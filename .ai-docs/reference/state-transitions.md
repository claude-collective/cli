# State Transitions

**Last Updated:** 2026-04-02

## Overview

**Purpose:** Complete wizard state machine -- all step transitions, action side effects, and reset behaviors.

**Source of truth:** `src/cli/stores/wizard-store.ts`

**Cross-references:**

- `store-map.md` -- WizardState shape and consumers
- `features/wizard-flow.md` -- Component architecture and UI details
- `component-patterns.md` -- Hotkey registry and Ink patterns

## WizardStep Union

**File:** `src/cli/stores/wizard-store.ts:172-178`

```typescript
type WizardStep = "stack" | "domains" | "build" | "sources" | "agents" | "confirm";
```

**Canonical order** (from `WIZARD_STEPS` at `src/cli/components/wizard/wizard-tabs.tsx:41-48`):

| Index | Step        | Label   | Purpose                                           |
| ----- | ----------- | ------- | ------------------------------------------------- |
| 0     | `"stack"`   | Stack   | Select pre-built stack or "Start from scratch"    |
| 1     | `"domains"` | Domains | Select domains to configure (web, api, cli, etc.) |
| 2     | `"build"`   | Skills  | Per-domain skill selection via CategoryGrid       |
| 3     | `"sources"` | Sources | Choose source per skill (eject, marketplace)      |
| 4     | `"agents"`  | Agents  | Select agents to compile                          |
| 5     | `"confirm"` | Confirm | Review and confirm                                |

## Step Sequence Diagram

```
                                +-----------+
                                |   stack   |  (initial step)
                                +-----+-----+
                                      |
                      +----- ENTER ----+---- ENTER ------+
                      |  ("scratch")   |  (stack item)   |
                      v                v                  |
              selectStack(null)   selectStack(id)         |
              setApproach("scratch") setStackAction("customize")
              toggleDomain x3     populateFromSkillIds()  |
                                  setApproach("stack")    |
                      |                |                  |
                      +-------+--------+                  |
                              v                          |
                        +-----------+                    |
                        |  domains  |                    |
                        +-----+-----+                    |
                              |                          |
                         ENTER (continue)                |
                              |                          |
                              v                          |
                        +-----------+                    |
                        |   build   |                    |
                        +-----+-----+                    |
                              |                          |
                    +---------+---------+                 |
                    | nextDomain()      |                 |
                    | returns true?     |                 |
                    | -> stay in build  |                 |
                    | returns false?    |                 |
                    | -> setStep("sources")              |
                    +---------+---------+                 |
                              v                          |
                        +-----------+                    |
                        |  sources  |                    |
                        +-----+-----+                    |
                              |                          |
                    ENTER (recommended) or               |
                    ENTER (after customize)               |
                              |                          |
                      preselectAgentsFromDomains()       |
                              |                          |
                              v                          |
                        +-----------+                    |
                        |  agents   |                    |
                        +-----+-----+                    |
                              |                          |
                         ENTER (continue)                |
                              v                          |
                        +-----------+                    |
                        |  confirm  |<-------------------+
                        +-----------+   (A hotkey: "accept defaults"
                                         skips build/sources/agents)
```

**Backward navigation:** Every step uses `goBack()` (ESC key), which pops from `history[]` to return to the previous step.

## Forward Navigation Transitions

| From      | To        | Trigger                                                  | Component/File                                   |
| --------- | --------- | -------------------------------------------------------- | ------------------------------------------------ |
| `stack`   | `domains` | ENTER on "Start from scratch"                            | `stack-selection.tsx:160`                        |
| `stack`   | `domains` | ENTER on a stack item                                    | `stack-selection.tsx:169`                        |
| `domains` | `build`   | ENTER (continue, requires >= 1 domain selected)          | `domain-selection.tsx:53`                        |
| `build`   | `build`   | ENTER when `nextDomain()` returns true (more domains)    | `use-build-step-props.ts:36`                     |
| `build`   | `sources` | ENTER when `nextDomain()` returns false (last domain)    | `use-build-step-props.ts:37`                     |
| `build`   | `confirm` | `A` hotkey (accept defaults, requires `selectedStackId`) | `wizard.tsx:147-148`                             |
| `sources` | `agents`  | ENTER on "Use recommended" or ENTER in customize view    | `wizard.tsx:240-245` (via `onContinue` callback) |
| `agents`  | `confirm` | ENTER (continue)                                         | `step-agents.tsx:216`                            |

