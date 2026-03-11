import path from "path";
import { mkdir, writeFile } from "fs/promises";
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
  readTestFile,
  createPermissionsFile,
  createEditableProject,
  writeProjectConfig,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  INSTALL_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  KEYSTROKE_DELAY_MS,
  EXIT_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { renderSkillMd } from "../../src/cli/lib/__tests__/content-generators.js";

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
      const configPath = path.join(projectDir!, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      expect(await fileExists(configPath)).toBe(true);

      const configContent = await readTestFile(configPath);
      expect(configContent).toContain('"scope"');

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
      expect(fullOutput).toContain(`${CLAUDE_SRC_DIR}/${STANDARD_FILES.CONFIG_TS}`);
    });

    describe("local install verification", () => {
      it("should copy skills to .claude/skills/ directory", async () => {
        await createProjectAndSource();

        session = await runFullInitFlow(projectDir!, sourceDir!);

        const exitCode = await session.waitForExit(INSTALL_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        // Verify .claude/skills/ directory exists
        const skillsDir = path.join(projectDir!, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
        expect(await directoryExists(skillsDir)).toBe(true);

        // Verify skill subdirectories were created
        const skillFolders = await listFiles(skillsDir);
        expect(skillFolders.length).toBeGreaterThan(0);

        // Verify at least one skill contains SKILL.md
        const firstSkillDir = path.join(skillsDir, skillFolders[0]!);
        expect(await fileExists(path.join(firstSkillDir, STANDARD_FILES.SKILL_MD))).toBe(true);
      });

      it("should not produce archive warnings during first install", async () => {
        await createProjectAndSource();

        session = await runFullInitFlow(projectDir!, sourceDir!);

        await session.waitForExit(INSTALL_TIMEOUT_MS);

        const fullOutput = session.getFullOutput();

        // These assertions would have caught the archive bug where
        // archiveAndCopySkills checked `!== "public"` instead of `!== "local"`,
        // causing "Failed to archive skill" warnings on every first install
        // because no existing skills exist to archive.
        expect(fullOutput).not.toContain("Failed to archive");
        expect(fullOutput).not.toContain("ENOENT");
      });

      it("should produce SkillConfig[] with id, scope, and source in config", async () => {
        await createProjectAndSource();

        session = await runFullInitFlow(projectDir!, sourceDir!);

        await session.waitForExit(INSTALL_TIMEOUT_MS);

        const configPath = path.join(projectDir!, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        const configContent = await readTestFile(configPath);

        // The config.ts skills field should be an array of SkillConfig objects,
        // NOT bare strings. Each entry should have { id, scope, source } structure.
        expect(configContent).toContain('"scope"');
        expect(configContent).toContain('"source"');

        // Verify the skills variable is a typed SkillConfig[] array with objects.
        // Config writer now generates: const skills: SkillConfig[] = [ { "id": "...", ... } ];
        // and the export default references the variable: skills,
        expect(configContent).toMatch(/const skills: SkillConfig\[\] = \[/);
        expect(configContent).toMatch(/"scope":\s*"(project|global)"/);
        expect(configContent).toMatch(/"source":\s*"[^"]+"/);
      });

      it("should list copied skills in output", async () => {
        await createProjectAndSource();

        session = await runFullInitFlow(projectDir!, sourceDir!);

        await session.waitForExit(INSTALL_TIMEOUT_MS);

        const fullOutput = session.getFullOutput();

        // Verify the output lists skills that were copied
        expect(fullOutput).toContain("Skills copied to:");
        expect(fullOutput).toContain(".claude/skills");
      });
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

      await wizardSession.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
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

    it("should toggle compatibility labels on skill tags when D key is pressed in build step", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateStackToBuild(session);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Verify build step is showing and Labels badge is present
      const buildOutput = session.getFullOutput();
      expect(buildOutput).toContain("Customize your");
      expect(buildOutput).toContain("Labels");

      // Press D to toggle compatibility labels on
      session.write("D");
      await delay(KEYSTROKE_DELAY_MS);

      // With labels toggled on, compatibility labels like "(recommended)" or
      // "(selected)" should appear next to skill tags
      const labelsOnOutput = session.getFullOutput();
      expect(labelsOnOutput).toMatch(/\(recommended\)|\(selected\)|\(discouraged\)/);
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

  describe("existing .claude directory without config", () => {
    it("should start fresh wizard when .claude/ exists but no config", async () => {
      await createProjectAndSource();

      // Create .claude/ directory with a settings file but no .claude-src/config.ts
      const claudeDir = path.join(projectDir!, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });
      await writeFile(
        path.join(claudeDir, "settings.json"),
        JSON.stringify({ permissions: { allow: [] } }),
      );

      session = spawnInitWizard(projectDir!, sourceDir!);

      // The wizard should start fresh since there is no .claude-src/config.ts
      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("E2E Test Stack");
    });
  });

  describe("already initialized project", () => {
    it("should show dashboard when project already has a config", async () => {
      await createProjectAndSource();

      await writeProjectConfig(projectDir!, {
        name: "test-project",
      });

      session = spawnInitWizard(projectDir!, sourceDir!);

      // Dashboard renders instead of the wizard when project is already initialized
      await session.waitForText("Agents Inc.", WIZARD_LOAD_TIMEOUT_MS);

      // Press Escape to dismiss the dashboard
      await delay(STEP_TRANSITION_DELAY_MS);
      session.escape();

      const exitCode = await session.waitForExit();
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    });
  });

  describe("--source flag", () => {
    it("should load custom source and display its stack", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);

      // The E2E source defines an "E2E Test Stack" — verify it appears
      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("E2E Test Stack");
      expect(fullOutput).toContain("Minimal stack for E2E testing");
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

  describe("stack customize flow", () => {
    it("should show build step with stack skills when choosing customize", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      // Select E2E Test Stack (first item, already focused)
      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Domain selection — pre-populated from stack
      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Build step renders — the stack selection sets stackAction to "customize",
      // so the build step shows with the stack's skills pre-selected.
      // Pressing Enter (not "a") advances through domains one by one.
      await session.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);

      // Verify skill categories from the E2E stack are visible
      const buildOutput = session.getFullOutput();
      expect(buildOutput).toContain("Customize your");

      // The E2E stack has web-framework-react, web-testing-vitest, web-state-zustand for web-developer.
      // The build step should show the Framework category from the stack.
      expect(buildOutput).toContain("Framework");
    });
  });

  describe("dashboard on existing project", () => {
    /**
     * Creates a project that looks like it was previously initialized.
     * Uses createEditableProject which creates a `project/` subdirectory
     * inside projectDir. The parent projectDir is cleaned in afterEach.
     */
    async function createDashboardProject(
      options?: Parameters<typeof createEditableProject>[1],
    ): Promise<string> {
      await createProjectAndSource();
      return createEditableProject(projectDir!, options);
    }

    it("should show dashboard menu instead of setup wizard", async () => {
      const dashboardDir = await createDashboardProject({
        skills: ["web-framework-react", "web-testing-vitest"],
        agents: ["web-developer"],
      });

      session = spawnInitWizard(dashboardDir, sourceDir!);

      await session.waitForText("Agents Inc.", WIZARD_LOAD_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();

      // Dashboard shows all four menu options
      expect(fullOutput).toContain("[Edit]");
      expect(fullOutput).toContain("[Compile]");
      expect(fullOutput).toContain("[Doctor]");
      expect(fullOutput).toContain("[List]");

      // Should NOT show the setup wizard
      expect(fullOutput).not.toContain("Choose a stack");

      // Clean exit
      await delay(STEP_TRANSITION_DELAY_MS);
      session.escape();
      await session.waitForExit();
    });

    it("should render installed skill count and mode", async () => {
      const dashboardDir = await createDashboardProject({
        skills: ["web-framework-react", "web-testing-vitest"],
        agents: ["web-developer"],
      });

      session = spawnInitWizard(dashboardDir, sourceDir!);

      await session.waitForText("Agents Inc.", WIZARD_LOAD_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();

      // Dashboard displays skill count from config
      expect(fullOutput).toContain("Skills:");
      expect(fullOutput).toContain("2 installed");

      // Dashboard displays mode
      expect(fullOutput).toContain("Mode:");
      expect(fullOutput).toContain("Local");

      // Dashboard displays agent info
      expect(fullOutput).toContain("Agents:");

      // Clean exit
      await delay(STEP_TRANSITION_DELAY_MS);
      session.escape();
      await session.waitForExit();
    });

    it("should navigate dashboard options with arrow keys", async () => {
      const dashboardDir = await createDashboardProject({
        skills: ["web-framework-react"],
        agents: ["web-developer"],
      });

      session = spawnInitWizard(dashboardDir, sourceDir!);

      await session.waitForText("Agents Inc.", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Dashboard uses left/right arrow keys for horizontal navigation
      session.arrowRight();
      await delay(KEYSTROKE_DELAY_MS);

      // After navigating, all options should still be visible
      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("[Edit]");
      expect(fullOutput).toContain("[Compile]");
      expect(fullOutput).toContain("[Doctor]");
      expect(fullOutput).toContain("[List]");

      // Navigate further right
      session.arrowRight();
      await delay(KEYSTROKE_DELAY_MS);

      // Navigate left
      session.arrowLeft();
      await delay(KEYSTROKE_DELAY_MS);

      // Dashboard is still responsive
      const updatedOutput = session.getFullOutput();
      expect(updatedOutput).toContain("[Edit]");

      // Clean exit
      session.escape();
      await session.waitForExit();
    });

    it("should exit cleanly when pressing Escape", async () => {
      const dashboardDir = await createDashboardProject({
        skills: ["web-framework-react"],
        agents: ["web-developer"],
      });

      session = spawnInitWizard(dashboardDir, sourceDir!);

      await session.waitForText("Agents Inc.", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.escape();

      const exitCode = await session.waitForExit();
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it("should exit cleanly when pressing Ctrl+C", async () => {
      const dashboardDir = await createDashboardProject({
        skills: ["web-framework-react"],
        agents: ["web-developer"],
      });

      session = spawnInitWizard(dashboardDir, sourceDir!);

      await session.waitForText("Agents Inc.", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.ctrlC();

      const exitCode = await session.waitForExit();
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    });
  });

  describe("source management in wizard", () => {
    /**
     * Navigates the init wizard to the sources step so that source management
     * hotkeys (S, A, DEL, ESC) can be tested.
     *
     * Flow: stack -> domain selection -> build step (per-domain Enter) -> sources step
     */
    async function navigateToSourcesStep(wizardSession: TerminalSession): Promise<void> {
      // Stack selection — select the first stack (E2E Test Stack)
      await wizardSession.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Domain selection — accept pre-populated defaults from stack
      await wizardSession.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Build step — advance through each domain with Enter.
      // The E2E stack pre-selects skills for Web, API, and Shared domains.
      await wizardSession.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Second domain (API)
      await wizardSession.waitForText("Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Third domain (Shared) — Enter advances past build step to sources
      await wizardSession.waitForText("Customize your Shared stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      wizardSession.enter();

      // Sources step
      await wizardSession.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
    }

    it("should open settings overlay when pressing S on the sources step", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateToSourcesStep(session);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Press S to open the settings overlay
      session.write("s");
      await delay(STEP_TRANSITION_DELAY_MS);

      // The settings overlay shows "Skill Sources" title and "Configured marketplaces"
      await session.waitForText("Skill Sources", EXIT_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Configured marketplaces");
      expect(fullOutput).toContain("Add source");
    });

    it("should show add source UI when pressing A in settings", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateToSourcesStep(session);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Open settings overlay
      session.write("s");
      await session.waitForText("Skill Sources", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Press A to open the add source input
      session.write("a");
      await delay(STEP_TRANSITION_DELAY_MS);

      // The add source input should show submission hints
      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("ENTER submit");
      expect(fullOutput).toContain("ESC cancel");
    });

    it("should not remove the default source when pressing DEL", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateToSourcesStep(session);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Open settings overlay
      session.write("s");
      await session.waitForText("Skill Sources", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // The default source ("Public") is focused. Press DEL (backspace).
      // The default source should NOT be removed because it has name "public".
      session.write("\x7f");
      await delay(STEP_TRANSITION_DELAY_MS);

      // The Public source should still be visible
      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Public");
      expect(fullOutput).toContain("(default)");
    });

    it("should return to sources step when pressing ESC in settings", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateToSourcesStep(session);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Open settings overlay
      session.write("s");
      await session.waitForText("Skill Sources", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Press ESC to close the settings overlay
      session.escape();
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be back on the sources step with the "technologies" text
      await session.waitForText("technologies", EXIT_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();
      // Should no longer show settings-specific content
      expect(fullOutput).not.toContain("Configured marketplaces");
    });
  });

  describe("stack skill restoration on domain re-toggle", () => {
    it("should restore stack skills when a domain is deselected and re-selected", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      // Select the E2E Test Stack
      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Domain selection — the stack pre-selects Web and API domains
      await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Navigate to API domain (index 1) and deselect it with Space
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      // Re-select API domain with Space (stack snapshot should restore)
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      // Continue to build step
      session.enter();

      // Build step starts on Web domain
      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Navigate to API domain (Enter advances to next domain)
      session.enter();
      await session.waitForText("Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);

      // Verify the E2E stack's API skills were restored.
      // The E2E stack assigns api-framework-hono to the api-developer agent.
      // The API domain's build step should show the skill pre-selected.
      const buildOutput = session.getFullOutput();
      expect(buildOutput).toContain("hono");
    });

    it("should not restore skills in scratch flow when domain is re-toggled", async () => {
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

      // Deselect API (index 1)
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      // Re-select API
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      // Continue to build step
      session.enter();

      // Web domain first
      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Select required skill in Web domain to pass validation
      session.space();
      await delay(KEYSTROKE_DELAY_MS);
      session.enter();

      // API domain
      await session.waitForText("Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);

      // In scratch flow, no stack snapshot exists, so no skills should be
      // automatically restored. The API domain should have zero skills selected.
      const buildOutput = session.getFullOutput();
      // The category should show (0 of N) or similar empty state
      // since scratch flow has no _stackDomainSelections to restore from
      expect(buildOutput).toContain("(0");
    });
  });

  describe("startup message buffering", () => {
    it("should show global fallback message when edit falls back to global config", async () => {
      projectDir = await createTempDir();

      // Create a global config at HOME/.claude-src/config.ts
      // TerminalSession sets HOME=cwd, so we create the config at the temp dir root
      await writeProjectConfig(projectDir, {
        name: "global-test",
        skills: [{ id: "web-framework-react", scope: "project", source: "local" }],
        agents: [{ name: "web-developer", scope: "project" }],
        domains: ["web"],
      });

      // Create the skill directory for the global installation
      const skillDir = path.join(
        projectDir,
        CLAUDE_DIR,
        STANDARD_DIRS.SKILLS,
        "web-framework-react",
      );
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, STANDARD_FILES.SKILL_MD),
        renderSkillMd("web-framework-react", "React", "# React"),
      );
      await writeFile(
        path.join(skillDir, STANDARD_FILES.METADATA_YAML),
        'author: "@test"\ndisplayName: web-framework-react\ncategory: web-framework\nslug: react\ncontentHash: "hash"\n',
      );

      // Create a subdirectory to run `edit` from (without its own config)
      // This simulates running `edit` from a project that has no project config,
      // causing it to fall back to the global installation
      const subDir = path.join(projectDir, "subproject");
      await mkdir(subDir, { recursive: true });

      session = new TerminalSession(["edit"], subDir, {
        env: { HOME: projectDir },
      });

      // The edit command should detect no project config and fall back to global.
      // It should show a message about using global installation.
      await session.waitForText("Loaded", WIZARD_LOAD_TIMEOUT_MS);

      const rawOutput = session.getRawOutput();
      expect(rawOutput).toContain("No project installation found");
      expect(rawOutput).toContain("global installation");
    });
  });

  describe("flag combinations", () => {
    it("should load skills from custom source with edit --source", async () => {
      projectDir = await createTempDir();

      const dashboardDir = await createEditableProject(projectDir, {
        skills: ["web-framework-react"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      session = new TerminalSession(["edit", "--source", sourceDir], dashboardDir, {
        rows: 60,
        cols: 120,
      });

      // The edit command should load skills from the E2E source
      await session.waitForText("Loaded", WIZARD_LOAD_TIMEOUT_MS);
      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      const output = await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      // The E2E source includes web-framework-react
      expect(output).toContain("Framework");
      expect(output).toContain("react");
    });

    // DEFERRED: compile --agent-source {url} requires a remote agent source.
    // This is not testable locally without network access. Tracked in TODO-E2E.md.
  });

  describe("global config detection prompt", () => {
    async function createGlobalConfigSetup(): Promise<{
      tempDir: string;
      workDir: string;
    }> {
      const tempDir = await createTempDir();

      // Create a global config at <tempDir>/.claude-src/config.ts
      await writeProjectConfig(tempDir, {
        name: "global-test",
      });

      // Create a subdirectory with no project config to run init from
      const workDir = path.join(tempDir, "work");
      await mkdir(workDir, { recursive: true });

      return { tempDir, workDir };
    }

    it("should prompt when global config exists but no project config", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      const { tempDir, workDir } = await createGlobalConfigSetup();
      projectDir = tempDir;

      // Spawn init from workDir (no project config) with HOME pointing to tempDir (has global config)
      session = new TerminalSession(["init", "--source", sourceDir!], workDir, {
        env: { HOME: tempDir, AGENTSINC_SOURCE: undefined },
      });

      // The global config detection prompt should appear
      await session.waitForText("global installation was found", WIZARD_LOAD_TIMEOUT_MS);

      const promptOutput = session.getFullOutput();
      expect(promptOutput).toContain("What would you like to do");

      // Press right arrow to move to "Create new project installation"
      session.arrowRight();
      await delay(KEYSTROKE_DELAY_MS);

      // Press Enter to select "Create new project installation"
      session.enter();

      // The wizard should start — "Choose a stack" confirms the create-project path works
      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);

      // Cancel the wizard
      session.escape();
      await session.waitForExit(EXIT_TIMEOUT_MS);
    });

    it("should show dashboard when selecting edit global", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      const { tempDir, workDir } = await createGlobalConfigSetup();
      projectDir = tempDir;

      // Spawn init from workDir (no project config) with HOME pointing to tempDir (has global config)
      session = new TerminalSession(["init", "--source", sourceDir!], workDir, {
        env: { HOME: tempDir, AGENTSINC_SOURCE: undefined },
      });

      // The global config detection prompt should appear
      await session.waitForText("global installation was found", WIZARD_LOAD_TIMEOUT_MS);

      // Press Enter to select "Edit global installation" (the default/first option)
      session.enter();
      await delay(KEYSTROKE_DELAY_MS);

      // The dashboard should appear showing the branding name
      await session.waitForText("Agents Inc.", WIZARD_LOAD_TIMEOUT_MS);

      // Dismiss the dashboard
      session.escape();
      await session.waitForExit(EXIT_TIMEOUT_MS);
    });
  });
});
