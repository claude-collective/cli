---
scope: reference
area: concepts
keywords:
  [
    scope,
    project,
    global,
    resolveInstallPaths,
    writeScopedConfigs,
    splitConfigByScope,
    dual-scope,
    lock-icon,
    isEditingFromGlobalScope,
    isInitMode,
  ]
related:
  - reference/architecture/overview.md
  - reference/wizard/flow.md
  - reference/wizard/state-transitions.md
  - reference/config/configuration.md
  - reference/wizard/component-patterns.md
  - reference/concepts/tombstone-pattern.md
last_validated: 2026-04-13
---

# Scope System (Project vs Global)

**Last Updated:** 2026-04-13
**Last Validated:** 2026-04-13

> **Cross-cutting concept.** Consolidates scope documentation from: `architecture-overview.md` (Section 11), `wizard-flow.md` (guards), `state-transitions.md` (scope actions), `configuration.md` (scope-aware splitting), `component-patterns.md` (dual-scope badges, lock icons).

## Overview

Skills and agents can exist at two scopes: `"project"` and `"global"`. This affects where files are installed, how config is split, and how the wizard enforces editing constraints.

## File Paths by Scope

| Scope     | Skills Path                    | Agents Path                    | Config Path                          |
| --------- | ------------------------------ | ------------------------------ | ------------------------------------ |
| `project` | `{projectDir}/.claude/skills/` | `{projectDir}/.claude/agents/` | `{projectDir}/.claude-src/config.ts` |
| `global`  | `~/.claude/skills/`            | `~/.claude/agents/`            | `~/.claude-src/config.ts`            |

## Path Resolution

**Function:** `resolveInstallPaths(projectDir, scope)` in `src/cli/lib/installation/local-installer.ts`

Returns the correct base directory: `os.homedir()` for `"global"`, `projectDir` for `"project"`.

## Type Definitions

**`SkillConfig`** (`src/cli/types/config.ts`):

```typescript
type SkillConfig = {
  id: SkillId;
  scope: "project" | "global";
  source: string; // "eject" | marketplace name
  excluded?: boolean;
};
```

**`AgentScopeConfig`** (`src/cli/types/config.ts`):

```typescript
type AgentScopeConfig = {
  name: AgentName;
  scope: "project" | "global";
  excluded?: boolean;
};
```

## Config Splitting

**Function:** `splitConfigByScope()` in `src/cli/lib/configuration/config-generator.ts`

Splits a `ProjectConfig` into global and project partitions by skill/agent scope. Returns `SplitConfigResult` (`{ global: ProjectConfig; project: ProjectConfig }`).

**Writer:** `writeScopedConfigs()` in `src/cli/lib/installation/local-installer.ts`

Writes:

1. Global config to `~/.claude-src/config.ts` (standalone)
2. Project config to `{projectDir}/.claude-src/config.ts` (self-contained snapshot via `generateProjectConfigWithInlinedGlobal()` -- both global and project entries inlined, no import/spread)
3. Config-types files: both global and project get standalone types (self-contained)

When installing from the home directory (not a project), a single standalone config is written.

## Config Writer Scope Handling

`generateConfigSource()` in `src/cli/lib/configuration/config-writer.ts`:

- When `isProjectConfig: true` with `globalConfig` provided (the standard path used by `writeScopedConfigs`): generates a self-contained config snapshot via `generateProjectConfigWithInlinedGlobal()`. Both global and project entries for the same skill ID are preserved (no deduplication). Global entries appear under a `// global` comment, project entries under `// project`. Excluded global entries (tombstones) replace their active global counterparts.
- When `isProjectConfig: true` without `globalConfig` (fallback path): generates a config that imports from the global config and spreads global arrays into skills, agents, and domains.

## Wizard Scope Guards

### Global-Item Guard Pattern

Guards prevent project-scope edits from modifying globally-installed skills/agents.

