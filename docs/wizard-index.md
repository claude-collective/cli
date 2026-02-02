# Wizard Architecture Index

Quick reference for understanding the Phase 7 wizard UX redesign.

## Design Documents

| Document | Purpose |
|----------|---------|
| [wizard-ux-redesign.md](./wizard-ux-redesign.md) | Full UX specification with ASCII mockups and user flows |
| [wizard-ux-redesign-concerns.md](./wizard-ux-redesign-concerns.md) | Architectural decisions and resolved concerns |
| [phase-7-implementation-plan.md](./phase-7-implementation-plan.md) | Detailed task breakdown with dependencies |
| [phase-7a-pre-test-plan.md](./phase-7a-pre-test-plan.md) | Test plan for Phase 7A checkpoint |

## Task Tracking

| Document | Purpose |
|----------|---------|
| [TODO.md](../TODO.md) | Current task status and blockers |
| [TODO-completed.md](../TODO-completed.md) | Archive of completed tasks |

---

## Wizard Flow

```
[1] Approach    [2] Stack    [3] Build    [4] Refine    [5] Confirm
     ●             ○            ○            ○              ○
```

### Flow A: Pre-built Stack
```
approach → stack → stack-options → [build?] → refine → confirm
                        │
            ┌───────────┴───────────┐
            │                       │
     "Continue defaults"     "Customize"
            │                       │
            └──→ refine         build → refine
```

### Flow B: Build from Scratch
```
approach → stack (domain selection) → build → refine → confirm
              │
    Select: [Web] [API] [CLI] [Mobile]
              │
              └──→ build (loops through each domain)
```

---

## Source Files

### Wizard Orchestration

| File | Purpose |
|------|---------|
| [wizard.tsx](../src/cli-v2/components/wizard/wizard.tsx) | Main orchestrator - renders steps, handles navigation, computes results |
| [wizard-store.ts](../src/cli-v2/stores/wizard-store.ts) | Zustand store with V2 state shape and actions |

### Wizard Steps

| File | Step | Purpose |
|------|------|---------|
| [step-approach.tsx](../src/cli-v2/components/wizard/step-approach.tsx) | Approach | Choose stack template or build from scratch |
| [step-stack.tsx](../src/cli-v2/components/wizard/step-stack.tsx) | Stack | Select pre-built stack OR domains (dual-purpose) |
| [step-stack-options.tsx](../src/cli-v2/components/wizard/step-stack-options.tsx) | Stack Options | Continue with defaults or customize (stack path) |
| [step-build.tsx](../src/cli-v2/components/wizard/step-build.tsx) | Build | Grid-based technology selection per domain |
| [step-refine.tsx](../src/cli-v2/components/wizard/step-refine.tsx) | Refine | Skill source selection (verified vs custom) |
| [step-confirm.tsx](../src/cli-v2/components/wizard/step-confirm.tsx) | Confirm | Final summary before installation |

### UI Components

| File | Purpose |
|------|---------|
| [wizard-tabs.tsx](../src/cli-v2/components/wizard/wizard-tabs.tsx) | Horizontal 5-step progress indicator |
| [category-grid.tsx](../src/cli-v2/components/wizard/category-grid.tsx) | 2D grid selection with keyboard navigation |
| [section-progress.tsx](../src/cli-v2/components/wizard/section-progress.tsx) | Sub-step progress for multi-domain flows |

---

## Configuration Files

| File | Purpose |
|------|---------|
| [config/skills-matrix.yaml](../config/skills-matrix.yaml) | Categories, relationships, skill aliases |
| [config/stacks.yaml](../config/stacks.yaml) | Stack definitions with agent→technology mappings |
| [src/schemas/skills-matrix.schema.json](../src/schemas/skills-matrix.schema.json) | JSON Schema for skills-matrix.yaml validation |
| [src/schemas/stacks.schema.json](../src/schemas/stacks.schema.json) | JSON Schema for stacks.yaml validation |

---

## Type Definitions

