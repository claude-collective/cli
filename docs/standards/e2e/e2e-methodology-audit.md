# E2E Test Methodology Audit

> Which E2E tests actually test user journeys vs which are fake integration tests?

**Date:** 2026-03-14
**Audited by:** CLI Tester Agent
**Scope:** All 57 `.e2e.test.ts` files in `e2e/`

## Criteria

A **REAL E2E test** must:
1. Spawn the CLI binary (via `TerminalSession` for interactive, `runCLI` for non-interactive)
2. Send input the way a user would (keyboard keys, command-line args)
3. Assert on what the user sees (terminal output, files created on disk, exit codes)
4. Never import production source code directly (except constants like file paths, exit codes, type imports)

Acceptable imports from `src/cli/`:
- Constants: `CLAUDE_DIR`, `STANDARD_FILES`, `EXIT_CODES`, `SKILLS_DIR_PATH`, etc.
- Type imports: `type { SkillId }`, `type { AgentName }`, etc.
- Test helpers: `renderSkillMd`, `renderConfigTs` (test data generators)
- Guard functions: `isClaudeCLIAvailable()` (used for conditional skip, not under test)

**NOT acceptable** (makes it a fake E2E):
- Importing and calling production functions directly (e.g., `writeScopedConfigs()`, `splitConfigByScope()`, `initializeMatrix()`)
- Calling `execCommand("claude", ...)` to test the Claude CLI directly (that's testing a third-party binary, not our CLI)
- Using `claudePluginInstall()`, `claudePluginMarketplaceAdd()` etc. — these call a different binary

---

## Summary

- **48 files are REAL E2E** (no changes needed)
- **3 files are FAKE E2E** (need rewrite)
- **6 files are MIXED** (some tests need rewrite)
- **57 files total**

---

## Real E2E (no changes needed)

These files spawn `agentsinc` via `runCLI` or `TerminalSession`, pass args/keyboard input, and assert on output.

| File | Tests | Approach |
|------|-------|----------|
| `commands/build-agent-plugins.e2e.test.ts` | 7 | `runCLI` |
| `commands/build.e2e.test.ts` | 10 | `runCLI` |
| `commands/compile.e2e.test.ts` | 14 | `runCLI` |
| `commands/compile-edge-cases.e2e.test.ts` | 7 | `runCLI` |
| `commands/config.e2e.test.ts` | 4 | `runCLI` |
| `commands/diff.e2e.test.ts` | 12 | `runCLI` |
| `commands/doctor.e2e.test.ts` | 12 | `runCLI` |
| `commands/dual-scope.e2e.test.ts` | 6 | `runCLI` |
| `commands/eject.e2e.test.ts` | 11 | `runCLI` |
| `commands/help.e2e.test.ts` | 8 | `execa` (direct binary spawn) |
| `commands/import-skill.e2e.test.ts` | 9 | `runCLI` |
| `commands/info.e2e.test.ts` | 12 | `runCLI` |
| `commands/list.e2e.test.ts` | 11 | `runCLI` |
| `commands/new-agent.e2e.test.ts` | 8 | `runCLI` |
| `commands/new-marketplace.e2e.test.ts` | 12 | `runCLI` |
| `commands/new-skill.e2e.test.ts` | 12 | `runCLI` |
| `commands/outdated.e2e.test.ts` | 10 | `runCLI` |
| `commands/plugin-build.e2e.test.ts` | 6 | `runCLI` |
| `commands/relationships.e2e.test.ts` | ~5 | `runCLI` |
| `commands/uninstall.e2e.test.ts` | ~10 | `runCLI` |
| `commands/uninstall-preservation.e2e.test.ts` | ~8 | `runCLI` |
| `commands/validate.e2e.test.ts` | ~10 | `runCLI` |
| `interactive/build-stack.e2e.test.ts` | ~5 | `TerminalSession` + `runCLI` |
| `interactive/edit-agent-scope-routing.e2e.test.ts` | ~4 | `TerminalSession` |
| `interactive/edit-skill-accumulation.e2e.test.ts` | ~4 | `TerminalSession` |
| `interactive/edit-wizard.e2e.test.ts` | ~6 | `TerminalSession` |
| `interactive/edit-wizard-local.e2e.test.ts` | ~10 | `TerminalSession` |
| `interactive/init-wizard-existing.e2e.test.ts` | ~5 | `TerminalSession` |
| `interactive/init-wizard-flags.e2e.test.ts` | ~4 | `TerminalSession` |
| `interactive/init-wizard-interactions.e2e.test.ts` | ~6 | `TerminalSession` |
| `interactive/init-wizard-navigation.e2e.test.ts` | ~5 | `TerminalSession` |
| `interactive/init-wizard-scratch.e2e.test.ts` | ~5 | `TerminalSession` |
| `interactive/init-wizard-sources.e2e.test.ts` | ~5 | `TerminalSession` |
| `interactive/init-wizard-stack.e2e.test.ts` | ~5 | `TerminalSession` |
| `interactive/init-wizard-ui.e2e.test.ts` | ~5 | `TerminalSession` |
| `interactive/real-marketplace.e2e.test.ts` | ~3 | `TerminalSession` |
| `interactive/search.e2e.test.ts` | ~5 | `TerminalSession` + `runCLI` |
| `interactive/smoke.e2e.test.ts` | 3 | `TerminalSession` |
| `interactive/uninstall.e2e.test.ts` | ~4 | `TerminalSession` |
| `interactive/update.e2e.test.ts` | ~4 | `TerminalSession` + `runCLI` |
| `lifecycle/cross-scope-lifecycle.e2e.test.ts` | ~3 | `TerminalSession` + `runCLI` |
| `lifecycle/dual-scope-edit.e2e.test.ts` | ~6 | `TerminalSession` + `runCLI` |
| `lifecycle/local-lifecycle.e2e.test.ts` | ~3 | `TerminalSession` + `runCLI` |
| `lifecycle/plugin-lifecycle.e2e.test.ts` | ~3 | `TerminalSession` + `runCLI` |
| `lifecycle/plugin-scope-lifecycle.e2e.test.ts` | ~3 | `TerminalSession` + `runCLI` |
| `lifecycle/re-edit-cycles.e2e.test.ts` | ~4 | `TerminalSession` + `runCLI` |
| `lifecycle/source-switching.e2e.test.ts` | ~6 | `TerminalSession` + `runCLI` |
| `integration/custom-agents.e2e.test.ts` | ~4 | `runCLI` |

---

## Fake E2E (need rewrite)

These files never spawn the `agentsinc` binary. They import production functions and call them directly.

### 1. `commands/plugin-install.e2e.test.ts`

| Problem | Detail |
|---------|--------|
| Imports production functions | `isClaudeCLIAvailable`, `claudePluginMarketplaceList`, `claudePluginInstall`, `claudePluginUninstall`, `execCommand` from `../../src/cli/utils/exec.js` |
| Tests a different binary | Calls `claude` (the Anthropic Claude CLI), not `agentsinc` |
| Never spawns our CLI | No `runCLI` or `TerminalSession` usage for the tests themselves |

**What it tests (intent):** Verifies that `claude plugin install`, `claude plugin marketplace add`, and `claude plugin uninstall` work — these are Claude CLI commands, not our CLI commands.

**What it should do instead:** These tests belong in an external dependency smoke test suite, not in our E2E tests. If kept, they should test our CLI's `plugin install` subcommand (not Claude's) by running `runCLI(["plugin", "install", ...])`. Alternatively, move to a dedicated `smoke/` directory and document that they test third-party CLI integration.

