---
type: anti-pattern
severity: high
affected_files:
  - e2e/commands/eject.e2e.test.ts
  - e2e/commands/uninstall.e2e.test.ts
  - e2e/commands/uninstall-preservation.e2e.test.ts
  - e2e/commands/plugin-uninstall-core.e2e.test.ts
  - e2e/lifecycle/dual-scope-edit-scope-changes.e2e.test.ts
  - e2e/lifecycle/source-switching-per-skill.e2e.test.ts
  - e2e/lifecycle/source-switching-modes.e2e.test.ts
  - e2e/lifecycle/scope-aware-local-copy.e2e.test.ts
standards_docs:
  - .ai-docs/standards/e2e/anti-patterns.md
  - .ai-docs/standards/e2e/test-data.md
date: 2026-03-21
reporting_agent: cli-tester
category: dry
domain: e2e
root_cause: missing-rule
---

## What Was Wrong

Multiple E2E test files defined their own local versions of helper functions that already existed (or should have existed) in shared locations:

- `skillsPath()` duplicated in 4 files -- already exported as `agentsPath()` pattern in `test-utils.ts`
- `addForkedFromMetadata()` duplicated in 2 files
- `injectMarketplaceIntoConfig()` duplicated in 3 lifecycle files
- `dual-scope-edit-scope-changes.e2e.test.ts` duplicated 4 helpers from `dual-scope-helpers.ts` instead of importing

## Fix Applied

Extracted all helpers to shared locations (`test-utils.ts`, `dual-scope-helpers.ts`). Updated 12 consuming files to import instead of defining locally.

## Proposed Standard

Added to `.ai-docs/standards/e2e/anti-patterns.md`: "Always check existing shared helpers before writing local ones" -- grep `test-utils.ts`, `fixtures/`, and `constants.ts` before defining any helper in a test file. Added decision tree for where new helpers belong.
