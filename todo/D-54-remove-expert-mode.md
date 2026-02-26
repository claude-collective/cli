# D-54: Remove Expert Mode

**Status:** Refinement complete, ready for implementation
**Complexity:** Medium (mechanical removal + one behavioral change in matrix-resolver)
**Estimated files changed:** ~25 production + ~10 test files

## Implementation Overview

Delete `expertMode` from the entire codebase (~18 production files, ~10 test files). The key behavioral change: `isDisabled()` (hard block on conflicting/unmet-requirement skills) is replaced by expanding `isDiscouraged()` to also cover conflicts and requirements — skills show a yellow warning but remain selectable. Selection counters become always-visible. The "E" keyboard toggle, store state, config persistence, Zod schemas, JSON schema, and all prop threading are removed. `validateSelection()` on the confirm step remains as a safety net. Mostly mechanical deletions with one logic merge in `matrix-resolver.ts`.

---

## Summary

Expert mode is a feature toggle in the wizard that bypasses skill conflict/requirement constraints and hides selection counters in the category grid. The plan:

1. **Remove all `expertMode` references** -- the concept is deleted entirely
2. **Replace `disabled` state with `discouraged`** -- conflicting/unmet-requirement skills show a yellow warning instead of being grayed out and unselectable
3. **Selection counters always visible** -- the `(1 of 1)` / `(2 selected)` counters are always shown
4. **`init` behaves identically to `edit`** -- no special simplified UX for the init command
5. **Mutual exclusion handled by `exclusive` categories** -- already exists on `CategoryDefinition`

The mental model: expert mode is just always on. All skills are always selectable. Conflicts and unmet requirements produce warnings (`discouraged` state), not hard blocks (`disabled` state).

---

## Design Decisions (Resolved)

### D1: Constraint handling -- `discouraged`, not `disabled`

Instead of deleting `isDisabled()` and making all skills show as `normal`, we **repurpose the conflict/requirement checks to produce `discouraged` state**. This means:

- Skills with active conflicts: shown as `discouraged` (yellow warning, still selectable)
- Skills with unmet requirements: shown as `discouraged` (yellow warning, still selectable)
- The `disabled` state (`OptionState = "disabled"`) is removed entirely from the codebase
- `validateSelection()` remains unchanged as the safety net at the confirm step

**Why discouraged instead of disabled:** The `discouraged` concept already exists in the matrix relationships (`discourages` field on skills). It shows a yellow warning but lets the user select the skill. This is exactly the right UX for conflicts and unmet requirements -- inform the user, don't block them.

**Why not just delete everything and show all as `normal`:** That would lose useful information. If two skills conflict, the user should see a warning when one is already selected. `discouraged` provides that warning without preventing selection.

### D2: Selection counters -- always visible

The `(1 of 1)` / `(2 selected)` counters are always displayed. They are useful visual feedback for how many skills are selected in each category. The previous behavior of hiding them in expert mode is removed.

### D3: `init` command -- no special behavior

The `init` command previously auto-enabled expert mode when `--source` was used. After this change, there is no special behavior -- `init` and `edit` pass the same props to `<Wizard>`. The `initialExpertMode` prop is removed entirely.

### D4: Exclusive categories handle mutual exclusion

The `exclusive` field on `CategoryDefinition` already enforces single-selection behavior (radio vs checkbox). This is the correct mechanism for categories where only one skill should be selected. No new code needed.

---

## What Changes vs. Previous Plan

The previous plan was to **delete `isDisabled()` entirely** and hardcode `disabled: false` for all skills. The updated plan is more nuanced:

| Aspect | Previous Plan | Updated Plan |
|--------|---------------|--------------|
| `isDisabled()` function | DELETE entirely | **REPURPOSE**: rename to extend `isDiscouraged()` to also check conflicts/requirements |
| `getDisableReason()` function | DELETE entirely | **REPURPOSE**: merge logic into `getDiscourageReason()` |
| `disabled` field on `SkillOption` | Always `false` | **REMOVE**: delete from `SkillOption` type entirely |
| `disabledReason` field on `SkillOption` | Always `undefined` | **REMOVE**: delete from `SkillOption` type entirely |
| `OptionState` union | Keep `"disabled"` variant (unused) | **REMOVE `"disabled"` variant** from union |
| `isCategoryAllDisabled()` | Always return `{ disabled: false }` | **DELETE**: no skills are ever disabled, so "all disabled" is impossible |
| Selection counters | Hide (hardcode `null`) | **ALWAYS SHOW** (remove the conditional) |
| `discouraged` state | Unchanged | **EXPANDED**: now also covers conflicts and unmet requirements |

