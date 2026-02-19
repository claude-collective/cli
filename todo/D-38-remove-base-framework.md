# D-38: Remove web-base-framework, Allow Compatible Multi-Framework Selection

## Goal

Remove the `web-base-framework` and `mobile-platform` stacks-only subcategory keys by merging their skills into the `web-framework` / `mobile-framework` arrays. Change the `web-framework` category from fully exclusive (one framework only) to supporting compatible multi-selection (e.g., React + Remix together, since Remix is built on React).

## Current State

### web-base-framework

- **Not a real category** -- it has no entry in `skills-matrix.yaml` `categories` section
- **Listed in the `Subcategory` type** (`src/cli/types/matrix.ts` line 27) and `SUBCATEGORY_VALUES` (`src/cli/lib/schemas.ts` line 72)
- **Has a separate Zod schema** -- `stackSubcategorySchema` extends `SUBCATEGORY_VALUES` with `"web-base-framework"` and `"mobile-platform"` (schemas.ts line 102)
- **Used in stacks.yaml** to provide a second framework slot: the "base" framework that a meta-framework is built on
  - `nuxt-stack`: `web-framework: nuxt`, `web-base-framework: vue`
  - `remix-stack`: `web-framework: remix`, `web-base-framework: react`
  - `react-native-stack`: `web-framework: react-native`, `web-base-framework: react`
- **Also referenced in** JSON schemas (`stacks.schema.json` line 72, `project-config.schema.json` line 88)

### mobile-platform

- **Not a real category** -- same pattern as `web-base-framework`
- **Listed in `Subcategory` type** (matrix.ts line 36) and `SUBCATEGORY_VALUES` (schemas.ts line 81)
- **Used only in stacks.yaml** for the React Native stack: `mobile-platform: mobile-framework-expo`
- **Also referenced in** JSON schemas (`stacks.schema.json` line 60, `project-config.schema.json` line 76)

### web-framework exclusivity

- `exclusive: true` in `skills-matrix.yaml` (line 25) -- only one skill allowed
- The wizard's `toggleTechnology()` in `wizard-store.ts` (line 519-542) checks the `exclusive` flag: if true, selecting a new skill replaces the previous one (radio behavior); if false, it toggles (checkbox behavior)
- The `validateExclusivity()` function in `matrix-resolver.ts` (line 405-432) checks that exclusive categories have at most one selection
- The conflict rule on line 366-367 lists all frameworks as mutually exclusive: `[react, vue, angular, solidjs, nextjs-app-router, remix, nuxt]`

### Existing relationship mechanisms

The system already has robust relationship primitives:

| Mechanism                      | Location                                          | Purpose                                                               |
| ------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------- |
| `requires` (matrix level)      | `skills-matrix.yaml` `relationships.requires`     | Hard dependency: skill A needs skill B (supports `needsAny` OR logic) |
| `requires` (skill level)       | `metadata.yaml` `requires` field                  | Same, per-skill definition                                            |
| `compatibleWith` (skill level) | `metadata.yaml` `compatibleWith` field            | Framework filtering in build step                                     |
| `conflictsWith` (matrix level) | `skills-matrix.yaml` `relationships.conflicts`    | Mutual exclusion                                                      |
| `conflictsWith` (skill level)  | `metadata.yaml` `conflictsWith` field             | Per-skill mutual exclusion                                            |
| `discourages`                  | `skills-matrix.yaml` `relationships.discourages`  | Soft warnings                                                         |
| `recommends`                   | `skills-matrix.yaml` `relationships.recommends`   | Soft suggestions                                                      |
| `alternatives`                 | `skills-matrix.yaml` `relationships.alternatives` | Informational grouping                                                |
| `categoryExclusive`            | `metadata.yaml` per skill                         | Override category exclusivity                                         |
| `exclusive`                    | Category definition in `skills-matrix.yaml`       | Category-level radio vs checkbox                                      |

### How the wizard handles exclusivity

