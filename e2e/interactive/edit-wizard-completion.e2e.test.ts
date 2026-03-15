import path from "path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLAUDE_DIR } from "../../src/cli/consts.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  cleanupTempDir,
  createEditableProject,
  createPermissionsFile,
  createTempDir,
  delay,
  directoryExists,
  ensureBinaryExists,
  EXIT_CODES,
  EXIT_TIMEOUT_MS,
  INSTALL_TIMEOUT_MS,
  listFiles,
  STEP_TRANSITION_DELAY_MS,
  WIZARD_LOAD_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * E2E tests for the `edit` command wizard — confirm step and completion flow.
 *
 * Tests the confirm step summary display, full edit flow completion,
 * back navigation, and skill selection preservation.
 */
describe("edit wizard — confirm step and completion", () => {
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

  describe("confirm step and completion", () => {
    let sourceTempDir: string | undefined;

    afterEach(async () => {
      if (sourceTempDir) {
        await cleanupTempDir(sourceTempDir);
        sourceTempDir = undefined;
      }
    });

    it("should navigate to confirm step and show summary", async () => {
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

      // Build step -> Sources step
      session.enter();
      await session.waitForText("Customize skill sources", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Sources step -> Agents step (accept recommended sources)
      session.enter();
      await session.waitForText("Select agents", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Agents step -> Confirm step
      session.enter();
      await session.waitForText("Ready to install", EXIT_TIMEOUT_MS);

      const screen = session.getScreen();
      // Confirm step shows summary with skill/agent counts and install mode
      expect(screen).toContain("Skills:");
      expect(screen).toContain("Agents:");
      expect(screen).toContain("Install mode:");
      expect(screen).toContain("ENTER");
      expect(screen).toContain("ESC");
    });

    it("should complete full edit flow and recompile agents", { timeout: 60_000 }, async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react", "web-styling-tailwind"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      // Permissions file prevents the blocking permission prompt after recompile
      await createPermissionsFile(projectDir);

      // Use a local E2E source to avoid triggering `claude plugin install/uninstall`
      // commands that hang when a real `claude` binary is present on the system.
      const source = await createE2ESource();
      sourceTempDir = source.tempDir;

      session = new TerminalSession(["edit", "--source", source.sourceDir], projectDir, {
        rows: 40,
        cols: 120,
      });

      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      // Build step -> Sources step
      session.enter();
      await session.waitForText("Customize skill sources", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Sources step -> Agents step
      session.enter();
      await session.waitForText("Select agents", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Agents step -> Confirm step
      session.enter();
      await session.waitForText("Ready to install", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Confirm step -> Complete (press Enter to confirm)
      session.enter();

      // Wait for recompilation to finish
      await session.waitForText("Recompiling agents", INSTALL_TIMEOUT_MS);

      const exitCode = await session.waitForExit(INSTALL_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Verify agents were written to disk
      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      expect(await directoryExists(agentsDir)).toBe(true);

      const agentFiles = await listFiles(agentsDir);
      const mdFiles = agentFiles.filter((f) => f.endsWith(".md"));
      expect(mdFiles.length).toBeGreaterThan(0);
    });

    it("should preserve skill selections when navigating back and forth", async () => {
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
      // Verify pre-selected skill is shown
      await session.waitForText("(1 of 1)", WIZARD_LOAD_TIMEOUT_MS);
      const outputBefore = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      expect(outputBefore).toMatch(/Framework.*\(1 of 1\)/);

      // Build step -> Sources step
      session.enter();
      await session.waitForText("Customize skill sources", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Sources step -> Agents step
      session.enter();
      await session.waitForText("Select agents", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Agents step -> Confirm step
      session.enter();
      await session.waitForText("Ready to install", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Go back from confirm step to build step via ESC
      session.escape();
      await session.waitForText("Select agents", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.escape();
      await session.waitForText("Customize skill sources", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.escape();
      await session.waitForText("Customize your Web stack", EXIT_TIMEOUT_MS);
      // The pre-selected skill should still be shown after navigating back
      await session.waitForText("(1 of 1)", WIZARD_LOAD_TIMEOUT_MS);
      const outputAfter = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      expect(outputAfter).toMatch(/Framework.*\(1 of 1\)/);
      expect(outputAfter).toContain("React");
    });
  });

  describe("confirm step navigation", () => {
    it("should return to agents step when pressing ESC on confirm step", async () => {
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

      // Build step -> Sources step
      session.enter();
      await session.waitForText("Customize skill sources", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Sources step -> Agents step
      session.enter();
      await session.waitForText("Select agents", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Agents step -> Confirm step
      session.enter();
      await session.waitForText("Ready to install", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Press ESC on confirm step — should go back to agents step
      session.escape();
      await session.waitForText("Select agents", EXIT_TIMEOUT_MS);

      const screen = session.getScreen();
      // Should be back on the agents step, not exited
      expect(screen).toContain("Select agents");
    });
  });
});