## Backward Navigation Transitions

| From      | To (via `goBack()`) | Trigger                                                  | Additional Side Effects                                    |
| --------- | ------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| `domains` | `stack`             | ESC                                                      | `setApproach(null)`, `selectStack(null)` before `goBack()` |
| `build`   | `build`             | ESC when `prevDomain()` returns true                     | Decrements `currentDomainIndex`                            |
| `build`   | `domains`           | ESC when `prevDomain()` returns false                    | Pops from `history`                                        |
| `sources` | `build`             | ESC (in choice view or non-choice mode)                  | Pops from `history`                                        |
| `sources` | `sources`           | ESC in customize view (if `FEATURE_FLAGS.SOURCE_CHOICE`) | Returns to choice view, no step change                     |
| `agents`  | `sources`           | ESC                                                      | Pops from `history`                                        |
| `confirm` | `agents`            | ESC                                                      | Pops from `history`                                        |

**`goBack()` implementation** (`wizard-store.ts:898-906`): Pops from `history[]`, sets `step` to the popped value. Falls back to `"stack"` if history is empty.

## Accept-Defaults Shortcut

When a stack is selected and the user presses `A` during the build step:

1. `setStackAction("defaults")` -- marks the stack for as-is use
2. `setStep("confirm")` -- jumps directly to confirmation, skipping sources and agents

**Condition:** `store.step === "build" && store.selectedStackId` (checked at `wizard.tsx:142-146`)

**`getStepProgress()` response:** marks `build`, `sources`, `agents` as `skipped` (not `completed`)

## Edit Mode Initialization

**File:** `src/cli/components/hooks/use-wizard-initialization.ts`

When the wizard opens in edit mode (from `agentsinc edit`):

1. `populateFromSkillIds(installedSkillIds, installedSkillConfigs)` -- restores skill selections
2. `setState({ approach: "scratch" })` -- sets approach without a stack
3. Walks through steps via `setStep()` to build `history` naturally (e.g., `initialStep="build"` calls `setStep("domains")` then `setStep("build")`, producing `history=["stack", "domains"]`)
4. Overrides `selectedDomains` if `initialDomains` provided
5. Overrides `selectedAgents` and `agentConfigs` if `initialAgents` provided
6. Sets `lockedSkillIds`, `lockedAgentNames`, `isEditingFromGlobalScope` if provided

---

## Action -> State Change Table

### Navigation Actions

| Action                     | State Modified       | Side Effects                                                                          |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| `setStep(step)`            | `step`, `history`    | Pushes current `step` onto `history`, sets new `step`                                 |
| `goBack()`                 | `step`, `history`    | Pops last entry from `history`, sets `step` to that value (or `"stack"` if empty)     |
| `nextDomain()`             | `currentDomainIndex` | Increments by 1 if not at last domain. Returns `true` if advanced, `false` if at end. |
| `prevDomain()`             | `currentDomainIndex` | Decrements by 1 if not at first domain. Returns `true` if moved, `false` if at start. |
| `setCurrentDomainIndex(n)` | `currentDomainIndex` | Sets directly if valid (0 <= n < selectedDomains.length), no-op otherwise             |

### Approach/Stack Actions

