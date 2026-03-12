# D-92: Generate Static Matrix from Source

**Status:** Done
**Complexity:** High (codegen restructure + module-level matrix provider)
**Depends on:** R-07 (complete)
**Supersedes:** D-91 (per-category skill constraints become a subset of this work)

## Problem

The `MergedSkillsMatrix` is the central data structure consumed by ~25 production files. It contains skills (with fully resolved relationships), categories (with UI metadata), stacks, slug maps, and agent-domain mappings. **All of this data is static and deterministic for the default public marketplace** — the same inputs always produce the same output.

Yet every CLI run rebuilds it from scratch:

1. Walk 86 skill directories → read 172 files (metadata.yaml + SKILL.md each) → parse YAML → validate with Zod
2. Run `mergeMatrixWithSkills()` → resolve relationships across 7 rule types (conflicts, discourages, recommends, requires, alternatives, compatibleWith, setupPairs) per skill
3. Load stacks → resolve to canonical IDs
4. Load agent metadata → extract domain definitions
5. Build slug map

Categories and rules come from `defaultCategories` and `defaultRules` (hardcoded TypeScript constants in the CLI repo) — the default source repo has no `config/` files to override them.

This is ~200 file reads and ~1000 lines of merge/resolution logic, all to produce the same object every time.

## Proposed Solution

Generate the full `MergedSkillsMatrix` (for the default public marketplace) as a TypeScript const at build time. The generated file becomes the single source of truth for all built-in skill data.

### Two-tier architecture

The solution uses a two-tier architecture to handle the distinction between statically known data and runtime-discovered data.

**Tier 1: `BUILT_IN_MATRIX` (static, generated at build time)**

- Generated from the default source (`agents-inc/skills`) by the codegen script
- Contains all ~86 skills, ~34 categories, 5 domains, stacks, slug map, agent-domain mappings
- Fully typed, fully static TypeScript const
- Includes derived lookup maps: `SKILL_IDS_BY_CATEGORY`, `CATEGORIES_BY_DOMAIN`
- This is the "known universe" for the default marketplace

**Tier 2: Runtime extensions (dynamic, discovered on CLI startup)**

- Local skills from `.claude/skills/` — user-created, unknown at build time
- Third-party source skills from custom marketplaces (`github:acme-corp/skills`) — loaded at runtime
- Parsed from metadata.yaml and merged into the matrix as `ResolvedSkill` objects — type safety comes from config-types.ts regeneration, not Zod membership checks
- Merged on top of `BUILT_IN_MATRIX` via `initializeMatrix()` before consumers access it

**The merge point is explicit:**

- Default source: `merge(BUILT_IN_MATRIX, runtimeExtensions)` → `initializeMatrix(merged)`
- Non-default source: full runtime loading pipeline as today → `initializeMatrix(result.matrix)`
- Consumer code imports `matrix` directly for property access; `getSkill()` and `findSkill()` helper signatures stay the same

### What the generated file contains

```
src/cli/types/generated/
  source-types.ts    ← already exists (unions, SKILL_MAP, const arrays)
  matrix.ts          ← NEW: full MergedSkillsMatrix const + derived lookup maps
```

**`matrix.ts`** contains:

1. **`BUILT_IN_MATRIX: MergedSkillsMatrix`** — the full pre-computed matrix:
   - `categories`: all ~34 `CategoryDefinition` objects (displayName, domain, order, exclusive, required, icon)
   - `skills`: all ~86 `ResolvedSkill` objects with fully resolved relationship arrays
   - `slugMap`: derived from `SKILL_MAP` in source-types.ts (both directions)
   - `suggestedStacks`: resolved stacks with canonical skill IDs
   - `agentDefinedDomains`: agent→domain mappings
   - `version`: `"1.0.0"`
   - `generatedAt`: fixed placeholder `"build"` (avoids unnecessary diffs on regeneration)

2. **Derived lookup maps** (generated from the matrix data):
   - `SKILL_IDS_BY_CATEGORY: Record<Category, readonly SkillId[]>`
   - `CATEGORIES_BY_DOMAIN: Record<Domain, readonly Category[]>`

### Estimated file size

