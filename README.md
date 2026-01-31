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

```bash
cc init          # interactive setup - pick skills, configure agents
cc edit          # modify your skill selection
cc compile       # recompile agents after changes
cc list          # show what's installed
cc config        # manage settings
cc validate      # check your setup is correct
```

## how skills work

a skill is focused knowledge for one technology. not surface-level docs but actual patterns, edge cases, the things you'd normally have to explain repeatedly

skills live in the [claude-collective/skills](https://github.com/claude-collective/skills) repository, organized by category:

| category | what's there                                                                        |
| -------- | ----------------------------------------------------------------------------------- |
| web      | react 19, next.js, remix, vue, angular, solidjs, scss-modules, zustand, react-query |
| api      | hono, drizzle, better-auth, posthog, resend, axiom+pino+sentry                      |
| mobile   | react-native, expo                                                                  |
| cli      | oclif, ink                                                                          |
| infra    | turborepo, github-actions, env config                                               |
| security | auth patterns, xss prevention, secrets                                              |
| meta     | code reviewing, research methodology                                                |

## stacks

stacks bundle skills together with pre-configured agents. instead of picking 20 skills individually, grab a stack that matches your setup:

- **nextjs-fullstack** - next.js app router + hono + drizzle + posthog
- **react-native-stack** - react native with expo
- **vue-stack** - vue 3 + nuxt
- **angular-stack** - angular 17+ standalone
- **remix-stack** - remix with loaders/actions
- **solidjs-stack** - solidjs fine-grained reactivity
- **nuxt-stack** - nuxt 3 with nitro

each stack includes agents like `web-developer`, `api-reviewer`, `web-tester` - roles that use the right skills for the job.

## installation options

**as a plugin** (recommended for personal use):

```bash
cc init
# installs to ~/.claude/plugins/claude-collective/
```

**locally in your project** (for team sharing):

```bash
cc init --local
# installs to ./.claude/ in your repo
```

**your own marketplace** (for orgs):

```bash
cc init --marketplace
# scaffolds a marketplace you can customize and host
```

## creating custom skills

if the existing skills don't cover what you need:

```bash
cc new skill my-custom-skill
```

this scaffolds the structure. a skill is just markdown with examples - no special tooling required.

## links

- [skills repository](https://github.com/claude-collective/skills) - all the skills and stacks
- [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code) - the tool this extends

## license

MIT
