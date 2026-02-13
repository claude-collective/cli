# UX 2.0: Multi-Source Implementation Plan

> Implementation spec for [ux-2.0-multi-source.md](./ux-2.0-multi-source.md).
> Verified against [architecture.md](./architecture.md).
> Feasibility analysis completed 2026-02-12 against actual codebase.

## Implementation Status

> **All Phases COMPLETE** (implemented 2026-02-12)
>
> - Phase 1: Sources step UI — `source-grid.tsx`, `step-sources.tsx`
> - Phase 2: Multi-source loading — `multi-source-loader.ts`, `SkillSource`/`SkillSourceType` types
> - Phase 3: Source switching infrastructure — `source-switcher.ts` (archive/restore)
> - Phase 3b: Source switching in `cc edit` — `edit.tsx` reads `sourceSelections`, calls archive/restore, passes to copier
> - Phase 4: Installed indicator — `installed?: boolean` on `CategoryOption`, dimmed `✓` in `SkillTag`
> - Phase 5: Settings view — `step-settings.tsx`, `source-manager.ts`, `G` hotkey
> - Phase 6: Bound skill search — `search-modal.tsx`, search pill in `source-grid.tsx`, `BoundSkill`/`BoundSkillCandidate` types, `searchExtraSources()`, `boundSkillSchema`, `bindSkill` store action
>
> 84 test files, 1634 tests passing, 0 type errors.

---

## CLI Developer Review Notes

> **Reviewed 2026-02-12 by CLI Developer against actual codebase at commit 0b13007.**
> This section documents critical corrections to the PM's implementation details.
> All file references and line numbers verified against actual source.

### Critical Corrections

#### 1. Escape Handler Bug -- MUST FIX IN PHASE 1

The PM does not mention this. In `wizard.tsx:51-62`, the global `useInput` handler has:

```typescript
if (store.step !== "build" && store.step !== "confirm") {
  store.goBack();
}
```

This means ANY new step that handles Escape internally (like `"sources"`) will **double-fire** -- the step's own escape handler fires AND the global one fires. The `"sources"` step MUST be added to this exclusion list:

```typescript
if (store.step !== "build" && store.step !== "confirm" && store.step !== "sources") {
```

This is the single most important gotcha in Phase 1. If missed, Escape on the Sources step will fire twice.

#### 2. Line Number Verification Summary

Most of the PM's line references are correct. Verified locations:

- `WizardStep` at wizard-store.ts:14-18 -- CORRECT
- `WizardState` at wizard-store.ts:20-70 -- CORRECT
- `createInitialState` at wizard-store.ts:72-86 -- CORRECT
- `SkillId` at types/skills.ts:7 -- CORRECT
- `ResolvedSkill` at types/matrix.ts:180-212 -- CORRECT
- `SourceEntry` at config.ts:12-17 -- CORRECT
- `ProjectSourceConfig` at config.ts:19-25 -- CORRECT
- `resolveAllSources` at config.ts:186-213 -- CORRECT
- `fetchMarketplace` at source-fetcher.ts:150-188 -- CORRECT
- `loadSkillsMatrixFromSource` at source-loader.ts:41-74 -- CORRECT
- `mergeLocalSkillsIntoMatrix` at source-loader.ts:220-266 -- CORRECT
- `injectForkedFromMetadata` at skill-metadata.ts:156-184 -- CORRECT
- `readForkedFromMetadata` at skill-metadata.ts:32-50 -- CORRECT
- `getLocalSkillsWithMetadata` at skill-metadata.ts:52-75 -- CORRECT
- `Installation` at installation.ts:9-15 -- CORRECT
- `detectInstallation` at installation.ts:18-67 -- CORRECT
- `SkillTag` at category-grid.tsx:143-200 -- CORRECT
- `CategorySection` at category-grid.tsx:202-251 -- CORRECT
- `OptionState` at category-grid.tsx:6 -- CORRECT
- `CategoryOption` at category-grid.tsx:8-15 -- CORRECT
- `CategoryRow` at category-grid.tsx:17-23 -- CORRECT
- `DefinitionItem` at wizard-layout.tsx:13-36 -- CORRECT
- `ViewTitle` at view-title.tsx:8-15 -- CORRECT
- `SearchInput` at skill-search.tsx:79 -- CORRECT
- `ResultItem` at skill-search.tsx:107 -- CORRECT
- `ResultsList` at skill-search.tsx:135-179 -- CORRECT
- `matchesQuery` at skill-search.tsx:29-42 -- CORRECT (note: separate version in search.tsx:24-37)
- `sanitizeSourceForCache` at source-fetcher.ts:21-23 -- CORRECT
- `installLocal` at local-installer.ts:200-285 -- CORRECT
- `projectSourceConfigSchema` at schemas.ts:569-586 -- CORRECT
- `renderStep` at wizard.tsx:127 -- CORRECT
- `handleComplete` at wizard.tsx:82-125 -- CORRECT
- `WizardResultV2` at wizard.tsx:15-27 -- CORRECT
- Test helpers: `createTempDir` at helpers.ts:93-95, `cleanupTempDir` at helpers.ts:97-99, `createTestDirs` at helpers.ts:109-120, `runCliCommand` at helpers.ts:49-51 -- ALL CORRECT

The PM's line number accuracy is surprisingly good. The issues are in **semantic descriptions** of what the code does, not where it is.

#### 3. StepRefine Is NOT a "Placeholder" -- It Is a Finished Component

The PM says `StepRefine` (step-refine.tsx:1-73) is an "existing placeholder". In reality, it is a **fully functional component** with:

- Props interface (`StepRefineProps`) with `technologyCount`, `refineAction`, callbacks
- Keyboard handling (`useInput` with Enter, Escape, arrow keys)
- Rendering for "Use all recommended" and "Customize skill sources (coming soon)"
- **35+ existing tests** in `step-refine.test.tsx`

The PM says to "expand" StepRefine or rename it. **DO NOT modify StepRefine.** Create a NEW `step-sources.tsx` instead. The existing StepRefine has tests and is used in the wizard flow -- it currently sits between build and confirm as an intermediate "refine" choice. The decision to repurpose it vs. create a new component should be: **create a new component.** StepRefine can eventually be removed once StepSources replaces it, but modifying it risks breaking existing tests.

#### 5. StepRefine Is NOT Currently Wired Into the Wizard Routing

The PM says StepRefine is "already wired into wizard tabs." **FALSE.** Looking at `wizard.tsx:127-200`, the `renderStep()` switch has cases for: `approach`, `stack`, `build`, `confirm`. **There is no case for "refine" or StepRefine.** It exists as a component but is NOT rendered anywhere in the wizard flow. The WIZARD_STEPS array in `wizard-tabs.tsx:18-23` also has no "refine" entry:

```typescript
export const WIZARD_STEPS: WizardTabStep[] = [
  { id: "approach", label: "Intro", number: 1 },
  { id: "stack", label: "Stack", number: 2 },
  { id: "build", label: "Build", number: 3 },
  { id: "confirm", label: "Confirm", number: 4 },
];
```

This means Phase 1 is cleaner than the PM thought -- we're adding a new step, not modifying an existing wired-in one.

#### 6. Build Step onContinue Is NOT at Line 168

The PM says "Change the Build step's `onContinue` (line 168) from `store.setStep("confirm")`." The actual code at `wizard.tsx:167-171` is:

```typescript
onContinue={() => {
  if (!store.nextDomain()) {
    store.setStep("confirm");
  }
}}
```

The `store.setStep("confirm")` is at **line 169**, inside a conditional. The change is correct (change `"confirm"` to `"sources"`), but the line reference is wrong and the conditional matters -- the Sources step is only reached after ALL domains are completed.

#### 7. CategoryGrid useInput Captures hjkl Keys -- Search Card Conflict is REAL

The PM mentions this as a risk but does not explain the mechanism. `category-grid.tsx:345-348`:

```typescript
const isLeft = key.leftArrow || input === "h";
const isRight = key.rightArrow || input === "l";
const isUp = key.upArrow || input === "k";
const isDown = key.downArrow || input === "j";
```

AND it captures `" "` (space), `"d"/"D"` (descriptions). This means CategoryGrid's `useInput` will eat ALL typing if used alongside a text input. The SourceGrid MUST be a separate component that does NOT reuse CategoryGrid's `useInput`. The PM correctly suggests `SourceGrid` as a new component but underestimates the difficulty -- you cannot compose CategoryGrid with a search card.

#### 8. WizardLayout completedSteps Is Hardcoded, NOT Data-Driven

The PM says to "update completedSteps logic (lines 80-100) to include sources state tracking." The actual logic at `wizard-layout.tsx:80-100` is:

```typescript
const { completedSteps, skippedSteps } = useMemo(() => {
  const completed: string[] = [];
  const skipped: string[] = [];
  if (store.step !== "approach") completed.push("approach");
  if (store.step !== "approach" && store.step !== "stack") completed.push("stack");
  if (store.approach === "stack" && store.selectedStackId && store.stackAction === "defaults") {
    skipped.push("build");
  } else if (store.step === "confirm") {
    completed.push("build");
  }
  return { completedSteps: completed, skippedSteps: skipped };
}, [store.step, store.approach, store.selectedStackId, store.stackAction]);
```

This is a chain of `if` statements, NOT a data-driven approach from `WIZARD_STEPS`. Adding `"sources"` requires:

- Adding `if (store.step === "confirm") completed.push("sources")` (sources is complete when we reach confirm)
- When `stackAction === "defaults"`, BOTH `"build"` AND `"sources"` should be skipped
- The `useMemo` dependency array must include any new state that affects sources completion

This is more involved than the PM implies.

#### 9. WizardResultV2 Does NOT Have sourceSelections

`WizardResultV2` at wizard.tsx:15-27 currently contains: `selectedSkills`, `selectedStackId`, `domainSelections`, `expertMode`, `installMode`, `cancelled`, `validation`. There is NO `sourceSelections` field. Adding it is a Phase 3 requirement, not Phase 1.

#### 10. No `copySkillFromAlternateSource` Exists

The PM says to add `copySkillFromAlternateSource()` to `skill-copier.ts`. The actual file has `copySkill()`, `copySkillsToLocalFlattened()`, `copySkillsToPluginFromSource()`. The suggested function name is fine but should follow the existing `copySkill()` pattern (takes a `ResolvedSkill` + paths, returns `CopiedSkill`).

