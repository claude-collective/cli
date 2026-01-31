# oclif + Ink Research: CLI Framework Evaluation

> Research document evaluating oclif and Ink as an alternative CLI framework for the Claude Collective CLI.

**Date:** January 2026
**Current Stack:** Commander.js + @clack/prompts + picocolors
**Evaluated Stack:** oclif + Ink (React for CLIs)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [oclif Overview](#oclif-overview)
3. [Ink Overview](#ink-overview)
4. [Combined Approach: oclif + Ink](#combined-approach-oclif--ink)
5. [Migration Considerations](#migration-considerations)
6. [Pros/Cons Comparison](#proscons-comparison)
7. [Recommendation](#recommendation)

---

## Executive Summary

This document evaluates **oclif** (Open CLI Framework by Salesforce/Heroku) and **Ink** (React renderer for CLIs) as potential replacements for our current Commander.js + @clack/prompts stack.

**Key Findings:**

- oclif provides superior plugin architecture, auto-updates, and scaffolding for large CLIs
- Ink offers React's component model for complex, stateful terminal UIs
- The current stack (Commander.js + clack) is well-suited for our current needs
- Migration would require significant refactoring with marginal immediate benefit
- **Recommendation:** Stay with current stack; consider Ink for specific complex UI features if needed

---

## oclif Overview

### What is oclif?

[oclif](https://github.com/oclif/oclif) is a framework for building command-line interfaces in Node.js, originally developed by Heroku and now maintained by Salesforce. It's designed for building everything from simple single-command CLIs to complex multi-command CLIs with subcommands (like `git` or `heroku`).

### Who Uses oclif?

- **Heroku CLI** - The original use case
- **Salesforce CLI (sf/sfdx)** - Enterprise-scale CLI
- **Twilio CLI**
- **Adobe I/O CLI**

### Architecture

#### Commands

Commands in oclif are class-based with static properties for configuration:

```typescript
import { Command, Flags, Args } from "@oclif/core";

export class Init extends Command {
  static summary = "Initialize Claude Collective in this project";
  static description = `Sets up skills, agents, and configuration for your project.`;

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --source github:org/repo",
  ];

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
      description: "Preview operations without executing",
    }),
  };

  static args = {
    path: Args.string({
      description: "Project path",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Init);
    // Command implementation
  }
}
```

#### Hooks

oclif provides lifecycle hooks for extending functionality:

| Hook                | When It Runs                                |
| ------------------- | ------------------------------------------- |
| `init`              | Before command is found                     |
| `prerun`            | After command found, before execution       |
| `postrun`           | After command completes successfully        |
| `command_not_found` | When command doesn't exist                  |
| `finally`           | After command finishes (success or failure) |

Example hook:

```typescript
import { Hook } from "@oclif/core";

const hook: Hook.Init = async function (options) {
  console.log(`Initializing before ${options.id}`);
};

export default hook;
```

#### Plugins

oclif's plugin system is one of its strongest features:

```json
{
  "oclif": {
    "plugins": [
      "@oclif/plugin-help",
      "@oclif/plugin-plugins",
      "@oclif/plugin-autocomplete",
      "@oclif/plugin-update"
    ]
  }
}
```

Key plugin capabilities:

- **User-installable plugins** via `@oclif/plugin-plugins`
- **Auto-complete** for bash/zsh/fish via `@oclif/plugin-autocomplete`
- **Auto-updates** via `@oclif/plugin-update`
- **Plugin discovery** from npm with friendly names

### Key Features

| Feature             | Description                                       |
| ------------------- | ------------------------------------------------- |
| TypeScript First    | Full TypeScript support with type-safe flags/args |
| Plugin Architecture | Extensible with user-installable plugins          |
| Auto-complete       | Shell completion for bash, zsh, fish              |
| Auto-updates        | Self-updating installers                          |
| Command Discovery   | Multiple strategies (pattern, explicit, single)   |
| Low Overhead        | Only loads the command being executed             |

---

## Ink Overview

### What is Ink?

[Ink](https://github.com/vadimdemedes/ink) is a React renderer for the terminal. It lets you build CLI applications using React components, hooks, and the familiar React development model.

### Who Uses Ink?

- **Claude Code** - Anthropic's agentic coding tool
- **Gemini CLI** - Google's agentic coding tool
- **GitHub Copilot CLI**
- **Cloudflare Wrangler**
- **Gatsby CLI**
- **Canva CLI**

### Component Model

Ink provides React components for terminal rendering:

```tsx
import React, { useState } from "react";
import { render, Box, Text, useInput, useApp } from "ink";

const Counter = () => {
  const [count, setCount] = useState(0);
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === "q") {
      exit();
    }
    if (key.upArrow) {
      setCount((c) => c + 1);
    }
    if (key.downArrow) {
      setCount((c) => c - 1);
    }
  });

  return (
    <Box flexDirection="column">
      <Text>Count: {count}</Text>
      <Text dimColor>Use arrows to change, q to quit</Text>
    </Box>
  );
};

render(<Counter />);
```

### Key Components

| Component     | Purpose                           |
| ------------- | --------------------------------- |
| `<Box>`       | Flexbox container (like `<div>`)  |
| `<Text>`      | Text rendering with styles        |
| `<Static>`    | Render items permanently above UI |
| `<Transform>` | Transform output strings          |
| `<Newline>`   | Line breaks                       |
| `<Spacer>`    | Flexible spacing                  |

### Key Hooks

| Hook              | Purpose                         |
| ----------------- | ------------------------------- |
| `useInput`        | Handle keyboard input           |
| `useApp`          | Access app context (exit, etc.) |
| `useFocus`        | Focus management for components |
| `useFocusManager` | Programmatic focus control      |
| `useStdin`        | Raw stdin access                |
| `useStdout`       | Raw stdout access               |
| `useStderr`       | Raw stderr access               |

### Flexbox Layout

Ink uses [Yoga](https://yogalayout.com/) for Flexbox layouts:

```tsx
<Box
  flexDirection="column"
  alignItems="center"
  justifyContent="center"
  padding={1}
  borderStyle="round"
  borderColor="green"
>
  <Text bold>Welcome to My CLI</Text>
  <Text dimColor>Version 1.0.0</Text>
</Box>
```

### Testing with ink-testing-library

[ink-testing-library](https://github.com/vadimdemedes/ink-testing-library) provides React Testing Library-style utilities:

```typescript
import { render } from "ink-testing-library";
import { Counter } from "./counter";

test("renders counter", () => {
  const { lastFrame, stdin } = render(<Counter />);

  expect(lastFrame()).toContain("Count: 0");

  // Simulate up arrow
  stdin.write("\u001B[A");
  expect(lastFrame()).toContain("Count: 1");
});
```

### Related Projects

#### Ink UI

[ink-ui](https://github.com/vadimdemedes/ink-ui) provides pre-built, themeable components:

- Spinners
- Progress bars
- Tables
- Alerts
- And more

#### Pastel

[Pastel](https://github.com/vadimdemedes/pastel) is a Next.js-like framework for CLIs:

- File-system routing for commands
- Zod-powered option parsing
- Auto-generated help
- Built on Commander.js under the hood (version 2.0+)

```
commands/
  index.tsx        # Default command
  init.tsx         # `mycli init`
  config/
    get.tsx        # `mycli config get`
    set.tsx        # `mycli config set`
```

---

## Combined Approach: oclif + Ink

### How They Work Together

oclif and Ink can be combined, with oclif handling:

- Command routing and parsing
- Plugin architecture
- Lifecycle hooks

And Ink handling:

- Complex UI rendering
- Interactive components
- Real-time updates

### Integration Example

```typescript
import { Command, Flags } from "@oclif/core";
import { render } from "ink";
import React from "react";
import { InitWizard } from "../components/init-wizard";

export class Init extends Command {
  static flags = {
    source: Flags.string({ char: "s" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    // Render Ink component
    const { waitUntilExit } = render(
      <InitWizard source={flags.source} onComplete={(result) => {
        // Handle completion
      }} />
    );

    await waitUntilExit();
  }
}
```

### Known Integration Challenges

1. **TSX File Discovery**: oclif's command discovery doesn't automatically pick up `.tsx` files. Requires configuration or using `.ts` files that import JSX.

2. **Build Complexity**: Need to configure Babel/esbuild for JSX transformation alongside oclif's TypeScript setup.

3. **Mixed Paradigms**: Combining class-based oclif commands with functional React components can feel inconsistent.

### Alternative: Pastel

Pastel 2.0 provides a cleaner integration by building on Commander.js (like our current stack) while providing full Ink support with file-system routing. This could be a middle-ground option.

---

## Migration Considerations

### Current CLI Structure

Our current CLI uses:

```typescript
// src/cli/index.ts
import { Command } from "commander";
import { initCommand } from "./commands/init";

const program = new Command();
program.name("cc").description("Claude Collective CLI");
program.addCommand(initCommand);
await program.parseAsync(process.argv);
```

```typescript
// src/cli/commands/init.ts
import { Command } from "commander";
import * as p from "@clack/prompts";

export const initCommand = new Command("init")
  .description("Initialize Claude Collective")
  .option("--source <url>", "Skills source URL")
  .action(async (options) => {
    p.intro("Claude Collective Setup");
    // ... wizard logic using clack prompts
  });
```

### What Would Change with oclif

| Aspect              | Current (Commander.js) | oclif                          |
| ------------------- | ---------------------- | ------------------------------ |
| Command Definition  | Function-based         | Class-based                    |
| Flags/Options       | Chained methods        | Static properties              |
| Parsing             | Automatic              | Explicit `this.parse()`        |
| Directory Structure | Flexible               | Convention-based (`commands/`) |
| Entry Point         | Single file            | Auto-discovered                |

### Migration to oclif Example

```typescript
// src/commands/init.ts (oclif)
import { Command, Flags } from "@oclif/core";
import * as p from "@clack/prompts";

export class Init extends Command {
  static description = "Initialize Claude Collective";

  static flags = {
    source: Flags.string({
      char: "s",
      description: "Skills source URL",
    }),
    refresh: Flags.boolean({
      description: "Force refresh from remote source",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    p.intro("Claude Collective Setup");
    // ... wizard logic (clack prompts still work!)
  }
}
```

### Migration to Ink Example

The wizard (currently 750 lines of imperative clack code) would become:

```tsx
// src/components/wizard.tsx (Ink)
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { SelectInput } from "@inkjs/ui";

interface WizardProps {
  matrix: MergedSkillsMatrix;
  onComplete: (result: WizardResult) => void;
}

export const Wizard: React.FC<WizardProps> = ({ matrix, onComplete }) => {
  const [step, setStep] = useState<WizardStep>("approach");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // React state management instead of imperative while loop
  return (
    <Box flexDirection="column">
      {step === "approach" && (
        <ApproachStep
          onSelect={(approach) => {
            if (approach === "stack") setStep("stack");
            else setStep("category");
          }}
        />
      )}
      {step === "category" && (
        <CategoryStep
          matrix={matrix}
          selectedSkills={selectedSkills}
          onSelect={handleCategorySelect}
        />
      )}
      {/* ... more steps */}
    </Box>
  );
};
```

### Effort Estimation

| Task                               | Estimated Effort |
| ---------------------------------- | ---------------- |
| oclif setup and configuration      | 2-4 hours        |
| Convert 18 commands to class-based | 8-16 hours       |
| Rewrite wizard in Ink/React        | 16-24 hours      |
| Update tests for new structure     | 8-12 hours       |
| Documentation updates              | 4-6 hours        |
| **Total**                          | **38-62 hours**  |

### Breaking Changes

1. **Package.json structure** - oclif requires specific configuration
2. **Command exports** - No longer using `export const xxxCommand`
3. **Test structure** - Different testing patterns
4. **Build process** - Additional compilation for TSX if using Ink

---

## Pros/Cons Comparison

### Commander.js + clack (Current Stack)

| Pros                             | Cons                        |
| -------------------------------- | --------------------------- |
| Lightweight (~5KB)               | No built-in plugin system   |
| Simple, intuitive API            | Manual help generation      |
| 119M weekly downloads            | No auto-complete out of box |
| Excellent documentation          | Flat command structure      |
| Easy to learn                    | Limited extensibility       |
| Works well for small-medium CLIs |                             |
| clack has beautiful UX           |                             |

### oclif

| Pros                           | Cons                                  |
| ------------------------------ | ------------------------------------- |
| Enterprise-grade plugin system | Steeper learning curve                |
| Auto-complete (bash/zsh/fish)  | More opinionated structure            |
| Auto-update support            | Heavier (~28 dependencies min)        |
| TypeScript-first               | 78K weekly downloads (less community) |
| Scaffolding/generators         | Documentation is TypeScript-heavy     |
| Great for large CLIs           | Overkill for simple CLIs              |
| Used by Heroku, Salesforce     |                                       |

### Ink

| Pros                       | Cons                           |
| -------------------------- | ------------------------------ |
| React's component model    | Requires React knowledge       |
| Declarative UI             | Larger bundle (React renderer) |
| State management via hooks | JSX build complexity           |
| Flexbox layouts            | Different testing patterns     |
| ink-testing-library        |                                |
| Used by major CLIs         |                                |

### clack vs Ink (UI Libraries)

| Aspect         | clack                 | Ink                     |
| -------------- | --------------------- | ----------------------- |
| Paradigm       | Promise-based prompts | React components        |
| Bundle Size    | ~80% smaller          | Larger (React renderer) |
| Learning Curve | Simple async/await    | Requires React          |
| Best For       | Sequential prompts    | Complex stateful UIs    |
| Flexibility    | Pre-built components  | Full component system   |

---

## Recommendation

### Short-term (Now): Stay with Current Stack

**Rationale:**

1. Commander.js + clack is working well for our current needs
2. 18 commands is manageable without oclif's scaffolding
3. clack provides excellent UX without React complexity
4. Migration would take 40-60 hours with limited immediate ROI
5. Our plugin system is external (Claude Code plugins), not CLI plugins

### Medium-term: Consider Ink for Specific Features

If we need features like:

- Real-time progress displays
- Complex multi-pane layouts
- Interactive dashboards
- Animated spinners/loaders

Then selectively introduce Ink for those specific components while keeping Commander.js for routing.

### Long-term: Re-evaluate at Scale

Consider oclif when:

- We have 50+ commands
- We need user-installable CLI plugins
- We want auto-update functionality
- Enterprise features become important

### Phased Migration Path (If Needed)

**Phase 1: Ink Integration (Optional)**

- Keep Commander.js
- Add Ink for complex UI components only
- ~8-12 hours effort

**Phase 2: Pastel Evaluation**

- Pastel 2.0 uses Commander.js under the hood
- Provides file-system routing
- Smooth path to Ink
- ~16-24 hours migration

**Phase 3: Full oclif (If Required)**

- Only if plugin architecture becomes critical
- ~40-60 hours migration

### Summary Table

| Scenario            | Recommended Stack            |
| ------------------- | ---------------------------- |
| Current needs       | Commander.js + clack (keep)  |
| Need complex UI     | Commander.js + Ink (partial) |
| Need file routing   | Pastel (Commander.js + Ink)  |
| Need plugin system  | oclif + Ink                  |
| Enterprise features | oclif + Ink                  |

---

## References

### Official Documentation

- [oclif Documentation](https://oclif.io/docs/)
- [oclif GitHub](https://github.com/oclif/oclif)
- [Ink GitHub](https://github.com/vadimdemedes/ink)
- [Ink UI GitHub](https://github.com/vadimdemedes/ink-ui)
- [Pastel GitHub](https://github.com/vadimdemedes/pastel)
- [ink-testing-library](https://github.com/vadimdemedes/ink-testing-library)
- [Commander.js](https://github.com/tj/commander.js)
- [clack](https://www.clack.cc/)

### Articles and Guides

- [Crafting Robust Node.js CLIs with oclif and Commander.js](https://leapcell.io/blog/crafting-robust-node-js-clis-with-oclif-and-commander-js)
- [Building a CLI from scratch with TypeScript and oclif](https://www.joshcanhelp.com/oclif/)
- [Creating CLIs with Ink, React and a bit of magic](https://vadimdemedes.com/posts/creating-clis-with-ink-react-and-a-bit-of-magic)
- [Ink 3 Release Notes](https://vadimdemedes.com/posts/ink-3)
- [Building CLI tools with React using Ink and Pastel](https://medium.com/trabe/building-cli-tools-with-react-using-ink-and-pastel-2e5b0d3e2793)

### Migration Guides

- [oclif V3 Migration Guide](https://github.com/oclif/core/blob/main/guides/V3_MIGRATION.md)
- [oclif Pre-core Migration Guide](https://github.com/oclif/core/blob/main/guides/PRE_CORE_MIGRATION.md)

### Comparisons

- [npm trends: commander vs oclif vs yargs](https://npmtrends.com/commander-vs-oclif-vs-yargs)
- [npm-compare: CLI Libraries](https://npm-compare.com/commander,oclif,vorpal,yargs)
