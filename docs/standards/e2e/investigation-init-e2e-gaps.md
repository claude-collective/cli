# Investigation: Init Command E2E Test Coverage Gaps

**Date:** 2026-03-13
**Context:** A bug where `init` with plugin mode failed because `sourceResult.marketplace` was undefined (the `BUILT_IN_MATRIX` optimization skips `marketplace.json` fetch). E2E tests didn't catch this.

---

## 1. Current State of Init E2E Test Coverage

There are **five test files** covering the init command's installation flow, none of which exercise the full command:

### File 1: `src/cli/lib/__tests__/integration/init-end-to-end.integration.test.ts`

**Despite the name, this is NOT an end-to-end test.** It calls `installLocal()` and `installPluginConfig()` directly -- the internal functions from `local-installer.ts` -- rather than running the `init` command.

- **What it tests:** wizard store -> `buildWizardResultFromStore()` -> `installLocal()` / `installPluginConfig()`
- **What it skips:** The entire `Init.run()` method (lines 253-370 of `init.tsx`), including:
  - `loadSkillsMatrixFromSource()` which constructs `sourceResult` (and may or may not set `marketplace`)
  - `handleInstallation()` which routes to `installIndividualPlugins()` vs `installLocalMode()`
  - `installIndividualPlugins()` (lines 394-487) which does the lazy `fetchMarketplace()` call, registers the marketplace, and runs `claudePluginInstall()` **before** calling `installPluginConfig()`
  - The `Wizard` React component render and its `onComplete` callback

**Plugin mode test (line 205-244):** Calls `installPluginConfig()` directly with a pre-built `sourceResult`. This `sourceResult` is constructed via `buildSourceResult()` from `helpers.ts` (line 47), which **never sets `marketplace`** (it's not in the factory's default shape). The test passes because `installPluginConfig` itself doesn't read `sourceResult.marketplace` -- the marketplace gate logic lives in `installIndividualPlugins()` on the Init command class.

### File 2: `src/cli/lib/__tests__/integration/init-flow.integration.test.ts`

Same pattern as above -- calls `installLocal()` directly. Tests local mode only (no plugin mode tests). Tests config structure, skill copying, agent compilation, merge behavior.

### File 3: `src/cli/lib/__tests__/commands/init.test.ts`

Uses `runCliCommand(["init"])` to exercise the actual command, but **only tests the "already initialized" dashboard path**. When `config.ts` already exists, `init` shows the dashboard and returns. No tests for the fresh-init wizard flow.

Why: The wizard renders an interactive Ink component. `runCliCommand()` captures stdout/stderr but cannot interact with the wizard (no `stdin.write()` capability). The test can only verify the non-interactive dashboard branch.

### File 4: `src/cli/lib/__tests__/integration/wizard-flow.integration.test.tsx`

Tests the Wizard component with `ink-testing-library`'s `render()` + `stdin.write()` for keyboard interaction. Tests wizard navigation, selection flows, and `onComplete` callback results. But **stops at the `onComplete` boundary** -- never feeds the `WizardResultV2` into `handleInstallation()`.

### File 5: `src/cli/lib/__tests__/integration/install-mode.integration.test.ts`

Tests `installLocal()` directly. Tests install mode persistence (local vs plugin source flags on `SkillConfig[]`). Calls `installLocal()` even for plugin-mode config -- meaning it tests config generation but not the `installIndividualPlugins()` pipeline.

---

## 2. What's Tested vs What's Not

### Tested (with direct function calls)

| Area                                      | Files                                       | Notes                                                     |
| ----------------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| `installLocal()` config generation        | init-flow, init-e2e, install-mode           | Thorough: config structure, skills, agents, merge, stacks |
| `installPluginConfig()` config generation | init-e2e (lines 205-244)                    | Config + agents only, no plugin install                   |
| Wizard store -> `WizardResultV2`          | init-e2e (via `buildWizardResultFromStore`) | Good coverage of customize & stack paths                  |
| Agent compilation from config             | init-flow, init-e2e, wizard-init-compile    | Files written, content verified                           |
| Skill copying                             | init-flow (lines 99-123)                    | SKILL.md presence and content                             |
| Already-initialized dashboard             | init.test.ts                                | `runCliCommand(["init"])` with existing config            |
| Wizard UI navigation                      | wizard-flow.integration.test.tsx            | Ink component with keyboard simulation                    |

