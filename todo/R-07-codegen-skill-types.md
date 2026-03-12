# R-07: Codegen Skill Types, Categories, and Agent Names from Source

**Status:** Ready to implement
**Complexity:** Medium (new script + type changes + test cascade)
**Depends on:** R-04 (complete)

## Problem

Five types are manually maintained in two places each (union type + Zod schema):

| Type        | Union location                                                   | Zod location                                        | Source of truth                                    |
| ----------- | ---------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| `SkillId`   | template literal in `types/skills.ts` (wide, no typo protection) | regex in `schemas.ts`                               | Skills repo: `SKILL.md` frontmatter `name` field   |
| `SkillSlug` | manual union in `types/skills.ts` (~85 values)                   | manual Zod enum in `schemas.ts` (~85 values)        | Skills repo: `metadata.yaml` `slug` field          |
| `Category`  | manual union in `types/matrix.ts` (38 values)                    | `CATEGORY_VALUES` const in `schemas.ts` (38 values) | Skills repo: `metadata.yaml` `category` field      |
| `AgentName` | manual union in `types/agents.ts` (17 values)                    | inline Zod enum in `schemas.ts` (17 values)         | CLI repo: `src/agents/**/metadata.yaml` `id` field |
| `Domain`    | manual union in `types/matrix.ts` (5 values)                     | —                                                   | Skills repo: `metadata.yaml` `domain` field        |

Adding a skill, category, or agent requires updating both the type union and the Zod schema. `SkillId` is worse — it's a template literal that accepts any matching pattern, so typos compile silently.

**Current drift (source vs union):**

- `Category`: 4 values in union but not in source (`cli-prompts`, `mobile-platform`, `shared`, `web-base-framework`)
- `SkillSlug`: ~18 mismatches in each direction
- `SkillId`: wide template literal, no drift possible (accepts everything)
- `AgentName`: in sync (17 agents in both)
- `Domain`: in sync (5 values) — but `"shared"` appears as a stale `Category` member

## Proposed Solution

A single codegen script that reads from two sources:

1. **Skills repo** (`../skills/src/skills/*/metadata.yaml` + `SKILL.md`) → `SkillId`, `SkillSlug`, `Category`, `Domain`
2. **CLI repo** (`src/agents/**/metadata.yaml`) → `AgentName`

Generates one file with:
- A **`SKILL_MAP`** object mapping slug → skill ID (encodes the relationship at the type level)
- Derived `SkillSlug` and `SkillId` types from the map
- Derived `SKILL_SLUGS` and `SKILL_IDS` arrays for Zod enum compatibility
- Const arrays + derived types for `Category`, `Domain`, `AgentName`

The Zod schemas in `schemas.ts` then derive from the generated arrays, eliminating all duplication.

**Key design choice: `SKILL_MAP` instead of separate arrays.** The slug↔ID relationship is currently reconstructed at runtime by `buildSlugMap()` in `matrix-loader.ts` from extracted skill metadata. With `SKILL_MAP`, the built-in slug↔ID mapping is available at import time as a typed constant. This:
- Encodes the relationship in the type system (no way to have a slug without its ID)
- Provides a compile-time lookup map (`SKILL_MAP["react"]` → `"web-framework-react"`)
- Eliminates the need to build slug maps from scratch for built-in skills
- Makes `SkillSlugMap` in `matrix.ts` derivable from `SKILL_MAP` for built-in skills (custom skills still extend at runtime)

**Parsing approach:** The script uses the `yaml` package (already a dependency) and a 3-line frontmatter regex directly. It does NOT import `parseFrontmatter()` from `loader.ts` or `extractAllSkills()` from `matrix-loader.ts` — those functions import CLI types, schemas, and utilities that depend on the generated types, creating a circular dependency. The script mirrors the traversal pattern of `extractAllSkills()` but with its own lightweight parsing.

### Generated output: `src/cli/types/generated/source-types.ts`

```typescript
// AUTO-GENERATED from skills source and agent metadata — do not edit manually
// Run: bun run generate:types

// ── Skill Map (slug → ID) ─────────────────────────────────────

export const SKILL_MAP = {
  "angular-standalone": "web-framework-angular-standalone",
  "anti-over-engineering": "meta-methodology-anti-over-engineering",
  "hono": "api-framework-hono",
  "react": "web-framework-react",
  "vue-composition-api": "web-framework-vue-composition-api",
  // ... all 86 entries, sorted alphabetically by slug
} as const;

export type SkillSlug = keyof typeof SKILL_MAP;
export type SkillId = (typeof SKILL_MAP)[SkillSlug];

// Derived arrays for Zod enum compatibility
// (z.enum() requires a readonly tuple, not Object.keys/values)
export const SKILL_SLUGS = [
  "angular-standalone",
  "hono",
  "react",
  // ... all 86 slugs, sorted alphabetically
] as const satisfies readonly SkillSlug[];

export const SKILL_IDS = [
  "api-framework-hono",
  "web-framework-react",
  "web-framework-vue-composition-api",
  // ... all 86 IDs, sorted alphabetically
] as const satisfies readonly SkillId[];

// ── Categories ─────────────────────────────────────────────────

export const CATEGORIES = [
  "api-analytics",
  "api-api",
  "web-framework",
  // ... all unique categories from metadata.yaml, sorted
] as const;

export type Category = (typeof CATEGORIES)[number];

// ── Domains ────────────────────────────────────────────────────

export const DOMAINS = ["api", "cli", "mobile", "shared", "web"] as const;

export type Domain = (typeof DOMAINS)[number];

// ── Agent Names ────────────────────────────────────────────────

export const AGENT_NAMES = [
  "agent-summoner",
  "api-developer",
  "cli-developer",
  // ... all agent IDs from src/agents/**/metadata.yaml, sorted
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];
```

