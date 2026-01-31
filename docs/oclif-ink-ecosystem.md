# oclif + Ink Ecosystem: Complementary Libraries and Tools

> Comprehensive research on libraries that reduce complexity in the oclif + Ink ecosystem.

**Date:** January 2026
**Purpose:** Identify and evaluate ecosystem libraries for our oclif + Ink migration
**Related:** [oclif-ink-research.md](./oclif-ink-research.md)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Recommended Starter Kit](#recommended-starter-kit)
3. [State Management](#state-management)
4. [Component Libraries for Ink](#component-libraries-for-ink)
5. [Plugin Architecture](#plugin-architecture)
6. [Testing Utilities](#testing-utilities)
7. [Configuration Management](#configuration-management)
8. [Utilities and Helpers](#utilities-and-helpers)
9. [Build and Distribution](#build-and-distribution)
10. [Comparison Tables](#comparison-tables)

---

## Executive Summary

This document catalogs the ecosystem of libraries that complement oclif and Ink, focusing on those that reduce boilerplate, increase reusability, and simplify common patterns. These libraries are analogous to how Zustand simplifies state management in React web applications.

### Top Recommendations

| Category              | Recommended Library                   | Why                                                  |
| --------------------- | ------------------------------------- | ---------------------------------------------------- |
| **State Persistence** | `conf`                                | Purpose-built for CLIs, XDG-compliant, atomic writes |
| **Configuration**     | `cosmiconfig`                         | 47M+ weekly downloads, supports all config formats   |
| **UI Components**     | `@inkjs/ui`                           | Official Ink component library, themeable            |
| **Tables**            | `@oclif/table`                        | Ink-based, CI-safe, handles large datasets           |
| **Task Lists**        | `listr2`                              | 25M+ weekly downloads, concurrent tasks              |
| **Process Execution** | `execa`                               | Cross-platform, promise-based, streaming             |
| **Testing**           | `@oclif/test` + `ink-testing-library` | Official testing utilities                           |
| **Validation**        | `zod`                                 | TypeScript-first, used by Pastel                     |

### Key Ecosystem Insight

The oclif + Ink ecosystem follows a modular philosophy. Unlike monolithic frameworks, you compose your CLI from focused libraries:

- **oclif** handles command routing, parsing, and plugin architecture
- **Ink** handles React-based terminal rendering
- **Ecosystem libraries** handle specific concerns (persistence, config, testing)

---

## Recommended Starter Kit

Based on our research, here is the recommended set of libraries to adopt:

### Core Framework

```json
{
  "dependencies": {
    "@oclif/core": "^4.x",
    "ink": "^6.x",
    "react": "^18.x"
  }
}
```

### Essential Plugins

```json
{
  "dependencies": {
    "@oclif/plugin-help": "^6.x",
    "@oclif/plugin-autocomplete": "^3.x",
    "@oclif/plugin-warn-if-update-available": "^3.x",
    "@oclif/plugin-not-found": "^3.x"
  }
}
```

### UI and Components

```json
{
  "dependencies": {
    "@inkjs/ui": "^2.x",
    "@oclif/table": "^0.5.x"
  }
}
```

### State and Configuration

```json
{
  "dependencies": {
    "conf": "^13.x",
    "cosmiconfig": "^9.x",
    "zod": "^3.x"
  }
}
```

### Utilities

```json
{
  "dependencies": {
    "execa": "^9.x",
    "listr2": "^9.x"
  }
}
```

### Testing

```json
{
  "devDependencies": {
    "@oclif/test": "^4.x",
    "ink-testing-library": "^4.x"
  }
}
```

---

## State Management

### Persistent State: conf

The go-to library for CLI state persistence, created specifically for command-line tools.

| Property             | Value                                |
| -------------------- | ------------------------------------ |
| **Package**          | `conf`                               |
| **npm**              | https://www.npmjs.com/package/conf   |
| **GitHub**           | https://github.com/sindresorhus/conf |
| **Weekly Downloads** | ~5M                                  |

**What it does:**

- Stores configuration as JSON in XDG-compliant directories
- Atomic writes (no corruption on crashes)
- Dot-notation access for nested properties
- JSON Schema validation support
- Optional encryption for obscuring sensitive data

**How it reduces complexity:**

- No need to manage file paths, directories, or JSON parsing
- Automatic handling of platform-specific config directories
- Type-safe with TypeScript generics

**Example usage:**

```typescript
import Conf from "conf";

interface CliConfig {
  lastUsedSource: string;
  selectedSkills: string[];
  preferences: {
    colorMode: "light" | "dark";
  };
}

const config = new Conf<CliConfig>({
  projectName: "claude-collective",
  defaults: {
    selectedSkills: [],
    preferences: { colorMode: "dark" },
  },
});

// Get/Set with dot notation
config.set("preferences.colorMode", "light");
const skills = config.get("selectedSkills");
```

### Alternative: configstore

| Property    | Value                                               |
| ----------- | --------------------------------------------------- |
| **Package** | `configstore`                                       |
| **npm**     | https://www.npmjs.com/package/configstore           |
| **Note**    | Older alternative; `conf` is the modern replacement |

### Runtime State: Zustand (For Ink Components)

Since Ink is React-based, Zustand works perfectly for managing runtime state across components.

| Property             | Value                                 |
| -------------------- | ------------------------------------- |
| **Package**          | `zustand`                             |
| **npm**              | https://www.npmjs.com/package/zustand |
| **Weekly Downloads** | ~7M                                   |

**What it does:**

- Lightweight state management (2KB)
- No Provider component required
- Works with React hooks
- Middleware support for persistence, logging

**Example with Ink:**

```typescript
import { create } from "zustand";

interface WizardState {
  step: "approach" | "category" | "skills" | "confirm";
  selectedSkills: string[];
  setStep: (step: WizardState["step"]) => void;
  toggleSkill: (skillId: string) => void;
}

export const useWizardStore = create<WizardState>((set) => ({
  step: "approach",
  selectedSkills: [],
  setStep: (step) => set({ step }),
  toggleSkill: (skillId) =>
    set((state) => ({
      selectedSkills: state.selectedSkills.includes(skillId)
        ? state.selectedSkills.filter((id) => id !== skillId)
        : [...state.selectedSkills, skillId],
    })),
}));
```

---

## Component Libraries for Ink

### @inkjs/ui (Official)

The official component library for Ink, providing pre-built UI components.

| Property             | Value                                   |
| -------------------- | --------------------------------------- |
| **Package**          | `@inkjs/ui`                             |
| **npm**              | https://www.npmjs.com/package/@inkjs/ui |
| **GitHub**           | https://github.com/vadimdemedes/ink-ui  |
| **Weekly Downloads** | ~250K                                   |

**Components included:**

| Component                       | Description                                     |
| ------------------------------- | ----------------------------------------------- |
| `Spinner`                       | Loading indicator with customizable frames      |
| `ProgressBar`                   | Progress indicator (0-100%)                     |
| `TextInput`                     | Text input with cursor navigation               |
| `PasswordInput`                 | Masked text input                               |
| `Select`                        | Single-select dropdown                          |
| `MultiSelect`                   | Multi-select with checkboxes                    |
| `ConfirmInput`                  | Yes/No confirmation                             |
| `Alert`                         | Status messages (info, warning, error, success) |
| `Badge`                         | Status indicators                               |
| `StatusMessage`                 | Feedback messages                               |
| `OrderedList` / `UnorderedList` | List components                                 |

**Theming support:**

```typescript
import { ThemeProvider, extendTheme, Spinner } from '@inkjs/ui';

const customTheme = extendTheme({
  components: {
    Spinner: {
      styles: {
        frame: () => ({ color: 'cyan' }),
        label: () => ({ color: 'gray' })
      }
    }
  }
});

const App = () => (
  <ThemeProvider theme={customTheme}>
    <Spinner label="Loading..." />
  </ThemeProvider>
);
```

### Individual Ink Components

For more granular control, individual packages are available:

| Package            | Description                           | Weekly Downloads |
| ------------------ | ------------------------------------- | ---------------- |
| `ink-text-input`   | Text input component                  | ~500K            |
| `ink-select-input` | Select input with arrow navigation    | ~300K            |
| `ink-spinner`      | Spinner using cli-spinners collection | ~400K            |
| `ink-table`        | Table rendering                       | ~250K            |
| `ink-big-text`     | Large ASCII text headers              | ~100K            |
| `ink-gradient`     | Gradient text effects                 | ~50K             |
| `ink-link`         | Clickable terminal links              | ~100K            |

### @oclif/table

Purpose-built table component for oclif CLIs.

| Property    | Value                                      |
| ----------- | ------------------------------------------ |
| **Package** | `@oclif/table`                             |
| **npm**     | https://www.npmjs.com/package/@oclif/table |
| **Version** | 0.5.x                                      |

**Features:**

- Ink-based rendering
- Automatic terminal width detection
- CI-safe (falls back to plain text in CI)
- Handles 10,000+ rows efficiently
- Column width customization

**Example:**

```typescript
import { printTable } from "@oclif/table";

printTable({
  data: skills,
  columns: ["name", "category", "status"],
  headerOptions: { bold: true, color: "blue" },
});
```

---

## Plugin Architecture

### Official oclif Plugins

oclif provides a comprehensive set of official plugins:

| Plugin                                   | Description                            | Recommendation       |
| ---------------------------------------- | -------------------------------------- | -------------------- |
| `@oclif/plugin-help`                     | Help command and `--help` flag         | Essential            |
| `@oclif/plugin-autocomplete`             | Shell completion (bash/zsh/powershell) | Essential            |
| `@oclif/plugin-not-found`                | "Did you mean?" suggestions            | Recommended          |
| `@oclif/plugin-warn-if-update-available` | Update notifications                   | Recommended          |
| `@oclif/plugin-update`                   | Self-update functionality              | For distributed CLIs |
| `@oclif/plugin-plugins`                  | User-installable plugins               | For extensible CLIs  |
| `@oclif/plugin-commands`                 | List all commands                      | Optional             |
| `@oclif/plugin-version`                  | Version command                        | Optional             |
| `@oclif/plugin-which`                    | Show plugin source for command         | Debugging            |
| `@oclif/plugin-search`                   | Search commands                        | Large CLIs           |

### Plugin Best Practices

**Configuration in package.json:**

```json
{
  "oclif": {
    "plugins": [
      "@oclif/plugin-help",
      "@oclif/plugin-autocomplete",
      "@oclif/plugin-not-found",
      "@oclif/plugin-warn-if-update-available"
    ],
    "hooks": {
      "init": "./dist/hooks/init",
      "prerun": "./dist/hooks/prerun"
    }
  }
}
```

**Hook patterns:**

```typescript
// hooks/init.ts
import { Hook } from "@oclif/core";

const hook: Hook.Init = async function (options) {
  // Load configuration
  // Check authentication
  // Set up telemetry
};

export default hook;
```

### Creating Custom Plugins

Plugins are separate npm packages with oclif configuration:

```json
{
  "name": "@myorg/plugin-analytics",
  "oclif": {
    "commands": "./dist/commands",
    "hooks": {
      "postrun": "./dist/hooks/analytics"
    }
  }
}
```

---

## Testing Utilities

### @oclif/test

Official testing library for oclif commands.

| Property    | Value                                     |
| ----------- | ----------------------------------------- |
| **Package** | `@oclif/test`                             |
| **npm**     | https://www.npmjs.com/package/@oclif/test |
| **GitHub**  | https://github.com/oclif/test             |

**Key utilities:**

| Function        | Purpose                                          |
| --------------- | ------------------------------------------------ |
| `captureOutput` | Capture stdout, stderr, return value, and errors |
| `runCommand`    | Execute a command and capture output             |
| `runHook`       | Execute a hook and capture output                |

**Example:**

```typescript
import { runCommand } from "@oclif/test";
import { expect } from "chai";

describe("init command", () => {
  it("displays welcome message", async () => {
    const { stdout } = await runCommand(["init"]);
    expect(stdout).to.contain("Claude Collective Setup");
  });

  it("handles --dry-run flag", async () => {
    const { stdout } = await runCommand(["init", "--dry-run"]);
    expect(stdout).to.contain("Dry run mode");
  });
});
```

**Configuration note:** Disable console interception in your test runner:

- Jest: Enable `verbose` flag
- Vitest: Enable `disableConsoleIntercept`

### ink-testing-library

React Testing Library-style utilities for Ink components.

| Property    | Value                                               |
| ----------- | --------------------------------------------------- |
| **Package** | `ink-testing-library`                               |
| **npm**     | https://www.npmjs.com/package/ink-testing-library   |
| **GitHub**  | https://github.com/vadimdemedes/ink-testing-library |

**API:**

| Method/Property         | Description                                |
| ----------------------- | ------------------------------------------ |
| `render(<Component />)` | Render component and return test utilities |
| `lastFrame()`           | Get the last rendered frame                |
| `frames`                | Array of all rendered frames               |
| `rerender(element)`     | Re-render with new props                   |
| `stdin.write(input)`    | Simulate keyboard input                    |
| `unmount()`             | Unmount the component                      |

**Example:**

```typescript
import { render } from 'ink-testing-library';
import { Wizard } from './wizard';

describe('Wizard component', () => {
  it('renders initial step', () => {
    const { lastFrame } = render(<Wizard />);
    expect(lastFrame()).toContain('Select your approach');
  });

  it('navigates with arrow keys', () => {
    const { lastFrame, stdin } = render(<Wizard />);

    // Press down arrow
    stdin.write('\u001B[B');
    expect(lastFrame()).toContain('> Category-based');
  });

  it('selects with enter', () => {
    const { lastFrame, stdin } = render(<Wizard />);

    stdin.write('\r'); // Enter key
    expect(lastFrame()).toContain('Stack Selection');
  });
});
```

---

## Configuration Management

### cosmiconfig

The standard library for loading configuration files.

| Property             | Value                                      |
| -------------------- | ------------------------------------------ |
| **Package**          | `cosmiconfig`                              |
| **npm**              | https://www.npmjs.com/package/cosmiconfig  |
| **GitHub**           | https://github.com/cosmiconfig/cosmiconfig |
| **Weekly Downloads** | ~47M                                       |

**What it does:**

- Searches for config files in standard locations
- Supports JSON, YAML, JS, TS, CJS, MJS formats
- Package.json property support
- Config file imports (`$import`)
- Caching for performance

**Default search places (for "myapp"):**

- `package.json` (myapp property)
- `.myapprc`
- `.myapprc.json`, `.myapprc.yaml`, `.myapprc.yml`
- `.myapprc.js`, `.myapprc.ts`, `.myapprc.mjs`, `.myapprc.cjs`
- `.config/myapprc.*`
- `myapp.config.js`, `myapp.config.ts`, etc.

**Example:**

```typescript
import { cosmiconfig } from "cosmiconfig";

const explorer = cosmiconfig("claudecollective");

const loadConfig = async () => {
  const result = await explorer.search();

  if (result) {
    console.log(`Config found at: ${result.filepath}`);
    return result.config;
  }

  return null;
};
```

**With Zod validation:**

```typescript
import { cosmiconfig } from "cosmiconfig";
import { z } from "zod";

const ConfigSchema = z.object({
  source: z.string().url().optional(),
  skills: z.array(z.string()).default([]),
  agents: z.record(z.string()).default({}),
});

type Config = z.infer<typeof ConfigSchema>;

const loadAndValidateConfig = async (): Promise<Config> => {
  const explorer = cosmiconfig("claudecollective");
  const result = await explorer.search();

  return ConfigSchema.parse(result?.config ?? {});
};
```

### Environment Variables: dotenv

Standard library for loading environment variables.

| Property             | Value                                |
| -------------------- | ------------------------------------ |
| **Package**          | `dotenv`                             |
| **npm**              | https://www.npmjs.com/package/dotenv |
| **Weekly Downloads** | ~35M                                 |

**Note:** Node.js 20+ has native `.env` file support via `--env-file` flag.

**For CLI distribution, consider `dotenv-cli`:**

```json
{
  "scripts": {
    "dev": "dotenv -e .env.local -- node ./bin/run"
  }
}
```

---

## Utilities and Helpers

### Process Execution: execa

The best library for spawning child processes.

| Property             | Value                                 |
| -------------------- | ------------------------------------- |
| **Package**          | `execa`                               |
| **npm**              | https://www.npmjs.com/package/execa   |
| **GitHub**           | https://github.com/sindresorhus/execa |
| **Weekly Downloads** | ~60M                                  |

**Why use execa over child_process:**

- Promise-based API
- Better Windows support (shebangs, PATHEXT)
- Streaming and piping support
- No shell injection risks
- Graceful termination
- Detailed error messages

**Example:**

```typescript
import { execa, execaCommand } from "execa";

// Simple command
const { stdout } = await execa("git", ["status"]);

// With options
const result = await execa("npm", ["install"], {
  cwd: projectPath,
  stdio: "inherit", // Stream to terminal
});

// Parse command string
await execaCommand('git commit -m "Initial commit"');

// Streaming
const subprocess = execa("npm", ["run", "build"]);
subprocess.stdout.pipe(process.stdout);
await subprocess;
```

### Task Lists: listr2

For displaying multiple concurrent or sequential tasks.

| Property             | Value                                |
| -------------------- | ------------------------------------ |
| **Package**          | `listr2`                             |
| **npm**              | https://www.npmjs.com/package/listr2 |
| **GitHub**           | https://github.com/listr2/listr2     |
| **Weekly Downloads** | ~25M                                 |

**When to use:**

- Multiple tasks with individual spinners
- Concurrent task execution
- Nested subtasks
- Task dependencies

**Example:**

```typescript
import { Listr } from "listr2";

const tasks = new Listr([
  {
    title: "Fetching skills manifest",
    task: async (ctx) => {
      ctx.manifest = await fetchManifest();
    },
  },
  {
    title: "Installing dependencies",
    task: async (ctx, task) => {
      return task.newListr(
        [
          { title: "Core packages", task: () => installCore() },
          { title: "Optional packages", task: () => installOptional() },
        ],
        { concurrent: true },
      );
    },
  },
  {
    title: "Generating configuration",
    task: async (ctx) => {
      await generateConfig(ctx.manifest);
    },
  },
]);

await tasks.run();
```

### Output Formatting: chalk

Terminal string styling.

| Property             | Value                               |
| -------------------- | ----------------------------------- |
| **Package**          | `chalk`                             |
| **npm**              | https://www.npmjs.com/package/chalk |
| **Weekly Downloads** | ~200M                               |

**Note:** Ink's `<Text>` component handles most styling needs. Use chalk for non-Ink output or logging.

**Alternative:** `kleur` - smaller, faster, drop-in replacement

### Spinners: ora

Single spinner for loading states (outside of Ink).

| Property             | Value                             |
| -------------------- | --------------------------------- |
| **Package**          | `ora`                             |
| **npm**              | https://www.npmjs.com/package/ora |
| **Weekly Downloads** | ~20M                              |

**Note:** For Ink-based UIs, use `@inkjs/ui` Spinner instead.

### Logging: signale

Hackable console logger.

| Property    | Value                                 |
| ----------- | ------------------------------------- |
| **Package** | `signale`                             |
| **npm**     | https://www.npmjs.com/package/signale |

**Provides:** Scoped loggers, timers, custom types, interactive mode

---

## Build and Distribution

### oclif Built-in Tools

oclif includes commands for packaging and distribution:

| Command                 | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `oclif pack tarballs`   | Build standalone tarballs with Node.js bundled |
| `oclif pack macos`      | Build macOS .pkg installer                     |
| `oclif pack win`        | Build Windows installer (requires 7zip, nsis)  |
| `oclif pack deb`        | Build Debian package                           |
| `oclif upload tarballs` | Upload to S3                                   |
| `oclif promote`         | Promote version between release channels       |

### Auto-Update: @oclif/plugin-update

| Property    | Value                                              |
| ----------- | -------------------------------------------------- |
| **Package** | `@oclif/plugin-update`                             |
| **npm**     | https://www.npmjs.com/package/@oclif/plugin-update |
| **Version** | 4.7.x                                              |

**Configuration:**

```json
{
  "oclif": {
    "update": {
      "s3": {
        "bucket": "my-cli-releases"
      },
      "autoupdate": {
        "debounce": 7
      }
    }
  }
}
```

### S3 Distribution

```bash
# Build tarballs
oclif pack tarballs

# Upload to S3 (requires AWS credentials)
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
oclif upload tarballs

# Promote to stable channel
oclif promote --version 1.2.3 --channel stable
```

### Snap (Linux)

```bash
# Build snap package
oclif pack snap

# Publish to Snap Store
snapcraft upload ./dist/snap/*.snap
```

---

## Comparison Tables

### State Management Options

| Library        | Use Case                | Size | Persistence | Type Safety         |
| -------------- | ----------------------- | ---- | ----------- | ------------------- |
| `conf`         | CLI config persistence  | 50KB | File-based  | TypeScript generics |
| `configstore`  | Legacy CLI config       | 40KB | File-based  | Basic               |
| `zustand`      | React/Ink runtime state | 2KB  | Optional    | Excellent           |
| `node-persist` | Simple key-value        | 30KB | File-based  | Basic               |

### UI Component Options

| Library              | Components | Theming | Bundle Size | Ink Version |
| -------------------- | ---------- | ------- | ----------- | ----------- |
| `@inkjs/ui`          | 12+        | Yes     | Medium      | 3.x+        |
| `ink-*` (individual) | 1 each     | No      | Small       | Varies      |
| `@oclif/table`       | Table only | Limited | Small       | 3.x+        |
| `listr2`             | Task lists | Yes     | Medium      | N/A         |

### Configuration Options

| Library       | Formats            | Search         | Caching   | Validation     |
| ------------- | ------------------ | -------------- | --------- | -------------- |
| `cosmiconfig` | JSON, YAML, JS, TS | Multi-location | Yes       | External (Zod) |
| `dotenv`      | .env only          | Single file    | No        | No             |
| `conf`        | JSON only          | Fixed location | Automatic | JSON Schema    |

### Testing Options

| Library               | For             | Approach         | Mocking          |
| --------------------- | --------------- | ---------------- | ---------------- |
| `@oclif/test`         | oclif commands  | Capture output   | Built-in         |
| `ink-testing-library` | Ink components  | Render frames    | stdin simulation |
| `vitest` / `jest`     | General testing | Unit/Integration | Standard         |

### Argument Parsing (Pre-oclif Reference)

| Library     | Style              | Size   | TypeScript | Subcommands |
| ----------- | ------------------ | ------ | ---------- | ----------- |
| `commander` | Fluent             | 50KB   | Good       | Yes         |
| `yargs`     | Fluent/Declarative | 290KB  | Good       | Yes         |
| `meow`      | Declarative        | 30KB   | Excellent  | Limited     |
| `oclif`     | Class-based        | 200KB+ | Excellent  | Yes         |

---

## References

### Official Resources

- [oclif Documentation](https://oclif.io/docs/) - Complete framework guide
- [oclif GitHub](https://github.com/oclif/oclif) - Source and issues
- [Ink GitHub](https://github.com/vadimdemedes/ink) - React renderer for CLI
- [Ink UI GitHub](https://github.com/vadimdemedes/ink-ui) - Component library
- [Pastel GitHub](https://github.com/vadimdemedes/pastel) - Next.js-like CLI framework

### Articles and Tutorials

- [Test-Driven Development With The oclif Testing Library](https://dzone.com/articles/test-driven-development-with-the-oclif-testing-lib) - TDD approach
- [Building CLI tools with React using Ink and Pastel](https://medium.com/trabe/building-cli-tools-with-react-using-ink-and-pastel-2e5b0d3e2793) - Integration guide
- [Creating CLIs with Ink, React and a bit of magic](https://vadimdemedes.com/posts/creating-clis-with-ink-react-and-a-bit-of-magic) - Vadim Demedes's guide
- [Using Ink UI with React to build interactive, custom CLIs](https://blog.logrocket.com/using-ink-ui-react-build-interactive-custom-clis/) - LogRocket tutorial
- [Interactive Terminal Apps with Ink 3](https://www.infoq.com/news/2020/08/ink3-hooks-devtool-terminal-apps/) - Ink 3 features

### npm Package Pages

- [conf](https://www.npmjs.com/package/conf)
- [cosmiconfig](https://www.npmjs.com/package/cosmiconfig)
- [@inkjs/ui](https://www.npmjs.com/package/@inkjs/ui)
- [@oclif/test](https://www.npmjs.com/package/@oclif/test)
- [ink-testing-library](https://www.npmjs.com/package/ink-testing-library)
- [execa](https://www.npmjs.com/package/execa)
- [listr2](https://www.npmjs.com/package/listr2)
- [zod](https://www.npmjs.com/package/zod)

### Community Resources

- [Build Custom CLI Tooling with oclif and React-Ink](https://github.com/zacjones93/community-notes-build-custom-cli-tooling-with-oclif-and-react-ink) - Workshop notes
- [npm trends: CLI libraries](https://npmtrends.com/commander-vs-oclif-vs-yargs) - Package comparisons
- [Top 12 libraries to build CLI tools in Node.js](https://byby.dev/node-command-line-libraries) - Overview
