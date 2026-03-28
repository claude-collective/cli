import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, EXIT_CODES, DIRS } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import {
  isClaudeCLIAvailable,
  cleanupTempDir,
  createTempDir,
  ensureBinaryExists,
  fileExists,
  injectMarketplaceIntoConfig,
} from "../helpers/test-utils.js";

/**
 * Source switching lifecycle E2E tests -- bulk mode switching.
 *
 * Tests the full flow of switching ALL skill sources mid-lifecycle:
 *   9a: Init local -> edit switch ALL to plugin -> verify plugin state
 *   9b: Init plugin -> edit switch ALL to local -> verify local state
 *
 * These tests require the Claude CLI for plugin install/uninstall operations.
 *
 * Note: isClaudeCLIAvailable is re-exported from test-utils for skip detection.
 */

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("source switching mid-lifecycle -- bulk mode switching", () => {
  let fixture: E2EPluginSource;

  let tempDir: string | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    fixture = await createE2EPluginSource();
  }, TIMEOUTS.SETUP * 2);

  afterAll(async () => {
    if (fixture) await cleanupTempDir(fixture.tempDir);
  });

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined;
    }
  });

  describe("init local, edit switch all to plugin", () => {
    it(
      "should switch all skills from eject to plugin mode via edit wizard",
      { timeout: TIMEOUTS.EXTENDED_LIFECYCLE },
      async () => {
        tempDir = await createTempDir();
        const projectDir = path.join(tempDir, "project");

        // Phase 1: Init in eject mode using page objects
        const initWizard = await InitWizard.launch({
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
          projectDir,
        });

        // Navigate through init with eject source selection
        const domain = await initWizard.stack.selectFirstStack();
        const build = await domain.acceptDefaults();
        const sources = await build.passThroughAllDomains();
        await sources.setAllLocal();
        const agents = await sources.advance();
        const confirm = await agents.acceptDefaults("init");
        const initResult = await confirm.confirm();

        expect(await initResult.exitCode).toBe(EXIT_CODES.SUCCESS);
        await initResult.destroy();

        // Verify Phase 1: all skills are eject
        await expect({ dir: projectDir }).toHaveSkillCopied("web-framework-react");
        await expect({ dir: projectDir }).toHaveConfig({
          skillIds: ["web-framework-react"],
          source: "eject",
        });

        // Inject marketplace into config (fixture setup for Phase 2)
        await injectMarketplaceIntoConfig(projectDir, fixture.marketplaceName);

        // Phase 2: Edit -- switch ALL to plugin via "p" hotkey
        const editWizard = await EditWizard.launch({
          projectDir,
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
        });

        const editSources = await editWizard.build.passThroughAllDomains();
        await editSources.setAllPlugin();
        const editAgents = await editSources.advance();
        const editConfirm = await editAgents.acceptDefaults("edit");
        const editResult = await editConfirm.confirm();

        expect(await editResult.exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = editResult.rawOutput;
        expect(rawOutput).toContain("Switching");
        expect(rawOutput).toContain("to plugin");

        await expect({ dir: projectDir }).toHaveConfig({
          skillIds: ["web-framework-react"],
          source: fixture.marketplaceName,
        });

        await expect({ dir: projectDir }).toHaveCompiledAgent("web-developer");
        await editResult.destroy();
      },
    );
  });

  describe("init plugin, edit switch all to eject", () => {
    it(
      "should switch all skills from plugin to eject mode via edit wizard",
      { timeout: TIMEOUTS.EXTENDED_LIFECYCLE },
      async () => {
        tempDir = await createTempDir();
        const projectDir = path.join(tempDir, "project");

        // Phase 1: Init in plugin mode
        const initWizard = await InitWizard.launch({
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
          projectDir,
        });
        const initResult = await initWizard.completeWithDefaults();

        expect(await initResult.exitCode).toBe(EXIT_CODES.SUCCESS);
        await initResult.destroy();

        await expect({ dir: projectDir }).toHaveConfig({
          skillIds: ["web-framework-react"],
          source: fixture.marketplaceName,
        });
        await expect({ dir: projectDir }).toHaveCompiledAgent("web-developer");

        // Phase 2: Edit -- switch ALL to eject via "l" hotkey
        const editWizard = await EditWizard.launch({
          projectDir,
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
        });

        const editSources = await editWizard.build.passThroughAllDomains();
        await editSources.setAllLocal();
        const editAgents = await editSources.advance();
        const editConfirm = await editAgents.acceptDefaults("edit");
        const editResult = await editConfirm.confirm();

        expect(await editResult.exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = editResult.rawOutput;
        expect(rawOutput).toContain("Switching");
        expect(rawOutput).toContain("to eject");

        await expect({ dir: projectDir }).toHaveSkillCopied("web-framework-react");

        await expect({ dir: projectDir }).toHaveConfig({
          skillIds: ["web-framework-react"],
          source: "eject",
        });

        // Agent may be compiled at project or global scope
        const projectAgentPath = path.join(projectDir, DIRS.CLAUDE, "agents", "web-developer.md");
        const checkDir = (await fileExists(projectAgentPath)) ? projectDir : os.homedir();
        await expect({ dir: checkDir }).toHaveCompiledAgent("web-developer");

        await editResult.destroy();
      },
    );
  });
});
