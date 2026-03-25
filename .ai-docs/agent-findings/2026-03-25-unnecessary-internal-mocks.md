---
type: anti-pattern
severity: medium
affected_files:
  - src/cli/lib/plugins/plugin-settings.test.ts
  - src/cli/lib/plugins/plugin-discovery.test.ts
  - src/cli/lib/matrix/skill-resolution.test.ts
  - src/cli/lib/installation/mode-migrator.test.ts
  - src/cli/lib/installation/installation.test.ts
  - src/cli/lib/stacks/stack-installer.test.ts
  - src/cli/lib/agents/agent-fetcher.test.ts
  - src/cli/lib/loading/source-fetcher-refresh.test.ts
  - src/cli/lib/plugins/plugin-finder.test.ts
  - src/cli/lib/skills/skill-fetcher.test.ts
  - src/cli/components/wizard/step-settings.test.tsx
  - src/cli/lib/configuration/__tests__/config-types-writer.test.ts
standards_docs:
  - .ai-docs/reference/test-infrastructure.md
date: 2026-03-25
reporting_agent: cli-tester
category: testing
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

Audit of all `vi.mock()` calls across `src/` found several categories of unnecessary or questionable mocking of internal pure functions and constants. The core anti-pattern: mocking a module to return the exact same values as the real module, which adds complexity without isolation benefit. The test ends up testing mock wiring instead of real behavior.

### Findings by Category

---

### WRONG: Mocking `getErrorMessage` (pure function, reimplements same logic)

**`src/cli/lib/plugins/plugin-settings.test.ts` line 30**
Mock: `vi.mock("../../utils/errors", ...)` with `getErrorMessage: vi.fn((e) => e instanceof Error ? e.message : String(e))`
The mock reimplements the exact same logic as the 4-line real function in `errors.ts`. The mock is never asserted against. Should use the real implementation.

**`src/cli/lib/plugins/plugin-discovery.test.ts` line 21**
Mock: `vi.mock("../../utils/errors", ...)` with identical reimplementation of `getErrorMessage`.
Never asserted against. Should use the real implementation.

---

### WRONG: Mocking `consts` to the same values

**`src/cli/lib/plugins/plugin-settings.test.ts` line 35**
Mock: `vi.mock("../../consts", ...)` setting `CLAUDE_DIR: ".claude"`, `PLUGINS_SUBDIR: "plugins"`, `MAX_CONFIG_FILE_SIZE: 1048576`, `PLUGIN_MANIFEST_DIR: ".claude-plugin"`, `PLUGIN_MANIFEST_FILE: "plugin.json"`. Every value is identical to the real export. This mock provides zero isolation benefit and adds 8 lines of noise.

**`src/cli/components/wizard/step-settings.test.tsx` line 21**
Mock: `vi.mock("../../lib/configuration/config.js", ...)` setting `DEFAULT_SOURCE: "github:agents-inc/skills"`. This is the exact value the real module exports. The mock was likely added to avoid importing `config.ts` which has side effects, but since the test already imports `source-manager.js` from the same configuration module, the side effects are already triggered.

---

### BORDERLINE: Logger mocks that suppress output but are never asserted against

These mocks serve the purpose of suppressing `verbose()`/`warn()` console output during tests. While suppression is a legitimate use, the pattern is inconsistent: some tests that mock the logger assert against it (JUSTIFIED), while others never use the mock values (noise). The borderline ones below could use a simpler suppression approach like `vi.spyOn` instead of a full module mock.

**`src/cli/lib/matrix/skill-resolution.test.ts` line 21**
`vi.mock("../../utils/logger")` -- logger never asserted. Suppression only.

**`src/cli/lib/installation/mode-migrator.test.ts` line 21**
`vi.mock("../../utils/logger")` -- logger never asserted. Suppression only.

**`src/cli/lib/installation/installation.test.ts` line 14**
`vi.mock("../../utils/logger")` -- logger never asserted. Suppression only.

**`src/cli/lib/stacks/stack-installer.test.ts` line 18**
`vi.mock("../../utils/logger")` -- logger never asserted. Suppression only.

**`src/cli/lib/agents/agent-fetcher.test.ts` line 7**
`vi.mock("../../utils/logger")` -- logger never asserted. Suppression only.

**`src/cli/lib/loading/source-fetcher-refresh.test.ts` line 9**
`vi.mock("../../utils/logger")` -- logger never asserted. Suppression only.

**`src/cli/lib/plugins/plugin-finder.test.ts` line 34**
`vi.mock("../../utils/logger")` -- logger never asserted. Suppression only.

**`src/cli/lib/skills/skill-fetcher.test.ts` line 8**
`vi.mock("../../utils/logger")` -- logger never asserted. Suppression only.

