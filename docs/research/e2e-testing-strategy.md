# E2E Testing Strategy Research

**Date:** 2026-02-25
**Status:** Research complete, decisions made

**Key decisions:**

- **PTY library:** `@lydell/node-pty` (prebuilt binaries, no C++ compilation)
- **Screen reading:** `@xterm/headless` virtual terminal (no ANSI stripping needed for interactive tests)
- **Non-interactive output:** `stripVTControlCharacters` from `node:util` (for Layer 3 / execa tests only)
- **Process cleanup:** `tree-kill` for PTY process trees
- **P0 blocker before any implementation:** verify `@lydell/node-pty` works under `bun test`

---

## Problem Statement

The CLI has ~2500 tests across 104 test files, but they provide little confidence against regression bugs. The core issue: **tests mock functions and pass exactly what they expect, fragmenting the application so thoroughly that the tests verify the mocking framework, not the application.**

Current "integration" tests call internal functions directly (`installLocal()`, `compileAllAgents()`) — they never invoke the CLI binary as a subprocess. Interactive wizard flows are tested by mocking all callbacks and verifying mock invocations, never testing that keyboard input propagates through to state changes and file system output.

### What We Need

1. Tests that invoke the actual CLI binary (not import functions)
2. Tests that navigate interactive prompts (arrow keys, enter, typing)
3. Tests that inspect actual terminal output (not mocked output)
4. Tests that verify file system side effects (files created, modified, deleted)
5. Tests that can test the full plugin installation flow
6. Tests that are deterministic and run in CI

---

## The Fundamental Technical Challenge

**Ink requires a real TTY** to enable interactive features. This is the central constraint that eliminates most tools:

- Ink checks `stdin.isTTY === true` to enable raw mode
- Raw mode is required for `useInput()`, `useFocus()`, and all interactive hooks
- `child_process.spawn()` creates **pipes**, not TTYs — `stdin.isTTY` is `undefined`
- **node-pty creates a real PTY** — `stdin.isTTY` is `true`, raw mode works

This means:

- execa, cli-testing-library, clet, nixt, @oclif/test → **all fail for interactive Ink**
- node-pty, bats+expect → **work for interactive Ink**
- ink-testing-library → sidesteps the issue by testing components in memory (no subprocess)

---

## Tool Evaluation

### Tools That Work for Our Stack

| Tool                       | Purpose                 | Interactive?     | Real TTY? | Maintained?    | Weekly Downloads |
| -------------------------- | ----------------------- | ---------------- | --------- | -------------- | ---------------- |
| **node-pty** (Microsoft)   | PTY creation in Node.js | Yes              | Yes       | Yes (Feb 2026) | 1.3M+            |
| **execa** v9               | Subprocess execution    | No               | No        | Yes (Nov 2025) | Millions         |
| **verdaccio** v6           | Local npm registry      | N/A              | N/A       | Yes (Feb 2026) | High             |
| **@oclif/test** v4         | Command unit tests      | No               | No        | Yes (Jan 2026) | High             |
| **ink-testing-library** v4 | Component unit tests    | Partial (no-ops) | No        | Yes (May 2024) | Moderate         |

### Tools That Don't Work / Are Dead

| Tool                            | Why Not                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| **nixt** v0.5                   | Unmaintained (2022), no PTY, callback-based API               |
| **clet** v1                     | Unmaintained (2022), no PTY, 79 GitHub stars                  |
| **cli-testing-library** v3      | No PTY (uses child_process), no Windows CI, single maintainer |
| **interactive-cli-tester** v0.3 | "Not ready for production" warning, 3 GitHub stars            |
| **nexpect**                     | Unmaintained, no PTY                                          |
| **suppose**                     | Unmaintained (2022)                                           |
| **terminalizer/asciinema**      | Recording tools, not testing tools — no assertions            |

### Detailed Analysis

#### node-pty — The Core Primitive