#### 11. discoverLocalSkills Location Verified

The PM says `discoverLocalSkills()` is at `src/cli/lib/skills/local-skill-loader.ts:33-59`. Verified: **line 33** in `local-skill-loader.ts` (correct). Exported via barrel at `skills/index.ts:32`.

#### 12. Two Duplicate `matchesQuery` Functions

`matchesQuery()` at `skill-search.tsx:29-42` operates on `SourcedSkill`. There is ALSO a separate `matchesQuery` in `search.tsx` (command file) at lines 24-37 that operates on `ResolvedSkill`. If Phase 6 reuses search logic, these should be consolidated or the implementer needs to pick the right one.

### Structural Issues

#### A. Phase 4 Should Be Part of Phase 1

Adding the `installed` indicator to the Build step is tiny (add an optional boolean to `CategoryOption`, render a checkmark in `SkillTag`). This is 10-15 lines of code and should be folded into Phase 1 to avoid a separate phase for a minor visual enhancement. The PM correctly identifies this as only modifying existing files with no new files.

#### B. Phase 6 Is Highest Risk and Should Note Deferability

The inline source search (Phase 6) is the most complex feature. It requires:

- A dual-mode component (idle/active text input inside a grid)
- Disabling grid navigation while typing
- A results dropdown that pushes content down
- A search backend

This is a significant UX engineering effort. The spec should explicitly note: **Phase 6 can be deferred to a future release without affecting the core multi-source workflow.** Phases 1-5 deliver full value.

#### C. Missing: How `cc edit` Routes Through Sources

The PM mentions `edit.tsx:70-76` for `currentSkillIds` but does NOT address how the `cc edit` command's wizard flow will handle the new Sources step. Currently, `cc edit` renders `<Wizard>` identically to `cc init` -- the Wizard component has no concept of "edit mode." The Sources step needs to know which skills are currently installed to pre-populate source selections. This requires either:

1. A new `initialSourceSelections` prop on `<Wizard>`, or
2. Computing it inside the wizard from the matrix's `availableSources[].installed` field

This is a Phase 2/3 integration concern that should be noted.

#### D. Missing: The `"D"` Key Conflict in Sources/Settings

`wizard.tsx:72-79` has global hotkey handlers for `"e"/"E"` (expert mode) and `"p"/"P"` (plugin mode). `category-grid.tsx:331-334` captures `"d"/"D"` for descriptions toggle. If the Sources step or Settings view has text input, these global keys will interfere. The implementer needs to disable global hotkeys during text input mode.

#### E. `Set<string>` for enabledSources Won't Work in Zustand

The PM suggests `enabledSources: Set<string>` in the wizard store. Zustand with `create()` does not natively handle `Set` for reactivity -- mutations to a `Set` don't trigger re-renders because the reference doesn't change. Use `string[]` or `Record<string, boolean>` instead, following the existing pattern of using plain objects/arrays in the store.

#### F. Missing: SourcedSkill Type Already Exists

The PM defines a new `SourceOption` type, but `SourcedSkill` already exists at `skill-search.tsx:7-10`:

```typescript
export type SourcedSkill = ResolvedSkill & {
  sourceName: string;
  sourceUrl?: string;
};
```

This type extends `ResolvedSkill` with source info. Consider reusing or extending this rather than creating separate parallel types.

### Implementation Order Recommendation

1. **Phase 1 + Phase 4 merged**: Sources step UI + installed indicator (2-3 days)
2. **Phase 2**: Multi-source loading (2-3 days)
3. **Phase 3**: Source switching + archive (2-3 days)
4. **Phase 5**: Settings view (2-3 days)
5. **Phase 6**: Inline search (3-5 days, DEFERRABLE)

---