---

### 2. `lifecycle/home-isolation.e2e.test.ts`

| Problem | Detail |
|---------|--------|
| Imports production functions | `isClaudeCLIAvailable`, `execCommand` from `../../src/cli/utils/exec.js` |
| Tests a different binary | Calls `claude --version`, `claude plugin marketplace list`, `claude plugin marketplace add`, `claude plugin install` directly |
| Never spawns our CLI | No `runCLI` or `TerminalSession` usage |

**What it tests (intent):** Determines whether the Claude CLI's plugin commands work when `HOME` is set to a temp directory. This is infrastructure research, not a user journey test.

**What it should do instead:** This is an infrastructure probe, not an E2E test. Move to a `smoke/` or `probes/` directory. If kept as E2E, rewrite to test our CLI's behavior with isolated HOME (e.g., `runCLI(["init", "--source", ...], tempDir, { env: { HOME: tempDir } })` — which many other tests already do).

---

### 3. `integration/plugin-chain-poc.e2e.test.ts`

| Problem | Detail |
|---------|--------|
| Imports production functions | `isClaudeCLIAvailable`, `claudePluginMarketplaceAdd`, `claudePluginInstall` from `../../src/cli/utils/exec.js` |
| Tests a different binary | Calls `claude plugin marketplace add` and `claude plugin install` directly |
| Partially uses our CLI | Uses `createE2EPluginSource()` which internally calls `runCLI(["build", ...])`, but the core test chain calls Claude CLI directly |

**What it tests (intent):** Proves the full plugin build -> register -> install chain works by calling Claude CLI plugin commands directly.

**What it should do instead:** The build steps (which go through `createE2EPluginSource`) are real E2E. The Claude CLI calls (steps 3-5: marketplace add, plugin install, verify in registry) are testing a third-party binary. Either:
- Move the Claude CLI steps to a `smoke/` suite
- Rewrite to test our CLI's plugin lifecycle via `runCLI(["plugin", "install", ...])` if such commands exist

---

