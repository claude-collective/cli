# D-41: Create Agents Inc Config Sub-Agent

## Refinement Document

**Status:** Ready for implementation
**Priority:** Medium
**Type:** Meta-agent creation (markdown + YAML files, no TypeScript)
**Estimated effort:** Medium (single session)

## Implementation Overview

Create the `config-manager` meta-agent at `src/agents/meta/config-manager/` — 7 markdown/YAML files, no TypeScript. The agent is a Sonnet-powered specialist that creates and validates `metadata.yaml`, `stacks.yaml`, `skills-matrix.yaml`, and `config.yaml` files. Its `workflow.md` embeds the full knowledge base (38 subcategory values, 18 agent names, SkillId format, all YAML schemas and field constraints). Uses Read, Write, Edit, Grep, Glob tools only (no Bash). Other agents delegate config tasks to it via the Task tool. Requires adding `"config-manager"` to the `agentNameSchema` enum in `schemas.ts` and the `AgentName` type, plus registering in `.claude-src/config.yaml`.

**Absorbs D-40 (skill registration):** Instead of a flags-only `agentsinc register` CLI command, the config-manager handles skill registration conversationally — read the skill's SKILL.md, infer category and description, generate `metadata.yaml`, and wire the skill into `config.yaml`. This is a better UX than asking users to specify `--category`, `--name`, `--description`, `--agents` etc. as flags.

---

## 1. Open Questions

### Scope Boundaries

| Question                                                     | Proposed Answer                                                                                                                                                                                  | Rationale                                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does this agent CREATE new skill directories?                | No. But it can REGISTER existing skills — read their SKILL.md to infer category/description, generate metadata.yaml, and wire into config.yaml. The skill-summoner creates actual skill content. | Separation of concerns -- config-manager handles YAML plumbing and registration, skill-summoner handles skill content creation.                   |
| Does it handle compilation?                                  | No. It tells the user to run `agentsinc compile` after making changes.                                                                                                                           | Compilation is a separate command. Config-manager is purely file manipulation.                                                                    |
| Does it handle agent-mappings.yaml?                          | No. `agent-mappings.yaml` was removed in D-43. All skills now assigned to all selected agents; stacks provide fine-grained mapping.                                                              | The TODO spec references this file but it no longer exists.                                                                                       |
| Should it handle `.claude-src/config.yaml` (project config)? | Yes, both `ProjectSourceConfig` fields AND `ProjectConfig` fields since they share the same physical file.                                                                                       | The file serves dual purpose and the agent needs to update both sets of fields (source/branding AND stack/skills/agents).                         |
| What model should it use?                                    | **Sonnet** -- this is structured YAML manipulation, not creative reasoning.                                                                                                                      | Unlike agent-summoner/skill-summoner which need opus for creative prompt writing, config-manager does rule-following schema-validated file edits. |
| Does it need Bash?                                           | No. Read, Write, Edit, Glob, Grep only.                                                                                                                                                          | Purely config file manipulation. No need to run commands, install packages, or execute scripts.                                                   |
| Where does it live?                                          | `src/agents/meta/config-manager/`                                                                                                                                                                | Follows existing meta-agent pattern (agent-summoner, skill-summoner, documentor all in `src/agents/meta/`).                                       |

### Out of Scope

These are explicitly NOT handled by this agent:

- Writing SKILL.md content (skill-summoner handles this)
- Writing agent prompt files (agent-summoner handles this)
- Running CLI commands like `agentsinc compile`
- Creating TypeScript code
- Modifying JSON schemas (those are generated from Zod schemas via a script)

---

## 2. Current State Analysis

### Existing Meta-Agent Patterns

All three existing meta-agents follow the same file structure:

```
src/agents/meta/{agent-name}/
  agent.yaml          # Agent definition (id, title, description, model, tools)
  intro.md            # Identity, expertise, modes of operation
  workflow.md          # Step-by-step process, investigation requirements, self-correction
  critical-requirements.md  # Non-negotiable constraints (top of compiled prompt)
  critical-reminders.md     # Emphatic reminders (bottom of compiled prompt)
  output-format.md    # Response structure template
  examples.md         # Concrete examples of good agent behavior
```

