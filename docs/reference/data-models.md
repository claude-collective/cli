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

  // Stack (resolved configuration)
  stack?: Record<string, Record<string, string>>;
}

type SkillEntry = string | SkillAssignment;
type AgentSkillConfig = SkillEntry[] | Record<string, SkillEntry[]>;
```

> **Note**: The `stack:` field stores **resolved** stack configuration (agent -> subcategory -> skill ID mappings) generated during `agentsinc init`. It is NOT a reference to a stack ID. Stack definitions themselves are loaded from `config/stacks.yaml` via `stacks-loader.ts`. See [Stack Types](#stack-types-configstacksyaml) for the source format.

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

## Stack Types (`config/stacks.yaml`)

Stack definitions loaded from `config/stacks.yaml` via `src/cli/lib/stacks-loader.ts`.

```typescript
// From src/cli/types-stacks.ts
interface Stack {
  id: string; // Unique identifier (kebab-case)
  name: string; // Human-readable name
  description: string;
  agents: Record<string, StackAgentConfig>; // Agent -> technology mappings
  philosophy?: string;
}

interface StackAgentConfig {
  [subcategoryId: string]: string; // Maps subcategory to technology alias
}

interface StacksConfig {
  stacks: Stack[];
}
```

**Example stack definition:**

```yaml
stacks:
  - id: nextjs-fullstack
    name: Next.js Fullstack
    description: Production-ready Next.js with complete backend infrastructure
    agents:
      web-developer:
        framework: react
        styling: scss-modules
        client-state: zustand
        server-state: react-query
        testing: vitest
      api-developer:
        api: hono
        database: drizzle
        auth: better-auth
      web-reviewer:
        reviewing: reviewing
      cli-tester: {} # Empty config = no technology-specific skills
    philosophy: Ship fast, iterate faster
```

## Skills Matrix (`config/skills-matrix.yaml`)

The skills matrix is the central configuration for skill relationships, categories, and aliases. Loaded via `src/cli/lib/matrix-loader.ts`.

Schema: `src/schemas/skills-matrix.schema.json`

### Structure Overview

```yaml
version: "1.0.0"

categories:
  # Hierarchical category definitions
  # ...

relationships:
  conflicts: [] # Mutually exclusive skills
  discourages: [] # Soft warnings
  recommends: [] # Suggestions
  requires: [] # Hard dependencies
  alternatives: [] # Interchangeable options

skill_aliases:
  # Short name -> full skill ID mappings
  # ...
```

### Categories

Categories define the hierarchical organization of skills. Top-level categories contain subcategories.

```yaml
categories:
  # Top-level category
  frontend:
    id: frontend
    name: Frontend
    description: UI and client-side development
    exclusive: false # Multiple skills allowed
    required: false
    order: 1
    icon: "..."

  # Subcategory (has parent)
  framework:
    id: framework
    name: Framework
    description: Core UI framework (React, Vue, Angular, SolidJS)
    parent: frontend # Links to parent category
    domain: web # Domain for agent mapping
    exclusive: true # Only one framework allowed
    required: true # Must select one
    order: 1
```

**Category Fields:**

| Field         | Type    | Description                                      |
| ------------- | ------- | ------------------------------------------------ |
| `id`          | string  | Unique identifier (kebab-case)                   |
| `name`        | string  | Human-readable display name                      |
| `description` | string  | Brief description                                |
| `parent`      | string  | Parent category ID (subcategories only)          |
| `domain`      | string  | Domain for agent mapping (web, api, cli, shared) |
| `exclusive`   | boolean | If true, only one skill from category allowed    |
| `required`    | boolean | If true, must select a skill from category       |
| `order`       | number  | Display order in UI                              |
| `icon`        | string  | Optional emoji/icon for UI                       |

### Relationships

#### Conflicts (Mutually Exclusive)

Selecting one skill disables the others.

```yaml
conflicts:
  - skills: [react, vue, angular, solidjs]
    reason: "Core frameworks are mutually exclusive within a single application"

  - skills: [drizzle, prisma]
    reason: "Both are ORMs serving similar purposes"
```

#### Discourages (Soft Warnings)

Selecting one skill shows a warning for the others but doesn't disable them.

```yaml
discourages:
  - skills: [scss-modules, tailwind]
    reason: "Mixing CSS paradigms causes slower builds and inconsistent patterns"

  - skills: [zustand, redux-toolkit, mobx]
    reason: "Using multiple React state libraries adds complexity"
```

#### Recommends (Suggestions)

Selecting a skill highlights recommended companions.

```yaml
recommends:
  - when: react
    suggest: [zustand, react-query, vitest, react-hook-form]
    reason: "Best-in-class React libraries"

  - when: hono
    suggest: [drizzle, better-auth, zod-validation]
    reason: "Hono + Drizzle + Better Auth is a powerful combo"
```

#### Requires (Hard Dependencies)

A skill cannot be selected unless its dependencies are met.

```yaml
requires:
  - skill: zustand
    needs: [react, react-native]
    needs_any: true # Only one of the dependencies required
    reason: "Our Zustand skill covers React/React Native patterns"

  - skill: shadcn-ui
    needs: [react, tailwind]
    # needs_any defaults to false (all dependencies required)
    reason: "shadcn/ui requires React and Tailwind"
```

#### Alternatives (Interchangeable Options)

Groups skills that serve the same purpose.

```yaml
alternatives:
  - purpose: "Frontend Framework"
    skills: [react, vue, angular, solidjs]

  - purpose: "Database ORM"
    skills: [drizzle, prisma]

  - purpose: "E2E Testing"
    skills: [playwright-e2e, cypress-e2e]
```

### Skill Aliases

Maps short technology names to normalized full skill IDs.

```yaml
skill_aliases:
  # Frameworks
  react: "web-framework-react"
  vue: "web-framework-vue-composition-api"
  angular: "web-framework-angular-standalone"

  # Styling
  scss-modules: "web-styling-scss-modules"
  tailwind: "web-styling-tailwind" # Note: skill not yet created

  # State management
  zustand: "web-state-zustand"
  redux-toolkit: "web-state-redux-toolkit"

  # Backend
  hono: "api-framework-hono"
  drizzle: "api-database-drizzle"
  prisma: "api-database-prisma"

  # CLI
  commander: "cli-framework-cli-commander"
  clack: "cli-prompts-cli-clack"
```

**Alias Normalization Rules:**

- No author suffix (author is metadata only)
- Slashes replaced with dashes
- Plus signs replaced with dashes
- All lowercase

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

## Agent Definition (`metadata.yaml`)

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

# Resolved stack configuration (generated by agentsinc init)
stack:
  web-developer:
    framework: web-framework-react
    styling: web-styling-scss-modules
  api-developer:
    api: api-framework-hono
    database: api-database-drizzle
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
| stacks            | `src/schemas/stacks.schema.json`                             |
| plugin manifest   | `src/schemas/plugin.schema.json`                             |
| marketplace       | `src/schemas/marketplace.schema.json`                        |
| agent definition  | `src/schemas/agent.schema.json`                              |
| agent frontmatter | `src/schemas/agent-frontmatter.schema.json`                  |
| hooks             | `src/schemas/hooks.schema.json`                              |
| stack config      | `claude-subagents/src/schemas/stack.schema.json`             |
| skill metadata    | `claude-subagents/src/schemas/metadata.schema.json`          |
| skill frontmatter | `claude-subagents/src/schemas/skill-frontmatter.schema.json` |
