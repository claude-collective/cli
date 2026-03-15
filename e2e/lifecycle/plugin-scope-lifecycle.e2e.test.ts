import { mkdir } from "fs/promises";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import { isClaudeCLIAvailable } from "../../src/cli/utils/exec.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  delay,
  ensureBinaryExists,
  EXIT_CODES,
  EXIT_WAIT_TIMEOUT_MS,
  fileExists,
  KEYSTROKE_DELAY_MS,
  PLUGIN_INSTALL_TIMEOUT_MS,
  readTestFile,
  runCLI,
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  WIZARD_LOAD_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * Plugin scope lifecycle E2E test: Init with mixed scopes -> Verify agent content -> Edit -> Verify preservation.
 *
 * This is the most thorough agent compilation test in the suite. It verifies:
 *
 * Phase 1: Init wizard with scope toggling
 *   - Run `cc init --source <sourceDir>` from a project dir inside fake HOME
 *   - Navigate per-domain build steps (Web, API, Shared)
 *   - On Web build step, press "s" to toggle web-framework-react to global scope
 *   - On Agents step, press "s" to toggle web-developer to global scope
 *   - Complete installation
 *
 * Phase 2: Verify compiled agent content and scope routing
 *   - Global agent (web-developer) at <HOME>/.claude/agents/
 *   - Project agent (api-developer) at <projectDir>/.claude/agents/
 *   - Frontmatter skill lists are correct for each agent
 *   - Cross-contamination checks (no agent in wrong scope directory)
 *
 * Phase 3: Compile and verify scope routing preserved
 *   - Run `cc compile --source <sourceDir>` non-interactively
 *   - Re-verify agent scope routing and content after recompilation
 *
 * Architecture:
 *   tempDir/
 *     fake-home/                          <- HOME env var points here
 *       .claude/agents/web-developer.md   <- global agent (after scope toggle)
 *       .claude/settings.json             <- permissions file
 *       project/                          <- project directory (CWD for init/edit)
 *         .claude-src/config.ts           <- project config
 *         .claude/agents/api-developer.md <- project agent
 *
 * Requires Claude CLI (plugin mode). Skipped when not available.
 */

const claudeAvailable = await isClaudeCLIAvailable();

const EXTENDED_LIFECYCLE_TIMEOUT_MS = 300_000;