1. `buildCategoriesForDomain()` in `build-step-logic.ts` reads `cat.exclusive` from the matrix categories
2. Returns `CategoryRow` with `exclusive` flag per category
3. `useBuildStepProps()` in `use-build-step-props.ts` passes `cat?.exclusive ?? true` to `store.toggleTechnology()`
4. `toggleTechnology()` uses `exclusive` to decide radio (replace) vs checkbox (toggle) behavior
5. `CategoryGrid` receives `CategoryRow[]` -- the `exclusive` flag is available but currently only used by the toggle logic, not the rendering (no separate radio/checkbox visuals)

---

## Framework Compatibility Map

| Framework    | Type   | Can be selected with         | Requires     |
| ------------ | ------ | ---------------------------- | ------------ |
| React        | base   | Remix, Next.js, React Native | --           |
| Vue          | base   | Nuxt                         | --           |
| Angular      | base   | (standalone only)            | --           |
| SolidJS      | base   | (standalone only)            | --           |
| Next.js      | meta   | React only                   | React        |
| Remix        | meta   | React only                   | React        |
| Nuxt         | meta   | Vue only                     | Vue          |
| React Native | mobile | React, Expo                  | React        |
| Expo         | mobile | React, React Native          | React Native |

### Valid multi-selections (examples)

- `[react]` -- standalone React
- `[react, nextjs-app-router]` -- Next.js app (React is implicit)
- `[react, remix]` -- Remix app (React is implicit)
- `[vue, nuxt]` -- Nuxt app (Vue is implicit)
- `[react, react-native]` -- React Native app
- `[react, react-native, expo]` -- Expo-managed React Native app
- `[angular]` -- standalone Angular
- `[solidjs]` -- standalone SolidJS

### Invalid multi-selections (prevented by conflicts)

- `[react, vue]` -- different ecosystems
- `[react, angular]` -- different ecosystems
- `[nextjs-app-router, remix]` -- both are React meta-frameworks, pick one
- `[nuxt, remix]` -- different ecosystems
- `[nextjs-app-router, nuxt]` -- different ecosystems
- `[vue, react-native]` -- RN requires React

---

## Changes Required

### Phase 1: Change web-framework from exclusive to compatible multi-select

#### 1a. skills-matrix.yaml -- Change category exclusivity

```yaml
# BEFORE
web-framework:
  id: web-framework
  displayName: Framework
  description: UI framework (React, Vue, Angular, SolidJS, Next.js, Remix, Nuxt)
  domain: web
  exclusive: true   # <-- change this
  required: true
  order: 1

# AFTER
web-framework:
  id: web-framework
  displayName: Framework
  description: UI framework (React, Vue, Angular, SolidJS, Next.js, Remix, Nuxt)
  domain: web
  exclusive: false   # <-- allows multi-select
  required: true
  order: 1
```

#### 1b. skills-matrix.yaml -- Rewrite conflict rules for framework compatibility

The current single conflict rule (`[react, vue, angular, solidjs, nextjs-app-router, remix, nuxt]`) prevents ALL multi-selection. Replace with granular rules that express the actual incompatibilities:

```yaml
conflicts:
  # Base framework conflicts (only one ecosystem)
  - skills: [react, vue, angular, solidjs]
    reason: "Base frameworks are mutually exclusive -- choose one ecosystem"

  # Meta-framework conflicts (only one meta-framework per ecosystem)
  - skills: [nextjs-app-router, remix]
    reason: "React meta-frameworks are mutually exclusive -- choose one"

  # Cross-ecosystem conflicts
  - skills: [nextjs-app-router, vue, angular, solidjs, nuxt]
    reason: "Next.js requires React -- incompatible with other ecosystems"
  - skills: [remix, vue, angular, solidjs, nuxt]
    reason: "Remix requires React -- incompatible with other ecosystems"
  - skills: [nuxt, react, angular, solidjs, nextjs-app-router, remix, react-native]
    reason: "Nuxt requires Vue -- incompatible with React/Angular/Solid ecosystem"

  # Mobile conflicts
  - skills: [react-native, vue, angular, solidjs, nuxt]
    reason: "React Native requires React -- incompatible with other ecosystems"
  - skills: [expo, vue, angular, solidjs, nuxt]
    reason: "Expo requires React Native (React) -- incompatible with other ecosystems"
```