## Mixed (partial rewrite)

These files have some tests that are real E2E and some that are fake.

### 4. `commands/plugin-uninstall.e2e.test.ts`

| Real tests | Fake tests | Problem |
|------------|------------|---------|
| The `describe("uninstall with local config references plugin-mode skills")` block and others that use `runCLI(["uninstall", ...])` | The top-level `describe.skipIf(!claudeAvailable)("uninstall with plugins calls Claude CLI")` block | Imports `isClaudeCLIAvailable`, `claudePluginMarketplaceAdd`, `claudePluginInstall` from `../../src/cli/utils/exec.js`. The Claude-dependent tests call Claude CLI plugin commands directly to set up state, then run our `uninstall` command. The setup is fake (calls production functions), the assertion is real. |

**What the fake part tests (intent):** Tests that our `uninstall --yes` command correctly cleans up after plugin installation. The plugin install is done by calling `claudePluginInstall()` directly.

**What it should do instead:** The setup that calls `claudePluginInstall()` directly is acceptable IF it's clearly documented as integration with the Claude CLI. The test itself (running `runCLI(["uninstall", ...])`) is real E2E. The concern is that the file imports and calls production functions for setup. Consider extracting the Claude-dependent setup to a helper.

---

### 5. `interactive/edit-wizard-plugin.e2e.test.ts`

| Real tests | Fake tests | Problem |
|------------|------------|---------|
| All `TerminalSession` tests that drive the edit wizard | Guard check at top | Imports `isClaudeCLIAvailable` from `../../src/cli/utils/exec.js` — used only for conditional skip, not called as part of any test. |

**Verdict:** Borderline. The import of `isClaudeCLIAvailable` is used as a guard (`describe.skipIf`), not to test behavior. The actual tests are all real E2E via `TerminalSession`. **Low priority** — the import is for conditional skip logic, not testing production code paths.

---

### 6. `interactive/init-wizard-plugin.e2e.test.ts`

| Real tests | Fake tests | Problem |
|------------|------------|---------|
| All `TerminalSession` tests that drive the init wizard | Guard check at top | Same as edit-wizard-plugin: imports `isClaudeCLIAvailable` from `../../src/cli/utils/exec.js` for conditional skip. |

**Verdict:** Same as above — borderline. Low priority.

---

### 7. `lifecycle/unified-config-view.e2e.test.ts`

| Real tests | Fake tests | Problem |
|------------|------------|---------|
| `describe("dual-scope compile verification")` — uses `runCLI(["compile"], ...)` | `describe("writeScopedConfigs empty project guard")` — calls `writeScopedConfigs()` directly | Imports `writeScopedConfigs` from `../../src/cli/lib/installation/local-installer.js`, `splitConfigByScope` from `../../src/cli/lib/configuration/config-generator.js`, `initializeMatrix` from `../../src/cli/lib/matrix/matrix-provider.js`, `EMPTY_MATRIX` from `../../src/cli/lib/__tests__/mock-data/mock-matrices.js`, `buildProjectConfig` from `../../src/cli/lib/__tests__/helpers.js` |
| | `describe("splitConfigByScope correctness")` — calls `splitConfigByScope()` directly | Pure unit tests of production functions, no binary spawned |

**What the fake parts test (intent):**
- `writeScopedConfigs empty project guard`: Tests that `writeScopedConfigs()` skips writing project config when there are no project-scoped items. Calls the function directly, mutates `process.env.HOME`.
- `splitConfigByScope correctness`: Pure unit tests of the `splitConfigByScope()` function — splits config by scope. Zero CLI involvement.

**What they should do instead:**
- The `writeScopedConfigs` tests are **unit/integration tests** and should live in `src/cli/lib/installation/__tests__/local-installer.test.ts` or similar.
- The `splitConfigByScope` tests are **pure unit tests** and should live in `src/cli/lib/configuration/__tests__/config-generator.test.ts`.
- The `dual-scope compile verification` test is a real E2E and can stay.
- The file also directly mutates `process.env.HOME` (lines 63, 93, 103, 142) which is a side effect that can leak between tests.

---

### 8. `lifecycle/dual-scope-edit.e2e.test.ts`

| Real tests | Fake tests | Problem |
|------------|------------|---------|
| All tests use `TerminalSession` to drive the wizard | Guard check at top | Imports `isClaudeCLIAvailable` from `../../src/cli/utils/exec.js` for conditional skip. |

**Verdict:** Same pattern as edit-wizard-plugin — borderline. The actual tests are real E2E. Low priority.

---

### 9. `lifecycle/source-switching.e2e.test.ts`

| Real tests | Fake tests | Problem |
|------------|------------|---------|
| All tests use `TerminalSession` to drive the wizard | Guard check at top | Imports `isClaudeCLIAvailable` from `../../src/cli/utils/exec.js` for conditional skip. |

