# E2E Testing Strategy Audit: Gaps and Blind Spots

**Auditor:** CLI Tester Agent
**Date:** 2026-02-25
**Document under audit:** `docs/research/e2e-testing-strategy.md`
**Status:** Findings ready for review

---

## 1. Missing Commands / Features

The document covers 8 user journeys focusing on `init`, `edit`, `compile`, `validate`, `eject`, and `uninstall`. The actual `src/cli/commands/` directory contains **24 commands** across 7 command groups. The following are entirely absent from the document:

### Commands Not Mentioned Anywhere

| Command                               | Type                  | Interactive? | Why It Matters                                                                                                                                                                                  |
| ------------------------------------- | --------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cc doctor`                           | Non-interactive       | No           | Runs 6+ diagnostic checks (config validity, source reachability, skill integrity, agent compilation, matrix health). Perfect Layer 3 candidate.                                                 |
| `cc diff`                             | Non-interactive       | No           | Compares local skills against source, generates unified diffs. Tests the `forked_from` metadata chain.                                                                                          |
| `cc info <skill>`                     | Non-interactive       | No           | Displays skill detail (content preview, relations, suggestions). Tests skill resolution and display formatting.                                                                                 |
| `cc list` (alias: `cc ls`)            | Non-interactive       | No           | Shows installation info (local vs plugin, skill count). Tests plugin discovery.                                                                                                                 |
| `cc outdated`                         | Non-interactive       | No           | Compares local skill hashes against source hashes, shows tabular diff. Tests versioning/hash computation.                                                                                       |
| `cc search`                           | **Interactive (Ink)** | **Yes**      | Full interactive skill search with text input, multi-select, install flow. Uses `SkillSearch` component with `useInput` and `useTextInput`. This is a **completely untested interactive flow**. |
| `cc update`                           | **Interactive (Ink)** | **Yes**      | Compares skills, prompts for confirmation with Ink `Confirm` component. Updates skills in-place and recompiles agents.                                                                          |
| `cc import skill <source>`            | Non-interactive       | No           | Fetches skills from GitHub repos (`github:owner/repo`, `gh:`, HTTPS URLs). Tests the entire remote fetching pipeline.                                                                           |
| `cc new agent`                        | **Interactive (Ink)** | **Yes**      | Text input for agent purpose, spawns Claude CLI subprocess for generation.                                                                                                                      |
| `cc new skill`                        | Non-interactive       | No           | Scaffolds skill directory with SKILL.md + metadata.yaml.                                                                                                                                        |
| `cc new marketplace`                  | Non-interactive       | No           | Scaffolds full marketplace directory structure.                                                                                                                                                 |
| `cc build marketplace`                | Non-interactive       | No           | Generates marketplace.json from built plugins. Skills repo authoring command.                                                                                                                   |
| `cc build plugins`                    | Non-interactive       | No           | Compiles skills and agents into standalone npm plugins.                                                                                                                                         |
| `cc build stack`                      | **Interactive (Ink)** | **Yes**      | Stack selector prompt, then compiles a stack into a plugin.                                                                                                                                     |
| `cc config` / `cc config show`        | Non-interactive       | No           | Displays effective configuration with origin layers.                                                                                                                                            |
| `cc config get <key>`                 | Non-interactive       | No           | Gets a single config value.                                                                                                                                                                     |
| `cc config set-project <key> <value>` | Non-interactive       | No           | Sets project-level config.                                                                                                                                                                      |
| `cc config unset-project <key>`       | Non-interactive       | No           | Removes project-level config value.                                                                                                                                                             |
| `cc config path`                      | Non-interactive       | No           | Shows config file paths.                                                                                                                                                                        |

### Impact Assessment

- **4 interactive commands** (`search`, `update`, `new agent`, `build stack`) are completely absent from the E2E strategy. These are node-pty candidates.
- **14 non-interactive commands** are absent. These are straightforward execa candidates and would be the easiest wins for Layer 3.
- The `cc search` command is particularly notable: it is a standalone interactive Ink application with text input, list navigation, multi-select, and install-on-complete flow. It is one of the most complex interactive flows outside the wizard.

### Recommendation

Add a Journey 9 covering `cc search` (interactive skill search and install). Add Layer 3 tests for at minimum: `doctor`, `diff`, `outdated`, `info`, `list`, `import skill`, `new skill`, `config show`, `config set-project`, `config get`.

---

## 2. Bound Skills / Search Feature

The document has **zero mentions** of:

- Bound skills (`BoundSkill`, `BoundSkillCandidate`)
- `bindSkill` store action
- `searchExtraSources()` function
- `search-modal.tsx` component
- Search pill in source grid
- `boundSkillSchema`

This is a Phase 6 feature (Multi-Source UX 2.0) that allows users to search for skills across extra sources and bind them to aliases. The feature involves:

1. A search pill rendered in the `SourceGrid` component
2. A `SearchModal` overlay with keyboard navigation
3. `searchExtraSources()` calls to fetch remote skill candidates
4. `bindSkill` store mutation
5. Bound skills appearing in the wizard confirmation step

This is a complex interactive flow with network I/O, modal overlays, and store mutations. It has no E2E coverage plan.

### Recommendation

Add a dedicated Journey or sub-journey for: navigate to source grid, focus search pill, trigger search, navigate results, bind a skill, verify it appears in confirm step.

---

## 3. Multi-Source UX Coverage

The document partially covers multi-source through Journey 5 ("Changing Source Mid-Wizard") and mentions the `G` hotkey for settings. However, the coverage is shallow:

### What IS covered (superficially)

- Source grid navigation (Journey 5)
- `G` hotkey to open settings modal (Journey 5, text only)
- Archive/restore directory structure (File System Assertions for `edit`)

### What IS NOT covered

- **Adding a new source** via `G` -> settings -> text input -> Enter. This involves the `StepSettings` component with `useTextInput`, `useSourceOperations`, and `useModalState` hooks.
- **Removing a source** via settings modal with keyboard navigation and deletion.
- **Source loading failure** when a configured source URL is unreachable or returns invalid data. `multi-source-loader.ts` has fallback logic that is never tested end-to-end.
- **Source switching in edit mode** -- `source-switcher.ts` archive/restore flow during `cc edit`. The document mentions file output but not the interactive flow of switching sources while in the edit wizard.
- **`sourceSelections` persistence** -- verifying that after wizard completion, the config YAML correctly records which source was chosen per skill alias.
- **Installed skill dimming** -- Phase 4 added `installed?: boolean` on `CategoryOption` with dimmed checkmark prefix. Visual verification of this in PTY output.

### Recommendation

Expand Journey 5 or create a dedicated multi-source journey that covers: add source via settings, verify source appears in source grid, switch source for a skill alias, complete wizard, verify `sourceSelections` in config YAML, re-enter edit wizard, verify source choices are preserved.

---

## 4. Expert Mode Coverage

The document mentions the `E` hotkey in Journey 8 (Edit Command) as one of several hotkeys. Expert mode is a significant feature:

### What expert mode actually does (from codebase investigation)

- Toggles `expertMode` boolean in wizard store
- Bypasses all constraint checks in `isDisabled()` (allows conflicting skills)
- Bypasses category-disabled checks in `isCategoryAllDisabled()`
- Changes option sort order in `CategoryGrid` (preserves original order instead of sorting by recommended)
- Hides selection counter in `CategoryGrid`
- Persisted to `config.yaml` when true
- Restored on `cc edit` via `initialExpertMode` prop
- Shown in `wizard-layout.tsx` as a status indicator

### What the document does NOT cover

- No E2E test verifying that expert mode actually enables conflicting skill selection
- No verification that expert mode state persists to config
- No verification that `cc edit` restores expert mode from config
- No verification that constraint bypass works (selecting two conflicting skills)
- No verification of the visual indicator in the wizard layout

### Recommendation

Add explicit expert mode assertions to Journey 8: toggle E, verify indicator, select two conflicting skills that would normally be disabled, complete wizard, verify config has `expertMode: true`, re-enter edit, verify conflicting skills are still selected.

---

## 5. Error Scenarios

The document acknowledges error paths exist (Journey 5 mentions "error flows: invalid source, missing skills, Ctrl+C abort" in the Phase 3 plan) but provides no concrete test designs for error scenarios.

### Missing error paths

| Scenario                                  | Current Coverage                                                                                                                     | Risk                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Network failure loading remote source** | Not tested. `fetchFromSource` in `source-fetcher.ts` uses `giget` for GitHub clones. No E2E test for timeout, DNS failure, or 404.   | High -- users on corporate networks, VPNs, or with intermittent connectivity will hit this regularly. |
| **Invalid/corrupt YAML in skill files**   | Not tested. `safeLoadYamlFile` and Zod schemas handle this in production code, but E2E would verify the user-visible error message.  | Medium -- marketplace maintainers could push broken YAML.                                             |
| **Permission denied errors**              | Not tested. Writing to `.claude/` when directory is read-only, or running in a directory without write permission.                   | Medium -- common in CI environments or shared servers.                                                |
| **Concurrent CLI invocations**            | Not mentioned at all. Two `cc compile` runs in the same project directory simultaneously. File locking? Race conditions?             | Low-medium -- unlikely in normal use but possible in CI scripts.                                      |
| **Ctrl+C mid-installation**               | Mentioned in Phase 3 plan but no test design. What happens to partially installed skills? Is the project left in a consistent state? | High -- users will Ctrl+C when installation is slow.                                                  |
| **Missing source directory**              | `--source /nonexistent/path` -- does the CLI give a clear error?                                                                     | Medium.                                                                                               |
| **Circular agent dependencies**           | Agent A includes Agent B which includes Agent A. Compilation should detect this.                                                     | Low.                                                                                                  |
| **Disk full during installation**         | Write failures mid-copy.                                                                                                             | Low -- but catastrophic if it corrupts existing installation.                                         |

### Recommendation

Create a dedicated error scenario test category. At minimum, test: invalid source flag, Ctrl+C during wizard (verify cleanup), Ctrl+C during installation (verify partial state), corrupt YAML in source.

---

## 6. CI/CD Gaps

### Test parallelization

The document states `singleFork: true` (sequential execution) for PTY tests. This is correct for PTY tests, but:

- No strategy for parallelizing Layer 3 (execa) tests, which CAN run in parallel since they use isolated temp directories
- No discussion of whether Layer 3 and Layer 4 tests run in the same vitest invocation or separate ones
- The vitest config shows a single `e2e/vitest.config.ts` with `singleFork` -- this forces ALL E2E tests to be sequential, even non-interactive ones that could be parallel

### CI job structure

The document says "run in separate CI job" but does not specify:

- Whether E2E tests block the PR merge (required check or optional)
- Whether E2E tests run on every push or only on PR / main
- Whether the existing ~2400 unit tests and E2E tests share a CI workflow file
- What the total CI time budget is (current unit tests + proposed E2E tests)

### Test matrix

The document recommends "Linux-first" for PTY tests. No mention of:

- Which Node.js versions to test (the existing tests likely test on a specific version)
- Whether `bun test` (the current test runner per CLAUDE.md) is used for E2E or if vitest runs directly via `npx vitest`
- Whether the `bun` runtime can spawn `node-pty` processes (bun has known compatibility gaps with native modules)

### Recommendation

Split vitest config: one for interactive PTY tests (sequential), one for non-interactive binary tests (parallel). Specify CI job as a separate workflow that runs on PR to main. Clarify bun vs node for E2E test execution. Add Node version matrix (at minimum, test on the version specified in `.node-version` or `engines`).

---

## 7. Migration Path

The document states "keep unit tests for fast feedback; E2E tests are the confidence layer" but does not address:

### What happens to existing integration tests?

The project has extensive integration tests in `src/cli/lib/__tests__/integration/`:

- `init-end-to-end.integration.test.ts`
- `wizard-flow.integration.test.tsx`
- `installation.test.ts`
- `source-switching.integration.test.ts`
- `compilation-pipeline.test.ts`
- `consumer-stacks-matrix.integration.test.ts`
- `wizard-init-compile-pipeline.test.ts`

And user journey tests in `src/cli/lib/__tests__/user-journeys/`:

- `install-compile.test.ts`
- `edit-recompile.test.ts`
- `compile-flow.test.ts`
- `config-precedence.test.ts`
- `user-journeys.integration.test.ts`

### Open questions not addressed

1. **Overlap**: The `wizard-flow.integration.test.tsx` already tests expert mode toggling, keyboard navigation, and multi-step wizard flows using ink-testing-library. If E2E tests cover the same flows via PTY, do these integration tests become redundant? Are they deleted, kept as-is, or demoted?

2. **Promotion**: Should any existing integration tests be promoted to E2E? For example, `source-switching.integration.test.ts` tests archive/restore logic by calling functions directly. An E2E version would invoke `cc edit --source <new-source>` and verify archive directories.

3. **Test data divergence**: The document flags (correctly) that `createMockMatrix()` builds synthetic data that may diverge from actual YAML. E2E tests using real source directories solve this. But who maintains alignment between mock factories and real data? Does adding E2E tests create a responsibility to keep both in sync?

4. **Incremental migration**: No phased plan for reducing reliance on mocked integration tests as E2E tests prove stable. Without this, the test suite grows (2400 unit + 20-30 E2E) without retiring redundant tests.

### Recommendation

Add a section on migration strategy: (a) identify which existing integration tests are fully superseded by E2E tests, (b) mark those for future removal after E2E tests prove stable for N CI runs, (c) define a rule for when a new test should be written as E2E vs integration vs unit.

---

## 8. Cost / Maintenance Concerns

### Who maintains E2E tests?

The document does not address:

- Whether E2E tests are maintained by the same developers who change the CLI
- Whether there is a designated owner for the E2E infrastructure (TerminalSession, verdaccio setup, CI config)
- Whether E2E test failures block releases

### UI change fragility

The wizard UI is actively evolving (Multi-Source UX 2.0 was 6 phases, web-extras domain split happened recently, scrolling was added as D-59). Each UI change can break E2E tests because:

- `waitForText("Select framework")` breaks if the label changes to "Choose a framework"
- Arrow key navigation counts change when new options are added to lists
- Tab order changes when new categories or domains are added

The document does not propose:

- A strategy for text constants (should E2E tests import string constants from the CLI source to avoid hardcoded strings?)
- An abstraction layer for wizard navigation (e.g., `wizard.selectDomain("web")` instead of `session.arrowDown(); session.arrowDown(); session.space()`)
- A policy on how often E2E tests are expected to break with feature changes

### Test brittleness estimation

For the 8 proposed journeys, I estimate:

- Journey 1-4 (init variants): Break whenever wizard step text changes, domain order changes, or skill list changes. **High churn.**
- Journey 5 (source change): Breaks whenever source grid UI changes. **Medium churn.**
- Journey 6 (plugin vs local): Breaks whenever install mode indicator text changes. **Low churn.**
- Journey 7 (uninstall): Breaks whenever confirmation prompt text changes. **Low churn.**
- Journey 8 (edit): Breaks whenever pre-selection display changes. **Medium churn.**

### Recommendation

Define a text constant extraction strategy (E2E tests reference constants from the CLI source, not hardcoded strings). Build semantic navigation helpers (`wizard.navigateToStep("build")`, `wizard.selectSkill("react")`) that encapsulate arrow key counts. Document expected maintenance overhead per journey.

---

## 9. Dependency Risks

### node-pty native compilation

- **Risk**: node-pty requires native compilation via node-gyp. New Node.js major versions (e.g., Node 24) can break native addon APIs.
- **The document acknowledges this** and suggests `@homebridge/node-pty-prebuilt-multiarch` or `@lydell/node-pty` for prebuilt binaries.
- **Missing analysis**: The prebuilt forks may lag behind node-pty releases. `@homebridge/node-pty-prebuilt-multiarch` is at `0.11.x` while `node-pty` is at `1.0.0`. The prebuilt fork may not have the same bug fixes.
- **Missing analysis**: The document does not mention whether `bun` (the project's test runner) can load native node-pty modules. Bun has known gaps with native addons. This could be a blocker.

### @xterm/headless

- **Status**: Actively maintained by the xterm.js project (same team as VS Code terminal). Currently at v6.0.0. 359 versions published.
- **Risk level**: Low. This is a core dependency of VS Code and has excellent maintenance.
- **Missing from document**: Version pinning strategy. The document shows `import { Terminal } from "@xterm/headless"` but doesn't specify which version. `@microsoft/tui-test` pins `@xterm/headless: ^5.3.0` -- our code would need `^6.0.0`.

### tree-kill

- **Status**: Last published 2018 (v1.2.2). 13 versions total. Zero dependencies.
- **Risk level**: Medium. The package works but is unmaintained. No updates in 8 years.
- **Missing from document**: Alternative analysis. `execa` v9 has process tree killing built in via `cleanup` and `forceKillAfterDelay` options. If we already depend on execa for Layer 3, we might not need tree-kill for those tests. Only PTY tests (where we use node-pty directly) would need it.
- **Missing from document**: What happens if `tree-kill` fails? The `SIGKILL` in the `destroy()` method has no error handling in the proposed code.

### verdaccio

- **Risk**: verdaccio v6 is actively maintained but complex. The document proposes programmatic `runServer()` which has had breaking API changes between verdaccio versions.
- **Missing from document**: Version pinning. Whether to use `verdaccio@6` or `verdaccio@latest`. The programmatic API is not semver-stable.
- **Missing from document**: Whether verdaccio is actually needed for Phase 1-3. The document proposes it for Layer 5 (Plugin Installation) which is Phase 4. It could be deferred entirely from the initial implementation.

### @microsoft/tui-test

- **The document references this but does not propose using it directly.** It proposes building a custom `TerminalSession` inspired by tui-test.
- **Risk**: tui-test is at `0.0.1-rc.5` (pre-release). 121 GitHub stars. 5 versions published. Using it directly would be risky.
- **The document's approach (build our own using the same primitives) is correct.** This is not a gap but worth noting that tui-test itself is not production-ready.

### Recommendation

Add a dependency version matrix to the document. Verify bun compatibility with node-pty before committing to the approach. Consider `execa`'s built-in process cleanup instead of `tree-kill` for Layer 3 tests. Defer verdaccio to Phase 4 explicitly.

---

## 10. Things That Could Be Tested But Are Not Mentioned

### Config file validation and precedence

The existing user journey tests include `config-precedence.test.ts` that tests env var > project config > default precedence. An E2E test would verify:

- `CC_SOURCE=/path/to/source cc compile` uses the env var source
- `cc config set-project source /path && cc compile` uses the project config
- Config file survives round-trip (write via wizard, read via compile)

### Plugin manifest format validation

After `cc compile` or `cc build plugins`, the generated `manifest.json` must conform to a schema. No E2E test validates that the manifest can be consumed by Claude Code (the downstream consumer).

### Agent compilation with different skill combinations

The document tests "compile produces correct output files" but does not test:

- Agent compilation with zero skills selected for a domain (edge case: empty agent?)
- Agent compilation with skills from multiple sources (bound skills + primary source)
- Agent compilation after expert mode override (conflicting skills selected)

### Stack installation with dependency conflicts

What happens when a stack references skills that do not exist in the current source? The wizard should show an error or skip missing skills. No E2E coverage.

### The `--source` flag with various source types

The CLI supports multiple source formats:

- Local path: `--source /home/user/skills`
- GitHub shorthand: `--source github:org/repo`
- GitHub HTTPS: `--source https://github.com/org/repo`
- `gh:` prefix: `--source gh:org/repo`