**Important:** Remove the old single-rule `[react, vue, angular, solidjs, nextjs-app-router, remix, nuxt]` and replace with the above. The `requires` rules (see 1c) handle the positive dependencies.

#### 1c. skills-matrix.yaml -- Add/update requires rules for meta-frameworks

These `requires` rules enforce that meta-frameworks auto-require their base framework. The system already has requires rules for downstream libraries (zustand requires react, etc.) with `needsAny: true`. For meta-frameworks, we use strict AND requires:

```yaml
requires:
  # Meta-frameworks require their base framework
  - skill: nextjs-app-router
    needs: [react]
    reason: "Next.js is built on React"

  - skill: remix
    needs: [react]
    reason: "Remix is built on React"

  - skill: nuxt
    needs: [vue]
    reason: "Nuxt is built on Vue"

  # Mobile
  - skill: react-native
    needs: [react]
    reason: "React Native is built on React"

  - skill: expo
    needs: [react-native]
    reason: "Expo requires React Native"
```

**Note:** Some of these already exist in the matrix. Check and deduplicate. The D-35 cleanup removed meta-framework requires from `skills-matrix.yaml` (because they were in the same exclusive category). Now that the category is non-exclusive, they need to come back.

**Also check:** `metadata.yaml` files in `claude-subagents` repo for the meta-framework skills. If they had `requires` removed during D-35, those need to be re-added.

#### 1d. Wizard toggle behavior -- auto-select base framework

When the category is `exclusive: false`, the current `toggleTechnology()` uses checkbox behavior (toggle on/off independently). This works for the basic case, but we want **auto-selection of base frameworks** when a meta-framework is selected:

**Option A (Recommended): Use existing requires + validation**

The simplest approach: let the user select `nextjs-app-router`, and the `requires` rule will show React as required (disabled/greyed state in the wizard). The user must manually select React too, or the validation will flag it.

This works TODAY with the existing system -- no wizard code changes needed. The `isDisabled()` check in `matrix-resolver.ts` already prevents selecting skills with unmet requirements.

**Option B: Auto-select base framework on meta-framework toggle**

More user-friendly: when the user selects `nextjs-app-router`, automatically also select `react`. This requires changes to `toggleTechnology()` in `wizard-store.ts`.

```typescript
// In toggleTechnology, after the normal toggle:
// If selecting a meta-framework, auto-select its required base framework
if (!isSelected && !exclusive) {
  const skill = matrix.skills[resolveAlias(technology, matrix)];
  if (skill) {
    for (const req of skill.requires) {
      if (!req.needsAny) {
        for (const reqId of req.skillIds) {
          if (!newSelections.includes(reqId)) {
            newSelections.push(reqId);
          }
        }
      }
    }
  }
}
```

**Recommendation:** Start with Option A (validation-based). Add Option B as a follow-up UX enhancement.

### Phase 2: Update stacks.yaml -- Merge base-framework and mobile-platform

#### 2a. Merge web-base-framework into web-framework

For all stacks that use `web-base-framework`, merge the skill into the `web-framework` array:

**nuxt-stack (currently):**

```yaml
web-developer:
  web-framework:
    - id: web-framework-nuxt
      preloaded: true
  web-base-framework:
    - id: web-framework-vue-composition-api
      preloaded: true
```

**nuxt-stack (after):**

```yaml
web-developer:
  web-framework:
    - id: web-framework-nuxt
      preloaded: true
    - id: web-framework-vue-composition-api
      preloaded: true
```

**remix-stack (currently):**

```yaml
web-developer:
  web-framework:
    - id: web-framework-remix
      preloaded: true
  web-base-framework:
    - id: web-framework-react
      preloaded: true
```

**remix-stack (after):**

```yaml
web-developer:
  web-framework:
    - id: web-framework-remix
      preloaded: true
    - id: web-framework-react
      preloaded: true
```

**react-native-stack (currently):**

```yaml
web-developer:
  web-framework:
    - id: mobile-framework-react-native
      preloaded: true
  mobile-platform:
    - id: mobile-framework-expo
      preloaded: true
  web-base-framework:
    - id: web-framework-react
      preloaded: true
```

**react-native-stack (after):**