---

## Current State Analysis

### What `isDisabled()` currently checks (matrix-resolver.ts:114-161)

The function returns `true` (skill is unselectable) when:

1. **Conflict check:** The skill has a `conflictsWith` entry matching a currently selected skill (bidirectional -- checks both directions)
2. **Requirement check (AND mode):** The skill has `requires` entries where ALL required skills must be selected, and some are missing
3. **Requirement check (OR/needsAny mode):** The skill has `requires` entries where ANY one of the alternatives must be selected, and none are

### What `isDiscouraged()` currently checks (matrix-resolver.ts:226-252)

The function returns `true` (skill shows yellow warning) when:

- The skill has a `discourages` entry matching a currently selected skill (bidirectional)

### How these will be merged

After the change, `isDiscouraged()` will check ALL of:
1. Existing `discourages` relationships (unchanged)
2. `conflictsWith` relationships (moved from `isDisabled()`)
3. Unmet `requires` dependencies (moved from `isDisabled()`)

Similarly, `getDiscourageReason()` will be expanded to return reasons for conflicts and unmet requirements, not just discouragement relationships.

### Every file that references `expertMode`

(Unchanged from previous analysis -- same 14 production files + 10 test files. See file reference table below.)

#### Production Files (14 files)

| File | Line(s) | What it does |
|------|---------|--------------|
| `src/cli/stores/wizard-store.ts` | 170, 291-292, 419, 580 | State field (`expertMode: boolean`), initial value (`false`), `toggleExpertMode` action |
| `src/cli/types/config.ts` | 61-66 | `expertMode?: boolean` field on `ProjectConfig` type |
| `src/cli/lib/schemas.ts` | 498-499, 534-535 | Zod schemas: `expertMode: z.boolean().optional()` in both `projectConfigSchema` and `projectConfigValidationSchema` |
| `src/schemas/project-config.schema.json` | 38-40 | JSON Schema: `"expertMode": { "type": "boolean" }` |
| `src/cli/commands/init.tsx` | 118 | `initialExpertMode={!!flags.source}` -- auto-enables when `--source` flag is used |
| `src/cli/commands/edit.tsx` | 128 | `initialExpertMode={projectConfig?.config?.expertMode}` -- restores from saved config |
| `src/cli/components/wizard/wizard.tsx` | 34, 53, 72, 91, 148, 194 | `WizardResultV2.expertMode`, `WizardProps.initialExpertMode`, key "e"/"E" handler calling `toggleExpertMode`, includes in result |
| `src/cli/components/wizard/step-build.tsx` | 25, 58, 74, 127 | `StepBuildProps.expertMode`, passes to `useFrameworkFiltering` and `CategoryGrid` |
| `src/cli/components/wizard/category-grid.tsx` | 35, 156, 167, 171, 213, 361 | `CategoryGridProps.expertMode`, `CategorySectionProps.expertMode`, hides selection counter |
| `src/cli/components/wizard/wizard-layout.tsx` | 121 | Status bar: `<DefinitionItem label="Expert mode" values={["E"]} isActive={store.expertMode} />` |
| `src/cli/components/wizard/help-modal.tsx` | 25 | Help text: `{ key: "E", description: "Toggle expert mode" }` |
| `src/cli/components/hooks/use-build-step-props.ts` | 54 | Passes `store.expertMode` to `StepBuildProps` |
| `src/cli/components/hooks/use-framework-filtering.ts` | 15, 24, 34, 38 | `expertMode` in options type, passed to `buildCategoriesForDomain()` |
| `src/cli/components/hooks/use-wizard-initialization.ts` | 9, 23, 44-45 | `initialExpertMode` prop, sets `expertMode` in store on init |
| `src/cli/lib/matrix/matrix-resolver.ts` | 93, 120, 545, 617, 626 | `SkillCheckOptions.expertMode`, bypasses constraints in `isDisabled()`, `getAvailableSkills()`, `isCategoryAllDisabled()` |
| `src/cli/lib/wizard/build-step-logic.ts` | 117, 137 | `expertMode` param in `buildCategoriesForDomain()`, passes to `getAvailableSkills()` |
| `src/cli/lib/installation/local-installer.ts` | 265-268 | Persists `expertMode: true` to project config YAML |