**Guard check:** If a skill/agent is found in `installedSkillConfigs`/`installedAgentConfigs` with `scope === "global"` and `!excluded`, and the wizard is NOT in global-scope edit mode (`isEditingFromGlobalScope === false`) and NOT in init mode (`isInitMode === false`), the action returns a toast message instead of modifying state.

**Key state fields:**

- `isEditingFromGlobalScope` (boolean) -- When true, scope toggling (S key) is disabled entirely
- `isInitMode` (boolean, default `false`) -- Distinguishes init wizard (first-time setup, no restrictions) from edit wizard (existing installation, global items locked)

**Actions with guards:**

| Action                       | Guard Behavior                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `toggleTechnology()`         | Toast if skill is installed globally. Also toasts if exclusive swap would deselect a globally-installed skill.           |
| `toggleSkillScope()`         | No-op if `isEditingFromGlobalScope`. Toast if project eject to global and global eject already installed (no tombstone). |
| `toggleAgent()`              | Toast if agent is installed globally (not in global edit or init mode).                                                  |
| `toggleAgentScope()`         | No-op if `isEditingFromGlobalScope`.                                                                                     |
| `toggleFilterIncompatible()` | Skips skills with `excluded` flag when finding incompatible web skills (protects tombstoned globals).                    |

> **Detailed documentation:** See [concepts/guard-pattern.md](./guard-pattern.md) for the full unified guard reference.

### Scope Toggle Eject Guard (D-199)

`toggleSkillScope` in `wizard-store.ts` blocks project-eject to global-eject promotion when a non-excluded global eject entry already exists in `installedSkillConfigs`. However, if the current `skillConfigs` already contains an excluded tombstone for that skill ID, the guard allows the toggle (undo path).

> **Detailed documentation:** See [concepts/tombstone-pattern.md](./tombstone-pattern.md) for full tombstone lifecycle.

## Scope Store Actions

| Action               | Signature                        | Effect                                                                                         |
| -------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `toggleSkillScope()` | `(skillId: SkillId) => void`     | Toggles `scope` between `"project"` and `"global"`. Tombstone management on scope transitions. |
| `toggleAgentScope()` | `(agentName: AgentName) => void` | Toggles `scope` between `"project"` and `"global"`. Tombstone management on scope transitions. |

**Tombstone management on scope toggle:**

- Moving global-installed skill/agent to project: adds excluded global entry (tombstone)
- Moving back to global: removes the excluded entry

## UI Scope Indicators

### Dual-Scope Badges (D-183)

Both the build step (CategoryGrid) and agent step (StepAgents) show dual-scope badges when a scope toggle creates a tombstone:

- **CategoryGrid** (`category-grid.tsx`): `CategoryOption.secondaryScope` renders a second `[G]`/`[P]` badge next to the primary scope badge.
- **StepAgents** (`step-agents.tsx`): Computes `secondaryScope` by checking for an excluded entry in `agentConfigs` with a different scope than the active entry. Renders `[G]`/`[P]` badge after the primary scope badge.

### Lock Icon for Globally Installed Skills (D-189)

In the build step, `SkillTag` in `category-grid.tsx` appends `UI_SYMBOLS.LOCK` after the display name when `option.installed && option.scope === "global"`. This visually marks skills that cannot be toggled from project scope.

### Scope Labels in Change Summary

`logChangeSummary()` in `edit.tsx` uses `[G]`/`[P]` scope labels. Global-to-project scope changes render as green `+` additions.

### SkillAgentSummary Scope Display

`skill-agent-summary.tsx` renders `ScopeLabel` components (white-on-LABEL_BG badges showing "Project" or "Global") next to each skill and agent in the confirm step and info panel.

## Installation Scope Splitting

During installation, skills and agents are split by scope before path-dependent operations:

1. `splitConfigByScope()` partitions the merged config
2. `writeScopedConfigs()` writes global and project configs separately
3. Plugin install/uninstall operations split by scope (`filter(s => s.scope === "global")` / `filter(s => s.scope !== "global")`)
4. Local skill copy operations split by scope via `resolveInstallPaths()`
