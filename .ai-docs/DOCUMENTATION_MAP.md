# Documentation Map

**Last Updated:** 2026-03-28
**Total Areas:** 18
**Documented:** 18 (100%)
**In Progress:** 0
**Needs Validation:** 0
**Last Validated:** 2026-03-28 (adversarial audit of test-infrastructure.md)

## Status Legend

- [DONE] Complete and validated
- [NEEDS-VALIDATION] Documented but needs validation
- [IN-PROGRESS] In progress
- [PLANNED] Planned
- [NOT-STARTED] Not started

## Staleness Dashboard

Machine-readable staleness tracker. Thresholds from `standards/documentation-bible.md`.

| Doc                      | Days Stale | Threshold | Status |
| ------------------------ | ---------- | --------- | ------ |
| architecture-overview.md | 0          | 30        | OK     |
| commands.md              | 0          | 14        | OK     |
| type-system.md           | 0          | 14        | OK     |
| store-map.md             | 0          | 7         | OK     |
| compilation-pipeline.md  | 0          | 14        | OK     |
| configuration.md         | 0          | 14        | OK     |
| wizard-flow.md           | 0          | 14        | OK     |
| skills-and-matrix.md     | 0          | 14        | OK     |
| plugin-system.md         | 0          | 14        | OK     |
| component-patterns.md    | 0          | 14        | OK     |
| utilities.md             | 0          | 14        | OK     |
| test-infrastructure.md   | 0          | 14        | OK     |
| operations-layer.md      | 0          | 14        | OK     |
| agent-system.md          | 0          | 14        | OK     |
| dependency-graph.md      | 0          | 14        | OK     |
| boundary-map.md          | 0          | 14        | OK     |
| state-transitions.md     | 0          | 14        | OK     |

**Status values:** `OK` = within threshold, `DUE` = at or past threshold, `OVERDUE` = at or past 2x threshold.
**Date basis:** 2026-03-28. compilation-pipeline.md validated 2026-03-28.

## Reference Documentation

Descriptive docs -- "how things work". Validated aggressively (7-30 day cadence).

| Area                  | Status | File                                         | Last Updated | Last Validated | Next Action          |
| --------------------- | ------ | -------------------------------------------- | ------------ | -------------- | -------------------- |
| Architecture Overview | [DONE] | `reference/architecture-overview.md`         | 2026-03-28   | 2026-03-28     | Validate in 30 days  |
| Commands Reference    | [DONE] | `reference/commands.md`                      | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| Type System           | [DONE] | `reference/type-system.md`                   | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| State Management      | [DONE] | `reference/store-map.md`                     | 2026-03-28   | 2026-03-28     | Validate in 7 days   |
| Compilation Pipeline  | [DONE] | `reference/features/compilation-pipeline.md` | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| Configuration System  | [DONE] | `reference/features/configuration.md`        | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| Wizard Flow           | [DONE] | `reference/features/wizard-flow.md`          | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| Skills & Matrix       | [DONE] | `reference/features/skills-and-matrix.md`    | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| Plugin System         | [DONE] | `reference/features/plugin-system.md`        | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| Component Patterns    | [DONE] | `reference/component-patterns.md`            | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| Utilities Reference   | [DONE] | `reference/utilities.md`                     | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| Test Infrastructure   | [DONE] | `reference/test-infrastructure.md`           | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| Operations Layer      | [DONE] | `reference/features/operations-layer.md`     | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| Agent System          | [DONE] | `reference/features/agent-system.md`         | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| Dependency Graph      | [DONE] | `reference/dependency-graph.md`              | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| Boundary Map          | [DONE] | `reference/boundary-map.md`                  | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| State Transitions     | [DONE] | `reference/state-transitions.md`             | 2026-03-28   | 2026-03-28     | Validate in 14 days  |
| Findings Impact       | [DONE] | `reference/findings-impact-report.md`        | 2026-03-28   | 2026-03-28     | Regenerate as needed |

## Standards Documentation

Prescriptive rules for code quality, testing, and content authoring. Lighter validation cadence -- validate when convention-keeper proposes updates, or quarterly.

| Area                    | File                                  | Last Moved |
| ----------------------- | ------------------------------------- | ---------- |
| Clean Code Standards    | `standards/clean-code-standards.md`   | 2026-03-25 |
| E2E Testing Bible       | `standards/e2e-testing-bible.md`      | 2026-03-25 |
| E2E Sub-Standards       | `standards/e2e/` (7 files)            | 2026-03-25 |
| Prompt Engineering      | `standards/prompt-bible.md`           | 2026-03-25 |
| Loop Prompts            | `standards/loop-prompts-bible.md`     | 2026-03-25 |
| Skill Atomicity         | `standards/skill-atomicity-bible.md`  | 2026-03-25 |
| Skill Atomicity Primer  | `standards/skill-atomicity-primer.md` | 2026-03-25 |
| TypeScript Types        | `standards/typescript-types-bible.md` | 2026-03-25 |
| Documentation Standards | `standards/documentation-bible.md`    | 2026-03-25 |
| Commit Protocol         | `standards/commit-protocol.md`        | 2026-03-25 |

