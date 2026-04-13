---
scope: reference
area: wizard
keywords: [zustand, wizard-store, state, actions, consumers, initial-state, toast, preselections]
related:
  - reference/state-transitions.md
  - reference/component-patterns.md
  - reference/features/wizard-flow.md
last_validated: 2026-04-13
---

# Store / State Map

**Last Updated:** 2026-04-13

## State Management Library

**Library:** Zustand
**Version:** v5
**Pattern:** Single store with `create<WizardState>()`, accessed via `useWizardStore` hook with selectors

## Store

| Store          | File                             | Purpose                  |
| -------------- | -------------------------------- | ------------------------ |
| useWizardStore | `src/cli/stores/wizard-store.ts` | Entire wizard flow state |

There is exactly **one** Zustand store in the codebase.

## WizardState Shape (`src/cli/stores/wizard-store.ts`)

### Navigation State

| Field     | Type           | Purpose                         |
| --------- | -------------- | ------------------------------- |
| `step`    | `WizardStep`   | Current wizard step             |
| `history` | `WizardStep[]` | Step history stack for goBack() |

`WizardStep` = `"stack" | "domains" | "build" | "sources" | "agents" | "confirm"`

Step progression: `stack -> domains -> build -> sources -> agents -> confirm`

### Approach State

| Field             | Type                                | Purpose                           |
| ----------------- | ----------------------------------- | --------------------------------- |
| `approach`        | `"stack" \| "scratch" \| null`      | Stack-based or build-from-scratch |
| `selectedStackId` | `string \| null`                    | Selected stack ID                 |
| `stackAction`     | `"defaults" \| "customize" \| null` | Use stack as-is or customize      |

### Selection State

| Field                    | Type                         | Purpose                                                                 |
| ------------------------ | ---------------------------- | ----------------------------------------------------------------------- |
| `selectedDomains`        | `Domain[]`                   | Active domains                                                          |
| `currentDomainIndex`     | `number`                     | Currently visible domain in build step                                  |
| `domainSelections`       | `DomainSelections`           | Full skill selections by domain/category                                |
| `_stackDomainSelections` | `DomainSelections \| null`   | Snapshot for restoring stack selections on re-toggle                    |
| `selectedAgents`         | `AgentName[]`                | Selected agents for compilation                                         |
| `agentConfigs`           | `AgentScopeConfig[]`         | Per-agent scope configuration (project/global)                          |
| `boundSkills`            | `BoundSkill[]`               | Foreign skills bound via search                                         |
| `skillConfigs`           | `SkillConfig[]`              | Per-skill source and scope configuration                                |
| `installedSkillConfigs`  | `SkillConfig[] \| null`      | Snapshot of configs installed before wizard opened (for diff rendering) |
| `installedAgentConfigs`  | `AgentScopeConfig[] \| null` | Snapshot of agent configs installed before wizard opened                |

### UI State

| Field                      | Type                                                           | Purpose                                                                             |
| -------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `showLabels`               | `boolean`                                                      | Show compatibility labels on skill tags                                             |
| `filterIncompatible`       | `boolean`                                                      | Filter incompatible skills in build step grid                                       |
| `showSettings`             | `boolean`                                                      | Settings overlay visible                                                            |
| `showInfo`                 | `boolean`                                                      | Info overlay visible (selected skills and agents)                                   |
| `focusedSkillId`           | `SkillId \| null`                                              | Currently focused skill (for S hotkey)                                              |
| `focusedAgentId`           | `AgentName \| null`                                            | Currently focused agent (for S hotkey)                                              |
| `isInitMode`               | `boolean`                                                      | True when running init (first-time setup); false when editing existing installation |
| `isEditingFromGlobalScope` | `boolean`                                                      | When true, scope toggling is disabled (editing from ~/.claude/)                     |
| `toastMessage`             | `string \| null`                                               | Temporary toast message shown in the wizard (auto-cleared after timeout)            |
| `globalPreselections`      | `SkillConfig[] \| null`                                        | Global skill configs to pre-select when a stack or scratch is chosen in init        |
| `globalAgentPreselections` | `{ agents: AgentName[]; configs: AgentScopeConfig[] } \| null` | Global agent preselections to restore after selectStack wipes state                 |

### Source State

