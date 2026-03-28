# E2E Testing Standards

Consolidated from 11 audit/strategy docs and 65+ E2E test files. Every rule is enforceable and grounded in actual codebase patterns.

---

## 1. Test Organization

**1.1 Directory structure follows test category.**

```
e2e/
  commands/         # Non-interactive command tests (runCLI)
  interactive/      # Wizard and interactive component tests (TerminalSession)
  lifecycle/        # Multi-phase flows: init -> edit -> compile -> uninstall
  integration/      # Cross-command integration (eject -> compile, custom agents)
  smoke/            # Third-party binary probes (Claude CLI availability)
  helpers/          # Shared infrastructure (NO test files here)
    test-utils.ts         # runCLI, createTempDir, timing constants, project factories
    terminal-session.ts   # PTY wrapper with xterm-headless screen reading
    create-e2e-source.ts  # 10-skill source fixture (skills, agents, stacks, templates)
    create-e2e-plugin-source.ts  # Source + built plugins + marketplace.json
    plugin-assertions.ts  # verifyConfig, verifyAgentCompiled, verifySkillCopiedLocally
    node-pty.d.ts         # Type declaration reference for @lydell/node-pty
```

**1.2 File naming: `{feature}.e2e.test.ts`.** Smoke tests use `{feature}.smoke.test.ts`. Split files at 300 LOC or 2+ unrelated concerns. Use descriptive names: `edit-wizard-plugin-migration.e2e.test.ts`, not `edit-2.e2e.test.ts`.

**1.3 No task IDs in `describe()` blocks.** No `"P-BUILD-1: ..."` or `"Bug A: ..."` prefixes. Task IDs can appear in file-level JSDoc comments only.

**1.4 Vitest config:** `e2e/vitest.config.ts` uses `pool: "forks"`, `testTimeout: 30_000`, `hookTimeout: 60_000`. The include pattern is `e2e/**/*.e2e.test.ts` -- smoke tests (`*.smoke.test.ts`) are excluded and must be run explicitly. Long tests override per-test with `{ timeout: LIFECYCLE_TEST_TIMEOUT_MS }`.

---

## 2. Test Categories

**2.1 Command tests** (`commands/`): Non-interactive. Use `runCLI()`. Test flags, output text, exit codes, and file system side effects. One `describe` per command, split into files when a command has 15+ tests.

**2.2 Interactive tests** (`interactive/`): Wizard flows. Use `TerminalSession`. Test keyboard navigation, step transitions, wizard completion, and resulting file output. Split by concern: `init-wizard-stack`, `init-wizard-scratch`, `edit-wizard-local`.

**2.3 Lifecycle tests** (`lifecycle/`): Multi-phase flows spanning commands. A single `it()` block runs Phase 1 (init) -> Phase 2 (compile/edit) -> Phase 3 (uninstall) -> Phase 4 (verify clean state). Use `TerminalSession` for interactive phases, `runCLI` for non-interactive phases.

**2.4 Integration tests** (`integration/`): Cross-command pipelines. Example: eject templates, modify them, compile, verify custom template content appears in output. Use `runCLI` exclusively.

**2.5 Smoke tests** (`smoke/`): Third-party binary probes (Claude CLI). These test whether external tools work, not our CLI. Use `describe.skipIf(!claudeAvailable)`. Never import production functions except `isClaudeCLIAvailable` and other `exec.ts` utilities for guards. Smoke tests also import `exec.ts` functions (`execCommand`, `claudePluginInstall`, etc.) because they test the Claude CLI binary directly, not our CLI.

---

## 3. CLI Execution

### Non-interactive: `runCLI`

**3.1 Use `runCLI()` from `test-utils.ts` for all non-interactive commands.**

```typescript
import { runCLI, EXIT_CODES } from "../helpers/test-utils.js";

const { exitCode, stdout, stderr, combined } = await runCLI(["compile", "--verbose"], projectDir, {
  env: { AGENTSINC_SOURCE: undefined },
});

expect(exitCode).toBe(EXIT_CODES.SUCCESS);
expect(combined).toContain("Discovered 1 local skills");
```

**3.2 `runCLI` sets `HOME=cwd` by default** to isolate from user's real global config. Override via `options.env.HOME` when testing dual-scope (separate global home and project dir).