## Agent Findings Pipeline

Sub-agent feedback loop for standards improvement. See [`agent-findings/README.md`](agent-findings/README.md) for pipeline details.

## Coverage Metrics

**Source Files:** 327 TypeScript files in `src/cli/`
**All major systems documented:** Yes

**Technical Areas:**

- Architecture: [DONE]
- Commands: [DONE]
- Type System: [DONE]
- State Management: [DONE]
- Compilation Pipeline: [DONE]
- Configuration: [DONE]
- Wizard Flow: [DONE]
- Skills & Matrix: [DONE]
- Plugin System: [DONE]
- Component Patterns: [DONE]
- Utilities: [DONE]
- Test Infrastructure: [DONE]
- Operations Layer: [DONE]
- Agent System: [DONE]
- Dependency Graph: [DONE]
- Boundary Map: [DONE]
- State Transitions: [DONE]
- Findings Impact Report: [DONE]

## Validation History

### 2026-03-28 Adversarial Audit (utilities.md)

0 errors found, 0 fixes needed. Full adversarial verification of all 10 utility files, all function signatures and line numbers, all message counts (ERROR=10, SUCCESS=5, STATUS=12, INFO=6), all 8 exec.ts exported functions + 4 internal helpers, all 11 fs.ts functions, all 4 logger functions + WarnOptions + buffering API, all 4 type-guard functions, all consts.ts constants (paths, DIRS, STANDARD_FILES x17, STANDARD_DIRS x3, branding, versioning, hashing, limits, YAML formatting, UI constants, schema paths, source resolution, domain config). string.ts already documented with correct signature and 3 importers. yaml.ts dead code confirmed (zero production importers, only yaml.test.ts). All mock files verified. Documentation was already fully current from prior update session.

### 2026-03-28 Adversarial Audit (wizard-flow.md)

15 errors fixed, 8 additions. Step progression missing "domains" step. Phantom HelpModal and ? hotkey removed (file does not exist). WizardResultV2 line range fixed (32-45 not 30-43). BUILT_IN_DOMAIN_ORDER expanded from 5 to 8 domains (ai, infra, meta added) at line 190 (not 191). Phantom computeOptionState() removed, isCompatibleWithSelectedFrameworks() added. WizardProps: removed phantom marketplaceLabel, added isEditingFromGlobalScope. Added Feature Flags section, Info Panel section, F/I hotkeys, Settings hotkeys, domain descriptions table.

### 2026-03-28 Adversarial Audit (architecture-overview.md)

Deep adversarial verification after 14 days stale, 204 file changes, version 0.74.10 -> 0.94.0.

**architecture-overview.md -- 11 errors fixed, 5 omissions added:**

- Fixed version: 0.94.0 (was 0.74.10)
- Fixed `detectInstallation()` line: 84 (was 103)
- Fixed `writeScopedConfigs()` line: 369 (was 422)
- Fixed `generateConfigSource()` line: 35 (was 29)
- Fixed `resolveRelationships()` line: 150 (was 147)
- Fixed template root resolution: `createLiquidEngine()` at 394-419 (was 400-434)
- Fixed `sanitizeCompiledAgentData()` range: 77-111 (was 77-112)
- Fixed wizard steps: added missing "domains" step (stack -> domains -> build -> sources -> agents -> confirm)
- Updated Zod schema count: 39 (was "30+")
- Updated feature flags: added SOURCE_CHOICE and INFO_PANEL (was only SOURCE_SEARCH)
- Added `operations/` directory with 3 subdirectories (source, skills, project) to directory structure
- Added `string.ts` utility to utils listing
- Added operations layer to data flow section
- Updated configuration directory comment to include config-generator
- Updated data flow Installation section to reference operations layer

**All verified correct (no changes needed):**

- CLI_BIN_NAME at consts.ts:27, BaseCommand at base-command.ts:12
- baseFlags: only `--source` (confirmed)
- resolveSource at config.ts:84-132
- validateSourceFormat at config.ts:291-320 with helpers through :447
- File size limits at consts.ts:143-145
- exec.ts validation at :7-87
- Source file count: 327 TypeScript files
- Technology stack versions: ink v5, Zustand v5, Zod v4.3.6, Remeda v2.33.6
- Vitest config: 3 projects (unit, integration, commands)
- Config subcommands: show, path (+ index.ts alias)
- All directory structure entries verified

### 2026-03-28 Adversarial Audit (skills-and-matrix.md)

28 errors fixed, 4 sections added. 15 function line numbers drifted in matrix-resolver.ts: resolveAlias 20->33, getDependentSkills 48->61, isDiscouraged 94->139, getDiscourageReason 153->253, isRecommended 234->403, getRecommendReason 266->435, getAvailableSkills 454->645, getSkillsByCategory 485->673, validateSelection 424->593, validateConflicts 282->451, validateRequirements 305->474, validateExclusivity 341->510, validateRecommendations 372->541. Also: resolveRelationships 147->150, mergeMatrixWithSkills 97->100 (skill-resolution.ts). SourceLoadResult 61-67->62-69 with missing marketplaceDisplayName field. rawMetadataSchema 26-37->26-36. Removed phantom tags from metadata.yaml example. Counts: SKILL_MAP 86->155, Categories 34->50, Domains 5->8, AgentNames 17->18. Added 5 undocumented matrix-resolver exports (getUnmetRequiredBy, isIncompatible, hasUnmetRequirements, getIncompatibleReason, getUnmetRequirementsReason). Added hasSkill to matrix-provider with barrel note. New sections: Current Counts, Skill Generators, Operations Layer Integration, expanded stacks-loader.

