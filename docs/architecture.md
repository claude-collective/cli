# Architecture

## Data Flow

```
Source Resolution -> Skill Loading -> Matrix Merging -> Wizard Selection -> Config Generation -> Compilation -> Installation
```

## Module Map

### Commands (`src/cli/commands/`)

| Command                | File                      | Purpose                               |
| ---------------------- | ------------------------- | ------------------------------------- |
| `init`                 | `init.tsx`                | Initialize project with wizard        |
| `edit`                 | `edit.tsx`                | Modify existing installation          |
| `compile`              | `compile.ts`              | Recompile agents from skills          |
| `eject`                | `eject.ts`                | Export templates/config/skills/agents |
| `uninstall`            | `uninstall.tsx`           | Remove plugin or local installation   |
| `update`               | `update.tsx`              | Update installed skills/agents        |
| `build plugins`        | `build/plugins.ts`        | Build individual skill plugins        |
| `build stack`          | `build/stack.tsx`         | Build stack into plugin               |
| `build marketplace`    | `build/marketplace.ts`    | Generate marketplace.json             |
| `validate`             | `validate.ts`             | Validate YAML/plugins                 |
| `list`                 | `list.ts`                 | Show plugin info                      |
| `info`                 | `info.ts`                 | Display skill/agent information       |
| `search`               | `search.ts`               | Search skills in marketplace          |
| `outdated`             | `outdated.ts`             | Check for outdated skills             |
| `diff`                 | `diff.ts`                 | Show differences in configurations    |
| `doctor`               | `doctor.ts`               | Diagnose installation issues          |
| `new agent`            | `new/agent.tsx`           | Create a new custom agent             |
| `new skill`            | `new/skill.ts`            | Create a new custom skill             |
| `config`               | `config/index.ts`         | Configuration management (parent)     |
| `config show`          | `config/show.ts`          | Show current configuration            |
| `config get`           | `config/get.ts`           | Get a specific config value           |
| `config set`           | `config/set.ts`           | Set a global config value             |
| `config unset`         | `config/unset.ts`         | Remove a global config value          |
| `config set-project`   | `config/set-project.ts`   | Set a project-level config value      |
| `config unset-project` | `config/unset-project.ts` | Remove a project-level config value   |
| `config path`          | `config/path.ts`          | Show config file paths                |
| `version`              | `version/index.ts`        | Version management (parent)           |
| `version show`         | `version/show.ts`         | Show current version                  |
| `version bump`         | `version/bump.ts`         | Bump plugin version                   |
| `version set`          | `version/set.ts`          | Set specific version                  |

### Library Modules (`src/cli/lib/`)

| Module                     | Purpose                               |
| -------------------------- | ------------------------------------- |
| `loader.ts`                | Load agents, skills, stacks from YAML |
| `resolver.ts`              | Resolve references between configs    |
| `compiler.ts`              | Compile agents via Liquid templates   |
| `source-loader.ts`         | Multi-source loading (local/remote)   |
| `stack-installer.ts`       | Install stacks as Claude plugins      |
| `wizard/` components       | Interactive selection wizard (Ink)    |
| `skill-copier.ts`          | Copy skills with metadata             |
| `config-generator.ts`      | Generate configs from selections      |
| `plugin-finder.ts`         | Find plugin directories               |
| `matrix-resolver.ts`       | Validate skill dependencies/conflicts |
| `matrix-loader.ts`         | Load and merge skills matrix          |
| `stack-plugin-compiler.ts` | Full plugin compilation               |
| `project-config.ts`        | Parse unified ProjectConfig           |
| `custom-agent-resolver.ts` | Resolve custom agents with extends    |
| `defaults-loader.ts`       | Load YAML defaults for mappings       |
| `skill-agent-mappings.ts`  | Agent-skill mappings resolution       |

## Project Structure

```
src/
├── agents/           # Agent source files (partials)
│   ├── developer/
│   ├── planning/
│   ├── researcher/
│   ├── reviewer/
│   └── tester/
├── cli/              # CLI commands and utilities
│   ├── commands/     # oclif commands
│   ├── components/   # Ink React components
│   ├── lib/          # Core library modules
│   ├── stores/       # Wizard state (MobX)
│   └── utils/        # Helper utilities
├── schemas/          # JSON schemas for validation
│   ├── agent.schema.json
│   ├── plugin.schema.json
│   └── ...
└── types.ts          # Shared TypeScript types

config/
├── skills-matrix.yaml  # Skills configuration matrix
└── stacks.yaml         # Stack definitions
```

## Marketplace Structure (`claude-subagents`)

```
src/
├── skills/           # Hierarchical: category/subcategory/skill (@author)/
│   ├── api/
│   ├── cli/
│   ├── infra/
│   ├── meta/
│   ├── security/
│   └── web/
└── stacks/           # Pre-built bundles
    ├── nextjs-fullstack/
    ├── vue-stack/
    └── ...
```

## Skill Structure

```
{category}/{subcategory}/{skill-name} (@{author})/
├── SKILL.md          # Main content with frontmatter
├── metadata.yaml     # CLI metadata (category, requires, conflicts)
├── reference.md      # Decision frameworks (optional)
└── examples/         # Extended examples (optional)
```

## Stack Structure

```
{stack-name}/
├── config.yaml       # Stack definition
└── skills/           # Stack-specific skill overrides (optional)
```

## Plugin Output Structure

```
{plugin}/
├── .claude-plugin/
│   └── plugin.json   # Manifest
├── agents/
│   └── {agent}.md
├── skills/
│   └── {skillId}/
├── hooks/
│   └── hooks.json
├── CLAUDE.md
└── README.md
```

## Local Installation Structure

The CLI supports two configuration locations:

### Primary: `.claude-src/` (Recommended)

```
.claude-src/
├── config.yaml       # Project config (primary location)
├── agents/           # Custom agent overrides (optional)
└── skills/           # Custom local skills (optional)

.claude/
├── agents/
│   ├── {agent}.md    # Compiled agents
│   └── _partials/    # Ejected agent partials (optional)
│       └── {agent}/
│           ├── intro.md
│           └── workflow.md
├── skills/
│   └── {skillId}/
│       └── SKILL.md
└── templates/        # Ejected Liquid templates (optional)
    └── agent.liquid
```

### Legacy: `.claude/config.yaml`

The CLI also supports configuration in `.claude/config.yaml` for backward compatibility.

## Config Resolution Precedence

```
--source flag > CC_SOURCE env > project .claude-src/config.yaml > project .claude/config.yaml > global ~/.claude-collective/config.yaml > default
```

For agents_source:

```
--agent-source flag > project config agents_source > global config agents_source > bundled agents
```

## Agent Compilation

Agent parts read from `src/agents/{agentPath}/`:

- `intro.md` (required)
- `workflow.md` (required)
- `examples.md` (optional)
- `critical-requirements.md` (optional)
- `critical-reminders.md` (optional)
- `output-format.md` (optional)

Compiled via Liquid template with skills injected as preloaded (embedded) or dynamic (via Skill tool).

## Custom Agents

Custom agents defined in `config.yaml` can:

- Define entirely new agents with full configuration
- Extend built-in agents with `extends: agent-name`

Resolution:

1. Parse custom agent config
2. If `extends`, load base agent definition
3. Merge: custom overrides base
4. Compile with resolved skills
