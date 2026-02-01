# Solution A: Agent-Centric Configuration - Migration Plan

## Executive Summary

Move skill mappings INTO agent YAMLs. Stacks become simple agent groupings in `skills-matrix.yaml`. Stack config files are eliminated entirely.

**Key Outcomes:**

- Looking at an agent YAML tells you exactly which skills it uses
- Skills have inline `preloaded` flag (no separate array)
- Stacks = agent groupings in matrix (not file-based configs)
- `cc build:stack` command dropped (deferred)

**Estimated Effort:** 5-7 days

---

## Architecture

### Agent YAML (New Structure)

```yaml
# web-developer/agent.yaml
id: web-developer
title: Web Developer
description: Implements frontend features from detailed specs
model: opus
tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash

skills:
  framework:
    id: react (@vince)
    preloaded: true
  styling:
    id: scss-modules (@vince)
    preloaded: true
  state:
    id: zustand (@vince)
    preloaded: false
  server-state:
    id: react-query (@vince)
    preloaded: false
  testing:
    id: vitest (@vince)
    preloaded: false
  mocks:
    id: msw (@vince)
    preloaded: false
```

### Stacks File (new: stacks.yaml)

```yaml
# config/stacks.yaml
stacks:
  - id: nextjs-fullstack
    name: Fullstack React
    description: Production-ready React with complete backend
    agents:
      - web-developer
      - api-developer
      - web-reviewer
      - api-reviewer
      - web-tester
      - web-pm
    philosophy: "Production-ready from day one"

  - id: react-frontend
    name: React Frontend Only
    description: React without backend infrastructure
    agents:
      - web-developer
      - web-reviewer
      - web-tester
    philosophy: "Pure frontend focus"
```

This separates concerns:

- `skills-matrix.yaml` - Skill categories, relationships, aliases
- `stacks.yaml` - Stack definitions with agent groupings

### What Gets Deleted

- `src/stacks/*/config.yaml` - All stack config files
- `agent_skills` section in stacks - Replaced by agent `skills` field
- `cc build:stack` command - Dropped for now

---

## Acceptance Criteria

1. **Agent YAML files** have explicit `skills` with inline `preloaded` flag
2. **stacks.yaml** defines stacks with `agents` list
3. **No stack config files** in `src/stacks/` (replaced by single `stacks.yaml`)
4. **CLI** resolves skills from agent YAMLs
5. **Wizard** uses `stacks.yaml` to determine which agents to include

---

## Phase 1: Types and Schema

---

**S | A1-1 | Add `skills` field to AgentYamlConfig type**

**File:** `/home/vince/dev/cli/src/types.ts`

```typescript
interface AgentSkillEntry {
  id: string;
  preloaded: boolean;
}

interface AgentYamlConfig {
  // ... existing fields ...

  /**
   * Skills this agent uses, keyed by category.
   * Each entry specifies the skill ID and whether it should be preloaded.
   */
  skills?: Record<string, AgentSkillEntry>;
}
```

**Success Criteria:**

- TypeScript compiles
- Preloaded flag is inline, not separate array

---

**S | A1-2 | Add `skills` field to AgentDefinition type**

**File:** `/home/vince/dev/cli/src/types.ts`

Same field on the resolved agent type.

---

**S | A1-3 | Update agent.schema.json**

**File:** `/home/vince/dev/cli/src/schemas/agent.schema.json`

```json
"skills": {
  "type": "object",
  "description": "Skills this agent uses, keyed by category",
  "additionalProperties": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "description": "Full skill ID (e.g., 'react (@vince)')"
      },
      "preloaded": {
        "type": "boolean",
        "description": "Whether to embed this skill in compiled agent",
        "default": false
      }
    },
    "required": ["id", "preloaded"]
  }
}
```

---

**S | A1-4 | Create Stack type**

**File:** `/home/vince/dev/cli/src/cli-v2/types-stacks.ts` (new file)

```typescript
interface Stack {
  id: string;
  name: string;
  description: string;
  agents: string[];
  philosophy?: string;
}

interface StacksConfig {
  stacks: Stack[];
}
```

---

**S | A1-5 | Create stacks.schema.json**

**File:** `/home/vince/dev/cli/src/schemas/stacks.schema.json` (new file)

