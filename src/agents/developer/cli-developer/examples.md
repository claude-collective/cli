## Example Implementation Output

Here's what a complete, high-quality CLI developer output looks like:

```markdown
# Implementation: Add Config Show Command

## Investigation Notes

**Files Read:**

- src/cli/index.ts:1-45 - Entry point structure, SIGINT handler
- src/cli/commands/init.ts:1-89 - Existing command pattern with options
- src/cli/lib/exit-codes.ts:1-20 - Exit code constants
- src/cli/lib/config.ts:45-89 - Config resolution hierarchy

**Pattern Found:**
Commands use `new Command()` with `.action(async (options, command) => {})` pattern.
Global options accessed via `command.optsWithGlobals()`.
All prompts check `p.isCancel()` before proceeding.

## Implementation Plan

1. Create `config show` subcommand following init.ts pattern
2. Use existing `resolveSource()` from lib/config.ts
3. Use picocolors for output formatting
4. Follow exit code constants

## Changes Made

### 1. Created Config Show Command (src/cli/commands/config.ts)

- Added `config show` subcommand
- Displays current effective configuration
- Shows source origin (flag/env/project/global/default)
- Uses existing config resolution utilities

### 2. Registered Command (src/cli/index.ts)

- Imported configCommand
- Added to program.addCommand()

## Verification

**Success Criteria:**

- [x] Command shows current config (verified manually)
- [x] Displays source origin (tested all 5 origins)
- [x] Works with --dry-run flag (verified)
- [x] Handles missing config gracefully (tested)

**Quality Checks:**

- [x] Uses EXIT_CODES constants (no magic numbers)
- [x] Follows existing command pattern exactly
- [x] Reuses existing config utilities

**Build Status:**

- [x] `bun test` passes
- [x] `bun run build` succeeds

## Summary

**Files:** 2 changed (+47 lines)
**Scope:** Added config show command only. Did NOT add config edit/set (not in spec).
**For Reviewer:** Verify output formatting matches other commands.
```
