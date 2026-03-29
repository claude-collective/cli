# D-138 Audit: E2E dual-scope-edit-mixed-sources try/finally cleanup

## File

`e2e/lifecycle/dual-scope-edit-mixed-sources.e2e.test.ts`

## Findings

### try/finally blocks in it() bodies

**Count:** 2 try/finally blocks removed (one per test), plus 2 inner try/catch blocks removed (one per test). Total: 4 structured error-handling blocks replaced with a single afterEach.

### Before pattern

Each `it()` block had a nested structure:

```typescript
it("Test N", async () => {
  const { tempDir, fakeHome, projectDir } = await createTestEnvironment();
  try {
    // ... setup phases ...
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

### After pattern

Variables hoisted to describe scope, cleanup in afterEach:

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

it("Test N", async () => {
  const env = await createTestEnvironment();
  tempDir = env.tempDir;
  const { fakeHome, projectDir } = env;
  // ... setup phases ...
  wizard = await EditWizard.launch({ ... });
  // ... wizard interaction + assertions ...
  await result.destroy();
});
```

### Edge cases

- **Double destroy safety:** `result.destroy()` is called in the happy path, and `wizard?.destroy()` runs in afterEach. Both call `TerminalSession.destroy()` which has an idempotency guard (`if (this.destroyed) return`), so double-calling is safe.
- **tempDir = undefined! pattern:** Used per test-structure.md convention -- TypeScript sees `string` during test execution, `undefined!` prevents stale references after cleanup.
- **wizard typed as `EditWizard | undefined`:** Allows `wizard?.destroy()` in afterEach without type errors. Reset to `undefined` after cleanup.

## Compliance

The file now fully complies with `test-structure.md`:

- No try/finally in test bodies
- Cleanup in afterEach
- `tempDir = undefined!` reset pattern
- `wizard?.destroy()` in afterEach for session cleanup
