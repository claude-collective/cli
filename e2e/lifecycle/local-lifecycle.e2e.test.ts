import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, EXIT_CODES, DIRS, STEP_TEXT } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { CLI } from "../fixtures/cli.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  directoryExists,
} from "../helpers/test-utils.js";

/**
 * Full lifecycle E2E test for eject mode: Init -> Compile -> Uninstall.
 *
 * Phase 1: Init wizard creates config, compiles agents, copies skills
 * Phase 2: Compile recompiles agents from existing installation
 * Phase 3: Uninstall --yes removes skills and agents
 * Phase 4: Verify clean state (config preserved, artifacts removed)
 */

describe("eject mode lifecycle: init -> compile -> uninstall", () => {
  let tempDir: string;
  let sourceDir: string;
  let sourceTempDir: string;
  let projectDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;

    tempDir = await createTempDir();
    projectDir = tempDir;
  }, TIMEOUTS.SETUP);

  afterAll(async () => {
    if (tempDir) await cleanupTempDir(tempDir);
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  it(
    "should complete full lifecycle: init -> compile -> uninstall",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      // ================================================================
      // Phase 1: Init -- run wizard, verify config + agents + skills
      // ================================================================

      const wizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir,
      });
      const initResult = await wizard.completeWithDefaults();
      const initExitCode = await initResult.exitCode;
      expect(initExitCode).toBe(EXIT_CODES.SUCCESS);

      // --- Phase 1 Verification ---

      // P1-A/B: Config exists with expected skill, agents, and source
      await expect({ dir: projectDir }).toHaveConfig({
        skillIds: ["web-framework-react"],
        agents: ["web-developer"],
        source: "agents-inc",
      });

      // P1-C/D: Agents compiled with correct content
      await expect({ dir: projectDir }).toHaveCompiledAgent("web-developer");
      await expect({ dir: projectDir }).toHaveCompiledAgentContent("web-developer", {
        contains: ["name: web-developer", "web-framework-react"],
      });

      // P1-F: Skills copied locally
      await expect({ dir: projectDir }).toHaveSkillCopied("web-framework-react");

      // P1-G: No archive warnings or errors
      const initOutput = initResult.output;
      expect(initOutput).not.toContain("Failed to archive");
      expect(initOutput).not.toContain("ENOENT");

      // Clean up session before non-interactive commands
      await initResult.destroy();

      // ================================================================
      // Phase 2: Compile -- recompile agents from existing installation
      // ================================================================

      const compileResult = await CLI.run(
        ["compile"],
        { dir: projectDir },
        {
          env: { AGENTSINC_SOURCE: undefined },
        },
      );

      expect(compileResult.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(compileResult.output).toMatch(/Recompiled [1-9]\d* global agents/);

      // P2-A: Config preserved after compile
      await expect({ dir: projectDir }).toHaveConfig({
        skillIds: ["web-framework-react"],
        agents: ["web-developer"],
        source: "agents-inc",
      });

      // P2-B/C: web-developer agent still compiled with correct content
      await expect({ dir: projectDir }).toHaveCompiledAgent("web-developer");
      await expect({ dir: projectDir }).toHaveCompiledAgentContent("web-developer", {
        contains: ["name: web-developer", "web-framework-react"],
      });

      // ================================================================
      // Phase 3: Uninstall --yes -- remove skills and agents
      // ================================================================

      const uninstallResult = await CLI.run(
        ["uninstall", "--yes"],
        { dir: projectDir },
        {
          env: { AGENTSINC_SOURCE: undefined },
        },
      );

      expect(uninstallResult.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(uninstallResult.stdout).toContain(STEP_TEXT.UNINSTALL_SUCCESS);

      // ================================================================
      // Phase 4: Verify clean state
      // ================================================================

      const skillsDir = path.join(projectDir, DIRS.CLAUDE, DIRS.SKILLS);
      const agentsDir = path.join(projectDir, DIRS.CLAUDE, DIRS.AGENTS);

      // Skills and agents directories should be fully removed
      await expect({ dir: projectDir }).toHaveNoLocalSkills();
      expect(await directoryExists(skillsDir)).toBe(false);
      expect(await directoryExists(agentsDir)).toBe(false);

      // Config directory should still exist (uninstall without --all preserves it)
      expect(await directoryExists(path.join(projectDir, DIRS.CLAUDE_SRC))).toBe(true);

      // The specific skill that was installed in Phase 1 should no longer be present
      expect(await directoryExists(path.join(skillsDir, "web-framework-react"))).toBe(false);
    },
  );
});
