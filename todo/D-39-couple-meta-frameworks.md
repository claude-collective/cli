# D-39: Couple Meta-Frameworks with Base Frameworks

**Depends on:** D-38 (category split)

## Goal

When a user selects a meta-framework (Next.js), the required base framework (React) shows as dimmed with "required by Next.js" and cannot be deselected. This uses the same UX pattern as shadcn requiring Tailwind.

## Revised Approach (2026-03-16)

With D-38's category split (`web-framework` + `web-meta-framework`), most coupling is handled automatically by the existing `requires` mechanism:

- **Selection gating**: Next.js shows as dimmed/disabled until React is selected (`isDisabled()` already does this)
- **Disable reason**: "requires React" text already shown by `getDisableReason()`

What D-39 adds on top:

1. **"Required by X" label** — when Next.js IS selected, React shows "required by Next.js"
2. **Block deselection** — user cannot deselect React while Next.js depends on it
3. **Auto-select** (optional UX enhancement) — selecting Next.js auto-selects React if not already selected

### What Already Works After D-38 (No D-39 Changes Needed)

| Scenario                                         | Behavior                               | Mechanism                             |
| ------------------------------------------------ | -------------------------------------- | ------------------------------------- |
| React not selected, user tries to select Next.js | Next.js shows dimmed, "requires React" | `isDisabled()` + `getDisableReason()` |
| React selected, user selects Next.js             | Works normally                         | Standard toggle                       |
| Both selected, user deselects Next.js            | Next.js removed, React stays           | Standard toggle                       |

### What D-39 Adds

| Scenario                                          | Behavior                               | New Code Needed                                |
| ------------------------------------------------- | -------------------------------------- | ---------------------------------------------- |
| Both selected, user tries to deselect React       | **Blocked** — React stays selected     | Deselect-blocking in `use-build-step-props.ts` |
| Next.js selected, React shows label               | **"required by Next.js"** dimmed label | `requiredBy` field on `CategoryOption`         |
| User selects Next.js without React selected first | **React auto-selects**                 | Auto-select in `use-build-step-props.ts`       |

---

## Implementation

### Phase 1: "Required by X" Visual Label

Add `requiredBy?: string` to `CategoryOption` (in `category-grid.tsx`).

Compute it in `build-step-logic.ts`: for each selected skill, check if any selected skill in another category requires it via `requires` rules. If yes, populate `requiredBy` with the dependent skill's display name.

Render in `SkillTag`: if `requiredBy` is set, show dimmed selected state + "(required by X)" text. Same visual treatment as the existing shadcn→Tailwind pattern.

### Phase 2: Block Deselection

In `use-build-step-props.ts`, wrap the `onToggle` callback:

- Before deselecting a skill, call `getDependentSkills(skillId, allSelections, matrix)`
- If dependents exist, block the deselection (return without calling store)
- The `requiredBy` label already explains why it's locked

In `use-category-grid-input.ts`:

- Space handler on a skill with `requiredBy` set → no-op (same as disabled)

### Phase 3: Auto-Select (Optional Enhancement)

When a meta-framework is selected and its required base framework is NOT yet selected, auto-select the base framework. This handles the edge case where:

- User navigates to `web-meta-framework` first (if wizard allows non-linear navigation)
- Stack population includes a meta-framework without the base (malformed stack)

Add `getAutoSelectTargets()` to `matrix-resolver.ts`:

```typescript
export function getAutoSelectTargets(skillId: SkillId, matrix: MergedSkillsMatrix): SkillId[] {
  const skill = getSkillById(skillId);
  if (!skill) return [];

  // Only AND-mode requirements (not needsAny)
  return skill.requires.filter((req) => !req.needsAny).flatMap((req) => req.skillIds);
}
```

In `use-build-step-props.ts`, after toggling on a skill:

- Call `getAutoSelectTargets()` and auto-select any missing requirements
- Works cross-category (meta-framework → base framework)

### Phase 4: Expert Mode Bypass

