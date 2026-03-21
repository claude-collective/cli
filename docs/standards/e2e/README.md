# E2E Testing Standards

Standards and conventions for the E2E test suite. These docs govern how tests are written, structured, and maintained. For API details, read the source files directly.

**Audience:** Developers and AI agents writing or modifying E2E tests.

---

## Architecture

The framework uses a 5-layer Page Object Model adapted for terminal-based CLI testing. Each layer has a single responsibility and a strict boundary: a layer may only call the layer directly below it.

```
+-------------------------------------------------------------------+
|  TEST LAYER                                                        |
|  e2e/{commands,interactive,lifecycle,integration,smoke}/*.test.ts  |
|  Uses: wizards, CLI.run, matchers. Never touches Session.          |
+-------------------------------------------------------------------+
                              |
+-------------------------------------------------------------------+
|  WIZARD LAYER                                                      |
|  e2e/pages/wizards/{init-wizard,edit-wizard}.ts                    |
|  Spawns session, returns first step. Composite flows.              |
+-------------------------------------------------------------------+
                              |
+-------------------------------------------------------------------+
|  STEP LAYER                                                        |
|  e2e/pages/steps/{stack,domain,build,sources,agents,confirm}.ts    |
|  e2e/pages/steps/search-modal.ts                                   |
|  Methods model user intent, return next-step objects.              |
+-------------------------------------------------------------------+
                              |
+-------------------------------------------------------------------+
|  SCREEN LAYER                                                      |
|  e2e/pages/terminal-screen.ts                                      |
|  Auto-retrying text matchers, stable render detection.             |
+-------------------------------------------------------------------+
                              |
+-------------------------------------------------------------------+
|  SESSION LAYER (framework-internal)                                |
|  e2e/helpers/terminal-session.ts                                   |
|  Raw PTY (node-pty + @xterm/headless). Never used in tests.       |
+-------------------------------------------------------------------+
```

**Horizontal layers** support all vertical layers:

| Layer | Files | Purpose |
|-------|-------|---------|
| Matchers | `e2e/matchers/project-matchers.ts`, `setup.ts` | Custom Vitest matchers for file-based assertions |
| Fixtures | `e2e/fixtures/project-builder.ts`, `cli.ts`, `dual-scope-helpers.ts`, `interactive-prompt.ts` | Project creation, CLI execution, scope helpers |
| Constants | `e2e/pages/constants.ts` | All UI text, paths, timeouts, exit codes |

---

## Directory Structure

```
e2e/
  commands/           # Non-interactive command tests (CLI.run)
  interactive/        # Wizard and interactive component tests
  lifecycle/          # Multi-phase flows: init -> edit -> compile -> uninstall
  integration/        # Cross-command pipelines
  smoke/              # Third-party binary probes, framework validation
  helpers/
    test-utils.ts         # runCLI, createTempDir, path helpers, re-exports
    terminal-session.ts   # PTY wrapper (framework-internal, never imported by tests)
    create-e2e-source.ts  # 10-skill E2E source factory
  fixtures/
    project-builder.ts    # Project directory factories (ProjectBuilder)
    cli.ts                # Non-interactive CLI runner (CLI.run)
    dual-scope-helpers.ts # Multi-phase dual-scope lifecycle helpers
    interactive-prompt.ts # Non-wizard interactive prompt page object
  pages/
    constants.ts          # DIRS, FILES, STEP_TEXT, TIMEOUTS, EXIT_CODES, INTERNAL_DELAYS
    base-step.ts          # Abstract base for all step page objects
    terminal-screen.ts    # Screen abstraction over TerminalSession
    wizard-result.ts      # WizardResult + ProjectHandle types
    dashboard-session.ts  # Dashboard mode page object
    wizards/
      init-wizard.ts      # InitWizard entry point
      edit-wizard.ts      # EditWizard entry point
    steps/
      stack-step.ts       # Stack selection step
      domain-step.ts      # Domain selection step
      build-step.ts       # Skill selection / build step
      sources-step.ts     # Source configuration step
      agents-step.ts      # Agent selection step
      confirm-step.ts     # Confirm and install step
      search-modal.ts     # Search overlay (opened from build step)
  matchers/
    project-matchers.ts   # Custom Vitest matcher implementations
    setup.ts              # Matcher registration + type augmentation
```

---

## Test Categories

| Category | Directory | Tool | Description |
|----------|-----------|------|-------------|
| Command | `commands/` | `CLI.run()` | Non-interactive commands: flags, output, exit codes, file side effects. One `describe` per command; split into files when a command has 15+ tests. |
| Interactive | `interactive/` | `InitWizard` / `EditWizard` | Wizard flows: navigation, step transitions, completion. Split by concern: `init-wizard-stack`, `edit-wizard-local`. |
| Lifecycle | `lifecycle/` | Both | Multi-phase: init, edit, compile, uninstall across shared project state. Single `it()` block per lifecycle. |
| Integration | `integration/` | `CLI.run()` | Cross-command pipelines (e.g., eject then compile) |
| Smoke | `smoke/` | Various | Third-party probes (Claude CLI). May import `exec.ts` functions (`execCommand`, `claudePluginInstall`, etc.) because they test the Claude CLI binary directly, not our CLI. Use `describe.skipIf(!claudeAvailable)`. |