**`src/cli/lib/plugins/plugin-settings.test.ts` line 25**
`vi.mock("../../utils/logger", ...)` with `verbose: mockVerbose` -- `mockVerbose` is never asserted against. Suppression only.

**`src/cli/lib/plugins/plugin-discovery.test.ts` line 16**
`vi.mock("../../utils/logger", ...)` with `verbose: mockVerbose` -- `mockVerbose` is never asserted against. Suppression only.

---

### BORDERLINE: `consts` mocked for dynamic path overrides

These mock `consts` to override `PROJECT_ROOT`, `CACHE_DIR`, or `GLOBAL_INSTALL_ROOT` to point at temp directories. This is a justified pattern because these values are computed at import time from `os.homedir()` and `import.meta.url` and cannot be configured otherwise. However, the pattern uses `get` accessors which is fragile.

**`src/cli/lib/agents/agent-fetcher.test.ts` line 24**
Mocks `PROJECT_ROOT` via getter to a temp dir. Justified -- derived from `import.meta.url`.

**`src/cli/lib/loading/source-fetcher-refresh.test.ts` line 11**
Mocks `CACHE_DIR` via getter to a temp dir. Justified -- derived from `os.homedir()`.

**`src/cli/lib/configuration/__tests__/config-types-writer.test.ts` line 7**
Mocks `GLOBAL_INSTALL_ROOT` to `/tmp/nonexistent-global-root`. Justified -- prevents dev machine's real `~/.claude-src/` from affecting tests.

---

### JUSTIFIED: All other mocks reviewed

The following patterns were reviewed and found to be properly justified:

- **File system mocks** (`utils/fs`, `fs/promises`): All files that mock `fs` do so because the SUT reads/writes files. Correct isolation pattern.
- **Logger mocks with assertions**: `loader.test.ts`, `schemas.test.ts`, `matrix-health-check.test.ts`, `skill-metadata.test.ts`, `source-switcher.test.ts`, `stacks-loader.test.ts`, `multi-source-loader.test.ts` all assert against `warn()` calls. These mocks serve dual purpose (suppress + verify).
- **External HTTP mocks** (`giget`, `source-fetcher`): Avoid network calls. Correct.
- **Child process mocks** (`exec.test.ts`): Avoid running real shell commands. Correct.
- **Heavy dependency mocks** in integration-style tests (`local-installer.test.ts`, `compiler.test.ts`, `edit.test.ts`): Mock adjacent modules to isolate the SUT's logic. These are standard unit test isolation.
- **Ink render mock** (`edit.test.ts`): Prevents actual terminal rendering during command tests. Correct.
- **`config-loader` mocks** (`matrix-loader.test.ts`, `stacks-loader.test.ts`): Avoid reading real config files from disk. Correct.

---

### Not found (good)

No test files mock:

- `typed-object.ts` (typedEntries, typedKeys)
- `type-guards.ts` (isDomain, isCategory, etc.)
- `generated/source-types.ts` or `generated/matrix.ts`
- `matrix-provider.ts` (tests use `initializeMatrix()` with test data as intended)
- `schemas.ts` (tests use real schemas)

## Fix Applied

None -- discovery only (read-only audit).

## Proposed Standard

### 1. Add rule to CLAUDE.md NEVER section

```
- NEVER mock `getErrorMessage()` from `utils/errors.ts` -- it is a 4-line pure function with no I/O
- NEVER mock `consts.ts` values to identical values -- only mock consts when overriding computed paths (PROJECT_ROOT, CACHE_DIR, GLOBAL_INSTALL_ROOT) to temp directories
```

### 2. Add rule to CLAUDE.md ALWAYS section

```
- ALWAYS use `vi.spyOn` or `vi.mock` auto-mock (`vi.mock("path")` with no factory) for logger suppression when no assertions are needed against logger calls. Reserve explicit mock factories for tests that assert against `warn()`/`verbose()`.
```

### 3. Specific files to clean up (ordered by impact)

**High priority (WRONG -- remove entirely):**

1. `plugin-settings.test.ts`: Remove `vi.mock("../../utils/errors")` and `vi.mock("../../consts")` entirely
2. `plugin-discovery.test.ts`: Remove `vi.mock("../../utils/errors")`
3. `step-settings.test.tsx`: Remove `vi.mock("../../lib/configuration/config.js")`

**Low priority (BORDERLINE -- simplify):** 4. Consider whether suppression-only logger mocks could use `vi.mock("../../utils/logger")` (bare auto-mock) consistently, instead of the more verbose `vi.mock("...", async (importOriginal) => ({ ...(await importOriginal()), verbose: mockVerbose }))` pattern that creates named mock handles never used in assertions.
