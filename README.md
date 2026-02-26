<p align="center">
  <img alt="Agents Inc" src="./assets/logo.svg" width="300">
</p>

# Agents Inc

An agent composition framework that builds stacks and compiles specialized subagents for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

[![npm version](https://img.shields.io/npm/v/@agents-inc/cli)](https://www.npmjs.com/package/@agents-inc/cli)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node: 18+](https://img.shields.io/badge/Node-18%2B-green.svg)](https://nodejs.org/)

```bash
npx @agents-inc/cli init
```

<!-- TODO: Add animated GIF of the full init wizard flow (stack selection -> skill grid -> agent config -> done).
This is the hero image. It should show the complete happy path in ~15-20 seconds.
<p align="center">
  <img src="./assets/init-wizard.gif" alt="Agents Inc init wizard" width="700">
</p>
-->

## What This Is

Claude Code has no knowledge of your stack. It doesn't know your patterns, conventions, or the specific way you use your tools. You end up repeating the same instructions or maintaining freeform markdown that fails silently when something's misconfigured.

Agents Inc provides structured skills -- focused knowledge modules for specific technologies (React, Drizzle, Vitest, Hono, etc.). Each skill covers patterns, anti-patterns, edge cases, and real code examples, backed by a metadata schema with category, tags, conflict rules, and compatibility declarations.

Browse 87+ skills on the [plugin marketplace](https://github.com/agents-inc/skills) before installing. See what each skill contains, its category, and its compatibility -- then install only what you need. The marketplace is the discovery layer; the CLI is the build layer.

Skills don't work alone. They get compiled into role-based sub-agents -- a web developer, a reviewer, a tester, a PM -- through a Liquid template pipeline. The compilation step validates structure, sanitizes inputs to prevent template injection, and produces the final agent markdown files that Claude Code reads.

Everything is transparent and ejectable. Edit the config, swap skills in the interactive wizard, eject agent partials, eject the Liquid templates, fork entire skills locally, or create your own from scratch. No lock-in at any layer.

## How It Works

The compilation pipeline takes three inputs and produces specialized agent files:

```
Skills (87+ modules)       Agent Definitions          Liquid Templates
    |                           |                          |
    v                           v                          v
 [agentsinc compile] ---> Resolve + Validate ---> Render ---> Output
                                                              |
                                                              v
                                                    .claude/agents/*.md
                                                    .claude/skills/*/SKILL.md
```

**Skills** are atomic knowledge modules. Each has markdown content (`SKILL.md`) and YAML metadata (`metadata.yaml`) validated against a Zod schema. A skill looks like this:

```yaml
# SKILL.md frontmatter
---
name: web-framework-react
description: Component architecture, hooks, patterns
---
```

**Agents** are role definitions. Each agent has an intro (role description), workflow (how it operates), examples, and critical requirements. An agent references multiple skills and compiles into a single structured markdown file:

```markdown
# Compiled output: .claude/agents/web-developer.md
---
name: web-developer
description: Implements frontend features from detailed specs...
tools: Read, Write, Edit, Grep, Glob, Bash
model: opus
skills:
  - meta-methodology-write-verification
  - meta-methodology-anti-over-engineering
  - web-framework-react
  ...
---

<role>
You are an expert web developer...
</role>

<core_principles>
...
</core_principles>

<skill_activation_protocol>
...
</skill_activation_protocol>
```

The `skills:` list in frontmatter contains preloaded skills (embedded in the agent prompt). Dynamic skills are loaded on demand via the Skill tool during the agent's session.

**Templates** are Liquid files that control how agents are assembled. The default template produces structured markdown with XML semantic sections. Eject templates for full control over the compilation format.

**Compilation** (`agentsinc compile`) resolves skills, renders through Liquid templates, sanitizes user-controlled data, validates output (XML balance, placeholder detection), and writes final `.md` files to `.claude/agents/`.

## Getting Started

```bash
npx @agents-inc/cli init
```

Requires Node 18+ and [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

The wizard walks you through three steps:

**1. Pick a stack or start from scratch.** Stacks bundle skills together with pre-configured agents:

| Stack | Technologies |
|-------|-------------|
| `nextjs-fullstack` | Next.js + React + Hono + Drizzle + PostHog + Zustand + React Query |
| `angular-stack` | Angular 19 + Signals + NgRx SignalStore + Hono + Drizzle |
| `vue-stack` | Vue 3 Composition API + Pinia + Hono + Drizzle |
| `nuxt-stack` | Nuxt + Vue 3 full-stack + Pinia + Hono + Drizzle |
| `remix-stack` | Remix + React + Hono + Drizzle |
| `solidjs-stack` | SolidJS + Hono + Drizzle |

Or select "Start from scratch" to browse domains and pick skills one by one.

<!-- TODO: Screenshot of the stack selection screen.
<img src="./assets/screenshot-stacks.png" alt="Stack selection" width="700">
-->

**2. Customize skills.** Add or remove individual skills from the interactive grid. 87+ skills across web, API, CLI, infra, and meta categories.

<!-- TODO: Screenshot of the skill selection grid.
<img src="./assets/screenshot-skills.png" alt="Skill selection" width="700">
-->

**3. Compile agents.** The wizard compiles your selections into agent files. After init, use `agentsinc edit` to change your setup and `agentsinc compile` to rebuild.

## Skills

A skill is a folder with two files: `SKILL.md` (content) and `metadata.yaml` (schema-validated metadata). Skills are organized into categories:

**Web** -- frameworks, styling, state management, testing, forms, components, accessibility<br>
`React` `Vue` `Angular` `SolidJS` `Next.js` `Remix` `Nuxt` `SCSS Modules` `CVA` `Zustand` `Pinia` `NgRx SignalStore` `Jotai` `React Query` `SWR` `tRPC` `GraphQL` `React Hook Form` `Zod` `shadcn/ui` `Radix UI` `TanStack Table` `Vitest` `Playwright` `Cypress` `MSW` `Framer Motion` `Storybook` `Accessibility`

**API** -- frameworks, databases, auth, observability<br>
`Hono` `Express` `Fastify` `Drizzle` `Prisma` `Better Auth` `PostHog` `Resend` `Axiom + Pino + Sentry` `GitHub Actions`

**Mobile** -- `React Native` `Expo`<br>
**CLI** -- `Commander` `oclif + Ink`<br>
**Infra** -- `Turborepo` `Tooling` `Env config`<br>
**Meta** -- `Code reviewing` `Research methodology` `Investigation requirements` `Anti-over-engineering` `Context management`

Skills can be **preloaded** (embedded directly in the agent prompt) or **dynamic** (loaded on demand via the Skill tool during a session). Browse and discover skills on the [plugin marketplace](https://github.com/agents-inc/skills).

## Agents

An agent is a compiled role with specific expertise. Instead of one generic Claude Code setup, you get specialized sub-agents, each with its own skills, workflow, and requirements.

18 agent roles across 8 categories:

| Category | Agents |
|----------|--------|
| Developers | `web-developer` `api-developer` `cli-developer` `web-architecture` |
| Reviewers | `web-reviewer` `api-reviewer` `cli-reviewer` |
| Testers | `web-tester` `cli-tester` |
| Researchers | `web-researcher` `api-researcher` |
| Planning | `web-pm` |
| Pattern Analysis | `pattern-scout` `web-pattern-critique` |
| Migration | `cli-migrator` |
| Documentation | `documentor` |
| Meta | `skill-summoner` `agent-summoner` |

Each agent is assembled from modular pieces: role intro, workflow process, domain-specific skills, critical requirements, and output format. Every piece is ejectable for customization.

## Commands

### Primary

| Command | Description |
|---------|-------------|
| `init` | Interactive setup wizard: pick a stack, customize skills, compile agents |
| `edit` | Modify your skill selection in the interactive wizard |
| `compile` | Recompile agents after changes |
| `update` | Pull latest skills from source |

### Customization

| Command | Description |
|---------|-------------|
| `eject <type>` | Export components for customization (`agent-partials`, `templates`, `skills`, `all`) |
| `new skill` | Scaffold a custom skill with proper structure |
| `new agent` | Scaffold a custom agent |
| `import skill` | Import a skill from an external GitHub repository |
| `search` | Search skills across sources (interactive or static query) |

### Diagnostics

| Command | Description |
|---------|-------------|
| `doctor` | Diagnose setup issues |
| `diff` | Show changes between local and source skills |
| `outdated` | Check for skill updates |
| `validate` | Validate config and skill structure |
| `info` | Show project configuration details |
| `uninstall` | Remove Agents Inc from your project |

Run `agentsinc --help` for the full command list. Every command supports `--help` for detailed usage.

## Customization

Progressive layers, from simple configuration to full framework extension:

| Layer | What | How |
|-------|------|-----|
| 1. Edit config | Change skill-to-agent mappings, toggle preloaded/dynamic | Edit `.claude-src/config.yaml` |
| 2. Use the wizard | Add/remove skills interactively | `agentsinc edit` |
| 3. Eject agent partials | Customize intro, workflow, examples, critical requirements for any agent | `agentsinc eject agent-partials` |
| 4. Eject templates | Modify the Liquid template that controls compilation format | `agentsinc eject templates` |
| 5. Eject skills | Fork any skill for local editing | `agentsinc eject skills` |
| 6. Create custom skills | Scaffold a new skill with proper metadata structure | `agentsinc new skill` |
| 7. Create custom agents | Scaffold agent files (intro, workflow, requirements) | `agentsinc new agent` |
| 8. Custom skill sources | Point to a private repo or local directory as a skill source | Configure in settings |
| 9. Build plugins | Package skills/agents as Claude Code plugins for distribution | Plugin manifest system |

Config example -- map skills to agents with preload control:

```yaml
web-developer:
  web-framework:
    id: web-framework-react
    preloaded: true
  web-styling: web-styling-scss-modules
```

Import skills from any GitHub repository:

```bash
agentsinc import skill github:your-org/skills --list
agentsinc import skill github:your-org/skills --skill react-best-practices
agentsinc import skill github:your-org/skills --all
```

## Architecture

| Component | Technology |
|-----------|-----------|
| Commands | oclif |
| Terminal UI | Ink + React |
| Wizard state | Zustand |
| Validation | Zod (30+ schemas at parse boundaries) |
| Compilation | LiquidJS |
| Testing | Vitest |

The codebase is strict TypeScript (zero `any` policy) organized into domain-driven modules:

```
src/cli/
  commands/       # oclif command definitions
  components/     # Ink/React terminal UI components
  lib/            # Core logic (compiler, loader, resolver, schemas)
  stores/         # Zustand state management
  utils/          # Shared utilities
src/agents/       # Agent definitions (18 roles)
config/           # Skills matrix, stacks, default mappings
```

See [docs/reference/architecture.md](./docs/reference/architecture.md) for the full reference.

## Links

- [Plugin Marketplace](https://github.com/agents-inc/skills) -- browse and discover skills
- [Architecture Reference](./docs/reference/architecture.md) -- full system documentation

## License

MIT
