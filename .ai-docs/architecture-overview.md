# Architecture Overview

**Last Updated:** 2026-02-25

## Project Identity

| Field       | Value                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| Package     | `@agents-inc/cli`                                                        |
| Version     | 0.47.0                                                                   |
| Binary      | `agentsinc` (also `CLI_BIN_NAME` in `src/cli/consts.ts:24`)              |
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
| YAML              | yaml                 | -           | Config/matrix/metadata parsing               |
| Utilities         | Remeda               | v2.33.6     | Functional array/object utilities            |
| File System       | fs-extra + fast-glob | -           | File operations and globbing                 |
| Testing           | Vitest               | -           | Unit, integration, and command tests         |

## Directory Structure

```
src/cli/
  index.ts                  # CLI entry: oclif run()
  base-command.ts           # BaseCommand class (shared flags, error handling)
  consts.ts                 # ALL global constants (paths, colors, symbols, limits)
  commands/                 # oclif command classes (one per CLI command)
    build/                  # Build subcommands (marketplace, plugins, stack)
    config/                 # Config subcommands (get, set-project, show, path, unset-project)
    import/                 # Import subcommands (skill)
    new/                    # New subcommands (agent, marketplace, skill)
    compile.ts              # Compile agents from installed skills
    diff.ts                 # Show skill differences
    doctor.ts               # Health check
    edit.tsx                # Edit installed skills (wizard re-entry)
    eject.ts                # Eject to local mode
    info.ts                 # Show installation info
    init.tsx                # Initialize project (wizard)
    list.ts                 # List installed skills
    outdated.ts             # Check for skill updates
    search.tsx              # Search for skills across sources
    uninstall.tsx           # Uninstall from project
    update.tsx              # Update skills
    validate.ts             # Validate installation
  components/               # Ink React components
    common/                 # Shared UI: confirm, message, spinner
    hooks/                  # React hooks for wizard behavior
    skill-search/           # Skill search modal
    themes/                 # Ink theme (CLI_COLORS -> theme)
    wizard/                 # Wizard step components + utilities
  hooks/
    init.ts                 # oclif init hook: resolves source, attaches to config
  lib/                      # Core business logic (no UI)
    agents/                 # Agent fetching, compilation, recompilation
    configuration/          # Config loading/saving/merging/source management
    installation/           # Install mode detection, local installer
    loading/                # YAML/frontmatter loading, source fetching, multi-source
    matrix/                 # Skills matrix loading, resolving, health checks
    plugins/                # Plugin discovery, validation, manifest, settings
    skills/                 # Skill fetching, copying, metadata, source switching
    stacks/                 # Stack loading, installing, plugin compilation
    wizard/                 # Build step logic (pure functions)
    compiler.ts             # Liquid template engine, agent/skill compilation
    exit-codes.ts           # Named EXIT_CODES constants
    metadata-keys.ts        # Metadata key constants
    output-validator.ts     # Compiled agent output validation
    permission-checker.tsx  # Claude Code permissions check
    resolver.ts             # Skill/agent reference resolution
    schema-validator.ts     # JSON Schema validation
    schemas.ts              # ALL Zod schemas (30+)
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
    matrix.ts               # Matrix types (Domain, Subcategory, ResolvedSkill, etc.)
    plugins.ts              # Plugin types (PluginManifest, Marketplace)
    skills.ts               # Skill types (SkillId, SkillFrontmatter, etc.)
    stacks.ts               # Stack types (Stack, StackAgentConfig)
  utils/                    # Cross-cutting utilities
    errors.ts               # getErrorMessage()
    exec.ts                 # Shell command execution (claude plugin install/uninstall)
    frontmatter.ts          # YAML frontmatter extraction
    fs.ts                   # File system wrappers (fs-extra + fast-glob)
    logger.ts               # log(), warn(), verbose(), setVerbose()
    messages.ts             # All user-facing message constants
    typed-object.ts         # typedEntries(), typedKeys()
    yaml.ts                 # safeLoadYamlFile() (Zod-validated YAML loading)
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
  -> loadSkillsMatrixFromSource() -> MergedSkillsMatrix
  -> render(<Wizard matrix={matrix} />)
  |
  v
Wizard (Ink/React UI)
  -> Zustand store (useWizardStore) manages step-by-step state
  -> Steps: stack -> build -> sources -> agents -> confirm
  -> Returns WizardResultV2
  |
  v
Installation
  -> installLocal() or installPluginConfig()
  -> Copies skills, generates config, compiles agents
  |
  v
Compilation (lib/compiler.ts)
  -> readAgentFiles() -> agent partials (intro.md, workflow.md, etc.)
  -> buildAgentTemplateContext() -> CompiledAgentData
  -> sanitizeCompiledAgentData() -> prevent Liquid injection
  -> Liquid engine renders agent.liquid template
  -> Output: .claude/agents/{name}.md
```

## Key Architectural Patterns

### 1. oclif Command Pattern

Every command extends `BaseCommand` (`src/cli/base-command.ts:11`).

```
BaseCommand provides:
  - baseFlags: --dry-run, --source
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
--source flag > CC_SOURCE env var > .claude-src/config.yaml source > default (github:agents-inc/skills)
```

Implemented in: `src/cli/lib/configuration/config.ts:100-148`

### 4. Install Modes

| Mode   | Skills Location     | Agents Location   | Config Location           |
| ------ | ------------------- | ----------------- | ------------------------- |
| local  | `.claude/skills/`   | `.claude/agents/` | `.claude-src/config.yaml` |
| plugin | Claude plugin cache | `.claude/agents/` | `.claude-src/config.yaml` |

Detection: `src/cli/lib/installation/installation.ts:23-60`

### 5. Liquid Template Compilation

Agent prompts are compiled from partials using LiquidJS.

Template root resolution order (first match wins):

1. `{project}/.claude-src/agents/_templates/`
2. `{project}/.claude/templates/` (legacy)
3. `{CLI_ROOT}/templates/` (built-in)

Implemented in: `src/cli/lib/compiler.ts:412-437`

### 6. Zod Schema Validation

All YAML/JSON parse boundaries use Zod schemas from `src/cli/lib/schemas.ts`.

Pattern: Lenient "loader" schemas with `.passthrough()` at parse boundaries, strict schemas for validation. Bridge pattern: `z.ZodType<ExistingType>` ensures Zod output matches TypeScript interfaces.

Helper: `safeLoadYamlFile()` from `src/cli/utils/yaml.ts` combines file read + parse + Zod validate.

### 7. Security Measures

- Source validation: `validateSourceFormat()` in `src/cli/lib/configuration/config.ts:307-445`
  - Blocks null bytes, UNC paths, private IPs, path traversal
  - Validates remote and local source formats
- Liquid injection prevention: `sanitizeCompiledAgentData()` in `src/cli/lib/compiler.ts:77-115`
  - Strips `{{`, `}}`, `{%`, `%}` from all user-controlled fields
- File size limits: `MAX_MARKETPLACE_FILE_SIZE`, `MAX_PLUGIN_FILE_SIZE`, `MAX_CONFIG_FILE_SIZE` in `src/cli/consts.ts:137-140`
- Command injection prevention: Input validation in `src/cli/utils/exec.ts:19-86`
