# Agent System

**Last Updated:** 2026-03-28

## Overview

**Purpose:** Agent template system that defines AI agent roles, compiles partial markdown files into full prompt documents via LiquidJS, and maps agents to wizard domains.
**Entry Point:** `src/agents/` (agent source files), `src/cli/lib/compiler.ts` (compilation)
**Key Files:** 23 agents across 7 categories, 1 main template, 6 methodology partials, 1 JSON schema

## File Structure

```
src/agents/
  _templates/
    agent.liquid                              # Main Liquid template assembling all partials
    methodologies/
      investigation-requirements.liquid       # "Never speculate" investigation protocol
      anti-over-engineering.liquid            # Surgical implementation, no new abstractions
      write-verification.liquid               # Re-read files after editing protocol
      success-criteria.liquid                 # Measurable "done" criteria template
      context-management.liquid               # .claude/ session continuity protocol
      improvement-protocol.liquid             # Self-improvement workflow for agents
  developer/
    ai-developer/                             # AI feature implementation
    api-developer/                            # Backend feature implementation
    cli-developer/                            # CLI feature implementation
    web-architecture/                         # App scaffolding in monorepo
    web-developer/                            # Frontend feature implementation
  meta/
    agent-summoner/                           # Creates/improves agents and skills
    codex-keeper/                             # AI-focused reference documentation
    convention-keeper/                        # Code quality standards
    skill-summoner/                           # Creates technology-specific skills
  pattern/
    pattern-scout/                            # Extracts codebase patterns
    web-pattern-critique/                     # Reviews patterns in UI code
  planning/
    api-pm/                                   # Backend implementation specs
    web-pm/                                   # Frontend implementation specs
  researcher/
    api-researcher/                           # Read-only backend research
    web-researcher/                           # Read-only frontend research
  reviewer/
    ai-reviewer/                              # Reviews AI integration code
    api-reviewer/                             # Reviews backend code
    cli-reviewer/                             # Reviews CLI code
    infra-reviewer/                           # Reviews infrastructure code
    web-reviewer/                             # Reviews UI component code
  tester/
    api-tester/                               # Tests backend features
    cli-tester/                               # Tests CLI features
    web-tester/                               # Tests frontend features
```

Each agent directory contains:

| File                       | Required | Constant                                | Purpose                                             |
| -------------------------- | -------- | --------------------------------------- | --------------------------------------------------- |
| `metadata.yaml`            | Yes      | `STANDARD_FILES.AGENT_METADATA_YAML`    | Agent identity, model, tools (parsed by Zod schema) |
| `identity.md`              | Yes      | `STANDARD_FILES.IDENTITY_MD`            | Role description, mission, domain scope             |
| `playbook.md`              | Yes      | `STANDARD_FILES.PLAYBOOK_MD`            | Detailed workflow, patterns, decision frameworks     |
| `output.md`                | No       | `STANDARD_FILES.OUTPUT_MD`              | Output format specification (falls back to category) |
| `critical-requirements.md` | No       | `STANDARD_FILES.CRITICAL_REQUIREMENTS_MD` | Top-of-prompt critical rules                        |
| `critical-reminders.md`    | No       | `STANDARD_FILES.CRITICAL_REMINDERS_MD`  | Bottom-of-prompt reminders                          |

Constants defined at `src/cli/consts.ts:50-60`.

## Agent Inventory

### developer/ (5 agents)

| Agent              | Model  | Tools                                    | Description                                                  |
| ------------------ | ------ | ---------------------------------------- | ------------------------------------------------------------ |
| `ai-developer`     | opus   | Read, Write, Edit, Grep, Glob, Bash      | AI features: RAG, agent loops, tool calling, prompt engineering |
| `api-developer`    | opus   | Read, Write, Edit, Grep, Glob, Bash      | Backend: API routes, DB operations, auth, middleware         |
| `cli-developer`    | opus   | Read, Write, Edit, Grep, Glob, Bash      | CLI: commands, interactive prompts, config hierarchies       |
| `web-architecture` | opus   | Read, Write, Edit, Grep, Glob, Bash      | Scaffolds new apps with foundational patterns                |
| `web-developer`    | opus   | Read, Write, Edit, Grep, Glob, Bash      | Frontend: UI components, TypeScript, styling, client state   |

### meta/ (4 agents)

