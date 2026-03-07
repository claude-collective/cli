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
- [x] Moved all `TestSkill[]` constants to `mock-data/mock-skills.ts`
- [x] Moved `INIT_SKILL_IDS`, `EJECT_INSTALLED_SKILL_IDS`, `TEST_AVAILABLE_SKILLS` to `mock-skills.ts`
- [x] Moved `PUBLIC_SKILLS`, `ACME_SKILLS`, `INTERNAL_SKILLS`, `SkillEntry` type to `mock-skills.ts`
- [x] Fixed diagnostics: removed unused `deriveInstallMode`, `AgentName`, `installResult`, `createMetadataContent`

### Type Redundancy & Pick Usage — COMPLETE

- [x] Extract `CategoryDomainMap` type alias in `types/matrix.ts` — replaced 15 inline occurrences
- [x] `PluginConfigResult` → `Omit<LocalInstallResult, "copiedSkills" | "skillsDir">`
- [x] `parseAgentFrontmatter` return type → `Pick<AgentFrontmatter, "name" | "description"> | null`
- [x] `DashboardProps` → `DashboardData & { onSelect; onCancel }`
- [x] `resolveSetupPairs` return type → `Pick<ResolvedSkill, "requiresSetup" | "providesSetupFor">`
- [x] `buildBoundSkillOptions` return type → `SourceOption[]` (imported from source-grid.tsx)
- [x] `SkillSearchResult` — not redundant (result container, not a skill shape)
- [x] `CompileStepResult` — no longer exists in the codebase

### Test Infrastructure Cleanup — COMPLETE

- [x] `writeTestSkill` — slug, category, domain derived from skillId via `parseSkillId()`; options fully optional; 35+ call sites simplified
- [x] `TestSkill` derived from `Pick<ExtractedSkillMetadata, ...>` — shared fields stay in sync
- [x] `displayName` required on `TestSkill` — added to all ~45 TestSkill objects
- [x] `alias` field removed from `TestSkill` — dead code from pre-slug era
- [x] `aliases` field removed from `TestMatrix` — dead code from pre-slug era
- [x] `aliases: {}` removed from `diskRules` in `create-test-source.ts` and `validate.test.ts`
