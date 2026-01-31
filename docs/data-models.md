# Data Models

## Core Types (`src/types.ts`)

### ProjectConfig (Unified Config)

Unified configuration for project-level settings. Replaces `StackConfig` for local installations.

```typescript
interface ProjectConfig {
  // Identity
  name?: string;
  version?: string;
  author?: string;
  description?: string;
  framework?: string;

  // Skills
  skills?: (string | SkillAssignment)[];

  // Agents
  agents?: string[];
  agent_skills?: Record<string, AgentSkillConfig>;
  custom_agents?: Record<string, CustomAgentConfig>;

  // Config sources
  agents_source?: string; // Remote agent definitions URL
  marketplace_url?: string; // Custom marketplace URL

  // Customization
  preload_patterns?: Record<string, string[]>;
  hooks?: Record<string, AgentHookDefinition[]>;
  philosophy?: string;
  principles?: string[];
}

type SkillEntry = string | SkillAssignment;
type AgentSkillConfig = SkillEntry[] | Record<string, SkillEntry[]>;
```

### CustomAgentConfig

Define custom agents or extend built-in agents.

```typescript
interface CustomAgentConfig {
  title: string;
  description: string;
  extends?: string; // Built-in agent to extend
  model?: "sonnet" | "opus" | "haiku" | "inherit";
  tools?: string[];
  disallowed_tools?: string[];
  permission_mode?: string;
  skills?: string[];
  hooks?: Record<string, AgentHookDefinition[]>;
}
```

**Example custom agent:**

```yaml
custom_agents:
  my-developer:
    title: My Custom Developer
    description: Specialized for our codebase
    extends: web-developer # Inherit from built-in
    model: opus
    tools:
      - Read
      - Write
      - Edit
    skills:
      - react
      - our-internal-patterns
```

### StackConfig (Legacy)

Stack definition bundling skills, agents, philosophy. Still supported for backward compatibility.

```typescript
interface StackConfig {
  id?: string;
  name: string;
  version: string;
  author: string; // @handle format
  description?: string;
  framework?: string; // e.g., "nextjs"
  skills: SkillAssignment[];
  agents: string[];
  agent_skills?: Record<string, Record<string, SkillAssignment[]>>;
  hooks?: Record<string, AgentHookDefinition[]>;
  philosophy?: string;
  principles?: string[];
}

interface SkillAssignment {
  id: string;
  preloaded?: boolean; // Embed in agent vs load dynamically
  local?: boolean;
  path?: string;
}
```

### AgentConfig (line 136)

Resolved agent for compilation.

```typescript
interface AgentConfig {
  name: string;
  title: string;
  description: string;
  model?: "opus" | "sonnet" | "haiku" | "inherit";
  tools: string[];
  disallowed_tools?: string[];
  permission_mode?: string;
  hooks?: Record<string, AgentHookDefinition[]>;
  skills: Skill[];
  path?: string;
  sourceRoot?: string;
}
```

### CompileConfig (line 118)

Configuration for compilation process.

```typescript
interface CompileConfig {
  name: string;
  description: string;
  claude_md: string;
  stack?: string;
  agents: Record<string, CompileAgentConfig>;
}
```

### PluginManifest (line 355)

Claude Code plugin package format.

```typescript
interface PluginManifest {
  name: string; // kebab-case
  version?: string; // semver
  description?: string;
  author?: { name: string; email?: string };
  commands?: string | string[];
  agents?: string | string[];
  skills?: string | string[];
  hooks?: string | Record<string, AgentHookDefinition[]>;
}
```

### Marketplace (line 444)

Plugin registry format.

```typescript
interface Marketplace {
  name: string;
  version: string;
  owner: { name: string; email?: string };
  metadata?: { pluginRoot?: string };
  plugins: MarketplacePlugin[];
}

interface MarketplacePlugin {
  name: string;
  source: string; // Relative path
  description?: string;
  version?: string;
  category?: string;
  keywords?: string[];
}
```

## Skill Metadata (`metadata.yaml`)

Schema: `claude-subagents/src/schemas/metadata.schema.json`

```yaml
category: framework # From enum
author: "@vince"
cli_name: React # Max 30 chars
cli_description: Component patterns # Max 60 chars
usage_guidance: Use when building React components
category_exclusive: true # Only one from category
requires:
  - "vitest (@vince)"
compatible_with:
  - "zustand (@vince)"
conflicts_with:
  - "vue (@vince)"
```

**Categories:** framework, database, auth, analytics, observability, testing, styling, state, api, cli, security, methodology, etc.

## SKILL.md Frontmatter

Schema: `claude-subagents/src/schemas/skill-frontmatter.schema.json`

```yaml
---
name: web/framework/react (@vince)
description: Component architecture, hooks, patterns
---
```

## Agent Definition (`agent.yaml`)

Schema: `src/schemas/agent.schema.json`

```yaml
title: Backend Developer
description: Implements backend features from specs
model: opus
tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
permission_mode: default
```

**Tools:** Read, Write, Edit, Grep, Glob, Bash, WebSearch, WebFetch, Task, TaskOutput

**Permission Modes:** default, acceptEdits, dontAsk, bypassPermissions, plan, delegate

## Project Config (`config.yaml`)

Project-level configuration in `.claude/config.yaml`:

```yaml
name: "My Project"
version: "1.0.0"
author: "@vince"
framework: nextjs

skills:
  - react
  - scss-modules
  - id: zustand
    preloaded: true

agents:
  - web-developer
  - api-developer

agent_skills:
  web-developer:
    framework:
      - id: react
        preloaded: true
    styling:
      - scss-modules

custom_agents:
  my-developer:
    title: My Developer
    description: Custom for our project
    extends: web-developer
    skills:
      - react

preload_patterns:
  web-developer:
    - framework
    - styling

hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: prompt
          prompt: "Verify the write succeeded"
```

## YAML Defaults

Default agent-skill mappings in `src/cli/defaults/defaults.yaml`:

```yaml
skill_to_agents:
  "frontend/*":
    - web-developer
    - web-reviewer
    - web-researcher
  "backend/*":
    - api-developer
    - api-reviewer

preloaded_skills:
  web-developer:
    - framework
    - styling
  api-developer:
    - api
    - database

subcategory_aliases:
  framework: frontend/framework
  styling: frontend/styling
  api: backend/api
```

## Schemas Location

| Schema            | Location                                                     |
| ----------------- | ------------------------------------------------------------ |
| skills-matrix     | `src/schemas/skills-matrix.schema.json`                      |
| plugin manifest   | `src/schemas/plugin.schema.json`                             |
| marketplace       | `src/schemas/marketplace.schema.json`                        |
| agent definition  | `src/schemas/agent.schema.json`                              |
| agent frontmatter | `src/schemas/agent-frontmatter.schema.json`                  |
| hooks             | `src/schemas/hooks.schema.json`                              |
| stack config      | `claude-subagents/src/schemas/stack.schema.json`             |
| skill metadata    | `claude-subagents/src/schemas/metadata.schema.json`          |
| skill frontmatter | `claude-subagents/src/schemas/skill-frontmatter.schema.json` |
