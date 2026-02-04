# Stack Simplification Research

## Executive Summary

The current CLI stack architecture is complex and creates unnecessary pain points. This research document analyzes the existing system, identifies key problems, and proposes multiple solutions with varying levels of complexity and impact.

**Key Finding:** The system can be significantly simplified by shifting from "stacks containing agents and skills" to an "agent-centric configuration" where agents declare their skill requirements.

**Status:** Research only - requires discussion before any implementation tasks are created.

---

## 1. Current Architecture Analysis

### 1.1 How Stacks Currently Work

**Data Flow:**

```
src/stacks/{stack-id}/
├── config.yaml              # StackConfig with agents, skills, agent_skills
├── CLAUDE.md               # Stack philosophy/principles
└── (optional) agent.liquid # Custom agent template

Compilation Process:
1. loadStack(stackId) → reads config.yaml
2. loadSkillsByIds(stack.skills) → finds all skills in src/skills/
3. resolveAgents(agents, skills, compileConfig) → merges agent defs + skills
4. compileStackPlugin() → generates plugin directory with:
   - agents/*.md (compiled agent markdown)
   - skills/ (copied from src/skills/)
   - plugin.json (manifest)
```

**Key Files Involved:**

| File                                      | Responsibility                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `src/cli/lib/stack-plugin-compiler.ts` | Main compilation engine - loads stack, skills, resolves agents, writes output |
| `src/cli/lib/stack-installer.ts`       | Stack installation to Claude Code plugin directory                            |
| `src/cli/commands/build/stack.tsx`     | CLI command to build standalone stack plugins                                 |
| `src/cli/lib/loader.ts`                | `loadStack()`, `loadSkillsByIds()`, `loadAllAgents()` - file loading          |
| `src/cli/lib/resolver.ts`              | `resolveStackSkills()`, `stackToCompileConfig()` - skill-agent mapping        |
| `src/cli/lib/skill-agent-mappings.ts`  | Hardcoded `SKILL_TO_AGENTS`, `PRELOADED_SKILLS` mappings                      |
| `src/types.ts`                            | `StackConfig`, `CompileConfig`, `AgentConfig` type definitions                |

### 1.2 Current Data Structures

**StackConfig** (from `src/stacks/{id}/config.yaml`):

```typescript
interface StackConfig {
  id?: string;
  name: string;
  version: string;
  author: string;
  description?: string;
  skills: SkillAssignment[]; // All skills for this stack
  agents: string[]; // Which agents to compile
  agent_skills?: Record<string, Record<string, SkillAssignment[]>>; // Per-agent overrides
  hooks?: Record<string, AgentHookDefinition[]>;
  philosophy?: string;
  principles?: string[];
  tags?: string[];
}
```

**CompileConfig** (derived from stack):

```typescript
interface CompileConfig {
  name: string;
  description: string;
  claude_md: string;
  stack?: string; // Reference back to stack ID
  agents: Record<string, CompileAgentConfig>;
}
```

**Agent YAML** (from `src/agents/{agent}/agent.yaml`):

```typescript
interface AgentDefinition {
  id: string; // Agent ID (e.g., "web-developer")
  title: string;
  description: string;
  model?: string;
  tools: string[];
  // NO SKILL INFORMATION - skills come from stack
}
```

### 1.3 Critical Issue: Decouple Between Stack and Compile

The `stack-plugin-compiler.ts` (used in `build:stack`) and the `compile.ts` command use **entirely different flows**:

**build:stack Flow:**

1. Loads from `src/stacks/{id}/config.yaml`
2. Uses `stack-plugin-compiler.ts` with `resolveStackSkills()`
3. Creates standalone plugin directory in `dist/stacks/`

**cc compile Flow:**

1. Reads from `~/.claude/plugins/claude-collective/config.yaml`
2. Uses `agent-recompiler.ts` which discovers skills dynamically
3. Does NOT use `resolveStackSkills()` at all!
4. Skills resolution happens in `recompileAgents()` from agent frontmatter