#### Test Files (10 files)

| File | What's tested |
|------|---------------|
| `src/cli/stores/wizard-store.test.ts` | Initial state, toggleExpertMode on/off, reset clears expertMode |
| `src/cli/lib/matrix/matrix-resolver.test.ts` | Expert mode bypasses conflicts (P1-23), bypasses isDisabled, bypasses isCategoryAllDisabled, still validates |
| `src/cli/components/wizard/category-grid.test.tsx` | expertMode prop in renderGrid, sort order preservation, counter hiding |
| `src/cli/components/wizard/step-build.test.tsx` | expertMode prop passthrough to CategoryGrid |
| `src/cli/lib/installation/local-installer.test.ts` | `expertMode: false` in mock wizard result |
| `src/cli/lib/__tests__/helpers.ts` | `expertMode: false` in `buildWizardResult()` and `buildWizardResultFromStore()` factories |
| `src/cli/lib/__tests__/integration/init-end-to-end.integration.test.ts` | Expert mode persistence to config |
| `src/cli/lib/__tests__/integration/wizard-flow.integration.test.tsx` | "E" keyboard toggle, expertMode in result |

---

## Removal Plan

For each reference, the action is **REMOVE** (delete the code), **REPURPOSE** (change behavior), or **SIMPLIFY** (remove conditional).

### Matrix Resolver -- REPURPOSE (conflicts/requirements become discouraged)

| Location | Action |
|----------|--------|
| `SkillCheckOptions` type (line 93) | **DELETE** the type entirely. It has only one field (`expertMode`). |
| `isDisabled()` function (line 114) | **DELETE** the function. Its conflict/requirement logic is merged into `isDiscouraged()`. |
| `getDisableReason()` function (line 175) | **DELETE** the function. Its logic is merged into `getDiscourageReason()`. |
| `isDiscouraged()` function (line 226) | **EXPAND**: add conflict checks (from `isDisabled()`) and unmet-requirement checks (from `isDisabled()`). |
| `getDiscourageReason()` function (line 254) | **EXPAND**: add conflict and requirement reason messages (from `getDisableReason()`). |
| `isCategoryAllDisabled()` function (line 620) | **DELETE** entirely. No skills are ever disabled, so "all disabled" is impossible. |
| `getAvailableSkills()` (line 548) | **SIMPLIFY**: Remove `options` parameter. Remove `isDisabled()` call. Remove `disabled`/`disabledReason` from the returned objects. The `discouraged` check now covers conflicts and requirements too. |

**Detailed approach for matrix-resolver:**

1. **DELETE `SkillCheckOptions` type.** Only field was `expertMode`.
2. **DELETE `isDisabled()` function.** Zero callers after changes.
3. **DELETE `getDisableReason()` function.** Zero callers after changes.
4. **DELETE `isCategoryAllDisabled()` function.** Concept no longer exists.
5. **EXPAND `isDiscouraged()`** to also check:
   - `conflictsWith` relationships (bidirectional, same logic as old `isDisabled()`)
   - Unmet `requires` dependencies (AND mode and OR/needsAny mode, same logic as old `isDisabled()`)
6. **EXPAND `getDiscourageReason()`** to also return reasons for:
   - Conflicts: `"Incompatible (conflicts with React)"` (same format as old `getDisableReason()`)
   - Unmet requirements: `"Requires TypeScript (requires TypeScript)"` (same format)
7. **UPDATE `getAvailableSkills()`**:
   - Remove `options` parameter
   - Remove `isDisabled()` call and `disabled`/`disabledReason` fields
   - The `discouraged` call now returns `true` for conflicts and unmet requirements too
   - The priority chain simplifies: `discouraged` > `recommended` > `normal` (no `disabled`)

### Wizard Store -- REMOVE

