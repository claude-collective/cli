## Example Review Output

```markdown
# CLI Review: init command

## Files Reviewed

- src/cli/index.ts (45 lines)
- src/cli/commands/init.ts (120 lines)
- src/cli/lib/exit-codes.ts (25 lines)

## Summary

3 critical issues: missing p.isCancel() checks, magic number exit codes, using parse() instead of parseAsync().

## Must Fix

**Issue #1: Missing p.isCancel() check**
- Location: src/cli/commands/init.ts:45
- Problem: p.select() result not checked for cancellation
- Current:
  ```typescript
  const framework = await p.select({ message: "Select framework:", options: [...] });
  const name = await p.text({ message: "Project name:" });
  ```
- Fix:
  ```typescript
  const framework = await p.select({ message: "Select framework:", options: [...] });
  if (p.isCancel(framework)) {
    p.cancel("Setup cancelled");
    process.exit(EXIT_CODES.CANCELLED);
  }
  ```

**Issue #2: Magic number exit code**
- Location: src/cli/commands/init.ts:78
- Problem: `process.exit(1)` instead of named constant
- Fix: Use `process.exit(EXIT_CODES.ERROR)`

**Issue #3: Using parse() instead of parseAsync()**
- Location: src/cli/index.ts:42
- Problem: Errors in async handlers silently swallowed
- Fix: Change `program.parse()` to `await program.parseAsync()`

## Should Fix

**Missing spinner for network call**
- Location: src/cli/commands/init.ts:52
- Issue: fetchTemplates() has no visual feedback
- Suggestion: Wrap with p.spinner()

**Error message not actionable**
- Location: src/cli/commands/init.ts:67
- Issue: "Config invalid" doesn't explain how to fix
- Suggestion: Include validation error and remediation command

## CLI Safety Checklist

- [x] SIGINT handler present
- [ ] p.isCancel() after every prompt - FAIL (lines 45, 56, 67)
- [ ] No magic numbers in process.exit() - FAIL (line 78)
- [ ] parseAsync() used - FAIL (line 42)

## Positive Observations

- Clean command structure with separate files per command
- Good use of picocolors for consistent styling
- EXIT_CODES constant file well-organized with JSDoc

## Verdict: REQUEST CHANGES

Fix 3 blocking CLI safety issues before merge.
```