| Action                   | State Modified                                                                                                                                                                           | Side Effects                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `setApproach(approach)`  | `approach`                                                                                                                                                                               | None                               |
| `selectStack(stackId)`   | `selectedStackId`, `domainSelections`, `_stackDomainSelections`, `selectedDomains`, `skillConfigs`, `selectedAgents`, `agentConfigs`, `boundSkills`, `currentDomainIndex`, `stackAction` | **Full reset** -- see Reset Matrix |
| `setStackAction(action)` | `stackAction`                                                                                                                                                                            | None                               |

### Selection Actions

| Action                                           | State Modified                                        | Side Effects                                                                                                                                                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toggleDomain(domain)`                           | `selectedDomains`, `domainSelections`, `skillConfigs` | **Remove:** drops domain selections + their skill configs. **Add:** restores from `_stackDomainSelections` snapshot if available, creates default skill configs for restored skills.                                                    |
| `toggleTechnology(domain, cat, tech, exclusive)` | `domainSelections`, `skillConfigs`                    | Respects `lockedSkillIds` (no-op if locked). Exclusive mode: replaces category selection (rejects if would deselect a locked skill). Syncs `skillConfigs` -- adds `createDefaultSkillConfig()` for new, removes configs for deselected. |
| `toggleAgent(agent)`                             | `selectedAgents`, `agentConfigs`                      | Respects `lockedAgentNames` (no-op if locked). Adds agent with scope `"global"`. Removes both from `selectedAgents` and `agentConfigs`.                                                                                                 |
| `preselectAgentsFromDomains()`                   | `selectedAgents`, `agentConfigs`                      | Replaces (not merges) with agents from `DOMAIN_AGENTS` map for each selected domain. All scoped as `"global"`.                                                                                                                          |

### Skill/Agent Config Actions

| Action                         | State Modified   | Side Effects                                                                                       |
| ------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------- |
| `toggleSkillScope(skillId)`    | `skillConfigs`   | Toggles `scope` between `"project"` and `"global"`. No-op if `isEditingFromGlobalScope` or locked. |
| `setSkillSource(skillId, src)` | `skillConfigs`   | Updates `source` field for matching skill config entry.                                            |
| `toggleAgentScope(agentName)`  | `agentConfigs`   | Toggles `scope` between `"project"` and `"global"`. No-op if `isEditingFromGlobalScope` or locked. |
| `setFocusedSkillId(id)`        | `focusedSkillId` | Sets or clears the focused skill (for `S` hotkey scope toggle in build step).                      |
| `setFocusedAgentId(id)`        | `focusedAgentId` | Sets or clears the focused agent (for `S` hotkey scope toggle in agents step).                     |

### Source Management Actions

| Action                             | State Modified     | Side Effects                                                                                        |
| ---------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------- |
| `setSourceSelection(skillId, src)` | `skillConfigs`     | Updates `source` field. No-op with warning if `skillId` or `src` is empty.                          |
| `setCustomizeSources(customize)`   | `customizeSources` | None                                                                                                |
| `setEnabledSources(sources)`       | `enabledSources`   | Filters out entries with empty-string keys (with warning).                                          |
| `setAllSourcesEject()`             | `skillConfigs`     | Sets `source: "eject"` for all skill configs.                                                       |
| `setAllSourcesPlugin()`            | `skillConfigs`     | Sets `source` to first non-eject `availableSource` per skill. Falls back to current source if none. |
| `bindSkill(skill)`                 | `boundSkills`      | Appends to array. Silently skips (with warning) if same `id + sourceUrl` already exists.            |

### UI Toggle Actions

| Action                       | State Modified                                           | Side Effects                                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toggleShowLabels()`         | `showLabels`                                             | Boolean toggle                                                                                                                                                       |
| `toggleFilterIncompatible()` | `filterIncompatible`, `domainSelections`, `skillConfigs` | When enabling: finds framework-incompatible web skills (respecting locked), removes them from selections and skill configs. When disabling: just sets flag to false. |
| `toggleSettings()`           | `showSettings`                                           | Boolean toggle (source management overlay)                                                                                                                           |
| `toggleInfo()`               | `showInfo`                                               | Boolean toggle (selected skills/agents overlay)                                                                                                                      |