### NOT Tested (the gaps)

| Gap                                                             | Where It Should Be       | Impact                                                      |
| --------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| **`Init.run()` full flow**                                      | No file exercises this   | The command entry point is untested for fresh init          |
| **`handleInstallation()` routing**                              | init.tsx line 372-392    | `deriveInstallMode()` -> plugin vs local branch             |
| **`installIndividualPlugins()` pipeline**                       | init.tsx lines 394-487   | Marketplace resolution, plugin install, config generation   |
| **Lazy `fetchMarketplace()` in plugin mode**                    | init.tsx lines 401-409   | **This is the exact gap that caused the bug**               |
| **`loadSkillsMatrixFromSource()` integration**                  | source-loader.ts line 69 | BUILT_IN_MATRIX path vs remote path, marketplace population |
| **`sourceResult.marketplace` being undefined**                  | source-loader.ts line 93 | Set from `sourceConfig.marketplace` which may be undefined  |
| **Plugin install via `claudePluginInstall()`**                  | init.tsx lines 431-442   | External command execution                                  |
| **Marketplace registration via `claudePluginMarketplaceAdd()`** | init.tsx lines 417-428   | External command execution                                  |
| **Fallback from plugin to local mode on marketplace error**     | init.tsx lines 405-409   | `this.warn(...)` then `installLocalMode()`                  |

---

## 3. The Specific Gap That Let the Marketplace Gate Bug Through

The bug was in `Init.installIndividualPlugins()` (init.tsx line 401):

```typescript
if (!sourceResult.marketplace) {
  try {
    const marketplaceResult = await fetchMarketplace(sourceResult.sourceConfig.source, {});
    sourceResult.marketplace = marketplaceResult.marketplace.name;
  } catch {
    this.warn("Could not resolve marketplace. Falling back to Local Mode...");
    await this.installLocalMode(result, sourceResult, flags, projectDir);
    return;
  }
}
```

The `BUILT_IN_MATRIX` path in `loadSkillsMatrixFromSource()` (source-loader.ts line 81-94) sets `marketplace: sourceConfig.marketplace`. When `sourceConfig.marketplace` is undefined (first-time init with default source, no existing project config), `sourceResult.marketplace` is undefined.

The lazy `fetchMarketplace()` call then fires. If the default source doesn't have a `marketplace.json` or the fetch fails, the init falls back to local mode unexpectedly.

**Why tests missed it:**

1. `init-end-to-end.integration.test.ts` calls `installPluginConfig()` directly (line 218), skipping `installIndividualPlugins()` entirely. The marketplace gate logic on lines 401-409 of `init.tsx` is never executed.

2. `buildSourceResult()` in `helpers.ts` (line 234-250) constructs a `SourceLoadResult` without `marketplace`:

   ```typescript
   return {
     matrix,
     sourceConfig,
     sourcePath,
     isLocal: true,
     ...overrides,
   };
   ```

   No test passes `marketplace` in overrides.

3. The test named "plugin mode with explicit agent selection" (init-e2e line 205) only verifies that `installPluginConfig()` produces config and agents -- it doesn't verify the preceding marketplace resolution step.

---

## 4. Recommended Test Cases

### Priority 1: Integration test for `installIndividualPlugins()` pipeline

Test the full `handleInstallation() -> installIndividualPlugins()` path. This requires mocking:

- `fetchMarketplace()` to return a known marketplace name
- `claudePluginMarketplaceExists()` to return true/false
- `claudePluginMarketplaceAdd()` to succeed
- `claudePluginInstall()` to succeed
- `installPluginConfig()` can use the real implementation (already tested)

**Test cases:**

