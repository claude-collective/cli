# D-50: Eliminate skills-matrix.yaml -- Derive Matrix from Skill Metadata

> **SUPERSEDED:** This task is fully covered by the [matrix decomposition design](../docs/features/proposed/matrix-decomposition-design.md) and its [phased implementation plan](./TODO-matrix-decomposition.md). The decomposition design takes a more comprehensive approach: splitting `skills-matrix.yaml` into `skill-categories.yaml` + `skill-rules.yaml` (Phases 1-4), auto-synthesis as a fallback for unknown categories (Phase 5), and cleanup of per-skill fields (Phases 6-8). All open questions below are addressed in that design.

---

## Open Questions (RESOLVED — see matrix decomposition design)

**These need user input before implementation begins.**

1. **Should `displayName`, `icon`, `order`, `required`, and `description` be added to individual `metadata.yaml` files?**
   These fields currently ONLY exist in `skills-matrix.yaml` category definitions. Options:
   - **(a)** Add them to metadata.yaml (per-skill). Derive from the first skill encountered in each category, or require consistency across skills in the same category. Adds 5 fields to every metadata.yaml.
   - **(b)** Provide sensible defaults when synthesized from metadata alone. E.g., `displayName` = title-cased subcategory suffix, `order` = 99 (end), `required` = false, `description` = empty. Custom marketplaces get functional-but-generic category entries.
   - **(c)** Move category-level metadata to a lightweight `category.yaml` file per category directory (not per skill), separate from skills-matrix.yaml.
   - **Recommendation:** Option (b) for Phase 1 (unblock custom marketplaces), option (a) or (c) later as refinement.

2. **Should `relationships` and `skillAliases` sections stay in skills-matrix.yaml?**
   These are cross-skill concerns (conflicts, requires, recommends, alternatives, aliases). They don't belong in individual skill metadata because they describe PAIRS/GROUPS of skills. Options:
   - **(a)** Keep them in skills-matrix.yaml (or a renamed `matrix-relationships.yaml`). The matrix file shrinks to just relationships + aliases.
   - **(b)** Move some to metadata.yaml (`conflictsWith`, `requires`, `compatibleWith` already live there per-skill). Only keep the multi-skill rules (conflict groups, alternative groups, recommend rules) in the matrix.
   - **(c)** Fully decentralize: all relationships go into metadata.yaml per-skill. The matrix file is eliminated entirely.
   - **Recommendation:** Option (a). Relationships are inherently cross-skill. Per-skill `conflictsWith`/`requires`/`compatibleWith` already work in metadata.yaml; the group-level rules (`conflicts: [A,B,C]`, `alternatives`, `recommends`) are best kept centralized.

3. **What is the priority order when a category is defined both in skills-matrix.yaml AND synthesized from metadata?**
   - Current behavior: `skills-matrix.yaml` categories are authoritative.
   - Proposal: `skills-matrix.yaml` wins for all fields it provides; synthesized values only fill gaps for categories that have NO definition in the matrix. This matches the current merge behavior (`source categories overlay CLI categories`).

4. **Should we keep the categories section in skills-matrix.yaml at all (for the built-in CLI categories)?**
   - Option (a): Keep categories in skills-matrix.yaml for built-in skills, auto-synthesize for custom.
   - Option (b): Eliminate the categories section entirely; all categories derived from skills.
   - **Recommendation:** Option (a) for now. The built-in categories have curated `displayName`, `order`, `required`, `icon`, and `description` values that would be painful to replicate in each metadata.yaml. Auto-synthesis handles custom marketplaces.

---

## Current State Analysis

### How the Matrix is Built Today

The full pipeline is orchestrated by `loadSkillsMatrixFromSource()` in `src/cli/lib/loading/source-loader.ts:67`.

**Step 1: Load skills-matrix.yaml** (`matrix-loader.ts:64`)

- `loadSkillsMatrix(configPath)` reads and Zod-validates the YAML
- Returns `SkillsMatrixConfig { version, categories, relationships, skillAliases }`
- Categories is a `Partial<Record<Subcategory, CategoryDefinition>>` with 36 entries

**Step 2: Merge CLI + source matrices** (`source-loader.ts:186-218`)

- If the source also has a skills-matrix.yaml, source categories overlay CLI categories
- Relationships are concatenated, aliases are merged (source wins)

**Step 3: Extract skill metadata** (`matrix-loader.ts:112`)

