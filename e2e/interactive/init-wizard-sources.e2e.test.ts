import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  EXIT_TIMEOUT_MS,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

describe("init wizard — source management", () => {
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
    await wizardSession.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Build step — advance through each domain with Enter.
    // The E2E stack pre-selects skills for Web, API, and Shared domains.
    await wizardSession.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Second domain (API)
    await wizardSession.waitForText("API", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Third domain (Shared) — Enter advances past build step to sources
    await wizardSession.waitForText("Shared", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Sources step
    await wizardSession.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
  }

  describe("source management in wizard", () => {
    it("should open settings overlay when pressing S on the sources step", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await navigateToSourcesStep(session);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Press S to open the settings overlay
      session.write("s");
      await delay(STEP_TRANSITION_DELAY_MS);

      // The settings overlay shows "Customize skill sources" title and "Configured marketplaces"
      await session.waitForText("Customize skill sources", EXIT_TIMEOUT_MS);

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
      await session.waitForText("Customize skill sources", EXIT_TIMEOUT_MS);
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
      await session.waitForText("Customize skill sources", EXIT_TIMEOUT_MS);
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
      await session.waitForText("Customize skill sources", EXIT_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Press ESC to close the settings overlay
      session.escape();
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be back on the sources step with the "Customize skill sources" text
      await session.waitForText("Customize skill sources", EXIT_TIMEOUT_MS);

      const fullOutput = session.getFullOutput();
      // Should no longer show settings-specific content
      expect(fullOutput).not.toContain("Configured marketplaces");
    });
  });
});
