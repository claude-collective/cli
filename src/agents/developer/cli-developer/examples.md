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

## Verification Checklist

PASS **Success Criteria Met:**

- [x] Command shows current config (verified manually)
- [x] Displays source origin (tested all 5 origins)
- [x] Works with --dry-run flag (verified)
- [x] Handles missing config gracefully (tested)

PASS **Code Quality:**

- [x] Uses EXIT_CODES constants (no magic numbers)
- [x] Follows existing command pattern exactly
- [x] Uses picocolors consistently
- [x] Reuses existing config utilities

PASS **CLI-Specific Quality:**

- [x] parseAsync() used for async action
- [x] No prompts needed (no isCancel checks required)
- [x] SIGINT handler exists in entry point
- [x] Output formatted with pc.cyan(), pc.dim()

PASS **Testing:**

- [x] No existing tests broken (ran `bun test`)
- [x] Build succeeds (ran `bun run build`)

## Files Modified

- src/cli/commands/config.ts (+45 lines, new file)
- src/cli/index.ts (+2 lines)

**Total:** 2 files changed, 47 insertions(+)
```

---

## Example: Interactive Wizard Implementation

````markdown
# Implementation: Project Setup Wizard

## Investigation Notes

**Files Read:**

- src/cli/commands/init.ts:1-120 - Existing init command structure
- src/cli/lib/wizard.ts:1-95 - Wizard state machine pattern
- src/cli/lib/exit-codes.ts:1-20 - Exit code constants

**Pattern Found:**
Wizard uses state machine with history array for back navigation.
Each step returns BACK_VALUE, CONTINUE_VALUE, or selection.
All prompts wrapped with isCancel() checks.

## Implementation Plan

1. Create wizard state interface following lib/wizard.ts
2. Implement step functions for each wizard screen
3. Handle back navigation via history array
4. Use spinner for async operations

## Changes Made

### 1. Created Setup Wizard (src/cli/commands/setup-wizard.ts)

```typescript
import * as p from "@clack/prompts";
import pc from "picocolors";
import { EXIT_CODES } from "../lib/exit-codes";

const BACK_VALUE = "__back__";
const CONTINUE_VALUE = "__continue__";

interface WizardState {
  currentStep: "framework" | "features" | "confirm";
  framework: string | null;
  features: string[];
  history: Array<WizardState["currentStep"]>;
}

export async function runSetupWizard(): Promise<WizardState | null> {
  const state: WizardState = {
    currentStep: "framework",
    framework: null,
    features: [],
    history: [],
  };

  while (true) {
    switch (state.currentStep) {
      case "framework": {
        const result = await p.select({
          message: "Select framework:",
          options: [
            { value: "react", label: "React", hint: "recommended" },
            { value: "vue", label: "Vue" },
          ],
        });

        if (p.isCancel(result)) {
          p.cancel("Setup cancelled");
          process.exit(EXIT_CODES.CANCELLED);
        }

        state.framework = result as string;
        state.history.push("framework");
        state.currentStep = "features";
        break;
      }

      case "features": {
        // ... feature selection with back support
        break;
      }

      case "confirm": {
        // ... confirmation with back support
        break;
      }
    }
  }
}
```
````

## Verification Checklist

PASS **Success Criteria Met:**

- [x] Wizard flows through all steps (verified manually)
- [x] Back navigation works (tested at each step)
- [x] Ctrl+C cancels cleanly (tested)
- [x] Final state contains selections (verified)

PASS **CLI-Specific Quality:**

- [x] p.isCancel() after EVERY prompt
- [x] EXIT_CODES.CANCELLED on cancel
- [x] History array enables back navigation
- [x] State machine pattern followed

## Files Modified

- src/cli/commands/setup-wizard.ts (+89 lines, new file)
- src/cli/index.ts (+3 lines)

**Total:** 2 files changed, 92 insertions(+)

```

---

These examples demonstrate:

- Investigation notes with specific file:line references
- Clear implementation plan
- Changes organized by file
- Complete verification checklist with CLI-specific checks
- No over-engineering (followed existing patterns)
- Concrete file modification summary
- Proper cancellation and exit code handling
```
