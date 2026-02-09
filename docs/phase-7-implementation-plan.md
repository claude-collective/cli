# Phase 7: Wizard UX Redesign - Implementation Plan

**Status:** PLANNING
**Estimated Total Effort:** 18-25 days (adjusted after CLI dev review)
**Created:** 2026-02-01
**Last Updated:** 2026-02-01
**Reviewed by:** CLI Developer (Technical Feasibility)

---

## Executive Summary

Phase 7 is split into two parts with a testing checkpoint:

- **Phase 7A**: Fix the critical architecture bug (skills in wrong stacks) while keeping the existing wizard working
- **Checkpoint**: User testing to verify no regressions
- **Phase 7B**: Implement the new UX redesign (domain-based navigation, CategoryGrid, etc.)

This separation ensures we have a stable, working CLI after fixing the blockers before layering on new UI.

### Phase 7A: Architecture Fix (4-5 days)

Fixes **Concern 1** from `docs/wizard-ux-redesign-concerns.md` - the critical bug where `angular-stack` gets React skills because skills are hardcoded in agent YAMLs.

**After Phase 7A:**

- Existing wizard flow still works: `approach → stack → category → subcategory → confirm`
- Selecting `angular-stack` gives Angular skills (not React)
- All existing tests pass
- No new UI changes

### Phase 7B: UX Redesign (14-20 days)

Implements the new wizard experience from `docs/wizard-ux-redesign.md`:

1. **Domain-based navigation** - Web, API, CLI, Mobile domains
2. **CategoryGrid UI** - 2D grid selection replacing linear flow
3. **Multi-domain support** - Build step loops through selected domains
4. **New wizard store (v2)** - New state shape for domain-based flow
5. **Progress components** - WizardTabs, SectionProgress

---

## Phase Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 7A: Architecture Fix (4-5 days)                                  │
│  ─────────────────────────────────────                                  │
│  • P7-0-1: Move skills from agents to stacks                            │
│  • P7-0-2: Update config.yaml schema for stack property                 │
│  • Existing wizard keeps working                                        │
│  • All tests pass                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CHECKPOINT: User Testing                                               │
│  ────────────────────────                                               │
│  • Verify `cc init` works with all stacks                               │
│  • Verify `cc compile` works                                            │
│  • Verify angular-stack gets Angular skills                             │
│  • Confirm no regressions                                               │
│  • User sign-off before proceeding                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 7B: UX Redesign (14-20 days)                                     │
│  ─────────────────────────────────                                      │
│  • P7-1-x: Data model updates (domain field, CLI domain)                │
│  • P7-2-x: Wizard store v2 migration                                    │
│  • P7-3-x: New wizard components (CategoryGrid, WizardTabs, etc.)       │
│  • P7-4-x: Integration and polish                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Dependencies Graph

### Phase 7A Dependencies (Architecture Fix)

```
P7-0-1 (skills in stacks)
    │
    └──> P7-0-2 (config.yaml stack property)

────────────────────────────────────────────────────────────────────────
                    ▼ CHECKPOINT: User Testing ▼
────────────────────────────────────────────────────────────────────────
```

### Phase 7B Dependencies (UX Redesign)

```
P7-1-1 (domain field) ──────────────────────────────────────────────────┐
    │                                                                    │
P7-1-2 (CLI domain) ────────────────────────────────────────────────────│
                                                                         │
P7-2-1 (wizard-store-v2) ───────────────────────────────────────────────│
    │                                                                    │
    ├──> P7-3-1 (CategoryGrid) ─────────────────────────────────────────│
    │        │                                                           │
    │        └──> P7-3-4 (StepBuild) ◀── P7-1-1 (needs domain field)    │
    │                                                                    │
    ├──> P7-3-2 (WizardTabs)                                            │
    │                                                                    │
    ├──> P7-3-3 (SectionProgress)                                       │
    │        │                                                           │
    │        └──> P7-3-5 (StepRefine)                                   │
    │                                                                    │
    └──> P7-2-2 (migrate components) ──> P7-2-3 (remove v1)             │
                                                                         │
P7-4-1 (integration) <───────────────────────────────────────────────────┘
    │
    └──> P7-4-2 (polish)
```

---

# PHASE 7A: Architecture Fix

**Goal:** Fix Concern 1 (stacks get wrong skills) while keeping the existing wizard working.

**Estimated Effort:** 4-5 days

**Success Criteria:**

- `cc init` with `angular-stack` results in Angular skills (not React)
- Existing wizard flow unchanged: `approach → stack → category → subcategory → confirm`
- All existing tests pass
- No new UI changes visible to users

---

## P7-0: Architecture Changes (CRITICAL)

### P7-0-1: Move Skills from Agents to Stacks

**Priority:** CRITICAL (blocks everything)
**Complexity:** XL+ (12-16 hours) - _Adjusted by CLI dev review_
**Dependencies:** None

**Problem:**
Currently, agents have hardcoded skills in their YAMLs (Phase 6). When you select `angular-stack`, you get React skills because `web-developer` agent has React hardcoded. This is a critical bug.

**Solution:**
Move skill definitions from agent YAMLs to stacks.yaml. Agents become generic (just tools, model, description), stacks define which technologies each agent uses.

**Files to Modify:**

