# Testing Strategy

> Concrete, opinionated conventions for organizing and writing tests in this CLI project.

---

## 1. Test Categories

Four categories, defined by scope and execution method:

| Category | What it tests | How it runs | Location | Speed |
|----------|--------------|-------------|----------|-------|
| **Unit** | Single function/component in isolation | Direct import, mock dependencies | Co-located with source | Fast (<1s) |
| **Command** | oclif command handler (flags, args, errors) | `runCliCommand()` (in-process) | `lib/__tests__/commands/` | Medium (1-3s) |
| **Integration** | Multiple modules working together | Direct import or `runCliCommand()` + real dependencies | `lib/__tests__/integration/` | Medium (2-5s) |
| **User Journey** | Full workflows with file system verification | `runCliCommand()` + fs assertions | `lib/__tests__/user-journeys/` | Slow (5-15s) |

No subprocess/smoke test category. `runCliCommand()` gives equivalent coverage without the overhead. If subprocess tests are ever needed (signal handling, exit codes in production builds), add a single `lib/__tests__/smoke.test.ts` — not per-command.

### Running categories selectively

```bash
# Unit tests only (co-located files)
bun test --testPathPattern='src/cli/(lib|stores|components)/[^_].*\.test\.'

# Command tests
bun test src/cli/lib/__tests__/commands/

# Integration tests
bun test src/cli/lib/__tests__/integration/

# User journey tests
bun test src/cli/lib/__tests__/user-journeys/

# All tests
bun test
```

Single `vitest.config.ts` — no Vitest workspaces. All tests run in `node` environment with the same settings. The project is not large enough to benefit from workspace splitting.

---

## 2. Directory Structure

```
src/cli/
  commands/
    compile.ts
    init.tsx
  components/
    wizard/
      step-build.tsx
      step-build.test.tsx          # co-located unit test (prop-driven)
      step-confirm.tsx
      step-confirm.test.tsx        # co-located unit test
      wizard.tsx
      category-grid.tsx
      category-grid.test.tsx       # co-located unit test
    skill-search/
      skill-search.tsx
      skill-search.test.tsx        # co-located unit test
  lib/
    matrix-resolver.ts
    matrix-resolver.test.ts        # co-located unit test
    config-generator.ts
    config-generator.test.ts       # co-located unit test
    __tests__/
      helpers.ts                   # shared: mock factories, fs helpers, runCliCommand
      test-constants.ts            # shared: keyboard codes, timing constants
      test-fixtures.ts             # shared: pre-built mock skill factories
      fixtures/
        create-test-source.ts      # full directory scaffolding for user journeys
      commands/                    # command integration tests
        compile.test.ts
        doctor.test.ts
        info.test.ts
        ...
      integration/                 # cross-module integration tests
        wizard-flow.integration.test.tsx
        compilation-pipeline.test.ts
        installation.test.ts
      user-journeys/               # full end-to-end scenario tests
        compile-flow.test.ts
        config-precedence.test.ts
  stores/
    wizard-store.ts
    wizard-store.test.ts           # co-located unit test
```

---

## 3. Co-location Rules

**Co-locate when ALL of these are true:**
1. The test exercises a single source file
2. The test does not require `runCliCommand()`
3. The test does not require complex multi-directory file system scaffolding
4. The test imports from `./module-under-test` (relative, same directory)

**Centralize when ANY of these are true:**
1. The test uses `runCliCommand()` to execute an oclif command
2. The test imports from 3+ different modules in different directories
3. The test sets up a realistic file system tree (multiple directories, multiple files)
4. The test describes a user-visible workflow (init flow, compile flow, update flow)
5. The test verifies interaction between multiple components (e.g., wizard integration)

### Current misplacements to fix

