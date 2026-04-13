---
scope: reference
area: features
keywords: [plugins, manifest, marketplace, installation, discovery]
related:
  - reference/features/compilation-pipeline.md
  - reference/features/skills-and-matrix.md
  - reference/commands.md
last_validated: 2026-04-02
---

# Plugin System

**Last Updated:** 2026-04-02

## Overview

**Purpose:** Discover, validate, and manage Claude Code plugins (skills and agents packaged for native installation).

**Location:** `src/cli/lib/plugins/`

## Files

| File                        | Path                                            | Purpose                             |
| --------------------------- | ----------------------------------------------- | ----------------------------------- |
| `plugin-manifest.ts`        | `src/cli/lib/plugins/plugin-manifest.ts`        | Generate plugin.json manifests      |
| `plugin-manifest-finder.ts` | `src/cli/lib/plugins/plugin-manifest-finder.ts` | Find plugin manifest in directory   |
| `plugin-finder.ts`          | `src/cli/lib/plugins/plugin-finder.ts`          | Locate plugin directories and files |
| `plugin-info.ts`            | `src/cli/lib/plugins/plugin-info.ts`            | Plugin info formatting/display      |
| `plugin-validator.ts`       | `src/cli/lib/plugins/plugin-validator.ts`       | Validate plugin structure/content   |
| `plugin-discovery.ts`       | `src/cli/lib/plugins/plugin-discovery.ts`       | Discover all installed plugins      |
| `plugin-settings.ts`        | `src/cli/lib/plugins/plugin-settings.ts`        | Plugin settings/paths resolution    |
| `index.ts`                  | `src/cli/lib/plugins/index.ts`                  | Barrel exports                      |

## Plugin Structure

A Claude Code plugin has this structure:

```
.claude-plugin/
  plugin.json          # Plugin manifest
skills/
  {skill-name}/
    SKILL.md           # Skill content
    metadata.yaml      # Skill metadata
agents/
  {agent-name}.md      # Compiled agent prompt
```

### Plugin Manifest (`plugin.json`)

Type: `PluginManifest` (`src/cli/types/plugins.ts`)

```typescript
type PluginManifest = {
  name: string; // kebab-case (e.g., "skill-react")
  version?: string;
  description?: string;
  author?: PluginAuthor;
  keywords?: string[];
  commands?: string | string[];
  agents?: string | string[];
  skills?: string | string[];
  hooks?: string | Record<string, AgentHookDefinition[]>;
};
```

## Plugin Locations

All location functions are in `src/cli/lib/plugins/plugin-finder.ts`:

| Function                   | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `getUserPluginsDir()`      | User-level plugins dir                      |
| `getCollectivePluginDir()` | Collective (shared) plugins dir             |
| `getProjectPluginsDir()`   | Project-level plugins: `.claude/plugins/`   |
| `getPluginSkillsDir()`     | Skills subdirectory within a plugin         |
| `getPluginAgentsDir()`     | Agents subdirectory within a plugin         |
| `getPluginManifestPath()`  | Path to plugin.json within a plugin dir     |
| `readPluginManifest()`     | Read and parse plugin.json from a dir       |
| `getPluginSkillIds()`      | Extract SkillIds from plugin SKILL.md files |

Note: `getPluginManifestPath()` also exists in `plugin-manifest.ts` (for output manifest path during compilation).

Plugin manifest directory: `.claude-plugin/` (`PLUGIN_MANIFEST_DIR` from `src/cli/consts.ts`)

## Plugin Manifest Finder

**File:** `src/cli/lib/plugins/plugin-manifest-finder.ts`

**Function:** `findPluginManifest(startDir)` - Walks up from `startDir` looking for `.claude-plugin/plugin.json`. Returns the manifest path or `null`.

## Plugin Discovery

**Function:** `discoverAllPluginSkills()` at `src/cli/lib/plugins/plugin-discovery.ts`

Discovers all installed skill plugins in a project directory:

1. Reads `.claude/settings.json` to find enabled plugins
2. Looks up install paths in global plugin registry
3. Loads skills from plugin cache directories
4. Returns `SkillDefinitionMap` (alias for `Partial<Record<SkillId, SkillDefinition>>`)

**Function:** `hasIndividualPlugins()` - Checks if any plugins exist (for init guard).

**Function:** `listPluginNames()` - List all plugin names.

## Plugin Info

**File:** `src/cli/lib/plugins/plugin-info.ts`

| Function                      | Purpose                                            |
| ----------------------------- | -------------------------------------------------- |
| `getPluginInfo()`             | Get plugin info (name, version, skill/agent count) |
| `formatPluginDisplay()`       | Format plugin info for terminal display            |
| `getInstallationInfo()`       | Get installation info (mode, paths, counts)        |
| `formatInstallationDisplay()` | Format installation info for terminal display      |

