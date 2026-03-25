---
type: anti-pattern
severity: low
affected_files:
  - src/cli/lib/plugins/plugin-settings.test.ts
  - src/cli/lib/plugins/plugin-discovery.test.ts
standards_docs:
  - .ai-docs/reference/test-infrastructure.md
date: 2026-03-25
reporting_agent: cli-tester
category: testing
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

### Context

After fixing `stacks-loader.test.ts` where `hasSkill` from `matrix-provider` was mocked unnecessarily (the mock was testing itself, not real behavior), an audit of ALL test files under `src/` was conducted to find similar patterns.

### Audit Results

**No matrix-provider mocking found.** Every test file that uses matrix-provider functions does so through real `initializeMatrix()` calls with properly constructed mock matrices. The `stacks-loader.test.ts` fix was the only instance of this specific anti-pattern. The codebase is healthy in this regard.

However, two related anti-patterns were found involving unnecessary mocking of pure functions:

#### 1. Unnecessary `getErrorMessage` mock (2 files)

Both `plugin-settings.test.ts` (line 16) and `plugin-discovery.test.ts` (line 13) mock `getErrorMessage` from `../../utils/errors` by re-implementing its exact logic:

```typescript
mockGetErrorMessage: vi.fn((e: unknown) => (e instanceof Error ? e.message : String(e)))
```

The real function is a one-liner that does the same thing. Neither test file asserts on `mockGetErrorMessage` calls. The mock serves no purpose -- the real function would work identically with zero side effects.

#### 2. Unnecessary `consts` mock (1 file)

`plugin-settings.test.ts` (lines 35-42) mocks `../../consts` to override five constants with their exact real values:

```typescript
vi.mock("../../consts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../consts")>()),
  CLAUDE_DIR: ".claude",           // real value: ".claude"
  PLUGINS_SUBDIR: "plugins",       // real value: "plugins"
  MAX_CONFIG_FILE_SIZE: 1048576,   // real value: ONE_MB = 1048576
  PLUGIN_MANIFEST_DIR: ".claude-plugin",  // real value: ".claude-plugin"
  PLUGIN_MANIFEST_FILE: "plugin.json",    // real value: "plugin.json"
}));
```

Every value is identical to the real module. This mock adds complexity without changing behavior.

### Findings Summary

| Category | Count | Description |
|----------|-------|-------------|
| **Should fix** | 3 | Two `getErrorMessage` mocks, one `consts` mock with identical values |
| **Borderline** | 0 | None found |
| **Justified** | ~60 | Logger mocks (output suppression + assertion), I/O mocks (fs, network, exec), env-dependent path overrides |

### Should Fix

1. **`src/cli/lib/plugins/plugin-settings.test.ts`** (lines 16, 30-33, 35-42)
   - Remove `mockGetErrorMessage` from `vi.hoisted()` block
   - Remove `vi.mock("../../utils/errors", ...)` block
   - Remove `vi.mock("../../consts", ...)` block (all values are identical to real module)

2. **`src/cli/lib/plugins/plugin-discovery.test.ts`** (lines 8, 13, 21-24)
   - Remove `mockGetErrorMessage` from `vi.hoisted()` block
   - Remove `vi.mock("../../utils/errors", ...)` block

### Justified (not exhaustive)

- `vi.mock("../../utils/logger")` across ~20 files -- suppresses test output, some tests assert on `warn()` calls
- `vi.mock("../../utils/fs")` across ~10 files -- avoids real filesystem operations
- `vi.mock("../../utils/exec")` -- avoids real shell command execution
- `vi.mock("../loading")` / `vi.mock("./source-fetcher")` -- avoids network calls
- `vi.mock("../../consts")` in `config-types-writer.test.ts`, `agent-fetcher.test.ts`, `source-fetcher-refresh.test.ts` -- overrides env-dependent paths (GLOBAL_INSTALL_ROOT, PROJECT_ROOT, CACHE_DIR) to temp dirs
- `vi.mock("../matrix")` in `multi-source-loader.test.ts` -- only mocks `extractAllSkills` (I/O), passes through all matrix-provider functions via `...actual`
- `vi.mock("./resolver")` in `compiler.test.ts` -- provides controlled fixture paths
- `vi.mock("../skills")` in `mode-migrator.test.ts` -- `deleteLocalSkill` and `copySkillsToLocalFlattened` do file I/O

## Fix Applied

None -- discovery only. The `stacks-loader.test.ts` fix was already applied prior to this audit.

## Proposed Standard

Add to CLAUDE.md NEVER rules:

```
- NEVER mock pure functions (`getErrorMessage`, `typedEntries`, `typedKeys`, type guards) -- they have no side effects and the real implementation is always correct
- NEVER mock a module to override constants with their real values -- only mock when values need to differ from production
```

These rules would go in the "NEVER do this > Test Data" section of CLAUDE.md.
