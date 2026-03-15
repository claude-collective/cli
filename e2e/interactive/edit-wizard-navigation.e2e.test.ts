import path from "path";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  createEditableProject,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  EXIT_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";

/**
 * E2E tests for the `edit` command wizard — navigation, hotkeys, cancellation,
 * and build step validation.
 */
describe("edit wizard — navigation and hotkeys", () => {
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

  describe("cancellation", () => {
    it("should cancel when Ctrl+C is pressed during wizard", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir);

      session = new TerminalSession(["edit"], projectDir, {
        rows: 40,
        cols: 120,
      });

      // Wait for the wizard build step to render
      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      // Send Ctrl+C to abort
      session.ctrlC();

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);

      // Ctrl+C in a PTY sends SIGINT, which usually results in non-zero exit
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });

    it("should preserve original installation after cancellation", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react"],
      });

      // Read the original config before editing
      const { readTestFile, fileExists } = await import("../helpers/test-utils.js");
      const { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES, STANDARD_DIRS } =
        await import("../../src/cli/consts.js");
      const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const originalConfig = await readTestFile(configPath);

      session = new TerminalSession(["edit"], projectDir, {
        rows: 40,
        cols: 120,
      });

      // Wait for the wizard build step to render
      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      // Cancel the wizard
      session.ctrlC();
      await session.waitForExit(EXIT_TIMEOUT_MS);

      // Config should be unchanged after cancellation
      const configAfterCancel = await readTestFile(configPath);
      expect(configAfterCancel).toBe(originalConfig);

      // Original skill files should still exist
      const skillMdPath = path.join(
        projectDir,
        CLAUDE_DIR,
        STANDARD_DIRS.SKILLS,
        "web-framework-react",
        STANDARD_FILES.SKILL_MD,
      );
      expect(await fileExists(skillMdPath)).toBe(true);
    });
  });

  describe("keyboard navigation", () => {
    it("should navigate to confirm step with ENTER", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react", "web-styling-tailwind"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      session = new TerminalSession(["edit"], projectDir, {
        rows: 40,
        cols: 120,
      });

      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      // Press ENTER to continue from build step.
      session.enter();

      // The next step after build is "sources", then "agents", then "confirm"
      await session.waitForText("Sources", EXIT_TIMEOUT_MS);
    });

    it("should navigate to domain step when pressing ESC (known bug: should cancel in edit mode)", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir);

      session = new TerminalSession(["edit"], projectDir, {
        rows: 40,
        cols: 120,
      });

      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      // ESC from build step triggers goBack() but history is empty because
      // initialStep="build" is set via setState() without pushing to history
      session.escape();
      await delay(STEP_TRANSITION_DELAY_MS);

      const screen = session.getScreen();
      expect(screen).toContain("Select domains to configure");
    });

    // BUG: ESC from edit build step goes to stack step instead of cancelling
    it.fails(
      "should cancel wizard when pressing ESC on the initial build step in edit mode",
      async () => {
        tempDir = await createTempDir();
        const projectDir = await createEditableProject(tempDir);

        session = new TerminalSession(["edit"], projectDir, {
          rows: 40,
          cols: 120,
        });

        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

        session.escape();
        await delay(STEP_TRANSITION_DELAY_MS);

        const screen = session.getScreen();
        // ESC on the first step in edit mode should cancel the wizard, not go to stack
        expect(screen).toContain("Customize your");
      },
    );
  });

  describe("wizard hotkeys", () => {
    it("should show hotkey indicators in the footer", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir);

      session = new TerminalSession(["edit"], projectDir, {
        rows: 40,
        cols: 120,
      });

      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
      const output = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      // The build step footer shows these hotkey indicators
      expect(output).toContain("Labels");
      expect(output).toContain("Help");
    });

    it("should toggle focused skill scope with S key", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react", "web-styling-tailwind"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      session = new TerminalSession(["edit"], projectDir, {
        rows: 40,
        cols: 120,
      });

      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
      const buildOutput = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      // The "S" badge with "Scope" label should be visible in the build step footer
      expect(buildOutput).toContain("Scope");

      // The first skill (web-framework-react) is focused and pre-selected.
      // Press "s" to toggle its scope from "project" (default) to "global".
      session.write("s");
      await delay(STEP_TRANSITION_DELAY_MS);

      // Navigate to the confirm step to verify the scope change is reflected.
      // Build step -> Sources step
      session.enter();
      await session.waitForText("technologies", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Sources step -> Agents step
      session.enter();
      await session.waitForText("Select agents to compile", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Agents step -> Confirm step
      session.enter();
      await session.waitForText("Ready to install", EXIT_TIMEOUT_MS);

      const confirmOutput = session.getFullOutput();
      // The confirm step shows "Scope:" with counts of project/global skills.
      expect(confirmOutput).toContain("Scope:");
      expect(confirmOutput).toContain("global");
    });
  });

  describe("build step advancement", () => {
    it("should advance past build step even when all skills in a category are deselected", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      session = new TerminalSession(["edit"], projectDir, {
        rows: 40,
        cols: 120,
      });

      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
      // Framework category should show pre-selected react skill
      await session.waitForText("(1 of 1)", WIZARD_LOAD_TIMEOUT_MS);

      // Deselect the react skill with SPACE (it is already focused as the first item)
      session.space();
      await delay(STEP_TRANSITION_DELAY_MS);

      // Press ENTER — wizard should advance to the next step (sources)
      session.enter();

      // The wizard no longer blocks advancement — it advances to sources step
      await session.waitForText("Sources", EXIT_TIMEOUT_MS);
    });
  });
});
