# Architecture

## Data Flow

```
Source Resolution -> Skill Loading -> Matrix Merging -> Wizard Selection -> Config Generation -> Compilation -> Installation
```

## Module Map

### Commands (`src/cli/commands/`)

| Command             | File                      | Purpose                               |
| ------------------- | ------------------------- | ------------------------------------- |
| `init`              | `init.ts`                 | Initialize project with wizard        |
| `edit`              | `edit.ts`                 | Modify existing installation          |
| `compile`           | `compile.ts`              | Recompile agents from skills          |
| `eject`             | `eject.ts`                | Export templates/config/skills/agents |
| `uninstall`         | `uninstall.ts`            | Remove plugin or local installation   |
| `build:plugins`     | `compile-plugins.ts`      | Build individual skill plugins        |
| `build:stack`       | `compile-stack.ts`        | Build stack into plugin               |
| `build:marketplace` | `generate-marketplace.ts` | Generate marketplace.json             |
| `validate`          | `validate.ts`             | Validate YAML/plugins                 |
| `list`              | `list.ts`                 | Show plugin info                      |
| `config`            | `config.ts`               | Manage configuration                  |
| `version`           | `version.ts`              | Bump plugin version                   |

### Library Modules (`src/cli/lib/`)

| Module                     | Purpose                               |
| -------------------------- | ------------------------------------- |
| `loader.ts`                | Load agents, skills, stacks from YAML |
| `resolver.ts`              | Resolve references between configs    |
| `compiler.ts`              | Compile agents via Liquid templates   |
| `source-loader.ts`         | Multi-source loading (local/remote)   |
| `stack-installer.ts`       | Install stacks as Claude plugins      |
| `wizard.ts`                | Interactive selection wizard          |
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
├── stacks/           # Pre-built bundles
│   ├── nextjs-fullstack/
│   ├── vue-stack/
│   └── ...
└── schemas/          # JSON schemas

.claude/
├── agents/           # Compiled agent markdown
└── skills/           # Deployed skills (flat)
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

```
.claude/
├── config.yaml       # Project config
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

## Config Resolution Precedence

```
--source flag > CC_SOURCE env > project .claude/config.yaml > global ~/.claude-collective/config.yaml > default
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