**Key observations from existing meta-agents:**

| Agent          | Model | Tools                                              | Distinctive Feature                                                                     |
| -------------- | ----- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| agent-summoner | opus  | Read, Write, Edit, Grep, Glob, Bash                | Three modes (Create/Improve/Compliance), references prompt-bible and architecture-bible |
| skill-summoner | opus  | Read, Write, Edit, Grep, Glob, WebSearch, WebFetch | External research via web tools, produces skill packages                                |
| documentor     | opus  | Read, Write, Glob, Grep, Bash                      | Incremental work, validation mode, tracks documentation drift                           |

### What Config Operations Currently Require Manual Knowledge

Today, when any agent (or user) needs to update config files, they must know:

1. **metadata.yaml structure** -- required fields (`category`, `author`, `displayName`, `cliDescription`, `usageGuidance`), valid `category` values from the 38 Subcategory union, author format (`@handle`), length limits (displayName max 30, cliDescription max 60, usageGuidance min 10)
2. **stacks.yaml structure** -- stack object shape (`id`, `name`, `description`, `agents`), agent-to-subcategory-to-skill nesting, skill assignment formats (bare string, object with `id`/`preloaded`, or array)
3. **skills-matrix.yaml structure** -- category definition fields, relationship rules (conflicts, discourages, recommends, requires, alternatives), skillAliases mapping
4. **config.yaml structure** -- dual-purpose file (ProjectSourceConfig + ProjectConfig fields), source resolution precedence, stack mapping format
5. **SkillId format** -- `${prefix}-${subcategory-part}-${name}` with 3+ dash-separated segments, valid prefixes (`web|api|cli|mobile|infra|meta|security`)
6. **CategoryPath format** -- domain-prefixed subcategory (e.g., `web-framework`), bare subcategory, or `"local"`
7. **Skill relationships** -- `requires`, `compatibleWith`, `conflictsWith`, `requiresSetup`, `providesSetupFor` and how they interrelate

This knowledge is scattered across schemas, types, and documentation. A dedicated agent centralizes it.

---

## 3. Agent Scope Definition

### What the Config Manager Handles

| Task                                     | Config Files Touched        | Example                                                                               |
| ---------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| Create metadata.yaml for a new skill     | `metadata.yaml`             | Given skill name "posthog-flags" in category "api-analytics", generate valid metadata |
| Update metadata.yaml fields              | `metadata.yaml`             | Add `compatibleWith` entries, update tags                                             |
| Add a new stack to stacks.yaml           | `config/stacks.yaml`        | Add a "vue-fullstack" stack with Vue + Pinia + Vitest                                 |
| Update an existing stack                 | `config/stacks.yaml`        | Add a new agent to an existing stack, change skill assignments                        |
| Add a new category to skills-matrix.yaml | `config/skills-matrix.yaml` | Add "web-cms" category with proper fields                                             |
| Add/update relationship rules            | `config/skills-matrix.yaml` | Add conflict between two skills, add recommendation                                   |
| Add/update skillAliases                  | `config/skills-matrix.yaml` | Map display name "tanstack-router" to full skill ID                                   |
| Update .claude-src/config.yaml           | `.claude-src/config.yaml`   | Add a new agent to the agents list, update stack mappings, add skills                 |
| Validate config files                    | Any of the above            | Check a metadata.yaml against the JSON schema, report issues                          |

### What It Does NOT Handle

| Task                        | Who Handles It | Why                                                                        |
| --------------------------- | -------------- | -------------------------------------------------------------------------- |
| Writing SKILL.md content    | skill-summoner | Config-manager does YAML, not prompt content                               |
| Writing agent prompt files  | agent-summoner | Same -- config vs content separation                                       |
| Running `agentsinc compile` | User / CLI     | Config-manager has no Bash tool                                            |
| Creating TypeScript types   | cli-developer  | Config-manager is not a code agent                                         |
| Updating JSON schemas       | cli-developer  | JSON schemas are generated from Zod via `scripts/generate-json-schemas.ts` |
| Creating skill directories  | skill-summoner | Config-manager writes into existing files, doesn't create skill packages   |

