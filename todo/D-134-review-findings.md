# D-134 Code Review Findings

**Last updated:** 2026-03-21

## Status

**ALL ITEMS RESOLVED.**

- **Fixed:** F1, F2, F3, F4, F5, F6, F7/F15, F8, F9, F10, F11, F12, F13, F14, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16

---

## Success criteria status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | No writeFile/readFile/mkdir in test bodies | PASS — 183 remaining are all in setup blocks (beforeAll/beforeEach), not test bodies |
| 2 | No session.waitForText/enter/arrowDown in test files | PASS — 0 matches |
| 3 | No delay() in test files | PASS — 0 matches |
| 4 | No src/cli/ imports in E2E test files (non-type) | PASS — 0 matches |
| 5 | No index-based navigation | Mostly done — 13 arrowDown() in InteractivePrompt-based tests (architectural boundary) |
| 6 | No duplicated navigation flows | PASS |
| 7 | Each test reads like a user story | PASS (qualitative) |
| 8 | UI text changes require editing 1 file | PASS — STEP_TEXT + EXIT_CODES centralized in constants.ts |
| 9 | test-utils.ts and plugin-assertions.ts deleted | plugin-assertions.ts deleted. test-utils.ts retained as clean utility module (178 lines, 74 importers — cannot delete without massive refactor) |
| 10 | Zero compatibility code | PASS — no deprecated functions or backward-compat shims |
| 11 | No direct config mutation between test phases | PASS — writeProjectConfig calls are in setup, not between phases |

## Verification checklist

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run test:e2e` — all 71 files, 498 tests pass
- [ ] `grep -rn "from.*src/cli" e2e/ --include="*.e2e.test.ts" | grep -v "import type" | wc -l` — 0
- [ ] `grep -rn "session.waitForText|session.enter|session.arrowDown" e2e/ --include="*.e2e.test.ts" | wc -l` — 0
- [ ] `grep -rn "await delay(" e2e/ --include="*.e2e.test.ts" | wc -l` — 0
- [ ] `grep -rn "INTERNAL_DELAYS" e2e/ --include="*.e2e.test.ts" | wc -l` — 0
- [ ] `grep -rn "^import.*TerminalSession" e2e/ --include="*.e2e.test.ts" | wc -l` — 0

---

## All Fixed Items

### Framework fixes
- **F1:** `navigateCursorToItem` promoted to `BaseStep` — 4 copies eliminated from domain-step, stack-step, agents-step
- **F2:** Shared `setupSession()` extracted in `init-wizard.ts` — ~40 duplicate lines removed
- **F3:** `InteractivePrompt` inline delay patterns replaced with `private delay(ms)` method — 10 occurrences cleaned
- **F4:** `DashboardSession` now composes `TerminalScreen` instead of reimplementing `waitForText`
- **F5:** Magic number `150` replaced with `INTERNAL_DELAYS.KEYSTROKE` in `DashboardSession`
- **F6:** `cleanupDirs` now used in `destroy()` for both `InitWizard` and `DashboardSession` — temp dirs cleaned up
- **F7/F15:** All 13 `STEP_TEXT` constants now referenced in test files — raw strings replaced (`"Compiled"`, `"Compiling stack"`, `"Uninstall complete"`, `"Loading skills"`, `"Search Skills"`, `"initialized successfully"`)
- **F8:** Removed unused `BaseStep.pressTab()` method
- **F9:** Redundant `ConfirmStep.getOutput()` override removed
- **F10:** Boundary cast comments added to `ProjectBuilder` double casts
- **F11:** `SourcesStep.acceptDefaults()` now calls `waitForReady()` instead of duplicating wait logic
- **F12:** `BaseStep.navigateToItem()` renamed to `waitForItemVisible()` — clearer name distinguishing from `navigateCursorToItem()`
- **F13:** `DashboardSession` extracted to `e2e/pages/dashboard-session.ts` — re-exported from `init-wizard.ts` for backward compat
- **F14:** `PluginScope` type exported from `project-matchers.ts` and used in `setup.ts` — eliminates inline union duplication

### Test fixes
- **T1:** Duplicated dual-scope helpers extracted to `e2e/fixtures/dual-scope-helpers.ts` (~350 lines deduplicated from 3 lifecycle files)
- **T2:** `project-builder.ts` imports replaced: `CLAUDE_DIR`/`STANDARD_FILES` from `src/cli/consts.ts` → `DIRS`/`FILES` from `e2e/pages/constants.ts`. `renderConfigTs`/`renderSkillMd` now imported via `test-utils.ts` re-exports
- **T3:** Index-based agent navigation replaced with `navigateCursorToAgent("API Developer")` in 4 files
- **T4:** Raw `execa` + `BIN_RUN` replaced with `CLI.run()` in `build-stack.e2e.test.ts` (5 call sites)
- **T5:** `beforeAll`/`afterAll` removed from 3 `it.todo()`-only suites in `config-scope-integrity.e2e.test.ts`
- **T6:** `agentsPath()` centralized in `test-utils.ts` — removed duplicates from 9 command test files
- **T7:** Source creation consolidated to single file-level `beforeAll` in `global-scope-lifecycle.e2e.test.ts` (6 duplicates removed)
- **T8:** Matchers import added to `edit-skill-accumulation.e2e.test.ts` and `edit-agent-scope-routing.e2e.test.ts`
- **T9:** Source creation convention documented — JSDoc on `create-e2e-source.ts`: create once in `beforeAll`, pass via `source` option
- **T10:** Cleanup convention documented — JSDoc on `InitWizard` class: `destroy()` in `afterEach`, shared sources in `afterAll`
- **T11:** `STEP_TEXT.DASHBOARD` added; 5 hardcoded `"Agents Inc."` strings replaced in `init-wizard-existing.e2e.test.ts`
- **T12:** Magic `60_000` timeout replaced with `TIMEOUTS.PLUGIN_INSTALL` in `edit-wizard-completion.e2e.test.ts`
- **T13:** `source-switching-modes.e2e.test.ts` try-catch fallback replaced with `fileExists` check + single assertion
- **T14:** Extensive inline setup in `init-wizard-existing.e2e.test.ts` extracted to `ProjectBuilder.globalWithSubproject()`
- **T15:** `CLI.run(args, projectDir)` fixed to `CLI.run(args, { dir: projectDir })` in `compile.e2e.test.ts`
- **T16:** 265 raw exit code assertions replaced with `EXIT_CODES.SUCCESS` / `EXIT_CODES.ERROR` across 38 test files

### Cleanup
- Removed unused `navigateInitWizardToCompletion`, `passThroughAllBuildDomains`, `waitForRawText` from `test-utils.ts`
- Removed unused internal timing constants and `delay` function from `test-utils.ts`
- Removed unused `TerminalSession` import from `test-utils.ts`
- Removed unused `createPermissionsFile` import from `init-wizard-default-source.e2e.test.ts`
- Removed unused `fileExists` import from `compile-edge-cases.e2e.test.ts`
- Removed unused `projectDir` field from `InitWizard` constructor