- ~86 skills × ~15-20 fields each (including relationship arrays) ≈ 1500-2000 lines
- ~34 categories × 8 fields ≈ 300 lines
- Stacks, slug map, domain maps, lookup maps ≈ 200 lines
- **Total: ~2000-2500 lines** — large, but generated and never hand-edited

## Circular Dependency Resolution

### The current problem

The codegen script can't import `mergeMatrixWithSkills()` from `matrix-loader.ts` because:

```
generate-source-types.ts
  → matrix-loader.ts (line 10-17: imports from schemas.ts)
    → schemas.ts (line 4: imports VALUE constants from generated/source-types.ts)
      → generated/source-types.ts ← THE FILE THE SCRIPT IS TRYING TO WRITE
```

This is a hard blocker at module load time.

### The resolution

**Split `matrix-loader.ts` into two files:**

```
src/cli/lib/matrix/
  matrix-loader.ts       ← KEEP: I/O loaders that depend on schemas
  skill-resolution.ts    ← NEW: Pure merge/resolution logic, no schema dependency
```

**What stays in `matrix-loader.ts`** (depends on schemas.ts):

- `loadSkillCategories()` — uses `skillCategoriesFileSchema`
- `loadSkillRules()` — uses `skillRulesFileSchema`
- `extractAllSkills()` — uses `rawMetadataSchema` (inline schema using `categoryPathSchema`, `domainSchema`)
- `loadAndMergeSkillsMatrix()` — convenience wrapper
- `rawMetadataSchema` definition (lines 48-58)

**What moves to `skill-resolution.ts`** (pure logic, no schema dependency):

- `mergeMatrixWithSkills()`
- `buildResolvedSkill()`
- `resolveConflicts()`
- `resolveRequirements()`
- `resolveAlternatives()`
- `resolveDiscourages()`
- `resolveCompatibilityGroups()`
- `resolveSetupPairs()`
- `buildSlugMap()`
- `buildDirectoryPathToIdMap()`
- `resolveToCanonicalId()`
- `synthesizeCategory()`

These functions import only from:

- `types/` — type imports only, erased at runtime (safe)
- `utils/logger` — `verbose()` and `warn()` (safe — no dependency on generated types)

`matrix-loader.ts` imports from `skill-resolution.ts` (not the reverse). The codegen script imports `mergeMatrixWithSkills` from `skill-resolution.ts` — no circular dependency.

**Also remove:** `KNOWN_DOMAINS` (line 60 of matrix-loader.ts) — dead code that creates an unnecessary dependency on `DOMAIN_VALUES` from schemas.ts. Never used anywhere.

**Also remove:** `resolveSuggestedStacks()` — a no-op that returns `[]`. Stacks are resolved in `source-loader.ts`, not here.

### What the codegen script does

The codegen script (`scripts/generate-source-types.ts`) is extended with a Phase 2:

**Phase 1 (already exists):** Read metadata.yaml + SKILL.md from source → extract flat data → write `source-types.ts`

**Phase 2 (new):** Generate the matrix:

1. Import `defaultCategories` from `src/cli/lib/configuration/default-categories.ts` — this is a plain TypeScript constant, no schema dependency
2. Import `defaultRules` from `src/cli/lib/configuration/default-rules.ts` — same, plain TypeScript constant
3. Import `defaultStacks` from `src/cli/lib/configuration/default-stacks.ts` — same
4. Import `mergeMatrixWithSkills` from `src/cli/lib/matrix/skill-resolution.ts` — extracted pure logic
5. Build `ExtractedSkillMetadata[]` from the data already parsed in Phase 1 (no re-reading files)
6. Call `mergeMatrixWithSkills(defaultCategories, defaultRules.relationships, extractedSkills)` to get the resolved matrix
7. Resolve stacks (see Stacks section below)
8. Read agent metadata.yaml files for `agentDefinedDomains` (script already reads these in Phase 1)
9. Serialize the complete `MergedSkillsMatrix` + derived lookup maps as TypeScript → write `matrix.ts`

