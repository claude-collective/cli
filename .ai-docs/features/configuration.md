# Configuration System

**Last Updated:** 2026-02-25

## Overview

**Purpose:** Manage project configuration, source resolution, and config persistence.

**Location:** `src/cli/lib/configuration/`

## Files

| File                  | Path                                            | Purpose                               |
| --------------------- | ----------------------------------------------- | ------------------------------------- |
| `config.ts`           | `src/cli/lib/configuration/config.ts`           | Source resolution, project config I/O |
| `config-generator.ts` | `src/cli/lib/configuration/config-generator.ts` | Generate ProjectConfig from wizard    |
| `config-merger.ts`    | `src/cli/lib/configuration/config-merger.ts`    | Merge wizard result with existing     |
| `config-saver.ts`     | `src/cli/lib/configuration/config-saver.ts`     | Save source to project config         |
| `project-config.ts`   | `src/cli/lib/configuration/project-config.ts`   | Load and validate project config      |
| `source-manager.ts`   | `src/cli/lib/configuration/source-manager.ts`   | Add/remove extra sources              |
| `index.ts`            | `src/cli/lib/configuration/index.ts`            | Barrel exports                        |

## Config File Locations

| File                         | Path                      | Purpose                          |
| ---------------------------- | ------------------------- | -------------------------------- |
| Project source config        | `.claude-src/config.yaml` | Source, marketplace, branding    |
| Legacy project source config | `.claude/config.yaml`     | Fallback for older installations |
| Project config (installed)   | `.claude-src/config.yaml` | Skills, agents, stack, mode      |

Both `ProjectSourceConfig` and `ProjectConfig` share the same physical file (`.claude-src/config.yaml`).

## Key Types

### ProjectSourceConfig (`src/cli/lib/configuration/config.ts:38-51`)

```typescript
type ProjectSourceConfig = {
  source?: string;
  author?: string;
  marketplace?: string;
  agentsSource?: string;
  sources?: SourceEntry[];
  boundSkills?: BoundSkill[];
  branding?: BrandingConfig;
  skillsDir?: string;
  agentsDir?: string;
  stacksFile?: string;
  matrixFile?: string;
};
```

### ResolvedConfig (`src/cli/lib/configuration/config.ts:53-57`)

```typescript
type ResolvedConfig = {
  source: string;
  sourceOrigin: "flag" | "env" | "project" | "default";
  marketplace?: string;
};
```

## Source Resolution

**Function:** `resolveSource()` at `src/cli/lib/configuration/config.ts:100-148`

**Precedence (highest to lowest):**

1. `--source` flag value
2. `CC_SOURCE` environment variable
3. `.claude-src/config.yaml` `source` field
4. Default: `github:agents-inc/skills`

**Source validation:** `validateSourceFormat()` at `src/cli/lib/configuration/config.ts:307-445`

Validates:

- No null bytes (bypass prevention)
- Max length 512 chars
- Remote sources: valid URL/shorthand, no path traversal, no private IPs
- Local sources: no control chars, no UNC paths

## Agent Source Resolution

**Function:** `resolveAgentsSource()` at `src/cli/lib/configuration/config.ts:158-184`

**Precedence:** `--agent-source` flag > project config `agentsSource` > default (local CLI)

## Config Generation

**Function:** `generateProjectConfigFromSkills()` at `src/cli/lib/configuration/config-generator.ts`

Generates `ProjectConfig` from wizard result:

- Maps domain selections to flat skill list
- Builds stack property from agent-skill mappings
- Resolves agent names from selected domains

**Function:** `buildStackProperty()` - Builds the `stack` record in config from wizard domain selections.

## Config Merging

**Function:** `mergeWithExistingConfig()` at `src/cli/lib/configuration/config-merger.ts`

When `edit` command modifies skills:

- Loads existing config
- Merges new selections with existing
- Preserves user customizations (author, source, etc.)

## Config I/O

| Function                    | Purpose                           | File                |
| --------------------------- | --------------------------------- | ------------------- |
| `loadProjectSourceConfig()` | Load .claude-src/config.yaml      | `config.ts:63-85`   |
| `saveProjectConfig()`       | Write .claude-src/config.yaml     | `config.ts:87-97`   |
| `loadProjectConfig()`       | Load + validate project config    | `project-config.ts` |
| `validateProjectConfig()`   | Validate project config structure | `project-config.ts` |

## Source Management

**File:** `src/cli/lib/configuration/source-manager.ts`

| Function             | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `addSource()`        | Add a new extra source to project config   |
| `removeSource()`     | Remove an extra source from project config |
| `getSourceSummary()` | Get summary of all configured sources      |

## Branding / White-Labeling

**Function:** `resolveBranding()` at `src/cli/lib/configuration/config.ts:232-238`

Supports custom branding via `.claude-src/config.yaml`:

```yaml
branding:
  name: "Acme Dev Tools"
  tagline: "Custom development agents"
```

Falls back to `DEFAULT_BRANDING` from `src/cli/consts.ts:158-161`:

- Name: "Agents Inc."
- Tagline: "AI-powered development tools"

## YAML Schema Comments

Generated config files include `yaml-language-server` schema comments for IDE validation:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/agents-inc/cli/main/src/schemas/project-source-config.schema.json
```

Schema URLs defined in `SCHEMA_PATHS` at `src/cli/consts.ts:73-81`.