| Location | Action |
|----------|--------|
| `expertMode: boolean` state (line 170) | REMOVE field |
| `expertMode: false` initial value (line 419) | REMOVE |
| `toggleExpertMode` action declaration (lines 291-292) | REMOVE |
| `toggleExpertMode` implementation (line 580) | REMOVE |

### Config Type -- REMOVE

| Location | Action |
|----------|--------|
| `expertMode?: boolean` on `ProjectConfig` (lines 61-66) | REMOVE field and JSDoc |

### Zod Schemas -- REMOVE

| Location | Action |
|----------|--------|
| `expertMode: z.boolean().optional()` in `projectConfigSchema` (line 499) | REMOVE |
| `expertMode: z.boolean().optional()` in `projectConfigValidationSchema` (line 535) | REMOVE |

### JSON Schema -- REMOVE

| Location | Action |
|----------|--------|
| `"expertMode": { "type": "boolean" }` (lines 38-40) | REMOVE |

### Commands -- REMOVE

| Location | Action |
|----------|--------|
| `init.tsx` -- `initialExpertMode={!!flags.source}` (line 118) | REMOVE prop |
| `edit.tsx` -- `initialExpertMode={projectConfig?.config?.expertMode}` (line 128) | REMOVE prop |

### Wizard Component -- REMOVE

| Location | Action |
|----------|--------|
| `WizardResultV2.expertMode` (line 34) | REMOVE field |
| `WizardProps.initialExpertMode` (line 53) | REMOVE prop |
| Destructuring `initialExpertMode` (line 72) | REMOVE |
| Passing to `useWizardInitialization` (line 91) | REMOVE |
| "e"/"E" key handler (lines 147-149) | REMOVE the handler |
| `expertMode: store.expertMode` in result (line 194) | REMOVE |

### StepBuild -- REMOVE

| Location | Action |
|----------|--------|
| `StepBuildProps.expertMode` (line 25) | REMOVE prop |
| Destructuring (line 58) | REMOVE |
| Passing to `useFrameworkFiltering` (line 74) | REMOVE |
| Passing to `CategoryGrid` (line 127) | REMOVE prop |

### CategoryGrid -- REMOVE + SIMPLIFY

| Location | Action |
|----------|--------|
| `CategoryGridProps.expertMode` (line 35) | REMOVE prop |
| `CategorySectionProps.expertMode` (line 156) | REMOVE prop |
| Destructuring in `CategorySection` (line 167) | REMOVE |
| `"disabled"` variant from `OptionState` union (line 10) | **REMOVE** -- `"disabled"` is no longer a valid state |
| `disabled: 3` from `STATE_PRIORITY` (line 56) | **REMOVE** |
| `"disabled"` checks in `SkillTag` (lines 101, 109, 110, 119, 120, 138) | **REMOVE** all `disabled` branches |
| Selection counter logic (line 171) | **SIMPLIFY**: remove the `expertMode` conditional, always show counters. The counter becomes: `category.exclusive ? \`(\${selectedCount} of 1)\` : \`(\${selectedCount} selected)\`` |
| Passing `expertMode` in `CategoryGrid` render (line 213, 361) | REMOVE |

### Wizard Layout -- REMOVE

| Location | Action |
|----------|--------|
| `<DefinitionItem label="Expert mode" ...>` (line 121) | REMOVE the entire `DefinitionItem` for expert mode |

### Help Modal -- REMOVE

| Location | Action |
|----------|--------|
| `{ key: "E", description: "Toggle expert mode" }` (line 25) | REMOVE entry |

### Use Build Step Props -- REMOVE

| Location | Action |
|----------|--------|
| `expertMode: store.expertMode` (line 54) | REMOVE |

### Use Framework Filtering -- REMOVE

| Location | Action |
|----------|--------|
| `expertMode: boolean` in type (line 15) | REMOVE |
| Destructuring (line 24) | REMOVE |
| Passing to `buildCategoriesForDomain` (line 34) | REMOVE |
| Dependency array (line 38) | REMOVE from deps |

### Use Wizard Initialization -- REMOVE

| Location | Action |
|----------|--------|
| `initialExpertMode?: boolean` (line 9) | REMOVE |
| Destructuring (line 23) | REMOVE |
| `if (initialExpertMode)` block (lines 44-46) | REMOVE |

### Build Step Logic -- REMOVE

