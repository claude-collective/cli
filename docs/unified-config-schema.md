# Unified Config Schema Design

## Overview

This document specifies the unified `config.yaml` schema for Claude Collective CLI projects. The config is stored at `.claude/config.yaml` and replaces the current `StackConfig` while maintaining backward compatibility.

## Goals

1. **Simplify for users** - Easy to understand and edit manually
2. **Support customization** - Override default agent-skill mappings
3. **Backward compatible** - Existing StackConfig files continue to work
4. **Support local skills** - Reference skills in `.claude/skills/`
5. **Schema versioned** - Enable future migrations

## Location

- **Project config:** `.claude/config.yaml`
- **Plugin config:** `~/.claude/plugins/claude-collective/config.yaml` (generated, not manually edited)

---

## TypeScript Interfaces

```typescript
/**
 * Unified project configuration for Claude Collective
 * Stored at .claude/config.yaml
 */
export interface ProjectConfig {
  /**
   * Schema version for migration support
   * @default "1"
   */
  version?: "1";

  /**
   * Project/plugin name (kebab-case)
   * @example "my-project"
   */
  name: string;

  /**
   * Brief description of the project
   */
  description?: string;

  /**
   * Skills available to agents
   * Can be skill IDs or SkillAssignment objects
   */
  skills?: SkillEntry[];

  /**
   * Agents to compile
   * List of agent names from the agent registry
   */
  agents: string[];

  /**
   * Per-agent skill assignments
   * Overrides default mappings from SKILL_TO_AGENTS
   * If not specified for an agent, uses intelligent defaults
   */
  agent_skills?: Record<string, AgentSkillConfig>;

  /**
   * Default preload patterns per agent
   * Overrides default mappings from PRELOADED_SKILLS
   * Maps agent name to skill categories/patterns that should be preloaded
   */
  preload_patterns?: Record<string, string[]>;

  /**
   * Lifecycle hooks for the plugin
   */
  hooks?: Record<string, AgentHookDefinition[]>;

  // --- Optional metadata (for marketplace/publishing) ---

  /**
   * Author handle (e.g., "@vince")
   */
  author?: string;

  /**
   * Framework hint for agent behavior
   * @example "nextjs", "remix", "express"
   */
  framework?: string;

  /**
   * Guiding philosophy for the project
   */
  philosophy?: string;

  /**
   * Design principles
   */
  principles?: string[];

  /**
   * Tags for discoverability
   */
  tags?: string[];
}

/**
 * Skill entry - can be a string (ID only) or full assignment
 */
type SkillEntry = string | SkillAssignment;

/**
 * Full skill assignment with options
 */
export interface SkillAssignment {
  /**
   * Skill ID (e.g., "react (@vince)" or alias "react")
   */
  id: string;

  /**
   * If true, skill content is embedded in compiled agent
   * If false, skill is loaded dynamically via Skill tool
   * @default false
   */
  preloaded?: boolean;

  /**
   * If true, this is a local skill from .claude/skills/
   * @default false
   */
  local?: boolean;

  /**
   * Relative path for local skills
   * Required if local is true
   * @example ".claude/skills/my-custom-skill/"
   */
  path?: string;
}

/**
 * Per-agent skill configuration
 * Supports both simple list and categorized structure
 */
type AgentSkillConfig = SimpleAgentSkills | CategorizedAgentSkills;

/**
 * Simple flat list of skills for an agent
 * @example ["react", "zustand", "scss-modules"]
 */
type SimpleAgentSkills = SkillEntry[];

/**
 * Categorized skills for an agent (matches current agent_skills structure)
 * @example { framework: ["react"], styling: ["scss-modules"] }
 */
type CategorizedAgentSkills = Record<string, SkillEntry[]>;

/**
 * Hook action types (unchanged from current)
 */
export interface AgentHookAction {
  type: "command" | "script" | "prompt";
  command?: string;
  script?: string;
  prompt?: string;
}

export interface AgentHookDefinition {
  matcher?: string;
  hooks?: AgentHookAction[];
}
```

---

## Example YAML Files

### Minimal Config (80% use case)

```yaml
# .claude/config.yaml
name: my-project

agents:
  - web-developer
  - api-developer
  - web-tester
```

This minimal config:

- Uses all discovered skills from `.claude/skills/` and installed plugins
- Uses default agent-skill mappings (from SKILL_TO_AGENTS)
- Uses default preload patterns (from PRELOADED_SKILLS)

### Standard Config with Skills