Types:

- `PluginInfo` - Plugin metadata with name, version, skill/agent counts, path
- `InstallationInfo` - Installation metadata with mode, paths, counts

## Plugin Validation

**Function:** `validatePlugin()` in `src/cli/lib/plugins/plugin-validator.ts`

Validates:

- Plugin structure via `validatePluginStructure()` (manifest dir exists)
- Plugin manifest via `validatePluginManifest()` (valid JSON, required fields)
- Skill files via `validatePluginSkillFiles()` (SKILL.md has valid frontmatter)
- Agent files via `validatePluginAgentFiles()` (agent .md files have valid frontmatter)

Individual frontmatter validators (exported):

- `validateSkillFrontmatter()` - Validate a single SKILL.md file
- `validateAgentFrontmatter()` - Validate a single agent .md file

**Function:** `validateAllPlugins()` - Validate all plugins in a directory.

**Function:** `printPluginValidationResult()` - Format validation results for display.

## Manifest Generation

| Function                        | Purpose                               |
| ------------------------------- | ------------------------------------- |
| `generateSkillPluginManifest()` | Generate manifest for a skill plugin  |
| `generateAgentPluginManifest()` | Generate manifest for an agent plugin |
| `generateStackPluginManifest()` | Generate manifest for a stack plugin  |
| `writePluginManifest()`         | Write plugin.json to disk             |
| `getPluginDir()`                | Get plugin output directory path      |

Options types:

- `SkillManifestOptions`
- `AgentManifestOptions`
- `StackManifestOptions`

## Plugin Settings

**File:** `src/cli/lib/plugins/plugin-settings.ts`

| Function                          | Purpose                                 |
| --------------------------------- | --------------------------------------- |
| `getEnabledPluginKeys()`          | Read enabled plugins from settings.json |
| `resolvePluginInstallPaths()`     | Resolve plugin paths from settings      |
| `getVerifiedPluginInstallPaths()` | Verified paths (check existence)        |

Types:

- `PluginKey` - Plugin identifier in settings
- `ResolvedPlugin` - Resolved plugin with path and metadata

## Marketplace

### Marketplace Type (`src/cli/types/plugins.ts`)

```typescript
type Marketplace = {
  $schema?: string;
  name: string;
  version: string;
  description?: string;
  owner: MarketplaceOwner;
  metadata?: MarketplaceMetadata;
  plugins: MarketplacePlugin[];
};
```

### Marketplace Generation

**File:** `src/cli/lib/marketplace-generator.ts`

Generates `marketplace.json` from a source directory containing skills.

### Marketplace Commands (via Claude CLI)

Executed through `src/cli/utils/exec.ts`:

| Function                          | Shell Command                                    |
| --------------------------------- | ------------------------------------------------ |
| `claudePluginInstall()`           | `claude plugin install {path} --scope {scope}`   |
| `claudePluginUninstall()`         | `claude plugin uninstall {name} --scope {scope}` |
| `claudePluginMarketplaceList()`   | `claude plugin marketplace list --json`          |
| `claudePluginMarketplaceExists()` | Checks if marketplace is registered (calls List) |
| `claudePluginMarketplaceAdd()`    | `claude plugin marketplace add {source}`         |
| `claudePluginMarketplaceRemove()` | `claude plugin marketplace remove {name}`        |
| `claudePluginMarketplaceUpdate()` | `claude plugin marketplace update {name}`        |
| `isClaudeCLIAvailable()`          | `claude --version` (returns boolean)             |

`claudePluginInstall()` and `claudePluginUninstall()` accept `scope: "project" | "user"` and `projectDir` parameters. User-scoped operations run from `os.homedir()` via `resolvePluginCwd()` so Claude CLI writes to `~/.claude/settings.json`. All inputs validated for injection prevention before execution.

## Installation Modes

### Plugin Mode

Skills installed as Claude Code plugins, agents compiled to `.claude/agents/`.

**Function:** `installPluginConfig()` in `src/cli/lib/installation/local-installer.ts`
(Re-exported from `src/cli/lib/installation/index.ts`)

### Eject Mode

Skills copied locally via eject workflow.

**Function:** `installEject()` (Re-exported from `src/cli/lib/installation/index.ts`)

### Scope-Aware Installation

`installPluginConfig()` uses `writeScopedConfigs()` to split config by scope:

- Global-scoped skills/agents go to `~/.claude-src/config.ts` and `~/.claude/agents/`
- Project-scoped skills/agents go to `{projectDir}/.claude-src/config.ts` and `{projectDir}/.claude/agents/`

Key helper functions in `local-installer.ts`:

| Function                | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `resolveInstallPaths()` | Resolve skill/agent/config paths for a scope     |
| `setConfigMetadata()`   | Set source/marketplace/domains on config         |
| `buildAndMergeConfig()` | Build config from wizard and merge with existing |
| `writeConfigFile()`     | Write config.ts using `generateConfigSource()`   |
| `buildCompileAgents()`  | Build agent compile config from ProjectConfig    |
| `buildAgentScopeMap()`  | Map agent names to their scope                   |
| `writeScopedConfigs()`  | Split and write configs by scope                 |

### Detection

**Function:** `detectInstallation()` in `src/cli/lib/installation/installation.ts`

Returns `Installation` type with `mode`, `configPath`, `agentsDir`, `skillsDir`, `projectDir`.

Detection logic:

1. Check for project-level installation via `detectProjectInstallation()`
2. If not found, fall back to global installation via `detectGlobalInstallation()`
3. Each checks for `.claude-src/config.ts` and loads config to determine mode

Install mode is derived at runtime from the skills array via `deriveInstallMode()`:

- Empty skills array = `"eject"` mode (default)
- All `source: "eject"` = `"eject"` mode
- All non-eject sources = `"plugin"` mode
- Mixed = `"mixed"` mode

**Function:** `getInstallationOrThrow()` in `src/cli/lib/installation/installation.ts` - Same as `detectInstallation()` but throws if no installation found.

## Mode Migration

**File:** `src/cli/lib/installation/mode-migrator.ts`
(Re-exported from `src/cli/lib/installation/index.ts`)

Handles skill source and scope migrations when editing an installation:

| Function             | Purpose                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| `detectMigrations()` | Compare old/new `SkillConfig[]` to detect source/scope changes             |
| `executeMigration()` | Execute per-skill migration: copy/delete locals, install/uninstall plugins |

Types:

- `SkillMigration` - Single skill migration with id, old/new source, old/new scope
- `MigrationPlan` - Contains `toEject`, `toPlugin`, `scopeChanges` arrays
- `MigrationResult` - Contains `ejectedSkills`, `pluginizedSkills`, `warnings`

Migration splits skills by scope before copying (project skills to `{projectDir}/.claude/skills/`, global to `~/.claude/skills/`). Plugin install/uninstall uses per-skill scope mapping (`"global"` -> `"user"`, `"project"` -> `"project"`).

## Operations Layer (Plugin Operations)

Plugin-related operations extracted to `src/cli/lib/operations/`:

### Install Plugin Skills

**File:** `src/cli/lib/operations/skills/install-plugin-skills.ts`

**Function:** `installPluginSkills(skills, marketplace, projectDir)` - Installs non-local skills as Claude CLI plugins. Constructs `{skillId}@{marketplace}` refs, routes by scope (`"global"` -> `"user"`, `"project"` -> `"project"`).

**Type:** `PluginInstallResult` - `{ installed: Array<{ id, ref }>, failed: Array<{ id, error }> }`

### Uninstall Plugin Skills

**File:** `src/cli/lib/operations/skills/uninstall-plugin-skills.ts`

**Function:** `uninstallPluginSkills(skillIds, oldSkills, projectDir)` - Uninstalls plugins using scope from old config entries.

**Type:** `PluginUninstallResult` - `{ uninstalled: SkillId[], failed: Array<{ id, error }> }`

### Ensure Marketplace

**File:** `src/cli/lib/operations/source/ensure-marketplace.ts`

**Function:** `ensureMarketplace(sourceResult)` - Registers or updates the marketplace with the Claude CLI. Lazy-resolves marketplace name if `sourceResult.marketplace` is undefined. Silent operation -- callers decide logging.

**Type:** `MarketplaceResult` - `{ marketplace: string | null, registered: boolean }`

Uses `claudePluginMarketplaceExists()`, `claudePluginMarketplaceAdd()`, and `claudePluginMarketplaceUpdate()` from exec.ts.

## Installation Barrel Exports

**File:** `src/cli/lib/installation/index.ts`

Re-exports from `installation.ts`: `InstallMode`, `Installation`, `detectGlobalInstallation`, `detectInstallation`, `detectProjectInstallation`, `getInstallationOrThrow`, `deriveInstallMode`

Re-exports from `local-installer.ts`: `EjectInstallOptions`, `EjectInstallResult`, `PluginConfigResult`, `installEject`, `installPluginConfig`, `buildAndMergeConfig`, `writeConfigFile`, `writeScopedConfigs`, `setConfigMetadata`, `resolveInstallPaths`, `buildEjectSkillsMap`, `buildCompileAgents`, `buildAgentScopeMap`

Re-exports from `mode-migrator.ts`: `SkillMigration`, `MigrationPlan`, `MigrationResult`, `detectMigrations`, `executeMigration`