In expert mode, skip auto-select and deselect-blocking. Expert users can make invalid selections intentionally.

---

## Edge Cases

| Scenario                                         | Behavior                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Select React first, then Next.js                 | React gets "required by Next.js" label, can't be deselected                              |
| Select Next.js without React (auto-select)       | React auto-selected in `web-framework`, dimmed with label                                |
| Deselect Next.js                                 | React stays selected, label removed, now freely deselectable                             |
| Select Expo (chain: Expo → React Native → React) | React Native auto-selected in `mobile-framework`, React auto-selected in `web-framework` |
| `cc edit` with Next.js but not React in config   | Loaded as-is, validation catches missing requirement on confirm step                     |
| Stack with Next.js + React                       | Both populated, `requiredBy` computed at render time                                     |

---

## Coupling Map

| Meta-Framework                     | Base Framework                      | Requires Rule                                |
| ---------------------------------- | ----------------------------------- | -------------------------------------------- |
| `web-framework-nextjs`             | `web-framework-react`               | `needs: [web-framework-react]`               |
| `web-framework-remix`              | `web-framework-react`               | `needs: [web-framework-react]`               |
| `web-framework-nuxt`               | `web-framework-vue-composition-api` | `needs: [web-framework-vue-composition-api]` |
| `web-framework-sveltekit` (future) | `web-framework-svelte`              | `needs: [web-framework-svelte]`              |
| `mobile-framework-expo`            | `mobile-framework-react-native`     | `needs: [mobile-framework-react-native]`     |
| `mobile-framework-react-native`    | `web-framework-react`               | `needs: [web-framework-react]`               |

---

## Files Changed

| File                                                  | Changes                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `src/cli/lib/matrix/matrix-resolver.ts`               | Add `getAutoSelectTargets()`                                |
| `src/cli/components/hooks/use-build-step-props.ts`    | Auto-select + deselect-blocking in `onToggle` wrapper       |
| `src/cli/lib/wizard/build-step-logic.ts`              | Compute `requiredBy` on `CategoryOption`                    |
| `src/cli/components/wizard/category-grid.tsx`         | Add `requiredBy?: string` to `CategoryOption`, render label |
| `src/cli/components/hooks/use-category-grid-input.ts` | Block space on skills with `requiredBy`                     |
| Tests (5+ files)                                      | Tests for auto-select, block-deselect, requiredBy           |

**No config/schema changes** — D-38 handles all category and rules changes. D-39 is purely wizard behavior.

---

## Execution Order

1. D-38 must be completed first
2. Phase 1: `requiredBy` visual label
3. Phase 2: Block deselection
4. Phase 3: Auto-select (optional, can defer)
5. Phase 4: Expert mode bypass
6. Update tests
7. Verify: `tsc --noEmit` + `npm test`

---

## Test Plan

### Unit Tests (matrix-resolver.ts)

1. `getAutoSelectTargets("web-framework-nextjs", matrix)` → `["web-framework-react"]`
2. `getAutoSelectTargets("web-framework-nuxt", matrix)` → `["web-framework-vue-composition-api"]`
3. `getAutoSelectTargets("web-framework-react", matrix)` → `[]` (no requirements)
4. `getAutoSelectTargets("web-state-zustand", matrix)` → `[]` (needsAny not auto-selected)
5. `getDependentSkills("web-framework-react", [...], matrix)` → `["web-framework-nextjs"]` when Next.js selected

### Hook Tests (use-build-step-props.ts)

6. Select Next.js → React auto-selected in store
7. Select React alone → no auto-select
8. Deselect React while Next.js selected → store unchanged (blocked)
9. Deselect Next.js → works, React stays selected
10. Deselect React after Next.js deselected → works

### Component Tests (build-step-logic.ts)

11. React has `requiredBy: "Next.js"` when Next.js is selected
12. React has no `requiredBy` when only React is selected
13. Vue has `requiredBy: "Nuxt"` when Nuxt is selected
