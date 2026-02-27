# Skills Matrix Decomposition

Redesign `skills-matrix.yaml` by separating its bundled concerns -- category definitions, cross-skill rules, aliases, and per-skill relationships -- into two focused files (`skill-categories.yaml` and `skill-rules.yaml`). This enables custom marketplaces to define their own categories and appear in the wizard without requiring entries in the CLI's built-in matrix.

**Status:** Draft
**Date:** 2026-02-25
**Related:** custom-extensibility-design.md (Phase 1-2 implemented)

**Open item:** `ProjectSourceConfig.matrixFile` (in `config.ts`) defaults to `SKILLS_MATRIX_PATH`. After decomposition, this needs to be split into `categoriesFile` + `rulesFile`, or removed. Address in Phase 4.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current Architecture](#current-architecture)
3. [Proposed Decomposition](#proposed-decomposition)
4. [File Format Specifications](#file-format-specifications)
5. [Loading and Merge Strategy](#loading-and-merge-strategy)
6. [Auto-Synthesis Fallback](#auto-synthesis-fallback)
7. [Migration Path](#migration-path)
8. [Impact Analysis](#impact-analysis)
9. [Open Questions](#open-questions)

---

## Problem Statement

`config/skills-matrix.yaml` bundles three distinct concerns into one 919-line file:

| Concern                         | Lines                                                      | Purpose                                                                    |
| ------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `categories` (lines 16-371)     | 38 category definitions                                    | Display metadata: name, domain, exclusive, required, order, icon           |
| `relationships` (lines 376-743) | Conflicts, discourages, recommends, requires, alternatives | Cross-skill coordination rules                                             |
| `skillAliases` (lines 754-919)  | ~90 display-name-to-ID mappings                            | Short names (e.g., `react`) to canonical IDs (e.g., `web-framework-react`) |

This creates two problems:

### 1. Custom marketplace skills are invisible

When a private marketplace ships skills with a category not present in the CLI's `skills-matrix.yaml`, those skills trigger a health check warning:

```
[matrix] Skill 'devops-terraform-aws' references category 'devops-iac' which does not exist in the matrix
```

The skill loads but never appears in the wizard because `domain-selection.tsx` only renders categories from `matrix.categories`. The marketplace author must either:

- Map skills to existing CLI categories (losing semantic accuracy), or
- Ship a full `skills-matrix.yaml` that duplicates all CLI categories plus their custom ones

Both are fragile and scale poorly.

### 2. Alias maintenance burden

Every new skill requires a corresponding `skillAliases` entry in `skills-matrix.yaml`, coupling alias management to the monolithic matrix file. Aliases are valuable for readability in relationship rules (e.g., `react` instead of `web-framework-react`), but they should live alongside the rules that use them, not in a separate section of a separate file.

---

## Current Architecture

### Data Flow

```
skills-matrix.yaml          metadata.yaml (per skill)       SKILL.md (per skill)
  categories: {...}           category: web-framework         name: web-framework-react
  relationships: {...}        displayName: react
  skillAliases: {...}         author: @vince
         |                         |                              |
         v                         v                              v
   loadSkillsMatrix()       extractAllSkills()              parseFrontmatter()
         |                         |                              |
         +------------+------------+------------------------------+
                      |
                      v
            mergeMatrixWithSkills()
                      |
                      v
             MergedSkillsMatrix {
               categories,       <-- from matrix only
               skills,           <-- from metadata + matrix relationships
               displayNameToId,  <-- from matrix.skillAliases
               displayNames,     <-- reverse of displayNameToId
             }
```

### Key Code Locations

| File                                               | Role                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `config/skills-matrix.yaml`                        | The monolithic file being decomposed                                                        |
| `src/cli/lib/matrix/matrix-loader.ts`              | `loadSkillsMatrix()`, `extractAllSkills()`, `mergeMatrixWithSkills()`                       |
| `src/cli/lib/loading/source-loader.ts`             | `loadAndMergeFromBasePath()` -- loads CLI matrix, overlays source matrix, merges skills     |
| `src/cli/types/matrix.ts`                          | `SkillsMatrixConfig`, `CategoryDefinition`, `MergedSkillsMatrix`, `RelationshipDefinitions` |
| `src/cli/lib/schemas.ts`                           | `skillsMatrixConfigSchema`, `categoryDefinitionSchema`, Zod validation                      |
| `src/cli/lib/matrix/matrix-health-check.ts`        | `checkMatrixHealth()` -- validates categories have domains, skills have valid category refs |
| `src/cli/components/wizard/domain-selection.tsx`   | Reads `matrix.categories` to render domain groups                                           |
| `src/cli/lib/wizard/build-step-logic.ts`           | Filters `matrix.categories` by domain for the build step                                    |
| `src/cli/components/hooks/use-build-step-props.ts` | Looks up `matrix.categories[subcategoryId]` for display                                     |
| `src/cli/consts.ts`                                | `SKILLS_MATRIX_PATH = "config/skills-matrix.yaml"`                                          |

### Matrix Merge in source-loader.ts (lines 171-218)

Currently, `loadAndMergeFromBasePath()` loads two matrices (CLI built-in + source) and merges them:

```
CLI matrix categories + source matrix categories  --> source wins on conflict
CLI relationships + source relationships           --> concatenated
CLI skillAliases + source skillAliases             --> source wins on conflict
```

This merge already supports custom categories and relationships from sources, but requires the source to ship a full `skills-matrix.yaml` with the correct schema.

---

## Proposed Decomposition

Split `skills-matrix.yaml` into two files:

### 1. `skill-categories.yaml` -- Category Definitions (NEW)

**Location:** `config/skill-categories.yaml`

Contains only category definitions. Each skill's `metadata.yaml` already declares `category: web-framework`, which becomes a foreign key into this file.

- Custom marketplaces ship their own `skill-categories.yaml`.
- The CLI merges built-in + source categories (source wins on key conflict, same as today).
- Categories not referenced by any skill are harmless (ignored).
- Skills referencing a category not in any `skill-categories.yaml` trigger auto-synthesis (see below).

### 2. `skill-rules.yaml` -- All Selection/Interaction Logic (RENAMED)

**Location:** `config/skill-rules.yaml`

The **single place** for ALL selection and interaction logic between skills. This includes both aggregate rules and per-skill rules.

**Aggregate rules** (cross-cutting rules that cannot be expressed from any single skill's perspective):

- **Group conflicts** -- "any of [A, B, C] excludes the others" (N-way exclusion in one place, not N\*(N-1) per-skill entries)
- **OR-logic dependencies** -- "A requires any of [B, C, D]"
- **Bidirectional soft rules** -- "discourage using A and B together" (neither skill owns this)
- **Cross-marketplace coordination** -- relationships between skills from different sources

**Per-skill rules** (previously in individual skill `metadata.yaml` files):

- `compatibleWith` -- "this skill works well with these"
- `conflictsWith` -- "this skill conflicts with these"
- `requires` -- "this skill needs one of these to function"
- `requiresSetup` -- "this skill needs this setup skill configured first"
- `providesSetupFor` -- "this skill is a setup skill for these usage skills"

**Rationale:** All of these fields -- both aggregate and per-skill -- are UI enrichment. They make the wizard smarter (disabling skills, encouraging, discouraging) but are NOT required for a skill to compile and function. A skill works fine without any of them. They belong in the rules layer, not the identity layer. Centralizing them in one file also makes it easier to audit and reason about all interaction logic.

**`categoryExclusive`** does NOT live here. It is a category-level property (radio vs checkbox behavior in the wizard UI) and belongs exclusively in `skill-categories.yaml` as `exclusive`. See Phase 7.

Custom marketplaces can optionally ship their own `skill-rules.yaml`. Rules are concatenated (same as current merge behavior for relationships).

All relationship rules use **aliases** (e.g., `react`) for readability. Aliases are defined in the `aliases` section of `skill-rules.yaml` and resolved to canonical skill IDs (e.g., `web-framework-react`) at load time.

### 3. Skill Aliases -- KEPT in `skill-rules.yaml`

The `skillAliases` section moves from `skills-matrix.yaml` to `skill-rules.yaml` as an `aliases` section. Aliases are kept because they make relationship rules far more readable:

- The `aliases` section in `skill-rules.yaml` maps short names (e.g., `react`) to canonical IDs (e.g., `web-framework-react`).
- All relationship rules (both aggregate and per-skill) use aliases exclusively.
- The schema validates aliases against a strict enum of valid skill IDs.
- The `displayNameToId` and `displayNames` maps on `MergedSkillsMatrix` are built from the `aliases` section in `skill-rules.yaml`.
- At load time, aliases in rules are resolved to canonical IDs before merging into `MergedSkillsMatrix`.
- The `displayName` -> `displayName` rename is deferred to Phase 8.

---

## File Format Specifications

### skill-categories.yaml

```yaml
version: "1.0.0"

categories:
  web-framework:
    id: web-framework
    displayName: Framework
    description: UI framework (React, Vue, Angular, SolidJS, Next.js, Remix, Nuxt)
    domain: web
    exclusive: true
    required: true
    order: 1

  web-styling:
    id: web-styling
    displayName: Styling
    description: CSS approach (SCSS Modules, Tailwind, CVA)
    domain: web
    exclusive: false
    required: true
    order: 3

  # ... remaining categories
```

**Schema:** Same `categoryDefinitionSchema` as today, wrapped in a top-level object with `version` and `categories`.

**Custom marketplace example:**

```yaml
# A private marketplace's skill-categories.yaml
version: "1.0.0"

categories:
  devops-iac:
    id: devops-iac
    displayName: Infrastructure as Code
    description: Terraform, Pulumi, CloudFormation
    domain: devops
    exclusive: true
    required: false
    order: 1
    custom: true

  devops-monitoring:
    id: devops-monitoring
    displayName: Monitoring
    description: Datadog, Grafana, CloudWatch
    domain: devops
    exclusive: false
    required: false
    order: 2
    custom: true
```

### skill-rules.yaml

```yaml
version: "1.0.0"

# Aliases: short names for readability in rules below.
# Maps alias -> canonical skill ID. All rules use aliases only.
aliases:
  react: web-framework-react
  vue: web-framework-vue-composition-api
  angular: web-framework-angular-standalone
  solidjs: web-framework-solidjs
  nextjs: web-framework-nextjs-app-router
  remix: web-framework-remix
  nuxt: web-framework-nuxt
  zustand: web-state-zustand
  redux: web-state-redux-toolkit
  mobx: web-state-mobx
  react-query: web-server-state-react-query
  swr: web-data-fetching-swr
  vitest: web-testing-vitest
  react-native: mobile-framework-react-native
  next-auth: web-auth-next-auth
  next-auth-setup: web-auth-next-auth-setup
  # ... remaining aliases

# Aggregate rules: cross-cutting rules expressed from no single skill's perspective
relationships:
  conflicts:
    - skills: [react, vue, angular, solidjs, nextjs, remix, nuxt]
      reason: "Frameworks are mutually exclusive -- choose one"

    - skills: [react-query, swr]
      reason: "Both solve server state caching -- choose one"

  discourages:
    - skills: [zustand, redux, mobx]
      reason: "Using multiple React state libraries adds complexity"

  recommends:
    - when: react
      suggest: [zustand, react-query, vitest]
      reason: "Best-in-class React libraries"

  requires:
    - skill: zustand
      needs: [react, nextjs, remix, react-native]
      needsAny: true
      reason: "Our Zustand skill covers React/React Native patterns"

  alternatives:
    - purpose: "Frontend Framework"
      skills: [react, vue, angular, solidjs, nextjs, remix, nuxt]

# Per-skill rules: what was previously in individual metadata.yaml files
# Keyed by alias for consistency with aggregate rules above
per-skill:
  react:
    compatibleWith: [zustand, react-query]
    conflictsWith: [vue, angular]

  zustand:
    requires: [react, nextjs, remix]
    compatibleWith: [react-query]

  next-auth:
    requiresSetup: [next-auth-setup]

  next-auth-setup:
    providesSetupFor: [next-auth]

  # ... per-skill rules for remaining skills
```

**Key changes:**

- All rules reference aliases for readability. Aliases are resolved to canonical skill IDs at load time.
- The `aliases` section (moved from `skillAliases` in `skills-matrix.yaml`) maps short names to canonical IDs and is validated against a strict enum.
- Per-skill rules (`compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor`) are centralized here instead of scattered across ~90 individual `metadata.yaml` files.
- Both `aliases`, aggregate `relationships`, and `per-skill` sections live in this one file -- the single source of truth for all selection/interaction logic.

### metadata.yaml (per skill -- relationship fields removed)

After decomposition, `metadata.yaml` is **pure identity**. It contains only fields that describe what a skill IS, not how it interacts with other skills:

```yaml
# Fields that STAY in metadata.yaml (identity):
category: web-framework
displayName: react # renamed to displayName in Phase 8
cliDescription: React...
usageGuidance: ...
tags: [frontend, ui]
author: "@vince"
contentHash: abc123
updated: 2026-02-25
domain: web # optional synthesis hint (D-49)


# Fields that MOVE to skill-rules.yaml (interaction):
# compatibleWith    -> skill-rules.yaml per-skill section
# conflictsWith     -> skill-rules.yaml per-skill section
# requires          -> skill-rules.yaml per-skill section
# requiresSetup     -> skill-rules.yaml per-skill section
# providesSetupFor  -> skill-rules.yaml per-skill section
# categoryExclusive -> skill-categories.yaml exclusive (category-level property, not a per-skill rule)
```

The `displayName` field continues to serve as the display name. The rename from `displayName` to `displayName` is deferred to Phase 8 (after all structural changes are stable) since it touches ~90 files.

The optional `domain` field (added in D-49) serves as a synthesis hint for custom marketplace skills whose category prefix doesn't match a known domain.

---

## Loading and Merge Strategy

### Updated Load Pipeline

```
skill-categories.yaml        skill-rules.yaml                metadata.yaml (per skill)
  categories: {...}            aliases: {...}                  displayName: react
       |                       relationships: {...}            category: web-framework
       v                       per-skill: {...}                      |
  loadSkillCategories()              |                               v
       |                      loadSkillRules()                extractAllSkills()
       |                             |                              |
       +-----------------------------+------------------------------+
                                     |
                                     v
                           mergeMatrixWithSkills()
                                     |
                                     v
                            MergedSkillsMatrix {
                              categories,       <-- from skill-categories.yaml (CLI + source)
                              skills,           <-- from metadata + skill rules
                              displayNameToId,  <-- built from aliases in skill-rules.yaml
                              displayNames,     <-- reverse of displayNameToId
                            }
```

### Merge Precedence (unchanged from today)

| Data        | CLI Built-in                   | Source Override                          | Merge Rule                                                    |
| ----------- | ------------------------------ | ---------------------------------------- | ------------------------------------------------------------- |
| Categories  | `config/skill-categories.yaml` | `config/skill-categories.yaml` in source | Source wins on same key                                       |
| Skill Rules | `config/skill-rules.yaml`      | `config/skill-rules.yaml` in source      | Concatenated (aggregate); source wins on same key (per-skill) |
| Aliases     | `config/skill-rules.yaml`      | `config/skill-rules.yaml` in source      | Source wins on same key                                       |

### source-loader.ts Changes

`loadAndMergeFromBasePath()` currently:

1. Loads CLI `skills-matrix.yaml` as `cliMatrix`
2. Loads source `skills-matrix.yaml` as `sourceMatrix` (if present)
3. Merges categories, relationships, and skillAliases
4. Calls `extractAllSkills()` + `mergeMatrixWithSkills()`

After decomposition:

1. Loads CLI `config/skill-categories.yaml` as `cliCategories`
2. Loads CLI `config/skill-rules.yaml` as `cliRules` (includes `aliases`, `relationships`, `per-skill`)
3. Loads source `config/skill-categories.yaml` as `sourceCategories` (if present)
4. Loads source `config/skill-rules.yaml` as `sourceRules` (if present)
5. Merges categories (source wins), aliases (source wins), aggregate rules (concatenated), and per-skill rules (source wins on same key)
6. Resolves aliases to canonical IDs in all merged rules
7. Builds `displayNameToId` from merged aliases
8. Calls `extractAllSkills()` + `mergeMatrixWithSkills()` with merged categories + resolved rules + extracted skills
9. Applies per-skill rules from `skill-rules.yaml` to resolved skills (populating `compatibleWith`, `conflictsWith`, etc.)
10. Auto-synthesizes any missing categories (see next section)

### Backward Compatibility for sources

During a transition period, `loadAndMergeFromBasePath()` should check for the old `skills-matrix.yaml` file as a fallback if neither `skill-categories.yaml` nor `skill-rules.yaml` exists. Since the project is pre-1.0, this fallback can be removed in the next minor version.

---

## Auto-Synthesis Fallback

Auto-synthesis is a **safety net** for custom/marketplace skills whose category isn't defined in any `skill-categories.yaml`. The preferred path is for skill authors to maintain proper `skill-categories.yaml` entries -- the `new skill` and `new marketplace` commands generate these files automatically (see Phase 6 in the Migration Path). Auto-synthesis ensures skills are never silently hidden, but gives a suboptimal experience compared to proper config files.

When a skill references a category not defined in any `skill-categories.yaml`, the loader synthesizes a basic `CategoryDefinition` instead of silently hiding the skill.

### Skill `domain` Field as Synthesis Hint

D-49 already added an optional `domain` field to skill `metadata.yaml`. This field serves as a fallback for auto-synthesis: if a skill references a category not in any `skill-categories.yaml`, the loader uses the skill's `domain` to assign the synthesized `CategoryDefinition` to the correct wizard domain. Most skills don't declare it yet (the category prefix is usually sufficient), but custom marketplace skills should declare `domain` when their category prefix doesn't match a known domain.

### Synthesis Rules

```typescript
function synthesizeCategory(
  categoryPath: CategoryPath,
  skillDomain?: Domain, // from the skill's metadata.yaml domain field
): CategoryDefinition {
  // Prefer explicit domain from skill metadata, fall back to category prefix
  const prefix = categoryPath.split("-")[0];
  const domain = skillDomain ?? (isKnownDomain(prefix) ? prefix : undefined);

  return {
    id: categoryPath as Subcategory,
    displayName: formatDisplayName(categoryPath), // "devops-iac" -> "Devops Iac"
    description: `Auto-generated category for ${categoryPath}`,
    domain,
    exclusive: true, // Safe default: radio behavior
    required: false, // Safe default: optional
    order: 999, // Appear at the end
    custom: true, // Mark as synthesized
  };
}
```

### When Auto-Synthesis Triggers

After `mergeMatrixWithSkills()` completes, a new post-merge step scans all resolved skills:

```
For each skill in mergedMatrix.skills:
  If skill.category not in mergedMatrix.categories:
    synthesize a CategoryDefinition
    add it to mergedMatrix.categories
    log verbose("Auto-synthesized category '{category}' for skill '{skillId}'")
```

This replaces the current health check warning (`skill-unknown-category`) with an actionable fallback. The health check remains for diagnostics but is no longer the only response.

### Implications

- Custom marketplace skills with novel categories appear in the wizard automatically.
- The synthesized category has reasonable defaults but suboptimal display (generic name, end of list).
- Marketplace authors are encouraged to ship a `skill-categories.yaml` for proper display names, ordering, and domain assignment.

---

## Migration Path

### Phase 1: Extract categories

1. Create `config/skill-categories.yaml` with content from `skills-matrix.yaml` `categories` section.
2. Add `loadSkillCategories()` function to `matrix-loader.ts`.
3. Add `SKILL_CATEGORIES_YAML_PATH` constant to `consts.ts`.
4. Add Zod schema `skillCategoriesFileSchema` to `schemas.ts`.
5. Update `loadAndMergeFromBasePath()` in `source-loader.ts` to load from `skill-categories.yaml`, fall back to `skills-matrix.yaml`.
6. Update tests.

### Phase 2: Extract aggregate rules and aliases

**Constraint:** Aliases are internal to the loading/merge layer. No alias values are exposed to consumers. Outside the matrix loading code, `displayName` (later `displayName`) from skill metadata is the user-facing display name everywhere (UI, commands, search). The `displayNameToId` map on `MergedSkillsMatrix` is used only for resolving user input (e.g., in the `info` command) to canonical IDs.

1. Create `config/skill-rules.yaml` with the `relationships` and `skillAliases` sections from `skills-matrix.yaml`. Keep aliases in all rules for readability. Move `skillAliases` to an `aliases` section.
2. Add `loadSkillRules()` function to `matrix-loader.ts`.
3. Add `SKILL_RULES_YAML_PATH` constant to `consts.ts`.
4. Add Zod schema `skillRulesFileSchema` to `schemas.ts` (with strict enums validating aliases against valid skill IDs).
5. Update `loadAndMergeFromBasePath()` to load from `skill-rules.yaml`, fall back to `skills-matrix.yaml`. Resolve aliases to canonical IDs at load time. Build `displayNameToId` from aliases.
6. Remove `skillAliases` from `skills-matrix.yaml`.
7. Update tests.

### Phase 3: Migrate per-skill relationship fields to skill-rules.yaml

1. Scan all skill `metadata.yaml` files and extract `compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor` entries.
2. Add a `per-skill` section to `config/skill-rules.yaml` with these entries keyed by alias (consistent with aggregate rules).
3. Remove the relationship fields from all skill `metadata.yaml` files (~90 files across sources).
4. Remove `compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor` from `rawMetadataSchema` and `localRawMetadataSchema` in `schemas.ts`.
5. Update `extractAllSkills()` -- relationship fields are no longer extracted from metadata.
6. Update `local-skill-loader.ts` / `discoverLocalSkills()` -- it also extracts all 5 relationship fields from local skill metadata and needs the same removal.
7. Update `mergeMatrixWithSkills()` -- populate per-skill relationships on `ResolvedSkill` from the `per-skill` section of the loaded skill rules instead of from metadata.
8. Update tests.

**Cross-repo:** This phase modifies the skills repo (`/home/vince/dev/skills`) to remove fields from metadata files. Skills repo changes come FIRST, then CLI repo changes.

**Note:** After this phase, local skills (in `.claude/skills/`) cannot declare relationship fields in their `metadata.yaml`. If a local skill needs relationship rules, they go in the source's `skill-rules.yaml`.

### Phase 4: Remove skills-matrix.yaml

1. Delete `config/skills-matrix.yaml`.
2. Remove `SKILLS_MATRIX_PATH` and `STANDARD_FILES.SKILLS_MATRIX_YAML` from `consts.ts`.
3. Remove `skillsMatrixConfigSchema` from `schemas.ts`.
4. Remove fallback loading logic from `source-loader.ts`.
5. Update `loadSkillsMatrix()` or remove if fully replaced.
6. Clean up `SkillsMatrixConfig` type -- may be split into `CategoriesConfig` + `SkillRulesConfig`.
7. Update `ProjectSourceConfig.matrixFile` in `config.ts` -- split into `categoriesFile` + `rulesFile`, or remove entirely (it defaults to `SKILLS_MATRIX_PATH` which no longer exists).
8. Update tests.

### Phase 5: Auto-synthesis (safety net)

This phase is a **fallback** for custom/marketplace skills whose category isn't defined in any `skill-categories.yaml`. The preferred path is for skill authors to maintain proper `skill-categories.yaml` entries (see Phase 6), which give correct display names, ordering, and domain assignment. Auto-synthesis gives a functional but suboptimal experience (generic display name, placed at end of list with `order: 999`).

1. Add `synthesizeCategory()` utility function.
2. Add post-merge synthesis step in `mergeMatrixWithSkills()`.
3. Update `matrix-health-check.ts` -- `skill-unknown-category` becomes informational when auto-synthesis is active.
4. Update tests.

### Phase 6: Command integration -- `new skill` updates config files

Update the `new skill` command to create/update `skill-categories.yaml` and `skill-rules.yaml` when scaffolding a new skill. Since `new marketplace` delegates to `new skill`, marketplace scaffolding gets this for free.

**Rationale:** Without this phase, skill authors must manually create and maintain `skill-categories.yaml` and `skill-rules.yaml`. By generating these files during scaffolding, the CLI ensures new skills get proper category definitions and alias entries from the start. This reduces friction for marketplace authors and means fewer skills fall through to the auto-synthesis fallback (Phase 5).

1. When `new skill` runs, check if `config/skill-categories.yaml` exists in the target directory.
   - If missing, create it with `version: "1.0.0"` and the new skill's category entry.
   - If present, check if the skill's category already exists. If not, append the category entry.
2. When `new skill` runs, check if `config/skill-rules.yaml` exists in the target directory.
   - If missing, create it with `version: "1.0.0"` and an `aliases` section containing the new skill's alias.
   - If present, check if an alias for the new skill already exists. If not, append it.
3. Update `new marketplace` -- no direct changes needed since it delegates to `new skill`, but verify the scaffolded marketplace has both config files after creation.
4. Tests: verify `new skill` creates/updates both config files, verify `new marketplace` produces a complete scaffold with both files.

**Note:** Keeping these files in sync is preferred but not required -- auto-synthesis (Phase 5) handles the gap when files are missing or incomplete. Proper config files give the best CLI experience (correct display names, ordering, domain assignment).

### Phase 7: Deprecate `categoryExclusive` on skill metadata

`categoryExclusive` currently lives on individual skill `metadata.yaml` as a convenience, but it is really a category-level property -- it controls whether the wizard renders radio (single select) or checkbox (multi select) for the entire category. It describes how the category behaves in the UI, not how skills interact with each other. With `skill-categories.yaml` as the source of truth for category definitions, `exclusive` lives there (it already exists on `CategoryDefinition` today). The per-skill `categoryExclusive` field becomes redundant and is removed from metadata entirely -- it does NOT move to `skill-rules.yaml`.

1. Audit all skills to confirm their `categoryExclusive` values match the corresponding `exclusive` in `skill-categories.yaml` (they should be identical).
2. Remove `categoryExclusive` from `rawMetadataSchema`, `localRawMetadataSchema`, and `ResolvedSkill` type.
3. The `exclusive` field in `skill-categories.yaml` is the sole source of truth. No `categoryExclusive` entries in `skill-rules.yaml`.
4. Update `matrix-resolver.ts` and any wizard logic that reads `skill.categoryExclusive` to read `category.exclusive` from the merged categories instead.
5. Update `ValidationError` type -- the `"categoryExclusive"` variant references the category, not the skill.
6. Update tests.

**Cross-repo:** This phase modifies the skills repo. Skills repo changes come FIRST, then CLI repo changes.

### Phase 8: Rename `displayName` to `displayName` (deferred)

> **Note:** This phase is intentionally deferred until all other changes are stable. It touches ~90 `metadata.yaml` files across the skills repo and is a pure rename with no functional change. Doing it last avoids churn during the structural migration phases above. By this point, `metadata.yaml` contains only identity fields, making this a clean rename.

1. Rename `displayName` to `displayName` in all skill `metadata.yaml` files across all sources (~90 files).
2. Update `rawMetadataSchema` and `localRawMetadataSchema` in `schemas.ts` (rename field).
3. Update `METADATA_KEYS.CLI_NAME` constant to `METADATA_KEYS.DISPLAY_NAME` in `metadata-keys.ts`.
4. Update all code referencing `displayName` to use `displayName`.
5. Update tests.

**Cross-repo:** This phase modifies the skills repo. Skills repo changes come FIRST, then CLI repo changes.

---

## Impact Analysis

### Types Affected

| Type                     | Change                                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SkillsMatrixConfig`     | Split into `CategoriesConfig` + `SkillRulesConfig`, or removed                                                                                                                                |
| `MergedSkillsMatrix`     | `displayNameToId` and `displayNames` populated from `aliases` section in `skill-rules.yaml` instead of from `skillAliases` in `skills-matrix.yaml`                                            |
| `SkillDisplayName`       | Populated from `aliases` section in `skill-rules.yaml` (validated by strict enum schema)                                                                                                      |
| `ExtractedSkillMetadata` | Relationship fields removed (`compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor`); `displayName` rename to `displayName` deferred to Phase 8                   |
| `CategoryDefinition`     | No change (already has `custom?: boolean` and `exclusive: boolean`)                                                                                                                           |
| `ResolvedSkill`          | Relationship fields populated from `skill-rules.yaml` `per-skill` section instead of from metadata; `categoryExclusive` removed (Phase 7) -- read from `CategoryDefinition.exclusive` instead |
| `SkillRulesConfig` (NEW) | New type for the parsed `skill-rules.yaml` file: `{ aliases: Record<string, SkillId>; relationships: RelationshipDefinitions; perSkill: Record<string, PerSkillRules> }`                      |
| `PerSkillRules` (NEW)    | New type for per-skill entries: `{ compatibleWith?, conflictsWith?, requires?, requiresSetup?, providesSetupFor? }`                                                                           |

### Files Modified

| File                     | Change                                                                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `consts.ts`              | Add `SKILL_CATEGORIES_YAML_PATH`, `SKILL_RULES_YAML_PATH`; remove `SKILLS_MATRIX_PATH`                                                                                                                           |
| `matrix-loader.ts`       | Add `loadSkillCategories()`, `loadSkillRules()`; update `mergeMatrixWithSkills()` to build display names from aliases and apply per-skill rules; add `synthesizeCategory()`                                      |
| `source-loader.ts`       | Update `loadAndMergeFromBasePath()` to load separate files; merge per-skill rules (source wins on same key)                                                                                                      |
| `schemas.ts`             | Add `skillCategoriesFileSchema`, `skillRulesFileSchema`, `perSkillRulesSchema`; remove `skillsMatrixConfigSchema`; remove relationship fields from `rawMetadataSchema`; validate aliases with strict enum schema |
| `matrix-health-check.ts` | Update `skill-unknown-category` handling                                                                                                                                                                         |
| `types/matrix.ts`        | Update or split `SkillsMatrixConfig`; add `SkillRulesConfig` + `PerSkillRules`; remove relationship fields from `ExtractedSkillMetadata`                                                                         |

### Files NOT Modified (consumers)

These files read `matrix.categories` and `matrix.skills` from `MergedSkillsMatrix`, which keeps the same shape:

- `domain-selection.tsx` -- reads `matrix.categories`
- `build-step-logic.ts` -- filters `matrix.categories`
- `use-build-step-props.ts` -- looks up `matrix.categories[id]`
- `stack-selection.tsx` -- uses `matrix.skills` and `matrix.categories`
- `matrix-resolver.ts` -- reads `matrix.categories`

The `MergedSkillsMatrix` type is the stable interface consumed by the wizard. Decomposing the source files does not change this consumer-facing type.

---

## Open Questions

### 1. Per-skill vs aggregate rules -- distinction within skill-rules.yaml

Both per-skill and aggregate rules now live in `skill-rules.yaml`, but the distinction between them still matters for authoring clarity and resolution:

**Per-skill rules (`per-skill` section):** Authored from the perspective of one skill, keyed by alias. Express "this skill has this relationship with specific other skills":

- `compatibleWith` -- "this skill works well with these"
- `conflictsWith` -- "this skill conflicts with these"
- `requires` -- "this skill needs one of these to function"
- `requiresSetup` -- "this skill needs this setup skill configured first"
- `providesSetupFor` -- "this skill is a setup skill for these usage skills"

Example: `per-skill.react.conflictsWith: [vue, angular]`

**Aggregate rules (`relationships` section):** Cross-cutting rules that cannot be expressed from any single skill's perspective:

- **Group conflicts** -- "React, Vue, Angular, SolidJS are ALL mutually exclusive" (N-way exclusion expressed once, not N\*(N-1) individual `conflictsWith` entries)
- **OR-requires** -- "zustand requires one-of [react, nextjs, remix]"
- **Bidirectional recommends/discourages** -- "discourage using zustand and redux together" (neither skill "owns" this rule)
- **Cross-marketplace coordination** -- relationships between skills from different sources that neither source can express individually

**Resolution:** Both per-skill and aggregate rules feed into the same validation pipeline. When both express the same constraint (e.g., React's per-skill `conflictsWith` and the group conflict rule both declare React/Vue incompatibility), the aggregate rule is authoritative. Per-skill declarations serve as additional specificity and enable validation even when aggregate rules don't cover a particular relationship.

**Why centralize instead of keeping per-skill rules in metadata?** All of these fields are UI enrichment -- they make the wizard smarter but are NOT required for a skill to compile and function. Centralizing them in one file makes it easier to audit interaction logic, avoids scattering rules across ~90 metadata files, and cleanly separates "what a skill IS" (metadata) from "how skills interact" (rules).

### 2. What happens to `resolveToCanonicalId()` with aliases in skill-rules.yaml?

Currently, `resolveToCanonicalId()` in `matrix-loader.ts` resolves display names (from aliases) and directory paths to canonical IDs. With aliases moved to `skill-rules.yaml`:

- **Directory path resolution** stays (skills have directory paths distinct from IDs).
- **Display name resolution** stays: the resolver uses the `aliases` section from `skill-rules.yaml` (same data, different source file).
- The resolution function itself remains unchanged. Its data source changes from `matrix.skillAliases` to the `aliases` section loaded from `skill-rules.yaml`.

### 3. Should we support `skills-matrix.yaml` as a legacy fallback?

**Recommendation:** Yes, temporarily. In `source-loader.ts`, check for the new files first, fall back to `skills-matrix.yaml` if neither `skill-categories.yaml` nor `skill-rules.yaml` exists. Remove the fallback in the next minor version (pre-1.0, so no backward compatibility obligation). This gives existing sources time to migrate without breaking.

### 4. How does this interact with the custom extensibility work?

The `discoverAndExtendFromSource()` function in `source-loader.ts` pre-scans for `custom: true` entities to extend Zod schemas. With auto-synthesis, custom categories discovered during scanning would be synthesized automatically instead of requiring schema extension. The `extendSchemasWithCustomValues()` mechanism for custom domains and agent names is unaffected.
