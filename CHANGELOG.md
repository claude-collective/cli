# Changelog

All notable changes to this project will be documented in this file.

Each release has detailed notes in its own file under [`changelogs/`](./changelogs/). This file serves as a summary index.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.34.1] - 2026-02-17

**Code formatting**

Prettier applied across wizard components.

See [changelogs/0.34.1.md](./changelogs/0.34.1.md) for full details.

---

## [0.34.0] - 2026-02-17

**Wizard UX overhaul — layout, scrolling, navigation, and visual redesign**

See [changelogs/0.34.0.md](./changelogs/0.34.0.md) for full details.

## [0.32.1] - 2026-02-16

**Code formatting cleanup (Prettier consistency)**

See [changelogs/0.32.1.md](./changelogs/0.32.1.md) for full details.

## [0.32.0] - 2026-02-16

**Wizard simplification, branding, scroll viewport, and code quality**

See [changelogs/0.32.0.md](./changelogs/0.32.0.md) for full details.

## [0.31.1] - 2026-02-16

**Commit protocol and changelog architecture**

Established commit protocol for AI agents with split-file changelog pattern.

[-> Full release notes](./changelogs/0.31.1.md)

## [0.31.0] - 2026-02-16

**CLAUDE.md project instructions and test infrastructure**

Comprehensive AI agent instructions, test fixture structure, feature proposals, and documentation cleanup.

[-> Full release notes](./changelogs/0.31.0.md)

## [0.30.0] - 2026-02-16

**Settings.json-based plugin discovery**

Migrated plugin discovery from project-local directory scanning to settings.json-based resolution via global plugin registry.

[-> Full release notes](./changelogs/0.30.0.md)

## [0.29.5] - 2026-02-15

**Fix local YAML schema paths**

Replaced relative local schema paths with raw.githubusercontent.com URLs for consumer project compatibility.

[-> Full release notes](./changelogs/0.29.5.md)

## [0.29.4] - 2026-02-15

**Strict JSON schema validation**

All 12 generated JSON schemas now enforce meaningful constraints for IDE autocomplete and validation.

[-> Full release notes](./changelogs/0.29.4.md)

## [0.29.3] - 2026-02-15

**Fix wrong YAML schema on generated config**

Fixed `cc init` embedding wrong schema reference in generated config.yaml.

[-> Full release notes](./changelogs/0.29.3.md)

## [0.29.2] - 2026-02-15

**Multi-skill stack assignments in project config**

Stack config now stores multiple skills per subcategory with preloaded flags preserved through the full pipeline.

[-> Full release notes](./changelogs/0.29.2.md)

## [0.29.1] - 2026-02-15

**Lint fixes and code cleanup**

Regex unicode flags, switch default cases, template literals, control flow simplification, and type cleanup.

[-> Full release notes](./changelogs/0.29.1.md)

## [0.29.0] - 2026-02-15

**Shared utilities, security hardening, and integration tests**

Extracted utility modules, expanded Zod schemas, added integration test suites, and hardened path traversal and input validation.

[-> Full release notes](./changelogs/0.29.0.md)

## [0.28.0] - 2026-02-13

**Explicit preloaded booleans and published JSON schemas**

Stack skills use explicit preloaded flags, published JSON schemas for IDE validation, and extended `cc validate` targets.

[-> Full release notes](./changelogs/0.28.0.md)

## [0.27.0] - 2026-02-13

**Stacks use skill IDs and config-driven source loading**

Stacks reference skills by ID instead of display name alias. Marketplace repos can declare custom resource paths.

[-> Full release notes](./changelogs/0.27.0.md)

## [0.26.1] - 2026-02-13

**Fix metadata version coercion and stack lookup**

Fixed version coercion warnings, stack lookup from source in plugin mode, and skills matrix fallback.

[-> Full release notes](./changelogs/0.26.1.md)

## [0.26.0] - 2026-02-13

**Plugin-aware compilation and marketplace guides**

Plugin-aware agent compilation, stacks from source, individual skill plugin installation, and marketplace documentation.

[-> Full release notes](./changelogs/0.26.0.md)

## [0.25.1] - 2026-02-13

**Code formatting**

Prettier applied across 21 files.

[-> Full release notes](./changelogs/0.25.1.md)

## [0.25.0] - 2026-02-12

**Multi-source skill selection (UX 2.0)**

Full multi-source skill selection with source grid, source switching, bound skill search, and settings management.

[-> Full release notes](./changelogs/0.25.0.md)

## [0.24.7] - 2026-02-12