```yaml
# .claude/config.yaml
name: my-saas-app
description: Full-stack SaaS application

skills:
  - react (@vince)
  - zustand (@vince)
  - scss-modules (@vince)
  - hono (@vince)
  - drizzle (@vince)
  - better-auth+drizzle+hono (@vince)
  - vitest (@vince)

agents:
  - web-developer
  - api-developer
  - web-reviewer
  - api-reviewer
  - web-tester
  - web-pm
```

### Config with Custom Agent-Skill Mappings

```yaml
# .claude/config.yaml
name: specialized-project
description: Project with custom skill assignments

skills:
  - react (@vince)
  - zustand (@vince)
  - scss-modules (@vince)
  - hono (@vince)
  - drizzle (@vince)

agents:
  - web-developer
  - api-developer
  - web-pm

# Override default mappings
agent_skills:
  web-developer:
    # Simple list - all skills for this agent
    - react (@vince)
    - zustand (@vince)
    - scss-modules (@vince)

  api-developer:
    # Categorized structure (existing format)
    api:
      - id: hono (@vince)
        preloaded: true
    database:
      - drizzle (@vince)

  web-pm:
    # PM only gets framework skill for context
    - react (@vince)
```

### Config with Local Skills

```yaml
# .claude/config.yaml
name: my-project-with-local-skills

skills:
  # Remote skills
  - react (@vince)
  - zustand (@vince)

  # Local skills
  - id: my-custom-patterns
    local: true
    path: .claude/skills/my-custom-patterns/

  - id: company-standards
    local: true
    path: .claude/skills/company-standards/

agents:
  - web-developer
  - api-developer
```

### Config with Preload Overrides

```yaml
# .claude/config.yaml
name: custom-preload-project

skills:
  - react (@vince)
  - zustand (@vince)
  - scss-modules (@vince)
  - vitest (@vince)

agents:
  - web-developer
  - web-tester

# Override which skills are preloaded per agent
preload_patterns:
  web-developer:
    - framework # Preload react
    - styling # Preload scss-modules
  web-tester:
    - testing # Preload vitest
    - mocks # Preload msw if available
```

### Full Config (Publishing/Marketplace)

```yaml
# .claude/config.yaml
version: "1"
name: nextjs-fullstack-stack
description: Complete Next.js fullstack development setup
author: "@vince"
framework: nextjs

skills:
  - id: react (@vince)
    preloaded: true
  - id: zustand (@vince)
  - id: scss-modules (@vince)
    preloaded: true
  - id: hono (@vince)
    preloaded: true
  - id: drizzle (@vince)
  - id: better-auth+drizzle+hono (@vince)
  - id: vitest (@vince)
  - id: msw (@vince)

agents:
  - web-developer
  - api-developer
  - web-reviewer
  - api-reviewer
  - web-tester
  - web-pm

agent_skills:
  web-developer:
    framework:
      - id: react (@vince)
        preloaded: true
    styling:
      - id: scss-modules (@vince)
        preloaded: true
    state:
      - zustand (@vince)
  api-developer:
    api:
      - id: hono (@vince)
        preloaded: true
    database:
      - drizzle (@vince)
    auth:
      - better-auth+drizzle+hono (@vince)

hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: prompt
          prompt: "Verify the file was written correctly by reading it back"

philosophy: >
  Ship fast with type safety. Use existing patterns. Avoid premature optimization.

principles:
  - "Investigation First: Never speculate. Read actual code before claims."
  - "Follow Existing Patterns: Match the style and conventions already in use."
  - "Minimal Necessary Changes: Surgical edits. Only change what's required."
  - "Anti-Over-Engineering: Simple solutions. Use existing utilities."
  - "Verify Everything: Test your work. Check success criteria."

tags:
  - nextjs
  - fullstack
  - typescript
  - react
```

---

## Migration Strategy

### From StackConfig to ProjectConfig

The unified config is **fully backward compatible** with StackConfig. The parser handles both formats.

#### Automatic Field Mapping

| StackConfig Field | ProjectConfig Field   | Notes                         |
| ----------------- | --------------------- | ----------------------------- |
| `id`              | (dropped)             | Not needed for project config |
| `name`            | `name`                | Same                          |
| `version`         | (dropped for project) | Version is in plugin.json     |
| `author`          | `author`              | Same (optional)               |
| `description`     | `description`         | Same                          |
| `created`         | (dropped)             | Not needed                    |
| `updated`         | (dropped)             | Not needed                    |
| `framework`       | `framework`           | Same                          |
| `skills`          | `skills`              | Same format supported         |
| `agents`          | `agents`              | Same                          |
| `agent_skills`    | `agent_skills`        | Same, plus simple list format |
| `hooks`           | `hooks`               | Same                          |
| `philosophy`      | `philosophy`          | Same                          |
| `principles`      | `principles`          | Same                          |
| `tags`            | `tags`                | Same                          |

