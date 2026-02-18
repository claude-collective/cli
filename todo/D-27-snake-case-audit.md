# D-27: Snake_case to camelCase Migration Audit

## Overview

27 snake_case field names across YAML configs, metadata files, JSON schemas, Zod schemas, TypeScript types, and property accesses. All CLI/user-defined fields should migrate to camelCase. Fields that originate from Claude's native output format are excluded.

## Fields to Migrate (27 total)

### Group 1: Project Config (5 fields)

| snake_case | camelCase | File types |
|---|---|---|
| `agents_source` | `agentsSource` | config.yaml, types, schemas |
| `skills_dir` | `skillsDir` | config.yaml, types, schemas |
| `agents_dir` | `agentsDir` | config.yaml, types, schemas |
| `stacks_file` | `stacksFile` | config.yaml, types, schemas |
| `matrix_file` | `matrixFile` | config.yaml, types, schemas |

**Touchpoints:**
- `src/cli/types/config.ts` (type definition)
- `src/cli/lib/schemas.ts` (Zod loader & validation schemas)
- `src/schemas/project-config.schema.json`
- `src/schemas/project-source-config.schema.json`
- `src/cli/lib/loading/source-loader.ts` (property access)
- `src/cli/lib/configuration/config.ts` (property access)
- `src/cli/lib/__tests__/fixtures/configs/config-with-all-fields.yaml` (test fixture)

### Group 2: Skill Metadata (11 fields)

| snake_case | camelCase | File types |
|---|---|---|
| `category_exclusive` | `categoryExclusive` | metadata.yaml, types, schemas |
| `cli_name` | `cliName` | metadata.yaml, schemas |
| `cli_description` | `cliDescription` | metadata.yaml, schemas |
| `usage_guidance` | `usageGuidance` | metadata.yaml, types, schemas |
| `compatible_with` | `compatibleWith` | metadata.yaml, types, schemas |
| `conflicts_with` | `conflictsWith` | metadata.yaml, types, schemas |
| `requires_setup` | `requiresSetup` | metadata.yaml, types, schemas |
| `provides_setup_for` | `providesSetupFor` | metadata.yaml, types, schemas |
| `content_hash` | `contentHash` | metadata.yaml, types, schemas |
| `forked_from` | `forkedFrom` | metadata.yaml, types, schemas |
| `forked_from.skill_id` | `forkedFrom.skillId` | metadata.yaml, types, schemas |

**Touchpoints:**
- `src/cli/types/skills.ts` (type definitions)
- `src/cli/lib/schemas.ts` (Zod loader, validation, & local skill schemas)
- `src/schemas/metadata.schema.json` (16 properties)
- `src/cli/lib/skills/local-skill-loader.ts` (7 property accesses)
- `src/cli/lib/matrix/matrix-loader.ts` (6 property accesses)
- `src/cli/lib/skills/skill-metadata.ts` (forked_from, content_hash access & assignment)
- `src/cli/commands/import/skill.ts` (forked_from, content_hash usage)
- `src/cli/lib/metadata-keys.ts` (constant definitions: CLI_NAME, CLI_DESCRIPTION, USAGE_GUIDANCE)
- `src/cli/lib/__tests__/helpers.ts` (test factory: category_exclusive)
- Multiple test files (assertions on forked_from, content_hash)

### Group 3: Skills Matrix (3 fields)

| snake_case | camelCase | File types |
|---|---|---|
| `parent_domain` | `parentDomain` | skills-matrix.yaml, types, schemas |
| `needs_any` | `needsAny` | skills-matrix.yaml, types, schemas |
| `skill_aliases` | `skillAliases` | skills-matrix.yaml, types, schemas |