| Location | Action |
|----------|--------|
| `expertMode: boolean` param (line 117) | REMOVE parameter |
| Passing to `getAvailableSkills` (line 137) | REMOVE -- pass no options (options param is deleted) |

### Local Installer -- REMOVE

| Location | Action |
|----------|--------|
| `if (wizardResult.expertMode)` block (lines 265-268) | REMOVE -- no longer persisting expertMode |

### Matrix Resolver Exports (index.ts) -- UPDATE

| Location | Action |
|----------|--------|
| `type SkillCheckOptions` export | REMOVE |
| `isDisabled` export | REMOVE |
| `getDisableReason` export | REMOVE |
| `isCategoryAllDisabled` export | REMOVE |

### SkillOption Type (types/matrix.ts) -- UPDATE

| Location | Action |
|----------|--------|
| `disabled: boolean` field (line 336) | REMOVE |
| `disabledReason?: string` field (line 338) | REMOVE |

---

## Step-by-Step Implementation Plan

### Phase 1: Transform matrix-resolver (core logic)

This is the only phase with behavioral changes (not just deletions).

1. **DELETE `SkillCheckOptions` type** from `matrix-resolver.ts`.
2. **DELETE `isDisabled()` function** from `matrix-resolver.ts`.
3. **DELETE `getDisableReason()` function** from `matrix-resolver.ts`.
4. **DELETE `isCategoryAllDisabled()` function** from `matrix-resolver.ts`.
5. **EXPAND `isDiscouraged()`**: Add conflict checks (bidirectional `conflictsWith` lookup) and unmet-requirement checks (AND mode and OR/needsAny mode). These are the same checks from the deleted `isDisabled()`, just producing `discouraged` instead of `disabled`.
6. **EXPAND `getDiscourageReason()`**: Add conflict reason messages and requirement reason messages. Same format as the deleted `getDisableReason()`.
7. **UPDATE `getAvailableSkills()`**: Remove `options` parameter. Remove `disabled`/`disabledReason` from skill options. The priority chain becomes: `discouraged` > `recommended` > `normal`.
8. **UPDATE `build-step-logic.ts`**: Remove `expertMode` parameter from `buildCategoriesForDomain()`. Remove options argument from `getAvailableSkills()` call.
9. **UPDATE `index.ts` exports**: Remove `SkillCheckOptions`, `isDisabled`, `getDisableReason`, `isCategoryAllDisabled`.

### Phase 2: Remove `disabled` from types and UI

10. **UPDATE `SkillOption` type** in `types/matrix.ts`: Remove `disabled` and `disabledReason` fields.
11. **UPDATE `OptionState` union** in `category-grid.tsx`: Remove `"disabled"` variant. Union becomes `"normal" | "recommended" | "discouraged"`.
12. **UPDATE `STATE_PRIORITY`** in `category-grid.tsx`: Remove `disabled: 3`. Priority becomes: `recommended: 0`, `normal: 1`, `discouraged: 2`.
13. **UPDATE `SkillTag`** in `category-grid.tsx`: Remove all `option.state === "disabled"` branches and `isLocked || option.state === "disabled"` checks.
14. **UPDATE `CategorySection`** in `category-grid.tsx`: Remove `expertMode` prop. Always show selection counter (remove conditional, just compute the counter string directly).

### Phase 3: Remove from wizard store and config types

15. **Remove `expertMode` field** from `WizardState` type in `wizard-store.ts`
16. **Remove `expertMode: false`** from `createInitialState()`
17. **Remove `toggleExpertMode`** action declaration and implementation
18. **Remove `expertMode?: boolean`** from `ProjectConfig` in `config.ts`

### Phase 4: Remove from schemas

19. **Remove `expertMode`** from `projectConfigSchema` in `schemas.ts`
20. **Remove `expertMode`** from `projectConfigValidationSchema` in `schemas.ts`
21. **Remove `expertMode`** from `project-config.schema.json`

### Phase 5: Remove from UI components