---

## 4. Agent File Structure

### Directory Layout

```
src/agents/meta/config-manager/
  agent.yaml
  intro.md
  workflow.md
  critical-requirements.md
  critical-reminders.md
  output-format.md
  examples.md
```

### agent.yaml

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/agents-inc/cli/main/src/schemas/agent.schema.json
id: config-manager
title: Config Manager Agent
description: Understands the Agents Inc CLI config system in depth - creates and validates metadata.yaml, stacks.yaml, skills-matrix.yaml, and config.yaml files with correct schemas and enum values
model: sonnet
tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
```

**Design decisions:**

- **Model: sonnet** -- Config manipulation is structured, rule-following work. Does not need opus-level reasoning.
- **No Bash** -- Purely file manipulation. No commands to run.
- **No WebSearch/WebFetch** -- All knowledge is embedded in the agent's prompt (schemas, enums, examples). No external research needed.

---

## 5. Knowledge Base

The agent's workflow.md must embed (or reference) the following knowledge so it can generate valid configs without hallucinating values.

### 5.1 Valid Subcategory Values (38 values)

The agent MUST know all valid `Subcategory` values. These are the keys used in `skills-matrix.yaml categories`, `stacks.yaml` agent configs, and `config.yaml` stack mappings.

Source: `src/cli/lib/schemas.ts` lines 70-109 (`SUBCATEGORY_VALUES`)

```
web-framework, web-styling, web-client-state, web-server-state, web-forms,
web-testing, web-ui-components, web-mocking, web-error-handling, web-i18n,
web-file-upload, web-files, web-utilities, web-realtime, web-animation,
web-pwa, web-accessibility, web-performance, web-base-framework,
api-api, api-database, api-auth, api-observability, api-analytics,
api-email, api-performance,
mobile-framework, mobile-platform,
shared-monorepo, shared-tooling, shared-security, shared-methodology,
shared-research, shared-reviewing, shared-ci-cd,
cli-framework, cli-prompts, cli-testing
```

### 5.2 Valid Domain Values (5 values)

Source: `src/cli/lib/schemas.ts` line 50 (`DOMAIN_VALUES`)

```
web, api, cli, mobile, shared
```

### 5.3 Valid Agent Names (18 values)

Source: `src/cli/lib/schemas.ts` lines 114-133

```
web-developer, api-developer, cli-developer, web-architecture,
agent-summoner, documentor, skill-summoner, cli-migrator,
pattern-scout, web-pattern-critique, web-pm, api-researcher,
web-researcher, api-reviewer, cli-reviewer, web-reviewer,
cli-tester, web-tester
```

Plus `config-manager` itself after implementation.

### 5.4 SkillId Format

Pattern: `^(web|api|cli|mobile|infra|meta|security)-.+-.+$`
Minimum 3 dash-separated segments. Examples:

- `web-framework-react`
- `api-database-drizzle`
- `meta-methodology-anti-over-engineering`

### 5.5 metadata.yaml Required Fields

Source: `src/schemas/metadata.schema.json`

| Field               | Type     | Constraints                                                          | Required |
| ------------------- | -------- | -------------------------------------------------------------------- | -------- |
| `category`          | string   | Must be a valid Subcategory (domain-prefixed, e.g., `web-framework`) | Yes      |
| `author`            | string   | Pattern: `^@[a-z][a-z0-9-]*$` (e.g., `@vince`)                       | Yes      |
| `displayName`       | string   | 1-30 chars                                                           | Yes      |
| `cliDescription`    | string   | 1-60 chars                                                           | Yes      |
| `usageGuidance`     | string   | Min 10 chars                                                         | Yes      |
| `categoryExclusive` | boolean  | Whether only one skill per category                                  | No       |
| `tags`              | string[] | Each tag: `^[a-z][a-z0-9-]*$`                                        | No       |
| `requires`          | string[] | Skill IDs this skill depends on                                      | No       |
| `compatibleWith`    | string[] | Framework skill IDs this works with                                  | No       |
| `conflictsWith`     | string[] | Skill IDs that cannot coexist                                        | No       |
| `requiresSetup`     | string[] | Setup skill IDs needed first                                         | No       |
| `providesSetupFor`  | string[] | Skills this setup skill configures                                   | No       |
| `contentHash`       | string   | `^[a-f0-9]{7}$` (7-char hex)                                         | No       |
| `updated`           | string   | ISO date                                                             | No       |
| `domain`            | string   | Override domain inference                                            | No       |
| `custom`            | boolean  | True for non-built-in skills                                         | No       |

### 5.6 stacks.yaml Structure

Source: `src/schemas/stacks.schema.json`, `src/cli/lib/schemas.ts` lines 683-697

```yaml
stacks:
  - id: kebab-case-stack-id      # Required
    name: Human-Readable Name     # Required
    description: Brief description # Required
    agents:                        # Required - maps agent names to subcategory skill assignments
      agent-name:
        subcategory-key: skill-id-string           # Bare string format
        subcategory-key:                            # Object format
          id: skill-id-string
          preloaded: true
        subcategory-key:                            # Array format (multiple skills)
          - id: skill-id-string
            preloaded: true
          - id: another-skill-id
    philosophy: Optional guiding philosophy text