**Touchpoints:**
- `src/cli/types/matrix.ts` (type definitions)
- `src/cli/lib/schemas.ts` (Zod schemas)
- `src/schemas/skills-matrix.schema.json` (3 properties)
- `config/skills-matrix.yaml` (YAML keys)
- `src/cli/stores/wizard-store.ts` (parent_domain property access)
- `src/cli/stores/wizard-store.test.ts` (test assertions)
- `src/cli/lib/matrix/matrix-loader.ts` (skill_aliases, needs_any property access)

### Group 4: Agent Config (3 fields)

| snake_case | camelCase | File types |
|---|---|---|
| `disallowed_tools` | `disallowedTools` | agent.yaml, types, schemas |
| `permission_mode` | `permissionMode` | agent.yaml, types, schemas |
| `output_format` | `outputFormat` | agent.yaml, types, schemas |

**Touchpoints:**
- `src/cli/types/agents.ts` (type definitions)
- `src/cli/lib/schemas.ts` (Zod loader & validation schemas)
- `src/schemas/agent.schema.json` (3 properties)
- `src/cli/lib/compiler.ts` (property access: disallowed_tools, permission_mode)
- `src/cli/lib/compiler.test.ts` (test assertions)
- `src/cli/lib/__tests__/fixtures/create-test-source.ts` (Liquid template variables)

### Group 5: Stack Config (1 field)

| snake_case | camelCase | File types |
|---|---|---|
| `agent_skills` | `agentSkills` | stacks.yaml, schemas |

**Touchpoints:**
- `src/cli/lib/schemas.ts` (Zod validation schema)
- `src/schemas/stack.schema.json` (1 property)

### Group 6: Agent Mappings (4 fields)

| snake_case | camelCase | File types |
|---|---|---|
| `skill_to_agents` | `skillToAgents` | agent-mappings.yaml, types, schemas |
| `preloaded_skills` | `preloadedSkills` | agent-mappings.yaml, types, schemas |
| `agent_skill_prefixes` | `agentSkillPrefixes` | agent-mappings.yaml, types, schemas |
| `subcategory_aliases` | `subcategoryAliases` | agent-mappings.yaml, types, schemas |

**Touchpoints:**
- `src/cli/lib/loading/defaults-loader.ts` (type definitions & property access)
- `src/cli/lib/schemas.ts` (Zod schemas)
- `src/cli/defaults/agent-mappings.yaml` (YAML keys)
- `src/cli/lib/configuration/config-generator.ts` (skill_to_agents access)
- `src/cli/lib/loading/defaults-loader.test.ts` (test data & assertions)
- `src/cli/lib/__tests__/fixtures/create-test-source.ts` (Liquid template: preloaded_skills)

---

## Migration Layers (order matters)

### Layer 1: Types (change first — cascading impact)

| File | Fields | Notes |
|---|---|---|
| `src/cli/types/config.ts` | agents_source | ProjectConfig, ProjectSourceConfig |
| `src/cli/types/skills.ts` | category_exclusive, usage_guidance, compatible_with, conflicts_with, requires_setup, provides_setup_for | SkillMetadataConfig, ExtractedSkillMetadata |
| `src/cli/types/matrix.ts` | parent_domain, needs_any, skill_aliases | CategoryDefinition, SkillRequirement, SkillsMatrixConfig |
| `src/cli/types/agents.ts` | disallowed_tools, permission_mode, output_format | AgentDefinition |

### Layer 2: Zod Schemas

| File | Count | Notes |
|---|---|---|
| `src/cli/lib/schemas.ts` | 31 field declarations | Loader schemas (lenient), validation schemas (strict), and generation schemas |

### Layer 3: JSON Schemas (auto-generated from Zod)

| File | Properties |
|---|---|
| `src/schemas/metadata.schema.json` | 16 properties |
| `src/schemas/agent.schema.json` | 3 properties |
| `src/schemas/skills-matrix.schema.json` | 3 properties |
| `src/schemas/project-config.schema.json` | 1 property |
| `src/schemas/project-source-config.schema.json` | 5 properties |
| `src/schemas/stack.schema.json` | 1 property |