| File                                               | Change                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| `config/stacks.yaml`                               | Transform `agents` array to object with subcategory->technology mappings  |
| `src/schemas/stacks.schema.json`                   | Update schema for new stack format                                        |
| `src/cli/types-stacks.ts`                          | Update `Stack` interface for agent->technology mappings                   |
| `src/agents/developer/web-developer/agent.yaml`    | Remove `skills` field entirely                                            |
| `src/agents/developer/api-developer/agent.yaml`    | Remove `skills` field entirely                                            |
| `src/agents/developer/cli-developer/agent.yaml`    | Remove `skills` field entirely                                            |
| `src/agents/developer/web-architecture/agent.yaml` | Remove `skills` field entirely                                            |
| `src/agents/reviewer/web-reviewer/agent.yaml`      | Remove `skills` field entirely                                            |
| `src/agents/reviewer/api-reviewer/agent.yaml`      | Remove `skills` field entirely                                            |
| `src/agents/reviewer/cli-reviewer/agent.yaml`      | Remove `skills` field entirely                                            |
| `src/agents/researcher/web-researcher/agent.yaml`  | Remove `skills` field entirely                                            |
| `src/agents/researcher/api-researcher/agent.yaml`  | Remove `skills` field entirely                                            |
| `src/agents/tester/web-tester/agent.yaml`          | Remove `skills` field entirely                                            |
| `src/agents/planning/web-pm/agent.yaml`            | Remove `skills` field entirely                                            |
| `src/agents/pattern/*/agent.yaml`                  | Remove `skills` field entirely                                            |
| `src/agents/meta/*/agent.yaml`                     | Remove `skills` field entirely                                            |
| `src/cli/lib/stacks-loader.ts`                     | Add `loadStackWithResolvedSkills()` function                              |
| `src/cli/lib/resolver.ts`                          | Update `resolveAgentSkills()` to read from stack                          |
| `src/cli/commands/init.tsx`                        | Update to use new stack format                                            |
| `src/types.ts`                                     | Remove `skills` field from `AgentDefinition`, deprecate `AgentSkillEntry` |
| `src/schemas/agent.schema.json`                    | Remove `skills` property from schema                                      |

**New stacks.yaml Format:**

```yaml
stacks:
  - id: nextjs-fullstack
    name: Next.js Fullstack
    description: Production-ready Next.js with complete backend infrastructure
    agents:
      web-developer:
        framework: react # subcategory: technology
        styling: scss-modules
        client-state: zustand
        server-state: react-query
        testing: vitest
      api-developer:
        api: hono
        database: drizzle
        auth: better-auth
        observability: axiom-pino-sentry
      web-reviewer:
        reviewing: reviewing
      # ... other agents with their technologies
    philosophy: Ship fast, iterate faster

  - id: angular-stack
    name: Modern Angular Stack
    description: Angular 19 with Signals and NgRx SignalStore
    agents:
      web-developer:
        framework: angular # Different technology!
        styling: tailwind
        client-state: ngrx-signalstore
        testing: vitest
      # ...
```

**New types-stacks.ts:**

```typescript
export interface StackV2 {
  id: string;
  name: string;
  description: string;
  agents: Record<string, StackAgentConfig>; // agent-id -> subcategory->technology
  philosophy?: string;
}

export interface StackAgentConfig {
  [subcategoryId: string]: string; // Maps subcategory to technology alias
}

export interface StacksConfigV2 {
  stacks: StackV2[];
}
```

**Subtasks:**

| ID      | Task                                   | Effort | Notes                                   |
| ------- | -------------------------------------- | ------ | --------------------------------------- |
| P7-0-1a | Design new `StackV2` type              | S      | See types above                         |
| P7-0-1b | Update `stacks.schema.json`            | S      | New agents object schema                |
| P7-0-1c | Update `config/stacks.yaml`            | M      | Transform all 7 stacks to new format    |
| P7-0-1d | Create `stackToAgentSkills()` resolver | M      | Read stack, return agent->skill mapping |
| P7-0-1e | Update `loadStackById()`               | S      | Return new `StackV2` type               |
| P7-0-1f | Remove `skills` from all agent YAMLs   | M      | 15+ agent files                         |
| P7-0-1g | Update `resolveAgentSkills()`          | M      | Now reads from stack, not agent         |
| P7-0-1h | Update `init.tsx`                      | M      | Use new stack format                    |
| P7-0-1i | Update `AgentDefinition` type          | S      | Remove skills field                     |
| P7-0-1j | Update `agent.schema.json`             | S      | Remove skills property                  |
| P7-0-1k | Update tests                           | L      | Many tests will break                   |

**Acceptance Criteria:**

1. Running `cc init` and selecting `angular-stack` results in Angular skills, not React
2. All existing tests pass (after updates)
3. Agent YAMLs have NO `skills` field
4. `config/stacks.yaml` defines technologies per agent
5. `skill_aliases` in skills-matrix.yaml maps technology->skill

**Risks:**

- Breaking change for existing installations
- Many files touched - high regression risk
- Tests need significant updates

---

### P7-0-2: Add `stack` Property to Consumer config.yaml

**Priority:** HIGH
**Complexity:** S (1-2 hours)
**Dependencies:** P7-0-1

**Purpose:**
When a user selects a stack, their `.claude/config.yaml` needs a `stack` property that stores the resolved agent->skill mapping. This enables the compile command to know which skills each agent should have.

**Files to Modify:**

| File                                     | Change                                            |
| ---------------------------------------- | ------------------------------------------------- |
| `src/types.ts`                           | Add `stack` property to `ProjectConfig` interface |
| `src/schemas/project-config.schema.json` | Add `stack` property schema (if exists)           |
| `src/cli/lib/config-generator.ts`        | Generate `stack` property from wizard selection   |

**New config.yaml Format:**

```yaml
name: my-project
description: My awesome project
agents:
  - web-developer
  - api-developer
  - web-reviewer

# NEW: Resolved stack with agent->skill mapping
stack:
  web-developer:
    framework: web/framework/react (@vince)
    styling: web/styling/scss-modules (@vince)
    client-state: web/state/zustand (@vince)
  api-developer:
    api: api/framework/hono (@vince)
    database: api/database/drizzle (@vince)
```

**ProjectConfig Update:**

```typescript
export interface ProjectConfig {
  // ... existing fields ...

  /**
   * Resolved stack configuration with agent->skill mappings.
   * Keys are agent IDs, values are subcategory->skill mappings.
   * Generated during `cc init` when a stack is selected.
   */
  stack?: Record<string, Record<string, string>>;
}
```

**Acceptance Criteria:**