### Script: `scripts/generate-source-types.ts`

```typescript
// Pseudocode
1. Accept skills source path as CLI arg (default: ../skills)
2. Glob for all metadata.yaml files under {source}/src/skills/
3. For each skill metadata.yaml:
   a. Parse YAML — skip if `custom: true` (custom skills register at runtime via extendSchemasWithCustomValues)
   b. Extract: slug, category, domain
   c. Read sibling SKILL.md, extract `name` from frontmatter via regex + yaml parse (= SkillId)
   d. Collect slug→id pair into SKILL_MAP entries
4. Glob for all metadata.yaml files under ./src/agents/
5. For each agent metadata.yaml:
   a. Parse YAML — skip if `custom: true`
   b. Extract: id (= AgentName)
6. Collect unique values for each type, sort alphabetically
7. Validate: no duplicate slugs, no duplicate IDs, no duplicate agent names
8. Write the generated file (SKILL_MAP object + derived arrays + other const arrays)
9. Log summary: "Generated: 86 skill IDs, 86 slugs, 34 categories, 5 domains, 17 agents"
```

**Custom values:** Skills and agents with `custom: true` in their `metadata.yaml` are excluded from codegen. Their IDs, slugs, categories, domains, and agent names are registered at runtime via `extendSchemasWithCustomValues()` in `schemas.ts`, which extends the Zod schemas dynamically. This system is unaffected by the codegen change — the extensible schemas use `.refine()` on top of the base enums.

### NPM script in `package.json`

```json
"generate:types": "bun scripts/generate-source-types.ts"
```

## Changes Required

### 1. New file: `scripts/generate-source-types.ts`

The codegen script (~100 lines). Uses only:

- Node's `fs` and `path` (or `fast-glob` / `glob` for globbing)
- `yaml` package (already a dependency)
- Regex for SKILL.md frontmatter extraction

### 2. New file: `src/cli/types/generated/source-types.ts`

The generated output. Committed to git (not gitignored) so the repo builds without running the script first.

### 3. Update: `src/cli/types/skills.ts`

- Remove the manual `SkillSlug` union (lines 13-121)
- Remove the template literal `SkillId` type (line 7)
- Remove `SkillIdPrefix` (line 4) — no longer needed. Its only consumer was `CategoryPath` (`` `${SkillIdPrefix}-${string}` | Category | "local" ``), which simplifies to `Category | "local"` now that `Category` is an exact generated union covering all valid category values.
- Re-export from the generated file:

```typescript
export type { SkillId, SkillSlug } from "./generated/source-types";
export { SKILL_MAP, SKILL_IDS, SKILL_SLUGS } from "./generated/source-types";
```

- Keep `PluginSkillRef` as `` `${SkillId}:${SkillId}` ``. With exact unions this becomes an 86×86 cross-product (7,396 members) — try it first. If TS/IDE performance degrades, fall back to `` `${string}:${string}` `` with runtime validation.

### 4. Update: `src/cli/types/matrix.ts`

- Remove the manual `Category` union (lines 8-46)
- Remove the manual `Domain` union (line 5)
- Re-export from the generated file:

```typescript
export type { Category, Domain } from "./generated/source-types";
export { CATEGORIES, DOMAINS } from "./generated/source-types";
```

### 5. Update: `src/cli/types/agents.ts`

- Remove the manual `AgentName` union (lines 5-29)
- Re-export from the generated file:

```typescript
export type { AgentName } from "./generated/source-types";
export { AGENT_NAMES } from "./generated/source-types";
```

### 6. Update: `src/cli/lib/schemas.ts`

Replace all manually maintained Zod enums with derivations from generated const arrays:

```typescript
import { SKILL_IDS, SKILL_SLUGS, CATEGORIES, DOMAINS, AGENT_NAMES } from "../../types/generated/source-types";

// Replace DOMAIN_VALUES and domainSchema
export const domainSchema = z.enum(DOMAINS) as z.ZodType<Domain>;

// Replace CATEGORY_VALUES and categorySchema
export const categorySchema = z.enum(CATEGORIES) as z.ZodType<Category>;
const CATEGORY_VALUES_SET = new Set<Category>([...CATEGORIES]);

// Replace inline agentNameSchema
export const agentNameSchema = z.enum(AGENT_NAMES) as z.ZodType<AgentName>;

// Replace manually maintained skillSlugSchema (lines 155-239)
export const skillSlugSchema = z.enum(SKILL_SLUGS) as z.ZodType<SkillSlug>;
```

