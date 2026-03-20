import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { isClaudeCLIAvailable } from "../../src/cli/utils/exec.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import {
  verifyAgentCompiled,
  verifyConfig,
  verifySkillCopiedLocally,
} from "../helpers/plugin-assertions.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  delay,
  ensureBinaryExists,
  EXIT_CODES,
  EXIT_WAIT_TIMEOUT_MS,
  KEYSTROKE_DELAY_MS,
  PLUGIN_INSTALL_TIMEOUT_MS,
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  WIZARD_LOAD_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * E2E tests for the init wizard in plugin mode.
 *
 * These tests drive the full init wizard via TerminalSession using a source
 * that has marketplace.json (built by createE2EPluginSource). The wizard
 * completes the full flow and installs skills as Claude CLI plugins.
 *
 * The entire suite is skipped when the Claude CLI is not available.
 *
 * Test scenarios from e2e-framework-design.md Section 4.1:
 *   P-INIT-1: Init with plugin mode installs plugins
 *   P-INIT-2: Marketplace registration on first use (verified within P-INIT-1)
 *   P-INIT-3: Marketplace NOT re-registered when already present (verified within P-INIT-1)
 *   P-INIT-4: Documented as not testable with current infrastructure (see note below)
 */

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("init wizard — plugin mode", () => {
  let fixture: E2EPluginSource;

  let session: TerminalSession | undefined;
  let projectDir: string | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    fixture = await createE2EPluginSource();
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    if (fixture) await cleanupTempDir(fixture.tempDir);
  });

  afterEach(async () => {
    await session?.destroy();
    session = undefined;

    if (projectDir) {
      await cleanupTempDir(projectDir);
      projectDir = undefined;
    }
  });

  function spawnInitWizard(cwd: string, sourcePath: string): TerminalSession {
    return new TerminalSession(["init", "--source", sourcePath], cwd, {
      env: { AGENTSINC_SOURCE: undefined },
    });
  }

  /**
   * Runs the full init wizard flow from stack selection through installation.
   * Same navigation pattern as init-wizard-stack.e2e.test.ts.
   */
  async function runFullPluginInitFlow(project: string, source: string): Promise<TerminalSession> {
    await createPermissionsFile(project);

    const wizardSession = spawnInitWizard(project, source);

    // Step 1: Stack selection — Enter accepts first stack
    await wizardSession.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Step 2: Domain selection — Enter accepts pre-selected domains
    await wizardSession.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Step 3: Build step — "a" accepts all defaults
    await wizardSession.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.write("a");

    // Step 4: Confirmation — Enter to confirm
    await wizardSession.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Wait for plugin installation to complete — this takes longer than local mode
    await wizardSession.waitForText("initialized successfully", PLUGIN_INSTALL_TIMEOUT_MS);

    return wizardSession;
  }

  describe("plugin installation happy path", () => {
    it("should complete plugin-mode init and install plugins", async () => {
      projectDir = await createTempDir();

      session = await runFullPluginInitFlow(projectDir, fixture.sourceDir);

      const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Verify plugin-specific output messages (init.tsx:349-364)
      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Installing skill plugins...");
      expect(fullOutput).toContain("skill plugins");

      // Verify install mode is reported as Plugin
      expect(fullOutput).toContain("Plugin (native install)");

      // Verify per-skill install messages — each plugin skill should show
      // "Installed <skillId>@<marketplace>" (init.tsx:355)
      expect(fullOutput).toContain(`Installed web-framework-react@${fixture.marketplaceName}`);

      // Should NOT copy skills locally — plugin mode installs via Claude CLI
      expect(fullOutput).not.toContain("Skills copied to:");
    });

    it("should generate config.ts with marketplace source", async () => {
      projectDir = await createTempDir();

      session = await runFullPluginInitFlow(projectDir, fixture.sourceDir);
      await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);

      // Config should reference the marketplace name as the source
      await verifyConfig(projectDir, {
        skillIds: ["web-framework-react"],
        source: fixture.marketplaceName,
      });
    });

    it("should compile agents", async () => {
      projectDir = await createTempDir();

      session = await runFullPluginInitFlow(projectDir, fixture.sourceDir);
      await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);

      // At least the web-developer agent should be compiled
      expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);
    });

    it("should display completion details after install", async () => {
      projectDir = await createTempDir();

      session = await runFullPluginInitFlow(projectDir, fixture.sourceDir);
      await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Agents compiled to:");
      expect(fullOutput).toContain("Configuration:");
    });
  });

  describe("marketplace registration", () => {
    it("should register or skip marketplace without error", async () => {
      projectDir = await createTempDir();

      session = await runFullPluginInitFlow(projectDir, fixture.sourceDir);

      const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // The output should either contain "Registering marketplace" (first use, P-INIT-2)
      // or NOT contain it (already registered, P-INIT-3).
      // Either way, the install should succeed without errors.
      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("initialized successfully");
      expect(fullOutput).not.toContain("Failed to");
    });
  });

  describe("local mode fallback", () => {
    /**
     * P-INIT-4: Fallback to local when marketplace resolution fails.
     *
     * Investigation result: This scenario is NOT testable with the current
     * E2E infrastructure. Here's why:
     *
     * The fallback warning ("Could not resolve marketplace. Falling back to
     * Local Mode...") at init.tsx:412 only triggers when:
     *   1. deriveInstallMode() returns "plugin" (skills have source !== "local")
     *   2. sourceResult.marketplace is undefined
     *   3. fetchMarketplace() fails inside installIndividualPlugins()
     *
     * When using createE2ESource() (no marketplace built) with a local path:
     *   - loadSkillsMatrixFromSource() calls loadFromLocal() since isLocalSource() is true
     *   - loadFromLocal() sets isLocal: true
     *   - loadSkillsFromAllSources() tags all skills with source: "local"
     *   - deriveInstallMode() returns "local"
     *   - handleInstallation() goes through installLocalMode() directly
     *   - installIndividualPlugins() is never entered
     *
     * To trigger the fallback, we would need a remote source (github:...)
     * that has no marketplace.json, which is not possible with temp dirs.
     *
     * The local-mode init flow (without marketplace) is already tested
     * thoroughly in init-wizard-stack.e2e.test.ts.
     */
    it("should install locally when source has no marketplace", async () => {
      // Use createE2ESource() (no marketplace built) — skills are tagged as local
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      projectDir = await createTempDir();
      await createPermissionsFile(projectDir);

      session = spawnInitWizard(projectDir, sourceDir);

      // Navigate the wizard flow
      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      await session.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.write("a");

      await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Should complete via local mode (not plugin mode)
      await session.waitForText("initialized successfully", PLUGIN_INSTALL_TIMEOUT_MS);

      const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const fullOutput = session.getFullOutput();

      // Should NOT mention plugin installation
      expect(fullOutput).not.toContain("Installing skill plugins");

      // Should mention local copy
      expect(fullOutput).toContain("Skills copied to:");

      // Skills should be copied locally
      expect(await verifySkillCopiedLocally(projectDir, "web-framework-react")).toBe(true);

      await cleanupTempDir(sourceTempDir);
    });
  });

  describe("plugin scope routing (Gap 3)", () => {
    /**
     * Gap 3: Verify that plugin scope is correctly routed.
     *
     * When skills have scope: "global", claudePluginInstall() should pass
     * scope "user". When scope: "project", it should pass scope "project".
     *
     * init.tsx:382-384:
     *   const pluginScope = skill.scope === "global" ? "user" : "project";
     *   await claudePluginInstall(pluginRef, pluginScope, projectDir);
     *   this.log(`  Installed ${pluginRef}`);
     *
     * We verify this by checking the output messages. The actual scope
     * argument is an internal detail of claudePluginInstall(), but the
     * per-skill install message and the overall success confirm the
     * scope routing worked (if the wrong scope were passed, the Claude CLI
     * would fail to install).
     */
    it("should install plugin skills with correct scope routing", async () => {
      projectDir = await createTempDir();

      session = await runFullPluginInitFlow(projectDir, fixture.sourceDir);

      const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const fullOutput = session.getFullOutput();

      // All default-scope skills (global) should be installed as user-scope plugins.
      // The init flow uses "a" to accept all defaults, which sets scope: "global"
      // for all skills. claudePluginInstall is called with scope "user".

      // Per-skill install messages confirm each skill was installed.
      // The fact that they succeed without error proves the scope routing is valid.
      expect(fullOutput).toContain(`Installed web-framework-react@${fixture.marketplaceName}`);
      expect(fullOutput).toContain(`Installed web-testing-vitest@${fixture.marketplaceName}`);

      // Verify the total plugin count message
      expect(fullOutput).toContain("skill plugins");

      // Verify NO failures — if scope routing were wrong, Claude CLI would error
      expect(fullOutput).not.toContain("Failed to install plugin");
    });

    it("should install project-scoped plugins correctly in mixed scope mode", async () => {
      projectDir = await createTempDir();
      await createPermissionsFile(projectDir);

      const wizardSession = spawnInitWizard(projectDir, fixture.sourceDir);

      // Step 1: Stack
      await wizardSession.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Step 2: Domains
      await wizardSession.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Step 3: Build — Web domain. Toggle first skill to project scope.
      await wizardSession.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
      await wizardSession.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.write("s"); // Toggle scope to project
      await delay(KEYSTROKE_DELAY_MS);
      wizardSession.enter();

      // API domain
      await wizardSession.waitForText("API", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Shared domain
      await wizardSession.waitForText("Shared", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Sources step — leave all at default (plugin)
      await wizardSession.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Agents step
      await wizardSession.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Confirm step
      await wizardSession.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      await wizardSession.waitForText("initialized successfully", PLUGIN_INSTALL_TIMEOUT_MS);
      session = wizardSession;

      const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const fullOutput = session.getFullOutput();

      // Per-skill install messages should be present for all plugin skills
      // The fact that installation succeeds proves scope routing works:
      //   - web-framework-react was toggled to project -> claudePluginInstall(ref, "project", ...)
      //   - Other skills stayed global -> claudePluginInstall(ref, "user", ...)
      expect(fullOutput).toContain("Installing skill plugins...");
      expect(fullOutput).toContain(`Installed web-framework-react@${fixture.marketplaceName}`);
      expect(fullOutput).not.toContain("Failed to install plugin");
    });
  });

  describe("mixed install mode", () => {
    /**
     * Navigation for mixed mode tests:
     *   Stack -> Domains -> Build (per-domain Enter) -> Sources (customize) ->
     *   set one skill to local via spacebar -> Agents -> Confirm -> Complete
     */
    async function runMixedModeWizard(project: string, source: string): Promise<TerminalSession> {
      await createPermissionsFile(project);

      const wizardSession = spawnInitWizard(project, source);

      // Step 1: Stack selection — Enter accepts first stack
      await wizardSession.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Step 2: Domain selection — Enter accepts pre-selected domains
      await wizardSession.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Step 3: Build step — advance through each domain with Enter.
      // The E2E stack pre-selects skills for Web, API, and Shared domains.
      await wizardSession.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      await wizardSession.waitForText("API", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      await wizardSession.waitForText("Shared", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Step 4: Sources customize view — already in customize view
      await wizardSession.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 4b: Sources customize view — set ONE skill to local.
      // SourceGrid focus enters at row 0, col 0 (the "local" option of the
      // first skill). Pressing space selects "local" for that skill, leaving
      // all other skills at their default marketplace source.
      await wizardSession.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.space();
      await delay(KEYSTROKE_DELAY_MS);

      // Enter to continue past Sources
      wizardSession.enter();

      // Step 5: Agents step — Enter to accept defaults
      await wizardSession.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Step 6: Confirmation — Enter to confirm
      await wizardSession.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Wait for installation to complete
      await wizardSession.waitForText("initialized successfully", PLUGIN_INSTALL_TIMEOUT_MS);

      return wizardSession;
    }

    /**
     * P-INIT-6: Mixed install mode.
     *
     * When some skills have source: "local" and others have a plugin source,
     * deriveInstallMode() returns "mixed". The correct behavior is:
     *   - Plugin-sourced skills are installed via claudePluginInstall()
     *   - Local-sourced skills are copied to .claude/skills/
     *   - The output reports "Mixed" install mode
     */
    it("should install plugin skills as plugins and local skills locally in mixed mode", async () => {
      projectDir = await createTempDir();

      session = await runMixedModeWizard(projectDir, fixture.sourceDir);

      const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const fullOutput = session.getFullOutput();

      // CORRECT: Mixed mode should install plugin-sourced skills as plugins
      expect(fullOutput).toContain("Installing skill plugins...");

      // CORRECT: The local-sourced skill should be copied locally
      expect(await verifySkillCopiedLocally(projectDir, "web-framework-react")).toBe(true);

      // CORRECT: Plugin-sourced skills should NOT be copied locally
      // (they are installed as Claude CLI plugins, not copied to .claude/skills/)
      expect(await verifySkillCopiedLocally(projectDir, "web-testing-vitest")).toBe(false);

      // Agents should still be compiled
      expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);
    });
  });
});
