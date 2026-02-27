# Skills & Matrix System

**Last Updated:** 2026-02-25

## Overview

**Purpose:** Load, resolve, and merge the skills matrix (category definitions + skill metadata) into a unified read model (`MergedSkillsMatrix`) consumed by the wizard and CLI commands.

## Key Concepts

| Concept            | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| Skills Matrix      | `config/skills-matrix.yaml` - category definitions + relationships |
| Skill Metadata     | Per-skill `SKILL.md` frontmatter + `metadata.yaml`                 |
| MergedSkillsMatrix | Combined read model after matrix + skill metadata merge            |
| Skill Alias        | Short display name (e.g., "react") resolved to SkillId             |
| Source             | Where skills come from (public marketplace, private, local)        |

## File Structure

### Matrix System (`src/cli/lib/matrix/`)

| File                     | Path                                        | Purpose                                     |
| ------------------------ | ------------------------------------------- | ------------------------------------------- |
| `matrix-loader.ts`       | `src/cli/lib/matrix/matrix-loader.ts`       | Load + merge matrix with skills             |
| `matrix-resolver.ts`     | `src/cli/lib/matrix/matrix-resolver.ts`     | Alias resolution, conflict/recommend checks |
| `matrix-health-check.ts` | `src/cli/lib/matrix/matrix-health-check.ts` | Validate matrix integrity                   |
| `index.ts`               | `src/cli/lib/matrix/index.ts`               | Barrel exports                              |

### Skills System (`src/cli/lib/skills/`)

| File                       | Path                                          | Purpose                                     |
| -------------------------- | --------------------------------------------- | ------------------------------------------- |
| `skill-fetcher.ts`         | `src/cli/lib/skills/skill-fetcher.ts`         | Fetch skills from source directories        |
| `skill-metadata.ts`        | `src/cli/lib/skills/skill-metadata.ts`        | Read/write skill metadata, hashing          |
| `skill-copier.ts`          | `src/cli/lib/skills/skill-copier.ts`          | Copy skills to local/plugin dirs            |
| `skill-plugin-compiler.ts` | `src/cli/lib/skills/skill-plugin-compiler.ts` | Compile skill as Claude plugin              |
| `local-skill-loader.ts`    | `src/cli/lib/skills/local-skill-loader.ts`    | Discover local skills in project            |
| `source-switcher.ts`       | `src/cli/lib/skills/source-switcher.ts`       | Archive/restore skills for source switching |
| `index.ts`                 | `src/cli/lib/skills/index.ts`                 | Barrel exports                              |

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

3. Matrix Loading
   loadSkillsMatrix() (matrix-loader.ts)
   -> Reads skills-matrix.yaml from source
   -> Returns SkillsMatrixConfig { categories, relationships, skillAliases }

4. Skill Extraction
   extractAllSkills() (matrix-loader.ts)
   -> Walks source skills directory
   -> Reads SKILL.md frontmatter (parseFrontmatter from loader.ts)
   -> Reads metadata.yaml (Zod-validated via skillMetadataLoaderSchema)
   -> Returns ExtractedSkillMetadata[]

5. Matrix Merge
   mergeMatrixWithSkills() (matrix-loader.ts)
   -> Combines categories + extracted metadata + relationships
   -> Resolves aliases (display names -> canonical IDs)
   -> Builds bidirectional display name maps
   -> Returns MergedSkillsMatrix

6. Multi-Source Loading (optional)
   loadSkillsFromAllSources() (multi-source-loader.ts)
   -> Loads skills from primary + extra configured sources
   -> Merges availableSources onto each ResolvedSkill
   -> Sets activeSource based on installation state

7. Combined Pipeline
   loadSkillsMatrixFromSource() (source-loader.ts)
   -> Orchestrates: fetch -> load matrix -> extract skills -> merge -> multi-source
   -> Returns SourceLoadResult
```

## SourceLoadResult (`src/cli/lib/loading/source-loader.ts:59-65`)

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
tags: ["react", "hooks", "components"]
compatibleWith: ["web-framework-react"]
requires: []
conflictsWith: []
domain: web
```

