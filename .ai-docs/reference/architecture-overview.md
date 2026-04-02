# Architecture Overview

**Last Updated:** 2026-04-02

## Project Identity

| Field       | Value                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| Package     | `@agents-inc/cli`                                                        |
| Version     | 0.100.0                                                                  |
| Binary      | `agentsinc` (also `CLI_BIN_NAME` in `src/cli/consts.ts:27`)              |
| Type        | ESM (`"type": "module"` in package.json)                                 |
| Entry Point | `src/cli/index.ts` (runs oclif with `run()`)                             |
| Build       | tsup -> `dist/`                                                          |
| Test Runner | Vitest (`vitest.config.ts`) with 3 projects: unit, integration, commands |
| Runtime     | Node.js (also Bun-compatible based on test helpers)                      |

## Technology Stack

| Layer             | Library              | Version     | Purpose                                      |
| ----------------- | -------------------- | ----------- | -------------------------------------------- |
| CLI Framework     | oclif                | @oclif/core | Command parsing, flags, plugins, hooks       |
| Terminal UI       | Ink + React          | ink v5      | Interactive wizard, prompts, terminal render |
| State Management  | Zustand              | v5          | Wizard state store                           |
| Schema Validation | Zod                  | v4.3.6      | YAML/JSON parse boundaries                   |
| Template Engine   | LiquidJS             | -           | Agent prompt compilation                     |
| Config Loader     | jiti                 | -           | TypeScript config file loading at runtime    |
| YAML              | yaml                 | -           | Config/matrix/metadata parsing               |
| Utilities         | Remeda               | v2.33.6     | Functional array/object utilities            |
| File System       | fs-extra + fast-glob | -           | File operations and globbing                 |
| Testing           | Vitest               | -           | Unit, integration, and command tests         |

## Directory Structure

```
src/cli/
  index.ts                  # CLI entry: oclif run()
  base-command.ts           # BaseCommand class (shared flags, error handling)
  config-exports.ts         # Public API re-exports for @agents-inc/cli/config
  consts.ts                 # ALL global constants (paths, colors, symbols, limits)
  commands/                 # oclif command classes (one per CLI command)
    build/                  # Build subcommands (marketplace, plugins, stack)
    import/                 # Import subcommands (skill)
    new/                    # New subcommands (agent, marketplace, skill)
    compile.ts              # Compile agents from installed skills
    doctor.ts               # Health check
    edit.tsx                # Edit installed skills (wizard re-entry, per-agent scope)
    eject.ts                # Eject skills/templates to local filesystem
    info.ts                 # Show installation info
    init.tsx                # Initialize project (wizard)
    list.tsx                # Show installation information (Ink component)
    search.tsx              # Search for skills across sources
    uninstall.tsx           # Uninstall from project
    update.tsx              # Update skills
    validate.ts             # Validate installation
  components/               # Ink React components
    common/                 # Shared UI: confirm, message, select-list, spinner
    hooks/                  # React hooks for wizard behavior
    skill-search/           # Skill search modal
    themes/                 # Ink theme (CLI_COLORS -> theme)
    wizard/                 # Wizard step components + utilities
  hooks/
    init.ts                 # oclif init hook: resolves source, attaches to config
  lib/                      # Core business logic (no UI)
    agents/                 # Agent fetching, compilation, recompilation
    configuration/          # Config loading/saving/merging/source management/config-writer/config-generator
    installation/           # Install mode detection, local installer, mode migrator
    loading/                # YAML/frontmatter loading, source fetching, multi-source
    matrix/                 # Skills matrix loading, resolving, health checks
      matrix-provider.ts    # getSkillById(), getSkillBySlug() lookups
      skill-resolution.ts   # resolveRelationships() — unified resolution
    operations/             # Composable building blocks for CLI commands
      source/               # loadSource(), ensureMarketplace()
      skills/               # discoverSkills(), copyLocalSkills(), installPluginSkills(), etc.
      project/              # detectProject(), writeProjectConfig(), compileAgents(), loadAgentDefs()
    plugins/                # Plugin discovery, validation, manifest, settings
    skills/                 # Skill fetching, copying, metadata, source switching
    stacks/                 # Stack loading, installing, plugin compilation
    wizard/                 # Build step logic (pure functions)
    compiler.ts             # Liquid template engine, agent/skill compilation
    exit-codes.ts           # Named EXIT_CODES constants
    feature-flags.ts        # Runtime feature flags (SOURCE_SEARCH, SOURCE_CHOICE, INFO_PANEL)
    metadata-keys.ts        # Metadata key constants
    output-validator.ts     # Compiled agent output validation
    permission-checker.tsx  # Claude Code permissions check
    resolver.ts             # Skill/agent reference resolution
    schema-validator.ts     # JSON Schema validation
    schemas.ts              # ALL Zod schemas (39 exported)
    source-validator.ts     # Source directory validation
    versioning.ts           # Content hashing for versioning
    marketplace-generator.ts # Marketplace.json generation
    __tests__/              # All test files
  stores/
    wizard-store.ts         # Zustand wizard state + actions
  types/                    # TypeScript type definitions
    index.ts                # Re-exports all type modules
    agents.ts               # Agent types (AgentName, AgentConfig, etc.)
    config.ts               # Config types (ProjectConfig, CompileConfig)
    matrix.ts               # Matrix types (Domain, Category, ResolvedSkill, etc.)
    plugins.ts              # Plugin types (PluginManifest, Marketplace)
    skills.ts               # Skill types (SkillId, SkillFrontmatter, etc.)
    stacks.ts               # Stack types (Stack, StackAgentConfig)
    generated/              # Auto-generated types from skills source
      source-types.ts       # SkillId, SkillSlug, Category, Domain, AgentName unions + arrays
      matrix.ts             # BUILT_IN_MATRIX constant with full category/skill data
  utils/                    # Cross-cutting utilities
    errors.ts               # getErrorMessage()
    exec.ts                 # Shell command execution (claude plugin install/uninstall)
    frontmatter.ts          # YAML frontmatter extraction
    fs.ts                   # File system wrappers (fs-extra + fast-glob)
    logger.ts               # log(), warn(), verbose(), setVerbose()
    messages.ts             # All user-facing message constants
    string.ts               # truncateText() string utility
    type-guards.ts          # isCategory(), isDomain(), isAgentName(), isCategoryPath()
    typed-object.ts         # typedEntries(), typedKeys()
    __mocks__/              # Vitest mocks for fs and logger
```