None of these source type variations are tested in the E2E strategy. The `import skill` command specifically handles all 4 formats with different code paths.

### `cc new agent` with Claude CLI integration

`new agent` spawns a Claude CLI subprocess via `child_process.spawn`. Testing this requires either mocking Claude CLI or having it available in CI. The document does not mention this command or the Claude CLI dependency.

### Help text consistency

The document mentions golden file testing (from GitHub CLI research) but never proposes it for this project. `cc --help`, `cc init --help`, etc. could use snapshot tests to catch help text regressions.

### `--verbose` flag behavior

Many commands accept `--verbose`. No E2E test verifies that verbose output is shown when the flag is present and hidden when absent.

---

## 11. Additional Observations

### The `bun test` Question

CLAUDE.md states tests are run with `bun test`. The document proposes `vitest` for E2E tests. These are compatible (bun can run vitest), but the document does not confirm:

- Whether `bun` can load `node-pty` native modules
- Whether `bun`'s vitest compatibility extends to `globalSetup`/`globalTeardown` (needed for verdaccio)
- Whether E2E tests use `bun test e2e/` or `npx vitest --config e2e/vitest.config.ts`

### No Mention of `--json` Flag

Several commands support structured JSON output. Testing JSON output is vastly simpler than testing formatted text output (parse JSON, assert on structure). The document does not mention this as a testing strategy for commands that support it.

