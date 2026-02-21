# Custom Extensibility Design

Design document for allowing private marketplace users to create custom skills, agents, categories, and domains that the CLI can load, validate, and compile without requiring changes to the CLI's built-in type definitions.

**Status:** Draft
**Date:** 2026-02-21

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [The Custom Property](#the-custom-property)
3. [Naming Convention Analysis](#naming-convention-analysis)
4. [Local Schema Design](#local-schema-design)
5. [Runtime Validation Behavior](#runtime-validation-behavior)
6. [Impact by Entity Type](#impact-by-entity-type)
7. [Skill & Agent Creation UX](#skill--agent-creation-ux)
8. [Implementation Phases](#implementation-phases)
9. [Open Questions](#open-questions)

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

### Recommendation: `customSkill: true`

A boolean `customSkill` property on each entity's config file.

**Why boolean over enum:**

- The only distinction that matters at runtime is "should the CLI enforce its built-in enum constraints on this entity?" -- a yes/no question
- An enum like `origin: "custom" | "builtin" | "forked"` conflates provenance with validation behavior. Provenance is already tracked elsewhere: `SkillSourceType` for source classification, `forkedFrom` for fork lineage
- A boolean is impossible to get wrong. Users writing YAML add `customSkill: true` and it works

**Why `customSkill` over alternatives:**

| Candidate           | Problem                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `origin: "custom"`  | Overlaps with `SkillSourceType` and `forkedFrom` provenance tracking |
| `managed: true`     | Semantically backwards (all skills are "managed" by the CLI)         |
| `builtin: false`    | Double negative; confusing for YAML authors                          |
| `external: true`    | Ambiguous -- external to what?                                       |
| `custom: true`      | Too generic -- could be confused with other "custom" concepts        |
| `customSkill: true` | Clear, specific, no overlap with existing concepts                   |

**Where it lives in each entity:**

```yaml
# metadata.yaml (skills)
customSkill: true
category: acme-pipeline
author: "@acme"
cliName: Deploy Pipeline
# ...

# agent.yaml (agents)
customSkill: true
id: acme-deployer
title: Acme Deployer
# ...

# skills-matrix.yaml (categories and domains -- in a custom overlay file)
# See "Local Schema Design" section for how custom categories/domains are declared
```

**Automatic vs manual:**

- `agentsinc new skill` and `agentsinc new agent` should set `customSkill: true` automatically when running inside a private marketplace context (detected via `config.yaml` having a `marketplace` field or the presence of `marketplace.json`)
- Users editing YAML directly can add it manually
- Built-in skills shipped with the public marketplace never have this property

### Codebase Audit Notes

**`SkillSourceType` and `forkedFrom` verification:**

- `SkillSourceType` (`src/cli/types/matrix.ts:280`): `"public" | "private" | "local"` -- classifies source provenance only. Lives on `SkillSource.type`, not on the metadata YAML. Confirmed no overlap with `customSkill`.
- `forkedFrom` is used in two contexts:
  1. `localSkillMetadataSchema` (`schemas.ts:539-554`): tracks fork lineage for local skills copied from marketplace (`skillId`, `contentHash`, `date`, `source`)
  2. `metadataValidationSchema` (`schemas.ts:819-832`): strict validation for published skills (`skillId`, `version`, `contentHash`, `source`, `date`)
  3. `importedSkillMetadataSchema` (`schemas.ts:635-650`): tracks import origin (`source`, `skillName`, `contentHash`, `date`)
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

#### 2. Agent-Skill Mapping (1 location, indirect)

| File                                   | Usage                                                          | Impact                            |
| -------------------------------------- | -------------------------------------------------------------- | --------------------------------- |
| `defaults/agent-mappings.yaml:135-216` | `agentSkillPrefixes` maps agents to prefixes like `web`, `api` | Used by wizard agent preselection |

But critically, `agentSkillPrefixes` is only used in one place: `preselectAgentsFromDomains()` in the wizard store. And that function does NOT parse skill ID prefixes -- it maps selected **domains** to agent lists via the hardcoded `DOMAIN_AGENTS` constant (`wizard-store.ts:24-37`). The `agentSkillPrefixes` config is loaded by `defaults-loader.ts:11` but never actually consumed for prefix parsing at runtime.

#### 3. Agent Routing via Skill Path (NOT prefix)

The `getAgentsForSkill()` function in `config-generator.ts:28-53` matches against the skill's **directory path** (e.g., `web/framework/react`) and **category** (e.g., `web-testing`) using path patterns like `"web/*"` and exact category matches, not against the skill ID prefix. The path comes from `ExtractedSkillMetadata.path` which is set to `skills/${directoryPath}/` in `matrix-loader.ts:147`.

The matching order in `getAgentsForSkill()`:

1. Exact match on `category` string (e.g., `"web-testing"` -> `[web-tester, web-developer, web-reviewer]`)
2. Exact match on normalized path
3. Wildcard prefix match (e.g., `"web/*"` matches `web/framework/react`)
4. Fallback to `DEFAULT_AGENTS` (`["agent-summoner", "skill-summoner", "documentor"]`)

#### 4. Display Name Fallback (1 location)

```typescript
// stores/wizard-store.ts:119-120
const segments = skillId.split("-");
const fallback = segments[segments.length - 1] || skillId;
```

This extracts the **last** segment as a display name fallback, not the first (prefix).

#### 5. Domain Determination

The skill's domain is determined by its `category` field in `metadata.yaml`, which maps to a `CategoryDefinition` with a `domain` property. The skill ID prefix is **not** used to determine domain at runtime.

### Conclusion: The Prefix is Redundant Information

**The prefix only matters for:**

1. Schema validation (3 regex checks) -- easily made conditional on `customSkill: true`
2. Human readability -- `web-framework-react` tells you the domain at a glance

**The prefix does NOT determine:**

- Which domain a skill belongs to (determined by `category` -> `CategoryDefinition.domain`)
- Which agents receive the skill (determined by `skillToAgents` path patterns in `agent-mappings.yaml`, resolved in `config-generator.ts:28-53`)
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

For custom entities (`customSkill: true`), relax the `SKILL_ID_PATTERN` to accept any kebab-case string:

```typescript
// Proposed: general pattern for custom skills — any kebab-case string
const CUSTOM_SKILL_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// At runtime, check:
// 1. If entity has customSkill: true -> validate against CUSTOM_SKILL_ID_PATTERN
// 2. If entity does NOT have customSkill: true -> validate against existing SKILL_ID_PATTERN
```

**What we do NOT do:**

- We do not remove the built-in prefix constraint for non-custom skills
- We do not parse the prefix from custom skill IDs for any routing logic (the `category` field handles routing)

### Codebase Audit Notes

**Line references verified:**

- `SKILL_ID_PATTERN` at `schemas.ts:227` -- **confirmed**
- `source-switcher.ts:16` uses `SKILL_ID_PATTERN.test(skillId)` -- **confirmed** (in `validateSkillId()` function, called by `archiveLocalSkill`, `restoreArchivedSkill`, and `hasArchivedSkill`)
- `stacks-loader.ts:118` uses `SKILL_ID_PATTERN.test(assignment.id)` -- **confirmed** (in `resolveAgentConfigToSkills()`)
- `agent-mappings.yaml:135` starts `agentSkillPrefixes` section -- **confirmed**
- `preselectAgentsFromDomains()` at `wizard-store.ts:634-644` -- **confirmed** it uses only `DOMAIN_AGENTS` constant, NOT `agentSkillPrefixes`

**Additional finding:** The JSDoc on `preselectAgentsFromDomains` (`wizard-store.ts:338`) misleadingly says "Matches domains against agentSkillPrefixes from cached defaults" but the implementation uses the hardcoded `DOMAIN_AGENTS` constant. The doc's analysis is correct about the actual behavior.

**`categoryPathSchema` additional prefix:** The `categoryPathSchema` regex (`schemas.ts:241`) includes `shared` as an 8th valid prefix beyond the 7 in `SkillIdPrefix`. This means `shared-monorepo` is a valid category path even though `shared` is not a valid skill ID prefix. Custom extensibility must relax `categoryPathSchema` similarly.

---

## Local Schema Design

### Purpose

Users need IDE validation (yaml-language-server) for their custom entities. The CLI publishes base JSON schemas (e.g., `metadata.schema.json`). The user's marketplace repo extends these with local schema files that add custom enum values.

### Directory Structure

```
.claude-src/
  schemas/
    metadata.schema.json          # Extends CLI's base metadata schema
    agent.schema.json             # Extends CLI's base agent schema
    skills-matrix.schema.json     # Extends CLI's base matrix schema
    custom-definitions.json       # Custom domains, categories, prefixes
```

### Schema Extension Pattern

Use JSON Schema `allOf` + `$ref` so the base schema's structural rules are inherited and the local schema only overrides enum constraints:

```jsonc
// .claude-src/schemas/metadata.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Custom Skill Metadata",
  "description": "Extends CLI base metadata schema with custom categories.",
  "allOf": [
    {
      "$ref": "https://unpkg.com/@anthropic/agentsinc-cli@latest/dist/schemas/metadata.schema.json",
    },
  ],
  "properties": {
    "customSkill": {
      "type": "boolean",
      "const": true,
      "description": "Marks this entity as custom-created (bypasses built-in enum validation)",
    },
    "category": {
      "type": "string",
      "enum": ["web-framework", "web-styling", "acme-pipeline", "acme-infra", "acme-ml"],
    },
  },
}
```

### How `$ref` Points to the CLI's Published Schema

**Option A: npm package URL (recommended)**

```json
{ "$ref": "https://unpkg.com/@anthropic/agentsinc-cli@latest/dist/schemas/metadata.schema.json" }
```

Pros: Always resolves to the published version. Works with any JSON Schema tooling.
Cons: Requires internet access. `@latest` may introduce breaking changes.

**Option B: Pinned version**

```json
{ "$ref": "https://unpkg.com/@anthropic/agentsinc-cli@0.44.0/dist/schemas/metadata.schema.json" }
```

Pros: Deterministic. No surprise breakage.
Cons: User must update version manually.

**Option C: Relative path to node_modules**

```json
{ "$ref": "../node_modules/@anthropic/agentsinc-cli/dist/schemas/metadata.schema.json" }
```

Pros: Works offline. Always matches installed CLI version.
Cons: Path may vary by project structure. Not all tools resolve relative `$ref` correctly.

**Recommendation:** Option A with the caveat that `agentsinc new marketplace` (future command) should scaffold with Option B (pinned to the user's current CLI version). The scaffolded schemas should include a comment explaining how to update the version.

### Custom Definitions File

A separate `custom-definitions.json` declares the custom vocabulary so the CLI knows what custom domains and categories exist without parsing every entity file:

```jsonc
// .claude-src/schemas/custom-definitions.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Custom Definitions",
  "description": "Declares custom domains, categories, and prefixes for this marketplace.",
  "type": "object",
  "properties": {
    "domains": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
          "displayName": { "type": "string" },
          "description": { "type": "string" },
        },
        "required": ["id", "displayName"],
      },
    },
    "categories": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
          "displayName": { "type": "string" },
          "description": { "type": "string" },
          "domain": { "type": "string" },
          "exclusive": { "type": "boolean", "default": true },
          "required": { "type": "boolean", "default": false },
          "order": { "type": "integer", "default": 100 },
        },
        "required": ["id", "displayName", "domain"],
      },
    },
    "agentNames": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9]*(-[a-z0-9]+)*$",
      },
      "description": "Custom agent names beyond the built-in set",
    },
    "skillIdPrefixes": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9]*$",
      },
      "description": "Custom skill ID prefixes (e.g., 'acme', 'dataeng')",
    },
  },
}
```

Example usage:

```jsonc
// .claude-src/schemas/custom-definitions.json (actual content, not schema)
{
  "domains": [
    { "id": "acme", "displayName": "Acme Platform", "description": "Internal platform tools" },
  ],
  "categories": [
    {
      "id": "acme-pipeline",
      "displayName": "CI/CD Pipeline",
      "description": "Deployment pipeline skills",
      "domain": "acme",
      "exclusive": false,
      "order": 1,
    },
    {
      "id": "acme-ml",
      "displayName": "ML Tooling",
      "description": "Machine learning workflow skills",
      "domain": "acme",
      "exclusive": true,
      "order": 2,
    },
  ],
  "agentNames": ["acme-deployer", "acme-ml-engineer"],
  "skillIdPrefixes": ["acme", "dataeng"],
}
```

### Schema Update on `new skill` / `new agent`

When `agentsinc new skill acme-pipeline-deploy` runs inside a marketplace with `custom-definitions.json`:

1. The CLI reads `custom-definitions.json` to learn valid custom prefixes/categories
2. Creates the skill with `customSkill: true` in `metadata.yaml`
3. Updates `.claude-src/schemas/metadata.schema.json` to add the new category to the local `category` enum (if not already present)

This is a convenience, not a hard requirement. Users can also edit the schemas manually.

### Codebase Audit Notes

**JSON Schema `allOf` + `$ref` complication:** The base `metadata.schema.json` (`src/schemas/metadata.schema.json`) currently has `"additionalProperties": false`. When combined via `allOf`, the base schema's `additionalProperties: false` will reject the `customSkill` property added by the extending schema. This is a known JSON Schema draft-07 limitation where `additionalProperties` in `allOf` does not compose intuitively.

**Resolution options:**

1. The base schema must be updated to include `customSkill` as an optional property (even for built-in skills, where it would be absent/ignored)
2. OR the base schema should remove `additionalProperties: false` in favor of documenting expected fields
3. OR the local schema must NOT use `allOf` + `$ref` and instead be a standalone schema that duplicates the base fields

**Recommendation:** Option 1 is cleanest -- add `customSkill` to the base `metadata.schema.json` as an optional boolean. This is a non-breaking change for existing skills and makes the `allOf` extension pattern work correctly.

**Existing schema directory:** The CLI already ships 12 JSON schemas in `src/schemas/`:

- `metadata.schema.json`, `agent.schema.json`, `skill-frontmatter.schema.json`, `agent-frontmatter.schema.json`
- `skills-matrix.schema.json`, `stacks.schema.json`, `stack.schema.json`
- `project-config.schema.json`, `project-source-config.schema.json`
- `marketplace.schema.json`, `plugin.schema.json`, `hooks.schema.json`

**Schema location:** The doc proposes `.claude-src/schemas/` for user schemas. The `CLAUDE_SRC_DIR` constant exists (`consts.ts:16`) as `".claude-src"`, confirming this is the established convention for source-level config.

**`custom-definitions.json` is NOT a JSON Schema:** The document confusingly presents `custom-definitions.json` with a `$schema` header and JSON Schema structure in one block, then shows "actual content" in another. These are two different things: (a) the schema FOR the file, and (b) the file's actual content. The document should separate these clearly. The schema for `custom-definitions.json` should ship with the CLI (at `src/schemas/custom-definitions.schema.json`). The actual file the user creates would just have a `$schema` pointer to it.

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

When the CLI loads an entity, it checks for the `customSkill` property:

```typescript
// Pseudocode for the detection flow
const rawMetadata = parseYaml(content);
const isCustom = rawMetadata.customSkill === true;
```

The check happens at the YAML parse boundary, before schema validation.

#### What Changes

| Check                  | Built-in Entity                               | Custom Entity (`customSkill: true`)                                  |
| ---------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| Skill ID format        | Must match `SKILL_ID_PATTERN` (7 prefixes)    | Must match `CUSTOM_SKILL_ID_PATTERN` (any kebab-case string)         |
| Agent name             | Must be in `AgentName` union                  | Must be kebab-case, no other constraint                              |
| Category               | Must be in `Subcategory` union                | Must be kebab-case, optionally declared in `custom-definitions.json` |
| Domain                 | Must be in `Domain` union                     | Must be kebab-case, optionally declared in `custom-definitions.json` |
| Structural fields      | `description`, `author`, `cliName` required   | Same -- structural requirements unchanged                            |
| Relationship refs      | Resolved via `displayNameToId` and alias maps | Same -- references validated post-merge                              |
| `additionalProperties` | Strict schemas reject unknown fields          | Same -- `customSkill` is added to the schema's known properties      |

#### What Does NOT Change

1. **Structural validation** -- a custom skill still needs `cliName`, `cliDescription`, `usageGuidance`, `author`, and `category` in its `metadata.yaml`
2. **Post-merge reference checking** -- if a custom skill declares `requires: ["acme-pipeline-setup"]`, the merge step verifies that `acme-pipeline-setup` actually exists in the loaded skill set
3. **Compilation pipeline** -- `buildResolvedSkill()` (`matrix-loader.ts:435-483`) works identically for custom skills; the category determines agent routing, not the ID prefix
4. **Schema validation command** (`agentsinc validate`) -- adds a `--custom-skill` flag or auto-detects from the entity's `customSkill: true` to apply relaxed enum checking

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

The strict validation schemas need conditional relaxation:

```typescript
// Proposed: factory function that creates a validation schema
// appropriate for the entity's custom status
function createMetadataValidationSchema(isCustom: boolean) {
  return z
    .object({
      customSkill: z.literal(true).optional(),
      category: isCustom
        ? z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/) // any kebab-case
        : subcategorySchema, // built-in enum
      // ... rest unchanged
    })
    .strict();
}
```

Alternatively, the strict schemas can simply add `customSkill` as an optional known property so `.strict()` does not reject it, and the category/ID enum checks are skipped at the caller level:

```typescript
// Simpler approach: add `customSkill` to schema, skip enum checks at caller
export const metadataValidationSchema = z
  .object({
    customSkill: z.boolean().optional(), // <-- NEW
    category: subcategorySchema,
    // ...
  })
  .strict();

// In the validation command:
if (parsed.customSkill === true) {
  // skip category enum check, use relaxed ID pattern
}
```

**Recommendation:** The simpler approach (add `customSkill` to existing schemas, conditional checks at the caller). This minimizes schema changes and avoids factory functions.

### Codebase Audit Notes

**Two-tier architecture verified:**

- Loader tier: `skillMetadataLoaderSchema` (`schemas.ts:290-300`) uses `.passthrough()` and `categoryPathSchema` (accepts any valid-looking category path). `skillFrontmatterLoaderSchema` (`schemas.ts:283-287`) uses `z.string()` for name.
- Validation tier: `metadataValidationSchema` (`schemas.ts:791-834`) uses `.strict()` and `subcategorySchema` (enum). `skillFrontmatterValidationSchema` (`schemas.ts:769-788`) uses `.strict()`.
- The two-tier description is **accurate**.

**The "simpler approach" problem:** If we keep `subcategorySchema` (enum) in the strict schema and only skip the check at the caller, then `z.strict()` will still reject unknown field combinations if `category` doesn't match the enum during Zod's `.safeParse()`. The Zod schema itself will fail before the caller can check `customSkill`. **The factory function approach OR a `z.union` that switches on `customSkill` is actually needed** for the Zod path. The caller-level skip only works for the JSON Schema path (where the validator already runs before code logic).

**Clarification:** The "simpler approach" works if the validation flow is:

1. Parse with lenient loader schema (already passes)
2. At the validation command level, check `customSkill` FIRST
3. If `customSkill: true`, use a relaxed validation schema variant
4. If not, use the strict built-in schema

This is effectively the factory function approach but with the decision at the call site rather than inside the schema. Either way, **two schema variants are needed**.

**Third loader schema not mentioned:** `matrix-loader.ts:37-51` has its own `rawMetadataSchema` (separate from `skillMetadataLoaderSchema`) used by `extractAllSkills()`. This schema also needs `customSkill` added, and its `category` field validation (`categoryPathSchema`) already accepts arbitrary prefix paths -- so custom categories work at the loader level today.

**`agentsinc validate` current structure:** The validate command (`commands/validate.ts`) delegates to `schema-validator.ts` which uses the strict schemas. It has two modes: YAML schema validation and plugin validation. The custom entity detection would need to be added to the YAML validation path in `schema-validator.ts`, where each file is parsed and validated against the appropriate strict schema.

---

## Impact by Entity Type

### Skills

**Config location:** `metadata.yaml`

```yaml
customSkill: true
category: acme-pipeline
author: "@acme"
cliName: Deploy Pipeline
cliDescription: Kubernetes deployment automation
usageGuidance: Use when deploying services to staging or production.
tags:
  - deployment
  - kubernetes
```

**Validation changes:**

- `SKILL_ID_PATTERN` check skipped when `customSkill: true`; `CUSTOM_SKILL_ID_PATTERN` (any kebab-case string) used instead
- `category` field accepts any kebab-case string, not just built-in `Subcategory` values
- All structural fields still required

**Wizard UI changes:**

The wizard rendering pipeline is 100% metadata-driven. Skill IDs are never parsed for routing. Custom skills render alongside built-in ones with zero special handling needed:

- The wizard determines domain tabs via `CategoryDefinition.domain`, not skill IDs
- Categories are filtered by `matrix.categories` where `cat.domain === domain` (`build-step-logic.ts:127`)
- Skills appear via `getAvailableSkills(cat.id, ...)` which matches on `metadata.yaml`'s `category` field
- A custom skill with `category: web-framework` appears next to React and Vue with no special handling
- Custom skills in custom categories (e.g., `category: acme-pipeline`) appear in the custom domain tab under their category
- The only prerequisite is that the custom category is loaded into `matrix.categories` (via `custom-definitions.json` merge) and has a `domain` property
- Optional: custom skills could be prefixed with a visual indicator (e.g., "C" badge) in the display label for clarity, but this is purely cosmetic

**Compilation pipeline changes:**

- None. `buildResolvedSkill()` (`matrix-loader.ts:435-483`) uses `category` for routing, which works with any string value
- `getAgentsForSkill()` (`config-generator.ts:28-53`) falls back to `DEFAULT_AGENTS` when no `skillToAgents` pattern matches, which is the correct behavior for custom skills unless the user also adds custom `skillToAgents` mappings

### Codebase Audit Notes (Skills)

**`extractAllSkills()` (`matrix-loader.ts:91-155`) requires changes.** The function uses a local `rawMetadataSchema` (`matrix-loader.ts:37-51`) that includes `categoryPathSchema` for the `category` field. The `categoryPathSchema` (`schemas.ts:238-247`) already accepts any prefix matching `^(web|api|cli|mobile|infra|meta|security|shared)-.+$` OR bare `Subcategory` values OR `"local"`. A custom category like `acme-pipeline` would NOT match any of these -- it would be rejected by `categoryPathSchema`. **This is a critical gap:** the loader-level schema already blocks custom categories. The fix: when `customSkill: true` is detected at the raw YAML level, use a relaxed `categoryPathSchema` variant (or just `z.string()` for category).

**`buildResolvedSkill()` path resolution:** For custom skills, `skill.path` is set to `skills/${directoryPath}/` at `matrix-loader.ts:147`. The `getAgentsForSkill()` function normalizes this path and matches against `skillToAgents` patterns. A custom skill in directory `acme/pipeline/deploy` would have path `skills/acme/pipeline/deploy/` -- this won't match any built-in pattern like `"web/*"` or `"api/*"`, so it correctly falls back to `DEFAULT_AGENTS`. Custom `skillToAgents` mappings (e.g., `"acme/*": ["acme-deployer"]`) would need to be defined in `custom-definitions.json` or a custom `agent-mappings.yaml` overlay.

### Agents

**Config location:** `agent.yaml`

```yaml
customSkill: true
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

- `id` field: `agentNameSchema` (enum check) skipped when `customSkill: true`; kebab-case check used instead
- All structural fields still required (`title`, `description`, `tools`)

**Wizard UI changes:**

- Custom agents appear in the Agents step alongside built-in agents
- `preselectAgentsFromDomains()` only preselects from `DOMAIN_AGENTS` (built-in); custom agents must be manually selected or auto-included if they appear in a custom `agentSkillPrefixes` mapping

**Compilation pipeline changes:**

- The compiler resolves agents by name from the `agents/` directory. Custom agents work as long as their directory structure matches the expected layout (`{agent-name}/agent.yaml`, template files, etc.)
- Stack configs can reference custom agent names in the outer record (e.g., `stack["acme-deployer"]`) since `projectConfigLoaderSchema.stack` (`schemas.ts:404`) uses `z.record(z.string(), stackAgentConfigSchema)` for agent keys

### Codebase Audit Notes (Agents)

**`agentYamlConfigSchema` blocks custom agents at loader level.** The schema (`schemas.ts:334-344`) uses `agentNameSchema` for the `id` field, which is a strict enum of 18 built-in names. Loading a custom agent's `agent.yaml` will fail at the Zod validation step. This needs the same conditional relaxation: when `customSkill: true` is present, use `z.string().regex(KEBAB_CASE_PATTERN)` instead of `agentNameSchema` for the `id` field.

**`agentYamlGenerationSchema` already lenient.** The strict schema for compiled agent output (`schemas.ts:736-749`) uses `z.string().min(1)` for `id` -- already accepts any string. So compilation output of custom agents works without changes.

**Stack config agent key validation:** The outer `stack` record in `projectConfigLoaderSchema` (`schemas.ts:404`) uses `z.record(z.string(), ...)` -- accepts any string for agent keys. **Confirmed: custom agent names work as stack keys.**

**Stack subcategory key validation blocks custom categories.** The inner `stackAgentConfigSchema` (`schemas.ts:360-375`) validates subcategory keys against `stackSubcategoryValues` (a `Set` of 38 built-in subcategory strings). Custom subcategory keys like `acme-pipeline` will trigger a Zod `addIssue()` with "Invalid subcategory". **This is a critical gap not mentioned in the doc.** The fix: skip subcategory key validation for agents/stacks that use custom categories.

### Categories

**Config location:** `skills-matrix.yaml` overlay or `custom-definitions.json`

Categories are not standalone entities -- they live inside `skills-matrix.yaml`. For custom categories, there are two approaches:

**Approach A: Custom overlay matrix**

The private marketplace ships its own `skills-matrix.yaml` that includes both built-in and custom categories. The CLI merges this during loading.

```yaml
# Private marketplace's skills-matrix.yaml
version: "1.0.0"
categories:
  # Include built-in categories the marketplace uses:
  web-framework:
    id: web-framework
    displayName: Framework
    description: UI framework
    domain: web
    exclusive: true
    required: true
    order: 1

  # Custom categories:
  acme-pipeline:
    id: acme-pipeline
    displayName: CI/CD Pipeline
    description: Deployment pipeline skills
    domain: acme # custom domain
    exclusive: false
    required: false
    order: 1
    customSkill: true # marks this category as custom
```

**Approach B: Separate custom-definitions.json (recommended)**

Categories declared in `custom-definitions.json` are merged into the matrix at load time. This keeps the matrix file cleaner and separates "what's custom" from "what's built-in."

**Validation changes:**

- `subcategorySchema` (enum check) on category `id` field skipped for entries with `customSkill: true`
- `CategoryDefinition.domain` accepts any string when the category is custom

**Wizard UI changes:**

- `buildCategoriesForDomain()` at `build-step-logic.ts:112-164` already handles this generically
- `Object.values(matrix.categories).filter(cat => cat.domain === domain)` includes any category in the map
- Categories are sorted by `cat.order` -- custom categories just need an `order` value
- No code changes needed in `build-step-logic.ts` for custom categories to render
- `CategoryMap` already uses `Partial<Record<Subcategory, CategoryDefinition>>` -- for custom categories, the key simply does not match the `Subcategory` union, which works with the `Partial` wrapper at runtime (the type constraint is compile-time only)

**Compilation pipeline changes:**

- None needed. The matrix-loader already processes `CategoryMap` entries generically

### Codebase Audit Notes (Categories)

**Approach A has a critical schema barrier.** The `skillsMatrixConfigSchema` (`schemas.ts:497-506`) validates category keys with `z.record(subcategorySchema, categoryDefinitionSchema)`. The `subcategorySchema` is a strict enum of 38 values. A custom category key like `acme-pipeline` will fail Zod validation at `loadSkillsMatrix()` (`matrix-loader.ts:60-73`). Approach A requires either:

1. Making the categories record use `z.record(z.string(), ...)` when custom definitions are present
2. OR using a separate custom categories section that bypasses enum validation

**Approach B avoids this.** Since `custom-definitions.json` is loaded separately and merged post-parse, it bypasses the `skillsMatrixConfigSchema` entirely.

**`CategoryDefinition.id` is typed as `Subcategory`.** The type (`types/matrix.ts:80`) constrains `id: Subcategory`. The `categoryDefinitionSchema` (`schemas.ts:447-456`) validates `id` with `subcategorySchema`. Both need relaxation for custom categories. Consider adding `customSkill?: boolean` to `CategoryDefinition` and a conditional schema.

### Domains

**Config location:** `custom-definitions.json`

Domains are not currently a first-class config entity -- they're derived from the `domain` field in `CategoryDefinition`. Custom domains emerge naturally when a custom category declares a `domain` value outside the built-in `Domain` union.

**Validation changes:**

- `domainSchema` (enum check) skipped for categories with `customSkill: true`
- The wizard store's `ALL_DOMAINS` constant (`wizard-store.ts:21`) and `DOMAIN_AGENTS` mapping (`wizard-store.ts:24-37`) would need to be dynamically computed from the loaded matrix rather than hardcoded

**Wizard UI changes:**

- Custom domains appear as additional tabs in the Build step
- Custom domains have no built-in agent preselection (no entries in `DOMAIN_AGENTS`) -- the user selects agents manually or the custom `custom-definitions.json` provides agent mappings

**Compilation pipeline changes:**

- None. Domains are a wizard concept, not a compilation concept

### Codebase Audit Notes (Domains)

**`DomainSelections` type constraint.** The type (`types/matrix.ts:76`) is `Partial<Record<Domain, Partial<Record<Subcategory, SkillId[]>>>>`. Both `Domain` and `Subcategory` are compile-time-only constraints -- at runtime, JavaScript treats all string keys equally. The Partial wrapper means missing keys are fine. So custom domains/subcategories work at runtime BUT TypeScript will flag type errors at compile time. This aligns with the Q4 recommendation (boundary casts).

**`toggleDomain` and `toggleTechnology` type signatures.** These wizard store actions (`wizard-store.ts:246, 261-266`) accept `Domain` and `Subcategory` typed parameters. Callers would need boundary casts when passing custom values. The wizard components that call these would need to cast custom domain/subcategory strings at the data boundary.

**`ProjectConfig.domains` field.** The `domains` field on `ProjectConfig` (`types/config.ts:100`) is typed `Domain[]`. The `projectConfigLoaderSchema` (`schemas.ts:400`) uses `z.array(domainSchema)`. Custom domains stored in the config would fail Zod validation. This needs relaxation in the loader schema when custom definitions are present.

---

## Implementation Phases

### Phase 1: Foundation (`customSkill` property + relaxed validation)

1. Add `customSkill?: boolean` to TypeScript types:
   - `SkillMetadataConfig` (`types/skills.ts:195-210`) -- note: this type only has `category`, `categoryExclusive`, `author`, `tags`, `requires`, `compatibleWith`, `conflictsWith`. It does NOT have `cliName`, `cliDescription`, or `usageGuidance`. The broader metadata type with those fields is in `rawMetadataSchema` (`matrix-loader.ts:37-51`) and `metadataValidationSchema` (`schemas.ts:791-834`).
   - `AgentYamlConfig` (`types/agents.ts:83-85`)
   - `CategoryDefinition` (`types/matrix.ts:79-92`)
   - `ExtractedSkillMetadata` (`types/matrix.ts:379-410`) -- needs `customSkill?: boolean` to carry the flag through the pipeline
2. Add `customSkill` to Zod schemas:
   - Loader schemas: `skillMetadataLoaderSchema` (`schemas.ts:290-300`), `localRawMetadataSchema` (`schemas.ts:512-536`), `rawMetadataSchema` (`matrix-loader.ts:37-51`), `agentYamlConfigSchema` (`schemas.ts:334-344`)
   - Validation schemas: `metadataValidationSchema` (`schemas.ts:791-834`), `agentFrontmatterValidationSchema` (`schemas.ts:751-767`), `categoryDefinitionSchema` (`schemas.ts:447-456`)
   - JSON schemas: `metadata.schema.json`, `agent.schema.json`, `skills-matrix.schema.json`
3. Create `CUSTOM_SKILL_ID_PATTERN` (any kebab-case string: `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`) in `schemas.ts` and conditional validation logic:
   - Add a helper `isCustomEntity(raw: unknown): boolean` that checks `rawMetadata.customSkill === true`
   - In `source-switcher.ts:validateSkillId()`: check custom flag before applying `SKILL_ID_PATTERN`
   - In `stacks-loader.ts:resolveAgentConfigToSkills()`: check custom flag before applying `SKILL_ID_PATTERN`
4. Update `extractAllSkills()` (`matrix-loader.ts:91-155`) to:
   - Read `customSkill` from raw metadata before Zod parse
   - When true, use a relaxed `rawMetadataSchema` variant (accepts any kebab-case category)
   - Pass `customSkill` through to `ExtractedSkillMetadata`
5. Update `agentsinc validate` (`commands/validate.ts` -> `schema-validator.ts`) to:
   - Detect `customSkill: true` in each file before applying strict schema
   - Use relaxed validation variant for custom entities

### Phase 2: Local schema infrastructure

1. Define `custom-definitions.schema.json` (ship with CLI in `src/schemas/`)
2. Create `loadCustomDefinitions()` loader in `src/cli/lib/loading/`:
   - Reads `.claude-src/schemas/custom-definitions.json`
   - Validates against the schema
   - Returns typed `CustomDefinitions` object
3. Update `loadSkillsMatrix()` (`matrix-loader.ts:60-73`) to merge custom categories from `custom-definitions.json`:
   - After loading the matrix, call `loadCustomDefinitions()`
   - Merge custom categories into `matrix.categories` (with `customSkill: true` flag)
   - Add custom domains to the matrix context
4. Update `new skill` (`commands/new/skill.ts`) and `new agent` (`commands/new/agent.tsx`) to auto-detect marketplace context and set `customSkill: true`
5. Relax `stackAgentConfigSchema` (`schemas.ts:360-375`) subcategory key validation to accept custom subcategory keys when custom definitions are loaded

### Phase 3: Wizard support

The rendering pipeline (`buildCategoriesForDomain()`, category grid, skill rendering, selection logic) already works generically on whatever is in the matrix -- no changes needed there. The real work is in the store initialization and domain tab generation:

1. Make `ALL_DOMAINS` (`wizard-store.ts:21`) and `DOMAIN_AGENTS` (`wizard-store.ts:24-37`) dynamic:
   - Compute from loaded matrix + custom definitions at wizard init time
   - Custom domains have empty agent lists in `DOMAIN_AGENTS`
2. Surface custom agents in the Agents step alongside built-in agents
3. Relax type signatures where needed:
   - `toggleDomain()` and related functions may need to accept `string` at boundary
   - `DomainSelections` may need a more permissive type for runtime custom values
   - `ProjectConfig.domains` loader schema needs to accept custom domain strings

### Phase 4: Schema scaffolding

1. Add `agentsinc new marketplace` command (or extend existing setup)
2. Scaffold `.claude-src/schemas/` with `$ref` to pinned CLI version
3. Auto-update local schema enums on `new skill` / `new agent`

### Codebase Audit Notes (Phases)

**Phase ordering is correct.** Phase 1 (foundation) has no dependencies. Phase 2 (custom definitions) depends on Phase 1 for the `customSkill` property. Phase 3 (wizard) depends on Phase 2 for custom domain/category data. Phase 4 (scaffolding) is independent but benefits from Phase 1-3 being complete.

**Missing from Phase 1:** The `projectConfigLoaderSchema` (`schemas.ts:382-412`) uses `domainSchema` for `domains` and `skillIdSchema` for `skills`. Custom skills and domains stored in `.claude/config.yaml` will fail loading. This must be relaxed in Phase 1, not deferred.

**Missing from Phase 2:** The `config-generator.ts:28-53` `getAgentsForSkill()` function needs a mechanism for custom `skillToAgents` mappings. Consider loading custom mappings from `custom-definitions.json` and merging with the built-in `agent-mappings.yaml`.

**Lower-risk reordering possible:** Phase 2 steps 4 (update `new skill`/`new agent`) could be done in Phase 1 since the commands already exist and the change is small (add `customSkill: true` to generated YAML when marketplace detected).

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

**Marketplace context:** When running inside a private marketplace (detected via `config.yaml` having a `marketplace` field or the presence of `marketplace.json`), the CLI sets `customSkill: true` automatically in the generated `metadata.yaml`. The user does not need to know about this property.

### Agents: Guided Domain + Role Picker

`agentsinc new agent` uses a guided wizard with structured selection, not free-text input.

**Flow:**

1. **"Which domain?"** -- select from available domains (`web`, `api`, `cli`, `mobile`, `shared`, plus any custom domains from `custom-definitions.json`)
2. **"What kind of agent?"** -- select from role archetypes (`developer`, `tester`, `reviewer`, `researcher`, `architect`, etc. -- drawn from the `AgentName` union, plus custom agent roles)

There is no "align to project" toggle. The domain + role combination fully defines the agent's responsibilities, tools, and behavior. There is nothing ambiguous left to align -- an `api-developer` is an `api-developer` regardless of which project it lives in.

**Output:** `agent.yaml` + template files in `agents/{agent-name}/`

**Marketplace context:** Same as skills -- `customSkill: true` set automatically when running inside a marketplace context.

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

### Q1: Should `custom-definitions.json` be required?

If a marketplace has custom skills but no `custom-definitions.json`, should the CLI:

- (a) Infer custom domains/categories from the entities it loads (more forgiving)
- (b) Require `custom-definitions.json` as the source of truth (more explicit)

**Lean:** (b) with a clear error message pointing the user to create the file. Inference is fragile and makes debugging harder.

### Q2: How do custom categories interact with relationship rules?

Built-in relationship rules in `skills-matrix.yaml` reference skills by display name or ID. Custom skills can participate in relationships (e.g., a custom skill can `require` a built-in skill). But can a custom skill appear in the built-in matrix's `conflicts` or `recommends` rules?

**Lean:** No. The built-in matrix should not reference custom skills. Custom relationship rules should live in the marketplace's own overlay or `custom-definitions.json`.

### Q3: Should custom agents get automatic `skillToAgents` mappings?

Currently, `agent-mappings.yaml` maps skill path patterns to agents. For custom agents, should:

- (a) Users define their own mappings in `custom-definitions.json`
- (b) Custom agents receive all skills from their declared domain
- (c) Custom agents receive no skills by default (explicit stack config required)

**Lean:** (c). Custom agents are explicitly configured via stack configs. Automatic mapping is a convenience for built-in agents that understand domain conventions.

### Q4: TypeScript type widening strategy

The `SkillId` type is a template literal that constrains prefixes at compile time. For custom skills, we need to accept arbitrary strings at boundaries. Options:

- (a) Widen `SkillId` to `string` everywhere (loses type safety for built-in skills)
- (b) Add a `CustomSkillId` type (`string`) and union it: `SkillId | CustomSkillId`
- (c) Keep `SkillId` strict for internal use; boundary casts accept `string` and validate at runtime

**Lean:** (c). This matches the existing pattern where boundary casts with Zod validation are already used. The `customSkill: true` flag determines which regex to apply at the boundary. Internal code continues to use `SkillId` -- custom IDs that pass the relaxed regex are cast to `SkillId` at the parse boundary with a comment explaining why.

### Q5: Wizard tab ordering for custom domains

Built-in domains have a fixed order: web, api, cli, mobile, shared. Where do custom domains appear?

**Lean:** After all built-in domains, in the order declared in `custom-definitions.json`. The `order` field on custom categories controls intra-domain ordering.

### Q6: Should the CLI ship a `custom-definitions.schema.json`?

For IDE validation of the `custom-definitions.json` file itself.

**Lean:** Yes. This is a small addition and dramatically improves the authoring experience.

### Codebase Audit Notes (Open Questions)

**Q1 answer from code:** The code currently does NOT support inference. `loadSkillsMatrix()` uses strict schema validation -- unknown categories fail. Inference would require scanning all skill directories to build a category list before loading the matrix. This is complex and fragile. **Recommendation (b) is strongly supported by the codebase.**

**Q3 answer from code:** `getAgentsForSkill()` (`config-generator.ts:28-53`) has a clear fallback chain: exact category match -> exact path match -> wildcard prefix match -> `DEFAULT_AGENTS`. Custom agents would only receive skills if explicitly added to a `skillToAgents` mapping or via stack config. The fallback to `DEFAULT_AGENTS` (agent-summoner, skill-summoner, documentor) is correct for custom skills that don't have explicit mappings. **Recommendation (c) is strongly supported by the code structure.**

**Q4 answer from code:** The codebase already uses this pattern extensively. Examples:

- `normalizeAgentConfig()` in `stacks-loader.ts:30-40` casts `item as SkillId` at the parse boundary
- `skillFrontmatterLoaderSchema` uses `z.string()` (not `skillIdSchema`) for the `name` field
- `rawMetadataSchema` in `matrix-loader.ts:46-48` uses `z.string() as z.ZodType<SkillId>` for relationship refs

**Recommendation (c) is the existing codebase pattern.** No new pattern needed.

**Q6 answer from code:** The CLI already ships 12 JSON schemas in `src/schemas/`. Adding a 13th (`custom-definitions.schema.json`) follows the existing pattern exactly. The schema would be straightforward based on the structure defined in the "Custom Definitions File" section.

### Additional Questions the Doc Should Raise

**Q7: How do custom categories interact with `stackAgentConfigSchema` subcategory key validation?**

The `stackAgentConfigSchema` (`schemas.ts:360-375`) validates all record keys against the built-in `stackSubcategoryValues` set. Any stack config using custom subcategory keys (e.g., `acme-pipeline: web-framework-react`) will fail validation. This must be relaxed -- either by detecting custom definitions and expanding the valid set, or by skipping key validation when custom definitions are loaded.

**Q8: How does the `projectConfigLoaderSchema` handle custom domains and skills?**

The loader schema (`schemas.ts:382-412`) uses `domainSchema` (strict enum) for `domains` and `skillIdSchema` (strict prefix regex) for `skills`. Saving and reloading a project config with custom domains/skills will fail. The loader schema must accept custom values when `customSkill` entities are present.

**Q9: Should `custom-definitions.json` support custom `skillToAgents` mappings?**

Currently agent routing is defined in `agent-mappings.yaml`. Custom skills that don't match any `"web/*"`, `"api/*"`, etc. pattern fall through to `DEFAULT_AGENTS`. If Q3 answer is (c), users need a way to define custom routing. Adding a `skillToAgents` section to `custom-definitions.json` would solve this. Without it, the only option is stack configs, which are more verbose.

**Q10: How do custom skills interact with `resolveToCanonicalId()` in matrix-loader?**

The `resolveToCanonicalId()` function (`matrix-loader.ts:226-249`) resolves display names, directory paths, and aliases to canonical skill IDs. Custom skills won't be in `displayNameToId` (the built-in alias map from skills-matrix.yaml). They need their own alias registration, either via `custom-definitions.json` or a separate `skillAliases` section in the custom definitions file.
