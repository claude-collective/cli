# Skills & Matrix System

**Last Updated:** 2026-03-14

## Overview

**Purpose:** Load, resolve, and merge the skills matrix (category definitions + relationship rules + skill metadata) into a unified read model (`MergedSkillsMatrix`) consumed by the wizard and CLI commands.

## Key Concepts

| Concept            | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| Skill Categories   | `config/skill-categories.ts` - category definitions (domains, display info) |
| Skill Rules        | `config/skill-rules.ts` - relationship rules between skills                 |
| Skill Metadata     | Per-skill `SKILL.md` frontmatter + `metadata.yaml`                          |
| MergedSkillsMatrix | Combined read model after categories + rules + skill metadata merge         |
| Skill Slug         | Short kebab-case key (e.g., "react") used in relationship rules             |
| Slug Map           | Bidirectional `SkillSlug <-> SkillId` mapping built during merge            |
| Source             | Where skills come from (public marketplace, private, local)                 |

## File Structure

### Matrix System (`src/cli/lib/matrix/`)

| File                     | Path                                        | Purpose                                                              |
| ------------------------ | ------------------------------------------- | -------------------------------------------------------------------- |
| `matrix-loader.ts`       | `src/cli/lib/matrix/matrix-loader.ts`       | Load categories + rules, extract skill metadata                      |
| `matrix-resolver.ts`     | `src/cli/lib/matrix/matrix-resolver.ts`     | Alias resolution, relationship queries, validation                   |
| `matrix-provider.ts`     | `src/cli/lib/matrix/matrix-provider.ts`     | Singleton matrix holder, asserting lookups (getSkillById, findStack) |
| `skill-resolution.ts`    | `src/cli/lib/matrix/skill-resolution.ts`    | Merge categories + rules + skills into MergedSkillsMatrix            |
| `matrix-health-check.ts` | `src/cli/lib/matrix/matrix-health-check.ts` | Validate matrix integrity                                            |
| `index.ts`               | `src/cli/lib/matrix/index.ts`               | Barrel exports                                                       |

### Skills System (`src/cli/lib/skills/`)

| File                       | Path                                          | Purpose                                          |
| -------------------------- | --------------------------------------------- | ------------------------------------------------ |
| `skill-fetcher.ts`         | `src/cli/lib/skills/skill-fetcher.ts`         | Fetch skills from source directories             |
| `skill-metadata.ts`        | `src/cli/lib/skills/skill-metadata.ts`        | Read/write skill metadata, hashing               |
| `skill-copier.ts`          | `src/cli/lib/skills/skill-copier.ts`          | Copy skills to local/plugin dirs                 |
| `skill-plugin-compiler.ts` | `src/cli/lib/skills/skill-plugin-compiler.ts` | Compile skill as Claude plugin                   |
| `local-skill-loader.ts`    | `src/cli/lib/skills/local-skill-loader.ts`    | Discover local skills in project                 |
| `source-switcher.ts`       | `src/cli/lib/skills/source-switcher.ts`       | Delete/migrate local skills for source switching |
| `index.ts`                 | `src/cli/lib/skills/index.ts`                 | Barrel exports                                   |

### Loading System (`src/cli/lib/loading/`)

| File                     | Path                                         | Purpose                              |
| ------------------------ | -------------------------------------------- | ------------------------------------ |
| `source-loader.ts`       | `src/cli/lib/loading/source-loader.ts`       | Load matrix from resolved source     |
| `source-fetcher.ts`      | `src/cli/lib/loading/source-fetcher.ts`      | Fetch/cache remote sources via giget |
| `multi-source-loader.ts` | `src/cli/lib/loading/multi-source-loader.ts` | Load skills from multiple sources    |
| `loader.ts`              | `src/cli/lib/loading/loader.ts`              | YAML/frontmatter parsing utilities   |
| `index.ts`               | `src/cli/lib/loading/index.ts`               | Barrel exports                       |

## Data Flow