**3.3 All output is pre-stripped of ANSI.** `runCLI` calls `stripVTControlCharacters` on stdout, stderr, and combined. No manual stripping needed.

**3.4 Use `COMPILE_ENV`** (`{ AGENTSINC_SOURCE: undefined }`) to prevent remote source resolution during compile tests. Do NOT spread `process.env` into `env` -- `execa` inherits it automatically, and spreading would clobber the `HOME` override.

### Interactive: `TerminalSession`

**3.5 Use `TerminalSession` from `terminal-session.ts` for all interactive flows.**

```typescript
import { TerminalSession } from "../helpers/terminal-session.js";

const session = new TerminalSession(["init", "--source", sourceDir], projectDir, {
  cols: 120,
  rows: 60,
  env: { AGENTSINC_SOURCE: undefined },
});
```

**3.6 `TerminalSession` architecture:**

- Spawns `node bin/run.js` via `@lydell/node-pty` (prebuilt binaries, no C++ compilation)
- Spreads `process.env` and sets `HOME=cwd`, `NO_COLOR=1`, `FORCE_COLOR=0` (color suppression ensures clean xterm buffer reads)
- Pipes PTY output to `@xterm/headless` virtual terminal (processes all ANSI/cursor codes)
- `getScreen()`: visible viewport only
- `getFullOutput()`: viewport + scrollback (use for most assertions)
- `getRawOutput()`: raw PTY data with ANSI stripped (for text that Ink overwrites in the buffer)
- `waitForText()`: polls `getFullOutput()` every 50ms until match or timeout
- `waitForStableRender()`: waits for wizard footer ("navigate") then returns `getFullOutput()`
- `waitForExit()`: waits for process to exit, returns exit code
- Kills process tree via `tree-kill` on destroy

**3.7 Always destroy sessions.** Use `afterEach` for interactive/command tests (each test is independent) or `afterAll` for lifecycle tests (phases share state):

```typescript
// Interactive/command tests: afterEach (independent tests)
afterEach(async () => {
  await session?.destroy();
  session = undefined;
});

// Lifecycle tests: afterAll (shared state across phases)
afterAll(async () => {
  await session?.destroy();
  if (tempDir) await cleanupTempDir(tempDir);
});
```

**3.8 Always call `ensureBinaryExists()` in `beforeAll`.** This verifies `bin/run.js` exists before running tests, providing a clear error if the CLI wasn't built:

```typescript
beforeAll(ensureBinaryExists);
```

---

## 4. Interactive Testing

**4.1 Keystroke methods on `TerminalSession`:**

| Method         | Escape Sequence | Usage               |
| -------------- | --------------- | ------------------- |
| `enter()`      | `\r`            | Confirm selection   |
| `arrowDown()`  | `\x1b[B`        | Navigate down       |
| `arrowUp()`    | `\x1b[A`        | Navigate up         |
| `arrowLeft()`  | `\x1b[D`        | Navigate left       |
| `arrowRight()` | `\x1b[C`        | Navigate right      |
| `space()`      | ` `             | Toggle checkbox     |
| `escape()`     | `\x1b`          | Cancel / back       |
| `tab()`        | `\t`            | Next section        |
| `ctrlC()`      | `\x03`          | Interrupt           |
| `write(str)`   | any string      | Type text or hotkey |

**4.2 The `waitForText` -> `delay` -> `keystroke` pattern.** Every wizard step follows this sequence:

```typescript
// Wait for the step to render
await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
// Allow rendering to stabilize
await delay(STEP_TRANSITION_DELAY_MS);
// Send input
session.enter();
```

Never send keystrokes without first waiting for the expected UI text. The delay after `waitForText` prevents race conditions where the UI hasn't finished rendering all elements.

**4.3 Use `waitForStableRender()` for assertions on wizard content.** It waits for the footer ("navigate") to render (last element in Ink tree), guaranteeing all content above is stable:

```typescript
const output = await session.waitForStableRender();
expect(output).toContain("web-framework-react");
```

**4.4 For text that Ink overwrites (installation progress), use `getRawOutput()`.** The xterm buffer has limited scrollback (1000 lines). Installation warnings may exceed this. `getRawOutput()` captures everything:

```typescript
await waitForRawText(session, "initialized successfully", INSTALL_TIMEOUT_MS);
```

**4.5 Send hotkeys with `session.write()`.** Wizard hotkeys are single characters — send them as `session.write("a")`. See `hotkeys.ts` for the full registry. Do not hardcode hotkey characters in tests; if a hotkey changes, the test should break at the `waitForText` assertion, not silently pass with the wrong key.

**4.6 Use shared navigation helpers for repeated patterns:**

| Helper                                                | Purpose                                                      | Source          |
| ----------------------------------------------------- | ------------------------------------------------------------ | --------------- |
| `navigateInitWizardToCompletion(session, timeoutMs?)` | Stack -> Domain -> Build("a") -> Confirm -> wait for success | `test-utils.ts` |
| `navigateEditWizardToCompletion(session, timeoutMs?)` | Build -> Sources -> Agents -> Confirm                        | `test-utils.ts` |
| `passThroughAllBuildDomains(session, timeoutMs?)`     | Web -> API -> Shared domain build steps                      | `test-utils.ts` |
| `waitForRawText(session, text, timeoutMs)`            | Poll raw PTY output (bypasses xterm buffer limits)           | `test-utils.ts` |

---

## 5. File System

**5.1 Use `createTempDir()` / `cleanupTempDir()` from `test-utils.ts`.** Never import `mkdtemp` or `os.tmpdir()` directly. The helper uses a consistent `ai-e2e-` prefix.

```typescript
let tempDir: string;

beforeAll(async () => {
  tempDir = await createTempDir();
}, SETUP_TIMEOUT_MS);

afterAll(async () => {
  if (tempDir) await cleanupTempDir(tempDir);
});
```

**5.2 Use `fileExists()` / `directoryExists()` from `test-utils.ts`**, not `fs.stat` or `fs.access` directly.

**5.3 Use `readTestFile()` instead of raw `readFile(path, "utf-8")`.** Consistent helper from `test-utils.ts`.

**5.4 Use `listFiles()` instead of raw `readdir()`.** Returns `[]` on error instead of throwing.

**5.5 Project factory functions create test fixtures:**

| Factory                                        | Creates                                      | Use When                                 |
| ---------------------------------------------- | -------------------------------------------- | ---------------------------------------- |
| `createMinimalProject(tempDir)`                | Config + 1 skill                             | Compile tests                            |
| `createEditableProject(tempDir, opts?)`        | Config + skills + agents dir                 | Edit wizard tests                        |
| `createDualScopeProject(tempDir)`              | Global home + project with separate configs  | Dual-scope tests                         |
| `createProjectWithCustomSkill(tempDir)`        | Config + custom skill ID + config-types.ts   | Custom skill validation                  |
| `createLocalSkill(projectDir, skillId, opts?)` | Skill dir with SKILL.md + optional metadata  | Add skill to existing project            |
| `writeProjectConfig(baseDir, config)`          | `.claude-src/config.ts`                      | Override config in any project           |
| `createMinimalInstallation(dir)`               | Minimal config.ts for `detectInstallation()` | Commands requiring existing installation |

**5.6 Source fixtures for wizard tests:**

| Factory                        | Creates                                                                                            | Use When                |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------- |
| `createE2ESource(opts?)`       | 10 skills, 2 agents, 1 stack, templates. Optional `relationships` for slug-based resolution tests. | Local-mode wizard tests |
| `createE2EPluginSource(opts?)` | Above + built plugins + marketplace.json. Optional `marketplaceName`, `relationships`.             | Plugin-mode tests       |

Create sources in `beforeAll` (expensive). Share across tests in a file. Each test creates its own `tempDir` with its own project for isolation.

**5.7 Create `.claude/settings.json` before interactive tests.** Without it, the permission checker renders a blocking Ink prompt after install and the PTY never exits:

```typescript
await createPermissionsFile(projectDir);
```

---

## 6. Assertions

**6.1 Use shared assertion helpers from `plugin-assertions.ts`:**

