# D-134: Declarative E2E Test Framework

## Problem Statement

The E2E test suite (70 files, 21,371 lines) is **imperative and fragile**. Tests spell out individual keystrokes, delays, and screen scrapes instead of describing user intent. This means:

1. **Tests don't catch what they should.** When a UI label changes, tests break — but when actual behavior regresses, tests often pass because they assert on incidental text, not outcomes.
2. **Identical navigation sequences are duplicated 6+ times.** The "Stack -> Domain -> Build -> Confirm" flow is independently re-implemented in `init-wizard-stack`, `init-wizard-plugin`, `test-utils.ts`, `source-switching-modes`, `config-scope-integrity`, and inline in lifecycle tests. Each copy drifts slightly.
3. **Tests are coupled to implementation details.** 70+ imports from `src/cli/` into E2E files. Tests reach into `config.ts` content with regex, inspect directory structures, and construct paths using internal constants.
4. **Navigation is index-based.** Tests press `arrowDown()` N times to reach a specific item. Adding or reordering items breaks these tests silently.
5. **1,571+ hardcoded delays** scattered across all files. No intelligent waiting strategy.

### By the Numbers

| Anti-Pattern                           | Count    | Scope              |
| -------------------------------------- | -------- | ------------------ |
| `waitForText` calls                    | 462      | 32 files           |
| `session.enter()` calls                | 272      | all interactive    |
| `delay()` calls                        | 553      | all files          |
| `WIZARD_LOAD_TIMEOUT_MS` references    | 1,018    | all files          |
| `STEP_TRANSITION_DELAY_MS` references  | 451      | all files          |
| `path.join` for paths                  | 577      | all files          |
| `fileExists` / `directoryExists`       | 252      | all files          |
| Production code imports (`src/cli/`)   | ~70      | 30+ files          |
| Try-catch blocks                       | 56       | 10+ files          |
| Nested try-catch (3+ levels)           | 8+       | 4 files            |
| Index-based arrow navigation           | 4+ known | fragile            |
| Duplicated "full init flow"            | 6+       | independent copies |
| Duplicated "edit wizard to completion" | 5+       | independent copies |
| Total `expect()` assertions            | 1,667    | all files          |

### Top Duplicated `waitForText` Strings (36 unique across all files)

**Step identification:**
| String | Count | Fragility |
|---|---|---|
| `"Web"` | 82 | Domain label — changes if renamed |
| `"Choose a stack"` | 39 | Step header text |
| `"Ready to install"` | 38 | Confirm step header |
| `"Customize skill sources"` | 37 | Sources step header |
| `"Select agents"` | 34 | Agents step header |
| `"Framework"` | 25+ | Build step category |
| `"API"` | 20+ | Domain label |
| `"Shared"` | 15+ | Domain label |

**Completion/status:**
`"initialized successfully"`, `"Plugin updated"`, `"Loaded"`, `"Loaded from local:"`, `"Loading skills"`, `"Recompiling agents"`, `"Compiling stack"`

**Prompts:**
`"Proceed with update?"`, `"Are you sure you want to uninstall"`

**UI/content:**
`"Too narrow"`, `"too short"`, `"No installation found"`, `"Search Skills"`, `"E2E Test Stack"`, `"Mobile"`, `"Sources"`, `"TOPICS"`, `"USAGE"`, `"Toggle selection"`, `"Uninstall complete"`, `"select"` (footer for stable render)

These are **magic strings** — if any UI text changes, dozens of tests break across many files.

---

## Backwards Compatibility Policy

**There is no backwards compatibility period.** This is a pre-1.0 project. We do not maintain two systems.

The migration is structured as a sequence of **break-then-fix** steps. Each step:

1. Introduces a new framework piece (or modifies an existing helper)
2. Immediately migrates ALL tests that use the old pattern
3. Deletes the old code in the same step

If a step breaks tests, the fix is in the same step. We never have a commit where old helpers and new page objects serve the same purpose. The sequencing (Section: Sequenced Refactoring Steps) is designed so that each step's blast radius is obvious — when tests fail, you know exactly which change caused it because you just made one atomic change.

**Why this matters for AI agents:** E2E test debugging is slow and error-prone for AI agents because:

- Running the full suite takes minutes
- Terminal output is hard to parse from error messages
- Flaky timing makes it unclear if a failure is real

By keeping each migration step atomic (one old pattern replaced, old code deleted), when tests fail you know the cause is the change you just made — not drift from a parallel system. This eliminates the debugging ambiguity that makes E2E failures hard for agents to resolve.

---

## The Golden Rule: Tests Never Touch the Filesystem

This is the single most important constraint in the entire framework. **E2E test code (the `it()` block) must NEVER create, modify, or read files directly.** No `writeFile`, no `mkdir`, no `readFile`, no `path.join` to construct paths to implementation files.

There are exactly two categories of file operations in E2E:

1. **Setup fixtures** (`ProjectBuilder`, `createE2ESource`) — these run BEFORE the test, in `beforeAll`/`beforeEach` or inside a fixture factory. They create the initial project state. This is the ONLY place where files are created directly.

2. **Custom matchers** (`toHaveConfig`, `toHaveCompiledAgents`) — these run AFTER the CLI has done its work. They read files to verify outcomes. The file-reading logic lives inside the matcher, never in the test.

The test itself only does three things:

- **Launch** a wizard or CLI command (through page objects or `CLI.run()`)
- **Interact** with the wizard (through step methods)
- **Assert** on the result (through custom matchers)