This means **two entirely separate compilation engines** with different skill resolution logic.

---

## 2. Identified Pain Points

### P1: Skills Locked Behind Stacks

**Problem:** To use a skill, it must be part of a stack first.

**Impact:**

- Can't compile a single skill as a plugin
- Can't add a new skill without updating a stack's config.yaml
- Personal/exploratory work requires creating a new stack

**Example:**

```bash
# WANT to do:
cc compile skill-x

# MUST do instead:
# 1. Create src/stacks/temp/config.yaml
# 2. Add skill-x to skills array
# 3. Add agents that need it
# 4. Run cc build:stack --stack temp
```

### P2: Multiple Stack YAML Files in Marketplace

**Problem:** Each stack in `src/stacks/{id}/` needs a `config.yaml`, creating redundancy.

**Current state:**

- ~15 agent types
- Each agent needs a stack to be compiled
- Or stacks group multiple agents (nextjs-fullstack, python-api, etc.)
- But to add a NEW agent, you must update all relevant stack files

**Impact:**

- Maintenance burden - update agent.yaml in 2 places + update any affected stacks
- No single source of truth for "which agents exist"
- Stack proliferation - creates clutter in `src/stacks/`

### P3: Compile Requires Active Stack

**Problem:** `cc compile` needs `~/.claude/plugins/claude-collective/config.yaml` to exist.

**Code reference** (compile.ts:239-256):

```typescript
const configPath = path.join(pluginDir, "config.yaml");
const hasConfig = await fileExists(configPath);
if (hasConfig) {
  try {
    const configContent = await readFile(configPath);
    const config = parseYaml(configContent) as StackConfig;
    // Uses it to determine agents/skills
  }
}
```

**Impact:**

- Can't `cc compile` a newly added agent without first running `cc init` and selecting agents
- Creates circular dependency: need to compile agents, but compile needs a stack

### P4: Hardcoded Skill-to-Agent Mappings

**Problem:** Skill-to-agent mappings are hardcoded in `skill-agent-mappings.ts`.

**Current structure** (hardcoded in SKILL_TO_AGENTS):

```typescript
"frontend/*": [
  "web-developer", "web-reviewer", "web-researcher",
  "web-pm", "web-pattern-scout", "web-pattern-critique",
  "agent-summoner", "skill-summoner", "documentor"
],
"backend/*": [
  "api-developer", "api-reviewer", "api-researcher",
  // ...
],
```

**Impact:**

- Adding a new skill category requires code change
- Can't override mappings per-project without modifying CLI code
- Adding new agent type requires updating hardcoded mappings

### P5: Agent Definitions Have No Skill Information

**Problem:** `src/agents/{agent}/agent.yaml` doesn't declare skills.

**Current:**

```yaml
id: web-developer
title: Web Developer Agent
description: Implements frontend features...
model: opus
tools:
  - Read
  - Write
  - Edit
# NO SKILL INFORMATION!
```

**Impact:**

- Skill requirements are implicit, inferred from naming conventions
- Can't quickly see "what skills does this agent work with"
- No single source of truth for agent requirements

### P6: Two Compilation Engines

**Problem:** `stack-plugin-compiler.ts` and `agent-recompiler.ts` handle skill resolution differently.

**Impact:**

- Bugs in one don't occur in other - inconsistency
- Maintenance burden - fix skill resolution in both places
- Different behavior between building standalone stacks vs. compiling projects

---

## 3. User's Vision

The user has articulated a clear vision for simplification:

1. **Keep stacks as visual representation in CLI only** - not as a required architectural concept
2. **Single config file** for skill-to-agent mappings instead of one per stack
3. **Agent property `belongs_to_stack`** (array of strings) on each agent for grouping
4. **Dynamic stack creation** - when a stack is selected in CLI, auto-create the stack config
5. **Preview and customize** - show which agents will be created, let users change skill loading per agent
6. **Seamless developer experience** - intuitive, not overly configurable