**Verdict:** Same pattern. Low priority.

---

## Severity Classification

### HIGH (should be rewritten or relocated)

| File | Severity | Reason |
|------|----------|--------|
| `lifecycle/unified-config-view.e2e.test.ts` | **HIGH** | 2 out of 3 describe blocks are pure unit/integration tests calling production functions directly. Also mutates `process.env.HOME`. |
| `commands/plugin-install.e2e.test.ts` | **HIGH** | Entire file tests the Claude CLI binary, not our CLI. Zero `runCLI` or `TerminalSession`. |
| `lifecycle/home-isolation.e2e.test.ts` | **HIGH** | Entire file tests the Claude CLI binary, not our CLI. Zero `runCLI` or `TerminalSession`. |
| `integration/plugin-chain-poc.e2e.test.ts` | **HIGH** | Steps 3-5 (out of 5) call Claude CLI directly. Only steps 1-2 go through our build pipeline. |

### LOW (guard imports only — no action needed)

| File | Severity | Reason |
|------|----------|--------|
| `interactive/edit-wizard-plugin.e2e.test.ts` | LOW | `isClaudeCLIAvailable` used only for `describe.skipIf` |
| `interactive/init-wizard-plugin.e2e.test.ts` | LOW | Same |
| `lifecycle/dual-scope-edit.e2e.test.ts` | LOW | Same |
| `lifecycle/source-switching.e2e.test.ts` | LOW | Same |
| `commands/plugin-uninstall.e2e.test.ts` | LOW | Claude CLI used for setup only; actual test uses `runCLI` |

---

## Recommended Actions

### Priority 1: Move unit tests out of E2E directory

**`lifecycle/unified-config-view.e2e.test.ts`**
- Move `writeScopedConfigs empty project guard` tests to `src/cli/lib/installation/__tests__/local-installer.test.ts`
- Move `splitConfigByScope correctness` tests to `src/cli/lib/configuration/__tests__/config-generator.test.ts`
- Keep `dual-scope compile verification` as the only test in the E2E file (or merge it into `commands/dual-scope.e2e.test.ts`)

### Priority 2: Relocate Claude CLI smoke tests

**`commands/plugin-install.e2e.test.ts`**, **`lifecycle/home-isolation.e2e.test.ts`**, **`integration/plugin-chain-poc.e2e.test.ts`**
- Create a `smoke/claude-cli/` directory
- Move these files there to clearly separate "testing our CLI" from "testing the Claude CLI binary"
- Rename from `.e2e.test.ts` to `.smoke.test.ts` to clarify they are not E2E tests

### Priority 3: No action needed

The LOW severity files (`isClaudeCLIAvailable` guard imports) are fine as-is. The guard is test infrastructure, not production code being tested.

---

## Appendix: Production function imports by file

| File | Production imports (excluding constants/types) |
|------|------------------------------------------------|
| `commands/plugin-install.e2e.test.ts` | `isClaudeCLIAvailable`, `claudePluginMarketplaceList`, `claudePluginInstall`, `claudePluginUninstall`, `execCommand` |
| `commands/plugin-uninstall.e2e.test.ts` | `isClaudeCLIAvailable`, `claudePluginMarketplaceAdd`, `claudePluginInstall` |
| `lifecycle/home-isolation.e2e.test.ts` | `isClaudeCLIAvailable`, `execCommand` |
| `lifecycle/unified-config-view.e2e.test.ts` | `writeScopedConfigs`, `splitConfigByScope`, `initializeMatrix`, `EMPTY_MATRIX`, `buildProjectConfig` |
| `integration/plugin-chain-poc.e2e.test.ts` | `isClaudeCLIAvailable`, `claudePluginMarketplaceAdd`, `claudePluginInstall` |
| `interactive/edit-wizard-plugin.e2e.test.ts` | `isClaudeCLIAvailable` (guard only) |
| `interactive/init-wizard-plugin.e2e.test.ts` | `isClaudeCLIAvailable` (guard only) |
| `lifecycle/dual-scope-edit.e2e.test.ts` | `isClaudeCLIAvailable` (guard only) |
| `lifecycle/source-switching.e2e.test.ts` | `isClaudeCLIAvailable` (guard only) |
| `lifecycle/plugin-lifecycle.e2e.test.ts` | `isClaudeCLIAvailable` (guard only) |
| `lifecycle/plugin-scope-lifecycle.e2e.test.ts` | `isClaudeCLIAvailable` (guard only) |

All other 46 files import only constants (`CLAUDE_DIR`, `STANDARD_FILES`, etc.), types (`SkillId`, `AgentName`), test data generators (`renderSkillMd`, `renderConfigTs`), or E2E helpers (`test-utils.js`, `terminal-session.js`, `create-e2e-source.js`, `plugin-assertions.js`).