If a test needs to verify config content, it uses `await expect(project).toHaveConfig({ skillIds: [...] })` — it does NOT read `config.ts` and inspect strings.

If a test needs a specific state between phases, it achieves that state through CLI interactions (running another wizard session with different selections). If the state is unreachable through user interactions, it doesn't belong in E2E — move it to a unit or integration test.

**Why:** Every `writeFile` or `readFile` in a test body is a coupling point to the implementation. When the config format changes, when directory structures change, when file naming conventions change — these tests break. But the CLI's behavior didn't change. The test was testing implementation, not behavior.

---

## Design Principles

Adapted from Playwright's Page Object Model and Martin Fowler's POM guidance:

1. **"If you have `session.waitForText()` in your test methods, you're doing it wrong."** Tests describe user stories, not terminal mechanics.
2. **Assertions in tests, not page objects.** Page objects return data and step objects; tests make assertions. Exception: step-transition waits are internal to navigation methods.
3. **Step methods return new step objects.** TypeScript enforces valid navigation paths — `buildStep.confirm()` is a compile error because `BuildStep` has no `confirm()` method.
4. **Delays are internal to the framework.** `STEP_TRANSITION_DELAY_MS` and `KEYSTROKE_DELAY_MS` disappear from test code entirely.
5. **Text constants are centralized in step classes.** When UI text changes, only one file needs updating.
6. **Navigate by name, not by index.** `agents.toggleAgent("api-developer")` instead of `arrowDown()` 7 times.
7. **No production imports in tests.** E2E tests import only from `e2e/` — never from `src/cli/`.
8. **One abstraction, not two.** When a new helper replaces an old one, the old one is deleted in the same step. No coexistence period.
9. **Tests never create or modify files.** Outside of setup fixtures (`ProjectBuilder`, `createE2ESource`), test code NEVER calls `writeFile`, `mkdir`, `readFile`, or constructs file paths. All state changes happen through the CLI (wizard interactions or commands). If a state can't be reached through user interactions, it doesn't belong in an E2E test — move it to a unit or integration test. This is the single most important principle. Violating it means the test is asserting on implementation details, not user-visible behavior.

---

## Architecture: Layer Diagram

```
+--------------------------------------------------------------+
|  TEST LAYER                                                   |
|  Tests use page objects and custom matchers.                  |
|  Never touch TerminalSession, never import from src/cli/.    |
|  e2e/interactive/*.e2e.test.ts                               |
|  e2e/lifecycle/*.e2e.test.ts                                 |
|  e2e/commands/*.e2e.test.ts                                  |
+----------------------------+---------------------------------+
                             |
+----------------------------v---------------------------------+
|  WIZARD LAYER (entry points)                                  |
|  InitWizard, EditWizard — spawn session, return first step.  |
|  Composite flows: completeWithDefaults(stackName?)             |
|  All flows go through every step — no shortcut keys.          |
|  e2e/pages/wizards/init-wizard.ts                            |
|  e2e/pages/wizards/edit-wizard.ts                            |
+----------------------------+---------------------------------+
                             |
+----------------------------v---------------------------------+
|  STEP LAYER (page objects)                                    |
|  StackStep, DomainStep, BuildStep, SourcesStep,             |
|  AgentsStep, ConfirmStep — one class per wizard step.        |
|  SearchModal — overlay (buggy, tests expected to fail).      |
|  Methods model user intent, return next-step objects.        |
|  e2e/pages/steps/*.ts                                        |
+----------------------------+---------------------------------+
                             |
+----------------------------v---------------------------------+
|  SCREEN LAYER (terminal locators)                             |
|  TerminalScreen — auto-retrying text matchers.               |
|  Wraps getScreen/getFullOutput/getRawOutput.                 |
|  Manages timeouts and polling internally.                    |
|  e2e/pages/terminal-screen.ts                                |
+----------------------------+---------------------------------+
                             |
+----------------------------v---------------------------------+
|  SESSION LAYER (existing, unchanged)                          |
|  TerminalSession — node-pty + @xterm/headless.               |
|  Raw PTY operations: write, enter, arrowDown, etc.           |
|  e2e/helpers/terminal-session.ts                             |
+--------------------------------------------------------------+
```

**Supporting layers (horizontal):**

```
+--------------------------------------------------------------+
|  MATCHERS LAYER                                               |
|  Custom Vitest matchers: toHaveConfig, toHaveCompiledAgents, |
|  toHavePlugin, toHaveSkillCopied, toHaveNoPlugins, etc.      |
|  e2e/matchers/project-matchers.ts                            |
|  e2e/matchers/setup.ts                                       |
+--------------------------------------------------------------+

+--------------------------------------------------------------+
|  FIXTURES LAYER                                               |
|  ProjectBuilder — fluent API for project directory creation. |
|  Replaces createMinimalProject, createEditableProject, etc.  |
|  e2e/fixtures/project-builder.ts                             |
|  e2e/fixtures/cli.ts                                         |
+--------------------------------------------------------------+

+--------------------------------------------------------------+
|  CONSTANTS LAYER (replaces src/cli/ imports)                  |
|  E2E-specific constants: paths, file names, step identifiers.|
|  Self-contained — no imports from src/cli/.                  |
|  e2e/pages/constants.ts                                      |
+--------------------------------------------------------------+
```

---

## API Design: Before vs After

### Example 1: Full Init Flow with Defaults