### 2026-03-28 Adversarial Audit (plugin-system.md)

17 line errors fixed, 4 sections added. See inline comments in plugin-system.md for full details. Key corrections: installLocal :584, installPluginConfig :492, writeScopedConfigs :369, detectInstallation :84, detectGlobalInstallation :59, getInstallationOrThrow :95, validatePlugin :351. Added mode-migrator.ts section, operations layer plugin ops, 3 missing exec.ts functions, installation barrel exports.

### 2026-03-28 Adversarial Audit (configuration.md)

9 line-number errors fixed, 1 phantom function removed, 1 section added. Prior 2026-03-14 audit marked several stale values as "verified correct" but those had already drifted. Fixed: `generateConfigSource` :29->:35, `buildStackProperty` :142->:146, `splitConfigByScope` :199->:169, removed phantom `compactStackForYaml`, `mergeWithExistingConfig` :83->:89, `mergeConfigs` :24->:25, `writeScopedConfigs` :422->:369, `DEFAULT_BRANDING` :163-166->:162-165, `SCHEMA_PATHS` :79-86->:78-85. Added Operations Layer section for `writeProjectConfig()` at operations/project/write-project-config.ts:43.

### 2026-03-14 Second-Pass Audit (architecture-overview.md, type-system.md)

Deep adversarial verification of every line number, count, function signature, directory structure, and data flow claim against actual source code.

**architecture-overview.md -- 3 errors fixed:**

- Fixed config subcommands: was "(get, set-project, show, path, unset-project)" but only `show.ts`, `path.ts`, and `index.ts` (alias for show) exist. Changed to "(show, path)"
- Fixed Data Flow: `render(<Wizard matrix={matrix} />)` was wrong -- Wizard does not receive matrix as a prop. Changed to `render(<Wizard projectDir={...} marketplaceLabel={...} />)` and added note that wizard imports matrix from matrix-provider.ts directly
- Fixed Data Flow: `loadSkillsMatrixFromSource() -> MergedSkillsMatrix` was imprecise -- returns `SourceLoadResult` (which contains matrix + sourceConfig). Changed to `-> SourceLoadResult (matrix + sourceConfig)`

**type-system.md -- 1 error fixed:**

- Fixed `projectConfigLoaderSchema` validates column: was `.claude-src/config.yaml`, changed to `.claude-src/config.ts` (config files are now TypeScript loaded via jiti)

**All verified correct (no changes needed):**

- Version 0.74.10 matches package.json
- CLI_BIN_NAME at consts.ts:27, BaseCommand at base-command.ts:12
- resolveSource at config.ts:84, sanitizeCompiledAgentData at compiler.ts:77-112
- validateSourceFormat at config.ts:291-320 with helpers through :447
- File size limits at consts.ts:143-145, exec.ts validation at :7-87
- generateConfigSource at config-writer.ts:29, writeScopedConfigs at local-installer.ts:422
- resolveRelationships at skill-resolution.ts:147, template root at compiler.ts:400-434
- 293 TypeScript files, 86 SKILL_MAP entries, 17 AgentNames, 5 Domains, 34 Categories
- All union type line numbers (SkillId :96, SkillSlug :95, AgentName :347, Domain :323, Category :317)
- All Named Aliases line numbers, all Core Data Structure line ranges
- All 10 Wizard/UI type line ranges, all type guard and typed object helper signatures
- All 26 Zod schema names exist, all 3 utility functions exist
- Directory structure matches actual filesystem, WizardStep union confirmed

### 2026-03-14 Second-Pass Audit (test-infrastructure.md)

Adversarial audit of first-pass validation results for test-infrastructure.md. Errors found and fixed:

- Added missing co-located test: `src/cli/lib/source-validator.test.ts`
- Added 2 missing component tests: `hotkeys.test.ts`, `utils.test.ts`
- Added 2 missing factory functions to table: `createMockRawStacksConfigWithArrays()`, `createMockRawStacksConfigWithObjects()`
- Added new "Test Utilities" section documenting 9 helper functions omitted from factory table: `runCliCommand`, `readTestYaml`, `readTestTsConfig`, `writeTestTsConfig`, `parseTestFrontmatter`, `createTestDirs`, `cleanupTestDirs`, `createTempDir`, `cleanupTempDir`
- Fixed unit test project include pattern: added `scripts/**/*.test.ts` (was missing)
- Added note that smoke tests use `*.smoke.test.ts` pattern, not matched by E2E vitest config

Verified correct (no changes needed):

