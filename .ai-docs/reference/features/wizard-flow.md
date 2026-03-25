# Wizard Flow

**Last Updated:** 2026-03-14

## Overview

**Purpose:** Multi-step interactive terminal UI for selecting skills, agents, and sources.

**Rendered by:** `init` and `edit` commands using Ink (React-based terminal rendering).

**State:** Zustand store at `src/cli/stores/wizard-store.ts`

## Step Progression

```
stack -> build -> sources -> agents -> confirm
```

- `stack`: Select a pre-built stack OR choose "Start from scratch" + domain selection
- `build`: Per-domain skill selection (CategoryGrid with category sections)
- `sources`: Choose which source provides each skill (recommended vs custom)
- `agents`: Select which agents to compile
- `confirm`: Review selections and confirm

**Shortcut:** If stack selected with `stackAction: "defaults"`, jumps directly to confirm (skips build/sources/agents).

## Component Architecture

```
Wizard (src/cli/components/wizard/wizard.tsx)
  |-> WizardLayout (wizard-layout.tsx)
  |     |-> WizardTabs (wizard-tabs.tsx) - Step progress indicators
  |     |-> HelpModal (help-modal.tsx) - Hotkey reference (when showHelp)
  |
  |-> Step Components (conditional render based on store.step):
  |     |-> StepStack (step-stack.tsx) - Stack selection
  |     |     |-> StackSelection (stack-selection.tsx) - Stack list + "Start from scratch"
  |     |     |-> DomainSelection (domain-selection.tsx) - Domain toggles
  |     |-> StepBuild (step-build.tsx) - Technology selection
  |     |     |-> CategoryGrid (category-grid.tsx) - Category sections
  |     |     |     |-> CheckboxGrid (checkbox-grid.tsx) - Skill toggles
  |     |     |-> SectionProgress (section-progress.tsx) - Category progress
  |     |     |-> ViewTitle (view-title.tsx) - Step title
  |     |-> StepSources (step-sources.tsx) - Source selection
  |     |     |-> SourceGrid (source-grid.tsx) - Per-skill source picker
  |     |     |-> SearchModal (search-modal.tsx) - Bound skill search
  |     |-> StepAgents (step-agents.tsx) - Agent selection
  |     |-> StepConfirm (step-confirm.tsx) - Confirmation
  |
  |-> Overlays:
        |-> StepSettings (step-settings.tsx) - Source management (S hotkey on sources step)
        |-> HelpModal (help-modal.tsx) - Hotkey reference (? hotkey)
```

Additional wizard components (not in main render tree):

- `menu-item.tsx` - Reusable menu item component
- `selection-card.tsx` - Selection card display
- `step-refine.tsx` - Refinement step (all-recommended vs customize)
- `view-title.tsx` - Step title component (used on all wizard steps)

## Wizard Props (from commands)

```typescript
type WizardProps = {
  onComplete: (result: WizardResultV2) => void; // Called on confirm
  onCancel: () => void; // Called on Escape/Ctrl+C
  version?: string; // CLI version for display
  marketplaceLabel?: string; // Source label for display
  logo?: string; // ASCII logo for header
  initialStep?: WizardStep; // "build" for edit mode
  initialDomains?: Domain[]; // Restore for edit mode
  initialAgents?: AgentName[]; // Restore for edit mode
  installedSkillIds?: SkillId[]; // Current skills for edit mode
  installedSkillConfigs?: SkillConfig[]; // Saved scope/source configs for edit mode
  installedAgentConfigs?: AgentScopeConfig[]; // Saved agent scope configs for edit mode
  lockedSkillIds?: SkillId[]; // Skills that cannot be toggled (D9: global items in project context)
  lockedAgentNames?: AgentName[]; // Agents that cannot be toggled (D9: global items in project context)
  projectDir?: string;
  startupMessages?: StartupMessage[]; // Messages to display on startup
};
```

**Note:** The wizard does NOT receive a `matrix` prop. It accesses the matrix singleton via `matrix-provider.ts` imports.

## WizardResultV2 (`src/cli/components/wizard/wizard.tsx:30-43`)

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

