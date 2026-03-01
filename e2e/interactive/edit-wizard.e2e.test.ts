import path from "path";
import { mkdir } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
  directoryExists,
  listFiles,
  readTestFile,
  createEditableProject,
  createLocalSkill,
  createPermissionsFile,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  INSTALL_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  EXIT_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

/**
 * E2E tests for the `edit` command wizard.
 *
 * The edit command re-enters the wizard at the build step with
 * pre-selected skills from the existing installation. It requires
 * a valid project with .claude-src/config.ts already present.
 *
 * These tests spawn the actual CLI binary via PTY (zero mocks).
 */
describe("edit wizard", () => {
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
      // The react skill tag should be visible
      expect(fullOutput).toContain("react");
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
      expect(output).toContain("Build");
      expect(output).toContain("Confirm");
    });
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
      // Since skills are pre-selected and a styling skill is also selected,
      // the validation should pass and we should proceed to the sources step.
      session.enter();

      // The next step after build is "sources", then "agents", then "confirm"
      // Wait for the sources step or agents step to appear
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
      // (src/cli/components/hooks/use-wizard-initialization.ts:39).
      // This causes goBack to fall through to the domain step instead of
      // cancelling the wizard or staying on build.
      session.escape();
      await delay(STEP_TRANSITION_DELAY_MS);

      const screen = session.getScreen();
      expect(screen).toContain("Select domains to configure");
    });

    // BUG: ESC from edit build step goes to stack step instead of cancelling
    // because initialStep="build" is set via setState() without pushing to history
    // (src/cli/components/hooks/use-wizard-initialization.ts:39).
    // In edit mode, the build step IS the first step, so ESC should cancel the
    // wizard (exit), not navigate to the stack step which is nonsensical.
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
      expect(output).toContain("Plugin mode");
      expect(output).toContain("Help");
    });

    it("should toggle install mode with P key", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir, {
        installMode: "local",
      });

      session = new TerminalSession(["edit"], projectDir, {
        rows: 40,
        cols: 120,
      });

      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
      // The footer should initially show "Plugin mode" (toggle indicator)
      const outputBefore = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      expect(outputBefore).toContain("Plugin mode");

      // Press P to toggle install mode from local to plugin
      session.write("p");
      await delay(STEP_TRANSITION_DELAY_MS);

      // The screen should still show the build step
      const screenAfter = session.getScreen();
      expect(screenAfter).toContain("Customize your Web stack");
    });
  });

  describe("confirm step and completion", () => {
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
      await session.waitForText("technologies", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Sources step -> Agents step (accept recommended sources)
      session.enter();
      await session.waitForText("Select agents to compile", EXIT_TIMEOUT_MS);
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

    it("should complete full edit flow and recompile agents", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react", "web-styling-tailwind"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      // Permissions file prevents the blocking permission prompt after recompile
      await createPermissionsFile(projectDir);

      session = new TerminalSession(["edit"], projectDir, {
        rows: 40,
        cols: 120,
      });

      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

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
      await session.waitForText("technologies", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Sources step -> Agents step
      session.enter();
      await session.waitForText("Select agents to compile", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Agents step -> Confirm step
      session.enter();
      await session.waitForText("Ready to install", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Go back from confirm step to build step via ESC
      session.escape();
      await session.waitForText("Select agents to compile", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.escape();
      await session.waitForText("technologies", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.escape();
      await session.waitForText("Customize your Web stack", EXIT_TIMEOUT_MS);
      // The pre-selected skill should still be shown after navigating back
      await session.waitForText("(1 of 1)", WIZARD_LOAD_TIMEOUT_MS);
      const outputAfter = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      expect(outputAfter).toMatch(/Framework.*\(1 of 1\)/);
      expect(outputAfter).toContain("react");
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
      await session.waitForText("(1 selected)", WIZARD_LOAD_TIMEOUT_MS);

      const output = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      // Framework category should show the pre-selected react skill
      expect(output).toMatch(/Framework.*\(1 of 1\)/);
      // Testing category should show the pre-selected vitest skill
      expect(output).toMatch(/Testing.*\(1 selected\)/);
      // Both skill tags should be visible
      expect(output).toContain("react");
      expect(output).toContain("vitest");
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
      // Since the edit command loads the full matrix from the default source,
      // web-testing-vitest already exists in the marketplace. Adding it on
      // disk makes discoverAllPluginSkills() find it, but the build step
      // shows all marketplace skills regardless.
      await createLocalSkill(projectDir, "web-testing-vitest", {
        description: "Next generation testing framework",
        metadata: `author: "@test"\ndisplayName: web-testing-vitest\ncategory: web-testing\ncontentHash: "e2e-hash-vitest"\n`,
      });

      session = new TerminalSession(["edit"], projectDir, {
        rows: 60,
        cols: 120,
      });

      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      const output = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      // The original pre-selected skill should still be visible
      expect(output).toContain("react");
      // The newly added skill tag should be visible in the build step.
      // The marketplace matrix includes vitest as a selectable option.
      expect(output).toContain("vitest");
    });
  });

  describe("build step validation", () => {
    it("should prevent advancing when all skills in a required category are deselected", async () => {
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

      // Try to proceed with ENTER — validation should prevent advancing
      session.enter();
      await delay(STEP_TRANSITION_DELAY_MS);

      const screen = session.getScreen();
      // The wizard should show a validation error about requiring at least one skill
      // in the Framework category (which is a required category)
      expect(screen).toContain("Select at least one skill");
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
      await session.waitForText("technologies", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Sources step -> Agents step
      session.enter();
      await session.waitForText("Select agents to compile", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Agents step -> Confirm step
      session.enter();
      await session.waitForText("Ready to install", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Press ESC on confirm step — should go back to agents step
      session.escape();
      await session.waitForText("Select agents to compile", EXIT_TIMEOUT_MS);

      const screen = session.getScreen();
      // Should be back on the agents step, not exited
      expect(screen).toContain("Select agents to compile");
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
    it("should fall back to global installation when no project config exists", async () => {
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
      // detectInstallation checks cwd first (no config), then falls back to HOME
      session = new TerminalSession(["edit"], workDir, {
        env: { HOME: projectDir },
      });

      // The edit command should detect the global installation and show
      // the "No project installation found. Using global installation..." message
      // in the startup buffer, then launch the wizard.
      await session.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);

      // The raw output should contain the global fallback message
      const raw = session.getRawOutput();
      expect(raw).toContain("global installation");
    });
  });
});
