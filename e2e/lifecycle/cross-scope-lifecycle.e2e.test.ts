import { mkdir } from "fs/promises";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, EXIT_CODES, DIRS } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  directoryExists,
  ensureBinaryExists,
  fileExists,
  readTestFile,
} from "../helpers/test-utils.js";

/**
 * Cross-scope lifecycle E2E test: Init Global -> Edit from Project.
 *
 * Phase 1: Runs `cc init` from HOME to create a global installation
 * Phase 2: Runs `cc edit` from a project subdirectory
 * Phase 3: Verifies global preserved, no project leakage
 *
 * Architecture:
 *   tempDir/
 *     fake-home/                    <- HOME env var points here
 *       .claude-src/config.ts       <- global config
 *       .claude/agents/             <- global agents
 *       .claude/skills/             <- global skills
 *       project/                    <- project directory (CWD for Phase 2)
 */

describe("cross-scope lifecycle: init global -> edit global from project", () => {
  let tempDir: string;
  let sourceDir: string;
  let sourceTempDir: string;
  let fakeHome: string;
  let projectDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;

    tempDir = await createTempDir();
    fakeHome = path.join(tempDir, "fake-home");
    projectDir = path.join(fakeHome, "project");

    await mkdir(fakeHome, { recursive: true });
    await mkdir(projectDir, { recursive: true });
  }, TIMEOUTS.SETUP);

  afterAll(async () => {
    if (tempDir) await cleanupTempDir(tempDir);
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  it(
    "should init globally, then edit global from project directory",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      // ================================================================
      // Phase 1: Init from HOME -- create global installation
      // ================================================================

      const initWizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir: fakeHome,
        env: { HOME: fakeHome },
      });
      const initResult = await initWizard.completeWithDefaults();
      const initExitCode = await initResult.exitCode;
      expect(initExitCode).toBe(EXIT_CODES.SUCCESS);

      // --- Phase 1 Verification ---

      await expect({ dir: fakeHome }).toHaveConfig({
        skillIds: ["web-framework-react"],
      });

      await expect({ dir: fakeHome }).toHaveCompiledAgent("web-developer");
      await expect({ dir: fakeHome }).toHaveSkillCopied("web-framework-react");

      const initOutput = initResult.output;
      expect(initOutput).not.toContain("Failed to");
      expect(initOutput).not.toContain("ENOENT");

      await initResult.destroy();

      // ================================================================
      // Phase 2: Edit from project dir -- uses global config
      // ================================================================

      await createPermissionsFile(projectDir);

      const editWizard = await EditWizard.launch({
        projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        env: { HOME: fakeHome },
      });
      const editResult = await editWizard.passThrough();

      const editExitCode = await editResult.exitCode;
      const phase2Raw = editResult.rawOutput;

      // ================================================================
      // Phase 3: Verification -- global preserved, no project leakage
      // ================================================================

      expect(editExitCode).toBe(EXIT_CODES.SUCCESS);

      // Global config still exists and is valid
      const globalConfigPath = path.join(fakeHome, DIRS.CLAUDE_SRC, "config.ts");
      expect(await fileExists(globalConfigPath)).toBe(true);
      const globalConfigContent = await readTestFile(globalConfigPath);
      expect(globalConfigContent).toContain("web-framework-react");

      // Global agents still exist
      const globalAgentsDir = path.join(fakeHome, DIRS.CLAUDE, "agents");
      expect(await directoryExists(globalAgentsDir)).toBe(true);
      await expect({ dir: fakeHome }).toHaveCompiledAgent("web-developer");

      // No project config created
      const projectConfigPath = path.join(projectDir, DIRS.CLAUDE_SRC, "config.ts");
      expect(await fileExists(projectConfigPath)).toBe(false);

      // Global skills still exist
      await expect({ dir: fakeHome }).toHaveSkillCopied("web-framework-react");

      // No errors in Phase 2 output
      expect(phase2Raw).not.toContain("ENOENT");

      await editResult.destroy();
    },
  );
});