```
1. Source Resolution
   resolveSource() -> ResolvedConfig { source, sourceOrigin, marketplace }

2. Source Fetching
   fetchFromSource() (source-fetcher.ts)
   -> Local: uses directory directly
   -> Remote: fetches via giget to cache dir (~/.cache/agents-inc/)

3. Category + Rules Loading
   loadSkillCategories() (matrix-loader.ts) -> CategoryMap
   loadSkillRules() (matrix-loader.ts) -> SkillRulesConfig { relationships: RelationshipDefinitions }

4. Skill Extraction
   extractAllSkills() (matrix-loader.ts)
   -> Walks source skills directory
   -> Reads SKILL.md frontmatter (parseFrontmatter from loader.ts)
   -> Reads metadata.yaml (Zod-validated via rawMetadataSchema)
   -> Returns ExtractedSkillMetadata[]

5. Matrix Merge
   mergeMatrixWithSkills() (skill-resolution.ts)
   -> Combines categories + extracted metadata + relationship rules
   -> Builds bidirectional slug map (SkillSlug <-> SkillId)
   -> Resolves slug-based relationships to canonical SkillIds
   -> Auto-synthesizes missing categories (exclusive: false by default)
   -> Returns MergedSkillsMatrix

6. Multi-Source Loading (optional)
   loadSkillsFromAllSources() (multi-source-loader.ts)
   -> Loads skills from primary + extra configured sources
   -> Merges availableSources onto each ResolvedSkill
   -> Sets activeSource based on installation state

7. Combined Pipeline
   loadSkillsMatrixFromSource() (source-loader.ts)
   -> For default source: uses pre-computed BUILT_IN_MATRIX
   -> Otherwise: fetch -> load categories/rules -> extract skills -> merge -> multi-source
   -> Calls initializeMatrix() to set the singleton
   -> Returns SourceLoadResult
```

## Matrix Provider (`src/cli/lib/matrix/matrix-provider.ts`)

Singleton module holding the current `MergedSkillsMatrix` instance. Starts as `BUILT_IN_MATRIX`, replaced after local skill merge on startup via `initializeMatrix()`.

**Exported functions:**

- `matrix` (let) - The current matrix instance
- `initializeMatrix(merged)` - Replace the singleton (called once on startup)
- `getSkillById(id: SkillId): ResolvedSkill` - Asserting lookup, throws if not found
- `getSkillBySlug(slug: SkillSlug): ResolvedSkill` - Resolves slug to ID via `slugMap`, throws if not found
- `getCustomSkillIds(): Set<SkillId>` - Returns IDs of all custom skills
- `getCategoryDomain(category: string): Domain | undefined` - Look up category's domain
- `findStack(stackId: string): ResolvedStack | undefined` - Optional stack lookup by ID

## Skill Resolution (`src/cli/lib/matrix/skill-resolution.ts`)

Contains the core merge logic that combines categories, relationship rules, and extracted skill metadata into a `MergedSkillsMatrix`.

**Exported functions:**

- `mergeMatrixWithSkills(categories, relationships, skills)` - Main merge function (line 97)
- `synthesizeCategory(category, domain)` - Create a basic CategoryDefinition for undefined categories (line 29)

**Internal function:**

- `resolveRelationships(skillId, relationships, resolve)` - Unified resolver (R-08) that resolves all five relationship types (conflicts, discourages, compatibleWith, requires, alternatives) in a single pass for each skill (line 147)

## SourceLoadResult (`src/cli/lib/loading/source-loader.ts:61-67`)

```typescript
type SourceLoadResult = {
  matrix: MergedSkillsMatrix;
  sourceConfig: ResolvedConfig;
  sourcePath: string;
  isLocal: boolean;
  marketplace?: string;
};
```

## Skill Metadata Sources

Each skill has two metadata files:

### SKILL.md Frontmatter

```yaml
---
name: web-framework-react
description: React component patterns and hooks
model: sonnet
---
```

Parsed by `parseFrontmatter()` from `src/cli/lib/loading/loader.ts`.

### metadata.yaml

```yaml
category: web-framework
author: "@vince"
slug: react
domain: web
displayName: React
tags: ["react", "hooks", "components"]
```

Validated with `rawMetadataSchema` in `src/cli/lib/matrix/matrix-loader.ts:26-37`.

**Note:** Relationship fields (`compatibleWith`, `conflictsWith`, `requires`, etc.) are NOT in per-skill metadata. They are defined centrally in `config/skill-rules.ts` as slug-based group rules and resolved during the merge step.

