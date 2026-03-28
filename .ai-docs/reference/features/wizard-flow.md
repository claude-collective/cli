# Wizard Flow

**Last Updated:** 2026-03-28

## Overview

**Purpose:** Multi-step interactive terminal UI for selecting skills, agents, and sources.

**Rendered by:** `init` and `edit` commands using Ink (React-based terminal rendering).

**State:** Zustand store at `src/cli/stores/wizard-store.ts`

## Step Progression

```
stack -> domains -> build -> sources -> agents -> confirm
```

- `stack`: Select a pre-built stack OR choose "Start from scratch"
- `domains`: Select which domains to configure (checkboxes)
- `build`: Per-domain skill selection (CategoryGrid with category sections)
- `sources`: Choose which source provides each skill (recommended vs custom)
- `agents`: Select which agents to compile
- `confirm`: Review selections and confirm

**Step type** (`src/cli/stores/wizard-store.ts:172-178`):

```typescript
type WizardStep = "stack" | "domains" | "build" | "sources" | "agents" | "confirm";
```

**Shortcut:** If stack selected with `stackAction: "defaults"`, jumps directly to confirm (skips build/sources/agents). Both stack and scratch flows go through `domains` step.

## Component Architecture

```
Wizard (src/cli/components/wizard/wizard.tsx)
  |-> WizardLayout (wizard-layout.tsx)
  |     |-> WizardTabs (wizard-tabs.tsx) - Step progress indicators
  |     |-> InfoPanel (info-panel.tsx) - Skill/agent scope summary (feature-flagged: FEATURE_FLAGS.INFO_PANEL)
  |     |-> WizardFooter (inline in wizard-layout.tsx) - SPACE/ENTER/ESC key hints
  |
  |-> Step Components (conditional render based on store.step):
  |     |-> StepStack (step-stack.tsx) - Stack selection
  |     |     |-> StackSelection (stack-selection.tsx) - Stack list + "Start from scratch"
  |     |-> DomainSelection (domain-selection.tsx) - Domain toggles
  |     |     |-> CheckboxGrid (checkbox-grid.tsx) - Generic checkbox list
  |     |-> StepBuild (step-build.tsx) - Technology selection
  |     |     |-> CategoryGrid (category-grid.tsx) - Category sections
  |     |     |     |-> CheckboxGrid (checkbox-grid.tsx) - Skill toggles (reused)
  |     |     |-> SectionProgress (section-progress.tsx) - Category progress
  |     |-> StepSources (step-sources.tsx) - Source selection
  |     |     |-> SelectionCard (selection-card.tsx) - Choice card (feature-flagged: SOURCE_CHOICE)
  |     |     |-> SourceGrid (source-grid.tsx) - Per-skill source picker
  |     |     |-> SearchModal (search-modal.tsx) - Bound skill search (feature-flagged: SOURCE_SEARCH)
  |     |-> StepAgents (step-agents.tsx) - Agent selection
  |     |-> StepConfirm (step-confirm.tsx) - Confirmation
  |
  |-> Overlays:
        |-> StepSettings (step-settings.tsx) - Source management (S hotkey on sources step; feature-flagged: SOURCE_SEARCH)
```

Additional wizard components (not in main render tree):

- `menu-item.tsx` - Reusable menu item component
- `selection-card.tsx` - Selection card display (used by StepSources choice view)
- `step-refine.tsx` - Refinement step (all-recommended vs customize); currently unused in renderStep switch
- `view-title.tsx` - Step title component (imported by multiple steps but some usages are commented out)
- `stats-panel.tsx` - Statistics panel (exports `StatsPanel` and `computeStats()`); currently unused in render tree

## Feature Flags

Feature flags live at `src/cli/lib/feature-flags.ts`:

| Flag | Default | Controls |
| --- | --- | --- |
| `SOURCE_SEARCH` | `false` | Search pill in source grid, settings overlay access |
| `SOURCE_CHOICE` | `false` | Intermediate "recommended vs customize" screen in sources step |
| `INFO_PANEL` | `false` | `I` key opens info panel overlay in wizard-layout |

## Wizard Props (from commands)

