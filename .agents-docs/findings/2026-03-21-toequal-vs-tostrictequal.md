---
type: standard-gap
severity: medium
affected_files:
  - src/cli/lib/wizard/build-step-logic.test.ts
  - e2e/commands/compile-edge-cases.e2e.test.ts
  - e2e/commands/outdated.e2e.test.ts
standards_docs:
  - docs/standards/e2e/assertions.md
  - CLAUDE.md
date: 2026-03-21
reporting_agent: cli-tester
category: testing
domain: e2e
root_cause: missing-rule
---

## What Was Wrong

7 instances of `toEqual` used for object/array comparisons where `toStrictEqual` should be used. `toEqual` silently ignores extra properties and class instance mismatches, masking potential bugs.

## Fix Applied

Replaced all 7 `toEqual` calls with `toStrictEqual` for object comparisons. Left `toEqual` for primitive comparisons where behavior is identical.

## Proposed Standard

Added "Object Equality" section to `docs/standards/e2e/assertions.md`. Added CLAUDE.md ALWAYS rule: "ALWAYS use `toStrictEqual` (not `toEqual`) for object and array comparisons."
