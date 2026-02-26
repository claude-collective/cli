import path from "path";
import { writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  STANDARD_FILES,
  STANDARD_DIRS,
} from "../../src/cli/consts.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  directoryExists,
  createEditableProject,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  EXIT_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";

/**
 * E2E tests for the `uninstall` command interactive confirmation prompt.
 *
 * The uninstall command without --yes renders an Ink-based confirmation
 * prompt that shows what will be removed and asks "Are you sure you want
 * to uninstall?" using @inkjs/ui ConfirmInput (y/n keys).
 *
 * These tests spawn the actual CLI binary via PTY (zero mocks).
 */
describe("uninstall interactive", () => {
  let tempDir: string;
  let session: TerminalSession | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await session?.destroy();
    session = undefined;
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  /**
   * Creates a project with CLI-managed skills (forkedFrom metadata present)
   * so that uninstall detects content to remove.
   */
  async function createUninstallableProject(temp: string): Promise<string> {
    const projectDir = await createEditableProject(temp, {
      skills: ["web-framework-react"],
      agents: ["web-developer"],
      domains: ["web"],
    });

    // Add forkedFrom metadata so uninstall recognizes the skill as CLI-managed
    const skillMetadataPath = path.join(
      projectDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      "web-framework-react",
      STANDARD_FILES.METADATA_YAML,
    );
    await writeFile(
      skillMetadataPath,
      [
        'author: "@test"',
        'contentHash: "e2e-hash-web-framework-react"',
        "forkedFrom:",
        "  skillId: web-framework-react",
        '  contentHash: "e2e-hash"',
        "  date: 2026-01-01",
      ].join("\n") + "\n",
    );

    return projectDir;
  }

  describe("confirmation prompt", () => {
    it("should show confirmation prompt with files to remove", async () => {
      tempDir = await createTempDir();
      const projectDir = await createUninstallableProject(tempDir);

      session = new TerminalSession(["uninstall"], projectDir);

      await session.waitForText("The following will be removed", WIZARD_LOAD_TIMEOUT_MS);

      const output = session.getFullOutput();
      expect(output).toContain("CLI-managed files");
      expect(output).toContain("Are you sure you want to uninstall");
    });

    it("should show the y/N prompt defaulting to cancel", async () => {
      tempDir = await createTempDir();
      const projectDir = await createUninstallableProject(tempDir);

      session = new TerminalSession(["uninstall"], projectDir);

      await session.waitForText("Are you sure you want to uninstall", WIZARD_LOAD_TIMEOUT_MS);

      const output = session.getFullOutput();
      // ConfirmInput with defaultChoice="cancel" renders "y/N"
      expect(output).toContain("y/N");
    });
  });

  describe("cancel with n", () => {
    it("should cancel when user types n", async () => {
      tempDir = await createTempDir();
      const projectDir = await createUninstallableProject(tempDir);

      session = new TerminalSession(["uninstall"], projectDir);

      await session.waitForText("Are you sure you want to uninstall", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.write("n");

      await session.waitForText("Uninstall cancelled", EXIT_TIMEOUT_MS);

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });

    it("should preserve files after cancellation", async () => {
      tempDir = await createTempDir();
      const projectDir = await createUninstallableProject(tempDir);

      const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");

      // Verify files exist before uninstall
      expect(await directoryExists(skillsDir)).toBe(true);
      expect(await directoryExists(agentsDir)).toBe(true);

      session = new TerminalSession(["uninstall"], projectDir);

      await session.waitForText("Are you sure you want to uninstall", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.write("n");

      await session.waitForExit(EXIT_TIMEOUT_MS);

      // All files should be preserved after cancellation
      expect(await directoryExists(skillsDir)).toBe(true);
      expect(await directoryExists(agentsDir)).toBe(true);
      expect(await directoryExists(path.join(projectDir, CLAUDE_SRC_DIR))).toBe(true);
    });

    it("should cancel when user presses Enter (default is cancel)", async () => {
      tempDir = await createTempDir();
      const projectDir = await createUninstallableProject(tempDir);

      session = new TerminalSession(["uninstall"], projectDir);

      await session.waitForText("Are you sure you want to uninstall", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Enter should use defaultChoice which is "cancel" (defaultValue={false})
      session.enter();

      await session.waitForText("Uninstall cancelled", EXIT_TIMEOUT_MS);

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });
  });

  describe("confirm with y", () => {
    it("should proceed when user types y", async () => {
      tempDir = await createTempDir();
      const projectDir = await createUninstallableProject(tempDir);

      session = new TerminalSession(["uninstall"], projectDir);

      await session.waitForText("Are you sure you want to uninstall", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.write("y");

      await session.waitForText("Uninstall complete", EXIT_TIMEOUT_MS);

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it("should remove CLI-managed files after confirming", async () => {
      tempDir = await createTempDir();
      const projectDir = await createUninstallableProject(tempDir);

      const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");

      // Verify files exist before uninstall
      expect(await directoryExists(skillsDir)).toBe(true);
      expect(await directoryExists(agentsDir)).toBe(true);

      session = new TerminalSession(["uninstall"], projectDir);

      await session.waitForText("Are you sure you want to uninstall", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.write("y");

      await session.waitForExit(EXIT_TIMEOUT_MS);

      // Skills and agents should be removed
      expect(await directoryExists(skillsDir)).toBe(false);
      expect(await directoryExists(agentsDir)).toBe(false);

      // Config directory should still exist (no --all flag)
      expect(await directoryExists(path.join(projectDir, CLAUDE_SRC_DIR))).toBe(true);
    });
  });

  describe("Ctrl+C during confirmation", () => {
    it("should exit cleanly when Ctrl+C is pressed", async () => {
      tempDir = await createTempDir();
      const projectDir = await createUninstallableProject(tempDir);

      session = new TerminalSession(["uninstall"], projectDir);

      await session.waitForText("Are you sure you want to uninstall", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.ctrlC();

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });

    it("should preserve files after Ctrl+C", async () => {
      tempDir = await createTempDir();
      const projectDir = await createUninstallableProject(tempDir);

      const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");

      session = new TerminalSession(["uninstall"], projectDir);

      await session.waitForText("Are you sure you want to uninstall", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.ctrlC();

      await session.waitForExit(EXIT_TIMEOUT_MS);

      // All files should be preserved after Ctrl+C
      expect(await directoryExists(skillsDir)).toBe(true);
      expect(await directoryExists(agentsDir)).toBe(true);
      expect(await directoryExists(path.join(projectDir, CLAUDE_SRC_DIR))).toBe(true);
    });
  });
});
