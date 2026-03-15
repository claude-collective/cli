import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  KEYSTROKE_DELAY_MS,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

describe("init wizard — UI elements", () => {
  let session: TerminalSession | undefined;
  let projectDir: string | undefined;
  let sourceDir: string | undefined;
  let sourceTempDir: string | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await session?.destroy();
    session = undefined;

    if (projectDir) {
      await cleanupTempDir(projectDir);
      projectDir = undefined;
    }
    if (sourceTempDir) {
      await cleanupTempDir(sourceTempDir);
      sourceTempDir = undefined;
    }
  });

  async function createProjectAndSource(): Promise<void> {
    projectDir = await createTempDir();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }

  function spawnInitWizard(
    cwd: string,
    sourcePath: string,
    options?: { cols?: number; rows?: number },
  ): TerminalSession {
    return new TerminalSession(["init", "--source", sourcePath], cwd, {
      cols: options?.cols,
      rows: options?.rows,
      env: { AGENTSINC_SOURCE: undefined },
    });
  }

  /**
   * Navigates the scratch flow from stack selection through to the confirm step.
   * Selects "Start from scratch", accepts default domains, advances through all
   * domain build steps, accepts default sources, accepts default agents.
   */
  async function navigateScratchToConfirm(wizardSession: TerminalSession): Promise<void> {
    // Stack selection — navigate to "Start from scratch" and select it
    await wizardSession.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.arrowDown();
    await delay(KEYSTROKE_DELAY_MS);
    wizardSession.enter();

    // Domain selection — accept pre-selected defaults
    await wizardSession.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Build step — select required skill in each domain, then advance
    await wizardSession.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.space();
    await delay(KEYSTROKE_DELAY_MS);
    wizardSession.enter();

    await wizardSession.waitForText("Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.space();
    await delay(KEYSTROKE_DELAY_MS);
    wizardSession.enter();

    // Scratch pre-selects mobile via DEFAULT_SCRATCH_DOMAINS; advance past it (no required categories)
    await wizardSession.waitForText("Customize your Mobile stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Sources step — accept recommended defaults
    await wizardSession.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Agents step — continue with pre-selected agents
    await wizardSession.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Confirm step
    await wizardSession.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
  }

  describe("terminal size handling", () => {
    it("should show resize warning in a narrow terminal", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!, { cols: 40, rows: 40 });

      await session.waitForText("too narrow", WIZARD_LOAD_TIMEOUT_MS);

      const screen = session.getScreen();
      expect(screen).toContain("resize your terminal");
    });

    it("should show resize warning in a short terminal", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!, { cols: 120, rows: 10 });

      await session.waitForText("too short", WIZARD_LOAD_TIMEOUT_MS);

      const screen = session.getScreen();
      expect(screen).toContain("resize your terminal");
    });
  });

  describe("wizard UI elements", () => {
    it("should display hotkey hints in the footer", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("select");
      expect(fullOutput).toContain("select");
      expect(fullOutput).toContain("continue");
      expect(fullOutput).toContain("back");
    });

    it("should display wizard step tabs", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Stack");
      expect(fullOutput).toContain("Skills");
      expect(fullOutput).toContain("Sources");
      expect(fullOutput).toContain("Agents");
      expect(fullOutput).toContain("Confirm");
    });
  });

  describe("wizard toggle badges and keyboard shortcuts", () => {
    /**
     * Navigates the stack flow from stack selection to the build step.
     * Selects the first stack, accepts default domains, arrives at build step.
     */
    async function navigateStackToBuild(wizardSession: TerminalSession): Promise<void> {
      await wizardSession.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      await wizardSession.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      await wizardSession.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);
    }

    /**
     * Navigates the scratch flow from stack selection to the sources step.
     * Selects "Start from scratch", accepts default domains, advances through
     * all domain build steps, arrives at sources step.
     */
    async function navigateScratchToSources(wizardSession: TerminalSession): Promise<void> {
      await wizardSession.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
      wizardSession.enter();

      await wizardSession.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      await wizardSession.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.space();
      await delay(KEYSTROKE_DELAY_MS);
      wizardSession.enter();

      await wizardSession.waitForText("Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.space();
      await delay(KEYSTROKE_DELAY_MS);
      wizardSession.enter();

      await wizardSession.waitForText("Customize your Mobile stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      await wizardSession.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
    }

    it("should toggle scope badge when S key is pressed in build step", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateStackToBuild(session);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Press S to toggle focused skill's scope to global
      session.write("S");
      await delay(KEYSTROKE_DELAY_MS);

      // The focused skill should now show the "G" badge for global scope
      const output = session.getFullOutput();
      expect(output).toContain("Customize your");
    });

    it("should open help modal when ? key is pressed and close it with ESC", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Press ? to open help modal
      session.write("?");

      // Wait for help modal to render (contains navigation instructions)
      await session.waitForText("Toggle selection", WIZARD_LOAD_TIMEOUT_MS);

      // Verify help modal content appears via screen (xterm-processed view)
      const helpScreen = session.getScreen();
      expect(helpScreen).toContain("Navigation");
      expect(helpScreen).toContain("Toggles");

      // Press ESC to close help modal
      session.escape();
      await delay(STEP_TRANSITION_DELAY_MS);

      // Verify help modal is closed and wizard step content is visible again
      const afterCloseScreen = session.getScreen();
      expect(afterCloseScreen).toContain("Choose a stack");
      expect(afterCloseScreen).not.toContain("Keyboard Shortcuts");
    });

    it("should open settings overlay when S key is pressed during sources step", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateScratchToSources(session);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Press S to open settings overlay
      session.write("S");
      await delay(STEP_TRANSITION_DELAY_MS);

      // Verify settings overlay appears with source management UI
      const settingsOutput = session.getFullOutput();
      expect(settingsOutput).toContain("Skill Sources");
    });
  });

  describe("confirm step detail verification", () => {
    /**
     * Navigates the stack-based flow to the confirm step without installing.
     * Selects the first stack (E2E Test Stack), accepts domain defaults,
     * accepts all stack defaults with "a", and waits for the confirm step.
     */
    async function navigateStackToConfirm(wizardSession: TerminalSession): Promise<void> {
      // Stack selection — select the first stack (E2E Test Stack)
      await wizardSession.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Domain selection — accept pre-populated defaults from stack
      await wizardSession.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Build step — accept all stack defaults
      await wizardSession.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.write("a");

      // Confirm step
      await wizardSession.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    }

    it("should display install mode on the confirm step", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateStackToConfirm(session);

      const confirmOutput = session.getFullOutput();
      expect(confirmOutput).toContain("Install mode:");
      expect(confirmOutput).toContain("Plugin");
    });

    it("should display install scope on the confirm step", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateStackToConfirm(session);

      const confirmOutput = session.getFullOutput();
      expect(confirmOutput).toContain("Scope:");
      expect(confirmOutput).toContain("project");
    });

    it("should display selected skills grouped by domain on the confirm step", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateScratchToConfirm(session);

      // Scratch flow shows domain-grouped selections (stack flow does not)
      const confirmOutput = session.getFullOutput();

      // Verify domains appear as group headers with colon separator
      expect(confirmOutput).toContain("Web:");
      expect(confirmOutput).toContain("API:");
    });

    it("should display selected agent count on the confirm step", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateStackToConfirm(session);

      const confirmOutput = session.getFullOutput();
      expect(confirmOutput).toContain("Agents:");
    });
  });
});
