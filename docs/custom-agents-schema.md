# Custom Agents Schema Design

## Overview

This document specifies how users can define custom agents in their project's `config.yaml`. Custom agents allow projects to create specialized agents tailored to their specific workflows, coding patterns, or domain requirements without modifying the core agent library.

## Goal

Enable users to define project-specific agents that:

1. Can extend built-in agents (inheriting tools, model, and base configuration)
2. Can be completely custom (defined from scratch)
3. Receive skills like built-in agents
4. Compile alongside built-in agents using existing infrastructure

## Proposed Schema

### Location

Custom agents are defined in the plugin's `config.yaml` file (at `~/.claude/plugins/claude-collective/config.yaml` or the project's `.claude-collective/config.yaml`).

### Schema Definition

```yaml
# config.yaml
name: my-project
version: "1.0.0"
author: "@username"

# Existing fields
skills:
  - id: react (@vince)
  - id: drizzle (@vince)

agents:
  - web-developer
  - api-developer
  - my-code-reviewer # Reference to custom agent below

# NEW: Custom agent definitions
custom_agents:
  my-code-reviewer:
    title: "My Code Reviewer"
    description: "Custom code reviewer for this project with domain-specific checks"
    extends: web-reviewer # Optional: inherit from built-in agent
    model: opus # Optional: override model (opus, sonnet, haiku, inherit)
    tools: # Optional: override/extend tools
      - Read
      - Grep
      - Glob
    disallowed_tools: # Optional: tools this agent cannot use
      - Bash
    permission_mode: default # Optional: default, acceptEdits, dontAsk, plan, delegate
    skills: # Optional: agent-specific skills (overrides agent_skills)
      - id: reviewing (@vince)
        preloaded: true
      - id: react (@vince)

  domain-expert:
    title: "Domain Expert"
    description: "Answers questions about our business domain and data models"
    # No extends - completely custom agent
    model: sonnet
    tools:
      - Read
      - Grep
      - Glob
    skills:
      - id: react (@vince)
```

### TypeScript Type Definition

Add to `/home/vince/dev/cli/src/types.ts`:

```typescript
/**
 * Custom agent definition in config.yaml
 * Can extend a built-in agent or be completely custom
 */
export interface CustomAgentDefinition {
  /** Display title for the agent */
  title: string;
  /** Description shown in Task tool */
  description: string;
  /** Built-in agent to extend (inherits tools, model, permission_mode) */
  extends?: string;
  /** AI model to use (overrides extended agent if specified) */
  model?: "opus" | "sonnet" | "haiku" | "inherit";
  /** Tools available to this agent (overrides extended agent if specified) */
  tools?: string[];
  /** Tools this agent cannot use */
  disallowed_tools?: string[];
  /** Permission mode for agent operations */
  permission_mode?:
    | "default"
    | "acceptEdits"
    | "dontAsk"
    | "bypassPermissions"
    | "plan"
    | "delegate";
  /** Agent-specific skill assignments */
  skills?: SkillAssignment[];
  /** Lifecycle hooks */
  hooks?: Record<string, AgentHookDefinition[]>;
}

// Update ProjectConfig interface
export interface ProjectConfig {
  // ... existing fields ...

  /**
   * Custom agent definitions
   * Maps custom agent ID to its definition
   */
  custom_agents?: Record<string, CustomAgentDefinition>;
}
```

## How Custom Agents Relate to Built-in Agents

### Extension Mechanism

When `extends` is specified, the custom agent inherits from the built-in agent:

| Property           | Inheritance Behavior                     |
| ------------------ | ---------------------------------------- |
| `title`            | Always from custom definition (required) |
| `description`      | Always from custom definition (required) |
| `model`            | Custom if specified, else inherited      |
| `tools`            | Custom if specified, else inherited      |
| `disallowed_tools` | Merged (custom + inherited)              |
| `permission_mode`  | Custom if specified, else inherited      |
| `hooks`            | Merged (custom hooks added to inherited) |

**Template files** (intro.md, workflow.md, etc.) are **always inherited** from the extended agent. Custom agents cannot override these - they customize behavior through skills and configuration only.

### Resolution Priority

```
1. Custom agent definition properties
2. Extended agent definition properties
3. Default values
```

### Example: Extending web-reviewer

