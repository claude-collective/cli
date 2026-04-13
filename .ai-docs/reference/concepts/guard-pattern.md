---
scope: reference
area: concepts
keywords:
  [guard, toast, isInstalledGlobal, toggleTechnology, toggleAgent, toggleSkillScope, eject-guard]
related:
  - reference/concepts/scope-system.md
  - reference/concepts/tombstone-pattern.md
  - reference/wizard/state-transitions.md
  - reference/wizard/flow.md
last_validated: 2026-04-13
---

# Guard Pattern

**Last Updated:** 2026-04-13
**Last Validated:** 2026-04-13

> **Cross-cutting concept.** Consolidates guard documentation from: `wizard-flow.md` (Global-Item Guards, Scope Toggle Eject Guard), `state-transitions.md` (guard tables in selection actions).

## Overview

The wizard store implements guards on several actions that prevent invalid state transitions. When a guard is triggered, the action returns a toast message instead of modifying state. Guards protect globally-installed items from project-scope edits and prevent conflicting configurations.

## Guard Preconditions

All global-item guards share these preconditions:

| Field                      | Required Value | Purpose                                        |
| -------------------------- | -------------- | ---------------------------------------------- |
| `isEditingFromGlobalScope` | `false`        | Global-scope edit bypasses all guards          |
| `isInitMode`               | `false`        | Init wizard (first-time setup) bypasses guards |

When either field is `true`, the guards are not active.

## Guard Registry

### 1. Global Skill Toggle Guard (`toggleTechnology`)

**File:** `wizard-store.ts` (in `toggleTechnology` action)

**Trigger:** Toggling a skill in the build step

**Guard condition:** Skill is found in `installedSkillConfigs` with `scope === "global"` and `!excluded`

**Behavior:** Shows toast: "Global skills cannot be changed from project scope"

**Additional:** In exclusive (radio) categories, also blocks selecting a new skill when the current selection is globally installed

### 2. Global Agent Toggle Guard (`toggleAgent`)

**File:** `wizard-store.ts` (in `toggleAgent` action)

**Trigger:** Toggling an agent in the agents step

**Guard condition:** Agent is found in `installedAgentConfigs` with `scope === "global"` and `!excluded`, AND `isEditingFromGlobalScope === false` AND `isInitMode === false`

**Behavior:** Shows toast: "Global agents cannot be changed from project scope"

### 3. Skill Scope Toggle Guard (`toggleSkillScope`)

**File:** `wizard-store.ts` (in `toggleSkillScope` action)

**Trigger:** Pressing `S` on a focused skill in the build step

**Guard conditions:**

- No-op if `isEditingFromGlobalScope` is true (S key disabled entirely)
- Blocks project-eject to global-eject when a non-excluded global eject entry already exists in `installedSkillConfigs`

**Undo path:** If the current `skillConfigs` already contains an excluded tombstone for that skill ID, the guard allows the toggle. This permits undoing a previous scope change.

**Tombstone management:**

- Global-to-project: adds excluded tombstone for global entry
- Project-to-global: removes excluded tombstone

### 4. Agent Scope Toggle Guard (`toggleAgentScope`)

**Trigger:** Pressing `S` on a focused agent in the agents step

**Guard condition:** No-op if `isEditingFromGlobalScope` is true

**Tombstone management:** Same as skill scope toggle -- moving global-installed to project adds excluded global entry; moving back removes it.

### 5. Filter Incompatible Guard (`toggleFilterIncompatible`)

**File:** `wizard-store.ts`

**Trigger:** Pressing `F` in the build step to enable incompatible skill filtering

**Guard:** When enabling, skips skills with `excluded` flag when finding incompatible web skills. This protects tombstoned globals from being inadvertently cleared by the filter operation.

## Guard vs Toast Flow

```
User action (e.g., SPACE on a skill)
  |
  v
Store action called (e.g., toggleTechnology)
  |
  v
Guard check: is item globally installed?
  |
  +-- YES: Is isEditingFromGlobalScope or isInitMode true?
  |   |
  |   +-- YES: Allow the action (guard bypassed)
  |   +-- NO:  Set toastMessage, return early (no state change)
  |
  +-- NO: Proceed with normal action logic
```

## Toast Message Display

Toast messages are stored in `toastMessage: string | null` state field. The `toast.tsx` component renders them as a styled text block with padding. Toast is auto-cleared after a timeout.

## Summary Table

| Guard               | Action                       | When Blocked                                                    | Toast Text                                           |
| ------------------- | ---------------------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Global skill toggle | `toggleTechnology()`         | Global skill, project-scope edit, not init mode                 | "Global skills cannot be changed from project scope" |
| Global agent toggle | `toggleAgent()`              | Global agent, project-scope edit, not init mode                 | "Global agents cannot be changed from project scope" |
| Skill scope eject   | `toggleSkillScope()`         | Project eject -> global when global eject exists (no tombstone) | "Already exists as ejected skill at global scope"    |
| Agent scope         | `toggleAgentScope()`         | `isEditingFromGlobalScope` is true                              | No-op (silent)                                       |
| Filter incompatible | `toggleFilterIncompatible()` | N/A (skips excluded items silently)                             | N/A (no toast, just protects tombstones)             |