```

**Three skill assignment formats** (all valid for the same subcategory key):

1. Bare string: `web-framework: web-framework-react`
2. Object: `web-framework: { id: web-framework-react, preloaded: true }`
3. Array: `web-framework: [{ id: web-framework-react, preloaded: true }, { id: web-framework-nextjs-app-router }]`

### 5.7 skills-matrix.yaml Category Structure

Source: `src/schemas/skills-matrix.schema.json`

```yaml
categories:
  subcategory-key: # Key must be a valid Subcategory
    id: subcategory-key # Must match the key
    displayName: Human Name
    description: Brief description
    domain: web # Optional, valid Domain value
    exclusive: true # Required boolean
    required: false # Required boolean
    order: 1 # Required number (display order within domain)
    icon: optional-icon # Optional string
    custom: false # Optional boolean
```

### 5.8 skills-matrix.yaml Relationship Types

```yaml
relationships:
  conflicts:
    - skills: [alias1, alias2] # Min 2. Uses display names (resolved to IDs at load time)
      reason: "Why they conflict"
  discourages:
    - skills: [alias1, alias2] # Min 2
      reason: "Why they're discouraged together"
  recommends:
    - when: alias1 # Single trigger skill
      suggest: [alias2, alias3] # Min 1 suggestion
      reason: "Why recommended"
  requires:
    - skill: alias1 # The skill that has the dependency
      needs: [alias2] # Min 1. Skills that must be selected first
      needsAny: false # Optional. true = OR logic, false/omitted = AND logic
      reason: "Why required"
  alternatives:
    - purpose: "Server state caching"
      skills: [alias1, alias2] # Min 1. Interchangeable skills
```

### 5.9 .claude-src/config.yaml Structure

This file serves two purposes. The agent must understand both:

**ProjectSourceConfig fields** (marketplace-level config):

```yaml
source: github:agents-inc/skills
author: "@vince"
marketplace: my-company
agentsSource: github:my-org/agents
sources:
  - name: source-name
    url: github:org/repo
    description: Optional description
    ref: optional-branch
boundSkills:
  - id: skill-id
    sourceUrl: github:org/repo
    sourceName: display-name
    boundTo: alias
branding:
  name: Custom CLI Name
  tagline: Custom tagline
skillsDir: src/skills
agentsDir: src/agents
stacksFile: config/stacks.yaml
matrixFile: config/skills-matrix.yaml
```

**ProjectConfig fields** (project-level config, same physical file):

```yaml
name: project-name # kebab-case
agents: # Agent IDs to compile
  - web-developer
  - api-developer
skills: # Flat list of all skill IDs
  - web-framework-react
  - web-state-zustand
installMode: local # "local" or "plugin"
expertMode: true # Optional boolean
domains: # Selected domains
  - web
  - api
selectedAgents: # From wizard
  - web-developer
stack: # Per-agent skill assignments (same format as stacks.yaml agents)
  web-developer:
    web-framework: web-framework-react
    web-styling: web-styling-scss-modules
