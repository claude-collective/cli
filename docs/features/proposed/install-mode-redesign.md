# Install Mode UX Redesign

Replace the hidden `P` hotkey toggle by extending the existing sources step to include "local" as a source option alongside marketplace sources. Install mode emerges naturally from source selection rather than being a separate concept.

**Status:** Draft
**Date:** 2026-02-21
**Related:** D-37 in TODO.md

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [New Design: Install Mode as Source Selection](#new-design-install-mode-as-source-selection)
3. [Init Flow](#init-flow)
4. [Edit Flow: Mode Switching with Migration](#edit-flow-mode-switching-with-migration)
5. [Existing Infrastructure](#existing-infrastructure)
6. [Current Code Gaps](#current-code-gaps)
7. [Implementation Phases](#implementation-phases)
8. [Open Questions](#open-questions)

---

## Problem Statement

`installMode` is currently a global toggle accessed via a hidden `P` hotkey in the wizard. This has three problems:

### 1. The toggle is invisible

The `P` hotkey is only discoverable via the help modal (`?`). A critical infrastructure decision -- whether skills are installed as native plugins or as editable local copies -- is hidden behind a single-letter shortcut with no onscreen indicator beyond a small status pill.

**Relevant code:**

<!-- CORRECTED: line numbers verified against actual source -->
- `wizard.tsx:151-153` -- handles `P` keypress, calls `store.toggleInstallMode()`
- `wizard-layout.tsx:128-132` -- renders a `P` indicator via `DefinitionItem` showing current state
- `help-modal.tsx:26` -- lists `P` in the `GLOBAL_TOGGLES` section

### 2. Edit mode ignores the toggle entirely

When the user changes `installMode` during `edit`, the wizard result's `installMode` field is populated but never acted upon. The `edit.tsx` command:

- Never calls `setConfigMetadata()` -- so `config.yaml` is not updated with the new mode
- Never calls `installLocal()` or `installPluginConfig()` -- so no installation artifacts change
- Calls `recompileAgents()` which reads `installMode` from the old config (`projectConfig?.installMode` at `agent-recompiler.ts:208`), not from the wizard result

The user toggles to "plugin", confirms, the wizard completes, and nothing happens. Config still says "local", local skill copies persist, no plugin installation occurs.

<!-- ADDED: broader gap discovered during audit -->
> **Audit note:** This is actually part of a broader gap: `edit.tsx` never writes to `config.yaml` at all. It reads config at line 93 via `loadProjectConfig()` but never persists any changes back -- not installMode, not expertMode, not domains, not selectedAgents, not the updated skills list. The only mutations `edit.tsx` performs are plugin install/uninstall, skill archive/restore, and agent recompilation. This means running `agentsinc edit` to add skills and then running it again will show the old skill set from config, not the new one. The only reason the edit flow partially works is that `recompileAgents()` re-discovers skills from the filesystem rather than from config.

### 3. No migration path between modes

Even if the toggle were wired up correctly, there is no migration logic. Switching from local to plugin should:

- Archive or remove `.claude/skills/` copies
- Install plugin references via `claude plugin install`
- Update `config.yaml`

Switching from plugin to local should:

- Copy skills to `.claude/skills/`
- Uninstall plugin references via `claude plugin uninstall`
- Update `config.yaml`

None of this exists.

---

## New Design: Install Mode as Source Selection

Remove the `P` hotkey toggle entirely. Instead of adding a separate install mode screen or toggle, **extend the existing sources step** so that "local" appears as a source option for every skill alongside the marketplace sources (Agents Inc, private scoped sources, third-party sources).

The install mode is NOT a separate concept -- it emerges from which source the user selects for each skill:

- Selecting a marketplace source (e.g., "Agents Inc", "Acme Corp") = plugin install for that skill
- Selecting "Local" = local install (editable copy in `.claude/skills/`) for that skill

This means:

- **No separate mode toggle or screen** -- source selection already exists, we just add "Local" to the options
- **Per-skill granularity by default** -- each skill can independently be local or plugin
- **Bulk actions via hotkeys** -- `L` sets all skills to local, `P` sets all to their default marketplace source
- **The `installMode` config value is derived** from the aggregate of per-skill source selections: all marketplace = `"plugin"`, all local = `"local"`, mixed = `"custom"`

### How Sources Are Rendered (Existing Pattern)

The existing `SourceGrid` component (`source-grid.tsx`) renders each skill as a row with bordered tags for each available source. Each tag is a `<Box borderStyle="single">` with the source label. The focused tag gets a highlighted border, and the selected tag gets the primary color. Source sort order per skill (from `getSourceSortTier()`):

1. **Local** (tier 1) -- editable copy in `.claude/skills/`
2. **Scoped private marketplace** (tier 2) -- e.g., "Acme Corp" (organization-scoped)
3. **Public marketplace** (tier 3) -- "Agents Inc" (default public)
4. **Third-party sources** (tier 4) -- extra configured sources

Installed sources get a checkmark prefix (e.g., "`V Agents Inc`"). The "local" source displays as "Local".

### UI Mockups

The mockups below match the actual `SourceGrid` rendering: each skill is a row, each source is a bordered tag. `[selected]` indicates the tag has the primary color and bold text. Navigation is arrow keys (up/down between skills, left/right between sources), SPACE to select.

**1. Default view -- all skills using marketplace sources (plugin mode):**

When the user first arrives at the sources step, each skill defaults to its primary marketplace source. "Local" is available but not selected.

```
Customize skill sources

react
 +--------+  +-----------+  +-------+
 | Local  |  | Acme Corp |  | >[AI] |
 +--------+  +-----------+  +-------+

zustand
 +--------+  +-----------+  +-------------+
 | Local  |  | Acme Corp |  | [Agents Inc] |
 +--------+  +-----------+  +-------------+

hono
 +--------+  +-------------+
 | Local  |  | [Agents Inc] |
 +--------+  +-------------+

vitest
 +--------+  +-------------+
 | Local  |  | [Agents Inc] |
 +--------+  +-------------+

L set all local  P set all plugin  ENTER continue  ESC back
```

`[Agents Inc]` = selected (primary color, bold). `>[AI]` = selected AND focused (highlighted border). Unselected tags are dim with neutral border.

In the actual Ink rendering, each tag is a `<Box borderStyle="single">` with `<Text>` inside. The `[...]` notation in these mockups represents the selected state (primary color border and bold text). The `>` prefix represents the cursor/focus highlight.

**2. After selecting "Local" for one skill:**

The user navigates to `react`'s "Local" tag and presses SPACE. That skill switches to local install while all others remain on marketplace sources.

```
Customize skill sources

react
 +---------+  +-----------+  +-------------+
 | [Local] |  | Acme Corp |  | Agents Inc  |
 +---------+  +-----------+  +-------------+

zustand
 +--------+  +-----------+  +-------------+
 | Local  |  | Acme Corp |  | [Agents Inc] |
 +--------+  +-----------+  +-------------+

hono
 +--------+  +-------------+
 | Local  |  | [Agents Inc] |
 +--------+  +-------------+

vitest
 +--------+  +-------------+
 | Local  |  | [Agents Inc] |
 +--------+  +-------------+

L set all local  P set all plugin  ENTER continue  ESC back
```

`[Local]` is now selected for react (primary color). Agents Inc for react is unselected (dim). All other skills unchanged.

**3. After pressing `L` -- all skills set to local:**

The `L` hotkey bulk-switches every skill to its "Local" source option.

```
Customize skill sources

react
 +---------+  +-----------+  +-------------+
 | [Local] |  | Acme Corp |  | Agents Inc  |
 +---------+  +-----------+  +-------------+

zustand
 +---------+  +-----------+  +-------------+
 | [Local] |  | Acme Corp |  | Agents Inc  |
 +---------+  +-----------+  +-------------+

hono
 +---------+  +-------------+
 | [Local] |  | Agents Inc  |
 +---------+  +-------------+

vitest
 +---------+  +-------------+
 | [Local] |  | Agents Inc  |
 +---------+  +-------------+

L set all local  P set all plugin  ENTER continue  ESC back
```

**4. Edit mode -- switching a skill from plugin to local (confirmation):**

When editing an existing project and the user changes a skill from a marketplace source to "Local", a confirmation is shown after pressing ENTER to continue from the sources step.

```
! Switching react from Agents Inc to local will:
  - Copy skill files to .claude/skills/react/
  - Remove the plugin reference

Continue? (y/n)
```

**5. Edit mode -- bulk switch to local (after pressing `L`):**

When the user presses `L` to switch all skills to local, the confirmation summarizes the full change.

```
! Setting all skills to local will:
  - Copy 4 skill files to .claude/skills/
  - Remove all plugin references

Local copies will be preserved in .claude/skills/_archived/
Continue? (y/n)
```

**6. Choice view -- before entering customize (existing pattern from step-sources.tsx):**

Before the grid, the user sees the two-card choice view (matching the existing `SelectionCard` pattern from `step-sources.tsx`).

```
Your stack includes 12 technologies.

 +--------------------------------------------------+
 | > Use all recommended skills (verified)           |
 |                                                   |
 |   This is the fastest option. All skills are      |
 |   verified and maintained by Agents Inc           |
 +--------------------------------------------------+

 +--------------------------------------------------+
 |   Customize skill sources                         |
 |                                                   |
 |   Choose alternative skills for each technology   |
 +--------------------------------------------------+
```

Selecting "Customize skill sources" enters the grid view shown in mockups 1-3 above.

### Why This Is Better

- **No new concepts** -- "local" is just another source, not a separate mode. Users already understand source selection.
- **Per-skill granularity by default** -- no need for a special "customize" option; every skill already has its own source selection.
- **Discoverable** -- "Local" is visible in the source list for every skill, no hidden hotkeys.
- **Bulk actions are accelerators, not primary UX** -- `L` and `P` hotkeys are shortcuts for power users, not the only way to change install behavior.
- **Migration consequences communicated upfront** -- edit flow shows what will change before executing.
- **Reuses existing UI** -- the `SourceGrid` component already renders per-skill source options with the exact layout needed. The only addition is ensuring "Local" always appears as a source option.

<!-- ADDED: constraint from current init.tsx flow -->
> **Implementation note:** The current `init.tsx` init flow (lines 203-215) already branches on `installMode` to decide between `installIndividualPlugins()` and `installLocalMode()`. Plugin mode has an additional constraint: it requires a marketplace (`sourceResult.marketplace`) for individual skill installation. When no marketplace is available, init falls back to local mode automatically (lines 206-211). When deriving the install mode from source selections, the same constraint applies: skills selected with marketplace sources require a marketplace to be configured.

### How `installMode` Is Derived

After the user confirms, the wizard result's `installMode` is derived from the aggregate source selections:

| All skills selected source | Derived `installMode` | Config behavior |
| --- | --- | --- |
| All marketplace (any combination of public/private/third-party) | `"plugin"` | All skills installed as plugins |
| All "Local" | `"local"` | All skills copied to `.claude/skills/` |
| Mix of marketplace and "Local" | `"custom"` | Per-skill `sourceSelections` persisted to config |

For `"custom"` mode, the config stores which skills are local:

```yaml
installMode: custom
skillOverrides:
  web-framework-react: local
  web-styling-tailwind: local
  # All others default to plugin
```

---

## Init Flow

During init, the user encounters the sources step. By default, all skills use their recommended marketplace source (plugin mode). If the user selects "Customize skill sources", they see the source grid where "Local" is available for every skill.

### Default (No Customization) -- Plugin Mode

If the user picks "Use all recommended skills (verified)" on the choice view, all skills are installed as plugins. No source grid is shown.

```
Ready to install your custom stack (Web + API)

  Technologies: 12
  Skills:       24 (all verified)
  Agents:       4
  Install mode: Plugin

  ENTER install  ESC go back
```

After confirm:

<!-- CORRECTED: more accurate description of actual flow in init.tsx -->
1. Derives `installMode: "plugin"` from source selections (all marketplace)
2. Checks if `sourceResult.marketplace` exists (required for plugin mode individual skills)
3. If no marketplace, falls back to local mode with a warning (existing behavior at `init.tsx:206-211`)
4. Registers marketplace via `claudePluginMarketplaceAdd()` if not already registered
5. Installs each skill as a plugin via `claudePluginInstall()` (per-skill loop at `init.tsx:242-252`)
6. Calls `installPluginConfig()` which internally calls `setConfigMetadata()` to write `config.yaml` with `installMode: "plugin"`, then compiles agents

### All Local (via `L` hotkey in source grid)

If the user enters the source grid and presses `L` to set all skills to "Local":

```
Ready to install your custom stack (Web + API)

  Technologies: 12
  Skills:       24 (all verified)
  Agents:       4
  Install mode: Local (editable copies)

  ENTER install  ESC go back
```

After confirm:

1. Derives `installMode: "local"` from source selections (all local)
2. Calls `installLocal()` (existing function in `local-installer.ts:511`)
3. Copies skills to `.claude/skills/` via `copySkillsToLocalFlattened()`
4. Writes `config.yaml` with `installMode: "local"` (via internal `setConfigMetadata()`)
5. Compiles agents

### Mixed (Per-Skill Source Selection)

If the user selects "Local" for some skills and marketplace sources for others:

```
Ready to install your custom stack (Web + API)

  Technologies: 12
  Skills:       24 (22 plugin, 2 local)
  Agents:       4
  Install mode: Custom (2 local, 22 plugin)

  ENTER install  ESC go back
```

After confirm:

1. Derives `installMode: "custom"` from source selections (mixed local and marketplace)
2. Splits selected skills into two groups based on source selections
3. Installs plugin-mode skills via `claudePluginInstall()` for each
4. Copies local-mode skills via `copySkillsToLocalFlattened()`
5. Writes `config.yaml` with `installMode: "custom"` and `skillOverrides` map
6. Compiles agents (which need per-skill install mode for skill references in agent markdown)

---

## Edit Flow: Mode Switching with Migration

When the user runs `agentsinc edit`, the sources step shows the current source selections pre-populated. If the user changes any skill's source between marketplace and "Local" (or vice versa), the edit command must perform migration after the wizard completes.

The edit flow detects what changed by comparing the new source selections against the current installation state. Migration is per-skill, not per-mode -- each skill that changed between local and marketplace is migrated independently.

### Per-Skill: Marketplace to Local

When the user changes one or more skills from a marketplace source to "Local" in the source grid, confirmation is shown after ENTER:

```
! Switching to local for 1 skill:
  - react (was: Agents Inc)

This will:
  - Copy skill files to .claude/skills/
  - Remove the plugin reference for react

Continue? (y/n)
```

If confirmed:

1. Copy the skill to `.claude/skills/` using `copySkillsToLocalFlattened()` (existing function in `skill-copier.ts:206`)
2. Uninstall the plugin reference via `claudePluginUninstall()` for that skill
3. Update `sourceSelections` and derived `installMode` in `config.yaml`
4. Recompile agents with the new per-skill install modes

<!-- ADDED: complication about copySkillsToLocalFlattened requiring SourceLoadResult -->
> **Complication:** `copySkillsToLocalFlattened()` requires a `SourceLoadResult` parameter (specifically `sourceResult.sourcePath` and `sourceResult.matrix`) to locate the source skill files. During edit, `sourceResult` is available from the earlier `loadSkillsMatrixFromSource()` call at `edit.tsx:79-84`, so this is feasible. However, the function also needs the `matrix.skills[skillId]` entry for each skill, which includes `skill.path` -- if a skill was installed as a plugin and no longer exists in the matrix source, the copy will fail with a "skill not found" warning.

### Per-Skill: Local to Marketplace

When the user changes one or more skills from "Local" to a marketplace source:

```
! Switching to plugin for 2 skills:
  - react (to: Acme Corp)
  - zustand (to: Agents Inc)

This will:
  - Archive local copies to .claude/skills/_archived/
  - Install skills as plugins

Continue? (y/n)
```

If confirmed:

1. Archive each local skill using `archiveLocalSkill()` (per-skill, existing function in `source-switcher.ts`)
2. Install plugin references via `claudePluginInstall()` for each skill
3. Update `sourceSelections` and derived `installMode` in `config.yaml`
4. Recompile agents with the new per-skill install modes

<!-- ADDED: complication about marketplace requirement -->
> **Complication:** Plugin mode requires `sourceResult.marketplace` for individual skill installation. During edit, the source is reloaded at `edit.tsx:79-84`, but if the original init was done in local mode without a marketplace, switching to plugin mode may not be possible. The migration logic must check for marketplace availability and fail gracefully if absent.

### Bulk: All Local (via `L` hotkey)

When the user presses `L` in the source grid to set all skills to "Local", confirmation summarizes the full change:

```
! Setting all skills to local will:
  - Copy 4 skill files to .claude/skills/
  - Remove all plugin references

Local copies will be preserved in .claude/skills/_archived/
Continue? (y/n)
```

### Bulk: All Plugin (via `P` hotkey)

When the user presses `P` to set all skills to their default marketplace source:

```
! Setting all skills to plugin will:
  - Archive 4 local skill copies to .claude/skills/_archived/
  - Install all skills as plugins

Continue? (y/n)
```

### No Source Changes

If the user keeps the same source selections, no migration is needed. The edit flow proceeds normally (add/remove skills, other changes).

---

## Existing Infrastructure

### Functions to Reuse

| Function | File | Exported? | Purpose |
| --- | --- | --- | --- |
| `archiveLocalSkill()` | `lib/skills/source-switcher.ts` | Yes (via `lib/skills/index.ts`) | Archive a single local skill to `_archived/` |
| `restoreArchivedSkill()` | `lib/skills/source-switcher.ts` | Yes (via `lib/skills/index.ts`) | Restore a single archived skill |
| `hasArchivedSkill()` | `lib/skills/source-switcher.ts` | Yes (via `lib/skills/index.ts`) | Check if archived version exists |
| `installLocal()` | `lib/installation/local-installer.ts` | Yes (via `lib/installation/index.ts`) | Full local installation pipeline |
| `installPluginConfig()` | `lib/installation/local-installer.ts` | Yes (via `lib/installation/index.ts`) | Plugin config installation (no skill copying) |
| `setConfigMetadata()` | `lib/installation/local-installer.ts` | **No -- module-private** | Persist wizard result to config.yaml |
| `writeConfigFile()` | `lib/installation/local-installer.ts` | **No -- module-private** | Write config YAML to disk |
| `buildAndMergeConfig()` | `lib/installation/local-installer.ts` | **No -- module-private** | Build config from wizard result and merge with existing |
| `copySkillsToLocalFlattened()` | `lib/skills/skill-copier.ts` | Yes (via `lib/skills/index.ts`) | Copy skills from source to `.claude/skills/` |
| `recompileAgents()` | `lib/agents/agent-recompiler.ts` | Yes (via `lib/agents/index.ts`) | Recompile agent markdown from config |
| `claudePluginInstall()` | `utils/exec.ts` | Yes | Run `claude plugin install` |
| `claudePluginUninstall()` | `utils/exec.ts` | Yes | Run `claude plugin uninstall` |
| `loadProjectConfig()` | `lib/configuration/index.ts` | Yes | Load config from disk |
| `mergeWithExistingConfig()` | `lib/configuration/index.ts` | Yes | Merge new config with existing on disk |

<!-- ADDED: "Exported?" column and three additional functions that are relevant but were missing -->

### UI Components to Reuse

| Component | File | Purpose |
| --- | --- | --- |
| `SourceGrid` | `components/wizard/source-grid.tsx` | Per-skill source selection grid |
| `StepSources` | `components/wizard/step-sources.tsx` | Source selection step wrapper |
| `StepConfirm` | `components/wizard/step-confirm.tsx` | Confirm step (where install choice will live) |
| `SelectionCard` | `components/wizard/selection-card.tsx` | Radio-style card used in StepSources choice view |

<!-- ADDED: SelectionCard is used in step-sources.tsx for the choice/customize toggle and would be useful for the install mode selector -->

### Store State

<!-- CORRECTED: line numbers verified -->
| Field | File | Purpose |
| --- | --- | --- |
| `installMode` | `stores/wizard-store.ts:164` | Current mode: `"plugin" \| "local"` |
| `toggleInstallMode()` | `stores/wizard-store.ts:567-569` | Toggle between plugin and local |
| `WizardResultV2.installMode` | `components/wizard/wizard.tsx:35` | Wizard result carries mode as `"plugin" \| "local"` |

---

## Current Code Gaps

### 1. `edit.tsx` never persists ANY config changes

<!-- CORRECTED: broadened from installMode-only to full config persistence gap -->
`edit.tsx` (lines 144-285) processes skill additions, removals, and source changes, but never writes to `config.yaml` at all. This is a broader gap than just `installMode`:

- **installMode** -- wizard result's `installMode` field is completely ignored
- **skills** -- added/removed skills are not persisted to config's `skills` array
- **domains** -- domain selection changes are not persisted
- **selectedAgents** -- agent selection changes are not persisted
- **expertMode** -- expert mode toggle is not persisted
- **sourceSelections** -- source changes are not persisted to config

The wizard result's `installMode` field is set during `init` (via `setConfigMetadata()` in `local-installer.ts:257-263`) but never during `edit`.

> **Impact:** Running `agentsinc edit` to add skills, then running it again, will show the original skill set from config rather than the updated one. The edit flow only "works" because `recompileAgents()` at `agent-recompiler.ts:184-186` discovers skills from the filesystem via `discoverAllPluginSkills()` rather than reading them from config. But for installMode, domains, agents, and expertMode, no such filesystem fallback exists.

### 2. `recompileAgents()` reads from old config, not wizard result

In `agent-recompiler.ts:208`, the `installMode` passed to `compileAndWriteAgents()` comes from `projectConfig?.installMode` -- the config loaded from disk at `agent-recompiler.ts:152-153`. During edit, the wizard result may have a different `installMode`, but it's never propagated to the recompilation step.

<!-- ADDED: specific detail about how installMode flows through recompilation -->
> **Detail:** The flow is: `recompileAgents()` calls `loadProjectConfig()` at line 152, extracts `projectConfig?.installMode` at line 208, passes it to `compileAndWriteAgents()` which passes it to `compileAgentForPlugin()` at line 129. The `compileAgentForPlugin()` function (in `lib/stacks/index.ts`) uses `installMode` to decide how to render skill references in agent markdown -- as plugin refs or local file paths.

### 3. No bulk archive/restore

`archiveLocalSkill()` and `restoreArchivedSkill()` work on a single skill. Mode migration needs to archive/restore all installed skills. A bulk wrapper is needed, though it's trivial -- just loop over skill IDs.

### 4. No confirmation dialog for destructive mode switches

The edit flow has no concept of "this change is destructive and needs user confirmation." Currently it just shows a diff (added/removed skills) and proceeds. Mode switching needs an interstitial confirmation because it modifies the filesystem in ways the user might not expect.

<!-- ADDED: implementation consideration -->
> **Note:** The edit flow is an oclif command, not an Ink interactive wizard. Confirmation prompts would need to use oclif's `this.confirm()` or a standalone prompt library (e.g., `@clack/prompts`), not Ink components, since the wizard has already exited by the time migration needs to happen.

### 5. No `installMode: "custom"` support

The `ProjectConfig` type (at `types/config.ts:58`) defines `installMode` as `"local" | "plugin"`. The Zod schema (at `lib/schemas.ts:396`) also validates against `z.enum(["local", "plugin"])`. The wizard store (at `stores/wizard-store.ts:164`) types it as `"plugin" | "local"`. The "customize" option requires adding `"custom"` to all three locations and adding a `skillOverrides` field.

<!-- CORRECTED: added the Zod schema and wizard store as additional locations that need updating -->

### 6. `StepConfirm` only displays mode as static label

`step-confirm.tsx` renders the current `installMode` as a static label (lines 82-87). In the new design, `StepConfirm` should derive the install mode from source selections and display it as a read-only summary (e.g., "Plugin", "Local (editable copies)", or "Custom (2 local, 22 plugin)"). It does NOT need to become an interactive selector -- install mode is controlled via source selection on the sources step.

<!-- ADDED: additional detail about current StepConfirm structure -->
> **Detail:** `StepConfirm` currently uses `useInput` (line 31) to handle only ENTER (confirm) and ESC (go back). The install mode is displayed as `<Text bold>{installMode === "plugin" ? "Plugin" : "Local"}</Text>`. This needs to be updated to show the derived mode from source selections, including a count for custom mode.

### 7. `setConfigMetadata()` and `writeConfigFile()` are module-private

<!-- ADDED: this gap was not in the original doc -->
The doc's "Existing Infrastructure" section lists `setConfigMetadata()` as a function to reuse, but it is a module-private `function` in `local-installer.ts:257` (no `export` keyword) and is NOT re-exported from `lib/installation/index.ts`. Similarly, `writeConfigFile()` at line 330 and `buildAndMergeConfig()` at line 291 are both private. The edit flow cannot call these functions without either:

- Exporting them from `local-installer.ts` and `lib/installation/index.ts`
- Extracting config persistence into a separate shared module (e.g., `lib/configuration/config-writer.ts`)
- Duplicating the logic in `edit.tsx` (not recommended)

### 8. `WizardResultV2.installMode` type needs to include `"custom"`

<!-- ADDED: this gap was not in the original doc -->
The `WizardResultV2` type (at `wizard.tsx:27-42`) defines `installMode: "plugin" | "local"`. This needs to include `"custom"` to match the new design. The wizard store's `installMode` state field (`wizard-store.ts:164`) also needs the same change.

### 9. `Installation` type and `detectInstallation()` need `"custom"` awareness

<!-- ADDED: this gap was not in the original doc -->
The `Installation` type (at `installation.ts:13-21`) uses `InstallMode = "local" | "plugin"`. The `detectInstallation()` function (line 23-61) reads `installMode` from config and branches on `"local"` vs anything else. Adding `"custom"` requires updating:

- `InstallMode` type at `installation.ts:13`
- The branching logic in `detectInstallation()` at line 43
- The `edit.tsx` usage at line 71 (`const isPluginMode = installation.mode === "plugin"`)

---

## Implementation Phases

### Phase 1: Ensure "Local" appears as a source option, add bulk hotkeys, remove `P` toggle

**Scope:** UI changes to the sources step. No migration logic yet.

1. Ensure `buildSourceRows()` in `wizard-store.ts` always includes a "Local" source option for every skill, even when no local source exists in `skill.availableSources`. This may already happen if the multi-source-loader populates a local source -- verify and add if missing.
2. Remove the `P` keypress handler from `wizard.tsx:151-153` (the old toggle)
3. Remove the `P` indicator `DefinitionItem` from `wizard-layout.tsx:128-132`
4. Remove `P` from `GLOBAL_TOGGLES` in `help-modal.tsx:26`
5. Add `L` and `P` hotkeys to `SourceGrid` or `StepSources` for bulk source switching:
   - `L` = set all skills' selected source to "local"
   - `P` = set all skills' selected source to their default marketplace source
6. Update `StepConfirm` to derive and display the install mode from source selections (read-only label, not a selector)
7. Add `"custom"` to the `installMode` type in:
   - `ProjectConfig` (`types/config.ts:58`)
   - `WizardResultV2` (`wizard.tsx:35`)
   - `wizard-store.ts:164` (state type) and `wizard-store.ts:412` (initial state)
   - `StepConfirmProps` (`step-confirm.tsx:16`)
   - Zod schema (`lib/schemas.ts:396` and `lib/schemas.ts:432`)
   - `InstallMode` (`installation.ts:13`)
8. Replace `toggleInstallMode()` in wizard-store with `setInstallMode(mode)` and add logic to derive mode from source selections
9. Add `skillOverrides?: Partial<Record<SkillId, "local" | "plugin">>` to `ProjectConfig`
10. Add corresponding Zod schema field for `skillOverrides`
11. Add footer hint text to the source grid showing hotkey shortcuts: `L set all local  P set all plugin  ENTER continue  ESC back`

**Files changed:**

| File | Change |
| --- | --- |
| `stores/wizard-store.ts` | Ensure "Local" in `buildSourceRows()`, add `deriveInstallMode()`, replace `toggleInstallMode()` with `setInstallMode()`, add bulk source actions |
| `components/wizard/source-grid.tsx` or `step-sources.tsx` | Add `L`/`P` hotkey handlers, add footer hint text |
| `components/wizard/wizard.tsx` | Remove `P` handler at line 151-153 |
| `components/wizard/wizard-layout.tsx` | Remove `P` indicator `DefinitionItem` at lines 128-132 |
| `components/wizard/help-modal.tsx` | Remove `P` entry from `GLOBAL_TOGGLES` at line 26 |
| `components/wizard/step-confirm.tsx` | Derive install mode from source selections, display as label |
| `types/config.ts` | Add `"custom"` to installMode union at line 58, add `skillOverrides` field |
| `lib/schemas.ts` | Add `"custom"` to both installMode schemas (lines 396, 432), add `skillOverrides` schema |
| `lib/installation/installation.ts` | Add `"custom"` to `InstallMode` type at line 13 |

### Phase 2: Wire source selections into edit flow (and fix config persistence gap)

<!-- CORRECTED: expanded scope to address the broader config persistence gap -->
**Scope:** Make `edit.tsx` persist wizard results to config and respect source selection changes that affect install mode.

1. Export `setConfigMetadata()`, `writeConfigFile()`, and `buildAndMergeConfig()` from `local-installer.ts` and re-export from `lib/installation/index.ts` -- OR extract config persistence into `lib/configuration/config-writer.ts`
2. After wizard completes in `edit.tsx`, persist ALL wizard result changes to `config.yaml` (skills, domains, agents, expertMode, sourceSelections, derived installMode, skillOverrides)
3. Compare new source selections against current installation state to detect per-skill migration needs (marketplace-to-local or local-to-marketplace)
4. If any skills changed, call migration logic (Phase 3)
5. Pass wizard result's derived `installMode` to `recompileAgents()` instead of relying on old config

**Files changed:**

| File | Change |
| --- | --- |
| `lib/installation/local-installer.ts` | Export `setConfigMetadata()`, `writeConfigFile()`, `buildAndMergeConfig()` |
| `lib/installation/index.ts` | Re-export new public functions |
| `commands/edit.tsx` | Add config persistence after wizard completes, add per-skill migration detection |
| `lib/agents/agent-recompiler.ts` | Add optional `installMode` field to `RecompileAgentsOptions` (line 26-33), use it to override `projectConfig?.installMode` at line 208 |

<!-- ADDED: dependency note -->
> **Dependency:** Phase 2 depends on Phase 1 for the `"custom"` type to exist, but the config persistence fix (steps 1-2) could be done independently as a prerequisite since it fixes an existing bug regardless of the install mode redesign.

### Phase 3: Per-skill migration with confirmation

**Scope:** Implement the actual per-skill migration when source selections change between local and marketplace.

1. Add bulk archive function: `archiveAllLocalSkills(projectDir, skillIds)` -- loops `archiveLocalSkill()` per skill
2. Add migration functions: `migrateSkillsToPlugin(skillIds)` and `migrateSkillsToLocal(skillIds)` -- operate on sets of skills, not modes
3. Add confirmation prompt in `edit.tsx` before executing migration (using oclif `ux.confirm()` or standalone prompt, not Ink since wizard has exited). Confirmation lists which skills are changing and in which direction.
4. Handle marketplace availability check: skills switching to marketplace sources require `sourceResult.marketplace`

**Files changed:**

| File | Change |
| --- | --- |
| `lib/skills/source-switcher.ts` | Add `archiveAllLocalSkills()` bulk function |
| `lib/installation/mode-migrator.ts` (new) | Migration functions `migrateSkillsToPlugin()`, `migrateSkillsToLocal()` |
| `commands/edit.tsx` | Confirmation prompt listing per-skill changes, migration orchestration |

<!-- ADDED: notes about marketplace constraint and testing -->
> **Constraint:** `migrateSkillsToPlugin()` must check `sourceResult.marketplace` and abort with a clear error if no marketplace is configured. The user must be told to configure a marketplace source before switching skills to plugin mode.

> **Testing note:** Migration functions should be pure (take explicit inputs, return results) to enable unit testing without filesystem side effects. The orchestration in `edit.tsx` calls them with real paths.

---

## Open Questions

### Q1: Should "Customize skill sources" (which exposes "Local" options) be available during init or only during edit?

During init, the user has no existing installation to migrate. The "Customize skill sources" card on the sources step opens the source grid where "Local" is visible for every skill.

**Lean:** Available during both init and edit. During init it is a simple per-skill source picker (no migration needed). During edit it additionally triggers per-skill migration for skills that change between local and marketplace.

### Q2: What happens to skills with local edits when converting local to plugin?

If the user has edited `.claude/skills/web-framework-react/SKILL.md` locally and then switches to plugin mode, the local edits are lost (archived but no longer active).

**Lean:** Warn explicitly. The confirmation dialog should mention: "Skills with local edits will be archived to `.claude/skills/_archived/`. You can restore them later with `agentsinc convert --to-local`."

### Q3: Should archived skills serve as a rollback mechanism?

Currently `archiveLocalSkill()` moves skills to `_archived/`. Should this be a permanent rollback mechanism or a temporary staging area?

**Lean:** Permanent rollback. Archived skills persist until explicitly cleaned up (e.g., `agentsinc clean --archived`). This is low-cost and provides safety.

<!-- ADDED: code-based answer -->
> **Code answer:** The current `archiveLocalSkill()` implementation (source-switcher.ts:42-71) copies the skill to `_archived/` then removes the original. `restoreArchivedSkill()` (line 77-106) copies back and removes the archive. There is no TTL, expiry, or cleanup mechanism. So archived skills already persist permanently by default. The only cleanup path is manual filesystem deletion or a future `agentsinc clean` command.

### Q4: Should `recompileAgents()` accept an explicit `installMode` parameter?

Currently it reads from `projectConfig?.installMode`. For edit mode to work correctly, the wizard result's install mode must override the config's value.

**Lean:** Yes. Add an optional `installMode` field to `RecompileAgentsOptions`. When provided, it overrides the config value. This is the minimal change needed.

<!-- ADDED: specific implementation detail -->
> **Code answer:** The change is straightforward. In `agent-recompiler.ts`:
> 1. Add `installMode?: "local" | "plugin" | "custom"` to `RecompileAgentsOptions` (line 26-33)
> 2. At line 208, change `installMode: projectConfig?.installMode` to `installMode: options.installMode ?? projectConfig?.installMode`
> 3. For "custom" mode, the caller must resolve per-skill overrides before calling recompile (the recompiler doesn't need to know about per-skill granularity)

### Q5: Config schema for per-skill overrides in "customize" mode

Two approaches for storing per-skill mode choices:

**Option A: Flat overrides map**

```yaml
installMode: custom
skillOverrides:
  web-framework-react: local
  web-styling-tailwind: local
```

**Option B: Grouped by mode**

```yaml
installMode: custom
localSkills:
  - web-framework-react
  - web-styling-tailwind
```

**Lean:** Option A. It's a simple `Record<SkillId, "local" | "plugin">` where missing entries default to plugin. Matches the existing `sourceSelections` pattern in the wizard result.

<!-- ADDED: code-based analysis -->
> **Code analysis:** Option A aligns better with the existing `sourceSelections: Partial<Record<SkillId, string>>` pattern used throughout the wizard store and wizard result. The Zod schema would be: `skillOverrides: z.record(z.string(), z.enum(["local", "plugin"])).optional()`.

### Q6: Should we add a `convert` command?

The confirmation dialogs mention `agentsinc convert --to-plugin` and `agentsinc convert --to-local`. This would be a per-skill mode switch outside the wizard.

**Lean:** Defer. The wizard handles this via the "customize" option. A standalone `convert` command is nice-to-have but not needed for the initial implementation.

### Q7: Should we fix the broader config persistence gap in edit.tsx as part of this work?

<!-- ADDED: new question discovered during audit -->
The audit revealed that `edit.tsx` never persists ANY config changes, not just installMode. This means the `skills`, `domains`, `selectedAgents`, and `expertMode` fields in config.yaml become stale after every edit.

**Lean:** Yes, fix it in Phase 2. The config persistence machinery (`setConfigMetadata()` + `writeConfigFile()`) already exists in `local-installer.ts` and just needs to be exported and called from `edit.tsx`. This is a prerequisite for install mode migration anyway, and fixing it simultaneously avoids leaving the config in an inconsistent state.

### Q8: How does "custom" (mixed) install mode interact with `init.tsx`'s branching?

<!-- ADDED: new question discovered during audit -->
The current `init.tsx` handles install after the wizard with a simple binary branch: `result.installMode === "plugin"` goes to `installIndividualPlugins()`, everything else goes to `installLocalMode()` (lines 203-215). With the source-selection approach, when some skills are "Local" and others are marketplace, init needs to:

1. Derive `installMode: "custom"` from mixed source selections
2. Split selected skills into two groups based on which source is selected (local vs marketplace)
3. Install plugin-mode skills via `claudePluginInstall()`
4. Copy local-mode skills via `copySkillsToLocalFlattened()`
5. Write config with `installMode: "custom"` and `skillOverrides`
6. Compile agents (which need to know per-skill install mode for skill references)

This is a non-trivial change to `init.tsx`'s `handleInstallation()` method that the current phases don't explicitly address.

**Lean:** Add a dedicated init handler for mixed/custom mode in Phase 3, or defer mixed mode entirely to a separate phase after the pure local/plugin paths work correctly.
