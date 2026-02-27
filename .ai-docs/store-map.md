# Store / State Map

**Last Updated:** 2026-02-25

## State Management Library

**Library:** Zustand
**Version:** v5
**Pattern:** Single store with `create<WizardState>()`, accessed via `useWizardStore` hook with selectors

## Store

| Store          | File                                 | Purpose                  |
| -------------- | ------------------------------------ | ------------------------ |
| useWizardStore | `src/cli/stores/wizard-store.ts:431` | Entire wizard flow state |

There is exactly **one** Zustand store in the codebase.

## WizardState Shape (`src/cli/stores/wizard-store.ts:157-408`)

### Navigation State

| Field     | Type           | Purpose                         |
| --------- | -------------- | ------------------------------- |
| `step`    | `WizardStep`   | Current wizard step             |
| `history` | `WizardStep[]` | Step history stack for goBack() |

`WizardStep` = `"stack" | "build" | "sources" | "agents" | "confirm"`

Step progression: `stack -> build -> sources -> agents -> confirm`

### Approach State

| Field             | Type        | Purpose     |
| ----------------- | ----------- | ----------- | ----------------- | --------------------------------- |
| `approach`        | `"stack"    | "scratch"   | null`             | Stack-based or build-from-scratch |
| `selectedStackId` | `string     | null`       | Selected stack ID |
| `stackAction`     | `"defaults" | "customize" | null`             | Use stack as-is or customize      |

### Selection State

| Field                | Type               | Purpose                                     |
| -------------------- | ------------------ | ------------------------------------------- |
| `selectedDomains`    | `Domain[]`         | Active domains                              |
| `currentDomainIndex` | `number`           | Currently visible domain in build step      |
| `domainSelections`   | `DomainSelections` | Full skill selections by domain/subcategory |
| `selectedAgents`     | `AgentName[]`      | Selected agents for compilation             |
| `boundSkills`        | `BoundSkill[]`     | Foreign skills bound via search             |

### UI State

| Field          | Type      | Purpose                                 |
| -------------- | --------- | --------------------------------------- |
| `showLabels`   | `boolean` | Show compatibility labels on skill tags |
| `showSettings` | `boolean` | Settings overlay visible                |
| `showHelp`     | `boolean` | Help overlay visible                    |

### Installation State

| Field              | Type                               | Purpose                       |
| ------------------ | ---------------------------------- | ----------------------------- | ------------------- |
| `installMode`      | `"plugin"                          | "local"`                      | Install mode toggle |
| `sourceSelections` | `Partial<Record<SkillId, string>>` | Per-skill source selection    |
| `customizeSources` | `boolean`                          | Show per-skill source pickers |
| `enabledSources`   | `Record<string, boolean>`          | Source enable/disable state   |

## All Actions

### Navigation

| Action    | Signature                    | Effect                                |
| --------- | ---------------------------- | ------------------------------------- |
| `setStep` | `(step: WizardStep) => void` | Navigate, push current to history     |
| `goBack`  | `() => void`                 | Pop from history, fallback to "stack" |

### Approach / Stack

| Action           | Signature            | Effect                |
| ---------------- | -------------------- | --------------------- | ---------------------------- | ------------------- |
| `setApproach`    | `(approach: "stack"  | "scratch"             | null) => void`               | Set wizard approach |
| `selectStack`    | `(stackId: string    | null) => void`        | Select or deselect a stack   |
| `setStackAction` | `(action: "defaults" | "customize") => void` | Use stack as-is or customize |

### Selection

| Action             | Signature                                              | Effect                                  |
| ------------------ | ------------------------------------------------------ | --------------------------------------- |
| `toggleDomain`     | `(domain: Domain) => void`                             | Add/remove domain, clears selections    |
| `toggleTechnology` | `(domain, subcategory, technology, exclusive) => void` | Radio (exclusive) or checkbox toggle    |
| `toggleAgent`      | `(agent: AgentName) => void`                           | Add/remove agent                        |
| `bindSkill`        | `(skill: BoundSkill) => void`                          | Add foreign skill from search           |
| `nextDomain`       | `() => boolean`                                        | Advance to next domain, returns success |
| `prevDomain`       | `() => boolean`                                        | Go to previous domain, returns success  |

### UI Toggles

| Action              | Signature    | Effect                                 |
| ------------------- | ------------ | -------------------------------------- |
| `toggleShowLabels`  | `() => void` | Toggle compatibility labels visibility |
| `toggleInstallMode` | `() => void` | Toggle between "plugin" and "local"    |
| `toggleSettings`    | `() => void` | Toggle settings overlay                |
| `toggleHelp`        | `() => void` | Toggle help overlay                    |