**Before (current):**

```typescript
it("should complete a full stack-based init flow", async () => {
  projectDir = await createTempDir();
  const source = await createE2ESource();
  sourceDir = source.sourceDir;
  sourceTempDir = source.tempDir;
  await createPermissionsFile(projectDir);

  session = new TerminalSession(["init", "--source", sourceDir], projectDir, {
    env: { AGENTSINC_SOURCE: undefined },
  });

  await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
  await delay(STEP_TRANSITION_DELAY_MS);
  session.enter();

  await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
  await delay(STEP_TRANSITION_DELAY_MS);
  session.enter();

  await session.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);
  await delay(STEP_TRANSITION_DELAY_MS);
  session.enter(); // Web domain
  await session.waitForText("API", WIZARD_LOAD_TIMEOUT_MS);
  await delay(STEP_TRANSITION_DELAY_MS);
  session.enter(); // API domain
  await session.waitForText("Shared", WIZARD_LOAD_TIMEOUT_MS);
  await delay(STEP_TRANSITION_DELAY_MS);
  session.enter(); // Shared domain

  await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
  await delay(STEP_TRANSITION_DELAY_MS);
  session.enter();
  await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
  await delay(STEP_TRANSITION_DELAY_MS);
  session.enter();

  await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
  await delay(STEP_TRANSITION_DELAY_MS);
  session.enter();

  await session.waitForText("initialized successfully", INSTALL_TIMEOUT_MS);
  const exitCode = await session.waitForExit(INSTALL_TIMEOUT_MS);
  expect(exitCode).toBe(EXIT_CODES.SUCCESS);

  const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
  expect(await fileExists(configPath)).toBe(true);
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  const agentFiles = await listFiles(agentsDir);
  expect(agentFiles.filter((f) => f.endsWith(".md")).length).toBeGreaterThan(0);
});
```

**After (declarative):**

```typescript
it("should complete a full stack-based init flow", async () => {
  const wizard = await InitWizard.launch({ source });
  const result = await wizard.completeWithDefaults();

  expect(await result.exitCode).toBe(0);
  await expect(result.project).toHaveConfig();
  await expect(result.project).toHaveCompiledAgents();
});
```

### Example 2: Scope Toggle in Build Step

**Before:**

```typescript
session = new TerminalSession(["edit"], projectDir, { rows: 40, cols: 120 });
await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
session.write("s");
await delay(STEP_TRANSITION_DELAY_MS);
session.enter();
await session.waitForText("Customize skill sources", EXIT_TIMEOUT_MS);
// ...8 more lines of wait/enter/wait...
const confirmOutput = session.getFullOutput();
expect(confirmOutput).toContain("global");
```

**After:**

```typescript
const wizard = await EditWizard.launch({ projectDir });
await wizard.build.toggleScopeOnFocusedSkill();
const confirm = await wizard.build.advanceToConfirm();
await expect(confirm).toShowScope({ global: 1 });
```

### Example 3: Navigate to Agent by Name (not index)

**Before:** `arrowDown()` x7 + `space()` — breaks when list order changes.

**After:** `await wizard.agents.toggleAgent("api-developer")`

### Example 4: Lifecycle (Init -> Edit -> Verify)

**Before:** 30+ lines spanning 4 phases with manual session create/destroy.

**After:**

```typescript
const initResult = await InitWizard.launch({ source }).then((w) => w.completeWithDefaults());
expect(await initResult.exitCode).toBe(0);
await expect(initResult.project).toHaveConfig({ skillIds: ["web-framework-react"] });

const editResult = await EditWizard.launch({
  projectDir: initResult.project.dir,
  source,
}).then((w) => w.passThrough());
expect(await editResult.exitCode).toBe(0);
await expect(editResult.project).toHaveConfig({ skillIds: ["web-framework-react"] });
```

### Example 5: Non-Interactive Command

**Before:**

```typescript
tempDir = await createTempDir();
const { projectDir, agentsDir } = await createMinimalProject(tempDir);
const result = await runCLI(["compile", "--verbose"], projectDir, {
  env: { AGENTSINC_SOURCE: undefined },
});
expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
expect(result.combined).toContain("Compiled");
const mdFiles = (await listFiles(agentsDir)).filter((f) => f.endsWith(".md"));
expect(mdFiles.length).toBeGreaterThan(0);
```

**After:**

```typescript
const project = await ProjectBuilder.minimal();
const result = await CLI.run(["compile", "--verbose"], project);
expect(result.exitCode).toBe(0);
expect(result.output).toContain("Compiled");
await expect(project).toHaveCompiledAgents();
```

### Example 6: Search Modal (buggy — tests expected to fail)

The search modal has known bugs. Tests should be written using the POM pattern but marked with `it.fails` or `it.skip` until the modal is fixed.

**After:**

```typescript
it.fails("should search and select a skill", async () => {
  const wizard = await InitWizard.launch({ source });
  const domain = await wizard.stack.selectFirstStack();
  const build = await domain.acceptDefaults();
  const search = await build.openSearch();
  await search.type("react");
  await expect(search).toShowResult("web-framework-react");
  await search.selectResult("web-framework-react");
  await search.close();
});
```

### Example 7: Multi-Phase Lifecycle

Lifecycle tests that need different state between phases should achieve that state through user interactions (wizard sessions), not by mutating config files directly. If a state can't be reached through the CLI, it shouldn't be tested in E2E — it belongs in a unit/integration test.

**After:**