source: github:agents-inc/skills
```

### 5.10 JSON Schema References

The agent should add `$schema` comments to generated YAML files:

| File                  | Schema URL Constant                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| metadata.yaml         | `SCHEMA_PATHS.metadata` = `https://raw.githubusercontent.com/agents-inc/cli/main/src/schemas/metadata.schema.json`                         |
| stacks.yaml           | `SCHEMA_PATHS.stacks` = `https://raw.githubusercontent.com/agents-inc/cli/main/src/schemas/stacks.schema.json`                             |
| skills-matrix.yaml    | `SCHEMA_PATHS.skillsMatrix` = `https://raw.githubusercontent.com/agents-inc/cli/main/src/schemas/skills-matrix.schema.json`                |
| config.yaml (project) | `SCHEMA_PATHS.projectConfig` = `https://raw.githubusercontent.com/agents-inc/cli/main/src/schemas/project-config.schema.json`              |
| config.yaml (source)  | `SCHEMA_PATHS.projectSourceConfig` = `https://raw.githubusercontent.com/agents-inc/cli/main/src/schemas/project-source-config.schema.json` |
| agent.yaml            | `SCHEMA_PATHS.agent` = `https://raw.githubusercontent.com/agents-inc/cli/main/src/schemas/agent.schema.json`                               |

Format: `# yaml-language-server: $schema={url}` as the first line.

### 5.11 STANDARD_FILES and STANDARD_DIRS

From `src/cli/consts.ts`:

| Constant                            | Value                       |
| ----------------------------------- | --------------------------- |
| `STANDARD_FILES.SKILL_MD`           | `SKILL.md`                  |
| `STANDARD_FILES.METADATA_YAML`      | `metadata.yaml`             |
| `STANDARD_FILES.CONFIG_YAML`        | `config.yaml`               |
| `STANDARD_FILES.SKILLS_MATRIX_YAML` | `skills-matrix.yaml`        |
| `STANDARD_FILES.AGENT_YAML`         | `agent.yaml`                |
| `SKILLS_MATRIX_PATH`                | `config/skills-matrix.yaml` |
| `STACKS_FILE_PATH`                  | `config/stacks.yaml`        |
| `CLAUDE_SRC_DIR`                    | `.claude-src`               |

---

## 6. Step-by-Step Implementation Plan

### Step 1: Create Agent Directory

```bash
mkdir -p src/agents/meta/config-manager/
```

### Step 2: Write agent.yaml

Create `src/agents/meta/config-manager/agent.yaml` with the definition from Section 4 above.

### Step 3: Write intro.md

Define the agent's identity:

- Expert in Agents Inc CLI configuration system
- Handles YAML file creation and validation
- Three modes: **Create** (generate new config files), **Update** (modify existing), **Validate** (check against schemas)
- Does NOT write skill content, agent prompts, or TypeScript code

### Step 4: Write workflow.md

This is the largest file. It must contain:

1. **Investigation process** -- Read existing config files before making changes
2. **The full knowledge base** from Section 5 (subcategory values, domains, agent names, SkillId format, metadata schema, stacks structure, matrix structure, config structure, schema URLs)
3. **Self-correction triggers** -- Stop if using bare subcategory names without domain prefix, stop if using unknown subcategory values, stop if metadata.yaml missing required fields
4. **Validation checklist** -- After every file write, verify against the known schema structure
5. **File-specific workflows** for each config file type (metadata.yaml, stacks.yaml, skills-matrix.yaml, config.yaml)

### Step 5: Write critical-requirements.md

Emphatic constraints placed at TOP of compiled prompt:

- MUST use domain-prefixed subcategory values (never bare names like "framework")
- MUST include yaml-language-server schema comment as first line
- MUST validate all required fields before writing
- MUST read existing file before updating (never overwrite blindly)
- MUST use SkillId format with 3+ segments (never display names in metadata)
- MUST verify writes by re-reading files after editing

### Step 6: Write critical-reminders.md

Same constraints repeated at BOTTOM of compiled prompt (self-reminder loop closure).

### Step 7: Write output-format.md

Define structured response format:

