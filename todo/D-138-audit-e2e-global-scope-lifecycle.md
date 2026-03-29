# D-138 Audit: E2E global-scope-lifecycle.e2e.test.ts

## Summary

Removed all `try/finally` and `try/catch` blocks from `it()` test bodies in `e2e/lifecycle/global-scope-lifecycle.e2e.test.ts`, replacing them with `afterEach` cleanup hooks per `test-structure.md`.

## Violations Found: 9 total (7 try/finally + 2 try/catch)

| Describe Block | Test | Pattern | Fixed |
|---|---|---|---|
| source loader merge | edit wizard should detect... | nested: outer try/finally (tempDir) + inner try/catch (wizard) | Yes |
| doctor command | should not report false 'missing' for global-scoped agents | try/finally (tempDir) | Yes |
| doctor command | should not report false 'missing' for global-scoped skills | try/finally (tempDir) | Yes |
| outdated command | should detect global-scoped local skills... | try/finally (tempDir) | Yes |
| outdated command | should not warn 'No local skills found'... | try/finally (tempDir) | Yes |
| diff command | should find global-scoped local skills... | try/finally (tempDir) | Yes |
| diff command | should not warn 'No local skills found'... | try/finally (tempDir) | Yes |
| uninstall with dual scope | should remove project-scoped skills... | try/finally (tempDir) | Yes |
| init wizard with scope toggling | should place global-scoped local skills... | try/catch (wizard) -- tempDir afterEach already existed | Yes |

## Before/After Pattern

### Before (try/finally for tempDir)

```typescript
it("test name", async () => {
  const { tempDir, fakeHome, projectDir } = await createDualScopeInstallation();
  try {
    // test logic
  } finally {
    await cleanupTempDir(tempDir);
  }
});
```

### After (afterEach cleanup)

```typescript
let tempDir: string;

afterEach(async () => {
  if (tempDir) {
    await cleanupTempDir(tempDir);
    tempDir = undefined!;
  }
});

it("test name", async () => {
  const installation = await createDualScopeInstallation();
  tempDir = installation.tempDir;
  const { fakeHome, projectDir } = installation;
  // test logic -- no try/finally
});
```

### Before (nested try/catch for wizard)

```typescript
it("test name", async () => {
  const wizard = await EditWizard.launch({ ... });
  try {
    // wizard interactions
    await result.destroy();
  } catch (e) {
    await wizard.destroy();
    throw e;
  }
});
```

### After (afterEach cleanup)

```typescript
let wizard: EditWizard | undefined;

afterEach(async () => {
  await wizard?.destroy();
  wizard = undefined;
});

it("test name", async () => {
  wizard = await EditWizard.launch({ ... });
  // wizard interactions -- no try/catch
  await result.destroy();
});
```

## Edge Cases

1. **Describe 6 (init wizard)** already had `afterEach` for `tempDir` with `string | undefined` type and `tempDir = undefined` reset. Updated to use `string` type with `undefined!` reset to match the standard pattern, and added wizard cleanup.

2. **Nested cleanup ordering**: Wizard must be destroyed before tempDir is cleaned up (wizard's PTY runs inside the temp dir). The `afterEach` hooks within each describe block run wizard cleanup first, then tempDir cleanup.

3. **Destructuring change**: Tests using `createDualScopeInstallation()` needed a two-step destructure to assign `tempDir` at describe scope while keeping `fakeHome`/`projectDir` as const bindings.

## Compliance

The file now fully complies with `test-structure.md`:
- Zero `try`/`finally`/`catch` blocks in any `it()` body
- All cleanup via `afterEach` with `tempDir = undefined!` reset pattern
- Wizard cleanup via `wizard?.destroy()` in `afterEach`
