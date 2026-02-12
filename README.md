# Claude Collective CLI

the CLI for working with Claude Collective skills. it's the entry point for everything: installing skills, creating stacks, and creating custom skills and subagents

```bash
npx @claude-collective/cli init
```

## what this does

Claude Code is okay out of the box, but it doesn't know your stack. the skills repository has 80+ in-depth modules covering react, hono, drizzle, posthog, and a lot more. each skill is atomic, comprehensive, and composable into agents and stacks

the CLI is how you work with all of it:

- **install skills** as plugins or locally into your project
- **create stacks** by bundling skills with a modular agent approach
- **scaffold new skills** when you need something custom
- **set up your own marketplace** if you're building for a team or org

## getting started

```bash
# run the wizard - picks skills, sets up agents
npx @claude-collective/cli init

# or install globally
npm install -g @claude-collective/cli
```

requires node 18+ and [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

## commands

| command                | what it does                                                  |
| ---------------------- | ------------------------------------------------------------- |
| `init`                 | interactive setup - pick skills, configure agents             |
| `edit`                 | modify your skill selection                                   |
| `compile`              | recompile agents after changes                                |
| `update`               | update local skills from source                               |
| `list`                 | show what's installed                                         |
| `doctor`               | diagnose setup issues                                         |
| `search`               | search for skills                                             |
| `info <skill>`         | show skill details                                            |
| `diff`                 | show skill differences vs source                              |
| `outdated`             | check for outdated skills                                     |
| `validate`             | check your setup is correct                                   |
| `new skill`            | create a custom skill                                         |
| `new agent`            | create a custom agent                                         |
| `import skill`         | import a skill from a remote source                           |
| `eject`                | eject skills/agent partials for customization                 |
| `uninstall`            | remove Claude Collective from project                         |
| `config`               | manage settings (show, get, set-project, unset-project, path) |
| `version`              | show/manage plugin versions (show, set, bump)                 |
| `build marketplace`    | generate marketplace.json                                     |
| `build plugins`        | build individual skill plugins                                |
| `build stack`          | build a stack plugin                                          |

every command supports `--dry-run` and `--source` flags. run `npx @claude-collective/cli <command> --help` for full options.

## how skills work

a skill is focused knowledge for one technology. not surface-level docs but actual patterns, edge cases, the things you'd normally have to explain repeatedly

skills live in the [claude-collective/skills](https://github.com/claude-collective/skills) repository, organized by category:

| category | what's there                                                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| web      | react, vue, angular, solidjs, next.js, remix, nuxt, scss-modules, cva, zustand, pinia, ngrx-signalstore, jotai, react-query, swr, trpc, graphql, react-hook-form, zod, shadcn-ui, radix-ui, tanstack-table, vitest, playwright, cypress, msw, framer-motion, storybook, accessibility |
| api      | hono, express, fastify, drizzle, prisma, better-auth, posthog, resend, axiom+pino+sentry, github-actions                                                                                                                                                                              |
| mobile   | react-native, expo                                                                                                                                                                                                                                                                    |
| cli      | commander, oclif, yargs, clack, inquirer, ink                                                                                                                                                                                                                                         |
| infra    | turborepo, tooling, env config                                                                                                                                                                                                                                                        |
| meta     | code reviewing, research methodology, investigation requirements, anti-over-engineering, context management                                                                                                                                                                           |

## stacks

stacks bundle skills together with pre-configured agents. instead of picking 20 skills individually, grab a stack that matches your setup:

- **nextjs-fullstack** - next.js + react + hono + drizzle + posthog + zustand + react-query
- **angular-stack** - angular 19 + signals + ngrx signalstore + hono + drizzle
- **vue-stack** - vue 3 composition API + pinia + hono + drizzle
- **nuxt-stack** - nuxt + vue 3 full-stack + pinia + hono + drizzle
- **remix-stack** - remix + react + hono + drizzle
- **solidjs-stack** - solidjs + hono + drizzle
- **react-native-stack** - react native + expo + zustand + react-query
- **meta-stack** - agents for creating agents, skills, docs, and extracting patterns

each stack includes agents like `web-developer`, `api-developer`, `web-reviewer`, `web-tester`, `web-researcher`, `pattern-scout`, `documentor` - roles that use the right skills for the job.

## installation options

**as a plugin** (recommended for personal use):

```bash
npx @claude-collective/cli init
# interactive wizard lets you choose: plugin mode, local mode, or marketplace setup
# plugin mode installs to ./.claude/plugins/claude-collective/
```

**locally in your project** (for team sharing):

```bash
npx @claude-collective/cli init
# select "local" mode in the wizard
# installs to ./.claude/ in your repo
```

**your own marketplace** (for orgs):

```bash
npx @claude-collective/cli init
# select "marketplace" mode in the wizard
# scaffolds a marketplace you can customize and host
```

## creating custom skills

if the existing skills don't cover what you need:

```bash
npx @claude-collective/cli new skill my-custom-skill
```

this scaffolds the structure. a skill is just markdown with examples - no special tooling required.

## architecture

built with TypeScript (strict mode), oclif for commands, Ink (React) for terminal UI, Zod for runtime validation, and Zustand for wizard state. the core pipeline:

```
source resolution → skill loading → matrix merging → wizard selection → config generation → agent compilation → installation
```

the codebase is organized into domain-driven library modules (`agents/`, `configuration/`, `loading/`, `matrix/`, `plugins/`, `skills/`, `stacks/`, `installation/`) with barrel exports. agents are compiled from YAML definitions + markdown partials through Liquid templates.

see [docs/architecture.md](./docs/architecture.md) for the full reference.

## links

- [skills repository](https://github.com/claude-collective/skills) - all the skills and stacks
- [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code) - the tool this extends

## license

MIT