## Data Flow Overview

```
User runs command (e.g., `agentsinc init`)
  |
  v
oclif init hook (hooks/init.ts)
  -> resolveSource() -> ResolvedConfig attached to oclif config
  |
  v
Command.run() (commands/init.tsx)
  -> loadSkillsMatrixFromSource() -> SourceLoadResult (matrix + sourceConfig)
  -> render(<Wizard projectDir={...} marketplaceLabel={...} />)
  |
  v
Wizard (Ink/React UI)
  -> Imports matrix from matrix-provider.ts (not via props)
  -> Zustand store (useWizardStore) manages step-by-step state
  -> Steps: stack -> domains -> build -> sources -> agents -> confirm
  -> Returns WizardResultV2
  |
  v
Installation (commands use operations layer as composable building blocks)
  -> Operations: loadSource(), detectProject(), copyLocalSkills(), installPluginSkills()
  -> writeProjectConfig() generates config via generateConfigSource()
  -> compileAgents() compiles agent prompts
  -> writeScopedConfigs() splits config into global + project scopes
  |
  v
Compilation (lib/compiler.ts)
  -> readAgentFiles() -> agent partials (identity.md, playbook.md, etc.)
  -> buildAgentTemplateContext() -> CompiledAgentData
  -> sanitizeCompiledAgentData() -> prevent Liquid injection
  -> Liquid engine renders agent.liquid template
  -> Output: .claude/agents/{name}.md
```

## Key Architectural Patterns

### 1. oclif Command Pattern

Every command extends `BaseCommand` (`src/cli/base-command.ts:12`).

```
BaseCommand provides:
  - baseFlags: --source
  - sourceConfig getter (from init hook)
  - handleError() -> this.error() with EXIT_CODES.ERROR
  - logSuccess(), logWarning(), logInfo()
```

Commands are discovered via oclif pattern strategy from `dist/commands/`.

### 2. Init Hook

File: `src/cli/hooks/init.ts`

Runs before every command. Extracts `--source` / `-s` from raw argv (before oclif parses), calls `resolveSource()`, attaches `ResolvedConfig` to oclif config object.