**Real-world pain point example:**

> "I am within the CLI itself and I added agent partials and added skills in the claude-subagents repository. But I'm unable to compile the agent properly using this CLI because it would mean updating the stack which I have active only so that I can get access to the agent I've just created."

---

## 4. Proposed Solutions

### Solution A: Agent-Centric Configuration (RECOMMENDED)

**Core Idea:** Agents declare their skill requirements. Stacks become optional groupings.

**Changes:**

1. **Add `belongs_to_stacks` to AgentDefinition:**

```yaml
# src/agents/web-developer/agent.yaml
id: web-developer
title: Web Developer Agent
description: Implements frontend features...
model: opus
tools: [Read, Write, Edit, Grep, Glob, Bash]

# NEW: Default skill categories this agent uses
skill_categories:
  - framework
  - styling
  - state
  - form
  - testing
  - mocks

# NEW: Optional - group this agent with others
belongs_to_stacks:
  - nextjs-fullstack
  - react-spa
  - vanilla-spa
```

2. **Stacks become optional groupings derived from agent metadata**

3. **Single resolution engine** using agent skill_categories as fallback

**Advantages:**

- Agents self-document their skill needs
- Can compile agents without a stack
- Stacks become optional display/organization tool
- Single source of truth per agent
- Backward compatible - existing stacks still work

**Disadvantages:**

- Requires updating all 18 agent YAML files
- Still need `skill_categories` → actual skills resolution

**Implementation Effort:** Medium (2-3 days)

---

### Solution B: Single Unified Agent-Skill Manifest

**Core Idea:** One config file declares all agent-to-skill mappings.

```yaml
# src/manifest.yaml
version: "1.0"

agents:
  web-developer:
    title: Web Developer Agent
    skills: [react, zustand, scss-modules, vitest]
    preloaded: [react, scss-modules]

stacks:
  nextjs-fullstack:
    agents: [web-developer, api-developer, web-reviewer]
    philosophy: "Ship fast with type safety"
```

**Advantages:**

- Single source of truth for all mappings
- No stack YAML files needed
- Easy to overview

**Disadvantages:**

- One large file instead of distributed configs
- Breaking change - requires migration
- Agents can't self-document independently

**Implementation Effort:** High (4-5 days)

---

### Solution C: Agent Property Extension (LIGHTER TOUCH)

**Core Idea:** Add optional skill hints to agents without removing stacks.

```yaml
# src/agents/web-developer/agent.yaml
skill_hints:
  categories: [framework, styling, state, form, testing]
  preload_categories: [framework, styling]
```

**Advantages:**

- Minimal changes to existing code
- Backward compatible
- Incremental adoption

**Disadvantages:**

- Doesn't eliminate stack complexity
- Hints are just hints, not authoritative

**Implementation Effort:** Low (1-2 days)

---

### Solution D: Move Hardcoded Mappings to YAML Defaults

**Core Idea:** Replace hardcoded SKILL_TO_AGENTS with bundled YAML that can be overridden.

```yaml
# src/cli/defaults/agent-mappings.yaml
skill_to_agents:
  "frontend/*": [web-developer, web-reviewer, ...]
  "backend/*": [api-developer, api-reviewer, ...]
```

**Advantages:**

- Makes defaults visible and editable
- Supports local overrides
- Minimal code changes

**Disadvantages:**

- Doesn't solve core "stacks required" issue
- Two sources of truth (defaults + stacks)

**Implementation Effort:** Low (1 day)

---

## 5. Comparison Matrix

