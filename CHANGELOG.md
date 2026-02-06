# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.13.3] - 2026-02-06

### Fixed

- **local config not found during recompile** - `recompileAgents` only looked for config in the plugin directory, missing local mode configs in the project directory. now falls back to project directory when plugin dir has no config
- **agent_skills normalization** - `agent_skills` from project config was passed to the compiler without normalizing mixed formats (string arrays vs object maps), causing compilation failures

## [0.13.2] - 2026-02-06

### Fixed

- **npx eject missing agent partials** - `src/agents/` directory was not included in the published npm package, causing `eject all` and `eject agent-partials` to warn "No agent partials found" and skip agent ejection

## [0.13.1] - 2026-02-06

### Fixed

- **npx eject fails with ENOENT** - `config/` directory (skills-matrix.yaml, stacks.yaml) was missing from the published npm package, causing `npx @claude-collective/cli eject all` to fail
- **Build copies config to dist** - `config/` is now copied to `dist/config/` during build for correct runtime path resolution
- **Test suite portability** - Integration tests that depend on the external claude-subagents repo are now gated behind `CC_TEST_SKILLS_SOURCE` env var
- **macOS temp path mismatch** - Fixed `/private/var` vs `/var` symlink issue in installation test
- **Pre-commit hook** - Changed `bun test` to `bun run test` to use vitest instead of bun's built-in test runner

## [0.13.0] - 2026-02-06

### Added

- **Import skill command** (`cc import skill`) - Import skills from GitHub repos with `--list`, `--skill`, `--all`, `--force`, `--dry-run` options
- **Interactive skill search** (`cc search -i`) - Live filtering, multi-select, batch import from configured sources
- **Sources config** - Configure multiple skill registries in `config.yaml` with `sources` array
- **Wizard footer component** - Split-layout footer with navigation hints on left, actions on right
- **Framework-first build flow** - Web domain hides other categories until framework is selected

### Changed

- **Wizard tabs** - Tab-style navigation with background colors (cyan active, white completed) instead of circle indicators
- **Wizard header** - Now displays CLI version
- **Category grid styling** - Background colors instead of circles/strikethrough for selection states
- **Agent definitions generalized** - 16 agents updated to use generic terms (styling, database) instead of specific tech (SCSS, Drizzle)

### Removed

- Old `search.ts` command - Replaced with dual-mode `search.tsx` (static + interactive)

[0.13.3]: https://github.com/claude-collective/cli/releases/tag/v0.13.3
[0.13.2]: https://github.com/claude-collective/cli/releases/tag/v0.13.2
[0.13.1]: https://github.com/claude-collective/cli/releases/tag/v0.13.1
[0.13.0]: https://github.com/claude-collective/cli/releases/tag/v0.13.0

## [0.12.0] - 2026-02-04

### Added

- **Agent Compliance Bible** - 30-test compliance suite in `docs/bibles/AGENT-COMPLIANCE-BIBLE.md` for verifying agent alignment with PROMPT_BIBLE and architecture standards
- **Claude Code Research** - Documentation of 176 Claude Code updates (Oct 2025 - Jan 2026) covering subagents, hooks, plugins, and async execution patterns
- **cli-tester examples** - Example test output for CLI component testing

### Changed

- **Agent partials improved** - Major conciseness pass on 15+ examples.md files, removed ~800 lines of filler, N/A sections, and verbose examples
- **Workflow quality** - Standardized workflows across all agents, removed time estimates, improved clarity
- **Bible index updated** - Fixed paths from `src/docs/` to `docs/bibles/`, corrected agent naming conventions

[0.12.0]: https://github.com/claude-collective/cli/releases/tag/v0.12.0

## [0.11.0] - 2026-02-04

### Breaking Changes

- **CLI source directory renamed** - `src/cli-v2/` renamed to `src/cli/`. The v2 suffix was removed as this is now the primary CLI implementation.

### Added

- **Bible documentation** - Added comprehensive documentation standards in `docs/bibles/`:
  - `CLAUDE_ARCHITECTURE_BIBLE.md` - System architecture and agent structure
  - `PROMPT_BIBLE.md` - Prompt engineering techniques
  - `DOCUMENTATION_BIBLE.md` - Documentation standards
  - `FRONTEND_BIBLE.md` - Frontend development standards
  - `SKILL-ATOMICITY-BIBLE.md` - Skill design principles
  - `INDEX.md` - Bible index and reference guide
