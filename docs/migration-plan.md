# CLI Migration Plan: Commander.js + @clack/prompts to oclif + Ink

> Comprehensive migration plan for the Claude Collective CLI

**Version:** 1.1
**Date:** January 2026
**Status:** APPROVED (with corrections)
**Related Documents:**

- [migration-research.md](./migration-research.md) - Current architecture analysis
- [oclif-ink-ecosystem.md](./oclif-ink-ecosystem.md) - Ecosystem libraries research

---

## CLI Specialist Review Summary

**Reviewer:** CLI Migration Specialist
**Review Date:** January 2026

### Assessment: APPROVED

The migration plan is comprehensive and well-structured. The following corrections and clarifications have been applied:

**Corrections Made:**

1. Fixed oclif `commands` configuration to use object format with `strategy`/`target` (required for oclif v4+)
2. Updated entry point pattern to use `Errors.handle()` and added bin file templates
3. Corrected `@inkjs/ui` component APIs (ConfirmInput callbacks, TextInput events, theme extension)
4. Fixed wizard step enum to match actual implementation (no separate "skill" step)
5. Removed incorrect `external` option from tsup config
6. Added note about Ink version stability (5.x recommended)

**Clarifications Added:**

1. Answered all 6 open questions with detailed technical guidance
2. Added notes about TSX file discovery limitations
3. Documented the nested skill selection pattern within subcategory step
4. Added command-specific migration notes for complex cases
5. Added technical appendix with TSX transpilation and useInput gotchas

**What Was Correct:**

- Overall migration sequence is logical and minimizes broken states
- Zustand integration approach is sound
- Component architecture is well-designed
- Timeline estimates are realistic
- Risk assessment is accurate
- Testing strategy is appropriate

---

## Table of Contents