---

## File Naming

- Test files: `{feature}.e2e.test.ts`
- Smoke tests: `{feature}.smoke.test.ts`
- Split at 300 LOC or when a file covers 2+ unrelated concerns
- Use descriptive names: `edit-wizard-plugin-migration.e2e.test.ts`, not `edit-2.e2e.test.ts`
- No task IDs in `describe()` blocks (task IDs may appear in file-level JSDoc comments only)

---

## Vitest Configuration

**File:** `e2e/vitest.config.ts`

| Setting | Value | Notes |
|---------|-------|-------|
| `pool` | `"forks"` | Process isolation between test files |
| `testTimeout` | `30_000` | Default per-test timeout |
| `hookTimeout` | `60_000` | Default for beforeAll/afterAll |
| `retry` | `1` | Automatic retry on first failure |
| `include` | `e2e/**/*.e2e.test.ts` | Smoke tests (`*.smoke.test.ts`) excluded, run explicitly |
| `globalSetup` | `./e2e/global-setup.ts` | Pre-suite setup |

Long tests override per-test: `it("...", { timeout: TIMEOUTS.LIFECYCLE }, async () => {})`.

---

## Constants Quick-Reference

All constants live in `e2e/pages/constants.ts`. Tests import from here, never from `src/cli/`.

**Directories (`DIRS`):** `CLAUDE`, `CLAUDE_SRC`, `SKILLS`, `AGENTS`, `PLUGINS`, `PLUGIN_MANIFEST`

**Files (`FILES`):** `CONFIG_TS`, `CONFIG_TYPES_TS`, `SKILL_MD`, `METADATA_YAML`, `SETTINGS_JSON`, `INSTALLED_PLUGINS_JSON`, `INTRO_MD`, `WORKFLOW_MD`, `PLUGIN_JSON`

**Step text (`STEP_TEXT`):** `STACK`, `DOMAIN_WEB`, `DOMAIN_API`, `DOMAIN_SHARED`, `BUILD`, `SOURCES`, `AGENTS`, `CONFIRM`, `INIT_SUCCESS`, `EDIT_SUCCESS`, `EDIT_UNCHANGED`, `COMPILE_SUCCESS`, `EJECT_SUCCESS`, `IMPORT_SUCCESS`, `UNINSTALL_SUCCESS`, `LOADING_SKILLS`, `RECOMPILING`, `COMPILING_STACK`, `LOADED`, `LOADED_LOCAL`, `CONFIRM_UPDATE`, `CONFIRM_UNINSTALL`, `SEARCH`, `DASHBOARD`, `FOOTER_SELECT`, `START_FROM_SCRATCH`, `TOGGLE_SELECTION`, `NO_INSTALLATION`, `TOO_NARROW`, `TOO_SHORT`

**Timeouts (`TIMEOUTS`):** `WIZARD_LOAD` (15s), `INSTALL` (30s), `PLUGIN_INSTALL` (60s), `PLUGIN_TEST` (90s), `EXIT` (10s), `EXIT_WAIT` (30s), `SETUP` (60s), `LIFECYCLE` (180s), `EXTENDED_LIFECYCLE` (300s), `INTERACTIVE` (120s)

**Exit codes (`EXIT_CODES`):** `SUCCESS` (0), `ERROR` (1), `INVALID_ARGS` (2), `NETWORK_ERROR` (3), `CANCELLED` (4), `UNKNOWN_COMMAND` (127)

**`INTERNAL_DELAYS`** contains `STEP_TRANSITION` and `KEYSTROKE`. These are framework-internal and must never appear in test files.

**Source paths (`SOURCE_PATHS`):** `SKILLS_DIR`, `SKILL_CATEGORIES`, `SKILL_RULES`, `STACKS_FILE`, `PLUGIN_MANIFEST_DIR`

These are paths within a skills source directory (not a project directory). Use for tests that assert on source structure.

---

## Further Reading

| Topic | File |
|-------|------|
| Test structure and the three-phase pattern | [test-structure.md](./test-structure.md) |
| Setting up test data and fixtures | [test-data.md](./test-data.md) |
| Assertions and custom matchers | [assertions.md](./assertions.md) |
| Reusable patterns for each test type | [patterns.md](./patterns.md) |
| Page Object Model framework | [page-objects.md](./page-objects.md) |
| Rules and anti-patterns | [anti-patterns.md](./anti-patterns.md) |
