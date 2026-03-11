# R-04 Phase 2: Migrate Relationship Rules from Canonical IDs to Slugs

**Status:** Ready to implement
**Depends on:** R-04 Phase 1 (complete), skills repo slug rollout (complete)

## Goal

Replace all `SkillId` references in relationship rule types and `default-rules.ts` with `SkillSlug` values. After this, rules read like `"react"` instead of `"web-framework-react"`.

## Scope

### 1. Type Changes (`src/cli/types/matrix.ts`)

Change the skill reference type in all relationship rule types from `SkillId` to `SkillSlug`:

| Type                 | Field(s)                    | Before     | After      |
| -------------------- | --------------------------- | ---------- | ---------- |
| `ConflictRule`       | `skills`                    | `SkillId[]` | `SkillSlug[]` |
| `DiscourageRule`     | `skills`                    | `SkillId[]` | `SkillSlug[]` |
| `Recommendation`     | `skill`                     | `SkillId`  | `SkillSlug` |
| `RequireRule`        | `skill`, `needs`            | `SkillId`  | `SkillSlug` |
| `AlternativeGroup`   | `skills`                    | `SkillId[]` | `SkillSlug[]` |
| `CompatibilityGroup` | `skills`                    | `SkillId[]` | `SkillSlug[]` |
| `SetupPair`          | `setup`, `configures`       | `SkillId`  | `SkillSlug` |

Also update the JSDoc comments on these types (e.g., "Canonical skill IDs" -> "Skill slugs").

### 2. `default-rules.ts` — Rewrite values

Replace every canonical ID with its slug. The mapping is 1:1 from the `SkillSlug` union in `types/skills.ts`. Examples:

```typescript
// Before
"web-framework-react" -> "react"
"web-state-zustand"   -> "zustand"
"api-framework-hono"  -> "hono"
```

The full mapping is deterministic — each canonical ID's slug is already defined in the `SkillSlug` union in `types/skills.ts`. TypeScript will type-check every value since the type changes to `SkillSlug`.

### 3. Resolver: `matrix-loader.ts`

The resolver already passes all rule values through `resolveToCanonicalId()` which looks up slugs in `slugMap.slugToId`. **No logic changes needed** in the resolution functions (`resolveConflicts`, `resolveRequirements`, `resolveAlternatives`, `resolveDiscourages`, `resolveCompatibilityGroups`, `resolveSetupPairs`).

However, the `ResolveId` type alias at line 46 must change its input type:

```typescript
// Before
type ResolveId = (id: SkillId, context?: string) => SkillId;

// After
type ResolveId = (id: SkillSlug, context?: string) => SkillId;
```

And `resolveToCanonicalId` signature (line 253) changes from `nameOrId: SkillId` to `nameOrId: SkillSlug`. Remove the `as unknown as SkillSlug` boundary cast at line 260 — it's no longer needed since the input IS a `SkillSlug`.

**Important:** The `recommends` lookup in `buildResolvedSkill` (line 486) does a direct comparison:
```typescript
const recommendation = relationships.recommends.find((r) => r.skill === skill.id);
```
After Phase 2, `r.skill` is `SkillSlug` and `skill.id` is `SkillId`. Change to:
```typescript
const recommendation = relationships.recommends.find((r) => r.skill === skill.slug);
```

### 4. Zod Schemas: `schemas.ts`

Update the schemas that validate relationship rules at the YAML parse boundary:

| Schema                      | Change                                                    |
| --------------------------- | --------------------------------------------------------- |
| `skillRefInYaml` (line 534) | Change from `z.string() as z.ZodType<SkillId>` to `skillSlugSchema` (already exists at line 155) |
| `recommendationSchema`      | Change `skill: skillIdSchema` to `skill: skillSlugSchema` |
| `compatibilityGroupSchema`  | Change `skills: z.array(skillIdSchema)` to `z.array(skillSlugSchema)` |
| `setupPairSchema`           | Change `setup: skillIdSchema` and `configures: z.array(skillIdSchema)` to `skillSlugSchema` versions |

Note: `conflictRuleSchema`, `discourageRuleSchema`, `requireRuleSchema`, and `alternativeGroupSchema` already use `skillRefInYaml`, so changing that one variable updates them all.

### 5. Schema Finalization: `metadata.schema.json` (Step 7)

Add `"slug"` to the `required` array at line 115:

```json
"required": ["category", "author", "displayName", "cliDescription", "usageGuidance", "slug"],
```

### 6. Test Updates

#### `default-rules.test.ts`
Update all string literals from canonical IDs to slugs:
- `"web-framework-react"` -> `"react"`
- `"web-state-zustand"` -> `"zustand"`