```json
{
  "type": "object",
  "properties": {
    "stacks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "description": { "type": "string" },
          "agents": {
            "type": "array",
            "items": { "type": "string" }
          },
          "philosophy": { "type": "string" }
        },
        "required": ["id", "name", "agents"]
      }
    }
  },
  "required": ["stacks"]
}
```

---

## Phase 2: Loader Updates

---

**M | A2-1 | Update loadAllAgents to extract skills**

**File:** `/home/vince/dev/cli/src/cli-v2/lib/loader.ts`

```typescript
agents[config.id] = {
  title: config.title,
  description: config.description,
  model: config.model,
  tools: config.tools,
  path: agentPath,
  sourceRoot: projectRoot,
  skills: config.skills, // NEW: pass through skills
};
```

---

**M | A2-2 | Create stacks loader**

**File:** `/home/vince/dev/cli/src/cli-v2/lib/stacks-loader.ts` (new file)

```typescript
export async function loadStacks(configDir: string): Promise<Stack[]> {
  const stacksPath = path.join(configDir, "stacks.yaml");
  const content = await readFile(stacksPath, "utf-8");
  const config = parseYaml(content) as StacksConfig;
  return config.stacks;
}
```

---

## Phase 3: Resolution Logic

---

**M | A3-1 | Create resolveAgentSkills function**

**File:** `/home/vince/dev/cli/src/cli-v2/lib/resolver.ts`

```typescript
/**
 * Resolve skills from agent's skills field.
 */
export function resolveAgentSkills(
  agentDef: AgentDefinition,
  allSkills: Record<string, SkillDefinition>,
): SkillReference[] {
  if (!agentDef.skills) return [];

  return Object.entries(agentDef.skills).map(([category, entry]) => ({
    id: entry.id,
    usage: `when working with ${category}`,
    preloaded: entry.preloaded,
  }));
}
```

---

**M | A3-2 | Update getAgentSkills to use agent's skills**

**File:** `/home/vince/dev/cli/src/cli-v2/lib/resolver.ts`

Replace stack-based resolution with agent-based resolution.

---

**S | A3-3 | Delete skill-agent-mappings.ts and stack-based resolution**

Delete entirely (no backwards compatibility):

- `/home/vince/dev/cli/src/cli-v2/lib/skill-agent-mappings.ts` - Delete file
- `/home/vince/dev/cli/src/cli-v2/lib/resolver.ts` - Remove `resolveStackSkills` function

The agent's `skills` field replaces both `SKILL_TO_AGENTS` and `PRELOADED_SKILLS`.

---

## Phase 4: Command Updates

---

**M | A4-1 | Update init command for new flow**

**File:** `/home/vince/dev/cli/src/cli-v2/commands/init.tsx`

When user selects a stack:

1. Get agents list from matrix stack
2. Load each agent's skills from agent YAML
3. Generate config with agents and their skills

---

**M | A4-2 | Update compile command**

**File:** `/home/vince/dev/cli/src/cli-v2/commands/compile.ts`

Resolve skills from agent definitions, not stack configs.

---

**S | A4-3 | Remove or disable build:stack command**

**File:** `/home/vince/dev/cli/src/cli-v2/commands/build/stack.tsx`

Either remove entirely or show "deprecated" message. Stack building deferred.

---

**S | A4-4 | Update wizard store for agent-based stacks**

**File:** `/home/vince/dev/cli/src/cli-v2/stores/wizard-store.ts`

When stack selected, derive skills from agents in that stack.

---

## Phase 5: Agent YAML Updates (claude-subagents)

---

**L | A5-1 | Add skills to web-developer**

**File:** `/home/vince/dev/claude-subagents/src/agents/developer/web-developer/agent.yaml`

```yaml
skills:
  framework:
    id: web/framework/react (@vince)
    preloaded: true
  styling:
    id: web/styling/scss-modules (@vince)
    preloaded: true
  state:
    id: web/state/zustand (@vince)
    preloaded: false
  # ... remaining skills from nextjs-fullstack agent_skills
```

---

**M | A5-2 | Add skills to api-developer**

---

**M | A5-3 | Add skills to remaining developer agents**

- cli-developer
- web-architecture