| Field              | Type                      | Purpose                       |
| ------------------ | ------------------------- | ----------------------------- |
| `customizeSources` | `boolean`                 | Show per-skill source pickers |
| `enabledSources`   | `Record<string, boolean>` | Source enable/disable state   |

## All Actions

### Navigation

| Action    | Signature                    | Effect                                |
| --------- | ---------------------------- | ------------------------------------- |
| `setStep` | `(step: WizardStep) => void` | Navigate, push current to history     |
| `goBack`  | `() => void`                 | Pop from history, fallback to "stack" |

### Approach / Stack

| Action           | Signature                                          | Effect                                       |
| ---------------- | -------------------------------------------------- | -------------------------------------------- |
| `setApproach`    | `(approach: "stack" \| "scratch" \| null) => void` | Set wizard approach                          |
| `selectStack`    | `(stackId: string \| null) => void`                | Select/deselect stack; resets all selections |
| `setStackAction` | `(action: "defaults" \| "customize") => void`      | Use stack as-is or customize                 |

### Selection

| Action                  | Signature                                           | Effect                                                                                                                             |
| ----------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `toggleDomain`          | `(domain: Domain) => void`                          | Add/remove domain, manages selections                                                                                              |
| `toggleTechnology`      | `(domain, category, technology, exclusive) => void` | Radio (exclusive) or checkbox toggle                                                                                               |
| `toggleAgent`           | `(agent: AgentName) => void`                        | Add/remove agent; guards against toggling globally-installed agents from project scope (shows toast); tombstone-aware toggle logic |
| `bindSkill`             | `(skill: BoundSkill) => void`                       | Add foreign skill from search                                                                                                      |
| `nextDomain`            | `() => boolean`                                     | Advance to next domain, returns success                                                                                            |
| `prevDomain`            | `() => boolean`                                     | Go to previous domain, returns success                                                                                             |
| `setCurrentDomainIndex` | `(index: number) => void`                           | Set domain index directly (no-op if out of range)                                                                                  |

### Scope / Source Per-Skill

| Action              | Signature                                    | Effect                                                                                                                                     |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `toggleSkillScope`  | `(skillId: SkillId) => void`                 | Toggle skill scope project/global; eject guard blocks project->global when global eject exists (allows undo if excluded tombstone present) |
| `setSkillSource`    | `(skillId: SkillId, source: string) => void` | Set source for a skill in configs                                                                                                          |
| `setFocusedSkillId` | `(id: SkillId \| null) => void`              | Set focused skill for S hotkey                                                                                                             |
| `toggleAgentScope`  | `(agentName: AgentName) => void`             | Toggle agent scope project/global                                                                                                          |
| `setFocusedAgentId` | `(id: AgentName \| null) => void`            | Set focused agent for S hotkey                                                                                                             |

### UI Toggles

| Action                     | Signature                           | Effect                                                                             |
| -------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `toggleShowLabels`         | `() => void`                        | Toggle compatibility labels visibility                                             |
| `toggleFilterIncompatible` | `() => void`                        | Toggle filtering of incompatible skills; removes incompatible web skills on enable |
| `toggleSettings`           | `() => void`                        | Toggle settings overlay                                                            |
| `toggleInfo`               | `() => void`                        | Toggle info overlay (selected skills and agents)                                   |
| `setToastMessage`          | `(message: string \| null) => void` | Set a temporary toast message, or null to clear it                                 |

### Source Management

| Action                | Signature                                      | Effect                           |
| --------------------- | ---------------------------------------------- | -------------------------------- |
| `setSourceSelection`  | `(skillId: SkillId, sourceId: string) => void` | Set source for a specific skill  |
| `setCustomizeSources` | `(customize: boolean) => void`                 | Toggle per-skill source pickers  |
| `setEnabledSources`   | `(sources: Record<string, boolean>) => void`   | Replace enabled/disabled sources |
| `setAllSourcesEject`  | `() => void`                                   | Set all skills to "eject" source |
| `setAllSourcesPlugin` | `() => void`                                   | Set all skills to marketplace    |

### Derived

| Action              | Signature           | Effect                                        |
| ------------------- | ------------------- | --------------------------------------------- |
| `deriveInstallMode` | `() => InstallMode` | Derive install mode from skillConfigs sources |

### Population (Hydrating from Config/Stack)

