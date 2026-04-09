import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { expectPhaseSuccess } from "../assertions/phase-assertions.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, EXIT_CODES, DIRS, FILES, STEP_TEXT } from "../pages/constants.js";
import { InteractivePrompt } from "../fixtures/interactive-prompt.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import {
  isClaudeCLIAvailable,
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  ensureBinaryExists,
  fileExists,
  injectMarketplaceIntoConfig,
  readTestFile,
} from "../helpers/test-utils.js";

/**
 * Source switching lifecycle E2E tests -- per-skill switching.
 *
 * Tests the full flow of switching ONE skill source mid-lifecycle:
 *   9c: Init local -> edit switch ONE skill to plugin -> verify mixed state
 *
 * These tests require the Claude CLI for plugin install/uninstall operations.
 *
 * Note: Phase 2 (edit with per-skill source switching) uses InteractivePrompt
 * because the SourceGrid's arrow-right navigation is not exposed
 * through the SourcesStep page object.
 */

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("source switching mid-lifecycle -- per-skill switching", () => {
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

  describe("per-skill source switching -- mixed local and plugin", () => {
    let prompt: InteractivePrompt | undefined;

    afterEach(async () => {
      if (prompt) {
        await prompt.destroy();
        prompt = undefined;
      }
    });

    it(
      "should support mixed source modes with per-skill switching via customize view",
      { timeout: TIMEOUTS.EXTENDED_LIFECYCLE },
      async () => {
        tempDir = await createTempDir();
        const projectDir = path.join(tempDir, "project");

        // Phase 1: Init in eject mode using page objects
        const initWizard = await InitWizard.launch({
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
          projectDir,
        });

        const domain = await initWizard.stack.selectFirstStack();
        const build = await domain.acceptDefaults();
        const initSources = await build.passThroughAllDomains();
        await initSources.setAllLocal();
        const initAgents = await initSources.advance();
        const initConfirm = await initAgents.acceptDefaults("init");
        const initResult = await initConfirm.confirm();

        await expectPhaseSuccess(initResult, {
          skillIds: ["web-framework-react"],
          source: "eject",
          copiedSkills: ["web-framework-react"],
        });
        await initResult.destroy();

        // Inject marketplace into config (fixture setup for Phase 2)
        await injectMarketplaceIntoConfig(projectDir, fixture.marketplaceName);

        // Phase 2: Edit -- switch ONLY the first skill to plugin mode
        // Uses InteractivePrompt because SourceGrid arrow-right navigation
        // is not exposed through the SourcesStep page object.
        await createPermissionsFile(projectDir);

        prompt = new InteractivePrompt(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
          rows: 60,
          cols: 120,
        });

        await prompt.waitForRawText(STEP_TEXT.BUILD, TIMEOUTS.WIZARD_LOAD);
        await prompt.pressEnter();

        await prompt.waitForRawText(STEP_TEXT.DOMAIN_API, TIMEOUTS.WIZARD_LOAD);
        await prompt.pressEnter();

        await prompt.waitForRawText(STEP_TEXT.DOMAIN_META, TIMEOUTS.WIZARD_LOAD);
        await prompt.pressEnter();

        await prompt.waitForRawText(STEP_TEXT.SOURCES, TIMEOUTS.WIZARD_LOAD);
        await prompt.waitForRawText(STEP_TEXT.SOURCES, TIMEOUTS.WIZARD_LOAD);

        // Arrow right to marketplace source column for the first skill
        await prompt.arrowRight();
        // Space to select the marketplace source for this skill only
        await prompt.space();

        await prompt.pressEnter();

        await prompt.waitForRawText(STEP_TEXT.AGENTS, TIMEOUTS.WIZARD_LOAD);
        await prompt.pressEnter();

        await prompt.waitForRawText(STEP_TEXT.CONFIRM, TIMEOUTS.WIZARD_LOAD);
        await prompt.pressEnter();

        await prompt.waitForRawText(STEP_TEXT.EDIT_SUCCESS, TIMEOUTS.PLUGIN_INSTALL);

        const editExitCode = await prompt.waitForExit(TIMEOUTS.EXIT_WAIT);
        expect(editExitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = prompt.getRawOutput();
        expect(rawOutput).toMatch(/[Ss]witch|[Ii]nstall/);

        const configPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
        expect(await fileExists(configPath)).toBe(true);
        const configContent = await readTestFile(configPath);
        expect(configContent).toContain(fixture.marketplaceName);

        await expect({ dir: projectDir }).toHaveCompiledAgent("web-developer");
      },
    );
  });
});
