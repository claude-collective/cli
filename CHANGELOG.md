# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1] - 2026-02-01

### Added

- **Auto-detection of installation mode** - CLI now automatically detects whether you have a local (`.claude/`) or plugin (`.claude/plugins/claude-collective/`) installation. No more `--output` flag needed for local mode.
- **`installMode` property in config.yaml** - new installations now store `installMode: local | plugin` explicitly in config
- **`detectInstallation()` utility** - shared function for consistent installation detection across commands
- **Local template support** - `compile` now uses templates from `.claude/templates/` if present (after running `eject templates`)

### Changed

- `cc compile` - auto-detects local mode and outputs to `.claude/agents` without needing `--output` flag
- `cc list` - now works for both local and plugin mode installations, shows mode in output
- `cc edit` - now works with local mode installations
- `nextjs-fullstack` stack - now includes all 18 agents (added `cli-tester` and `cli-migrator`)

### Fixed

- Local templates not being used after `eject templates` - compile now correctly checks for `.claude/templates/` before falling back to CLI bundled templates

[0.5.1]: https://github.com/claude-collective/cli/releases/tag/v0.5.1

## [0.5.0] - 2026-02-01

### Breaking Changes

- **Agent-centric configuration** - skills are now defined in agent YAMLs instead of stack config files. Stacks are now simple agent groupings in `config/stacks.yaml`. This is a significant architectural change that simplifies configuration but requires migration for custom stacks.

### Added

- **Skills in agent YAMLs** - each agent now defines its own skills with a `preloaded` flag to control what's included in the agent prompt
- **Centralized stacks.yaml** - all 7 stacks (nextjs-fullstack, angular, nuxt, remix, vue, solidjs, react-native) are now defined in `config/stacks.yaml` with agent lists and philosophy
- **stacks-loader** - new module to load stacks from config/stacks.yaml
- **resolveAgentSkills()** - function to extract skills from agent definitions

### Changed

- `loadStackById()` now loads from `config/stacks.yaml` (new format) instead of `src/stacks/*/config.yaml`
- `getAgentSkills()` priority order: compile config > agent skills > stack-based (legacy)
- `stackToResolvedStack()` now extracts skill IDs from agent definitions
- `build:stack` command deprecated (shows warning and exits)

### Removed

- Stack config files (`src/stacks/*/config.yaml`) - skills now come from agent YAMLs
- `suggested_stacks` section from `skills-matrix.yaml` - moved to `stacks.yaml`

### Internal

- Updated all 17 agent YAMLs with skills fields
- Deprecated `skill-agent-mappings.ts` (kept for wizard fallback)
- Updated tests to work with new stack format (passing Stack objects instead of writing config files)

[0.5.0]: https://github.com/claude-collective/cli/releases/tag/v0.5.0

## [0.4.0] - 2026-01-31

### Added

- **Methodology skills preselected** - foundational skills (anti-over-engineering, context-management, investigation-requirements, success-criteria, write-verification, improvement-protocol) are now selected by default in the wizard
- **CLI skills in nextjs-fullstack** - stack now includes cli-commander, cli-reviewing, and setup skills for posthog, email, and observability
- **Test isolation support** - `CC_CONFIG_HOME` environment variable allows overriding the global config directory
- **Comprehensive test suite** - 1000+ tests covering commands, components, and user journeys

### Internal

- Added cli-migrator and cli-tester agents for CLI development workflows
- Added research documentation for CLI testing strategies and stack simplification

[0.4.0]: https://github.com/claude-collective/cli/releases/tag/v0.4.0

## [0.3.0] - 2026-01-31

### Changed

- **CLI Framework Migration** - migrated from Commander.js + @clack/prompts to oclif + Ink for improved maintainability and extensibility
- All commands now use oclif's class-based command structure
- Interactive components now use Ink (React-based terminal UI)
- Wizard state management now uses Zustand
- Removed dependencies: commander, @clack/prompts, @clack/core, picocolors
- Added dependencies: @oclif/core, @oclif/plugin-\*, ink, react, @inkjs/ui, zustand

[0.3.0]: https://github.com/claude-collective/cli/releases/tag/v0.3.0

## [0.2.0] - 2026-01-30

### Added

- **Marketplace support** - install stack plugins directly from configured marketplaces
- Marketplace field in project and global config for plugin installation
- CLI utilities for marketplace management (`marketplace list`, `exists`, `add`)
- Multi-source agent loading - agents can now be loaded from both CLI and custom sources
- `sourceRoot` tracking for correct template resolution with multi-source agents

### Changed

- Removed skills eject functionality (use marketplace plugins instead)

### Fixed

- Wizard now preserves approach selection state when toggling Expert Mode or Install Mode

[0.2.0]: https://github.com/claude-collective/cli/releases/tag/v0.2.0

## [0.1.3] - 2026-01-30

### Added

- `--output` option for eject command to specify custom output directory
- Remote schema fetching for skill validation from GitHub

### Fixed

- Plugin manifest no longer includes agents field (Claude Code discovers automatically)
- Source loader now supports source-provided skills matrix

[0.1.3]: https://github.com/claude-collective/cli/releases/tag/v0.1.3

## [0.1.2] - 2026-01-30

### Changed

- Removed local dev files from repo (.claude, CLAUDE.md)

[0.1.2]: https://github.com/claude-collective/cli/releases/tag/v0.1.2

## [0.1.1] - 2026-01-30

### Fixed

- `GITHUB_REPO` const now points to correct repo
- README agent names match actual stack config

[0.1.1]: https://github.com/claude-collective/cli/releases/tag/v0.1.1

## [0.1.0] - 2026-01-30

### Added

- **Interactive wizard** (`cc init`) - guided setup with stack/skill selection
- **Stack installation** - install curated skill bundles (nextjs-fullstack, api-only, etc.)
- **Individual skill installation** - pick specific skills for your project
- **Skill compilation** (`cc compile`) - compile skills and agents
- **Validation** (`cc validate`) - validate skill file structure and content
- **Configuration management** (`cc config`) - view and edit project settings
- **List command** (`cc list`) - browse available and installed skills/stacks
- **Eject command** (`cc eject`) - eject templates for customization
- **Plugin mode** - native Claude Code plugin installation
- **Local mode** - copy skills directly to `.claude/skills/`

### Stacks Included

- `nextjs-fullstack` - Next.js App Router + Hono + Drizzle + Better Auth
- `angular-stack` - Angular 19 + Signals + NgRx
- `vue-stack` - Vue 3 + Pinia + Tailwind
- `nuxt-stack` - Nuxt + Vue 3
- `remix-stack` - Remix + React
- `solidjs-stack` - SolidJS + Tailwind
- `react-native-stack` - React Native + Expo

### Skills Available

80+ skills across domains:

- Web (React, SCSS Modules, Zustand, React Query, MSW)
- API (Hono, Drizzle, Better Auth, Resend)
- Infrastructure (GitHub Actions, Turborepo, PostHog)
- Quality (Vitest, Security, Accessibility)

[0.1.0]: https://github.com/claude-collective/cli/releases/tag/v0.1.0