1. `ProjectConfig` includes optional `stack` property
2. `cc init` with stack selection populates `stack` property
3. Compile command reads skills from `stack` property when present
4. Existing config.yaml files (without `stack`) still work

---

# CHECKPOINT: User Testing

**Before proceeding to Phase 7B, verify:**

| Test                       | Command                             | Expected Result                       |
| -------------------------- | ----------------------------------- | ------------------------------------- |
| Init with nextjs-fullstack | `cc init` → select nextjs-fullstack | React, SCSS Modules, Zustand skills   |
| Init with angular-stack    | `cc init` → select angular-stack    | Angular, Tailwind, NgRx skills        |
| Init with vue-stack        | `cc init` → select vue-stack        | Vue skills                            |
| Compile after init         | `cc compile`                        | Agents compiled with correct skills   |
| Edit existing project      | `cc edit`                           | Existing skills preserved, can modify |
| Build from scratch         | `cc init` → build from scratch      | Category/subcategory flow works       |

**Manual Verification:**

1. [ ] `cc init` wizard completes without errors
2. [ ] Stack selection shows all 7 stacks
3. [ ] Selected stack's skills match the stack definition
4. [ ] `.claude/config.yaml` has correct `stack` property
5. [ ] `cc compile` produces correct agent markdown
6. [ ] No TypeScript errors
7. [ ] All tests pass

**Sign-off Required:**

- [ ] User confirms Phase 7A is working correctly
- [ ] User approves proceeding to Phase 7B

---

# PHASE 7B: UX Redesign

**Goal:** Implement the new wizard UX with domain-based navigation and CategoryGrid.

**Estimated Effort:** 14-20 days

**Prerequisites:** Phase 7A complete and user-approved

---

## P7-1: Data Model Updates

### P7-1-1: Add `domain` Field to Subcategories

**Priority:** HIGH
**Complexity:** S (1-2 hours) - _Adjusted by CLI dev review_
**Dependencies:** P7-0-1

**Purpose:**
Enable domain-based filtering in the wizard. Each subcategory needs a `domain` field (web, api, cli, mobile) so the Build step can show only relevant categories.

**Files to Modify:**

| File                           | Change                                             |
| ------------------------------ | -------------------------------------------------- |
| `config/skills-matrix.yaml`    | Add `domain` field to each subcategory             |
| `src/cli/types-matrix.ts`      | Add `domain` field to `CategoryDefinition`         |
| `src/cli/lib/matrix-loader.ts` | Validate `domain` field presence for subcategories |

**Domain Mappings:**

| Current Parent | Domain                          |
| -------------- | ------------------------------- |
| `frontend`     | `web`                           |
| `backend`      | `api`                           |
| `mobile`       | `mobile`                        |
| `setup`        | `shared` (shows in all domains) |
| `reviewing`    | `shared`                        |

**skills-matrix.yaml Changes:**

```yaml
categories:
  framework:
    id: framework
    name: Framework
    parent: frontend
    domain: web # NEW
    exclusive: true
    required: true
    order: 1

  api:
    id: api
    name: API Framework
    parent: backend
    domain: api # NEW
    exclusive: true
    required: true
    order: 1
```

**Acceptance Criteria:**

1. All subcategories in skills-matrix.yaml have `domain` field
2. `CategoryDefinition` type includes optional `domain` field
3. Matrix loader validates domain field for subcategories
4. No breaking changes to existing functionality

---

### P7-1-2: Add CLI Domain to skills-matrix.yaml

**Priority:** HIGH
**Complexity:** M (3-4 hours)
**Dependencies:** P7-1-1

**Purpose:**
CLI is not currently represented in skills-matrix.yaml. Add CLI as a full domain with categories, subcategories, and skills.

**Files to Modify:**

| File                        | Change                                                         |
| --------------------------- | -------------------------------------------------------------- |
| `config/skills-matrix.yaml` | Add `cli` top-level category, subcategories, and skill_aliases |

**New Categories:**

```yaml
categories:
  # Top-level CLI category
  cli:
    id: cli
    name: CLI
    description: Command-line tool development
    exclusive: false
    required: false
    order: 6
    icon: ">"

  # CLI subcategories
  cli-framework:
    id: cli-framework
    name: CLI Framework
    description: CLI application framework (Commander, oclif, yargs)
    parent: cli
    domain: cli
    exclusive: true
    required: true
    order: 1

  cli-prompts:
    id: cli-prompts
    name: CLI Prompts
    description: Interactive prompts and UI (Clack, Inquirer, Ink)
    parent: cli
    domain: cli
    exclusive: true
    required: false
    order: 2

  cli-testing:
    id: cli-testing
    name: CLI Testing
    description: CLI testing utilities
    parent: cli
    domain: cli
    exclusive: false
    required: false
    order: 3
```

**New skill_aliases:**

```yaml
skill_aliases:
  # CLI Framework
  commander: "cli/framework/cli-commander (@vince)"
  oclif: "cli/framework/cli-oclif (@vince)"
  yargs: "cli/framework/cli-yargs (@vince)"

  # CLI Prompts
  clack: "cli/prompts/cli-clack (@vince)"
  inquirer: "cli/prompts/cli-inquirer (@vince)"
  ink: "cli/prompts/cli-ink (@vince)"
```

**New Relationships:**

```yaml
relationships:
  conflicts:
    - skills: [commander, oclif, yargs]
      reason: "CLI frameworks are mutually exclusive"
    - skills: [clack, inquirer, ink]
      reason: "CLI prompt libraries - choose one"

  recommends:
    - when: oclif
      suggest: [ink, vitest]
      reason: "oclif + Ink is a powerful combo"
    - when: commander
      suggest: [clack, vitest]
      reason: "Commander + Clack is lightweight and elegant"

  alternatives:
    - purpose: "CLI Framework"
      skills: [commander, oclif, yargs]
    - purpose: "CLI Prompts"
      skills: [clack, inquirer, ink]
```