```typescript
// src/cli/components/wizard/wizard.tsx:47-63
type WizardProps = {
  onComplete: (result: WizardResultV2) => void; // Called on confirm
  onCancel: () => void; // Called on Escape/Ctrl+C
  version?: string; // CLI version for display
  logo?: string; // ASCII logo for header
  initialStep?: WizardStep; // "build" for edit mode
  initialDomains?: Domain[]; // Restore for edit mode
  initialAgents?: AgentName[]; // Restore for edit mode
  installedSkillIds?: SkillId[]; // Current skills for edit mode
  installedSkillConfigs?: SkillConfig[]; // Saved scope/source configs for edit mode
  installedAgentConfigs?: AgentScopeConfig[]; // Saved agent scope configs for edit mode
  lockedSkillIds?: SkillId[]; // Skills that cannot be toggled (D9: global items in project context)
  lockedAgentNames?: AgentName[]; // Agents that cannot be toggled (D9: global items in project context)
  isEditingFromGlobalScope?: boolean; // When true, S key (scope toggle) is disabled
  projectDir?: string;
  startupMessages?: StartupMessage[]; // Messages to display on startup
};
```

**Note:** The wizard does NOT receive a `matrix` prop. It accesses the matrix singleton via `matrix-provider.ts` imports.

## WizardResultV2 (`src/cli/components/wizard/wizard.tsx:32-45`)

```typescript
type WizardResultV2 = {
  skills: SkillConfig[]; // { id, scope, source } per skill
  selectedAgents: AgentName[];
  agentConfigs: AgentScopeConfig[]; // { name, scope } per agent
  selectedStackId: string | null;
  domainSelections: DomainSelections;
  selectedDomains: Domain[];
  cancelled: boolean;
  validation: {
    valid: boolean;
    errors: Array<{ message: string }>;
    warnings: Array<{ message: string }>;
  };
};
```

## Wizard Hooks

| Hook | File | Purpose |
| --- | --- | --- |
| `useWizardInitialization` | `src/cli/components/hooks/use-wizard-initialization.ts` | Initialize store from props |
| `useBuildStepProps` | `src/cli/components/hooks/use-build-step-props.ts` | Compute build step derived data |
| `useCategoryGridInput` | `src/cli/components/hooks/use-category-grid-input.ts` | Keyboard navigation for grid |
| `useKeyboardNavigation` | `src/cli/components/hooks/use-keyboard-navigation.ts` | Arrow key + Enter handling |
| `useFilteredResults` | `src/cli/components/hooks/use-filtered-results.ts` | Text search filtering |
| `useFocusedListItem` | `src/cli/components/hooks/use-focused-list-item.ts` | Focus tracking for lists |
| `useFrameworkFiltering` | `src/cli/components/hooks/use-framework-filtering.ts` | Framework-first skill filtering |
| `useMeasuredHeight` | `src/cli/components/hooks/use-measured-height.ts` | Component height measurement |
| `useModalState` | `src/cli/components/hooks/use-modal-state.ts` | Modal open/close state |
| `useRowScroll` | `src/cli/components/hooks/use-row-scroll.ts` | Row-based scroll position |
| `useSectionScroll` | `src/cli/components/hooks/use-section-scroll.ts` | Section-based scroll position |
| `useSourceGridSearchModal` | `src/cli/components/hooks/use-source-grid-search-modal.ts` | Search modal for sources |
| `useSourceOperations` | `src/cli/components/hooks/use-source-operations.ts` | Source add/remove operations |
| `useTerminalDimensions` | `src/cli/components/hooks/use-terminal-dimensions.ts` | Terminal width/height tracking |
| `useTextInput` | `src/cli/components/hooks/use-text-input.ts` | Text input handling |
| `useVirtualScroll` | `src/cli/components/hooks/use-virtual-scroll.ts` | Virtual scrolling for long lists |

## Build Step Logic

**Pure functions:** `src/cli/lib/wizard/build-step-logic.ts`

Contains non-UI logic extracted from the build step for testability:

- `validateBuildStep()` - Validate build step selections (required categories)
- `isCompatibleWithSelectedFrameworks()` - Check if a skill is compatible with selected framework skills
- `buildCategoriesForDomain()` - Build category row data for a domain

## Edit Mode Flow

When `edit` command enters the wizard:

1. `initialStep="build"` (skips stack and domains steps)
2. `installedSkillIds` populated from current installation
3. `installedSkillConfigs` carries saved scope/source configs
4. `installedAgentConfigs` carries saved agent scope configs
5. `lockedSkillIds`/`lockedAgentNames` mark global items as read-only in project context
6. `isEditingFromGlobalScope` disables scope toggle (S key) when editing global config
7. `useWizardInitialization` calls `populateFromSkillIds(skillIds, savedConfigs)` to hydrate store
8. `useWizardInitialization` walks through steps via `setStep()` to build `history` naturally
9. `initialDomains` and `initialAgents` restore previous wizard state
10. User modifies selections
11. On confirm: diff computed (added/removed/source-changed)

