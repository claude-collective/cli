---
type: anti-pattern
severity: low
affected_files:
  - src/cli/lib/__tests__/integration/compilation-pipeline.test.ts
standards_docs:
  - .ai-docs/standards/clean-code-standards.md
date: 2026-03-29
reporting_agent: cli-tester
category: dry
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

Every test in `compilation-pipeline.test.ts` duplicated the same console spy boilerplate:

```typescript
const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
// ... test body ...
consoleSpy.mockRestore();
warnSpy.mockRestore();
```

This was repeated in 11 tests across 3 describe blocks. Each test had 4 lines of spy setup/teardown that could be centralized in `beforeEach`/`afterEach`.

## Fix Applied

Moved `vi.spyOn(console, ...)` to `beforeEach` and `vi.restoreAllMocks()` to `afterEach` for each describe block. Removed all per-test spy setup and manual `.mockRestore()` calls.

## Proposed Standard

Add to test infrastructure docs: "When all tests in a describe block need the same spy, move it to `beforeEach`/`afterEach`. Use `vi.restoreAllMocks()` in `afterEach` instead of manual `.mockRestore()` calls."
