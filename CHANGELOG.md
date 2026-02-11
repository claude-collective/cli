# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.24.3] - 2026-02-11

### Changed

- **AJV replaced with Zod for all schema validation** — `schema-validator.ts` and `plugin-validator.ts` rewritten to use Zod `.safeParse()`. AJV and ajv-formats dependencies removed (23 packages pruned). Strict validation schemas added for `cc validate`: `metadataValidationSchema`, `stackConfigValidationSchema`, `skillFrontmatterValidationSchema`, `agentFrontmatterValidationSchema`.
- **JSON Schema files now generated from Zod** — `scripts/generate-json-schemas.ts` uses `z.toJSONSchema()` (Zod v4 native) to generate 10 schema files from Zod source of truth. Hand-maintained JSON schemas and symlinks to claude-subagents removed. New npm scripts: `generate:schemas`, `generate:schemas:check`.
- **YAML `$schema` references use local relative paths** — All 18 `agent.yaml` files switched from remote `raw.githubusercontent.com` URLs to `# yaml-language-server: $schema=` comments with relative paths. Schema reference added to `config/skills-matrix.yaml`. VS Code YAML validation now works offline.

## [0.24.2] - 2026-02-11

### Changed

- **Type definitions co-located into `src/cli/types/`** — 4 scattered type files (`src/types.ts`, `src/cli/types.ts`, `src/cli/types-matrix.ts`, `src/cli/types-stacks.ts`) consolidated into 6 domain-organized files + barrel index under `src/cli/types/`. All 60+ consumer imports updated. Unused imports cleaned up.

## [0.24.1] - 2026-02-11

### Fixed

- **Stack config now respects user customizations** — `buildLocalConfig` generates stack config from the user's actual skill selections instead of hardcoding the original stack definition. Customizations like swapping `commander` for `oclif` are now preserved.
- **Subcategory key `cli` corrected to `cli-framework`** in `stacks.yaml` to match the `CategoryPath` format used in production metadata files.
- **Parse boundaries hardened** — All YAML/JSON parse boundaries now warn or throw with context on failure: `parseFrontmatter` includes file path in warnings, `loadAllAgents`/`loadProjectAgents` catch and warn on invalid `agent.yaml`, `config-saver` uses Zod validation, `versioning` wraps `parseYaml` in try/catch, `matrix-loader` warns on invalid skill alias mappings.

### Changed

- **Test structure reorganized** — Component tests co-located with source files. Integration tests grouped in `lib/__tests__/integration/`. Compilation pipeline tests rewritten to use `createTestSource()` instead of external repo dependency.
- **Shared test factories added** — `createMockCategory()`, `createMockResolvedStack()`, `createComprehensiveMatrix()`, `createBasicMatrix()` in `helpers.ts` reduce ~300 lines of duplicate fixture code.
- **17 previously untested lib files now have unit tests** — compiler, matrix-loader, stacks-loader, defaults-loader, config-saver, skill-plugin-compiler, plugin-info, plugin-finder, plugin-version, output-validator, schema-validator, installation, skill-fetcher, agent-fetcher, skill-metadata, matrix-health-check, stack-installer.
- **Error path and user journey test coverage expanded** — 12 error path tests for loader functions, 8 edit-recompile journey tests, 17 install-compile journey tests.

## [0.24.0] - 2026-02-11

### Changed

- **Type system rewrite** — All `interface` declarations replaced with `type` aliases. `Skill` now extends `SkillDefinition` via intersection. Agent types composed from `BaseAgentFields` shared base. Inline `//` comments converted to JSDoc on type fields.
- **`SkillAlias` renamed to `SkillDisplayName`** — `ResolvedSkill.alias` → `displayName`, `CategoryDefinition.name` → `displayName`. `SkillRef` union eliminated — all post-resolution sites use `SkillId` directly.
- **`stack` is the single source of truth for skill assignment** — `skills` flat list, `agent_skills` per-agent overrides, and `preload_patterns` removed from `ProjectConfig`. When no predefined stack is selected, a stack is auto-generated from wizard selections.
- **Config always uses `SkillAssignment` objects** — `SkillEntry` union (`string | SkillAssignment`) eliminated. Config YAML `skills` entries are always `{ id }` objects.
- **`ProjectConfig.agents` narrowed** from `string[]` to `AgentName[]`. `getAgentsForSkill()` return type narrowed to `AgentName[]`.
- **Remaining `Object.entries`/`Object.keys` replaced** with `typedEntries`/`typedKeys` across all files. `Record<string, X>` narrowed to `Record<SkillId|AgentName|Subcategory, X>` where keys are known.
- **`loadProjectConfig` renamed** to `loadProjectSourceConfig` in `config.ts` to disambiguate from `project-config.ts` version.
- **Format functions consolidated** — `formatSourceOrigin`/`formatAgentsSourceOrigin` merged into `formatOrigin(type, origin)`.
- **`KEY_SUBCATEGORIES` deduplicated** — moved from `resolver.ts` and `stacks-loader.ts` into `consts.ts`.

### Removed

