# Custom Extensibility Design

Design document for allowing private marketplace users to create custom skills, agents, categories, and domains that the CLI can load, validate, and compile without requiring changes to the CLI's built-in type definitions.

**Status:** Phase 1-2 implemented (foundation + matrix merge + auto-discovery + dynamic schema extension)
**Date:** 2026-02-21 (design), 2026-02-22 (implementation)

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [The Custom Property](#the-custom-property)
3. [Naming Convention Analysis](#naming-convention-analysis)
4. [Local Schema Design](#local-schema-design)
5. [Runtime Validation Behavior](#runtime-validation-behavior)
6. [Skills Matrix Merge Strategy](#skills-matrix-merge-strategy)
7. [Impact by Entity Type](#impact-by-entity-type)
8. [Skill & Agent Creation UX](#skill--agent-creation-ux)
9. [Implementation Phases](#implementation-phases)
10. [Open Questions](#open-questions)

---

## Problem Statement

The CLI currently has tightly constrained union types for all core entities:

| Entity        | Type          | Constraint                                                                        |
| ------------- | ------------- | --------------------------------------------------------------------------------- |
| Skill IDs     | `SkillId`     | Must match `${SkillIdPrefix}-${string}-${string}` where prefix is one of 7 values |
| Agent names   | `AgentName`   | Closed union of 18 built-in names                                                 |
| Subcategories | `Subcategory` | Closed union of 38 values                                                         |
| Domains       | `Domain`      | Closed union of 5 values (`web`, `api`, `cli`, `mobile`, `shared`)                |

These constraints serve the built-in skill marketplace well but block users who need custom entities in their private marketplaces. The existing `SkillSourceType === "private"` flag only marks where a skill came from, not whether it was custom-created outside the CLI's built-in vocabulary.

### Goals

1. Let users create entities with IDs outside the built-in unions
2. Distinguish custom entities from built-in ones at runtime
3. Validate custom entities via local schemas that extend (not replace) the CLI's base schemas
4. Skip strict enum validation for custom entities while preserving structural and reference-integrity checks

### Codebase Audit Notes

**Counts verified against actual source (2026-02-21):**

- `SkillIdPrefix` (`src/cli/types/skills.ts:4`): 7 values -- `"web" | "api" | "cli" | "mobile" | "infra" | "meta" | "security"`. **Correct as stated.**
- `AgentName` (`src/cli/types/agents.ts:5-31`): **18 members, not 20.** The actual list: `web-developer`, `api-developer`, `cli-developer`, `web-architecture`, `agent-summoner`, `documentor`, `skill-summoner`, `cli-migrator`, `pattern-scout`, `web-pattern-critique`, `web-pm`, `api-researcher`, `web-researcher`, `api-reviewer`, `cli-reviewer`, `web-reviewer`, `cli-tester`, `web-tester`. The Zod schema in `schemas.ts:104-123` has the same 18 values.
- `Subcategory` (`src/cli/types/matrix.ts:8-46`): **38 members, not 37.** Count includes: 19 web-prefixed (web-framework through web-base-framework), 7 api-prefixed, 2 mobile-prefixed, 7 shared-prefixed, 3 cli-prefixed = 38 total. The `SUBCATEGORY_VALUES` array in `schemas.ts:53-92` matches with the same 38 entries.
- `Domain` (`src/cli/types/matrix.ts:5`): 5 values -- confirmed.
- `SkillSourceType` (`src/cli/types/matrix.ts:280`): `"public" | "private" | "local"` -- **confirmed.** The claim about it marking provenance is accurate.

**Note:** The `CategoryPath` type (`src/cli/types/skills.ts:124`) accepts an additional prefix `shared` beyond the 7 in `SkillIdPrefix`. The regex in `categoryPathSchema` (`schemas.ts:241`) includes 8 prefixes: `web|api|cli|mobile|infra|meta|security|shared`. This asymmetry means `shared-monorepo` is a valid `CategoryPath` but "shared" is not a valid `SkillIdPrefix`. Custom extensibility must account for both patterns.

---

## The Custom Property

### Recommendation: `custom: true`

A boolean `custom` property on each entity's config file. The property is shared by both skills and agents.

**Why boolean over enum:**

- The only distinction that matters at runtime is "should the CLI enforce its built-in enum constraints on this entity?" -- a yes/no question
- An enum like `origin: "custom" | "builtin" | "forked"` conflates provenance with validation behavior. Provenance is already tracked elsewhere: `SkillSourceType` for source classification, `forkedFrom` for fork lineage
- A boolean is impossible to get wrong. Users writing YAML add `custom: true` and it works

**Why `custom` over alternatives:**

| Candidate           | Problem                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `origin: "custom"`  | Overlaps with `SkillSourceType` and `forkedFrom` provenance tracking |
| `managed: true`     | Semantically backwards (all skills are "managed" by the CLI)         |
| `builtin: false`    | Double negative; confusing for YAML authors                          |
| `external: true`    | Ambiguous -- external to what?                                       |
| `customSkill: true` | Awkward on agent YAML -- the property is not skill-specific          |

**Where it lives in each entity:**

```yaml
# metadata.yaml (skills)
custom: true
category: acme-pipeline
author: "@acme"
displayName: Deploy Pipeline
# ...

# agent.yaml (agents)
custom: true
id: acme-deployer
title: Acme Deployer
# ...
```

**Note:** Categories and domains do NOT use `custom: true`. They are declared in the source's `skills-matrix.yaml` and merged with the CLI's built-in matrix at load time. See [Skills Matrix Merge Strategy](#skills-matrix-merge-strategy) for details.

**Automatic vs manual:**

- `agentsinc new skill` and `agentsinc new agent` should set `custom: true` automatically when running inside a private marketplace context (detected via `config.yaml` having a `marketplace` field or the presence of `marketplace.json`)
- Users editing YAML directly can add it manually
- Built-in skills shipped with the public marketplace never have this property

### Where `custom: true` Is Actually Checked

The `custom: true` flag is ONLY checked in two contexts:

1. **`agentsinc validate` command** -- to decide whether to apply strict built-in naming conventions. This is centralized in one place: `schema-validator.ts`. When `custom: true`, the validator skips the `SKILL_ID_PATTERN` prefix check for skill IDs and the `agentNameSchema` enum check for agent names.
2. **UI/UX** -- to show a visual indicator in the wizard (optional badge/label). This is purely cosmetic.

It is NOT checked at any loader parse boundary. The dynamic schema extension (for categories, domains, agent names, and skill IDs via auto-discovery) handles all parse-time validation. This means `custom: true` does not infect the codebase with scattered conditionals -- it is a metadata flag for validation strictness and display purposes only.

### Codebase Audit Notes

**`SkillSourceType` and `forkedFrom` verification:**

- `SkillSourceType` (`src/cli/types/matrix.ts:280`): `"public" | "private" | "local"` -- classifies source provenance only. Lives on `SkillSource.type`, not on the metadata YAML. Confirmed no overlap with `custom`.
- `forkedFrom` is used in two contexts:
  1. `localSkillMetadataSchema` (`schemas.ts:539-554`): tracks fork lineage for local skills copied from marketplace (`skillId`, `contentHash`, `date`, `source`)
  2. `metadataValidationSchema` (`schemas.ts:811-824`): strict validation for published skills (`skillId`, `version`, `contentHash`, `source`, `date`)
  3. `importedSkillMetadataSchema` (`schemas.ts:627-642`): tracks import origin (`source`, `skillName`, `contentHash`, `date`)
- Neither `SkillSourceType` nor `forkedFrom` conveys "this entity uses custom vocabulary" -- the doc's claim of no overlap is **correct**.

**Marketplace detection:** The `marketplace` field exists on `ProjectConfig` (`src/cli/types/config.ts:87`). The `Marketplace` type (`src/cli/types/plugins.ts:58-66`) represents `marketplace.json`. Both detection paths described are viable.

---

## Naming Convention Analysis

### Current State: Prefix-Based Skill IDs

The `SkillId` type is `${SkillIdPrefix}-${string}-${string}`, requiring one of 7 prefixes: `web`, `api`, `cli`, `mobile`, `infra`, `meta`, `security`.

The `SKILL_ID_PATTERN` regex enforces this:

```typescript
// src/cli/lib/schemas.ts:227
export const SKILL_ID_PATTERN = /^(web|api|cli|mobile|infra|meta|security)-.+-.+$/;
```

### Codebase Audit: Where Is the Prefix Actually Parsed?

I searched the codebase for all code that extracts or relies on the skill ID prefix. Here is every location:

#### 1. Schema Validation (3 locations)

| File                               | Usage                                        | Impact                                       |
| ---------------------------------- | -------------------------------------------- | -------------------------------------------- |
| `lib/schemas.ts:227-235`           | `SKILL_ID_PATTERN` regex and `skillIdSchema` | Rejects IDs with unknown prefixes            |
| `lib/skills/source-switcher.ts:16` | `SKILL_ID_PATTERN.test(skillId)`             | Rejects IDs for archive/restore operations   |
| `lib/stacks/stacks-loader.ts:118`  | `SKILL_ID_PATTERN.test(assignment.id)`       | Warns and skips invalid IDs in stack configs |

#### 2. Agent-Skill Assignment (post D-43)

The `getAgentsForSkill()` function, `skillToAgents` mapping in `agent-mappings.yaml`, `agentSkillPrefixes`, `DEFAULT_AGENTS` constant, and `defaults-loader.ts` have all been removed by D-43. The current behavior is simpler: when no stack is selected, all skills are assigned to all selected agents. Stacks provide fine-grained skill-to-agent mapping via explicit config.

This simplification means the skill ID prefix has zero routing significance -- it is purely a naming convention for human readability.

#### 3. Display Name Fallback (1 location)

```typescript
// stores/wizard-store.ts:116-117
const segments = skillId.split("-");
const fallback = segments[segments.length - 1] || skillId;
```

This extracts the **last** segment as a display name fallback, not the first (prefix).

#### 4. Domain Determination

The skill's domain is determined by its `category` field in `metadata.yaml`, which maps to a `CategoryDefinition` with a `domain` property. The skill ID prefix is **not** used to determine domain at runtime.

### Conclusion: The Prefix is Redundant Information

**The prefix only matters for:**

1. Schema validation (3 regex checks) -- easily made conditional on `custom: true`
2. Human readability -- `web-framework-react` tells you the domain at a glance

**The prefix does NOT determine:**

- Which domain a skill belongs to (determined by `category` -> `CategoryDefinition.domain`)
- Which agents receive the skill (after D-43, all skills are assigned to all selected agents; stacks provide fine-grained mapping)
- How the skill appears in the wizard (determined by category/subcategory)

### Recommendation: Allow Any Kebab-Case ID

Custom skills should be allowed to use **any** kebab-case string as their ID -- no prefix requirements, no minimum segment count. The only constraint is filesystem and YAML safety: the ID must be a valid kebab-case string (lowercase alphanumeric segments separated by hyphens).

This means all of the following are valid custom skill IDs:

- `deploy` (single segment)
- `acme-deploy` (two segments)
- `acme-pipeline-deploy` (three segments)
- `acme-k8s-rollback-strategy` (four segments)

The skill's placement in the system is determined entirely by its `category` field in `metadata.yaml`, not by any prefix convention in the ID.

**Implementation approach:**

For custom entities (`custom: true`), relax the `SKILL_ID_PATTERN` to accept any kebab-case string:

```typescript
// Proposed: general pattern for custom skills — any kebab-case string
const CUSTOM_SKILL_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// At runtime, check:
// 1. If entity has custom: true -> validate against CUSTOM_SKILL_ID_PATTERN
// 2. If entity does NOT have custom: true -> validate against existing SKILL_ID_PATTERN
```

**What we do NOT do:**

- We do not remove the built-in prefix constraint for non-custom skills
- We do not parse the prefix from custom skill IDs for any routing logic (the `category` field handles routing)

### Codebase Audit Notes

**Line references verified:**

- `SKILL_ID_PATTERN` at `schemas.ts:227` -- **confirmed**
- `source-switcher.ts:16` uses `SKILL_ID_PATTERN.test(skillId)` -- **confirmed** (in `validateSkillId()` function, called by `archiveLocalSkill`, `restoreArchivedSkill`, and `hasArchivedSkill`)
- `stacks-loader.ts:118` uses `SKILL_ID_PATTERN.test(assignment.id)` -- **confirmed** (in `resolveAgentConfigToSkills()`)
- `preselectAgentsFromDomains()` at `wizard-store.ts:631-641` -- **confirmed** it uses only `DOMAIN_AGENTS` constant
- `defaults/agent-mappings.yaml`, `defaults-loader.ts`, `agentSkillPrefixes`, `defaultMappingsSchema`, `getAgentsForSkill()`, and `DEFAULT_AGENTS` have all been removed by D-43

**`categoryPathSchema` additional prefix:** The `categoryPathSchema` regex (`schemas.ts:241`) includes `shared` as an 8th valid prefix beyond the 7 in `SkillIdPrefix`. This means `shared-monorepo` is a valid category path even though `shared` is not a valid skill ID prefix. Custom extensibility must relax `categoryPathSchema` similarly.

---

## Local Schema Design

> **Status: DEFERRED.** Schema scaffolding is fully deferred. `new marketplace` and `new skill` no longer generate `$schema` comments in YAML files. No local schema files are generated. The CLI validates at runtime via Zod (which already supports custom values via dynamic schema extension from Phases 1-2). IDE schema validation for custom enum values will be implemented later via the base schema splitting approach described below.

### Purpose

Users need IDE validation (yaml-language-server) for their custom entities. The CLI publishes base JSON schemas (e.g., `metadata.schema.json`). The user's marketplace repo would extend these with local schema files that add custom enum values.

### What Works Today

> **Decision (2026-02-23):** Base schemas upgraded to **JSON Schema draft 2020-12** with `unevaluatedProperties: false` (replacing `additionalProperties: false`). yaml-language-server supports draft 2020-12 as of February 2026 ([issue #478](https://github.com/redhat-developer/yaml-language-server/issues/478)).

The `unevaluatedProperties` keyword solves the **property addition** problem: it sees across `allOf` boundaries, so an extending schema can add new properties (like `custom: true`) without the base schema rejecting them as unknown. This is working and correct.

However, `unevaluatedProperties` does **NOT** solve the **enum widening** problem. `allOf` is always intersection (AND). If the base schema has `category: { enum: [38 built-in values] }` and the extension adds `category: { enum: ["acme-pipeline", "acme-ml"] }`, the `allOf` intersection produces an empty set (no value can be in both enums simultaneously). The extension's custom categories would always fail validation.

### Why `$dynamicRef`/`$dynamicAnchor` Is Not Viable

Research confirmed that `$dynamicRef`/`$dynamicAnchor` (the JSON Schema draft 2020-12 mechanism for "open" extension points) is not supported by the tooling:

- **yaml-language-server** (AJV-based) restricts `$dynamicAnchor` to schema roots only -- it cannot be placed on individual property schemas
- **VS Code JSON service** explicitly does not support `$dynamicRef`

This rules out the "open anchor" approach to enum extensibility.

### Planned Solution: Base Schema Splitting

The planned approach splits each base schema into two variants:

| Variant                                     | Purpose                                                                        | Enum fields                                | Used by                                |
| ------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ | -------------------------------------- |
| **Structure schema** (`*-base.schema.json`) | All properties, types, patterns, required -- but NO enums on extensible fields | `category: { "type": "string" }` (no enum) | Extension schemas via `allOf` + `$ref` |
| **Full schema** (`*.schema.json`)           | References structure via `allOf` + adds strict enums                           | `category: { "enum": [38 values] }`        | Built-in YAML files (same as today)    |

Custom marketplace YAML files would point to tiny **extension schemas** (~10-15 lines) that `allOf` + `$ref` the structure schema and add ONLY custom enum values. This works because the structure schema has `category: { "type": "string" }` (no enum), so the extension's `category: { "enum": ["acme-pipeline", "acme-ml"] }` does not intersect with anything -- it simply constrains the open `string` type to the custom values.

**Schemas that would need splitting (when implemented):**

| Base schema                  | Structure variant                           | Extensible fields                                                                          |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `metadata.schema.json`       | `metadata-base.schema.json`                 | `category` relaxed to `{ "type": "string" }` (no enum)                                     |
| `skills-matrix.schema.json`  | `skills-matrix-base.schema.json`            | `propertyNames` no enum, `id` no enum, `domain` no enum, no `required` array on categories |
| `stacks.schema.json`         | `stacks-base.schema.json`                   | `propertyNames` no enum, skill ID no prefix pattern                                        |
| `project-config.schema.json` | N/A -- consumer-side, no `$schema` comments | --                                                                                         |

### Directory Structure (Planned)

```
# CLI package (src/schemas/)
metadata.schema.json              # Full schema (strict enums) -- built-in YAML files use this
metadata-base.schema.json         # Structure schema (no enums on extensible fields)
agent.schema.json                 # Full schema
agent-base.schema.json            # Structure schema
skills-matrix.schema.json         # Full schema
skills-matrix-base.schema.json    # Structure schema

# User's marketplace (.claude-src/schemas/)
metadata.schema.json              # Extension: allOf $ref -> CLI's metadata-base + custom enums
agent.schema.json                 # Extension: allOf $ref -> CLI's agent-base + custom enums
skills-matrix.schema.json         # Extension: allOf $ref -> CLI's skills-matrix-base + custom enums
```

### Extension Schema Example (Planned)

```jsonc
// .claude-src/schemas/metadata.schema.json (~10-15 lines)
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Custom Skill Metadata",
  "description": "Extends CLI structure schema with custom categories.",
  "allOf": [
    {
      // References the STRUCTURE schema (no enums), NOT the full schema
      "$ref": "../node_modules/@anthropic/agentsinc-cli/dist/schemas/metadata-base.schema.json",
    },
  ],
  "properties": {
    "custom": {
      "type": "boolean",
      "const": true,
      "description": "Marks this entity as custom-created (bypasses built-in enum validation)",
    },
    "category": {
      "type": "string",
      "enum": ["acme-pipeline", "acme-infra", "acme-ml"],
    },
  },
}
```

This works because:

1. The structure schema defines `category: { "type": "string" }` with no enum constraint
2. The extension's `allOf` inherits all structural rules (required fields, types, patterns)
3. The extension's `category: { "enum": [...] }` constrains the open string to only custom values
4. `unevaluatedProperties: false` on the structure schema allows the `custom` property addition
5. No intersection conflict -- the structure schema's `"type": "string"` is compatible with any `"enum"` subset

### How `$ref` Would Point to the CLI's Structure Schema

**Option A: npm package URL**

```json
{
  "$ref": "https://unpkg.com/@anthropic/agentsinc-cli@latest/dist/schemas/metadata-base.schema.json"
}
```

Pros: Always resolves to the published version. Works with any JSON Schema tooling.
Cons: Requires internet access. `@latest` may introduce breaking changes.

**Option B: Pinned version**

```json
{
  "$ref": "https://unpkg.com/@anthropic/agentsinc-cli@0.44.0/dist/schemas/metadata-base.schema.json"
}
```

Pros: Deterministic. No surprise breakage.
Cons: User must update version manually.

**Option C: Relative path to node_modules (recommended)**

```json
{ "$ref": "../node_modules/@anthropic/agentsinc-cli/dist/schemas/metadata-base.schema.json" }
```

Pros: Works offline. Always matches installed CLI version.
Cons: Path may vary by project structure. Not all tools resolve relative `$ref` correctly.

**Recommendation:** Option C (relative path) is the primary approach. When schema scaffolding is implemented, `agentsinc new marketplace` would scaffold local schemas with a relative path to the CLI's `dist/schemas/` structure variants. This works offline, always matches the installed CLI version, and avoids the versioning problem. Options A and B remain viable for environments where the CLI is not installed locally.

### Schema Update on `new skill` / `new agent` (Deferred)

This subsection is deferred along with schema scaffolding. When implemented:

1. `agentsinc new skill` would create the skill with `custom: true` in `metadata.yaml`
2. Optionally update `.claude-src/schemas/metadata.schema.json` to add the new category to the local `category` enum (if not already present)

Currently, `new skill` sets `custom: true` in metadata but does not generate or update any local JSON schema files.

### Codebase Audit Notes

**`allOf` + `$ref` enum widening: DOES NOT WORK.** `allOf` is intersection (AND). If the base schema has `category: { enum: [38 values] }` and the extension adds `category: { enum: [2 custom values] }`, the intersection is empty -- no value satisfies both constraints. The `unevaluatedProperties` upgrade solved the **property addition** problem (adding `custom` without rejection) but does NOT solve enum widening.

**`$dynamicRef`/`$dynamicAnchor`: NOT SUPPORTED by tooling.** yaml-language-server (AJV-based) restricts `$dynamicAnchor` to schema roots only. VS Code JSON service explicitly does not support `$dynamicRef`. Not viable for per-property extension points.

**Planned solution: base schema splitting.** Split each base schema into a structure variant (no enums on extensible fields) and a full variant (strict enums via `allOf` + structure ref). Extension schemas reference the structure variant, avoiding the intersection problem entirely. See "Planned Solution: Base Schema Splitting" above.

**Base schemas upgraded to draft 2020-12.** The base schemas now use JSON Schema draft 2020-12 with `unevaluatedProperties: false` instead of `additionalProperties: false`. The `unevaluatedProperties` keyword ([spec](https://json-schema.org/draft/2020-12/json-schema-core#section-11.3)) sees across `allOf` boundaries, allowing property addition. yaml-language-server supports this as of February 2026 ([issue #478](https://github.com/redhat-developer/yaml-language-server/issues/478)).

Note: Adding `custom` to the base schema (done in Phase 1) remains useful as a convenience -- the base schema documents `custom` as a known optional property. But this alone does not enable enum widening for categories/domains in IDE schemas.

**Existing schema directory:** The CLI already ships 12 JSON schemas in `src/schemas/`:

- `metadata.schema.json`, `agent.schema.json`, `skill-frontmatter.schema.json`, `agent-frontmatter.schema.json`
- `skills-matrix.schema.json`, `stacks.schema.json`, `stack.schema.json`
- `project-config.schema.json`, `project-source-config.schema.json`
- `marketplace.schema.json`, `plugin.schema.json`, `hooks.schema.json`

**Schema location:** The doc proposes `.claude-src/schemas/` for user schemas. The `CLAUDE_SRC_DIR` constant exists (`consts.ts:16`) as `".claude-src"`, confirming this is the established convention for source-level config.

**Local schemas for IDE autocomplete:** Local JSON schemas in `.claude-src/schemas/` are useful for IDE autocomplete but independent of the runtime merge + auto-discovery pipeline.

---

## Runtime Validation Behavior

### Current Validation Architecture

The CLI has two validation tiers:

| Tier       | Schema                                                         | Purpose                  | Strictness                                                       |
| ---------- | -------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| Loader     | `skillMetadataLoaderSchema`, `skillFrontmatterLoaderSchema`    | Parse YAML/JSON safely   | Lenient: `.passthrough()`, optional fields, `z.string()` for IDs |
| Validation | `metadataValidationSchema`, `skillFrontmatterValidationSchema` | IDE/`agentsinc validate` | Strict: `.strict()`, enum constraints, format patterns           |

### Proposed Behavior for Custom Entities

#### Detection

When the CLI loads an entity, it checks for the `custom` property:

```typescript
// Pseudocode for the detection flow
const rawMetadata = parseYaml(content);
const isCustom = rawMetadata.custom === true;
```

The check happens at the YAML parse boundary, before schema validation.

#### What Changes

| Check                  | Built-in Entity                                 | Custom Entity (`custom: true`)                                                                   |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Skill ID format        | Must match `SKILL_ID_PATTERN` (7 prefixes)      | Must match `CUSTOM_SKILL_ID_PATTERN` (any kebab-case string)                                     |
| Agent name             | Must be in `AgentName` union                    | Must be kebab-case, no other constraint                                                          |
| Category               | Must be in `Subcategory` union                  | Validated by extended schema (see [Skills Matrix Merge Strategy](#skills-matrix-merge-strategy)) |
| Domain                 | Must be in `Domain` union                       | Validated by extended schema (see [Skills Matrix Merge Strategy](#skills-matrix-merge-strategy)) |
| Structural fields      | `description`, `author`, `displayName` required | Same -- structural requirements unchanged                                                        |
| Relationship refs      | Resolved via `displayNameToId` and alias maps   | Same -- references validated post-merge                                                          |
| `additionalProperties` | Strict schemas reject unknown fields            | Same -- `custom` is added to the schema's known properties                                       |

#### What Does NOT Change

1. **Structural validation** -- a custom skill still needs `displayName`, `cliDescription`, `usageGuidance`, `author`, and `category` in its `metadata.yaml`
2. **Post-merge reference checking** -- if a custom skill declares `requires: ["acme-pipeline-setup"]`, the merge step verifies that `acme-pipeline-setup` actually exists in the loaded skill set
3. **Compilation pipeline** -- `buildResolvedSkill()` (`matrix-loader.ts:435-483`) works identically for custom skills; the category determines agent routing, not the ID prefix
4. **Schema validation command** (`agentsinc validate`) -- auto-detects from the entity's `custom: true` to apply relaxed enum checking

#### Integration with Existing Schemas

The lenient loader schemas already do most of the work:

```typescript
// skillFrontmatterLoaderSchema (schemas.ts:283-287) already accepts any string for `name`:
export const skillFrontmatterLoaderSchema = z.object({
  name: z.string(), // <-- already lenient
  description: z.string(),
  model: modelNameSchema.optional(),
});
```

The strict validation schemas need different treatment depending on the entity type:

**Categories and domains: Dynamic schema extension (no `custom: true` needed)**

Categories and domains are declared in the custom `skills-matrix.yaml`. The CLI reads the merged matrix at startup and knows all valid category/domain values before any entity YAML is parsed. The Zod enums are extended at runtime to include custom values:

```typescript
// After merging matrices (see "Skills Matrix Merge Strategy"), extract all valid values
const allCategories = Object.keys(mergedMatrix.categories);
const allDomains = unique(Object.values(mergedMatrix.categories).map((c) => c.domain));

// Extend schemas dynamically -- still strict enums, just wider
const extendedSubcategorySchema = z.enum([...SUBCATEGORY_VALUES, ...customCategories]);
const extendedDomainSchema = z.enum([...DOMAIN_VALUES, ...customDomains]);
```

This eliminates the "simpler approach problem" documented below in the audit notes: Zod never rejects custom categories because they are already in the extended schema by the time any entity YAML is parsed. No factory functions, no two-schema variants, no caller-level skipping needed for categories and domains.

**Initialization timing:** Schema extension happens early in the command lifecycle, after the merged matrix is loaded but before any entity YAML parsing. This could be in a `BaseCommand.init()` hook or an oclif lifecycle hook.

**Skills and agents: `custom: true` with conditional relaxation**

Skill IDs and agent names DO still need `custom: true` because they are per-entity identifiers (not declared in the matrix). For these, add `custom` as an optional known property so `.strict()` does not reject it:

```typescript
// Add custom to schema so .strict() accepts it
export const metadataValidationSchema = z
  .object({
    custom: z.boolean().optional(), // <-- NEW
    category: extendedSubcategorySchema, // <-- uses dynamically extended schema
    // ...
  })
  .strict();

// In the validation command, only skill ID and agent name need conditional checks:
if (parsed.custom === true) {
  // skip skill ID prefix check, use relaxed CUSTOM_SKILL_ID_PATTERN
  // skip agent name enum check, use kebab-case pattern
  // category and domain are already valid via extended schemas
}
```

**Recommendation:** Dynamic schema extension for categories/domains (eliminates the factory function problem entirely). `custom: true` with caller-level conditional checks for skill IDs and agent names only.

### Codebase Audit Notes

**Two-tier architecture verified:**

- Loader tier: `skillMetadataLoaderSchema` (`schemas.ts:290-300`) uses `.passthrough()` and `categoryPathSchema` (accepts any valid-looking category path). `skillFrontmatterLoaderSchema` (`schemas.ts:283-287`) uses `z.string()` for name.
- Validation tier: `metadataValidationSchema` (`schemas.ts:783-826`) uses `.strict()` and `subcategorySchema` (enum). `skillFrontmatterValidationSchema` (`schemas.ts:762-780`) uses `.strict()`.
- The two-tier description is **accurate**.

**The "simpler approach" problem (RESOLVED by dynamic schema extension):** The original concern was that `subcategorySchema` (enum) in the strict schema would reject custom categories during `.safeParse()` before the caller could check `custom`. This is now moot for categories and domains: the dynamic schema extension approach (see "Integration with Existing Schemas" above) extends the Zod enums to include custom values BEFORE any entity parsing happens. The extended schema accepts custom categories natively -- no factory functions, no union switching, no caller-level skipping needed.

**Remaining two-variant need:** The `custom: true` conditional check is still needed for skill IDs (`SKILL_ID_PATTERN` vs `CUSTOM_SKILL_ID_PATTERN`) and agent names (`agentNameSchema` vs kebab-case pattern). For these, the validation flow is:

1. Parse with lenient loader schema (already passes)
2. At the validation command level, check `custom` FIRST
3. If `custom: true`, skip skill ID prefix check and agent name enum check
4. Category and domain are already valid via the extended schemas

**Third loader schema not mentioned:** `matrix-loader.ts:37-51` has its own `rawMetadataSchema` (separate from `skillMetadataLoaderSchema`) used by `extractAllSkills()`. This schema also needs `custom` added, and its `category` field validation (`categoryPathSchema`) already accepts arbitrary prefix paths -- so custom categories work at the loader level today.

**`agentsinc validate` current structure:** The validate command (`commands/validate.ts`) delegates to `schema-validator.ts` which uses the strict schemas. It has two modes: YAML schema validation and plugin validation. The custom entity detection would need to be added to the YAML validation path in `schema-validator.ts`, where each file is parsed and validated against the appropriate strict schema.

---

## Skills Matrix Merge Strategy

### Current Behavior: One Matrix, No Merge

Only ONE skills-matrix YAML is ever loaded. The CLI checks for a source's `config/skills-matrix.yaml` first; if it exists, that file is used. Otherwise, the CLI's built-in matrix at `config/skills-matrix.yaml` is used as a fallback. There is NO matrix-to-matrix merge. Code location: `source-loader.ts:152-188` (`loadAndMergeFromBasePath()`).

```typescript
// Current behavior in loadAndMergeFromBasePath() (source-loader.ts:159-169)
const sourceMatrixPath = path.join(basePath, matrixRelPath);
const cliMatrixPath = path.join(PROJECT_ROOT, SKILLS_MATRIX_PATH);

let matrixPath: string;
if (await fileExists(sourceMatrixPath)) {
  matrixPath = sourceMatrixPath; // Source matrix REPLACES CLI matrix entirely
} else {
  matrixPath = cliMatrixPath; // CLI matrix used as fallback
}
```

### Problem

If a user creates a custom skills-matrix to add custom categories, it currently REPLACES the CLI matrix entirely. The user must duplicate ALL built-in categories they want to use, not just declare their custom ones. This is fragile -- CLI upgrades that add new built-in categories would not be picked up, and users must manually keep their matrix in sync with the CLI's.

### Proposed Solution: Merge Custom Matrix Over Built-In

The user's custom skills-matrix is MERGED with the built-in CLI matrix. User values win on conflicts:

- Custom categories are ADDED to the built-in categories
- If a user overrides a built-in category (e.g., changes `web-framework`'s display name or order), the user's version wins
- All built-in categories NOT overridden are preserved

**Implementation:** Simple record spread `{ ...builtInCategories, ...userCategories }` in `loadAndMergeFromBasePath()` (or a new merge function).

### Order of Operations

```
1. Load CLI built-in matrix (always)
2. Load source matrix (if exists)
3. Merge categories: { ...cliMatrix.categories, ...sourceMatrix.categories }
4. Extract skills from source
5. mergeMatrixWithSkills(mergedMatrix, skills)
6. Extend Zod schemas with custom categories/domains (see "Runtime Validation Behavior")
7. (rest of pipeline unchanged)
```

### Implementation Sketch

```typescript
// Proposed replacement for source-loader.ts:159-176
const cliMatrixPath = path.join(PROJECT_ROOT, SKILLS_MATRIX_PATH);
const cliMatrix = await loadSkillsMatrix(cliMatrixPath);

let mergedCategories = { ...cliMatrix.categories };

const sourceMatrixPath = path.join(basePath, matrixRelPath);
if (await fileExists(sourceMatrixPath)) {
  const sourceMatrix = await loadSkillsMatrix(sourceMatrixPath);
  // Source categories overlay CLI categories -- user values win on conflict
  mergedCategories = { ...cliMatrix.categories, ...sourceMatrix.categories };
  verbose(
    `Matrix merged: CLI (${Object.keys(cliMatrix.categories).length} categories) + source (${Object.keys(sourceMatrix.categories).length} categories)`,
  );
} else {
  verbose(`Matrix from CLI only (source has no matrix): ${cliMatrixPath}`);
}

const matrix = { ...cliMatrix, categories: mergedCategories };
const skills = await extractAllSkills(skillsDir);
const mergedMatrix = await mergeMatrixWithSkills(matrix, skills);
```

### Interaction with Zod Schema Extension

After the merge, the CLI knows all valid categories and domains (both built-in and custom). This is when the dynamic Zod schema extension happens:

```typescript
// Extract custom values that aren't in the built-in enums
const allCategoryIds = Object.keys(mergedCategories);
const customCategories = allCategoryIds.filter((id) => !SUBCATEGORY_VALUES.includes(id));
const allDomains = unique(Object.values(mergedCategories).map((c) => c.domain));
const customDomains = allDomains.filter((d) => !DOMAIN_VALUES.includes(d));

// Extend Zod schemas if custom values exist
if (customCategories.length > 0 || customDomains.length > 0) {
  extendValidationSchemas({ customCategories, customDomains });
}
```

This is the key insight that simplifies the design: categories and domains do NOT need `custom: true` flags or per-entity detection. They are declared in the skills-matrix YAML, and the CLI learns about them at startup via the merge step.

### Codebase Audit Notes

**`loadSkillsMatrix()` schema barrier:** The `skillsMatrixConfigSchema` (`schemas.ts:497-506`) validates category keys with `z.record(subcategorySchema, categoryDefinitionSchema)`, where `subcategorySchema` is a strict enum of 38 values. Loading a source matrix with custom category keys like `acme-pipeline` will fail Zod validation. **Fix:** The source matrix must be loaded with a relaxed schema variant that accepts `z.record(z.string(), categoryDefinitionSchema)` for category keys. Alternatively, `loadSkillsMatrix()` can accept a `relaxed: boolean` parameter to switch schemas.

**No other top-level matrix fields need merging.** The `SkillsMatrixConfig` type has `version: string` and `categories: Record<...>`. Only `categories` needs merging. The `version` field from the CLI matrix is kept (or the higher version if both are present).

---

## Impact by Entity Type

### Skills

**Config location:** `metadata.yaml`

```yaml
custom: true
category: acme-pipeline
author: "@acme"
displayName: Deploy Pipeline
cliDescription: Kubernetes deployment automation
usageGuidance: Use when deploying services to staging or production.
tags:
  - deployment
  - kubernetes
```

**Validation changes:**

- `SKILL_ID_PATTERN` check skipped when `custom: true`; `CUSTOM_SKILL_ID_PATTERN` (any kebab-case string) used instead
- `category` field accepts any kebab-case string, not just built-in `Subcategory` values
- All structural fields still required

**Wizard UI changes:**

The wizard rendering pipeline is 100% metadata-driven. Skill IDs are never parsed for routing. Custom skills render alongside built-in ones with zero special handling needed:

- The wizard determines domain tabs via `CategoryDefinition.domain`, not skill IDs
- Categories are filtered by `matrix.categories` where `cat.domain === domain` (`build-step-logic.ts:127`)
- Skills appear via `getAvailableSkills(cat.id, ...)` which matches on `metadata.yaml`'s `category` field
- A custom skill with `category: web-framework` appears next to React and Vue with no special handling
- Custom skills in custom categories (e.g., `category: acme-pipeline`) appear in the custom domain tab under their category
- The only prerequisite is that the custom category is loaded into `matrix.categories` (via the skills-matrix merge) and has a `domain` property
- Optional: custom skills could be prefixed with a visual indicator (e.g., "C" badge) in the display label for clarity, but this is purely cosmetic

**Compilation pipeline changes:**

- None. `buildResolvedSkill()` (`matrix-loader.ts:435-483`) uses `category` for routing, which works with any string value
- After D-43, when no stack is selected, all skills are assigned to all selected agents. Stacks provide fine-grained skill-to-agent mapping. Custom skills are included alongside all other skills with no special handling needed

### Skill ID Auto-Discovery

Skill IDs can be auto-discovered from the source's `src/skills/` directory via `extractAllSkills()` (`matrix-loader.ts:91-155`). This function already scans all `metadata.yaml` files and parses the canonical skill ID from each skill's `SKILL.md` frontmatter.

The `skillIdSchema` can be extended to accept either a match against `SKILL_ID_PATTERN` OR any ID found in the source's skills:

```typescript
// After extractAllSkills(), extend skillIdSchema
const sourceSkillIds = skills.map((s) => s.id);
const customSkillIds = sourceSkillIds.filter((id) => !SKILL_ID_PATTERN.test(id));
if (customSkillIds.length > 0) {
  // Accept built-in pattern OR any discovered custom ID
  extendedSkillIdSchema = z.union([
    z.string().regex(SKILL_ID_PATTERN),
    z.enum(customSkillIds as [string, ...string[]]),
  ]);
}
```

The `custom: true` flag on skills is NOT needed for Zod schema extension -- it is only checked in two places:

1. **`agentsinc validate`** -- to decide whether to apply strict built-in naming conventions (centralized in `schema-validator.ts`)
2. **UI/UX** -- to show a visual indicator in the wizard (optional badge/label)

### Codebase Audit Notes (Skills)

**`extractAllSkills()` (`matrix-loader.ts:91-155`) requires changes.** The function uses a local `rawMetadataSchema` (`matrix-loader.ts:37-51`) that includes `categoryPathSchema` for the `category` field. The `categoryPathSchema` (`schemas.ts:238-247`) already accepts any prefix matching `^(web|api|cli|mobile|infra|meta|security|shared)-.+$` OR bare `Subcategory` values OR `"local"`. A custom category like `acme-pipeline` would NOT match any of these -- it would be rejected by `categoryPathSchema`. **This is a critical gap:** the loader-level schema already blocks custom categories. The fix: when `custom: true` is detected at the raw YAML level, use a relaxed `categoryPathSchema` variant (or just `z.string()` for category).

**`buildResolvedSkill()` path resolution:** For custom skills, `skill.path` is set to `skills/${directoryPath}/` at `matrix-loader.ts:147`. After D-43, when no stack is selected, all skills are assigned to all selected agents. Stacks provide fine-grained skill-to-agent mapping. A custom skill will be included alongside all other skills and assigned to whatever agents the user selects (or the stack specifies).

### Agents

**Config location:** `agent.yaml`

```yaml
custom: true
id: acme-deployer
title: Acme Deployer
description: Handles Kubernetes deployments and rollbacks
tools:
  - Bash
  - Read
  - Write
model: opus
```

**Validation changes:**

- `id` field: `agentNameSchema` (enum check) skipped when `custom: true`; kebab-case check used instead
- All structural fields still required (`title`, `description`, `tools`)

**Wizard UI changes:**

- Custom agents appear in the Agents step alongside built-in agents
- `preselectAgentsFromDomains()` only preselects from `DOMAIN_AGENTS` (built-in); custom agents must be manually selected

**Compilation pipeline changes:**

- The compiler resolves agents by name from the `agents/` directory. Custom agents work as long as their directory structure matches the expected layout (`{agent-name}/agent.yaml`, template files, etc.)
- Stack configs can reference custom agent names in the outer record (e.g., `stack["acme-deployer"]`) since `projectConfigLoaderSchema.stack` (`schemas.ts:404`) uses `z.record(z.string(), stackAgentConfigSchema)` for agent keys

### Agent Name Auto-Discovery

Agent names can be auto-discovered from the source's `agents/` directory by scanning `agent.yaml` files for their `id` field. This is the same pattern used for skill auto-discovery via `extractAllSkills()` in `matrix-loader.ts`. The existing `loadAllAgents()` function (`loading/loader.ts:29-57`) already scans `**/agent.yaml` files and parses their `id` fields.

The `agentNameSchema` can be extended dynamically at runtime -- the same approach used for `subcategorySchema` and `domainSchema`. After scanning the source's agents directory, any agent IDs not in the built-in `AgentName` union are added to the extended schema:

```typescript
// After loading agents from source, extend agentNameSchema
const sourceAgentIds = Object.keys(await loadAllAgents(sourcePath));
const customAgentIds = sourceAgentIds.filter((id) => !AGENT_NAME_VALUES.includes(id));
if (customAgentIds.length > 0) {
  extendedAgentNameSchema = z.enum([...AGENT_NAME_VALUES, ...customAgentIds]);
}
```

The `custom: true` flag on agents is NOT needed for Zod schema extension -- it is only checked in two places:

1. **`agentsinc validate`** -- to decide whether to apply strict built-in naming conventions
2. **UI/UX** -- to show a visual indicator in the wizard (optional badge/label)

### Codebase Audit Notes (Agents)

**`agentYamlConfigSchema` blocks custom agents at loader level.** The schema (`schemas.ts:334-344`) uses `agentNameSchema` for the `id` field, which is a strict enum of 18 built-in names. Loading a custom agent's `agent.yaml` will fail at the Zod validation step. **Fix:** Extend `agentNameSchema` dynamically at runtime with auto-discovered agent names from the source's `agents/` directory, using the same approach as `subcategorySchema` extension. Alternatively, when `custom: true` is present, use `z.string().regex(KEBAB_CASE_PATTERN)` instead of `agentNameSchema` for the `id` field.

**`agentYamlGenerationSchema` already lenient.** The strict schema for compiled agent output (`schemas.ts:728-741`) uses `z.string().min(1)` for `id` -- already accepts any string. So compilation output of custom agents works without changes.

**Stack config agent key validation:** The outer `stack` record in `projectConfigLoaderSchema` (`schemas.ts:404`) uses `z.record(z.string(), ...)` -- accepts any string for agent keys. **Confirmed: custom agent names work as stack keys.**

**Stack subcategory key validation blocks custom categories.** The inner `stackAgentConfigSchema` (`schemas.ts:360-375`) validates subcategory keys against `stackSubcategoryValues` (a `Set` of 38 built-in subcategory strings). Custom subcategory keys like `acme-pipeline` will trigger a Zod `addIssue()` with "Invalid subcategory". **This is a critical gap.** The fix: extend `stackSubcategoryValues` at runtime with custom category IDs from the merged matrix (same dynamic extension approach as `subcategorySchema`).

### Categories

**Config location:** Source's `skills-matrix.yaml`

Categories are not standalone entities -- they live inside `skills-matrix.yaml`. Custom categories are declared in the source's own `skills-matrix.yaml` and merged with the CLI's built-in matrix at load time (see [Skills Matrix Merge Strategy](#skills-matrix-merge-strategy)).

**Categories do NOT need `custom: true`.** They are declared in the matrix YAML, and the CLI learns about them at startup via the merge step. The user's source matrix only needs to declare the CUSTOM categories -- all built-in categories are inherited from the CLI matrix automatically.

```yaml
# Private marketplace's skills-matrix.yaml
# Only custom categories needed -- built-in categories are inherited from CLI matrix
version: "1.0.0"
categories:
  acme-pipeline:
    id: acme-pipeline
    displayName: CI/CD Pipeline
    description: Deployment pipeline skills
    domain: acme # custom domain
    exclusive: false
    required: false
    order: 1

  acme-ml:
    id: acme-ml
    displayName: ML Tooling
    description: Machine learning workflow skills
    domain: acme
    exclusive: true
    order: 2
```

If the user wants to override a built-in category (e.g., change `web-framework`'s display name), they include it in their matrix and their version wins via the merge.

**Validation changes:**

- No `custom: true` check needed -- the extended Zod schemas already include all categories from the merged matrix
- `CategoryDefinition.domain` accepts custom domain values via the extended `domainSchema`

**Wizard UI changes:**

- `buildCategoriesForDomain()` at `build-step-logic.ts:112-163` already handles this generically
- `Object.values(matrix.categories).filter(cat => cat.domain === domain)` includes any category in the map
- Categories are sorted by `cat.order` -- custom categories just need an `order` value
- No code changes needed in `build-step-logic.ts` for custom categories to render
- `CategoryMap` already uses `Partial<Record<Subcategory, CategoryDefinition>>` -- for custom categories, the key simply does not match the `Subcategory` union, which works with the `Partial` wrapper at runtime (the type constraint is compile-time only)

**Compilation pipeline changes:**

- None needed. The matrix-loader already processes `CategoryMap` entries generically

### Codebase Audit Notes (Categories)

**Schema barrier for source matrix loading.** The `skillsMatrixConfigSchema` (`schemas.ts:497-506`) validates category keys with `z.record(subcategorySchema, categoryDefinitionSchema)`. The `subcategorySchema` is a strict enum of 38 values. Loading a source matrix with custom category keys like `acme-pipeline` will fail Zod validation at `loadSkillsMatrix()` (`matrix-loader.ts:60-73`). **Fix:** When loading the source matrix (as opposed to the CLI matrix), use a relaxed schema variant with `z.record(z.string(), categoryDefinitionSchema)` for category keys. The CLI matrix can continue using the strict schema since it only contains built-in categories.

**`CategoryDefinition.id` is typed as `Subcategory`.** The type (`types/matrix.ts:80`) constrains `id: Subcategory`. The `categoryDefinitionSchema` (`schemas.ts:447-456`) validates `id` with `subcategorySchema`. The relaxed source matrix schema should use `z.string()` for the `id` field. At runtime, custom category IDs are cast to `Subcategory` at the merge boundary (same pattern as Q3 recommendation for skill IDs).

**Categories and domains are declared in the source's `skills-matrix.yaml`** (the authoritative declaration via the merge strategy). Agent names and skill IDs are auto-discovered from the source's directory structure.

### Domains

**Config location:** Derived from `CategoryDefinition.domain` in the merged skills-matrix

Domains are not a first-class config entity -- they're derived from the `domain` field in `CategoryDefinition`. Custom domains emerge naturally when a custom category in the source's `skills-matrix.yaml` declares a `domain` value outside the built-in `Domain` union (e.g., `domain: acme`).

**Domains do NOT need `custom: true`.** Like categories, they are known at startup via the matrix merge. The Zod `domainSchema` is extended dynamically to include custom domain values extracted from the merged matrix.

**Validation changes:**

- `domainSchema` is extended at runtime to include custom domains (see [Skills Matrix Merge Strategy](#skills-matrix-merge-strategy))
- The wizard store's `ALL_DOMAINS` constant (`wizard-store.ts:21`) and `DOMAIN_AGENTS` mapping (`wizard-store.ts:24-37`) would need to be dynamically computed from the loaded matrix rather than hardcoded

**Wizard UI changes:**

- Custom domains appear as additional tabs in the Build step
- Custom domains have no built-in agent preselection (no entries in `DOMAIN_AGENTS`) -- the user selects agents manually

**Compilation pipeline changes:**

- None. Domains are a wizard concept, not a compilation concept

### Codebase Audit Notes (Domains)

**`DomainSelections` type constraint.** The type (`types/matrix.ts:76`) is `Partial<Record<Domain, Partial<Record<Subcategory, SkillId[]>>>>`. Both `Domain` and `Subcategory` are compile-time-only constraints -- at runtime, JavaScript treats all string keys equally. The Partial wrapper means missing keys are fine. So custom domains/subcategories work at runtime BUT TypeScript will flag type errors at compile time. This aligns with the Q3 recommendation (boundary casts).

**`toggleDomain` and `toggleTechnology` type signatures.** These wizard store actions (`wizard-store.ts:243, 258-263`) accept `Domain` and `Subcategory` typed parameters. Callers would need boundary casts when passing custom values. The wizard components that call these would need to cast custom domain/subcategory strings at the data boundary.

**`ProjectConfig.domains` field.** The `domains` field on `ProjectConfig` (`types/config.ts:100`) is typed `Domain[]`. The `projectConfigLoaderSchema` (`schemas.ts:400`) uses `z.array(domainSchema)`. Custom domains stored in the config would fail Zod validation. This needs relaxation in the loader schema when custom definitions are present.

---

## Implementation Phases

### Phase 1: Foundation (`custom` property + relaxed validation)

1. Add `custom?: boolean` to TypeScript types:
   - `SkillMetadataConfig` (`types/skills.ts:195-210`) -- note: this type only has `category`, `categoryExclusive`, `author`, `tags`, `requires`, `compatibleWith`, `conflictsWith`. It does NOT have `displayName`, `cliDescription`, or `usageGuidance`. The broader metadata type with those fields is in `rawMetadataSchema` (`matrix-loader.ts:37-51`) and `metadataValidationSchema` (`schemas.ts:783-826`).
   - `AgentYamlConfig` (`types/agents.ts:83-85`)
   - `CategoryDefinition` (`types/matrix.ts:79-92`)
   - `ExtractedSkillMetadata` (`types/matrix.ts:379-410`) -- needs `custom?: boolean` to carry the flag through the pipeline
2. Add `custom` to Zod schemas:
   - Loader schemas: `skillMetadataLoaderSchema` (`schemas.ts:290-300`), `localRawMetadataSchema` (`schemas.ts:512-536`), `rawMetadataSchema` (`matrix-loader.ts:37-51`), `agentYamlConfigSchema` (`schemas.ts:334-344`)
   - Validation schemas: `metadataValidationSchema` (`schemas.ts:783-826`), `agentFrontmatterValidationSchema` (`schemas.ts:744-759`), `categoryDefinitionSchema` (`schemas.ts:447-456`)
   - JSON schemas: `metadata.schema.json`, `agent.schema.json`, `skills-matrix.schema.json`
3. Create `CUSTOM_SKILL_ID_PATTERN` (any kebab-case string: `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`) in `schemas.ts` and conditional validation logic:
   - Add a helper `isCustomEntity(raw: unknown): boolean` that checks `rawMetadata.custom === true`
   - In `source-switcher.ts:validateSkillId()`: check custom flag before applying `SKILL_ID_PATTERN`
   - In `stacks-loader.ts:resolveAgentConfigToSkills()`: check custom flag before applying `SKILL_ID_PATTERN`
4. Update `extractAllSkills()` (`matrix-loader.ts:91-155`) to:
   - Read `custom` from raw metadata before Zod parse
   - When true, use a relaxed `rawMetadataSchema` variant (accepts any kebab-case category)
   - Pass `custom` through to `ExtractedSkillMetadata`
5. Update `agentsinc validate` (`commands/validate.ts` -> `schema-validator.ts`) to:
   - Detect `custom: true` in each file before applying strict schema
   - Use relaxed validation variant for custom entities

**Phase 1 Progress (2026-02-22): COMPLETE**

- Added `custom?: boolean` to `CategoryDefinition`, `ExtractedSkillMetadata` (types/matrix.ts), `AgentYamlConfig` (types/agents.ts), `SkillMetadataConfig` (types/skills.ts)
- Added `custom: z.boolean().optional()` to all loader and validation Zod schemas: `skillMetadataLoaderSchema`, `localRawMetadataSchema`, `rawMetadataSchema` (matrix-loader.ts), `agentYamlConfigSchema`, `metadataValidationSchema`, `categoryDefinitionSchema`, `agentYamlGenerationSchema`
- Added `custom` boolean property to JSON schemas: `metadata.schema.json`, `agent.schema.json`
- Created `CUSTOM_SKILL_ID_PATTERN` (`/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`) in `schemas.ts`
- Updated `extractAllSkills()` to pass `custom` through to `ExtractedSkillMetadata`
- Updated `source-switcher.ts:validateSkillId()` and `stacks-loader.ts:resolveAgentConfigToSkills()` to accept `CUSTOM_SKILL_ID_PATTERN` alongside `SKILL_ID_PATTERN`
- Note: `isCustomEntity()` helper was NOT needed -- the dynamic schema extension approach (Phase 3) handles validation without per-entity `custom` checks at parse boundaries
- Note: `agentsinc validate` changes deferred -- requires Phase 3 schema extension to be meaningful
- 35 new tests added to `schemas.test.ts` covering patterns, custom property parsing, relaxed schemas, and dynamic extension
- 2465 tests passing, 0 type errors

### Phase 2: Matrix merge + auto-discovery

1. Update `loadAndMergeFromBasePath()` (`source-loader.ts:152-188`) to merge source matrix with CLI matrix:
   - Always load CLI built-in matrix first
   - If source matrix exists, merge categories: `{ ...cliMatrix.categories, ...sourceMatrix.categories }`
   - Load source matrix with a relaxed schema variant (`z.record(z.string(), categoryDefinitionSchema)`)
2. Add agent name auto-discovery:
   - Scan source's `agents/` directory for `agent.yaml` files
   - Extract `id` fields and extend `agentNameSchema` dynamically
3. Add skill ID auto-discovery:
   - Use existing `extractAllSkills()` output to discover custom skill IDs
   - Extend `skillIdSchema` dynamically with discovered IDs
4. Extend Zod schemas dynamically after merge + discovery:
   - `subcategorySchema` extended with custom category IDs
   - `domainSchema` extended with custom domains from category definitions
   - `agentNameSchema` extended with discovered agent names
   - `stackSubcategoryValues` Set extended with custom category IDs
5. Update `new skill` (`commands/new/skill.ts`) and `new agent` (`commands/new/agent.tsx`) to auto-detect marketplace context and set `custom: true`
6. Relax `stackAgentConfigSchema` (`schemas.ts:360-375`) subcategory key validation to accept custom subcategory keys from the merged matrix

**Phase 2 Progress (2026-02-22): COMPLETE (steps 1, 2, 3, 4, 6 done; step 5 deferred)**

- **Step 1 (matrix merge):** Created `relaxedCategoryDefinitionSchema` and `relaxedSkillsMatrixConfigSchema` in `schemas.ts` for loading source matrices with custom category keys and domains. Added `loadSkillsMatrixRelaxed()` in `matrix-loader.ts`. Rewrote `loadAndMergeFromBasePath()` in `source-loader.ts` from either/or to always-merge. Relationships merged by concatenating arrays; skill aliases merged with source winning on conflict.
- **Step 2 (agent auto-discovery):** Added `discoverAndExtendFromSource()` in `source-loader.ts` that pre-scans `agents/` directory for `agent.yaml` files, extracts `id` fields, and calls `extendSchemasWithCustomValues({ agentNames })`. Lightweight YAML parse avoids the chicken-and-egg problem (need extended schemas to load agents, but need to load agents to discover custom names).
- **Step 3 (skill ID auto-discovery):** Same `discoverAndExtendFromSource()` function pre-scans `skills/` directory for `SKILL.md` frontmatter, extracts skill IDs that don't match `SKILL_ID_PATTERN`, and calls `extendSchemasWithCustomValues({ skillIds })`.
- **Step 4 (dynamic Zod extension):** Created `customExtensions` object with runtime-extensible Sets in `schemas.ts`. Added `extendSchemasWithCustomValues()` and `resetSchemaExtensions()`. Updated `categoryPathSchema`, `stackAgentConfigSchema`, `agentYamlConfigSchema`, `skillAssignmentSchema`, `metadataValidationSchema`, and `projectConfigLoaderSchema` (skills + domains fields) to check custom extensions via `refine()` validators. Added `extendSchemasFromMatrix()` in `source-loader.ts` that extracts custom categories/domains from the merged matrix and extends schemas before entity loading.
- **Step 5 (update `new skill`/`new agent`):** Deferred to Phase 4 -- `new skill` now always sets `custom: true` (Phase 4 progress notes). `new agent` deferred pending agent creation UX redesign.
- **Step 6 (relax stackAgentConfigSchema):** `stackAgentConfigSchema.superRefine()` now accepts keys from `customExtensions.categories` alongside built-in subcategories.
- 2465 tests passing, 0 type errors

**Phase 2 Review Fixes (2026-02-22):**

- **Issue #1:** Replaced hardcoded `BUILTIN_SUBCATEGORIES` Set in `extendSchemasFromMatrix()` with `stackSubcategorySchema.options` (single source of truth from schemas.ts). Added exported `DOMAIN_VALUES` const in schemas.ts and used it for `BUILTIN_DOMAINS` Set. Eliminates silent drift if subcategories or domains are added/removed.
- **Issue #2:** Replaced `Object.keys()`/`Object.values()` with `typedKeys()`/`typedEntries()` from `utils/typed-object.ts` in `source-loader.ts` (codebase convention).
- **Issue #3:** Filtered built-in agent names in `discoverAndExtendFromSource()` by checking against `agentNameSchema.safeParse()` before pushing to `customAgentNames`. Previously pushed ALL agent names including built-in ones like `"web-developer"`.

### Phase 3: Wizard support

The rendering pipeline (`buildCategoriesForDomain()`, category grid, skill rendering, selection logic) already works generically on whatever is in the matrix -- no changes needed there. The real work is in the store initialization and domain tab generation:

1. Make `ALL_DOMAINS` (`wizard-store.ts:21`) and `DOMAIN_AGENTS` (`wizard-store.ts:24-37`) dynamic:
   - Compute from loaded matrix at wizard init time
   - Custom domains have empty agent lists in `DOMAIN_AGENTS`
2. Surface custom agents in the Agents step alongside built-in agents
3. Relax type signatures where needed:
   - `toggleDomain()` and related functions may need to accept `string` at boundary
   - `DomainSelections` may need a more permissive type for runtime custom values
   - `ProjectConfig.domains` loader schema needs to accept custom domain strings

**Phase 3 Progress (2026-02-22): COMPLETE**

- **Type widening:** Added `(string & {})` to `Domain` (types/matrix.ts), `Subcategory` (types/matrix.ts), and `AgentName` (types/agents.ts) to accept custom values while preserving IDE autocomplete for built-in values.
- **Domain selection (Issue #1):** Replaced hardcoded `AVAILABLE_DOMAINS` in `domain-selection.tsx` with matrix-derived domains. Component now receives `matrix` prop, uses `useMemo` to extract unique domains from `matrix.categories`, preserves built-in order (web, api, cli, mobile) then appends custom domains.
- **Display names (Issue #2):** Changed `getDomainDisplayName()` in `utils.ts` from `Record<Domain, string>` (crashes on custom) to `Record<string, string>` with fallback: `domain.charAt(0).toUpperCase() + domain.slice(1)`. Parameter widened from `Domain` to `string`.
- **Store domains (Issue #3):** Replaced hardcoded `ALL_DOMAINS` constant in `wizard-store.ts` with `getAllDomainsFromCategories()` helper. Both `populateFromStack` and `populateFromSkillIds` now derive domains from the categories parameter, appending custom domains after built-in order.
- **Agent preselection (Issue #4):** Changed `DOMAIN_AGENTS` from `Record<Domain, AgentName[]>` to `Partial<Record<string, AgentName[]>>`. Removed empty `mobile: []` and `shared: []` entries. Custom domains gracefully return no preselected agents via existing `if (domainAgents)` guard.
- **Agent display (Issue #5):** Refactored `StepAgents` in `step-agents.tsx` from static module-level constants to dynamic computation. Component now accepts optional `matrix` prop. `buildAgentGroups()` extracts custom agents from `matrix.suggestedStacks` and groups them by domain prefix. `agentIdToLabel()` converts kebab-case IDs to title-case labels. All groups, flat rows, and focusable IDs are computed via `useMemo`.
- **Cascading fixes:** Added `CategoryDefinition` type guard in `build-step-logic.ts:127` to handle `undefined` values from widened `Partial<Record<Subcategory, ...>>`. Added null guard in `stacks-loader.ts:153` for `mapValues` over widened `Partial<Record<AgentName, ...>>`. Updated boundary cast in `compilation-pipeline.test.ts` to use `as unknown as`.
- **Test updates:** Updated `step-stack.test.tsx` mock matrix to set proper `domain` values on all categories (was previously relying on hardcoded domain list masking incorrect test data). Added `cli-framework` and `mobile-framework` categories to mock.
- 2465 tests passing, 0 type errors

### Phase 4: Schema scaffolding + marketplace tooling

1. Add `agentsinc new marketplace` command (or extend existing setup)
2. Scaffold `.claude-src/schemas/` with `$ref` to pinned CLI version
3. Scaffold source `skills-matrix.yaml` with example custom categories
4. Auto-update local schema enums on `new skill` / `new agent`

**Phase 4 Progress (2026-02-23): PARTIAL (steps 1, 3, 4 done; step 2 fully deferred)**

- **Step 1 (`agentsinc new marketplace`):** Created `commands/new/marketplace.ts` extending BaseCommand. Scaffolds a complete private marketplace directory with `src/skills/`, `src/agents/`, `src/stacks/`, `config/skills-matrix.yaml`, and `README.md`. Supports `--force`, `--dry-run`, and `--output` flags. Validates marketplace name is kebab-case. Example `skills-matrix.yaml` includes custom domain and two example categories with inline documentation. 28 tests added.
- **Step 2 (scaffold local JSON schemas): FULLY DEFERRED.** Schema scaffolding is deferred pending the base schema splitting approach. Research confirmed that `allOf` + `$ref` CANNOT widen enums (intersection semantics produce an empty set). `$dynamicRef`/`$dynamicAnchor` is not supported by yaml-language-server or VS Code JSON service. The planned solution is to split each base schema into a **structure schema** (no enums on extensible fields) and a **full schema** (strict enums referencing the structure schema). Extension schemas would `allOf` + `$ref` the structure variant. See [Local Schema Design](#local-schema-design) for details. For now: `yamlSchemaComment()` calls removed from `new marketplace` and `new skill`. No local schema files are generated. No `$schema` comments in scaffolded YAML files. Runtime validation via Zod (with dynamic schema extension from Phases 1-2) handles all custom value validation.
- **Step 3 (scaffold skills-matrix.yaml):** Done as part of step 1. The `generateSkillsMatrixYaml()` function creates a fully commented example matrix with custom domain, two categories, empty relationships, and empty skill aliases.
- **Step 4 (auto-update schema enums):** Investigation complete -- **no explicit update needed.** The `discoverAndExtendFromSource()` function (Phase 2) already auto-discovers custom skill IDs and agent names from the source's directory structure at every load cycle. When `new skill` creates a skill file, the next `compile`/`edit`/`validate` invocation automatically discovers it via the SKILL.md frontmatter scan. Same for `new agent` with agent.yaml scanning.

**Phase 2 Step 5 (`new skill` custom: true): COMPLETE (2026-02-22)**

- Updated `generateMetadataYaml()` in `commands/new/skill.ts` to always include `custom: true` in generated metadata.yaml. This is unconditional (not dependent on marketplace context detection) since every skill created via `new skill` is user-created content. The `custom: true` flag marks it for relaxed validation (e.g., custom skill IDs bypass `SKILL_ID_PATTERN` prefix check).
- 2 new tests added to `skill.test.ts` verifying `custom: true` presence and ordering.

### Codebase Audit Notes (Phases)

**Phase ordering is correct.** Phase 1 (foundation) has no dependencies. Phase 2 (matrix merge + auto-discovery) depends on Phase 1 for the `custom` property. Phase 3 (wizard) depends on Phase 2 for custom domain/category data. Phase 4 (scaffolding) is independent but benefits from Phase 1-3 being complete.

**Missing from Phase 1:** The `projectConfigLoaderSchema` (`schemas.ts:382-412`) uses `domainSchema` for `domains` and `skillIdSchema` for `skills`. Custom skills and domains stored in `.claude/config.yaml` will fail loading. This must be relaxed in Phase 1, not deferred.

**Phase 2 simplified by D-43:** The removal of `getAgentsForSkill()` and `agent-mappings.yaml` eliminates the need for custom `skillToAgents` mappings. All skills are now assigned to all selected agents (or mapped explicitly via stacks).

**Lower-risk reordering possible:** Phase 2 step 5 (update `new skill`/`new agent`) could be done in Phase 1 since the commands already exist and the change is small (add `custom: true` to generated YAML when marketplace detected).

---

## Skill & Agent Creation UX

The `agentsinc new skill` and `agentsinc new agent` commands have fundamentally different interaction models. This is intentional -- the nature of the entity dictates the UX.

### Skills: Interactive Free-Text with Codebase Alignment

`agentsinc new skill` is always interactive. There is no `--interactive` flag because there is no non-interactive path -- free-text input is the only way to describe what a skill should teach.

**Flow:**

1. **"What should this skill teach?"** -- free-text prompt (e.g., "CVA with design tokens", "Kubernetes rollback strategies", "Zod schema validation patterns")
2. **"Align to codebase?"** -- boolean toggle, defaults to `true`

**Two-pass generation:**

| Pass      | Input                            | Output                                                                |
| --------- | -------------------------------- | --------------------------------------------------------------------- |
| Generic   | Topic description                | Best-practices skill from training knowledge (comprehensive coverage) |
| Alignment | Generic skill + project codebase | Rewritten skill matching the project's real conventions               |

The generic pass ensures comprehensive coverage -- it captures patterns the codebase might not demonstrate (error handling edge cases, lesser-used APIs, configuration options). The alignment pass ensures the skill reflects how THIS project actually uses the technology: real file structure, naming conventions, import patterns, preferred libraries.

If the user declines alignment, only the generic pass runs.

**Output:** `SKILL.md` + `metadata.yaml` in `.claude/skills/{skill-name}/`

**Marketplace context:** When running inside a private marketplace (detected via `config.yaml` having a `marketplace` field or the presence of `marketplace.json`), the CLI sets `custom: true` automatically in the generated `metadata.yaml`. The user does not need to know about this property.

### Agents: Guided Domain + Role Picker

`agentsinc new agent` uses a guided wizard with structured selection, not free-text input.

**Flow:**

1. **"Which domain?"** -- select from available domains (`web`, `api`, `cli`, `mobile`, `shared`, plus any custom domains from the merged skills matrix)
2. **"What kind of agent?"** -- select from role archetypes (`developer`, `tester`, `reviewer`, `researcher`, `architect`, etc. -- drawn from the `AgentName` union, plus custom agent roles)

There is no "align to project" toggle. The domain + role combination fully defines the agent's responsibilities, tools, and behavior. There is nothing ambiguous left to align -- an `api-developer` is an `api-developer` regardless of which project it lives in.

**Output:** `agent.yaml` + template files in `agents/{agent-name}/`

**Marketplace context:** Same as skills -- `custom: true` set automatically when running inside a marketplace context.

### Why the Asymmetry

| Aspect         | Skills                                                      | Agents                                                  |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| Nature         | Knowledge -- infinite variety of topics and conventions     | Roles -- finite set of well-established archetypes      |
| Input space    | Unbounded (any technology, pattern, or practice)            | Bounded (domain x role matrix)                          |
| Ambiguity      | High -- "CVA" could mean many things in different codebases | Low -- "api-tester" means the same thing everywhere     |
| Alignment      | Valuable -- project conventions vary widely                 | Unnecessary -- role definition is project-independent   |
| UX implication | Free-text is the only way to capture intent                 | Guided selection prevents overlap and ensures coherence |

Skills are knowledge. Free-form description is the only way to capture what the user wants to teach. Agents are roles. A guided picker prevents users from creating overlapping agents or agents that don't fit the established role taxonomy.

### Flow Comparison

```
agentsinc new skill                    agentsinc new agent
====================                   ===================

+----------------------------------+   +----------------------------------+
| What should this skill teach?    |   | Which domain?                    |
|                                  |   |                                  |
| > CVA with design tokens_        |   |   web                            |
|   (free text)                    |   | > api                            |
+----------------------------------+   |   cli                            |
              |                        |   mobile                         |
              v                        |   shared                         |
+----------------------------------+   |   acme (custom)                  |
| Align to codebase?               |   +----------------------------------+
|                                  |                 |
| > Yes / No                       |                 v
+----------------------------------+   +----------------------------------+
              |                        | What kind of agent?              |
              v                        |                                  |
+----------------------------------+   | > developer                      |
| [1/2] Generating skill...        |   |   tester                         |
|       (generic best practices)   |   |   reviewer                       |
+----------------------------------+   |   researcher                     |
              |                        |   architect                      |
              v                        +----------------------------------+
+----------------------------------+                 |
| [2/2] Aligning to codebase...    |                 v
|       (scanning project files)   |   +----------------------------------+
+----------------------------------+   | Generating agent...              |
              |                        |   (domain + role -> definition)  |
              v                        +----------------------------------+
+----------------------------------+                 |
| Created:                         |                 v
|   .claude/skills/cva-design-     |   +----------------------------------+
|     tokens/SKILL.md              |   | Created:                         |
|   .claude/skills/cva-design-     |   |   agents/api-tester/             |
|     tokens/metadata.yaml         |   |     agent.yaml                   |
+----------------------------------+   +----------------------------------+
```

### Codebase Audit Notes (Creation UX)

**Current `new skill` implementation (`commands/new/skill.ts`) is very different from the proposed flow.** The current command:

- Takes a `name` argument (required, positional): `agentsinc new skill <name>`
- Accepts `--author`, `--category`, `--force` flags
- Is NOT interactive -- no free-text prompt, no "align to codebase" toggle
- Generates a static scaffold (`generateSkillMd()`, `generateMetadataYaml()`) with placeholder content
- Does NOT invoke Claude or any AI generation
- Output goes to `.claude/skills/{name}/` (via `LOCAL_SKILLS_PATH` constant)

The proposed interactive free-text + two-pass generation flow would be a **complete rewrite** of the command. It would require:

1. Removing the required `name` arg (the name would be derived from the topic)
2. Adding a free-text prompt step (Ink `TextInput` or `@clack/prompts`)
3. Adding an "align to codebase" boolean toggle
4. Integrating Claude CLI invocation for AI-generated content (similar to how `new agent` uses `agent-summoner`)
5. A two-pass pipeline (generic then alignment) with spinner feedback

**Current `new agent` implementation (`commands/new/agent.tsx`) is also different from the proposed flow.** The current command:

- Takes a `name` argument (required, positional): `agentsinc new agent <name>`
- Has an interactive `PurposeInput` component (free-text "What should this agent do?") -- the opposite of what the doc proposes
- Uses `agent-summoner` meta-agent via Claude CLI to generate the agent
- Accepts `--purpose` flag for non-interactive use
- Does NOT have domain/role selection -- it's pure free-text like the current (not proposed) skill flow

The proposed domain + role picker would also be a **significant rewrite**:

1. Replace `PurposeInput` with a domain selector (list of domains from `ALL_DOMAINS` + custom)
2. Add a role archetype selector (derived from `AgentName` role suffixes)
3. The agent name would be computed from domain + role (e.g., `acme-deployer`)
4. The `agent-summoner` invocation would use the structured domain+role instead of free-text purpose

**Feasibility:** Both rewrites are feasible given the existing command infrastructure (oclif commands, Ink rendering, Claude CLI spawning). The `new agent` command already demonstrates the Claude CLI invocation pattern. The main new work is the interactive selection UI and the two-pass generation pipeline.

**Marketplace detection specifics:** The doc says detection uses "config.yaml having a `marketplace` field or the presence of `marketplace.json`". In code:

- `ProjectConfig.marketplace` (`types/config.ts:87`) is an optional string field loaded by `projectConfigLoaderSchema`
- `marketplace.json` is detected via `source-loader.ts` and `source-fetcher.ts`
- Checking both is straightforward: read project config and check for `marketplace` field, OR check for `marketplace.json` in the project root

---

## Open Questions

### Q1: How do custom categories interact with relationship rules?

Built-in relationship rules in `skills-matrix.yaml` reference skills by display name or ID. Custom skills can participate in relationships (e.g., a custom skill can `require` a built-in skill). But can a custom skill appear in the built-in matrix's `conflicts` or `recommends` rules?

**Lean:** No. The built-in matrix should not reference custom skills. Custom relationship rules should live in the marketplace's own `skills-matrix.yaml` overlay (the source's matrix can define its own `relationships` section).

### Q2: ~~Should custom agents get automatic `skillToAgents` mappings?~~ RESOLVED

~~Currently, `agent-mappings.yaml` maps skill path patterns to agents.~~

**Resolved by D-43:** The `agent-mappings.yaml` and `getAgentsForSkill()` have been removed. After D-43, when no stack is selected, all skills are assigned to all selected agents. Stacks provide fine-grained skill-to-agent mapping. This question is no longer relevant -- custom agents receive all skills by default (same as built-in agents), and stacks override this when explicit mapping is needed.

### Q3: TypeScript type widening strategy

The `SkillId` type is a template literal that constrains prefixes at compile time. For custom skills, we need to accept arbitrary strings at boundaries. Options:

- (a) Widen `SkillId` to `string` everywhere (loses type safety for built-in skills)
- (b) Add a `CustomSkillId` type (`string`) and union it: `SkillId | CustomSkillId`
- (c) Keep `SkillId` strict for internal use; boundary casts accept `string` and validate at runtime

**Lean:** (c). This matches the existing pattern where boundary casts with Zod validation are already used. The `custom: true` flag determines which regex to apply at the boundary. Internal code continues to use `SkillId` -- custom IDs that pass the relaxed regex are cast to `SkillId` at the parse boundary with a comment explaining why.

### Q4: Wizard tab ordering for custom domains

Built-in domains have a fixed order: web, api, cli, mobile, shared. Where do custom domains appear?

**Lean:** After all built-in domains, in the order declared in the source's `skills-matrix.yaml`. The `order` field on custom categories controls intra-domain ordering.

### Codebase Audit Notes (Open Questions)

**Q2 resolved by D-43:** The `getAgentsForSkill()`, `skillToAgents`, `DEFAULT_AGENTS`, and `agent-mappings.yaml` have all been removed. All skills are now assigned to all selected agents. Stacks provide fine-grained skill-to-agent mapping when needed.

**Q3 answer from code:** The codebase already uses this pattern extensively. Examples:

- `normalizeAgentConfig()` in `stacks-loader.ts:30-40` casts `item as SkillId` at the parse boundary
- `skillFrontmatterLoaderSchema` uses `z.string()` (not `skillIdSchema`) for the `name` field
- `rawMetadataSchema` in `matrix-loader.ts:46-48` uses `z.string() as z.ZodType<SkillId>` for relationship refs

**Recommendation (c) is the existing codebase pattern.** No new pattern needed.

### Additional Questions the Doc Should Raise

**Q5: How do custom categories interact with `stackAgentConfigSchema` subcategory key validation?**

The `stackAgentConfigSchema` (`schemas.ts:360-375`) validates all record keys against the built-in `stackSubcategoryValues` set. Any stack config using custom subcategory keys (e.g., `acme-pipeline: web-framework-react`) will fail validation. This must be relaxed by extending `stackSubcategoryValues` at runtime with custom category IDs from the merged matrix (same dynamic extension approach as `subcategorySchema`).

**Q6: How does the `projectConfigLoaderSchema` handle custom domains and skills?**

The loader schema (`schemas.ts:382-412`) uses `domainSchema` (strict enum) for `domains` and `skillIdSchema` (strict prefix regex) for `skills`. Saving and reloading a project config with custom domains/skills will fail. The loader schema must accept custom values when custom entities are present.

**Q7: How do custom skills interact with `resolveToCanonicalId()` in matrix-loader?**

The `resolveToCanonicalId()` function (`matrix-loader.ts:226-249`) resolves display names, directory paths, and aliases to canonical skill IDs. Custom skills won't be in `displayNameToId` (the built-in alias map from skills-matrix.yaml) unless they are added to the source's `skills-matrix.yaml` `skillAliases` section. The source's matrix can define aliases for custom skills in the same way the CLI matrix defines aliases for built-in skills -- these are merged alongside categories.
