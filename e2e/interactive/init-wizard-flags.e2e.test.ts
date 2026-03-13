import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  createEditableProject,
  createPermissionsFile,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  INSTALL_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

describe("init wizard — flags and permissions", () => {
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

  describe("--source flag", () => {
    it("should load custom source and display its stack", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      // The E2E source defines an "E2E Test Stack" — wait for it to render
      await session.waitForText("E2E Test Stack", WIZARD_LOAD_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();
      expect(fullOutput).toContain("Choose a stack");
      expect(fullOutput).toContain("Minimal stack for E2E testing");
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
});