- E2E file counts: commands=24, interactive=24, lifecycle=11, integration=3, smoke=3, total=65
- SKILLS registry: 10 entries
- TEST_CATEGORIES: 15 entries
- All keyboard/timing constants match source
- All 5 content generator functions match source
- All 6 mock-data files match source
- E2E helper files match source
- Fixture directory structure matches source (no `configs/` or `matrix/` subdirectories)

### 2026-03-14 Second-Pass Audit (configuration.md, plugin-system.md)

Deep adversarial verification of every claim in configuration.md and plugin-system.md against actual source code. All line numbers, type definitions, function signatures, and file paths verified correct. No hallucinated content found from the prior agent pass. Omissions found and fixed:

**features/configuration.md -- 0 errors, 5 additions:**

- All 14 documented line numbers verified correct against source code
- All 3 type definitions (ProjectConfig, SkillConfig, AgentScopeConfig, ResolvedConfig) verified exact match
- All 5 source resolution precedence steps verified against `resolveSource()` implementation
- Added 4 undocumented exported functions to Config I/O table: `getProjectConfigPath()` (:24), `resolveAllSources()` (:224), `resolveAuthor()` (:204), `formatOrigin()` (:172)
- Added `isLocalSource()` documentation with behavior description (:431)
- Added `SplitConfigResult` return type to `splitConfigByScope()` description

**features/plugin-system.md -- 0 errors, 4 additions:**

- All 16 documented line numbers verified correct against source code
- All type definitions (PluginManifest, Marketplace) verified exact match
- All 5 exec.ts shell command strings verified against actual `execCommand()` calls
- Fixed `deriveInstallMode()` to document empty-skills-array case (returns `"local"`)
- Added Plugin Manifest Finder section documenting `findPluginManifest()` (walks up dirs)
- Added Plugin Info section documenting 4 exported functions and 2 types from `plugin-info.ts`
- Added exported frontmatter validators `validateSkillFrontmatter()` (:184) and `validateAgentFrontmatter()` (:220)

**Cross-reference checks passed:**

- architecture-overview.md agrees on `resolveSource()` at config.ts:84, `validateSourceFormat()` at :291
- type-system.md agrees on `ProjectConfig` at types/config.ts:66-146
- installation/index.ts barrel exports match all documented re-exports

### 2026-03-14 Second-Pass Adversarial Audit (commands.md, utilities.md)

Deep verification of every claim in commands.md and utilities.md against actual source code. Major hallucination errors found and fixed from prior agent pass:

**commands.md -- 8 errors fixed:**

- Removed phantom `--dry-run` base flag (does not exist in BaseCommand; only `--source` is a base flag)
- Removed 3 phantom config subcommands: `config get` (get.ts does not exist), `config set-project` (set-project.ts does not exist), `config unset-project` (unset-project.ts does not exist). Only `config`, `config show`, `config path` exist.
- Removed phantom `--dry-run` from init flags (init only has `--refresh`, `--source`)
- Removed phantom `--dry-run` from edit flags (edit only has `--refresh`, `--agent-source`, `--source`)
- Removed phantom `--output` and `--dry-run` from compile flags (compile only has `--verbose`, `--agent-source`, `--source`)
- Removed phantom "Custom output" compile mode description (no `--output` flag exists)
- Fixed config section: `.claude-src/config.yaml` changed to `.claude-src/config.ts` (TypeScript format)
- Updated compile flow description: now describes dual-pass global+project compilation with `detectGlobalInstallation()` and `detectProjectInstallation()`

**utilities.md -- 3 additions, no errors:**

- Added `GLOBAL_INSTALL_ROOT`, `SKILL_CATEGORIES_PATH`, `SKILL_RULES_PATH` to paths table
- Added `STANDARD_FILES.CONFIG_TS` and `STANDARD_FILES.CONFIG_TYPES_TS` to standard files table
- Added Startup Message Buffering subsection documenting `enableBuffering()`, `drainBuffer()`, `disableBuffering()`, `pushBufferMessage()` and `StartupMessage` type

**All verified correct (no changes needed):**

- Exit codes (5 entries in exit-codes.ts)
- Message counts: ERROR_MESSAGES=10, SUCCESS_MESSAGES=5, STATUS_MESSAGES=12, INFO_MESSAGES=6
- Line numbers: getErrorMessage :2, execCommand :95, extractFrontmatter :3, safeLoadYamlFile :13, MAX_CONFIG_FILE_SIZE :145
- All 6 Claude CLI wrapper functions in exec.ts
- All 4 type guard functions in type-guards.ts
- All 11 fs.ts function signatures
- All 4 logger functions plus style guide
- typedEntries/typedKeys signatures
- All consts.ts constant values and limits

### 2026-03-14 Targeted Validation (commands.md, utilities.md, test-infrastructure.md)

Validated against source code after significant test infrastructure and command changes (Feb 25 - Mar 14).

**commands.md:**

- Updated `init` flow: documented Dashboard shown when project CLI config exists (`detectProjectInstallation()`)
- Added marketplace registration step before plugin installation (`claudePluginMarketplaceExists()` + `claudePluginMarketplaceAdd()`)
- Added `edit` cwd fix note (commit 093e18b)
- Updated key dependencies: added `detectProjectInstallation`, `deriveInstallMode`
- Fixed SUCCESS_MESSAGES count: 5 (was 6)
- Fixed INFO_MESSAGES count: 6 (was 7)
- Removed DRY_RUN_MESSAGES (object deleted from messages.ts)