**Note:** The actual skill files (SKILL.md + metadata.yaml) may not exist yet. This task only updates the matrix. Skill creation is a separate task.

**Acceptance Criteria:**

1. `cli` appears as a top-level category
2. `cli-framework`, `cli-prompts`, `cli-testing` subcategories exist with `domain: cli`
3. `skill_aliases` map CLI technologies to skill IDs
4. CLI relationships (conflicts, recommends, alternatives) defined
5. Matrix validation passes

---

### P7-1-3: Update stacks.yaml Schema for Agent->Technology Mappings

**Priority:** MEDIUM
**Complexity:** S (1-2 hours)
**Dependencies:** P7-1-1

**Purpose:**
Update the JSON schema to validate the new stacks.yaml format where agents are objects with subcategory->technology mappings. (Note: The basic schema update is done in P7-0-1; this adds domain-aware validation.)

**Files to Modify:**

| File                             | Change                |
| -------------------------------- | --------------------- |
| `src/schemas/stacks.schema.json` | Add domain validation |

**Acceptance Criteria:**

1. Schema validates domain field in subcategories
2. VS Code/YAML language server provides correct autocomplete for domain values

---

## P7-2: Wizard Store Migration

### P7-2-1: Create wizard-store-v2.ts with New State Shape

**Priority:** HIGH
**Complexity:** M (3-4 hours)
**Dependencies:** P7-0-1

**Purpose:**
The new wizard flow requires a different state shape. Create a v2 store incrementally to avoid breaking existing functionality.

**Files to Create:**

| File                                | Purpose                                   |
| ----------------------------------- | ----------------------------------------- |
| `src/cli/stores/wizard-store-v2.ts` | New Zustand store with domain-based state |

**New State Shape:**

```typescript
export type WizardStepV2 =
  | "approach"
  | "stack" // Stack selection (pre-built or domain selection)
  | "stack-options" // After stack: continue defaults or customize
  | "build" // CategoryGrid for technology selection
  | "refine" // Skill source selection
  | "confirm";

export interface WizardStateV2 {
  // Current step
  step: WizardStepV2;

  // Flow tracking
  approach: "stack" | "scratch" | null;
  selectedStackId: string | null;
  stackAction: "defaults" | "customize" | null; // For stack flow

  // Domain selection (scratch flow)
  selectedDomains: string[]; // ['web', 'api', 'cli', 'mobile']

  // Build step state
  currentDomainIndex: number; // Which domain we're configuring (0-based)
  domainSelections: Record<string, Record<string, string[]>>;
  // e.g., { web: { framework: ['react'], styling: ['scss-modules'] } }
  // Note: array supports multi-select categories

  // Grid navigation state
  focusedRow: number;
  focusedCol: number;

  // Refine step state
  currentRefineIndex: number; // Which skill we're refining
  skillSources: Record<string, string>; // technology -> selected skill ID
  refineAction: "all-recommended" | "customize" | null;

  // UI state
  showDescriptions: boolean;
  expertMode: boolean;

  // Modes (carry over from v1)
  installMode: "plugin" | "local";

  // Navigation
  history: WizardStepV2[];

  // Actions
  setStep: (step: WizardStepV2) => void;
  setApproach: (approach: "stack" | "scratch") => void;
  selectStack: (stackId: string | null) => void;
  setStackAction: (action: "defaults" | "customize") => void;
  toggleDomain: (domain: string) => void;
  setDomainSelection: (domain: string, subcategory: string, technologies: string[]) => void;
  setCurrentDomainIndex: (index: number) => void;
  setFocus: (row: number, col: number) => void;
  setRefineAction: (action: "all-recommended" | "customize") => void;
  setSkillSource: (technology: string, skillId: string) => void;
  setCurrentRefineIndex: (index: number) => void;
  toggleShowDescriptions: () => void;
  toggleExpertMode: () => void;
  toggleInstallMode: () => void;
  goBack: () => void;
  reset: () => void;

  // Computed getters (not stored, computed on access)
  // - getAllSelectedTechnologies(): string[]
  // - getCurrentDomain(): string | null
  // - getResolvedSkills(): Record<string, string>
}
```

**Pattern Reference:**
Follow existing `wizard-store.ts` (lines 1-173) for Zustand patterns, action naming conventions, and state update patterns.

**Acceptance Criteria:**

1. `wizard-store-v2.ts` created with full type definitions
2. All actions implemented
3. Unit tests for state transitions
4. Store can be used alongside v1 store during migration

---

### P7-2-2: Migrate Wizard Components to Use v2 Store

**Priority:** MEDIUM
**Complexity:** L (5-8 hours)
**Dependencies:** P7-2-1, P7-3-1 through P7-3-5

**Purpose:**
Update existing wizard components to use the v2 store. Create new components as needed.

**Files to Modify:**

| File                                             | Change                               |
| ------------------------------------------------ | ------------------------------------ |
| `src/cli/components/wizard/wizard.tsx`           | Import v2 store, update step routing |
| `src/cli/components/wizard/step-approach.tsx`    | Use v2 store actions                 |
| `src/cli/components/wizard/step-stack.tsx`       | Refactor for new flow                |
| `src/cli/components/wizard/step-confirm.tsx`     | Read from v2 store                   |
| `src/cli/components/wizard/selection-header.tsx` | Update for domain-based display      |

**Files to Remove (after migration):**

| File                                             | Reason                |
| ------------------------------------------------ | --------------------- |
| `src/cli/components/wizard/step-category.tsx`    | Replaced by StepBuild |
| `src/cli/components/wizard/step-subcategory.tsx` | Replaced by StepBuild |

**Migration Strategy:**

1. Create new components first (P7-3-x)
2. Update wizard.tsx to route to new steps
3. Update existing steps to use v2 store
4. Remove deprecated steps
5. Verify all flows work

**Acceptance Criteria:**

1. All wizard flows work with v2 store
2. No regressions in existing functionality
3. step-category.tsx and step-subcategory.tsx removed
4. All tests pass

---

