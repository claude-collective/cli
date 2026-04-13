import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { TIMEOUTS, DIRS, FILES, EXIT_CODES } from "../pages/constants.js";
import { cleanupTempDir, ensureBinaryExists, readTestFile } from "../helpers/test-utils.js";
import { createGlobalOnlyEnv, type DualScopeEnv } from "../fixtures/dual-scope-helpers.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import "../matchers/setup.js";

/**
 * Global agent toggle guard E2E test.
 *
 * Verifies that globally installed agents cannot be toggled from project
 * scope in the edit wizard's agents step. The guard shows a toast message
 * and leaves the agent selection unchanged.
 */

describe("global agent toggle guard from project scope", () => {
  let sourceDir: string;
  let sourceTempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, TIMEOUTS.SETUP * 2);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  let env: DualScopeEnv | undefined;
  let wizard: EditWizard | undefined;

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;
    await env?.destroy();
    env = undefined;
  });

  it(
    "should block toggling globally installed agents from project scope",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      // Setup: global init + project init with all skills/agents staying global
      env = await createGlobalOnlyEnv(sourceDir, sourceTempDir);

      // Launch edit wizard from project scope
      wizard = await EditWizard.launch({
        projectDir: env.projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        env: { HOME: env.fakeHome },
        rows: 60,
        cols: 120,
      });

      // Navigate to agents step: build (all domains) -> sources -> agents
      const sources = await wizard.build.passThroughAllDomains();
      const agents = await sources.acceptDefaults();

      // Attempt to toggle a globally installed agent
      await agents.toggleAgent("Web Developer");

      // Verify the toast message appeared
      const output = agents.getOutput();
      expect(output).toContain("Global agents cannot be changed from project scope");

      // Complete the wizard without changes
      const confirm = await agents.advance("edit");
      const result = await confirm.confirm();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);
      await result.destroy();

      // Verify the global config still contains the agent (unchanged)
      const globalConfigPath = path.join(env.fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const globalConfig = await readTestFile(globalConfigPath);
      expect(globalConfig).toContain("web-developer");

      // Verify the project config still references the agent as global (unchanged)
      const projectConfigPath = path.join(env.projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const projectConfig = await readTestFile(projectConfigPath);
      expect(projectConfig).toContain('"web-developer"');
      expect(projectConfig).toContain('"scope":"global"');
    },
  );
});