```typescript
// Phase 1: Init with defaults
const initResult = await InitWizard.launch({ source }).then((w) => w.completeWithDefaults());
expect(await initResult.exitCode).toBe(0);

// Phase 2: Edit — change source through the wizard's source step
const wizard = await EditWizard.launch({ projectDir: initResult.project.dir, source });
await wizard.build.passThroughAllDomains();
await wizard.sources.setAllPlugin();
const editResult = await wizard.sources
  .advance()
  .then((agents) => agents.acceptDefaults())
  .then((confirm) => confirm.confirm());
expect(await editResult.exitCode).toBe(0);
```

---

## File Structure

```
e2e/
  helpers/
    terminal-session.ts              # Layer 1 (EXISTING, unchanged throughout)
    create-e2e-source.ts             # EXISTING (unchanged)
    create-e2e-plugin-source.ts      # EXISTING (unchanged)

  pages/                             # NEW — Page Object Model
    constants.ts                     # E2E-only constants (replaces src/cli/ imports)
    terminal-screen.ts               # Layer 2: auto-retrying text matchers
    base-step.ts                     # Layer 3: shared step behavior
    steps/
      stack-step.ts                  # StackStep page object
      domain-step.ts                 # DomainStep page object
      build-step.ts                  # BuildStep page object
      sources-step.ts                # SourcesStep page object
      agents-step.ts                 # AgentsStep page object
      confirm-step.ts                # ConfirmStep page object (init + edit variants)
      search-modal.ts                # SearchModal overlay (buggy — tests use it.fails)
    wizards/
      init-wizard.ts                 # InitWizard entry point + completeWithDefaults
      edit-wizard.ts                 # EditWizard entry point + passThrough
    wizard-result.ts                 # Post-completion result + project handle

  fixtures/                          # NEW — Test lifecycle management
    project-builder.ts               # ProjectBuilder.minimal(), .editable(), .dualScope()
    cli.ts                           # CLI.run() wrapper for non-interactive commands

  matchers/                          # NEW — Custom Vitest matchers
    project-matchers.ts              # toHaveConfig, toHaveCompiledAgents, etc.
    setup.ts                         # Registers all matchers (vitest setupFile)
```

**Files deleted during migration** (not kept for compatibility):

- `e2e/helpers/test-utils.ts` — replaced by `constants.ts`, `project-builder.ts`, `cli.ts`, step objects
- `e2e/helpers/plugin-assertions.ts` — replaced by `project-matchers.ts`

---

## Complete Constants Definition

```typescript
// --- e2e/pages/constants.ts ---
// Self-contained E2E constants. NO imports from src/cli/.

export const DIRS = {
  CLAUDE: ".claude",
  CLAUDE_SRC: ".claude-src",
  SKILLS: "skills",
  AGENTS: "agents",
  PLUGINS: "plugins",
  PLUGIN_MANIFEST: "plugin-manifest",
} as const;

export const FILES = {
  CONFIG_TS: "config.ts",
  CONFIG_TYPES_TS: "config-types.ts",
  SKILL_MD: "SKILL.md",
  METADATA_YAML: "metadata.yaml",
  SETTINGS_JSON: "settings.json",
  INSTALLED_PLUGINS_JSON: "installed_plugins.json",
  INTRO_MD: "intro.md",
  WORKFLOW_MD: "workflow.md",
} as const;

/** Text that identifies each wizard step. Centralized so UI changes update one place. */
export const STEP_TEXT = {
  // Step identification
  STACK: "Choose a stack",
  DOMAIN_WEB: "Web",
  DOMAIN_API: "API",
  DOMAIN_SHARED: "Shared",
  DOMAIN_MOBILE: "Mobile",
  BUILD: "Framework", // First category visible in build step
  SOURCES: "Customize skill sources",
  AGENTS: "Select agents",
  CONFIRM: "Ready to install",

  // Completion
  INIT_SUCCESS: "initialized successfully",
  EDIT_SUCCESS: "Plugin updated", // NOT "recompiled"
  COMPILE_SUCCESS: "Compiled",
  EJECT_SUCCESS: "Eject complete!",
  IMPORT_SUCCESS: "Import complete:",
  UNINSTALL_SUCCESS: "Uninstall complete!",

  // Status / progress
  LOADING_SKILLS: "Loading skills",
  RECOMPILING: "Recompiling agents",
  COMPILING_STACK: "Compiling stack",
  LOADED: "Loaded",
  LOADED_LOCAL: "Loaded from local:",

  // Prompts
  CONFIRM_UPDATE: "Proceed with update?",
  CONFIRM_UNINSTALL: "Are you sure you want to uninstall",
  SEARCH: "Search Skills",

  // UI elements
  FOOTER_SELECT: "select", // Footer text used for stable render detection
  START_FROM_SCRATCH: "Start from scratch",
  TOGGLE_SELECTION: "Toggle selection",
  NO_INSTALLATION: "No installation found",

  // Terminal size warnings
  TOO_NARROW: "too narrow",
  TOO_SHORT: "too short",
} as const;

export const TIMEOUTS = {
  WIZARD_LOAD: 15_000,
  INSTALL: 30_000,
  PLUGIN_INSTALL: 60_000,
  EXIT: 10_000,
  EXIT_WAIT: 30_000,
  SETUP: 60_000,
  LIFECYCLE: 180_000,
  INTERACTIVE: 120_000,
} as const;

// Internal to the framework — NOT exported to tests
export const INTERNAL_DELAYS = {
  STEP_TRANSITION: 500,
  KEYSTROKE: 150,
} as const;

export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  UNKNOWN_COMMAND: 127,
} as const;
```

