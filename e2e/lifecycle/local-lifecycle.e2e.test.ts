import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import {
  verifyConfig,
  verifyAgentCompiled,
  verifySkillCopiedLocally,
} from "../helpers/plugin-assertions.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
  directoryExists,
  listFiles,
  readTestFile,
  createPermissionsFile,
  navigateInitWizardToCompletion,
  runCLI,
  INSTALL_TIMEOUT_MS,
  SETUP_TIMEOUT_MS,
  LIFECYCLE_TEST_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";

/**
 * Full lifecycle E2E test for local mode: Init -> Compile -> Uninstall.
 *
 * This test exercises the complete lifecycle in local mode (no Claude CLI needed):
 *
 * Phase 1: Init wizard creates config, compiles agents, copies skills
 * Phase 2: Compile recompiles agents from existing installation
 * Phase 3: Uninstall --yes removes skills and agents
 * Phase 4: Verify clean state (config preserved, artifacts removed)
 *
 * A single tempDir serves as both HOME and project directory for full isolation.
 * Each phase depends on the previous, so the test runs as a single sequential block.
 *
 * Design reference: e2e-full-lifecycle-test-design.md Section 3.1 (simplified)
 */

describe("local mode lifecycle: init -> compile -> uninstall", () => {
  let tempDir: string;
  let sourceDir: string;
  let sourceTempDir: string;
  let projectDir: string;
  let session: TerminalSession | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;

    tempDir = await createTempDir();
    projectDir = tempDir;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await session?.destroy();
    if (tempDir) await cleanupTempDir(tempDir);
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  it(
    "should complete full lifecycle: init -> compile -> uninstall",
    { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
    async () => {
      // ================================================================
      // Phase 1: Init — run wizard, verify config + agents + skills
      // ================================================================

      await createPermissionsFile(projectDir);

      session = new TerminalSession(["init", "--source", sourceDir], projectDir, {
        env: { AGENTSINC_SOURCE: undefined },
      });

      await navigateInitWizardToCompletion(session);
      const initExitCode = await session.waitForExit(INSTALL_TIMEOUT_MS);
      expect(initExitCode).toBe(EXIT_CODES.SUCCESS);

      // --- Phase 1 Verification ---

      // P1-A: Config exists
      const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      expect(await fileExists(configPath)).toBe(true);

      // P1-B: Config has expected skill
      await verifyConfig(projectDir, {
        skillIds: ["web-framework-react"],
      });

      // P1-B2: Config has source field with some value
      const configContent = await readTestFile(configPath);
      expect(configContent).toMatch(/"source":\s*"[^"]+"/);
      expect(configContent).toMatch(/"scope":\s*"(project|global)"/);

      // P1-C: Agents directory exists with compiled agents
      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      expect(await directoryExists(agentsDir)).toBe(true);

      // E2E source defines exactly 2 agents: web-developer and api-developer
      const agentFiles = await listFiles(agentsDir);
      const mdFiles = agentFiles.filter((f) => f.endsWith(".md"));
      expect(mdFiles.length).toBe(2);

      // P1-D: At least web-developer agent compiled with valid frontmatter
      expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);

      // P1-E: Skills directory exists with copied skills
      const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      expect(await directoryExists(skillsDir)).toBe(true);

      // P1-F: At least web-framework-react skill was copied locally
      expect(await verifySkillCopiedLocally(projectDir, "web-framework-react")).toBe(true);

      // P1-G: No archive warnings or errors during first install
      const initOutput = session.getFullOutput();
      expect(initOutput).not.toContain("Failed to archive");
      expect(initOutput).not.toContain("ENOENT");

      // Clean up session before non-interactive commands
      await session.destroy();
      session = undefined;

      // ================================================================
      // Phase 2: Compile — recompile agents from existing installation
      // ================================================================

      const compileResult = await runCLI(["compile"], projectDir, {
        env: { AGENTSINC_SOURCE: undefined },
      });

      expect(compileResult.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(compileResult.combined).toMatch(/Recompiled [1-9]\d* global agents/);

      // P2-A: web-developer agent still compiled with valid frontmatter
      expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);

      // P2-B: Agent file has meaningful content (frontmatter + body)
      const webDevPath = path.join(agentsDir, "web-developer.md");
      const webDevContent = await readTestFile(webDevPath);
      expect(webDevContent).toMatch(/^---/);
      expect(webDevContent).toContain("name: web-developer");

      // ================================================================
      // Phase 3: Uninstall --yes — remove skills and agents
      // ================================================================

      const uninstallResult = await runCLI(["uninstall", "--yes"], projectDir, {
        env: { AGENTSINC_SOURCE: undefined },
      });

      expect(uninstallResult.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(uninstallResult.stdout).toContain("Uninstall complete!");

      // ================================================================
      // Phase 4: Verify clean state
      // ================================================================

      // P4-A: Skills directory removed
      expect(await directoryExists(skillsDir)).toBe(false);

      // P4-B: Agents directory removed
      expect(await directoryExists(agentsDir)).toBe(false);

      // P4-C: Config directory still exists (--yes without --all preserves config)
      expect(await directoryExists(path.join(projectDir, CLAUDE_SRC_DIR))).toBe(true);

      // P4-D: Config file still readable
      expect(await fileExists(configPath)).toBe(true);
    },
  );
});