22. **CategoryGrid**: Remove `expertMode` prop from `CategoryGridProps` and `CategorySectionProps`.
23. **StepBuild**: Remove `expertMode` from `StepBuildProps`, stop passing to `CategoryGrid` and `useFrameworkFiltering`.
24. **Wizard**: Remove `initialExpertMode` prop from `WizardProps`, remove from `WizardResultV2`, remove "e"/"E" key handler, remove from result object.
25. **WizardLayout**: Remove the expert mode `DefinitionItem` from status bar.
26. **HelpModal**: Remove "E - Toggle expert mode" entry from `GLOBAL_TOGGLES`.

### Phase 6: Remove from hooks

27. **use-build-step-props.ts**: Remove `expertMode` from returned props.
28. **use-framework-filtering.ts**: Remove `expertMode` from options type and params, stop passing to `buildCategoriesForDomain()`.
29. **use-wizard-initialization.ts**: Remove `initialExpertMode` from options type and initialization logic.

### Phase 7: Remove from commands and installer

30. **init.tsx**: Remove `initialExpertMode` prop from `<Wizard>`.
31. **edit.tsx**: Remove `initialExpertMode` prop from `<Wizard>`.
32. **local-installer.ts**: Remove `if (wizardResult.expertMode)` config persistence block.

### Phase 8: Update tests

33. Update `wizard-store.test.ts`: Remove tests for `toggleExpertMode`, remove `expertMode` assertions from initial state and reset tests.
34. Update `matrix-resolver.test.ts`:
    - DELETE all tests for `isDisabled()` (function deleted)
    - DELETE all tests for `getDisableReason()` (function deleted)
    - DELETE all tests for `isCategoryAllDisabled()` (function deleted)
    - DELETE "expert mode on (P1-23)" test block
    - **ADD tests** for expanded `isDiscouraged()`: verify it returns `true` for conflicting skills and skills with unmet requirements
    - **ADD tests** for expanded `getDiscourageReason()`: verify it returns conflict/requirement reason messages
    - UPDATE `getAvailableSkills()` tests: remove `options` argument, verify no `disabled`/`disabledReason` in output, verify conflicting skills show as `discouraged: true`
35. Update `category-grid.test.tsx`: Remove `expertMode` from `renderGrid()` defaults and specific test cases. Remove "expert mode" describe block. Remove all `disabled` state references. Update tests to verify counters are always shown.
36. Update `step-build.test.tsx`: Remove `expertMode` from props, remove test "should pass expertMode to CategoryGrid".
37. Update `local-installer.test.ts`: Remove `expertMode` from mock wizard result.
38. Update `helpers.ts`: Remove `expertMode` from `buildWizardResult()` and `buildWizardResultFromStore()`.
39. Update integration tests: Remove expert mode assertions from `init-end-to-end.integration.test.ts` and `wizard-flow.integration.test.tsx`.

---

## Type/Schema Changes

### Types removed
- `expertMode: boolean` from `WizardState`
- `toggleExpertMode: () => void` from `WizardState`
- `expertMode?: boolean` from `ProjectConfig`
- `expertMode: boolean` from `WizardResultV2`
- `initialExpertMode?: boolean` from `WizardProps`
- `initialExpertMode?: boolean` from `UseWizardInitializationOptions`
- `expertMode: boolean` from `StepBuildProps`
- `expertMode: boolean` from `CategoryGridProps`
- `expertMode: boolean` from `CategorySectionProps`
- `expertMode: boolean` from `UseFrameworkFilteringOptions`
- `expertMode: boolean` param from `buildCategoriesForDomain()`
- `SkillCheckOptions` type (deleted entirely -- only field was `expertMode`)
- `options?: SkillCheckOptions` param from `getAvailableSkills()`, `isCategoryAllDisabled()`
- `disabled: boolean` from `SkillOption`
- `disabledReason?: string` from `SkillOption`
- `"disabled"` variant from `OptionState` union type

### Functions removed
- `isDisabled()` (logic merged into `isDiscouraged()`)
- `getDisableReason()` (logic merged into `getDiscourageReason()`)
- `isCategoryAllDisabled()` (concept no longer exists)

### Functions modified
- `isDiscouraged()` -- expanded to also check `conflictsWith` and `requires`
- `getDiscourageReason()` -- expanded to return conflict and requirement reasons
- `getAvailableSkills()` -- `options` param removed, `disabled`/`disabledReason` fields removed from output