**utilities.md:**

- Added `type-guards.ts` module with 4 functions: `isCategory()`, `isDomain()`, `isAgentName()`, `isCategoryPath()`
- Fixed `execCommand` line reference: 95 (was 94)
- Fixed `MAX_CONFIG_FILE_SIZE` line reference: 145 (was 140)
- Removed `SKILLS_MATRIX_PATH` from consts paths (deleted from consts.ts)
- Fixed SUCCESS_MESSAGES count: 5 (was 6)
- Fixed INFO_MESSAGES count: 6 (was 7)
- Removed DRY_RUN_MESSAGES (object deleted from messages.ts)

**test-infrastructure.md:**

- Added `content-generators.ts` to directory structure (5 renderer functions)
- Added `test-fs-utils.ts` to directory structure
- Added `mock-data/` directory with 6 files: mock-agents, mock-categories, mock-matrices, mock-skills, mock-sources, mock-stacks
- Removed phantom `configs/` and `matrix/` from fixtures subdirectories (do not exist)
- Added `compile.test.ts` to command tests listing
- Added `install-mode.integration.test.ts` to integration tests
- Added 22 new co-located test files: configuration/**tests**/ (8 files), mode-migrator, matrix-provider, skill-resolution, config-generator, config-merger, versioning, local-installer, use-section-scroll, etc.
- Expanded factory functions table: 6 -> 35 factories documented
- Added Content Generators section
- Added Canonical Test Fixtures section (SKILLS registry table, TEST_CATEGORIES table)
- Added Mock Data Module section documenting all 6 mock-data files
- Removed `OUTPUT_STRINGS` section (deleted from helpers.ts)
- Removed `TEST_AVAILABLE_SKILLS` reference (deleted)
- Added complete E2E test infrastructure section: config, directory structure (65 E2E files across 5 directories), helpers, E2E file split history
- Added `setupFiles: ["./vitest.setup.ts"]` to config section
- Updated `buildSourceResult` signature: now takes 3 params (matrix, sourcePath, overrides)

### 2026-03-14 Architecture Overview Validation

Validated `architecture-overview.md` against current source code. Significant drift found and fixed:

- Fixed version: 0.74.10 (was 0.47.0)
- Fixed CLI_BIN_NAME line: consts.ts:27 (was :24)
- Fixed BaseCommand line: base-command.ts:12 (was :11)
- Fixed baseFlags: only `--source` (was `--dry-run, --source` -- dry-run does not exist)
- Fixed source resolution: config.ts:84-132 (was :100-148)
- Fixed source precedence: `.claude-src/config.ts` (was `config.yaml`), added global step
- Fixed install mode detection: installation.ts detectInstallation():103, detectProjectInstallation():35 (was :23-60)
- Fixed template root resolution: compiler.ts:400-434 (was :412-437)
- Fixed sanitize line range: compiler.ts:77-112 (was :77-115)
- Fixed validateSourceFormat: config.ts:291-320 with helpers to 447 (was :307-445)
- Fixed file size limits: consts.ts:143-145 (was :137-140)
- Fixed exec.ts validation: :7-87 (was :19-86)
- Added `config-exports.ts` to directory structure
- Added `types/generated/` directory (source-types.ts, matrix.ts)
- Added `utils/type-guards.ts` (isCategory, isDomain, isAgentName, isCategoryPath)
- Added `lib/feature-flags.ts`
- Added `select-list.tsx` to common components
- Added jiti to technology stack (config loader)
- Added new sections: Generated Types (7), Matrix Provider and Skill Resolution (8), Config Writer (10)
- Updated Data Flow to include generateConfigSource() and writeScopedConfigs()
- Updated source file count: 293 (was 253)

### 2026-03-14 Configuration + Plugin System Validation

Validated `features/configuration.md` and `features/plugin-system.md` against source code after significant changes (R-11 config writer consolidation, scope-aware config splitting, global defaults).

**features/configuration.md:**

- Config files changed from `.yaml` to `.ts` (TypeScript loaded via jiti)
- Removed `ProjectSourceConfig` type (consolidated into unified `ProjectConfig` at `types/config.ts`)
- Removed `saveProjectConfig()` (replaced by `generateConfigSource()` + `writeFile()`)
- Added 7 new files: `config-writer.ts`, `config-types-writer.ts`, `config-loader.ts`, `define-config.ts`, `default-categories.ts`, `default-rules.ts`, `default-stacks.ts`
- Added scope-aware config splitting section (`splitConfigByScope`, `writeScopedConfigs`)
- Added config-types writer section (narrowed unions, global/project split)
- Added `loadGlobalSourceConfig()` function
- Updated source resolution to 5-tier precedence (flag > env > project > global > default)
- Updated all line references: `resolveSource()` :84, `resolveAgentsSource()` :142, `resolveBranding()` :216, `validateSourceFormat()` :291, `loadProjectSourceConfig()` :28, `ResolvedConfig` :18-22
- Updated branding example from YAML to TypeScript
- Added `SkillConfig` and `AgentScopeConfig` type sections
- Updated schema table (removed `projectSourceConfigValidationSchema`)