| File | Current Location | Should Be | Reason |
|------|-----------------|-----------|--------|
| `step-confirm.test.tsx` | `__tests__/components/` | `components/wizard/` | Tests single component |
| `step-approach.test.tsx` | `__tests__/components/` | `components/wizard/` | Tests single component |
| `step-stack.test.tsx` | `__tests__/components/` | `components/wizard/` | Tests single component |
| `wizard-tabs.test.tsx` | `__tests__/components/` | `components/wizard/` | Tests single component |
| `confirm.test.tsx` | `__tests__/components/` | Co-locate with confirm component | Tests single component |
| `wizard.integration.test.tsx` | `__tests__/components/` | `__tests__/integration/` | Multi-component integration test |
| `integration.test.ts` | `__tests__/` | `__tests__/integration/` | Integration test |
| `installation.test.ts` | `__tests__/` | `__tests__/integration/` | Integration test |

---

## 4. File Naming

All test files use `*.test.ts` or `*.test.tsx`. No `.spec.ts`.

| Test type | Naming pattern | Example |
|-----------|---------------|---------|
| Unit test | `{module}.test.ts` | `matrix-resolver.test.ts` |
| Integration test | `{feature}.integration.test.ts` | `wizard-flow.integration.test.tsx` |
| User journey test | `{scenario}.test.ts` in `user-journeys/` | `compile-flow.test.ts` |
| Command test | `{command}.test.ts` in `commands/` | `compile.test.ts` |

The `.integration.` infix disambiguates when a centralized test dir contains a mix. The directory location is the primary signal.

---

## 5. Test Naming Conventions

Follow existing patterns:

**Top-level describe block:**
- Lib modules: `describe("module-name", ...)`
- Components: `describe("ComponentName component", ...)`
- Stores: `describe("StoreName", ...)`
- Commands: `describe("command-name command", ...)`

**Nested describe blocks:** Group by behavior area:
- `describe("rendering", ...)`
- `describe("keyboard navigation", ...)`
- `describe("edge cases", ...)`
- `describe("validation on continue", ...)`

**Individual tests:** Start with `should` for behavioral assertions, verb for state:
- `it("should render approach options", ...)`
- `it("returns a minimal ProjectConfig structure", ...)`
- `it("should fail when no plugin exists", ...)`

---

## 6. Fixture Organization

Four tiers — already well-structured, keep as-is:

| Tier | File | What goes here |
|------|------|---------------|
| 1 | `test-constants.ts` | Keyboard codes (`ARROW_UP`, `ENTER`), timing values (`INPUT_DELAY_MS`), `delay()` utility |
| 2 | `test-fixtures.ts` | Pre-built mock objects (`createTestReactSkill()`, `createTestZustandSkill()`) |
| 3 | `helpers.ts` | Parameterized builders (`createMockSkill(id, cat, overrides)`), fs helpers, `runCliCommand()` |
| 4 | `fixtures/create-test-source.ts` | Full multi-directory project scaffolding for user journeys |

**Rules:**
- Import `createMockSkill` / `createMockMatrix` from `helpers.ts` for boilerplate reduction
- Build test-specific matrices and props locally in each test file
- Never share fixture instances across test files — each file creates its own
- Factory functions specific to one test file stay local (e.g., `createComprehensiveMatrix`)

---

## 7. Testing Ink Commands (Two-Layer Approach)

Commands that render Ink UI (init, edit, search, update) need two layers:

### Layer 1: Command tests via `runCliCommand()`

Test the command boundary — flag parsing, argument validation, error exits. Do NOT test rendered output (Ink renders to an alternate stdout that `runCommand` does not capture reliably).

```typescript
// Test that valid flags are accepted
it("should accept query as first argument", async () => {
  const { error } = await runCliCommand(["search", "test"]);
  expect(error?.message?.toLowerCase()).not.toContain("missing required arg");
});
```

### Layer 2: Component tests via `ink-testing-library`

Test rendering and interaction. Use `render()`, `lastFrame()`, `stdin.write()`.

```typescript
const { lastFrame, stdin, unmount } = render(<StepBuild {...props} />);
cleanup = unmount;
await delay(RENDER_DELAY_MS);
expect(lastFrame()).toContain("Expected text");
```

