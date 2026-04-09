import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { TIMEOUTS, DIRS, FILES, EXIT_CODES } from "../pages/constants.js";
import {
  cleanupTempDir,
  directoryExists,
  ensureBinaryExists,
  readTestFile,
} from "../helpers/test-utils.js";
import { createGlobalOnlyEnv, type DualScopeEnv } from "../fixtures/dual-scope-helpers.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import "../matchers/setup.js";

/**
 * Global skill toggle guard E2E test.
 *
 * Verifies that globally installed skills cannot be deselected from project
 * scope in the edit wizard's build step. The guard shows a toast message
 * and leaves the skill selection unchanged.
 *
 * Also covers the exclusive-category bypass vector: selecting a different
 * skill in an exclusive category where the current selection is globally
 * installed must be blocked with the same toast message.
 */

describe("global skill toggle guard from project scope", () => {
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
    "should block toggling globally installed skills from project scope",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      // Setup: global init + project init with all skills staying global
      env = await createGlobalOnlyEnv(sourceDir, sourceTempDir);

      // Launch edit wizard from project scope
      wizard = await EditWizard.launch({
        projectDir: env.projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        env: { HOME: env.fakeHome },
        rows: 60,
        cols: 120,
      });

      // Attempt to toggle a globally installed skill
      await wizard.build.selectSkill("web-framework-react");

      // Verify the toast message appeared (selectSkill's internal delay allows render)
      const output = wizard.build.getOutput();
      expect(output).toContain("Global skills cannot be changed from project scope");

      // Pass through the rest of the wizard without changes
      const sources = await wizard.build.passThroughAllDomains();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("edit");
      const result = await confirm.confirm();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);
      await result.destroy();

      // Verify the global config still contains all original skills (unchanged)
      const globalConfigPath = path.join(env.fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const globalConfig = await readTestFile(globalConfigPath);
      expect(globalConfig).toContain("web-framework-react");

      // Verify global skill directories still exist on disk
      const globalSkillsDir = path.join(env.fakeHome, DIRS.CLAUDE, DIRS.SKILLS);
      expect(await directoryExists(globalSkillsDir)).toBe(true);
      expect(await directoryExists(path.join(globalSkillsDir, "web-framework-react"))).toBe(true);

      // Verify the project config still references the skill as global (unchanged)
      const projectConfigPath = path.join(env.projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const projectConfig = await readTestFile(projectConfigPath);
      expect(projectConfig).toContain('"web-framework-react"');
      expect(projectConfig).toContain('"scope":"global"');
    },
  );

  it(
    "should block selecting a different skill in exclusive category when current is globally installed",
    { timeout: TIMEOUTS.LIFECYCLE, retry: 0 },
    async () => {
      // Setup: global init + project init with all skills staying global
      env = await createGlobalOnlyEnv(sourceDir, sourceTempDir);

      // Launch edit wizard from project scope
      wizard = await EditWizard.launch({
        projectDir: env.projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        env: { HOME: env.fakeHome },
        rows: 60,
        cols: 120,
      });

      // Attempt to select pinia in the exclusive web-client-state category
      // where zustand is already globally selected — this should be blocked
      await wizard.build.selectSkill("web-state-pinia");

      // Verify the toast message appeared
      const output = wizard.build.getOutput();
      expect(output).toContain("Global skills cannot be changed from project scope");

      // Pass through the rest of the wizard without changes
      const sources = await wizard.build.passThroughAllDomains();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("edit");
      const result = await confirm.confirm();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);
      await result.destroy();

      // Verify the global config still contains zustand (not replaced by pinia)
      const globalConfigPath = path.join(env.fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const globalConfig = await readTestFile(globalConfigPath);
      expect(globalConfig).toContain("zustand");
      expect(globalConfig).not.toContain("pinia");

      // Verify global skill directories still exist on disk (eject mode)
      const globalSkillsDir = path.join(env.fakeHome, DIRS.CLAUDE, DIRS.SKILLS);
      expect(await directoryExists(path.join(globalSkillsDir, "web-state-zustand"))).toBe(true);

      // Verify the project config doesn't incorrectly add pinia or remove zustand
      const projectConfigPath = path.join(env.projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const projectConfig = await readTestFile(projectConfigPath);
      expect(projectConfig).not.toContain("pinia");
    },
  );
});