**features/plugin-system.md:**

- Updated `installLocal()` line: :634 (was :511)
- Updated `installPluginConfig()` line: :542 (was :435)
- Added scope-aware installation section with `writeScopedConfigs` and helper functions table
- Updated detection section: now uses `detectProjectInstallation()` :35 + `detectGlobalInstallation()` :68 fallback
- Added `deriveInstallMode()` documentation
- Added `getInstallationOrThrow()` reference
- Updated marketplace command descriptions (scope param is `"project" | "user"`)
- Added `readPluginManifest()` and `getPluginSkillIds()` to plugin-finder table
- Added `validateAllPlugins()` and `printPluginValidationResult()` to validation section
- Added `getPluginDir()` to manifest generation table
- `validatePlugin()` line verified correct at :350

### 2026-03-14 Targeted Validation (skills-and-matrix.md, wizard-flow.md)

Validated against source code after significant matrix and wizard changes (Feb 25 - Mar 14).

**features/skills-and-matrix.md:**

- Replaced `skills-matrix.yaml` references with `skill-categories.ts` + `skill-rules.ts` (YAML config replaced by TS config)
- Removed phantom `SkillsMatrixConfig` type and `skillAliases` field (no longer exist)
- Removed phantom `displayNameToId` references -- alias resolution now uses `slugMap`
- Added new `matrix-provider.ts` to file structure table with all 6 exported functions
- Added new `skill-resolution.ts` to file structure table with `mergeMatrixWithSkills` and `synthesizeCategory`
- Documented R-08 unified `resolveRelationships()` -- 5 separate resolve functions consolidated into single internal function
- Moved `mergeMatrixWithSkills()` from matrix-loader.ts to skill-resolution.ts (line 97)
- Updated `validateSelection()` line: 424 (was 512)
- Added line numbers for all matrix-resolver.ts functions with current values
- Added 4 new exported validation helpers: `validateConflicts` (282), `validateRequirements` (305), `validateExclusivity` (341), `validateRecommendations` (372)
- Updated `resolveAlias()` description -- no longer does display name lookup, just validates ID exists in matrix
- Updated data flow: step 3 now loads categories + rules separately (was single matrix YAML)
- Updated data flow: step 5 now documents slug-based resolution and auto-synthesized categories
- Updated data flow: step 7 now documents BUILT_IN_MATRIX optimization for default source
- Updated SourceLoadResult line range: 61-67 (was 59-65)
- Fixed metadata.yaml example: removed `compatibleWith`, `requires`, `conflictsWith` (now in skill-rules.ts); added `slug`, `displayName` fields
- Added `rawMetadataSchema` reference (was `skillMetadataLoaderSchema`)
- Added `migrateLocalSkillScope()` to source-switcher.ts documentation
- Added `compatibleWith` relationship type to table
- Updated `source-switcher.ts` description to include scope migration
- Added full Matrix Provider section with all functions
- Added full Skill Resolution section with merge logic description

**features/wizard-flow.md:**

- Updated `WizardResultV2` type: `selectedSkills` renamed to `skills: SkillConfig[]`, removed `sourceSelections` and `installMode`, added `agentConfigs: AgentScopeConfig[]`
- Updated `WizardResultV2` line range: 30-43 (was 27-42)
- Updated `WizardProps`: removed `matrix` prop (uses matrix-provider), removed `initialInstallMode`, added `installedSkillConfigs`, `installedAgentConfigs`, `lockedSkillIds`, `lockedAgentNames`, `startupMessages`
- Added note that wizard does NOT receive matrix prop
- Added 2 new hooks: `useRowScroll`, `useSectionScroll`
- Updated build step logic functions: removed `getSkillDisplayLabel()`, added `computeOptionState()` and `buildCategoriesForDomain()`
- Added new wizard components: `menu-item.tsx`, `selection-card.tsx`, `step-refine.tsx`, `stack-selection.tsx`
- Updated component tree: added `StackSelection` and `DomainSelection` under StepStack
- Fixed `BUILT_IN_DOMAIN_ORDER`: now includes "shared" -- `["web", "api", "mobile", "cli", "shared"]` at line 191 (was 179)
- Fixed default scratch domains: `["web", "api", "mobile"]` (all except CLI and shared)
- Updated keyboard navigation section: centralized hotkeys in `hotkeys.ts`, documented per-step hotkeys (S for scope, D for labels, L/P for sources)
- Updated edit mode flow: added steps for `installedSkillConfigs`, `installedAgentConfigs`, `lockedSkillIds`/`lockedAgentNames`
- Updated `populateFromSkillIds()` signature in edit mode flow (now takes optional `savedConfigs`)
- Updated framework-first filtering: `compatibleWith` now resolved from `skill-rules.ts` not per-skill metadata

### 2026-03-14 Targeted Validation (store-map.md, component-patterns.md)

Validated against source code after wizard store and component changes (Feb 25 - Mar 14).

**store-map.md:**