1. **Plugin mode with `sourceResult.marketplace` set** -- should skip `fetchMarketplace()` and proceed to install plugins
2. **Plugin mode with `sourceResult.marketplace` undefined** -- should call `fetchMarketplace()`, set marketplace, then proceed
3. **Plugin mode with `fetchMarketplace()` failing** -- should fallback to local mode with warning
4. **Plugin mode with new marketplace** -- should call `claudePluginMarketplaceAdd()`
5. **Plugin mode with existing marketplace** -- should skip `claudePluginMarketplaceAdd()`

### Priority 2: `loadSkillsMatrixFromSource()` integration test for marketplace population

Test that the source loader correctly populates `marketplace` on `SourceLoadResult`:

1. **Default source (BUILT_IN_MATRIX path)** with `sourceConfig.marketplace` undefined -- `marketplace` should be undefined on result
2. **Default source with `sourceConfig.marketplace` set** -- `marketplace` should propagate
3. **Remote source with `marketplace.json`** -- `marketplace` should be set from fetched data
4. **Remote source without `marketplace.json`** -- `marketplace` should remain undefined

### Priority 3: `handleInstallation()` routing test

Test that `deriveInstallMode()` correctly routes to plugin vs local:

1. Skills with `source: "agents-inc"` -> plugin mode -> `installIndividualPlugins()`
2. Skills with `source: "local"` -> local mode -> `installLocalMode()`
3. Mixed skills (both plugin and local sources) -> routes to `installLocalMode()`, meaning plugin-source skills in a mixed set never get `claudePluginInstall()` called. Note: this may be a bug (plugin skills silently downgraded to local) or intentional behavior that needs documentation.

---

## 5. Can the Init Command Be Tested End-to-End?

### Current Infrastructure Limitations

The init command has **two distinct phases** with different testability:

**Phase 1: Interactive Wizard (Hard to test E2E)**

- Renders an Ink `<Wizard>` component
- Requires keyboard interaction (arrow keys, enter, space)
- `runCliCommand()` can capture output but cannot write to stdin
- `ink-testing-library` can render and interact, but only for the component -- not the full oclif command wrapper