---

## Key Design Corrections (from audit)

Issues found during surgical review of the first draft:

### Fix 1: No `acceptAll()` — the "a" key shortcut is being removed

The "a" key that skips sources and agents is being removed from the wizard. The only path through the wizard is domain-by-domain through Build, then Sources, then Agents, then Confirm. This simplifies the design: there is exactly one flow, not two.

```typescript
class BuildStep {
  /** Advance current domain without changes (Enter). */
  async advanceDomain(): Promise<void> { ... }

  /** Pass through all domains one by one, then advance to SourcesStep. */
  async passThroughAllDomains(): Promise<SourcesStep> { ... }
}
```

### Fix 2: ConfirmStep needs wizard-type awareness

Init confirm waits for `"initialized successfully"`. Edit confirm waits for `"Plugin updated"`. The confirm step must know which success text to wait for.

**Solution:** ConfirmStep takes a `wizardType` parameter:

```typescript
class ConfirmStep extends BaseStep {
  constructor(screen, session, private wizardType: "init" | "edit") { ... }

  async confirm(): Promise<WizardResult> {
    await this.pressEnter();
    const successText = this.wizardType === "init"
      ? STEP_TEXT.INIT_SUCCESS
      : STEP_TEXT.EDIT_SUCCESS;
    await this.screen.waitForText(successText, TIMEOUTS.INSTALL);
    return new WizardResult(this.session, this.projectDir);
  }
}
```

### Fix 3: DRY — merge `completeWithDefaults()` and `completeWithStack()`

These were 90% identical. Merged into one method with optional parameter. The flow always goes through every step — no shortcuts:

```typescript
class InitWizard {
  async completeWithDefaults(stackName?: string): Promise<WizardResult> {
    const domain = stackName
      ? await this.stack.selectStack(stackName)
      : await this.stack.selectFirstStack();
    const build = await domain.acceptDefaults();
    const sources = await build.passThroughAllDomains();
    const agents = await sources.acceptDefaults();
    const confirm = await agents.acceptDefaults();
    return confirm.confirm();
  }
}
```

### Fix 4: SourcesStep needs full interaction coverage

The first draft only had `acceptDefaults()`. Actual tests use `l` (all local), `p` (all plugin), Space (toggle individual), Settings overlay (`G` key), ESC (go back).

```typescript
class SourcesStep extends BaseStep {
  async acceptDefaults(): Promise<AgentsStep> { ... }
  async setAllLocal(): Promise<void> { await this.pressKey("l"); }
  async setAllPlugin(): Promise<void> { await this.pressKey("p"); }
  async toggleFocusedSource(): Promise<void> { await this.pressSpace(); }
  async openSettings(): Promise<void> { await this.pressKey("G"); }
  async goBack(): Promise<BuildStep> { ... }
}
```

### Fix 5: SearchModal page object (buggy — tests expected to fail)

The search modal has known bugs. The page object should be built so tests can be written, but all search tests should be marked `it.fails` or `it.skip` until the modal is stabilized.

```typescript
class SearchModal extends BaseStep {
  async type(query: string): Promise<void> { ... }
  async selectResult(label: string): Promise<void> { ... }
  async close(): Promise<void> { await this.pressEscape(); }
  getResults(): string { return this.screen.getScreen(); }
}
```

### Fix 6: ProjectHandle is minimal — no file mutation

`ProjectHandle` is `{ dir: string }`. No `readConfig()`, no `patchConfig()`, no `writeFile()`.

Tests that previously mutated config between wizard phases (e.g., `injectMarketplaceIntoConfig` in `source-switching-modes.e2e.test.ts`) must be rewritten to achieve that state through CLI interactions — run `edit`, change source in the sources step, confirm. If the state is unreachable through user interactions, the test belongs in a unit/integration test, not E2E.

```typescript
type ProjectHandle = {
  dir: string;
};
```

### Fix 7: ProjectBuilder needs dual-scope and custom-skill support

The first draft had `ProjectBuilder.dualScope()` but didn't address that dual-scope tests need TWO `ProjectHandle`s (project + global home). Also missing: custom agents, marketplace config, broken metadata edge cases.

```typescript
class ProjectBuilder {
  static async minimal(): Promise<ProjectHandle> { ... }
  static async editable(options?: EditableOptions): Promise<ProjectHandle> { ... }
  static async dualScope(): Promise<DualScopeHandle> { ... }
  static async withCustomSkill(): Promise<ProjectHandle> { ... }
  static async withCustomAgent(agentConfig: CustomAgentConfig): Promise<ProjectHandle> { ... }
}

type DualScopeHandle = {
  project: ProjectHandle;
  globalHome: ProjectHandle;
};
```

### Fix 8: WizardResult owns both project handle and session lifecycle

WizardResult needs to carry a `ProjectHandle` (not just `projectDir: string`) so matchers can work directly on the result. It also needs `destroy()` so tests can clean up sessions in multi-phase lifecycle tests.

```typescript
class WizardResult {
  readonly project: ProjectHandle;

  get exitCode(): Promise<number> { ... }
  get output(): string { ... }
  async destroy(): Promise<void> { ... }
}
```

### Fix 9: Missing `waitForRawText` in TerminalScreen