| File | Key Types |
|------|-----------|
| [types-matrix.ts](../src/cli-v2/types-matrix.ts) | `MergedSkillsMatrix`, `CategoryDefinition`, `ResolvedSkill`, `ResolvedStack` |
| [types-stacks.ts](../src/cli-v2/types-stacks.ts) | `Stack`, `StacksConfig`, `StackAgentConfig` |
| [wizard-store.ts](../src/cli-v2/stores/wizard-store.ts) | `WizardStep`, `WizardState` |

---

## Key Concepts

### Domains
Categories are assigned to domains for filtering in the Build step:
- **web** - Frontend technologies (framework, styling, client-state, etc.)
- **api** - Backend technologies (api-framework, database, auth, etc.)
- **cli** - Command-line tools (cli-framework, cli-prompts, cli-testing)
- **mobile** - Mobile frameworks (react-native, expo)
- **shared** - Cross-domain (methodology, reviewing, security)

### Technology vs Skill
- **Technology**: What the user selects (e.g., "React", "Tailwind")
- **Skill**: The actual skill file that teaches Claude (resolved via `skill_aliases`)

### Visual States
Options in CategoryGrid display with visual indicators:
| Symbol | State | Color |
|--------|-------|-------|
| `●` | Selected | Green |
| `⭐` | Recommended | Green text |
| `⚠` | Discouraged | Yellow/dim |
| `✗` | Disabled | Gray + strikethrough |
| `○` | Normal | White |
| `>` | Focused | Cyan/bold |

### Keyboard Navigation
| Key | Action |
|-----|--------|
| `←` `→` / `h` `l` | Navigate options |
| `↑` `↓` / `j` `k` | Navigate categories |
| `Space` | Toggle selection |
| `Tab` | Toggle descriptions |
| `e` | Toggle expert mode |
| `Enter` | Continue to next step |
| `Escape` | Go back (history-based) |

---

## Test Files

| File | Coverage |
|------|----------|
| [wizard-store.test.ts](../src/cli-v2/stores/wizard-store.test.ts) | Store actions and computed getters |
| [wizard.integration.test.tsx](../src/cli-v2/lib/__tests__/components/wizard.integration.test.tsx) | End-to-end wizard flows |
| [category-grid.test.tsx](../src/cli-v2/components/wizard/category-grid.test.tsx) | Grid navigation and selection |
| [wizard-tabs.test.tsx](../src/cli-v2/lib/__tests__/components/wizard-tabs.test.tsx) | Progress indicator states |
| [step-build.test.tsx](../src/cli-v2/components/wizard/step-build.test.tsx) | Build step with domain filtering |
| [step-refine.test.tsx](../src/cli-v2/components/wizard/step-refine.test.tsx) | Refine step options |
| [step-confirm.test.tsx](../src/cli-v2/lib/__tests__/components/step-confirm.test.tsx) | Confirm step display |

---

## Resolution Logic

| File | Purpose |
|------|---------|
| [matrix-resolver.ts](../src/cli-v2/lib/matrix-resolver.ts) | `getAvailableSkills()`, `validateSelection()` - computes option states |
| [stacks-loader.ts](../src/cli-v2/lib/stacks-loader.ts) | `loadStackById()`, `resolveStackSkillsFromAliases()` |
| [resolver.ts](../src/cli-v2/lib/resolver.ts) | `resolveAgentSkillsFromStack()`, `getAgentSkills()` |

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              wizard.tsx                                  │
│  (orchestrates steps, handles global ESC, computes WizardResultV2)      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
          ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
          │ wizard-tabs │  │ step-*.tsx  │  │ footer hint │
          │  (progress) │  │ (per step)  │  │             │
          └─────────────┘  └─────────────┘  └─────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │       wizard-store.ts         │
                    │  (Zustand - single source)    │
                    │                               │
                    │  State:                       │
                    │  - step, approach, history    │
                    │  - selectedStackId            │
                    │  - selectedDomains[]          │
                    │  - domainSelections{}         │
                    │  - focusedRow/Col             │
                    │  - expertMode, installMode    │
                    └───────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
          ┌─────────────────────┐       ┌─────────────────────┐
          │  skills-matrix.yaml │       │    stacks.yaml      │
          │  - categories       │       │  - stack definitions│
          │  - relationships    │       │  - agent configs    │
          │  - skill_aliases    │       │  - philosophy       │
          └─────────────────────┘       └─────────────────────┘
```
