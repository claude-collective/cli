# D-136: Test Coverage Gap Analysis

**Created:** 2026-03-21
**Status:** In Progress

---

## Overview

Comprehensive audit of unit, integration, and E2E test coverage. Goals:
- Every command has strict E2E tests for all flags, error paths, and edge cases
- All complex pure functions have unit tests
- Integration tests are relevant, unmocked where possible, and user-journey-oriented
- E2E tests follow the POM declarative pattern from D-134

### Expected failures policy

Bugs are expected. When a test has **accurate assertions** (the test describes the correct behavior) but the code doesn't match yet, mark the test as **expected to fail** using `it.fails(...)` rather than skipping or weakening the assertion. This documents the bug and ensures it's automatically detected when fixed. Never weaken an assertion to make a test pass — if the behavior is wrong, the test should fail.

---

## E2E Test Gaps

### HIGH PRIORITY

#### 1. `new agent` command — MINIMAL coverage (6 tests)
Missing:
- [ ] Agent compilation after creation
- [ ] `--purpose` flag content validation
- [ ] `--refresh` flag behavior
- [ ] Creating agent when no installation exists
- [ ] Creating duplicate agent without `--force`
- [ ] Agent appears in `cc list` after creation

#### 2. `update` command — NARROW coverage (13 tests, all happy-path)
Missing:
- [ ] Update specific skill by name
- [ ] Update when no matching skills found (error message)
- [ ] Global vs project scope updating
- [ ] `--no-recompile` flag behavior
- [ ] Update with hash mismatch (actual content change)
- [ ] Update when source is unavailable (error handling)
- [ ] `--yes` flag (auto-confirm)

#### 3. `build marketplace` — MISSING flag tests
Missing:
- [ ] `--owner-name` and `--owner-email` flags
- [ ] `--version` field in output
- [ ] `--output` with nested path creation
- [ ] marketplace.json schema validation in output
- [ ] Building from empty source (error)

#### 4. `validate` — PLUGIN validation incomplete
Missing:
- [ ] Malformed plugin.json handling
- [ ] Cross-reference validation (skills referencing non-existent categories)
- [ ] Custom skill validation (custom: true in metadata)
- [ ] `--all` flag comprehensive check
- [ ] `--plugins` flag with no plugins installed
- [ ] `--source` flag with invalid source

#### 5. `doctor` — DIAGNOSTICS incomplete
Missing:
- [ ] Detection of missing/corrupted config
- [ ] Detection of orphaned skills (in dir but not in config)
- [ ] Detection of missing skills (in config but not in dir)
- [ ] `--verbose` showing additional detail
- [ ] Broken agent references

### MEDIUM PRIORITY

#### 6. `import skill` — Network/edge cases missing
Missing:
- [ ] Invalid source path (non-existent directory)
- [ ] `--subdir` with non-existent subdirectory
- [ ] `--all` importing all skills from source
- [ ] Skill name collision without `--force`
- [ ] `--list` output format validation

#### 7. `eject` — Edge cases missing
Missing:
- [ ] `eject templates` (templates-only ejection)
- [ ] `eject skills` (skills-only ejection)
- [ ] `eject agent-partials` (partials-only ejection)
- [ ] Overwrite existing ejected files without `--force` (should error)
- [ ] `--output` to custom directory

#### 8. `search` — JSON and filtering gaps
Missing:
- [ ] `--json` output format validation
- [ ] `--category` filter with valid category
- [ ] `--category` filter with invalid category (error)
- [ ] Search with no results
- [ ] Interactive search cancellation (Escape)

#### 9. `config` — Scope and merging gaps
Missing:
- [ ] `config show` with both global and project config (merge display)
- [ ] `config show` with only global config
- [ ] `config path` for global config location
- [ ] Config display with custom source

#### 10. `uninstall` — Scope-aware gaps
Missing:
- [ ] `--no-recompile` flag behavior
- [ ] Uninstall when only global skills exist
- [ ] Uninstall preserving project skills when removing global
- [ ] `--yes` auto-confirm flag

#### 11. `help` — Comprehensive command coverage
Missing:
- [ ] `help init` subcommand help
- [ ] `help edit` subcommand help
- [ ] `help compile` subcommand help
- [ ] `help build` subcommand help