### Source Management

| Action                | Signature                                      | Effect                           |
| --------------------- | ---------------------------------------------- | -------------------------------- |
| `setSourceSelection`  | `(skillId: SkillId, sourceId: string) => void` | Set source for a specific skill  |
| `setCustomizeSources` | `(customize: boolean) => void`                 | Toggle per-skill source pickers  |
| `setEnabledSources`   | `(sources: Record<string, boolean>) => void`   | Replace enabled/disabled sources |

### Population (Hydrating from Config/Stack)

| Action                       | Signature                                | When Used                              |
| ---------------------------- | ---------------------------------------- | -------------------------------------- |
| `populateFromStack`          | `(stack, categories) => void`            | Stack selection in init wizard         |
| `populateFromSkillIds`       | `(skillIds, skills, categories) => void` | Edit mode: restore from project config |
| `preselectAgentsFromDomains` | `() => void`                             | After domain selection                 |

### Reset

| Action  | Signature    | Effect                                               |
| ------- | ------------ | ---------------------------------------------------- |
| `reset` | `() => void` | Restore all state to `createInitialState()` defaults |

### Computed Getters

| Getter                             | Returns                              | Purpose                          |
| ---------------------------------- | ------------------------------------ | -------------------------------- | ---------------------------- |
| `getAllSelectedTechnologies`       | `SkillId[]`                          | Flat list of all selected skills |
| `getSelectedTechnologiesPerDomain` | `Partial<Record<Domain, SkillId[]>>` | Skills grouped by domain         |
| `getCurrentDomain`                 | `Domain                              | null`                            | Domain at currentDomainIndex |
| `getDefaultMethodologySkills`      | `SkillId[]`                          | DEFAULT_PRESELECTED_SKILLS       |
| `getTechnologyCount`               | `number`                             | Total selected count             |
| `getStepProgress`                  | `{ completedSteps, skippedSteps }`   | For wizard tab indicators        |
| `canGoToNextDomain`                | `boolean`                            | Has next domain                  |
| `canGoToPreviousDomain`            | `boolean`                            | Has previous domain              |
| `buildSourceRows`                  | `(matrix) => SourceRow[]`            | Sources step UI data             |

## Usage Pattern

**In wizard components:**

```typescript
// Select specific state slices (Zustand selectors)
const step = useWizardStore((s) => s.step);
const toggleTechnology = useWizardStore((s) => s.toggleTechnology);
const selectedDomains = useWizardStore((s) => s.selectedDomains);

// Or get the entire store
const store = useWizardStore();
```

**Files using the store:**

- `src/cli/components/wizard/wizard.tsx` - Main wizard orchestrator
- `src/cli/components/wizard/step-stack.tsx` - Stack selection step
- `src/cli/components/wizard/step-build.tsx` - Technology selection step
- `src/cli/components/wizard/step-sources.tsx` - Source selection step
- `src/cli/components/wizard/step-agents.tsx` - Agent selection step
- `src/cli/components/wizard/step-confirm.tsx` - Confirmation step
- `src/cli/components/wizard/step-settings.tsx` - Settings overlay
- `src/cli/components/wizard/wizard-tabs.tsx` - Step progress tabs
- `src/cli/components/wizard/wizard-layout.tsx` - Layout wrapper
- `src/cli/components/hooks/use-wizard-initialization.ts` - Init hook
- `src/cli/components/hooks/use-build-step-props.ts` - Build step props

## Internal Constants

**Domain-to-agent mapping** (`wizard-store.ts:37-48`):

```typescript
DOMAIN_AGENTS = {
  web: [
    "web-developer",
    "web-reviewer",
    "web-researcher",
    "web-tester",
    "web-pm",
    "web-architecture",
  ],
  api: ["api-developer", "api-reviewer", "api-researcher"],
  cli: ["cli-developer", "cli-tester", "cli-reviewer"],
};
```

**Source sort tiers** (for source ordering in buildSourceRows):

1. local/installed
2. scoped marketplace (primary)
3. default public marketplace
4. third-party marketplaces

## State Reset

`reset()` action restores all state to `createInitialState()` defaults (`wizard-store.ts:410-429`).

Initial state:

- `step: "stack"`, `approach: null`, `selectedStackId: null`
- `selectedDomains: []`, `currentDomainIndex: 0`, `domainSelections: {}`
- `installMode: "local"`
- `history: []`, `selectedAgents: []`, `boundSkills: []`