```yaml
custom_agents:
  strict-reviewer:
    title: "Strict Code Reviewer"
    description: "Extra-strict reviewer that enforces additional patterns"
    extends: web-reviewer
    # Inherits: model (opus), tools (Read, Write, Edit, Grep, Glob, Bash)
    # Inherits: template files (intro.md, workflow.md from web-reviewer)
    disallowed_tools:
      - Bash # Remove Bash access for security
    skills:
      - id: reviewing (@vince)
        preloaded: true
```

### Standalone Custom Agent

When no `extends` is specified, all required fields must be provided:

```yaml
custom_agents:
  data-analyst:
    title: "Data Analyst"
    description: "Analyzes data patterns and generates reports"
    # No extends - must specify tools
    model: sonnet
    tools:
      - Read
      - Grep
      - Glob
    # Standalone agents use a minimal default template
```

## How Skills Are Assigned to Custom Agents

### Skill Resolution Order

1. **Explicit `skills` in custom agent definition** - Highest priority
2. **`agent_skills` entry matching custom agent name** - If no explicit skills
3. **Default skill mapping from stack** - If extends is specified and no explicit skills

### Example: All Three Methods

```yaml
# Method 1: Explicit skills in custom_agents
custom_agents:
  my-reviewer:
    title: "My Reviewer"
    description: "Project-specific reviewer"
    extends: web-reviewer
    skills:
      - id: reviewing (@vince)
        preloaded: true
      - id: react (@vince)

# Method 2: Using agent_skills (works for both built-in and custom)
agent_skills:
  my-other-reviewer:
    frontend:
      - id: react (@vince)
        preloaded: true
    reviewing:
      - id: reviewing (@vince)

# Method 3: Inherit from extended agent's defaults
custom_agents:
  inherited-reviewer:
    title: "Inherited Reviewer"
    description: "Gets skills from web-reviewer defaults"
    extends: web-reviewer
    # No skills specified - inherits web-reviewer's skill mappings
```

### Preloading Behavior

Custom agent skills follow the same preloading rules as built-in agents:

- `preloaded: true` - Skill content embedded in compiled agent
- `preloaded: false` (default) - Skill loaded dynamically via Skill tool

## Compilation Process

### Integration Points

Custom agents integrate into the existing compilation pipeline at these points:

1. **Config Loading** (`src/cli/lib/agent-recompiler.ts:39-57`)
   - `loadPluginConfig()` extended to parse `custom_agents`

2. **Agent Loading** (`src/cli/lib/loader.ts:42-69`)
   - `loadAllAgents()` extended to merge custom agents with built-in agents

3. **Resolution** (`src/cli/lib/resolver.ts:203-250`)
   - `resolveAgents()` handles custom agent resolution with extends logic

4. **Compilation** (`src/cli/lib/compiler.ts:29-93`)
   - `compileAgent()` unchanged - receives resolved AgentConfig

### Resolution Algorithm

```
function resolveCustomAgent(customDef, builtInAgents):
  if customDef.extends:
    baseAgent = builtInAgents[customDef.extends]
    if not baseAgent:
      throw "Extended agent not found"

    resolved = {
      name: customAgentId,
      title: customDef.title,
      description: customDef.description,
      model: customDef.model ?? baseAgent.model,
      tools: customDef.tools ?? baseAgent.tools,
      disallowed_tools: merge(baseAgent.disallowed_tools, customDef.disallowed_tools),
      permission_mode: customDef.permission_mode ?? baseAgent.permission_mode,
      hooks: merge(baseAgent.hooks, customDef.hooks),
      path: baseAgent.path,           # Use extended agent's templates
      sourceRoot: baseAgent.sourceRoot
    }
  else:
    # Standalone custom agent
    resolved = {
      name: customAgentId,
      title: customDef.title,
      description: customDef.description,
      model: customDef.model ?? "inherit",
      tools: customDef.tools ?? ["Read", "Grep", "Glob"],  # Minimal defaults
      disallowed_tools: customDef.disallowed_tools ?? [],
      permission_mode: customDef.permission_mode ?? "default",
      hooks: customDef.hooks ?? {},
      path: "_custom",                # Use custom agent template
      sourceRoot: null
    }

  return resolved
```

### Template for Standalone Custom Agents

Standalone agents (no `extends`) use a minimal template at `src/agents/_custom/`:

```
src/agents/_custom/
  intro.md       # "You are a custom agent configured for this project."
  workflow.md    # "Follow the skills and instructions provided."
```

This provides a sensible base while allowing skills to define the actual behavior.

## Validation Rules

### Required Fields

| Scenario          | Required Fields                                |
| ----------------- | ---------------------------------------------- |
| With `extends`    | `title`, `description`                         |
| Without `extends` | `title`, `description`, `tools` (at least one) |

### Validation Checks

1. **Extended agent exists**: If `extends` specified, the agent must exist in built-in agents
2. **No circular references**: Custom agents cannot extend other custom agents
3. **Valid tools**: All tools in `tools` array must be valid Claude Code tools
4. **Valid skills**: All skill IDs must exist in the skills registry
5. **Unique names**: Custom agent IDs must not conflict with built-in agent IDs

### Error Messages

```
Error: Custom agent "my-reviewer" extends unknown agent "reviewer-typo".
       Available agents: web-reviewer, api-reviewer, cli-reviewer

Error: Custom agent "standalone" requires 'tools' when not extending another agent.
       Add 'extends: web-developer' or specify tools explicitly.

Error: Custom agent "my-reviewer" uses same name as built-in agent.
       Choose a unique name like "project-reviewer" or "my-code-reviewer".
```

## Examples

### Example 1: Domain-Specific Reviewer

```yaml
custom_agents:
  fintech-reviewer:
    title: "Fintech Code Reviewer"
    description: "Reviews code for financial applications, checking for security, precision, and compliance patterns"
    extends: web-reviewer
    skills:
      - id: reviewing (@vince)
        preloaded: true
      - id: security (@vince)
        preloaded: true
      - id: react (@vince)
```

### Example 2: Lightweight Research Agent

```yaml
custom_agents:
  codebase-explorer:
    title: "Codebase Explorer"
    description: "Quickly explores and answers questions about the codebase structure"
    model: sonnet # Use faster model for exploration
    tools:
      - Read
      - Grep
      - Glob
    # No skills - pure exploration agent
```

### Example 3: Full Custom Stack

```yaml
name: my-startup-stack
version: "1.0.0"
author: "@startup"

skills:
  - id: react (@vince)
  - id: drizzle (@vince)
  - id: hono (@vince)
  - id: security (@vince)

agents:
  - web-developer
  - api-developer
  - startup-pm # Custom
  - security-reviewer # Custom

custom_agents:
  startup-pm:
    title: "Startup PM"
    description: "Creates lean specs focused on MVP delivery"
    extends: web-pm
    skills:
      - id: react (@vince)
      - id: research-methodology (@vince)
        preloaded: true

  security-reviewer:
    title: "Security Reviewer"
    description: "Reviews code for security vulnerabilities and compliance"
    extends: api-reviewer
    skills:
      - id: security (@vince)
        preloaded: true
      - id: reviewing (@vince)
        preloaded: true
```

## Migration Path

### Phase 1: Schema Support

1. Add `CustomAgentDefinition` type to `types.ts`
2. Update `ProjectConfig` to include `custom_agents`
3. Add JSON schema for validation

### Phase 2: Resolution

1. Extend `loadPluginConfig()` to parse custom agents
2. Create `resolveCustomAgent()` function
3. Merge custom agents into agent resolution pipeline

### Phase 3: Compilation

1. Create `_custom` template directory for standalone agents
2. Extend `recompileAgents()` to handle custom agents
3. Update validation to check custom agent constraints

### Phase 4: CLI Integration

1. Add `cc agent:create` command for scaffolding
2. Update `cc list` to show custom agents
3. Add custom agent documentation to help output

## Constraints

- Custom agents cannot modify built-in agent template files
- Custom agents cannot extend other custom agents (prevents complexity)
- Custom agent names must be unique across built-in and custom agents
- Standalone custom agents require explicit tools (no implicit inheritance)
- Maximum 20 custom agents per project (prevents abuse)

## Success Criteria

1. Users can define custom agents in config.yaml
2. Custom agents compile successfully alongside built-in agents
3. Extended agents inherit base configuration correctly
4. Skills are resolved and assigned to custom agents
5. Validation catches configuration errors with helpful messages
6. Existing built-in agent workflows remain unchanged
