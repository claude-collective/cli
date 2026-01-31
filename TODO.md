# Claude Collective CLI - Implementation Plan

## Executive Summary

**Current State:** 1160 tests passing. Phase 1-3 Complete. Phase 4 Tier 1-2 Complete.

**Next Steps:**

1. Complete R1 research (oclif + Ink ecosystem)
2. Plan oclif + Ink migration
3. Address remaining technical debt (P4-16 through P4-18)

For completed tasks, see [TODO-completed.md](./TODO-completed.md).

---

## High Priority Research

### R1: oclif + Ink Ecosystem Libraries (HIGHEST PRIORITY)

**Question:** What complementary libraries reduce complexity when building with oclif + Ink?

**Context:** Decision made to migrate to oclif + Ink. Need to identify libraries that reduce boilerplate and increase reusability (similar to Zustand for React).

**Research Areas:**

- State management for CLIs
- Pre-built Ink component libraries
- Plugin architecture patterns
- Testing utilities
- Configuration management (cosmiconfig, etc.)
- Build and distribution

**Output:** [docs/oclif-ink-ecosystem.md](./docs/oclif-ink-ecosystem.md)

**Status:** In Progress

---

### R0: oclif + Ink Framework Evaluation (COMPLETE)

**Decision:** YES - Migrate to oclif + Ink. The benefits (scalability, plugin system, React component model) outweigh migration costs.

**Output:** [docs/oclif-ink-research.md](./docs/oclif-ink-research.md)

---

## Ongoing Reminders

### R1: Commit After Each Task

**ALWAYS** commit changes after completing any task. This will automatically run tests via pre-commit hooks.
Test count should remain at 1160+ and all should pass.

### R2: Write Tests for New Features

After completing a task, ask yourself: "Can tests be written for this new functionality?"
If yes, write tests before committing. Test-driven development is preferred when feasible.

### R3: Move Completed Tasks to Archive

Once your task is done, move it to [TODO-completed.md](./TODO-completed.md). Keep TODO.md lean by archiving all completed tasks immediately.

---

## Pending Tasks

### Phase 4.5: Technical Debt

| Task ID | Task                                | Complexity | Dependencies | Status  |
| ------- | ----------------------------------- | ---------- | ------------ | ------- |
| P4-16   | Test: All tests use shared fixtures | S          | P4-15        | Pending |

### Phase 4.6: UX Improvements

| Task ID | Task                                                  | Complexity | Dependencies | Status  |
| ------- | ----------------------------------------------------- | ---------- | ------------ | ------- |
| P4-17   | Feature: `cc new skill/agent` supports multiple items | M          | P4-11        | Pending |
| P4-18   | Test: Multiple skill/agent creation works             | S          | P4-17        | Pending |

### Deferred Tasks

| Task ID | Task                                 | Complexity | Notes                            |
| ------- | ------------------------------------ | ---------- | -------------------------------- |
| P3-14   | Individual skill plugin installation | L          | Plugin mode only supports stacks |

---

## Phase 5: oclif + Ink Migration (PLANNING)

**Goal:** Migrate from Commander.js + @clack/prompts to oclif + Ink for better scalability and maintainability.

**Prerequisites:**

- Complete R1 research (ecosystem libraries)
- Document current command structure
- Create migration strategy

| Task ID | Task                                         | Complexity | Status      |
| ------- | -------------------------------------------- | ---------- | ----------- |
| P5-01   | Research: oclif + Ink ecosystem libraries    | M          | In Progress |
| P5-02   | Design: Migration strategy and phases        | L          | Pending     |
| P5-03   | Scaffold: New oclif project structure        | M          | Pending     |
| P5-04   | Migrate: Core infrastructure (config, utils) | L          | Pending     |
| P5-05   | Migrate: Commands one-by-one                 | XL         | Pending     |
| P5-06   | Test: Verify all functionality preserved     | L          | Pending     |

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
