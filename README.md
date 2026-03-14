<p align="center">
  <img alt="Agents Inc" src="./assets/logo.svg" width="300">
</p>

# Agents Inc

An agent composition framework for Claude Code.

Compose specialized [Claude Code](https://docs.anthropic.com/en/docs/claude-code) subagents from atomic skills. Choose your stack, customize your skills, and compile from the CLI.

[![npm version](https://img.shields.io/npm/v/@agents-inc/cli)](https://www.npmjs.com/package/@agents-inc/cli)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node: 18+](https://img.shields.io/badge/Node-18%2B-green.svg)](https://nodejs.org/)

<p align="center">
  <img src="./screenshots/wizard-flow.gif" alt="Agents Inc init wizard" width="700">
</p>

## Getting Started

```bash
npx @agents-inc/cli init
```

<p align="center">
  <img src="screenshots/stack-selection.png" alt="Stack selection" width="500">
</p>

Choose a pre-built stack or start from scratch. Stacks pre-select skills and agents for common tech combinations.

| Stack              | Technologies                                                       |
| ------------------ | ------------------------------------------------------------------ |
| `nextjs-fullstack` | Next.js + React + Hono + Drizzle + PostHog + Zustand + React Query |
| `angular-stack`    | Angular 19 + Signals + NgRx SignalStore + Hono + Drizzle           |
| `vue-stack`        | Vue 3 Composition API + Pinia + Hono + Drizzle                     |
| `nuxt-stack`       | Nuxt + Vue 3 full-stack + Pinia + Hono + Drizzle                   |
| `remix-stack`      | Remix + React + Hono + Drizzle                                     |
| `solidjs-stack`    | SolidJS + Hono + Drizzle                                           |

<p align="center">
  <img src="screenshots/skill-selection.png" alt="Skill selection" width="500">
</p>

Add or remove skills from the interactive grid. Skills are organized by domain with framework-aware filtering.

<p align="center">
  <img src="screenshots/agent-selection.png" alt="Agent selection" width="500">
</p>

Choose which subagents to compile. Each agent is composed from the skills you selected.

After init, use `agentsinc edit` to change selections and `agentsinc compile` to rebuild.

## Guides

| Guide                                                                       | Description                                                          |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Install modes](docs/guides/install-modes.md)                               | Plugin vs local install, global vs project scope                     |
| [Editing your config](docs/guides/editing-config.md)                        | Skill mappings, preloaded vs dynamic loading, and config structure   |
| [Customizing subagents](docs/guides/customizing-subagents.md)               | Eject and modify partials, templates, and skills                     |
| [Writing custom skills and subagents](docs/guides/writing-custom-skills.md) | Author skills and subagents from scratch or iterate on existing ones |
| [Importing third-party skills](docs/guides/importing-skills.md)             | Install skills from external repositories                            |
| [Creating a marketplace](docs/guides/creating-a-marketplace.md)             | Build a personal or org-level marketplace with curated skills        |

## Skills

**Web:** React, Vue, Angular, Next.js, Remix, Nuxt, SolidJS, Tailwind, Zustand, Vitest, Playwright, and more
**API:** Hono, Express, Drizzle, Prisma, PostHog, and more
**Mobile:** React Native, Expo
**CLI:** Commander, oclif + Ink
**Shared:** Turborepo, Code Reviewing, Auth Security, and more

Browse the full catalog on the [Plugin Marketplace](https://github.com/agents-inc/skills).

## Subagents

| Category         | Subagents                                                          |
| ---------------- | ------------------------------------------------------------------ |
| Developers       | `web-developer` `api-developer` `cli-developer` `web-architecture` |
| Reviewers        | `web-reviewer` `api-reviewer` `cli-reviewer`                       |
| Testers          | `web-tester` `cli-tester`                                          |
| Researchers      | `web-researcher` `api-researcher`                                  |
| Planning         | `web-pm`                                                           |
| Pattern Analysis | `pattern-scout` `web-pattern-critique`                             |
| Documentation    | `documentor`                                                       |
| Meta             | `skill-summoner` `agent-summoner`                                  |

Each subagent is composed from modular partials (role, workflow, output format) plus its assigned skills. Everything is ejectable.

## Commands

### Core

| Command   | Description                                                                 |
| --------- | --------------------------------------------------------------------------- |
| `init`    | Interactive setup wizard: pick a stack, customize skills, compile subagents |
| `edit`    | Modify skill selection via the interactive wizard                           |
| `compile` | Recompile subagents after changes                                           |
| `update`  | Pull latest skills from source                                              |
| `search`  | Search skills across all sources                                            |

### Customization

| Command           | Description                                                               |
| ----------------- | ------------------------------------------------------------------------- |
| `eject <type>`    | Export for customization (`agent-partials`, `templates`, `skills`, `all`) |
| `new skill`       | Scaffold a custom skill                                                   |
| `new agent`       | Scaffold a custom agent                                                   |
| `new marketplace` | Scaffold a new skill marketplace                                          |
| `import skill`    | Import a skill from an external GitHub repository                         |

### Build

| Command             | Description                                    |
| ------------------- | ---------------------------------------------- |
| `build marketplace` | Generate `marketplace.json` from source skills |
| `build plugins`     | Build skill and agent plugins for distribution |
| `build stack`       | Build a stack as a single plugin               |

### Configuration

| Command                | Description                        |
| ---------------------- | ---------------------------------- |
| `config`               | Show config overview               |
| `config get`           | Get a config value                 |
| `config show`          | Display all resolved config values |
| `config path`          | Show config file paths             |
| `config set-project`   | Set a project config value         |
| `config unset-project` | Remove a project config value      |

### Diagnostics

| Command     | Description                                  |
| ----------- | -------------------------------------------- |
| `doctor`    | Diagnose setup issues                        |
| `diff`      | Show changes between local and source skills |
| `list`      | List installed skills                        |
| `outdated`  | Check for skill updates                      |
| `validate`  | Validate config and skill structure          |
| `info`      | Show project configuration details           |
| `uninstall` | Remove Agents Inc from your project          |

Run `agentsinc --help` for full usage.

## Links

- [Plugin Marketplace](https://github.com/agents-inc/skills): browse and discover skills
- [Architecture Reference](./docs/reference/architecture.md): full system documentation

## License

MIT