---

**M | A5-4 | Add skills to reviewer agents**

- web-reviewer
- api-reviewer
- cli-reviewer

---

**M | A5-5 | Add skills to researcher agents**

- web-researcher
- api-researcher

---

**M | A5-6 | Add skills to tester and planning agents**

- web-tester
- web-pm

---

**S | A5-7 | Add skills to pattern and meta agents**

- pattern-scout
- web-pattern-critique
- skill-summoner
- agent-summoner
- documentor

---

## Phase 6: Matrix and Cleanup

---

**M | A6-1 | Create stacks.yaml with all stacks**

**File:** `/home/vince/dev/cli/config/stacks.yaml` (new file)

```yaml
stacks:
  - id: nextjs-fullstack
    name: Fullstack React
    description: Production-ready React with complete backend
    agents:
      - web-developer
      - api-developer
      - web-reviewer
      - api-reviewer
      - web-tester
      - web-pm
      - web-researcher
      - api-researcher
    philosophy: "Production-ready from day one"

  - id: vue-stack
    name: Vue Fullstack
    description: Vue 3 with Composition API
    agents:
      - web-developer
      - api-developer
      - web-reviewer
      - api-reviewer
    philosophy: "Progressive framework"

  # ... remaining stacks migrated from src/stacks/*/config.yaml
```

---

**M | A6-2 | Delete all stack config files**

**Repository:** `/home/vince/dev/claude-subagents`

Delete:

- `src/stacks/nextjs-fullstack/config.yaml`
- `src/stacks/vue-stack/config.yaml`
- `src/stacks/remix-stack/config.yaml`
- `src/stacks/angular-stack/config.yaml`
- `src/stacks/react-native-stack/config.yaml`
- `src/stacks/nuxt-stack/config.yaml`
- `src/stacks/solidjs-stack/config.yaml`

---

**S | A6-3 | Remove stack loading code**

**File:** `/home/vince/dev/cli/src/cli-v2/lib/loader.ts`

Remove `loadStack()` function and related code.

---

**S | A6-4 | Remove suggested_stacks from skills-matrix.yaml**

**File:** `/home/vince/dev/cli/config/skills-matrix.yaml`

Delete the `suggested_stacks` section (now in `stacks.yaml`).

---

**S | A6-5 | Clean up types**

**File:** `/home/vince/dev/cli/src/types.ts`

Remove or deprecate `StackConfig` interface and related types.

---

## Summary

| Phase          | Tasks   | Effort   | Description                                  |
| -------------- | ------- | -------- | -------------------------------------------- |
| 1: Types       | 5 tasks | 1 day    | Add skills to agent types, create Stack type |
| 2: Loaders     | 2 tasks | 0.5 days | Agent skills loader, stacks loader           |
| 3: Resolution  | 3 tasks | 1-2 days | Agent-based skill resolution                 |
| 4: Commands    | 4 tasks | 1-2 days | Update init, compile, remove build:stack     |
| 5: Agent YAMLs | 7 tasks | 1-2 days | Add skills to ~18 agents                     |
| 6: Cleanup     | 5 tasks | 1 day    | Create stacks.yaml, delete old configs       |

**Total:** 26 tasks, 5-7 days

---

## Test Plan

1. **Phase 1:** `bun tsc --noEmit` passes
2. **Phase 3:** Unit tests for `resolveAgentSkills`
3. **Phase 4:** `cc init` works with new flow
4. **Phase 5:** Agent YAMLs validate against schema
5. **Phase 6:** All tests pass after cleanup

**Integration Test:**

```bash
# Select nextjs-fullstack stack
cc init

# Verify agents have correct skills from their YAML files
cat .claude/agents/web-developer.md | grep -A 20 "preloaded_skills"
```

---

## Future Work (Deferred)

- **`cc edit:stack`** - CLI command to create/modify stack compositions
- **`cc build:stack`** - Build stack plugins from matrix + agents
- **TypeScript agent definitions** - Replace YAML with TypeScript for type-safe agent configs. Skills become first-class imports (`import { react } from '@skills'`) instead of string IDs. Enables IDE autocomplete, refactoring support, and compile-time validation of skill references. Agents already require a build step, so this adds no new complexity for users.
