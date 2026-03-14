# Plugin System

**Last Updated:** 2026-03-14

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

Type: `PluginManifest` (`src/cli/types/plugins.ts:10-21`)

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

Plugin manifest directory: `.claude-plugin/` (`PLUGIN_MANIFEST_DIR` from `src/cli/consts.ts:18`)

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

**Function:** `validatePlugin()` at `src/cli/lib/plugins/plugin-validator.ts:350`

Validates:

- Plugin structure via `validatePluginStructure()` (manifest dir exists, line `:63`)
- Plugin manifest via `validatePluginManifest()` (valid JSON, required fields, line `:113`)
- Skill files via `validatePluginSkillFiles()` (SKILL.md has valid frontmatter)
- Agent files via `validatePluginAgentFiles()` (agent .md files have valid frontmatter)

Individual frontmatter validators (exported):

- `validateSkillFrontmatter()` at `:184` - Validate a single SKILL.md file
- `validateAgentFrontmatter()` at `:220` - Validate a single agent .md file

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

### Marketplace Type (`src/cli/types/plugins.ts:58-66`)

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
| `claudePluginMarketplaceExists()` | Checks if marketplace is registered              |
| `claudePluginMarketplaceAdd()`    | `claude plugin marketplace add {source}`         |

`claudePluginInstall()` and `claudePluginUninstall()` accept `scope: "project" | "user"` and `projectDir` parameters. All inputs validated for injection prevention before execution.

## Installation Modes

### Local Mode

Skills copied to `.claude/skills/`, agents compiled to `.claude/agents/`.

**Function:** `installLocal()` at `src/cli/lib/installation/local-installer.ts:634`
(Re-exported from `src/cli/lib/installation/index.ts`)

### Plugin Mode

Skills installed as Claude Code plugins, agents compiled to `.claude/agents/`.

**Function:** `installPluginConfig()` at `src/cli/lib/installation/local-installer.ts:542`
(Re-exported from `src/cli/lib/installation/index.ts`)

### Scope-Aware Installation

Both `installLocal()` and `installPluginConfig()` use `writeScopedConfigs()` (line `:422`) to split config by scope:

- Global-scoped skills/agents go to `~/.claude-src/config.ts` and `~/.claude/agents/`
- Project-scoped skills/agents go to `{projectDir}/.claude-src/config.ts` and `{projectDir}/.claude/agents/`

Key helper functions in `local-installer.ts`:

| Function                | Line   | Purpose                                          |
| ----------------------- | ------ | ------------------------------------------------ |
| `resolveInstallPaths()` | `:98`  | Resolve skill/agent/config paths for a scope     |
| `buildAndMergeConfig()` | `:284` | Build config from wizard and merge with existing |
| `writeConfigFile()`     | `:302` | Write config.ts using `generateConfigSource()`   |
| `writeScopedConfigs()`  | `:422` | Split and write configs by scope                 |
| `buildCompileAgents()`  | `:311` | Build agent compile config from ProjectConfig    |
| `buildAgentScopeMap()`  | `:338` | Map agent names to their scope                   |
| `setConfigMetadata()`   | `:253` | Set source/marketplace/domains on config         |

### Detection

**Function:** `detectInstallation()` at `src/cli/lib/installation/installation.ts:103`

Returns `Installation` type with `mode`, `configPath`, `agentsDir`, `skillsDir`, `projectDir`.

Detection logic:

1. Check for project-level installation via `detectProjectInstallation()` (line `:35`)
2. If not found, fall back to global installation via `detectGlobalInstallation()` (line `:68`)
3. Each checks for `.claude-src/config.ts` and loads config to determine mode

Install mode is derived at runtime from the skills array via `deriveInstallMode()` (line `:26`):

- Empty skills array = `"local"` mode (default)
- All `source: "local"` = `"local"` mode
- All non-local sources = `"plugin"` mode
- Mixed = `"mixed"` mode

**Function:** `getInstallationOrThrow()` at `src/cli/lib/installation/installation.ts:114` - Same as `detectInstallation()` but throws if no installation found.