| Helper                                                      | Checks                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| `verifyConfig(projectDir, { skillIds?, source?, agents? })` | Config.ts exists and contains expected values              |
| `verifyAgentCompiled(projectDir, agentName)`                | Agent `.md` exists with YAML frontmatter                   |
| `verifySkillCopiedLocally(projectDir, skillId)`             | `SKILL.md` exists in `.claude/skills/<id>/`                |
| `verifyPluginInSettings(projectDir, pluginKey)`             | Plugin enabled in `settings.json`                          |
| `verifyPluginInRegistry(homeDir, pluginKey, scope?)`        | Plugin in `installed_plugins.json` (optional scope filter) |
| `verifyNoLocalSkills(projectDir)`                           | No skill directories in `.claude/skills/`                  |
| `verifyNoPlugins(projectDir)`                               | No enabled plugins in `settings.json`                      |

**6.2 Assert exit codes with named constants.** Never use bare numbers:

```typescript
expect(exitCode).toBe(EXIT_CODES.SUCCESS); // 0
expect(exitCode).toBe(EXIT_CODES.ERROR); // 1
expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS); // 2
```

**6.3 Assert output text with `toContain` or `toMatch`.** Prefer substrings over exact strings (wizard text evolves). Use `toMatch` with regex for dynamic content:

```typescript
expect(combined).toContain("Discovered 1 local skills");
expect(combined).toMatch(/Recompiled \d+ global agents/);
expect(combined).toMatch(/\d+ added/);
```

**6.4 Never assert on single characters or whitespace.** `toContain("+")` or `toContain("-")` match skill IDs, not change indicators. `toContain("G ")` matches any word starting with G. Use distinctive substrings.

**6.5 For negative assertions, verify specific absence:**

```typescript
// BAD: asserts nothing meaningful
expect(combined).not.toContain("error");

// GOOD: asserts specific skill is absent
expect(configContent).not.toContain("web-styling-tailwind");
```

**6.6 Assert file content, not just existence.** An empty or corrupted file passes `fileExists()`:

```typescript
const content = await readTestFile(agentPath);
expect(content).toMatch(/^---\n/); // YAML frontmatter
expect(content).toContain("web-framework-react"); // Expected skill reference
```

---

## 7. Timing & Reliability

**7.1 Use named timing constants from `test-utils.ts`.** Never inline timeout numbers:

| Constant                      | Value   | Usage                        |
| ----------------------------- | ------- | ---------------------------- |
| `WIZARD_LOAD_TIMEOUT_MS`      | 10,000  | Wait for wizard to render    |
| `INSTALL_TIMEOUT_MS`          | 30,000  | Wait for installation        |
| `STEP_TRANSITION_DELAY_MS`    | 500     | Delay after advancing a step |
| `KEYSTROKE_DELAY_MS`          | 150     | Delay after a single key     |
| `EXIT_TIMEOUT_MS`             | 10,000  | Wait for process exit        |
| `PLUGIN_INSTALL_TIMEOUT_MS`   | 60,000  | Plugin install timeout       |
| `EXIT_WAIT_TIMEOUT_MS`        | 30,000  | Lifecycle process exit       |
| `SETUP_TIMEOUT_MS`            | 60,000  | `beforeAll` hooks            |
| `LIFECYCLE_TEST_TIMEOUT_MS`   | 180,000 | Multi-phase lifecycle tests  |
| `INTERACTIVE_TEST_TIMEOUT_MS` | 120,000 | Interactive wizard tests     |

**7.2 Use `delay()` from `test-utils.ts`** for explicit waits between keystrokes or after step transitions. Never use raw `setTimeout` or `new Promise(r => setTimeout(r, ms))` in tests.

**7.3 Set per-test timeouts for long tests:**

```typescript
it("should complete full lifecycle", { timeout: LIFECYCLE_TEST_TIMEOUT_MS }, async () => {
  // ...
});
```

**7.4 `waitForText` is CI-aware.** Default timeout is 10s locally, 20s in CI (`process.env.CI`). Always pass explicit timeouts for operations that take longer than defaults.

**7.5 Wait for specific text, not arbitrary delays.** The `waitForText` -> `delay` -> `keystroke` pattern is the core reliability mechanism. The `delay(STEP_TRANSITION_DELAY_MS)` after `waitForText` is not arbitrary -- it accounts for Ink rendering remaining elements after the matched text appears.

**7.6 For process exit, use `waitForExit()`, not sleep:**