1. [Overview](#1-overview)
2. [Phase 0: Preparation](#2-phase-0-preparation)
3. [Phase 1: Core Infrastructure](#3-phase-1-core-infrastructure)
4. [Phase 2: Simple Commands First](#4-phase-2-simple-commands-first)
5. [Phase 3: Interactive Components](#5-phase-3-interactive-components)
6. [Phase 4: Wizard Migration](#6-phase-4-wizard-migration)
7. [Phase 5: Polish and Testing](#7-phase-5-polish-and-testing)
8. [Phase 6: Cleanup](#8-phase-6-cleanup)
9. [Appendix: Command Migration Matrix](#9-appendix-command-migration-matrix)

---

## 1. Overview

### 1.1 Goals

| Goal                                | Success Criteria                                                 |
| ----------------------------------- | ---------------------------------------------------------------- |
| **Migrate to oclif**                | All 21 commands functional as oclif command classes              |
| **Migrate to Ink**                  | Interactive prompts replaced with React-based Ink components     |
| **Enable Advanced UI**              | Multi-column layouts, horizontal tabs, persistent search, tables |
| **Maintain Backward Compatibility** | All existing CLI commands work identically                       |
| **Improve Maintainability**         | Component-based architecture, Zustand state management           |

### 1.2 Timeline Estimate

| Phase                           | Estimated Duration | Dependencies |
| ------------------------------- | ------------------ | ------------ |
| Phase 0: Preparation            | 1-2 days           | None         |
| Phase 1: Core Infrastructure    | 2-3 days           | Phase 0      |
| Phase 2: Simple Commands        | 3-4 days           | Phase 1      |
| Phase 3: Interactive Components | 3-4 days           | Phase 2      |
| Phase 4: Wizard Migration       | 5-7 days           | Phase 3      |
| Phase 5: Polish and Testing     | 3-4 days           | Phase 4      |
| Phase 6: Cleanup                | 1-2 days           | Phase 5      |

**Total Estimated Duration: 18-26 days (4-5 weeks)**

### 1.3 Key Decisions Needed

| Decision                 | Options                      | Recommendation                        | Rationale                  |
| ------------------------ | ---------------------------- | ------------------------------------- | -------------------------- |
| **Entry Point Strategy** | Wrapper vs Direct            | Direct oclif                          | Cleaner, less maintenance  |
| **TSX File Handling**    | .ts wrapper vs TSX transpile | .tsx with tsup config                 | Simpler, modern approach   |
| **State Management**     | Zustand vs useState          | Zustand for wizard                    | Complex multi-step state   |
| **Config Persistence**   | conf vs existing YAML        | Keep YAML, add conf for prefs         | Don't break existing users |
| **Testing Framework**    | Keep Vitest vs switch        | Keep Vitest + add ink-testing-library | Minimal disruption         |

### 1.4 Risk Assessment

| Risk                           | Likelihood | Impact | Mitigation                                  |
| ------------------------------ | ---------- | ------ | ------------------------------------------- |
| Breaking existing workflows    | Medium     | High   | Feature parity testing, staged rollout      |
| Ink rendering issues           | Medium     | Medium | Test on multiple terminals, CI environments |
| oclif startup time (~200ms)    | Certain    | Low    | Acceptable for this use case                |
| React 18 bundle size           | Low        | Low    | Tree shaking, lazy loading                  |
| Windows terminal compatibility | Medium     | Medium | Cross-platform testing matrix               |

---

## 2. Phase 0: Preparation

**Duration:** 1-2 days
**Objective:** Set up project structure and dependencies without breaking existing CLI.

### 2.1 Add New Dependencies

**File:** `/home/vince/dev/cli/package.json`

**Add to dependencies:**

```json
{
  "dependencies": {
    "@oclif/core": "^4.0.0",
    "@oclif/plugin-help": "^6.0.0",
    "@oclif/plugin-autocomplete": "^3.0.0",
    "@oclif/plugin-not-found": "^3.0.0",
    "@oclif/plugin-warn-if-update-available": "^3.0.0",
    "@oclif/table": "^0.5.0",
    "ink": "^5.0.0",
    "react": "^18.2.0",
    "@inkjs/ui": "^2.0.0",
    "zustand": "^5.0.0",
    "conf": "^13.0.0",
    "execa": "^9.0.0"
  },
  "devDependencies": {
    "@oclif/test": "^4.0.0",
    "ink-testing-library": "^4.0.0",
    "@types/react": "^18.2.0"
  }
}
```

**Note on Ink version:** The ecosystem research mentions Ink 6.x, but 5.x is more stable. Both work with React 18. If you encounter issues, `ink@^5.0.0` is the safer choice.

````

**Keep existing (do not remove yet):**
- `@clack/prompts` - Still used during migration
- `commander` - Still used during migration
- `picocolors` - Can be removed after migration (replaced by Ink `<Text>`)

**Acceptance Criteria:**
- [ ] `bun install` completes without errors
- [ ] TypeScript compiles without errors
- [ ] Existing CLI still works: `bun cli:dev init --dry-run`

### 2.2 Update TypeScript Configuration

**File:** `/home/vince/dev/cli/tsconfig.json`

**Add/Update:**
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
````

**Acceptance Criteria:**

- [ ] `.tsx` files compile successfully
- [ ] No TypeScript errors on existing code

### 2.3 Update Build Configuration

**File:** `/home/vince/dev/cli/tsup.config.ts`

**Update entry points to include new oclif structure:**

```typescript
export default defineConfig({
  entry: [
    "src/cli/index.ts", // Keep existing for backward compatibility
    "src/cli/index.ts", // New oclif entry point
    "src/cli/commands/**/*.ts", // Command classes
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  // Note: Do NOT externalize ink/react - oclif commands need bundled dependencies
  // The external option is only needed if creating a library, not a CLI
});
```

**Important:** Unlike library builds, CLI distributions should bundle their dependencies. Remove `external: ["ink", "react"]` unless you have a specific reason to externalize them.

**Acceptance Criteria:**

- [ ] Build produces both old and new entry points
- [ ] No build errors

### 2.4 Create oclif Configuration

**Add to package.json:**

```json
{
  "oclif": {
    "bin": "cc",
    "dirname": "claude-collective",
    "commands": {
      "strategy": "pattern",
      "target": "./dist/cli/commands"
    },
    "plugins": [
      "@oclif/plugin-help",
      "@oclif/plugin-autocomplete",
      "@oclif/plugin-not-found",
      "@oclif/plugin-warn-if-update-available"
    ],
    "hooks": {
      "init": "./dist/cli/hooks/init"
    },
    "topicSeparator": " "
  }
}
```

**Note:** The `commands` field should use the object format with `strategy` and `target` for oclif v4+. The string format (`"commands": "./dist/..."`) is deprecated.

```

**Acceptance Criteria:**
- [ ] oclif can discover commands
- [ ] Help command works: `bun cli --help`

### 2.5 Create Directory Structure

**Create new directories:**
```

src/cli/
├── index.ts # oclif entry point
├── base-command.ts # Base command class
├── commands/
│ ├── init.ts
│ ├── edit.ts
│ ├── compile.ts
│ ├── config/
│ │ ├── show.ts
│ │ ├── get.ts
│ │ ├── set.ts
│ │ └── unset.ts
│ └── ... (other commands)
├── components/
│ ├── wizard/
│ │ └── ... (Ink components)
│ └── common/
│ └── ... (shared components)
├── stores/
│ └── wizard-store.ts
└── hooks/
└── init.ts

````

**Acceptance Criteria:**
- [ ] Directory structure created
- [ ] No files moved from `src/cli/` yet

---

## 3. Phase 1: Core Infrastructure

**Duration:** 2-3 days
**Objective:** Create base command class and migrate shared utilities.

### 3.1 Create Base Command Class

**File:** `src/cli/base-command.ts`

**Purpose:** Shared functionality for all commands (config loading, error handling, output formatting).

**Implementation Notes:**
- Extend `@oclif/core` Command class
- Add shared flags (`--dry-run`, `--source`)
- Configure error handling to match existing exit codes
- Load project/global config via existing `lib/config.ts`

**Pattern Reference:**
```typescript
import { Command, Flags } from "@oclif/core";
import { EXIT_CODES } from "../cli/lib/exit-codes";

export abstract class BaseCommand extends Command {
  static baseFlags = {
    "dry-run": Flags.boolean({
      description: "Preview operations without executing",
      default: false,
    }),
  };

  protected handleError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    this.error(message, { exit: EXIT_CODES.ERROR });
  }
}
````

**Acceptance Criteria:**

- [ ] BaseCommand class created
- [ ] Shared flags work across commands
- [ ] Error handling uses existing exit codes

### 3.2 Create oclif Entry Point

**File:** `src/cli/index.ts`

**Implementation Notes:**

- Bootstrap oclif runtime
- Set up SIGINT handling (match existing behavior)
- Configure plugin loading

**Pattern Reference:**

```typescript
import { run, flush, Errors } from "@oclif/core";

run(undefined, import.meta.url)
  .then(() => flush())
  .catch((error) => Errors.handle(error));
```

**Also create bin files:**

**File:** `bin/run.js` (production)

```javascript
#!/usr/bin/env node
import { execute } from "@oclif/core";
await execute({ dir: import.meta.url });
```

**File:** `bin/dev.js` (development with tsx)

```javascript
#!/usr/bin/env -S npx tsx
import { execute } from "@oclif/core";
await execute({ development: true, dir: import.meta.url });
```

**Note:** Use `Errors.handle()` instead of manual error handling - it provides consistent oclif error formatting and proper exit codes.

**Acceptance Criteria:**

- [ ] Entry point runs without errors
- [ ] SIGINT handling works (Ctrl+C exits cleanly)

### 3.3 Create Init Hook

**File:** `src/cli/hooks/init.ts`

**Purpose:** Load configuration before command execution.

**Implementation Notes:**

- Load global config from existing config system
- Set up any required environment variables
- Log startup messages if verbose

**Acceptance Criteria:**

- [ ] Hook runs before each command
- [ ] Config is available to commands

### 3.4 Verify lib/ Utilities Work with oclif

**Files:** All files in `src/cli/lib/` (except `wizard.ts`)

**Task:** Ensure all library modules can be imported from oclif commands.

**Potential Issues:**

- Path resolution differences
- ESM import compatibility

**Acceptance Criteria:**

- [ ] All lib/\* modules importable from `cli/commands/`
- [ ] No runtime errors when accessing utilities

---

## 4. Phase 2: Simple Commands First

**Duration:** 3-4 days
**Objective:** Migrate non-interactive commands to establish patterns.

### 4.1 Migration Order (Easiest First)

| Priority | Command              | Complexity | Notes                            |
| -------- | -------------------- | ---------- | -------------------------------- |
| 1        | `list` (alias: `ls`) | Low        | 26 lines, simple output          |
| 2        | `version`            | Low        | Simple version display           |
| 3        | `validate`           | Low        | Validation output                |
| 4        | `search`             | Low        | Table output - test @oclif/table |
| 5        | `info`               | Low        | Detailed display                 |
| 6        | `diff`               | Low        | Colored diff output              |
| 7        | `outdated`           | Low        | Table output                     |
| 8        | `doctor`             | Medium     | Multiple checks                  |
| 9        | `config` (topic)     | Medium     | 7 subcommands                    |
| 10       | `compile`            | Medium     | No interactive prompts           |
| 11       | `eject`              | Low        | Simple file operations           |
| 12       | `new skill`          | Low        | Scaffold only                    |

### 4.2 Pattern: Simple Command Migration

**Example: Migrating `list` command**

**Current:** `src/cli/commands/list.ts`

```typescript
import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
// ... 26 lines
```

**Target:** `src/cli/commands/list.ts`

```typescript
import { Command } from "@oclif/core";
import { getPluginInfo, formatPluginDisplay } from "../../cli/lib/plugin-info";

export class List extends Command {
  static summary = "Show plugin information";
  static description =
    "Display details about the installed Claude Collective plugin";
  static aliases = ["ls"];

  async run(): Promise<void> {
    const info = await getPluginInfo();

    if (!info) {
      this.warn("No plugin found.");
      this.log("Run 'cc init' to create one.");
      return;
    }

    this.log("");
    this.log(formatPluginDisplay(info));
    this.log("");
  }
}
```

**Note:** For simple non-interactive commands like `list`, you don't need Ink at all. Use `this.log()` for output. Only use Ink `render()` for interactive components.

```

**Acceptance Criteria per Command:**
- [ ] Command runs via oclif: `bun cli <command>`
- [ ] Output matches existing command
- [ ] Flags work identically
- [ ] Exit codes match existing behavior

### 4.3 Pattern: Subcommand (Topic) Migration

**Example: Migrating `config` command**

**Current:** Single file with `configCommand.command("show")` etc.

**Target:** Topic directory structure
```

src/cli/commands/config/
├── show.ts
├── get.ts
├── set.ts
├── unset.ts
├── set-project.ts
├── unset-project.ts
└── path.ts

````

**Each subcommand is a separate file:**
```typescript
// src/cli/commands/config/show.ts
import { Command } from "@oclif/core";

export class ConfigShow extends Command {
  static summary = "Show current effective configuration";

  async run(): Promise<void> {
    // Migration of configCommand.command("show") action
  }
}
````

**Acceptance Criteria:**

- [ ] All 7 config subcommands work
- [ ] `cc config --help` shows all subcommands
- [ ] Output matches existing commands

### 4.4 Pattern: Table Output with @oclif/table

**Example: Migrating `search` command**

**Current:** Manual table formatting with picocolors

```typescript
const header = pc.bold("ID".padEnd(idWidth)) + "  " + ...
```

**Target:** Using @oclif/table

```typescript
import { printTable } from "@oclif/table";

printTable({
  data: results,
  columns: [
    { key: "id", name: "ID" },
    { key: "category", name: "Category" },
    { key: "description", name: "Description" },
  ],
  headerOptions: { bold: true },
});
```

**Acceptance Criteria:**

- [ ] Table renders correctly
- [ ] Works in CI (non-TTY) environments
- [ ] Column widths auto-adjust

### 4.5 Build Commands Migration

**Commands:** `build:plugins`, `build:stack`, `build:marketplace`

**Current:** Separate command files
**Target:** Topic directory `src/cli/commands/build/`

**Acceptance Criteria:**

- [ ] All build commands functional
- [ ] Topic help works: `cc build --help`

---

## 5. Phase 3: Interactive Components

**Duration:** 3-4 days
**Objective:** Build Ink component library and Zustand store.

### 5.1 Create Zustand Wizard Store

**File:** `src/cli/stores/wizard-store.ts`

**Migrate from:** `src/cli/lib/wizard.ts` (WizardState interface, lines 32-46)

**Implementation:**

```typescript
import { create } from "zustand";

interface WizardState {
  // State - NOTE: "skill" is not a separate step in current impl (see note in 6.1)
  step: "approach" | "stack" | "category" | "subcategory" | "confirm";
  selectedSkills: string[];
  selectedStack: ResolvedStack | null;
  expertMode: boolean;
  installMode: "plugin" | "local";
  history: WizardStep[]; // Use typed array, not string[]
  currentTopCategory: string | null;
  currentSubcategory: string | null;
  visitedCategories: Set<string>;

  // Actions
  setStep: (step: WizardState["step"]) => void;
  toggleSkill: (skillId: string) => void;
  selectStack: (stackId: string | null) => void;
  toggleExpertMode: () => void;
  toggleInstallMode: () => void;
  setCategory: (category: string | null) => void;
  setSubcategory: (subcategory: string | null) => void;
  goBack: () => void;
  reset: () => void;
}

export const useWizardStore = create<WizardState>((set, get) => ({
  // Initial state
  step: "approach",
  selectedSkills: [],
  selectedStack: null,
  expertMode: false,
  installMode: "local",
  history: [],
  currentTopCategory: null,
  currentSubcategory: null,
  visitedCategories: new Set(),

  // Actions
  setStep: (step) =>
    set((state) => ({
      step,
      history: [...state.history, state.step],
    })),

  toggleSkill: (skillId) =>
    set((state) => ({
      selectedSkills: state.selectedSkills.includes(skillId)
        ? state.selectedSkills.filter((id) => id !== skillId)
        : [...state.selectedSkills, skillId],
    })),

  goBack: () =>
    set((state) => {
      const newHistory = [...state.history];
      const previousStep = newHistory.pop();
      return {
        step: previousStep ?? "approach",
        history: newHistory,
      };
    }),

  reset: () =>
    set({
      step: "approach",
      selectedSkills: [],
      selectedStack: null,
      expertMode: false,
      installMode: "local",
      history: [],
      currentTopCategory: null,
      currentSubcategory: null,
      visitedCategories: new Set(),
    }),

  // ... other actions
}));
```

**Acceptance Criteria:**

- [ ] Store created with all state from current WizardState
- [ ] All actions implemented
- [ ] History navigation works correctly

### 5.2 Create Common Ink Components

**Directory:** `src/cli/components/common/`

#### 5.2.1 Spinner Component

**File:** `src/cli/components/common/spinner.tsx`

**Purpose:** Replace `p.spinner()` from @clack/prompts

**Use:** `@inkjs/ui` Spinner component with custom styling

```typescript
import { Spinner as InkSpinner } from "@inkjs/ui";

export const Spinner: React.FC<{ label: string }> = ({ label }) => (
  <InkSpinner label={label} />
);
```

#### 5.2.2 Alert/Message Components

**File:** `src/cli/components/common/message.tsx`

**Purpose:** Replace `p.log.info()`, `p.log.warn()`, `p.log.error()`, `p.log.success()`

```typescript
import { Alert } from "@inkjs/ui";

export const InfoMessage: React.FC<{ children: string }> = ({ children }) => (
  <Alert variant="info">{children}</Alert>
);

export const WarningMessage: React.FC<{ children: string }> = ({ children }) => (
  <Alert variant="warning">{children}</Alert>
);

export const ErrorMessage: React.FC<{ children: string }> = ({ children }) => (
  <Alert variant="error">{children}</Alert>
);

export const SuccessMessage: React.FC<{ children: string }> = ({ children }) => (
  <Alert variant="success">{children}</Alert>
);
```

#### 5.2.3 Confirm Component

**File:** `src/cli/components/common/confirm.tsx`

**Purpose:** Replace `p.confirm()`

```typescript
import React from "react";
import { Box, Text } from "ink";
import { ConfirmInput } from "@inkjs/ui";

interface ConfirmProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  defaultValue?: boolean;
}

export const Confirm: React.FC<ConfirmProps> = ({
  message,
  onConfirm,
  onCancel,
  defaultValue = false
}) => (
  <Box flexDirection="column">
    <Text>{message}</Text>
    <ConfirmInput
      onConfirm={onConfirm}
      onCancel={onCancel}
      defaultChoice={defaultValue ? "confirm" : "cancel"}
    />
  </Box>
);
```

**Note:** `@inkjs/ui` ConfirmInput uses separate `onConfirm` and `onCancel` callbacks, not a single callback with boolean. Also, the message must be rendered separately - ConfirmInput doesn't have a message prop.

**Acceptance Criteria:**

- [ ] All common components created
- [ ] Components styled to match existing CLI appearance
- [ ] Components render correctly in terminal

### 5.3 Create Selection Header Component

**File:** `src/cli/components/wizard/selection-header.tsx`

**Migrate from:** `renderSelectionsHeader()` in `wizard.ts` (lines 124-155)

**Implementation:**

```typescript
import React from "react";
import { Box, Text } from "ink";
import { useWizardStore } from "../../stores/wizard-store";

interface SelectionHeaderProps {
  matrix: MergedSkillsMatrix;
}

export const SelectionHeader: React.FC<SelectionHeaderProps> = ({ matrix }) => {
  const selectedSkills = useWizardStore((state) => state.selectedSkills);

  if (selectedSkills.length === 0) {
    return null;
  }

  // Group skills by category
  const byCategory: Record<string, string[]> = {};
  for (const skillId of selectedSkills) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;
    const category = matrix.categories[skill.category];
    const topCategory = category?.parent || skill.category;
    const categoryName = matrix.categories[topCategory]?.name || topCategory;

    if (!byCategory[categoryName]) {
      byCategory[categoryName] = [];
    }
    byCategory[categoryName].push(skill.alias || skill.name);
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Text dimColor>{"─".repeat(50)}</Text>
      <Text bold>  Selected:</Text>
      {Object.entries(byCategory).map(([category, skills]) => (
        <Text key={category}>
          {"  "}<Text color="cyan">{category}</Text>: {skills.join(", ")}
        </Text>
      ))}
      <Text dimColor>{"─".repeat(50)}</Text>
    </Box>
  );
};
```

**Acceptance Criteria:**

- [ ] Component displays selected skills grouped by category
- [ ] Matches visual appearance of current implementation
- [ ] Updates reactively when selections change

### 5.4 Set Up @inkjs/ui Theme

**File:** `src/cli/components/themes/default.ts`

**Purpose:** Configure colors to match existing picocolors usage

```typescript
import { extendTheme, defaultTheme } from "@inkjs/ui";

export const cliTheme = extendTheme(defaultTheme, {
  components: {
    Spinner: {
      styles: {
        frame: () => ({ color: "cyan" }),
        label: () => ({ color: "gray" }),
      },
    },
    Select: {
      styles: {
        focusIndicator: () => ({ color: "cyan" }),
        label: ({ isFocused }) => ({
          color: isFocused ? "cyan" : undefined,
        }),
      },
    },
    StatusMessage: {
      styles: {
        container: ({ variant }) => ({
          borderStyle: "round",
          borderColor:
            variant === "error"
              ? "red"
              : variant === "warning"
                ? "yellow"
                : variant === "success"
                  ? "green"
                  : "blue",
        }),
      },
    },
  },
});
```

**Note:** `extendTheme` requires `defaultTheme` as the first argument. Also use `StatusMessage` instead of `Alert` for the component name, and note that Select uses `focusIndicator` for the cursor styling.

**Acceptance Criteria:**

- [ ] Theme created
- [ ] Colors match existing CLI appearance
- [ ] Theme applied via ThemeProvider in wizard

---

## 6. Phase 4: Wizard Migration

**Duration:** 5-7 days
**Objective:** Migrate the complete wizard flow to Ink components.

### 6.1 Wizard Component Architecture

```
src/cli/components/wizard/
├── wizard.tsx              # Main wizard container
├── step-approach.tsx       # Approach selection step
├── step-stack.tsx          # Stack selection step
├── step-category.tsx       # Category browser
├── step-subcategory.tsx    # Subcategory browser
├── step-skill.tsx          # Skill selection (per subcategory)
├── step-confirm.tsx        # Confirmation step
├── selection-header.tsx    # Persistent header showing selections
├── skill-option.tsx        # Individual skill option component
└── hooks/
    └── use-keyboard.ts     # Keyboard navigation hook
```

**Important Note on Wizard Steps:** The current `wizard.ts` implementation has a unique pattern where the "skill" step is handled as a **nested loop within the subcategory step**, not as a separate step. When the user selects a subcategory, the code enters a `while(true)` loop showing skills until they press "Back". The Zustand store should either:

1. Keep the same pattern (skill selection inline within subcategory component)
2. OR add a proper "skill" step to the state machine

Option 1 is recommended to match current behavior. The skill selection component should be rendered conditionally within `step-subcategory.tsx` based on whether `currentSubcategory` is set.

### 6.2 Main Wizard Container

**File:** `src/cli/components/wizard/wizard.tsx`

**Migrate from:** `runWizard()` in `wizard.ts` (lines 512-750)

**Implementation:**

```typescript
import React, { useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { ThemeProvider } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store";
import { cliTheme } from "../themes/default";
import { SelectionHeader } from "./selection-header";
import { StepApproach } from "./step-approach";
import { StepStack } from "./step-stack";
import { StepCategory } from "./step-category";
import { StepSubcategory } from "./step-subcategory";
import { StepSkill } from "./step-skill";
import { StepConfirm } from "./step-confirm";
import type { MergedSkillsMatrix } from "../../cli/types-matrix";

interface WizardProps {
  matrix: MergedSkillsMatrix;
  onComplete: (result: WizardResult) => void;
  onCancel: () => void;
  initialSkills?: string[];
}

export const Wizard: React.FC<WizardProps> = ({
  matrix,
  onComplete,
  onCancel,
  initialSkills = [],
}) => {
  const { step, goBack, reset } = useWizardStore();
  const { exit } = useApp();

  // Initialize store with initial skills if provided
  React.useEffect(() => {
    if (initialSkills.length > 0) {
      // Set initial state
    }
  }, [initialSkills]);

  // Handle ESC key for back navigation
  useInput((input, key) => {
    if (key.escape) {
      if (step === "approach") {
        onCancel();
        exit();
      } else {
        goBack();
      }
    }
  });

  const renderStep = () => {
    switch (step) {
      case "approach":
        return <StepApproach />;
      case "stack":
        return <StepStack matrix={matrix} />;
      case "category":
        return <StepCategory matrix={matrix} />;
      case "subcategory":
        // StepSubcategory handles skill selection internally when
        // currentSubcategory is set (matching current wizard.ts behavior)
        return <StepSubcategory matrix={matrix} />;
      case "confirm":
        return <StepConfirm matrix={matrix} onComplete={onComplete} />;
      default:
        return null;
    }
  };

  return (
    <ThemeProvider theme={cliTheme}>
      <Box flexDirection="column" padding={1}>
        <SelectionHeader matrix={matrix} />
        {renderStep()}
        <Box marginTop={1}>
          <Text dimColor>ESC to go back, Ctrl+C to cancel</Text>
        </Box>
      </Box>
    </ThemeProvider>
  );
};
```

**Acceptance Criteria:**

- [ ] Wizard container renders
- [ ] Step switching works
- [ ] ESC navigates back
- [ ] Ctrl+C cancels cleanly

### 6.3 Step Components

#### 6.3.1 Approach Step

**File:** `src/cli/components/wizard/step-approach.tsx`

**Migrate from:** `stepApproach()` in `wizard.ts` (lines 242-286)

**Key Features:**

- Display current mode status (Expert Mode, Install Mode)
- Options: "Use a pre-built template", "Start from scratch"
- Toggle options for Expert Mode and Install Mode

**Implementation Pattern:**

```typescript
import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store";

export const StepApproach: React.FC = () => {
  const {
    expertMode,
    installMode,
    toggleExpertMode,
    toggleInstallMode,
    setStep,
  } = useWizardStore();

  const options = [
    {
      value: "stack",
      label: "Use a pre-built template",
    },
    {
      value: "scratch",
      label: "Start from scratch",
    },
    {
      value: "expert",
      label: expertMode
        ? "Expert Mode: ON"
        : "Expert Mode: OFF",
    },
    {
      value: "install",
      label: installMode === "local"
        ? "Install Mode: Local"
        : "Install Mode: Plugin",
    },
  ];

  const handleSelect = (value: string) => {
    switch (value) {
      case "stack":
        setStep("stack");
        break;
      case "scratch":
        setStep("category");
        break;
      case "expert":
        toggleExpertMode();
        break;
      case "install":
        toggleInstallMode();
        break;
    }
  };

  return (
    <Box flexDirection="column">
      {/* Mode status display */}
      <Box marginBottom={1} flexDirection="column">
        {expertMode && (
          <Text color="yellow">
            Expert Mode is ON <Text dimColor>- conflict checking disabled</Text>
          </Text>
        )}
        <Text color="cyan">
          Install Mode: {installMode === "plugin" ? "Plugin" : "Local"}
          <Text dimColor>
            {installMode === "plugin"
              ? " - native Claude plugins"
              : " - copy to .claude/skills/"}
          </Text>
        </Text>
      </Box>

      <Select
        options={options}
        onChange={handleSelect}
      />
    </Box>
  );
};
```

#### 6.3.2 Stack Selection Step

**File:** `src/cli/components/wizard/step-stack.tsx`

**Migrate from:** `stepSelectStack()` in `wizard.ts` (lines 288-302)

#### 6.3.3 Category Selection Step

**File:** `src/cli/components/wizard/step-category.tsx`

**Migrate from:** `stepSelectTopCategory()` in `wizard.ts` (lines 304-349)

**Key Features:**

- Display all top-level categories
- Show unvisited count
- "Back" option at top
- "Continue" option when skills selected

#### 6.3.4 Subcategory Selection Step

**File:** `src/cli/components/wizard/step-subcategory.tsx`

**Migrate from:** `stepSelectSubcategory()` in `wizard.ts` (lines 351-416)

**Key Features:**

- Show subcategories for current top category
- Display selection status per subcategory
- Handle disabled categories

#### 6.3.5 Skill Selection Step

**File:** `src/cli/components/wizard/step-skill.tsx`

**Migrate from:** `stepSelectSkill()` in `wizard.ts` (lines 418-455)

**Key Features:**

- Show skills for current subcategory
- Toggle selection on click
- Show selected/disabled/recommended states
- Handle dependent skill deselection confirmation

#### 6.3.6 Confirmation Step

**File:** `src/cli/components/wizard/step-confirm.tsx`

**Migrate from:** `stepConfirm()` in `wizard.ts` (lines 457-510)

**Key Features:**

- Display all selected skills by category
- Show validation errors/warnings
- "Back" and "Confirm" options

**Acceptance Criteria per Step:**

- [ ] Step renders correctly
- [ ] Keyboard navigation works
- [ ] Selection state persists
- [ ] Transitions to correct next step

### 6.4 Advanced UI Components (User Requirements)

These address the specific user requirements beyond @clack/prompts capabilities.

#### 6.4.1 Multi-Column Skill Layout

**File:** `src/cli/components/wizard/skill-table.tsx`

**Purpose:** Display skills in a multi-column table layout.

**Implementation Pattern:**

```typescript
import React from "react";
import { Box, Text } from "ink";

interface SkillTableProps {
  skills: SkillOption[];
  columns: number;
  onSelect: (skillId: string) => void;
}

export const SkillTable: React.FC<SkillTableProps> = ({
  skills,
  columns,
  onSelect,
}) => {
  // Arrange skills into rows
  const rows: SkillOption[][] = [];
  for (let i = 0; i < skills.length; i += columns) {
    rows.push(skills.slice(i, i + columns));
  }

  return (
    <Box flexDirection="column">
      {rows.map((row, rowIndex) => (
        <Box key={rowIndex} flexDirection="row">
          {row.map((skill) => (
            <Box key={skill.id} width={`${100 / columns}%`} paddingRight={2}>
              <Text color={skill.selected ? "green" : undefined}>
                {skill.selected ? "✓ " : "  "}
                {skill.name}
              </Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};
```

#### 6.4.2 Horizontal Tab Navigation

**File:** `src/cli/components/wizard/tab-navigation.tsx`

**Purpose:** Display wizard steps as horizontal tabs.

```typescript
import React from "react";
import { Box, Text } from "ink";

interface Tab {
  id: string;
  label: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
}) => (
  <Box flexDirection="row" marginBottom={1}>
    {tabs.map((tab, index) => (
      <React.Fragment key={tab.id}>
        <Box paddingX={1}>
          <Text
            bold={tab.id === activeTab}
            color={tab.id === activeTab ? "cyan" : "gray"}
          >
            {tab.label}
          </Text>
          <Text dimColor>
            {tab.id === activeTab ? " ●" : " ○"}
          </Text>
        </Box>
        {index < tabs.length - 1 && <Text dimColor> │ </Text>}
      </React.Fragment>
    ))}
  </Box>
);
```

#### 6.4.3 Persistent Search Field

**File:** `src/cli/components/wizard/search-input.tsx`

**Purpose:** Always-visible search field for filtering skills.

```typescript
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";

interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  isActive?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  placeholder = "Search skills...",
  isActive = true,
}) => {
  const [query, setQuery] = useState("");

  const handleSubmit = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  return (
    <Box borderStyle="single" paddingX={1}>
      <Text>Search: </Text>
      <TextInput
        defaultValue={query}
        onSubmit={handleSubmit}
        placeholder={placeholder}
        isDisabled={!isActive}
      />
    </Box>
  );
};
```

**Important:** `@inkjs/ui` TextInput uses `onSubmit` (called on Enter), not `onChange`. For real-time filtering, you may need to use the lower-level `ink-text-input` package which does support `onChange`, or implement debounced submission. Also use `isDisabled` prop to manage focus when multiple inputs are present.

#### 6.4.4 Category Skills Table

**File:** `src/cli/components/wizard/category-table.tsx`

**Purpose:** Display skills by subcategory in a table format (web/api/cli with subsections).

```typescript
import React from "react";
import { Box, Text } from "ink";

interface CategoryTableProps {
  categories: {
    name: string;
    skills: SkillOption[];
  }[];
  onSelectSkill: (skillId: string) => void;
}

export const CategoryTable: React.FC<CategoryTableProps> = ({
  categories,
  onSelectSkill,
}) => (
  <Box flexDirection="row">
    {categories.map((category) => (
      <Box
        key={category.name}
        flexDirection="column"
        borderStyle="single"
        paddingX={1}
        marginRight={1}
      >
        <Text bold>{category.name}</Text>
        <Box flexDirection="column" marginTop={1}>
          {category.skills.map((skill) => (
            <Text
              key={skill.id}
              color={skill.selected ? "green" : undefined}
            >
              {skill.selected ? "✓" : " "} {skill.name}
            </Text>
          ))}
        </Box>
      </Box>
    ))}
  </Box>
);
```

**Acceptance Criteria:**

- [ ] Multi-column layout renders correctly
- [ ] Tab navigation displays current step
- [ ] Search filters skills in real-time
- [ ] Category table groups skills correctly

### 6.5 Integrate Wizard with init/edit Commands

**File:** `src/cli/commands/init.ts`

**Migrate from:** `src/cli/commands/init.ts`

**Implementation Pattern:**

```typescript
import { Command, Flags } from "@oclif/core";
import { render } from "ink";
import React from "react";
import { Wizard } from "../components/wizard/wizard";
import { loadSkillsMatrixFromSource } from "../../cli/lib/source-loader";

export class Init extends Command {
  static summary = "Initialize Claude Collective in this project";

  static flags = {
    source: Flags.string({
      char: "s",
      description: "Skills source URL",
    }),
    refresh: Flags.boolean({
      description: "Force refresh from remote source",
      default: false,
    }),
    "dry-run": Flags.boolean({
      description: "Preview without making changes",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    this.log("Claude Collective Setup\n");

    if (flags["dry-run"]) {
      this.log("[dry-run] Preview mode - no files will be created");
    }

    // Load skills matrix
    const sourceResult = await loadSkillsMatrixFromSource({
      sourceFlag: flags.source,
      projectDir: process.cwd(),
      forceRefresh: flags.refresh,
    });

    // Render wizard
    const { waitUntilExit } = render(
      <Wizard
        matrix={sourceResult.matrix}
        onComplete={(result) => this.handleComplete(result, sourceResult, flags)}
        onCancel={() => this.handleCancel()}
      />
    );

    await waitUntilExit();
  }

  private handleComplete(result: WizardResult, sourceResult: SourceLoadResult, flags: any): void {
    // Migrate logic from current init.ts (lines 120-447)
    // - Plugin mode installation
    // - Local mode installation
    // - Agent compilation
    // - Config generation
  }

  private handleCancel(): void {
    this.log("Setup cancelled");
    process.exit(0);
  }
}
```

**Acceptance Criteria:**

- [ ] `cc init` runs wizard in Ink
- [ ] `cc edit` runs wizard with existing selections
- [ ] Wizard completes full flow
- [ ] Files created match existing behavior

---

## 7. Phase 5: Polish and Testing

**Duration:** 3-4 days
**Objective:** Complete test migration and polish UX.

### 7.1 Test Migration Strategy

| Test Type         | Current      | Target               | Notes             |
| ----------------- | ------------ | -------------------- | ----------------- |
| Unit tests        | Vitest       | Vitest               | Keep as-is        |
| Command tests     | Vitest mocks | @oclif/test + Vitest | Add oclif testing |
| Component tests   | N/A          | ink-testing-library  | New               |
| Integration tests | Manual       | @oclif/test          | Formalize         |

### 7.2 Command Testing Pattern

**File:** `src/cli/commands/list.test.ts`

```typescript
import { runCommand } from "@oclif/test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as pluginInfo from "../../cli/lib/plugin-info";

describe("list command", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows plugin info when plugin exists", async () => {
    vi.spyOn(pluginInfo, "getPluginInfo").mockResolvedValue({
      name: "test-plugin",
      version: "1.0.0",
      // ... other properties
    });

    const { stdout } = await runCommand(["list"]);

    expect(stdout).toContain("test-plugin");
    expect(stdout).toContain("1.0.0");
  });

  it("shows warning when no plugin found", async () => {
    vi.spyOn(pluginInfo, "getPluginInfo").mockResolvedValue(null);

    const { stdout } = await runCommand(["list"]);

    expect(stdout).toContain("No plugin found");
  });
});
```

### 7.3 Component Testing Pattern

**File:** `src/cli/components/wizard/wizard.test.tsx`

```typescript
import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { Wizard } from "./wizard";

describe("Wizard component", () => {
  const mockMatrix = {
    skills: {},
    categories: {},
    suggestedStacks: [],
  };

  it("renders approach step initially", () => {
    const { lastFrame } = render(
      <Wizard
        matrix={mockMatrix}
        onComplete={() => {}}
        onCancel={() => {}}
      />
    );

    expect(lastFrame()).toContain("How would you like to set up");
  });

  it("navigates with arrow keys", () => {
    const { lastFrame, stdin } = render(
      <Wizard
        matrix={mockMatrix}
        onComplete={() => {}}
        onCancel={() => {}}
      />
    );

    // Press down arrow
    stdin.write("\u001B[B");
    expect(lastFrame()).toContain("Start from scratch");
  });

  it("calls onCancel when ESC pressed at approach step", () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <Wizard
        matrix={mockMatrix}
        onComplete={() => {}}
        onCancel={onCancel}
      />
    );

    // Press ESC
    stdin.write("\u001B");
    expect(onCancel).toHaveBeenCalled();
  });
});
```

### 7.4 Vitest Configuration Update

**File:** `vitest.config.ts`

Add configuration for ink-testing-library:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Disable console interception for @oclif/test
    disableConsoleIntercept: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

### 7.5 Cross-Platform Testing

**Environments to Test:**

- [ ] macOS Terminal
- [ ] macOS iTerm2
- [ ] Linux terminal (Ubuntu)
- [ ] Windows Terminal
- [ ] Windows PowerShell
- [ ] CI environment (GitHub Actions)
- [ ] Non-TTY (pipe output)

**Test Cases:**

- [ ] Colors display correctly
- [ ] Box drawing characters render
- [ ] Keyboard navigation works
- [ ] Spinner animation works
- [ ] Table columns align

### 7.6 Performance Validation

**Metrics to Measure:**

- Startup time (target: < 300ms)
- Time to first render
- Memory usage
- Bundle size

**Acceptance Criteria:**

- [ ] All existing tests pass
- [ ] New command tests added
- [ ] Component tests added
- [ ] Cross-platform testing complete
- [ ] Performance within acceptable range

---

## 8. Phase 6: Cleanup

**Duration:** 1-2 days
**Objective:** Remove old implementation, update documentation.

### 8.1 Remove Old Dependencies

**Remove from package.json:**

```json
{
  "dependencies": {
    "@clack/prompts": "^0.11.0", // REMOVE
    "commander": "^12.1.0", // REMOVE
    "picocolors": "^1.1.0" // REMOVE (replaced by Ink)
  }
}
```

### 8.2 Delete Old Files

**Files to Delete:**

- `src/cli/index.ts` (replaced by `src/cli/index.ts`)
- `src/cli/commands/*.ts` (all migrated)
- `src/cli/lib/wizard.ts` (replaced by Ink components)

**Files to Keep (move to cli):**

- `src/cli/lib/*.ts` (except wizard.ts)
- `src/cli/utils/*.ts`
- `src/cli/consts.ts`
- `src/cli/types*.ts`

### 8.3 Update Entry Points

**package.json:**

```json
{
  "main": "dist/cli/index.js",
  "bin": {
    "cc": "dist/cli/index.js"
  }
}
```

### 8.4 Update Documentation

**Files to Update:**

- `README.md` - Update installation and usage
- `docs/commands.md` - Verify command documentation
- `CHANGELOG.md` - Document migration

### 8.5 Final Validation

**Checklist:**

- [ ] `bun install` has no warnings
- [ ] `bun build` succeeds
- [ ] All tests pass
- [ ] `cc --help` shows all commands
- [ ] All commands work as expected
- [ ] No references to old files

---

## 9. Appendix: Command Migration Matrix

| Command                | Current File                       | Target File                            | Interactive | Status  |
| ---------------------- | ---------------------------------- | -------------------------------------- | ----------- | ------- |
| `init`                 | `commands/init.ts`                 | `cli/commands/init.ts`                 | Full wizard | Pending |
| `edit`                 | `commands/edit.ts`                 | `cli/commands/edit.ts`                 | Full wizard | Pending |
| `compile`              | `commands/compile.ts`              | `cli/commands/compile.ts`              | No          | Pending |
| `update`               | `commands/update.ts`               | `cli/commands/update.ts`               | Confirm     | Pending |
| `uninstall`            | `commands/uninstall.ts`            | `cli/commands/uninstall.ts`            | Confirm     | Pending |
| `list`                 | `commands/list.ts`                 | `cli/commands/list.ts`                 | No          | Pending |
| `search`               | `commands/search.ts`               | `cli/commands/search.ts`               | No          | Pending |
| `info`                 | `commands/info.ts`                 | `cli/commands/info.ts`                 | No          | Pending |
| `outdated`             | `commands/outdated.ts`             | `cli/commands/outdated.ts`             | No          | Pending |
| `diff`                 | `commands/diff.ts`                 | `cli/commands/diff.ts`                 | No          | Pending |
| `doctor`               | `commands/doctor.ts`               | `cli/commands/doctor.ts`               | No          | Pending |
| `validate`             | `commands/validate.ts`             | `cli/commands/validate.ts`             | No          | Pending |
| `config show`          | `commands/config.ts`               | `cli/commands/config/show.ts`          | No          | Pending |
| `config get`           | `commands/config.ts`               | `cli/commands/config/get.ts`           | No          | Pending |
| `config set`           | `commands/config.ts`               | `cli/commands/config/set.ts`           | No          | Pending |
| `config unset`         | `commands/config.ts`               | `cli/commands/config/unset.ts`         | No          | Pending |
| `config set-project`   | `commands/config.ts`               | `cli/commands/config/set-project.ts`   | No          | Pending |
| `config unset-project` | `commands/config.ts`               | `cli/commands/config/unset-project.ts` | No          | Pending |
| `config path`          | `commands/config.ts`               | `cli/commands/config/path.ts`          | No          | Pending |
| `new agent`            | `commands/new-agent.ts`            | `cli/commands/new/agent.ts`            | Text input  | Pending |
| `new skill`            | `commands/new-skill.ts`            | `cli/commands/new/skill.ts`            | No          | Pending |
| `eject`                | `commands/eject.ts`                | `cli/commands/eject.ts`                | No          | Pending |
| `version`              | `commands/version.ts`              | `cli/commands/version.ts`              | No          | Pending |
| `build:plugins`        | `commands/compile-plugins.ts`      | `cli/commands/build/plugins.ts`        | No          | Pending |
| `build:stack`          | `commands/compile-stack.ts`        | `cli/commands/build/stack.ts`          | Select      | Pending |
| `build:marketplace`    | `commands/generate-marketplace.ts` | `cli/commands/build/marketplace.ts`    | No          | Pending |

### Command Migration Notes

**Commands requiring special attention:**

1. **`update` command** - Has interactive confirmation AND handles file operations. Needs careful error handling if user cancels mid-operation.

2. **`new agent` command** - Uses text input for "purpose" field. Consider whether to keep simple `TextInput` or enhance with multi-line support.

3. **`build:stack` command** - Uses `p.select()` for stack selection. Straightforward migration to `@inkjs/ui` Select.

4. **`doctor` command** - Complex output with multiple checks. Consider using listr2 for visual task list display.

**Missing from matrix but mentioned in research:**

- Shell completion is handled by `@oclif/plugin-autocomplete` (plugin, not command)
- Help is handled by `@oclif/plugin-help` (plugin, not command)

---

## Appendix: Open Questions for CLI Specialist Review

1. **TSX in oclif:** What's the best practice for handling `.tsx` files with oclif's command discovery? Use `.ts` wrapper files or configure transpilation?

   **Answer:** oclif does NOT auto-discover `.tsx` files. The recommended approach is to keep command files as `.ts` and import JSX components from separate `.tsx` files. Example:

   ```typescript
   // src/commands/init.ts (discovered by oclif)
   import { render } from "ink";
   import { Wizard } from "../components/wizard.js"; // .tsx file

   export class Init extends Command {
     async run() {
       const { waitUntilExit } = render(<Wizard />);
       await waitUntilExit();
     }
   }
   ```

   Ensure tsup/esbuild is configured to transpile `.tsx` files with the correct JSX settings.

2. **Startup Performance:** The research mentions ~200ms oclif startup time. Any techniques to optimize this for frequently-used commands?

   **Answer:** The ~200ms overhead is largely unavoidable due to plugin discovery and command loading. Mitigation strategies:
   - Use lazy imports (`await import()`) for heavy dependencies inside command `run()` methods
   - Avoid expensive operations in hooks (especially `init` hook)
   - Consider `@oclif/plugin-commands` lazy loading for very large CLIs
   - For this CLI size (21 commands), 200ms is acceptable and typical

3. **State Persistence:** Should wizard state be persisted (e.g., to resume after interrupt)? If so, `conf` or filesystem?

   **Answer:** For a wizard, state persistence is usually NOT recommended because:
   - Interrupted wizards often mean the user wants to start fresh
   - Stale state can cause confusing behavior
   - Skills matrix may have changed between sessions

   If needed for specific cases (e.g., "edit" command remembering last selections), use `conf` for user preferences only, not transient wizard state. The current implementation correctly passes `initialSkills` to the wizard for the edit case.

4. **Terminal Size Handling:** How should the multi-column layout degrade on narrow terminals?

   **Answer:** Use Ink's `useStdout()` hook to detect terminal width:

   ```typescript
   import { useStdout } from "ink";

   const { stdout } = useStdout();
   const width = stdout?.columns ?? 80;
   const columns = width < 80 ? 1 : width < 120 ? 2 : 3;
   ```

   Implement responsive breakpoints:
   - < 80 columns: Single column, vertical stacking
   - 80-120 columns: 2 columns
   - > 120 columns: 3 columns

   Test with `COLUMNS=60` environment variable.

5. **Ink Cleanup:** Any known issues with Ink rendering cleanup when commands error out?

   **Answer:** Yes, there are gotchas:
   - Always wrap Ink components in error boundaries to catch render errors
   - Use `useApp().exit()` for controlled exits, not `process.exit()`
   - If using `this.error()` from within an Ink render, the component may not unmount cleanly
   - **Best practice:** Complete the Ink render first, THEN throw errors:

   ```typescript
   const { waitUntilExit } = render(<Wizard onComplete={setResult} />);
   await waitUntilExit();

   if (result.error) {
     this.error(result.error.message);
   }
   ```

   - For Ctrl+C handling, Ink handles SIGINT gracefully if you're using `useInput` with escape handling

6. **CI Detection:** Best practice for detecting CI environments and disabling interactive UI?

   **Answer:** Use the `ci-info` package or check common environment variables:

   ```typescript
   import ci from "ci-info";

   if (ci.isCI || !process.stdin.isTTY) {
     // Non-interactive mode
     this.error("Interactive wizard requires a TTY. Use --yes flag for CI.");
   }
   ```

   Also check:
   - `process.env.CI`
   - `process.env.CONTINUOUS_INTEGRATION`
   - `!process.stdin.isTTY`
   - `!process.stdout.isTTY`

   The `--yes` or `-y` flag pattern (shown in Phase 2 init command) is the standard approach for CI compatibility.

---

## Appendix: Additional Technical Notes

### TSX File Transpilation

Add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

The `react-jsx` transform (React 17+) is required for Ink 5+ and avoids needing `import React from "react"` in every file.

### Multiple useInput Hooks

When multiple components have `useInput` hooks, they all receive keyboard events. Use the `isActive` option to manage focus:

```typescript
useInput(
  (input, key) => {
    // Handle input
  },
  { isActive: isFocused },
);
```

### Ink and Raw Mode

Ink automatically enters raw mode for keyboard input. If your CLI spawns child processes that need terminal input (like `git commit` without `-m`), you may need to temporarily exit raw mode. Consider using `execa` with `stdio: 'inherit'` for such cases.

---

_Document created: January 2026_
_Reviewed and updated by CLI Migration Specialist_
_Status: APPROVED with corrections applied_
