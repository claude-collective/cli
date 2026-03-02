# Per-Skill Scope & Consolidated Skills Array

Replace the global `installScope` toggle and parallel data structures (`skills[]` + `sourceSelections{}`) with a single consolidated `SkillConfig[]` array that carries scope and source per skill.

**Status:** Proposed
**Date:** 2026-03-02
**Related:** `ProjectConfig` in config.ts, `WizardResultV2` in wizard.tsx, `wizard-store.ts`

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [New Data Model](#new-data-model)
3. [UI Changes](#ui-changes)
4. [Installation Pipeline Changes](#installation-pipeline-changes)
5. [Files to Modify](#files-to-modify)
6. [Open Questions](#open-questions)

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

The wizard store keeps `sourceSelections` and `scopeSelections` as separate maps internally -- they serve different UI interactions (source grid vs S hotkey). They get merged into `SkillConfig[]` only at completion time in `handleComplete`.

**Add:**

| Item | Type | Purpose |
|------|------|---------|
| `scopeSelections` | `Partial<Record<SkillId, InstallScope>>` | Per-skill scope map (default: `{}`, sparse -- only `"global"` entries stored) |
| `toggleSkillScope(skillId: SkillId)` | action | Toggles between project/global for a single skill |
| `getScopeForSkill(skillId: SkillId): InstallScope` | helper | Returns effective scope (defaults to `"project"`) |

**Remove:**

- `installScope` field
- `toggleInstallScope()` action
- `toggleInstallMode()` action

**Keep:**

- `sourceSelections: Partial<Record<SkillId, string>>` -- still used internally by the sources step UI
- `deriveInstallMode()` -- still useful for UI display (but no longer persisted)

**Update `handleComplete` in `wizard.tsx`:**

Build `SkillConfig[]` by combining `selectedSkills`, `sourceSelections`, and `scopeSelections`:

```typescript
const skills: SkillConfig[] = allSkills.map((id) => ({
  id,
  scope: store.getScopeForSkill(id),
  source: store.sourceSelections[id] || DEFAULT_PUBLIC_SOURCE_NAME,
}));
```

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

## 3. UI Changes

### Build step -- skill tags

Add a scope suffix to each selected skill tag using Unicode modifier letters:

```
[react \u1D3E] [zustand \u1D3E] [anti-over-engineering \u1D33]
```

- `\u1D3E` = project scope (default)
- `\u1D33` = global scope
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

## 4. Installation Pipeline Changes

### Config generation (`config-generator.ts`)

`generateProjectConfigFromSkills()` now produces `SkillConfig[]` instead of `SkillId[]`. It needs `sourceSelections` and `scopeSelections` as additional parameters (or receives the pre-built `SkillConfig[]` directly from the wizard result).

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

### Mode migrator (`mode-migrator.ts`)

`executeMigration()`: The scope parameter becomes per-skill, extracted from each `SkillConfig` entry.

### Edit command (`edit.tsx`)

- Skill diff logic at `edit.tsx:175-189`: extract IDs from `SkillConfig[]` for comparison (e.g., `oldSkills.map(s => s.id)` vs `newSkills.map(s => s.id)`)
- Source change detection: compare old vs new `SkillConfig` entries by ID
- Plugin install/uninstall: use per-skill scope from the `SkillConfig`
- Scope change detection: if a skill's scope changed, uninstall from old scope, install at new scope

---

## 5. Files to Modify

### Types & Schemas

| File | Change |
|------|--------|
| `src/cli/types/config.ts` | Add `SkillConfig` type. Update `ProjectConfig.skills` from `SkillId[]` to `SkillConfig[]`. Remove `sourceSelections`. Remove `installMode`. |
| `src/cli/lib/schemas.ts` | Update `projectConfigLoaderSchema` -- `skills` changes from `z.array(extensibleSkillIdSchema)` to `z.array(z.object({ id, scope, source }))`. Remove `installMode` and `sourceSelections` fields. |
| `src/cli/lib/installation/installation.ts` | Keep `InstallScope` and `InstallMode` type exports (still used). Update install detection to derive mode from skills array. |

### Wizard & UI

| File | Change |
|------|--------|
| `src/cli/stores/wizard-store.ts` | Add `scopeSelections`, `toggleSkillScope`, `getScopeForSkill`. Remove `installScope`, `toggleInstallScope`, `toggleInstallMode`. Keep `sourceSelections` (internal wizard state). |
| `src/cli/components/wizard/wizard.tsx` | Remove `G` handler (lines 150-152). Add `S` handler gated on `step === "build"`. Update `WizardResultV2` type (replace `selectedSkills`/`sourceSelections`/`installMode`/`installScope` with `skills: SkillConfig[]`). Update `handleComplete` to build `SkillConfig[]`. Remove `initialInstallScope` prop. |
| `src/cli/components/wizard/wizard-layout.tsx` | Remove `G` badge (lines 144-148). Add `S scope` badge visible on build step. |
| `src/cli/components/wizard/help-modal.tsx` | Remove `G` from `GLOBAL_TOGGLES` (lines 22-28). Add `S` to `BUILD_KEYS`. |
| `src/cli/components/wizard/category-grid.tsx` | Add scope prop to `SkillTag`. |
| `src/cli/components/wizard/step-build.tsx` | Add `S scope` to footer hint text. |
| `src/cli/components/wizard/step-confirm.tsx` | Remove `installScope` prop. Update scope display to per-skill summary ("Scope: 15 project, 3 global"). Remove `installMode` prop or derive it from skills. |
| `src/cli/components/wizard/step-sources.tsx` | Update if it reads `installMode`/`installScope`. |
| `src/cli/components/hooks/use-wizard-initialization.ts` | Remove `initialInstallScope` handling. Add `scopeSelections` loading from config. |
| `src/cli/components/hooks/use-build-step-props.ts` | Pass scope data through to `CategoryGrid`. |

### Installation Pipeline

| File | Change |
|------|--------|
| `src/cli/lib/configuration/config-generator.ts` | Update `generateProjectConfigFromSkills()` to produce `SkillConfig[]`. |
| `src/cli/lib/installation/local-installer.ts` | Update `setConfigMetadata()` -- remove `sourceSelections` and `installMode` persistence. Update `buildLocalConfig()` to pass scope/source info. Route skills to correct directories by scope. |
| `src/cli/lib/configuration/config-merger.ts` | Add skills merge logic (by ID). New skills union with existing. Existing skills keep scope/source unless explicitly changed. |
| `src/cli/lib/configuration/config-types-writer.ts` | Update generated `ProjectConfig` interface -- `skills: SkillConfig[]`, emit `SkillConfig` type, remove `sourceSelections` and `installMode` fields. |
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
| `src/cli/stores/wizard-store.test.ts` | Rewrite `installScope`/`toggleInstallScope` tests. Add `scopeSelections`/`toggleSkillScope` tests. |
| `src/cli/components/wizard/step-confirm.test.tsx` | Update to use per-skill scope summary instead of single scope prop. |
| `src/cli/lib/configuration/__tests__/config-types-writer.test.ts` | Update `skills` assertions from ID array to object array. |
| `src/cli/lib/configuration/config-generator.test.ts` | Update `skills` assertions from ID array to object array. |
| `src/cli/lib/configuration/config-merger.test.ts` | Add skills merge tests (merge by ID). |
| `src/cli/lib/__tests__/integration/*.test.ts` | Update all `config.skills` assertions. |
| `src/cli/lib/__tests__/integration/install-mode.integration.test.ts` | Major rewrite -- `sourceSelections` removed from config, `installMode` derived. |
| `e2e/interactive/init-wizard.e2e.test.ts` | Remove global scope E2E test. |
| `e2e/**/*.test.ts` | Update config fixtures that include `skills` arrays. |

---

## 6. Open Questions

### Q1: Should scope default to "project" or be configurable?

**Decision: Always default to "project".** No configuration needed. Users toggle individual skills to global via the `S` hotkey.

### Q2: What about existing configs with the old format?

Not applicable. The project is pre-1.0 -- no backward-compatibility shims or migration code. Old configs will fail validation and users re-run `cc init`.

### Q3: How does `cc edit` detect scope changes?

Compare old and new `SkillConfig[]` entries by ID. If a skill's scope changed, trigger scope migration: uninstall from old scope, install at new scope. This extends the existing mode-migrator pattern.

### Q4: Should skill tags show scope only when mixed?

**Decision: Always show scope indicator on selected skills.** Users need to see what they are getting. The superscript characters (`\u1D3E`/`\u1D33`) are small enough to not add visual noise.