**Sources step and edit command improvements**

New Sources wizard step, edit command starts at Build step, parse boundary hardening.

[-> Full release notes](./changelogs/0.24.7.md)

## [0.24.6] - 2026-02-12

**Codebase-wide comment cleanup**

Removed ~5,600 lines of AI-generated banner comments, standardized JSDoc on type definitions.

[-> Full release notes](./changelogs/0.24.6.md)

## [0.24.5] - 2026-02-11

**Command tests and Vitest auto-mocks**

158 new command tests, Vitest auto-mocks for fs/logger, config split into 3 test projects.

[-> Full release notes](./changelogs/0.24.5.md)

## [0.24.4] - 2026-02-11

**Library restructured into domain subdirectories**

62 files moved from flat `lib/` into 8 domain-organized subdirectories with barrel imports.

[-> Full release notes](./changelogs/0.24.4.md)

## [0.24.3] - 2026-02-11

**AJV replaced with Zod, JSON schemas generated from Zod**

Schema validation rewritten to Zod, JSON schemas generated natively, YAML references use local paths.

[-> Full release notes](./changelogs/0.24.3.md)

## [0.24.2] - 2026-02-11

**Type definitions co-located**

4 scattered type files consolidated into 6 domain-organized files under `src/cli/types/`.

[-> Full release notes](./changelogs/0.24.2.md)

## [0.24.1] - 2026-02-11

**Stack config respects customizations, parse boundaries hardened**

Stack config uses user selections, parse boundaries warn on failure, 17 new unit test files.

[-> Full release notes](./changelogs/0.24.1.md)

## [0.24.0] - 2026-02-11

**Type system rewrite and dead code removal**

All interfaces replaced with type aliases, stack as single source of truth, ~2,100 lines of dead code removed.

[-> Full release notes](./changelogs/0.24.0.md)

## [0.23.0] - 2026-02-10

**Zod runtime validation, typed utilities, and Remeda**

30+ Zod schemas at parse boundaries, typed object utilities, Remeda array operations, named type aliases.

[-> Full release notes](./changelogs/0.23.0.md)

## [0.22.0] - 2026-02-09

**Union types for IDs, categories, agents, and domains**

Strict union types replace `string` across the codebase. Normalized skill ID format enforced at compile time.

[-> Full release notes](./changelogs/0.22.0.md)

## [0.21.0] - 2026-02-09

**Removed refine step, added web-extras domain**

Wizard simplified to 4 steps. 8 categories split into `web-extras` domain with parent domain inheritance.

[-> Full release notes](./changelogs/0.21.0.md)

## [0.20.0] - 2026-02-07

**Removed StackConfig type and global config layer**

All consumers operate directly on ProjectConfig. Global config and related commands deleted.

[-> Full release notes](./changelogs/0.20.0.md)

## [0.19.0] - 2026-02-07

**Removed top-level categories, aligned agent mappings with domains**

Flattened skills matrix to domain-based organization. Agent mapping patterns renamed to match domains.

[-> Full release notes](./changelogs/0.19.0.md)

## [0.18.0] - 2026-02-07

**Matrix health check and type consolidation**

Referential integrity validation, dead type removal, shared utilities extraction, matrix alias cleanup.

[-> Full release notes](./changelogs/0.18.0.md)

## [0.17.0] - 2026-02-07

**Local skill badge and module extraction**

Local skill `[L]` badge in wizard, extracted config-merger, local-installer, and skill resolution improvements.

[-> Full release notes](./changelogs/0.17.0.md)

## [0.16.0] - 2026-02-07

**Simplified wizard flow and styling updates**

Removed stack-options step, simplified ViewTitle API, border-based skill tag styling.

[-> Full release notes](./changelogs/0.16.0.md)

## [0.15.0] - 2026-02-07

**Custom navigation components and global shortcuts**

MenuItem and ViewTitle components, global keyboard shortcuts for mode toggles.

[-> Full release notes](./changelogs/0.15.0.md)

## [0.14.1] - 2026-02-07

**Library extraction: skill-metadata, config-saver, plugin-manifest-finder**

Deduplicated shared logic into 3 new library modules.

[-> Full release notes](./changelogs/0.14.1.md)

## [0.14.0] - 2026-02-07

**WizardLayout, redesigned tabs and footer, ASCII banner**

Extracted WizardLayout component, unified footer, ASCII art banner, Prettier config.

[-> Full release notes](./changelogs/0.14.0.md)

## [0.13.4] - 2026-02-06

**Fix local skills losing category metadata**

