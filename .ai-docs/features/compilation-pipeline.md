# Compilation Pipeline

**Last Updated:** 2026-02-25

## Overview

**Purpose:** Compile agent prompt files from partials (intro, workflow, examples, etc.) + skill assignments using Liquid templates.

**Entry Points:**

| Entry Point          | File                                     | When Called                    |
| -------------------- | ---------------------------------------- | ------------------------------ |
| `recompileAgents()`  | `src/cli/lib/agents/agent-recompiler.ts` | `compile` command, `edit` flow |
| `compileAllAgents()` | `src/cli/lib/compiler.ts:234`            | Called by recompileAgents      |
| `compileAllSkills()` | `src/cli/lib/compiler.ts:281`            | Called by recompileAgents      |

## Pipeline Flow

```
1. Agent Definitions Discovery
   -> getAgentDefinitions() (src/cli/lib/agents/agent-fetcher.ts)
   -> Returns AgentSourcePaths { agentsDir, templatesDir, sourcePath }

2. Skill Discovery
   -> discoverAllPluginSkills() (src/cli/lib/plugins/plugin-discovery.ts)
   -> discoverLocalProjectSkills() (commands/compile.ts:78-83)
   -> Merge: plugin skills + local (.claude/skills/) skills

3. Agent Resolution
   -> resolveAgentConfigs() in agent-recompiler.ts
   -> Reads project config (config.yaml)
   -> Resolves stack skills per agent
   -> Maps SkillReference -> Skill (with path, usage, preloaded flag)

4. Liquid Engine Setup
   -> createLiquidEngine() (src/cli/lib/compiler.ts:412-437)
   -> Template root hierarchy:
      a. {project}/.claude-src/agents/_templates/
      b. {project}/.claude/templates/ (legacy)
      c. {CLI_ROOT}/templates/ (built-in)

5. Per-Agent Compilation
   -> readAgentFiles() (src/cli/lib/compiler.ts:126-167)
      Reads: intro.md, workflow.md, examples.md, critical-requirements.md,
             critical-reminders.md, output-format.md
   -> buildAgentTemplateContext() (src/cli/lib/compiler.ts:169-190)
      Splits skills into preloaded vs dynamic
   -> sanitizeCompiledAgentData() (src/cli/lib/compiler.ts:77-115)
      Strips Liquid template syntax from all user-controlled fields
   -> engine.renderFile("agent", data) using LiquidJS

6. Output Validation
   -> validateCompiledAgent() (src/cli/lib/output-validator.ts)
   -> Checks: XML tag balance, template artifacts, placeholder text

7. Skill Compilation
   -> compileAllSkills() (src/cli/lib/compiler.ts:281-339)
   -> Deduplicates across agents
   -> For folder skills: copies SKILL.md, reference.md, examples/, scripts/
   -> For single-file skills: copies as SKILL.md

8. CLAUDE.md Copy
   -> copyClaudeMdToOutput() (src/cli/lib/compiler.ts:350-357)
   -> Resolves from stack directory

9. Commands Copy
   -> compileAllCommands() (src/cli/lib/compiler.ts:368-399)
   -> Copies *.md from src/commands/ to output
```

## Key Files

| File                                          | Purpose                                              |
| --------------------------------------------- | ---------------------------------------------------- |
| `src/cli/lib/compiler.ts`                     | Core compilation: Liquid engine, agent/skill compile |
| `src/cli/lib/agents/agent-recompiler.ts`      | Orchestrates recompilation flow                      |
| `src/cli/lib/agents/agent-fetcher.ts`         | Fetches agent definitions (local or remote)          |
| `src/cli/lib/agents/agent-plugin-compiler.ts` | Plugin-mode agent compilation                        |
| `src/cli/lib/resolver.ts`                     | Resolves skill references, CLAUDE.md path            |
| `src/cli/lib/output-validator.ts`             | Validates compiled agent output                      |

## Agent File Structure

Each agent has a directory with these files:

```
src/agents/{agent-name}/
  intro.md                    # Required: agent introduction/role
  workflow.md                 # Required: agent workflow/process
  examples.md                 # Optional: usage examples
  critical-requirements.md    # Optional: top-of-prompt requirements
  critical-reminders.md       # Optional: bottom-of-prompt reminders
  output-format.md            # Optional: output format specification
  agent.yaml                  # Agent configuration (tools, model, permissions)
```

Output format resolution falls back from agent-specific dir to parent category dir.

## Skill Types in Compilation

| Type      | In Compiled Agent                             | Loaded How                       |
| --------- | --------------------------------------------- | -------------------------------- |
| Preloaded | Content embedded directly in .md file         | Listed in frontmatter `skills:`  |
| Dynamic   | Metadata only (id, usage) in skill activation | Loaded via Skill tool at runtime |

Split logic: `src/cli/lib/compiler.ts:174-176`

## Output Structure

```
.claude/
  agents/
    web-developer.md        # Compiled agent prompt
    api-developer.md
    ...
  skills/
    web-framework-react/
      SKILL.md              # Skill content
      reference.md          # Optional reference
      examples/             # Optional examples dir
      scripts/              # Optional scripts dir
    ...
  commands/
    custom-command.md       # Custom command definitions
  CLAUDE.md                 # Stack-specific CLAUDE.md
```

## Security: Liquid Injection Prevention

File: `src/cli/lib/compiler.ts:31-115`

`sanitizeCompiledAgentData()` strips Liquid template syntax (`{{`, `}}`, `{%`, `%}`) from:

- Agent metadata: name, title, description, tools, model, permissionMode
- Skill metadata: id, description, usage, pluginRef
- File content: intro, workflow, examples, critical requirements/reminders, output format
- Preloaded skill IDs

This prevents user-controlled data (from YAML files) from executing as Liquid template code.

## Plugin-Mode Compilation

For native Claude Code plugin distribution:

| Compiler               | File                                          | Output                       |
| ---------------------- | --------------------------------------------- | ---------------------------- |
| `compileSkillPlugin()` | `src/cli/lib/skills/skill-plugin-compiler.ts` | Individual skill plugin dirs |
| `compileAgentPlugin()` | `src/cli/lib/agents/agent-plugin-compiler.ts` | Individual agent plugin dirs |
| `compileStackPlugin()` | `src/cli/lib/stacks/stack-plugin-compiler.ts` | Bundled stack plugin dir     |