```yaml
web-developer:
  web-framework:
    - id: mobile-framework-react-native
      preloaded: true
    - id: mobile-framework-expo
      preloaded: true
    - id: web-framework-react
      preloaded: true
```

#### 2b. Apply to ALL agents in each stack

Every agent entry in a stack (web-developer, web-reviewer, web-pm, web-researcher, pattern-scout, etc.) has the same pattern. Apply the merge to all of them.

**Count of changes by stack:**

- `nuxt-stack`: ~8 agents x 2 keys (`web-framework` + `web-base-framework`) = ~8 merges
- `remix-stack`: ~8 agents x 2 keys = ~8 merges
- `react-native-stack`: ~8 agents x 3 keys (`web-framework` + `mobile-platform` + `web-base-framework`) = ~8 merges

Total: ~24 merge operations in stacks.yaml, plus removing all `web-base-framework:` and `mobile-platform:` lines.

### Phase 3: Remove from Type/Schema System

#### 3a. Remove from Subcategory type (src/cli/types/matrix.ts)

```typescript
// REMOVE these two lines from Subcategory union:
| "web-base-framework"   // line 27
| "mobile-platform"      // line 36
```

#### 3b. Remove from SUBCATEGORY_VALUES (src/cli/lib/schemas.ts)

```typescript
// REMOVE from SUBCATEGORY_VALUES array:
"web-base-framework",   // line 72
"mobile-platform",      // line 81
```

#### 3c. Remove stackSubcategorySchema extension (src/cli/lib/schemas.ts)

```typescript
// BEFORE (line 102):
export const stackSubcategorySchema = z.enum([
  ...SUBCATEGORY_VALUES,
  "web-base-framework",
  "mobile-platform",
]);

// AFTER: stackSubcategorySchema is no longer needed as a separate schema
// (or simply becomes identical to subcategorySchema)
export const stackSubcategorySchema = subcategorySchema;
```

#### 3d. Update JSON schemas

**src/schemas/stacks.schema.json:**

- Remove `"web-base-framework"` (line 72) from subcategory enum
- Remove `"mobile-platform"` (line 60) from subcategory enum

**src/schemas/project-config.schema.json:**

- Remove `"web-base-framework"` (line 88) from subcategory enum
- Remove `"mobile-platform"` (line 76) from subcategory enum

### Phase 4: Update Wizard/Exclusivity Logic

#### 4a. No rendering changes needed (minimal approach)

The `CategoryGrid` already renders all skills in a category as a flat list. When `exclusive: false`, the toggle behavior is already checkbox-style. The only thing that changes is:

- `web-framework` moves from `exclusive: true` to `exclusive: false`
- The conflict rules prevent incompatible selections
- The requires rules enforce base framework dependencies

The wizard will naturally show all framework skills as checkboxes. Users can select React + Remix together. They cannot select React + Vue (blocked by conflict rule).

#### 4b. Framework-first filtering update (build-step-logic.ts)

The `buildCategoriesForDomain()` function has framework-first filtering logic (lines 82-109) that checks `isFrameworkSelected()` and `getSelectedFrameworks()`. With multi-select, this still works correctly because:

- `getSelectedFrameworks()` returns ALL selected framework skill IDs
- `isCompatibleWithSelectedFrameworks()` checks if a skill is compatible with ANY selected framework
- This means: if React and Remix are both selected, skills compatible with either will show

**No changes needed** in `build-step-logic.ts`.

#### 4c. Validation changes (matrix-resolver.ts)

The `validateExclusivity()` function (line 405-432) will no longer flag `web-framework` since it's `exclusive: false`. The conflict and requires validation passes will handle compatibility enforcement instead.

**No changes needed** in `matrix-resolver.ts`.

#### 4d. Section locking (use-category-grid-input.ts)

The `isSectionLocked()` function (line 10-19) locks non-framework sections until a framework is selected. This still works with multi-select -- as long as ANY framework is selected, other sections unlock.

**No changes needed** in `use-category-grid-input.ts`.

### Phase 5: Handle mobile-framework category

#### 5a. Decision: merge Expo into mobile-framework or web-framework?

**Option A: Keep mobile-framework separate, just remove mobile-platform**