### Missing `onTestFinished` Pattern

The document references Wrangler's `onTestFinished` for automatic cleanup but the proposed `TerminalSession` uses a manual `try/finally` pattern. The `onTestFinished` hook (vitest v1+) would be more robust and prevent resource leaks when tests fail with unexpected errors.

### No Mention of Test Retries

The document notes that PTY tests are timing-sensitive but does not propose a retry strategy. Salesforce CLI retries 3 times with 60s gaps. Vitest supports `retry` in test config. A flaky PTY test should be retried once before being marked as failed.

### No Test Isolation for `process.cwd()`

Several commands use `process.cwd()` to find the project directory. The document proposes `cwd: tmpDir` when spawning PTY processes, which is correct for subprocess isolation. But it does not mention whether the test runner's own `cwd` could interfere (e.g., if a test accidentally modifies files in the repo root).

---

## Summary: Priority of Gaps

| Priority              | Gap                                                                                 | Impact                                                                         |
| --------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **P0 - Blocker**      | Verify bun + node-pty compatibility before committing to the approach               | If bun cannot load native modules, the entire PTY strategy needs rethinking    |
| **P1 - Critical**     | 4 interactive commands (`search`, `update`, `new agent`, `build stack`) not covered | These are complex Ink flows that are completely untested at E2E level          |
| **P1 - Critical**     | Bound skill search feature not mentioned                                            | Phase 6 feature with modal overlays and network I/O has zero E2E coverage plan |
| **P1 - Critical**     | 14 non-interactive commands not covered                                             | Easy wins for Layer 3 that would significantly increase command coverage       |
| **P2 - Important**    | No error scenario test designs                                                      | Error paths are mentioned but have no concrete test implementations            |
| **P2 - Important**    | CI job structure undefined                                                          | E2E tests need clear CI integration plan                                       |
| **P2 - Important**    | Migration path for existing integration tests undefined                             | Risk of growing test suite without retiring redundant tests                    |
| **P2 - Important**    | UI change fragility not addressed                                                   | Active wizard development will break E2E tests frequently without mitigation   |
| **P3 - Nice to Have** | Expert mode E2E assertions                                                          | Expert mode is tested at unit level but constraint bypass not tested E2E       |
| **P3 - Nice to Have** | `--source` format variations                                                        | Multiple source URL formats have separate code paths                           |
| **P3 - Nice to Have** | Help text snapshot testing                                                          | Low-cost high-value regression detection                                       |
| **P3 - Nice to Have** | `--json` output testing                                                             | Simpler than text assertions, available on several commands                    |