### Schemas removed
- `expertMode: z.boolean().optional()` from `projectConfigSchema`
- `expertMode: z.boolean().optional()` from `projectConfigValidationSchema`
- `"expertMode": { "type": "boolean" }` from `project-config.schema.json`

---

## Config Migration

### Existing configs with `expertMode: true/false`

The `expertMode` field will be removed from the `ProjectConfig` type and both Zod schemas. Both schemas use `.passthrough()`, which means:

- **Parsing will NOT fail** if an existing config file has `expertMode: true`. The `.passthrough()` modifier allows unknown fields to pass through silently.
- The field will simply be ignored -- it won't be read by `edit.tsx` (the prop is removed), and it won't be written by `local-installer.ts` (the persistence block is removed).
- On the next `agentsinc edit` -> save cycle, the field will naturally be dropped from the config YAML because it's no longer written.

**No explicit migration code needed.** This is the correct approach per CLAUDE.md: "NEVER add backward-compatibility shims, migration code, or legacy fallbacks."

**For `projectConfigValidationSchema`** (used for JSON schema generation / strict IDE validation): removing the field means the strict schema will flag `expertMode` as an unknown property. This is acceptable -- it tells the user to remove the stale field.

---

## Test Impact

### Tests to DELETE entirely
- `wizard-store.test.ts`: "should have expert mode off" (initial state)
- `wizard-store.test.ts`: "should toggle expert mode on"
- `wizard-store.test.ts`: "should toggle expert mode off"
- `wizard-store.test.ts`: expertMode assertion in reset test
- `matrix-resolver.test.ts`: Entire "Conflicting skills with expert mode on (P1-23)" describe block (6+ tests)
- `matrix-resolver.test.ts`: All `isDisabled()` tests (function deleted)
- `matrix-resolver.test.ts`: All `getDisableReason()` tests (function deleted)
- `matrix-resolver.test.ts`: "isCategoryAllDisabled" describe block entirely (function deleted)
- `step-build.test.tsx`: "should pass expertMode to CategoryGrid"
- `step-build.test.tsx`: "should not handle expert mode toggle locally"
- `category-grid.test.tsx`: "expert mode" describe block
- `category-grid.test.tsx`: "should hide counter in expert mode"
- `category-grid.test.tsx`: All tests referencing `disabled` state
- `init-end-to-end.integration.test.ts`: "should set expertMode in config when wizard has it enabled"
- `wizard-flow.integration.test.tsx`: "should toggle expert mode via keyboard shortcut"
- `wizard-flow.integration.test.tsx`: expertMode assertions in result tests

### Tests to MODIFY
- `matrix-resolver.test.ts`: Remove `{ expertMode: true }` options argument from `getAvailableSkills()` tests. Remove `disabled`/`disabledReason` from assertions. Update tests to verify conflicting skills show as `discouraged: true` with appropriate reasons.
- `category-grid.test.tsx`: Remove `expertMode` from `renderGrid()` defaults. Remove `"disabled"` from any state assertions. Update sort order tests (no disabled state means sort priority changes). Verify counters are always shown.
- `step-build.test.tsx`: Default props -- remove `expertMode: false`
- `local-installer.test.ts`: Mock wizard result -- remove `expertMode: false`
- `helpers.ts`: `buildWizardResult()` -- remove `expertMode: false`
- `helpers.ts`: `buildWizardResultFromStore()` -- remove `expertMode: store.expertMode`

### Tests to ADD
- `isDiscouraged()` returns `true` when a conflicting skill is selected
- `isDiscouraged()` returns `true` when required skills are not selected (AND mode)
- `isDiscouraged()` returns `true` when no alternative required skills are selected (OR/needsAny mode)
- `getDiscourageReason()` returns conflict reason with context (e.g., "Incompatible (conflicts with React)")
- `getDiscourageReason()` returns requirement reason with context (e.g., "Needs TypeScript (requires TypeScript)")
- `getAvailableSkills()` marks conflicting skills as `discouraged: true` (not `disabled`)
- `getAvailableSkills()` marks skills with unmet requirements as `discouraged: true`
- Selection counters are always visible in CategoryGrid (no expert mode conditional)

---

## Files Changed Summary

### Production Files (~18 files)

