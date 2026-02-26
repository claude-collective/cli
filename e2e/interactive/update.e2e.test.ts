import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  createEditableProject,
  createLocalSkill,
  delay,
  runCLI,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  EXIT_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

/**
 * E2E tests for the `update` command.
 *
 * The update command checks local skills against source for available updates.
 * It shows an interactive confirmation prompt (unless --yes is passed).
 *
 * These tests spawn the actual CLI binary (zero mocks).
 */
describe("update command", () => {
  let tempDir: string;
  let session: TerminalSession | undefined;
  let sourceTempDir: string | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await session?.destroy();
    session = undefined;
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
    if (sourceTempDir) {
      await cleanupTempDir(sourceTempDir);
      sourceTempDir = undefined;
    }
  });

  describe("update --help", () => {
    it("should display help text with command description", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await runCLI(["update", "--help"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Update local skills from source");
      expect(stdout).toContain("--yes");
      expect(stdout).toContain("--source");
      expect(stdout).toContain("--no-recompile");
    });
  });

  describe("update --yes with no installation", () => {
    it("should warn when no local skills exist", async () => {
      tempDir = await createTempDir();

      const { exitCode, combined } = await runCLI(["update", "--yes"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // The update command checks for LOCAL_SKILLS_PATH and warns if absent
      expect(combined).toContain("No local skills found");
    });
  });

  describe("interactive update", () => {
    it("should launch and show loading status for a project with skills", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir);

      session = new TerminalSession(["update"], projectDir);

      // The update command logs "Loading skills..." as it resolves the source
      await session.waitForText("Loading skills...", WIZARD_LOAD_TIMEOUT_MS);
    });

    // The update command with --yes and no outdated skills should report
    // "All skills are up to date." and exit 0. If this fails because
    // createEditableProject's source cannot be resolved without a real
    // marketplace, the test correctly fails -- that's a setup issue, not
    // a reason to accept error messages as "passing."
    it("should report all skills up to date when no outdated skills exist", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir);

      session = new TerminalSession(["update", "--yes"], projectDir);

      await session.waitForText("skills", WIZARD_LOAD_TIMEOUT_MS);

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      const output = session.getFullOutput();

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("up to date");
    });
  });

  describe("update with nonexistent skill name", () => {
    it("should show error containing the skill name", async () => {
      tempDir = await createTempDir();
      const source = await createE2ESource();
      sourceTempDir = source.tempDir;
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react"],
      });

      const { exitCode, combined } = await runCLI(
        ["update", "nonexistent-skill-xyz", "--source", source.sourceDir],
        projectDir,
      );

      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
      // The update command prints: Error: Skill "nonexistent-skill-xyz" not found.
      expect(combined).toContain("nonexistent-skill-xyz");
      expect(combined).toContain("not found");
    });

    it("should suggest similar skills via Did you mean", async () => {
      tempDir = await createTempDir();
      const source = await createE2ESource();
      sourceTempDir = source.tempDir;
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react"],
      });

      // "framework" is a substring of "web-framework-react", triggering findSimilarSkills
      const { exitCode, combined } = await runCLI(
        ["update", "framework", "--source", source.sourceDir],
        projectDir,
      );

      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
      // findSimilarSkills checks if lowered query is included in skill ID
      expect(combined).toContain("Did you mean");
    });
  });

  describe("update --yes --no-recompile", () => {
    it("should not recompile agents when --no-recompile is set", async () => {
      tempDir = await createTempDir();
      const source = await createE2ESource();
      sourceTempDir = source.tempDir;
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react"],
      });

      const { exitCode, combined } = await runCLI(
        ["update", "--yes", "--no-recompile", "--source", source.sourceDir],
        projectDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // When --no-recompile is set, the STATUS_MESSAGES.RECOMPILING_AGENTS
      // ("Recompiling agents...") should NOT appear in the output
      expect(combined).not.toContain("Recompiling agents");
    });
  });

  describe("update local-only skill", () => {
    it("should report that a local-only skill cannot be updated", async () => {
      tempDir = await createTempDir();
      const source = await createE2ESource();
      sourceTempDir = source.tempDir;
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react"],
      });

      // Create a local-only skill with no forkedFrom metadata
      await createLocalSkill(projectDir, "cli-custom-local-skill", {
        description: "A purely local skill with no source link",
      });

      const { exitCode, combined } = await runCLI(
        ["update", "cli-custom-local-skill", "--source", source.sourceDir],
        projectDir,
      );

      // BUG: CLI exits 0 even when it says "Cannot update" -- arguably should
      // be non-zero, but documenting current behavior
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // The update command should recognize it has no forkedFrom and report local-only
      expect(combined).toContain("local-only");
      expect(combined).toContain("Cannot update");
    });
  });

  describe("cancellation", () => {
    it("should exit when Ctrl+C is pressed during source resolution", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir);

      // Point at a non-existent remote source to keep the command busy resolving
      session = new TerminalSession(
        ["update", "--source", "https://example.invalid/nonexistent-repo.git"],
        projectDir,
      );

      // The command starts loading and tries to resolve the remote source
      await session.waitForText("Loading skills...", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.ctrlC();

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      // Ctrl+C should terminate the process (non-zero exit from SIGINT)
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });
  });
});
