---
type: standard-gap
severity: medium
affected_files:
  - e2e/lifecycle/global-scope-lifecycle.e2e.test.ts
  - e2e/fixtures/dual-scope-helpers.ts
standards_docs:
  - .ai-docs/standards/e2e/test-data.md
date: 2026-03-29
reporting_agent: cli-tester
category: testing
domain: e2e
root_cause: convention-undocumented
---

## What Was Wrong

When refactoring `global-scope-lifecycle.e2e.test.ts` Suite 1 (edit wizard) to use wizard-created dual-scope state via `createDualScopeEnv()` instead of manual file creation via `createDualScopeInstallation()`, the edit wizard's pass-through did not preserve project-scoped `api-framework-hono` at the project directory. The skill was present after the init wizard but disappeared after the edit wizard ran.

This means the edit wizard behaves differently depending on whether the initial state was created manually (with explicit config + skill files) vs. through the init wizard. The manually-created state has a specific 3-skill config, while the wizard-created state has a 10-skill config from the full E2E source. The edit wizard's pass-through may reset scope or fail to re-install project-scoped skills when the config structure differs.

## Fix Applied

Suite 1 was left unchanged (using the manual `createDualScopeInstallation()` helper) since the task explicitly states "Suite 1 (edit wizard) ... do NOT modify." Suites 2-5 were successfully refactored to use wizard-created state via `createDualScopeEnv()` and `createGlobalOnlyEnv()`.

## Proposed Standard

1. **Document in `test-data.md`**: Add a note that edit wizard E2E tests requiring specific file-state preservation may need `ProjectBuilder` or manual setup rather than wizard-based setup, because the edit wizard re-computes and re-installs based on the config structure produced by init.

2. **Investigate**: The edit wizard should preserve project-scoped skills during pass-through regardless of how the initial state was created. This may be a real CLI bug where the edit wizard's scope restoration logic is sensitive to the config structure (e.g., number of skills, stack entries).