- Fixed useWizardStore line: 494 (was 431)
- Fixed WizardState shape range: 149-439 (was 157-408)
- Removed deleted state fields: `installMode`, `sourceSelections`
- Added 7 new state fields: `_stackDomainSelections`, `skillConfigs`, `focusedSkillId`, `agentConfigs`, `focusedAgentId`, `lockedSkillIds`, `lockedAgentNames`
- Removed deleted actions: `toggleExpertMode`, `toggleInstallMode`
- Added 8 new actions: `deriveInstallMode`, `toggleSkillScope`, `setSkillSource`, `setFocusedSkillId`, `toggleAgentScope`, `setFocusedAgentId`, `setAllSourcesLocal`, `setAllSourcesPlugin`
- Fixed `populateFromSkillIds` signature (now takes `savedConfigs?` instead of `skills, categories`)
- Fixed `populateFromStack` signature (no `categories` param -- uses matrix internally)
- Documented `selectStack()` reset behavior (resets all selections on stack change)
- Fixed `buildSourceRows` return type: `() => { skillId, options }[]` (was `(matrix) => SourceRow[]`)
- Fixed `createInitialState()` line range: 468-492 (was 410-429)
- Fixed DOMAIN_AGENTS line range: 54-65 (was 37-48)
- Updated store consumer list: removed 4 files that no longer import store directly (step-confirm, step-settings, wizard-tabs, use-build-step-props); added 2 new consumers (stack-selection, domain-selection)
- Updated initial state to include all 17 fields

**component-patterns.md:**

- Fixed hooks count: 16 (was 14). Added `use-row-scroll.ts`, `use-section-scroll.ts`
- Fixed wizard files count: 23 (was 22). Added `hotkeys.ts`
- Added new `select-list.tsx` in common/ with type signatures
- Added `CHEVRON_SPACER` to UI_SYMBOLS table
- Fixed `CLI_COLORS` line range: 178-188 (was 166-176)
- Fixed `UI_SYMBOLS` line range: 100-113 (was 95-108)
- Fixed `SCROLL_VIEWPORT` line range: 150-161 (was 145-156)
- Fixed CategoryOption type: removed phantom `label` field, added `scope?: "project" | "global"`
- Added `use-framework-filtering.ts` to CategoryOption/CategoryRow consumers list
- Fixed `build-step-logic.ts` path: `src/cli/lib/wizard/build-step-logic.ts`
- Added Hotkeys Registry section documenting `hotkeys.ts`
- Added Section Scroll and Row Scroll subsections

### 2026-02-25 Adversarial Audit

Full validation of all 12 documentation files against actual source code. Errors found and fixed:

**type-system.md:**

- Fixed Category count: 38 (was 46)
- Fixed SkillDisplayName count: 82 (was 118)
- Removed phantom "SkillRef" alias (does not exist; actual type is PluginSkillRef)
- Added missing types: CompileConfig, CompileContext, ValidationResult, ExtractedSkillMetadata
- Added wizard/UI types table from matrix.ts
- Added metadataValidationSchema to Zod schemas table

**utilities.md:**

- Fixed ERROR_MESSAGES count: 10 (was 8)
- Fixed STATUS_MESSAGES count: 12 (was 10)
- Fixed INFO_MESSAGES count: 7 (was 6)
- Added STANDARD_FILES and STANDARD_DIRS reference section

**features/plugin-system.md:**

- Fixed installLocal() location: local-installer.ts:511 (was installation.ts)
- Fixed installPluginConfig() location: local-installer.ts:435 (was installation.ts)
- Added re-export note from index.ts
- Added validatePlugin line reference (:359)
- Added dual getPluginManifestPath note

**test-infrastructure.md:**

- Added note that test/fixtures/ directory does NOT exist at project root
- Added KEY_Y and KEY_N to keyboard constants table
- Added delay() utility
- Added missing co-located test files (installation, plugin tests)

**component-patterns.md:**

- Fixed hooks count: 14 (was 15)
- Fixed wizard files count: 22 (was 20)
- Added DISABLED symbol to UI_SYMBOLS table
- Fixed CategoryOption type: uses `state: OptionState` pattern (not individual booleans)
- Added OptionState and CategoryRow types
- Updated consumers list (added build-step-logic.ts)

**commands.md:**

- Fixed installIndividualPlugins reference (private method on Init class, not from installation module)
- Fixed key dependencies (installation/index.ts, not installation.ts)
- Added message count references

**store-map.md:**

- Added 14 missing actions: setApproach, selectStack, setStackAction, nextDomain, prevDomain, toggleShowLabels, toggleExpertMode, toggleInstallMode, setSourceSelection, setCustomizeSources, toggleSettings, toggleHelp, setEnabledSources
- Reorganized actions into clear categories (Navigation, Approach/Stack, Selection, UI Toggles, Source Management, Population, Reset)

**features/skills-and-matrix.md:**

- Added missing `sourcePath: string` field to SourceLoadResult type
- Added line references to SourceLoadResult type definition
- Added line numbers for all matrix-resolver.ts functions
- Added undocumented utility functions: getAvailableSkills, getSkillsByCategory