| Hook                       | File                                                       | Purpose                          |
| -------------------------- | ---------------------------------------------------------- | -------------------------------- |
| `useWizardInitialization`  | `src/cli/components/hooks/use-wizard-initialization.ts`    | Initialize store from props      |
| `useBuildStepProps`        | `src/cli/components/hooks/use-build-step-props.ts`         | Compute build step derived data  |
| `useCategoryGridInput`     | `src/cli/components/hooks/use-category-grid-input.ts`      | Keyboard navigation for grid     |
| `useKeyboardNavigation`    | `src/cli/components/hooks/use-keyboard-navigation.ts`      | Arrow key + Enter handling       |
| `useFilteredResults`       | `src/cli/components/hooks/use-filtered-results.ts`         | Text search filtering            |
| `useFocusedListItem`       | `src/cli/components/hooks/use-focused-list-item.ts`        | Focus tracking for lists         |
| `useFrameworkFiltering`    | `src/cli/components/hooks/use-framework-filtering.ts`      | Framework-first skill filtering  |
| `useMeasuredHeight`        | `src/cli/components/hooks/use-measured-height.ts`          | Component height measurement     |
| `useModalState`            | `src/cli/components/hooks/use-modal-state.ts`              | Modal open/close state           |
| `useRowScroll`             | `src/cli/components/hooks/use-row-scroll.ts`               | Row-based scroll position        |
| `useSectionScroll`         | `src/cli/components/hooks/use-section-scroll.ts`           | Section-based scroll position    |
| `useSourceGridSearchModal` | `src/cli/components/hooks/use-source-grid-search-modal.ts` | Search modal for sources         |
| `useSourceOperations`      | `src/cli/components/hooks/use-source-operations.ts`        | Source add/remove operations     |
| `useTerminalDimensions`    | `src/cli/components/hooks/use-terminal-dimensions.ts`      | Terminal width/height tracking   |
| `useTextInput`             | `src/cli/components/hooks/use-text-input.ts`               | Text input handling              |
| `useVirtualScroll`         | `src/cli/components/hooks/use-virtual-scroll.ts`           | Virtual scrolling for long lists |

## Build Step Logic

**Pure functions:** `src/cli/lib/wizard/build-step-logic.ts`

Contains non-UI logic extracted from the build step for testability:

- `validateBuildStep()` - Validate build step selections (required categories)
- `computeOptionState()` - Compute option state (discouraged, recommended, selected) for a skill
- `buildCategoriesForDomain()` - Build category row data for a domain

## Edit Mode Flow

When `edit` command enters the wizard:

1. `initialStep="build"` (skips stack step)
2. `installedSkillIds` populated from current installation
3. `installedSkillConfigs` carries saved scope/source configs
4. `installedAgentConfigs` carries saved agent scope configs
5. `lockedSkillIds`/`lockedAgentNames` mark global items as read-only in project context
6. `useWizardInitialization` calls `populateFromSkillIds(skillIds, savedConfigs)` to hydrate store
7. `initialDomains` and `initialAgents` restore previous wizard state
8. User modifies selections
9. On confirm: diff computed (added/removed/source-changed)

## Keyboard Navigation

Hotkeys are centralized in `src/cli/components/wizard/hotkeys.ts`.

Global hotkeys (handled in `wizard.tsx`):

- `?`: Toggle help modal
- `Escape`: Step-specific behavior (cancel on stack step, goBack on other steps)
- `A` (build step with stack selected): Accept stack defaults, jump to confirm
- `S` (build step): Toggle focused skill scope (project/global)
- `S` (agents step): Toggle focused agent scope (project/global)
- `S` (sources step): Toggle settings overlay

Per-step hotkeys vary by component (arrow keys, Space for toggle, Enter for confirm).

Build step hotkeys (in `hotkeys.ts`):

- `D`: Toggle compatibility labels

Sources step hotkeys:

- `L`: Set all sources to local
- `P`: Set all sources to plugin (marketplace)

## Build Step Domain Order

From `src/cli/consts.ts:191`:

```typescript
BUILT_IN_DOMAIN_ORDER = ["web", "api", "mobile", "cli", "shared"];
```

Custom domains appear before built-in domains, alphabetically.

Default scratch domains: `["web", "api", "mobile"]` (all except CLI and shared).

## Framework-First Filtering

In the build step, skills have a `compatibleWith` field (resolved from `skill-rules.ts` compatibility groups) listing framework skill IDs they work with.

When a framework is selected (e.g., `web-framework-react`), only skills compatible with that framework (or with an empty `compatibleWith`) are shown.

Implemented in `src/cli/components/hooks/use-framework-filtering.ts`.