- **`name` field** from `SkillDefinition`, `Skill`, `ResolvedSkill`, `SkillOption` — `displayName` (formerly alias) replaces it. `extractDisplayName()` removed from `loader.ts`.
- **`custom_agents` infrastructure** — `custom-agent-resolver.ts` deleted entirely. `CustomAgentConfig` type, validation, resolution, and compilation code paths removed.
- **`agent_skills` config mechanism** — redundant with `stack`. All read/write/validation paths removed.
- **`preload_patterns` config field** — redundant with `SkillAssignment.preloaded`.
- **Dead `ProjectConfig` fields** — `philosophy`, `principles`, `tags`, `framework`, `hooks`.
- **Dead `SkillFrontmatter` fields** — `agent`, `argument-hint`, `context`, `disable-model-invocation`, `user-invocable`, `allowed-tools`.
- **Dead `PluginManifest` fields** — `homepage`, `license`, `repository`, `mcpServers`.
- **`ResolvedSkill.recommendedBy` and `requiredBy`** — unused inverse relationship fields.
- **`MarketplaceFetchResult.cacheKey`** — set but never read.
- **`CompileConfig.claude_md`** — always empty string.
- **`CompileMode` type and `getDirs()` function** — single-value enum.
- **`LoadedProjectConfig.isLegacy`** — always `false`.
- **`AgentYamlConfig.skills`** — parsed but never read.
- **Dead `skill-agent-mappings.ts` code** — ~170 lines of hardcoded fallbacks, `shouldPreloadSkill`, `extractCategoryKey`, `hasAgentSkillsOverride`, `isSkillAssignedToAgent`, `normalizeAgentSkills`, `resolveAgentsForSkill`.
- **Dead `resolver.ts` functions** — `resolveStackSkills`, `getStackSkillIds`, `flattenAgentSkills`, `expandSkillIdIfDirectory`, `normalizeSkillEntry`, unused interfaces.
- **Unused `compileAllAgents()` `_config` parameter**.
- **Dead wizard store actions/state** — `setDomainSelection`, `setSkillSource`, `setCurrentRefineIndex`, `setCurrentDomainIndex`, `toggleShowDescriptions`, `setFocus`, `currentRefineIndex`, `skillSources`.
- **Dead wizard component code** — `shouldShowSubcategory()` (always true), unused props, redundant computations.
- **~2,100 lines of redundant test code** for deleted features.

## [0.23.0] - 2026-02-10

### Added

- **Zod runtime validation at all parse boundaries** — 30+ schemas in `schemas.ts` using bridge pattern (`z.ZodType<ExistingType>`) validate every `JSON.parse` and `parseYaml` call in production code. Eliminates all production `as T` casts at deserialization boundaries. Lenient loader schemas use `.passthrough()` at parse boundaries; strict schemas for validation.
- **Typed object utilities** — `typedEntries<K,V>()` and `typedKeys<K>()` in `typed-object.ts` replace all `Object.entries/keys` boundary casts with type-safe helpers.
- **Named type aliases** — `SkillRef`, `SubcategorySelections`, `DomainSelections`, `CategoryMap`, `ResolvedSubcategorySkills` in `types-matrix.ts` for recurring composite types.
- **Scalar union types** — `ModelName` (`"sonnet" | "opus" | "haiku" | "inherit"`) and `PermissionMode` unions added to `types-matrix.ts`.
- **Testing strategy document** — `testing-strategy.md` with conventions for test categories, co-location rules, Ink component testing, keyboard simulation timing, and fixture organization.

### Changed

- **Extended type narrowing across 33 library files** — `Record<string, X>` narrowed to `Record<AgentName|SkillId|Subcategory, X>` where keys are known. Function signatures narrowed for `compileAgent`, `compileAgentForPlugin`, `getPluginSkillIds`, `fetchSkills`, `buildStackProperty`, `buildAgentSkills`, `validateBuildStep`, `populateFromStack`. Return types narrowed for `CompiledStackPlugin`, `StackInstallResult`, `RecompileAgentsResult`.
- **Replaced manual array operations with Remeda utilities** — `unique()`, `uniqueBy()`, `countBy()`, `sumBy()`, `sortBy()`, `indexBy()`, `mapToObj()`, `pipe()`, `flatMap()`, `filter()`, `mapValues()`, `difference()`, `groupBy()` across 20+ files.
- **`types.ts` interface fields narrowed** — `SkillDefinition.canonicalId` to `SkillId`, `AgentDefinition`/`AgentConfig` model/permission fields to `ModelName`/`PermissionMode`, `ProjectConfig.stack` to `ResolvedSubcategorySkills`. Inline `//` comments converted to JSDoc.
- **Wizard components and store narrowed** — Store selections use `DomainSelections`/`SubcategorySelections`, components use `typedEntries`/`typedKeys`.

### Dependencies

- Added `zod` v4.3.6 — runtime schema validation
- Added `remeda` v2.33.6 — tree-shakeable TypeScript-first utility functions

## [0.22.0] - 2026-02-09

### Changed

- **Union types for skill IDs, categories, agents, and domains** - Added `SkillId`, `CategoryPath`, `SkillAlias`, `AgentName`, `Domain`, `Subcategory` template literal and union types to `types-matrix.ts` as the single source of truth. All interface fields and function parameters across the codebase now use strict union types instead of `string`.
- **Narrowed production function signatures** - 27 production files updated: `matrix-resolver`, `skill-agent-mappings`, `resolver`, `wizard-store`, `step-build`, `category-grid`, and others. Type assertions (`as SkillId`, etc.) used only at data entry boundaries (YAML parsing, CLI input, `Object.keys()`).
- **Normalized skill ID format enforced at compile time** - `SkillId` = `` `${SkillIdPrefix}-${string}` `` prevents old-format IDs like `"react (@vince)"` at the type level. All test files updated to use `domain-subcategory-name` format.
- **Removed test constants** - `TEST_SKILLS`, `TEST_CATEGORIES`, `PLACEHOLDER_SKILLS`, `TEST_AUTHOR` removed from test helpers — union types provide compile-time safety, making string constants redundant.
- **`CategoryDefinition.id`** narrowed from `string` to `Subcategory`.
- **`SkillEntry`** narrowed from `string | SkillAssignment` to `SkillId | SkillAssignment`.

## [0.21.0] - 2026-02-09

### Changed