#### Migration Steps

1. **Automatic detection:** Parser checks for `version` field
   - If `version: "1"` -> new format
   - If no `version` or `version: "1.0.0"` (semver) -> legacy format

2. **Runtime normalization:** Legacy configs are normalized at load time
   - No file modification required
   - Both formats work identically

3. **Optional migration command:**
   ```bash
   cc migrate config  # Rewrites config to new format
   ```

### Moving SKILL_TO_AGENTS to Config

Currently hardcoded in `src/cli/lib/skill-agent-mappings.ts`.

#### Phase 1: Config Override (No Breaking Change)

```yaml
# .claude/config.yaml
agent_skills:
  web-developer:
    - react
    - zustand
```

**Behavior:**

- If `agent_skills` is specified for an agent, use it
- Otherwise, fall back to SKILL_TO_AGENTS defaults

#### Phase 2: Defaults in YAML (Future)

Move defaults to a bundled `defaults.yaml`:

```yaml
# src/defaults/agent-mappings.yaml
skill_to_agents:
  "frontend/*":
    - web-developer
    - web-reviewer
    - web-researcher
    # ...

  "backend/*":
    - api-developer
    - api-reviewer
    # ...

preloaded_skills:
  web-developer:
    - framework
    - styling
  api-developer:
    - api
    - database
```

User config merges with/overrides defaults.

---

## Validation Rules

### Required Fields

| Field    | Condition                    |
| -------- | ---------------------------- |
| `name`   | Always required              |
| `agents` | Required if compiling agents |

### Type Validation