| Agent               | Model  | Tools                                       | Description                                              |
| ------------------- | ------ | ------------------------------------------- | -------------------------------------------------------- |
| `agent-summoner`    | opus   | Read, Write, Edit, Grep, Glob, Bash         | Creates/improves agents and skills                       |
| `codex-keeper`      | opus   | Read, Write, Edit, Glob, Grep, Bash         | AI-focused reference documentation                       |
| `convention-keeper` | sonnet | Read, Write, Edit, Grep, Glob, Bash         | Code quality and testing standards                       |
| `skill-summoner`    | opus   | Read, Write, Edit, Grep, Glob, WebSearch, WebFetch | Creates technology-specific skills via web research |

### pattern/ (2 agents)

| Agent                 | Model | Tools                        | Description                                                |
| --------------------- | ----- | ---------------------------- | ---------------------------------------------------------- |
| `pattern-scout`       | opus  | Read, Grep, Glob, Bash       | Extracts all patterns from monorepo (15+ categories)       |
| `web-pattern-critique` | opus | Read, Write, Edit, Grep, Glob, Bash | Reviews UI code patterns                            |

### planning/ (2 agents)

| Agent    | Model | Tools                                   | Description                                                |
| -------- | ----- | --------------------------------------- | ---------------------------------------------------------- |
| `api-pm` | opus  | Read, Write, Edit, Grep, Glob, Bash     | Backend implementation specs: API contracts, DB schema     |
| `web-pm` | opus  | Read, Write, Edit, Grep, Glob, Bash     | Frontend implementation specs: architecture, requirements  |

### researcher/ (2 agents)

| Agent            | Model | Tools                  | Description                                                 |
| ---------------- | ----- | ---------------------- | ----------------------------------------------------------- |
| `api-researcher` | opus  | Read, Grep, Glob, Bash | Read-only backend research: API routes, DB schemas, auth   |
| `web-researcher` | opus  | Read, Grep, Glob, Bash | Read-only frontend research: UI patterns, design systems   |

### reviewer/ (5 agents)

| Agent            | Model  | Tools                                   | Description                                              |
| ---------------- | ------ | --------------------------------------- | -------------------------------------------------------- |
| `ai-reviewer`   | opus   | Read, Grep, Glob, Bash                  | AI integration: prompt safety, injection risks, tokens   |
| `api-reviewer`   | opus   | Read, Write, Edit, Grep, Glob, Bash     | Backend code review                                      |
| `cli-reviewer`   | opus   | Read, Write, Edit, Grep, Glob, Bash     | CLI code review                                          |
| `infra-reviewer` | sonnet | Read, Grep, Glob, Bash                  | Infrastructure: Dockerfiles, CI/CD, deployment, IaC      |
| `web-reviewer`   | opus   | Read, Write, Edit, Grep, Glob, Bash     | UI components: hooks, props, state, a11y                 |

### tester/ (3 agents)

| Agent        | Model  | Tools                                   | Description                                              |
| ------------ | ------ | --------------------------------------- | -------------------------------------------------------- |
| `api-tester` | sonnet | Read, Write, Edit, Grep, Glob, Bash     | Backend tests: API endpoints, DB operations, auth flows  |
| `cli-tester` | opus   | Read, Write, Edit, Grep, Glob, Bash     | CLI tests: wizard flows, commands, keyboard interactions |
| `web-tester` | opus   | Read, Write, Edit, Grep, Glob, Bash     | Frontend tests: component behavior, user flows           |

**Model distribution:** 20 agents use `opus`, 3 agents use `sonnet` (`convention-keeper`, `infra-reviewer`, `api-tester`).

**Tool patterns:**
- Read-only agents (researchers, some reviewers): Read, Grep, Glob, Bash (no Write/Edit)
- Implementation agents (developers, testers, planners): Read, Write, Edit, Grep, Glob, Bash
- `skill-summoner` is unique: has WebSearch and WebFetch instead of Bash

## metadata.yaml Schema

**JSON Schema:** `src/schemas/agent.schema.json`
**Zod Schema:** `agentYamlConfigSchema` at `src/cli/lib/schemas.ts:215-227`
**TypeScript Type:** `AgentYamlConfig` at `src/cli/types/agents.ts:62-68`

