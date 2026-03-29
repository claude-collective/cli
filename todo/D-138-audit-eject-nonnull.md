# D-138 Audit: Non-null Assertions in eject.ts

## Issue

CLAUDE.md rule: "NEVER use `matrix.skills[id]!` non-null assertions -- use asserting lookups."
More broadly, non-null assertions (`!`) on variables that could be undefined are a code smell that suppresses TypeScript's safety.

**File:** `src/cli/commands/eject.ts`

---

## Finding 1: `sourceResult!` in `executeEject` (lines 193, 198)

### Where It Is

The `sourceResult` parameter is typed `SourceLoadResult | undefined` in the `executeEject` method (line 181):

```typescript
private async executeEject(
  ejectType: EjectType,
  outputBase: string,
  flags: { force: boolean; output?: string },
  projectDir: string,
  sourceResult: SourceLoadResult | undefined,  // <-- typed as possibly undefined
): Promise<void> {
```

It comes from `loadSourceIfNeeded` (line 160-174), which returns `SourceLoadResult | undefined`:

```typescript
private async loadSourceIfNeeded(
  ejectType: EjectType,
  flags: { source?: string; refresh: boolean },
  projectDir: string,
): Promise<SourceLoadResult | undefined> {
  if (ejectType === "skills" || ejectType === "all") {
    const loaded = await loadSource({ ... });
    return loaded.sourceResult;
  }
  return undefined;  // <-- undefined for "agent-partials" and "templates"
}
```

### The Switch Statement (lines 185-202)

```typescript
switch (ejectType) {
  case "agent-partials":
    await this.handleAgentPartials(outputBase, flags.force, directOutput, false);
    break;
  case "templates":
    await this.handleAgentPartials(outputBase, flags.force, directOutput, true);
    break;
  case "skills":
    await this.handleSkills(projectDir, flags.force, sourceResult!, directOutput, outputBase);
    //                                                 ^^^^^^^^^^^^^ non-null assertion
    break;
  case "all":
    await this.handleAgentPartials(outputBase, flags.force, directOutput, false);
    await this.handleAgentPartials(outputBase, true, directOutput, true);
    await this.handleSkills(projectDir, flags.force, sourceResult!, directOutput, outputBase);
    //                                                 ^^^^^^^^^^^^^ non-null assertion
    break;
  default:
    break;
}
```

### Code Path Analysis

| ejectType | `loadSourceIfNeeded` returns | `sourceResult!` used? | Safe? |
|---|---|---|---|
| `"agent-partials"` | `undefined` | No | N/A |
| `"templates"` | `undefined` | No | N/A |
| `"skills"` | `SourceLoadResult` | Yes, line 193 | Logically safe (loaded) |
| `"all"` | `SourceLoadResult` | Yes, line 198 | Logically safe (loaded) |

**The assertions are logically correct** -- `loadSourceIfNeeded` returns a value (not undefined) when `ejectType` is `"skills"` or `"all"`, which are exactly the branches that use `sourceResult!`. TypeScript cannot infer this because the `loadSourceIfNeeded` call and the `switch` are separate -- TS doesn't track the correlation between the `ejectType` argument and the return type.

### Why It Is Still a Problem

1. **The assertions suppress a real type-safety guarantee.** If someone later adds a new eject type that uses skills but forgets to update `loadSourceIfNeeded`, the `!` will silently pass at compile time and crash at runtime.
2. **CLAUDE.md explicitly bans non-null assertions.** Even when logically safe, the rule exists to prevent the class of bugs described above.

### Proposed Fix

Restructure `loadSourceIfNeeded` and `executeEject` so TypeScript knows `sourceResult` is defined when needed. Two approaches:

**Option A (recommended): Load source inside the switch branches that need it.**

This is the simplest refactor -- move the source loading into `executeEject` so it's scoped to the branches that use it:

```typescript
private async executeEject(
  ejectType: EjectType,
  outputBase: string,
  flags: { force: boolean; output?: string; source?: string; refresh: boolean },
  projectDir: string,
): Promise<void> {
  const directOutput = !!flags.output;

  switch (ejectType) {
    case "agent-partials":
      await this.handleAgentPartials(outputBase, flags.force, directOutput, false);
      break;
    case "templates":
      await this.handleAgentPartials(outputBase, flags.force, directOutput, true);
      break;
    case "skills": {
      const sourceResult = await this.loadSource(flags, projectDir);
      await this.handleSkills(projectDir, flags.force, sourceResult, directOutput, outputBase);
      break;
    }
    case "all": {
      const sourceResult = await this.loadSource(flags, projectDir);
      await this.handleAgentPartials(outputBase, flags.force, directOutput, false);
      await this.handleAgentPartials(outputBase, true, directOutput, true);
      await this.handleSkills(projectDir, flags.force, sourceResult, directOutput, outputBase);
      break;
    }
  }
}

// Renamed helper -- always loads, never returns undefined
private async loadSource(
  flags: { source?: string; refresh: boolean },
  projectDir: string,
): Promise<SourceLoadResult> {
  const loaded = await loadSource({
    sourceFlag: flags.source,
    projectDir,
    forceRefresh: flags.refresh,
  });
  return loaded.sourceResult;
}
```