---

## Unit Test Gaps

### HIGH PRIORITY — Pure functions with NO unit tests

#### 1. `plugin-manifest-finder.ts` — 0 tests
Function: `findPluginManifest(startDir): Promise<string | null>`
Pure directory-walk function. Tests needed:
- [ ] Finds manifest in current directory
- [ ] Finds manifest by walking up N levels
- [ ] Returns null when no manifest found (reaches fs root)
- [ ] Handles deeply nested starting directory

#### 2. `config-writer.ts` — Edge cases missing
Function: `generateConfigSource(config, options?)`
Existing tests cover happy path. Missing:
- [ ] Empty config (no skills, no agents, no domains)
- [ ] Config with only global-scope items
- [ ] Config with special characters in name/description
- [ ] Standalone vs global-import generation modes
- [ ] Stack with nested category assignments

#### 3. `build-step-logic.ts` — Complex pure logic, no dedicated unit tests
Functions: `computeOptionState()`, `buildCategoriesForDomain()`
- [ ] computeOptionState with locked skill
- [ ] computeOptionState with incompatible skill
- [ ] computeOptionState with required skill
- [ ] buildCategoriesForDomain with empty matrix
- [ ] buildCategoriesForDomain with custom categories

### MEDIUM PRIORITY — Partial coverage

#### 4. `config-loader.ts` — Error paths missing
- [ ] loadConfig with non-existent file
- [ ] loadConfig with invalid TypeScript syntax
- [ ] loadConfig with Zod validation failure (schema mismatch)
- [ ] loadConfig with empty file

#### 5. `source-validator.ts` — Edge cases
- [ ] Validation of source with zero skills
- [ ] Validation of source with malformed metadata
- [ ] Validation with missing agent directories

#### 6. `skill-metadata.ts` — Transform functions
- [ ] injectForkedFromMetadata with existing forkedFrom
- [ ] injectForkedFromMetadata with missing fields
- [ ] Metadata extraction from malformed SKILL.md

---

## Integration Test Audit

### Files to review for staleness/over-mocking:

#### 1. `init-flow.integration.test.ts` (645 lines)
- Review: Is this duplicated by E2E init wizard tests?
- Check: Are mocks hiding real behavior?

#### 2. `init-end-to-end.integration.test.ts` (556 lines)
- Review: Overlaps with init-flow.integration.test.ts?
- Check: Both files test similar flows

#### 3. `compilation-pipeline.test.ts` (506 lines)
- Review: Does this match current compile behavior?
- Check: Error path coverage

#### 4. `installation.test.ts` (269 lines)
- Review: Does installation logic match post-scope-aware changes?
- Check: Mock boundaries appropriate?

#### 5. `wizard-init-compile-pipeline.test.ts` (289 lines)
- Review: End-to-end flow, but with mocks
- Check: Could this be replaced by E2E tests?

---

## Implementation Plan

### Phase 1: Unit Tests (pure functions)
1. [x] plugin-manifest-finder.test.ts — 7 new tests (finds manifest, walks up, null at root, handles non-existent dir)
2. [x] config-writer.test.ts — 47 new tests (empty config, global scope, special chars, standalone, complex stack, syntax validity)
3. [x] build-step-logic.test.ts — 34 new tests (validateBuildStep, buildCategoriesForDomain, framework filtering, selected state)
4. config-loader.test.ts — expand error paths (deferred)

### Phase 2: E2E Command Tests (using POM pattern)
1. [x] new-agent.e2e.test.ts — 10 new tests (purpose flag, short aliases, error handling, `it.fails` for missing --force)
2. update.e2e.test.ts — expand (deferred)
3. [x] validate.e2e.test.ts — 8 new tests (--all, --plugins, malformed metadata, missing SKILL.md, --verbose)
4. [x] doctor.e2e.test.ts — 6 new tests (orphaned skills, missing skills, no agents, --verbose, healthy project)
5. build marketplace tests — expand (deferred)
6. [x] eject.e2e.test.ts — 8 new tests (templates-only, skills-only, --force, --output, error paths, `it.fails` for bugs)
7. [x] import-skill.e2e.test.ts — 5 new tests (--all, invalid source, --subdir, non-existent skill, `it.fails` for bugs)
8. [x] search-static.e2e.test.ts — 3 new tests (no results, category filter, cross-category)
9. [x] config.e2e.test.ts — 5 new tests (project config, merged config, global-only, path format, alias parity)
10. [x] uninstall.e2e.test.ts — 3 new tests (--yes flag, empty project, --all --yes)
11. [x] help.e2e.test.ts — 6 new tests (init, edit, build stack, search, unknown command)