```typescript
function validateProjectConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Config must be an object"], warnings: [] };
  }

  const c = config as Record<string, unknown>;

  // Required: name
  if (!c.name || typeof c.name !== "string") {
    errors.push("name is required and must be a string");
  }

  // Required: agents (for compilation)
  if (!c.agents || !Array.isArray(c.agents)) {
    errors.push("agents is required and must be an array");
  } else {
    for (const agent of c.agents) {
      if (typeof agent !== "string") {
        errors.push(`agents must contain strings, found: ${typeof agent}`);
      }
    }
  }

  // Optional: version
  if (c.version !== undefined && c.version !== "1") {
    errors.push('version must be "1" (or omitted for default)');
  }

  // Optional: skills
  if (c.skills !== undefined) {
    if (!Array.isArray(c.skills)) {
      errors.push("skills must be an array");
    } else {
      for (const skill of c.skills) {
        if (typeof skill !== "string" && typeof skill !== "object") {
          errors.push("skills must be strings or objects");
        }
        if (typeof skill === "object" && skill !== null) {
          const s = skill as Record<string, unknown>;
          if (!s.id || typeof s.id !== "string") {
            errors.push("skill object must have an id string");
          }
          if (s.local === true && !s.path) {
            errors.push(`local skill "${s.id}" must have a path`);
          }
        }
      }
    }
  }

  // Optional: agent_skills
  if (c.agent_skills !== undefined) {
    if (typeof c.agent_skills !== "object" || c.agent_skills === null) {
      errors.push("agent_skills must be an object");
    }
  }

  // Warnings for deprecated patterns
  if (c.id !== undefined) {
    warnings.push("id field is deprecated in project config");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

### Semantic Validation

```typescript
function validateSemanticRules(
  config: ProjectConfig,
  availableSkills: string[],
  availableAgents: string[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate referenced skills exist
  if (config.skills) {
    for (const skill of config.skills) {
      const id = typeof skill === "string" ? skill : skill.id;
      if (!availableSkills.includes(id)) {
        errors.push(`Skill "${id}" not found in available skills`);
      }
    }
  }

  // Validate referenced agents exist
  for (const agent of config.agents) {
    if (!availableAgents.includes(agent)) {
      errors.push(`Agent "${agent}" not found in available agents`);
    }
  }

  // Validate agent_skills reference valid skills
  if (config.agent_skills) {
    for (const [agentName, skills] of Object.entries(config.agent_skills)) {
      if (!config.agents.includes(agentName)) {
        warnings.push(
          `agent_skills contains "${agentName}" not in agents list`,
        );
      }
      // Check skill references...
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

---

## Default Values

| Field              | Default Value | Notes                                 |
| ------------------ | ------------- | ------------------------------------- |
| `version`          | `"1"`         | Current schema version                |
| `description`      | `""`          | Empty string                          |
| `skills`           | `[]`          | Empty, discovers from .claude/skills/ |
| `agent_skills`     | `undefined`   | Uses SKILL_TO_AGENTS mappings         |
| `preload_patterns` | `undefined`   | Uses PRELOADED_SKILLS mappings        |
| `author`           | `"@user"`     | Default author for publishing         |
| `framework`        | `undefined`   | No framework hint                     |
| `hooks`            | `undefined`   | No hooks                              |
| `philosophy`       | `undefined`   | No philosophy                         |
| `principles`       | `[]`          | No principles                         |
| `tags`             | `[]`          | No tags                               |

---

## Skill Resolution Order

When compiling agents, skills are resolved in this order:

1. **Explicit config.skills** - Skills listed in config
2. **Local skills** - Skills in `.claude/skills/`
3. **Plugin skills** - Skills from installed plugins

For agent-skill assignment:

1. **Explicit agent_skills** - If defined for this agent
2. **Default mappings** - From SKILL_TO_AGENTS patterns
3. **All skills** - Fallback if no mappings match

For preload decisions:

1. **Explicit preload flag** - `preloaded: true` in skill entry
2. **Explicit preload_patterns** - If defined for this agent
3. **Default patterns** - From PRELOADED_SKILLS mappings

---

## Implementation Notes

### Parser Changes

The config parser in `src/cli/lib/config.ts` needs to:

1. Support both legacy StackConfig and new ProjectConfig
2. Normalize agent_skills to handle both simple list and categorized formats
3. Merge user config with default mappings

### Loader Changes

The loader in `src/cli/lib/loader.ts` needs to:

1. Load from `.claude/config.yaml` (not `.claude-collective/config.yaml`)
2. Support the new skill entry formats
3. Resolve local skill paths correctly

### Recompiler Changes

The recompiler in `src/cli/lib/agent-recompiler.ts` needs to:

1. Use unified config parsing
2. Support simple list format for agent_skills
3. Apply preload_patterns if specified

---

## File Location Summary

| Config Type    | Location                                          | Purpose                            |
| -------------- | ------------------------------------------------- | ---------------------------------- |
| Project config | `.claude/config.yaml`                             | User-editable project settings     |
| Plugin config  | `~/.claude/plugins/claude-collective/config.yaml` | Generated, tracks installed skills |
| Global config  | `~/.claude-collective/config.yaml`                | Source URL, marketplace settings   |

---

## Schema JSON (for Validation)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "agents"],
  "properties": {
    "version": {
      "type": "string",
      "enum": ["1"]
    },
    "name": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "description": {
      "type": "string"
    },
    "skills": {
      "type": "array",
      "items": {
        "oneOf": [
          { "type": "string" },
          {
            "type": "object",
            "required": ["id"],
            "properties": {
              "id": { "type": "string" },
              "preloaded": { "type": "boolean" },
              "local": { "type": "boolean" },
              "path": { "type": "string" }
            }
          }
        ]
      }
    },
    "agents": {
      "type": "array",
      "items": { "type": "string" }
    },
    "agent_skills": {
      "type": "object",
      "additionalProperties": {
        "oneOf": [
          {
            "type": "array",
            "items": {
              "oneOf": [{ "type": "string" }, { "type": "object" }]
            }
          },
          {
            "type": "object",
            "additionalProperties": {
              "type": "array"
            }
          }
        ]
      }
    },
    "preload_patterns": {
      "type": "object",
      "additionalProperties": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "hooks": {
      "type": "object"
    },
    "author": { "type": "string" },
    "framework": { "type": "string" },
    "philosophy": { "type": "string" },
    "principles": {
      "type": "array",
      "items": { "type": "string" }
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

---

## Open Questions

### Resolved

- **Q:** Where should project config live?
  **A:** `.claude/config.yaml` (aligns with Claude Code plugin structure)

- **Q:** How to handle both simple and categorized agent_skills?
  **A:** Parser detects format - array = simple list, object = categorized

- **Q:** How to migrate existing configs?
  **A:** Full backward compatibility - no migration required

### Needs Discussion

- **Q:** Should we support importing/extending base configs?

  ```yaml
  extends: "@claude-collective/nextjs-stack"
  ```

  This could simplify config but adds complexity.

- **Q:** Should `preload_patterns` use skill IDs or category names?
  Current design uses category names (matching PRELOADED_SKILLS).
  Alternative: use skill IDs directly for more explicit control.