- `extractAllSkills(skillsDir)` scans for `metadata.yaml` files
- Each skill produces an `ExtractedSkillMetadata` with: `id`, `category`, `categoryExclusive`, `author`, `tags`, `compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor`, `domain?`, `custom?`
- Returns `ExtractedSkillMetadata[]` (86 skills in the main marketplace)

**Step 4: Merge matrix with skills** (`matrix-loader.ts:246`)

- `mergeMatrixWithSkills(matrix, skills)` creates the `MergedSkillsMatrix`
- **Line 270**: `categories: matrix.categories` -- categories come ONLY from the matrix config
- Skills are indexed by ID, relationships resolved to canonical IDs
- Display name maps built from `skillAliases`

**Step 5: Local skill discovery** (`source-loader.ts:87-94`)

- `discoverLocalSkills()` finds `.claude/skills/` in the project
- `mergeLocalSkillsIntoMatrix()` adds them to the merged matrix
- If a local skill's category isn't in `matrix.categories`, the health check warns

**Step 6: Health check** (`matrix-health-check.ts:17`)

- `checkMatrixHealth()` validates the final matrix
- `checkSkillCategories()` (line 45): warns when a skill references a category not in `matrix.categories`
- `checkSubcategoryDomains()` (line 32): warns when a category has no domain

### The Core Problem

When a custom marketplace provides skills without a `skills-matrix.yaml`, the pipeline falls back to CLI-only categories (`source-loader.ts:216-218`). Any skill whose `category` doesn't match a built-in subcategory will:

1. Fail the health check ("Skill X references category Y which does not exist in the matrix")
2. Be invisible in the wizard because `buildCategoriesForDomain()` (`build-step-logic.ts:128-133`) only iterates `matrix.categories`
3. Fail `resolveSkillForPopulation()` in `wizard-store.ts:96-97` because `categories[subcat]?.domain` returns undefined