### Phase 3: Integration Test Cleanup
1. [x] Audit each integration test for relevance — all 7 files reviewed, all valid
2. No tests fully superseded by E2E — all provide unique coverage
3. No unnecessary mocks — 6 of 7 files use zero function mocking
4. Recommendation: merge wizard-init-compile-pipeline.test.ts into init-flow.integration.test.ts (2 unique tests, 4 duplicates)

---

## Integration Test Audit — Detailed Findings

**Date:** 2026-03-21
**Auditor:** CLI tester agent
**Test run result:** All 178 tests across 10 files PASS (21.57s)

### Summary

| File | Lines | Tests | Verdict | Recommendation |
|------|-------|-------|---------|----------------|
| `compilation-pipeline.test.ts` | 506 | 15 | VALID | Keep — unique coverage of build pipeline internals |
| `init-flow.integration.test.ts` | 645 | 12 | VALID | Keep — tests `installLocal()` API contracts directly |
| `init-end-to-end.integration.test.ts` | 556 | 14 | VALID (overlap) | Keep but consolidate — overlaps with init-flow but adds wizard store integration |
| `installation.test.ts` | 269 | 13 | VALID | Keep — fast, focused, no mocking, tests `detectInstallation()` edge cases |
| `import-skill.integration.test.ts` | 681 | 10 | VALID | Keep — exercises import CLI command + compile pipeline end-to-end |
| `source-switching.integration.test.ts` | 203 | 7 | VALID | Keep — unique coverage of `deleteLocalSkill()` + re-copy flows |
| `wizard-init-compile-pipeline.test.ts` | 289 | 6 | VALID (overlap) | Merge into init-flow — duplicates init-flow scenarios 1-4 with slightly different fixture |

### Per-File Analysis

#### 1. `compilation-pipeline.test.ts` (15 tests)

**What it tests:** Full skill compilation pipeline: `compileAllSkillPlugins()`, `compileStackPlugin()`, `generateMarketplace()`, `writeMarketplace()`, `validatePlugin()`, `validateAllPlugins()`.

**Import validity:**
- `compileAllSkillPlugins` — exists at `skill-plugin-compiler.ts:189`
- `compileStackPlugin` — exists at `stack-plugin-compiler.ts:202`
- `loadStacks` — exists at `stacks-loader.ts:56`
- `generateMarketplace`, `writeMarketplace`, `getMarketplaceStats` — all exist in `marketplace-generator.ts`
- `validateAllPlugins`, `validatePlugin` — exist in `plugin-validator.ts`
- `COMPILATION_TEST_STACK` — exists in `mock-stacks.ts:184`
- `DEFAULT_TEST_SKILLS` — exists in `mock-skills.ts`

**Mocking:** Minimal — only `console.log` and `console.warn` suppressed. No function mocking. Uses real filesystem via `createTestSource()` + `createTempDir()`.

**E2E overlap:** E2E `plugin-build.e2e.test.ts` and `build.e2e.test.ts` test the `build plugins` and `build marketplace` CLI commands but go through the full oclif command layer. This integration test exercises the internal functions directly with more granular assertions (manifest content, plugin structure, marketplace stats, sorting, categorization). The E2E tests cannot easily assert on internal data structures like `PluginManifest` fields.

**Verdict: KEEP.** Low mocking, exercises real compilation with real filesystem, covers internal contract guarantees that E2E cannot check (manifest structure, category stats, plugin name uniqueness, sorted output).

---

#### 2. `init-flow.integration.test.ts` (12 tests across 8 describe blocks)

