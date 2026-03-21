import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { cleanupTempDir, ensureBinaryExists, isClaudeCLIAvailable } from "../helpers/test-utils.js";
import { ProjectBuilder } from "../fixtures/project-builder.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { TIMEOUTS, EXIT_CODES } from "../pages/constants.js";
import "../matchers/setup.js";

/**
 * E2E tests for the edit wizard in plugin mode — skill install/uninstall
 * and cancellation.
 *
 * Test scenarios:
 *   P-EDIT-1: Add skill via edit triggers plugin install
 *   P-EDIT-2: Remove skill via edit triggers plugin uninstall
 *   + No-change completion
 *   + Cancellation safety
 *
 * The entire suite is skipped when the Claude CLI is not available.
 */

/** Combined timeout for tests that include plugin operations + exit wait */
const PLUGIN_TEST_TIMEOUT_MS = TIMEOUTS.PLUGIN_TEST;

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("edit wizard — plugin mode operations", () => {
  let fixture: E2EPluginSource;
  let wizard: EditWizard | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    fixture = await createE2EPluginSource();
  }, TIMEOUTS.SETUP);

  afterAll(async () => {
    if (fixture) await cleanupTempDir(fixture.tempDir);
  });

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;
  });

  /**
   * Navigate from a single-domain build step through to completion.
   */
  async function completeEditFromBuild(w: EditWizard) {
    const sources = await w.build.advanceToSources();
    const agents = await sources.acceptDefaults();
    const confirm = await agents.acceptDefaults("edit");
    return confirm.confirm();
  }

  describe("remove skill triggers plugin uninstall", () => {
    it("should uninstall removed plugin skills", { timeout: PLUGIN_TEST_TIMEOUT_MS }, async () => {
      const project = await ProjectBuilder.pluginProject({
        skills: ["web-framework-react", "web-styling-tailwind"],
        marketplace: fixture.marketplaceName,
        agents: ["web-developer"],
        domains: ["web"],
      });

      wizard = await EditWizard.launch({
        projectDir: project.dir,
        source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
      });

      const result = await completeEditFromBuild(wizard);

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      const rawOutput = result.rawOutput;
      expect(rawOutput).toContain("Uninstalling plugin: web-styling-tailwind");
      expect(rawOutput).toContain("removed");
    });

    it(
      "should update config after removing a plugin skill",
      { timeout: PLUGIN_TEST_TIMEOUT_MS },
      async () => {
        const project = await ProjectBuilder.pluginProject({
          skills: ["web-framework-react", "web-styling-tailwind"],
          marketplace: fixture.marketplaceName,
          agents: ["web-developer"],
          domains: ["web"],
        });

        wizard = await EditWizard.launch({
          projectDir: project.dir,
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
        });

        const result = await completeEditFromBuild(wizard);

        await result.exitCode;

        await expect(result.project).toHaveConfig({
          skillIds: ["web-framework-react"],
          source: fixture.marketplaceName,
        });
      },
    );

    it(
      "should recompile agents after removing a plugin skill",
      { timeout: PLUGIN_TEST_TIMEOUT_MS },
      async () => {
        const project = await ProjectBuilder.pluginProject({
          skills: ["web-framework-react", "web-styling-tailwind"],
          marketplace: fixture.marketplaceName,
          agents: ["web-developer"],
          domains: ["web"],
        });

        wizard = await EditWizard.launch({
          projectDir: project.dir,
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
        });

        const result = await completeEditFromBuild(wizard);

        await result.exitCode;

        await expect(result.project).toHaveCompiledAgent("web-developer");
      },
    );
  });

  describe("add skill triggers plugin install", () => {
    it(
      "should install added plugin skills when navigating to a new skill",
      { timeout: PLUGIN_TEST_TIMEOUT_MS },
      async () => {
        const project = await ProjectBuilder.pluginProject({
          skills: ["web-framework-react"],
          marketplace: fixture.marketplaceName,
          agents: ["web-developer"],
          domains: ["web"],
        });

        wizard = await EditWizard.launch({
          projectDir: project.dir,
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
          rows: 60,
          cols: 120,
        });

        // Arrow down to next skill and select it
        await wizard.build.navigateDown();
        await wizard.build.toggleFocusedSkill();

        const result = await completeEditFromBuild(wizard);

        expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = result.rawOutput;
        expect(rawOutput).toContain("Installing plugin:");
        expect(rawOutput).toMatch(/\d+ added/);
      },
    );
  });

  describe("plugin mode completion without skill changes", () => {
    it(
      "should complete edit without triggering plugin install/uninstall when skills are unchanged",
      { timeout: PLUGIN_TEST_TIMEOUT_MS },
      async () => {
        const project = await ProjectBuilder.pluginProject({
          skills: ["web-framework-react"],
          marketplace: fixture.marketplaceName,
          agents: ["web-developer"],
          domains: ["web"],
        });

        wizard = await EditWizard.launch({
          projectDir: project.dir,
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
        });

        const result = await completeEditFromBuild(wizard);

        expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = result.rawOutput;
        expect(rawOutput).not.toContain("Installing plugin:");
        expect(rawOutput).not.toContain("Uninstalling plugin:");
      },
    );
  });

  describe("cancellation in plugin mode", () => {
    it("should not trigger plugin install/uninstall when cancelled", async () => {
      const project = await ProjectBuilder.pluginProject({
        skills: ["web-framework-react", "web-testing-vitest"],
        marketplace: fixture.marketplaceName,
        agents: ["web-developer"],
        domains: ["web"],
      });

      wizard = await EditWizard.launch({
        projectDir: project.dir,
        source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
      });

      wizard.abort();

      const exitCode = await wizard.waitForExit(TIMEOUTS.EXIT);
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);

      const rawOutput = wizard.getRawOutput();
      expect(rawOutput).not.toContain("Installing plugin:");
      expect(rawOutput).not.toContain("Uninstalling plugin:");
    });
  });
});