| Field            | Type                    | Required | Description                                           |
| ---------------- | ----------------------- | -------- | ----------------------------------------------------- |
| `id`             | `AgentName` (string)    | Yes      | Agent identifier, matches directory name              |
| `title`          | `string`                | Yes      | Display title (e.g., "CLI Developer Agent")           |
| `description`    | `string`                | Yes      | Brief description for Task tool                       |
| `model`          | `ModelName`             | Yes*     | `"sonnet"` / `"opus"` / `"haiku"` / `"inherit"`      |
| `tools`          | `string[]`              | Yes      | Available tools (Read, Write, Edit, Grep, Glob, Bash, WebSearch, WebFetch) |
| `disallowedTools`| `string[]`              | No       | Tools this agent cannot use                           |
| `permissionMode` | `PermissionMode`        | No       | `"default"` / `"acceptEdits"` / `"dontAsk"` / `"bypassPermissions"` / `"plan"` / `"delegate"` |
| `hooks`          | `Record<string, ...>`   | No       | Lifecycle hooks with matcher and actions               |
| `outputFormat`   | `string`                | No       | Which output format file to use                       |
| `domain`         | `Domain`                | No       | Domain for wizard grouping                            |
| `custom`         | `boolean`               | No       | True for agents created outside built-in vocabulary    |

*`model` is required in the JSON schema enum but typed as optional in TypeScript (defaults to `"inherit"` in the template).

**`ModelName`** defined at `src/cli/types/matrix.ts:11`: `"sonnet" | "opus" | "haiku" | "inherit"`

**`PermissionMode`** defined at `src/cli/types/matrix.ts:14-20`: `"default" | "acceptEdits" | "dontAsk" | "bypassPermissions" | "plan" | "delegate"`

**Note:** Currently, no agent metadata.yaml uses `disallowedTools`, `permissionMode`, `hooks`, `outputFormat`, `domain`, or `custom` fields -- these are supported by the schema but unused in built-in agents.

## Template Partial Structure

### Partial Files Per Agent

Each agent directory contains markdown partials read by `readAgentFiles()` at `src/cli/lib/compiler.ts:118-149`:

| Partial                    | Read Function   | Fallback                       | Template Variable              |
| -------------------------- | --------------- | ------------------------------ | ------------------------------ |
| `identity.md`              | `readFile()`    | None (required, throws)        | `{{ identity }}`               |
| `playbook.md`              | `readFile()`    | None (required, throws)        | `{{ playbook }}`               |
| `output.md`                | `readFileOptional()` | Category-level `output.md`  | `{{ output }}`                 |
| `critical-requirements.md` | `readFileOptional()` | Empty string               | `{{ criticalRequirementsTop }}` |
| `critical-reminders.md`    | `readFileOptional()` | Empty string               | `{{ criticalReminders }}`      |

**Output fallback:** If an agent's own `output.md` is missing, the compiler looks for `output.md` in the parent category directory (e.g., `src/agents/developer/output.md`). Currently all 23 agents have their own `output.md`, so no fallback is used.

### What Goes in Each Partial

| Partial                    | Content                                                           | Example (codex-keeper)                                             |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `identity.md`              | Role definition, mission statement, domain scope, operating modes | "You are a documentation specialist for AI agents..."              |
| `playbook.md`              | Detailed workflow, decision trees, templates, checklists          | Documentation templates, investigation process, validation steps   |
| `output.md`                | Structured output format specification                            | Session summary format, investigation table, documentation section |
| `critical-requirements.md` | Non-negotiable rules rendered at top of prompt                    | "NEVER document based on assumptions", "MUST verify file paths"    |
| `critical-reminders.md`    | Reinforced rules rendered at bottom of prompt                     | Repetition of critical rules for instruction continuity            |

## Liquid Compilation Pipeline

### Engine Setup

**Function:** `createLiquidEngine()` at `src/cli/lib/compiler.ts:394-419`

Template root resolution order (first match wins):

| Priority | Path                                             | Purpose                |
| -------- | ------------------------------------------------ | ---------------------- |
| 1        | `{projectDir}/.claude-src/agents/_templates/`    | Project-local overrides |
| 2        | `{projectDir}/.claude/templates/`                | Legacy template path   |
| 3        | `{CLI_ROOT}/src/agents/_templates/`              | Built-in templates     |

Engine config: `.liquid` extension, `strictVariables: false`, `strictFilters: true`.

### Main Template: agent.liquid

**File:** `src/agents/_templates/agent.liquid`

