---
type: anti-pattern
severity: low
affected_files:
  - e2e/commands/compile-scope-filtering.e2e.test.ts
  - e2e/commands/build.e2e.test.ts
  - e2e/commands/info.e2e.test.ts
  - e2e/commands/new-marketplace.e2e.test.ts
  - e2e/commands/compile-edge-cases.e2e.test.ts
  - e2e/commands/validate.e2e.test.ts
  - e2e/commands/compile.e2e.test.ts
  - e2e/commands/help.e2e.test.ts
  - e2e/commands/dual-scope.e2e.test.ts
  - e2e/commands/doctor.e2e.test.ts
  - e2e/commands/relationships.e2e.test.ts
  - e2e/commands/outdated.e2e.test.ts
  - e2e/commands/diff.e2e.test.ts
  - e2e/commands/new-agent.e2e.test.ts
  - e2e/commands/import-skill.e2e.test.ts
  - e2e/commands/plugin-uninstall-edge-cases.e2e.test.ts
  - e2e/commands/eject.e2e.test.ts
  - e2e/commands/config.e2e.test.ts
  - e2e/commands/uninstall-preservation.e2e.test.ts
  - e2e/commands/doctor-diagnostics.e2e.test.ts
  - e2e/commands/list.e2e.test.ts
  - e2e/commands/new-skill.e2e.test.ts
  - e2e/commands/uninstall.e2e.test.ts
  - e2e/interactive/search-static.e2e.test.ts
  - e2e/interactive/build-stack.e2e.test.ts
  - e2e/interactive/search-interactive.e2e.test.ts
  - e2e/interactive/update.e2e.test.ts
  - e2e/interactive/uninstall.e2e.test.ts
  - e2e/interactive/edit-agent-scope-routing.e2e.test.ts
  - e2e/interactive/edit-skill-accumulation.e2e.test.ts
  - e2e/lifecycle/unified-config-view.e2e.test.ts
  - e2e/smoke/plugin-install.smoke.test.ts
  - e2e/smoke/plugin-chain-poc.smoke.test.ts
standards_docs:
  - .ai-docs/standards/e2e/anti-patterns.md
date: 2026-03-23
reporting_agent: cli-tester
category: testing
domain: e2e
root_cause: convention-undocumented
---

## What Was Wrong

Two anti-patterns found across E2E test files:

1. **`undefined!` non-null assertions (34 occurrences, 30 files):** Every E2E test file using temp directories had `tempDir = undefined!` in `afterEach` blocks after `cleanupTempDir()`. The `undefined!` cast is unnecessary because `cleanupTempDir()` uses `force: true` (handles non-existent directories gracefully) and the next `beforeEach` always reassigns via `createTempDir()`.

2. **Raw `readFile` instead of `readTestFile` (6 files):** Six E2E test files imported `readFile` from `fs/promises` directly instead of using the `readTestFile` helper from `e2e/helpers/test-utils.ts`. The helper exists for consistency and to avoid repeating the `"utf-8"` encoding parameter.

Additionally, `edit-skill-accumulation.e2e.test.ts` had two separate `import` lines from `"fs/promises"` which were consolidated.

## Fix Applied

1. Removed all 34 `tempDir = undefined!` / `sourceTempDir = undefined!` lines from afterEach blocks.
2. Replaced all raw `readFile(path, "utf-8")` calls with `readTestFile(path)` and updated imports accordingly.
3. Consolidated duplicate `fs/promises` import in `edit-skill-accumulation.e2e.test.ts`.

TypeScript type check passes with zero errors after all changes.

## Proposed Standard

Add to `.ai-docs/standards/e2e/anti-patterns.md`:

- **Do not use `undefined!` in afterEach cleanup.** The `cleanupTempDir()` function uses `force: true` and handles already-deleted directories. The next `beforeEach` always reassigns via `createTempDir()`.
- **Always use `readTestFile()` from `e2e/helpers/test-utils.ts` instead of raw `readFile` from `fs/promises`.** This ensures consistent encoding and reduces import surface from Node.js built-ins.