### Layer 4: YAML Config Files

| File | Keys |
|---|---|
| `config/skills-matrix.yaml` | parent_domain, needs_any, skill_aliases |
| `src/cli/defaults/agent-mappings.yaml` | skill_to_agents, preloaded_skills, agent_skill_prefixes, subcategory_aliases |
| All `agent.yaml` files | disallowed_tools, permission_mode, output_format |
| All `metadata.yaml` files | category_exclusive, cli_name, cli_description, usage_guidance, compatible_with, conflicts_with, requires_setup, provides_setup_for, content_hash, forked_from |

### Layer 5: Property Access in Implementation

| File | Fields accessed |
|---|---|
| `src/cli/lib/skills/local-skill-loader.ts` | category_exclusive, cli_name, compatible_with, conflicts_with, requires_setup, provides_setup_for, usage_guidance |
| `src/cli/lib/matrix/matrix-loader.ts` | skill_aliases, needs_any, compatible_with, conflicts_with, requires_setup, provides_setup_for, category_exclusive |
| `src/cli/lib/skills/skill-metadata.ts` | forked_from, content_hash, skill_id |
| `src/cli/lib/compiler.ts` | disallowed_tools, permission_mode |
| `src/cli/lib/loading/defaults-loader.ts` | skill_to_agents, preloaded_skills, agent_skill_prefixes, subcategory_aliases |
| `src/cli/lib/configuration/config-generator.ts` | skill_to_agents |
| `src/cli/lib/loading/source-loader.ts` | agents_source |
| `src/cli/stores/wizard-store.ts` | parent_domain |
| `src/cli/commands/import/skill.ts` | forked_from, content_hash |
| `src/cli/lib/metadata-keys.ts` | CLI_NAME, CLI_DESCRIPTION, USAGE_GUIDANCE constants |

### Layer 6: Test Files

| File | Notes |
|---|---|
| `src/cli/lib/__tests__/helpers.ts` | createMockSkill: category_exclusive |
| `src/cli/lib/__tests__/fixtures/create-test-source.ts` | Liquid template variables: permission_mode, preloaded_skills |
| `src/cli/lib/compiler.test.ts` | permission_mode assertions |
| `src/cli/stores/wizard-store.test.ts` | parent_domain test data |
| `src/cli/lib/loading/defaults-loader.test.ts` | All 4 mapping fields |
| Multiple test files | forked_from, content_hash assertions |

---

## Special Considerations

### Liquid Templates
`create-test-source.ts` generates agent YAML with Liquid syntax:
```
{{ agent.permission_mode }}
{{ agent.preloaded_skills }}
```
These must change to `{{ agent.permissionMode }}` etc., AND the data passed to the template must use the new keys.

### metadata-keys.ts Constants
`src/cli/lib/metadata-keys.ts` defines string constants for YAML key names:
```typescript
CLI_NAME: "cli_name"       → "cliName"
CLI_DESCRIPTION: "cli_description" → "cliDescription"
USAGE_GUIDANCE: "usage_guidance"   → "usageGuidance"
```

### Marketplace Compatibility
Skills from the external marketplace source also use these YAML field names in their `metadata.yaml` files. Changing the CLI parser means the marketplace source must also update, OR the CLI needs a temporary compatibility layer during migration. Given the CLAUDE.md rule against backward-compatibility shims and the pre-1.0 status, a clean break is preferred with a coordinated marketplace update.

### JSON Schema URLs
JSON schemas are published at `raw.githubusercontent.com` for IDE validation. Regenerating schemas after the rename will update the published URLs' content. Existing consumer projects with cached schemas may see validation errors until they refresh.

---

## Estimated Impact

- **27 fields** renamed
- **~50 files** modified (types, schemas, implementation, tests, YAML configs)
- **6 JSON schemas** regenerated
- **~100+ YAML files** in the marketplace source (external repo — metadata.yaml in each skill)
- **4 YAML config files** in this repo