The template assembles a compiled agent prompt in this order:

```
1. YAML frontmatter
   - name, description, tools, disallowedTools (conditional), model, permissionMode
   - skills (conditional: only if preloadedSkillIds exist)

2. # {{ agent.title }}
   <role>{{ identity }}</role>

3. <core_principles> (hardcoded 5 principles)
   1. Investigation First
   2. Follow Existing Patterns
   3. Minimal Necessary Changes
   4. Anti-Over-Engineering
   5. Verify Everything

4. <methodologies> (5 Liquid partials via {% render %})
   - methodologies/investigation-requirements
   - methodologies/anti-over-engineering
   - methodologies/write-verification
   - methodologies/success-criteria
   - methodologies/context-management

5. <critical_requirements> (conditional: if criticalRequirementsTop is non-empty)

6. <skill_activation_protocol> (conditional: if dynamicSkills exist)
   - 3-step protocol: EVALUATE -> ACTIVATE -> IMPLEMENT
   - Lists each dynamic skill with id, description, invoke command, usage
   OR <skills_note> if all skills are preloaded

7. {{ playbook }} (agent-specific workflow)

8. ## Standards and Conventions

9. {{ output }} (output format specification)

10. <critical_reminders> (conditional: if criticalReminders is non-empty)

11. Final instruction lines (always present):
    - "DISPLAY ALL 5 CORE PRINCIPLES..."
    - "ALWAYS RE-READ FILES AFTER EDITING..."
```

### Template Variables

| Variable                 | Source                           | Type         |
| ------------------------ | -------------------------------- | ------------ |
| `agent.name`             | `AgentConfig.name`               | `string`     |
| `agent.description`      | `AgentConfig.description`        | `string`     |
| `agent.title`            | `AgentConfig.title`              | `string`     |
| `agent.tools`            | `AgentConfig.tools`              | `string[]`   |
| `agent.disallowed_tools` | `AgentConfig.disallowedTools`    | `string[]`   |
| `agent.model`            | `AgentConfig.model`              | `ModelName`  |
| `agent.permission_mode`  | `AgentConfig.permissionMode`     | `PermissionMode` |
| `identity`               | Content of `identity.md`         | `string`     |
| `playbook`               | Content of `playbook.md`         | `string`     |
| `output`                 | Content of `output.md`           | `string`     |
| `criticalRequirementsTop`| Content of `critical-requirements.md` | `string` |
| `criticalReminders`      | Content of `critical-reminders.md`    | `string` |
| `preloadedSkillIds`      | Skill IDs for frontmatter        | `(SkillId \| PluginSkillRef)[]` |
| `dynamicSkills`          | Skills loaded via Skill tool     | `Skill[]`    |
| `preloadedSkills`        | Skills embedded in prompt        | `Skill[]`    |

### Compilation Flow

**Per-agent compilation:** `compileAgent()` at `src/cli/lib/compiler.ts:190-202`

```
1. readAgentFiles(name, agent, projectRoot)
   - Reads identity.md, playbook.md, output.md, critical-requirements.md, critical-reminders.md
   - output.md falls back to category directory if missing from agent directory

2. buildAgentTemplateContext(name, agent, files)  [compiler.ts:151-172]
   - Splits agent.skills into preloaded (s.preloaded === true) and dynamic
   - Builds preloadedSkillIds from preloaded skills

3. sanitizeCompiledAgentData(data)  [compiler.ts:77-111]
   - Strips Liquid template syntax ({{ }}, {% %}) from all user-controlled fields
   - Prevents template injection when user data is passed to Liquid engine

4. engine.renderFile("agent", sanitizedData)
   - Renders agent.liquid with the sanitized CompiledAgentData
```

**Batch compilation:** `compileAllAgents()` at `src/cli/lib/compiler.ts:216-249`

```
for each (name, agent) in resolvedAgents:
  1. compileAgent(name, agent, projectRoot, engine) -> rendered markdown
  2. writeFile("{outputDir}/agents/{name}.md", output)
  3. validateCompiledAgent(output) -> check for missing sections, placeholder text
  4. Print validation warnings (non-blocking)
```

### Sanitization

**Function:** `sanitizeCompiledAgentData()` at `src/cli/lib/compiler.ts:77-111`
**Pattern:** `LIQUID_SYNTAX_PATTERN = /\{\{|\}\}|\{%|%\}/g` at `:31`