**What it tests:** `installLocal()` function directly — config generation, skill copying, agent compilation, directory structure, idempotency/merge, install mode, skill content preservation, agent filtering, forkedFrom metadata injection.

**Import validity:**
- `installLocal` — exists at `local-installer.ts:634`
- `deriveInstallMode` — exists at `installation.ts:26`
- `initializeMatrix` — exists at `matrix-provider.ts`
- `buildWizardResult`, `buildSkillConfigs`, `buildSourceResult`, `readTestTsConfig` — all exist in `helpers.ts`
- `FULLSTACK_TRIO_MATRIX` — exists at `mock-matrices.ts:53`
- `INIT_TEST_SKILLS` — exists at `mock-skills.ts:212`

**Mocking:** Zero function mocking. Uses real `installLocal()` with real filesystem. The only artificial setup is `process.chdir()` and an `afterEach` to clean global config files from `os.homedir()`.

**E2E overlap:** E2E `init-wizard-*.e2e.test.ts` (11 files) test the full init wizard flow interactively but test user-facing behavior (terminal output, keyboard navigation, wizard steps). This integration test exercises `installLocal()` directly, verifying internal API contracts: config shape, skill copying results, agent assignments, stack entries, forkedFrom metadata. The E2E tests cannot assert on the `LocalInstallResult` return value or config internals.

**Verdict: KEEP.** Zero mocking, tests `installLocal()` contract directly. Catches regressions in config structure, skill copying, agent filtering, and merge behavior that E2E tests cannot easily verify.

---

#### 3. `init-end-to-end.integration.test.ts` (14 tests across 6 describe blocks)

**What it tests:** Same `installLocal()` and `installPluginConfig()` functions as init-flow.integration.test.ts, but adds the wizard store (`useWizardStore`) in the loop: `simulateSkillSelections()` -> `preselectAgentsFromDomains()` -> `buildWizardResultFromStore()` -> `installLocal()`. Also tests stack consistency invariants and validation.

**Import validity:**
- `installLocal`, `installPluginConfig` — exist at `local-installer.ts:634, :542`
- `useWizardStore` — exists in `stores/wizard-store.ts`
- `createComprehensiveMatrix`, `buildWizardResultFromStore`, `simulateSkillSelections`, `extractSkillIdsFromAssignment` — all exist in `helpers.ts`
- `ALL_TEST_SKILLS` — exists at `mock-skills.ts:200`

**Mocking:** `os.homedir()` mocked to return project dir (necessary to avoid writing to real home). `vi.restoreAllMocks()` in afterEach. No function mocking of the code under test.

**E2E overlap with init-flow.integration.test.ts:** Significant overlap. Both test `installLocal()` output (config structure, agent lists, skill counts, directory structure). The unique value of this file is:
1. Tests `preselectAgentsFromDomains()` behavior directly (3 tests in "preselectAgentsFromDomains behavior" block)
2. Tests `installPluginConfig()` (plugin mode, 2 tests)
3. Tests stack consistency invariants with `extractSkillIdsFromAssignment()`
4. Tests conflict detection through `buildWizardResultFromStore()` validation

**Verdict: KEEP but consider consolidation.** The wizard store integration (simulateSkillSelections -> preselectAgentsFromDomains -> installLocal) provides unique value over init-flow.integration.test.ts. However, tests like "should create the complete directory structure" and "should set source flag in config when provided" duplicate init-flow nearly verbatim. Recommendation: merge the 6 unique describe blocks into init-flow.integration.test.ts and remove the duplicated directory/config tests.

---

#### 4. `installation.test.ts` (13 tests)

**What it tests:** `detectInstallation()` and `getInstallationOrThrow()` — installation detection logic for local mode, plugin mode, no installation, priority when both exist, and edge cases (invalid config, process.cwd default).

**Import validity:**
- `detectInstallation`, `getInstallationOrThrow` — both exist at `installation.ts:84, :95`
- `renderConfigTs` — exists at `content-generators.ts:18`
- `buildProjectConfig`, `buildSkillConfigs` — exist in `helpers.ts`

**Mocking:** Zero mocking. Creates real filesystem fixtures with `writeFile()` and `createTempDir()`. Tests actual config file parsing through `detectInstallation()`.

