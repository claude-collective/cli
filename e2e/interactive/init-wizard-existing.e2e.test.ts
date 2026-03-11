import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { CLAUDE_DIR, STANDARD_DIRS, STANDARD_FILES } from "../../src/cli/consts.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  createEditableProject,
  writeProjectConfig,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  KEYSTROKE_DELAY_MS,
  EXIT_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { renderSkillMd } from "../../src/cli/lib/__tests__/content-generators.js";

describe("init wizard — existing projects", () => {
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
});