describe.skipIf(!claudeAvailable)(
  "plugin scope lifecycle: init with mixed scopes -> verify agent content -> edit -> verify preservation",
  () => {
    let fixture: E2EPluginSource;
    let tempDir: string;
    let fakeHome: string;
    let projectDir: string;
    let session: TerminalSession | undefined;

    beforeAll(async () => {
      await ensureBinaryExists();
      fixture = await createE2EPluginSource();

      tempDir = await createTempDir();
      fakeHome = path.join(tempDir, "fake-home");
      projectDir = path.join(fakeHome, "project");

      await mkdir(fakeHome, { recursive: true });
      await mkdir(projectDir, { recursive: true });
    }, SETUP_TIMEOUT_MS * 2);

    afterAll(async () => {
      await session?.destroy();
      if (tempDir) await cleanupTempDir(tempDir);
      if (fixture) await cleanupTempDir(fixture.tempDir);
    });

    it.fails(
      "should init with mixed scopes, verify agent content, and verify preservation (expected fail — scope routing bugs)",
      { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
      async () => {
        // ================================================================
        // Phase 1: Init wizard with scope toggling
        // ================================================================

        // Create permissions files to prevent permission prompt hang
        await createPermissionsFile(fakeHome);
        await createPermissionsFile(projectDir);

        session = new TerminalSession(["init", "--source", fixture.sourceDir], projectDir, {
          env: {
            HOME: fakeHome,
            AGENTSINC_SOURCE: undefined,
          },
          rows: 60,
          cols: 120,
        });

        // Step 1: Stack selection — accept first stack (E2E Test Stack)
        await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 2: Domain selection — accept pre-selected domains
        await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 3a: Build step — Web domain
        // web-framework-react is the first skill (first category in Web domain).
        // Focus starts on the first skill. Press "s" to toggle it to global scope.
        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Toggle web-framework-react to global scope
        session.write("s");
        await delay(KEYSTROKE_DELAY_MS);

        // Advance past Web domain
        session.enter();

        // Step 3b: Build step — API domain
        await session.waitForText("Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 3c: Build step — Shared domain
        await session.waitForText("Customize your Shared stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 4: Sources — accept recommended (first option)
        await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 5: Agents step
        // Focus starts on the first agent. In the E2E stack, agents are:
        // web-developer (first), api-developer (second).
        // Press "s" to toggle web-developer to global scope.
        await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Toggle web-developer to global scope
        session.write("s");
        await delay(KEYSTROKE_DELAY_MS);

        // Continue to Confirm step
        session.enter();

        // Step 6: Confirm — accept installation
        await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Wait for installation to complete
        await session.waitForText("initialized successfully", PLUGIN_INSTALL_TIMEOUT_MS);
        const initExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);

        // Capture output for debugging
        const initOutput = session.getFullOutput();
        const initRaw = session.getRawOutput();

        // P1-A: Init exited successfully
        expect(initExitCode).toBe(EXIT_CODES.SUCCESS);

        // P1-B: No errors in output
        expect(initRaw).not.toContain("ENOENT");
        expect(initOutput).not.toContain("Failed to");

        // Clean up Phase 1 session
        await session.destroy();
        session = undefined;

        // ================================================================
        // Phase 2: Verify initial state — config, agent content, scope routing
        // ================================================================

        // --- Config file assertions ---

        // P2-A: Project config exists
        const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        expect(await fileExists(projectConfigPath), "Project config must exist").toBe(true);

        // P2-B: Global config exists (scope split writes global config to <HOME>/.claude-src/)
        const globalConfigPath = path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        expect(await fileExists(globalConfigPath), "Global config must exist (scope split)").toBe(
          true,
        );

        // P2-C: Read both configs
        const globalConfigContent = await readTestFile(globalConfigPath);
        const projectConfigContent = await readTestFile(projectConfigPath);

        // P2-D: Config scope split — strict assertions
        // Global config should contain web-developer (toggled to global scope)
        expect(globalConfigContent).toContain("web-developer");
        // Project config should contain api-developer (default project scope)
        expect(projectConfigContent).toContain("api-developer");

        // --- Scope routing — strict assertions ---

        const globalWebDevPath = path.join(fakeHome, CLAUDE_DIR, "agents", "web-developer.md");
        const projectWebDevPath = path.join(projectDir, CLAUDE_DIR, "agents", "web-developer.md");
        const globalApiDevPath = path.join(fakeHome, CLAUDE_DIR, "agents", "api-developer.md");
        const projectApiDevPath = path.join(projectDir, CLAUDE_DIR, "agents", "api-developer.md");

        // web-developer was toggled to global scope with "s" hotkey.
        // It MUST be in the global agents directory, NOT in the project directory.
        expect(
          await fileExists(globalWebDevPath),
          "web-developer.md must exist in global agents dir (scope toggled to global)",
        ).toBe(true);
        expect(
          await fileExists(projectWebDevPath),
          "web-developer.md must NOT exist in project agents dir (it's global-scoped)",
        ).toBe(false);

        // api-developer was NOT toggled — it should stay at project scope (default).
        expect(
          await fileExists(projectApiDevPath),
          "api-developer.md must exist in project agents dir (default scope)",
        ).toBe(true);
        expect(
          await fileExists(globalApiDevPath),
          "api-developer.md must NOT exist in global agents dir (it's project-scoped)",
        ).toBe(false);

        // --- Agent content assertions (read from strict paths) ---

        // P2-E: Read and verify web-developer.md content from global path
        const webDevContent = await readTestFile(globalWebDevPath);

        // Has YAML frontmatter
        expect(webDevContent).toMatch(/^---/);

        // Frontmatter contains name: web-developer
        expect(webDevContent).toMatch(/name:\s*web-developer/);

        // web-framework-react is preloaded for web-developer
        expect(webDevContent).toContain("web-framework-react");

        // Dynamic skill references in skill activation protocol
        expect(webDevContent).toContain("web-testing-vitest");
        expect(webDevContent).toContain("web-state-zustand");

        // web-developer should NOT contain API skills
        expect(webDevContent).not.toContain("api-framework-hono");

        // P2-F: Read and verify api-developer.md content from project path
        const apiDevContent = await readTestFile(projectApiDevPath);

        // Has YAML frontmatter
        expect(apiDevContent).toMatch(/^---/);

        // Frontmatter contains name: api-developer
        expect(apiDevContent).toMatch(/name:\s*api-developer/);

        // api-framework-hono should be present (preloaded or dynamic)
        expect(apiDevContent).toContain("api-framework-hono");

        // Methodology skills should be present
        expect(apiDevContent).toContain("meta-methodology");

        // api-developer should NOT contain web-framework-react (web skills don't belong in API agent)
        expect(apiDevContent).not.toContain("web-framework-react");

        // ================================================================
        // Phase 3: Run compile to recompile agents and verify scope preserved
        // ================================================================

        const compileResult = await runCLI(["compile", "--source", fixture.sourceDir], projectDir, {
          env: { HOME: fakeHome, AGENTSINC_SOURCE: undefined },
        });
        expect(compileResult.exitCode, `compile failed: ${compileResult.combined}`).toBe(
          EXIT_CODES.SUCCESS,
        );

        // Re-verify: agents still in correct scope directories after recompilation
        expect(
          await fileExists(globalWebDevPath),
          "After compile: web-developer.md must still exist in global agents dir",
        ).toBe(true);
        expect(
          await fileExists(projectWebDevPath),
          "After compile: web-developer.md must still NOT exist in project agents dir",
        ).toBe(false);
        expect(
          await fileExists(projectApiDevPath),
          "After compile: api-developer.md must still exist in project agents dir",
        ).toBe(true);
        expect(
          await fileExists(globalApiDevPath),
          "After compile: api-developer.md must still NOT exist in global agents dir",
        ).toBe(false);

        // Re-verify content after recompilation
        const webDevRecompiled = await readTestFile(globalWebDevPath);
        expect(webDevRecompiled).toContain("web-framework-react");
        expect(webDevRecompiled).not.toContain("api-framework-hono");

        const apiDevRecompiled = await readTestFile(projectApiDevPath);
        expect(apiDevRecompiled).toContain("api-framework-hono");
        expect(apiDevRecompiled).not.toContain("web-framework-react");
      },
    );
  },
);