Strips Liquid delimiters from:
- `agent.name`, `agent.title`, `agent.description`
- `agent.tools[]`, `agent.disallowedTools[]`
- `agent.model`, `agent.permissionMode`
- `identity`, `playbook`, `output`, `criticalRequirementsTop`, `criticalReminders`
- All skill fields (id, description, usage, content)
- `preloadedSkillIds[]`

## Methodology Templates

**Directory:** `src/agents/_templates/methodologies/`

All methodology partials are rendered via `{% render %}` tags in `agent.liquid` and included in every compiled agent.

| Template                            | XML Tag                          | Purpose                                                    |
| ----------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| `investigation-requirements.liquid` | `<investigation_requirement>`    | "Never speculate" protocol: list files, read, verify       |
| `anti-over-engineering.liquid`      | `<anti_over_engineering>`        | Surgical implementation: no new abstractions, use existing  |
| `write-verification.liquid`         | `<write_verification_protocol>`  | Re-read files after editing, verify changes exist          |
| `success-criteria.liquid`           | `<success_criteria_template>`    | Measurable "done" criteria with SMART template             |
| `context-management.liquid`         | `<context_management>`           | .claude/ session files for cross-session continuity        |
| `improvement-protocol.liquid`       | `<improvement_protocol>`         | Self-improvement workflow when agents update own config     |

**Note:** `improvement-protocol.liquid` exists in the methodologies directory but is NOT rendered by `agent.liquid`. Only the 5 listed in the `{% render %}` tags are included in compiled agents.

## AgentName Type Relationship

### Generated Union Type

**File:** `src/cli/types/generated/source-types.ts:550-571`

```typescript
export const AGENT_NAMES = [
  "agent-summoner", "api-developer", "api-researcher", "api-reviewer",
  "cli-developer", "cli-reviewer", "cli-tester", "codex-keeper",
  "convention-keeper", "pattern-scout", "skill-summoner", "web-architecture",
  "web-developer", "web-pattern-critique", "web-pm", "web-researcher",
  "web-reviewer", "web-tester",
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];
```

**Count:** 18 entries in the generated union.

### Re-export Chain

```
src/cli/types/generated/source-types.ts  -- defines AGENT_NAMES and AgentName
  -> src/cli/types/agents.ts:3-6         -- re-exports AgentName and AGENT_NAMES
     -> src/cli/types/index.ts            -- barrel export
```

### Agents NOT in Generated Union

5 agents exist in `src/agents/` but are absent from the generated `AGENT_NAMES` array:

| Agent            | Category  | metadata.yaml exists | Likely reason for absence              |
| ---------------- | --------- | -------------------- | -------------------------------------- |
| `ai-developer`   | developer | Yes                  | Added after last type generation       |
| `ai-reviewer`    | reviewer  | Yes                  | Added after last type generation       |
| `api-pm`         | planning  | Yes                  | Added after last type generation       |
| `api-tester`     | tester    | Yes                  | Added after last type generation       |
| `infra-reviewer` | reviewer  | Yes                  | Added after last type generation       |

These agents compile and function correctly because:
- `agentYamlConfigSchema` uses `z.string() as z.ZodType<AgentName>` (accepts any string at runtime)
- `loadAllAgents()` at `src/cli/lib/loading/loader.ts:38-71` uses `Record<string, AgentDefinition>` internally
- Custom/new agents bypass the union constraint via boundary cast

### Wizard Domain Mapping

**File:** `src/cli/stores/wizard-store.ts:93-104`

```typescript
const DOMAIN_AGENTS: Partial<Record<string, AgentName[]>> = {
  web: ["web-developer", "web-reviewer", "web-researcher", "web-tester", "web-pm", "web-architecture"],
  api: ["api-developer", "api-reviewer", "api-researcher"],
  cli: ["cli-developer", "cli-tester", "cli-reviewer"],
};
```

Agents NOT in any domain mapping (11 of 23):
- **meta:** agent-summoner, codex-keeper, convention-keeper, skill-summoner
- **pattern:** pattern-scout, web-pattern-critique
- **planning:** api-pm (not in api domain mapping)
- **reviewer:** ai-reviewer, infra-reviewer
- **tester:** api-tester (not in api domain mapping)
- **developer:** ai-developer (not in any domain mapping)

(`web-tester` IS in the web domain mapping despite being in the tester/ category.)

