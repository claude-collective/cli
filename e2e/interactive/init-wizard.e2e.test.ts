import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
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
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  INSTALL_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  KEYSTROKE_DELAY_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

describe("init wizard", () => {
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
   * Runs the full init wizard flow from stack selection through installation.
   * Creates permissions file, spawns wizard, navigates all steps with defaults.
   */
  async function runFullInitFlow(project: string, source: string): Promise<TerminalSession> {
    await createPermissionsFile(project);

    const wizardSession = spawnInitWizard(project, source);

    // Step 1: Stack selection
    await wizardSession.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Step 2: Domain selection (pre-populated from stack)
    await wizardSession.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Step 3: Build step — accept stack defaults
    await wizardSession.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.write("a");

    // Step 4: Confirmation
    await wizardSession.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Wait for installation to complete
    await wizardSession.waitForText("initialized successfully", INSTALL_TIMEOUT_MS);

    return wizardSession;
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

  describe("stack selection happy path", () => {
    it("should display the wizard with stack options and scratch choice", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Start from scratch");
    });

    it("should show the marketplace label", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Marketplace:");
    });

    it("should show the E2E test stack from source config", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("E2E Test Stack");
      expect(fullOutput).toContain("Minimal stack for E2E testing");
    });

    it("should navigate stacks with arrow keys", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);

      // Verify wizard is still rendering after navigation
      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Start from scratch");
    });

    it("should select stack and advance to domain selection", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.enter();
      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
    });

    it("should complete a full stack-based init flow with defaults", async () => {
      await createProjectAndSource();

      session = await runFullInitFlow(projectDir!, sourceDir!);

      const exitCode = await session.waitForExit(INSTALL_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Verify config was created
      const configPath = path.join(projectDir!, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
      expect(await fileExists(configPath)).toBe(true);

      const configContent = await readTestFile(configPath);
      expect(configContent).toContain("installMode:");

      // Verify agents directory was created with agent files
      const agentsDir = path.join(projectDir!, CLAUDE_DIR, "agents");
      expect(await directoryExists(agentsDir)).toBe(true);

      const agentFiles = await listFiles(agentsDir);
      const mdFiles = agentFiles.filter((f) => f.endsWith(".md"));
      expect(mdFiles.length).toBeGreaterThan(0);

      // Verify agent files have valid frontmatter content
      for (const mdFile of mdFiles) {
        const content = await readTestFile(path.join(agentsDir, mdFile));
        expect(content).toMatch(/^---/);
        expect(content).toContain("name:");
      }
    });

    it("should display completion details after install", async () => {
      await createProjectAndSource();

      session = await runFullInitFlow(projectDir!, sourceDir!);

      // Wait for process to fully exit so all output is flushed
      await session.waitForExit(INSTALL_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Agents compiled to:");
      expect(fullOutput).toContain("Configuration:");
      expect(fullOutput).toContain(`${CLAUDE_SRC_DIR}/${STANDARD_FILES.CONFIG_YAML}`);
    });
  });

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
      expect(confirmOutput).toContain("Local");
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
      const configPath = path.join(projectDir!, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
      expect(await fileExists(configPath)).toBe(true);

      // Verify agents directory was created with agent files
      const agentsDir = path.join(projectDir!, CLAUDE_DIR, "agents");
      expect(await directoryExists(agentsDir)).toBe(true);

      const agentFiles = await listFiles(agentsDir);
      const mdFiles = agentFiles.filter((f) => f.endsWith(".md"));
      expect(mdFiles.length).toBeGreaterThan(0);

      // Verify skills directory was created
      const skillsDir = path.join(projectDir!, CLAUDE_DIR, "skills");
      expect(await directoryExists(skillsDir)).toBe(true);

      const skillFolders = await listFiles(skillsDir);
      expect(skillFolders.length).toBeGreaterThan(0);
    });
  });

  describe("Ctrl+C abort", () => {
    it("should exit the wizard without creating files", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.ctrlC();

      const exitCode = await session.waitForExit();
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);

      expect(await directoryExists(path.join(projectDir!, CLAUDE_SRC_DIR))).toBe(false);
      expect(await directoryExists(path.join(projectDir!, CLAUDE_DIR))).toBe(false);
    });
  });

  describe("Escape navigation", () => {
    it("should go back from domain selection to stack selection", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.enter();
      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.escape();
      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    });

    it("should go back from build step to domain selection", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.enter();
      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.enter();
      await session.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.escape();
      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
    });

    it("should go back from confirm step to build step", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.enter();
      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.enter();
      await session.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.write("a");
      await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.escape();
      await session.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);
    });

    it("should cancel wizard when pressing Escape on initial stack selection", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.escape();

      const exitCode = await session.waitForExit();
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);

      expect(await directoryExists(path.join(projectDir!, CLAUDE_SRC_DIR))).toBe(false);
    });
  });

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
      expect(fullOutput).toContain("navigate");
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
      expect(fullOutput).toContain("Build");
      expect(fullOutput).toContain("Sources");
      expect(fullOutput).toContain("Agents");
      expect(fullOutput).toContain("Confirm");
    });

    it("should toggle expert mode with E key", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.write("e");
      await delay(KEYSTROKE_DELAY_MS);

      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Expert mode");
    });
  });

  describe("permission checker", () => {
    const PERMISSION_HANG_TIMEOUT_MS = 15_000;

    /**
     * Runs the full init wizard flow WITHOUT creating a permissions file.
     * This exposes the permission checker hang bug.
     */
    async function runFullInitFlowWithoutPermissions(
      project: string,
      source: string,
    ): Promise<TerminalSession> {
      const wizardSession = spawnInitWizard(project, source);

      // Step 1: Stack selection
      await wizardSession.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Step 2: Domain selection (pre-populated from stack)
      await wizardSession.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Step 3: Build step -- accept stack defaults
      await wizardSession.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.write("a");

      // Step 4: Confirmation
      await wizardSession.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Wait for installation to complete
      await wizardSession.waitForText("initialized successfully", INSTALL_TIMEOUT_MS);

      return wizardSession;
    }

    // BUG: permission checker renders a blocking Ink component with no exit handler
    // when no .claude/settings.json exists. The component renders a "Permission Notice"
    // box but has no useInput/exit handler, so the process hangs forever.
    // (src/cli/lib/permission-checker.tsx:60-81)
    it.fails("should exit after showing permission notice without settings.json", async () => {
      await createProjectAndSource();
      session = await runFullInitFlowWithoutPermissions(projectDir!, sourceDir!);
      // The process should exit after showing the permission notice
      // but it hangs forever because the Ink component has no useInput/exit handler
      const exitCode = await session.waitForExit(PERMISSION_HANG_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    });
  });

  describe("already initialized project", () => {
    it("should warn when project already has a config", async () => {
      await createProjectAndSource();

      const configDir = path.join(projectDir!, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_YAML), "version: 1.0.0\n");

      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("already initialized", WIZARD_LOAD_TIMEOUT_MS);

      const exitCode = await session.waitForExit();
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    });
  });
});
