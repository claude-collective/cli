# D-138 Audit: E2E config-scope-integrity.e2e.test.ts

## Issue

`try/finally` blocks used in `it()` test bodies for temp directory and wizard session cleanup.
This violates `.ai-docs/standards/e2e/test-structure.md`: "Do not use `try/finally` for cleanup in test bodies. `afterEach` runs even when tests throw."

## Findings

**3 try/finally blocks** found in `it()` bodies, plus **2 inner try/catch blocks** for wizard session cleanup:

1. **Test Suite 1** (source priority preservation): `try/finally` around entire test body for `tempDir` cleanup + inner `try/catch` for `EditWizard` session cleanup
2. **Test Suite 5** (config-types Domain type): `try/finally` around entire test body for `tempDir` cleanup + inner `try/catch` for `EditWizard` session cleanup
3. **Test Suite 6** (global config source field, `it.skip`): `try/finally` around entire test body for `tempDir` cleanup

**1 try/catch block** in extracted helper function `initGlobalWithLocalSource()` -- retained per the standard's exception: "Extracted lifecycle helpers may use try/catch internally because they manage sessions within a single function scope."

## Fix Applied

For each affected describe block:

### Before pattern

```typescript
it("test name", async () => {
  const { tempDir, fakeHome } = await createTestEnvironment();
  try {
    // ... test logic ...
    const wizard = await EditWizard.launch({ ... });
    try {
      const result = await wizard.passThrough();
      await result.destroy();
    } catch (e) {
      await wizard.destroy();
      throw e;
    }
    // ... more assertions ...
  } finally {
    await cleanupTempDir(tempDir);
  }
});
```

### After pattern

```typescript
let tempDir: string;
let wizard: Awaited<ReturnType<typeof EditWizard.launch>> | undefined;

afterEach(async () => {
  await wizard?.destroy();
  wizard = undefined;
  if (tempDir) {
    await cleanupTempDir(tempDir);
    tempDir = undefined!;
  }
});

it("test name", async () => {
  const env = await createTestEnvironment();
  tempDir = env.tempDir;
  const { fakeHome } = env;

  // ... test logic (flat, no try/finally) ...
  wizard = await EditWizard.launch({ ... });
  const result = await wizard.passThrough();
  await result.destroy();
  wizard = undefined;
  // ... more assertions ...
});
```

### Key changes

- Declared `tempDir` and `wizard` at describe scope
- Added `afterEach` with cleanup + `undefined!` reset for each affected describe block
- Removed all 3 `try/finally` blocks from `it()` bodies
- Removed all 2 inner `try/catch` blocks for wizard sessions from `it()` bodies
- After successful wizard destroy/result.destroy, set `wizard = undefined` to prevent double-destroy in afterEach
- Test Suite 6 (skipped test) does not use wizard, so only `tempDir` cleanup was needed

## Compliance

The file now fully complies with `test-structure.md`:

- Zero `finally` blocks in the file
- Only remaining `try` block is in the extracted helper `initGlobalWithLocalSource()` (allowed by exception)
- All cleanup done via `afterEach` hooks
- Uses `tempDir = undefined!` pattern per the standard
- All test logic and assertions unchanged