| Aspect                                 | Solution A | Solution B | Solution C | Solution D |
| -------------------------------------- | ---------- | ---------- | ---------- | ---------- |
| **Solves P1** (Skills locked)          | Partial    | Yes        | Workaround | No         |
| **Solves P2** (Multiple YAMLs)         | Partial    | Yes        | No         | No         |
| **Solves P3** (Compile requires stack) | Yes        | Yes        | Partial    | No         |
| **Solves P4** (Hardcoded mappings)     | Partial    | Yes        | No         | Yes        |
| **Solves P5** (No agent skills)        | Yes        | Yes        | Yes        | No         |
| **Solves P6** (Dual engines)           | Yes        | Yes        | Yes        | No         |
| **Breaking Changes**                   | Small      | Large      | None       | None       |
| **Implementation Time**                | 2-3 days   | 4-5 days   | 1-2 days   | 1 day      |
| **Backward Compatible**                | Yes        | Partial    | Yes        | Yes        |
| **Incremental Adoption**               | Yes        | No         | Yes        | Yes        |

---

## 6. Recommended Approach: Two-Phase Hybrid

**Phase 1 (Immediate):** Apply Solution D + C

1. Extract hardcoded mappings to `agent-mappings.yaml`
2. Add `skill_hints` optional field to agents
3. Update resolver to fallback to skill_hints
4. Allows compilation without stack in many cases

**Phase 2 (Later):** Transition to Solution A

1. Add `skill_categories` to all agent definitions
2. Add `belongs_to_stacks` grouping
3. Update resolver to use skill_categories as primary source
4. Keep stacks for marketplace/special cases

**Result after both phases:**

- Agents are self-documenting
- Can compile without stacks
- Stacks still work for marketplace/organization
- Single resolution engine
- Backward compatible throughout

---

## 7. Developer Experience Considerations

### What should "just work":

1. **Adding a new agent** - Create agent.yaml with skill_categories, immediately compilable
2. **Adding a new skill** - Add to skills directory, agents with matching categories pick it up
3. **Customizing per-project** - Override skill assignments in .claude/config.yaml
4. **Viewing what will be created** - CLI shows preview before compilation
5. **Changing skill assignments** - Edit config, recompile, done

### What should be intuitive:

1. **Stack selection** - Visual grouping in CLI, creates config automatically
2. **Skill browsing** - See skills by category, understand what each does
3. **Agent customization** - Choose which skills to preload vs. load on demand
4. **Configuration discovery** - Clear documentation of what can be configured where

### What should NOT be required:

1. Updating stack YAML files to add a new agent
2. Creating a stack just to compile one agent
3. Understanding the dual compilation engines
4. Modifying CLI code to add skill mappings

---

## 8. Open Questions for Discussion

1. **Should stacks remain as a concept at all, or just agent groupings?**
   - Current thinking: Keep for marketplace organization, make optional for local dev

2. **Where should the skill-to-agent mapping live?**
   - Option A: In each agent's YAML (distributed)
   - Option B: In a single manifest (centralized)
   - Option C: Combination (agents declare categories, manifest maps categories to skills)

3. **How to handle backward compatibility with existing stacks?**
   - Keep stack compilation path unchanged
   - Add new agent-centric path as alternative

4. **Should the CLI auto-generate stack configs, or should users create them?**
   - User's preference: Auto-generate when a stack is selected

5. **What level of customization is appropriate?**
   - Avoid over-engineering: Simple defaults that work, overrides when needed

---

## 9. Next Steps

**This research requires discussion before implementation.** Recommended process:

1. Review this document
2. Discuss and refine the approach
3. Make decision on which solution(s) to pursue
4. THEN create implementation tasks

**Note:** No TODO items should be added for this work until the approach is agreed upon.

---

## 10. References

- D-03 in TODO.md: Original deferred task for stack simplification
- `src/cli/lib/stack-plugin-compiler.ts`: Current stack compilation
- `src/cli/lib/skill-agent-mappings.ts`: Hardcoded mappings
- `src/cli/commands/compile.ts`: Current compile command