### P7-2-3: Remove wizard-store.ts (v1) After Migration

**Priority:** LOW
**Complexity:** S (1-2 hours)
**Dependencies:** P7-2-2

**Purpose:**
Once all components use v2 store, remove v1 and rename v2.

**Files to Modify:**

| File                                | Change                      |
| ----------------------------------- | --------------------------- |
| `src/cli/stores/wizard-store-v2.ts` | Rename to `wizard-store.ts` |
| `src/cli/stores/wizard-store.ts`    | Delete                      |
| All wizard components               | Update imports              |

**Acceptance Criteria:**

1. Only one wizard store exists
2. File is named `wizard-store.ts` (not v2)
3. All imports updated
4. All tests pass

---

## P7-3: Wizard Components

### P7-3-1: Create CategoryGrid Component

**Priority:** HIGH (Big selling point of redesign)
**Complexity:** XL (8+ hours) - _Adjusted by CLI dev review - 2D navigation is non-trivial_
**Dependencies:** P7-2-1

**Purpose:**
Grid-based category/technology selection with 2D keyboard navigation. This is the core UI component for the Build step.

**Files to Create:**

| File                                               | Purpose             |
| -------------------------------------------------- | ------------------- |
| `src/cli/components/wizard/category-grid.tsx`      | Main grid component |
| `src/cli/components/wizard/category-grid.test.tsx` | Unit tests          |

**Visual Design:**

```
                                            [ ] Show descriptions    [Expert Mode: OFF]

Framework *     > * react (r)    o vue         o angular      o svelte
Styling *         * scss-mod     o tailwind    o styled       o vanilla
Client State      o zustand (r)  o jotai       o redux (!)    o mobx
Server State      * react-query  o swr         o apollo
Analytics         o posthog                                               (optional)

Legend: * selected   (r) recommended   (!) discouraged   x disabled
```

**Props Interface:**

```typescript
interface CategoryGridProps {
  /** Domain to show categories for (web, api, cli, mobile) */
  domain: string;
  /** Categories to display (filtered by domain from matrix) */
  categories: CategoryRow[];
  /** Current selections by category */
  selections: Record<string, string[]>;
  /** Focused row index */
  focusedRow: number;
  /** Focused column index */
  focusedCol: number;
  /** Show descriptions under each technology */
  showDescriptions: boolean;
  /** Expert mode - shows all options, disables smart ordering */
  expertMode: boolean;
  /** Called when user toggles a technology */
  onToggle: (categoryId: string, technologyId: string) => void;
  /** Called when focus changes */
  onFocusChange: (row: number, col: number) => void;
}

interface CategoryRow {
  id: string;
  name: string;
  required: boolean; // Show * indicator
  exclusive: boolean; // Radio vs checkbox behavior
  options: CategoryOption[];
}

interface CategoryOption {
  id: string;
  label: string;
  state: "normal" | "recommended" | "discouraged" | "disabled";
  stateReason?: string; // Tooltip text
  selected: boolean;
}
```

**Keyboard Shortcuts:**

| Key          | Action                              |
| ------------ | ----------------------------------- |
| `Left/Right` | Move between options in current row |
| `Up/Down`    | Move between categories             |
| `Space`      | Toggle selection (select/deselect)  |
| `Tab`        | Toggle descriptions                 |
| `E`          | Toggle Expert Mode                  |
| `Enter`      | Continue to next step               |

**Implementation Notes:**

1. Use Ink's `Box` with `flexDirection="column"` for rows
2. Each row is a `Box` with `flexDirection="row"` for options
3. Use `useInput` hook for keyboard handling
4. Compute option states (recommended/discouraged/disabled) using matrix relationships
5. Handle exclusive vs multi-select categories differently

**Pattern Reference:**

- Ink `Box` usage: See `step-approach.tsx` (lines 65-94)
- `useInput` hook: See `wizard.tsx` (lines 52-61)
- Matrix relationship resolution: See `matrix-resolver.ts` (lines 1-200)

**Acceptance Criteria:**

1. 2D grid renders correctly with Ink Box/flexbox
2. Arrow key navigation works (wraps at edges)
3. Space toggles selection
4. Exclusive categories only allow one selection
5. Multi-select categories allow multiple
6. Required categories shown with `*`
7. Option states (recommended, discouraged, disabled) computed from matrix
8. Disabled options cannot be selected
9. Show descriptions toggle works
10. Expert mode toggle works
11. Responsive to terminal width
12. Unit tests cover all interactions

---

### P7-3-2: Create WizardTabs Component

**Priority:** MEDIUM
**Complexity:** M (3-4 hours)
**Dependencies:** P7-2-1

**Purpose:**
Horizontal progress tabs showing all 5 wizard steps with visual states.

**Files to Create:**

| File                                             | Purpose                 |
| ------------------------------------------------ | ----------------------- |
| `src/cli/components/wizard/wizard-tabs.tsx`      | Progress tabs component |
| `src/cli/components/wizard/wizard-tabs.test.tsx` | Unit tests              |

**Visual Design:**

```
[1] Approach    [2] Stack    [3] Build    [4] Refine    [5] Confirm
     check          check         *            o              o
```

**States:**

| Symbol  | Color     | Meaning                |
| ------- | --------- | ---------------------- |
| check   | Green     | Completed              |
| \*      | Cyan      | Current                |
| o       | Gray      | Pending                |
| o (dim) | Dark gray | Skipped/not applicable |

**Props Interface:**

```typescript
interface WizardTabsProps {
  steps: Array<{
    id: string;
    label: string;
    number: number;
  }>;
  currentStep: string;
  completedSteps: string[];
  skippedSteps: string[]; // Grayed out
}
```

**Implementation Notes:**

1. Use Ink `Box` with `flexDirection="row"` and `justifyContent="space-around"`
2. Each tab is `[{number}] {label}` with status below
3. Use `Text` `color` prop for state colors

**Pattern Reference:**

- Ink color usage: See `step-approach.tsx` (lines 69-82)

