---
type: anti-pattern
severity: low
affected_files:
  - e2e/interactive/smoke.e2e.test.ts
  - e2e/smoke/pom-framework.e2e.test.ts
  - e2e/lifecycle/global-scope-lifecycle.e2e.test.ts
standards_docs:
  - docs/standards/e2e/test-structure.md
date: 2026-03-21
reporting_agent: cli-tester
category: testing
domain: e2e
root_cause: enforcement-gap
---

## What Was Wrong

- `smoke.e2e.test.ts`: `projectDir` created in `beforeAll` but never cleaned up in `afterAll`
- `pom-framework.e2e.test.ts`: Source and project temp dirs leaked (only wizard session cleaned up)
- `global-scope-lifecycle.e2e.test.ts`: `exitCode` destructured but never asserted; unused `sourceDir` parameter; `as any` cast

## Fix Applied

Added `afterAll` cleanup to smoke test, added temp dir cleanup to POM smoke test, added exit code assertions, removed unused parameter, removed `as any` cast.

## Proposed Standard

Existing standards in `test-structure.md` cover cleanup conventions. This is an enforcement gap -- the rules exist but were not followed in newer test files. No doc change needed.