**Phase 2: Installation Pipeline (Can be tested, but isn't)**

- `handleInstallation()` -> `installIndividualPlugins()` or `installLocalMode()`
- Pure function calls with side effects (file writes, external commands)
- These are private methods on the `Init` class, so they can't be called directly from tests

### What Would a Proper E2E Test Look Like?

**Option A: Mock the Wizard, test the rest**

The most practical approach. Mock `ink`'s `render()` to immediately call `onComplete` with a known `WizardResultV2`. Mock the external commands (`claudePluginInstall`, etc.) but let the real `loadSkillsMatrixFromSource()`, `installPluginConfig()`, and file system operations run.

This is essentially what `edit.test.ts` does (lines 41-44): it mocks `ink.render` to resolve immediately, then tests the command logic around it.

```typescript
// Pattern from edit.test.ts
vi.mock("ink", async (importOriginal) => {
  const original = await importOriginal<typeof import("ink")>();
  return { ...original, render: mockRender };
});
```

For init, the mock render would need to:

1. Capture the `onComplete` callback from the Wizard props
2. Call it with a `WizardResultV2` containing plugin-mode skills
3. Let `handleInstallation()` run

Additional mocks needed:

- `loadSkillsMatrixFromSource()` -- return a `SourceLoadResult` with or without `marketplace`
- `claudePluginInstall()`, `claudePluginMarketplaceExists()`, `claudePluginMarketplaceAdd()` -- mock external commands
- `fetchMarketplace()` -- mock for the lazy resolution case

**Option B: Extract `handleInstallation()` as a testable function**

Move `handleInstallation()`, `installIndividualPlugins()`, and `installLocalMode()` out of the Init class into standalone exported functions. Then test them directly without needing the oclif command infrastructure. This is a code change but would make the most critical logic testable.

**Option C: Full E2E with test harness (expensive)**

Create a test harness that spawns the CLI as a subprocess, pipes stdin/stdout, and drives the wizard with escape sequences. This is the highest-fidelity approach but also the most complex and flaky.

### Original Recommendation (SUPERSEDED — see Section 7)

~~**Option A is the right approach.**~~ This was superseded after proving the Claude CLI works in the test environment. Option C (full E2E with the real Claude CLI) is now the correct approach.

---

## 6. Original Next Steps (SUPERSEDED — see Section 8)

### Step 1: Add `handleInstallation()` test for plugin mode (HIGH PRIORITY)

Create tests in `src/cli/lib/__tests__/commands/init.test.ts` that:

1. Mock `ink.render` to trigger `onComplete` with a plugin-mode `WizardResultV2`
2. Mock `loadSkillsMatrixFromSource` to return `SourceLoadResult` **without** `marketplace` (BUILT_IN_MATRIX path)
3. Mock `fetchMarketplace` to control marketplace resolution
4. Mock `claudePluginInstall`, `claudePluginMarketplaceExists`, `claudePluginMarketplaceAdd`
5. Let `installPluginConfig` run with a real test source directory
6. Verify the full pipeline completes: marketplace resolved -> plugins installed -> config written -> agents compiled

This directly prevents the marketplace gate bug class.

### Step 2: Fix `buildSourceResult()` factory to support `marketplace` (MEDIUM PRIORITY)

Update `buildSourceResult()` in `helpers.ts` to optionally accept `marketplace`:

```typescript
export function buildSourceResult(
  matrix: MergedSkillsMatrix,
  sourcePath: string,
  overrides?: Partial<SourceLoadResult>,
): SourceLoadResult {
  // ...existing code...
  // marketplace can be set via overrides
}
```

This is already supported via `overrides`, but no test uses it. Add explicit plugin-mode test constants that include `marketplace`.

### Step 3: Add marketplace-undefined scenario to init-end-to-end (MEDIUM PRIORITY)

In `init-end-to-end.integration.test.ts`, the "plugin mode" describe block (line 205) should have a test variant where `sourceResult.marketplace` is explicitly `undefined`. Even though this test calls `installPluginConfig()` directly (which doesn't use marketplace), it documents the expectation and catches regressions if `installPluginConfig` starts using marketplace.

### Step 4: Add `loadSkillsMatrixFromSource()` integration test for marketplace (LOW PRIORITY)

Test that the BUILT_IN_MATRIX path correctly propagates `sourceConfig.marketplace` to the result. This is more of a unit test for source-loader.ts but validates the root cause of the bug.

### Step 5: Consider extracting `installIndividualPlugins()` (FUTURE)

If Step 1 proves too complex with mocks, extract `installIndividualPlugins()` from the Init class into a standalone function in `local-installer.ts`. This would make it directly testable without oclif/Ink mocks.

---

## Summary

The gap is architectural: the test suite thoroughly tests **internal functions** (`installLocal`, `installPluginConfig`) but never exercises the **command-level orchestration** (`Init.run()`, `handleInstallation()`, `installIndividualPlugins()`). The marketplace gate bug lived in that orchestration layer -- specifically in `installIndividualPlugins()` which is a private method on the Init class that no test calls.

**Resolution:** After proving the Claude CLI doesn't hang (Section 7), the approach shifted from "mock everything" to "test against the real CLI." The E2E framework design (`todo/e2e-framework-design.md`) adds plugin-mode tests in 5 phases, using `describe.skipIf(!claudeAvailable)` for CI compatibility. The Claude CLI is not a third-party dependency to mock away -- it's the runtime we target, and we want our tests to fail if its contract changes.

The fix is to add command-level tests following the `edit.test.ts` pattern: mock `ink.render` and external commands, then run the command via `runCliCommand(["init"])` or direct class instantiation. This tests the orchestration logic that glues the wizard output to the installation pipeline.

---

## 7. Resolution: Claude CLI Does NOT Hang (2026-03-13)

### The Claim

A comment in `edit-wizard.e2e.test.ts` stated:

```
// Use a local E2E source to avoid triggering `claude plugin install/uninstall`
// commands that hang when a real `claude` binary is present on the system.
```

This led the entire test suite to avoid plugin-mode E2E tests.

### The Proof

We wrote a smoke test (`e2e/commands/plugin-install.e2e.test.ts`) that calls the real Claude CLI directly:

- `claude --version` -- completes instantly
- `claude plugin marketplace list --json` -- returns array, no hang
- `claude plugin marketplace add <dir>` -- completes (may fail on format, but doesn't hang)
- `claude plugin install <nonexistent>` -- fails fast with error, no hang
- `claude plugin uninstall <nonexistent>` -- completes silently, no hang
- Raw `execCommand("claude", ["plugin", "install", ...])` -- completes, no hang

**All 8 tests pass in 1.7 seconds.** The Claude CLI does not hang.

The original "hanging" was likely caused by the interactive `checkPermissions()` Ink component that renders after installation -- not the `claude plugin install` command itself.

### Implications

- **Option C (full E2E with real CLI) is now viable and preferred**
- The existing E2E infrastructure (TerminalSession, HOME isolation, temp dirs) already solves environment isolation
- Plugin-mode E2E tests should use `describe.skipIf(!claudeAvailable)` for CI environments without Claude
- No need to mock `claudePluginInstall`, `claudePluginMarketplaceAdd`, etc. -- test against the real thing

---

## 8. Revised Next Steps: Real CLI E2E Framework

See `todo/e2e-framework-design.md` for the full design document.

### Principles

1. **Use the real Claude CLI** -- Don't mock what can be tested for real
2. **Don't manually create output files** -- Let the CLI produce files, verify they exist
3. **Minimal mocking** -- Only mock truly external network calls
4. **Test user flows, not functions** -- Run `node bin/run init`, don't call `installLocal()` directly
5. **Plugin mode as first-class** -- Every init/edit/uninstall flow gets a plugin-mode variant

### Phases

| Phase                           | Scope                                              | Effort |
| ------------------------------- | -------------------------------------------------- | ------ |
| 1. Infrastructure               | Add marketplace.json to E2E source, plugin helpers | 2-3h   |
| 2. Non-interactive plugin tests | Verify CLI output + side effects with `runCLI`     | 4-6h   |
| 3. Interactive plugin tests     | Drive wizard via TerminalSession in plugin mode    | 4-6h   |
| 4. Edit/uninstall plugin tests  | Full CRUD lifecycle for plugins                    | 4-6h   |
| 5. Full lifecycle tests         | Init -> Edit -> Compile -> Uninstall               | 2-3h   |

### What Stays, What Changes

- **Keep:** Existing local-mode E2E tests, TerminalSession infrastructure, integration tests that test config structure/compilation
- **Add:** Plugin-mode E2E tests using real Claude CLI with `describe.skipIf(!claudeAvailable)`
- **Don't mock:** The Claude CLI -- it's fast, deterministic, and we WANT to know if it breaks

---

## 9. Review Notes (2026-03-13)

A thorough review of this investigation document was performed against the current source code. Key findings:

- **File count mismatch corrected:** Section 1 intro said "four test files" but listed five. Fixed to "five."
- **Line references have drifted 6-8 lines in init.tsx** since writing. Non-blocking -- the code has evolved but the referenced functions and logic are still in the same locations. Line numbers are approximate.
- **All function signatures and data flow descriptions verified accurate** against current source. The analysis of `installIndividualPlugins()`, `handleInstallation()`, `loadSkillsMatrixFromSource()`, and the marketplace gate logic remains correct.
- **Mixed install mode gap identified and added to Priority 3:** `deriveInstallMode()` routes mixed plugin+local sets to `installLocalMode()`, silently skipping `claudePluginInstall()` for plugin-source skills. This may be a bug or intentional -- flagged for investigation.
- **Investigation findings are consistent with the companion framework design doc** (`todo/e2e-framework-design.md`). No contradictions found between the two documents.
- **Resolution in Sections 7-8 (real CLI E2E approach) confirmed as the correct strategy** after the smoke test proof that the Claude CLI does not hang.