```typescript
const exitCode = await session.waitForExit(INSTALL_TIMEOUT_MS);
expect(exitCode).toBe(EXIT_CODES.SUCCESS);
```

---

## 8. Source & Marketplace Setup

**8.1 The E2E source contains exactly 10 skills across 3 domains:**

| Domain | Skills                                                           |
| ------ | ---------------------------------------------------------------- |
| web    | `web-framework-react`, `web-testing-vitest`, `web-state-zustand` |
| api    | `api-framework-hono`                                             |
| shared | 6 methodology skills (`meta-methodology-*`)                      |

**8.2 The E2E source defines 1 stack** ("E2E Test Stack") mapping skills to 2 agents (`web-developer`, `api-developer`).

**8.3 `createE2ESource()` creates the full source directory** -- skills with `SKILL.md` + `metadata.yaml`, agents with `metadata.yaml` + `identity.md` + `playbook.md`, a `stacks.ts` config, and an `agent.liquid` template.

**8.4 `createE2EPluginSource()` extends the above** by running `runCLI(["build", "plugins"])` and `runCLI(["build", "marketplace", "--name", ...])` on the source. Returns `{ sourceDir, tempDir, marketplaceName, pluginsDir }`.

**8.5 Use `describe.skipIf()` for tests requiring external dependencies.** Plugin-mode tests use `describe.skipIf(!claudeAvailable)` to skip when Claude CLI is absent. Real marketplace tests use `describe.skipIf(!hasSkillsSource)` to skip when the skills repo isn't available. Do not mock external binaries -- test against the real thing and skip gracefully when unavailable:

```typescript
const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("plugin mode lifecycle", () => {
  // Tests that require the Claude CLI binary
});
```

---

## 9. Scope Testing

**9.1 Non-interactive dual-scope tests use `createDualScopeProject()`.** Creates a fake `HOME` at `tempDir/global-home` and a project at `tempDir/project` with separate configs and pre-created skills. Interactive dual-scope lifecycle tests (e.g., `dual-scope-edit-display`) build the two-scope state through the wizard itself -- they extract helper functions like `initGlobal()`, `initProject()`, and `createTestEnvironment()` to manage multi-phase setup.

**9.2 Pass `HOME` in env for dual-scope commands:**

```typescript
const { exitCode } = await runCLI(["compile"], projectDir, {
  env: { HOME: globalHome, AGENTSINC_SOURCE: undefined },
});
```

**9.3 Lifecycle scope verification pattern:**

```typescript
// Phase 1: Init global (HOME = fakeHome, cwd = fakeHome)
// Phase 2: Init project (HOME = fakeHome, cwd = projectDir)
// Phase 3: Edit from project (HOME = fakeHome, cwd = projectDir)
// Phase 4: Verify both configs independently
await verifyConfig(globalHome, { skillIds: ["web-framework-react"] });
await verifyConfig(projectDir, { skillIds: ["api-framework-hono"] });
```

**9.4 Scope indicators in wizard output:** `"G "` prefix for global skills, `"P "` prefix for project skills. Agent scope badges: `"[G]"`, `"[P]"`.

---

## 10. Anti-Patterns

**10.1 Never import production functions to call them directly.** E2E tests spawn the CLI binary. Importing `installLocal()`, `splitConfigByScope()`, or `writeScopedConfigs()` makes it a unit/integration test, not E2E. Acceptable imports: constants (`CLAUDE_DIR`, `EXIT_CODES`), types (`SkillId`, `AgentName`), test data generators (`renderSkillMd`, `renderConfigTs`), `isClaudeCLIAvailable` for guards, and test factory helpers (`createMockSkillAssignment`).

**10.2 Never use `as SkillId` casts on valid union members.** Strings like `"web-framework-react"` are already valid `SkillId` literals. Only cast test-only IDs (e.g., `"web-custom-e2e-widget" as SkillId`), and extract those to file-level constants with a single cast.

**10.3 Never use `mkdtemp` or `os.tmpdir()` directly.** Always use `createTempDir()` / `cleanupTempDir()`.

**10.4 Never use `readFile` from `fs/promises` directly.** Use `readTestFile()` from `test-utils.ts`.