## Alias Resolution

**Function:** `resolveAlias()` at `src/cli/lib/matrix/matrix-resolver.ts:20`

Validates that a skill ID exists in the matrix:

- Input: `"web-framework-react"` -> Output: `"web-framework-react"` (confirmed to exist)
- Lookup via `matrix.skills[skillId]`
- Throws if the ID is not found in the matrix

## Relationship System

Defined in `config/skill-rules.ts` under `relationships` using skill slugs:

| Type             | Effect                                  | Enforcement         |
| ---------------- | --------------------------------------- | ------------------- |
| `conflicts`      | Selecting one disables others           | Hard (grays out)    |
| `discourages`    | Selecting one warns about others        | Soft (warning icon) |
| `recommends`     | Selecting one highlights companions     | Soft (highlight)    |
| `requires`       | Skill A needs skill B first             | Hard (dependency)   |
| `alternatives`   | Interchangeable skills for same purpose | Informational       |
| `compatibleWith` | Symmetric compatibility groups          | Framework filtering |

All relationship rules use `SkillSlug` references (e.g., `"react"`, `"zustand"`) which are resolved to canonical `SkillId`s during the merge step via the slug map.

Checked per-skill by functions in `matrix-resolver.ts`:

- `getDependentSkills()` (line 48) - Find skills that depend on a given skill
- `isDiscouraged()` (line 94) - Check if skill is discouraged (conflicts, unmet requirements, or discourages relationships)
- `getDiscourageReason()` (line 153) - Get human-readable reason for discouragement
- `isRecommended()` (line 234) - Check if skill is recommended by selected skills
- `getRecommendReason()` (line 266) - Get human-readable recommendation reason
- `getAvailableSkills()` (line 454) - Get skills available for a category with state annotations (discouraged, recommended, selected)
- `getSkillsByCategory()` (line 485) - Get all resolved skills belonging to a category

## Validation

**Function:** `validateSelection()` at `src/cli/lib/matrix/matrix-resolver.ts:424`

Runs four validation passes via helper functions:

- `validateConflicts()` (line 282) - Mutually exclusive skill pairs
- `validateRequirements()` (line 305) - Required dependencies
- `validateExclusivity()` (line 341) - Category exclusive violations
- `validateRecommendations()` (line 372) - Missing recommended companions (warnings only)

Returns `SelectionValidation` with `valid` flag, error list, and warning list.

**Function:** `checkMatrixHealth()` at `src/cli/lib/matrix/matrix-health-check.ts`

Validates matrix integrity: orphaned skills, missing categories, broken references.

## Source Switching

**File:** `src/cli/lib/skills/source-switcher.ts`

When changing a skill's source:

- `deleteLocalSkill(projectDir, skillId)` - Permanently removes local skill directory
- `migrateLocalSkillScope(skillId, fromScope, projectDir)` - Moves skill files between project and global directories when scope changes

## Skill Versioning

**File:** `src/cli/lib/versioning.ts`

- `computeSkillFolderHash()` - SHA-256 hash of skill directory contents
- Used for `forkedFrom.contentHash` in metadata to detect local modifications

## Stacks System (`src/cli/lib/stacks/`)

| File                       | Path                                          | Purpose                        |
| -------------------------- | --------------------------------------------- | ------------------------------ |
| `stacks-loader.ts`         | `src/cli/lib/stacks/stacks-loader.ts`         | Load stacks from stacks.ts     |
| `stack-installer.ts`       | `src/cli/lib/stacks/stack-installer.ts`       | Install stack as plugin        |
| `stack-plugin-compiler.ts` | `src/cli/lib/stacks/stack-plugin-compiler.ts` | Compile stack as plugin bundle |

Stacks are pre-configured bundles of skills mapped to agents. Defined in `config/stacks.ts`.

**Key functions:**

- `loadStacks()` - Load all stacks from TS config
- `loadStackById()` - Load specific stack
- `resolveAgentConfigToSkills()` - Resolve stack agent config to skill assignments
- `getStackSkillIds()` - Extract flat skill ID list from stack
- `normalizeStackRecord()` - Normalize stack values to `SkillAssignment[]` arrays