- **Missing command documentation** - Added docs for: `doctor`, `search`, `outdated`, `info`, `diff`, `update`, `new skill`, `new agent`, and all config/version subcommands
- **skills-matrix.yaml schema documentation** - Full schema with categories, relationships, and skill aliases documented in `data-models.md`

### Changed

- **Agents genericized** - Developer agents no longer reference specific technologies (SCSS, Drizzle, Commander.js, etc.). Skills provide implementation details.
- **Agent references fixed** - Updated all agent references to use correct names: `frontend-*` → `web-*`, `backend-*` → `api-*`, `tester` → `web-tester`/`cli-tester`
- **Documentation paths fixed** - Fixed skill paths from `src/skills/` to `.claude/skills/`, Bible paths to `docs/bibles/`
- **cc eject options corrected** - Changed from `templates/config/agents` to `agent-partials/skills/all`
- **README install paths fixed** - Changed `~/.claude/` to `./.claude/` (relative to project)
- **Command naming convention** - Updated docs to use space-separated format (`build plugins`) instead of colon notation (`build:plugins`)

### Removed

- **Deprecated documentation** - Deleted outdated files that referenced non-existent architecture:
  - `docs/workflows.md` - Referenced non-existent `src/stacks/`
  - `docs/stacks-as-visual-hierarchy.md` - Design proposal never implemented
  - `docs/solution-a-migration-tasks.md` - Outdated migration document

[0.11.0]: https://github.com/claude-collective/cli/releases/tag/v0.11.0

## [0.10.0] - 2026-02-03

### Breaking Changes

- **Directory structure changed** - Source files now in `.claude-src/`, runtime output in `.claude/`. Config moved from `.claude/config.yaml` to `.claude-src/config.yaml`. Backward compatible reads from both locations.
- **Uninstall removes directories** - `cc uninstall` now removes entire `.claude/` and `.claude-src/` directories. The `--keep-config` flag is removed.

### Added

- `CLAUDE_SRC_DIR` constant for `.claude-src/` directory
- `loadProjectAgents()` function to load agents from `.claude-src/agents/`
- `agentBaseDir` field on AgentDefinition/AgentConfig types
- `marketplace` and `agents_source` fields on ProjectConfig type
- Eject creates minimal `config.yaml` with example stack blueprint if it doesn't exist
- Init merges with existing config instead of overwriting

### Changed

- Eject agent-partials go to `.claude-src/agents/` (was `.claude/agents/_partials/`)
- Init writes config to `.claude-src/config.yaml`
- Compiler checks `.claude-src/agents/_templates/` first for templates
- Config readers check `.claude-src/` first, fall back to `.claude/`

[0.10.0]: https://github.com/claude-collective/cli/releases/tag/v0.10.0

## [0.9.0] - 2026-02-03

### Breaking Changes

- **Config location changed** - Project config now at `.claude/config.yaml` instead of `.claude-collective/config.yaml`. Global config is deprecated.
- **Eject types simplified** - Old types `templates`, `config`, `agents` removed. Use `agent-partials`, `skills`, or `all`.

### Added

- `--refresh` flag for `cc eject` to force refresh cached remote sources
- Source is saved to `.claude/config.yaml` when using `--source` flag
- `resolveAuthor()` function for project-level author resolution
- `populateFromStack()` wizard action to pre-populate domain selections

### Fixed

- **Compiled agents now include preloaded_skills** - Fixed bug where agents compiled by `cc init` had no skills in frontmatter
- **Wizard "customize" option** - Now pre-populates with stack defaults instead of starting from scratch
- **Source fetcher cache handling** - No longer errors when cache directory already exists

### Changed

- Eject loads skills from source marketplace instead of plugin directory
- Global config functions deprecated in favor of project-level config

[0.9.0]: https://github.com/claude-collective/cli/releases/tag/v0.9.0

## [0.8.0] - 2026-02-02

### Breaking Changes

- **Skill IDs normalized to kebab-case** - Skill IDs changed from path-based format with author suffix (e.g., `web/framework/react (@vince)`) to simple kebab-case (e.g., `web-framework-react`). Consumer configs and any code referencing old skill IDs must be updated.

### Added

- **Meta-stack** - New stack for meta-level development with 5 agents (skill-summoner, agent-summoner, documentor, pattern-scout, web-pattern-critique) mapped to methodology and research skills.

### Changed

