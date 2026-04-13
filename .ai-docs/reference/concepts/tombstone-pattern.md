---
scope: reference
area: concepts
keywords: [tombstone, excluded, applySkillRemoval, applyAgentToggle, scope-toggle, config-writer]
related:
  - reference/concepts/scope-system.md
  - reference/concepts/guard-pattern.md
  - reference/wizard/state-transitions.md
  - reference/config/configuration.md
  - reference/architecture/overview.md
last_validated: 2026-04-13
---

# Excluded Tombstone Pattern

**Last Updated:** 2026-04-13
**Last Validated:** 2026-04-13

> **Cross-cutting concept.** Consolidates tombstone documentation from: `architecture-overview.md` (Section 12), `state-transitions.md` (applySkillRemoval, applyAgentToggle), `wizard-flow.md` (Scope Toggle Eject Guard), `configuration.md` (excluded entries in config writer).

## Overview

When a project needs to override (disable) a globally-installed skill or agent without removing it from the global config, it uses an **excluded tombstone**: a config entry with `excluded: true`.

## Type Definitions

- `SkillConfig.excluded?: boolean` in `src/cli/types/config.ts`
- `AgentScopeConfig.excluded?: boolean` in `src/cli/types/config.ts`

## How Tombstones Are Created

### Skill Removal (`applySkillRemoval()`)

**File:** `wizard-store.ts` (function `applySkillRemoval()`)

When deselecting a skill:

- **Project-scoped skills:** Simply removed from `skillConfigs`
- **Globally-installed skills:** Instead of removing the config entry, sets `excluded: true` -- keeps the entry so the global config stays correct for other projects

### Agent Toggle Off (`applyAgentToggle()`)

**File:** `wizard-store.ts` (function `applyAgentToggle()`)

When toggling off an agent:

- **Not globally installed:** Simply added/removed from `selectedAgents` and `agentConfigs`
- **Globally installed:** Marks the config entry as `excluded: true` and keeps the agent in `selectedAgents` (preserves global config entry)

### Scope Toggle (`toggleSkillScope()`)

**File:** `wizard-store.ts` (function `toggleSkillScope()`)

When moving a globally-installed skill from global to project scope:

- Adds an excluded tombstone for the global entry
- Creates a new project-scoped entry for the same skill

When moving back to global:

- Removes the excluded global tombstone (restores the global entry)

The same tombstone management applies to `toggleAgentScope()`.

## How Tombstones Are Consumed

### Compilation

Tombstoned entries (`excluded: true`) are skipped during agent compilation -- they are not compiled into agent prompts.

### Restoration

Re-selecting a tombstoned skill/agent clears the `excluded` flag (restores it to active state).

### Scope Toggle Undo

The `toggleSkillScope()` action checks for existing excluded entries to allow undo of scope overrides. When an excluded tombstone exists for a skill, the scope toggle guard allows the toggle (undo path), even when a non-excluded global entry normally blocks the operation.

### Filter Incompatible

`toggleFilterIncompatible()` skips skills with `excluded` flag when finding incompatible web skills -- this protects tombstoned globals from being inadvertently cleared.

## Config Writer Handling

In `generateProjectConfigWithInlinedGlobal()` (`config-writer.ts`):

- Excluded global entries (tombstones) replace their active global counterparts in the global section
- The active project entry appears separately in the project section
- Both are preserved in the snapshot (no deduplication)
- Global entries appear under a `// global` comment, project entries under `// project`

## UI Indicators

When a tombstone exists alongside an active entry of a different scope, dual-scope badges are shown:

- **Build step** (`CategoryGrid`): `CategoryOption.secondaryScope` renders a second `[G]`/`[P]` badge
- **Agents step** (`StepAgents`): Computes `secondaryScope` from excluded entries with different scope

> **See also:** [concepts/scope-system.md](./scope-system.md) for full scope system documentation.

## State Transition Summary

| Operation              | Project-scoped item | Globally-installed item           |
| ---------------------- | ------------------- | --------------------------------- |
| Deselect skill         | Remove from configs | Set `excluded: true` (tombstone)  |
| Toggle agent off       | Remove normally     | Set `excluded: true` (tombstone)  |
| Scope: global->project | N/A                 | Add excluded global + new project |
| Scope: project->global | N/A                 | Remove excluded global (restore)  |
| Re-select tombstoned   | N/A                 | Clear `excluded` flag             |