**Key insight:** Categories, rules, and stacks for the default source are NOT loaded from files in the source repo — they come from hardcoded TypeScript constants in the CLI repo (`default-categories.ts`, `default-rules.ts`, `default-stacks.ts`). The source repo has no `config/` directory to override them. So the codegen script just imports these constants directly. No YAML/TypeScript file parsing needed for these. These constants remain in the codebase — they also serve as runtime fallbacks for non-default sources that lack their own config files.

### Stacks

Stacks are currently resolved in `source-loader.ts` via `convertStackToResolvedStack()`, which calls `resolveAgentConfigToSkills()` from `stacks-loader.ts`. The conversion calls `isValidSkillId()` from `schemas.ts` — creating a schema dependency.

`isValidSkillId()` is removed entirely. It was a regex heuristic (`/^(web|api|cli|mobile|infra|meta|security)-.+-.+$/`) plus a `customExtensions` Set check. With a generated set of known skill IDs, heuristic validation is unnecessary — use set lookups instead:

- **In the codegen script:** validate against the `SKILL_IDS` array built in Phase 1 (`skillIdSet.has(id)`)
- **At runtime:** validate against the matrix's skill keys (`id in matrix.skills`)

**Resolution:** The stacks resolution in the codegen script uses the `SKILL_IDS` set directly — no schema import needed. Pre-compute stacks by converting `defaultStacks` directly — the script already has all skill IDs from Phase 1.

## Matrix Access Layer

The Zustand store (`matrix-store.ts`) is **deleted** and replaced by a plain module-level variable in `matrix-provider.ts`. The `matrix` object is exported directly — consumers import it and access properties without wrapper functions. Two thin lookup helpers (`getSkill()`, `findSkill()`) and one new helper (`findStack()`) handle common access patterns. ~25 production files replace `getMatrix()` calls with direct `matrix` import and property access; `useMatrixStore((s) => s.getMatrix())` calls become direct `matrix` imports.

```typescript
// matrix-provider.ts (replaces matrix-store.ts)
import { BUILT_IN_MATRIX } from "../../types/generated/matrix";

/** The current matrix — starts as BUILT_IN_MATRIX, replaced after local skill merge on startup */
export let matrix: MergedSkillsMatrix = BUILT_IN_MATRIX;

/** Merge local/custom skills on top of BUILT_IN_MATRIX. Called once on CLI startup. */
export function initializeMatrix(merged: MergedSkillsMatrix) {
  matrix = merged;
}

/** Asserting skill lookup by ID — throws if not found. */
export function getSkillById(id: SkillId): ResolvedSkill {
  const skill = matrix.skills[id];
  if (!skill) throw new Error(`Skill not found: ${id}`);
  return skill;
}

/** Asserting skill lookup by slug — resolves slug to ID, throws if not found. */
export function getSkillBySlug(slug: SkillSlug): ResolvedSkill {
  const id = matrix.slugMap.slugToId[slug];
  if (!id) throw new Error(`Skill not found for slug: ${slug}`);
  return getSkillById(id);
}

/** Optional stack lookup by ID. */
export function findStack(stackId: string): ResolvedStack | undefined {
  return matrix.suggestedStacks.find((s) => s.id === stackId);
}
```

**Key properties:**

- `matrix` is available immediately at import time (defaults to `BUILT_IN_MATRIX`)
- `initializeMatrix()` is called once on CLI startup after local skill discovery — replaces the module variable with the merged result
- Consumers import `matrix` directly for property access (`.skills`, `.categories`, `.slugMap`, `.suggestedStacks`, `.agentDefinedDomains`)
- `getSkillById(id)` / `getSkillBySlug(slug)` — asserting lookups that throw if not found. No `find` variants — the matrix is always fully populated before consumers access it, so a missing skill is always a bug
- `findStack()` replaces repeated `.find()` calls in 2 production call sites
- No `getMatrix()` — the object is imported directly, no wrapper needed
- No `resetMatrix()` — tests use `initializeMatrix()` with mock data for setup; if tests need cleanup, they call `initializeMatrix(BUILT_IN_MATRIX)` in `beforeEach`
- No reactive state management — the matrix is set once on startup, consumers read it synchronously
- React components that previously used `useMatrixStore` selectors now import `matrix` directly. This removes reactivity intentionally — the matrix is always fully initialized before any React components mount (`source-loader.ts` completes before `render()` is called in `init.tsx` and `edit.tsx`)