### Population Actions

| Action                                          | State Modified                                                                  | Side Effects                                                                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `populateFromStack(stack)`                      | `domainSelections`, `_stackDomainSelections`, `selectedDomains`, `skillConfigs` | Iterates stack agents' skill assignments, builds domain selections, snapshots to `_stackDomainSelections`, creates default skill configs. Sorts domains canonically.                                      |
| `populateFromSkillIds(skillIds, savedConfigs?)` | `domainSelections`, `_stackDomainSelections`, `selectedDomains`, `skillConfigs` | Resolves each skill's category/domain via `resolveSkillForPopulation()`. Warns for unresolvable skills. Restores `scope`/`source` from `savedConfigs` if provided. Snapshots to `_stackDomainSelections`. |

### Reset Action

| Action    | State Modified | Side Effects                                                                          |
| --------- | -------------- | ------------------------------------------------------------------------------------- |
| `reset()` | All fields     | Restores every state field to `createInitialState()` values. See Initial State below. |

---

## Reset Matrix

Which actions trigger which resets:

| Action                         | `domainSelections` | `_stackDomainSelections` | `selectedDomains` | `skillConfigs` | `selectedAgents` | `agentConfigs` | `boundSkills` | `currentDomainIndex` | `stackAction` |
| ------------------------------ | :----------------: | :----------------------: | :---------------: | :------------: | :--------------: | :------------: | :-----------: | :------------------: | :-----------: |
| `selectStack(stackId)`         |       RESET        |          RESET           |       RESET       |     RESET      |      RESET       |     RESET      |     RESET     |        RESET         |     RESET     |
| `reset()`                      |       RESET        |          RESET           |       RESET       |     RESET      |      RESET       |     RESET      |     RESET     |        RESET         |     RESET     |
| `toggleDomain(off)`            |      partial       |            --            |      partial      |    partial     |        --        |       --       |      --       |          --          |      --       |
| `toggleDomain(on)`             |      partial       |            --            |      partial      |    partial     |        --        |       --       |      --       |          --          |      --       |
| `toggleTechnology()`           |      partial       |            --            |        --         |    partial     |        --        |       --       |      --       |          --          |      --       |
| `toggleFilterIncompatible()`   |      partial       |            --            |        --         |    partial     |        --        |       --       |      --       |          --          |      --       |
| `populateFromStack()`          |        SET         |           SET            |        SET        |      SET       |        --        |       --       |      --       |          --          |      --       |
| `populateFromSkillIds()`       |        SET         |           SET            |        SET        |      SET       |        --        |       --       |      --       |          --          |      --       |
| `preselectAgentsFromDomains()` |         --         |            --            |        --         |       --       |       SET        |      SET       |      --       |          --          |      --       |

**Legend:** RESET = cleared to initial value. SET = replaced with new computed value. partial = specific entries updated (not full clear). `--` = not modified.

### selectStack() Reset Detail

**File:** `wizard-store.ts:571`

When a new stack is selected (or deselected via `null`), the following fields are reset to empty/initial values:

```
selectedStackId = stackId (the new value)
domainSelections = {}
_stackDomainSelections = null
selectedDomains = []
skillConfigs = []
selectedAgents = []
agentConfigs = []
boundSkills = []
currentDomainIndex = 0
stackAction = null
```

This is the most aggressive reset in the store -- it clears all downstream selections to prevent stale data from a previously selected stack.

### toggleDomain() Cascading Effects

**Remove a domain:**

1. Removes domain key from `domainSelections`
2. Collects all skill IDs in that domain's selections
3. Removes those skill IDs from `skillConfigs`
4. Removes domain from `selectedDomains`

**Add a domain:**