Validated with `skillMetadataLoaderSchema` from `src/cli/lib/schemas.ts`.

## Alias Resolution

**Function:** `resolveAlias()` at `src/cli/lib/matrix/matrix-resolver.ts`

Resolves short display names to canonical SkillIds:

- Input: `"react"` -> Output: `"web-framework-react"`
- Lookup via `matrix.displayNameToId`
- Falls through if already a canonical ID

## Relationship System

Defined in `skills-matrix.yaml` under `relationships`:

| Type           | Effect                                  | Enforcement         |
| -------------- | --------------------------------------- | ------------------- |
| `conflicts`    | Selecting one disables others           | Hard (grays out)    |
| `discourages`  | Selecting one warns about others        | Soft (warning icon) |
| `recommends`   | Selecting one highlights companions     | Soft (highlight)    |
| `requires`     | Skill A needs skill B first             | Hard (dependency)   |
| `alternatives` | Interchangeable skills for same purpose | Informational       |

Checked per-skill by functions in `matrix-resolver.ts`:

- `getDependentSkills()` - Find skills that depend on a given skill
- `isDiscouraged()` - Check if skill is discouraged (conflicts, unmet requirements, or discourages relationships)
- `getDiscourageReason()` - Get human-readable reason for discouragement
- `isRecommended()` - Check if skill is recommended by selected skills
- `getRecommendReason()` - Get human-readable recommendation reason

Additional utilities:

- `validateSelection()` - Full selection validation (conflicts, requirements, exclusivity)
- `getAvailableSkills()` - Get skills available for a category with state annotations
- `getSkillsByCategory()` - Get skills grouped by category

## Validation

**Function:** `validateSelection()` at `src/cli/lib/matrix/matrix-resolver.ts:512`

Returns `SelectionValidation` with:

- Errors: conflicts, missing requirements, category exclusive violations
- Warnings: missing recommendations, unused setup skills

**Function:** `checkMatrixHealth()` at `src/cli/lib/matrix/matrix-health-check.ts`

Validates matrix integrity: orphaned skills, missing categories, broken references.

## Source Switching

**File:** `src/cli/lib/skills/source-switcher.ts`

When changing a skill's source:

- `archiveLocalSkill(projectDir, skillId)` - Moves to `_archived/` directory
- `restoreArchivedSkill(projectDir, skillId)` - Restores from `_archived/`
- `hasArchivedSkill(projectDir, skillId)` - Checks if archived version exists

Archive directory: `.claude/skills/_archived/` (`ARCHIVED_SKILLS_DIR_NAME` from `src/cli/consts.ts:30`)

## Skill Versioning

**File:** `src/cli/lib/versioning.ts`

- `computeSkillFolderHash()` - SHA-256 hash of skill directory contents
- Used for `forkedFrom.contentHash` in metadata to detect local modifications

## Stacks System (`src/cli/lib/stacks/`)

| File                       | Path                                          | Purpose                        |
| -------------------------- | --------------------------------------------- | ------------------------------ |
| `stacks-loader.ts`         | `src/cli/lib/stacks/stacks-loader.ts`         | Load stacks from stacks.yaml   |
| `stack-installer.ts`       | `src/cli/lib/stacks/stack-installer.ts`       | Install stack as plugin        |
| `stack-plugin-compiler.ts` | `src/cli/lib/stacks/stack-plugin-compiler.ts` | Compile stack as plugin bundle |

Stacks are pre-configured bundles of skills mapped to agents. Defined in `config/stacks.yaml`.

**Key functions:**

- `loadStacks()` - Load all stacks from YAML
- `loadStackById()` - Load specific stack
- `resolveAgentConfigToSkills()` - Resolve stack agent config to skill assignments
- `getStackSkillIds()` - Extract flat skill ID list from stack
- `normalizeStackRecord()` - Normalize stack values to `SkillAssignment[]` arrays