- **File:** which file was created/modified
- **Changes:** what was added/modified
- **Validation:** schema compliance check results
- **Next steps:** what the user should do (e.g., run `agentsinc compile`)

### Step 8: Write examples.md

Concrete examples of:

1. Creating a metadata.yaml for a new skill
2. Adding a stack to stacks.yaml
3. Adding a category to skills-matrix.yaml
4. Updating config.yaml stack mappings
5. Validating a metadata.yaml and reporting errors

### Step 9: Register in .claude-src/config.yaml

Add `config-manager` to the `agents` list in `.claude-src/config.yaml`.

Add `config-manager` to the `selectedAgents` list.

### Step 10: Update schemas.ts AgentName

Add `"config-manager"` to the `agentNameSchema` enum in `src/cli/lib/schemas.ts` (line 114).

Add `"config-manager"` to the `AgentName` union type in the appropriate types file.

### Step 11: Compile and Verify

```bash
agentsinc compile
```

Verify:

- Agent compiles without errors
- Compiled output appears in `.claude/agents/config-manager.md`
- All required XML tags present in compiled output

---

## 7. Integration Points

### How Other Agents Delegate to It

Other agents use the Task tool to invoke config-manager:

```
Task: config-manager
"Create a metadata.yaml for a new skill called 'tanstack-router' in category 'web-framework' by author @vince"
```

```
Task: config-manager
"Add the skill 'web-framework-tanstack-router' to the nextjs-fullstack stack under web-developer agent, subcategory web-framework"
```

```
Task: config-manager
"Validate the metadata.yaml at src/skills/web-framework-tanstack-router/metadata.yaml"
```

### Key Delegation Patterns

| Caller                           | Delegates What                                           | Example                                                                              |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| agent-summoner                   | After creating an agent, delegate config registration    | "Add config-manager to .claude-src/config.yaml agents list and create stack entries" |
| skill-summoner                   | After creating skill content, delegate metadata creation | "Create metadata.yaml for this new skill with these properties"                      |
| D-40 `register` command (future) | Automated config updates during skill registration       | "Add this skill to skills-matrix.yaml and update stacks"                             |
| User directly                    | Ad-hoc config tasks                                      | "Add a new stack for Vue + Nuxt"                                                     |

### How Users Invoke It

Users invoke via Claude Code's Task tool or slash command:

```
/task config-manager "Create metadata.yaml for skill xyz..."
```

Or via delegation from another agent task.

---

## 8. Validation Strategy

### Schema Validation Approach

Since the agent cannot run TypeScript/Zod, it validates by **knowledge of the schema rules embedded in its prompt**. The workflow.md must contain:

1. **Required field checklists** for each file type
2. **Valid enum value lists** (subcategories, domains, agent names)
3. **Format patterns** (SkillId regex, author format, tag format)
4. **Structural rules** (stacks need at least one agent, categories need id matching key, etc.)

### Post-Write Verification

After every file write/edit, the agent MUST:

1. Re-read the file using the Read tool
2. Check that all required fields are present
3. Check that enum values match the known valid sets
4. Check that the yaml-language-server schema comment is present
5. Report any validation issues found

### Limitation

The agent cannot run `agentsinc validate` or execute Zod schema validation directly. It relies on embedded knowledge. For critical operations, the agent should instruct the user to run validation:

> "I've created the metadata.yaml. To verify it against the full JSON schema, run: `agentsinc validate`"

---

## 9. Test Plan

### Manual Testing (Meta-Agent)

Since this is a meta-agent (markdown + YAML), testing is primarily manual:

1. **Compile test**: Run `agentsinc compile` and verify the agent appears in `.claude/agents/`
2. **Metadata creation test**: Ask the agent to create a metadata.yaml for a hypothetical skill. Verify:
   - yaml-language-server schema comment present
   - All 5 required fields present and valid
   - Category is domain-prefixed
   - Author format is `@handle`
3. **Stacks update test**: Ask the agent to add a stack entry. Verify:
   - Valid structure with id, name, description, agents
   - Subcategory keys are valid Subcategory values
   - Skill IDs follow the 3-segment format