Local skills now preserve original category from metadata.yaml instead of hardcoding "local/custom".

[-> Full release notes](./changelogs/0.13.4.md)

## [0.13.3] - 2026-02-06

**Fix local config and agent_skills normalization**

Fixed recompile config lookup fallback and agent_skills mixed format normalization.

[-> Full release notes](./changelogs/0.13.3.md)

## [0.13.2] - 2026-02-06

**Fix npx eject missing agent partials**

Added `src/agents/` to published npm package.

[-> Full release notes](./changelogs/0.13.2.md)

## [0.13.1] - 2026-02-06

**Fix npx eject ENOENT and build config**

Added `config/` to published package, fixed build to copy config to dist, test portability improvements.

[-> Full release notes](./changelogs/0.13.1.md)

## [0.13.0] - 2026-02-06

**Import command, interactive search, framework-first build**

Import skills from GitHub, interactive skill search with multi-select, framework-first wizard flow.

[-> Full release notes](./changelogs/0.13.0.md)

## [0.12.0] - 2026-02-04

**Agent Compliance Bible and Claude Code research**

30-test compliance suite, 176 Claude Code updates documented, agent partials conciseness pass.

[-> Full release notes](./changelogs/0.12.0.md)

## [0.11.0] - 2026-02-04

**CLI source directory rename and Bible documentation**

`src/cli-v2/` renamed to `src/cli/`, comprehensive documentation standards added.

[-> Full release notes](./changelogs/0.11.0.md)

## [0.10.0] - 2026-02-03

**Directory structure: .claude-src/ and .claude/**

Source files in `.claude-src/`, runtime output in `.claude/`. Breaking change to directory layout.

[-> Full release notes](./changelogs/0.10.0.md)

## [0.9.0] - 2026-02-03

**Config location change and eject simplification**

Config moved to `.claude/config.yaml`, eject types simplified, wizard pre-population.

[-> Full release notes](./changelogs/0.9.0.md)

## [0.8.0] - 2026-02-02

**Skill IDs normalized to kebab-case**

Breaking change from path-based IDs to simple kebab-case format. Meta-stack added.

[-> Full release notes](./changelogs/0.8.0.md)

## [0.7.0] - 2026-02-02

**Wizard flow redesign with domain-based grid selection**

New 5-step flow with CategoryGrid, WizardTabs, domain-based navigation. Complete wizard rewrite.

[-> Full release notes](./changelogs/0.7.0.md)

## [0.6.0] - 2026-02-01

**Skills defined in stacks, not agents**

Breaking change: stacks.yaml defines technology selections per agent. Skills resolved via matrix aliases.

[-> Full release notes](./changelogs/0.6.0.md)

## [0.5.1] - 2026-02-01

**Auto-detection of installation mode**

CLI auto-detects local vs plugin installation. `installMode` stored in config.

[-> Full release notes](./changelogs/0.5.1.md)

## [0.5.0] - 2026-02-01

**Agent-centric configuration**

Breaking change: skills defined in agent YAMLs, centralized stacks.yaml.

[-> Full release notes](./changelogs/0.5.0.md)

## [0.4.0] - 2026-01-31

**Methodology skills preselected and comprehensive test suite**

Foundational skills selected by default, 1000+ tests, test isolation support.

[-> Full release notes](./changelogs/0.4.0.md)

## [0.3.0] - 2026-01-31

**CLI framework migration to oclif + Ink**

Migrated from Commander.js + @clack/prompts to oclif + Ink + Zustand.

[-> Full release notes](./changelogs/0.3.0.md)

## [0.2.0] - 2026-01-30

**Marketplace support**

Install stack plugins from configured marketplaces, multi-source agent loading.

[-> Full release notes](./changelogs/0.2.0.md)

## [0.1.3] - 2026-01-30

**Eject output option and remote schema fetching**

Custom output directory for eject, remote schema validation from GitHub.

[-> Full release notes](./changelogs/0.1.3.md)

## [0.1.2] - 2026-01-30

**Remove local dev files from repo**

Cleaned up local development files (.claude, CLAUDE.md).

[-> Full release notes](./changelogs/0.1.2.md)

## [0.1.1] - 2026-01-30

**Fix repo reference and README agent names**

Corrected GITHUB_REPO const and README agent names.

[-> Full release notes](./changelogs/0.1.1.md)

## [0.1.0] - 2026-01-30

**Initial release**

Interactive wizard, stack installation, skill compilation, validation, configuration management, and plugin mode.

[-> Full release notes](./changelogs/0.1.0.md)
