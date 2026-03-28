# Configuration System

**Last Updated:** 2026-03-28

## Overview

**Purpose:** Manage project configuration, source resolution, and config persistence.

**Location:** `src/cli/lib/configuration/`

## Files

| File                     | Path                                               | Purpose                                         |
| ------------------------ | -------------------------------------------------- | ----------------------------------------------- |
| `config.ts`              | `src/cli/lib/configuration/config.ts`              | Source resolution, project source config I/O    |
| `config-generator.ts`    | `src/cli/lib/configuration/config-generator.ts`    | Generate ProjectConfig from wizard, scope split |
| `config-merger.ts`       | `src/cli/lib/configuration/config-merger.ts`       | Merge wizard result with existing               |
| `config-saver.ts`        | `src/cli/lib/configuration/config-saver.ts`        | Save source to project config                   |
| `config-writer.ts`       | `src/cli/lib/configuration/config-writer.ts`       | Generate TypeScript config source strings       |
| `config-types-writer.ts` | `src/cli/lib/configuration/config-types-writer.ts` | Generate config-types.ts type files             |
| `config-loader.ts`       | `src/cli/lib/configuration/config-loader.ts`       | Load TypeScript config via jiti                 |
| `project-config.ts`      | `src/cli/lib/configuration/project-config.ts`      | Load and validate project config                |
| `source-manager.ts`      | `src/cli/lib/configuration/source-manager.ts`      | Add/remove extra sources                        |
| `define-config.ts`       | `src/cli/lib/configuration/define-config.ts`       | Type-safe `defineConfig()` helper               |
| `default-categories.ts`  | `src/cli/lib/configuration/default-categories.ts`  | Default skill category definitions              |
| `default-rules.ts`       | `src/cli/lib/configuration/default-rules.ts`       | Default skill rule definitions                  |
| `default-stacks.ts`      | `src/cli/lib/configuration/default-stacks.ts`      | Default stack definitions                       |
| `index.ts`               | `src/cli/lib/configuration/index.ts`               | Barrel exports                                  |

## Config File Locations

| File                 | Path                            | Purpose                                 |
| -------------------- | ------------------------------- | --------------------------------------- |
| Project config       | `.claude-src/config.ts`         | Skills, agents, stack, source, branding |
| Project config types | `.claude-src/config-types.ts`   | Auto-generated type unions for config   |
| Global config        | `~/.claude-src/config.ts`       | Global-scope skills, agents, stack      |
| Global config types  | `~/.claude-src/config-types.ts` | Auto-generated global type unions       |

Config uses a unified `ProjectConfig` type for both source-level settings (source, marketplace, branding) and installation settings (skills, agents, stack). Files are TypeScript (loaded via jiti), not YAML.

## Key Types

### ProjectConfig (`src/cli/types/config.ts:66-146`)

Unified configuration type. Stores both source-resolution fields and installed skill/agent data.

```typescript
type ProjectConfig = {
  version?: "1";
  name: string;
  description?: string;
  agents: AgentScopeConfig[];
  skills: SkillConfig[];
  author?: string;
  stack?: Record<string, StackAgentConfig>;
  source?: string;
  marketplace?: string;
  agentsSource?: string;
  domains?: Domain[];
  selectedAgents?: AgentName[];
  sources?: SourceEntry[];
  boundSkills?: BoundSkill[];
  branding?: BrandingConfig;
  skillsDir?: string;
  agentsDir?: string;
  stacksFile?: string;
  categoriesFile?: string;
  rulesFile?: string;
};
```

### SkillConfig (`src/cli/types/config.ts:23-27`)

```typescript
type SkillConfig = {
  id: SkillId;
  scope: "project" | "global";
  source: string; // "local" | marketplace name
};
```

### AgentScopeConfig (`src/cli/types/config.ts:30-33`)

```typescript
type AgentScopeConfig = {
  name: AgentName;
  scope: "project" | "global";
};
```

### ResolvedConfig (`src/cli/lib/configuration/config.ts:18-22`)

```typescript
type ResolvedConfig = {
  source: string;
  sourceOrigin: "flag" | "env" | "project" | "default";
  marketplace?: string;
};
```

## Source Resolution

**Function:** `resolveSource()` at `src/cli/lib/configuration/config.ts:84`

