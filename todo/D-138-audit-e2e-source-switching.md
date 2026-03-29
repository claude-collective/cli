# D-138 Audit: source-switching-per-skill.e2e.test.ts

## Summary

Removed `try/finally` blocks from `it()` test bodies in `e2e/lifecycle/source-switching-per-skill.e2e.test.ts` per `test-structure.md`: "Do not use `try/finally` for cleanup in test bodies. `afterEach` runs even when tests throw."

## Changes

**try/finally blocks found:** 1
**try/finally blocks fixed:** 1

### Before

```typescript
const prompt = new InteractivePrompt([...], projectDir, { ... });

try {
  await prompt.waitForRawText(STEP_TEXT.BUILD, TIMEOUTS.WIZARD_LOAD);
  // ... all test interactions and assertions ...
  await expect({ dir: projectDir }).toHaveCompiledAgent("web-developer");
} finally {
  await prompt.destroy();
}
```

### After

```typescript
// Declared at inner describe scope
let prompt: InteractivePrompt | undefined;

afterEach(async () => {
  if (prompt) {
    await prompt.destroy();
    prompt = undefined;
  }
});

// In the test body -- no try/finally wrapper
prompt = new InteractivePrompt([...], projectDir, { ... });

await prompt.waitForRawText(STEP_TEXT.BUILD, TIMEOUTS.WIZARD_LOAD);
// ... all test interactions and assertions ...
await expect({ dir: projectDir }).toHaveCompiledAgent("web-developer");
```

## Approach

- Declared `prompt` as `let prompt: InteractivePrompt | undefined` at the inner `describe` scope (the `"per-skill source switching"` block).
- Added an `afterEach` in that inner `describe` to destroy and reset `prompt`.
- Removed the `try/finally` wrapper from the test body, leaving `prompt` assigned directly to the describe-scoped variable.
- All test logic and assertions are unchanged.

## Complications

None. The fix was straightforward -- single `try/finally` block, single resource to clean up.

## Minor observation

The outer `tempDir` variable is typed as `string | undefined` (line 40) rather than the `string` + `tempDir = undefined!` pattern documented in `test-structure.md`. This was not changed since the task scope was limited to try/finally cleanup. The existing pattern still works correctly -- the `if (tempDir)` guard handles the `undefined` case.

## Compliance

The file now fully complies with `test-structure.md` cleanup conventions:
- No `try/finally` in test bodies
- Cleanup handled via `afterEach`
- Resources declared at describe scope and reset after cleanup