- `skill_aliases` in skills-matrix.yaml now map to normalized kebab-case IDs
- `DEFAULT_PRESELECTED_SKILLS` updated to use new ID format
- Simplified `skill-copier.ts`, `skill-plugin-compiler.ts`, `marketplace-generator.ts` - removed path parsing logic

### Removed

- `normalizeSkillId()` function - no longer needed since frontmatter contains canonical IDs

### Fixed

- **Uninstall command terminal state** - Added proper `exit()` calls to restore terminal after confirmation

[0.8.0]: https://github.com/claude-collective/cli/releases/tag/v0.8.0

## [0.7.0] - 2026-02-02

### Breaking Changes

- **Wizard flow redesigned** - New 5-step flow: Approach → Stack → Build → Refine → Confirm. The old category → subcategory linear flow is replaced with domain-based grid selection.

### Added

- **Domain-based navigation** - Categories now have a `domain` field (web, api, cli, mobile, shared) for filtering in the Build step
- **CategoryGrid component** - 2D grid selection with keyboard navigation (arrows, vim keys h/j/k/l), visual states (selected, recommended, discouraged, disabled)
- **WizardTabs component** - Horizontal 5-step progress indicator with completed/current/pending/skipped states
- **SectionProgress component** - Sub-step progress for multi-domain flows
- **StepBuild component** - Grid-based technology selection per domain, replaces linear category/subcategory flow
- **StepRefine component** - Skill source selection (verified skills, customize coming soon)
- **StepStackOptions component** - Options after stack selection (continue defaults or customize)
- **CLI domain support** - New `cli` category in skills-matrix with framework, prompts, testing subcategories
- **Wizard store v2** - Complete rewrite with history-based navigation, domain selections, grid focus state

### Changed

- `wizard.tsx` - Complete rewrite as orchestrator for new 5-step flow
- `step-approach.tsx` - Updated for v2 store
- `step-stack.tsx` - Now dual-purpose: stack selection (stack path) or domain selection (scratch path)
- `step-confirm.tsx` - Updated to show domain breakdown, technology/skill counts
- `wizard-store.ts` - Migrated to v2 state shape with approach, selectedDomains, domainSelections, stackAction, focusedRow/Col

### Removed

- `step-category.tsx` - Replaced by StepBuild with CategoryGrid
- `step-subcategory.tsx` - Replaced by StepBuild with CategoryGrid
- `selection-header.tsx` - No longer needed

### Fixed

- **Skill resolution for stack defaults** - Selecting a stack with "Continue with defaults" now correctly includes all stack skills (was only including methodology skills)
- **Display names in Build step** - Technologies now show clean names ("React") instead of full IDs ("React (@vince)")

[0.7.0]: https://github.com/claude-collective/cli/releases/tag/v0.7.0

## [0.6.0] - 2026-02-01

### Breaking Changes

- **Skills now defined in stacks, not agents** - Previously, each agent YAML contained a `skills` field. Now, stacks define technology selections per agent in `config/stacks.yaml`. Skills are resolved via `skill_aliases` in the skills matrix. This fixes the bug where stacks got wrong skills (e.g., angular-stack getting React skills).
- **stacks.yaml schema changed** - Agents are now objects with subcategory→technology mappings (e.g., `web-developer: { framework: react, styling: scss-modules }`) instead of simple string lists.
- **Removed `skills` field from agent schema** - Agent YAMLs no longer contain skill definitions.

### Added

- **`stack` property in consumer config.yaml** - When a stack is selected, the resolved agent→skill mappings are stored in the project config for reproducibility.
- **`resolveAgentSkillsFromStack()`** - New function in resolver.ts to extract skills from stack configurations.
- **`resolveStackSkillsFromAliases()`** - New function in stacks-loader.ts to resolve technology selections to skill IDs via the matrix.
- **Phase 7 UX specification** - Comprehensive documentation for upcoming wizard UX redesign with domain-based navigation and grid-based skill selection.

### Changed

- `loadStackById()` now reads technology selections per agent from the new stacks.yaml format
- `getAgentSkills()` now accepts optional `stack` and `skillAliases` parameters for Phase 7 skill resolution
- `stackToResolvedStack()` extracts skills from stack configurations instead of agent YAMLs
- Stack plugin compiler now extracts skills via matrix aliases

### Removed

- `skills` field from all 18 agent YAMLs - skills now come from stacks
- `skills` property from agent.schema.json

[0.6.0]: https://github.com/claude-collective/cli/releases/tag/v0.6.0

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
