# Scope Toggle Bug Investigation — 2026-04-08/09

## Summary

A series of interconnected bugs around skill and agent scope toggling (Global <-> Project) in the edit wizard. Multiple regressions discovered during fixes.

---

## Bug 1: D-193 — Excluded global skill shows as selected in edit mode

**Status**: Fixed
**File**: `src/cli/commands/edit.tsx:188-198`

**Root Cause**: `configSkillIds` mapped ALL skill configs including `excluded: true` ones into `currentSkillIds`. These flowed into `populateFromSkillIds` -> `domainSelections`, making excluded skills appear selected. Worse: the excluded tombstone was silently lost on a no-op edit.

**Fix**: Filter excluded skill IDs from `currentSkillIds`. Only apply the exclusion filter to `pluginSkillIds` (discovered on disk), not `configSkillIds` (explicitly active in config). This preserves dual-entry skills (tombstone + active project entry).

**Related locations found but NOT fixed**:

- `init.tsx:269` — `globalConfig?.skills?.map((s) => s.id)` doesn't filter excluded (low priority, global configs rarely have excluded entries)
- `skill-agent-summary.tsx:60-67` — `inheritedGlobalSkills` filter doesn't check `!s.excluded`, tombstone entries incorrectly appear as "inherited"

---

## Bug 2: D-192 — Scope toggle G->P then deselect removes skill from global

**Status**: Fixed
**File**: `src/cli/commands/edit.tsx:609-623`

**Root Cause**: `detectConfigChanges` diffed against `currentSkillIds` (all discovered + config skills) instead of `oldConfig.skills`. Globally-discovered skills not in the wizard result appeared as "removals", triggering `uninstallPluginSkills` with `scope: "user"` — removing from global installation.

**Fix**: Changed to diff against `oldConfig.skills` (matching how agents already diffed against `oldConfig.agents`). Removed `currentSkillIds` parameter from `detectConfigChanges`.

---

## Bug 3: Exclusive category bypasses global skill guard

**Status**: Fixed
**File**: `src/cli/stores/wizard-store.ts:842-853`

**Root Cause**: In exclusive categories, selecting a DIFFERENT skill replaces the current selection. If the current selection was a globally-installed skill, this indirectly deselected it — bypassing the direct global guard.

**Fix**: Added guard in exclusive mode: when selecting a new skill, check if any currently-selected skill in the category is globally installed. If so, block with toast.

---

## Bug 4: Unique-skill-in-category guard missing

**Status**: Fixed
**File**: `src/cli/stores/wizard-store.ts:833-840`

**Root Cause**: Guard was never implemented as standalone — was incidentally protected by old `lockedSkillIds`/`getDependentSkills` mechanisms that were removed.

**Fix**: Added guard: if category has only 1 skill in the matrix, block deselection with toast "Cannot deselect the only skill in this category".

---

## Bug 5: Agent scope map poisoning — G->P toggle deletes agent from both scopes

**Status**: Fixed
**File**: `src/cli/commands/edit.tsx:512-514`

**Root Cause**: `agentScopeMap` was built from unfiltered `result.agentConfigs`. When an agent is toggled G->P, the wizard store adds an excluded tombstone `{ name, scope: "global", excluded: true }`. Since `new Map()` last-entry-wins, the tombstone's `"global"` scope overwrote the active `"project"` entry. Agent compiled to wrong directory (global), then `cleanupStaleAgentFiles` deleted it from global. Agent missing everywhere.

**Fix**: Added `.filter((a) => !a.excluded)` to scope map construction, matching `buildAgentScopeMap` in `local-installer.ts`.

---

## Bug 6: Dual-entry excluded skill not shown as selected (D-193 regression)

**Status**: Fixed
**File**: `src/cli/commands/edit.tsx:196-197`

**Root Cause**: The D-193 fix filtered `excludedConfigIds` against the ENTIRE merged set (both `pluginSkillIds` and `configSkillIds`). When a skill had both an excluded tombstone AND an active project entry, the active entry was wrongly filtered out because it shared the same skill ID as the tombstone.

**Fix**: Only filter `pluginSkillIds` against `excludedConfigIds`, not `configSkillIds`. If a skill has an active non-excluded config entry, it's always in `currentSkillIds`.

---

## Bug 7: Agent scope toggle corrupts global config — swap behavior on repeat

**Status**: ROOT CAUSE CONFIRMED — Ready for implementation

**Symptoms**:

1. Session 1: Toggle agent A from G->P — A added to project, A DELETED from global config + folder
2. Session 2: Toggle agent B from G->P — B deleted from global, BUT A REAPPEARS in global config + folder

**Root Cause (confirmed by 8 independent agent investigations)**:

`mergeGlobalConfigs` in `local-installer.ts:371-422` is additive-only by design ("Never removes existing items"). The operation sequence during an edit is:

1. `splitConfigByScope(finalConfig)` correctly puts the G→P agent in the PROJECT partition
2. `mergeGlobalConfigs(existingGlobal, newGlobalSplit)` receives a global split WITHOUT the moved agent
3. But it starts from `[...existing.agents, ...newAgents]` — the old agent stays
4. Global config is written with the stale entry
5. `cleanupStaleAgentFiles` deletes the compiled .md file but NOT the config entry
6. Next compile/load recreates the agent from the stale config entry

**Fix Location**: `writeScopedConfigs` in `local-installer.ts`, after line 630 (after `effectiveGlobalConfig` is determined), before line 637 (before writing to disk). Prune agents/skills from `effectiveGlobalConfig` that appear in the project partition (`projectSplitConfig`) as non-excluded, project-scoped entries.

**What must NOT change**: `mergeGlobalConfigs` itself stays additive-only (correct for init flow). The pruning happens in the caller.

**Applies to both skills and agents** (same mechanism).

---

## Bug 8: No toast when toggling pre-installed global agent from project scope

**Status**: TODO (D-196)

The toggle is correctly disabled but no toast message is shown to explain why.

---

## Bug 9: Change summary display issues

**Status**: TODO (D-197)

- Shows slugs instead of display names
- Doesn't show scope (global/project) on each line
- G->P scope changes shown as `~` (tilde) instead of `+` (addition to project)

---

## Failing E2E Tests (5 total)

| #   | Test File                         | Test Name                                                                    | Status              |
| --- | --------------------------------- | ---------------------------------------------------------------------------- | ------------------- |
| 1   | `scope-change-deselect-integrity` | "deselecting a project-scoped skill should not remove it from global config" | Under investigation |
| 2   | `init-wizard-default-source`      | "init wizard — stale marketplace update"                                     | Under investigation |
| 3   | `init-wizard-plugin`              | "init wizard — plugin mode"                                                  | Under investigation |
| 4   | `dual-scope-edit-mixed-sources`   | "dual-scope edit lifecycle -- mixed source coexistence"                      | Under investigation |
| 5   | `dual-scope-edit-source-changes`  | "dual-scope edit lifecycle -- source changes via Sources step"               | Under investigation |

---

## Files Changed Today

| File                                                         | Changes                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `src/cli/commands/edit.tsx`                                  | D-193 excluded filter, D-192 detectConfigChanges fix, agent scope map fix |
| `src/cli/stores/wizard-store.ts`                             | Unique skill guard, exclusive category global guard                       |
| `src/cli/stores/wizard-store.test.ts`                        | Unit tests for both guards                                                |
| `src/cli/lib/configuration/__tests__/default-stacks.test.ts` | Updated stack count 16->17                                                |
| `e2e/interactive/edit-wizard-excluded-skills.e2e.test.ts`    | NEW: 5 tests for excluded skills                                          |
| `e2e/interactive/edit-wizard-unique-skill-guard.e2e.test.ts` | NEW: 2 tests for unique skill guard                                       |
| `e2e/lifecycle/scope-change-deselect-integrity.e2e.test.ts`  | NEW: 3 tests for scope deselect                                           |
| `e2e/lifecycle/global-skill-toggle-guard.e2e.test.ts`        | Added exclusive category bypass test                                      |
| `e2e/lifecycle/dual-scope-edit-scope-changes.e2e.test.ts`    | Added G->P agent toggle test                                              |
| `todo/TODO.md`                                               | Added D-196, D-197                                                        |

---

## Key Code Paths Involved

| Code Path                  | File                         | Purpose                                                     |
| -------------------------- | ---------------------------- | ----------------------------------------------------------- |
| `loadContext()`            | `edit.tsx:175-210`           | Builds `currentSkillIds` for wizard preselection            |
| `detectConfigChanges()`    | `edit.tsx:609-645`           | Diffs old vs new config to find added/removed/changed items |
| `writeConfigAndCompile()`  | `edit.tsx:480-555`           | Writes configs, compiles agents, installs plugins           |
| `cleanupStaleAgentFiles()` | `edit.tsx:577-592`           | Deletes agent files from old scope after scope change       |
| `logChangeSummary()`       | `edit.tsx:266-321`           | Renders the changes display                                 |
| `mergeGlobalConfigs()`     | `local-installer.ts:371-422` | Additive merge of global config entries                     |
| `toggleTechnology()`       | `wizard-store.ts:821-870`    | Handles skill toggle with guards                            |
| `toggleAgentScope()`       | `wizard-store.ts:1095-1115`  | Handles agent scope toggle, creates tombstones              |
| `populateFromSkillIds()`   | `wizard-store.ts:735-778`    | Populates wizard state from installed skill IDs             |
| `buildAgentScopeMap()`     | `local-installer.ts:359-365` | Builds scope map (filters excluded)                         |
| `agentScopeMap` inline     | `edit.tsx:512-514`           | Inline scope map (now filters excluded)                     |
| `writeScopedConfigs()`     | `write-project-config.ts`    | Splits and writes config by scope                           |