| Action                       | Signature                           | When Used                                                                                                                |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `populateFromStack`          | `(stack) => void`                   | Stack selection in init wizard; now returns `selectedAgents` and `agentConfigs` derived from `Object.keys(stack.agents)` |
| `populateFromSkillIds`       | `(skillIds, savedConfigs?) => void` | Edit mode: restore from project config                                                                                   |
| `preselectAgentsFromDomains` | `() => void`                        | After domain selection                                                                                                   |

### Reset

| Action  | Signature    | Effect                                               |
| ------- | ------------ | ---------------------------------------------------- |
| `reset` | `() => void` | Restore all state to `createInitialState()` defaults |

### Computed Getters

| Getter                             | Returns                                     | Purpose                          |
| ---------------------------------- | ------------------------------------------- | -------------------------------- |
| `getAllSelectedTechnologies`       | `SkillId[]`                                 | Flat list of all selected skills |
| `getSelectedTechnologiesPerDomain` | `Partial<Record<Domain, SkillId[]>>`        | Skills grouped by domain         |
| `getCurrentDomain`                 | `Domain \| null`                            | Domain at currentDomainIndex     |
| `getTechnologyCount`               | `number`                                    | Total selected count             |
| `getStepProgress`                  | `{ completedSteps, skippedSteps }`          | For wizard tab indicators        |
| `canGoToNextDomain`                | `() => boolean`                             | Has next domain                  |
| `canGoToPreviousDomain`            | `() => boolean`                             | Has previous domain              |
| `buildSourceRows`                  | `{ skillId, options, scope?, readOnly? }[]` | Sources step UI data             |

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

**Files using the store (production only):**

- `src/cli/components/wizard/wizard.tsx` - Main wizard orchestrator
- `src/cli/components/wizard/wizard-layout.tsx` - Layout wrapper
- `src/cli/components/wizard/step-build.tsx` - Technology selection step
- `src/cli/components/wizard/step-sources.tsx` - Source selection step
- `src/cli/components/wizard/step-agents.tsx` - Agent selection step
- `src/cli/components/wizard/stack-selection.tsx` - Stack list component
- `src/cli/components/wizard/domain-selection.tsx` - Domain tab selector
- `src/cli/components/wizard/info-panel.tsx` - Info overlay (selected skills/agents)
- `src/cli/components/wizard/skill-agent-summary.tsx` - Skill/agent summary display
- `src/cli/components/hooks/use-wizard-initialization.ts` - Init hook

## Internal Helpers

**`buildSkillConfigForId(id, savedConfigs?)`** in `wizard-store.ts`: Builds a `SkillConfig` for a skill ID, preferring a project-scoped non-excluded entry from `savedConfigs` over a global one when duplicates exist (D-198 defensive fix). Falls back to `createDefaultSkillConfig` pattern.

**`applySkillRemoval(configs, removedIds, installedSkillConfigs)`** in `wizard-store.ts`: Removes project-scope skills outright; marks global-scope skills as `excluded: true` only if they were previously installed.

## Internal Constants

**Domain-to-agent mapping** in `wizard-store.ts`:

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

1. eject/global (installed on disk -- type "eject" or installed via plugin)
2. scoped marketplace (primary source from --source flag)
3. default public marketplace (Agents Inc)
4. third-party marketplaces (extra configured sources)

## State Reset

`reset()` action restores all state to `createInitialState()` defaults.

`selectStack()` also resets: domainSelections, \_stackDomainSelections, selectedDomains, skillConfigs, selectedAgents, agentConfigs, boundSkills, currentDomainIndex, stackAction.

Initial state:

- `step: "stack"`, `approach: null`, `selectedStackId: null`, `stackAction: null`
- `selectedDomains: []`, `currentDomainIndex: 0`, `domainSelections: {}`, `_stackDomainSelections: null`
- `showLabels: false`, `filterIncompatible: false`, `showSettings: false`, `showInfo: false`
- `skillConfigs: []`, `focusedSkillId: null`, `customizeSources: false`
- `enabledSources: {}`, `selectedAgents: []`, `agentConfigs: []`, `focusedAgentId: null`
- `boundSkills: []`, `installedSkillConfigs: null`, `installedAgentConfigs: null`
- `isInitMode: false`, `isEditingFromGlobalScope: false`, `toastMessage: null`
- `globalPreselections: null`, `globalAgentPreselections: null`, `history: []`
