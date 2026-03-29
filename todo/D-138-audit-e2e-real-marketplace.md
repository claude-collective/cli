# D-138 Audit: e2e/interactive/real-marketplace.e2e.test.ts

## Summary

Audited `e2e/interactive/real-marketplace.e2e.test.ts` for `try/finally` violations per `test-structure.md`.

## Findings

### try/finally blocks in it() bodies

**Count found:** 1
**Count fixed:** 1

**Location:** `describe("edit with real marketplace")` > `it("should show the build step with pre-selected skills")`

**Before pattern:**

```typescript
it("should show the build step with pre-selected skills", async () => {
  const editWizard = await EditWizard.launch({...});
  try {
    const output = editWizard.build.getOutput();
    expect(output).toMatch(/Framework \*/);
  } finally {
    editWizard.abort();
    await editWizard.waitForExit(TIMEOUTS.EXIT);
    await editWizard.destroy();
  }
});
```

**After pattern:**

```typescript
describe("edit with real marketplace", () => {
  let editWizard: EditWizard | undefined;

  afterEach(async () => {
    if (editWizard) {
      editWizard.abort();
      await editWizard.waitForExit(TIMEOUTS.EXIT);
      await editWizard.destroy();
      editWizard = undefined;
    }
  });

  it("should show the build step with pre-selected skills", async () => {
    editWizard = await EditWizard.launch({...});
    const output = editWizard.build.getOutput();
    expect(output).toMatch(/Framework \*/);
  });
});
```

### Additional checks

- **setTimeout/delay() calls:** None found. File complies with timing philosophy.
- **try/catch in utility function (`skillsSourceExists`):** Present and acceptable per test-structure.md exception for extracted helpers that manage sessions within a function scope.
- **Unused import:** `DIRS` is imported but never used. Pre-existing; not addressed in this audit.

## Changes Made

1. Added `afterEach` to vitest imports (line 3)
2. Declared `let editWizard: EditWizard | undefined` at nested describe scope
3. Added `afterEach` block with cleanup (abort, waitForExit, destroy, reset to undefined)
4. Removed `try/finally` from test body, leaving test logic and assertions unchanged

## Compliance

The file now fully complies with `test-structure.md`:

- No `try/finally` in test bodies
- Cleanup handled by `afterEach` which runs even when tests throw
- Variables reset after cleanup (`editWizard = undefined`)

## Complications

None. The fix was straightforward -- single try/finally block, single resource to hoist.