The `discoverAndExtendFromSource()` function (`source-loader.ts:417`) does discover custom categories, domains, and skill IDs -- but it ONLY extends Zod schema validation (so the YAML parse doesn't reject custom values). It does NOT create `CategoryDefinition` entries in the matrix.

### Fields in CategoryDefinition vs metadata.yaml

| Field         | In CategoryDefinition | In metadata.yaml          | Gap? |
| ------------- | --------------------- | ------------------------- | ---- |
| `id`          | Yes                   | No (implicit)             | --   |
| `displayName` | Yes                   | No                        | YES  |
| `description` | Yes                   | No                        | YES  |
| `domain`      | Yes                   | Yes (optional)            | No   |
| `exclusive`   | Yes                   | Yes (`categoryExclusive`) | No   |
| `required`    | Yes                   | No                        | YES  |
| `order`       | Yes                   | No                        | YES  |
| `icon`        | Yes                   | No                        | YES  |
| `custom`      | Yes                   | Yes                       | No   |

**5 fields exist ONLY in skills-matrix.yaml category definitions**: `displayName`, `description`, `required`, `order`, `icon`.

### Where `matrix.categories` Is Consumed

All consumers of `matrix.categories` that would be affected:

| File                      | Line   | Usage                                                                   |
| ------------------------- | ------ | ----------------------------------------------------------------------- |
| `build-step-logic.ts`     | 129    | Filters categories by domain for wizard grid                            |
| `domain-selection.tsx`    | 27     | Extracts unique domains from categories                                 |
| `stack-selection.tsx`     | 55     | `populateFromSkillIds()` needs category -> domain                       |
| `wizard-store.ts`         | 25     | `getAllDomainsFromCategories()` derives domains                         |
| `wizard-store.ts`         | 82-103 | `resolveSkillForPopulation()` looks up domain by category               |
| `wizard-store.ts`         | 456    | `populateFromStack()` resolves subcategory -> domain                    |
| `matrix-resolver.ts`      | 420    | `validateExclusivity()` checks `category.exclusive`                     |
| `matrix-health-check.ts`  | 33-57  | Validates categories have domains and skills reference valid categories |
| `matrix-loader.ts`        | 270    | Sets `categories: matrix.categories` on MergedSkillsMatrix              |
| `source-loader.ts`        | 190    | Merges CLI + source categories                                          |
| `helpers.ts`              | 865    | Test helper category lookup                                             |
| `utils.ts`                | 37-47  | `getDomainsFromStack()` resolves subcategory -> domain                  |
| `use-build-step-props.ts` | 29     | Resolves category from subcategoryId                                    |

---

## What Needs to Change

### 1. Auto-synthesize CategoryDefinition from skill metadata (Core Fix)

**Where:** `mergeMatrixWithSkills()` in `matrix-loader.ts:246`

After building resolved skills, scan for categories referenced by skills that DON'T already exist in `matrix.categories`. For each missing category, synthesize a `CategoryDefinition` from the skill metadata:

```typescript
// After resolving all skills, synthesize missing categories
for (const skill of skills) {
  const subcategory = skill.category as Subcategory;
  if (!matrix.categories[subcategory]) {
    synthesizedCategories[subcategory] = synthesizeCategoryFromSkill(skill);
  }
}
```

The synthesized category would use:

- `id`: the subcategory key (from `skill.category`)
- `displayName`: derive from subcategory key (e.g., `"devops-deployment"` -> `"Deployment"`)
- `description`: empty string or generic
- `domain`: from `skill.domain` if present, otherwise infer from category prefix (e.g., `"web-*"` -> `"web"`, `"api-*"` -> `"api"`). Fall back to `"shared"` if no match.
- `exclusive`: from `skill.categoryExclusive` (first skill in category sets it, or majority vote)
- `required`: `false` (safe default; custom categories should never block wizard progression)
- `order`: high number (e.g., 99) to sort after built-in categories
- `icon`: undefined
- `custom`: `true`

### 2. Domain inference from category prefix

**Where:** New utility function, likely in `matrix-loader.ts` or a shared utility

When a skill has no explicit `domain` in metadata.yaml and the category is not in the matrix, infer the domain from the category's prefix:

```
"web-*"      -> "web"
"api-*"      -> "api"
"cli-*"      -> "cli"
"mobile-*"   -> "mobile"
"shared-*"   -> "shared"
"infra-*"    -> "shared"
"meta-*"     -> "shared"
"security-*" -> "shared"
anything else -> "shared" (safe fallback)
```

This mirrors the existing pattern where subcategory keys are `{domain}-{name}` (e.g., `web-framework`, `api-database`).

### 3. DisplayName derivation from subcategory key

When synthesizing a category without a `displayName`:

```
"web-framework"     -> "Framework"
"api-database"      -> "Database"
"devops-deployment" -> "Deployment"
"custom-foo-bar"    -> "Foo Bar"
```

Rule: strip the domain prefix (first segment before `-`), title-case the remainder. If the key has no dash, use the whole key title-cased.

### 4. Merge synthesized categories into the matrix

**Where:** `mergeMatrixWithSkills()` in `matrix-loader.ts`

After line 270, merge synthesized categories:

```typescript
const merged: MergedSkillsMatrix = {
  version: matrix.version,
  categories: { ...matrix.categories, ...synthesizedCategories },
  skills: resolvedSkills,
  // ... rest
};
```

Existing matrix categories always win (they have curated metadata). Synthesized categories only fill gaps.

### 5. Update health check for synthesized categories

**Where:** `matrix-health-check.ts`

The `checkSkillCategories()` check (line 45-57) should NOT warn for skills whose categories were auto-synthesized. After Phase 1, this check becomes less relevant since every skill's category will have a definition (either from matrix or synthesized).

However, `checkSubcategoryDomains()` (line 32-43) should still warn if a synthesized category somehow has no domain (which shouldn't happen with the inference logic but is a good safety net).

### 6. Extend schema discovery to also create categories

**Where:** `discoverAndExtendFromSource()` in `source-loader.ts:417`

Currently this function only extends Zod schemas. It should be left as-is -- category synthesis happens downstream in `mergeMatrixWithSkills()`. However, consider if the timing needs adjustment: `discoverAndExtendFromSource()` runs BEFORE `extractAllSkills()` / `mergeMatrixWithSkills()`, and the schema extensions allow those functions to accept custom values. The category synthesis is a separate concern.

**No change needed here.** The existing flow is:

1. `discoverAndExtendFromSource()` -- extends Zod schemas so custom values pass validation
2. `extractAllSkills()` -- reads metadata.yaml (now accepted by extended schemas)
3. `mergeMatrixWithSkills()` -- synthesizes categories for any skill with unknown subcategory

### 7. Handle `exclusive` conflict for multiple skills in same synthesized category

When multiple skills share a custom category, they might declare different `categoryExclusive` values. Resolution strategy:

- If ANY skill in the category declares `categoryExclusive: true`, the category is exclusive (conservative -- prevents accidental multi-select in an exclusive category)
- Alternatively: use the value from the FIRST skill encountered (alphabetical by ID for determinism)

**Recommendation:** Use first-skill-wins with alphabetical ordering for determinism.

---

## New/Modified Types

### No new types needed

The `CategoryDefinition` type already has all required fields including `custom?: boolean`. The `ExtractedSkillMetadata` type already has `domain?: Domain`. No type changes are required.

### Optional: Add category metadata to metadata.yaml schema

If Open Question 1 resolves to option (a), the `rawMetadataSchema` in `matrix-loader.ts:39` and `localRawMetadataSchema` in `schemas.ts:633` would need new optional fields:

```typescript
categoryDisplayName: z.string().optional(),
categoryDescription: z.string().optional(),
categoryOrder: z.number().optional(),
categoryRequired: z.boolean().optional(),
categoryIcon: z.string().optional(),
```

**Deferred to future refinement.** Phase 1 uses sensible defaults.

---

## Step-by-Step Implementation Plan

### Phase 1: Auto-Synthesize Categories (Unblock Custom Marketplaces)

**Goal:** Skills from a custom marketplace with no `skills-matrix.yaml` appear in the wizard.

#### Step 1.1: Add `synthesizeCategoryFromSkill()` utility

**File:** `src/cli/lib/matrix/matrix-loader.ts`

Add a pure function that creates a `CategoryDefinition` from `ExtractedSkillMetadata`:

```typescript
function inferDomainFromCategoryPrefix(category: string): Domain {
  const prefix = category.split("-")[0];
  const DOMAIN_PREFIX_MAP: Record<string, Domain> = {
    web: "web",
    api: "api",
    cli: "cli",
    mobile: "mobile",
    shared: "shared",
    infra: "shared",
    meta: "shared",
    security: "shared",
  };
  return DOMAIN_PREFIX_MAP[prefix] ?? "shared";
}

function deriveCategoryDisplayName(category: string): string {
  const parts = category.split("-");
  if (parts.length <= 1) return category.charAt(0).toUpperCase() + category.slice(1);
  // Strip domain prefix, title-case the rest
  const suffix = parts.slice(1).join(" ");
  return suffix.replace(/\b\w/g, (c) => c.toUpperCase());
}

function synthesizeCategoryFromSkill(
  subcategory: Subcategory,
  skill: ExtractedSkillMetadata,
): CategoryDefinition {
  const SYNTHESIZED_ORDER = 99;
  return {
    id: subcategory,
    displayName: deriveCategoryDisplayName(subcategory),
    description: "",
    domain: skill.domain ?? inferDomainFromCategoryPrefix(subcategory),
    exclusive: skill.categoryExclusive,
    required: false,
    order: SYNTHESIZED_ORDER,
    custom: true,
  };
}
```

#### Step 1.2: Modify `mergeMatrixWithSkills()` to auto-synthesize

**File:** `src/cli/lib/matrix/matrix-loader.ts`

After building all resolved skills, iterate them and synthesize missing categories:

```typescript
export async function mergeMatrixWithSkills(
  matrix: SkillsMatrixConfig,
  skills: ExtractedSkillMetadata[],
): Promise<MergedSkillsMatrix> {
  // ... existing code up to building resolvedSkills ...

  // Auto-synthesize categories for skills whose category isn't in the matrix
  const synthesizedCategories: CategoryMap = {};
  for (const skill of skills) {
    const subcategory = skill.category as Subcategory;
    if (!matrix.categories[subcategory] && !synthesizedCategories[subcategory]) {
      synthesizedCategories[subcategory] = synthesizeCategoryFromSkill(subcategory, skill);
      verbose(`Synthesized category '${subcategory}' from skill '${skill.id}'`);
    }
  }

  const merged: MergedSkillsMatrix = {
    version: matrix.version,
    categories: { ...matrix.categories, ...synthesizedCategories },
    // ... rest unchanged
  };

  return merged;
}
```

#### Step 1.3: Update health check

**File:** `src/cli/lib/matrix/matrix-health-check.ts`

The `checkSkillCategories()` function should no longer warn for skills whose categories were auto-synthesized. After this change, the warning only fires if a category somehow wasn't synthesized (which would indicate a bug).

No code change strictly needed -- after Phase 1, every skill's category WILL be in the matrix (either from YAML or synthesized). The warning becomes a dead code path for normal operation, but remains useful as a safety net.

#### Step 1.4: Adjust `mergeLocalSkillsIntoMatrix()` for local skills

**File:** `src/cli/lib/loading/source-loader.ts`

The `mergeLocalSkillsIntoMatrix()` function (line 483) adds local skills to the matrix but doesn't create category entries. After Phase 1, this is handled by the upstream `mergeMatrixWithSkills()`. However, local skills are merged AFTER the matrix merge, so they could still have orphan categories.

Fix: after adding local skills to the matrix, also synthesize categories for them:

```typescript
function mergeLocalSkillsIntoMatrix(
  matrix: MergedSkillsMatrix,
  localResult: LocalSkillDiscoveryResult,
): MergedSkillsMatrix {
  for (const metadata of localResult.skills) {
    // ... existing skill merge logic ...

    // Synthesize category if missing
    const subcategory = category as Subcategory;
    if (!matrix.categories[subcategory]) {
      matrix.categories[subcategory] = synthesizeCategoryFromMetadata(subcategory, metadata);
    }
  }
  return matrix;
}
```

This requires exporting the `synthesizeCategoryFromSkill` utility or creating a variant that works with `LocalSkillDiscoveryResult` metadata.

### Phase 2: (Optional) Add Category Metadata to metadata.yaml

**Only if Open Question 1 resolves to option (a).**

This would allow skill authors to provide curated category metadata:

```yaml
# metadata.yaml
category: devops-deployment
categoryDisplayName: Deployment
categoryDescription: CI/CD and deployment pipelines
categoryOrder: 5
categoryExclusive: false
```

The synthesis logic would prefer metadata.yaml values over the derived defaults.

### Phase 3: (Optional) Eliminate categories section from skills-matrix.yaml

**Only if Open Question 4 resolves to option (b).**

Move all category metadata (displayName, description, order, required, icon) to either:

- Individual metadata.yaml files (option 2a)
- Per-category `category.yaml` files in the skills directory

This is a large migration (36 categories, 86 skills) and should only be done if the auto-synthesis approach proves insufficient for the built-in marketplace.

---

## Edge Cases and Risks

### 1. Multiple skills in same custom category with conflicting `exclusive` values

**Scenario:** Skill A declares `categoryExclusive: true`, Skill B declares `categoryExclusive: false`, both have `category: "devops-deployment"`.

**Mitigation:** First-skill-wins (alphabetically by skill ID) for determinism. Log a verbose warning about the inconsistency.

### 2. Domain inference fails for non-standard category prefixes

**Scenario:** Custom category `"my-custom-tools"` -- prefix `"my"` doesn't map to any domain.

**Mitigation:** Fall back to `"shared"` domain. The skill author can explicitly set `domain` in metadata.yaml to override.

### 3. DisplayName derivation produces ugly results

**Scenario:** Category `"web-ui-components"` derives to `"Ui Components"` instead of `"UI Components"`.

**Mitigation:** Phase 1 accepts imperfect display names for synthesized categories. Built-in categories retain their curated names from skills-matrix.yaml. Phase 2 (optional) allows overriding via metadata.yaml.

### 4. Order collisions for synthesized categories

**Scenario:** Multiple synthesized categories all get `order: 99`, appearing in nondeterministic order.

**Mitigation:** Secondary sort by category ID (alphabetical) for determinism. Or assign incrementing orders (99, 100, 101, ...) based on discovery order.

### 5. Local skills with custom categories

**Scenario:** A user creates `.claude/skills/my-tool/` with `category: "devops-my-thing"`. Before Phase 1, this triggers a health check warning. After Phase 1, the category is auto-synthesized.

**Mitigation:** This is the desired behavior. The local skill becomes visible in the wizard under a synthesized category.

### 6. Schema validation timing

**Scenario:** `discoverAndExtendFromSource()` runs BEFORE `extractAllSkills()`. If a custom skill uses a custom category, the schema must accept it.

**Status:** Already handled. `discoverAndExtendFromSource()` extends the Zod schemas with custom category values before the full extraction happens.

### 7. Race condition: synthesized category vs source matrix category

**Scenario:** Source matrix defines `category: "devops-deployment"` with `exclusive: true`, but a skill in the same source declares `categoryExclusive: false`.

**Mitigation:** Existing matrix categories always take precedence. Synthesis only fires for categories NOT already in the matrix. This is the correct behavior -- the matrix is the authoritative source for category semantics.

### 8. Empty categories after framework filtering

**Scenario:** A synthesized custom category has skills that are all filtered out by the framework-first filter in `buildCategoriesForDomain()`.

**Status:** Already handled. `build-step-logic.ts:167` filters out categories with no visible options: `return categoryRows.filter((row) => row.options.length > 0)`.

---

## Test Plan

### Unit Tests

1. **`synthesizeCategoryFromSkill()` utility**
   - Correct `displayName` derivation from various category keys
   - Correct domain inference from category prefixes (web-, api-, cli-, mobile-, shared-, infra-, meta-, security-, unknown)
   - Default values: `required: false`, `order: 99`, `custom: true`
   - Uses skill's `categoryExclusive` value

2. **`mergeMatrixWithSkills()` with missing categories**
   - Skill with category not in matrix -> category auto-synthesized
   - Skill with category IN matrix -> matrix category preserved (no synthesis)
   - Multiple skills in same custom category -> single synthesized category
   - Conflicting `categoryExclusive` across skills in same category -> deterministic resolution

3. **Domain inference**
   - `inferDomainFromCategoryPrefix("web-framework")` -> `"web"`
   - `inferDomainFromCategoryPrefix("api-database")` -> `"api"`
   - `inferDomainFromCategoryPrefix("my-custom")` -> `"shared"`
   - Skill with explicit `domain: "devops"` overrides prefix inference

4. **DisplayName derivation**
   - `"web-framework"` -> `"Framework"`
   - `"api-database"` -> `"Database"`
   - `"devops-ci-cd"` -> `"Ci Cd"` (acceptable for synthesized)
   - `"custom"` (no prefix) -> `"Custom"`

5. **`mergeLocalSkillsIntoMatrix()` with custom categories**
   - Local skill with unknown category -> category auto-synthesized
   - Local skill overriding existing remote skill -> keeps original category

### Integration Tests

6. **Full pipeline: custom marketplace without skills-matrix.yaml**
   - Source with only skills (no skills-matrix.yaml) loads successfully
   - Custom categories appear in the merged matrix
   - Health check passes without warnings for auto-synthesized categories
   - Skills are visible in `buildCategoriesForDomain()` output

7. **Full pipeline: mixed built-in and custom categories**
   - Built-in categories retain their curated metadata
   - Custom categories are synthesized alongside built-in ones
   - Domain selection includes all domains (built-in + custom)

8. **Wizard store integration**
   - `populateFromSkillIds()` resolves skills in synthesized categories
   - `resolveSkillForPopulation()` correctly maps synthesized categories to domains
   - `getDomainsFromStack()` includes domains from synthesized categories

### Manual Testing

9. **Custom marketplace end-to-end**
   - Create a directory with skills (metadata.yaml + SKILL.md) but no skills-matrix.yaml
   - Run `agentsinc init --source ./custom-marketplace`
   - Verify skills appear in the wizard under synthesized categories
   - Verify domain tabs include any custom domains
   - Verify selecting and compiling works

---

## Files Changed Summary

| File                                        | Change Type         | Description                                                                                                                                                                    |
| ------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/cli/lib/matrix/matrix-loader.ts`       | Modified            | Add `synthesizeCategoryFromSkill()`, `inferDomainFromCategoryPrefix()`, `deriveCategoryDisplayName()`. Modify `mergeMatrixWithSkills()` to auto-synthesize missing categories. |
| `src/cli/lib/loading/source-loader.ts`      | Modified            | Update `mergeLocalSkillsIntoMatrix()` to synthesize categories for local skills with unknown categories.                                                                       |
| `src/cli/lib/matrix/matrix-health-check.ts` | No change (Phase 1) | After auto-synthesis, the "skill-unknown-category" warning naturally goes away. May add `custom` note to verbose output in future.                                             |
| `src/cli/lib/matrix/matrix-loader.test.ts`  | Modified            | Add tests for category synthesis, domain inference, display name derivation.                                                                                                   |
| `src/cli/lib/loading/source-loader.test.ts` | Modified            | Add integration test for loading a source without skills-matrix.yaml.                                                                                                          |
| `src/cli/lib/__tests__/helpers.ts`          | Modified            | Add `createMockExtractedSkill()` factory if needed for test data.                                                                                                              |

**Estimated scope:** ~80-120 lines of new code + ~100 lines of tests. No new files. No type changes. No new dependencies.
