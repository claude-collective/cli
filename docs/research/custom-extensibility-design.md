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
7. [Open Questions](#open-questions)

---

## Problem Statement

The CLI currently has tightly constrained union types for all core entities:

| Entity        | Type          | Constraint                                                                        |
| ------------- | ------------- | --------------------------------------------------------------------------------- |
| Skill IDs     | `SkillId`     | Must match `${SkillIdPrefix}-${string}-${string}` where prefix is one of 7 values |
| Agent names   | `AgentName`   | Closed union of 20 built-in names                                                 |
| Subcategories | `Subcategory` | Closed union of 37 values                                                         |
| Domains       | `Domain`      | Closed union of 5 values (`web`, `api`, `cli`, `mobile`, `shared`)                |

These constraints serve the built-in skill marketplace well but block users who need custom entities in their private marketplaces. The existing `SkillSourceType === "private"` flag only marks where a skill came from, not whether it was custom-created outside the CLI's built-in vocabulary.

### Goals

1. Let users create entities with IDs outside the built-in unions
2. Distinguish custom entities from built-in ones at runtime
3. Validate custom entities via local schemas that extend (not replace) the CLI's base schemas
4. Skip strict enum validation for custom entities while preserving structural and reference-integrity checks

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
| `custom: true`      | Too generic — could be confused with other "custom" concepts         |
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

But critically, `agentSkillPrefixes` is only used in one place: `preselectAgentsFromDomains()` in the wizard store. And that function does NOT parse skill ID prefixes -- it maps selected **domains** to agent lists via the hardcoded `DOMAIN_AGENTS` constant. The `agentSkillPrefixes` config is loaded but only consumed as informational data, not for prefix parsing.

#### 3. Agent Routing via Skill Path (NOT prefix)

The `getAgentsForSkill()` function in `config-generator.ts` matches against the skill's **directory path** (e.g., `web/framework/react`) using glob patterns like `"web/*"`, not against the skill ID prefix. The path comes from `ExtractedSkillMetadata.path` which is set to `skills/${directoryPath}/` in the matrix-loader.

#### 4. Display Name Fallback (1 location)

```typescript
// stores/wizard-store.ts:119
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
- Which agents receive the skill (determined by `skillToAgents` path patterns)
- How the skill appears in the wizard (determined by category/subcategory)

### Recommendation: Allow Custom Prefixes

Custom skills should be allowed to use **any** kebab-case prefix, as long as:

1. The prefix maps to a declared custom domain (if one exists), OR
2. The skill's `category` field explicitly declares its subcategory placement

This means `acme-pipeline-deploy` is valid if:

- There's a custom domain `acme` with custom categories, OR
- The skill's `metadata.yaml` has `category: acme-pipeline` pointing to a custom subcategory

**Implementation approach:**

For custom entities (`customSkill: true`), relax the `SKILL_ID_PATTERN` to accept any kebab-case ID with at least 3 segments:

```typescript
// Proposed: general pattern for custom skills
const CUSTOM_SKILL_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+){2,}$/;

// At runtime, check:
// 1. If entity has customSkill: true -> validate against CUSTOM_SKILL_ID_PATTERN
// 2. If entity does NOT have customSkill: true -> validate against existing SKILL_ID_PATTERN
```

**What we do NOT do:**

- We do not remove the built-in prefix constraint for non-custom skills
- We do not require custom skills to declare their prefix in a registry
- We do not parse the prefix from custom skill IDs for any routing logic (the `category` field handles routing)

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
| Skill ID format        | Must match `SKILL_ID_PATTERN` (7 prefixes)    | Must match `CUSTOM_SKILL_ID_PATTERN` (any kebab-case, 3+ segments)   |
| Agent name             | Must be in `AgentName` union                  | Must be kebab-case, no other constraint                              |
| Category               | Must be in `Subcategory` union                | Must be kebab-case, optionally declared in `custom-definitions.json` |
| Domain                 | Must be in `Domain` union                     | Must be kebab-case, optionally declared in `custom-definitions.json` |
| Structural fields      | `description`, `author`, `cliName` required   | Same -- structural requirements unchanged                            |
| Relationship refs      | Resolved via `displayNameToId` and alias maps | Same -- references validated post-merge                              |
| `additionalProperties` | Strict schemas reject unknown fields          | Same -- `customSkill` is added to the schema's known properties      |

#### What Does NOT Change

1. **Structural validation** -- a custom skill still needs `cliName`, `cliDescription`, `usageGuidance`, `author`, and `category` in its `metadata.yaml`
2. **Post-merge reference checking** -- if a custom skill declares `requires: ["acme-pipeline-setup"]`, the merge step verifies that `acme-pipeline-setup` actually exists in the loaded skill set
3. **Compilation pipeline** -- `buildResolvedSkill()` works identically for custom skills; the category determines agent routing, not the ID prefix
4. **Schema validation command** (`agentsinc validate`) -- adds a `--custom-skill` flag or auto-detects from the entity's `customSkill: true` to apply relaxed enum checking

#### Integration with Existing Schemas

The lenient loader schemas already do most of the work:

```typescript
// skillFrontmatterLoaderSchema already accepts any string for `name`:
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

