import { readFile } from "fs/promises";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, EXIT_CODES, DIRS, FILES } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { cleanupTempDir, ensureBinaryExists, fileExists } from "../helpers/test-utils.js";
import { createTestEnvironment } from "../fixtures/dual-scope-helpers.js";

/**
 * SelectedAgentName excluded global agent E2E test.
 *
 * Verifies that when a globally-installed agent is excluded at project level,
 * the project's config-types.ts still includes it in SelectedAgentName.
 * This prevents the generated union from being too narrow.
 */

describe("SelectedAgentName includes excluded global agents", () => {
  let sourceDir: string;
  let sourceTempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, TIMEOUTS.SETUP);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  let testTempDir: string | undefined;

  afterEach(async () => {
    if (testTempDir) {
      await cleanupTempDir(testTempDir);
      testTempDir = undefined;
    }
  });

  it(
    "should include excluded global agent in SelectedAgentName union",
    { timeout: TIMEOUTS.EXTENDED_LIFECYCLE },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();
      testTempDir = tempDir;

      // Phase 1: Global init -- install with default agents
      const globalWizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir: fakeHome,
        env: { HOME: fakeHome },
      });
      const globalResult = await globalWizard.completeWithDefaults();
      expect(await globalResult.exitCode).toBe(EXIT_CODES.SUCCESS);
      await globalResult.destroy();

      // Phase 2: Project init -- deselect one agent
      const projectWizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir,
        env: { HOME: fakeHome },
        rows: 60,
        cols: 120,
      });

      const domain = await projectWizard.stack.selectFirstStack();
      const build = await domain.acceptDefaults();
      const sources = await build.passThroughAllDomains();
      const agents = await sources.acceptDefaults();

      // Deselect api-developer by toggling it off (display name on screen)
      await agents.toggleAgent("API Developer");

      const confirm = await agents.advance("init");
      const result = await confirm.confirm();
      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);
      await result.destroy();

      // Read the project's config-types.ts
      const configTypesPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TYPES_TS);
      expect(await fileExists(configTypesPath)).toBe(true);

      const content = await readFile(configTypesPath, "utf-8");

      // SelectedAgentName should include ALL agents (including the excluded one)
      // The E2E source has 2 agents: web-developer and api-developer
      expect(content).toContain("SelectedAgentName");
      expect(content).toContain("web-developer");
      expect(content).toContain("api-developer");

      // Verify the config.ts has the excluded agent marked
      const configPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      if (await fileExists(configPath)) {
        const configContent = await readFile(configPath, "utf-8");
        expect(configContent).toContain("excluded");
      }
    },
  );
});