### 2026-03-28 Adversarial Audit (store-map.md)

Deep validation of every line number, state field, action, getter, and consumer against `src/cli/stores/wizard-store.ts` (1105 lines). 17 errors found and fixed:

**Line number drift (4 errors):**

- Fixed `useWizardStore` line: 552 (was 494)
- Fixed `WizardState` shape range: 190-493 (was 149-439)
- Fixed `createInitialState()` range: 524-550 (was 468-492)
- Fixed `DOMAIN_AGENTS` range: 93-104 (was 54-65)

**Missing "domains" step (2 errors):**

- Added `"domains"` to WizardStep union (was missing entirely)
- Fixed step progression: `stack -> domains -> build -> sources -> agents -> confirm` (was missing `domains`)

**Phantom state field (1 error):**

- Removed `showHelp` (does not exist in code -- was renamed to `showInfo`)

**Missing state fields (3 errors):**

- Added `filterIncompatible: boolean` (filter incompatible skills in build step)
- Added `showInfo: boolean` (info overlay visible -- replaced `showHelp`)
- Added `isEditingFromGlobalScope: boolean` (disables scope toggling when editing from ~/.claude/)

**Phantom action (1 error):**

- Removed `toggleHelp` (does not exist -- was renamed to `toggleInfo`)

**Missing actions (3 errors):**

- Added `toggleFilterIncompatible` (toggle filtering + removes incompatible web skills on enable)
- Added `toggleInfo` (toggle info overlay)
- Added `setCurrentDomainIndex` (set domain index directly, no-op if out of range)

**Consumer list drift (2 errors):**

- Removed `step-stack.tsx` (no longer imports useWizardStore directly)
- Added `info-panel.tsx` (new consumer: info overlay showing selected skills/agents)

**Initial state values (1 error):**

- Updated initial state: replaced `showHelp: false` with `filterIncompatible: false`, `showInfo: false`, `isEditingFromGlobalScope: false`

**All verified correct (no changes needed):**

- Zustand v5 library, single store pattern
- All 10 Selection State fields
- All 2 Source State fields
- All 3 Approach State fields
- All 5 Scope/Source Per-Skill actions and signatures
- All 5 Source Management actions and signatures
- All 3 Population actions and signatures
- All 8 Computed Getters and return types
- `deriveInstallMode` signature and behavior
- `selectStack()` reset behavior (9 fields reset)
- DOMAIN_AGENTS content (web=6, api=3, cli=3 agents)
- Source sort tiers (4 tiers)
- Usage pattern code examples

### 2026-03-28 Adversarial Audit (commands.md)

Complete rewrite after 14 days stale. Every command file (23 total) read in full. Every flag verified against actual `static flags` definitions. Operations layer usage mapped per command.

**commands.md -- FULL REWRITE. Major drift found:**

- Prior doc had ZERO mention of operations layer -- 10 commands using operations now documented with specific operation calls
- Prior `init` flow outdated: now uses 8 operations (loadSource, ensureMarketplace, installPluginSkills, copyLocalSkills, writeProjectConfig, compileAgents, discoverInstalledSkills, loadAgentDefs)
- Prior `edit` flow missed: detectProject, uninstallPluginSkills, scope migration, agent scope changes, migration handling
- Prior `compile` flow missed: detectBothInstallations, scopeFilter on passes, buildCompilePasses logic
- Prior `list` summary wrong: was "List installed skills", actual: "Show installation information" (alias: ls)
- Prior doc had NO flags/details for 17 of 23 commands
- doctor defines source flag directly (not via BaseCommand.baseFlags) -- now documented
- Added complete flags/args tables for all 23 commands
- Added Operations Layer Usage by Command cross-reference table
- Added exported utilities from init: formatDashboardText, showDashboard, getDashboardData

### 2026-03-28 Adversarial Audit (utilities.md)

10 errors/omissions fixed: Added `string.ts` module (truncateText, 3 importers), 2 missing exec.ts wrappers (Remove/Update, total now 8), ExecResult/MarketplaceInfo types, warn() WarnOptions param, MAX_CONFIG_FILE_SIZE line (:144 was :145), 9 missing STANDARD_FILES entries, DIRS/Branding/Schema/Source/Domain sections. Flagged yaml.ts as dead code.

**Verified correct (unchanged):** Exit codes (5), message counts (ERROR=10, SUCCESS=5, STATUS=12, INFO=6), BaseCommand flag (--source), all 23 file paths, config subcommands (show, path only)

## Notes for Next Session

- compilation-pipeline.md freshly validated 2026-03-28 -- next validation due 2026-04-11
- DUE: test-infrastructure.md (14 days stale)
- commands.md freshly validated 2026-03-28 -- next validation due 2026-04-11
- utilities.md freshly validated 2026-03-28 -- next validation due 2026-04-11
- store-map.md freshly validated 2026-03-28 -- next validation due 2026-04-04
- DEAD CODE: `src/cli/utils/yaml.ts` has zero production importers -- candidate for removal
- type-system.md freshly validated 2026-03-28 -- next validation due 2026-04-11
- component-patterns.md freshly validated 2026-03-28 -- next validation due 2026-04-11