- `SKILL_ID_PATTERN` check skipped when `customSkill: true`; `CUSTOM_SKILL_ID_PATTERN` used instead
- `category` field accepts any kebab-case string, not just built-in `Subcategory` values
- All structural fields still required

**Wizard UI changes:**

- Custom skills appear in their custom category (if the category is declared in `custom-definitions.json`)
- If the custom category's domain is not in the wizard's `Domain` union, it appears in a new domain tab
- The wizard already handles dynamic categories via `CategoryMap` -- custom categories just need to be added to the matrix's `categories` map during loading

**Compilation pipeline changes:**

- None. `buildResolvedSkill()` uses `category` for routing, which works with any string value
- `getAgentsForSkill()` falls back to `DEFAULT_AGENTS` when no `skillToAgents` pattern matches, which is the correct behavior for custom skills unless the user also adds custom `skillToAgents` mappings

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
- Stack configs can reference custom agent names since `stackAgentConfigSchema` uses `z.record(z.string(), ...)` for agent keys

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

- Custom categories rendered in their domain's tab
- Custom domains rendered as additional tabs (after built-in domains)
- `CategoryMap` already uses `Partial<Record<Subcategory, CategoryDefinition>>` -- for custom categories, the key simply does not match the `Subcategory` union, which works with the `Partial` wrapper at runtime (the type constraint is compile-time only)

**Compilation pipeline changes:**

- None needed. The matrix-loader already processes `CategoryMap` entries generically

### Domains

**Config location:** `custom-definitions.json`

Domains are not currently a first-class config entity -- they're derived from the `domain` field in `CategoryDefinition`. Custom domains emerge naturally when a custom category declares a `domain` value outside the built-in `Domain` union.

**Validation changes:**

- `domainSchema` (enum check) skipped for categories with `customSkill: true`
- The wizard store's `ALL_DOMAINS` constant and `DOMAIN_AGENTS` mapping would need to be dynamically computed from the loaded matrix rather than hardcoded

**Wizard UI changes:**

- Custom domains appear as additional tabs in the Build step
- Custom domains have no built-in agent preselection (no entries in `DOMAIN_AGENTS`) -- the user selects agents manually or the custom `custom-definitions.json` provides agent mappings

**Compilation pipeline changes:**

- None. Domains are a wizard concept, not a compilation concept

---

## Implementation Phases

### Phase 1: Foundation (`customSkill` property + relaxed validation)

1. Add `customSkill: boolean` to `SkillMetadataConfig`, `AgentYamlConfig`, `CategoryDefinition`
2. Add `customSkill` to all JSON schemas and Zod schemas (loader + validation)
3. Create `CUSTOM_SKILL_ID_PATTERN` and conditional validation logic
4. Update `extractAllSkills()` to pass through `customSkill` flag
5. Update `agentsinc validate` to respect `customSkill: true`

### Phase 2: Local schema infrastructure

1. Define `custom-definitions.json` schema
2. Add `loadCustomDefinitions()` loader
3. Update `loadSkillsMatrix()` to merge custom categories from `custom-definitions.json`
4. Update `new skill` / `new agent` to auto-detect marketplace context and set `customSkill: true`

### Phase 3: Wizard support

1. Make `ALL_DOMAINS` and `DOMAIN_AGENTS` dynamic (computed from loaded matrix)
2. Render custom domain tabs in the Build step
3. Surface custom agents in the Agents step
4. Handle custom categories in the category grid

### Phase 4: Schema scaffolding

1. Add `agentsinc new marketplace` command (or extend existing setup)
2. Scaffold `.claude-src/schemas/` with `$ref` to pinned CLI version
3. Auto-update local schema enums on `new skill` / `new agent`

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
- (b) Add a `CustomSkillId` type (`${string}-${string}-${string}`) and union it: `SkillId | CustomSkillId`
- (c) Keep `SkillId` strict for internal use; boundary casts accept `string` and validate at runtime

**Lean:** (c). This matches the existing pattern where boundary casts with Zod validation are already used. The `customSkill: true` flag determines which regex to apply at the boundary. Internal code continues to use `SkillId` -- custom IDs that pass the relaxed regex are cast to `SkillId` at the parse boundary with a comment explaining why.

### Q5: Wizard tab ordering for custom domains

Built-in domains have a fixed order: web, api, cli, mobile, shared. Where do custom domains appear?

**Lean:** After all built-in domains, in the order declared in `custom-definitions.json`. The `order` field on custom categories controls intra-domain ordering.

### Q6: Should the CLI ship a `custom-definitions.schema.json`?

For IDE validation of the `custom-definitions.json` file itself.

**Lean:** Yes. This is a small addition and dramatically improves the authoring experience.