**For non-interactive commands** (compile, info, doctor, diff, eject, outdated), `runCliCommand()` captures stdout directly. User journey tests like `compile-flow.test.ts` demonstrate this — they run compile and check the file system for output.

---

## 8. Keyboard Simulation

All keyboard constants live in `test-constants.ts`. Never inline escape sequences.

**Timing tiers:**

| Constant | Value | When to use |
|----------|-------|-------------|
| `INPUT_DELAY_MS` | 50ms | Between keystrokes within the same step |
| `RENDER_DELAY_MS` | 100ms | After render before first interaction; after interactions that cause rerender |
| `STEP_TRANSITION_DELAY_MS` | 150ms | After interactions that change wizard steps |

**Rules:**
1. Always `await stdin.write()` — it is async
2. Always `await delay(RENDER_DELAY_MS)` before the first interaction after render
3. Test-specific timing constants stay local to the test file
4. If a test is flaky, increase the delay for that specific operation — do not add global delays
5. Do NOT try to replace delays with polling/waitFor patterns — fixed delays are more reliable for terminal UI tests (ink-testing-library has no `waitFor()` equivalent)

---

## 9. Error Path Testing

Three patterns, matching the existing split:

**Flag validation errors** — test via `runCliCommand()` in command tests:
```typescript
it("should require skill argument", async () => {
  const { error } = await runCliCommand(["info"]);
  expect(error).toBeDefined();
  expect(error?.message?.toLowerCase()).toContain("missing");
});
```

**Missing config/plugin errors** — test via `runCliCommand()` with bare project dir:
```typescript
it("should fail when no plugin exists", async () => {
  const { error } = await runCliCommand(["compile"]);
  expect(error?.oclif?.exit).toBeDefined();
});
```

**Data validation errors** (corrupt YAML, missing fields, invalid schemas) — test via direct lib function calls in co-located unit tests:
```typescript
it("should return null for invalid YAML", async () => {
  await writeFile(configPath, "invalid: yaml: content: :");
  const config = await loadProjectConfig(projectDir);
  expect(config).toBeNull();
});
```

---

## 10. What NOT to Do

- **No `renderWithStore()` helper** — it hides setup, making tests harder to understand. Each test sets up its own store state explicitly.
- **No `testKeyboardNav()` utility** — keyboard patterns vary too much between components.
- **No `describe.each` for testing the same thing across commands** — each command has unique flags.
- **No per-command subprocess test files** — if subprocess tests are needed, one `smoke.test.ts` file.
- **No Vitest workspaces** — single config handles all test types.
- **No `.spec.ts` files** — all tests use `.test.ts` / `.test.tsx`.

---

## 11. Test Coverage Priorities

After dead code removal (T7-T21), fill gaps in this order:

**Priority 1 — Core compilation pipeline (most impact):**
- `compiler.ts` — agent template compilation
- `loader.ts` — skill/agent loading from disk
- `matrix-loader.ts` — skills matrix YAML parsing
- `stacks-loader.ts` — stack definitions loading
- `source-loader.ts` — remote/local source loading

**Priority 2 — Plugin system:**
- `skill-plugin-compiler.ts`, `stack-plugin-compiler.ts`
- `plugin-info.ts`, `plugin-finder.ts`, `plugin-validator.ts`, `plugin-version.ts`

**Priority 3 — Secondary systems:**
- `installation.ts`, `local-skill-loader.ts`, `defaults-loader.ts`
- `source-fetcher.ts`, `skill-fetcher.ts`
- `schema-validator.ts`, `marketplace-generator.ts`

**Priority 4 — Commands (cover via user journeys first):**
- Add user journey tests for init, edit, update flows
- Individual command tests for untested non-interactive commands

**Priority 5 — Error paths:**
- Missing error path coverage across existing tested files
- Malformed YAML, missing fields, circular dependencies, network failures