Some tests need raw PTY output (when xterm scrollback is exceeded). The first draft had this but it needs emphasis — this is NOT a fallback, it's required for lifecycle tests that generate large output.

### Fix 10: `renderSkillMd`, `renderAgentYaml`, `renderConfigTs` used in E2E helpers

These are imported from `src/cli/lib/__tests__/content-generators.ts` into `test-utils.ts` and `create-e2e-source.ts`. The "no production imports" rule applies to test files, not to framework/helper files. Framework helpers (`create-e2e-source.ts`, `project-builder.ts`) may import from `src/cli/` since they are infrastructure, not tests.

**Clarified rule:** Test files (`.e2e.test.ts`) import only from `e2e/`. Framework files (`e2e/pages/`, `e2e/fixtures/`, `e2e/helpers/`) may import from `src/cli/` for content generation and type definitions.

---

## Sequenced Refactoring Steps

Each step is atomic: introduce the new code, migrate all consumers, delete the old code. Tests may break within a step but are fixed before the step is complete. **No step leaves two systems serving the same purpose.**

The steps are ordered so that each step's changes are independent of subsequent steps. If step N breaks tests, the fix is within step N — never "we'll fix it in step N+1."

---

### Step 0: Foundation (no tests change, no tests break)

**What:** Create all new framework files. No test files are modified.

**Files created:**

- `e2e/pages/constants.ts`
- `e2e/pages/terminal-screen.ts`
- `e2e/pages/base-step.ts`
- `e2e/pages/steps/stack-step.ts`
- `e2e/pages/steps/domain-step.ts`
- `e2e/pages/steps/build-step.ts`
- `e2e/pages/steps/sources-step.ts`
- `e2e/pages/steps/agents-step.ts`
- `e2e/pages/steps/confirm-step.ts`
- `e2e/pages/steps/search-modal.ts`
- `e2e/pages/wizard-result.ts`
- `e2e/pages/wizards/init-wizard.ts`
- `e2e/pages/wizards/edit-wizard.ts`
- `e2e/fixtures/project-builder.ts`
- `e2e/fixtures/cli.ts`
- `e2e/matchers/project-matchers.ts`
- `e2e/matchers/setup.ts`

**Validation:** Write 3 new standalone smoke tests using the POM API to prove it works end-to-end before touching any existing test. These smoke tests exercise:

1. `InitWizard.completeWithDefaults()` + `toHaveConfig()` matcher
2. `EditWizard.passThrough()` + `toHaveCompiledAgents()` matcher
3. `ProjectBuilder.minimal()` + `CLI.run(["compile"])` + `toHaveCompiledAgents()`

If these smoke tests fail, fix the framework before proceeding.

**Tests broken:** 0
**Old code deleted:** Nothing

---

### Step 1: Replace `plugin-assertions.ts` with custom matchers

**What:** Migrate all `verifyConfig()`, `verifyAgentCompiled()`, `verifySkillCopiedLocally()`, `verifyNoLocalSkills()`, `verifyNoPlugins()`, `verifyPluginInSettings()`, `verifyPluginInRegistry()` calls to custom Vitest matchers.

**Why first:** These functions are used across 20+ files but are pure assertion helpers with no flow control. Safest starting point — if a matcher fails, the error message tells you exactly what's wrong.

**Migration pattern:**

```typescript
// Before
await verifyConfig(projectDir, { skillIds: ["web-framework-react"] });
await verifyAgentCompiled(projectDir, "web-developer");

// After
await expect({ dir: projectDir }).toHaveConfig({ skillIds: ["web-framework-react"] });
await expect({ dir: projectDir }).toHaveCompiledAgent("web-developer");
```

**Files modified:** Every E2E test file that imports from `plugin-assertions.ts` (~20 files)
**File deleted:** `e2e/helpers/plugin-assertions.ts`
**Tests broken then fixed:** ~20 files — mechanical find-and-replace of function calls to matcher syntax

---

### Step 2: Replace `ProjectBuilder` for non-interactive command tests

**What:** Replace `createMinimalProject()`, `createEditableProject()`, `createDualScopeProject()`, `createProjectWithCustomSkill()`, `createMinimalInstallation()` in `test-utils.ts` with `ProjectBuilder` methods.

**Migration pattern:**

```typescript
// Before
const { projectDir, agentsDir } = await createMinimalProject(tempDir);

// After
const project = await ProjectBuilder.minimal();
// project.dir replaces projectDir, agents dir derived from project.dir
```

**Files modified:** All command E2E tests (~24 files) + lifecycle tests that use these helpers
**Functions deleted from test-utils.ts:** `createMinimalProject`, `createEditableProject`, `createDualScopeProject`, `createProjectWithCustomSkill`, `createMinimalInstallation`, `writeProjectConfig`, `createLocalSkill`, `createPermissionsFile`
**Tests broken then fixed:** ~24 files — replace factory calls and update path references

---

### Step 3: Replace `CLI.run()` for non-interactive command tests

**What:** Replace raw `runCLI()` + manual path construction + manual assertions with `CLI.run()` + custom matchers.

**Migration pattern:**

```typescript
// Before
const result = await runCLI(["compile", "--verbose"], projectDir, { env: COMPILE_ENV });
expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
const mdFiles = (await listFiles(agentsDir)).filter((f) => f.endsWith(".md"));
expect(mdFiles.length).toBeGreaterThan(0);

// After
const result = await CLI.run(["compile", "--verbose"], project);
expect(result.exitCode).toBe(0);
await expect(project).toHaveCompiledAgents();
```