The `run()` method would change from:

```typescript
const sourceResult = await this.loadSourceIfNeeded(ejectType, flags, projectDir);
await this.executeEject(ejectType, outputBase, flags, projectDir, sourceResult);
```

To:

```typescript
await this.executeEject(ejectType, outputBase, flags, projectDir);
```

And `ensureConfig` would need `sourceResult` passed differently (either from return value of `executeEject` or loaded inline). The simplest approach: have `executeEject` return the `SourceLoadResult | undefined` so `ensureConfig` can use it.

**Note:** The `ensureConfig` call at line 108 also receives `sourceResult` and uses it optionally (line 507: `sourceResult?.sourceConfig`), so it's fine with `undefined`.

**Option B: Discriminated return from loadSourceIfNeeded.**

Use a tagged union so TypeScript narrows:

```typescript
type LoadResult =
  | { needsSource: true; sourceResult: SourceLoadResult }
  | { needsSource: false; sourceResult: undefined };
```

This is more complex and over-engineered for this case. **Option A is preferred.**

### Complexity Assessment

**Simple fix.** The refactor is mechanical: move the `loadSource` call into the switch branches that need it. No behavioral change. No new types needed. Tests should not be affected since `executeEject` is private.

---

## Finding 2: `result.skipReason!` in eject.ts (lines 244, 281)

### Where It Is

```typescript
// Line 243-246 (handleAgentPartials)
if (result.skipped) {
  this.warn(result.skipReason!);
  return;
}

// Line 280-282 (handleSkills)
if (result.skipped) {
  this.warn(result.skipReason!);
  return;
}
```

### Analysis

The types `EjectAgentPartialsResult` and `EjectSkillsResult` both define:
```typescript
skipped: boolean;
skipReason?: string;
```

When `skipped` is `true`, every code path in `ejectAgentPartials` and `ejectSkills` sets `skipReason`. But TypeScript cannot narrow `skipReason` based on the `skipped` boolean.

### Proposed Fix

Use a discriminated union:

```typescript
type EjectAgentPartialsResult =
  | { skipped: true; skipReason: string; templatesSkipped: false }
  | { skipped: false; destDir: string; templatesSkipped: boolean };
```

Or more simply, just use `result.skipReason ?? "Operation skipped"` as a fallback instead of `!`. However, the discriminated union is the correct TypeScript pattern here and would also eliminate the optional `destDir` field.

### Complexity Assessment

**Medium fix.** Requires changing the result types to discriminated unions and updating the return sites. Clean and correct but touches more lines than the sourceResult fix.

---

## Finding 3: Other Non-null Assertions in Commands Directory

### search.tsx:367 -- `options.category!`

```typescript
function filterSkillsByQuery(skills: ResolvedSkill[], options: FilterSkillsOptions): ResolvedSkill[] {
  let results = skills.filter((skill) => matchesQuery(skill, options.query));
  if (options.category) {
    results = results.filter((skill) => matchesCategory(skill, options.category!));
  }
  return results;
}
```

`options.category` is `string | undefined`. The guard `if (options.category)` narrows it to `string` in the block, but TypeScript loses narrowing inside the callback closure.

**Fix:** Capture in a local variable:

```typescript
if (options.category) {
  const category = options.category;
  results = results.filter((skill) => matchesCategory(skill, category));
}
```

**Complexity: Trivial.**

### doctor.ts:308 -- `result.details!`

```typescript
const shouldShowDetails =
  result.details &&
  result.details.length > 0 &&
  (verbose || result.status === "fail" || result.status === "warn");

if (shouldShowDetails) {
  for (const detail of result.details!) {
```

TypeScript cannot narrow through the intermediate `shouldShowDetails` boolean. The truthiness check on `result.details` is lost.

**Fix:** Inline the check or capture the array:

```typescript
if (result.details && result.details.length > 0 &&
    (verbose || result.status === "fail" || result.status === "warn")) {
  for (const detail of result.details) {
```

Or use a local variable:

```typescript
const details = result.details ?? [];
if (details.length > 0 && (verbose || result.status === "fail" || result.status === "warn")) {
  for (const detail of details) {
```

**Complexity: Trivial.**

---

## Summary

| Location | Pattern | Severity | Fix Complexity |
|---|---|---|---|
| eject.ts:193,198 | `sourceResult!` after conditional load | Medium | Simple (move load into switch branches) |
| eject.ts:244,281 | `result.skipReason!` after `skipped` check | Low | Medium (discriminated union or fallback) |
| search.tsx:367 | `options.category!` in closure | Low | Trivial (local variable) |
| doctor.ts:308 | `result.details!` after boolean guard | Low | Trivial (inline check or local variable) |

### Priority Recommendation

1. **eject.ts `sourceResult!`** -- Fix first. This is the primary audit finding and the one most likely to cause a real bug if the code evolves.
2. **search.tsx and doctor.ts** -- Fix opportunistically. These are trivial one-line changes.
3. **eject.ts `skipReason!`** -- Fix when touching the result types. The discriminated union is the right approach but is a slightly larger change.