- **Removed refine wizard step** - The 5-step wizard flow (approach → stack → build → refine → confirm) is now 4 steps (approach → stack → build → confirm). The refine step for skill source selection has been removed; `refineAction` state and `setRefineAction` action removed from wizard store.
- **Build step layout** - Domain tabs header shows all selected domains with active domain highlighted; legend row simplified from positioned overlay to inline flex layout.

### Added

- **`web-extras` domain** - 8 categories (error-handling, file-upload, files, utilities, realtime, animation, pwa, accessibility) split from `web` into a new `web-extras` domain to reduce vertical height in the build view.
- **`parent_domain` field** on `CategoryDefinition` - Sub-domains inherit framework-first filtering from their parent domain (e.g., `web-extras` respects `web`'s framework selection).
- **`parentDomainSelections` prop** on `StepBuild` - Passes parent domain selections for framework compatibility filtering in sub-domains.

## [0.20.0] - 2026-02-07

### Changed

- **Removed `StackConfig` type** - All consumers (compile, agent-recompiler, resolver, stack-plugin-compiler, loader) now operate directly on `ProjectConfig`. The `StackConfig` interface, `loadStack()`, `loadStackSkills()`, `projectConfigToStackLike()`, `resolveAgentSkills()`, and related conversion helpers have been removed.
- **Removed global config layer** - The `~/.claude-collective/config.yaml` global config is no longer supported. Config resolution simplifies from `flag > env > project > global > default` to `flag > env > project > default`. The `config:set` and `config:unset` commands (which wrote to global config) have been deleted.
- **Removed legacy StackConfig detection** - `isLegacyStackConfig()`, `normalizeStackConfig()`, and the legacy format migration branch in `loadProjectConfig()` have been removed. `ProjectConfig` is the only supported format.
- **Removed StackConfig-based generator functions** - `generateConfigFromSkills`, `generateConfigFromStack`, `mergeStackWithSkills`, and `generateProjectConfigFromStack` removed from config-generator.
- **Removed `suggested_stacks` from skills matrix** - The field on `SkillsMatrixConfig` and the alias-resolution logic in `resolveSuggestedStacks()` have been removed; stacks are defined in `stacks.yaml`.
- **Removed deprecated frontmatter field warnings** - `category`, `author`, and `version` warnings in skill frontmatter validation removed (metadata comes from `metadata.yaml`).
- **Removed deprecated skill extraction functions** - `extractSkillName`, `extractCategory`, `extractAuthor` stubs removed from skill-plugin-compiler.
- **Removed deprecated `skills` field from `AgentDefinition`** - Skills come from stacks, not agent definitions.

### Removed

- **`config:set` command** - Wrote to removed global config.
- **`config:unset` command** - Wrote to removed global config.
- **`test-imports` command** - Hidden debug command no longer needed.
- **`GlobalConfig` type and helpers** - `loadGlobalConfig`, `saveGlobalConfig`, `getGlobalConfigPath`, `getGlobalConfigDir`.
- **`"global"` source origin** - Removed from `sourceOrigin` and `AgentsSourceOrigin` union types.

## [0.19.0] - 2026-02-07

### Changed

- **Removed top-level categories from skills matrix** - Top-level categories (`frontend`, `backend`, `setup`, `cli`, `mobile`, `reviewing`, `methodology`, `research`, `shared`, `local`) and the `parent` field on subcategories have been removed. The wizard already operated entirely on the `domain` field; the top-level layer added no value.
- **Aligned agent mapping patterns with domains** - Category path patterns in skill-agent-mappings renamed: `frontend/*` → `web/*`, `backend/*` → `api/*`, `setup/*` → `infra/*`. YAML defaults and marketplace generator updated to match.
- **Renamed `frontend/realtime` to `realtime`** - Composite subcategory ID simplified to match the `^[a-z][a-z0-9-]*$` schema pattern.
- **Stacks alias renamed** - `backend-testing` → `api-testing` in stacks.yaml.

### Added

- **New web categories** - `animation`, `pwa`, `accessibility`, `web-performance` for skills previously bucketed under the removed `frontend` top-level.
- **New shared categories** - `methodology`, `research`, `reviewing`, `ci-cd` for meta and infrastructure skills.

### Removed

- **`parent` field** from `CategoryDefinition` type and JSON schema.
- **`getSubcategories()` and `getTopLevelCategories()`** from matrix-resolver (unused in production code).

## [0.18.0] - 2026-02-07

### Added

- **Matrix health check** - New `matrix-health-check` module validates referential integrity of the merged skills matrix at load time, surfacing ghost skill IDs, missing domains, unknown categories, and dangling stack references
- **Diagnostic logging for alias resolution** - `resolveToCanonicalId` in matrix-loader now accepts a context parameter for verbose-level messages when an ID can't be resolved
- **Logger `warn()` function** - Always-visible warnings (not gated by verbose mode) for issues like unresolved aliases and missing skill categories
- **Expanded matrix categories** - Top-level categories (methodology, research, shared, local) and new subcategories: error-handling, i18n, file-upload, files, utilities, frontend/realtime, performance, security
- **New skill aliases** - `tailwind` → `web-styling-tailwind`, `mobx` → `web-state-mobx`, updated `oclif` → `cli-framework-oclif-ink`

### Changed

- **Dead types removed** - Removed unused types from `types.ts` (`SkillsConfig`, `RegistryConfig`, `AgentsConfig`, `AgentSkillEntry`, `SkillYamlConfig`, `Config`, `PluginCompileOptions`) and `types-matrix.ts` (`WizardState`)
- **Type disambiguations** - `ProjectConfig` → `ProjectSourceConfig` in config.ts, `SkillPluginOptions`/`StackPluginOptions` → `SkillManifestOptions`/`StackManifestOptions` in plugin-manifest.ts, `ForkedFromMetadata` → `ImportedForkedFromMetadata` in import command, `ValidationResult` → `BuildStepValidation` in step-build
- **Shared `extractFrontmatter` utility** - Deduplicated three identical copies (output-validator, plugin-validator, schema-validator) into `src/cli/utils/frontmatter.ts`
- **Shared wizard utilities** - Extracted `getDomainDisplayName` and `getStackName` from wizard.tsx and step-build.tsx into `wizard/utils.ts`
- **Consolidated `injectForkedFromMetadata`** - Moved from skill-copier.ts and update.tsx into skill-metadata.ts as single source of truth
- **`parseFrontmatter` import** - skill-plugin-compiler.ts now imports from loader.ts instead of defining its own copy
- **`LocalResolvedSkill` type** - Extracted named type in local-installer.ts replacing repeated inline object types
- **Deprecated `WizardResult` removed** - Wizard `onComplete` callback now accepts only `WizardResultV2`
- **`OutputValidationResult` replaced** - Uses `ValidationResult` from types.ts instead of local duplicate
- **Matrix alias cleanup** - Removed references to skills not yet created (yargs, clack, inquirer, ink, svelte) from conflicts, alternatives, recommends, and requires

## [0.17.0] - 2026-02-07

### Added

- **Local skill badge in wizard** - Skill tags in the CategoryGrid now show a gray `[L]` badge when the skill has a local override in `.claude/skills/`

### Changed

- **Extract config-merger module** - Config merging logic (identity fields, skills/agents union, stack deep-merge) extracted from `init.tsx` into dedicated `lib/config-merger.ts` with comprehensive tests
- **Extract local-installer module** - Local installation orchestration (skill copying, config generation, agent compilation) extracted from `init.tsx` into `lib/local-installer.ts`, reducing the command to a thin orchestrator
- **Deduplicate getCurrentDate** - Removed duplicate `getCurrentDate()` definitions from `import/skill.ts`, `update.tsx`, and `skill-copier.ts` in favor of the canonical export from `lib/versioning.ts`
- **Graceful missing skill resolution** - `resolveSkillReference` now returns `null` and logs a verbose message instead of throwing when a skill is not found; callers skip missing skills gracefully
- **Remove synthetic local categories** - Stop injecting fake `local` and `local/custom` category definitions into the skills matrix; local skills use their declared or inherited category

### Fixed

- **Wizard skill count mismatch** - Confirm step now uses `getAllSelectedTechnologies()` instead of `getSelectedSkills()` so the count matches the actual technologies shown
- **Wizard option tracking** - Build step uses `skill.id` instead of alias for `CategoryOption.id` so selection tracking stays consistent
- **Multi-skill category pre-population** - Stack pre-population now uses per-skill pseudo-agents so categories with multiple skills (e.g. testing: vitest + playwright-e2e) are all preserved instead of the second overwriting the first

## [0.16.0] - 2026-02-07

### Changed

- **Wizard flow simplified** - Removed the intermediate "stack-options" step; selecting a stack now goes directly to the build step with pre-populated technology selections. Flow is now: approach -> stack -> build -> refine -> confirm
- **ViewTitle component** - Simplified API from `title` string prop to `children` for flexible composition
- **Build step header** - Replaced domain tab header with ViewTitle showing "Customise your {Domain} stack"
- **Build step legend** - Simplified color legend from background-colored badges to plain colored text
- **CategoryGrid styling** - Skill tags now use border-based styling instead of background colors; removed section header underlines

### Added

- **Accept defaults shortcut** - Press `A` during build step (stack path only) to skip customization and continue with stack defaults
- **All-domain cycling** - Stack selection now includes all five domains (web, api, cli, mobile, shared) in the build step, even if the stack only covers some

### Fixed

- **Local skill category preservation** - When a local skill overwrites a remote skill, the remote skill's domain-based category is now preserved instead of falling back to "local/custom"

### Removed

- **StepStackOptions component** - Eliminated intermediate step between stack selection and technology customization

## [0.15.0] - 2026-02-07

### Added

- **MenuItem component** - Reusable chevron + label menu item with focused/active states for wizard navigation
- **ViewTitle component** - Yellow-background title banner for consistent wizard step headings
- **Global keyboard shortcuts** - `E` toggles expert mode, `P` toggles plugin/local install mode, `D` toggles descriptions (on build step) - available from any wizard step

### Changed

- **Step Approach** - Replaced Select dropdown with custom card-based navigation using arrow keys and Enter
- **Step Stack** - Replaced Select dropdown with card-based stack selection; Escape for back navigation; focus starts at first stack
- **Mode toggles** - Expert mode and install mode moved from per-step menu options to persistent global shortcuts shown in layout footer
- **Build step legend** - Repositioned color legend (active/recommended/discouraged/disabled) above category grid

### Removed

- **Inline keyboard hints** - Removed per-step keyboard hint text (global footer already provides this)
- **CategoryGrid header/legend** - Moved toggle indicators and legend out of CategoryGrid to parent components

## [0.14.1] - 2026-02-07

### Changed

- **Extract skill-metadata library** - Deduplicated `readForkedFromMetadata`, `getLocalSkillsWithMetadata`, `computeSourceHash`, and `compareSkills` into shared `lib/skill-metadata.ts`, removing ~254 lines from `update.tsx`, `outdated.ts`, and `diff.ts`
- **Extract config-saver library** - Deduplicated `saveSourceToProjectConfig` into shared `lib/config-saver.ts`, removing duplication from `init.tsx` and `eject.ts`
- **Extract plugin-manifest-finder library** - Deduplicated `findPluginManifest` into shared `lib/plugin-manifest-finder.ts`, removing duplication from 4 `version/*` command files

### Removed

- **Unused step-build props** - Removed `currentDomainIndex` prop, dead code from SectionProgress removal (unused imports, constants, functions)

## [0.14.0] - 2026-02-07

### Changed

- **WizardLayout component** - Extracted layout wrapper that renders WizardTabs (header), children, and WizardFooter consistently across all wizard steps
- **Wizard tabs** - Simplified to text-only styling (cyan current, dimmed skipped) with horizontal border lines; renamed "Approach" step to "Intro"; version displayed in tab bar
- **Build step header** - Redesigned with domain tab navigation and inline toggle indicators for descriptions and expert mode
- **Wizard footer** - Unified keyboard shortcut hints (navigate, select, continue, back, export) displayed on all steps, replacing per-step footer strings

### Added

- **ASCII art banner** - Init command displays stylized banner on startup
- **Prettier config** - Added `prettier.config.mjs` for consistent code formatting (printWidth 100)

### Removed

- **Old WizardFooter component** (`wizard-footer.tsx`) - Replaced by centralized footer in WizardLayout
- **SectionProgress in build step** - Domain progress replaced by domain tab navigation in header

### Fixed

- **Version display** - Fixed broken `import { config } from "process"` (Node's build config, not CLI version); version now prop-drilled from oclif `this.config.version`

## [0.13.4] - 2026-02-06

### Fixed

- **local skills lose category metadata** - Local skills from `.claude/skills/` were hardcoded to `category: "local/custom"`, destroying their original category (e.g., `"framework"`, `"styling"`). This broke framework pre-selection in the wizard's Build step and domain filtering. Now preserves the original category from `metadata.yaml` when it matches a matrix category, and carries forward aliases and relationships from source skills.

## [0.13.3] - 2026-02-06

### Fixed

- **local config not found during recompile** - `recompileAgents` only looked for config in the plugin directory, missing local mode configs in the project directory. now falls back to project directory when plugin dir has no config
- **agent_skills normalization** - `agent_skills` from project config was passed to the compiler without normalizing mixed formats (string arrays vs object maps), causing compilation failures

## [0.13.2] - 2026-02-06

### Fixed

- **npx eject missing agent partials** - `src/agents/` directory was not included in the published npm package, causing `eject all` and `eject agent-partials` to warn "No agent partials found" and skip agent ejection

## [0.13.1] - 2026-02-06

### Fixed

- **npx eject fails with ENOENT** - `config/` directory (skills-matrix.yaml, stacks.yaml) was missing from the published npm package, causing `npx @claude-collective/cli eject all` to fail
- **Build copies config to dist** - `config/` is now copied to `dist/config/` during build for correct runtime path resolution
- **Test suite portability** - Integration tests that depend on the external claude-subagents repo are now gated behind `CC_TEST_SKILLS_SOURCE` env var
- **macOS temp path mismatch** - Fixed `/private/var` vs `/var` symlink issue in installation test
- **Pre-commit hook** - Changed `bun test` to `bun run test` to use vitest instead of bun's built-in test runner

## [0.13.0] - 2026-02-06

### Added

- **Import skill command** (`cc import skill`) - Import skills from GitHub repos with `--list`, `--skill`, `--all`, `--force`, `--dry-run` options
- **Interactive skill search** (`cc search -i`) - Live filtering, multi-select, batch import from configured sources
- **Sources config** - Configure multiple skill registries in `config.yaml` with `sources` array
- **Wizard footer component** - Split-layout footer with navigation hints on left, actions on right
- **Framework-first build flow** - Web domain hides other categories until framework is selected

### Changed

- **Wizard tabs** - Tab-style navigation with background colors (cyan active, white completed) instead of circle indicators
- **Wizard header** - Now displays CLI version
- **Category grid styling** - Background colors instead of circles/strikethrough for selection states
- **Agent definitions generalized** - 16 agents updated to use generic terms (styling, database) instead of specific tech (SCSS, Drizzle)

### Removed

- Old `search.ts` command - Replaced with dual-mode `search.tsx` (static + interactive)

[0.21.0]: https://github.com/claude-collective/cli/releases/tag/v0.21.0
[0.20.0]: https://github.com/claude-collective/cli/releases/tag/v0.20.0
[0.19.0]: https://github.com/claude-collective/cli/releases/tag/v0.19.0
[0.18.0]: https://github.com/claude-collective/cli/releases/tag/v0.18.0
[0.17.0]: https://github.com/claude-collective/cli/releases/tag/v0.17.0
[0.16.0]: https://github.com/claude-collective/cli/releases/tag/v0.16.0
[0.15.0]: https://github.com/claude-collective/cli/releases/tag/v0.15.0
[0.14.1]: https://github.com/claude-collective/cli/releases/tag/v0.14.1
[0.14.0]: https://github.com/claude-collective/cli/releases/tag/v0.14.0
[0.13.4]: https://github.com/claude-collective/cli/releases/tag/v0.13.4
[0.13.3]: https://github.com/claude-collective/cli/releases/tag/v0.13.3
[0.13.2]: https://github.com/claude-collective/cli/releases/tag/v0.13.2
[0.13.1]: https://github.com/claude-collective/cli/releases/tag/v0.13.1
[0.13.0]: https://github.com/claude-collective/cli/releases/tag/v0.13.0

## [0.12.0] - 2026-02-04

### Added

- **Agent Compliance Bible** - 30-test compliance suite in `docs/bibles/AGENT-COMPLIANCE-BIBLE.md` for verifying agent alignment with PROMPT_BIBLE and architecture standards
- **Claude Code Research** - Documentation of 176 Claude Code updates (Oct 2025 - Jan 2026) covering subagents, hooks, plugins, and async execution patterns
- **cli-tester examples** - Example test output for CLI component testing

### Changed

- **Agent partials improved** - Major conciseness pass on 15+ examples.md files, removed ~800 lines of filler, N/A sections, and verbose examples
- **Workflow quality** - Standardized workflows across all agents, removed time estimates, improved clarity
- **Bible index updated** - Fixed paths from `src/docs/` to `docs/bibles/`, corrected agent naming conventions

[0.12.0]: https://github.com/claude-collective/cli/releases/tag/v0.12.0

## [0.11.0] - 2026-02-04

### Breaking Changes

- **CLI source directory renamed** - `src/cli-v2/` renamed to `src/cli/`. The v2 suffix was removed as this is now the primary CLI implementation.

### Added

- **Bible documentation** - Added comprehensive documentation standards in `docs/bibles/`:
  - `CLAUDE_ARCHITECTURE_BIBLE.md` - System architecture and agent structure
  - `PROMPT_BIBLE.md` - Prompt engineering techniques
  - `DOCUMENTATION_BIBLE.md` - Documentation standards
  - `FRONTEND_BIBLE.md` - Frontend development standards
  - `SKILL-ATOMICITY-BIBLE.md` - Skill design principles
  - `INDEX.md` - Bible index and reference guide
- **Missing command documentation** - Added docs for: `doctor`, `search`, `outdated`, `info`, `diff`, `update`, `new skill`, `new agent`, and all config/version subcommands
- **skills-matrix.yaml schema documentation** - Full schema with categories, relationships, and skill aliases documented in `data-models.md`

### Changed

- **Agents genericized** - Developer agents no longer reference specific technologies (SCSS, Drizzle, Commander.js, etc.). Skills provide implementation details.
- **Agent references fixed** - Updated all agent references to use correct names: `frontend-*` → `web-*`, `backend-*` → `api-*`, `tester` → `web-tester`/`cli-tester`
- **Documentation paths fixed** - Fixed skill paths from `src/skills/` to `.claude/skills/`, Bible paths to `docs/bibles/`
- **cc eject options corrected** - Changed from `templates/config/agents` to `agent-partials/skills/all`
- **README install paths fixed** - Changed `~/.claude/` to `./.claude/` (relative to project)
- **Command naming convention** - Updated docs to use space-separated format (`build plugins`) instead of colon notation (`build:plugins`)

### Removed

- **Deprecated documentation** - Deleted outdated files that referenced non-existent architecture:
  - `docs/workflows.md` - Referenced non-existent `src/stacks/`
  - `docs/stacks-as-visual-hierarchy.md` - Design proposal never implemented
  - `docs/solution-a-migration-tasks.md` - Outdated migration document

[0.11.0]: https://github.com/claude-collective/cli/releases/tag/v0.11.0

## [0.10.0] - 2026-02-03

### Breaking Changes

- **Directory structure changed** - Source files now in `.claude-src/`, runtime output in `.claude/`. Config moved from `.claude/config.yaml` to `.claude-src/config.yaml`. Backward compatible reads from both locations.
- **Uninstall removes directories** - `cc uninstall` now removes entire `.claude/` and `.claude-src/` directories. The `--keep-config` flag is removed.

### Added

- `CLAUDE_SRC_DIR` constant for `.claude-src/` directory
- `loadProjectAgents()` function to load agents from `.claude-src/agents/`
- `agentBaseDir` field on AgentDefinition/AgentConfig types
- `marketplace` and `agents_source` fields on ProjectConfig type
- Eject creates minimal `config.yaml` with example stack blueprint if it doesn't exist
- Init merges with existing config instead of overwriting

### Changed

- Eject agent-partials go to `.claude-src/agents/` (was `.claude/agents/_partials/`)
- Init writes config to `.claude-src/config.yaml`
- Compiler checks `.claude-src/agents/_templates/` first for templates
- Config readers check `.claude-src/` first, fall back to `.claude/`

[0.10.0]: https://github.com/claude-collective/cli/releases/tag/v0.10.0

## [0.9.0] - 2026-02-03

### Breaking Changes

- **Config location changed** - Project config now at `.claude/config.yaml` instead of `.claude-collective/config.yaml`. Global config is deprecated.
- **Eject types simplified** - Old types `templates`, `config`, `agents` removed. Use `agent-partials`, `skills`, or `all`.

### Added

- `--refresh` flag for `cc eject` to force refresh cached remote sources
- Source is saved to `.claude/config.yaml` when using `--source` flag
- `resolveAuthor()` function for project-level author resolution
- `populateFromStack()` wizard action to pre-populate domain selections

### Fixed

- **Compiled agents now include preloaded_skills** - Fixed bug where agents compiled by `cc init` had no skills in frontmatter
- **Wizard "customize" option** - Now pre-populates with stack defaults instead of starting from scratch
- **Source fetcher cache handling** - No longer errors when cache directory already exists

### Changed

- Eject loads skills from source marketplace instead of plugin directory
- Global config functions deprecated in favor of project-level config

[0.9.0]: https://github.com/claude-collective/cli/releases/tag/v0.9.0

## [0.8.0] - 2026-02-02

### Breaking Changes

- **Skill IDs normalized to kebab-case** - Skill IDs changed from path-based format with author suffix (e.g., `web/framework/react (@vince)`) to simple kebab-case (e.g., `web-framework-react`). Consumer configs and any code referencing old skill IDs must be updated.

### Added

- **Meta-stack** - New stack for meta-level development with 5 agents (skill-summoner, agent-summoner, documentor, pattern-scout, web-pattern-critique) mapped to methodology and research skills.

### Changed

- `skill_aliases` in skills-matrix.yaml now map to normalized kebab-case IDs
- `DEFAULT_PRESELECTED_SKILLS` updated to use new ID format
- Simplified `skill-copier.ts`, `skill-plugin-compiler.ts`, `marketplace-generator.ts` - removed path parsing logic

### Removed

- `normalizeSkillId()` function - no longer needed since frontmatter contains canonical IDs

### Fixed

- **Uninstall command terminal state** - Added proper `exit()` calls to restore terminal after confirmation

[0.8.0]: https://github.com/claude-collective/cli/releases/tag/v0.8.0

## [0.7.0] - 2026-02-02

### Breaking Changes

- **Wizard flow redesigned** - New 5-step flow: Approach → Stack → Build → Refine → Confirm. The old category → subcategory linear flow is replaced with domain-based grid selection.

### Added

- **Domain-based navigation** - Categories now have a `domain` field (web, api, cli, mobile, shared) for filtering in the Build step
- **CategoryGrid component** - 2D grid selection with keyboard navigation (arrows, vim keys h/j/k/l), visual states (selected, recommended, discouraged, disabled)
- **WizardTabs component** - Horizontal 5-step progress indicator with completed/current/pending/skipped states
- **SectionProgress component** - Sub-step progress for multi-domain flows
- **StepBuild component** - Grid-based technology selection per domain, replaces linear category/subcategory flow
- **StepRefine component** - Skill source selection (verified skills, customize coming soon)
- **StepStackOptions component** - Options after stack selection (continue defaults or customize)
- **CLI domain support** - New `cli` category in skills-matrix with framework, prompts, testing subcategories
- **Wizard store v2** - Complete rewrite with history-based navigation, domain selections, grid focus state

### Changed

- `wizard.tsx` - Complete rewrite as orchestrator for new 5-step flow
- `step-approach.tsx` - Updated for v2 store
- `step-stack.tsx` - Now dual-purpose: stack selection (stack path) or domain selection (scratch path)
- `step-confirm.tsx` - Updated to show domain breakdown, technology/skill counts
- `wizard-store.ts` - Migrated to v2 state shape with approach, selectedDomains, domainSelections, stackAction, focusedRow/Col

### Removed

- `step-category.tsx` - Replaced by StepBuild with CategoryGrid
- `step-subcategory.tsx` - Replaced by StepBuild with CategoryGrid
- `selection-header.tsx` - No longer needed

### Fixed

- **Skill resolution for stack defaults** - Selecting a stack with "Continue with defaults" now correctly includes all stack skills (was only including methodology skills)
- **Display names in Build step** - Technologies now show clean names ("React") instead of full IDs ("React (@vince)")

[0.7.0]: https://github.com/claude-collective/cli/releases/tag/v0.7.0

## [0.6.0] - 2026-02-01

### Breaking Changes

- **Skills now defined in stacks, not agents** - Previously, each agent YAML contained a `skills` field. Now, stacks define technology selections per agent in `config/stacks.yaml`. Skills are resolved via `skill_aliases` in the skills matrix. This fixes the bug where stacks got wrong skills (e.g., angular-stack getting React skills).
- **stacks.yaml schema changed** - Agents are now objects with subcategory→technology mappings (e.g., `web-developer: { framework: react, styling: scss-modules }`) instead of simple string lists.
- **Removed `skills` field from agent schema** - Agent YAMLs no longer contain skill definitions.

### Added

- **`stack` property in consumer config.yaml** - When a stack is selected, the resolved agent→skill mappings are stored in the project config for reproducibility.
- **`resolveAgentSkillsFromStack()`** - New function in resolver.ts to extract skills from stack configurations.
- **`resolveStackSkillsFromAliases()`** - New function in stacks-loader.ts to resolve technology selections to skill IDs via the matrix.
- **Phase 7 UX specification** - Comprehensive documentation for upcoming wizard UX redesign with domain-based navigation and grid-based skill selection.

### Changed

- `loadStackById()` now reads technology selections per agent from the new stacks.yaml format
- `getAgentSkills()` now accepts optional `stack` and `skillAliases` parameters for Phase 7 skill resolution
- `stackToResolvedStack()` extracts skills from stack configurations instead of agent YAMLs
- Stack plugin compiler now extracts skills via matrix aliases

### Removed

- `skills` field from all 18 agent YAMLs - skills now come from stacks
- `skills` property from agent.schema.json

[0.6.0]: https://github.com/claude-collective/cli/releases/tag/v0.6.0

## [0.5.1] - 2026-02-01

### Added

- **Auto-detection of installation mode** - CLI now automatically detects whether you have a local (`.claude/`) or plugin (`.claude/plugins/claude-collective/`) installation. No more `--output` flag needed for local mode.
- **`installMode` property in config.yaml** - new installations now store `installMode: local | plugin` explicitly in config
- **`detectInstallation()` utility** - shared function for consistent installation detection across commands
- **Local template support** - `compile` now uses templates from `.claude/templates/` if present (after running `eject templates`)

### Changed

- `cc compile` - auto-detects local mode and outputs to `.claude/agents` without needing `--output` flag
- `cc list` - now works for both local and plugin mode installations, shows mode in output
- `cc edit` - now works with local mode installations
- `nextjs-fullstack` stack - now includes all 18 agents (added `cli-tester` and `cli-migrator`)

### Fixed

- Local templates not being used after `eject templates` - compile now correctly checks for `.claude/templates/` before falling back to CLI bundled templates

[0.5.1]: https://github.com/claude-collective/cli/releases/tag/v0.5.1

## [0.5.0] - 2026-02-01

### Breaking Changes

- **Agent-centric configuration** - skills are now defined in agent YAMLs instead of stack config files. Stacks are now simple agent groupings in `config/stacks.yaml`. This is a significant architectural change that simplifies configuration but requires migration for custom stacks.

### Added

- **Skills in agent YAMLs** - each agent now defines its own skills with a `preloaded` flag to control what's included in the agent prompt
- **Centralized stacks.yaml** - all 7 stacks (nextjs-fullstack, angular, nuxt, remix, vue, solidjs, react-native) are now defined in `config/stacks.yaml` with agent lists and philosophy
- **stacks-loader** - new module to load stacks from config/stacks.yaml
- **resolveAgentSkills()** - function to extract skills from agent definitions

### Changed

- `loadStackById()` now loads from `config/stacks.yaml` (new format) instead of `src/stacks/*/config.yaml`
- `getAgentSkills()` priority order: compile config > agent skills > stack-based (legacy)
- `stackToResolvedStack()` now extracts skill IDs from agent definitions
- `build:stack` command deprecated (shows warning and exits)

### Removed

- Stack config files (`src/stacks/*/config.yaml`) - skills now come from agent YAMLs
- `suggested_stacks` section from `skills-matrix.yaml` - moved to `stacks.yaml`

### Internal

- Updated all 17 agent YAMLs with skills fields
- Deprecated `skill-agent-mappings.ts` (kept for wizard fallback)
- Updated tests to work with new stack format (passing Stack objects instead of writing config files)

[0.5.0]: https://github.com/claude-collective/cli/releases/tag/v0.5.0

## [0.4.0] - 2026-01-31

### Added

- **Methodology skills preselected** - foundational skills (anti-over-engineering, context-management, investigation-requirements, success-criteria, write-verification, improvement-protocol) are now selected by default in the wizard
- **CLI skills in nextjs-fullstack** - stack now includes cli-commander, cli-reviewing, and setup skills for posthog, email, and observability
- **Test isolation support** - `CC_CONFIG_HOME` environment variable allows overriding the global config directory
- **Comprehensive test suite** - 1000+ tests covering commands, components, and user journeys

### Internal

- Added cli-migrator and cli-tester agents for CLI development workflows
- Added research documentation for CLI testing strategies and stack simplification

[0.4.0]: https://github.com/claude-collective/cli/releases/tag/v0.4.0

## [0.3.0] - 2026-01-31

### Changed

- **CLI Framework Migration** - migrated from Commander.js + @clack/prompts to oclif + Ink for improved maintainability and extensibility
- All commands now use oclif's class-based command structure
- Interactive components now use Ink (React-based terminal UI)
- Wizard state management now uses Zustand
- Removed dependencies: commander, @clack/prompts, @clack/core, picocolors
- Added dependencies: @oclif/core, @oclif/plugin-\*, ink, react, @inkjs/ui, zustand

[0.3.0]: https://github.com/claude-collective/cli/releases/tag/v0.3.0

## [0.2.0] - 2026-01-30

### Added

- **Marketplace support** - install stack plugins directly from configured marketplaces
- Marketplace field in project and global config for plugin installation
- CLI utilities for marketplace management (`marketplace list`, `exists`, `add`)
- Multi-source agent loading - agents can now be loaded from both CLI and custom sources
- `sourceRoot` tracking for correct template resolution with multi-source agents

### Changed

- Removed skills eject functionality (use marketplace plugins instead)

### Fixed

- Wizard now preserves approach selection state when toggling Expert Mode or Install Mode

[0.2.0]: https://github.com/claude-collective/cli/releases/tag/v0.2.0

## [0.1.3] - 2026-01-30

### Added

- `--output` option for eject command to specify custom output directory
- Remote schema fetching for skill validation from GitHub

### Fixed

- Plugin manifest no longer includes agents field (Claude Code discovers automatically)
- Source loader now supports source-provided skills matrix

[0.1.3]: https://github.com/claude-collective/cli/releases/tag/v0.1.3

## [0.1.2] - 2026-01-30

### Changed

- Removed local dev files from repo (.claude, CLAUDE.md)

[0.1.2]: https://github.com/claude-collective/cli/releases/tag/v0.1.2

## [0.1.1] - 2026-01-30

### Fixed

- `GITHUB_REPO` const now points to correct repo
- README agent names match actual stack config

[0.1.1]: https://github.com/claude-collective/cli/releases/tag/v0.1.1

## [0.1.0] - 2026-01-30

### Added

- **Interactive wizard** (`cc init`) - guided setup with stack/skill selection
- **Stack installation** - install curated skill bundles (nextjs-fullstack, api-only, etc.)
- **Individual skill installation** - pick specific skills for your project
- **Skill compilation** (`cc compile`) - compile skills and agents
- **Validation** (`cc validate`) - validate skill file structure and content
- **Configuration management** (`cc config`) - view and edit project settings
- **List command** (`cc list`) - browse available and installed skills/stacks
- **Eject command** (`cc eject`) - eject templates for customization
- **Plugin mode** - native Claude Code plugin installation
- **Local mode** - copy skills directly to `.claude/skills/`

### Stacks Included

- `nextjs-fullstack` - Next.js App Router + Hono + Drizzle + Better Auth
- `angular-stack` - Angular 19 + Signals + NgRx
- `vue-stack` - Vue 3 + Pinia + Tailwind
- `nuxt-stack` - Nuxt + Vue 3
- `remix-stack` - Remix + React
- `solidjs-stack` - SolidJS + Tailwind
- `react-native-stack` - React Native + Expo

### Skills Available

80+ skills across domains:

- Web (React, SCSS Modules, Zustand, React Query, MSW)
- API (Hono, Drizzle, Better Auth, Resend)
- Infrastructure (GitHub Actions, Turborepo, PostHog)
- Quality (Vitest, Security, Accessibility)

[0.1.0]: https://github.com/claude-collective/cli/releases/tag/v0.1.0