## Keyboard Navigation

Hotkeys are centralized in `src/cli/components/wizard/hotkeys.ts`.

Global hotkeys (handled in `wizard.tsx`):

- `I`: Toggle info panel (feature-flagged: `FEATURE_FLAGS.INFO_PANEL`)
- `Escape`: Each step handles its own ESC (cancel on stack step, goBack on other steps)
- `A` (build step with stack selected): Accept stack defaults, jump to confirm
- `S` (build step): Toggle focused skill scope (project/global); disabled when `isEditingFromGlobalScope`
- `S` (agents step): Toggle focused agent scope (project/global); disabled when `isEditingFromGlobalScope`
- `S` (sources step): Toggle settings overlay (feature-flagged: `SOURCE_SEARCH`)

Per-step hotkeys vary by component (arrow keys, j/k vim keys, Space for toggle, Enter for confirm).

Build step hotkeys (in `hotkeys.ts`):

- `D`: Toggle labels display (`HOTKEY_TOGGLE_LABELS`)
- `F`: Toggle incompatible skill filtering (`HOTKEY_FILTER_INCOMPATIBLE`)

Sources step hotkeys:

- `L`: Set all sources to local (`HOTKEY_SET_ALL_LOCAL`)
- `P`: Set all sources to plugin/marketplace (`HOTKEY_SET_ALL_PLUGIN`)

Settings step hotkeys:

- `A`: Add source (`HOTKEY_ADD_SOURCE`)
- `DEL`/`Backspace`: Remove focused source
- `ESC` or `S`: Close settings

Hotkey helpers:

- `isHotkey(input, hotkey)` - Case-insensitive character comparison

Common key labels exported from `hotkeys.ts`:

- `KEY_LABEL_ENTER`, `KEY_LABEL_ESC`, `KEY_LABEL_SPACE`, `KEY_LABEL_TAB`, `KEY_LABEL_DEL`
- `KEY_LABEL_ARROWS` (horizontal), `KEY_LABEL_ARROWS_VERT` (vertical)
- `KEY_LABEL_VIM`, `KEY_LABEL_VIM_VERT`

## Build Step Domain Order

From `src/cli/consts.ts:190`:

```typescript
BUILT_IN_DOMAIN_ORDER = ["web", "api", "ai", "mobile", "cli", "infra", "meta", "shared"];
```

Custom domains appear before built-in domains, alphabetically.

Default scratch domains (`src/cli/consts.ts:202`): `["web", "api", "mobile"]`.

Domain descriptions defined in `domain-selection.tsx`:

| Domain | Description |
| --- | --- |
| `web` | Frontend web applications |
| `api` | Backend APIs and services |
| `ai` | AI and LLM integrations |
| `cli` | Command-line tools |
| `mobile` | Mobile applications |
| `infra` | CI/CD, deployment, and infrastructure |
| `meta` | Design patterns, code review, and research methodology |
| `shared` | Shared utilities and methodology |

## Framework-First Filtering

In the build step, skills have a `compatibleWith` field (resolved from `skill-rules.ts` compatibility groups) listing framework skill IDs they work with.

When a framework is selected (e.g., `web-framework-react`), only skills compatible with that framework (or with an empty `compatibleWith`) are shown. This filtering only applies to the `web` domain and only when `filterIncompatible` is true (toggled with `F` key).

Implemented in:

- `src/cli/components/hooks/use-framework-filtering.ts` (hook)
- `src/cli/lib/wizard/build-step-logic.ts` (`isCompatibleWithSelectedFrameworks()`, `buildCategoriesForDomain()`)

## Info Panel (Feature-Flagged)

`src/cli/components/wizard/info-panel.tsx`

Feature-flagged behind `FEATURE_FLAGS.INFO_PANEL` (currently `false`).

When enabled, pressing `I` opens a panel in `wizard-layout.tsx` that replaces the step content. Shows:

- Skills grouped by scope (global/project) and source (plugin/local)
- Agents grouped by scope (global/project)
- Uses skill display names from matrix via `getSkillDisplayName()`
- Closes with `I` or `Escape`
