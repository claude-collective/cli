# CLI Migration Research: Commander.js + @clack/prompts to oclif + Ink

> Comprehensive analysis of the current CLI architecture for migration planning

**Date:** January 2026
**Purpose:** Document current architecture to inform PM migration planning
**Current Stack:** Commander.js v12 + @clack/prompts v0.11 + picocolors v1.1

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture](#2-current-architecture)
   - [Commands Inventory](#21-commands-inventory)
   - [Interactive UI Inventory](#22-interactive-ui-inventory)
   - [State Management Patterns](#23-state-management-patterns)
3. [Dependencies and File Structure](#3-dependencies-and-file-structure)
4. [Advanced UI Requirements Analysis](#4-advanced-ui-requirements-analysis)
5. [Recommended Target Architecture](#5-recommended-target-architecture)
6. [Migration Complexity Assessment](#6-migration-complexity-assessment)
7. [Key Risks and Considerations](#7-key-risks-and-considerations)

---

## 1. Executive Summary

### Current State

The Claude Collective CLI (`cc`) is built with **Commander.js** for command parsing and routing, **@clack/prompts** for interactive terminal UI, and **picocolors** for terminal styling. The CLI provides 21 commands spanning plugin management, skill installation, compilation, and configuration.

### Key Findings

| Aspect               | Current State                  | Migration Impact                      |
| -------------------- | ------------------------------ | ------------------------------------- |
| **Commands**         | 21 commands, well-structured   | Medium - oclif class-based refactor   |
| **Interactive UI**   | Wizard with 5-step flow        | High - Complex Ink component redesign |
| **State Management** | Manual state passing in wizard | Medium - Can leverage Zustand         |
| **Testing**          | Vitest-based unit tests        | Low - Similar testing patterns        |
| **Dependencies**     | 12 runtime dependencies        | Medium - Some replacements needed     |

### Migration Rationale

The migration from Commander.js + @clack/prompts to oclif + Ink addresses:

1. **Advanced UI Limitations** - @clack/prompts lacks multi-column layouts, horizontal tabs, tables, and persistent search fields
2. **Plugin Architecture** - oclif provides enterprise-grade plugin system for extensibility
3. **Complex State Management** - Ink's React model enables Zustand integration for wizard state
4. **Component Reusability** - React components can be composed and themed

---

## 2. Current Architecture

### 2.1 Commands Inventory

#### Core User Commands (Interactive)

| Command     | File                    | Interactive              | Description                             | Complexity |
| ----------- | ----------------------- | ------------------------ | --------------------------------------- | ---------- |
| `init`      | `commands/init.ts`      | **Yes** - Full wizard    | Initialize Claude Collective in project | High       |
| `edit`      | `commands/edit.ts`      | **Yes** - Full wizard    | Modify installed skills via wizard      | High       |
| `compile`   | `commands/compile.ts`   | No                       | Compile agents with skills              | Medium     |
| `update`    | `commands/update.ts`    | **Yes** - Confirm prompt | Update local skills from source         | Medium     |
| `uninstall` | `commands/uninstall.ts` | **Yes** - Confirm prompt | Remove Claude Collective                | Low        |

#### Information Commands (Non-Interactive)

| Command              | File                   | Interactive | Description                      | Complexity |
| -------------------- | ---------------------- | ----------- | -------------------------------- | ---------- |
| `list` (alias: `ls`) | `commands/list.ts`     | No          | Show plugin information          | Low        |
| `search`             | `commands/search.ts`   | No          | Search available skills          | Low        |
| `info`               | `commands/info.ts`     | No          | Show skill details               | Low        |
| `outdated`           | `commands/outdated.ts` | No          | Check for outdated skills        | Low        |
| `diff`               | `commands/diff.ts`     | No          | Show local vs source differences | Low        |
| `doctor`             | `commands/doctor.ts`   | No          | Diagnose configuration issues    | Medium     |
| `validate`           | `commands/validate.ts` | No          | Validate YAML/plugins            | Low        |

#### Configuration Commands

| Command                | File                 | Interactive | Description                | Complexity |
| ---------------------- | -------------------- | ----------- | -------------------------- | ---------- |
| `config show`          | `commands/config.ts` | No          | Show current configuration | Low        |
| `config set`           | `commands/config.ts` | No          | Set global config value    | Low        |
| `config get`           | `commands/config.ts` | No          | Get config value           | Low        |
| `config unset`         | `commands/config.ts` | No          | Remove config value        | Low        |
| `config set-project`   | `commands/config.ts` | No          | Set project-level config   | Low        |
| `config unset-project` | `commands/config.ts` | No          | Remove project config      | Low        |
| `config path`          | `commands/config.ts` | No          | Show config file paths     | Low        |

#### Creation Commands

| Command     | File                    | Interactive          | Description                   | Complexity |
| ----------- | ----------------------- | -------------------- | ----------------------------- | ---------- |
| `new agent` | `commands/new-agent.ts` | **Yes** - Text input | Create custom agent via AI    | Medium     |
| `new skill` | `commands/new-skill.ts` | No                   | Create local skill scaffold   | Low        |
| `eject`     | `commands/eject.ts`     | No                   | Eject templates/config/skills | Low        |
| `version`   | `commands/version.ts`   | No                   | Manage plugin version         | Low        |

#### Build Commands (Development)

| Command             | File                               | Interactive             | Description               | Complexity |
| ------------------- | ---------------------------------- | ----------------------- | ------------------------- | ---------- |
| `build:plugins`     | `commands/compile-plugins.ts`      | No                      | Build skill plugins       | Medium     |
| `build:stack`       | `commands/compile-stack.ts`        | **Yes** - Select prompt | Build stack plugin        | Medium     |
| `build:marketplace` | `commands/generate-marketplace.ts` | No                      | Generate marketplace.json | Low        |

#### Commander.js Patterns Used

```typescript
// Command definition pattern
export const initCommand = new Command("init")
  .description("Initialize Claude Collective in this project")
  .option("--source <url>", "Skills source URL")
  .option("--refresh", "Force refresh from remote source", false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options, command) => {
    // Command implementation
  });

// Subcommand pattern (config)
configCommand.command("set")
  .argument("<key>", "Configuration key")
  .argument("<value>", "Configuration value")
  .action(async (key, value) => { ... });

// Nested commands (new agent/skill)
export const newCommand = new Command("new")
  .addCommand(agentSubcommand)
  .addCommand(skillSubcommand);
```

### 2.2 Interactive UI Inventory

#### @clack/prompts Components Used

| Component     | Import            | Usage Locations                                                   | Count |
| ------------- | ----------------- | ----------------------------------------------------------------- | ----- |
| `intro`       | `p.intro()`       | init, edit, eject, new-agent, new-skill, uninstall                | 6     |
| `outro`       | `p.outro()`       | init, edit, eject, compile, new-agent, new-skill, uninstall, etc. | 12+   |
| `spinner`     | `p.spinner()`     | All commands with async operations                                | 18    |
| `select`      | `p.select()`      | wizard.ts (5 steps), build:stack                                  | 6     |
| `confirm`     | `p.confirm()`     | wizard.ts, update, uninstall                                      | 3     |
| `text`        | `p.text()`        | new-agent (purpose input)                                         | 1     |
| `log.info`    | `p.log.info()`    | Throughout all commands                                           | Many  |
| `log.warn`    | `p.log.warn()`    | Throughout all commands                                           | Many  |
| `log.error`   | `p.log.error()`   | Throughout all commands                                           | Many  |
| `log.success` | `p.log.success()` | new-skill, eject                                                  | 3     |
| `isCancel`    | `p.isCancel()`    | All interactive prompts                                           | 10+   |
| `cancel`      | `p.cancel()`      | init, edit, update, uninstall                                     | 4     |

#### picocolors Usage Patterns

```typescript
import pc from "picocolors";

// Color patterns used throughout
pc.cyan("text"); // Primary accent color
pc.green("text"); // Success/positive
pc.red("text"); // Error
pc.yellow("text"); // Warning
pc.dim("text"); // Secondary/muted
pc.bold("text"); // Emphasis
pc.green("+ added"); // Diff additions
pc.red("- removed"); // Diff removals

// Composite patterns
pc.green(`✓ ${name}`); // Selected item
pc.dim(`${name} (disabled)`); // Disabled item
pc.green("(recommended)"); // Recommendation hint
```

#### Wizard Flow Analysis (`lib/wizard.ts`)

The wizard is the most complex interactive component, managing a 5-step selection flow:

```
                   ┌─────────────────────────────────────────────────────────────┐
                   │                         WIZARD STEPS                         │
                   └─────────────────────────────────────────────────────────────┘
                                              │
                   ┌──────────────────────────┼──────────────────────────────────┐
                   │                          │                                   │
              ┌────▼────┐              ┌──────▼──────┐                           │
              │APPROACH │              │    STACK    │                           │
              │         │───stack───▶  │   SELECT    │                           │
              │ - stack │              └──────┬──────┘                           │
              │ - scratch                     │                                   │
              │ - expert mode                 │                                   │
              │ - install mode                │                                   │
              └────┬────┘                     │                                   │
                   │scratch                   │                                   │
                   ▼                          │                                   │
              ┌────────────┐                  │                                   │
              │  CATEGORY  │◀─────────────────┘                                   │
              │   SELECT   │                                                      │
              │            │──────────────────────────────────────────────────────┤
              └────┬───────┘                                                      │
                   │                                                              │
                   ▼                                                              │
              ┌────────────┐                                                      │
              │ SUBCATEGORY│                                                      │
              │   SELECT   │                                                      │
              └────┬───────┘                                                      │
                   │                                                              │
                   ▼                                                              │
              ┌────────────┐                                                      │
              │   SKILL    │                                                      │
              │   SELECT   │◀─────────────────────────────────────────────────────┤
              │ (toggles)  │                                                      │
              └────┬───────┘                                                      │
                   │ continue                                                     │
                   ▼                                                              │
              ┌────────────┐                                                      │
              │  CONFIRM   │──────────────────────────────────────────────────────┘
              │            │                   (back navigation)
              └────────────┘
```

**Wizard State Interface:**

```typescript
interface WizardState {
  currentStep: WizardStep; // 'approach' | 'stack' | 'category' | 'subcategory' | 'confirm'
  selectedSkills: string[]; // Currently selected skill IDs
  history: WizardStep[]; // Step history for back navigation
  currentTopCategory: string | null; // Active top-level category
  currentSubcategory: string | null; // Active subcategory
  visitedCategories: Set<string>; // Track visited categories
  selectedStack: ResolvedStack | null; // Selected pre-built stack
  lastSelectedCategory: string | null;
  lastSelectedSubcategory: string | null;
  lastSelectedSkill: string | null;
  lastSelectedApproach: string | null;
  expertMode: boolean; // Disable conflict checking
  installMode: "plugin" | "local"; // Installation method
}
```

**Key Wizard Features:**

1. **Back Navigation** - Full step history with `pushHistory()`/`popHistory()`
2. **Selection Header** - Persistent display of current selections
3. **Expert Mode Toggle** - Inline toggle in approach step
4. **Install Mode Toggle** - Switch between plugin/local installation
5. **Dependency Checking** - `getDependentSkills()` for cascade removal
6. **Validation Display** - Shows errors/warnings in confirm step
7. **Screen Clearing** - `clearTerminal()` between steps

### 2.3 State Management Patterns

#### Current Approach

State management is **manual and imperative**:

```typescript
// Wizard state is passed through function calls
const state = createInitialState(options);

while (true) {
  switch (state.currentStep) {
    case "approach": {
      const result = await stepApproach(state);
      if (result === "stack") {
        pushHistory(state);
        state.currentStep = "stack";
      }
      break;
    }
    // ... more cases
  }
}
```

#### State Patterns Identified

| Pattern                 | Location    | Description                         |
| ----------------------- | ----------- | ----------------------------------- |
| **Wizard State Object** | `wizard.ts` | Mutable object passed through steps |
| **History Stack**       | `wizard.ts` | Array for back navigation           |
| **Selection Tracking**  | `wizard.ts` | `selectedSkills` array mutations    |
| **Visited Tracking**    | `wizard.ts` | Set for category visit state        |
| **Option Caching**      | `wizard.ts` | `lastSelected*` for initial values  |

---

## 3. Dependencies and File Structure

### 3.1 Current Dependencies

#### Runtime Dependencies (package.json)

```json
{
  "dependencies": {
    "@clack/prompts": "^0.11.0", // Interactive prompts - REPLACE with @inkjs/ui
    "ajv": "^8.17.1", // JSON Schema validation - KEEP
    "ajv-formats": "^3.0.1", // AJV format extensions - KEEP
    "commander": "^12.1.0", // Command parsing - REPLACE with @oclif/core
    "diff": "^8.0.3", // Text diffing - KEEP
    "fast-glob": "^3.3.0", // File globbing - KEEP
    "fs-extra": "^11.2.0", // File operations - KEEP
    "giget": "^1.2.0", // Git repo fetching - KEEP
    "gray-matter": "^4.0.3", // Frontmatter parsing - KEEP
    "liquidjs": "^10.24.0", // Template engine - KEEP
    "picocolors": "^1.1.0", // Terminal colors - REPLACE with Ink <Text>
    "yaml": "^2.8.2" // YAML parsing - KEEP
  }
}
```

#### Proposed Target Dependencies

```json
{
  "dependencies": {
    "@oclif/core": "^4.x", // Command framework
    "@oclif/plugin-help": "^6.x", // Help command
    "@oclif/plugin-autocomplete": "^3.x", // Shell completion
    "@oclif/plugin-not-found": "^3.x", // "Did you mean?"
    "@oclif/plugin-warn-if-update-available": "^3.x",
    "@oclif/table": "^0.5.x", // Table rendering
    "ink": "^5.x", // React terminal renderer
    "react": "^18.x", // React
    "@inkjs/ui": "^2.x", // Pre-built Ink components
    "zustand": "^5.x", // State management
    "conf": "^13.x", // Persistent config
    "cosmiconfig": "^9.x", // Config file loading
    "zod": "^3.x", // Schema validation
    "execa": "^9.x", // Process execution
    // KEEP existing:
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "diff": "^8.0.3",
    "fast-glob": "^3.3.0",
    "fs-extra": "^11.2.0",
    "giget": "^1.2.0",
    "gray-matter": "^4.0.3",
    "liquidjs": "^10.24.0",
    "yaml": "^2.8.2"
  },
  "devDependencies": {
    "@oclif/test": "^4.x", // Command testing
    "ink-testing-library": "^4.x" // Ink component testing
  }
}
```

### 3.2 File Structure

#### Current Structure

```
src/cli/
├── index.ts                    # Entry point, Commander setup
├── consts.ts                   # Constants
├── types.ts                    # CLI-specific types
├── types-matrix.ts             # Skills matrix types
│
├── commands/                   # 21 command files
│   ├── init.ts                 # 448 lines - Complex wizard integration
│   ├── edit.ts                 # 227 lines - Wizard reuse
│   ├── compile.ts              # 494 lines - Agent compilation
│   ├── config.ts               # 285 lines - Subcommands
│   ├── list.ts                 # 26 lines - Simple display
│   ├── search.ts               # 171 lines - Table output
│   ├── info.ts                 # 283 lines - Detailed display
│   ├── outdated.ts             # 408 lines - Table output
│   ├── update.ts               # 587 lines - Interactive confirm
│   ├── diff.ts                 # 326 lines - Colored diff output
│   ├── doctor.ts               # 514 lines - Health checks
│   ├── validate.ts             # 144 lines - Validation output
│   ├── eject.ts                # 253 lines - File operations
│   ├── uninstall.ts            # 257 lines - Interactive confirm
│   ├── version.ts              # 174 lines - Semver operations
│   ├── new-agent.ts            # 240 lines - AI invocation
│   ├── new-skill.ts            # 222 lines - Scaffold generation
│   ├── compile-plugins.ts      # 68 lines - Build command
│   ├── compile-stack.ts        # 108 lines - Build with select
│   └── generate-marketplace.ts # 102 lines - Build output
│
├── lib/                        # 35 utility modules
│   ├── wizard.ts               # 750 lines - Complex wizard logic
│   ├── matrix-resolver.ts      # Skills matrix resolution
│   ├── config.ts               # Configuration loading
│   ├── config-generator.ts     # Config file generation
│   ├── compiler.ts             # Template compilation
│   ├── resolver.ts             # Agent resolution
│   ├── loader.ts               # Data loading
│   ├── source-loader.ts        # Remote source loading
│   ├── source-fetcher.ts       # Git fetching
│   ├── skill-copier.ts         # Skill file copying
│   ├── skill-fetcher.ts        # Skill retrieval
│   ├── local-skill-loader.ts   # Local skill discovery
│   ├── agent-fetcher.ts        # Agent definitions
│   ├── agent-recompiler.ts     # Agent recompilation
│   ├── plugin-finder.ts        # Plugin discovery
│   ├── plugin-info.ts          # Plugin information
│   ├── plugin-manifest.ts      # Manifest operations
│   ├── plugin-validator.ts     # Plugin validation
│   ├── plugin-version.ts       # Version management
│   ├── stack-plugin-compiler.ts # Stack compilation
│   ├── skill-plugin-compiler.ts # Skill compilation
│   ├── stack-installer.ts      # Stack installation
│   ├── marketplace-generator.ts # Marketplace creation
│   ├── schema-validator.ts     # Schema validation
│   ├── validator.ts            # General validation
│   ├── versioning.ts           # Version utilities
│   ├── permission-checker.ts   # Permission checks
│   ├── project-config.ts       # Project config
│   ├── custom-agent-resolver.ts # Custom agent handling
│   ├── skill-agent-mappings.ts # Skill-agent mappings
│   ├── defaults-loader.ts      # Default loading
│   ├── output-validator.ts     # Output validation
│   ├── exit-codes.ts           # Exit code constants
│   └── matrix-loader.ts        # Matrix loading
│
├── utils/                      # Utility functions
│   ├── fs.ts                   # File system operations
│   ├── logger.ts               # Logging utilities
│   └── exec.ts                 # Process execution
│
└── defaults/
    └── agent-mappings.yaml     # Default agent mappings
```

#### Proposed oclif + Ink Structure

```
src/
├── commands/                   # oclif command classes
│   ├── init.ts                 # Renders <InitWizard />
│   ├── edit.ts                 # Renders <EditWizard />
│   ├── compile.ts              # Non-interactive
│   ├── config/                 # Topic: config
│   │   ├── show.ts
│   │   ├── get.ts
│   │   ├── set.ts
│   │   └── unset.ts
│   ├── new/                    # Topic: new
│   │   ├── agent.ts
│   │   └── skill.ts
│   ├── build/                  # Topic: build
│   │   ├── plugins.ts
│   │   ├── stack.ts
│   │   └── marketplace.ts
│   └── ...
│
├── components/                 # Ink React components
│   ├── wizard/
│   │   ├── wizard.tsx          # Main wizard container
│   │   ├── step-approach.tsx   # Approach selection step
│   │   ├── step-stack.tsx      # Stack selection step
│   │   ├── step-category.tsx   # Category browser
│   │   ├── step-skill.tsx      # Skill selection
│   │   ├── step-confirm.tsx    # Confirmation step
│   │   ├── selection-header.tsx # Persistent header
│   │   └── skill-table.tsx     # Multi-column skill display
│   ├── common/
│   │   ├── spinner.tsx         # Custom spinner
│   │   ├── table.tsx           # Data tables
│   │   ├── diff-view.tsx       # Colored diffs
│   │   ├── search-input.tsx    # Persistent search
│   │   └── tab-navigation.tsx  # Horizontal tabs
│   └── themes/
│       └── default.ts          # Ink UI theme
│
├── stores/                     # Zustand state stores
│   ├── wizard-store.ts         # Wizard state
│   └── config-store.ts         # Configuration state
│
├── hooks/                      # oclif lifecycle hooks
│   ├── init/
│   │   └── check-update.ts     # Update notifications
│   └── prerun/
│       └── load-config.ts      # Config loading
│
├── lib/                        # Business logic (mostly unchanged)
│   └── ... (keep existing)
│
├── utils/                      # Utilities (unchanged)
│   └── ...
│
└── types/                      # TypeScript types
    └── ...
```

---

## 4. Advanced UI Requirements Analysis

### User Requirements

The user has explicitly requested capabilities BEYOND current @clack/prompts:

| Requirement                 | Current Support | Ink Support           | Implementation               |
| --------------------------- | --------------- | --------------------- | ---------------------------- |
| Multi-column layouts        | No              | Yes (Flexbox)         | `<Box flexDirection="row">`  |
| Horizontal tab navigation   | No              | Yes (custom)          | Custom `<Tabs>` component    |
| Tables for subsections      | No              | Yes (`@oclif/table`)  | Skills by category in tables |
| Always-visible search field | No              | Yes (custom)          | Fixed-position `<TextInput>` |
| Complex stateful interfaces | Limited         | Yes (React + Zustand) | Full React component model   |

### Proposed UI Enhancements

#### 1. Multi-Column Skill Browser

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Search: [react_____________________]                              Expert: ON │
├─────────────────────────────────────────────────────────────────────────────┤
│ ◀ Categories ▶   │ ◀ Skills ▶                                               │
│                  │                                                           │
│ > Frontend       │ ┌────────────────────────────────────────────────────────┐│
│   Backend        │ │ Name          Category      Description                ││
│   Testing        │ ├────────────────────────────────────────────────────────┤│
│   DevOps         │ │ ✓ react       state-mgmt    React patterns and hooks  ││
│                  │ │   zustand     state-mgmt    Zustand state management  ││
│                  │ │   tanstack    data-fetch    TanStack Query patterns   ││
│                  │ │   scss        styling       SCSS modules with CVA     ││
│                  │ └────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────┤
│ Selected (3): react, zustand, scss-modules           [Continue] [Back] [?]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 2. Horizontal Tab Navigation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [ Approach ]  [ Stack ]  [ Skills ]  [ Review ]  [ Confirm ]               │
│      ◯           ◯          ●           ◯           ◯                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Select skills for your project:                                            │
│  ...                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 3. Web Skills Category Table

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Web Skills                                                                  │
├──────────────┬──────────────┬──────────────┬───────────────────────────────┤
│ Frameworks   │ State Mgmt   │ Styling      │ Data Fetching                 │
├──────────────┼──────────────┼──────────────┼───────────────────────────────┤
│ ✓ react      │ ✓ zustand    │ ✓ scss       │   tanstack-query              │
│   vue        │   jotai      │   tailwind   │   swr                         │
│   svelte     │   redux      │   css-in-js  │   react-query                 │
└──────────────┴──────────────┴──────────────┴───────────────────────────────┘
```

### Ink Component Requirements

| Component         | Source                | Purpose                         |
| ----------------- | --------------------- | ------------------------------- |
| `Select`          | @inkjs/ui             | Single selection lists          |
| `MultiSelect`     | @inkjs/ui             | Multi-selection with checkboxes |
| `TextInput`       | @inkjs/ui             | Search field                    |
| `Spinner`         | @inkjs/ui             | Loading indicators              |
| `ProgressBar`     | @inkjs/ui             | Progress display                |
| `Alert`           | @inkjs/ui             | Status messages                 |
| `Box`             | ink                   | Flexbox layouts                 |
| `Text`            | ink                   | Styled text                     |
| Custom `Tabs`     | Build                 | Horizontal navigation           |
| Custom `Table`    | Build or @oclif/table | Data tables                     |
| Custom `DiffView` | Build                 | Colored diffs                   |

---

## 5. Recommended Target Architecture

### 5.1 Ecosystem (from oclif-ink-ecosystem.md)

Based on the ecosystem research, the recommended stack:

#### Core Framework

```json
{
  "@oclif/core": "^4.x",
  "ink": "^5.x",
  "react": "^18.x"
}
```

#### UI Components

```json
{
  "@inkjs/ui": "^2.x",
  "@oclif/table": "^0.5.x"
}
```

#### State and Configuration

```json
{
  "zustand": "^5.x",
  "conf": "^13.x",
  "cosmiconfig": "^9.x",
  "zod": "^3.x"
}
```

#### Testing

```json
{
  "@oclif/test": "^4.x",
  "ink-testing-library": "^4.x"
}
```

### 5.2 Command Architecture Pattern

```typescript
// src/commands/init.ts
import { Command, Flags } from "@oclif/core";
import { render } from "ink";
import React from "react";
import { InitWizard } from "../components/wizard/init-wizard.js";

export class Init extends Command {
  static summary = "Initialize Claude Collective in this project";
  static description = "Interactive wizard to set up skills and agents";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --source github:org/repo",
  ];

  static flags = {
    source: Flags.string({
      char: "s",
      description: "Skills source URL"
    }),
    refresh: Flags.boolean({
      description: "Force refresh from remote source",
      default: false
    }),
    "dry-run": Flags.boolean({
      description: "Preview without making changes"
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    const { waitUntilExit } = render(
      <InitWizard
        source={flags.source}
        refresh={flags.refresh}
        dryRun={flags["dry-run"]}
      />
    );

    await waitUntilExit();
  }
}
```

### 5.3 Zustand State Pattern

```typescript
// src/stores/wizard-store.ts
import { create } from "zustand";

interface WizardState {
  step: "approach" | "stack" | "category" | "subcategory" | "skill" | "confirm";
  selectedSkills: string[];
  selectedStack: string | null;
  expertMode: boolean;
  installMode: "plugin" | "local";
  history: string[];

  // Actions
  setStep: (step: WizardState["step"]) => void;
  toggleSkill: (skillId: string) => void;
  selectStack: (stackId: string) => void;
  toggleExpertMode: () => void;
  toggleInstallMode: () => void;
  goBack: () => void;
  reset: () => void;
}

export const useWizardStore = create<WizardState>((set, get) => ({
  step: "approach",
  selectedSkills: [],
  selectedStack: null,
  expertMode: false,
  installMode: "local",
  history: [],

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

  selectStack: (stackId) => set({ selectedStack: stackId }),

  toggleExpertMode: () =>
    set((state) => ({
      expertMode: !state.expertMode,
    })),

  toggleInstallMode: () =>
    set((state) => ({
      installMode: state.installMode === "plugin" ? "local" : "plugin",
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
    }),
}));
```

### 5.4 Ink Component Pattern

```tsx
// src/components/wizard/wizard.tsx
import React from "react";
import { Box, Text, useApp, useInput } from "ink";
import { useWizardStore } from "../../stores/wizard-store.js";
import { StepApproach } from "./step-approach.js";
import { StepStack } from "./step-stack.js";
import { StepCategory } from "./step-category.js";
import { StepConfirm } from "./step-confirm.js";
import { SelectionHeader } from "./selection-header.js";

interface WizardProps {
  source?: string;
  refresh?: boolean;
  dryRun?: boolean;
}

export const Wizard: React.FC<WizardProps> = ({ source, refresh, dryRun }) => {
  const { step, selectedSkills, goBack } = useWizardStore();
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.escape) {
      if (step === "approach") {
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
        return <StepStack source={source} />;
      case "category":
        return <StepCategory />;
      case "confirm":
        return <StepConfirm dryRun={dryRun} />;
      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <SelectionHeader skills={selectedSkills} />
      {renderStep()}
      <Box marginTop={1}>
        <Text dimColor>ESC to go back, Ctrl+C to cancel</Text>
      </Box>
    </Box>
  );
};
```

---

## 6. Migration Complexity Assessment

### 6.1 Component Migration Matrix

| Component        | Current                  | Target                  | Effort | Risk   |
| ---------------- | ------------------------ | ----------------------- | ------ | ------ |
| Entry point      | `commander.parseAsync()` | oclif command discovery | Medium | Low    |
| Command routing  | Commander chaining       | oclif class-based       | Medium | Low    |
| Subcommands      | `program.addCommand()`   | Topic directories       | Low    | Low    |
| Flags/Args       | Commander options        | oclif Flags/Args        | Low    | Low    |
| Help generation  | Commander auto           | oclif plugin-help       | Low    | Low    |
| Wizard state     | Manual object            | Zustand store           | Medium | Medium |
| Wizard UI        | @clack select/confirm    | Ink components          | High   | Medium |
| Spinners         | @clack spinner           | @inkjs/ui Spinner       | Low    | Low    |
| Tables           | picocolors formatting    | @oclif/table            | Medium | Low    |
| Colored output   | picocolors               | Ink `<Text>`            | Medium | Low    |
| Progress display | @clack spinner           | @inkjs/ui ProgressBar   | Low    | Low    |
| Error handling   | Manual + exit codes      | oclif error handling    | Medium | Low    |

### 6.2 Effort Estimates

| Phase                                 | Components              | Est. Hours | Dependencies |
| ------------------------------------- | ----------------------- | ---------- | ------------ |
| **Phase 1: Core Setup**               | oclif scaffold, config  | 8-12       | None         |
| **Phase 2: Non-Interactive Commands** | 12 commands             | 16-24      | Phase 1      |
| **Phase 3: Wizard Core**              | Zustand store, Ink base | 12-16      | Phase 1      |
| **Phase 4: Wizard Steps**             | 5 step components       | 24-32      | Phase 3      |
| **Phase 5: Advanced UI**              | Tables, tabs, search    | 16-24      | Phase 4      |
| **Phase 6: Interactive Commands**     | init, edit, update      | 12-16      | Phase 4      |
| **Phase 7: Testing**                  | Test suite migration    | 16-24      | All          |
| **Phase 8: Polish**                   | Theme, animations       | 8-12       | Phase 5      |

**Total Estimated Effort: 112-160 hours (3-4 weeks full-time)**

### 6.3 Migration Phases

```
Phase 1: Foundation (Week 1)
├── Set up oclif project structure
├── Configure TypeScript + ESM
├── Migrate shared lib/ utilities
└── Basic command scaffolding

Phase 2: Non-Interactive Commands (Week 1-2)
├── list, search, info, outdated, diff
├── doctor, validate, version
├── config subcommands
└── build commands

Phase 3: Wizard Infrastructure (Week 2)
├── Zustand wizard store
├── Base Ink component structure
├── Selection header component
└── Navigation logic

Phase 4: Wizard Steps (Week 2-3)
├── Approach step
├── Stack selection step
├── Category browser
├── Skill selection
└── Confirmation step

Phase 5: Advanced UI (Week 3)
├── Multi-column layouts
├── Horizontal tab navigation
├── Skill tables
├── Persistent search

Phase 6: Interactive Commands (Week 3-4)
├── init command with wizard
├── edit command with wizard
├── update command with confirm
├── uninstall command
└── new agent/skill commands

Phase 7: Testing and Polish (Week 4)
├── @oclif/test integration
├── ink-testing-library setup
├── Migrate existing tests
└── Theme and animations
```

---

## 7. Key Risks and Considerations

### 7.1 Technical Risks

| Risk                        | Impact | Likelihood | Mitigation                              |
| --------------------------- | ------ | ---------- | --------------------------------------- |
| Ink rendering complexity    | High   | Medium     | Start with simple components, iterate   |
| State management overhead   | Medium | Low        | Zustand is lightweight, well-documented |
| oclif startup time (~200ms) | Low    | Certain    | Acceptable for this use case            |
| React 18 compatibility      | Low    | Low        | Ink 5+ requires React 18                |
| TSX file discovery          | Medium | Medium     | Use .ts wrapper files for commands      |
| Cross-platform rendering    | Medium | Medium     | Test on Windows/macOS/Linux             |

### 7.2 Breaking Changes

| Area               | Change                        | User Impact | Communication   |
| ------------------ | ----------------------------- | ----------- | --------------- |
| Command output     | Slightly different formatting | Low         | Changelog       |
| Keyboard shortcuts | ESC for back vs navigating    | Low         | Help text       |
| Wizard flow        | Visual redesign               | Medium      | Demo/video      |
| Config location    | oclif conventions             | Low         | Migration guide |

### 7.3 Compatibility Considerations

1. **Node.js Version** - Current requires Node 18+, oclif + Ink are compatible
2. **ESM Modules** - Both current and target use ESM
3. **TypeScript** - Both use TypeScript, similar configs
4. **Terminal Support** - Ink handles terminal capability detection

### 7.4 Testing Strategy

```typescript
// Command testing with @oclif/test
import { runCommand } from "@oclif/test";

describe("init command", () => {
  it("displays welcome message", async () => {
    const { stdout } = await runCommand(["init", "--dry-run"]);
    expect(stdout).toContain("Claude Collective Setup");
  });
});

// Component testing with ink-testing-library
import { render } from "ink-testing-library";
import { Wizard } from "./wizard";

describe("Wizard component", () => {
  it("renders approach step initially", () => {
    const { lastFrame } = render(<Wizard />);
    expect(lastFrame()).toContain("How would you like to set up");
  });

  it("navigates with keyboard", () => {
    const { lastFrame, stdin } = render(<Wizard />);
    stdin.write("\u001B[B"); // Down arrow
    stdin.write("\r");       // Enter
    expect(lastFrame()).toContain("Stack Selection");
  });
});
```

### 7.5 Rollback Plan

1. Keep current implementation in `legacy/` branch
2. Feature flag for new vs old UI during transition
3. Maintain CLI interface compatibility (same commands, flags)
4. Gradual rollout: internal testing -> beta users -> GA

---

## Appendix A: Files to Migrate

### High Priority (Core Functionality)

- [ ] `src/cli/index.ts` -> oclif entry point
- [ ] `src/cli/lib/wizard.ts` -> Ink components + Zustand store
- [ ] `src/cli/commands/init.ts` -> oclif command + Ink integration
- [ ] `src/cli/commands/edit.ts` -> oclif command + Ink integration
- [ ] `src/cli/commands/compile.ts` -> oclif command

### Medium Priority (Supporting Commands)

- [ ] `src/cli/commands/config.ts` -> oclif topic with subcommands
- [ ] `src/cli/commands/list.ts` -> oclif command
- [ ] `src/cli/commands/search.ts` -> oclif command with table
- [ ] `src/cli/commands/info.ts` -> oclif command
- [ ] `src/cli/commands/update.ts` -> oclif command with confirm
- [ ] `src/cli/commands/uninstall.ts` -> oclif command with confirm

### Low Priority (Dev/Build Commands)

- [ ] `src/cli/commands/validate.ts` -> oclif command
- [ ] `src/cli/commands/eject.ts` -> oclif command
- [ ] `src/cli/commands/version.ts` -> oclif command
- [ ] `src/cli/commands/new-agent.ts` -> oclif command
- [ ] `src/cli/commands/new-skill.ts` -> oclif command
- [ ] `src/cli/commands/compile-*.ts` -> oclif topic: build

### Unchanged (Library Code)

- `src/cli/lib/*.ts` (except wizard.ts) - Business logic unchanged
- `src/cli/utils/*.ts` - Utility functions unchanged
- `src/types.ts` - Type definitions unchanged

---

## Appendix B: Key Code References

### Current Wizard Entry Point

**File:** `/home/vince/dev/cli/src/cli/lib/wizard.ts`
**Lines:** 750
**Key exports:** `runWizard()`, `WizardState`, `WizardResult`

### Current Command Pattern

**File:** `/home/vince/dev/cli/src/cli/commands/init.ts`
**Lines:** 448
**Pattern:** Commander chaining with async action

### Skills Matrix Resolution

**File:** `/home/vince/dev/cli/src/cli/lib/matrix-resolver.ts`
**Key exports:** `getTopLevelCategories()`, `getSubcategories()`, `getAvailableSkills()`, `validateSelection()`

### oclif + Ink Skill Reference

**File:** `/home/vince/dev/claude-subagents/src/skills/cli/framework/oclif-ink (@vince)/SKILL.md`
**Companion files:** `examples.md`, `examples-advanced.md`, `examples-testing.md`

### Ecosystem Research

**File:** `/home/vince/dev/cli/docs/oclif-ink-ecosystem.md`
**Content:** Recommended libraries, comparison tables, best practices

---

_Document generated: January 2026_
_For PM agent migration planning_