### Current flow (every run — before this change)

```
source-loader.ts → loadAndMergeFromBasePath() → 200 file reads → mergeMatrixWithSkills()
  → loadStacks() → convertStackToResolvedStack() → loadAllAgents()
  → setMatrix(result.matrix)
```

### New flow (default source)

```
source-loader.ts → import { BUILT_IN_MATRIX } from "generated/matrix"
  → discover local skills → parse metadata.yaml → build ResolvedSkill objects
  → mergeLocalSkillsIntoMatrix(BUILT_IN_MATRIX, localSkills)
  → loadSkillsFromAllSources()  (for multi-source enrichment)
  → initializeMatrix(mergedMatrix)
```

### New flow (non-default source)

```
source-loader.ts → loadAndMergeFromBasePath() → full runtime loading as today
  → parse metadata.yaml → build matrix (no membership validation)
  → initializeMatrix(result.matrix)
```

Default source detection uses `sourceConfig.source === DEFAULT_SOURCE` (comparing against the `"github:agents-inc/skills"` constant from `config.ts`). This check goes in `loadSkillsMatrixFromSource()` after `resolveSource()` — if the resolved source matches `DEFAULT_SOURCE`, use `BUILT_IN_MATRIX` instead of calling `loadFromRemote()`.

## Config-Types Writer (D-91 integration)

With `SKILL_IDS_BY_CATEGORY` available as a generated const, `config-types-writer.ts` can generate per-category constrained `StackAgentConfig`:

```typescript
// Generated .claude-src/config-types.ts
type SkillAssignment<S extends SkillId> = S | { id: S; preloaded: boolean };

export type StackAgentConfig = {
  "web-framework"?: SkillAssignment<"web-framework-react" | "web-framework-vue-composition-api" | ...>;
  "web-state"?: SkillAssignment<"web-state-zustand" | "web-state-pinia" | ...>;
  // ...
};
```

The writer uses `SKILL_IDS_BY_CATEGORY` to generate these types, filtered to only installed skills when a `ProjectConfig` is provided.

## Schema Simplification

The entire `extensible*Schema` machinery is **removed**. It is unnecessary for both tiers.

### Why the extensible schema machinery is unnecessary

The extensible schemas are a Zod validation hack: pre-scan YAML to find custom values, mutate global `Set<string>` state, then re-parse with extended schemas so Zod doesn't reject unknown categories/domains/skill IDs. This is unnecessary because:

1. **Built-in skills (Tier 1)** are validated at codegen time — they're in `BUILT_IN_MATRIX`. No runtime Zod validation needed.
2. **Local/custom skills (Tier 2)** define their own categories and domains. There's nothing to validate against — the skill IS the source of truth for its own values. When merged into the matrix and config-types.ts is regenerated, their IDs, categories, and domains appear in the TypeScript unions. Type safety comes from the generated config-types.ts, not from Zod membership checks at parse time.

### Loose metadata schema for custom/local skills

Custom and local skills still need basic structural validation when parsing metadata.yaml — required fields must exist, types must be correct (strings are strings, arrays are arrays). But the identity fields (`skillId`, `slug`, `category`, `domain`) can be any string.

Two versions of the metadata schema:

1. **Strict schema** — used at codegen time for built-in skills. `skillId`, `category`, `domain`, `slug` use the exact generated unions from `source-types.ts`. Catches any built-in skill with an invalid value.
2. **Loose schema** — used at runtime for custom/local skills. `skillId`, `category`, `domain`, `slug` are plain strings. All other fields (`description`, `displayName`, `tags`, `author`, `requires`, `conflictsWith`, etc.) keep their real validation. Catches malformed metadata.yaml (missing required fields, wrong types) without rejecting custom values.

The strict schema only exists in the codegen script. The loose schema is what `discoverLocalSkills()` and the non-default source loader use at runtime.

### What is removed

All of the following are deleted entirely:

- `extensibleDomainSchema`, `extensibleSkillIdSchema`, `extensibleCategorySchema`, `extensibleAgentNameSchema`
- `customExtensions` Sets (`customDomains`, `customCategories`, `customSkillIds`, `customAgentNames`)
- `extendSchemasWithCustomValues()`, `resetSchemaExtensions()`
- `discoverAndExtendFromSource()`, `discoverAndExtendFromLocalSkills()`
- `isValidSkillId()` — replaced by `id in matrix.skills` at runtime, `skillIdSet.has(id)` at codegen time

### Net simplification

- The default source loading path uses `BUILT_IN_MATRIX` directly — eliminates ~200 file reads and ~1000 lines of merge logic
- No pre-scan step, no global mutable `Set<string>` state
- Tests no longer need to call `resetSchemaExtensions()` for isolation
- Config-types.ts is the single enforcement mechanism for type correctness — generated from the matrix, always up to date

## Order of Operations

### Phase 1: Extract skill-resolution.ts (DONE)

1. Create `src/cli/lib/matrix/skill-resolution.ts` with all pure resolution functions
2. Remove dead `KNOWN_DOMAINS` and no-op `resolveSuggestedStacks()` from matrix-loader.ts
3. Update `matrix-loader.ts` to import from `skill-resolution.ts`
4. Update `matrix/index.ts` exports
5. Move test cases for resolution functions from `matrix-loader.test.ts` to a new `skill-resolution.test.ts`
6. `mergeMatrixWithSkills()` is currently declared `async` but contains no `await` calls — remove the `async` wrapper during extraction to make the function synchronous
7. Verify all existing tests pass — pure refactor, no behavior change

### Phase 2: Extend codegen to generate matrix (DONE)

1. Add Phase 2 to `generate-source-types.ts`:
   - Import `defaultCategories`, `defaultRules`, `defaultStacks`
   - Import `mergeMatrixWithSkills` from `skill-resolution.ts`
   - Build `ExtractedSkillMetadata[]` from Phase 1 data
   - Call `mergeMatrixWithSkills()` → serialize as `BUILT_IN_MATRIX`
   - Resolve stacks from `defaultStacks` using Phase 1 skill IDs
   - Generate `SKILL_IDS_BY_CATEGORY` and `CATEGORIES_BY_DOMAIN` lookup maps
   - Write `generated/matrix.ts`
2. Verify: generated matrix matches runtime-built matrix for default source

### Phase 3: Replace matrix store with matrix provider + wire up source-loader

**3a: Create `matrix-provider.ts`, delete `matrix-store.ts`** (DONE)

1. Create `src/cli/lib/matrix/matrix-provider.ts` with:
   - `export let matrix: MergedSkillsMatrix = BUILT_IN_MATRIX` — consumers import `matrix` directly for property access
   - `initializeMatrix(merged)` — called once on CLI startup after local skill merge
   - `getSkillById(id)` / `getSkillBySlug(slug)` — asserting lookups, throw if not found. No `find` variants — skills are always present.
   - `findStack(stackId)` — optional stack lookup by ID, replaces repeated `.find()` calls in 2 production call sites
   - No `getMatrix()` — unnecessary indirection, just import `matrix` directly
   - No `resetMatrix()` — not needed (see test impact below)
2. Delete `src/cli/stores/matrix-store.ts`
3. Update `matrix/index.ts` exports to re-export from `matrix-provider.ts`
4. Update ~25 production files:
   - Replace `getMatrix()` calls with direct `matrix` import and property access
   - Replace `useMatrixStore((s) => s.getMatrix())` with direct `matrix` import
   - All `getSkill()` and `findSkill()` call sites migrate to `getSkillById()` or `getSkillBySlug()` depending on what data they have. The `find` variants (returning undefined) are removed — the matrix is always fully populated, so a missing skill is a bug that should throw.
   - 2 production `suggestedStacks.find()` call sites replaced with `findStack()`
   - Remove redundant `setMatrix()` calls in `init.tsx` and `edit.tsx` — `source-loader.ts` calls `initializeMatrix()` once; commands don't need to call it again
