# Claude Collective CLI

> Make Claude Code an expert in your tech stack. Production-ready knowledge modules for React, Hono, Drizzle, and 80+ more.

[![npm version](https://img.shields.io/npm/v/@claude-collective/cli.svg)](https://www.npmjs.com/package/@claude-collective/cli)
[![npm downloads](https://img.shields.io/npm/dm/@claude-collective/cli.svg)](https://www.npmjs.com/package/@claude-collective/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Stop teaching Claude your conventions. Start coding.**

```bash
npx @claude-collective/cli init
```

## What is this?

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) is Anthropic's agentic coding CLI. Out of the box, Claude knows programming - but not _your_ patterns, _your_ libraries, _your_ conventions.

**Claude Collective fixes that.** We provide **skills** - focused knowledge modules that make Claude an expert in specific technologies:

| Term       | What it is                                                                   |
| ---------- | ---------------------------------------------------------------------------- |
| **Skills** | Expertise in one technology (React 19, Hono v4, Drizzle ORM, etc.)           |
| **Stacks** | Curated bundles for common setups ("nextjs-fullstack" = React + Hono + auth) |
| **Agents** | Specialized roles (frontend-developer, backend-reviewer, etc.)               |

## Installation

```bash
# Recommended: Use npx (no install required)
npx @claude-collective/cli init

# Or install globally
npm install -g @claude-collective/cli
yarn global add @claude-collective/cli
pnpm add -g @claude-collective/cli
bun add -g @claude-collective/cli
```

Requires Node.js 18+ and [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed.

## Quick Start (60 seconds)

```bash
# 1. Run the wizard in your project
cd your-project
npx @claude-collective/cli init

# 2. Select a stack (or pick individual skills)
#    ? What type of project? > Fullstack React
#    ? Include agents? > Yes

# 3. Done! Skills installed to .claude/skills/
```

**Or skip the wizard:**

```bash
# Initialize with a specific stack directly
cc init --stack nextjs-fullstack
```

## See It In Action

**Before skills:** Claude gives generic React advice.

**After installing `react` skill:** Claude knows:

- Your project uses React 19 with the new `use` hook
- Error boundaries should use `react-error-boundary`
- Components go in `kebab-case.tsx` files with named exports
- State management follows your Zustand patterns

**What skills teach Claude:**

| Skill     | Claude Learns                                              |
| --------- | ---------------------------------------------------------- |
| `react`   | React 19 patterns, hooks, error boundaries, file structure |
| `hono`    | Route handlers, middleware, OpenAPI integration, Zod       |
| `drizzle` | Schema patterns, migrations, transactions, relations       |
| `vitest`  | Test patterns, mocking, coverage requirements              |

## Commands

### Essential Commands

| Command                  | Description                           |
| ------------------------ | ------------------------------------- |
| `cc init`                | Interactive setup wizard - start here |
| `cc init --stack <name>` | Skip wizard, use a predefined stack   |
| `cc list`                | Browse available skills and stacks    |
| `cc list --installed`    | See what's currently installed        |

### Advanced Commands

| Command       | Description                                 |
| ------------- | ------------------------------------------- |
| `cc compile`  | Compile agent templates (for custom agents) |
| `cc validate` | Check skill files for errors                |
| `cc config`   | View or edit `.claude/config.yaml`          |
| `cc eject`    | Export templates for customization          |

Run `cc --help` for full usage details.

## Available Stacks

| Stack                | Includes                                                | Best For                   |
| -------------------- | ------------------------------------------------------- | -------------------------- |
| `nextjs-fullstack`   | Next.js App Router, Hono, Drizzle, Better Auth, Zustand | Full-stack TypeScript apps |
| `angular-stack`      | Angular 19, Signals, NgRx SignalStore, Hono, Drizzle    | Enterprise Angular apps    |
| `vue-stack`          | Vue 3 Composition API, Pinia, Tailwind, Hono, Drizzle   | Vue.js applications        |
| `nuxt-stack`         | Nuxt 3, Vue 3, Pinia, Tailwind, Hono, Drizzle           | Full-stack Vue apps        |
| `remix-stack`        | Remix, React, Tailwind, Zustand, Hono, Drizzle          | Form-heavy applications    |
| `solidjs-stack`      | SolidJS, Tailwind, Vitest, Hono, Drizzle                | High-performance apps      |
| `react-native-stack` | React Native, Expo, Zustand, React Query                | Cross-platform mobile      |

```bash
# See all stacks
cc list --stacks
```

## Available Skills

80+ skills across domains:

- **Web**: React, SCSS Modules, Zustand, React Query, MSW
- **API**: Hono, Drizzle, Better Auth, Resend, PostHog
- **Infra**: GitHub Actions, Turborepo, monitoring, CI/CD
- **Quality**: Vitest, Security, Accessibility, Testing patterns

```bash
# Browse all available skills
cc list --skills
```

## How It Works

1. **Install skills** via `cc init` or manually to `.claude/skills/`
2. **Skills are loaded** automatically by Claude Code
3. **Agents use skills** to provide expert-level assistance

```
.claude/
├── skills/           # Installed skills
│   ├── react/
│   ├── hono/
│   └── drizzle/
└── agents/           # Compiled agents (optional)
    ├── frontend-developer.md
    └── backend-developer.md
```

## Configuration

Configuration is stored in `.claude/config.yaml`:

```yaml
stack: nextjs-fullstack
skills:
  - react
  - hono
  - drizzle
```

Edit manually or use `cc config`.

## Creating Custom Skills

Skills are markdown files with YAML frontmatter:

```
.claude/skills/my-skill/
├── SKILL.md          # Main skill file (required)
├── metadata.yaml     # Skill metadata (optional)
└── examples/         # Code examples (optional)
    └── core.md
```

**SKILL.md template:**

```markdown
---
name: my-custom-skill
description: Brief description for Claude
globs: ["src/**/*.ts"]
---

# My Custom Skill

## When to Use

[Describe when Claude should apply this knowledge]

## Patterns

[Explain patterns with code examples]

## Anti-Patterns

[What NOT to do]
```

**Tips:**

- Be specific: "Use `date-fns`" not "use a date library"
- Include anti-patterns: Tell Claude what to avoid
- Add real examples: Code from your actual codebase works best

## Troubleshooting

<details>
<summary><strong>Skills not loading in Claude Code?</strong></summary>

1. Ensure skills are in `.claude/skills/` (not `.claude-skills/`)
2. Each skill needs a `SKILL.md` file
3. Restart Claude Code after adding skills
4. Run `cc validate` to check for errors

</details>

<details>
<summary><strong>Permission denied on global install?</strong></summary>

Use a Node version manager (nvm, fnm) or install to user directory:

```bash
npm install -g @claude-collective/cli --prefix ~/.npm-global
```

</details>

<details>
<summary><strong>"cc" command not found after install?</strong></summary>

Your global npm bin directory may not be in PATH. Try:

```bash
# Find where npm installs global bins
npm config get prefix

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$(npm config get prefix)/bin:$PATH"
```

Or use `npx @claude-collective/cli` instead.

</details>

## FAQ

**Q: Does this work with Claude Code Pro/Team?**
A: Yes, skills work with any Claude Code installation.

**Q: Can I use custom skills alongside collective skills?**
A: Yes! Add custom skills to `.claude/skills/my-skill/SKILL.md`.

**Q: How do I update skills?**
A: Re-run `cc init` or manually update files in `.claude/skills/`.

## Requirements

- **Node.js** 18.0.0 or higher
- **Claude Code** installed and configured

## Links

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Skills Repository](https://github.com/claude-collective/skills)
- [Issue Tracker](https://github.com/claude-collective/cli/issues)
- [Changelog](CHANGELOG.md)

## Contributing

We welcome contributions! Please open an issue or PR on GitHub.

## License

MIT - see [LICENSE](LICENSE) for details.
