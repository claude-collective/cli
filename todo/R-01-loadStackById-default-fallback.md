# R-01: `loadStackById` Default Stacks Fallback

**Status:** Ready to implement
**Complexity:** Low (~10 lines changed across 3 files + test updates)

## Problem

Both call sites of `loadStackById` duplicate the same fallback to `defaultStacks`:

**`local-installer.ts:172-178`:**
```typescript
loadedStack = await loadStackById(wizardResult.selectedStackId, sourceResult.sourcePath);
if (!loadedStack) {
  loadedStack = defaultStacks.find((s) => s.id === wizardResult.selectedStackId) ?? null;
}
```

**`stack-plugin-compiler.ts:223-227`:**
```typescript
const newStack =
  options.stack ||
  (await loadStackById(stackId, projectRoot)) ||
  defaultStacks.find((s) => s.id === stackId) ||
  null;
```

## Fix

Move the `defaultStacks` fallback inside `loadStackById` so callers get it for free.

### 1. `src/cli/lib/stacks/stacks-loader.ts` (line 89-100)

```typescript
// Before
export async function loadStackById(stackId: string, configDir: string): Promise<Stack | null> {
  const stacks = await loadStacks(configDir);
  const stack = stacks.find((s) => s.id === stackId);

  if (!stack) {
    verbose(`Stack '${stackId}' not found`);
    return null;
  }

  verbose(`Found stack: ${stack.name} (${stackId})`);
  return stack;
}

// After
export async function loadStackById(stackId: string, configDir: string): Promise<Stack | null> {
  const stacks = await loadStacks(configDir);
  const stack = stacks.find((s) => s.id === stackId);

  if (stack) {
    verbose(`Found stack: ${stack.name} (${stackId})`);
    return stack;
  }

  // Fall back to CLI's built-in default stacks
  const defaultStack = defaultStacks.find((s) => s.id === stackId) ?? null;
  if (defaultStack) {
    verbose(`Found default stack: ${defaultStack.name} (${stackId})`);
  } else {
    verbose(`Stack '${stackId}' not found in source or defaults`);
  }
  return defaultStack;
}
```

Add import: `import { defaultStacks } from "../configuration/default-stacks";`

### 2. `src/cli/lib/installation/local-installer.ts` (line 172-178)

```typescript
// Before
let loadedStack: Stack | null = null;
if (wizardResult.selectedStackId) {
  loadedStack = await loadStackById(wizardResult.selectedStackId, sourceResult.sourcePath);
  if (!loadedStack) {
    // Fall back to CLI's built-in default stacks
    loadedStack = defaultStacks.find((s) => s.id === wizardResult.selectedStackId) ?? null;
  }

// After
let loadedStack: Stack | null = null;
if (wizardResult.selectedStackId) {
  loadedStack = await loadStackById(wizardResult.selectedStackId, sourceResult.sourcePath);
```

Remove the `defaultStacks` import if no longer used in this file.

### 3. `src/cli/lib/stacks/stack-plugin-compiler.ts` (line 223-227)

```typescript
// Before
const newStack =
  options.stack ||
  (await loadStackById(stackId, projectRoot)) ||
  defaultStacks.find((s) => s.id === stackId) ||
  null;

// After
const newStack =
  options.stack ||
  (await loadStackById(stackId, projectRoot));
```

Remove the `defaultStacks` import if no longer used in this file.

### 4. Test updates — `stacks-loader.test.ts`

The "returns null when stack ID not found" and "returns null when no stacks file exists" tests need updating. After R-01, `loadStackById` may return a default stack instead of null when the source file has no match. Tests should:

- Verify that a known default stack ID (e.g., `"nextjs-fullstack"`) is returned even when the source has no stacks
- Verify that a truly nonexistent ID still returns null
- Add a test: "falls back to default stacks when source has no match"

### 5. Clean up unused imports

After removing the fallback from both callers, check if `defaultStacks` is still imported in:
- `local-installer.ts` — remove import if unused
- `stack-plugin-compiler.ts` — remove import if unused

## Files Changed

| File | Change |
| --- | --- |
| `src/cli/lib/stacks/stacks-loader.ts` | Add defaultStacks fallback inside loadStackById |
| `src/cli/lib/installation/local-installer.ts` | Remove duplicated fallback + unused import |
| `src/cli/lib/stacks/stack-plugin-compiler.ts` | Remove duplicated fallback + unused import |
| `src/cli/lib/stacks/stacks-loader.test.ts` | Update/add tests for default fallback behavior |