5. Update ~20 test files: use `initializeMatrix(mockMatrix)` for setup in `beforeEach`. No `resetMatrix()` — if tests need cleanup, they call `initializeMatrix(BUILT_IN_MATRIX)` or just set up fresh in each `beforeEach`. No mocking required — `initializeMatrix()` is a plain exported function. `createMockMatrix()` continues to build test matrices as before — its output is passed to `initializeMatrix()`.
6. Add tests for the codegen script: verify generated matrix matches a runtime-built matrix for the default source
7. Add integration tests for source-loader.ts: verify default-source shortcut produces the same result as the full pipeline

**3b: Wire up the shortcut in source-loader** (DONE)

1. Update `source-loader.ts`: for the default source, use `BUILT_IN_MATRIX` instead of running `loadAndMergeFromBasePath()`
2. Discover local skills from `.claude/skills/` — parse metadata.yaml, build `ResolvedSkill` objects
3. Merge local skills on top: `mergeLocalSkillsIntoMatrix(BUILT_IN_MATRIX, localSkills)`
4. Call `initializeMatrix(mergedMatrix)` to set the module variable
5. Multi-source enrichment (`loadSkillsFromAllSources`) continues as-is
6. Keep full runtime loading path for non-default sources — ends with `initializeMatrix(result.matrix)`

### Phase 4: Remove extensible schema machinery + clean up (DONE)

1. Remove `extensible*Schema` wrappers from `schemas.ts` (`extensibleDomainSchema`, `extensibleSkillIdSchema`, `extensibleCategorySchema`, `extensibleAgentNameSchema`)
2. Remove `customExtensions` Sets (`customDomains`, `customCategories`, `customSkillIds`, `customAgentNames`) from `schemas.ts`
3. Remove `extendSchemasWithCustomValues()` and `resetSchemaExtensions()` from `schemas.ts`
4. Remove `discoverAndExtendFromSource()` and `discoverAndExtendFromLocalSkills()` from `source-loader.ts`
5. Remove the membership validation from Zod schemas used for local/custom skill parsing — these fields no longer need to be checked against known sets
6. Remove `isValidSkillId()` from `schemas.ts` and update its 3 production call sites:
   - `stacks-loader.ts:115` — replaced with `SKILL_ID_PATTERN.test()` (format validation)
   - `source-switcher.ts:16` — replaced with `SKILL_ID_PATTERN.test()` (security: filesystem path safety check)
   - `source-loader.ts:314` — replaced with `id in currentMatrix.skills` (matrix lookup)
   - Remove `isValidSkillId` tests from `schemas.test.ts`
   - `SKILL_ID_PATTERN` kept in `schemas.ts` — still needed by `source-validator.ts` and the two call sites above
7. Remove all `resetSchemaExtensions()` calls from test setup/teardown
8. Verify the default source loading path uses `BUILT_IN_MATRIX` and no longer calls `loadAndMergeFromBasePath()`
9. Verify non-default source loading path still works (full runtime pipeline, no membership validation)
10. Verify local skills still parse and merge correctly on top of `BUILT_IN_MATRIX`

**Additional Phase 4 cleanup (beyond original spec):**
- Removed `extendSchemasWithCustomValues` call from `project-config.ts` (loadProjectConfigFromDir)
- Removed `extendSchemasWithCustomValues` call from `marketplace.ts` (buildMarketplace)
- Updated `matrix-loader.ts` to replace `extensibleDomainSchema` with `z.string() as z.ZodType<Domain>`
- Updated `generate-json-schemas.ts` to import `CATEGORIES` from `source-types.ts` instead of removed `CATEGORY_VALUES` re-export
- Updated `schemas.test.ts`: removed `isValidSkillId`, `extendSchemasWithCustomValues`, `resetSchemaExtensions` tests; updated category validation tests for lenient behavior
- Updated `stacks-loader.test.ts` and `source-switcher.test.ts`: removed `extendSchemasWithCustomValues`/`resetSchemaExtensions` imports and tests

### Phase 5: Config-types writer (D-91) (DONE)

1. Update `config-types-writer.ts` to use `SKILL_IDS_BY_CATEGORY` for per-category constrained types
2. Update `generate-json-schemas.ts` to use `SKILL_IDS_BY_CATEGORY` for category→skill enums