| File | Change |
|------|--------|
| `src/cli/lib/matrix/matrix-resolver.ts` | DELETE `SkillCheckOptions`, `isDisabled()`, `getDisableReason()`, `isCategoryAllDisabled()`. EXPAND `isDiscouraged()` and `getDiscourageReason()`. UPDATE `getAvailableSkills()` |
| `src/cli/lib/matrix/index.ts` | Remove deleted exports, keep expanded exports |
| `src/cli/types/matrix.ts` | Remove `disabled`/`disabledReason` from `SkillOption` |
| `src/cli/lib/wizard/build-step-logic.ts` | Remove `expertMode` param from `buildCategoriesForDomain()` |
| `src/cli/stores/wizard-store.ts` | Remove `expertMode` state, `toggleExpertMode` action |
| `src/cli/types/config.ts` | Remove `expertMode` from `ProjectConfig` |
| `src/cli/lib/schemas.ts` | Remove `expertMode` from both schemas |
| `src/schemas/project-config.schema.json` | Remove `expertMode` property |
| `src/cli/commands/init.tsx` | Remove `initialExpertMode` prop |
| `src/cli/commands/edit.tsx` | Remove `initialExpertMode` prop |
| `src/cli/components/wizard/wizard.tsx` | Remove from props, result, key handler |
| `src/cli/components/wizard/step-build.tsx` | Remove `expertMode` prop |
| `src/cli/components/wizard/category-grid.tsx` | Remove `expertMode` prop, remove `"disabled"` from `OptionState`, always show counters |
| `src/cli/components/wizard/wizard-layout.tsx` | Remove expert mode status bar item |
| `src/cli/components/wizard/help-modal.tsx` | Remove "E" toggle entry |
| `src/cli/components/hooks/use-build-step-props.ts` | Remove `expertMode` from props |
| `src/cli/components/hooks/use-framework-filtering.ts` | Remove `expertMode` from options |
| `src/cli/components/hooks/use-wizard-initialization.ts` | Remove `initialExpertMode` |
| `src/cli/lib/installation/local-installer.ts` | Remove expertMode persistence |

### Test Files (~10 files)

| File | Change |
|------|--------|
| `src/cli/stores/wizard-store.test.ts` | Remove expertMode tests |
| `src/cli/lib/matrix/matrix-resolver.test.ts` | DELETE `isDisabled`/`getDisableReason`/`isCategoryAllDisabled` tests, ADD expanded `isDiscouraged`/`getDiscourageReason` tests, update `getAvailableSkills` assertions |
| `src/cli/components/wizard/category-grid.test.tsx` | Remove expertMode prop, remove disabled state tests, verify counters always shown |
| `src/cli/components/wizard/step-build.test.tsx` | Remove expertMode prop and tests |
| `src/cli/lib/installation/local-installer.test.ts` | Remove from mock data |
| `src/cli/lib/__tests__/helpers.ts` | Remove from factory functions |
| `src/cli/lib/__tests__/integration/init-end-to-end.integration.test.ts` | Remove expert mode test |
| `src/cli/lib/__tests__/integration/wizard-flow.integration.test.tsx` | Remove expert mode tests |

### Documentation Files (update if they reference expert mode)

| File | Change |
|------|--------|
| `.ai-docs/store-map.md` | Remove `toggleExpertMode` from actions list |
| `.ai-docs/features/wizard-flow.md` | Remove expert mode references |
| `.ai-docs/component-patterns.md` | Remove expertMode from CategoryGridProps, remove `"disabled"` from OptionState |

---

## Risk Assessment

**Low risk.** The behavioral change (conflicts/requirements become discouraged instead of disabled) is well-scoped:

- The `discouraged` concept and UX already exist and are well-tested
- The only new logic is adding conflict/requirement checks to `isDiscouraged()` and `getDiscourageReason()` -- these are direct copies of the logic from `isDisabled()` and `getDisableReason()`
- `validateSelection()` is UNAFFECTED -- it still catches conflicts at the confirm step as a safety net
- The `exclusive` field on categories already handles single-selection enforcement
- `.passthrough()` on Zod schemas means existing configs won't break
- Most changes are pure deletions

Key safety nets:
- `validateSelection()` catches conflicts at the confirm step (unchanged)
- `exclusive` categories enforce single-selection (unchanged)
- `discouraged` state shows visible warnings to the user (expanded to cover more cases)
