# Type Cleanup Tasks

Tracking remaining fixes from the type redundancy audit session.

## Done

- [x] Remove `Partial` from `SkillDefinitionMap` in `src/cli/types/skills.ts`
- [x] Remove `Partial` from `SkillSlugMap` in `src/cli/types/matrix.ts`
- [x] Make `displayName` and `category` required in `localRawMetadataSchema` (`src/cli/lib/schemas.ts`)
- [x] Remove category/displayName fallback logic in `src/cli/lib/skills/local-skill-loader.ts`
- [x] `SKILL_FIXTURES` → `satisfies Partial<Record<SkillSlug, ResolvedSkill>>`, use `createMockSkill`
- [x] `TEST_SKILLS` → `satisfies Partial<Record<SkillSlug, ResolvedSkill>>`, rename camelCase keys to kebab-case slugs
- [x] Update all call sites for renamed `TEST_SKILLS` keys (helpers.ts, mock-matrices.ts, test-fixtures.ts)
- [x] `slug` optional in marketplace `rawMetadataSchema`, derived from directory when missing
- [x] `slug` required in `localRawMetadataSchema`

- [x] Fix source-loader tests — `"dummy-category"` with `custom: true` passes validation

- [x] `getSkillDisplayLabel` — removed `|| skill.id` fallback, simplified signature to `Pick<SkillOption, "displayName">`
- [x] `writeSourceSkill` — added `slug` to config, removed derivation from id
- [x] `writeValidSourceSkill` — added `slug` to config, removed derivation from id
- [x] `loadSkillsByIds` — return type changed to `SkillDefinitionMap`, removed casts at call sites
- [x] `slug` required in marketplace `rawMetadataSchema` (not optional), removed fallback derivation
- [x] Removed directory-path alias hack in `loadSkillsByIds` (`loader.ts`)
- [x] `TestSkill` type: added `slug: SkillSlug` field, all call sites updated
- [x] `writeSourceSkill` config typed as `TestSkill` (removed `WriteSourceSkillConfig`)
- [x] `writeValidSourceSkill` config typed as `TestSkill` (removed `WriteValidSourceSkillConfig`)
- [x] `TestSkill`: added `displayName?`, `cliDescription?`, `usageGuidance?` optional fields
- [x] Fixed all invalid `as SkillSlug` casts in test data — replaced with valid union members
- [x] Moved all `TestSkill[]` constants to `mock-data/mock-skills.ts`: `PIPELINE_TEST_SKILLS`, `RESOLUTION_PIPELINE_SKILLS`, `SWITCHABLE_SKILLS`, `LOCAL_SKILL_VARIANTS`, `DEFAULT_TEST_SKILLS`, `METHODOLOGY_TEST_SKILLS`, `EXTRA_DOMAIN_TEST_SKILLS`, `COMPILE_LOCAL_SKILL`, `ALL_TEST_SKILLS`, `CI_CD_SKILLS`, `DISCOURAGES_TEST_SKILLS`, `REQUIRES_TEST_SKILLS`, `DOCKER_TOOLING_SKILL`, `DATADOG_OBSERVABILITY_SKILL`
- [x] Moved `INIT_SKILL_IDS`, `EJECT_INSTALLED_SKILL_IDS`, `TEST_AVAILABLE_SKILLS` to `mock-skills.ts`
- [x] Moved `PUBLIC_SKILLS`, `ACME_SKILLS`, `INTERNAL_SKILLS`, `SkillEntry` type to `mock-skills.ts`
- [x] Fixed diagnostics: removed unused `deriveInstallMode`, `AgentName`, `installResult`, `createMetadataContent`

## Refactor: Type Redundancy & Pick Usage

Findings from background audit. Address when touching these files.

### HIGH

- [ ] Extract `CategoryDomainMap` type alias (`Partial<Record<Category, Domain>>`) in `src/cli/types/matrix.ts` — repeated 4× in `wizard-store.ts` + 11× in tests
- [ ] `PluginConfigResult` in `src/cli/lib/installation/local-installer.ts` — duplicates fields from `LocalInstallResult`, should be `Pick<LocalInstallResult, ...>`
- [ ] `parseAgentFrontmatter` return type in `src/cli/lib/skills/agent-plugin-compiler.ts` — returns subset of `AgentFrontmatter`, should use `Pick<AgentFrontmatter, "name" | "description">`
- [ ] `resolveSetupPairs` return type in `src/cli/lib/matrix/matrix-loader.ts` — returns objects with only `requiresSetup` + `providesSetupFor`, should use `Pick<ResolvedSkill, ...>`
- [ ] `buildBoundSkillOptions` return type in `src/cli/stores/wizard-store.ts` — returns `SourceOption[]` already defined in `source-grid.tsx`, should import that type
- [ ] `DashboardProps` in `src/cli/commands/init.tsx` — duplicates fields from `DashboardData`, should extend or use `Pick`

### MEDIUM

- [ ] `SkillSearchResult` in `src/cli/components/skill-search/skill-search.tsx` — overlaps heavily with `SkillOption`, could be `Pick<SkillOption, ...> & { ... }`
- [ ] `CompileStepResult` in `src/cli/components/wizard/wizard.tsx` — mirrors `CompileResult` fields, could use `Pick`

### LOW

- [ ] Test-only type duplications in mock helpers that mirror production types with slight variations — consolidate where possible

## Refactor: `writeTestSkill` — derive fields from `skillId`

`writeTestSkill` currently requires `slug`, `category`, and `domain` to be passed explicitly alongside `skillId`. Since the skill ID encodes these fields (e.g., `"web-framework-react"` → category `"web-framework"`, slug `"react"`, domain `"web"`), the function should derive them from the ID automatically — accept just a `SkillId` and look up or parse the rest.

- [ ] Parse `category`, `slug`, `domain` from `skillId` (or look up from a test matrix/registry)
- [ ] Remove `slug`, `category` from required options
- [ ] Keep options override for edge cases (e.g., `custom: true` categories)
- [ ] Apply same pattern to `createEditableProject` in `e2e/helpers/test-utils.ts` — currently derives `slug`/`category` from skill ID string splitting (lines 300-303). Should accept structured skill data or use the same lookup utility.

## Refactor: Align `TestSkill` with `ExtractedSkillMetadata`

`TestSkill` in `create-test-source.ts` largely mirrors `ExtractedSkillMetadata` from `types/matrix.ts` but is independently declared. Align them:

- [ ] Derive `TestSkill` from `Pick<ExtractedSkillMetadata, ...>` so shared field names/types stay in sync
- [ ] Make `displayName` required on `TestSkill` (matches `ExtractedSkillMetadata`) — add to all ~40 test skill objects in `mock-skills.ts` and other fixtures
- [ ] Confirm `alias` is still needed — currently used by 4 `DEFAULT_TEST_SKILLS` entries + consumed by `createTestSource` line 345
- [ ] Keep test-only fields (`content`, `skipMetadata`, `forkedFrom`, `cliDescription`) as extensions
