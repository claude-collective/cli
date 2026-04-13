---
scope: reference
area: config
keywords:
  [
    config-writer,
    generateConfigSource,
    generateProjectConfigWithInlinedGlobal,
    config-types-writer,
    scope-split,
    global-config,
  ]
related:
  - reference/config/configuration.md
  - reference/concepts/scope-system.md
  - reference/concepts/tombstone-pattern.md
last_validated: 2026-04-13
---

# Config Writer (Detailed)

**Last Updated:** 2026-04-13
**Last Validated:** 2026-04-13

> **Extracted from:** `reference/features/configuration.md` (Config Writer and Config Types Writer sections).

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

The `generateConfigSource()` function accepts an optional `ConfigSourceOptions` parameter:

- When `isProjectConfig: true` (no `globalConfig`): generates a config that imports from the global config and spreads global arrays into skills, agents, and domains.
- When `isProjectConfig: true` with `globalConfig` provided: generates a self-contained config snapshot via `generateProjectConfigWithInlinedGlobal()`. Both global and project entries for the same skill ID are preserved (no deduplication). Global entries appear under a `// global` comment, project entries under `// project`. Excluded global entries (tombstones) replace their active global counterparts in the global section while the active project entry appears separately in the project section. Stack entries are filtered to project-scoped agents only.

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