1. [Existing Infrastructure Audit](#existing-infrastructure-audit)
2. [Data Model Changes](#data-model-changes)
3. [Phase 1: Sources Step UI](#phase-1-sources-step-ui)
4. [Phase 2: Multi-Source Loading](#phase-2-multi-source-loading)
5. [Phase 3: Source Switching](#phase-3-source-switching)
6. [Phase 4: Installed Indicator in Build Step](#phase-4-installed-indicator-in-build-step)
7. [Phase 5: Settings View](#phase-5-settings-view)
8. [Phase 6: Bound Skill Search](#phase-6-bound-skill-search)
9. [Testing Strategy](#testing-strategy)
10. [Risk Assessment](#risk-assessment)

---

## Existing Infrastructure Audit

> What already exists that can be reused. All references are to actual source files.

### Reusable Components

| Component         | File                                               | Lines   | What It Provides                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | -------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CategoryGrid`    | `src/cli/components/wizard/category-grid.tsx`      | 1-418   | Full 2D grid navigation with arrow/vim keys, space-to-select, section locking, option sorting. **CLI DEV NOTE: Cannot reuse this component directly for Sources step. Its `useInput` at lines 298-389 captures h/j/k/l for vim nav, d/D for descriptions, and space for selection. These conflict with any text input (Phase 6 search card). Create SourceGrid as a SEPARATE component inspired by CategoryGrid's visual pattern but with its own input handling.**                                                                                                                                   |
| `StepRefine`      | `src/cli/components/wizard/step-refine.tsx`        | 1-73    | Existing "Use recommended" / "Customize" choice UI. Has 35+ tests in step-refine.test.tsx. **CLI DEV NOTE: NOT a placeholder -- it is a finished component. NOT wired into wizard tabs or routing (no case in renderStep switch, no entry in WIZARD_STEPS). Create new step-sources.tsx instead of modifying this.**                                                                                                                                                                                                                                                                                  |
| `SkillSearch`     | `src/cli/components/skill-search/skill-search.tsx` | 1-361   | Full search UI with query input, results list, keyboard navigation, scroll, copy link. The inline search in Phase 6 reuses `matchesQuery()` (line 29), `SearchInput` (line 79), and `ResultItem` (line 107) patterns. **CLI DEV NOTE: SkillSearch's `useInput` at lines 290-337 captures j/k for navigation AND all printable chars for query input. SearchInput (line 79-99) has its own `useInput` that captures backspace + printable chars. These two `useInput` hooks coexist because they are in parent/child components and both fire. This is the pattern to follow for search-inside-grid.** |
| `SkillTag`        | `src/cli/components/wizard/category-grid.tsx`      | 143-200 | Card rendering with color states, focus border, local badge. Source variant cards follow this same visual pattern.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `CategorySection` | `src/cli/components/wizard/category-grid.tsx`      | 202-251 | Row layout with header + options. Source rows follow this same structure.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `WizardLayout`    | `src/cli/components/wizard/wizard-layout.tsx`      | 77-129  | Layout shell with tabs, hotkeys, footer. Sources step renders inside this. **CLI DEV NOTE: completedSteps logic at lines 80-100 is hardcoded if-chains, NOT data-driven from WIZARD_STEPS. Must add sources-specific conditions.**                                                                                                                                                                                                                                                                                                                                                                    |
| `WizardTabs`      | `src/cli/components/wizard/wizard-tabs.tsx`        | 1-87    | Step tabs with completed/current/pending/skipped states. Already has `WIZARD_STEPS` array to extend.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `ViewTitle`       | `src/cli/components/wizard/view-title.tsx`         | 1-15    | Section title component. Reused in Sources step header.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `DefinitionItem`  | `src/cli/components/wizard/wizard-layout.tsx`      | 13-36   | Hotkey hint rendering. Reused for `G Settings` hotkey.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `MenuItem`        | `src/cli/components/wizard/menu-item.tsx`          | -       | Menu item for radio-style selection. Used by StepApproach.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### Reusable Types

| Type                  | File                                               | Lines   | Reuse                                                                      |
| --------------------- | -------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `WizardStep`          | `src/cli/stores/wizard-store.ts`                   | 14-18   | Extend union with `"sources"`                                              |
| `WizardState`         | `src/cli/stores/wizard-store.ts`                   | 20-70   | Add source selection state                                                 |
| `CategoryOption`      | `src/cli/components/wizard/category-grid.tsx`      | 8-15    | Pattern for `SourceOption`                                                 |
| `CategoryRow`         | `src/cli/components/wizard/category-grid.tsx`      | 17-23   | Pattern for `SourceRow`                                                    |
| `OptionState`         | `src/cli/components/wizard/category-grid.tsx`      | 6       | Reuse directly for source card states                                      |
| `SkillId`             | `src/cli/types/skills.ts`                          | 7       | All skill references use this                                              |
| `ResolvedSkill`       | `src/cli/types/matrix.ts`                          | 180-212 | Extend with `availableSources`                                             |
| `SourceEntry`         | `src/cli/lib/configuration/config.ts`              | 12-17   | Already defines `{ name, url, description?, ref? }` for `config.sources[]` |
| `ProjectSourceConfig` | `src/cli/lib/configuration/config.ts`              | 19-25   | Already has `sources?: SourceEntry[]` field                                |
| `SourcedSkill`        | `src/cli/components/skill-search/skill-search.tsx` | 7-10    | Existing `ResolvedSkill & { sourceName, sourceUrl? }` pattern              |
| `ForkedFromMetadata`  | `src/cli/lib/skills/skill-metadata.ts`             | 12-16   | Tracks forked skill origin. Used to detect installed source.               |
| `Installation`        | `src/cli/lib/installation/installation.ts`         | 9-15    | Detection of local/plugin install mode                                     |

### Reusable Lib Functions

| Function                       | File                                               | Lines   | Reuse                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | -------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveAllSources()`          | `src/cli/lib/configuration/config.ts`              | 186-213 | Already resolves primary + extra `SourceEntry[]` from config. Foundation for multi-source loading.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `loadSkillsMatrixFromSource()` | `src/cli/lib/loading/source-loader.ts`             | 41-74   | Current single-source loader. Must be extended to iterate sources.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `fetchFromSource()`            | `src/cli/lib/loading/source-fetcher.ts`            | 30-41   | Fetches from local or remote. Reuse per-source in multi-source loop.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `mergeMatrixWithSkills()`      | `src/cli/lib/matrix/matrix-loader.ts`              | -       | Merges extracted skills into matrix. Called once per source. **CLI DEV NOTE: This function takes `(matrix: SkillsMatrix, skills: ExtractedSkillMetadata[])` and returns `MergedSkillsMatrix`. It resolves all relationship fields (conflictsWith, recommends, etc.) and creates `ResolvedSkill` objects. For extra sources, you may only need the skill metadata (not the full matrix), so `extractAllSkills()` alone may suffice, with manual creation of `SkillSource` entries without the full merge pipeline.** |
| `mergeLocalSkillsIntoMatrix()` | `src/cli/lib/loading/source-loader.ts`             | 220-266 | Merges local `.claude/skills/` into matrix. Pattern for multi-source merge.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `discoverLocalSkills()`        | `src/cli/lib/skills/local-skill-loader.ts`         | 33-59   | Discovers skills in `.claude/skills/`. Used to populate "Installed" source variant.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `getLocalSkillsWithMetadata()` | `src/cli/lib/skills/skill-metadata.ts`             | 52-75   | Reads `forked_from` metadata for all local skills. Used to link installed skills to their source.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `readForkedFromMetadata()`     | `src/cli/lib/skills/skill-metadata.ts`             | 32-50   | Reads single skill's `forked_from`. Used to determine origin source.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `detectInstallation()`         | `src/cli/lib/installation/installation.ts`         | 18-67   | Detects local/plugin installation. Used to determine installed skills.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `getPluginSkillIds()`          | `src/cli/lib/plugins/plugin-finder.ts`             | -       | Gets skill IDs from plugin installation. Used for "Installed" indicator.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `injectForkedFromMetadata()`   | `src/cli/lib/skills/skill-metadata.ts`             | 156-184 | Writes `forked_from` metadata after ejecting/switching sources.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `loadProjectSourceConfig()`    | `src/cli/lib/configuration/config.ts`              | 37-70   | Loads `.claude-src/config.yaml`. Used by settings view.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `saveProjectConfig()`          | `src/cli/lib/configuration/config.ts`              | 72-81   | Saves config to disk. Used by settings view to persist source changes.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `fetchMarketplace()`           | `src/cli/lib/loading/source-fetcher.ts`            | 150-188 | Fetches + validates marketplace.json. Used when adding a new source.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `sanitizeSourceForCache()`     | `src/cli/lib/loading/source-fetcher.ts`            | 21-23   | Cache key generation. Reused for per-source caching.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `matchesQuery()`               | `src/cli/components/skill-search/skill-search.tsx` | 29-42   | Fuzzy text matching against skill fields. Reused in inline search.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

## Data Model Changes

### New Types

**File: `src/cli/types/matrix.ts`** (add near the end, after `SkillOption`)

```typescript
/** Source type classification for skill provenance */
export type SkillSourceType = "public" | "private" | "local" | "plugin";

/** A single source from which a skill can be obtained */
export type SkillSource = {
  /** Source identifier: "public", marketplace name, "local", "plugin" */
  name: string;
  type: SkillSourceType;
  /** Source URL for remote sources (e.g., "github:acme-corp/claude-skills") */
  url?: string;
  /** Skill content version from metadata.yaml */
  version?: string;
  /** Whether this source's version is currently installed on disk */
  installed: boolean;
};

/** Source variant displayed as a card in the Sources step */
export type SourceOption = {
  /** Source identifier (e.g., "public", "acme-corp", "local") */
  id: string;
  /** Display label (e.g., "Public . v2", "Installed . v2") */
  label: string;
  /** Currently selected as the active source for this skill */
  selected: boolean;
  /** Currently installed on disk */
  installed: boolean;
  /** Visual state (reuses existing OptionState) */
  state: OptionState;
};

/** One row in the Sources step grid -- one skill, multiple source variants */
export type SourceRow = {
  /** The skill this row represents */
  id: SkillId;
  /** Skill display name (e.g., "react") */
  displayName: string;
  /** Available source variants as selectable cards */
  options: SourceOption[];
  /** Always true -- one source per skill (exclusive selection) */
  exclusive: true;
};
```

Note: `OptionState` is already defined in `src/cli/components/wizard/category-grid.tsx` line 6. Import it from there, or extract it to `src/cli/types/matrix.ts` if it becomes shared across more than 2 files.

> **CLI DEV NOTE: `SourcedSkill` already exists at `skill-search.tsx:7-10` as `ResolvedSkill & { sourceName: string; sourceUrl?: string }`. This overlaps conceptually with `SkillSource`. Consider whether `SourcedSkill` can be extended/reused rather than creating parallel type hierarchies. The `cc search` command (search.tsx) also has its own `toSourcedSkill()` helper at line 44 that converts `ResolvedSkill` to `SourcedSkill`. If Phase 6 reuses the search UI, these types need to be reconciled.**

### Type Extensions

**File: `src/cli/types/matrix.ts`** -- extend `ResolvedSkill`:

```typescript
// Add to the existing ResolvedSkill type:
export type ResolvedSkill = {
  // ... all existing fields unchanged ...
  /** All known sources that provide this skill */
  availableSources?: SkillSource[];
  /** Currently active/installed source (if any) */
  activeSource?: SkillSource;
};
```

Make both fields optional so existing code that creates `ResolvedSkill` objects is unaffected (backward compatible).

**File: `src/cli/stores/wizard-store.ts`** -- extend `WizardStep` and `WizardState`:

```typescript
// Extend WizardStep union:
export type WizardStep =
  | "approach"
  | "stack"
  | "build"
  | "sources" // NEW: between build and confirm
  | "confirm";

// Add to WizardState:
export type WizardState = {
  // ... existing fields ...
  /** Per-skill source selection: skill ID -> source identifier */
  sourceSelections: Partial<Record<SkillId, string>>;
  /** Whether user chose to customize sources (vs. "use recommended") */
  customizeSources: boolean;
  // ... existing actions ...
  setSourceSelection: (skillId: SkillId, sourceId: string) => void;
  setCustomizeSources: (customize: boolean) => void;
};
```

### Zod Schema Changes

**File: `src/cli/lib/schemas.ts`** -- add schemas for new types, following bridge pattern:

```typescript
// New: SkillSourceType union schema
export const skillSourceTypeSchema = z.enum([
  "public",
  "private",
  "local",
  "plugin",
]) as z.ZodType<SkillSourceType>;

// New: SkillSource schema (lenient loader)
export const skillSourceSchema = z
  .object({
    name: z.string(),
    type: skillSourceTypeSchema,
    url: z.string().optional(),
    version: z.string().optional(),
    installed: z.boolean(),
  })
  .passthrough();
```

The existing `projectSourceConfigSchema` (schemas.ts:569-586) already validates the `sources` array with `SourceEntry` shape -- no changes needed there.

### Config Schema Changes

No changes to `ProjectConfig` type or `projectConfigSchema`. The `sources` field already exists on `ProjectSourceConfig` (config.ts:24) and is validated by `projectSourceConfigSchema` (schemas.ts:575-584).

The key config structure that already exists:

```yaml
# .claude-src/config.yaml
source: github:claude-collective/skills
sources:
  - name: acme-corp
    url: github:acme-corp/claude-skills
    description: "Acme Corp private skills"
```

---

## Phase 1: Sources Step UI

### Scope

Wire `StepRefine` into the wizard flow as the "Sources" step (step 4 of 5). Implement the "Use recommended" / "Customise" choice. Build the per-skill source picker grid using the `CategoryGrid` pattern. For now, only show "Public" variant (single source) since multi-source loading is Phase 2.

### Files to Create

| File                                              | Purpose                                                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/cli/components/wizard/step-sources.tsx`      | New Sources step component with recommended/customize toggle and per-skill source grid                     |
| `src/cli/components/wizard/step-sources.test.tsx` | Component tests for Sources step                                                                           |
| `src/cli/components/wizard/source-grid.tsx`       | Source variant grid component (similar to `CategoryGrid` but for exclusive source selection per skill row) |
| `src/cli/components/wizard/source-grid.test.tsx`  | Component tests for source grid                                                                            |

### Files to Modify

| File                                          | Changes                                                                                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/stores/wizard-store.ts`              | Add `"sources"` to `WizardStep` union. Add `sourceSelections`, `customizeSources` state + actions. Update `createInitialState()`.                                |
| `src/cli/components/wizard/wizard.tsx`        | Add `case "sources"` to `renderStep()` switch (line 127). Update Build step's `onContinue` to navigate to `"sources"` instead of `"confirm"` (line 168).         |
| `src/cli/components/wizard/wizard-tabs.tsx`   | Add `{ id: "sources", label: "Sources", number: 4 }` to `WIZARD_STEPS` array. Renumber Confirm to 5.                                                             |
| `src/cli/components/wizard/wizard-layout.tsx` | Update `completedSteps` logic (line 80-100) to include `"sources"` state tracking. Add `G` hotkey hint via `DefinitionItem` when on sources step (line 113-125). |
| `src/cli/components/wizard/step-refine.tsx`   | Either rename to `step-sources.tsx` or keep as-is and create new file. The existing component becomes the "recommended vs customize" gateway.                    |
| `src/cli/types/matrix.ts`                     | Add `SkillSourceType`, `SkillSource`, `SourceOption`, `SourceRow` types. Add `availableSources?` and `activeSource?` to `ResolvedSkill`.                         |

### Implementation Details

**1. Wizard Store Changes** (`wizard-store.ts`)

Follow the existing pattern at lines 72-86 (`createInitialState`):

- Add `sourceSelections: {} as Partial<Record<SkillId, string>>` to initial state
- Add `customizeSources: false` to initial state
- Add `setSourceSelection` action following the `toggleTechnology` pattern (lines 156-179)
- Add `setCustomizeSources` action following the `setApproach` pattern (line 99)
- The `"sources"` step sits between `"build"` and `"confirm"` in the flow

**2. Wizard Routing** (`wizard.tsx`)

In `renderStep()` (line 127), add a new case before `confirm`:

```
case "sources":
  return <StepSources matrix={matrix} />;
```

Change the Build step's `onContinue` at **line 169** (inside the `if (!store.nextDomain())` conditional) from:

```
store.setStep("confirm")
```

to:

```
store.setStep("sources")
```

The Sources step's own `onContinue` navigates to `"confirm"`.

> **CLI DEV NOTE: CRITICAL -- Also update the global escape handler at wizard.tsx:56. Currently excludes "build" and "confirm" from global Escape handling. MUST also exclude "sources" to prevent double-fire:**
>
> ```typescript
> } else if (store.step !== "build" && store.step !== "confirm" && store.step !== "sources") {
> ```
>
> **Also update the "Accept defaults" shortcut at wizard.tsx:65-69. When `stackAction === "defaults"`, the shortcut currently goes to `"confirm"`. This should STAY going to `"confirm"` (skipping sources), but the logic should be documented.**

**3. StepSources Component** (new file)

Structure: Two views controlled by `customizeSources` state.

- **Default view**: "Use recommended" (selected) / "Customise" radio buttons
  - Follow `StepRefine` pattern (step-refine.tsx:14-73) for the radio choice UI
  - "Use recommended" on Enter -> navigate to confirm
  - "Customise" on Enter -> switch to grid view

> **CLI DEV NOTE: StepRefine is a reference PATTERN, not code to reuse. Create step-sources.tsx as a new component. StepRefine has its own `useInput` handler that calls `onContinue`/`onBack` directly. StepSources should handle its own escape (call `store.goBack()`) because the global escape handler will be excluded for this step (see correction #1 above).**

- **Customize view**: Per-skill source grid
  - One row per selected skill (from `store.getAllSelectedTechnologies()`)
  - Each row shows source variants as cards
  - Phase 1: only "Public" card per row (single source)
  - Follow `StepBuild` pattern for layout (step-build.tsx:217-300 is actually 217-300, the component body)

> **CLI DEV NOTE: step-build.tsx:217-300 is the `StepBuild` component JSX. The actual `buildCategoriesForDomain` function the PM references for Phase 4 is at lines 132-188. Use the overall layout (domain tabs + title + grid + footer) as the pattern, but the grid itself must be SourceGrid (new), not CategoryGrid.**

**4. Source Grid Component** (new file)

Reuse the `SkillTag` visual pattern from `category-grid.tsx:143-200` but adapted for source cards:

- Show source name + version as label
- `selected` = cyan border (same as CategoryGrid)
- `installed` = checkmark prefix
- Use same arrow key + space selection as CategoryGrid

**5. Wizard Tabs** (`wizard-tabs.tsx`)

Change `WIZARD_STEPS` (lines 18-23) from:

```
[Intro(1), Stack(2), Build(3), Confirm(4)]
```

to:

```
[Intro(1), Stack(2), Build(3), Sources(4), Confirm(5)]
```

> **CLI DEV NOTE: The `wizard-tabs.test.tsx` file exists and likely tests the WIZARD_STEPS array length and tab labels. Update those test expectations in the same PR.**

**6. Wizard Layout Step Tracking** (`wizard-layout.tsx`)

Update `completedSteps/skippedSteps` logic (lines 80-100) to handle the new `"sources"` step. When stack+defaults path is taken, skip both `"build"` and `"sources"`.

> **CLI DEV NOTE: The existing code at lines 80-100 is a chain of if-statements, NOT data-driven. You need to add:**
>
> ```typescript
> // After the existing build/confirm logic:
> if (store.approach === "stack" && store.selectedStackId && store.stackAction === "defaults") {
>   skipped.push("build");
>   skipped.push("sources"); // NEW
> } else if (store.step === "confirm") {
>   completed.push("build");
>   completed.push("sources"); // NEW
> }
> ```
>
> **The `useMemo` dependency array at line 100 is `[store.step, store.approach, store.selectedStackId, store.stackAction]`. No new dependencies needed since sources completion is implied by reaching confirm.**

### Reuse Opportunities

| What                                  | From                                              | How                                                       |
| ------------------------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| Grid navigation (arrow/vim/tab/space) | `category-grid.tsx:298-388`                       | Source grid follows identical keyboard handling           |
| Card visual states                    | `category-grid.tsx:143-200` (SkillTag)            | Source cards use same color scheme                        |
| Section layout                        | `category-grid.tsx:202-251` (CategorySection)     | Source rows use same header + options layout              |
| Radio choice UI                       | `step-refine.tsx:14-73`                           | "Recommended vs Customize" uses same bordered box pattern |
| View title                            | `view-title.tsx:8-15`                             | "Choose a source for each skill" header                   |
| Test patterns                         | `step-refine.test.tsx` + `category-grid.test.tsx` | Same `ink-testing-library` render + stdin patterns        |
| Test constants                        | `src/cli/lib/__tests__/test-constants.ts`         | `ENTER`, `ESCAPE`, `ARROW_*`, `delay()`                   |

### Acceptance Criteria

| #   | Criterion                                                          | Verification                                                              |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 1   | `WizardStep` type includes `"sources"`                             | `bun tsc --noEmit` passes                                                 |
| 2   | `WIZARD_STEPS` shows 5 tabs: Intro, Stack, Build, Sources, Confirm | Unit test on `wizard-tabs.tsx`                                            |
| 3   | Build step's Enter navigates to Sources (not Confirm)              | Component test: render Build, press Enter, verify store step is "sources" |
| 4   | Sources step renders "Use recommended" and "Customise" options     | Component test: render StepSources, verify both options in `lastFrame()`  |
| 5   | Enter on "Use recommended" navigates to Confirm                    | Component test: press Enter, verify store step is "confirm"               |
| 6   | Selecting "Customise" shows per-skill source grid                  | Component test: select customize, verify skill names appear               |
| 7   | Each selected skill appears as a row with "Public" source card     | Component test with mock matrix                                           |
| 8   | Space on a source card selects it (cyan border)                    | Component test: press space, verify selection                             |
| 9   | Escape on Sources returns to Build                                 | Component test: press Escape, verify store step                           |
| 10  | Stack+defaults path skips Sources (goes directly to Confirm)       | Store test: set stackAction="defaults", verify Sources is skipped         |
| 11  | All existing wizard tests pass                                     | `bun vitest run src/cli/components/wizard/`                               |
| 12  | No TypeScript errors                                               | `bun tsc --noEmit`                                                        |

---

## Phase 2: Multi-Source Loading

### Scope

Extend `loadSkillsMatrixFromSource()` to load skills from all configured sources (primary + `config.sources[]`), tag each skill with its `SkillSource`, and populate `availableSources[]` on `ResolvedSkill`. After this phase, the Sources step shows real source variants from multiple marketplaces.

### Files to Create

| File                                              | Purpose                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/cli/lib/loading/multi-source-loader.ts`      | Loads and merges skills from all configured sources, tagging provenance |
| `src/cli/lib/loading/multi-source-loader.test.ts` | Unit tests for multi-source loading                                     |

### Files to Modify

| File                                         | Changes                                                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/lib/loading/source-loader.ts`       | Call `loadAllSourceSkills()` from multi-source-loader instead of single-source loading. Merge results into unified matrix. |
| `src/cli/lib/loading/index.ts`               | Export new multi-source-loader functions                                                                                   |
| `src/cli/types/matrix.ts`                    | No new types needed (Phase 1 already added `SkillSource`, `availableSources`)                                              |
| `src/cli/lib/schemas.ts`                     | Add `skillSourceSchema` if not already done in Phase 1                                                                     |
| `src/cli/components/wizard/step-sources.tsx` | Update to read `availableSources` from matrix and render real source variants                                              |

### Implementation Details

**1. Multi-Source Loading Function** (`multi-source-loader.ts`)

Create `loadSkillsFromAllSources()` that:

1. Calls `resolveAllSources()` (config.ts:186-213) to get primary + extra sources
2. For the primary source: loads via existing `loadFromLocal()`/`loadFromRemote()` pattern (source-loader.ts:76-178)
3. For each extra source in `config.sources[]`: calls `fetchFromSource()` (source-fetcher.ts:30-41), then `extractAllSkills()` (matrix-loader.ts) to get skill metadata
4. Tags each skill with a `SkillSource` object indicating provenance
5. Returns a map: `Record<SkillId, SkillSource[]>` -- all sources for each skill ID

> **CLI DEV NOTE: `loadFromLocal()` and `loadFromRemote()` are private functions (not exported) in source-loader.ts. You cannot call them from a separate module. Two options:**
>
> 1. **Extract them** as exported functions (requires modifying source-loader.ts)
> 2. **Call the public API** `loadSkillsMatrixFromSource()` for the primary source, then separately load extra sources
>
> Option 2 is simpler -- let the existing pipeline handle primary, then overlay extras.
>
> Also: `extractAllSkills()` is exported from `../matrix` (via matrix-loader.ts). It takes a `skillsDir: string` and returns `ExtractedSkillMetadata[]`. It does NOT return `ResolvedSkill` -- the conversion to `ResolvedSkill` happens in `mergeMatrixWithSkills()`. The PM's description glosses over this: extra sources need both a matrix file AND skills directory, or just a skills directory with metadata.yaml files.

**2. Source Tagging**

For each source, create a `SkillSource`:

```
Primary source -> { name: "public", type: "public", url: resolvedConfig.source, installed: false }
Extra sources -> { name: entry.name, type: "private", url: entry.url, installed: false }
Local skills -> { name: "local", type: "local", installed: true }
Plugin skills -> { name: "plugin", type: "plugin", installed: true }
```

**3. Matrix Merging**

After loading skills from all sources:

1. Start with primary source matrix (existing behavior)
2. For each extra source: find overlapping skill IDs, add to `availableSources[]`
3. For local/plugin skills: add to `availableSources[]` with `installed: true`
4. Set `activeSource` to the currently installed variant (or primary if not installed)

Follow the `mergeLocalSkillsIntoMatrix()` pattern (source-loader.ts:220-266) for the merge logic.

**4. Integration with Source-Loader**

Modify `loadSkillsMatrixFromSource()` (source-loader.ts:41-74):

- After loading the primary source matrix (existing code)
- Call `loadSkillsFromAllSources()` to discover extra sources
- Merge extra source skills into `availableSources[]` on each `ResolvedSkill`
- The existing `discoverLocalSkills()` call (lines 60-68) and `mergeLocalSkillsIntoMatrix()` still run as-is

> **CLI DEV NOTE: The actual local skills loading is at lines 60-68, not "61-68":**
>
> ```typescript
> const resolvedProjectDir = projectDir || process.cwd();
> const localSkillsResult = await discoverLocalSkills(resolvedProjectDir);
> if (localSkillsResult && localSkillsResult.skills.length > 0) {
>   verbose(`Found ${localSkillsResult.skills.length} local skill(s)...`);
>   result.matrix = mergeLocalSkillsIntoMatrix(result.matrix, localSkillsResult);
> }
> ```
>
> The multi-source loading should happen BEFORE `mergeLocalSkillsIntoMatrix()` so that local skills can correctly overlay any source's version of the same skill.

**5. Sources Step Update** (`step-sources.tsx`)

Now reads `matrix.skills[skillId].availableSources` to build `SourceRow[]`:

```
For each selected skill:
  row.options = skill.availableSources.map(source => ({
    id: source.name,
    label: `${source.name} . v${source.version || "?"}`,
    selected: source === skill.activeSource,
    installed: source.installed,
    state: "normal",
  }))
```

### Reuse Opportunities

| What                 | From                                                       | How                                                 |
| -------------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| Source resolution    | `resolveAllSources()` in config.ts:186-213                 | Already parses primary + extras from config         |
| Remote fetching      | `fetchFromSource()` in source-fetcher.ts:30-41             | Called per extra source                             |
| Skill extraction     | `extractAllSkills()` in matrix-loader.ts                   | Called per source to get `ExtractedSkillMetadata[]` |
| Local skill merge    | `mergeLocalSkillsIntoMatrix()` in source-loader.ts:220-266 | Pattern for merging extra sources                   |
| Cache management     | `sanitizeSourceForCache()` in source-fetcher.ts:21-23      | Per-source cache dirs                               |
| Typed object helpers | `typedEntries()`, `typedKeys()` in utils/typed-object.ts   | For iterating source maps                           |

### Acceptance Criteria

| #   | Criterion                                                                          | Verification                                                                          |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Skills from primary source have `availableSources` with `type: "public"` entry     | Unit test: load matrix, check `matrix.skills["web-framework-react"].availableSources` |
| 2   | Skills from extra sources appear as additional `availableSources` entries          | Unit test: configure extra source, verify entries                                     |
| 3   | Local skills have `availableSources` entry with `type: "local"`, `installed: true` | Unit test with local skill directory                                                  |
| 4   | Overlapping skill IDs across sources collect all variants in `availableSources[]`  | Unit test: same skill ID from 2 sources, verify 2 entries                             |
| 5   | `activeSource` is set to installed source when present, otherwise primary          | Unit test                                                                             |
| 6   | Sources step shows real variant cards from configured sources                      | Manual test with a second source configured                                           |
| 7   | Loading from sources with no extras works identically to current behavior          | Existing tests pass unchanged                                                         |
| 8   | Network failures on extra sources produce warnings, not hard errors                | Unit test: mock `fetchFromSource` to throw, verify warning logged                     |
| 9   | Performance: loading 2 extra sources adds < 2s to init time                        | Manual timing test                                                                    |
| 10  | All existing source-loader tests pass                                              | `bun vitest run src/cli/lib/loading/`                                                 |

---

## Phase 3: Source Switching

### Scope

When a user changes the active source for a skill in the Sources step, handle the transition: archive local skills on switch, update config references, ensure correct skill content is fetched during installation.

### Files to Create

| File                                         | Purpose                                             |
| -------------------------------------------- | --------------------------------------------------- |
| `src/cli/lib/skills/source-switcher.ts`      | Archive-on-switch logic, source transition handlers |
| `src/cli/lib/skills/source-switcher.test.ts` | Unit tests for source switching                     |

### Files to Modify

| File                                          | Changes                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/cli/lib/installation/local-installer.ts` | Before copying skills, check `sourceSelections` for non-default sources. Copy from correct source path. |
| `src/cli/lib/skills/skill-copier.ts`          | Add `copySkillFromAlternateSource()` to copy from a specific source path instead of primary             |
| `src/cli/lib/skills/skill-metadata.ts`        | Add `archiveLocalSkill()` function to move skill to `_archived/`                                        |
| `src/cli/stores/wizard-store.ts`              | Ensure `sourceSelections` is included in `WizardResultV2` output                                        |
| `src/cli/components/wizard/wizard.tsx`        | Pass `sourceSelections` through to the result in `handleComplete()` (line 82-125)                       |
| `src/cli/lib/skills/index.ts`                 | Export new source-switcher functions                                                                    |

### Implementation Details

**1. Source Switcher Module** (`source-switcher.ts`)

Handle each transition case from the UX spec:

| From               | To             | Action                                                          |
| ------------------ | -------------- | --------------------------------------------------------------- |
| Installed (local)  | Public/Private | Archive to `.claude/skills/_archived/{skill-id}/`, fetch remote |
| Public             | Private        | Update source reference in config, re-fetch on install          |
| Public/Private     | Local (eject)  | Copy to `.claude/skills/` with `forked_from` metadata           |
| Installed (plugin) | Local          | Copy from plugin dir to `.claude/skills/`, mark as local        |

Key function signatures:

```
archiveLocalSkill(projectDir, skillId) -> Promise<void>
  Move .claude/skills/{skill-id}/ to .claude/skills/_archived/{skill-id}/

restoreArchivedSkill(projectDir, skillId) -> Promise<boolean>
  Move .claude/skills/_archived/{skill-id}/ back to .claude/skills/{skill-id}/
  Return true if found + restored

resolveSkillSourcePath(skillId, sourceId, sourceResult) -> string
  Given a source identifier, return the filesystem path to fetch the skill from
```

**2. Archive Logic**

Follow the existing `copy()` / `remove()` / `ensureDir()` patterns from `utils/fs.ts`:

- `archiveLocalSkill()`: `ensureDir(_archived)` -> `copy(skill -> _archived/skill)` -> `remove(skill)`
- `restoreArchivedSkill()`: check `_archived/skill` exists -> `copy(_archived/skill -> skill)` -> `remove(_archived/skill)`

Use `ARCHIVED_SKILLS_PATH = ".claude/skills/_archived"` constant (add to `consts.ts`).

> **CLI DEV NOTE: `copy()`, `remove()`, and `ensureDir()` are at `utils/fs.ts` lines 48, 52, and 56 respectively. They are thin wrappers around fs-extra. Verified available. Also note: `LOCAL_SKILLS_PATH` is already defined in `consts.ts:31` as `".claude/skills"`. The archived path should derive from it: `path.join(LOCAL_SKILLS_PATH, "_archived")`.**

**3. Install-Time Source Resolution**

In `installLocal()` (local-installer.ts:200-285), before step 2 (copy selected skills), check `wizardResult.sourceSelections`:

```
For each skill in wizardResult.selectedSkills:
  if sourceSelections[skill] exists and != "public":
    resolve alternate source path
    copy from alternate source
  else:
    copy from primary source (existing behavior)
```

**4. WizardResultV2 Extension**

Add `sourceSelections` to `WizardResultV2` (wizard.tsx:15-27) so the installation pipeline knows which source to use:

```typescript
export type WizardResultV2 = {
  // ... existing fields ...
  sourceSelections: Partial<Record<SkillId, string>>;
};
```

### Reuse Opportunities

| What                  | From                                                      | How                               |
| --------------------- | --------------------------------------------------------- | --------------------------------- |
| File operations       | `copy()`, `remove()`, `ensureDir()` from utils/fs.ts      | Archive/restore operations        |
| Forked-from injection | `injectForkedFromMetadata()` in skill-metadata.ts:156-184 | When ejecting to local            |
| Content hashing       | `hashFile()` from versioning.ts                           | Compute hash before archiving     |
| Skill copying         | `copySkillFromSource()` in skill-copier.ts                | Pattern for alternate source copy |
| Config persistence    | `saveProjectConfig()` in config.ts:72-81                  | Update source references          |

### Acceptance Criteria

| #   | Criterion                                                                   | Verification                                                                         |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Switching from installed local to public archives the local skill           | Integration test: create local skill, switch source, verify `_archived/` contains it |
| 2   | Switching back from public to local restores from archive                   | Integration test: archive, then restore, verify skill is back                        |
| 3   | Switching from public to private updates config source reference            | Unit test: verify config.sources entry                                               |
| 4   | Ejecting (public/private -> local) copies skill with `forked_from` metadata | Integration test: eject, verify metadata.yaml contains `forked_from`                 |
| 5   | `WizardResultV2.sourceSelections` is passed through to `installLocal()`     | Unit test on wizard.tsx `handleComplete()`                                           |
| 6   | Install copies skills from the correct source per `sourceSelections`        | Integration test: configure alternate source, verify correct content                 |
| 7   | Archive directory is created only when needed (not eagerly)                 | Unit test: verify `_archived/` not created when no switches                          |
| 8   | All existing installation tests pass                                        | `bun vitest run src/cli/lib/installation/`                                           |

### Phase 3b: Wire Source Switching into `cc edit`

Phase 3 built the source switching infrastructure (`source-switcher.ts`) which works during `cc init`. However, `edit.tsx` currently ignores `sourceSelections` entirely — users can change sources in the wizard during edit, but those changes are silently discarded. This phase wires source switching into the edit flow.

#### Files to Modify

| File                                 | Changes                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/commands/edit.tsx`          | Read `sourceSelections` from wizard result, compute source changes, call archive/restore, pass `sourceSelections` to copier                         |
| `src/cli/lib/skills/skill-copier.ts` | Add `sourceSelections` parameter to `copySkillsToLocalFlattened` and `copySkillsToPluginFromSource`, override local-skip when user selects "public" |

#### Implementation Details

**1. Detect Source Changes** (edit.tsx, after wizard completes)

After the wizard returns `result`, compute source changes by comparing selections against current state:

```typescript
const sourceChanges = new Map<SkillId, { from: string; to: string }>();
for (const [skillId, selectedSource] of typedEntries(result.sourceSelections)) {
  const skill = matrix.skills[skillId];
  if (skill?.activeSource && skill.activeSource.name !== selectedSource) {
    sourceChanges.set(skillId, {
      from: skill.activeSource.name,
      to: selectedSource,
    });
  }
}
```

**2. Apply Source Switches** (edit.tsx)

For each source change, apply the appropriate transition:

```
For each [skillId, { from, to }] in sourceChanges:
  if from is "local" or "Local":
    archiveLocalSkill(projectDir, skillId)  // preserve local version
    // then copy from selected remote source
  if to is "local" or "Local":
    restoreArchivedSkill(projectDir, skillId)  // bring back archived version
```

**3. Detect Source-Only Changes**

When no skills are added or removed but sources changed, the edit flow must still detect this to avoid a false "No changes made" message:

```typescript
const hasSourceChanges = sourceChanges.size > 0;
const hasSkillChanges = addedSkills.length > 0 || removedSkills.length > 0;
if (!hasSkillChanges && !hasSourceChanges) {
  // truly no changes
}
```

**4. Pass sourceSelections to Copier** (skill-copier.ts)

Add `sourceSelections` parameter to `copySkillsToLocalFlattened` and `copySkillsToPluginFromSource`. When `sourceSelections[skillId]` is set to a non-local source, override the local-skip logic that normally preserves existing local skills:

```
if sourceSelections[skillId] === "public" && localSkillExists(skillId):
  skip local preservation — user explicitly chose remote source
```

**5. Change Log Output**

Show source switches in the edit summary:

```
~ web-framework-react (Local → Public)
~ web-testing-vitest (Public → acme-corp)
```

#### Existing Infrastructure to Reuse

| What                   | From                                               | How                                   |
| ---------------------- | -------------------------------------------------- | ------------------------------------- |
| Archive local skill    | `archiveLocalSkill()` in `source-switcher.ts`      | Move local skill to `_archived/`      |
| Restore archived skill | `restoreArchivedSkill()` in `source-switcher.ts`   | Move archived skill back              |
| Check for archive      | `hasArchivedSkill()` in `source-switcher.ts`       | Detect if archived version exists     |
| Archived dir constant  | `ARCHIVED_SKILLS_DIR_NAME` in `source-switcher.ts` | Directory name for archives           |
| Typed entries          | `typedEntries()` in `utils/typed-object.ts`        | Iterate `sourceSelections` with types |

#### Acceptance Criteria

| #   | Criterion                                                     | Verification                                                                        |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | `edit.tsx` reads `sourceSelections` from wizard result        | Unit test: mock wizard result with sourceSelections, verify they're read            |
| 2   | Local→Public switch archives local skill and copies remote    | Integration test: create local skill, edit to switch to public, verify `_archived/` |
| 3   | Public→Local switch restores archived local skill             | Integration test: archive exists, edit to switch to local, verify restored          |
| 4   | Source-only changes are detected (no false "No changes")      | Unit test: wizard returns only source changes, verify they're applied               |
| 5   | Change log shows source switch notation `~ skill (From → To)` | Unit test: verify log output                                                        |
| 6   | `sourceSelections` is passed to skill copier                  | Unit test: verify copier receives and uses sourceSelections                         |
| 7   | Copier overrides local-skip when user selects remote          | Integration test: local skill exists, user selects public, verify remote copied     |
| 8   | All existing edit command tests pass                          | `bun vitest run src/cli/commands/`                                                  |

---

## Phase 4: Installed Indicator in Build Step

### Scope

Show a `checkmark` indicator on skills in the Build step that are currently installed (any source). This is a visual-only change -- no behavioral changes to the Build step.

### Files to Create

None. This phase only modifies existing files.

### Files to Modify

| File                                          | Changes                                                                                                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/components/wizard/category-grid.tsx` | Add `installed?: boolean` to `CategoryOption` type (already has `local?: boolean` at line 14). Update `SkillTag` (line 149) to show `checkmark` prefix when `installed` is true. |
| `src/cli/components/wizard/step-build.tsx`    | Compute `installed` property on each `CategoryOption` based on installation state. Pass installed skill set as prop or compute from matrix.                                      |
| `src/cli/components/wizard/wizard.tsx`        | Pass installed skill IDs to StepBuild (loaded from `detectInstallation()` + disk scan at wizard start).                                                                          |

### Implementation Details

**1. Installed Skills Detection**

At wizard startup (in the command that renders `<Wizard>`), detect installation and get installed skill IDs:

For `edit.tsx`: Already loads `currentSkillIds` (line 70-76). Pass these to the Wizard as an `installedSkillIds` prop.

For `init.tsx`: No installation exists yet, so `installedSkillIds` is empty.

**2. CategoryOption Extension**

In `category-grid.tsx`, `CategoryOption` (line 8-15) already has `local?: boolean`. Add `installed?: boolean` following the same optional pattern:

```typescript
export type CategoryOption = {
  id: SkillId;
  label: string;
  state: OptionState;
  stateReason?: string;
  selected: boolean;
  local?: boolean;
  installed?: boolean; // NEW
};
```

**3. SkillTag Visual Update**

In `SkillTag` (category-grid.tsx:149-200), add checkmark rendering. Follow the existing `local` badge pattern at lines 191-195:

```
{option.installed && !option.local && (
  <Text dimColor>{"checkmark"} </Text>
)}
```

The checkmark is dimmed (not prominent) per UX spec. It's distinct from the `L` badge and the cyan selected state.

**4. StepBuild Integration**

In `buildCategoriesForDomain()` (step-build.tsx:132-188), when building `CategoryOption[]` (lines 169-176), add the `installed` field:

```typescript
const options: CategoryOption[] = filteredSkillOptions.map((skill) => ({
  // ... existing fields ...
  installed: installedSkillIds.has(skill.id), // NEW
}));
```

The `installedSkillIds` set needs to be passed through from the Wizard component.

> **CLI DEV NOTE: `buildCategoriesForDomain()` is a module-level function (not a method), and it takes 6 parameters already. Adding `installedSkillIds` as a 7th parameter makes the signature unwieldy. Consider passing it as part of an options object, or better yet, put installed skill IDs on the `ResolvedSkill` objects in the matrix itself (via a `installed?: boolean` field, similar to how `local?: boolean` already works). This way `step-build.tsx` can check `matrix.skills[skill.id]?.installed` just like it checks `matrix.skills[skill.id]?.local` at line 175.**
>
> **This approach is cleaner and avoids threading a Set through multiple component layers. The `installed` field on `ResolvedSkill` would be set during matrix loading (near where `local` is set in `mergeLocalSkillsIntoMatrix`).**

### Reuse Opportunities

| What                      | From                                        | How                                         |
| ------------------------- | ------------------------------------------- | ------------------------------------------- |
| Local badge pattern       | `category-grid.tsx:191-195`                 | Same inline rendering pattern for checkmark |
| Installed skill detection | `getPluginSkillIds()` from plugin-finder.ts | Get IDs from plugin dir                     |
| Installation detection    | `detectInstallation()` from installation.ts | Determine local vs plugin mode              |
| Edit command pattern      | `edit.tsx:70-76`                            | Already loads `currentSkillIds`             |

### Acceptance Criteria

| #   | Criterion                                                 | Verification                                                                     |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | `CategoryOption` type includes optional `installed` field | `bun tsc --noEmit`                                                               |
| 2   | Installed skills show checkmark in Build step             | Component test: render with `installed: true`, verify checkmark in `lastFrame()` |
| 3   | Non-installed skills do NOT show checkmark                | Component test: render with `installed: false`, verify no checkmark              |
| 4   | Checkmark is dimmed (not prominent)                       | Visual inspection of component test output                                       |
| 5   | Installed + selected shows both checkmark and cyan border | Component test with both flags true                                              |
| 6   | Local badge (`L`) and installed checkmark can coexist     | Component test with both `local: true` and `installed: true`                     |
| 7   | `cc edit` passes installed skill IDs to wizard            | Manual test or integration test                                                  |
| 8   | `cc init` passes empty installed set                      | Verify no checkmarks on fresh init                                               |
| 9   | All existing CategoryGrid tests pass                      | `bun vitest run src/cli/components/wizard/category-grid.test.tsx`                |

---

## Phase 5: Settings View

### Scope

Add a settings view accessible from the Sources step via `G` hotkey. Shows configured marketplaces with enable/disable toggle, add/remove sources, and local/plugin counts. Persists changes to `.claude-src/config.yaml`.

### Files to Create

| File                                               | Purpose                                                 |
| -------------------------------------------------- | ------------------------------------------------------- |
| `src/cli/components/wizard/step-settings.tsx`      | Settings view component for source management           |
| `src/cli/components/wizard/step-settings.test.tsx` | Component tests for settings view                       |
| `src/cli/lib/configuration/source-manager.ts`      | Add/remove/toggle sources, fetch + validate new sources |
| `src/cli/lib/configuration/source-manager.test.ts` | Unit tests for source management                        |

### Files to Modify

| File                                          | Changes                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/cli/stores/wizard-store.ts`              | Add `showSettings: boolean` and `toggleSettings()` action. Track enabled/disabled sources. |
| `src/cli/components/wizard/wizard.tsx`        | Handle `G` hotkey to toggle settings overlay. Render settings when active.                 |
| `src/cli/components/wizard/wizard-layout.tsx` | Add `G Settings` hotkey hint (visible only on Sources step).                               |
| `src/cli/lib/configuration/config.ts`         | Add `saveProjectSourceConfig()` helper or reuse existing `saveProjectConfig()`.            |
| `src/cli/lib/configuration/index.ts`          | Export source-manager functions                                                            |

### Implementation Details

**1. Settings View Component** (`step-settings.tsx`)

A full-screen overlay that replaces the Sources step content when active. Follows the list-based layout from the UX spec:

Structure:

- Title: "Skill Sources"
- Configured marketplaces list (bordered box, checkmark for enabled)
- "Add source" text input at the bottom
- Local/plugin count summary
- Footer: navigation, toggle, delete, escape-to-return

Keyboard handling:

- Up/Down: navigate marketplace list
- Enter: toggle source on/off
- Del/Backspace: remove source (with confirmation prompt)
- Escape: return to Sources step
- Text input in "Add source" field when focused

Follow the `SkillSearch` component pattern (skill-search.tsx) for list navigation with scroll:

- `focusedIndex` state for list position
- `scrollOffset` for windowed rendering
- Input handling for the "Add source" field

> **CLI DEV NOTE: Text input in the Settings view creates a keyboard conflict with wizard.tsx's global hotkeys. The global `useInput` handler at wizard.tsx:72-79 captures `"e"/"E"` (expert mode) and `"p"/"P"` (plugin mode). If the user types "p" in the "Add source" URL field, it will toggle plugin mode. Solution: either (1) add `store.showSettings` to the global handler's guard condition, or (2) disable the global handler when a text input is active. SkillSearch avoids this because it's a full-screen takeover (not inside the Wizard component) -- it has its own `useApp` and `exit()`.**

**2. Source Manager** (`source-manager.ts`)

Functions:

```
addSource(projectDir, url): Promise<{ name, skillCount, categories }>
  1. Call fetchMarketplace(url) (source-fetcher.ts:150-188) to validate
  2. Call extractAllSkills() on fetched source to count skills
  3. Append to config.sources[] via saveProjectConfig()
  4. Return summary for UI display

removeSource(projectDir, name): Promise<void>
  1. Load config, filter out source by name
  2. Save updated config

toggleSource(projectDir, name, enabled): Promise<void>
  1. Load config, update source entry
  2. Save updated config

getSourceSummary(projectDir): Promise<SourceSummary>
  1. Load config
  2. Count local skills via discoverLocalSkills()
  3. Count plugin skills via detectInstallation() + getPluginSkillIds()
  4. Return summary
```

**3. State Management** (`wizard-store.ts`)

Add minimal state for the settings overlay:

```typescript
showSettings: boolean;
enabledSources: Record<string, boolean>;  // source names that are toggled on
toggleSettings: () => void;
toggleSourceEnabled: (name: string) => void;
```

> **CLI DEV NOTE: The PM originally suggested `Set<string>`. This won't work with Zustand's `create()` -- mutating a Set doesn't change the reference, so React won't re-render. Use `Record<string, boolean>` or `string[]` instead, following the existing store patterns (all state is plain objects/arrays). See existing patterns like `domainSelections: {} as DomainSelections` at wizard-store.ts:79.**

**4. Config Persistence**

Use `loadProjectSourceConfig()` (config.ts:37-70) and `saveProjectConfig()` (config.ts:72-81) for read/write. The `ProjectSourceConfig.sources` field is already an array of `SourceEntry`.

The public marketplace cannot be removed (only toggled off). Enforce this in `removeSource()`.

**5. Add Source Flow**

When user types a URL and presses Enter:

1. Show "Fetching..." spinner
2. Call `fetchMarketplace()` to validate
3. On success: show summary (name, skill count), ask for confirmation
4. On Enter: add to config, refresh available sources
5. On Escape: cancel

Follow the `fetchMarketplace()` error handling pattern for user-friendly error messages.

> **CLI DEV NOTE: The PM references "source-fetcher.ts:100-148" for error handling. The actual error wrapping function is `wrapGigetError()` at lines 100-148 (correct). It handles 404, 401, 403, network errors. `fetchMarketplace()` itself is at lines 150-188 and validates the marketplace.json structure. Both are good patterns to follow.**

### Reuse Opportunities

| What                   | From                                                             | How                             |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------- |
| List navigation        | `skill-search.tsx:290-337`                                       | focusedIndex + up/down handling |
| Text input             | `skill-search.tsx:79-99` (SearchInput)                           | "Add source" input field        |
| Marketplace validation | `fetchMarketplace()` in source-fetcher.ts:150-188                | Validate new source URL         |
| Config read/write      | `loadProjectSourceConfig()` + `saveProjectConfig()` in config.ts | Persist changes                 |
| Local skill discovery  | `discoverLocalSkills()` in local-skill-loader.ts:33-59           | Count local skills              |
| Installation detection | `detectInstallation()` + `getPluginSkillIds()`                   | Count plugin skills             |
| Hotkey rendering       | `DefinitionItem` in wizard-layout.tsx:13-36                      | "G Settings" hint               |

### Acceptance Criteria

| #   | Criterion                                                            | Verification                                                     |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | `G` key on Sources step opens Settings view                          | Component test: render Sources, press G, verify settings content |
| 2   | Settings shows list of configured sources with enable/disable toggle | Component test with mock config containing 2 sources             |
| 3   | Enter on a source toggles its checkmark (enabled/disabled)           | Component test: press Enter, verify toggle                       |
| 4   | "Add source" input accepts text and fetches on Enter                 | Component test with mocked `fetchMarketplace`                    |
| 5   | Successful add shows confirmation with skill count                   | Component test: mock successful fetch, verify summary            |
| 6   | Failed add shows user-friendly error message                         | Component test: mock failed fetch, verify error display          |
| 7   | Del/Backspace removes a source (with confirmation)                   | Component test: press Del, confirm, verify removal               |
| 8   | Public marketplace cannot be removed                                 | Component test: try to delete public, verify rejection           |
| 9   | Escape returns to Sources step                                       | Component test: press Escape, verify settings closed             |
| 10  | Changes persist to `.claude-src/config.yaml`                         | Integration test with temp dir                                   |
| 11  | Local/plugin counts are displayed                                    | Component test: mock installation state                          |
| 12  | All existing wizard tests pass                                       | `bun vitest run src/cli/components/wizard/`                      |

---

## Phase 6: Bound Skill Search

> **DESIGN REVISED:** The original Phase 6 design (inline text input search card + dropdown results box) has been replaced with a simpler modal-based approach. See [ux-2.0-multi-source.md](./ux-2.0-multi-source.md) for the revised UX spec.

### Scope

Add a search pill as the last element in every source row. Pressing Space on the search pill immediately searches all configured extra marketplaces using the subcategory's alias (e.g., "react"). Results appear in a modal overlay. Selecting a result binds it to the subcategory as a new source variant card.

### Key Design Changes from Original Phase 6

| Original Design                                                       | Revised Design                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `SearchCard` dual-mode component (idle text card / active text input) | Simple search pill — no text input, Space triggers immediate search |
| `SearchResultsBox` inline dropdown (pushes content down)              | Modal overlay (floats above content)                                |
| User types a search query                                             | Search uses subcategory alias automatically                         |
| Results appear inline below the row                                   | Results appear in a centered modal                                  |
| Complex state machine (`idle` → `searching` → `results`)              | Simple state: pill focused → modal open → modal closed              |
| Required `useInput` coordination between grid and search input        | No input conflict — modal captures all input when open              |

### Files to Create

| File                                              | Purpose                                                      |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `src/cli/components/wizard/search-modal.tsx`      | Modal overlay showing search results from extra marketplaces |
| `src/cli/components/wizard/search-modal.test.tsx` | Component tests for search modal                             |

### Files to Modify

| File                                         | Changes                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/cli/components/wizard/source-grid.tsx`  | Append search pill to each row, handle Space to trigger search, render modal when active |
| `src/cli/lib/loading/multi-source-loader.ts` | Extract `searchExtraSources(alias, configuredSources)` function from `tagExtraSources`   |
| `src/cli/stores/wizard-store.ts`             | Add `boundSkills` state and `bindSkill` action                                           |
| `src/cli/lib/configuration/config.ts`        | Add `boundSkills` to `ProjectSourceConfig`                                               |
| `src/cli/lib/schemas.ts`                     | Add `boundSkillSchema`                                                                   |

### Implementation Details

**1. Search Modal** (`search-modal.tsx`)

A modal overlay component that displays search results:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Search results for "react"                                                  │
│                                                                              │
│  ▸ awesome-dev/react-pro          v3   Opinionated React with strict TS     │
│    team-xyz/react-strict          v1   Strict mode, concurrent, suspense    │
│    solo-dev/react-minimal         v2   Minimal — hooks only, no classes     │
│    company/react-enterprise       v4   Enterprise with auth, RBAC, audit    │
│                                                                              │
│  ↑/↓ navigate   ENTER bind   ESC close                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Renders as an overlay (uses Ink's `Box` with absolute positioning or z-index layering)
- ↑/↓ navigates results, `▸` marks focused result
- Enter binds the focused result to the subcategory
- Escape closes without binding
- Modal captures all input while open — grid navigation is paused

**2. Search Pill in Source Grid** (`source-grid.tsx`)

Each source row gets a search pill appended as the last element:

```
[Public · v2] [acme · v1] [✓ Installed · v2] [⌕ Search]
```

The search pill is navigable like any other card but does not toggle selection. Instead:

- Space on the search pill triggers `searchExtraSources(subcategoryAlias, configuredSources)`
- The search function queries all configured extra marketplaces for skills matching the alias
- Results are passed to the search modal for display

**3. Search Function** (`multi-source-loader.ts`)

Extract from the existing `tagExtraSources` logic:

```typescript
searchExtraSources(
  alias: SkillAlias,
  configuredSources: SourceEntry[]
): Promise<BoundSkillCandidate[]>
```

Queries each configured extra source for skills whose alias matches. Returns candidates with source name, skill ID, version, and description.

**4. Bound Skills State** (`wizard-store.ts`)

```typescript
// Add to WizardState
boundSkills: BoundSkill[];

// Add action
bindSkill(skill: BoundSkill): void;
```

When a search result is bound:

1. Add to `boundSkills` array in store
2. Add a new `SkillSource` entry to the target skill's `availableSources`
3. The new variant card appears in the source row

**5. BoundSkill Type and Schema**

```typescript
type BoundSkill = {
  id: SkillId;
  sourceUrl: string;
  sourceName: string;
  boundTo: SkillAlias;
  description?: string;
};
```

Persisted in `.claude-src/config.yaml`:

```yaml
boundSkills:
  - id: web-framework-react-pro
    sourceUrl: github:awesome-dev/skills
    sourceName: awesome-dev
    boundTo: react
    description: Opinionated React with strict TypeScript
```

Schema in `schemas.ts`:

```typescript
const boundSkillSchema: z.ZodType<BoundSkill> = z.object({
  id: z.string(),
  sourceUrl: z.string(),
  sourceName: z.string(),
  boundTo: z.string(),
  description: z.string().optional(),
});
```

**6. Config Persistence** (`config.ts`)

Add `boundSkills?: BoundSkill[]` to `ProjectSourceConfig`. When binding a skill, persist to config immediately.

### Reuse Opportunities

| What              | From                                            | How                             |
| ----------------- | ----------------------------------------------- | ------------------------------- |
| Modal rendering   | Existing Ink `Box` patterns                     | Overlay with border             |
| List navigation   | `skill-search.tsx:290-337`                      | focusedIndex + up/down handling |
| Source loading    | `tagExtraSources()` in `multi-source-loader.ts` | Extract search function         |
| Card rendering    | `SkillTag` in `category-grid.tsx`               | Search pill visual              |
| Source management | `addSource()` in `source-manager.ts`            | Persist bound skill sources     |
| Config schemas    | `schemas.ts`                                    | Bridge pattern for `BoundSkill` |

### Acceptance Criteria

| #   | Criterion                                                    | Verification                                                             |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1   | Each source row ends with a `⌕ Search` pill                  | Component test: render source grid, verify pill in each row              |
| 2   | Space on search pill triggers search using subcategory alias | Component test: focus pill, press Space, verify search called with alias |
| 3   | Modal overlay appears with results from extra sources        | Component test: trigger search, verify modal rendered with results       |
| 4   | ↑/↓ navigates results within the modal                       | Component test: open modal, press down, verify focused result changes    |
| 5   | Enter on a result binds it and closes modal                  | Component test: select result, verify bound skill added, modal closed    |
| 6   | Escape closes modal without binding                          | Component test: open modal, press Escape, verify no binding              |
| 7   | Bound skill appears as new variant card in the row           | Component test: bind result, verify new card in source row               |
| 8   | Bound skills persist to `config.yaml` under `boundSkills`    | Integration test: bind skill, verify config file                         |
| 9   | `boundSkillSchema` validates correct/incorrect data          | Unit test on schema                                                      |
| 10  | Grid navigation pauses while modal is open                   | Component test: open modal, press ←/→, verify grid doesn't move          |
| 11  | All existing source grid tests pass                          | `bun vitest run src/cli/components/wizard/`                              |

---

## Testing Strategy

### Unit Tests

| Area                | Test Files                                         | What to Test                                                               |
| ------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| Source types        | `src/cli/types/matrix.test.ts`                     | New types compile correctly, `SkillSource` validates                       |
| Zod schemas         | `src/cli/lib/schemas.test.ts`                      | `skillSourceSchema` validates correct/incorrect data                       |
| Multi-source loader | `src/cli/lib/loading/multi-source-loader.test.ts`  | Loading from 0, 1, 2+ sources. Error handling per source. Correct tagging. |
| Source switcher     | `src/cli/lib/skills/source-switcher.test.ts`       | Archive, restore, eject transitions. Path resolution.                      |
| Source manager      | `src/cli/lib/configuration/source-manager.test.ts` | Add, remove, toggle sources. Config persistence.                           |
| Search backend      | `src/cli/lib/skills/skill-search-backend.test.ts`  | Query matching across sources. Empty queries. No results.                  |

All unit tests follow the established pattern:

- `vi.mock("../../utils/fs")` and `vi.mock("../../utils/logger")` for file/log mocking
- `vi.mocked(readFile).mockResolvedValue(...)` for per-test configuration
- Test skill IDs matching `SkillId` pattern (e.g., `"web-test-a"`)

### Component Tests (ink-testing-library)

| Component        | Test File                     | What to Test                                                            |
| ---------------- | ----------------------------- | ----------------------------------------------------------------------- |
| StepSources      | `step-sources.test.tsx`       | Rendering, recommended/customize toggle, Enter/Escape navigation        |
| SourceGrid       | `source-grid.test.tsx`        | Grid navigation, source selection, exclusive per-row, keyboard handling |
| StepSettings     | `step-settings.test.tsx`      | Source list, toggle, add input, delete confirmation, Escape             |
| SearchCard       | `search-card.test.tsx`        | Idle/active modes, text input, Escape clear                             |
| SearchResultsBox | `search-results-box.test.tsx` | Results rendering, focused index, Enter select                          |

All component tests follow the established pattern from `step-refine.test.tsx` and `category-grid.test.tsx`:

- `render(<Component {...props} />)` from `ink-testing-library`
- `lastFrame()` for snapshot assertions
- `stdin.write(ENTER)` for keyboard simulation
- `await delay(INPUT_DELAY_MS)` for async settling (INPUT_DELAY_MS = 50, RENDER_DELAY_MS also used)
- `afterEach(() => { cleanup?.(); })` for cleanup
- Test constants imported from `../../lib/__tests__/test-constants` (ENTER, ESCAPE, ARROW_UP, ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT, delay, RENDER_DELAY_MS, INPUT_DELAY_MS)

> **CLI DEV NOTE: The cleanup pattern in existing tests uses `const { lastFrame, unmount } = renderComponent()` and then `cleanup = unmount` in afterEach. See step-refine.test.tsx for the canonical example. Also: the Zustand store is global (module-level `create()`), so tests that use the wizard store need `useWizardStore.getState().reset()` in beforeEach/afterEach to avoid state leaking between tests.**

### Integration Tests

| Test                 | Location                                                     | What to Test                                                                        |
| -------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Multi-source loading | `src/cli/lib/__tests__/integration/multi-source.test.ts`     | Real file system: create multiple source directories, load and verify merged matrix |
| Source switching     | `src/cli/lib/__tests__/integration/source-switching.test.ts` | Real file system: archive, restore, verify file operations                          |
| Config persistence   | `src/cli/lib/__tests__/integration/source-config.test.ts`    | Real file system: add/remove sources, verify YAML output                            |

Integration tests use real file system with temp directories:

- `createTempDir()` / `cleanupTempDir()` from `helpers.ts:93-95` / `helpers.ts:97-99`
- `createTestDirs()` from `helpers.ts:109-120` for full project structure
- Test data fixtures from `test-fixtures.ts` (e.g., `createTestReactSkill()`, `createTestHonoSkill()`)

> **CLI DEV NOTE: The PM references `createMockMatrix()` / `createMockSkill()` but these DO NOT EXIST. The actual test fixtures are in `src/cli/lib/__tests__/test-fixtures.ts` and export functions like `createTestReactSkill()`, `createTestVueSkill()`, etc. There is also `helpers.ts` which exports `createTempDir`, `cleanupTempDir`, `createTestDirs`, and `runCliCommand`. Use these actual helpers, not the invented names.**

### Command Tests

| Command   | Test File                                             | What to Test                                                                |
| --------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `cc init` | `src/cli/lib/__tests__/commands/init-sources.test.ts` | Wizard flow includes Sources step, config output includes source selections |
| `cc edit` | `src/cli/lib/__tests__/commands/edit-sources.test.ts` | Installed skill indicators, source pre-selection                            |

Command tests use `runCliCommand()` from `helpers.ts:49-51` with the oclif test runner.

---

## Risk Assessment

### Technical Risks

| Risk                                                                                                              | Severity | Likelihood | Mitigation                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-source loading performance** -- loading 3+ remote sources adds significant startup latency                | High     | Medium     | Parallel `Promise.all()` for independent source fetches. Cache aggressively via existing `sanitizeSourceForCache()`. Show progress indicator during load.                     |
| **Skill ID collisions across sources** -- same `SkillId` from different sources with different content            | High     | High       | By design: `availableSources[]` collects all variants under the same `SkillId`. User picks one. Only one active at a time.                                                    |
| **State complexity in wizard store** -- source selections add another dimension to already complex wizard state   | Medium   | Medium     | Keep source state minimal (`sourceSelections: Record<SkillId, string>`). Don't duplicate skill data in store -- reference matrix. Follow existing `domainSelections` pattern. |
| **CategoryGrid reuse vs. fork** -- source grid needs slightly different behavior (exclusive per-row, search card) | Medium   | Low        | Create `SourceGrid` as a new component that follows `CategoryGrid` patterns but is purpose-built. Avoid modifying `CategoryGrid` itself (used by Build step).                 |
| **Archive directory conflicts** -- archiving when `_archived/` already has a version                              | Low      | Low        | Overwrite on archive (timestamp in metadata preserves history). Log warning if overwriting.                                                                                   |
| **Search card keyboard conflicts** -- text input captures keys that grid navigation uses                          | Medium   | Medium     | Clear state machine: `idle` vs `searching` mode. In `searching` mode, only Escape exits. Grid navigation paused.                                                              |

### UX Risks

| Risk                                                                                                       | Severity | Likelihood | Mitigation                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Users confused by Sources step** -- most users only use public marketplace, extra step feels unnecessary | High     | Medium     | Default is "Use recommended" which skips directly to Confirm. One Enter press. Zero friction for the common case.                                |
| **Information overload in customize view** -- many skills x many sources = many cards                      | Medium   | Medium     | Only selected skills appear (not all available). Each row is compact (one line of cards). Search card is last, not prominent.                    |
| **Settings view discoverability** -- `G` hotkey not obvious                                                | Low      | High       | Hotkey hint visible in footer when on Sources step. Settings is a power-user feature, not needed for basic flow.                                 |
| **Inline search expectations** -- users may expect full marketplace browsing                               | Medium   | Low        | Search is scoped to configured sources. Label clearly: "Search configured sources". Full marketplace browsing is a separate `cc search` command. |

### Compatibility Risks

| Risk                                                                                  | Severity | Likelihood | Mitigation                                                                                                                                                                         |
| ------------------------------------------------------------------------------------- | -------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Existing config files lack `sources` field** -- users upgrading from older versions | Low      | High       | `sources` is already optional in `ProjectSourceConfig` (config.ts:24). `resolveAllSources()` (config.ts:186-213) returns empty extras when field is missing. Zero breaking change. |
| **`WizardStep` union change breaks consumers** -- adding `"sources"` to the union     | Medium   | Low        | Only the wizard's own switch statement and wizard-layout consume this. Update both in Phase 1. No external consumers.                                                              |
| **`ResolvedSkill` extension breaks existing code** -- adding optional fields          | Low      | Low        | `availableSources?` and `activeSource?` are optional. All existing code that creates `ResolvedSkill` objects (test helpers, matrix-loader, source-loader) is unaffected.           |
| **WIZARD_STEPS array change breaks tab rendering** -- renumbering Confirm from 4 to 5 | Low      | Medium     | `wizard-tabs.test.tsx` will catch this. Update test expectations in Phase 1.                                                                                                       |
| **Edit command flow** -- currently skips refine/sources entirely                      | Medium   | Medium     | Phase 1 must ensure `cc edit` wizard flow includes Sources step with pre-populated source selections matching current installation.                                                |

> **CLI DEV NOTE on Edit Command Integration:** The `cc edit` command (edit.tsx) renders `<Wizard>` identically to `cc init`. It does NOT pass any props indicating "edit mode" or pre-existing installation state. The Wizard component at wizard.tsx:29-34 accepts `{ matrix, onComplete, onCancel, version }` -- no props for installed skills or source selections. To support pre-populated source selections in `cc edit`:
>
> 1. The `currentSkillIds` computed at edit.tsx:70-72 via `getPluginSkillIds()` should be passed to Wizard
> 2. Wizard needs a new optional prop like `initialInstalledSkillIds?: SkillId[]`
> 3. The Sources step can use this to show which skills are already installed
> 4. This is a Phase 2/3 concern (when multi-source loading makes `availableSources` meaningful)