**Precedence (highest to lowest):**

1. `--source` flag value
2. `CC_SOURCE` environment variable
3. `.claude-src/config.ts` `source` field (project-level)
4. `~/.claude-src/config.ts` `source` field (global-level)
5. Default: `github:agents-inc/skills`

**Source validation:** `validateSourceFormat()` at `src/cli/lib/configuration/config.ts:291`

Validates:

- No null bytes (bypass prevention)
- Max length 512 chars
- Remote sources: valid URL/shorthand, no path traversal, no private IPs
- Local sources: no control chars, no UNC paths

**Source classification:** `isLocalSource()` at `src/cli/lib/configuration/config.ts:431` - Returns `true` for paths starting with `/` or `.`, `false` for remote protocols. Rejects `..` and `~` in non-remote sources.

## Agent Source Resolution

**Function:** `resolveAgentsSource()` at `src/cli/lib/configuration/config.ts:142`

**Precedence:** `--agent-source` flag > project config `agentsSource` > global config `agentsSource` > default (local CLI)

## Config Generation

**Function:** `generateProjectConfigFromSkills()` at `src/cli/lib/configuration/config-generator.ts:47`

Generates `ProjectConfig` from wizard result:

- Maps domain selections to flat skill list
- Builds stack property from agent-skill mappings
- Resolves agent names from selected domains

**Function:** `buildStackProperty()` at `src/cli/lib/configuration/config-generator.ts:146` - Builds the `stack` record in config from a loaded Stack definition.

**Function:** `splitConfigByScope()` at `src/cli/lib/configuration/config-generator.ts:169` - Splits a `ProjectConfig` into global and project partitions by skill/agent scope. Returns `SplitConfigResult` (`{ global: ProjectConfig; project: ProjectConfig }`).

## Config Merging

**Function:** `mergeWithExistingConfig()` at `src/cli/lib/configuration/config-merger.ts:89`

When `edit` command modifies skills:

- Loads existing config
- Merges new selections with existing via `mergeConfigs()` (line `:25`)
- Preserves user customizations (author, source, etc.)

**Pure merge function:** `mergeConfigs()` at `src/cli/lib/configuration/config-merger.ts:25`

- Existing values take precedence for identity fields (name, description, source, author)
- Agents are unioned by name
- Skills are merged by ID (new overrides existing, keeps the rest)
- Stack is deep-merged by agent

## Config I/O

| Function                      | Purpose                                 | File                   |
| ----------------------------- | --------------------------------------- | ---------------------- |
| `loadProjectSourceConfig()`   | Load .claude-src/config.ts (partial)    | `config.ts:28`         |
| `loadGlobalSourceConfig()`    | Load ~/.claude-src/config.ts (partial)  | `config.ts:52`         |
| `loadProjectConfig()`         | Load + validate with global fallback    | `project-config.ts:75` |
| `loadProjectConfigFromDir()`  | Load + validate from specific dir only  | `project-config.ts:18` |
| `validateProjectConfig()`     | Validate project config structure       | `project-config.ts:88` |
| `generateConfigSource()`      | Generate TypeScript source string       | `config-writer.ts:35`  |
| `saveSourceToProjectConfig()` | Save source field to config file        | `config-saver.ts:8`    |
| `loadConfig()`                | Generic TypeScript config loader (jiti) | `config-loader.ts:26`  |
| `defineConfig()`              | Type-safe config helper (identity fn)   | `define-config.ts:10`  |
| `getProjectConfigPath()`      | Build absolute path to project config   | `config.ts:24`         |
| `resolveAllSources()`         | Resolve primary + extra sources         | `config.ts:224`        |
| `resolveAuthor()`             | Resolve author from effective config    | `config.ts:204`        |
| `formatOrigin()`              | Human-readable label for source origin  | `config.ts:172`        |

## Config Writer

**File:** `src/cli/lib/configuration/config-writer.ts`

Replaced the former `writeProjectSourceConfig()`. Generates TypeScript source strings from `ProjectConfig`.

