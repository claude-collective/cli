# Wizard Flow

**Last Updated:** 2026-02-25

## Overview

**Purpose:** Multi-step interactive terminal UI for selecting skills, agents, and sources.

**Rendered by:** `init` and `edit` commands using Ink (React-based terminal rendering).

**State:** Zustand store at `src/cli/stores/wizard-store.ts`

## Step Progression

```
stack -> build -> sources -> agents -> confirm
```

- `stack`: Select a pre-built stack OR choose "Start from scratch" + domain selection
- `build`: Per-domain skill selection (CategoryGrid with subcategory sections)
- `sources`: Choose which source provides each skill (recommended vs custom)
- `agents`: Select which agents to compile
- `confirm`: Review selections and confirm

**Shortcut:** If stack selected with `stackAction: "defaults"`, jumps directly to confirm (skips build/sources/agents).

## Component Architecture

```
Wizard (src/cli/components/wizard/wizard.tsx)
  |-> WizardLayout (wizard-layout.tsx)
  |     |-> WizardTabs (wizard-tabs.tsx) - Step progress indicators
  |     |-> ViewTitle (view-title.tsx) - Step title
  |
  |-> Step Components (conditional render based on store.step):
  |     |-> StepStack (step-stack.tsx) - Stack selection
  |     |-> StepBuild (step-build.tsx) - Technology selection
  |     |     |-> CategoryGrid (category-grid.tsx) - Subcategory sections
  |     |     |     |-> CheckboxGrid (checkbox-grid.tsx) - Skill toggles
  |     |     |-> DomainSelection (domain-selection.tsx) - Domain tabs
  |     |     |-> SectionProgress (section-progress.tsx) - Category progress
  |     |-> StepSources (step-sources.tsx) - Source selection
  |     |     |-> SourceGrid (source-grid.tsx) - Per-skill source picker
  |     |     |-> SearchModal (search-modal.tsx) - Bound skill search
  |     |-> StepAgents (step-agents.tsx) - Agent selection
  |     |-> StepConfirm (step-confirm.tsx) - Confirmation
  |
  |-> Overlays:
        |-> StepSettings (step-settings.tsx) - Source management (G hotkey)
        |-> HelpModal (help-modal.tsx) - Hotkey reference
```

## Wizard Props (from commands)

```typescript
type WizardProps = {
  matrix: MergedSkillsMatrix; // Required: loaded skills data
  onComplete: (result: WizardResultV2) => void; // Called on confirm
  onCancel: () => void; // Called on Escape/Ctrl+C
  version?: string; // CLI version for display
  marketplaceLabel?: string; // Source label for display
  logo?: string; // ASCII logo for header
  initialStep?: WizardStep; // "build" for edit mode
  initialInstallMode?: "plugin" | "local";
  initialDomains?: Domain[]; // Restore for edit mode
  initialAgents?: AgentName[]; // Restore for edit mode
  installedSkillIds?: SkillId[]; // Current skills for edit mode
  projectDir?: string;
};
```

## WizardResultV2 (`src/cli/components/wizard/wizard.tsx:27-42`)

```typescript
type WizardResultV2 = {
  selectedSkills: SkillId[];
  selectedAgents: AgentName[];
  selectedStackId: string | null;
  domainSelections: DomainSelections;
  selectedDomains: Domain[];
  sourceSelections: Partial<Record<SkillId, string>>;
  installMode: "plugin" | "local";
  cancelled: boolean;
  validation: { valid: boolean; errors: [...]; warnings: [...] };
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
| `useSourceGridSearchModal` | `src/cli/components/hooks/use-source-grid-search-modal.ts` | Search modal for sources         |
| `useSourceOperations`      | `src/cli/components/hooks/use-source-operations.ts`        | Source add/remove operations     |
| `useTerminalDimensions`    | `src/cli/components/hooks/use-terminal-dimensions.ts`      | Terminal width/height tracking   |
| `useTextInput`             | `src/cli/components/hooks/use-text-input.ts`               | Text input handling              |
| `useVirtualScroll`         | `src/cli/components/hooks/use-virtual-scroll.ts`           | Virtual scrolling for long lists |

## Build Step Logic

**Pure functions:** `src/cli/lib/wizard/build-step-logic.ts`

Contains non-UI logic extracted from the build step for testability:

- `getSkillDisplayLabel()` - Compute display label for a skill
- `validateBuildStep()` - Validate build step selections

## Edit Mode Flow

When `edit` command enters the wizard:

1. `initialStep="build"` (skips stack step)
2. `installedSkillIds` populated from current installation
3. `useWizardInitialization` calls `populateFromSkillIds()` to hydrate store
4. `initialDomains` and `initialAgents` restore previous wizard state
5. User modifies selections
6. On confirm: diff computed (added/removed/source-changed)

## Keyboard Navigation

Global hotkeys (handled in `wizard.tsx`):

- `Escape` / `Ctrl+C`: Cancel wizard
- `Tab` / `Shift+Tab`: Navigate between domains (build step)

Per-step hotkeys vary by component (arrow keys, Space for toggle, Enter for confirm).

## Build Step Domain Order

From `src/cli/consts.ts:179`:

```typescript
BUILT_IN_DOMAIN_ORDER = ["web", "api", "mobile", "cli"];
```

Custom domains appear before built-in domains, alphabetically.

Default scratch domains: `["web", "api", "mobile"]` (all except CLI).

## Framework-First Filtering

In the build step, skills have a `compatibleWith` field listing framework skill IDs they work with.

When a framework is selected (e.g., `web-framework-react`), only skills compatible with that framework (or with an empty `compatibleWith`) are shown.

Implemented in `src/cli/components/hooks/use-framework-filtering.ts`.
