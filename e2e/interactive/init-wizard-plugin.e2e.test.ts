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
    await wizardSession.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Step 3: Build step — "a" accepts all defaults
    await wizardSession.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);
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

      // Verify plugin-specific output messages (init.tsx:436, 442, 451)
      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Installing skill plugins...");
      expect(fullOutput).toContain("skill plugins");

      // Verify install mode is reported as Plugin
      expect(fullOutput).toContain("Plugin (native install)");
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

      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      await session.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);
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

  describe("mixed install mode", () => {
    /**
     * P-INIT-6: Mixed install mode — when some skills have source: "local"
     * and others have a plugin source, deriveInstallMode() returns "mixed".
     *
     * The "mixed" mode falls through to installLocalMode() in init.tsx:397,
     * so ALL skills get installed locally regardless of their individual
     * source setting. No claudePluginInstall() is called.
     *
     * Navigation:
     *   Stack -> Domains -> Build (per-domain Enter) -> Sources (customize) ->
     *   set one skill to local via spacebar -> Agents -> Confirm -> Complete
     */
    it("should install all skills locally when sources are mixed", async () => {
      projectDir = await createTempDir();
      await createPermissionsFile(projectDir);

      session = spawnInitWizard(projectDir, fixture.sourceDir);

      // Step 1: Stack selection — Enter accepts first stack
      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Step 2: Domain selection — Enter accepts pre-selected domains
      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Step 3: Build step — advance through each domain with Enter.
      // The E2E stack pre-selects skills for Web, API, and Shared domains.
      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      await session.waitForText("Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      await session.waitForText("Customize your Shared stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Step 4: Sources customize view — already in customize view
      await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 4b: Sources customize view — set ONE skill to local.
      // SourceGrid focus enters at row 0, col 0 (the "local" option of the
      // first skill). Pressing space selects "local" for that skill, leaving
      // all other skills at their default marketplace source.
      await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      // Enter to continue past Sources
      session.enter();

      // Step 5: Agents step — Enter to accept defaults
      await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Step 6: Confirmation — Enter to confirm
      await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Wait for installation to complete
      await session.waitForText("initialized successfully", PLUGIN_INSTALL_TIMEOUT_MS);

      const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const fullOutput = session.getFullOutput();

      // Install mode should be "Local" because mixed falls through to installLocalMode
      // (init.tsx:389 — only "plugin" shows "Plugin (native install)")
      expect(fullOutput).toContain("Local (copy to .claude/skills/)");
      expect(fullOutput).not.toContain("Plugin (native install)");

      // Should NOT mention plugin installation
      expect(fullOutput).not.toContain("Installing skill plugins");

      // Should mention local copy
      expect(fullOutput).toContain("Skills copied to:");

      // All skills should be copied locally — even the ones with plugin source
      expect(await verifySkillCopiedLocally(projectDir, "web-framework-react")).toBe(true);
      expect(await verifySkillCopiedLocally(projectDir, "web-testing-vitest")).toBe(true);

      // Agents should still be compiled
      expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);
    });
  });
});
