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

describe("init wizard — stack flow", () => {
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

  describe("stack selection happy path", () => {
    it("should display the wizard with stack options and scratch choice", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Start from scratch");
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
});
