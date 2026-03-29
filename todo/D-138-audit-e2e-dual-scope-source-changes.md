# D-138 Audit: dual-scope-edit-source-changes.e2e.test.ts

## Summary

Removed `try/finally` blocks from `it()` test bodies in `e2e/lifecycle/dual-scope-edit-source-changes.e2e.test.ts` to comply with `test-structure.md`.

## Findings

**try/finally blocks found in it() bodies:** 2 (one per test)
**try/catch blocks found nested inside try/finally:** 2 (wizard error cleanup)
**Total blocks fixed:** 4 (2 outer try/finally + 2 inner try/catch)

### Before Pattern

Each `it()` block had a two-layer cleanup structure:

```typescript
it("Test N: ...", async () => {
  const { tempDir, fakeHome, projectDir } = await createTestEnvironment();
  try {
    // ... phases A + B ...
    const wizard = await EditWizard.launch({ ... });
    try {
      // ... wizard interaction + assertions ...
      await result.destroy();
    } catch (e) {
      await wizard.destroy();
      throw e;
    }
  } finally {
    await cleanupTempDir(tempDir);
  }
});
```

- Outer `try/finally`: cleaned up `tempDir` via `cleanupTempDir()`
- Inner `try/catch`: cleaned up wizard session via `wizard.destroy()` on error

### After Pattern

Cleanup variables declared at `describe` scope, cleanup in `afterEach`:

```typescript
let tempDir: string;
let wizard: EditWizard | undefined;

afterEach(async () => {
  await wizard?.destroy();
  wizard = undefined;
  if (tempDir) {
    await cleanupTempDir(tempDir);
    tempDir = undefined!;
  }
});

it("Test N: ...", async () => {
  const env = await createTestEnvironment();
  tempDir = env.tempDir;
  const { fakeHome, projectDir } = env;

  // ... phases A + B ...

  wizard = await EditWizard.launch({ ... });
  // ... wizard interaction + assertions (flat, no try/catch) ...

  await result.destroy();
  wizard = undefined;  // prevent double-destroy in afterEach
});
```

### Key decisions

1. **Wizard cleanup order:** `wizard?.destroy()` runs before `cleanupTempDir(tempDir)` in `afterEach`, matching the original nesting order (inner catch before outer finally).

2. **`wizard = undefined` at end of happy path:** After `result.destroy()` completes the wizard session cleanly, the test sets `wizard = undefined` to prevent `afterEach` from calling `wizard.destroy()` again (which would be a double-destroy).

3. **`tempDir = undefined!` pattern:** Follows the convention documented in `test-structure.md` -- the non-null assertion is intentional since `tempDir` is typed as `string` (not `string | undefined`).

4. **Destructuring change:** `createTestEnvironment()` result is captured as `env` first, then `tempDir` is assigned to the describe-scope variable, then `fakeHome` and `projectDir` are destructured. This is necessary because `tempDir` must be the describe-scope variable (not a local `const`).

## Compliance

The file now fully complies with `.ai-docs/standards/e2e/test-structure.md`:
- No `try/finally` in test bodies
- No `try/catch` for cleanup in test bodies
- All cleanup in `afterEach`
- Uses `tempDir = undefined!` reset pattern
- Uses `wizard?.destroy()` optional chaining pattern

## Note: Sibling files with same pattern

During investigation, `dual-scope-edit-display.e2e.test.ts` was observed to have the same try/finally + try/catch pattern. It was NOT modified (out of scope for this task).