node-pty is the **only Node.js approach** that provides a real TTY for Ink-based CLIs. It is maintained by Microsoft (used in VS Code's integrated terminal), has 1.3M+ weekly downloads, and was last updated February 2026.

**What it does:**

- Creates real pseudo-terminals using platform APIs (forkpty on Linux/macOS, ConPTY on Windows)
- Spawned process sees `stdin.isTTY === true`, `setRawMode()` works
- ANSI escape sequences flow naturally
- Terminal dimensions (cols/rows) are configurable
- Signal handling (Ctrl+C, Ctrl+D) works

**Tradeoffs:**

- Native module — the upstream Microsoft package requires C++ compilation (node-gyp)
- Prebuilt binaries available via `@lydell/node-pty` (see below)
- Output is raw ANSI — use `@xterm/headless` virtual terminal for clean screen reads
- Timing-sensitive — needs robust `waitFor()` helpers with timeouts
- Not thread-safe — cannot run in parallel worker threads

#### `@lydell/node-pty` — The Prebuilt Fork

**Decision: Use `@lydell/node-pty` instead of upstream `node-pty` or `@homebridge/node-pty-prebuilt-multiarch`.**

| Metric                     | `@lydell/node-pty`                                     | `@homebridge/node-pty-prebuilt-multiarch` |
| -------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| Weekly downloads           | 1.86M                                                  | ~30K                                      |
| Latest version             | 1.2.0-beta.3 (Feb 2026)                                | 0.11.x                                    |
| Used by                    | Google Gemini CLI                                      | Homebridge ecosystem                      |
| Install pattern            | `optionalDependencies` per platform (like esbuild/swc) | Prebuilt binaries via postinstall         |
| C++ compilation            | None needed — prebuilt for all platforms               | None needed                               |
| Node-gyp / build-essential | Not required                                           | Not required                              |

The `@lydell/node-pty` package uses the modern per-platform `optionalDependencies` pattern (one npm package per OS/arch combination, like esbuild and swc). No postinstall scripts, no C++ toolchain, no `build-essential` or `python3` or `make` or `gcc` required in CI.

**Example:**

```typescript
import pty from "@lydell/node-pty";

const term = pty.spawn("./bin/dev", ["init"], {
  name: "xterm-256color",
  cols: 120,
  rows: 40,
  cwd: tmpDir,
  env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
});

let output = "";
term.onData((data) => {
  output += data;
});

await waitFor(() => expect(output).toContain("Choose a stack"));
term.write("\x1b[B"); // Down arrow
term.write("\r"); // Enter

await waitFor(() => expect(output).toContain("Created successfully"));
```

#### execa v9 — For Non-Interactive Commands

Excellent for testing commands that take flags/args and produce output without interaction:

```typescript
import { execa } from "execa";
import { stripVTControlCharacters } from "node:util";

const { stdout, exitCode } = await execa("./bin/dev", ["compile", "--source", dir]);
expect(exitCode).toBe(0);
expect(stripVTControlCharacters(stdout)).toContain("Compiled");
// Verify file system side effects
expect(await stat(path.join(dir, ".claude/agents"))).toBeTruthy();
```

#### verdaccio v6 — For Plugin Installation Testing

The industry standard for testing npm package installation flows. Used by create-react-app, pnpm, Storybook, Babel, Angular CLI, Docusaurus.

```typescript
// globalSetup: start verdaccio, publish packages
// In test: install from local registry, verify

await execa("npm", ["install", "@agents-inc/skill-react", "--registry", registryUrl], {
  cwd: testProjectDir,
});
// Verify installed files, run compile, check output
```

---

## How Major CLI Tools Test Themselves

| Tool            | Framework           | E2E Approach                                           |
| --------------- | ------------------- | ------------------------------------------------------ |
| **oclif**       | @oclif/test         | In-process `Command.run()`, no binary tests            |
| **Ink**         | ink-testing-library | In-memory `render()` + `lastFrame()`, no PTY           |
| **Vercel CLI**  | Jest                | `pnpm pack` → real deployments, probe verification     |
| **GitHub CLI**  | Go testing          | Golden file testing, `.golden` file diffs              |
| **Shopify CLI** | Vitest + Cucumber   | Acceptance tests as Cucumber scenarios, isolated dirs  |
| **pnpm**        | Verdaccio           | Real package installation against local registry       |
| **Yarn Berry**  | GitHub Actions      | E2E as CI workflows, bash scripts that install + build |

**Key insight:** The most confident CLI tools (gh, pnpm, Shopify) all test at the binary level with real file system effects, not by importing internal functions.

---

## Current Test Suite Weaknesses

### Anti-Patterns Found

1. **Over-mocking:** `skill-fetcher.test.ts` has 7 mock assertions verifying mock behavior, not real behavior
2. **Mock-testing-mock:** Tests verify that when mocks return specific data, parsing works — never tests real YAML parsing
3. **Callback isolation:** `step-build.test.tsx` has 11 `vi.fn()` mock callbacks — verifies callbacks fire but never tests state propagation
4. **Factory data divergence:** `createMockMatrix()` builds synthetic data that may diverge from actual YAML output format
5. **No visual verification:** Tests check string presence (`toContain("Framework")`) not formatting, ordering, or interactivity
6. **No binary invocation:** Zero tests spawn the actual CLI binary as a subprocess

### Bug Categories That Slip Through

| Category               | Example                             | Why Missed                                                     |
| ---------------------- | ----------------------------------- | -------------------------------------------------------------- |
| Data transformation    | Skill ID format validation          | Tests use pre-constructed objects, skip YAML→object conversion |
| File system edge cases | Permission errors, symlinks         | All I/O is mocked                                              |
| State synchronization  | Wizard selection lost between steps | Components tested with mocked callbacks                        |
| Skill resolution       | Circular dependencies               | Tests build isolated matrices                                  |
| Compilation pipeline   | Manifest merge failures             | Simplified fake stacks                                         |
| UI/UX regressions      | Text truncation, wrong ordering     | Tests check string presence, not layout                        |

### Concrete Regression Scenario

```typescript
// Bug: onContinue callback doesn't include framework selection
// Component test — PASSES:
const onContinue = vi.fn();
renderStepBuild({ onContinue });
expect(onContinue).toHaveBeenCalled(); // Yes, it was called
// But was it called with the correct selections? Never checked.
// Real flow: empty selections → wizard crashes at next step
```

---

## Recommended Architecture

### Five Testing Layers

```
Layer 5: Plugin Installation E2E (verdaccio + execa)
         └─ Full install → compile → verify flow
Layer 4: Interactive E2E (node-pty + @xterm/headless)
         └─ Wizard navigation, keyboard input, multi-step flows
Layer 3: Binary Non-Interactive E2E (execa)
         └─ compile, validate, eject — flag-based commands
Layer 2: Command Integration (existing @oclif/test)
         └─ Individual command unit tests (keep existing)
Layer 1: Component/Unit Tests (existing vitest + ink-testing-library)
         └─ Pure logic, schema validation, store state machines (keep existing)
```

### Layer 3: Binary Non-Interactive E2E (NEW)

**Tool:** execa v9
**Purpose:** Test non-interactive commands by spawning the actual binary
**What it catches:** Flag parsing bugs, output format regressions, exit code errors, file system side effects

```typescript
// e2e/commands/compile.e2e.test.ts
import { execa } from "execa";
import { stripVTControlCharacters } from "node:util";

test("compile produces correct output files", async () => {
  const dir = await createTestSource({ skills: DEFAULT_SKILLS, stacks: DEFAULT_STACKS });

  const { stdout, exitCode } = await execa("./bin/dev", ["compile", "--source", dir]);

  expect(exitCode).toBe(0);
  expect(stripVTControlCharacters(stdout)).toContain("Compiled");

  // Verify actual file system output
  const agents = await readdir(path.join(dir, ".claude/agents"));
  expect(agents.length).toBeGreaterThan(0);
});
```

### Layer 4: Interactive E2E (NEW)

**Tool:** `@lydell/node-pty` with `@xterm/headless` virtual terminal via `TerminalSession` wrapper
**Purpose:** Test interactive wizard flows with real keyboard input
**What it catches:** Focus management bugs, state propagation, multi-step flow regressions, keyboard shortcut failures

The key insight from [microsoft/tui-test](https://github.com/microsoft/tui-test) is to pipe raw PTY output into `@xterm/headless`, a virtual terminal emulator. This eliminates the ANSI chaos problem entirely — instead of trying to strip escape codes from a raw byte buffer, we read the **rendered screen buffer** and get exactly what the user sees.

Why not use tui-test directly: it is at `0.0.1-rc.5` (pre-release, 121 GitHub stars). Building a thin wrapper using the same primitives (`@lydell/node-pty` + `@xterm/headless`) gives us control without depending on pre-release software.

```typescript
// e2e/helpers/terminal-session.ts
import pty from "@lydell/node-pty";
import { Terminal } from "@xterm/headless";
import treeKill from "tree-kill";

export class TerminalSession {
  private pty: pty.IPty;
  private xterm: Terminal;

  constructor(args: string[], cwd: string) {
    const cols = 120;
    const rows = 40;

    this.xterm = new Terminal({ allowProposedApi: true, cols, rows });
    this.pty = pty.spawn("./bin/dev", args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    });
    this.pty.onData((data) => {
      this.xterm.write(data);
    });
  }

  /** Reads the rendered screen — no ANSI garbage */
  getScreen(): string {
    const buffer = this.xterm.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i <= buffer.cursorY; i++) {
      const line = buffer.getLine(buffer.baseY + i);
      if (line) lines.push(line.translateToString(true));
    }
    return lines.join("\n").trimEnd();
  }

  /** Reads ALL output including scrollback */
  getFullOutput(): string {
    const buffer = this.xterm.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    return lines.join("\n").trimEnd();
  }

  async waitForText(text: string, timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? (process.env.CI ? 20_000 : 10_000);
    const start = Date.now();
    while (!this.getFullOutput().includes(text)) {
      if (Date.now() - start > timeout) {
        throw new Error(
          `Timeout waiting for "${text}" after ${timeout}ms.\n` +
            `Screen:\n${this.getScreen()}\n` +
            `Full output:\n${this.getFullOutput()}`,
        );
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  write(data: string): void {
    this.pty.write(data);
  }
  enter(): void {
    this.write("\r");
  }
  arrowDown(): void {
    this.write("\x1b[B");
  }
  arrowUp(): void {
    this.write("\x1b[A");
  }
  arrowLeft(): void {
    this.write("\x1b[D");
  }
  arrowRight(): void {
    this.write("\x1b[C");
  }
  tab(): void {
    this.write("\t");
  }
  escape(): void {
    this.write("\x1b");
  }
  space(): void {
    this.write(" ");
  }
  ctrlC(): void {
    this.write("\x03");
  }

  async destroy(): Promise<void> {
    await new Promise<void>((resolve) => {
      treeKill(this.pty.pid, "SIGKILL", () => resolve());
    });
    this.xterm.dispose();
  }
}
```

This design incorporates:

- **tui-test's xterm-headless pattern** for clean screen reads (no `strip-ansi`, no cursor movement garbage)
- **Vitest's CI-aware timeouts** (20s CI, 10s local)
- **Wrangler/Expo's tree-kill** for reliable cleanup
- **50ms polling** (tui-test default)
- **Error messages include both screen and full output** for debugging

**Example test:**

```typescript
// e2e/wizard/init-project.e2e.test.ts
test("init wizard creates project with React + Zustand", async () => {
  const session = new TerminalSession(["init"], tmpDir);
  try {
    // Source loading
    await session.waitForText("Loading skills...");
    await session.waitForText("Choose a stack");
    session.enter(); // Select default stack

    // Domain selection
    await session.waitForText("Select domains");
    session.space(); // Toggle web
    session.enter(); // Continue

    // Build step — framework selection
    await session.waitForText("Customize your Web stack");
    session.arrowDown(); // Navigate to React
    session.space(); // Select it
    session.tab(); // Move to next category

    // Continue through wizard...
    await session.waitForText("Confirm");
    session.enter();

    // Verify file system
    const config = await readFile(path.join(tmpDir, ".claude-src/config.yaml"), "utf-8");
    expect(config).toContain("web-framework-react");
    expect(config).toContain("web-state-zustand");
  } finally {
    await session.destroy();
  }
});
```

### Layer 5: Plugin Installation E2E (NEW)

**Tools:** verdaccio v6 + execa v9
**Purpose:** Test the full publish → install → compile → verify flow
**What it catches:** Package metadata issues, dependency resolution failures, plugin loading bugs

```typescript
// e2e/globalSetup.ts
import { fork } from "child_process";

let verdaccioProcess: ChildProcess;

export async function setup() {
  verdaccioProcess = fork(require.resolve("verdaccio/bin/verdaccio"), [
    "--config",
    "./e2e/verdaccio-config.yaml",
    "--listen",
    "4873",
  ]);
  await waitForRegistry("http://localhost:4873");
  // Publish test packages
  await execa("npm", ["publish", "--registry", "http://localhost:4873"], {
    cwd: "./test-plugins/skill-react",
  });
}

export async function teardown() {
  await new Promise<void>((resolve) => {
    treeKill(verdaccioProcess.pid!, "SIGKILL", () => resolve());
  });
}
```

```typescript
// e2e/plugin-install.e2e.test.ts
test("plugin installs and compiles correctly", async () => {
  const projectDir = await createTempDir();

  // Install plugin from local registry
  await execa(
    "npm",
    ["install", "@agents-inc/skill-react", "--registry", "http://localhost:4873"],
    {
      cwd: projectDir,
    },
  );

  // Run compile
  const { exitCode, stdout } = await execa("./bin/dev", ["compile"], { cwd: projectDir });
  expect(exitCode).toBe(0);

  // Verify output — plugin manifest is at .claude/plugins/{name}/.claude-plugin/plugin.json
  const pluginDir = path.join(projectDir, ".claude/plugins/agents-inc");
  const manifest = JSON.parse(
    await readFile(path.join(pluginDir, ".claude-plugin/plugin.json"), "utf-8"),
  );
  expect(manifest.skills).toContainEqual(expect.objectContaining({ id: "web-framework-react" }));
});
```

---

## Implementation Plan

### MVP Phase

**Prerequisites (P0 blocker):**

Verify that `@lydell/node-pty` loads and works correctly under `bun test`. The project uses bun as its test runner. Bun has known compatibility gaps with native Node.js addons. If `@lydell/node-pty` cannot be loaded by bun, the entire PTY strategy needs rethinking (possible fallback: run E2E tests via `npx vitest` directly instead of through bun).

**Foundation:**

1. Install dependencies: `@lydell/node-pty`, `@xterm/headless`, `execa`, `tree-kill`
2. Create `e2e/` directory structure:
   ```
   e2e/
   ├── helpers/
   │   ├── terminal-session.ts
   │   └── test-utils.ts
   ├── commands/          # Non-interactive binary tests
   ├── wizard/            # Interactive wizard tests
   ├── plugins/           # Plugin installation tests
   └── vitest.config.ts   # Separate vitest config for E2E
   ```
3. Build `TerminalSession` wrapper (node-pty + @xterm/headless)
4. Write smoke tests:
   - `./bin/dev --help` exits 0 with expected output
   - `./bin/dev compile --source <dir>` produces files
   - `./bin/dev validate --source <dir>` reports results

**Layer 3 (execa) — non-interactive commands:**

5. `compile` — verify output files, exit codes, error messages
6. `validate` — verify validation output against real source
7. `uninstall --yes` — verify file cleanup (non-interactive with `--yes` flag)

**Layer 4 (node-pty) — interactive commands:**

8. `init` wizard happy path: source loading → stack → domains → build → confirm → install
9. `edit` wizard happy path: pre-selection visible, toggle skills, recompile

### Future Phases (no timelines)

- Verdaccio / plugin installation testing (Layer 5)
- Remaining non-interactive commands: `eject`, `doctor`, `diff`, `outdated`, `info`, `list`, `config show`
- Remaining interactive commands: `search`, `update`, `build stack`
- Bound skill search E2E (search pill → search modal → bind skill → verify in confirm step)
- Expert mode E2E (toggle E → select conflicting skills → verify config persistence)
- Source switching E2E (add source via settings → switch source → verify `sourceSelections` in config)
- Error scenario testing (invalid source, Ctrl+C mid-wizard, corrupt YAML)
- Golden file / snapshot testing for help text and error messages
- Cross-platform testing (currently Linux-only for PTY tests)

---

## Vitest Configuration for E2E

```typescript
// e2e/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["e2e/**/*.e2e.test.ts"],
    testTimeout: 30_000, // 30s per test (interactive flows are slower)
    hookTimeout: 60_000, // 60s for setup/teardown (verdaccio startup)
    pool: "forks", // node-pty is not thread-safe
    fileParallelism: false, // E2E tests run sequentially
    globals: true,
  },
});
```

---

## Decision Points

1. **Should E2E tests live in `e2e/` or `src/cli/lib/__tests__/e2e/`?**
   - Recommendation: Separate `e2e/` directory with its own vitest config

2. **Should we add `--non-interactive` flags to commands for easier testing?**
   - node-pty makes this unnecessary for most cases, but flag-based bypass is useful for CI smoke tests

3. **Should verdaccio run as Docker container or npm process?**
   - npm process is simpler for local dev; Docker for CI isolation. The "What We Should Adopt" table recommends programmatic `runServer()`, but the fork-based approach in globalSetup also works. Either way, verdaccio is deferred to future phases.

---

## User Journey Verification

All 8 proposed journeys were traced through the actual codebase to verify testability.

### Journey 1: Init with Custom Source (Private Marketplace)

**Command:** `cc init --source /path/to/private-marketplace`

| Aspect           | Details                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------- |
| **Text signals** | "Loading skills...", "Loaded X skills (label)", "Choose a stack"                        |
| **Keyboard**     | Arrow down, Enter (stack select), Space (skill toggle), Tab (category nav)              |
| **File output**  | `.claude-src/config.yaml` with source URL, `.claude/skills/` or `.claude/plugins/`      |
| **Testable?**    | YES — source flag passes through `loadSkillsMatrixFromSource()`, all text deterministic |

### Journey 2: Init Without Source Flag

**Command:** `cc init`

| Aspect           | Details                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| **Text signals** | Same loading messages, default marketplace label                            |
| **Keyboard**     | Same navigation                                                             |
| **File output**  | Config with default source, `installMode: "plugin"` default for marketplace |
| **Testable?**    | YES — default source resolution is deterministic                            |

### Journey 3: Stack Selection (Pre-built)

**Command:** Within wizard, user selects a pre-built stack

| Aspect           | Details                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| **Text signals** | "Choose a stack", stack names/descriptions, "Customize your [Domain] stack" |
| **Keyboard**     | Arrow down/up or j/k (vi-style), Enter to select                            |
| **File output**  | Config with `selectedStackId`, all stack skills installed                   |
| **Testable?**    | YES — `selectStack()` → `populateFromSkillIds()` is deterministic           |

### Journey 4: Stack Creation From Scratch

**Command:** User selects "Start from scratch"

| Aspect           | Details                                                                           |
| ---------------- | --------------------------------------------------------------------------------- |
| **Text signals** | "Start from scratch", "Select domains to configure", domain names, category names |
| **Keyboard**     | Space (toggle domains), Enter (continue), Tab (category nav), Space (skills)      |
| **File output**  | Config with manual selections, only selected domain skills installed              |
| **Testable?**    | YES — domain toggling and per-category selection fully keyboard-driven            |

### Journey 5: Changing Source Mid-Wizard

**Command:** User navigates back from confirm step, changes source

| Aspect           | Details                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| **Text signals** | "Customize skill sources", source grid labels, G hotkey settings modal         |
| **Keyboard**     | Escape (back), arrow keys (grid nav), Enter (select source), G (settings)      |
| **File output**  | `sourceSelections` map in config, archive/restore for local↔public transitions |
| **Testable?**    | YES — forward/back navigation, source grid, settings modal all text-based      |

### Journey 6: Plugin vs Local Install Mode

**Command:** User toggles with P hotkey during wizard

| Aspect           | Details                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| **Text signals** | "Install mode: Plugin (native install)" / "Install mode: Local (copy to .claude/skills/)" on confirm step |
| **Keyboard**     | P/p to toggle at any wizard step                                                                          |
| **File output**  | Plugin: `.claude/plugins/`, plugin manifest; Local: `.claude/skills/`, direct copy                        |
| **Testable?**    | YES — toggle is keyboard-driven, output paths differ clearly                                              |

### Journey 7: Uninstall Command

**Command:** `cc uninstall`, `cc uninstall --yes`, `cc uninstall --all`

| Aspect           | Details                                                                             |
| ---------------- | ----------------------------------------------------------------------------------- |
| **Text signals** | "The following will be removed:", file list, "Are you sure you want to uninstall?"  |
| **Keyboard**     | y/n for confirmation, or `--yes` flag to skip                                       |
| **File output**  | Plugins removed, matching skills removed, agents removed, `.claude-src/` with --all |
| **Testable?**    | YES — both interactive (y/n) and non-interactive (--yes) paths                      |

### Journey 8: Edit Command (Re-enter Wizard)

**Command:** `cc edit`, `cc edit --source github:org/other`

| Aspect           | Details                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| **Text signals** | "Edit Plugin Skills", "Current plugin has X skills", pre-selected skill markers |
| **Keyboard**     | Same as build step, plus E (expert), P (install mode), G (settings)             |
| **File output**  | Delta: added/removed skills, agents recompiled, config updated                  |
| **Testable?**    | YES — wizard opens at build step, pre-selection visible, deltas logged          |

### Summary

| Journey                     | node-pty | execa | verdaccio | Verdict        |
| --------------------------- | -------- | ----- | --------- | -------------- |
| 1. Custom source init       | Required | —     | —         | Fully testable |
| 2. Default source init      | Required | —     | —         | Fully testable |
| 3. Stack selection          | Required | —     | —         | Fully testable |
| 4. Scratch build            | Required | —     | —         | Fully testable |
| 5. Source change mid-wizard | Required | —     | —         | Fully testable |
| 6. Plugin vs local mode     | Required | —     | Optional  | Fully testable |
| 7. Uninstall                | Required | Also  | —         | Fully testable |
| 8. Edit wizard              | Required | —     | —         | Fully testable |

---

## File System Assertions Guide

Exact files to verify after each command.

### After `init` (Local Mode)

```
project/
├── .claude-src/
│   └── config.yaml          # installMode: "local", source, selections
├── .claude/
│   ├── skills/
│   │   ├── web-framework-react/
│   │   │   ├── SKILL.md           # Copied from source
│   │   │   └── metadata.yaml      # Injected forked_from field
│   │   └── web-state-zustand/
│   │       ├── SKILL.md
│   │       └── metadata.yaml
│   └── agents/
│       ├── web-developer.md       # Compiled agent (Liquid-templated)
│       └── api-developer.md
```

### After `init` (Plugin Mode)

```
project/
├── .claude-src/
│   └── config.yaml          # installMode: "plugin"
├── .claude/
│   └── plugins/
│       └── agents-inc/            # DEFAULT_PLUGIN_NAME
│           ├── .claude-plugin/
│           │   └── plugin.json    # Plugin manifest with skill references
│           ├── skills/            # Skills bundled in plugin
│           └── agents/
│               ├── web-developer.md
│               └── api-developer.md
```

### After `edit` (Source Switch)

```
project/
├── .claude/
│   ├── skills/
│   │   ├── _archived/
│   │   │   └── web-framework-react/   # Old version archived
│   │   └── web-framework-react/       # New version from new source
│   └── agents/                        # Recompiled with new skills
```

### After `uninstall --all`

```
project/
├── .claude/
│   ├── skills/                    # User-created skills preserved
│   │   └── my-custom-skill/       # No forked_from → preserved
│   └── (agents/ removed)
├── (.claude-src/ removed)
```

### After `compile`

For local mode or `--output` flag:

```
project/
├── .claude/
│   └── agents/
│       ├── web-developer.md       # Re-rendered from source skills
│       └── api-developer.md       # Sanitized for injection prevention
```

For plugin mode, agents are compiled inside the plugin directory (`.claude/plugins/agents-inc/agents/`).

### After `eject`

```
project/
├── .claude-src/
│   └── agents/
│       └── _templates/            # Copied from CLI defaults
├── .claude/
│   └── skills/                    # Flattened from source
├── (.claude-src/config.yaml created if missing)
```

### After `validate`

No file system changes — read-only command. Assert only on stdout/stderr and exit code.

---

## The Hard Truths: What Cannot Be Tested

This section documents the real, unvarnished limitations of the proposed setup. These are not hypothetical — they are documented bugs and architectural constraints.

### 1. The Exit/Data Race Condition (FUNDAMENTAL)

**node-pty Issue [#72](https://github.com/microsoft/node-pty/issues/72) (open since 2016):** The `exit` event can fire before all buffered data has been delivered via `data` events. This means:

- If you wait for `exit` to know when to assert on output, you may miss the final chunk
- There is no reliable way to know when output is "complete"
- Occurs approximately 1 in 5 runs per [Issue #140](https://github.com/microsoft/node-pty/issues/140)

**Mitigation:** Never use `exit` as the signal that output is complete. Instead, wait for a known final text string (exit message, etc.) and add a small buffer delay (200-500ms) after finding it.

### 2. Ink Rewrites Lines (ANSI Chaos)

Ink uses cursor movement codes to rewrite lines on every re-render (Yoga layout engine). In a raw PTY buffer, this means:

```
Raw buffer: "Loading...\x1b[1ALoading... 50%\x1b[1ADone!"
Raw string: "Loading...Loading... 50%Done!"  (NOT what the user sees)
User sees:  "Done!"
```

Raw ANSI stripping (whether via npm packages or `node:util`) removes color codes but NOT cursor movement codes (`\x1b[1A`, `\x1b[2J`, `\x1b[K`). You get a garbled concatenation of every intermediate render, not the final screen state.

**Mitigation:** Use `@xterm/headless` as a virtual terminal emulator. It processes ALL escape sequences (including cursor movement) and maintains a proper screen buffer. The `getScreen()` method on our `TerminalSession` returns exactly what the user would see — no garbled intermediate frames.

### 3. Output Chunking Splits Words

PTY output arrives in arbitrary kernel-determined chunks. `"Compiled successfully"` might arrive as `"Compi"` + `"led successfully"`. Multi-byte UTF-8 characters can split across chunks.

**Mitigation:** The `TerminalSession` pipes all data into `@xterm/headless`, which handles buffering and reassembly. The `waitForText` implementation reads from the xterm buffer, not raw data events.

### 4. Platform Differences Are Real

| Platform | Issue                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Linux    | Output truncation bug ([#85](https://github.com/microsoft/node-pty/issues/85), unfixed) — final data may be lost                        |
| macOS    | 4KB kernel pipe buffer — large outputs can drop data                                                                                    |
| macOS    | Hardened runtime: `fork()` takes 300ms instead of <3ms ([#476](https://github.com/microsoft/node-pty/issues/476))                       |
| Windows  | ConPTY echoes ALL input in output ([#78](https://github.com/microsoft/node-pty/issues/78)) — every keystroke appears in captured output |
| Windows  | Extra ANSI sequences not present on Linux/macOS ([#475](https://github.com/microsoft/node-pty/issues/475))                              |
| Windows  | `kill()` may not terminate child processes ([#437](https://github.com/microsoft/node-pty/issues/437))                                   |

**Mitigation:** Target Linux-only for PTY tests initially. Accept that cross-platform PTY testing is a future effort requiring platform-specific expected values.

### 5. stdin Timing (Keystrokes Can Be Lost)

Writing to stdin before the spawned process is ready causes data loss. There is no "ready" event ([Issue #327](https://github.com/microsoft/node-pty/issues/327)).

**Mitigation:** Always `waitForText` before sending any keystroke. Never send keystrokes immediately after spawn. Add 100-200ms delay between rapid keystrokes if needed.

### 6. Terminal Dimensions Affect Layout

Ink renders differently at 80 columns vs 120 columns. Text wrapping, truncation, and Yoga layout calculations change.

**Mitigation:** Always set explicit `cols: 120, rows: 40` at spawn time. If output exceeds 40 rows, the first rows scroll into the xterm scrollback buffer (still accessible via `getFullOutput()`).

### 7. CI Environment Gotchas

- GitHub Actions + Node.js with io_uring caused parallel PTYs to receive SIGHUP ([#630](https://github.com/microsoft/node-pty/issues/630)). Fixed in Node.js 20.11.1+ but requires attention to Node version.
- GitHub Actions sends SIGHUP (not SIGINT) on cancellation.
- `@lydell/node-pty` uses prebuilt binaries — no `build-essential`, `python3`, `make`, or `gcc` needed in CI.

### 8. Performance Reality

| Test type       | Time per test | Notes                                |
| --------------- | ------------- | ------------------------------------ |
| Unit (vitest)   | 1-50ms        | In-process, no I/O                   |
| Integration     | 50-500ms      | Real filesystem, createTestSource()  |
| Binary E2E      | 500ms-2s      | Process spawn + CLI init + output    |
| Interactive PTY | 2-10s         | Spawn + render + waitForText polling |
| Plugin install  | 5-30s         | npm publish + install + compile      |

Interactive PTY tests at ~5s each add up. Acceptable as a separate CI job, but do not scale to hundreds of tests.

### 9. Things That Are Genuinely Impossible

Even with a perfect PTY setup, you **cannot** test:

1. **Exact visual layout** — Even with `@xterm/headless`, you get the text content of each row but not sub-cell rendering details. Color rendering accuracy across terminals (iTerm2 vs Terminal.app vs Windows Terminal) is not verifiable.

2. **Animation timing** — Ink spinners, progress bars, and transitions depend on render timing. In the xterm buffer you get the latest frame, but inter-frame timing is non-deterministic.

3. **Mouse input** — node-pty does not support mouse event injection.

4. **Terminal resize mid-operation** — `pty.resize()` exists but the child's SIGWINCH handling is non-deterministic.

5. **Guaranteed output completeness** — Due to the exit/data race, you can never be 100% certain you captured ALL output.

6. **Cross-platform identical assertions** — Windows ConPTY fundamentally produces different output. No single assertion works everywhere.

### 10. Honest Assessment: Is This an E2E Platform?

**Yes, with caveats.**

What you get:

- Real binary execution with real TTY — the CLI cannot distinguish test from user
- Real keyboard input driving real Ink components through real state management
- Real file system side effects to verify after each flow
- Real plugin installation via local registry
- Real uninstall/cleanup verification
- Coverage of ALL 8 proposed user journeys

What you accept:

- Linux-first, cross-platform later (platform gaps)
- Text `includes()` assertions, not pixel-perfect layout (even with xterm-headless)
- Generous timeouts and sequential execution (timing sensitivity)
- `waitForText` polling, not synchronous assertions (output buffering)
- Final output verification post-exit, not mid-flow snapshots (exit/data race)

---

## Production Patterns From Real Codebases

Research into how major CLI projects actually implement E2E testing. These patterns have survived trial and error in production CI environments.

### The Key Discovery: Microsoft tui-test

**Repository:** [microsoft/tui-test](https://github.com/microsoft/tui-test) (121 stars, MIT)

This is "Playwright for terminals" — built by Microsoft, used for testing CLI and TUI experiences. It solves the ANSI chaos problem we identified earlier by using `@xterm/headless` as a virtual terminal emulator.

**Architecture:** node-pty spawns the process → raw PTY output pipes into `@xterm/headless` → tests read the **rendered screen buffer** (not raw bytes). This means no ANSI stripping, no cursor movement garbage, no garbled intermediate frames. You get exactly what the user sees.

```typescript
// tui-test's Terminal class (simplified from /src/terminal/term.ts)
import pty from "@lydell/node-pty";
import xterm from "@xterm/headless";

export class Terminal {
  private readonly _pty: pty.IPty;
  private readonly _term: xterm.Terminal;

  constructor(
    target: string,
    args: string[],
    rows: number,
    cols: number,
    env?: Record<string, string>,
  ) {
    this._pty = pty.spawn(target, args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd: process.cwd(),
      env,
    });
    this._term = new xterm.Terminal({ allowProposedApi: true, rows, cols });
    this._pty.onData((data) => {
      this._term.write(data);
    });
  }

  // Reads the RENDERED screen — no ANSI garbage
  getViewableBuffer(): string[][] {
    // reads from xterm's virtual screen buffer
  }

  // Playwright-style locator
  getByText(text: string | RegExp): Locator {
    return new Locator(text, this, this._term);
  }

  write(data: string): void {
    this._pty.write(data);
  }
  submit(data?: string): void {
    this._pty.write(`${data ?? ""}\r`);
  }
  kill() {
    process.kill(this._pty.pid, 9);
  }
}
```

**Test API (Playwright-style):**

```typescript
import { test, expect } from "@microsoft/tui-test";

test.use({ program: { file: "git" } });

test("git shows usage", async ({ terminal }) => {
  await expect(terminal.getByText("usage: git", { full: true })).toBeVisible();
});
```

**Why this matters for us:** The `@xterm/headless` approach eliminates our biggest concern — Ink's cursor movement codes garbling the output buffer. Instead of `includes()` on a messy buffer, we get clean screen reads.

### Universal Patterns Across All Projects

After analyzing Nx, Wrangler, Vitest, Expo, create-next-app, oclif, Shopify CLI, and Salesforce CLI, these patterns appear in nearly every codebase:

#### 1. ANSI Stripping: `node:util` Is the Standard (for non-PTY tests)

For tests that use execa (Layer 3), every modern project has converged on Node's built-in `stripVTControlCharacters` instead of the `strip-ansi` npm package:

```typescript
import { stripVTControlCharacters } from "node:util";
const clean = stripVTControlCharacters(rawOutput);
```

Used by: Nx, Wrangler, Expo, Vitest, Astro. Only oclif uses `ansis` and older projects use `strip-ansi`.

For PTY tests (Layer 4), `@xterm/headless` renders the screen buffer directly — no ANSI stripping is needed at all.

#### 2. FORCE_COLOR Disabling

Every project sets this in test environments:

```typescript
env: { ...process.env, FORCE_COLOR: "false" }  // Nx, Wrangler
env: { ...process.env, FORCE_COLOR: "0" }       // Expo, create-next-app
```

Our `TerminalSession` uses both `NO_COLOR: "1"` and `FORCE_COLOR: "0"` (belt-and-suspenders).

#### 3. Process Cleanup: tree-kill, Not process.kill

Both Wrangler and Expo use `tree-kill` for reliable child process termination:

```typescript
import treeKill from "tree-kill";

async function killProcess(child: ChildProcess): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    treeKill(child.pid!, "SIGKILL", (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
```

`process.kill()` only kills the parent — `tree-kill` kills the entire process tree.

#### 4. CI-Aware Timeouts

Shopify CLI's pattern is the most thorough:

```typescript
const TIMEOUTS = {
  normal: 5_000,
  windows: 13_000,
  macos: 13_000,
  debug: 180_000,
};

let testTimeout = TIMEOUTS.normal;
if (process.env.RUNNER_OS === "Windows") testTimeout = TIMEOUTS.windows;
else if (process.env.RUNNER_OS === "macOS") testTimeout = TIMEOUTS.macos;
```

Vitest's CLI tests use 60s test timeout with 4s local / 20s CI for `waitForStdout`.

#### 5. Skip-Cleanup Env Vars for Debugging

Every project has a way to preserve test artifacts:

| Project    | Env Var                   |
| ---------- | ------------------------- |
| Next.js    | `NEXT_TEST_SKIP_CLEANUP`  |
| Vitest     | `VITEST_FS_CLEANUP=false` |
| Salesforce | `TESTKIT_SAVE_ARTIFACTS`  |

#### 6. Output Normalization Pipeline (Wrangler)

Wrangler's `normalizeOutput()` chains 20+ functions for deterministic snapshot testing. Key normalizers:

```typescript
function stripTimings(stdout: string): string {
  return stdout.replace(/\(\d+\.\d+ sec\)/g, "(TIMINGS)").replace(/\d+ ms/g, "(TIMINGS)");
}
function normalizeTempDirs(stdout: string): string {
  return stdout.replaceAll(/\S+\/wrangler-smoke-.+/g, "/tmpdir");
}
function normalizeSlashes(str: string): string {
  return str.replace(/\\/g, "/");
}
```

This is critical for snapshot tests — without it, timestamps, paths, and timings make snapshots non-deterministic.

### Vitest's Own CLI Testing Pattern

Vitest tests its own CLI using a custom `Cli` class that captures streaming output. This is the closest match to our needs since it tests an interactive CLI:

```typescript
// From vitest/test/test-utils/cli.ts
export class Cli {
  stdout = "";
  stderr = "";
  private stdoutListeners: Listener[] = [];

  constructor(options: { stdin; stdout; stderr }) {
    options.stdout.on("data", (data) => {
      const msg = stripVTControlCharacters(data.toString());
      this.stdout += msg;
      this.stdoutListeners.forEach((fn) => fn());
    });
  }

  write(data: string) {
    this.resetOutput();
    this.stdin.emit("data", data);
  }

  waitForStdout(expected: string) {
    return new Promise<void>((resolve, reject) => {
      if (this.stdout.includes(expected)) return resolve();

      const timeout = setTimeout(
        () => {
          reject(
            new Error(
              `Timeout waiting for "${expected}".\nReceived:\nstdout: ${this.stdout}\nstderr: ${this.stderr}`,
            ),
          );
        },
        process.env.CI ? 20_000 : 4_000,
      );

      const listener = () => {
        if (this.stdout.includes(expected)) {
          clearTimeout(timeout);
          resolve();
        }
      };
      this.stdoutListeners.push(listener);
    });
  }
}
```

**Interactive test example (Vitest testing its own init command):**

```typescript
const ARROW_DOWN = "\u001B[B";
const ENTER = "\n";

test("initializes project", async () => {
  const { vitest } = await runVitestCli({ nodeOptions: { cwd } }, "init", "browser");

  await vitest.waitForStdout("Choose a language for your tests");
  vitest.write(ENTER);

  await vitest.waitForStdout("Choose a browser provider");
  vitest.write(`${ARROW_DOWN}${ARROW_DOWN}${ENTER}`);

  await vitest.waitForStdout("Choose a browser");
  vitest.write(ENTER);

  await vitest.waitForStdout("All done!");
  expect(await getFiles()).toMatchInlineSnapshot(`...`);
});
```

Note: Vitest's `Cli` class uses `stdin.emit("data", ...)` (in-process, no PTY) so it uses `"\n"` for enter. Our `TerminalSession` writes to a real PTY and must use `"\r"` instead.

**Vitest E2E config:**

```typescript
export default defineConfig({
  test: {
    testTimeout: 60_000,
    isolate: false,
    fileParallelism: false, // CLI tests run sequentially
  },
});
```

### Wrangler's LongLivedCommand Pattern

Cloudflare Wrangler's approach for testing long-running commands (`wrangler dev`) with streaming output:

```typescript
// From cloudflare/workers-sdk packages/wrangler/e2e/helpers/command.ts
export class LongLivedCommand {
  private lines: string[] = [];
  private commandProcess: ChildProcessWithoutNullStreams;

  constructor(command: string, { cwd, env, timeout }: CommandOptions) {
    const signal = createTimeoutSignal(timeout);
    this.commandProcess = spawn(command, [], { shell: true, cwd, stdio: "pipe", env, signal });
    // Merges stdout + stderr into single stream
  }

  async readUntil(regexp: RegExp, readTimeout?: number): Promise<RegExpMatchArray> {
    // Reads from stream until regexp matches
  }

  async stop() {
    await new Promise<void>((resolve) => {
      treeKill(this.commandProcess.pid!, (e) => resolve());
    });
  }
}
```

**Test helper class with automatic cleanup via `onTestFinished`:**

```typescript
export class WranglerE2ETestHelper {
  tmpPath = makeRoot();

  async seed(files: Record<string, string | Uint8Array>) {
    await seed(this.tmpPath, files);
  }

  runLongLived(command: string) {
    const wrangler = new WranglerLongLivedCommand(command, { cwd: this.tmpPath });
    onTestFinished(async () => {
      await wrangler.stop();
    });
    return wrangler;
  }
}
```

### Shopify CLI: Ink Component Testing Infrastructure

Shopify CLI (the largest oclif + Ink project) tests interactive prompts with a custom render helper:

```typescript
// From Shopify/cli packages/cli-kit/src/private/node/testing/ui.ts
export function waitForInputsToBeReady() {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

export async function sendInputAndWaitForChange(
  renderInstance: ReturnType<typeof render>,
  ...inputs: string[]
) {
  await waitForChange(
    () => inputs.forEach((input) => renderInstance.stdin.write(input)),
    renderInstance.lastFrame,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export function getLastFrameAfterUnmount(renderInstance: ReturnType<typeof render>) {
  // CI workaround: Ink clears last frame on unmount in CI
  return isTruthy(process.env.CI)
    ? renderInstance.frames[renderInstance.frames.length - 2]
    : renderInstance.lastFrame();
}
```

**Key Shopify patterns:**

- `waitForInputsToBeReady()` — 100ms delay before first input (Ink needs a tick)
- `waitForChange()` — polls at 10ms intervals until the frame changes
- CI-specific frame retrieval — `frames[length-2]` because Ink clears on unmount in CI
- `pool: "forks"` in vitest config (not threads) for better isolation
- `hanging-process` reporter to detect tests that don't terminate
- `SHOPIFY_UNIT_TEST=1` env var so production code can detect test context

**Acceptance tests use Cucumber with XDG isolation:**

```typescript
// Full environment isolation via XDG overrides
Given("I have a working directory", async function () {
  this.temporaryDirectory = tempy.directory();
  this.temporaryEnv = {
    XDG_DATA_HOME: path.join(this.temporaryDirectory, "XDG_DATA_HOME"),
    XDG_CONFIG_HOME: path.join(this.temporaryDirectory, "XDG_CONFIG_HOME"),
    XDG_STATE_HOME: path.join(this.temporaryDirectory, "XDG_STATE_HOME"),
    XDG_CACHE_HOME: path.join(this.temporaryDirectory, "XDG_CACHE_HOME"),
  };
});
```

### Salesforce CLI: TestSession and execCmd

The largest oclif E2E testing infrastructure. Key pattern — `TestSession` stubs `process.cwd()` and overrides `HOME`:

```typescript
// From salesforcecli/cli-plugins-testkit src/testSession.ts
export class TestSession {
  public dir: string;
  public homeDir: string;

  constructor(options) {
    this.dir = path.join(process.cwd(), `test_session_${this.id}`);
    fs.mkdirSync(this.dir, { recursive: true });

    // Stub cwd
    this.cwdStub = this.sandbox.stub(process, "cwd").returns(projectDir);

    // Override home
    process.env.HOME = this.homeDir = this.dir;

    // Write options for debugging
    fs.writeFileSync(path.join(this.dir, "testSessionOptions.json"), JSON.stringify(this.options));
  }

  async clean() {
    this.sandbox.restore();
    if (!env.getBoolean("TESTKIT_SAVE_ARTIFACTS")) {
      await this.rmSessionDir();
    }
  }
}
```

**execCmd redirects stdout/stderr to temp files for reliable capture:**

```typescript
// From salesforcecli/cli-plugins-testkit src/execCmd.ts
const execCmdSync = <T>(cmd: string, options?: ExecCmdOptions): ExecCmdResult<T> => {
  const stdoutFile = `${genUniqueString("stdout")}.txt`;
  const stderrFile = `${genUniqueString("stderr")}.txt`;

  const code = shelljs.exec(`${cmd} 1> ${stdoutFile} 2> ${stderrFile}`, cmdOptions).code;

  result.shellOutput = new ShellString(fs.readFileSync(stdoutFileLocation, "utf-8"));
  result.shellOutput.code = code;

  // Auto-parse JSON if --json flag present
  if (cmd.includes("--json")) {
    result.jsonOutput = parseJson(fs.readFileSync(stdoutFileLocation, "utf-8"));
  }

  fs.rmSync(stdoutFileLocation);
  fs.rmSync(stderrFileLocation);
  return result;
};
```

**NUT file convention:** `*.nut.ts` files separated from `*.test.ts` by npm script:

```json
{
  "test": "mocha **/*.test.ts",
  "test:nuts": "mocha **/*.nut.ts"
}
```

**CI retries:** 3 attempts with 60s gap, 60-minute timeout per NUT run.

### Verdaccio Patterns From Production

#### Programmatic Start (rluvaton pattern — simplest)

```typescript
import { runServer } from "verdaccio";

async function setupVerdaccio() {
  const config = {
    storage: path.join(tempFolder, "storage"),
    packages: {
      "@agents-inc/*": { access: ["$anonymous"], publish: ["$anonymous"] },
      "@*/*": { access: ["$all"], proxy: ["npmjs"] },
      "**": { access: ["$all"], proxy: ["npmjs"] },
    },
    uplinks: { npmjs: { url: "https://registry.npmjs.org/" } },
    logs: { type: "stdout", format: "pretty", level: "fatal" },
  };

  const instance = await runServer(config);
  await new Promise((resolve, reject) => {
    const result = instance.listen(0, (err) => (err ? reject(err) : resolve(undefined)));
    port = result.address().port; // Random free port
  });

  return {
    registryUrl: `http://localhost:${port}`,
    npmEnv: { npm_config_registry: `http://localhost:${port}` },
    stop: () => instance.close(),
  };
}
```

#### Fork-based Start (Angular CLI pattern)

```typescript
import { fork } from "child_process";
import { on } from "events";

async function createRegistry(port: number): Promise<ChildProcess> {
  const server = fork(require.resolve("verdaccio/bin/verdaccio"), ["-c", configPath]);

  // Wait for verdaccio_started message
  for await (const events of on(server, "message", { signal: AbortSignal.timeout(30_000) })) {
    if (events.some((event) => event?.verdaccio_started)) break;
  }

  return server;
}
```

#### Nx globalSetup Pattern

```typescript
// globalSetup.ts
export default async () => {
  global.stopLocalRegistry = await startLocalRegistry({ localRegistryTarget, storage });

  await releaseVersion({ specifier: "0.0.0-e2e", stageChanges: false, gitCommit: false });
  await releasePublish({ tag: "e2e", firstRelease: true });
};

// globalTeardown.ts
export default () => {
  global.stopLocalRegistry?.();
};
```

#### Docker Service in GitHub Actions

```yaml
jobs:
  e2e:
    services:
      verdaccio:
        image: verdaccio/verdaccio
        ports: ["4873:4873"]
    steps:
      - run: echo "registry=http://localhost:4873" > ~/.npmrc
      - run: npm publish --registry http://localhost:4873
      - run: npm install my-package && npm test
```

### Declarative File Seeding

**Wrangler pattern:**

```typescript
export async function seed(root: string, files: Record<string, string | Uint8Array>) {
  await Promise.all(
    Object.entries(files).map(async ([name, contents]) => {
      const filePath = path.resolve(root, name);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, contents);
    }),
  );
}

// Usage:
await helper.seed({
  "package.json": '{ "name": "test" }',
  "wrangler.toml": 'name = "test-worker"',
  "src/index.ts": 'export default { fetch() { return new Response("ok") } }',
});
```

**Vitest `useFS` pattern (with auto-cleanup):**

```typescript
export function useFS(root: string, structure: Record<string, string>) {
  for (const [file, content] of Object.entries(structure)) {
    const filepath = resolve(root, file);
    fs.mkdirSync(dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, content, "utf-8");
  }
  onTestFinished(() => {
    if (process.env.VITEST_FS_CLEANUP !== "false") {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  return {
    readFile: (file: string) => fs.readFileSync(resolve(root, file), "utf-8"),
    editFile: (file: string, callback: (content: string) => string) => {
      /* ... */
    },
    createFile: (file: string, content: string) => {
      /* ... */
    },
  };
}
```

### What We Should Adopt

Based on the production patterns above, our implementation should use:

| Decision                    | Choice                                           | Precedent                   |
| --------------------------- | ------------------------------------------------ | --------------------------- |
| **PTY wrapper**             | `@lydell/node-pty` + `@xterm/headless`           | Microsoft tui-test          |
| **Interactive screen read** | `@xterm/headless` virtual terminal buffer        | Microsoft tui-test          |
| **Non-interactive output**  | `stripVTControlCharacters` from `node:util`      | Nx, Wrangler, Expo, Vitest  |
| **Process cleanup**         | `tree-kill` package                              | Wrangler, Expo              |
| **Temp dirs**               | `onTestFinished` auto-cleanup + skip env var     | Vitest, Wrangler            |
| **File seeding**            | Declarative `seed()` function                    | Wrangler, Vitest            |
| **Timeouts**                | CI-aware (longer in CI), OS-aware                | Shopify CLI, Vitest         |
| **Output normalization**    | Pipeline of normalizers for snapshots            | Wrangler                    |
| **Verdaccio**               | Programmatic `runServer()` + `listen(0)`         | rluvaton, Angular CLI       |
| **Test file convention**    | `*.e2e.test.ts` separated from `*.test.ts`       | Salesforce NUT pattern      |
| **Sequential execution**    | `fileParallelism: false` for E2E                 | Vitest                      |
| **Pool strategy**           | `pool: "forks"` (not threads)                    | Shopify CLI, Vitest         |
| **Color disabling**         | `FORCE_COLOR: "0"` + `NO_COLOR: "1"` in test env | Every project               |
| **Debug artifacts**         | `TESTKIT_SAVE_ARTIFACTS` style env var           | Salesforce, Next.js, Vitest |
| **waitForText approach**    | Event-listener with CI-aware timeout             | Vitest                      |

---

## References

### Tools

- [node-pty (Microsoft)](https://github.com/microsoft/node-pty) — PTY creation, 1.3M weekly downloads
- [@lydell/node-pty](https://www.npmjs.com/package/@lydell/node-pty) — Prebuilt fork, 1.86M weekly downloads, no node-gyp needed
- [@xterm/headless](https://www.npmjs.com/package/@xterm/headless) — Virtual terminal emulator (from xterm.js / VS Code)
- [execa v9](https://github.com/sindresorhus/execa) — Modern subprocess execution
- [verdaccio v6](https://verdaccio.org/docs/e2e/) — Local npm registry for E2E testing
- [@oclif/test v4](https://github.com/oclif/test) — oclif command unit tests
- [ink-testing-library v4](https://github.com/vadimdemedes/ink-testing-library) — Ink component tests
- [tree-kill](https://www.npmjs.com/package/tree-kill) — Kill process trees

### How Others Test (Source Repositories)

- [microsoft/tui-test](https://github.com/microsoft/tui-test) — Playwright-style terminal testing with node-pty + xterm-headless
- [Shopify/cli](https://github.com/Shopify/cli) — oclif + Ink, Vitest + Cucumber acceptance tests
- [Shopify CLI Testing Strategy](https://shopify.github.io/cli/cli/testing-strategy.html) — Architecture decisions
- [salesforcecli/cli-plugins-testkit](https://github.com/salesforcecli/cli-plugins-testkit) — oclif NUT pattern, TestSession, execCmd
- [salesforcecli/source-testkit](https://github.com/salesforcecli/source-testkit) — Higher-level oclif test utilities
- [vitest-dev/vitest test/cli](https://github.com/vitest-dev/vitest/tree/main/test/cli) — Interactive CLI testing with tinyexec + custom Cli class
- [cloudflare/workers-sdk wrangler/e2e](https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler/e2e) — LongLivedCommand, output normalization pipeline
- [vercel/next.js create-next-app tests](https://github.com/vercel/next.js/tree/canary/test/integration/create-next-app) — execa + useTempDir
- [nrwl/nx e2e/utils](https://github.com/nrwl/nx/tree/master/e2e/utils) — runCLI, project caching, backup/restore
- [expo/expo cli/e2e](https://github.com/expo/expo/tree/main/packages/@expo/cli/e2e) — execa + tree-kill + background server pattern
- [oclif/oclif test/integration](https://github.com/oclif/oclif/tree/main/test/integration) — child_process.exec + ansis strip
- [Verdaccio E2E docs](https://verdaccio.org/docs/e2e/) — Used by CRA, pnpm, Storybook, Babel
- [rluvaton/e2e-verdaccio-example](https://github.com/rluvaton/e2e-verdaccio-example) — Cleanest programmatic verdaccio pattern
- [angular/angular-cli tests](https://github.com/angular/angular-cli) — Fork-based verdaccio with auth testing
- [Testing Terminal UI Apps (Waleed Khan)](https://blog.waleedkhan.name/testing-tui-apps/) — Golden file approach
- [How to Test CLI Output (lekoarts)](https://www.lekoarts.de/how-to-test-cli-output-in-jest-vitest/) — execa + stripVTControlCharacters
- [Testing CLI the Way People Use It (Smashing Magazine)](https://www.smashingmagazine.com/2022/04/testing-cli-way-people-use-it/) — cli-testing-library

### Research

- [oclif Issue #286](https://github.com/oclif/oclif/issues/286) — Interactive testing not supported
- [Ink Raw Mode Issue #378](https://github.com/vadimdemedes/ink/issues/378) — TTY requirement
- [Integration Tests on Node.js CLI (zorrodg)](https://medium.com/@zorrodg/integration-tests-on-node-js-cli-part-2-testing-interaction-user-input-6f345d4b713a) — child_process approach
- [CLI E2E with bats+expect](https://pkaramol.medium.com/end-to-end-command-line-tool-testing-with-bats-and-auto-expect-7a4ffb19336d) — Bash-based approach
- [TigerBeetle Snapshot Testing](https://tigerbeetle.com/blog/2024-05-14-snapshot-testing-for-the-masses/) — Self-updating snapshots

### node-pty Known Issues (Critical for Test Design)

- [#72 — Exit fires before data delivered](https://github.com/microsoft/node-pty/issues/72) — Open since 2016, fundamental race condition
- [#85 — Output truncation on Linux](https://github.com/microsoft/node-pty/issues/85) — Final output lost, closed as unfixable
- [#140 — Exit before data received (~1 in 5)](https://github.com/microsoft/node-pty/issues/140) — Confirms race frequency
- [#327 — stdin write timing](https://github.com/microsoft/node-pty/issues/327) — No "ready" event, keystrokes can be lost
- [#437 — Cannot kill on Windows](https://github.com/microsoft/node-pty/issues/437) — Process cleanup fails
- [#476 — macOS hardened runtime 300ms spawn](https://github.com/microsoft/node-pty/issues/476) — Major perf hit
- [#630 — Parallel PTYs + io_uring = SIGHUP](https://github.com/microsoft/node-pty/issues/630) — CI-specific, fixed in Node 20.11.1+
- [#715 — Flaky SIGINT test in node-pty itself](https://github.com/microsoft/node-pty/issues/715) — Their own tests are flaky
- [#831 — macOS 4KB buffer data loss](https://github.com/microsoft/node-pty/pull/831) — Large output drops data
- [#887 — Windows ConPTY prevents Node.js exit](https://github.com/microsoft/node-pty/issues/887) — Open, Feb 2026
