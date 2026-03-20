import path from "path";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { CLAUDE_SRC_DIR, CLAUDE_DIR } from "../../src/cli/consts.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  directoryExists,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  KEYSTROKE_DELAY_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

describe("init wizard — navigation", () => {
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
      await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
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
      await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.enter();
      await session.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.escape();
      await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
    });

    it("should go back from confirm step to build step", async () => {
      await createProjectAndSource();
      session = spawnInitWizard(projectDir!, sourceDir!);

      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.enter();
      await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.enter();
      await session.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.write("a");
      await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.escape();
      await session.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);
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
});