**Acceptance Criteria:**

1. All 5 tabs render horizontally
2. Current step highlighted in cyan
3. Completed steps show green check
4. Skipped steps are dimmed
5. Responsive to terminal width
6. Unit tests cover all states

---

### P7-3-3: Create SectionProgress Component

**Priority:** MEDIUM
**Complexity:** S (1-2 hours)
**Dependencies:** P7-2-1

**Purpose:**
Sub-step progress indicator for multi-domain Build and Refine steps.

**Files to Create:**

| File                                                  | Purpose                    |
| ----------------------------------------------------- | -------------------------- |
| `src/cli/components/wizard/section-progress.tsx`      | Section progress component |
| `src/cli/components/wizard/section-progress.test.tsx` | Unit tests                 |

**Visual Design:**

```
  Domain: Web                                         [1/2] Next: API
```

```
  Skill: react                                   [1/8] Next: zustand
```

**Props Interface:**

```typescript
interface SectionProgressProps {
  /** Section label (e.g., "Domain" or "Skill") */
  label: string;
  /** Current item name (e.g., "Web" or "react") */
  current: string;
  /** 1-based index */
  index: number;
  /** Total count */
  total: number;
  /** Next item name, or undefined if last */
  next?: string;
}
```

**Implementation Notes:**

1. Use Ink `Box` with `justifyContent="space-between"`
2. Left side: `{label}: {current}`
3. Right side: `[{index}/{total}] {next ? "Next: " + next : "Last step"}`
4. Start WITHOUT borders (decision from concerns doc)

**Acceptance Criteria:**

1. Component renders with correct layout
2. Shows "Next: X" when not last
3. Shows "Last step" when on final item
4. No borders (can add later via Box borderStyle)
5. Unit tests cover all cases

---

### P7-3-4: Create StepBuild Component

**Priority:** HIGH
**Complexity:** L (5-8 hours) - _Adjusted by CLI dev review_
**Dependencies:** P7-3-1, P7-3-3, P7-2-1, P7-1-1 (needs domain field for filtering)

**Purpose:**
New Build step that uses CategoryGrid, replacing the linear category->subcategory flow.

**Files to Create:**

| File                                            | Purpose              |
| ----------------------------------------------- | -------------------- |
| `src/cli/components/wizard/step-build.tsx`      | Build step component |
| `src/cli/components/wizard/step-build.test.tsx` | Unit tests           |

**Component Responsibilities:**

1. Determine current domain from store state
2. Filter categories by domain from matrix
3. Compute option states (recommended, etc.) from matrix relationships
4. Render SectionProgress if multi-domain
5. Render CategoryGrid
6. Handle navigation to next domain or Refine step

**Flow Logic:**

```
if (selectedDomains.length > 1):
  show SectionProgress with current domain
  show CategoryGrid filtered to current domain
  on ENTER:
    if currentDomainIndex < selectedDomains.length - 1:
      advance to next domain
    else:
      go to Refine step
else:
  show CategoryGrid (no SectionProgress)
  on ENTER:
    go to Refine step
```

**Pattern Reference:**

- Step component structure: See `step-approach.tsx` (full file)
- Matrix filtering: See `step-subcategory.tsx` (lines 15-45)

**Acceptance Criteria:**

1. Single domain: Shows CategoryGrid, no SectionProgress
2. Multi-domain: Shows SectionProgress and CategoryGrid
3. Navigation between domains works
4. Final domain advances to Refine
5. Back navigation preserves selections
6. Unit tests cover single and multi-domain flows

---

### P7-3-5: Create StepRefine Component

**Priority:** MEDIUM
**Complexity:** M (3-4 hours)
**Dependencies:** P7-3-3, P7-2-1

**Purpose:**
New Refine step for skill source selection. Default is "Use all recommended" (verified skills only - skills.sh integration deferred).

**Files to Create:**

| File                                             | Purpose               |
| ------------------------------------------------ | --------------------- |
| `src/cli/components/wizard/step-refine.tsx`      | Refine step component |
| `src/cli/components/wizard/step-refine.test.tsx` | Unit tests            |

**Visual Design (Default View):**

```
Your stack includes 12 technologies.

  -------------------------------------------
  |                                         |
  |   > Use all recommended skills          |
  |                                         |
  |     This is the fastest option. All     |
  |     skills are verified and maintained  |
  |     by Claude Collective.               |
  |                                         |
  -------------------------------------------

    o Customize skill sources
      Choose alternative skills for each technology
```

**Visual Design (Customize View - Deferred for skills.sh):**

```
  Skill: react                                   [1/8] Next: zustand

> * react (@vince)                    check Verified
  o react-complete (@skills.sh/dan)   12.4k downloads
```

**Initial Implementation:**
For Phase 7, only implement "Use all recommended" path:

- Show prominent default option
- Show grayed "Customize" option (not selectable)
- ENTER on default -> advance to Confirm

skills.sh integration will be Phase 8.

**Props Interface:**

```typescript
interface StepRefineProps {
  /** Technologies selected in Build step */
  technologies: string[];
  /** Matrix for skill lookup */
  matrix: MergedSkillsMatrix;
}
```

**Acceptance Criteria:**

1. Shows count of selected technologies
2. "Use all recommended" is prominent default
3. "Customize" shown but disabled (skills.sh deferred)
4. ENTER advances to Confirm with verified skills
5. Back navigation works
6. Unit tests

---

## P7-4: Integration and Polish

### P7-4-1: Integration Testing

**Priority:** HIGH
**Complexity:** L (5-8 hours)
**Dependencies:** All P7-3-x tasks

**Purpose:**
End-to-end testing of all wizard flows.

**Test Scenarios:**

