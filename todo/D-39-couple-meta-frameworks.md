# D-39: Couple Meta-Frameworks with Base Frameworks

## Implementation Overview

**Blocked by D-38.** When a user selects a meta-framework (Next.js), auto-select the required base framework (React) and block deselection while dependents exist. Add `getAutoSelectTargets()` to `matrix-resolver.ts` — a pure function that follows AND-mode `requires` rules recursively within the same subcategory. The auto-select and deselect-blocking logic lives in `use-build-step-props.ts` (where the matrix is already available), wrapping the existing `onToggle` callback. Add a `requiredBy?: string` field to `CategoryOption` for visual feedback ("required by Next.js") in `SkillTag`. About 9 files changed. No config/schema changes — D-38 handles all `skills-matrix.yaml` changes.

## Open Questions (All Resolved)

1. **Auto-select vs validation-only vs hybrid?** When a user selects Next.js, should React be auto-selected immediately (Option B from D-38), or should the `requires` validation just flag it (Option A)?
   **RESOLVED:** Yes, auto-select the base framework when a meta-framework is selected. The base framework is just auto-selected silently -- it should be obvious to the user.

2. **Should the base framework show "(auto-selected)" or "(required by Next.js)" label?**
   **RESOLVED:** Show "required by X" on the auto-selected base framework skill tag.

3. **What about deselecting the base framework?** If the user selected Next.js (which auto-selected React), and then tries to deselect React: should it (a) block deselection, (b) also deselect Next.js, or (c) show a warning?
   **RESOLVED:** Block deselection. The base framework should NOT be deselectable when a meta-framework depends on it.

4. **Does `toggleTechnology` need access to the matrix?** Currently `toggleTechnology()` takes `(domain, subcategory, technology, exclusive)` -- it has no access to `MergedSkillsMatrix`. Auto-selection requires knowing the skill's `requires` rules. Either the store must receive the matrix, or the auto-select logic lives in the hook/component layer.
   **RESOLVED:** Yes, give the hook/logic access to the matrix if needed. The recommended approach (Phase 1) puts the auto-select logic in `use-build-step-props.ts` where the matrix is already available.

5. **Cross-category auto-selection?** When selecting Next.js (web-framework), should we also auto-select skills in other categories?
   **RESOLVED:** Out of scope for D-39. Don't worry about cross-category auto-selection for now.

6. **Skill content overlap problem (from D-38 TODO notes).** The React skill teaches generic React patterns including routing and data fetching, but when using Next.js, you want Next.js routing, not React Router. Is this a D-39 concern or a separate task?
   **RESOLVED:** Out of scope for D-39. This is a separate task. D-39 is about the coupling mechanism, not skill content optimization.

---

## Current State Analysis

### D-38 Foundation (prerequisite)

D-38 changes the framework category from exclusive to non-exclusive and adds granular conflict/requires rules. After D-38:

- `web-framework` has `exclusive: false` (checkbox behavior instead of radio)
- `mobile-framework` has `exclusive: false`
- `web-base-framework` and `mobile-platform` subcategory keys are removed
- All framework skills live in `web-framework` or `mobile-framework`
- Conflict rules prevent incompatible selections (e.g., React + Vue)
- `requires` rules exist: `nextjs-app-router` requires `[react]`, `remix` requires `[react]`, `nuxt` requires `[vue]`, etc.

### Existing Requires Mechanism

The system already has a complete `requires` mechanism:

**Matrix level** (`skills-matrix.yaml` `relationships.requires`):
- Each rule has `skill`, `needs: [...]`, optional `needsAny: true`, and `reason`
- Currently used for library-to-framework dependencies (zustand requires react/nextjs/remix via `needsAny`)
- After D-38, will also express meta-framework-to-base-framework dependencies

**Skill level** (`metadata.yaml` `requires` field):
- Per-skill requires declarations, merged into the matrix during `mergeMatrixWithSkills()`

**Resolution** (`matrix-resolver.ts`):
- `isDisabled()` (line 114-161): Checks if a skill has unmet requirements. For `needsAny`, at least one of the required skills must be selected. For AND mode, all must be selected. Returns `true` if the skill cannot be selected.
- `getDisableReason()` (line 175-224): Returns human-readable reason like "Next.js is built on React (requires React)"
- `validateRequirements()` (line 368-403): Validation pass that checks all selected skills have their requirements met
- `getDependentSkills()` (line 56-90): Given a skill, finds all currently selected skills that depend on it (used to check "can I safely deselect this?")