1. Checks `_stackDomainSelections` for a snapshot of that domain
2. If snapshot exists: restores selections via `structuredClone`, creates default skill configs for restored skills
3. If no snapshot: just adds domain to `selectedDomains` (empty selections)
4. Sorts `selectedDomains` canonically

---

## Derived State (Computed Selectors)

| Selector                             | Computes From                                                         | Returns                                                        |
| ------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `getAllSelectedTechnologies()`       | `domainSelections` (all domains, all categories)                      | `SkillId[]` -- flat array of all selected skill IDs            |
| `getSelectedTechnologiesPerDomain()` | `domainSelections`                                                    | `Partial<Record<Domain, SkillId[]>>`                           |
| `getCurrentDomain()`                 | `selectedDomains`, `currentDomainIndex`                               | `Domain \| null`                                               |
| `getTechnologyCount()`               | Calls `getAllSelectedTechnologies().length`                           | `number`                                                       |
| `getStepProgress()`                  | `step`, `approach`, `selectedStackId`, `stackAction`                  | `{ completedSteps: WizardStep[], skippedSteps: WizardStep[] }` |
| `canGoToNextDomain()`                | `currentDomainIndex`, `selectedDomains.length`                        | `boolean`                                                      |
| `canGoToPreviousDomain()`            | `currentDomainIndex`                                                  | `boolean`                                                      |
| `deriveInstallMode()`                | `skillConfigs` (source values)                                        | `InstallMode` (`"eject" \| "plugin" \| "mixed"`)               |
| `buildSourceRows()`                  | `getAllSelectedTechnologies()`, `skillConfigs`, `boundSkills`, matrix | `{ skillId, options: SourceOption[] }[]`                       |

### getStepProgress() Logic

**File:** `wizard-store.ts:1001`

| Current Step         | Completed Steps                                  | Skipped Steps                |
| -------------------- | ------------------------------------------------ | ---------------------------- |
| `stack`              | (none)                                           | (none)                       |
| `domains`            | `stack`                                          | (none)                       |
| `build`              | `stack`, `domains`                               | (none)                       |
| `sources`            | `stack`, `domains`, `build`                      | (none)                       |
| `agents`             | `stack`, `domains`, `build`, `sources`           | (none)                       |
| `confirm`            | `stack`, `domains`, `build`, `sources`, `agents` | (none)                       |
| `confirm` (defaults) | `stack`, `domains`                               | `build`, `sources`, `agents` |

The "defaults" shortcut case: `approach === "stack" && selectedStackId && stackAction === "defaults"` marks build/sources/agents as `skipped` instead of `completed`.

---

## Hotkey -> Action Mapping

**Hotkey registry:** `src/cli/components/wizard/hotkeys.ts`

### Global Hotkeys (wizard.tsx)

| Hotkey | Key | Active When                              | Action                           | Store Method                                           |
| ------ | --- | ---------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| `A`    | `a` | `step === "build"` + stack selected      | Accept defaults, jump to confirm | `setStackAction("defaults")` then `setStep("confirm")` |
| `S`    | `s` | `step === "build"`                       | Toggle focused skill scope       | `toggleSkillScope(focusedSkillId)`                     |
| `S`    | `s` | `step === "agents"`                      | Toggle focused agent scope       | `toggleAgentScope(focusedAgentId)`                     |
| `S`    | `s` | `step === "sources"`                     | Toggle settings overlay          | `toggleSettings()`                                     |
| `I`    | `i` | Any step (if `FEATURE_FLAGS.INFO_PANEL`) | Toggle info overlay              | `toggleInfo()`                                         |

### Build Step Hotkeys (use-category-grid-input.ts)

| Hotkey | Key | Action                                    | Store Method                 |
| ------ | --- | ----------------------------------------- | ---------------------------- |
| `D`    | `d` | Toggle compatibility labels on skill tags | `toggleShowLabels()`         |
| `F`    | `f` | Filter incompatible skills                | `toggleFilterIncompatible()` |

