# Per-Skill-Scope Bugs

Raised during manual testing on 2026-03-02 after per-skill-scope implementation.
All bugs fixed on 2026-03-06.

## Bug 1: `new skill` adds files without init check — DONE
- **Severity:** Medium
- **Status:** Done
- **File:** `src/cli/commands/new/skill.ts`
- Added `detectInstallation()` check at lines 219-222, errors with "Run init first"

## Bug 2: Edit mode loses skill source identity — DONE
- **Severity:** High — caused Bugs 3 and 4
- **Status:** Done
- **File:** `src/cli/stores/wizard-store.ts` (populateFromSkillIds)
- `populateFromSkillIds()` now accepts `savedConfigs?: SkillConfig[]` and preserves existing scope/source

## Bug 3: Switching one skill's source switches ALL skills — DONE
- **Severity:** High
- **Status:** Done (fixed by Bug 2)
- **File:** `src/cli/commands/edit.tsx`
- `edit.tsx` passes `installedSkillConfigs` to Wizard, preserving source identity

## Bug 4: Local skill not selected in build step — DONE
- **Severity:** High
- **Status:** Done (fixed by Bug 2)
- **File:** `src/cli/components/hooks/use-wizard-initialization.ts`
- Hook accepts and passes `installedSkillConfigs` to `populateFromSkillIds()`

## Bug 5: S key scope toggle doesn't work — DONE
- **Severity:** High
- **Status:** Done
- **Files:** `wizard.tsx`, `category-grid.tsx`, `step-build.tsx`, `build-step-logic.ts`
- S key handler reads `focusedSkillId` and calls `toggleSkillScope`
- `CategoryGrid` syncs focused skill to store via `onFocusedSkillChange` callback
- Mount initialization sets `focusedSkillId` on first render
- Yellow G badge displayed for global-scoped skills

## Bug 6: Shared domain missing from build step — DONE
- **Severity:** Medium
- **Status:** Done
- **File:** `src/cli/components/wizard/domain-selection.tsx`
- Removed `d !== "shared"` filter — shared domain now selectable and visible

## Bug 7: Source grid selected styling incomplete — DONE
- **Severity:** Low
- **Status:** Done
- **File:** `src/cli/components/wizard/source-grid.tsx`
- `getBorderColor()` returns `CLI_COLORS.PRIMARY` for selected sources regardless of focus
- `borderDimColor` only dims when neither focused nor selected
