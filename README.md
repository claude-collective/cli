<p align="center">
  <img alt="Agents Inc" src="./assets/logo.svg" width="300">
</p>

# Agents Inc

An agent composition framework that builds stacks and compiles specialized subagents for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Manage your subagents and skills with code via a unified CLI.

[![npm version](https://img.shields.io/npm/v/@agents-inc/cli)](https://www.npmjs.com/package/@agents-inc/cli)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node: 18+](https://img.shields.io/badge/Node-18%2B-green.svg)](https://nodejs.org/)

<!-- TODO: Add animated GIF of the full init wizard flow (stack selection -> skill grid -> agent config -> done).
This is the hero image. It should show the complete happy path in ~15-20 seconds.
<p align="center">
  <img src="./assets/init-wizard.gif" alt="Agents Inc init wizard" width="700">
</p>
-->

## Overview

Agents Inc comprises two parts:

- **[Marketplace](https://github.com/agents-inc/skills):** 87+ atomic, best-practice skills spanning web, API, CLI, infra, and meta domains
- **CLI:** installs, ejects, creates, compiles, and updates skills and subagents

Skills are composed into 18+ domain-specific subagents through templates and modular agent partials, all validated against strict Zod schemas. Everything is ejectable so there's endless customisation with no lock-in.

## How It Works

Each subagent is composed from modular partials (role, workflow, output format) plus a set of atomic skills. The CLI manages the full lifecycle:

- **Install:** pull skills from the public marketplace, your own, or a local directory either as plugins or directly as source files
- **Compose:** map skills to subagents, configure preloaded vs dynamic loading
- **Compile:** resolve skill mappings, Liquid templates, and agent partials into `.claude/agents/`
- **Eject:** take progressive ownership of any layer (partials, templates, skills, subagents)
- **Update:** pull upstream skill changes without losing local customizations

## Getting Started

```bash
npx @agents-inc/cli init
```

Requires Node 18+ and [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

The wizard has three steps:

**1. Pick a stack or start from scratch** (or create your own in your custom marketplace):

| Stack              | Technologies                                                       |
| ------------------ | ------------------------------------------------------------------ |
| `nextjs-fullstack` | Next.js + React + Hono + Drizzle + PostHog + Zustand + React Query |
| `angular-stack`    | Angular 19 + Signals + NgRx SignalStore + Hono + Drizzle           |
| `vue-stack`        | Vue 3 Composition API + Pinia + Hono + Drizzle                     |
| `nuxt-stack`       | Nuxt + Vue 3 full-stack + Pinia + Hono + Drizzle                   |
| `remix-stack`      | Remix + React + Hono + Drizzle                                     |
| `solidjs-stack`    | SolidJS + Hono + Drizzle                                           |

**2. Customize skills.** Add or remove from the interactive grid.

**3. Select subagents.** Choose which role-based subagents to include.

**4. Compile.** After init, use `agentsinc edit` to change selections and `agentsinc compile` to rebuild.

## Skills

87+ skills organized by category:

**Web:** `React` `Vue` `Angular` `SolidJS` `Next.js` `Remix` `Nuxt` `SCSS Modules` `CVA` `Zustand` `Pinia` `NgRx SignalStore` `Jotai` `React Query` `SWR` `tRPC` `GraphQL` `React Hook Form` `Zod` `shadcn/ui` `Radix UI` `TanStack Table` `Vitest` `Playwright` `Cypress` `MSW` `Framer Motion` `Storybook` `Accessibility`

**API:** `Hono` `Express` `Fastify` `Drizzle` `Prisma` `Better Auth` `PostHog` `Resend` `Axiom + Pino + Sentry` `GitHub Actions`

**Mobile:** `React Native` `Expo`

**CLI:** `Commander` `oclif + Ink`

**Infra:** `Turborepo` `Tooling` `Env config`

**Meta:** `Code reviewing` `Research methodology` `Investigation requirements` `Anti-over-engineering` `Context management`

## Subagents

18 roles across 8 categories:

| Category         | Subagents                                                          |
| ---------------- | ------------------------------------------------------------------ |
| Developers       | `web-developer` `api-developer` `cli-developer` `web-architecture` |
| Reviewers        | `web-reviewer` `api-reviewer` `cli-reviewer`                       |
| Testers          | `web-tester` `cli-tester`                                          |
| Researchers      | `web-researcher` `api-researcher`                                  |
| Planning         | `web-pm`                                                           |
| Pattern Analysis | `pattern-scout` `web-pattern-critique`                             |
| Migration        | `cli-migrator`                                                     |
| Documentation    | `documentor`                                                       |
| Meta             | `skill-summoner` `agent-summoner`                                  |

## Commands

### Primary

| Command   | Description                                                                 |
| --------- | --------------------------------------------------------------------------- |
| `init`    | Interactive setup wizard: pick a stack, customize skills, compile subagents |
| `edit`    | Modify skill selection in the interactive wizard                            |
| `compile` | Recompile subagents after changes                                           |
| `update`  | Pull latest skills from source                                              |

### Customization

| Command        | Description                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `eject <type>` | Export for customization (`agent-partials`, `templates`, `skills`, `all`)                                         |
| `new skill`    | Scaffold a custom skill ![Coming soon](https://img.shields.io/badge/coming%20soon-grey)                           |
| `new agent`    | Scaffold a custom agent ![Coming soon](https://img.shields.io/badge/coming%20soon-grey)                           |
| `import skill` | Import a skill from an external GitHub repository ![Coming soon](https://img.shields.io/badge/coming%20soon-grey) |
| `search`       | Search skills across sources ![Coming soon](https://img.shields.io/badge/coming%20soon-grey)                      |

### Diagnostics

| Command     | Description                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| `doctor`    | Diagnose setup issues                                                                                        |
| `diff`      | Show changes between local and source skills ![Coming soon](https://img.shields.io/badge/coming%20soon-grey) |
| `outdated`  | Check for skill updates                                                                                      |
| `validate`  | Validate config and skill structure                                                                          |
| `info`      | Show project configuration details                                                                           |
| `uninstall` | Remove Agents Inc from your project                                                                          |

Run `agentsinc --help` for full usage.

## Customization

Progressive layers from config to full extension:

| Layer           | How                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Edit config     | `.claude-src/config.yaml`; skill-to-subagent mappings, preloaded/dynamic                       |
| Wizard          | `agentsinc edit`; add/remove skills interactively                                              |
| Eject partials  | `agentsinc eject agent-partials`; customize agent partials such as intro, workflow, and output |
| Eject templates | `agentsinc eject templates`; modify Liquid templates                                           |
| Eject skills    | `agentsinc eject skills`; fork skills for local editing                                        |
| Custom skills   | `agentsinc new skill`; scaffold with proper metadata                                           |
| Custom agents   | `agentsinc new agent`; scaffold agent files                                                    |
| Custom sources  | Point to a private repo or local directory as a skill source                                   |
| Plugins         | Package skills/subagents as Claude Code plugins for distribution                               |

Templates apply globally across all subagents; partials apply to specific roles. Put shared conventions in a template for consistency, and role-specific behaviour in partials.

Import skills from any GitHub repository:

```bash
agentsinc import skill github:your-org/skills --list
agentsinc import skill github:your-org/skills --skill react-best-practices
agentsinc import skill github:your-org/skills --all
```

## Tech Stack

| Component    | Technology                            |
| ------------ | ------------------------------------- |
| Commands     | oclif                                 |
| Terminal UI  | Ink + React                           |
| Wizard state | Zustand                               |
| Validation   | Zod (30+ schemas at parse boundaries) |
| Compilation  | LiquidJS                              |
| Testing      | Vitest                                |

```
src/cli/
  commands/       # oclif command definitions
  components/     # Ink/React terminal UI components
  lib/            # Core logic (compiler, loader, resolver, schemas)
  stores/         # Zustand state management
  utils/          # Shared utilities
src/agents/       # Subagent definitions (18 roles)
config/           # Skills matrix, stacks, default mappings
```

See [docs/reference/architecture.md](./docs/reference/architecture.md) for the full reference.

## Links

- [Plugin Marketplace](https://github.com/agents-inc/skills): browse and discover skills
- [Architecture Reference](./docs/reference/architecture.md): full system documentation

## License

MIT