**10.5 Never hardcode path segments.** Use constants: `CLAUDE_DIR` (not `".claude"`), `CLAUDE_SRC_DIR` (not `".claude-src"`), `STANDARD_FILES.CONFIG_TS`, `STANDARD_FILES.SKILL_MD`, `STANDARD_FILES.METADATA_YAML`, `STANDARD_DIRS.SKILLS`.

**10.6 Never inline timeout numbers.** Use the named constants from Section 7.1.

**10.7 Never test the Claude CLI binary from E2E tests.** Testing `claude plugin install` directly is a smoke test, not E2E. Place in `smoke/` with `.smoke.test.ts` extension.

**10.8 Never skip cleanup on test failure.** Use `afterEach`/`afterAll` for cleanup in test bodies. `afterEach` runs even when tests throw. Exception: extracted helper functions in lifecycle tests (e.g., `initGlobal()`, `initProject()`) may use try/finally to destroy sessions they create and manage internally.

**10.9 Never duplicate helper logic across files.** If 3+ files share the same setup or assertion pattern, extract to `test-utils.ts` or `plugin-assertions.ts`.

**10.10 Avoid hardcoding arrow-down counts for navigation.** Prefer `waitForText` to find the target content, then send keystrokes. Hardcoded counts (`for i < 7: arrowDown()`) break when list items change. In practice, some lifecycle tests (e.g., dual-scope agent step navigation) still use counted loops because the target item has no unique text to wait for -- document the assumption with a comment when this is unavoidable.

**10.11 Use `tempDir = undefined!` in cleanup blocks.** The codebase standardizes on the non-null assertion pattern `tempDir = undefined!` in `afterEach`/`afterAll` cleanup. The variable is declared as `let tempDir: string` (not `string | undefined`) and assigned in the test body before use, then reset in cleanup.

**10.12 Use `it.fails()` for known bugs.** When a test documents expected behavior that the CLI doesn't yet implement correctly, mark it with `it.fails()` instead of weakening assertions. This keeps the suite green while documenting the bug. Add a comment explaining the bug and its location:

```typescript
// BUG: CLI exits 0 with corrupt source — it falls back to default source
// instead of reporting an error for the invalid --source directory.
it.fails("should handle corrupt source without crashing", async () => {
  // ... test that would pass once the bug is fixed
  expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
});
```

When the bug is fixed, removing `it.fails()` makes the test start passing -- no assertion changes needed. Never broaden assertions to accommodate bugs.

---

## 11. Additional Exports from `test-utils.ts`

Beyond the constants and factories documented above, `test-utils.ts` exports:

| Export                               | Purpose                                                                |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `COMPILE_ENV`                        | `{ AGENTSINC_SOURCE: undefined }` -- prevents remote source resolution |
| `OCLIF_EXIT_CODES`                   | `{ UNKNOWN_COMMAND: 127 }` -- oclif-specific exit codes                |
| `FORKED_FROM_METADATA`               | Standard forkedFrom metadata block for plugin/uninstall tests          |
| `CLI_ROOT`                           | Absolute path to the repository root                                   |
| `BIN_RUN`                            | Absolute path to `bin/run.js` (the built binary)                       |
| `ensureBinaryExists()`               | Verifies `bin/run.js` exists; throws if CLI wasn't built               |
| `stripAnsi(text)`                    | Strips ANSI escape sequences (wraps `stripVTControlCharacters`)        |
| `getEjectedTemplatePath(projectDir)` | Returns path to ejected `agent.liquid` template                        |
| `renderConfigTs(config)`             | Re-exported from content-generators -- renders a config.ts string      |
| `renderSkillMd(id, desc, content?)`  | Re-exported from content-generators -- renders a SKILL.md string       |

---

## 12. What a Real E2E Test Must Do

A test is E2E if it:

1. Spawns the CLI binary (via `runCLI` for non-interactive, `TerminalSession` for interactive)
2. Sends input the way a user would (command-line args, keyboard keys)
3. Asserts on what the user sees (terminal output, files on disk, exit codes)
4. Never calls production functions directly

If a test calls `installLocal()`, `compileAllAgents()`, or `splitConfigByScope()` directly, it belongs in `src/cli/lib/__tests__/`, not in `e2e/`.
