---
type: anti-pattern
severity: medium
affected_files:
  - src/cli/lib/wizard/build-step-logic.test.ts
standards_docs:
  - CLAUDE.md
date: 2026-03-25
reporting_agent: cli-reviewer
category: testing
domain: cli
root_cause: enforcement-gap
---

## What Was Wrong

`build-step-logic.test.ts` constructs mock skills inline with `createMockSkill()` overrides instead of using pre-built constants from `mock-data/mock-skills.ts`. This violates the CLAUDE.md rule: "NEVER construct test data inline — use factories from `__tests__/helpers.ts` and fixtures from `create-test-source.ts`. If a factory doesn't exist, create one."

Seven inline mock constructions found:

- `createMockSkill("web-framework-react", { conflictsWith: [...] })` (lines 600, 655)
- `createMockSkill("web-framework-vue-composition-api", { conflictsWith: [...] })` (line 603)
- `createMockSkill("web-state-zustand", { conflictsWith: [...] })` (line 627)
- `createMockSkill("web-state-pinia", { conflictsWith: [...] })` (line 630)
- `createMockSkill("web-framework-react", { requires: [...] })` (lines 437, 469 — duplicated)
- `createMockSkill("web-state-zustand", { compatibleWith: [] })` (line 392)
- `createMockSkill("web-framework-react", { isRecommended: true, ... })` (line 655)

This also connects to a broader principle: inline mock constructions require the reader to mentally simulate the factory call to understand the test setup. Named constants like `REACT_CONFLICTS_VUE` make the intent clear from the name alone.

**Root cause of enforcement gap:** The sub-agents that wrote the D-132 tests included the CLAUDE.md findings instruction but violated the inline test data rule in their own output. The agents check for anti-patterns in code they _read_ but not in code they _write_.

## Fix Applied

Extracted all inline mock skills to named constants in `src/cli/lib/__tests__/mock-data/mock-skills.ts`. Updated `build-step-logic.test.ts` to import and use the constants.

## Proposed Standard

The existing CLAUDE.md rule is sufficient. The enforcement gap is in sub-agent self-review — agents should verify their own output against CLAUDE.md rules before completing, not just check existing code. Consider adding a self-review step to the cli-developer agent's workflow.