### 3. Source Resolution Precedence

```
--source flag > CC_SOURCE env var > .claude-src/config.ts (project) > ~/.claude-src/config.ts (global) > default (github:agents-inc/skills)
```

Implemented in: `src/cli/lib/configuration/config.ts:84-132`

### 4. Install Modes

| Mode   | Skills Location                                   | Agents Location   | Config Location         |
| ------ | ------------------------------------------------- | ----------------- | ----------------------- |
| eject  | `.claude/skills/`                                 | `.claude/agents/` | `.claude-src/config.ts` |
| plugin | Claude plugin cache                               | `.claude/agents/` | `.claude-src/config.ts` |
| mixed  | `.claude/skills/` (eject) + plugin cache (plugin) | `.claude/agents/` | `.claude-src/config.ts` |

Detection: `src/cli/lib/installation/installation.ts` — `detectInstallation()` at line 84, `detectProjectInstallation()` at line 35

Scope-aware config splitting: `writeScopedConfigs()` in `src/cli/lib/installation/local-installer.ts:369` splits config into global and project-scoped files.

### 5. Liquid Template Compilation

Agent prompts are compiled from partials using LiquidJS.

Template root resolution order (first match wins):

1. `{project}/.claude-src/agents/_templates/`
2. `{project}/.claude/templates/` (legacy)
3. `{CLI_ROOT}/templates/` (built-in)

Implemented in: `src/cli/lib/compiler.ts:394-419` (`createLiquidEngine()`)

### 6. Zod Schema Validation

All YAML/JSON parse boundaries use Zod schemas from `src/cli/lib/schemas.ts` (39 exported schemas).

Pattern: Lenient "loader" schemas with `.passthrough()` at parse boundaries, strict schemas for validation. Bridge pattern: `z.ZodType<ExistingType>` ensures Zod output matches TypeScript interfaces.

Production code calls `parseYaml()` + `schema.safeParse()` directly at individual call sites. (`safeLoadYamlFile()` from `utils/yaml.ts` was removed as dead code.)

### 7. Generated Types

Union types (`SkillId`, `SkillSlug`, `Category`, `Domain`, `AgentName`) are auto-generated from the skills source into `src/cli/types/generated/source-types.ts`. Run `bun run generate:types` to regenerate.

Runtime type guards in `src/cli/utils/type-guards.ts` (`isCategory()`, `isDomain()`, `isAgentName()`, `isCategoryPath()`) validate strings against these generated arrays.

The `src/cli/types/generated/matrix.ts` file contains the full `BUILT_IN_MATRIX` constant with all category and skill data.

### 8. Matrix Provider and Skill Resolution

`src/cli/lib/matrix/matrix-provider.ts` provides safe skill lookups:

- `getSkillById(id)` — asserting lookup by SkillId
- `getSkillBySlug(slug)` — asserting lookup by SkillSlug

`src/cli/lib/matrix/skill-resolution.ts` contains `resolveRelationships()` (line 150) — a single unified function that resolves all skill relationships (replaces 5 separate resolve functions).

### 9. Security Measures

- Source validation: `validateSourceFormat()` in `src/cli/lib/configuration/config.ts:291-320` (with helper functions through line 447)
  - Blocks null bytes, UNC paths, private IPs, path traversal
  - Validates remote and local source formats
- Liquid injection prevention: `sanitizeCompiledAgentData()` in `src/cli/lib/compiler.ts:77-111`
  - Strips `{{`, `}}`, `{%`, `%}` from all user-controlled fields
- File size limits: `MAX_MARKETPLACE_FILE_SIZE`, `MAX_PLUGIN_FILE_SIZE`, `MAX_CONFIG_FILE_SIZE` in `src/cli/consts.ts:150-152`
- Command injection prevention: Input validation in `src/cli/utils/exec.ts:7-87`

### 10. Config Writer

`src/cli/lib/configuration/config-writer.ts` — `generateConfigSource()` generates TypeScript config files from `ProjectConfig` objects. Supports standalone configs and project configs that import/extend global configs.

Key function: `generateConfigSource(config, options?)` at line 35. When `options.isProjectConfig` is true, generates config that imports from the global `~/.claude-src/config` and spreads global arrays.