### Current Toggle Behavior

`toggleTechnology()` in `wizard-store.ts` (line 531-554):
- Takes `(domain, subcategory, technology, exclusive)`
- If `exclusive=true`: radio behavior (replace previous selection or clear)
- If `exclusive=false`: checkbox behavior (add/remove independently)
- **No access to the matrix** -- purely mechanical toggle
- **No auto-selection logic** -- just adds/removes from the array

`use-build-step-props.ts` (line 26-33):
- Wraps `toggleTechnology`, passing `cat?.exclusive ?? true` from the matrix category definition
- Has access to `matrix` (passed as prop)

`use-category-grid-input.ts` (line 138-145):
- Handles spacebar press: checks `currentOption.state !== "disabled"` before calling `onToggle`
- Does not check requires -- relies on `isDisabled()` having already computed the state

### What Happens TODAY After D-38 (Without D-39)

1. User sees all frameworks as checkboxes in `web-framework`
2. User selects `nextjs-app-router`
3. React appears as disabled (because requires are checked by `isDisabled()`) -- WAIT, this is WRONG.
4. Actually: `isDisabled()` checks if the CANDIDATE skill has unmet requirements. It does NOT check the reverse (i.e., it doesn't force selection of required skills). So after selecting Next.js:
   - Next.js is selected
   - React is NOT automatically selected
   - React shows as normal (selectable) -- it has no requirements of its own
   - If the user proceeds without selecting React, `validateRequirements()` on the confirm step will flag it: "Next.js requires React"
   - If the user tries to select a skill that requires React (like zustand), it will be disabled because neither react nor nextjs-app-router alone satisfies `needsAny: [react, nextjs-app-router, ...]` -- WAIT, zustand already lists `nextjs-app-router` in its `needsAny` list, so it would be satisfied.

**Key insight:** After D-38 with Option A (validation-only), the experience is:
- Select Next.js -> works fine
- Forget to select React -> validation error on confirm step
- Other React-ecosystem libraries (zustand, react-query) are selectable because they use `needsAny: [react, nextjs-app-router, ...]`
- The user may never realize they need React too until the confirm step

This is a poor UX. D-39 exists to fix it.

---

## Framework Coupling Map

(Identical to D-38 Section "Framework Compatibility Map", reproduced for reference)

| Meta-Framework | Base Framework | Requires Rule |
|---|---|---|
| Next.js (`nextjs-app-router`) | React (`react`) | `needs: [react]` |
| Remix (`remix`) | React (`react`) | `needs: [react]` |
| Nuxt (`nuxt`) | Vue (`vue`) | `needs: [vue]` |
| React Native (`react-native`) | React (`react`) | `needs: [react]` |
| Expo (`expo`) | React Native (`react-native`) | `needs: [react-native]` |
| Next.js Server Actions (`nextjs-server-actions`) | Next.js (`nextjs-app-router`) | `needs: [nextjs-app-router]` |

Note: `nextjs-server-actions` has `categoryExclusive: false` (it's an add-on, not a standalone framework pick).

---

## Design Options

### Option A: Validation-Only (D-38 Default)

**How it works:** Rely entirely on the existing `requires` validation. The user must manually select both Next.js and React. If they forget, `validateRequirements()` catches it on the confirm step.

**Pros:**
- Zero code changes beyond D-38
- Simple, predictable behavior

**Cons:**
- Poor UX: user may not understand why they need to also select React
- Validation error on confirm step feels like a gotcha
- Non-obvious coupling: nothing in the UI hints that Next.js needs React

**Verdict:** Insufficient for good UX. Not recommended for D-39.

---

### Option B: Auto-Select on Toggle (Recommended)

**How it works:** When the user selects a meta-framework, automatically also select its required base framework. When the user tries to deselect a base framework that has dependents, block the deselection (treat it as disabled/locked).

**UX flow:**
1. User selects `nextjs-app-router` -> React is auto-selected alongside it
2. React shows a visual indicator: "(required by Next.js)" label and/or locked border
3. User tries to deselect React while Next.js is selected -> no-op (blocked)
4. User deselects Next.js -> React becomes deselectable again (but stays selected; user can manually remove it)

**Pros:**
- Best UX: automatic and intuitive
- No gotcha on the confirm step
- Visual feedback explains why the base framework was added

**Cons:**
- Requires changes to `toggleTechnology()` or the hook layer
- Need to handle the "auto-selected" visual state
- Need to handle deselection blocking

**Verdict:** Recommended approach for D-39.

---

### Option C: Auto-Select with Cascade Deselect

**How it works:** Same as Option B for selection. For deselection: when deselecting a base framework, also deselect all meta-frameworks that depend on it.

**UX flow:**
1. User selects `nextjs-app-router` -> React is auto-selected
2. User deselects React -> Next.js is also deselected (cascade)

**Pros:**
- Clean deselection behavior

**Cons:**
- Surprising: user deselected one skill but another also disappeared
- Harder to reason about
- Edge case complexity: what if React was manually selected BEFORE Next.js?

**Verdict:** Too surprising. Option B (block deselection) is simpler and more predictable.

---

## Recommended Approach: Option B (Auto-Select + Block Deselect)

### UX Behavior

#### Selecting a meta-framework

1. User navigates to `nextjs-app-router` and presses Space
2. `nextjs-app-router` is selected (toggled on)
3. The `requires` rules for `nextjs-app-router` are checked: `needs: [react]`
4. `react` is automatically added to `domainSelections[web][web-framework]` if not already present
5. In the UI, React's tag shows with a special "required" visual state

#### Deselecting a base framework while dependents exist

1. React is selected (either manually or via auto-select)
2. Next.js is also selected
3. User navigates to React and presses Space
4. `getDependentSkills("react", currentSelections, matrix)` returns `["nextjs-app-router"]`
5. Since dependents exist, the deselection is blocked (no-op)
6. The "required" label on React already explains why: "(required by Next.js)"

#### Deselecting a meta-framework

1. Next.js is selected, React was auto-selected alongside it
2. User navigates to Next.js and presses Space
3. Next.js is deselected
4. React remains selected (user can now deselect it manually if desired)
5. React's "required" label disappears (no more dependents)

#### Chain dependencies

1. User selects Expo
2. Auto-select: React Native (Expo requires React Native)
3. Auto-select: React (React Native requires React)
4. All three are selected; React and React Native show "required" labels
5. Deselecting Expo: React Native and React remain selected but become freely deselectable
6. Deselecting React Native while Expo is selected: blocked

---

## Step-by-Step Implementation Plan

### Phase 1: Add matrix access to toggle logic

The auto-select logic needs access to `MergedSkillsMatrix` to look up `requires` rules. Two approaches:

**Approach 1a: Move auto-select logic into `use-build-step-props.ts`** (Recommended)

The hook already has access to `matrix`. Instead of putting logic in the store, wrap the `onToggle` callback:

```typescript
// In use-build-step-props.ts
const onToggle = useCallback(
  (subcategoryId, techId) => {
    const domain = store.getCurrentDomain() || "web";
    const cat = matrix.categories[subcategoryId];
    const exclusive = cat?.exclusive ?? true;

    // Auto-select: when selecting a skill, also select its requirements
    const skillId = resolveAlias(techId, matrix);
    const skill = matrix.skills[skillId];
    const currentSelections = store.domainSelections[domain]?.[subcategoryId] || [];
    const isDeselecting = currentSelections.includes(techId);

    if (!isDeselecting && skill && !exclusive) {
      // Selecting: auto-select required skills in same subcategory
      const autoSelectIds = getAutoSelectTargets(skillId, matrix, subcategoryId);
      store.toggleTechnology(domain, subcategoryId, techId, exclusive);
      for (const autoId of autoSelectIds) {
        const existing = store.domainSelections[domain]?.[subcategoryId] || [];
        if (!existing.includes(autoId)) {
          store.toggleTechnology(domain, subcategoryId, autoId, false);
        }
      }
    } else if (isDeselecting) {
      // Deselecting: check for dependents
      const allSelections = store.getAllSelectedTechnologies();
      const dependents = getDependentSkills(techId, allSelections, matrix);
      if (dependents.length > 0) {
        return; // Block deselection
      }
      store.toggleTechnology(domain, subcategoryId, techId, exclusive);
    } else {
      store.toggleTechnology(domain, subcategoryId, techId, exclusive);
    }
  },
  [store, matrix],
);
```

**Approach 1b: Pass matrix to the store**

Add a `matrix` parameter to `toggleTechnology()`. This changes the store signature and all call sites.

**Recommendation:** Approach 1a. It keeps the store simple (mechanical toggle) and puts the intelligence in the hook where the matrix is already available. This follows the existing pattern where `use-build-step-props.ts` already wraps store actions with matrix-aware logic.

### Phase 2: Auto-select helper function

Create a pure function that computes which skills should be auto-selected. This function goes in `matrix-resolver.ts` (not a new file) since all related dependency logic (`isDisabled`, `getDependentSkills`, `validateRequirements`) already lives there.

```typescript
// In matrix-resolver.ts
export function getAutoSelectTargets(
  skillId: SkillId,
  matrix: MergedSkillsMatrix,
  subcategory: Subcategory,
): SkillId[] {
  const skill = matrix.skills[skillId];
  if (!skill) return [];

  const directTargets = skill.requires
    .filter((req) => !req.needsAny)
    .flatMap((req) => req.skillIds)
    .filter((reqId) => matrix.skills[reqId]?.category === subcategory);

  // Recursively collect requirements of the direct targets
  const recursiveTargets = directTargets.flatMap((reqId) =>
    getAutoSelectTargets(reqId, matrix, subcategory),
  );

  return unique([...directTargets, ...recursiveTargets]);
}
```

Key decisions:
- Only AND-mode requirements (`!needsAny`): if a skill needs "react OR vue", we cannot auto-select one
- Only same-subcategory: auto-selecting across categories would be confusing (e.g., we should NOT auto-select zustand just because it recommends react). The `requires` rules for meta-frameworks point to base frameworks in the same `web-framework` category, so this naturally scopes to framework coupling.
- Recursive: Expo -> React Native -> React chains work correctly

### Phase 3: Block deselection of required skills

Modify the toggle logic to check `getDependentSkills()` before allowing deselection:

**In `use-build-step-props.ts`:**
- Before deselecting a skill, call `getDependentSkills(skillId, allSelections, matrix)`
- If the result is non-empty, block the deselection (return without calling store)
- The skill already shows a disabled/required reason via `getDisableReason()` or a new "required by" label

**In `use-category-grid-input.ts`:**
- The space handler already checks `currentOption.state !== "disabled"` (line 141)
- If we make auto-selected/required skills show `state: "disabled"` (or a new state), the grid input naturally blocks them
- Alternative: add a new state `"required"` to `OptionState` -- but this adds complexity. Simpler to just handle it in the `onToggle` callback.

### Phase 4: Visual indicator for auto-selected skills

Two options for UX:

**Option 4a: Use existing "disabled" state with a custom reason**

When a skill is auto-selected due to a requirement, compute its state as "disabled" with reason "Required by Next.js". The skill tag shows as selected + dimmed + "(required by Next.js)" label.

Downside: "disabled" semantics are wrong -- the skill IS selected, it's just not user-deselectable.

**Option 4b: Add a "required" visual indicator** (Recommended)

Add a `requiredBy` field to `CategoryOption`. The **type definition** lives in `category-grid.tsx` (where `CategoryOption` is defined, lines 12-20). The **computation** of the `requiredBy` value lives in `build-step-logic.ts` (which builds `CategoryOption[]` objects and already imports `CategoryOption` from `category-grid.tsx`).

```typescript
// In category-grid.tsx (type definition)
export type CategoryOption = {
  id: SkillId;
  label: string;
  state: OptionState;
  stateReason?: string;
  selected: boolean;
  local?: boolean;
  installed?: boolean;
  requiredBy?: string; // NEW: e.g., "Next.js"
};
```

In `build-step-logic.ts` (computation), when building `CategoryOption[]`:
- For each selected skill, check if any other selected skill in the same category requires it
- If yes, populate `requiredBy` with the dependent skill's display name

In `category-grid.tsx` `SkillTag` (rendering):
- If `option.requiredBy` is set, show "(required by X)" label
- Use a distinct visual style (e.g., selected color + lock icon or dimmed text)

In `use-category-grid-input.ts`:
- When space is pressed on a skill with `requiredBy` set, treat it as a no-op (same as disabled)

### Phase 5: Handle `populateFromStack` and `populateFromSkillIds`

These functions pre-populate wizard state from existing data. After D-38, stacks already include both base and meta framework skills in the `web-framework` array. No auto-select logic is needed here -- the data already contains both skills.

**However**, the `requiredBy` visual indicator still needs to be computed at render time, regardless of how the skills were populated. This is handled in Phase 4's `buildCategoriesForDomain()` logic.

### Phase 6: Cross-category auto-selection (OUT OF SCOPE)

**Explicitly out of scope for D-39.** Some `requires` rules cross categories (e.g., `shadcn-ui` in `web-ui-components` requires `tailwind` in `web-styling`). D-39 does NOT auto-select across categories -- only within the same subcategory. Cross-category requirements continue to use validation-only (confirm step error).

This is intentional: auto-selecting a skill in a different category section that the user hasn't even looked at yet would be confusing. This may be revisited in a future task if the UX warrants it.

---

## Edge Cases

### 1. Manually selecting the base framework BEFORE the meta-framework

**Scenario:** User selects React first, then selects Next.js.
**Expected:** React was already selected. Next.js is added. React now shows "(required by Next.js)" label and becomes non-deselectable.
**Implementation:** The auto-select logic checks `if (!existing.includes(autoId))` before adding, so no duplicate. The `requiredBy` label is computed at render time, so it appears immediately.

### 2. Two meta-frameworks requiring the same base

**Scenario:** User selects Remix (auto-selects React), then selects Next.js.
**Expected:** This should be blocked by conflict rules -- D-38 adds a conflict between Remix and Next.js. So this scenario cannot occur.
**If conflicts are somehow bypassed (expert mode):** React shows "(required by Remix, Next.js)" or just "(required)". Deselecting either meta-framework alone doesn't free React.

### 3. Chain dependencies: Expo -> React Native -> React

**Scenario:** User selects Expo.
**Expected:** React Native is auto-selected (Expo requires it). React is auto-selected (React Native requires it). All three in `web-framework` (after D-38 merges mobile skills there -- or in `mobile-framework` if kept separate per D-38's recommendation to keep mobile-framework separate).
**If mobile-framework stays separate:** Expo auto-selects React Native (same category). React is in `web-framework` (different category), so it is NOT auto-selected. Validation on confirm step catches it.
**Open question:** Should D-39 also auto-select across categories for the specific case of mobile-framework -> web-framework (React Native needs React)? This is the one case where cross-category auto-select might be needed. Recommendation: defer. The user selecting the mobile domain likely also selects the web domain and picks React there.

### 4. Expert mode

**Current behavior:** Expert mode bypasses `isDisabled()` checks. Should it also bypass auto-select?
**Recommendation:** Yes. In expert mode, `toggleTechnology` should work as a simple toggle without auto-selection or deselect blocking. Expert users know what they are doing.

### 5. Edit wizard pre-population

**Scenario:** User runs `cc edit` on a project that has Next.js but NOT React (theoretically possible if manually configured).
**Expected:** `populateFromSkillIds()` loads the existing config as-is. The `requiredBy` indicator is computed at render time. React does not magically appear (it's not in the config). Validation will flag the missing requirement if the user tries to proceed.
**No auto-selection during population:** Auto-select only fires on interactive toggle, not on bulk population. This prevents surprises when loading existing configs.

### 6. Stack population

**Scenario:** User selects a stack that includes Next.js and React.
**Expected:** Both are populated from the stack definition. `requiredBy` computed at render time.
**Scenario:** User selects a stack that includes Next.js but NOT React (malformed stack).
**Expected:** Only Next.js is populated. Validation catches the missing requirement on confirm step. If the user enters the build step to customize, they see React as selectable (not auto-selected, because auto-select only fires on interactive toggle).

---

## Test Plan

### Unit Tests

**`matrix-resolver.ts`:**
1. `getAutoSelectTargets("nextjs-app-router", matrix, "web-framework")` returns `["web-framework-react"]`
2. `getAutoSelectTargets("nuxt", matrix, "web-framework")` returns `["web-framework-vue-composition-api"]`
3. `getAutoSelectTargets("expo", matrix, "mobile-framework")` returns `["mobile-framework-react-native"]` (assuming same category)
4. `getAutoSelectTargets("expo", matrix, "mobile-framework")` with chain: if react-native requires react AND react is in a different category, returns only `["mobile-framework-react-native"]` (no cross-category)
5. `getAutoSelectTargets("react", matrix, "web-framework")` returns `[]` (base frameworks have no requirements)
6. `getAutoSelectTargets("zustand", matrix, "web-client-state")` returns `[]` (needsAny requirements are not auto-selected)
7. Expert mode: verify auto-select is skipped

**`getDependentSkills()` (existing function, new test cases):**
8. `getDependentSkills("react", ["react", "nextjs-app-router"], matrix)` returns `["nextjs-app-router"]`
9. `getDependentSkills("react", ["react"], matrix)` returns `[]` (no dependents)
10. `getDependentSkills("react", ["react", "nextjs-app-router", "remix"], matrix)` returns `["nextjs-app-router", "remix"]`

### Component/Hook Tests

**`use-build-step-props.ts`:**
11. Selecting Next.js also selects React in the store
12. Selecting React alone does not auto-select anything
13. Deselecting React while Next.js is selected: store unchanged (blocked)
14. Deselecting Next.js: works, React remains selected
15. Deselecting React after Next.js is deselected: works

**`build-step-logic.ts`:**
16. `CategoryOption` for React has `requiredBy: "Next.js"` when Next.js is selected
17. `CategoryOption` for React has no `requiredBy` when only React is selected
18. `CategoryOption` for Vue has `requiredBy: "Nuxt"` when Nuxt is selected

### Integration Tests

19. Full wizard flow: select Next.js -> verify React auto-selected -> proceed to confirm -> no validation errors
20. Full wizard flow: select Next.js -> deselect Next.js -> deselect React -> verify both removed
21. Stack population with Next.js + React: both present, React shows "required by" indicator

---

## Files Changed Summary

| File | Action | Purpose |
|---|---|---|
| `src/cli/lib/matrix/matrix-resolver.ts` | Modified | Add `getAutoSelectTargets()` function |
| `src/cli/components/hooks/use-build-step-props.ts` | Modified | Wrap `onToggle` with auto-select and deselect-blocking logic |
| `src/cli/lib/wizard/build-step-logic.ts` | Modified | Compute `requiredBy` field on `CategoryOption` |
| `src/cli/components/wizard/category-grid.tsx` | Modified | Add `requiredBy` to `CategoryOption` type, render "(required by X)" label, block space on required skills |
| `src/cli/components/hooks/use-category-grid-input.ts` | Modified | Check `requiredBy` in space handler to block deselection |
| `src/cli/lib/matrix/matrix-resolver.test.ts` | Modified | Add tests for `getAutoSelectTargets()` |
| `src/cli/components/hooks/use-build-step-props.test.ts` | New or modified | Tests for auto-select and deselect-blocking |
| `src/cli/lib/wizard/build-step-logic.test.ts` | Modified | Tests for `requiredBy` computation |
| `src/cli/components/wizard/category-grid.test.tsx` | Modified | Tests for "required by" rendering |

**No config changes** -- D-38 handles all `skills-matrix.yaml` and `stacks.yaml` changes. D-39 is purely wizard behavior.

**No type system changes** -- the `requiredBy?: string` addition to `CategoryOption` is a minor type extension in an existing component file.

---

## Execution Order

1. **D-38 must be completed first.** D-39 depends on `web-framework` being non-exclusive with proper `requires` rules.
2. **Phase 1:** Add matrix access to toggle logic -- wrap `onToggle` in `use-build-step-props.ts` with auto-select + deselect-blocking
3. **Phase 2:** Add `getAutoSelectTargets()` helper to `matrix-resolver.ts`
4. **Phase 3:** Block deselection of required skills (deselect-blocking logic in `use-build-step-props.ts`)
5. **Phase 4:** Add `requiredBy` visual indicator -- type change in `category-grid.tsx`, computation in `build-step-logic.ts`, rendering in `SkillTag`, space handler in `use-category-grid-input.ts`
6. **Phase 5:** Handle `populateFromStack` and `populateFromSkillIds` (verify no changes needed)
7. **Phase 6 (out of scope):** Cross-category auto-selection -- deferred, not part of D-39
8. **Update tests** for all phases
9. **Verify:** `npx tsc --noEmit` + `npm test`