| Function                                 | Purpose                                                    |
| ---------------------------------------- | ---------------------------------------------------------- |
| `generateConfigSource()`                 | Main entry: generates config.ts source string              |
| `generateBlankGlobalConfigSource()`      | Blank global config (empty arrays)                         |
| `generateBlankGlobalConfigTypesSource()` | Blank config-types.ts (all types = `never`)                |
| `ensureBlankGlobalConfig()`              | Creates blank global config at `~/.claude-src/` if missing |
| `getGlobalConfigImportPath()`            | Returns absolute path to `~/.claude-src/`                  |

The `generateConfigSource()` function accepts an optional `ConfigSourceOptions` parameter. When `isProjectConfig: true`, the generated config imports from the global config and spreads global arrays into skills, agents, and domains.

## Config Types Writer

**File:** `src/cli/lib/configuration/config-types-writer.ts`

Generates `config-types.ts` files with typed union types narrowed to installed items.

| Function                             | Purpose                                           |
| ------------------------------------ | ------------------------------------------------- |
| `generateConfigTypesSource()`        | Generate standalone config-types.ts from matrix   |
| `generateProjectConfigTypesSource()` | Generate project config-types.ts extending global |
| `regenerateConfigTypes()`            | Full regeneration with background matrix loading  |
| `loadConfigTypesDataInBackground()`  | Kick off background matrix/agent loading          |
| `getGlobalConfigTypesPath()`         | Check if global config-types.ts exists            |

When a global installation exists, project `config-types.ts` imports from global and extends with project-only types. Types are narrowed to only installed items (not the full matrix).

## Scope-Aware Config Splitting

Config supports `"project"` and `"global"` scopes on both skills and agents. During installation:

1. `splitConfigByScope()` partitions the merged config into global and project parts
2. `writeScopedConfigs()` (in `local-installer.ts:369`) writes:
   - Global config to `~/.claude-src/config.ts` (standalone)
   - Project config to `{projectDir}/.claude-src/config.ts` (imports from global)
3. Config-types files are split similarly: global gets standalone types, project extends global

When installing from the home directory (not a project), a single standalone config is written.

## Source Management

**File:** `src/cli/lib/configuration/source-manager.ts`

| Function             | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `addSource()`        | Add a new extra source to project config   |
| `removeSource()`     | Remove an extra source from project config |
| `getSourceSummary()` | Get summary of all configured sources      |

## Branding / White-Labeling

**Function:** `resolveBranding()` at `src/cli/lib/configuration/config.ts:216`

Supports custom branding via `.claude-src/config.ts`:

```typescript
export default {
  name: "my-project",
  skills: [],
  agents: [],
  branding: {
    name: "Acme Dev Tools",
    tagline: "Custom development agents",
  },
} satisfies ProjectConfig;
```

Falls back to `DEFAULT_BRANDING` from `src/cli/consts.ts:162-165`:

- Name: "Agents Inc."
- Tagline: "AI-powered development tools"

## Schema Validation

Config files are validated at parse boundaries using Zod schemas from `src/cli/lib/schemas.ts`:

| Schema                      | Purpose                                 |
| --------------------------- | --------------------------------------- |
| `projectSourceConfigSchema` | Lenient loader for source config fields |
| `projectConfigLoaderSchema` | Lenient loader for full ProjectConfig   |

Schema URLs defined in `SCHEMA_PATHS` at `src/cli/consts.ts:78-85`.

## Operations Layer: writeProjectConfig

**File:** `src/cli/lib/operations/project/write-project-config.ts`

The operations layer provides `writeProjectConfig()` (line `:43`) as a high-level orchestrator that runs the full config pipeline:

1. `buildAndMergeConfig()` -- generates config from wizard result, merges with existing
2. `loadAllAgents()` -- loads agent definitions for config-types generation
3. `ensureBlankGlobalConfig()` -- ensures global config exists (when in project context)
4. `writeScopedConfigs()` -- writes config.ts and config-types.ts split by scope

| Type                | Name                  | Purpose                                              |
| ------------------- | --------------------- | ---------------------------------------------------- |
| `ConfigWriteOptions`  | Input options type    | wizardResult, sourceResult, projectDir, sourceFlag, agents |
| `ConfigWriteResult`   | Return type           | config, configPath, globalConfigPath, wasMerged, existingConfigPath, filesWritten |
| `writeProjectConfig()`| Orchestrator function | Builds, merges, and writes project config (init/edit) |

Used by `init.tsx` and `edit.tsx` commands. Replaces inlined config writing logic with a single operation call.