**E2E overlap:** No E2E test directly tests `detectInstallation()` in isolation. E2E lifecycle tests (local-lifecycle, plugin-lifecycle) exercise it indirectly through the CLI commands, but cannot test edge cases like "invalid config file as local mode", "null when plugin dir exists without config", or "process.cwd() default". There is no E2E test for `getInstallationOrThrow()` error message format.

**Verdict: KEEP as-is.** Exemplary integration test: zero mocking, fast execution, tests important edge cases that E2E cannot cover, clean fixture setup/teardown.

---

#### 5. `import-skill.integration.test.ts` (10 tests across 4 describe blocks)

**What it tests:** Import skill command (`runCliCommand(["import:skill", ...])`) -> compile pipeline (`compileSkillPlugin()`, `compileAllSkillPlugins()`) -> validation (`validatePlugin()`). Also tests `--force` flag, `--subdir` flag, metadata preservation through compilation, error recovery for nonexistent skills, and mixed content sources.

**Import validity:**
- `runCliCommand` — exists at `helpers.ts:37`
- `compileSkillPlugin`, `compileAllSkillPlugins` — exist in `skill-plugin-compiler.ts`
- `validatePlugin` — exists in `plugin-validator.ts`
- `IMPORT_REACT_PATTERNS_SKILL`, `IMPORT_TESTING_UTILS_SKILL`, `IMPORT_API_SECURITY_SKILL` — exist in `mock-skills.ts:511-561`
- `EXIT_CODES` — exists in `exit-codes.ts`

**Mocking:** Only `console.log`/`console.warn` suppressed. Uses real `runCliCommand()` which exercises the actual oclif command runner.

**E2E overlap:** E2E `import-skill.e2e.test.ts` tests the CLI command through the binary (`CLI.run()`). It covers help text, basic import, `--list`, `--skill`, and `--all` flags. However, the integration test adds unique coverage:
1. Import -> compile pipeline (E2E never compiles imported skills)
2. `--force` overwrite + version bump after recompile
3. Metadata preservation through compilation (forkedFrom injected, original metadata preserved)
4. `--subdir` flag with custom subdirectory
5. Compiled plugin README content verification

**Verdict: KEEP.** The import -> compile pipeline is not tested by E2E. The metadata preservation through compilation and version bumping are uniquely covered here. The `runCliCommand` approach is close to E2E but faster.

---

#### 6. `source-switching.integration.test.ts` (7 tests across 3 describe blocks)

**What it tests:** `deleteLocalSkill()` function directly — deleting skills, re-copying from source, local-to-plugin-to-local round-trip. Verifies that after delete + reinstall, content comes from marketplace source (not preserved local edits).

**Import validity:**
- `deleteLocalSkill` — exists at `source-switcher.ts:40`
- `installLocal` — exists at `local-installer.ts:634`
- `SWITCHABLE_SKILLS`, `LOCAL_SKILL_VARIANTS` — exist in `mock-skills.ts:143, :166`
- `createMockMatrix`, `testSkillToResolvedSkill`, `buildWizardResult`, `buildSkillConfigs`, `buildSourceResult` — all exist in `helpers.ts`

**Mocking:** Zero mocking. Uses real filesystem, real `deleteLocalSkill()`, real `installLocal()`.

**E2E overlap:** E2E `source-switching-modes.e2e.test.ts` and `source-switching-per-skill.e2e.test.ts` test source switching through the edit wizard UI (interactive terminal). They cannot test `deleteLocalSkill()` directly or verify that re-copied content comes from source (not local edits). The integration test's unique value is the content verification assertion: "Marketplace Version" after re-copy, NOT "Local Version".

**Verdict: KEEP.** Zero mocking, unique coverage of `deleteLocalSkill()` behavior and content preservation semantics that E2E cannot test.

---

#### 7. `wizard-init-compile-pipeline.test.ts` (6 tests across 4 describe blocks)

**What it tests:** `installLocal()` with `buildWizardResult()` + `buildSkillConfigs()` for a 7-skill pipeline. Verifies config integrity, directory structure, agent content containing skill references, and agent recompilation round-trip via `recompileAgents()`.