| Flow | Description                                                                            | Expected Result            |
| ---- | -------------------------------------------------------------------------------------- | -------------------------- |
| A1   | Approach -> Stack -> Continue defaults -> Refine -> Confirm                            | Stack with verified skills |
| A2   | Approach -> Stack -> Customize -> Build (pre-populated) -> Refine -> Confirm           | Modified stack             |
| B    | Approach -> Scratch -> Domain (Web) -> Build -> Refine -> Confirm                      | Custom web stack           |
| C    | Approach -> Scratch -> Domain (Web+API) -> Build/Web -> Build/API -> Refine -> Confirm | Multi-domain               |
| D    | Back navigation at each step                                                           | Preserves all selections   |
| E    | ESC cancels at first step                                                              | Clean exit                 |

**Files to Create:**

| File                                                    | Purpose           |
| ------------------------------------------------------- | ----------------- |
| `src/cli/components/wizard/wizard.integration.test.tsx` | Integration tests |

**Acceptance Criteria:**

1. All flows complete successfully
2. Skills resolved correctly for each flow
3. Back navigation preserves state
4. Cancel works correctly
5. Error handling for invalid states

---

### P7-4-2: Polish and Edge Cases

**Priority:** LOW
**Complexity:** M (3-4 hours)
**Dependencies:** P7-4-1

**Purpose:**
Handle edge cases, improve UX, add help text.

**Tasks:**

| Task           | Description                             |
| -------------- | --------------------------------------- |
| Empty state    | What if user selects no technologies?   |
| Validation     | Required categories must have selection |
| Help text      | Keyboard shortcuts help at bottom       |
| Terminal size  | Handle narrow terminals gracefully      |
| Error messages | Clear messages for invalid states       |

**Acceptance Criteria:**

1. All edge cases handled gracefully
2. Help text visible
3. No crashes on narrow terminals
4. Clear error messages

---

## Risk Assessment

### High Risk

| Risk                               | Mitigation                            |
| ---------------------------------- | ------------------------------------- |
| P7-0-1 touches many files          | Create comprehensive test plan first  |
| Breaking change for existing users | Document migration path               |
| Store migration complexity         | Incremental approach, keep v1 working |

### Medium Risk

| Risk                            | Mitigation                                 |
| ------------------------------- | ------------------------------------------ |
| Ink layout complexity           | Prototype early, test on various terminals |
| Matrix relationship computation | Reuse existing matrix-resolver.ts logic    |

### Low Risk

| Risk                           | Mitigation                              |
| ------------------------------ | --------------------------------------- |
| CLI domain skills don't exist  | skill_aliases can point to placeholders |
| skills.sh integration deferred | Clearly scope out for Phase 8           |

---

## Testing Strategy

### Unit Tests

| Component              | Tests                         |
| ---------------------- | ----------------------------- |
| `wizard-store-v2.ts`   | All state transitions         |
| `category-grid.tsx`    | Navigation, selection, states |
| `wizard-tabs.tsx`      | All visual states             |
| `section-progress.tsx` | All display variants          |
| `step-build.tsx`       | Single/multi-domain flows     |
| `step-refine.tsx`      | Default path                  |

### Integration Tests

| Test              | Scope                                  |
| ----------------- | -------------------------------------- |
| Wizard flows      | Full wizard from start to finish       |
| Matrix resolution | Correct skills resolved for selections |
| Store persistence | State preserved across steps           |

### Manual Tests

| Test                | Description                  |
| ------------------- | ---------------------------- |
| Terminal width      | Test at 80, 120, 160 columns |
| Keyboard navigation | All shortcuts work           |
| Visual inspection   | Colors, alignment, spacing   |

---

## Task Summary

### Phase 7A: Architecture Fix

| Task         | Description                       | Est. Days |
| ------------ | --------------------------------- | --------- |
| P7-0-1       | Move skills from agents to stacks | 3-4       |
| P7-0-2       | Add stack property to config.yaml | 1         |
| **7A Total** |                                   | **4-5**   |

### Checkpoint: User Testing

| Activity | Description                      |
| -------- | -------------------------------- |
| Testing  | Verify all stacks work correctly |
| Sign-off | User approves proceeding to 7B   |

### Phase 7B: UX Redesign

| Task         | Description                       | Est. Days |
| ------------ | --------------------------------- | --------- |
| P7-1-1       | Add domain field to subcategories | 0.5       |
| P7-1-2       | Add CLI domain to skills-matrix   | 1-2       |
| P7-1-3       | Update stacks.yaml schema         | 0.5       |
| P7-2-1       | Create wizard-store-v2            | 1-2       |
| P7-2-2       | Migrate wizard components         | 2-3       |
| P7-2-3       | Remove wizard-store v1            | 0.5       |
| P7-3-1       | Create CategoryGrid               | 3-4       |
| P7-3-2       | Create WizardTabs                 | 1         |
| P7-3-3       | Create SectionProgress            | 0.5       |
| P7-3-4       | Create StepBuild                  | 2-3       |
| P7-3-5       | Create StepRefine                 | 1-2       |
| P7-4-1       | Integration testing               | 2-3       |
| P7-4-2       | Polish and edge cases             | 1-2       |
| **7B Total** |                                   | **14-20** |

### Grand Total

| Phase      | Est. Days          |
| ---------- | ------------------ |
| Phase 7A   | 4-5                |
| Checkpoint | 1-2 (user testing) |
| Phase 7B   | 14-20              |
| **Total**  | **19-27**          |

---

## Recommended Execution Order

### Phase 7A: Architecture Fix

1. **P7-0-1** - Move skills from agents to stacks (critical bug fix)
2. **P7-0-2** - Add stack property to config.yaml

### Checkpoint

3. **User Testing** - Verify all stacks work, sign-off before 7B

### Phase 7B: UX Redesign

