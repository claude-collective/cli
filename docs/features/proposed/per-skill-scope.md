# Per-Skill Scope & Consolidated Skills Array

Replace the global `installScope` toggle and parallel data structures (`skills[]` + `sourceSelections{}`) with a single consolidated `SkillConfig[]` array that carries scope and source per skill.

**Status:** Implemented (2026-03-06)
**Date:** 2026-03-02
**Related:** `ProjectConfig` in config.ts, `WizardResultV2` in wizard.tsx, `wizard-store.ts`

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [New Data Model](#new-data-model)
3. [Dual Config Architecture](#dual-config-architecture)
4. [UI Changes](#ui-changes)
5. [Installation Pipeline Changes](#installation-pipeline-changes)
6. [Files to Modify](#files-to-modify)
7. [Open Questions](#open-questions)

---

## 1. Problem Statement

### The scope toggle is all-or-nothing

`installScope` is a global binary toggle (`"project" | "global"`) controlled by a `G` hotkey available on every wizard step. All skills share the same scope. There is no way to say "install `anti-over-engineering` globally but keep `react` at project scope."

Relevant code:
- `wizard-store.ts:184` -- `installScope: InstallScope` (single global field)
- `wizard-store.ts:647-650` -- `toggleInstallScope()` action
- `wizard.tsx:150-152` -- `G` key calls `store.toggleInstallScope()`, works on ANY step
- `wizard-layout.tsx:144-148` -- Shows `G` badge in footer when scope is global
- `step-confirm.tsx:112-117` -- Displays "Install scope: Global" or "Install scope: Project"
- `help-modal.tsx:22-28` -- Documents `G` in `GLOBAL_TOGGLES` section

### skills and sourceSelections are parallel data structures that can drift

`ProjectConfig` stores skills as a flat `SkillId[]` and source information in a separate `sourceSelections?: Partial<Record<SkillId, string>>`. These are parallel structures -- a skill can exist in one but not the other, or have stale entries after removal. The `installMode` field is also redundant since it can be derived from the source selections.

Relevant code:
- `config.ts:48` -- `skills: SkillId[]`
- `config.ts:60-61` -- `sourceSelections?: Partial<Record<SkillId, string>>`
- `config.ts:57-58` -- `installMode?: "local" | "plugin" | "mixed"`

### Goal

Per-skill scope + source in a single consolidated array, eliminating parallel data structures and the global scope toggle.

---

## 2. New Data Model

### `SkillConfig` type (new, in `types/config.ts`)

```typescript
type SkillConfig = {
  id: SkillId;
  scope: InstallScope;  // "project" | "global"
  source: string;        // "local" | marketplace name (e.g., "agents-inc")
};
```

### `ProjectConfig` changes

```typescript
// Before:
type ProjectConfig = {
  skills: SkillId[];
  sourceSelections?: Partial<Record<SkillId, string>>;
  installMode?: "local" | "plugin" | "mixed";
  // ... other fields unchanged
};

// After:
type ProjectConfig = {
  skills: SkillConfig[];
  // sourceSelections removed (now part of SkillConfig)
  // installMode removed (derived from skills array)
  // ... other fields unchanged
};
```

### Derived `installMode`

`installMode` is no longer persisted. It is derived at runtime from the skills array:

```typescript
function deriveInstallMode(skills: SkillConfig[]): InstallMode {
  if (skills.length === 0) return "local";
  const hasLocal = skills.some((s) => s.source === "local");
  const hasPlugin = skills.some((s) => s.source !== "local");
  if (hasLocal && hasPlugin) return "mixed";
  return hasLocal ? "local" : "plugin";
}
```

### `WizardResultV2` changes

```typescript
// Before:
type WizardResultV2 = {
  selectedSkills: SkillId[];
  sourceSelections: Partial<Record<SkillId, string>>;
  installMode: InstallMode;
  installScope: InstallScope;
  // ... other fields
};

// After:
type WizardResultV2 = {
  skills: SkillConfig[];
  // selectedSkills removed (IDs extracted from skills)
  // sourceSelections removed (part of SkillConfig)
  // installMode removed (derived from skills)
  // installScope removed (per-skill in SkillConfig)
  // ... other fields unchanged
};
```

### Wizard store changes

The wizard store uses `SkillConfig[]` directly as its internal representation -- the same shape as the config file. No parallel maps, no merging step at completion.

**Add:**

| Item | Type | Purpose |
|------|------|---------|
| `skillConfigs` | `SkillConfig[]` | Per-skill config array (same shape as `ProjectConfig.skills`) |
| `toggleSkillScope(skillId: SkillId)` | action | Toggles scope between project/global for a skill in `skillConfigs` |
| `setSkillSource(skillId: SkillId, source: string)` | action | Updates source for a skill in `skillConfigs` |
| `focusedSkillId` | `SkillId \| null` | Currently focused skill in build step (for `S` hotkey) |
| `setFocusedSkillId(id: SkillId \| null)` | action | Set focused skill from CategoryGrid |

**Remove:**

- `installScope` field
- `toggleInstallScope()` action
- `toggleInstallMode()` action
- `sourceSelections` (folded into `skillConfigs`)

**Keep:**

- `deriveInstallMode()` -- computed from `skillConfigs`, still useful for UI display

The existing `selections: Partial<Record<Subcategory, SkillId[]>>` map remains as the category grid UI state -- it tracks which skills are checked. `skillConfigs` is the complementary metadata layer: when a skill is selected in the build step, an entry is added to `skillConfigs` with defaults `{ id, scope: "project", source: DEFAULT_PUBLIC_SOURCE_NAME }`. When deselected, the entry is removed from both `selections` and `skillConfigs`. The source grid updates `source` on existing `skillConfigs` entries. The `S` hotkey toggles `scope` on an existing entry. `selections` answers "what's selected," `skillConfigs` answers "how it's configured."

**`handleComplete` in `wizard.tsx`:**

```typescript
// skillConfigs is already SkillConfig[] -- pass directly
const result: WizardResultV2 = {
  skills: store.skillConfigs,
  // ... other fields unchanged
};
```

**Loading during edit:**

When editing an existing project, `skillConfigs` is loaded directly from `projectConfig.skills` -- no decomposition needed since the shapes match.

### Zod schema changes

`projectConfigLoaderSchema` in `schemas.ts`:

```typescript
// Before:
skills: z.array(extensibleSkillIdSchema).optional(),

// After:
skills: z.array(z.object({
  id: extensibleSkillIdSchema,
  scope: z.enum(["project", "global"]),
  source: z.string(),
})).optional(),
```

The `installMode` and `sourceSelections` fields are removed from the schema.

---

## 3. Dual Config Architecture

### Two config locations

Global-scope skills get their own config and types at the global installation directory. Project-scope skills live in the project config. Both configs use the same `SkillConfig[]` format.

| Location | Config file | Types file | Contains |
|----------|-------------|------------|----------|
| `~/.claude-src/` | `config.ts` | `config-types.ts` | Global-scope skills only |
| `{project}/.claude-src/` | `config.ts` | `config-types.ts` | All skills (project + global scope) |

The **project config is the complete picture** -- it declares all skills the project uses, including global-scope ones. The global config is a full installation in its own right -- it has its own skills, agents, domains, and compiled agents. The typical use case is installing meta skills and their associated agents globally. The project config-types import gives projects type-safe access to globally available skill IDs.

### Type imports

The project `config-types.ts` auto-imports global types and extends them:

```typescript
// {project}/.claude-src/config-types.ts (generated)
import type { SkillId as GlobalSkillId } from "/home/user/.claude-src/config-types";

export type SkillId = GlobalSkillId | "web-framework-react" | "web-styling-tailwind";
```

This means:
- Removing a global skill from the global config → type disappears → projects that reference it get TypeScript errors
- New projects auto-import global types via `cc init` without knowing what's installed globally
- The project config remains 100% self-contained for runtime behavior
- The import path is an absolute path resolved from `os.homedir()` at generation time (TypeScript cannot resolve `~`)

### Installation writes to both locations

When `cc init` or `cc edit` completes:

1. Global-scope skills → written to global config at `~/.claude-src/config.ts`, types generated at `~/.claude-src/config-types.ts`
2. Project-scope skills → written to project config at `{project}/.claude-src/config.ts`
3. Project `config-types.ts` regenerated with import from global types
4. The project config's `skills` array contains ALL skills (both scopes)

### When no global skills exist

The global config at `~/.claude-src/` is only created when at least one global-scope skill is installed. If no global skills exist, the project `config-types.ts` is self-contained (no import). The global config is created on first global skill installation (via `cc init` or `cc edit`).

### Loading during edit

`cc edit` loads the **project config only** -- it has the full `skills: SkillConfig[]` with both scopes. No need to load the global config separately.

### Changing global skills to project scope

When `cc edit` changes a skill from global to project scope, the skill is removed from the global config and installed at project scope. A warning is shown: other projects that reference the global skill will have type errors until they re-run `cc init` or `cc edit`. This is intentional -- the type system surfaces the dependency break immediately.

---

## 4. UI Changes

### Build step -- skill tags

Add a scope suffix to each selected skill tag:

```
[react P] [zustand P] [anti-over-engineering G]
```

- `P` = project scope (default)
- `G` = global scope
- Scope indicator shown only on selected skills
- Scope passed as a prop to `SkillTag` (not read from store inside the component)

### Build step -- footer & input

Add `S scope` to the build step footer hotkey hints:

```
S scope  D labels  ? help
```

The `S` handler goes in `wizard.tsx` with a `store.step === "build"` guard (matches existing pattern for the `A` key at `wizard.tsx:139-143`):

```typescript
if ((input === "s" || input === "S") && store.step === "build") {
  const focusedSkillId = /* extracted from CategoryGrid focus tracking:
    processedCategories[focusedRow].sortedOptions[focusedCol].id */;
  if (focusedSkillId && store.getAllSelectedTechnologies().includes(focusedSkillId)) {
    store.toggleSkillScope(focusedSkillId);
  }
}
```

No-op on unselected skills. No hotkey conflict -- `S` is already used in the sources step for `toggleSettings` (`wizard.tsx:145-148`, gated on `store.step === "sources"`), and the build step is a different step.

**Focus tracking:** Add `focusedSkillId: SkillId | null` + `setFocusedSkillId()` to the wizard store. `CategoryGrid`'s existing `onFocusChange` callback resolves the focused indices to a skill ID and writes to the store. `wizard.tsx` reads `store.focusedSkillId` in the `S` handler.

### Remove global G hotkey

- Remove `wizard.tsx:150-152` -- the `G` key handler calling `store.toggleInstallScope()`
- Remove `wizard-layout.tsx:144-148` -- the `G` badge in the footer
- Remove `help-modal.tsx:22-28` -- the `G` entry in `GLOBAL_TOGGLES`

### Remove --global flag from `cc init`

- Remove `init.tsx:293-296` -- `global: Flags.boolean(...)` flag definition
- Remove all `flags.global` usage in `init.tsx` (lines 306, 321, 364, 397)
- Remove `initialInstallScope` prop from Wizard component

### Confirmation step

Replace the single "Install scope: Global/Project" line with a per-skill summary:

```
Scope: 15 project, 3 global
```

Replace the "Install mode: Plugin/Local/Mixed" line with a summary derived from the skills array (already done by `getInstallModeLabel` -- update it to accept `SkillConfig[]`).

---

## 5. Installation Pipeline Changes

### Config generation (`config-generator.ts`)

`generateProjectConfigFromSkills()` now produces `SkillConfig[]` instead of `SkillId[]`. It receives the pre-built `SkillConfig[]` directly from the wizard result.

### Config types generation (`config-types-writer.ts`)

The config types writer generates two files when global-scope skills exist:

1. `~/.claude-src/config-types.ts` -- exports `SkillId` union for global skills only
2. `{project}/.claude-src/config-types.ts` -- imports global types and extends with project skills

When no global-scope skills exist, the project `config-types.ts` is self-contained (no import).

### Config metadata (`local-installer.ts`)

`setConfigMetadata()`: Remove `sourceSelections` persistence (now part of skills array). Remove `installMode` persistence (derived).

`buildLocalConfig()`: Updated to produce config with `SkillConfig[]` format.

### Config merge (`config-merger.ts`)

`mergeWithExistingConfig()` must handle merging `SkillConfig[]` arrays. Merge by ID: new skills union with existing, existing skills keep their scope/source unless explicitly changed.

### Install routing

For each skill in the result:

| Source | Scope | Action |
|--------|-------|--------|
| `"local"` | `"project"` | Copy to `{project}/.claude/skills/` |
| `"local"` | `"global"` | Copy to `~/.claude/skills/` |
| non-local | `"project"` | `claudePluginInstall(ref, "project", projectDir)` |
| non-local | `"global"` | `claudePluginInstall(ref, "user", projectDir)` |

Each skill is an independent clean install -- no migration ordering needed. The install loop iterates over `result.skills` and dispatches each to the appropriate variant:

```typescript
for (const skill of result.skills) {
  const isLocal = skill.source === "local";
  const isGlobal = skill.scope === "global";
  const skillsDir = isGlobal ? globalSkillsDir : projectSkillsDir;
  const pluginScope = isGlobal ? "user" : "project";

  if (isLocal) {
    await copyToLocal(skill.id, skillsDir, sourceResult);
  } else {
    const pluginRef = `${skill.id}@${sourceResult.marketplace}`;
    await claudePluginInstall(pluginRef, pluginScope, projectDir);
  }
}
```

Old artifacts are cleaned up independently per skill before installing.

### Mode migrator (`mode-migrator.ts`)

The mode-migrator handles **edit-time cleanup of old artifacts**. When a skill changes source, scope, or both, the old installation must be removed before the new one is created -- there should only be one instance of each skill.

`detectMigrations()` compares old vs new `SkillConfig[]` entries by ID to find skills that changed source or scope. `executeMigration()` cleans up old artifacts:

- Local->plugin: delete old local copy, then install plugin
- Plugin->local: uninstall old plugin, then copy to local
- Project->global (same source): remove from project location, install at global location
- Global->project (same source): remove from global location, install at project location
- Source AND scope change: clean up old, install new (both dimensions)

During `cc init` there are no old artifacts -- the install loop handles everything directly. The mode-migrator is only needed during `cc edit`.

### Edit command (`edit.tsx`)

- Skill diff logic at `edit.tsx:175-189`: extract IDs from `SkillConfig[]` for comparison (e.g., `oldSkills.map(s => s.id)` vs `newSkills.map(s => s.id)`)
- Source change detection: compare old vs new `SkillConfig` entries by ID
- Plugin install/uninstall: use per-skill scope from the `SkillConfig`
- Scope change detection: if a skill's scope changed, uninstall from old scope, install at new scope

---

## 6. Files to Modify

### Types & Schemas

| File | Change |
|------|--------|
| `src/cli/types/config.ts` | Add `SkillConfig` type. Update `ProjectConfig.skills` from `SkillId[]` to `SkillConfig[]`. Remove `sourceSelections`. Remove `installMode`. |
| `src/cli/lib/schemas.ts` | Update `projectConfigLoaderSchema` -- `skills` changes from `z.array(extensibleSkillIdSchema)` to `z.array(z.object({ id, scope, source }))`. Remove `installMode` and `sourceSelections` fields. |
| `src/cli/lib/installation/installation.ts` | Keep `InstallMode` type export (still used). Remove `scope` from `Installation` type. Add `deriveInstallMode(skills: SkillConfig[])` as shared utility. Update install detection to derive mode from skills array. |

### Wizard & UI

| File | Change |
|------|--------|
| `src/cli/stores/wizard-store.ts` | Add `skillConfigs: SkillConfig[]`, `toggleSkillScope`, `setSkillSource`, `focusedSkillId`, `setFocusedSkillId`. Remove `installScope`, `toggleInstallScope`, `toggleInstallMode`, `sourceSelections` (folded into `skillConfigs`). |
| `src/cli/components/wizard/wizard.tsx` | Remove `G` handler (lines 150-152). Add `S` handler gated on `step === "build"`. Update `WizardResultV2` type (replace `selectedSkills`/`sourceSelections`/`installMode`/`installScope` with `skills: SkillConfig[]`). Update `handleComplete` to build `SkillConfig[]`. Remove `initialInstallScope` prop. |
| `src/cli/components/wizard/wizard-layout.tsx` | Remove `G` badge (lines 144-148). Add `S scope` badge visible on build step. |
| `src/cli/components/wizard/help-modal.tsx` | Remove `G` from `GLOBAL_TOGGLES` (lines 22-28). Add `S` to `BUILD_KEYS`. |
| `src/cli/components/wizard/category-grid.tsx` | Add scope prop to `SkillTag`. |
| `src/cli/components/wizard/step-build.tsx` | Add `S scope` to footer hint text. |
| `src/cli/components/wizard/step-confirm.tsx` | Remove `installScope` prop. Update scope display to per-skill summary ("Scope: 15 project, 3 global"). Remove `installMode` prop or derive it from skills. |
| `src/cli/components/wizard/step-sources.tsx` | Update if it reads `installMode`/`installScope`. |
| `src/cli/components/hooks/use-wizard-initialization.ts` | Remove `initialInstallScope` handling. Load `skillConfigs` from `config.skills`. |
| `src/cli/components/hooks/use-build-step-props.ts` | Pass scope data through to `CategoryGrid`. |

### Installation Pipeline

| File | Change |
|------|--------|
| `src/cli/lib/configuration/config-generator.ts` | Update `generateProjectConfigFromSkills()` to produce `SkillConfig[]`. |
| `src/cli/lib/installation/local-installer.ts` | Update `setConfigMetadata()` -- remove `sourceSelections` and `installMode` persistence. Update `buildLocalConfig()` to pass scope/source info. Route skills to correct directories by scope. |
| `src/cli/lib/configuration/config-merger.ts` | Add skills merge logic (by ID). New skills union with existing. Existing skills keep scope/source unless explicitly changed. |
| `src/cli/lib/configuration/config-types-writer.ts` | Update generated `ProjectConfig` interface -- `skills: SkillConfig[]`, emit `SkillConfig` type, remove `sourceSelections` and `installMode` fields. Generate dual config-types files: global types at `~/.claude-src/config-types.ts`, project types that import and extend global types. |
| `src/cli/lib/configuration/project-config.ts` | Update defensive initialization for new skills format. Update `extendSchemasWithCustomValues` call to extract IDs: `raw.skills?.map(s => s.id) ?? []`. |
| `src/cli/lib/installation/installation.ts` | Update `detectProjectInstallation`/`detectGlobalInstallation` to derive `installMode` from `skills` array instead of reading `config.installMode`. |
| `src/cli/lib/installation/mode-migrator.ts` | Per-skill scope in `executeMigration()`. |
| `src/cli/lib/agents/agent-recompiler.ts` | Reads `installMode` from config for compile output format -- derive from skills array instead. |
| `src/cli/commands/init.tsx` | Remove `--global` flag (lines 293-296). Split installation by scope. Remove all `flags.global` usage. |
| `src/cli/commands/edit.tsx` | Per-skill scope in plugin install/uninstall (replace static `pluginScope` at line 81 with per-skill lookup). Update skill diff logic to extract IDs from `SkillConfig[]`. Detect scope changes and trigger scope migration. |
| `src/cli/commands/eject.ts` | Remove `installMode: "local"` write -- field no longer exists on `ProjectConfig`. |

### Test Files (major impact)

| File | Change |
|------|--------|
| `src/cli/lib/__tests__/helpers.ts` | Update `buildWizardResult()` and `buildWizardResultFromStore()` for new `WizardResultV2` type. |
| `src/cli/stores/wizard-store.test.ts` | Rewrite `installScope`/`toggleInstallScope` tests. Add `skillConfigs`/`toggleSkillScope`/`setSkillSource` tests. |
| `src/cli/components/wizard/step-confirm.test.tsx` | Update to use per-skill scope summary instead of single scope prop. |
| `src/cli/lib/configuration/__tests__/config-types-writer.test.ts` | Update `skills` assertions from ID array to object array. |
| `src/cli/lib/configuration/config-generator.test.ts` | Update `skills` assertions from ID array to object array. |
| `src/cli/lib/configuration/config-merger.test.ts` | Add skills merge tests (merge by ID). |
| `src/cli/lib/__tests__/integration/*.test.ts` | Update all `config.skills` assertions. |
| `src/cli/lib/__tests__/integration/install-mode.integration.test.ts` | Major rewrite -- `sourceSelections` removed from config, `installMode` derived. |
| `e2e/interactive/init-wizard.e2e.test.ts` | Remove global scope E2E test. |
| `e2e/**/*.test.ts` | Update config fixtures that include `skills` arrays. |

---

## 7. Open Questions

### Q1: Should scope default to "project" or be configurable?

**Decision: Always default to "project".** No configuration needed. Users toggle individual skills to global via the `S` hotkey.

### Q2: What about existing configs with the old format?

Not applicable. The project is pre-1.0 -- no backward-compatibility shims or migration code. Old configs will fail validation and users re-run `cc init`.

### Q3: How does `cc edit` detect scope changes?

Compare old and new `SkillConfig[]` entries by ID. If a skill's scope changed, clean install at the new location and clean up the old one. Each skill is independent -- no migration ordering needed.

### Q4: Should skill tags show scope only when mixed?

**Decision: Always show scope indicator on selected skills.** `P` for project, `G` for global. Users need to see what they are getting.

### Q5: Where does `deriveInstallMode()` live?

In `installation.ts` alongside the `InstallMode` type definition. Exported as a shared utility for use by `agent-recompiler.ts`, `init.tsx`, `edit.tsx`, `step-confirm.tsx`, and anywhere else that needs the derived mode.

### Q6: Should `Installation.scope` be kept?

**Decision: Remove it.** The `Installation` type no longer has a single `scope` field. Each skill carries its own scope in `SkillConfig`. The `Installation` type retains `mode` (derived from skills array), `configPath`, `agentsDir`, `skillsDir`, and `projectDir`.

### Q7: How does the install loop work?

Four variants based on source x scope. Each skill is dispatched independently:

| Source | Scope | Action |
|--------|-------|--------|
| `"local"` | `"project"` | Copy to `{project}/.claude/skills/` |
| `"local"` | `"global"` | Copy to `~/.claude/skills/` |
| non-local | `"project"` | `claudePluginInstall(ref, "project", projectDir)` |
| non-local | `"global"` | `claudePluginInstall(ref, "user", projectDir)` |

No complex migration ordering. Old artifacts cleaned up before install. Each skill is a clean install with clean arguments.