**Files modified:** All non-interactive command test files (~24 files)
**Functions deleted from test-utils.ts:** `runCLI` (moved to `cli.ts`), `listFiles`, `readTestFile`, `stripAnsi`, `getEjectedTemplatePath`
**Exports deleted from test-utils.ts:** `EXIT_CODES`, `OCLIF_EXIT_CODES`, `CLI_ROOT`, `BIN_RUN`, `COMPILE_ENV`, `FORKED_FROM_METADATA`
**Tests broken then fixed:** ~24 files — replace `runCLI` + manual assertions

---

### Step 4: Replace timing constants

**What:** Remove all timing constant imports from test files. Tests that still use `TerminalSession` directly (not yet migrated to page objects) get their delays from `e2e/pages/constants.ts` instead of `test-utils.ts`.

**Migration pattern:**

```typescript
// Before
import { WIZARD_LOAD_TIMEOUT_MS, STEP_TRANSITION_DELAY_MS, delay } from "../helpers/test-utils.js";

// After
import { TIMEOUTS, INTERNAL_DELAYS } from "../pages/constants.js";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms)); // inline until step objects replace it
```

**Files modified:** All interactive + lifecycle test files (~35 files)
**Exports deleted from test-utils.ts:** All timing constants (`WIZARD_LOAD_TIMEOUT_MS`, `STEP_TRANSITION_DELAY_MS`, `KEYSTROKE_DELAY_MS`, `EXIT_TIMEOUT_MS`, `INSTALL_TIMEOUT_MS`, `PLUGIN_INSTALL_TIMEOUT_MS`, `EXIT_WAIT_TIMEOUT_MS`, `SETUP_TIMEOUT_MS`, `LIFECYCLE_TEST_TIMEOUT_MS`, `INTERACTIVE_TEST_TIMEOUT_MS`, `delay`)
**Tests broken then fixed:** ~35 files — import path changes

---

### Step 5: Replace navigation helpers with page objects — Init Wizard tests

**What:** Migrate all `init-wizard-*.e2e.test.ts` files (8 files) to use `InitWizard` page object. This is the highest-value migration — these files have the most duplicated navigation.

**Migration per file:**

1. Replace `new TerminalSession(["init", ...])` with `InitWizard.launch()`
2. Replace `waitForText` + `delay` + `enter` sequences with step methods
3. Replace `navigateInitWizardToCompletion()` with `wizard.completeWithDefaults()`
4. Replace inline assertions with custom matchers
5. Remove `session` variable tracking (wizard handles lifecycle)

**Files migrated (in order):**

1. `init-wizard-stack.e2e.test.ts` — canonical init flow, simplest
2. `init-wizard-scratch.e2e.test.ts` — uses `selectScratch()`
3. `init-wizard-interactions.e2e.test.ts` — scope toggle, domain deselection
4. `init-wizard-plugin.e2e.test.ts` — plugin flows, mixed mode
5. `init-wizard-navigation.e2e.test.ts` — back navigation
6. `init-wizard-sources.e2e.test.ts` — source step interactions
7. `init-wizard-ui.e2e.test.ts` — terminal size, UI details
8. `init-wizard-flags.e2e.test.ts` — flag handling
9. `init-wizard-existing.e2e.test.ts` — existing installation detection
10. `init-wizard-default-source.e2e.test.ts` — default source path (if exists)

**Functions deleted from test-utils.ts:** `navigateInitWizardToCompletion`
**Tests broken then fixed:** 8-10 files — full rewrite of test bodies

---

### Step 6: Replace navigation helpers with page objects — Edit Wizard tests

**What:** Migrate all `edit-wizard-*.e2e.test.ts` files (7 files) to use `EditWizard` page object.

**Files migrated:**

1. `edit-wizard-completion.e2e.test.ts`
2. `edit-wizard-navigation.e2e.test.ts`
3. `edit-wizard-launch.e2e.test.ts`
4. `edit-wizard-local.e2e.test.ts`
5. `edit-wizard-plugin-migration.e2e.test.ts`
6. `edit-wizard-plugin-operations.e2e.test.ts`
7. `edit-skill-accumulation.e2e.test.ts`
8. `edit-agent-scope-routing.e2e.test.ts`

**Functions deleted from test-utils.ts:** `navigateEditWizardToCompletion`, `passThroughAllBuildDomains`
**Tests broken then fixed:** 7-8 files

---

### Step 7: Migrate interactive misc tests

**What:** Migrate remaining interactive tests that aren't init or edit wizard.

**Files migrated:**

1. `build-stack.e2e.test.ts`
2. `search-interactive.e2e.test.ts` — uses `SearchModal` page object (tests marked `it.fails`)
3. `search-static.e2e.test.ts`
4. `real-marketplace.e2e.test.ts`
5. `smoke.e2e.test.ts`
6. `uninstall.e2e.test.ts` (interactive)
7. `update.e2e.test.ts`

**Tests broken then fixed:** 7 files

---

### Step 8: Migrate lifecycle tests

**What:** Migrate all lifecycle test files. These are the most complex — multi-phase, shared state. Any tests that previously mutated config files directly must be rewritten to achieve state through wizard interactions or moved to unit/integration tests.

**Files migrated (ordered by complexity):**

