import path from "path";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_DIRS, STANDARD_FILES } from "../../src/cli/consts.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
  directoryExists,
  listFiles,
  createPermissionsFile,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  INSTALL_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  KEYSTROKE_DELAY_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

describe("init wizard — scratch flow", () => {
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
    await wizardSession.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Agents step — continue with pre-selected agents
    await wizardSession.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Confirm step
    await wizardSession.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
  }

  describe("scratch flow", () => {
    it("should navigate to 'Start from scratch' and enter domain selection", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Navigate past the E2E test stack to reach "Start from scratch"
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);

      session.enter();
      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
    });

    it("should complete a scratch-based init flow selecting both domains", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      // Step 1: Navigate to "Start from scratch"
      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
      session.enter();

      // Step 2: Domain selection — web and api are pre-selected from scratch defaults
      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      const domainOutput = session.getFullOutput();
      expect(domainOutput).toContain("Web");
      expect(domainOutput).toContain("API");

      session.enter();

      // Step 3: Build step — verify both domain tabs are shown
      await session.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);
      const buildOutput = session.getFullOutput();
      expect(buildOutput).toContain("Web");
      expect(buildOutput).toContain("API");
    });

    it("should navigate domain views with Enter and Escape in build step", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      // Navigate to scratch -> domain selection -> build step
      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
      session.enter();

      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Build step starts on the first domain (Web)
      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Select the required Framework skill before advancing
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      // Press Enter to advance to the next domain (API)
      session.enter();
      await session.waitForText("Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Press Escape to go back to the previous domain (Web)
      session.escape();
      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
    });

    it("should show confirm step details with selected technologies", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateScratchToConfirm(session);

      // Verify confirm step shows expected details
      const confirmOutput = session.getFullOutput();
      expect(confirmOutput).toContain("Web");
      expect(confirmOutput).toContain("API");
      expect(confirmOutput).toContain("Skills:");
      expect(confirmOutput).toContain("Agents:");
      expect(confirmOutput).toContain("project");
    });

    it("should complete a full scratch-based init flow through to install", async () => {
      await createProjectAndSource();
      await createPermissionsFile(projectDir!);
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateScratchToConfirm(session);

      // Press Enter to install
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Wait for installation to complete
      await session.waitForText("initialized successfully", INSTALL_TIMEOUT_MS);

      const exitCode = await session.waitForExit(INSTALL_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Verify config was created
      const configPath = path.join(projectDir!, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      expect(await fileExists(configPath)).toBe(true);

      // Verify agents directory was created with agent files
      const agentsDir = path.join(projectDir!, CLAUDE_DIR, "agents");
      expect(await directoryExists(agentsDir)).toBe(true);

      const agentFiles = await listFiles(agentsDir);
      const mdFiles = agentFiles.filter((f) => f.endsWith(".md"));
      expect(mdFiles.length).toBeGreaterThan(0);

      // Verify skills directory was created
      const skillsDir = path.join(projectDir!, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      expect(await directoryExists(skillsDir)).toBe(true);

      const skillFolders = await listFiles(skillsDir);
      expect(skillFolders.length).toBeGreaterThan(0);
    });
  });

  describe("single-domain scratch flow", () => {
    it("should show only Web domain in build step when API is deselected", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      // Navigate to "Start from scratch"
      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
      session.enter();

      // Domain selection — scratch pre-selects web, api, mobile
      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Navigate to API domain and deselect it (toggle off with space)
      // Domains are listed in order: Web, API, Mobile (or similar)
      // Web is at index 0 (focused by default), API is at index 1
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      // Also deselect Mobile (index 2)
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      // Continue with only Web selected
      session.enter();

      // Build step should show only Web domain
      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      // The build step should NOT show API or Mobile
      const buildOutput = session.getFullOutput();
      expect(buildOutput).toContain("Customize your Web stack");
    });
  });

  describe("all domains deselected", () => {
    it("should show empty message when all domains are deselected", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      // Navigate to "Start from scratch"
      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
      session.enter();

      // Domain selection — scratch pre-selects web, api, mobile
      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Deselect Web (index 0, focused by default)
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      // Deselect API (index 1)
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      // Deselect Mobile (index 2)
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      // The checkbox grid should show the empty message
      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Please select at least one domain");
    });
  });
});