#### `mock-data/mock-matrices.ts`
Update relationship rule values in matrix fixtures from canonical IDs to slugs. The skill IDs used in these fixtures correspond to slugs defined in `test-fixtures.ts` SKILLS entries:
- `"web-framework-react"` -> `"react"` in conflicts, alternatives
- `"web-framework-vue"` -> `"vue"` in conflicts, alternatives, recommends
- `"web-state-zustand"` -> `"zustand"` in alternatives, requires
- `"web-state-jotai"` -> `"jotai"` in alternatives
- `"web-testing-vitest"` -> `"vitest"` in requires
- `"web-styling-scss-modules"` -> `"scss-modules"` in discourages

#### `e2e/commands/validate.e2e.test.ts`
The "relationship metadata validation" test at line 242 constructs inline `skill-rules.ts` with conflict rules using canonical IDs. Update these to slugs:
- `"web-framework-alpha"` -> `"react"` (or keep a deliberate unresolvable slug like `"nonexistent"` for the error case)

Actually, looking at this test more carefully: it creates its own skills with slug `"react"` and `"vitest"`, but the conflict rule references `"web-framework-alpha"` and `"web-nonexistent-skill"`. After Phase 2, these conflict values should be slugs. The test should use slug values: `"react"` (resolvable) and `"nonexistent"` (unresolvable, to test the health check).

#### Other test files referencing relationship data
Run `grep -r` for any test file that constructs `RelationshipDefinitions`, `ConflictRule`, etc. inline. These must switch from `SkillId` to `SkillSlug` values.

### 7. E2E Tests for Slug-Based Relationships

Add a new E2E test file `e2e/commands/relationships.e2e.test.ts` covering the key relationship journeys end-to-end:

#### Test 1: "conflict rules prevent co-selection"
Create an E2E source with two skills in a conflict group (slugs). Run `cc validate` on a config that selects both. Verify the conflict error appears.

#### Test 2: "require rules enforce dependencies"
Create an E2E source where skill A (slug `"zustand"`) requires skill B (slug `"react"`). Run `cc validate` on a config that selects A without B. Verify the missing requirement error.

#### Test 3: "slug resolution maps to canonical IDs"
Create an E2E source with skills that have slugs. Load the matrix and verify the `slugMap` correctly maps slug -> canonical ID and back.

#### Test 4: "recommends surface for compatible skills"
Create an E2E source with a recommended skill. Run `cc validate` with a selection that is compatible. Verify the recommendation warning appears.

Use `createE2ESource()` pattern from `e2e/helpers/create-e2e-source.ts` as the base, extending it to support custom relationship rules via a `skill-rules.ts` config.

### 8. `create-e2e-source.ts` Enhancement

Add optional `relationships` parameter to `createE2ESource()`:

```typescript
type E2ESourceOptions = {
  relationships?: Partial<RelationshipDefinitions>;
};
```

Write a `config/skill-rules.ts` file to the source directory when provided. The rules should use `SkillSlug` values (matching the skills' metadata slugs).

## Order of Operations

1. Type changes (`matrix.ts`) — change relationship types to use `SkillSlug`
2. Zod schemas (`schemas.ts`) — update validation schemas
3. Resolver (`matrix-loader.ts`) — update `ResolveId`, `resolveToCanonicalId`, recommends lookup
4. `default-rules.ts` — rewrite all values to slugs
5. `metadata.schema.json` — add `slug` to required
6. Unit test updates (`default-rules.test.ts`, `mock-matrices.ts`)
7. E2E source enhancement (`create-e2e-source.ts`)
8. E2E tests (`relationships.e2e.test.ts`)
9. Run full test suite, fix any remaining type errors

## Files Changed

| File | Change Type |
| ---- | ----------- |
| `src/cli/types/matrix.ts` | Type narrowing (SkillId -> SkillSlug) |
| `src/cli/lib/configuration/default-rules.ts` | Value rewrite (canonical IDs -> slugs) |
| `src/cli/lib/matrix/matrix-loader.ts` | Signature update + recommends lookup fix |
| `src/cli/lib/schemas.ts` | Schema updates |
| `src/schemas/metadata.schema.json` | Add slug to required |
| `src/cli/lib/configuration/__tests__/default-rules.test.ts` | Update string literals |
| `src/cli/lib/__tests__/mock-data/mock-matrices.ts` | Update relationship values |
| `e2e/helpers/create-e2e-source.ts` | Add relationships support |
| `e2e/commands/relationships.e2e.test.ts` | New E2E test file |
| `e2e/commands/validate.e2e.test.ts` | Update inline rule values |

## Non-Goals

- Changing how `ResolvedSkill` stores relationships (still `SkillId` after resolution)
- Changing the wizard UI or any display logic
- Changing stack configs or agent mappings (these use `SkillId`, not slugs)
- Backward compatibility — pre-1.0, clean break