These unmapped agents are available for manual selection in the wizard but are not auto-preselected by `preselectAgentsFromDomains()`.

## Key Types

| Type                 | File                            | Line  | Purpose                                                |
| -------------------- | ------------------------------- | ----- | ------------------------------------------------------ |
| `AgentName`          | `types/generated/source-types.ts` | :571 | Union type of known agent IDs                          |
| `AgentYamlConfig`    | `types/agents.ts`               | :62-68 | Parsed metadata.yaml structure                        |
| `AgentDefinition`    | `types/agents.ts`               | :41-52 | Agent definition with path/source metadata            |
| `AgentConfig`        | `types/agents.ts`               | :55-59 | Fully resolved config with skills list                |
| `BaseAgentFields`    | `types/agents.ts`               | :27-38 | Shared fields across AgentDefinition/Config/YamlConfig |
| `AgentFrontmatter`   | `types/agents.ts`               | :71-86 | Compiled .md frontmatter format                       |
| `CompiledAgentData`  | `types/agents.ts`               | :89-105 | All data needed for template rendering                |
| `AgentSourcePaths`   | `types/agents.ts`               | :108-112 | Directory paths for agent loading                    |
| `AgentHookAction`    | `types/agents.ts`               | :9-14 | Hook action (command/script/prompt)                    |
| `AgentHookDefinition`| `types/agents.ts`               | :17-20 | Hook with optional file matcher                       |

## Key Functions

| Function                    | File                                      | Line  | Signature                                                        |
| --------------------------- | ----------------------------------------- | ----- | ---------------------------------------------------------------- |
| `loadAllAgents()`           | `lib/loading/loader.ts`                   | :38   | `(projectRoot: string) => Promise<Record<AgentName, AgentDefinition>>` |
| `readAgentFiles()`          | `lib/compiler.ts`                         | :118  | `(name, agent, projectRoot) => Promise<AgentFiles>`              |
| `buildAgentTemplateContext()` | `lib/compiler.ts`                       | :151  | `(name, agent, files) => CompiledAgentData`                      |
| `sanitizeCompiledAgentData()` | `lib/compiler.ts`                       | :77   | `(data: CompiledAgentData) => CompiledAgentData`                 |
| `compileAgent()`            | `lib/compiler.ts`                         | :190  | `(name, agent, projectRoot, engine) => Promise<string>`          |
| `compileAllAgents()`        | `lib/compiler.ts`                         | :216  | `(resolvedAgents, ctx, engine) => Promise<void>`                 |
| `createLiquidEngine()`      | `lib/compiler.ts`                         | :394  | `(projectDir?) => Promise<Liquid>`                               |
| `sanitizeLiquidSyntax()`    | `lib/compiler.ts`                         | :41   | `(value, fieldName) => sanitized string`                         |
| `getAgentDefinitions()`     | `lib/agents/agent-fetcher.ts`             | :13   | `(remoteSource?, options?) => Promise<AgentSourcePaths>`         |
| `loadAgentDefs()`           | `lib/operations/project/load-agent-defs.ts` | :21 | `(agentSource?, options?) => Promise<AgentDefs>`                 |

## Agent Loading Flow

```
1. loadAgentDefs()  [operations/project/load-agent-defs.ts:21]
   |
   +-> getAgentDefinitions(agentSource)  [agents/agent-fetcher.ts:13]
   |   Returns AgentSourcePaths { agentsDir, templatesDir, sourcePath }
   |
   +-> loadAllAgents(PROJECT_ROOT)  [loading/loader.ts:38]
   |   Globs for **/metadata.yaml, parses each with agentYamlConfigSchema
   |   Returns Record<AgentName, AgentDefinition> (built-in agents)
   |
   +-> loadAllAgents(sourcePath)  [loading/loader.ts:38]
   |   Same logic for remote source agents
   |
   +-> Merge: { ...cliAgents, ...sourceAgents }
       Source agents override built-in agents with same ID
```

## Related Documentation

- [Compilation Pipeline](./compilation-pipeline.md) -- Full compilation flow including skills
- [Plugin System](./plugin-system.md) -- How skills are discovered and assigned to agents
- [Wizard Flow](./wizard-flow.md) -- How agents are selected in the wizard (DOMAIN_AGENTS)
- [Type System](../type-system.md) -- AgentName union type and generated types