### Sources Step Hotkeys (step-sources.tsx, customize view)

| Hotkey | Key | Action                               | Store Method            |
| ------ | --- | ------------------------------------ | ----------------------- |
| `L`    | `l` | Set all skill sources to "eject"     | `setAllSourcesEject()`  |
| `P`    | `p` | Set all skill sources to marketplace | `setAllSourcesPlugin()` |

### Settings Step Hotkey (step-settings.tsx)

| Hotkey | Key | Action           | Store Method                |
| ------ | --- | ---------------- | --------------------------- |
| `A`    | `a` | Add a new source | (settings-specific handler) |

### Overlay Blocking

When `showSettings === true`, all input is blocked except `S` (to close settings). When `showInfo === true`, all input is blocked except `ESC` and `I` (to close info).

---

## Initial State

**File:** `wizard-store.ts:530` (`createInitialState()`)

| Field                      | Initial Value |
| -------------------------- | ------------- |
| `step`                     | `"stack"`     |
| `approach`                 | `null`        |
| `selectedStackId`          | `null`        |
| `stackAction`              | `null`        |
| `selectedDomains`          | `[]`          |
| `currentDomainIndex`       | `0`           |
| `domainSelections`         | `{}`          |
| `_stackDomainSelections`   | `null`        |
| `showLabels`               | `false`       |
| `filterIncompatible`       | `false`       |
| `skillConfigs`             | `[]`          |
| `focusedSkillId`           | `null`        |
| `customizeSources`         | `false`       |
| `showSettings`             | `false`       |
| `showInfo`                 | `false`       |
| `enabledSources`           | `{}`          |
| `selectedAgents`           | `[]`          |
| `agentConfigs`             | `[]`          |
| `focusedAgentId`           | `null`        |
| `boundSkills`              | `[]`          |
| `installedSkillConfigs`    | `null`        |
| `installedAgentConfigs`    | `null`        |
| `lockedSkillIds`           | `[]`          |
| `lockedAgentNames`         | `[]`          |
| `isEditingFromGlobalScope` | `false`       |
| `history`                  | `[]`          |

---

## DOMAIN_AGENTS Preselection Map

**File:** `wizard-store.ts:93-104`

| Domain | Preselected Agents                                                                            |
| ------ | --------------------------------------------------------------------------------------------- |
| `web`  | `web-developer`, `web-reviewer`, `web-researcher`, `web-tester`, `web-pm`, `web-architecture` |
| `api`  | `api-developer`, `api-reviewer`, `api-researcher`                                             |
| `cli`  | `cli-developer`, `cli-tester`, `cli-reviewer`                                                 |

Other domains (mobile, shared, ai, infra, meta) have no preselected agents.

## Scratch Mode Default Domains

**File:** `src/cli/consts.ts:211`

When "Start from scratch" is selected, these domains are pre-toggled:

```typescript
const DEFAULT_SCRATCH_DOMAINS: readonly Domain[] = ["web", "api", "mobile"];
```

## Locked State Behavior

**Skills:** `lockedSkillIds: SkillId[]` -- set during edit-mode initialization for globally-installed skills in project context.

**Agents:** `lockedAgentNames: AgentName[]` -- same pattern for agents.

**Actions that respect locks:**

| Action                       | Lock Check                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `toggleTechnology()`         | No-op if `technology` in `lockedSkillIds`. Rejects exclusive swap if would deselect locked skill. |
| `toggleSkillScope()`         | No-op if `skillId` in `lockedSkillIds` or `isEditingFromGlobalScope`                              |
| `toggleAgent()`              | No-op if `agent` in `lockedAgentNames`                                                            |
| `toggleAgentScope()`         | No-op if `agentName` in `lockedAgentNames` or `isEditingFromGlobalScope`                          |
| `toggleFilterIncompatible()` | Excludes locked skills when removing incompatible web skills                                      |
