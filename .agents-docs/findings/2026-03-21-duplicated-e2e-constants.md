---
type: anti-pattern
severity: medium
affected_files:
  - e2e/commands/diff.e2e.test.ts
  - e2e/commands/info.e2e.test.ts
  - e2e/commands/outdated.e2e.test.ts
  - e2e/commands/validate.e2e.test.ts
  - e2e/commands/new-marketplace.e2e.test.ts
  - e2e/commands/new-skill.e2e.test.ts
  - e2e/interactive/build-stack.e2e.test.ts
  - e2e/interactive/edit-wizard-local.e2e.test.ts
  - e2e/interactive/real-marketplace.e2e.test.ts
  - e2e/lifecycle/source-switching-per-skill.e2e.test.ts
standards_docs:
  - docs/standards/e2e/anti-patterns.md
  - docs/standards/e2e/README.md
  - CLAUDE.md
date: 2026-03-21
reporting_agent: cli-tester
category: dry
domain: e2e
root_cause: missing-rule
---

## What Was Wrong

Path and timeout constants were duplicated locally in test files instead of being centralized:

- `SKILLS_DIR_PATH` duplicated in 4 command test files
- `SKILL_CATEGORIES_PATH`/`SKILL_RULES_PATH` duplicated in 3 files
- `EXTENDED_LIFECYCLE_TIMEOUT_MS` duplicated in 4 lifecycle tests
- Local timeout constants (`COMPILE_TIMEOUT_MS`, `EDIT_TEST_TIMEOUT_MS`, `REAL_INSTALL_TIMEOUT`) duplicated values already in `TIMEOUTS.*`

## Fix Applied

Added `SOURCE_PATHS` object and `TIMEOUTS.PLUGIN_TEST`/`TIMEOUTS.EXTENDED_LIFECYCLE` to `e2e/pages/constants.ts`. Updated 12 consuming files to import centralized constants.

## Proposed Standard

Added `SOURCE_PATHS` to constants quick-reference in `README.md`. Added CLAUDE.md NEVER rule: "NEVER define path/timeout/text constants locally in E2E test files."
