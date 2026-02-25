# Plugin System

**Last Updated:** 2026-02-25

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

| Function                   | Purpose                                   |
| -------------------------- | ----------------------------------------- |
| `getUserPluginsDir()`      | User-level plugins dir                    |
| `getCollectivePluginDir()` | Collective (shared) plugins dir           |
| `getProjectPluginsDir()`   | Project-level plugins: `.claude/plugins/` |
| `getPluginSkillsDir()`     | Skills subdirectory within a plugin       |
| `getPluginAgentsDir()`     | Agents subdirectory within a plugin       |
| `getPluginManifestPath()`  | Path to plugin.json within a plugin dir   |

Note: `getPluginManifestPath()` also exists in `plugin-manifest.ts` (for output manifest path during compilation).

Plugin manifest directory: `.claude-plugin/` (`PLUGIN_MANIFEST_DIR` from `src/cli/consts.ts:18`)

## Plugin Discovery

**Function:** `discoverAllPluginSkills()` at `src/cli/lib/plugins/plugin-discovery.ts`

Discovers all installed skill plugins in a project directory:

1. Scans project plugins directory
2. Reads each plugin manifest
3. Extracts skill definitions from SKILL.md frontmatter
4. Returns `Partial<Record<SkillId, SkillDefinition>>`

**Function:** `hasIndividualPlugins()` - Checks if any plugins exist (for init guard).

**Function:** `listPluginNames()` - List all plugin names.

## Plugin Validation

**Function:** `validatePlugin()` at `src/cli/lib/plugins/plugin-validator.ts:359`

Validates:

- Plugin structure via `validatePluginStructure()` (manifest dir exists)
- Plugin manifest via `validatePluginManifest()` (valid JSON, required fields)
- Skill files via `validatePluginSkillFiles()` (SKILL.md has valid frontmatter)
- Agent files via `validatePluginAgentFiles()` (agent .md files have valid frontmatter)

## Manifest Generation

| Function                        | Purpose                               |
| ------------------------------- | ------------------------------------- |
| `generateSkillPluginManifest()` | Generate manifest for a skill plugin  |
| `generateAgentPluginManifest()` | Generate manifest for an agent plugin |
| `generateStackPluginManifest()` | Generate manifest for a stack plugin  |
| `writePluginManifest()`         | Write plugin.json to disk             |

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
| `claudePluginInstall()`           | `claude plugin install {ref} --scope {scope}`    |
| `claudePluginUninstall()`         | `claude plugin uninstall {name} --scope {scope}` |
| `claudePluginMarketplaceList()`   | `claude plugin marketplace list --json`          |
| `claudePluginMarketplaceExists()` | Checks if marketplace is registered              |
| `claudePluginMarketplaceAdd()`    | `claude plugin marketplace add {source}`         |

All inputs validated for injection prevention before execution.

## Installation Modes

### Local Mode

Skills copied to `.claude/skills/`, agents compiled to `.claude/agents/`.

**Function:** `installLocal()` at `src/cli/lib/installation/local-installer.ts:511`
(Re-exported from `src/cli/lib/installation/index.ts`)

### Plugin Mode

Skills installed as Claude Code plugins, agents compiled to `.claude/agents/`.

**Function:** `installPluginConfig()` at `src/cli/lib/installation/local-installer.ts:435`
(Re-exported from `src/cli/lib/installation/index.ts`)

### Detection

**Function:** `detectInstallation()` at `src/cli/lib/installation/installation.ts:23-60`

Returns `Installation` type with `mode`, `configPath`, `agentsDir`, `skillsDir`, `projectDir`.

Detection logic:

1. Check for `.claude-src/config.yaml` or `.claude/config.yaml`
2. Load project config to determine mode
3. Return appropriate paths for the mode
