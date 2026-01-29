## Example Review Output

Here's what a complete, high-quality CLI review looks like:

````markdown
# CLI Review: init command

## Files Reviewed

- src/cli/index.ts (45 lines) - Entry point
- src/cli/commands/init.ts (120 lines) - Init command
- src/cli/lib/exit-codes.ts (25 lines) - Exit code constants

## Summary

The init command implementation has good structure but has 3 critical issues:
missing p.isCancel() checks, magic number exit codes, and using parse() instead
of parseAsync(). These must be fixed before approval.

---

## Must Fix (3 issues)

### Issue #1: Missing p.isCancel() check

**Location:** src/cli/commands/init.ts:45
**Category:** Cancellation Handling

**Problem:** p.select() result not checked for cancellation

**Current code:**

```typescript
const framework = await p.select({
  message: "Select framework:",
  options: [
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
  ],
});
// Code continues without checking if user pressed Ctrl+C
const name = await p.text({ message: "Project name:" });
```

**Recommended fix:**

```typescript
const framework = await p.select({
  message: "Select framework:",
  options: [
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
  ],
});
if (p.isCancel(framework)) {
  p.cancel("Setup cancelled");
  process.exit(EXIT_CODES.CANCELLED);
}
```

**Impact:** If user presses Ctrl+C, code continues with Symbol value causing undefined behavior or crash.

---

### Issue #2: Magic number exit code

**Location:** src/cli/commands/init.ts:78
**Category:** Exit Codes

**Problem:** `process.exit(1)` uses magic number instead of named constant

**Current code:**

```typescript
if (!configExists) {
  p.log.error("Config file not found");
  process.exit(1);
}
```

**Recommended fix:**

```typescript
if (!configExists) {
  p.log.error("Config file not found");
  process.exit(EXIT_CODES.ERROR);
}
```

**Impact:** Exit codes become undocumented and unmaintainable. Scripts depending on this CLI cannot reliably interpret exit codes.

---

### Issue #3: Using parse() instead of parseAsync()

**Location:** src/cli/index.ts:42
**Category:** Async Handling

**Problem:** `program.parse()` used with async action handlers

**Current code:**

```typescript
program.parse(process.argv);
```

**Recommended fix:**

```typescript
await program.parseAsync(process.argv);
```

**Impact:** Errors in async action handlers are silently swallowed. Users see no feedback when commands fail.

---

## Should Fix (2 issues)

### Issue #1: Missing spinner for network call

**Location:** src/cli/commands/init.ts:52
**Category:** User Experience

**Issue:** `fetchTemplates()` has no visual feedback during network operation

**Suggestion:**

```typescript
const s = p.spinner();
s.start("Fetching templates...");
try {
  const templates = await fetchTemplates();
  s.stop(`Found ${templates.length} templates`);
} catch (error) {
  s.stop("Failed to fetch templates");
  throw error;
}
```

**Benefit:** Users see progress during network operations. Without spinner, CLI appears frozen.

---

### Issue #2: Error message not actionable

**Location:** src/cli/commands/init.ts:67
**Category:** Error Quality

**Issue:** Error says "Config invalid" but doesn't explain how to fix

**Current:**

```typescript
p.log.error("Config file is invalid");
```

**Suggestion:**

```typescript
p.log.error(`Config file is invalid: ${validationError.message}`);
p.log.info(
  "Run 'mycli validate --config ./config.yaml' to see detailed errors",
);
```

**Benefit:** Users know exactly what's wrong and how to resolve it.

---

## Nice to Have (1 item)

### Add --json output option

**Location:** src/cli/commands/init.ts
**Suggestion:** Add `--json` flag for CI/script integration

```typescript
.option('--json', 'Output results as JSON')
```

**Benefit:** Enables automation and tooling integration for CI pipelines.

---

## CLI Safety Checks

### Signal Handling

- [x] SIGINT handler present in entry point
- [x] SIGINT calls process.exit with EXIT_CODES.CANCELLED
- [ ] SIGTERM handled (for container environments) - not required for this CLI

### Exit Codes

- [x] EXIT_CODES constant file exists
- [x] All exit codes have JSDoc descriptions
- [ ] **No magic numbers in process.exit()** - FAIL (line 78)

### Prompt Cancellation

- [ ] **p.isCancel() after EVERY prompt** - FAIL (lines 45, 56, 67)
- [ ] p.cancel() with descriptive message - N/A (no isCancel checks)

### Async Handling

- [x] Global error handler with .catch()
- [ ] **parseAsync() used** - FAIL (line 42 uses parse())

**Safety Issues Found:** 3 critical

---

## Configuration Review

| Dimension           | Status | Notes                             |
| ------------------- | ------ | --------------------------------- |
| Flag precedence     | PASS   | Flags override env vars correctly |
| Env var handling    | PASS   | Uses MYAPP\_ prefix               |
| Missing file        | PASS   | Gracefully handles missing config |
| Config validation   | WARN   | Error message needs improvement   |
| Verbose source info | N/A    | No --verbose mode implemented     |

---

## What Was Done Well

- Clean command structure with separate files per command
- Good use of picocolors for consistent styling
- SIGINT handler present in entry point
- Config hierarchy follows correct precedence
- EXIT_CODES constant file well-organized with JSDoc
- Help text includes useful examples

---

## Verdict: REQUEST CHANGES

**Blocking Issues:** 3 (all CLI safety issues)
**Recommended Fixes:** 2 (user experience)
**Suggestions:** 1

**Next Steps:**

1. Add p.isCancel() check after every @clack/prompts call (lines 45, 56, 67)
2. Replace `process.exit(1)` with `process.exit(EXIT_CODES.ERROR)` (line 78)
3. Change `program.parse()` to `await program.parseAsync()` (line 42)
4. Add spinner for fetchTemplates() network call
5. Improve error message actionability
````

---

This example demonstrates:

- Clear structure following CLI-specific output format
- Systematic safety audits (SIGINT, exit codes, cancellation, async)
- Specific file:line references
- Code examples showing current vs. fixed
- Severity markers with CLI-specific categories
- Actionable suggestions
- Recognition of good patterns