4. **Matrix category test**: Ask the agent to add a category. Verify:
   - All required fields present (id, displayName, description, exclusive, required, order)
   - Domain is valid
   - Key matches id field
5. **Validation test**: Give the agent an invalid metadata.yaml and ask it to validate. Verify:
   - It catches missing required fields
   - It catches invalid category values
   - It catches invalid author format
6. **Refusal test**: Ask the agent to write SKILL.md content or TypeScript code. Verify it refuses and defers to the appropriate agent.

### Acceptance Criteria (from TODO spec)

- [ ] Can create a valid `metadata.yaml` from a skill name and category
- [ ] Can register an existing skill: read its SKILL.md, infer category/description, generate metadata.yaml, wire into config.yaml (replaces D-40)
- [ ] Can add a new stack to `stacks.yaml` with correct agent/subcategory/skill structure
- [ ] Can add a new category to `skills-matrix.yaml` with proper schema
- [ ] Validates all output against schema rules (embedded knowledge)
- [ ] Refuses to use bare subcategory names (enforces domain-prefix)
- [ ] Other agents can delegate config tasks to it via the Task tool

### Additional Quality Checks

- [ ] Agent compiles without errors
- [ ] Compiled output has all required sections
- [ ] No hardcoded paths that would break in other environments
- [ ] All enum values in the agent's knowledge base match current source of truth

---

## 10. Files Created Summary

| File                                                      | Purpose                                    | Estimated Size |
| --------------------------------------------------------- | ------------------------------------------ | -------------- |
| `src/agents/meta/config-manager/agent.yaml`               | Agent definition                           | ~10 lines      |
| `src/agents/meta/config-manager/intro.md`                 | Identity and scope                         | ~20 lines      |
| `src/agents/meta/config-manager/workflow.md`              | Full workflow with embedded knowledge base | ~400-500 lines |
| `src/agents/meta/config-manager/critical-requirements.md` | Top-of-prompt constraints                  | ~15 lines      |
| `src/agents/meta/config-manager/critical-reminders.md`    | Bottom-of-prompt reminders                 | ~20 lines      |
| `src/agents/meta/config-manager/output-format.md`         | Response structure template                | ~40 lines      |
| `src/agents/meta/config-manager/examples.md`              | Concrete examples                          | ~150 lines     |

**Code changes (minor):**
| File | Change |
|------|--------|
| `.claude-src/config.yaml` | Add `config-manager` to `agents` and `selectedAgents` lists |
| `src/cli/lib/schemas.ts` | Add `"config-manager"` to `agentNameSchema` enum |
| `src/cli/types/agents.ts` (line 5-31) | Add `"config-manager"` to `AgentName` union type (Meta section, after `"skill-summoner"`) |

---

## 11. Notes for Implementer

### Key Difference from Other Meta-Agents

- **agent-summoner** and **skill-summoner** use opus because they do creative prompt engineering work.
- **config-manager** uses **sonnet** because it does structured, rule-following YAML manipulation. The "creativity" is already encoded in the schema rules.

### The Biggest Risk

The embedded knowledge (subcategory values, agent names, etc.) will drift as the codebase evolves. To mitigate:

1. The workflow.md should include instructions to **always read the actual `schemas.ts` file** before generating config, rather than relying solely on embedded lists.
2. The agent should Grep for `SUBCATEGORY_VALUES` and `agentNameSchema` as part of its investigation step.
3. The embedded lists serve as a **fast reference** but the agent should verify against source when precision matters.

### agent-mappings.yaml Is Gone

The D-41 TODO spec mentions `agent-mappings.yaml`. This file was removed in D-43. The config-manager agent does NOT need to handle it. All skills are now assigned to all selected agents; stacks provide fine-grained mapping. The implementer should not add any agent-mappings references.

### Stack Entries in config.yaml

The `.claude-src/config.yaml` `stack` section uses the SAME format as `stacks.yaml` agent entries. The config-manager should understand that these are the same schema and can generate both.

### Schema Comment Convention

Every generated YAML file must start with:

```yaml
# yaml-language-server: $schema={schema-url}
```

This enables IDE validation via yaml-language-server.