The `mobile-framework` category already exists with `exclusive: true`. Expo (`mobile-framework-expo`) is in this category. React Native (`mobile-framework-react-native`) is also here. We can change `mobile-framework` to `exclusive: false` and let both be selected together. The `requires` rule ensures Expo needs React Native.

**Option B: Merge everything into web-framework**

Since React Native and Expo are already skill IDs that appear in `web-framework` slots in stacks.yaml (the react-native-stack has `web-framework: mobile-framework-react-native`), we could move them into the `web-framework` category entirely. This would mean:

- The `mobile-framework` category is removed
- React Native and Expo appear alongside React, Vue, etc. in the framework picker
- The `mobile` domain might become empty

**Recommendation:** Option A is simpler and lower risk. Keep the mobile domain with its own category. Remove `mobile-platform` only (it's the stacks-only key for Expo). Change `mobile-framework` to `exclusive: false` so React Native + Expo can be selected together.

#### 5b. Changes for mobile-framework

```yaml
# BEFORE
mobile-framework:
  id: mobile-framework
  displayName: Mobile Framework
  description: Native mobile framework (React Native, Expo)
  domain: mobile
  exclusive: true    # <-- change this
  required: true
  order: 1

# AFTER
mobile-framework:
  id: mobile-framework
  displayName: Mobile Framework
  description: Native mobile framework (React Native, Expo)
  domain: mobile
  exclusive: false   # <-- allows React Native + Expo together
  required: true
  order: 1
```

Add requires rule:

```yaml
- skill: expo
  needs: [react-native]
  reason: "Expo is built on React Native"
```

### Phase 6: Update Tests

#### 6a. Test files referencing web-base-framework or mobile-platform

Search for these strings in test files and update:

| File                                                   | What to update                                              |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `src/cli/lib/__tests__/helpers.ts`                     | If `createMockMatrix()` or similar uses these subcategories |
| `src/cli/lib/__tests__/fixtures/create-test-source.ts` | If test stacks use `web-base-framework`                     |
| `src/cli/lib/stacks/stacks-loader.test.ts`             | If stack loading tests reference these keys                 |
| `src/cli/lib/matrix/matrix-resolver.test.ts`           | If exclusivity tests use `web-framework` as exclusive       |
| `src/cli/components/wizard/category-grid.test.tsx`     | If grid tests assume exclusive framework category           |
| `src/cli/stores/wizard-store.test.ts`                  | If toggle tests assume exclusive framework behavior         |
| `src/cli/lib/wizard/build-step-logic.test.ts`          | If build step tests reference these subcategories           |
| `src/cli/lib/matrix/matrix-health-check.test.ts`       | If health checks validate these subcategories               |

#### 6b. Test for new multi-select behavior

Add tests for:

- Selecting React + Remix together succeeds (no validation error)
- Selecting React + Vue together fails (conflict error)
- Selecting Remix alone fails (missing requirement: React)
- Selecting Expo alone fails (missing requirement: React Native)
- Selecting React + React Native + Expo succeeds
- Deselecting React when Remix is selected shows validation error

---

## Files to Change

### Config files

| File                        | Changes                                                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/skills-matrix.yaml` | Change `web-framework.exclusive` to false; change `mobile-framework.exclusive` to false; rewrite framework conflict rules; add/update meta-framework requires rules                                                                           |
| `config/stacks.yaml`        | Merge all `web-base-framework` entries into `web-framework` arrays (~24 agents); merge all `mobile-platform` entries into `web-framework`/`mobile-framework` arrays (~8 agents); remove all `web-base-framework:` and `mobile-platform:` keys |

### Type system

| File                      | Lines          | Changes                                                                        |
| ------------------------- | -------------- | ------------------------------------------------------------------------------ |
| `src/cli/types/matrix.ts` | 27, 36         | Remove `"web-base-framework"` and `"mobile-platform"` from `Subcategory` union |
| `src/cli/lib/schemas.ts`  | 72, 81, 99-102 | Remove from `SUBCATEGORY_VALUES`; simplify `stackSubcategorySchema`            |

### JSON schemas

| File                                     | Lines  | Changes                                                         |
| ---------------------------------------- | ------ | --------------------------------------------------------------- |
| `src/schemas/stacks.schema.json`         | 60, 72 | Remove `"mobile-platform"` and `"web-base-framework"` from enum |
| `src/schemas/project-config.schema.json` | 76, 88 | Remove `"mobile-platform"` and `"web-base-framework"` from enum |

### External repos (metadata.yaml in claude-subagents)

| File                                            | Changes                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `web-framework-nextjs-app-router/metadata.yaml` | Add `requires: [web-framework-react]` if removed by D-35               |
| `web-framework-remix/metadata.yaml`             | Add `requires: [web-framework-react]` if not present                   |
| `web-framework-nuxt/metadata.yaml`              | Add `requires: [web-framework-vue-composition-api]` if removed by D-35 |
| `mobile-framework-expo/metadata.yaml`           | Add `requires: [mobile-framework-react-native]`                        |

### Tests (need review)

| File                                                                           | Likely changes                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------- |
| `src/cli/lib/matrix/matrix-resolver.test.ts`                                   | Update exclusivity tests for web-framework        |
| `src/cli/stores/wizard-store.test.ts`                                          | Update toggle tests for non-exclusive framework   |
| `src/cli/lib/wizard/build-step-logic.test.ts`                                  | Update if referencing exclusive framework         |
| `src/cli/lib/stacks/stacks-loader.test.ts`                                     | Update if referencing web-base-framework          |
| `src/cli/lib/__tests__/fixtures/create-test-source.ts`                         | Update test stacks if they use web-base-framework |
| `src/cli/lib/__tests__/integration/consumer-stacks-matrix.integration.test.ts` | Update if referencing exclusive or base-framework |

---

## Execution Order

1. **Phase 1** -- Update `skills-matrix.yaml`: change exclusivity, rewrite conflicts, add requires
2. **Phase 2** -- Update `stacks.yaml`: merge all `web-base-framework` and `mobile-platform` entries
3. **Phase 3** -- Remove from types and schemas: `Subcategory`, `SUBCATEGORY_VALUES`, `stackSubcategorySchema`, JSON schemas
4. **Phase 4** -- No wizard code changes needed (existing system handles it)
5. **Phase 5** -- Update `mobile-framework` exclusivity
6. **Phase 6** -- Update tests
7. **Phase 7** -- Update external repos (claude-subagents metadata.yaml files)
8. **Verify** -- `npx tsc --noEmit` + `npm test`

---

## Open Questions

1. **Auto-select base framework?** When user selects Remix, should React be auto-selected? Or should the user explicitly select both? (Recommendation: start without auto-select, add as UX enhancement later. The requires validation will guide the user.)

2. **Should mobile skills move into web-framework?** The react-native-stack currently puts `mobile-framework-react-native` under the `web-framework` key in stacks.yaml. Should the mobile-framework category be removed and all mobile skills placed in web-framework? (Recommendation: keep separate for now. The mobile domain provides a clean conceptual boundary.)

3. **Next.js stack currently only has React, not nextjs-app-router.** Is this intentional? If the Next.js App Router skill should be in the nextjs-fullstack stack, that's a separate fix but should be noted.

4. **What about nextjs-server-actions?** It has `categoryExclusive: false` (it's an add-on, not a standalone framework). In the new multi-select world, it should require `nextjs-app-router` (already has this via D-35). No additional changes needed.

5. **Conflict rule complexity.** The current single conflict rule is simple. The replacement is multiple granular rules. Should we instead use a different mechanism (e.g., `ecosystems` grouping) to simplify? (Recommendation: granular conflict rules are fine for the current 9 framework skills. Add a new mechanism only if the number of frameworks grows significantly.)

6. **Stacks that put `mobile-framework-react-native` under `web-framework`.** The react-native-stack puts `mobile-framework-react-native` under the `web-framework` subcategory key. After this change, should it remain there (since the agent needs it as a "framework" skill), or should it go under `mobile-framework`? This affects whether the web-developer agent gets the skill via the web-framework or mobile-framework key. (Recommendation: keep it under web-framework for now, since the web-developer agent's framework-first filtering needs it there.)
