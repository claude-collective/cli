import path from "path";
import { mkdir } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { CLAUDE_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  createEditableProject,
  createLocalSkill,
  runCLI,
  WIZARD_LOAD_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

/**
 * E2E tests for the `edit` command wizard — launch, display, and error handling.
 *
 * Tests wizard startup, error states, skill display, custom source loading,
 * help output, and global config fallback.
 */
describe("edit wizard — launch and display", () => {
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

  describe("no installation", () => {
    it("should error when no installation exists", async () => {
      tempDir = await createTempDir();
      const emptyDir = path.join(tempDir, "empty");
      await mkdir(emptyDir, { recursive: true });

      session = new TerminalSession(["edit"], emptyDir);

      // The edit command calls detectInstallation() which returns null
      // when no config.ts is found, then exits with an error
      await session.waitForText("No installation found");

      const exitCode = await session.waitForExit();
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);

      const output = session.getFullOutput();
      expect(output).toContain("agentsinc init");
    });
  });

  describe("wizard launch", () => {
    it("should display startup messages for an existing installation", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir);

      session = new TerminalSession(["edit"], projectDir);

      // Startup messages are buffered and rendered via Ink's <Static> component
      await session.waitForText("Loaded", WIZARD_LOAD_TIMEOUT_MS);

      const raw = session.getRawOutput();
      expect(raw).toContain("Loaded");
      expect(raw).toContain("skills");
    });

    it("should show skills loaded status", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir);

      session = new TerminalSession(["edit"], projectDir);

      // The edit command buffers status messages and shows them via Ink's <Static>
      await session.waitForText("Loaded", WIZARD_LOAD_TIMEOUT_MS);
    });

    it("should show pre-selected skills in the build step", async () => {
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

      // The wizard opens at the build step with pre-selected skills.
      // "web-framework-react" should be pre-selected, shown as "1 of 1"
      // in the Framework category header.
      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
      await session.waitForText("Framework");
      // Framework category should show the pre-selected skill count
      await session.waitForText("(1 of 1)", WIZARD_LOAD_TIMEOUT_MS);
      const fullOutput = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      expect(fullOutput).toMatch(/Framework.*\(1 of 1\)/);
      // The React skill tag should be visible
      expect(fullOutput).toContain("React");
    });

    it("should reach the build step wizard view", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir);

      session = new TerminalSession(["edit"], projectDir, {
        rows: 40,
        cols: 120,
      });

      // Wait for the wizard to render the build step.
      // The build step shows "Customize your X stack" title and domain tabs.
      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
      const output = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      // Should show the domain tab bar with Web selected
      expect(output).toContain("Web");
      // Should show the build step navigation instructions
      expect(output).toContain("SPACE");
      expect(output).toContain("ENTER");
      expect(output).toContain("ESC");
      // Should show the wizard step indicators
      expect(output).toContain("Skills");
      expect(output).toContain("Confirm");
    });
  });

  describe("multiple installed skills", () => {
    it("should handle edit with multiple installed skills", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react", "web-testing-vitest"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      session = new TerminalSession(["edit"], projectDir, {
        rows: 60,
        cols: 120,
      });

      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      const output = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      // Framework category should show the pre-selected react skill
      expect(output).toMatch(/Framework.*\(1 of 1\)/);
      // Testing category should be visible (non-exclusive categories no longer show a counter)
      expect(output).toContain("Testing");
      // Both skill tags should be visible
      expect(output).toContain("React");
      expect(output).toContain("Vitest");
    });
  });

  describe("--source flag", () => {
    let sourceTempDir: string | undefined;

    afterEach(async () => {
      if (sourceTempDir) {
        await cleanupTempDir(sourceTempDir);
        sourceTempDir = undefined;
      }
    });

    it("should load skills from custom source directory", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      const source = await createE2ESource();
      sourceTempDir = source.tempDir;

      session = new TerminalSession(["edit", "--source", source.sourceDir], projectDir, {
        rows: 60,
        cols: 120,
      });

      // The edit command should load skills from the E2E source.
      // The startup message includes the skill count from the custom source.
      await session.waitForText("Loaded", WIZARD_LOAD_TIMEOUT_MS);
      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      const output = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      // The E2E source includes web-framework-react, web-testing-vitest, and
      // web-state-zustand — the build step should show skills from the custom source
      expect(output).toContain("Framework");
      // E2E source uses skill IDs as displayNames (e.g. "web-framework-react")
      expect(output).toContain("react");
    });
  });

  describe("newly added skill", () => {
    it("should show a new local skill alongside original skills in build step", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      // Create an additional local skill that was NOT in the original config.
      await createLocalSkill(projectDir, "web-testing-vitest", {
        description: "Next generation testing framework",
        metadata: `author: "@test"\ndisplayName: web-testing-vitest\nslug: vitest\ncategory: web-testing\ndomain: web\ncontentHash: "e2e-hash-vitest"\n`,
      });

      session = new TerminalSession(["edit"], projectDir, {
        rows: 60,
        cols: 120,
      });

      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      const output = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      // The original pre-selected skill should still be visible
      expect(output).toContain("React");
      // The newly added skill tag should be visible in the build step.
      expect(output).toContain("Vitest");
    });
  });

  describe("edit --help", () => {
    it("should display help text with command description", async () => {
      tempDir = await createTempDir();

      session = new TerminalSession(["edit", "--help"], tempDir);

      await session.waitForText("USAGE");

      const output = session.getFullOutput();
      expect(output).toContain("edit");
      expect(output).toContain("Edit skills");
      expect(output).toContain("--source");
      expect(output).toContain("--refresh");

      const exitCode = await session.waitForExit();
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    });
  });

  describe("global installation fallback", () => {
    it("should load wizard using global config when no project config exists", async () => {
      tempDir = await createTempDir();

      // Create a "global home" directory with a valid installation
      const globalHome = path.join(tempDir, "global-home");
      const projectDir = await createEditableProject(globalHome, {
        skills: ["web-framework-react"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      // Create a working directory WITHOUT config (forces global fallback)
      const workDir = path.join(tempDir, "work");
      await mkdir(workDir, { recursive: true });

      // Launch edit with HOME pointing to the global project directory
      session = new TerminalSession(["edit"], workDir, {
        env: { HOME: projectDir },
      });

      // The edit command falls back to global config and launches the wizard
      await session.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);

      const raw = session.getRawOutput();
      expect(raw).toContain("Loaded");
      expect(raw).toContain("skills");
    });
  });
});