4. **P7-1-1** - Domain field (quick, unblocks P7-3-4)
5. **P7-1-2** - CLI domain (can parallel with P7-1-1)
6. **P7-1-3** - Schema update (quick)
7. **P7-2-1** - Wizard store v2 (unblocks components)
8. **P7-3-2** - WizardTabs (simple, visible progress)
9. **P7-3-3** - SectionProgress (simple)
10. **P7-3-1** - CategoryGrid (complex, core UI)
11. **P7-3-4** - StepBuild (depends on CategoryGrid + P7-1-1)
12. **P7-3-5** - StepRefine (depends on SectionProgress)
13. **P7-2-2** - Migrate components
14. **P7-2-3** - Remove v1 store
15. **P7-4-1** - Integration testing
16. **P7-4-2** - Polish

---

## Appendix: CLI Developer Review

### Assessment: APPROVED with adjustments

The Phase 7 implementation plan is **technically sound**. The architecture change (P7-0-1) correctly addresses the critical bug where stacks get wrong skills.

### Complexity Adjustments Made

| Task   | Original | Revised      | Reason                                                    |
| ------ | -------- | ------------ | --------------------------------------------------------- |
| P7-0-1 | XL (8+)  | XL+ (12-16h) | 15+ agent files + tests + resolver changes                |
| P7-1-1 | M (3-4h) | S (1-2h)     | Just adding a field to existing categories                |
| P7-3-1 | L (5-8h) | XL (8+h)     | 2D navigation, responsive layout, visual states           |
| P7-3-4 | M (3-4h) | L (5-8h)     | Orchestrates CategoryGrid + SectionProgress + domain loop |

### Missing Dependencies Added

- **P7-3-4 now depends on P7-1-1** - StepBuild filters categories by domain

### Additional Files to Modify (P7-0-1)

| File                           | Change                                       |
| ------------------------------ | -------------------------------------------- |
| `src/cli/lib/source-loader.ts` | May need stack loading integration           |
| `src/cli/consts.ts`            | Potential DEFAULT_PRESELECTED_SKILLS updates |

### Additional Acceptance Criteria

**P7-0-1:**

- [ ] `cc compile` works with new stack format
- [ ] Existing `.claude/config.yaml` files (without `stack` property) still work

**P7-3-1:**

- [ ] Handles terminal widths from 80 to 200+ columns
- [ ] Focus state is visually distinct (highlight or underline)

### Additional Risks Identified

| Risk                                               | Mitigation                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| Backwards compatibility for existing installations | Migration handling or clear error message for old config.yaml format |
| Ink terminal width edge cases                      | Use `useStdoutDimensions()` hook for responsive CategoryGrid         |
| Custom component vs @inkjs/ui Select               | No library support for bugs - prototype early                        |

### Parallelization Opportunities

These task pairs can run in parallel:

- P7-1-1 (domain field) ‖ P7-1-2 (CLI domain)
- P7-3-2 (WizardTabs) ‖ P7-3-3 (SectionProgress)

### Implementation Notes

1. **resolveAgentSkills() signature change** needed:

   ```typescript
   // Current
   resolveAgentSkills(agentDef: AgentDefinition): SkillReference[]

   // Needed
   resolveAgentSkills(agentDef: AgentDefinition, stack: StackV2, aliases: Record<string, string>): SkillReference[]
   ```

2. **Matrix relationship utilities** to reuse for CategoryGrid:
   - `isDisabled()` at `matrix-resolver.ts:61-119`
   - `isDiscouraged()` at `matrix-resolver.ts:121-150`
   - `isRecommended()` at `matrix-resolver.ts:152-180`

3. **Store migration** - Use re-export pattern to minimize import changes:
   ```typescript
   // In wizard-store-v2.ts:
   export { useWizardStoreV2 as useWizardStore };
   ```

---

## Appendix: File Inventory

### Phase 7A Files

**Files to Modify:**

| File                               | Task           |
| ---------------------------------- | -------------- |
| `config/stacks.yaml`               | P7-0-1         |
| `src/schemas/stacks.schema.json`   | P7-0-1         |
| `src/schemas/agent.schema.json`    | P7-0-1         |
| `src/types.ts`                     | P7-0-1, P7-0-2 |
| `src/cli/types-stacks.ts`          | P7-0-1         |
| `src/cli/lib/stacks-loader.ts`     | P7-0-1         |
| `src/cli/lib/resolver.ts`          | P7-0-1         |
| `src/cli/lib/config-generator.ts`  | P7-0-2         |
| `src/cli/commands/init.tsx`        | P7-0-1         |
| `src/agents/**/*.yaml` (15+ files) | P7-0-1         |

### Phase 7B Files

**Files to Create:**

| File                                             | Task   |
| ------------------------------------------------ | ------ |
| `src/cli/stores/wizard-store-v2.ts`              | P7-2-1 |
| `src/cli/components/wizard/category-grid.tsx`    | P7-3-1 |
| `src/cli/components/wizard/wizard-tabs.tsx`      | P7-3-2 |
| `src/cli/components/wizard/section-progress.tsx` | P7-3-3 |
| `src/cli/components/wizard/step-build.tsx`       | P7-3-4 |
| `src/cli/components/wizard/step-refine.tsx`      | P7-3-5 |

**Files to Modify:**

| File                                             | Task           |
| ------------------------------------------------ | -------------- |
| `config/skills-matrix.yaml`                      | P7-1-1, P7-1-2 |
| `src/cli/types-matrix.ts`                        | P7-1-1         |
| `src/cli/lib/matrix-loader.ts`                   | P7-1-1         |
| `src/cli/components/wizard/wizard.tsx`           | P7-2-2         |
| `src/cli/components/wizard/step-approach.tsx`    | P7-2-2         |
| `src/cli/components/wizard/step-stack.tsx`       | P7-2-2         |
| `src/cli/components/wizard/step-confirm.tsx`     | P7-2-2         |
| `src/cli/components/wizard/selection-header.tsx` | P7-2-2         |

**Files to Delete:**

| File                                             | Task   |
| ------------------------------------------------ | ------ |
| `src/cli/stores/wizard-store.ts`                 | P7-2-3 |
| `src/cli/components/wizard/step-category.tsx`    | P7-2-2 |
| `src/cli/components/wizard/step-subcategory.tsx` | P7-2-2 |