**Import validity:**
- `installLocal` — exists at `local-installer.ts:634`
- `recompileAgents` — exists at `agent-recompiler.ts:157`
- `initializeMatrix` — exists at `matrix-provider.ts`
- `PIPELINE_TEST_SKILLS` — exists at `mock-skills.ts:86`
- `PIPELINE_MATRIX` — exists at `mock-matrices.ts:343`

**Mocking:** Zero mocking. Uses real filesystem, real compilation.

**E2E overlap with init-flow.integration.test.ts:** High overlap. Scenarios 1 (full pipeline), 3 (config integrity), and 4 (directory structure) duplicate what init-flow.integration.test.ts already covers with different fixture data. Unique contributions:
1. Scenario 2: `recompileAgents()` round-trip (init then recompile) — not tested elsewhere
2. Agent content verification (checking that compiled agents contain skill content/IDs)

**Verdict: MERGE into init-flow.** The `recompileAgents()` test and agent content verification are valuable and unique. Move those 2 tests to init-flow.integration.test.ts. The other 4 tests (config integrity, directory structure, source metadata) are redundant with init-flow and init-end-to-end.

---

### Cross-Cutting Issues

#### 1. `console.log`/`console.warn` Spy Pattern
5 of 7 files suppress console output with `vi.spyOn(console, "log").mockImplementation(() => {})`. This is appropriate — these functions genuinely log to console during compilation. However, compilation-pipeline.test.ts uses this per-test instead of in beforeEach/afterEach, which is more error-prone. Consider moving to a shared beforeEach pattern.

#### 2. Duplicate Config Assertion Patterns
Multiple files test the same assertions: "config.agents.map(a => a.name) should be sorted", "config.skills should contain selected IDs", "stack should not contain DEFAULT_AGENTS". These could use a shared assertion helper: `assertConfigIntegrity(config, expectedSkills, expectedAgents)`.

#### 3. No Global Scope Testing
None of the 7 integration tests exercise global-scope installation (`scope: "global"` on SkillConfig). The init-end-to-end.integration.test.ts mocks `os.homedir()` to avoid writing to real home, but never tests the actual scope-splitting behavior of `writeScopedConfigs()`. This is a gap — E2E lifecycle tests cover it but integration tests don't.

---

### Recommendations

| Priority | Action | Files Affected | Effort |
|----------|--------|----------------|--------|
| LOW | Merge wizard-init-compile-pipeline into init-flow | wizard-init-compile-pipeline.test.ts, init-flow.integration.test.ts | Small |
| LOW | Deduplicate init-end-to-end directory/config tests | init-end-to-end.integration.test.ts | Small |
| LOW | Extract `assertConfigIntegrity()` shared helper | helpers.ts, 3 integration test files | Small |
| LOW | Move console spy to beforeEach in compilation-pipeline | compilation-pipeline.test.ts | Trivial |
| MEDIUM | Add global scope tests to init-flow | init-flow.integration.test.ts | Medium |

### Files to Keep (Definitive)

1. **compilation-pipeline.test.ts** — unique build pipeline coverage, low mocking
2. **init-flow.integration.test.ts** — canonical `installLocal()` contract tests
3. **init-end-to-end.integration.test.ts** — wizard store integration (consolidate duplicates)
4. **installation.test.ts** — exemplary, zero mocking, edge cases only
5. **import-skill.integration.test.ts** — import-compile pipeline, metadata preservation
6. **source-switching.integration.test.ts** — `deleteLocalSkill()` + content verification

### Files to Merge/Remove

7. **wizard-init-compile-pipeline.test.ts** — merge `recompileAgents()` test and agent content test into init-flow, remove remaining 4 duplicated tests

---

## Success Criteria

- [ ] All commands have E2E tests for every flag
- [ ] All error paths have explicit tests with error message assertions
- [ ] All complex pure functions have unit tests
- [ ] No integration tests that are fully superseded by E2E tests
- [ ] Zero mocking of things that don't need mocking
- [ ] All new E2E tests use POM pattern (no raw session calls)
- [ ] Accurate assertions that expose bugs use `it.fails(...)` — never weaken assertions to pass
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] `npm run test:e2e` passes