1. `local-lifecycle.e2e.test.ts` — simplest lifecycle
2. `plugin-lifecycle.e2e.test.ts`
3. `cross-scope-lifecycle.e2e.test.ts`
4. `source-switching-modes.e2e.test.ts` — rewrite config mutations as wizard interactions
5. `source-switching-per-skill.e2e.test.ts`
6. `re-edit-cycles.e2e.test.ts` — multiple sequential wizard sessions
7. `plugin-scope-lifecycle.e2e.test.ts`
8. `unified-config-view.e2e.test.ts`
9. `dual-scope-edit-display.e2e.test.ts`
10. `dual-scope-edit-integrity.e2e.test.ts` — most complex, deeply nested
11. `dual-scope-edit-scope-changes.e2e.test.ts`

**Tests broken then fixed:** 11 files

---

### Step 9: Migrate remaining command + integration tests

**What:** Any command or integration tests not yet migrated in steps 2-3.

**Files:**

- `e2e/integration/custom-agents.e2e.test.ts`
- `e2e/integration/eject-compile.e2e.test.ts`
- `e2e/integration/eject-integration.e2e.test.ts`
- Any newly added test files (e.g., `compile-scope-filtering.e2e.test.ts`, `config-scope-integrity.e2e.test.ts`)

**Tests broken then fixed:** 3-5 files

---

### Step 10: Delete `test-utils.ts` and remove all `src/cli/` imports from tests

**What:** The final cleanup. By this point, `test-utils.ts` should have no consumers. Delete it. Grep all `.e2e.test.ts` files for any remaining `import.*from.*src/cli` — fix any stragglers.

**Files deleted:**

- `e2e/helpers/test-utils.ts`
- `e2e/helpers/plugin-assertions.ts` (already deleted in step 1, confirm gone)

**Verification:**

```bash
# Must return 0 results:
grep -r 'from.*src/cli' e2e/**/*.e2e.test.ts
grep -r 'from.*test-utils' e2e/**/*.e2e.test.ts
grep -r 'from.*plugin-assertions' e2e/**/*.e2e.test.ts

# Must return 0 results in test files (framework files are OK):
grep -r 'WIZARD_LOAD_TIMEOUT_MS\|STEP_TRANSITION_DELAY_MS\|KEYSTROKE_DELAY_MS' e2e/**/*.e2e.test.ts
grep -r 'session\.waitForText\|session\.enter\|session\.arrowDown' e2e/**/*.e2e.test.ts
grep -r 'await delay(' e2e/**/*.e2e.test.ts
```

**Tests broken then fixed:** 0 (all migration done in prior steps)

---

## Step Dependency Graph

```
Step 0 (foundation)
  |
  +---> Step 1 (matchers) -------> Step 2 (ProjectBuilder) --> Step 3 (CLI.run)
  |                                                               |
  +---> Step 4 (timing constants) <-------------------------------+
           |
           +---> Step 5 (init wizard POM)
           |        |
           |        +---> Step 6 (edit wizard POM)
           |                 |
           |                 +---> Step 7 (misc interactive POM)
           |                          |
           |                          +---> Step 8 (lifecycle POM)
           |                                    |
           +------------------------------------+---> Step 9 (remaining)
                                                         |
                                                         +---> Step 10 (delete old)
```

Steps 1-3 can run in parallel with each other (independent concerns). Steps 5-8 must be sequential (each builds on the patterns proven in the prior step). Step 10 is always last.

---

## Success Criteria

1. **No `writeFile`, `readFile`, `mkdir`, or `path.join` in test bodies.** Setup fixtures and matchers handle all file I/O. Test code only launches, interacts, and asserts.
2. **No `session.waitForText()` in test files.** All terminal interaction goes through page objects.
3. **No `delay()` in test files.** All timing is internal to the framework.
4. **No `src/cli/` imports in E2E test files.** Framework files may import from `src/cli/`; test files may not.
5. **No index-based navigation.** All "go to item X" is by name.
6. **No duplicated navigation flows.** Each wizard flow exists once (in wizard entry points or composite methods).
7. **Each test reads like a user story.** A non-engineer can understand what the test does.
8. **UI text changes require editing 1 file** (`constants.ts`), not 30+.
9. **`test-utils.ts` and `plugin-assertions.ts` are deleted.** No legacy helpers remain.
10. **Zero "compatibility" code.** No deprecated functions, no "use the old way or the new way" choices.
11. **No direct config mutation between test phases.** State changes happen through wizard interactions, never by editing files.

---

## Risk Mitigation

| Risk                                           | Mitigation                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework has bugs discovered during migration | Step 0 includes 3 smoke tests that prove the API end-to-end. Fix framework bugs before migrating any existing test.                                                                              |
| A step breaks too many tests at once           | Steps 5-8 are ordered by complexity (simplest first). If `init-wizard-stack` migration works, the pattern is proven for the other 7 init files.                                                  |
| Timing changes cause flaky tests               | All timing is now in `constants.ts` and `INTERNAL_DELAYS`. If flaky, adjust one constant — not 451 scattered references.                                                                         |
| Page objects don't cover an edge case          | `BaseStep` exposes `protected` methods. Step subclasses can access the underlying screen/session for escape-hatch scenarios. Tests never touch session directly.                                 |
| Migration takes too long                       | Steps are independent units of work. Each step is a single commit. Progress is always forward — no step depends on future steps.                                                                 |
| `navigateToItem(label)` is unreliable          | The method has a max-attempts limit and throws with a clear error including the current screen content. Falls back to index-based navigation only if explicitly requested via a separate method. |
