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

<!-- TODO: Add animated GIF of the full init wizard flow (stack selection → skill grid → agent config → done).
This is the hero image. It should show the complete happy path in ~15-20 seconds.
<p align="center">
  <img src="./assets/init-wizard.gif" alt="Agents Inc init wizard" width="700">
</p>
-->

## What this does

Claude Code doesn't know your stack. It doesn't know your patterns, your conventions, or the specific way you use your tools. So you end up repeating the same instructions or maintaining freeform markdown skills that fail silently when something's wrong.

Agents Inc fixes this with structured skills: focused knowledge modules for specific technologies. Each skill covers patterns, conventions, anti-patterns, edge cases, and real code examples. Skills get compiled into specialized subagents (a web developer, a reviewer, a tester, a PM) that actually know what they're doing.

The whole thing is opt-in and works alongside your existing Claude Code setup. It uses smart defaults, but there are progressive levels of customization: edit the config, swap skills, choose which to preload and which to load dynamically, eject templates, eject agent partials, or eject entire skills.

Under the hood, the CLI is written in strict TypeScript with Zod for runtime validation and JSON Schema generation. Skills and agents are validated against these schemas, so misconfigurations surface immediately. Agent compilation uses Liquid templates, so the output format is fully customizable without touching CLI internals.

## Getting started

```bash
# Run the wizard
npx @agents-inc/cli init

# Or install globally
npm install -g @agents-inc/cli
```

Requires Node 18+ and [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

The wizard walks you through the full setup:

### 1. Pick a stack or start from scratch

<!-- TODO: Screenshot of the stack selection screen.
Shows the list of available stacks (nextjs-fullstack, angular-stack, vue-stack, etc.)
with descriptions and skill counts.
<img src="./assets/screenshot-stacks.png" alt="Stack selection" width="700">
-->

Stacks bundle skills together with pre-configured agents. Instead of picking skills individually, grab a stack that matches your setup:

- **nextjs-fullstack**: Next.js + React + Hono + Drizzle + PostHog + Zustand + React Query
- **angular-stack**: Angular 19 + Signals + NgRx SignalStore + Hono + Drizzle
- **vue-stack**: Vue 3 Composition API + Pinia + Hono + Drizzle
- **nuxt-stack**: Nuxt + Vue 3 full-stack + Pinia + Hono + Drizzle
- **remix-stack**: Remix + React + Hono + Drizzle
- **solidjs-stack**: SolidJS + Hono + Drizzle
- **react-native-stack**: React Native + Expo + Zustand + React Query
- **meta-stack**: Agents for creating agents, skills, docs, and extracting patterns

Or select "Start from scratch" to browse domains and pick skills one by one.

### 2. Customize skills

<!-- TODO: Screenshot of the skill selection grid.
Shows skills organized by category (web, api, mobile, etc.) with checkboxes,
tagged by source when multiple sources are configured.
<img src="./assets/screenshot-skills.png" alt="Skill selection" width="700">
-->

After picking a stack, you can add or remove individual skills. 87+ skills are available across these categories:

**Web**<br>
`React` `Vue` `Angular` `SolidJS` `Next.js` `Remix` `Nuxt` `SCSS Modules` `CVA` `Zustand` `Pinia` `NgRx SignalStore` `Jotai` `React Query` `SWR` `tRPC` `GraphQL` `React Hook Form` `Zod` `shadcn/ui` `Radix UI` `TanStack Table` `Vitest` `Playwright` `Cypress` `MSW` `Framer Motion` `Storybook` `Accessibility`

**API**<br>
`Hono` `Express` `Fastify` `Drizzle` `Prisma` `Better Auth` `PostHog` `Resend` `Axiom + Pino + Sentry` `GitHub Actions`

**Mobile**<br>
`React Native` `Expo`

**CLI**<br>
`Commander` `oclif + Ink`

**Infra**<br>
`Turborepo` `Tooling` `Env config`

**Meta**<br>
`Code reviewing` `Research methodology` `Investigation requirements` `Anti-over-engineering` `Context management`

Skills live in the [Agents Inc marketplace](https://github.com/agents-inc/skills). Each one is a structured package with metadata, versioning, and compatibility declarations. Everything is validated against schemas, so if a skill name doesn't match or a config is malformed, you get an actual error instead of silent failure.

### 3. Configure subagents

<!-- TODO: Screenshot of the subagent configuration screen.
Shows which agents will be compiled (web-developer, web-reviewer, web-tester, etc.)
and which skills are mapped to each one.
<img src="./assets/screenshot-agents.png" alt="Subagent configuration" width="700">
-->

Each stack includes agents like `web-developer`, `api-developer`, `web-reviewer`, `web-tester`, `web-researcher`, `pattern-scout`, and `documentor`: roles that use the right skills for the job.

---

Both modes (stack or from scratch) compile agents and generate a config at `.claude-src/config.yaml`. Use `agentsinc edit` to change your setup at any time.

## Commands

| Command        | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `init`         | Interactive setup: pick skills, configure agents           |
| `edit`         | Modify your skill selection                                |
| `compile`      | Recompile agents after changes                             |
| `update`       | Pull latest skills from source                             |
| `search`       | Search skills across sources (interactive or static query) |
| `eject`        | Export skills or agent partials for customization          |
| `new skill`    | Scaffold a custom skill                                    |
| `new agent`    | Scaffold a custom agent                                    |
| `import skill` | Import a skill from an external GitHub repository          |
| `doctor`       | Diagnose setup issues                                      |
| `uninstall`    | Remove Agents Inc from your project                        |

Every command supports `--dry-run` and `--source` flags. Run `agentsinc --help` for the full command list including `config`, `version`, `build`, `diff`, `outdated`, `validate`, `info`, and `list`.

## Importing third-party skills

Import skills from any GitHub repository into your local setup:

```bash
# List available skills from a repository
agentsinc import skill github:your-org/skills --list

# Import a specific skill
agentsinc import skill github:your-org/skills --skill react-best-practices

# Import all skills from a repository
agentsinc import skill github:your-org/skills --all
```

Imported skills are copied to `.claude/skills/` and tracked with metadata for future updates.

## Customization

Everything is configured through `.claude-src/config.yaml` with schema validation. There are progressive levels of customization depending on how deep you want to go:

**Edit the config directly** to change skill-to-agent mappings:

```yaml
web-developer:
  web-framework:
    id: web-framework-react
    preloaded: true
  web-styling: web-styling-tailwind-v3
```

**Eject** for deeper control:

```bash
# Eject agent partials (intro, workflow, critical requirements, etc.)
npx @agents-inc/cli eject agent-partials

# Eject the Liquid templates that control how agents are compiled
npx @agents-inc/cli eject agent-partials --templates

# Eject skills for local editing
npx @agents-inc/cli eject skills
```

**Create custom skills** when you need something that doesn't exist:

```bash
npx @agents-inc/cli new skill my-custom-skill
```

## Architecture

The CLI uses oclif for commands, Ink (React) for the terminal UI, and Zustand for wizard state. The codebase is organized into domain-driven library modules with barrel exports.

See [docs/reference/architecture.md](./docs/reference/architecture.md) for the full reference.

## Links

- [Agents Inc Skills](https://github.com/agents-inc/skills): the marketplace

## License

MIT
