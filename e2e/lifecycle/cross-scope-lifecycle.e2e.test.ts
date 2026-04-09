import { mkdir } from "fs/promises";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expectPhaseSuccess } from "../assertions/phase-assertions.js";
import { expectCleanUninstall } from "../assertions/uninstall-assertions.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { E2E_AGENTS } from "../fixtures/expected-values.js";
import { TIMEOUTS, DIRS, FILES } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  ensureBinaryExists,
  fileExists,
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

      // --- Phase 1 Verification ---

      await expectPhaseSuccess(
        { project: { dir: fakeHome }, exitCode: initResult.exitCode },
        {
          skillIds: ["web-framework-react"],
          agents: E2E_AGENTS.WEB_AND_API,
          source: "agents-inc",
          copiedSkills: ["web-framework-react"],
        },
      );
      await expect({ dir: fakeHome }).toHaveCompiledAgentContent("web-developer", {
        contains: ["name: web-developer", "web-framework-react"],
      });
      await expect({ dir: fakeHome }).toHaveCompiledAgentContent("api-developer", {
        contains: ["name: api-developer"],
      });

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

      const phase2Raw = editResult.rawOutput;

      // ================================================================
      // Phase 3: Verification -- global preserved, no project leakage
      // ================================================================

      // Global state preserved: config, agents, and skills
      await expectPhaseSuccess(
        { project: { dir: fakeHome }, exitCode: editResult.exitCode },
        {
          skillIds: ["web-framework-react"],
          agents: E2E_AGENTS.WEB_AND_API,
          source: "agents-inc",
          copiedSkills: ["web-framework-react"],
        },
      );
      await expect({ dir: fakeHome }).toHaveCompiledAgentContent("web-developer", {
        contains: ["name: web-developer", "web-framework-react"],
      });
      await expect({ dir: fakeHome }).toHaveCompiledAgentContent("api-developer", {
        contains: ["name: api-developer"],
      });

      // No project config created
      const projectConfigPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      expect(await fileExists(projectConfigPath)).toBe(false);

      // No project-scope skills or agents leaked
      await expectCleanUninstall(projectDir);

      // No errors in Phase 2 output
      expect(phase2Raw).not.toContain("ENOENT");

      await editResult.destroy();
    },
  );
});