Delete: `CATEGORY_VALUES` const array, `DOMAIN_VALUES` const array (replaced by `CATEGORIES` and `DOMAINS` from generated file). Keep `isValidSkillId()` regex for runtime validation at parse boundaries.

**c) `categoryPathSchema` (line 340):** Currently has a hardcoded regex with 8 prefixes (`web|api|cli|mobile|infra|meta|security|shared`). With `CategoryPath` simplified to `Category | "local"`, remove the regex arm — just check `val === "local"`, `categorySchema.safeParse(val).success`, or `customExtensions.categories.has(val)`.

### 7. Fix: `test-fixtures.ts` — `SKILLS.vue`

`SKILLS.vue` uses `"web-framework-vue"` but the actual source skill is `"web-framework-vue-composition-api"`. With exact unions this becomes a compile error. Update the fixture to match the source, and cascade the ID change to all test files referencing `SKILLS.vue`.

### 8. Test impact — `createMockSkill()` callers

~23 test call sites pass non-source IDs to `createMockSkill()` as bare string literals (e.g., `"web-skill-a"`, `"web-test-alpha"`). With exact unions, these won't type-check without casts.

**Fix:** Add `as SkillId` casts to these call sites. The tests are deliberately using fake IDs for isolation/error cases, and the cast documents that intent.

### 9. First-run drift cleanup

The first codegen run will change several unions:

- `Category`: removes 4 stale values (`cli-prompts`, `mobile-platform`, `shared`, `web-base-framework`)
- `SkillSlug`: ~18 mismatches in each direction
- `SkillId`: narrows from wide template literal to exact union

**Mitigation:** After generating, search for all hardcoded string literals of each type in the codebase and fix any that reference removed values.

### 10. `CategoryPath` type

Currently: `` `${SkillIdPrefix}-${string}` | Category | "local" ``

Simplify to `Category | "local"`. The `` `${SkillIdPrefix}-${string}` `` arm was a loose pattern to catch category strings that matched the prefix convention — with `Category` as an exact generated union, it's redundant. Delete `SkillIdPrefix` entirely.

## Order of Operations

1. Write the codegen script (`scripts/generate-source-types.ts`)
2. Run it to generate `src/cli/types/generated/source-types.ts`
3. Update `types/skills.ts` — re-export `SkillId`, `SkillSlug`, `SKILL_MAP`, `SKILL_IDS`, `SKILL_SLUGS`
4. Update `types/matrix.ts` — re-export `Category`, `Domain`, `CATEGORIES`, `DOMAINS`
5. Update `types/agents.ts` — re-export `AgentName`, `AGENT_NAMES`
6. Update `schemas.ts` — derive all Zod enums from generated const arrays, delete `CATEGORY_VALUES`
7. Fix `SKILLS.vue` in `test-fixtures.ts` + cascade
8. Add `as SkillId` casts to ~23 `createMockSkill()` call sites with non-source IDs
9. Fix hardcoded string literals broken by drift (categories, slugs)
10. Run `tsc --noEmit` — fix remaining type errors
11. Run full test suite
12. Add `generate:types` npm script to `package.json`

## Estimated Blast Radius

### Direct changes:

| File                                      | Action          | Lines     |
| ----------------------------------------- | --------------- | --------- |
| `scripts/generate-source-types.ts`        | NEW             | ~100      |
| `src/cli/types/generated/source-types.ts` | NEW (generated) | ~220      |
| `src/cli/types/skills.ts`                 | MODIFY          | -110, +5  |
| `src/cli/types/matrix.ts`                 | MODIFY          | -45, +4   |
| `src/cli/types/agents.ts`                 | MODIFY          | -25, +3   |
| `src/cli/lib/schemas.ts`                  | MODIFY          | -120, +10 |
| `package.json`                            | MODIFY          | +1        |

### Cascade changes:

| File                                     | Action | Reason                                    |
| ---------------------------------------- | ------ | ----------------------------------------- |
| `src/cli/lib/__tests__/test-fixtures.ts` | MODIFY | `SKILLS.vue` ID correction                |
| `src/cli/lib/__tests__/helpers.ts`       | MODIFY | `getCanonicalSkillCategories()` vue entry |
| ~15-20 test files                        | MODIFY | `as SkillId` casts for non-source IDs     |
| Test files using stale categories        | MODIFY | Fix removed category values               |

**Estimated total: ~25-30 files**, with test file changes being mechanical.

## Non-Goals

- Auto-running on build — manual `bun run generate:types` is sufficient
- Generating `ModelName` or `PermissionMode` — these are small, stable, and not sourced from metadata
- Changing `isValidSkillId()` runtime check — regex stays for parse boundaries
- Updating `getCanonicalSkillCategories()` beyond the vue fix — separate cleanup
- Replacing `buildSlugMap()` in `matrix-loader.ts` with `SKILL_MAP` — `buildSlugMap()` handles runtime-discovered skills (custom, local) so it must remain; `SKILL_MAP` could seed it as a follow-up optimization but that's out of scope
