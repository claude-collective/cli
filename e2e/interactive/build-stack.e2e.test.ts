import path from "path";
import { execa } from "execa";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  BIN_RUN,
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  stripAnsi,
  directoryExists,
  delay,
  runCLI,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  EXIT_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

const COMPILE_TIMEOUT_MS = 30_000;

/**
 * E2E tests for the `build stack` command.
 *
 * The build stack command opens an interactive wizard to select a stack
 * and compile it into a standalone plugin. When no --stack flag is given,
 * it renders a StackSelector Ink component for interactive selection.
 *
 * These tests spawn the actual CLI binary via PTY (zero mocks).
 */
describe("build stack command", () => {
  let tempDir: string;
  let session: TerminalSession | undefined;
  let sourceDir: string | undefined;
  let sourceTempDir: string | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await session?.destroy();
    session = undefined;
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
    if (sourceTempDir) {
      await cleanupTempDir(sourceTempDir);
      sourceTempDir = undefined;
    }
  });

  describe("build stack --help", () => {
    it("should display help text with command description", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await runCLI(["build", "stack", "--help"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Build a stack into a standalone plugin");
      expect(stdout).toContain("--stack");
      expect(stdout).toContain("--output-dir");
      expect(stdout).toContain("--source");
    });
  });

  describe("interactive wizard", () => {
    it("should launch stack selector when --source points to E2E source", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      session = new TerminalSession(["build", "stack", "--source", sourceDir], sourceDir);

      await session.waitForText("Select a stack", WIZARD_LOAD_TIMEOUT_MS);
    });

    it("should display the E2E test stack name in the selector", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      session = new TerminalSession(["build", "stack", "--source", sourceDir], sourceDir);

      await session.waitForText("Select a stack", WIZARD_LOAD_TIMEOUT_MS);

      const screen = session.getScreen();
      expect(screen).toContain("e2e-test-stack");
    });

    it("should select stack and begin compilation on Enter", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      session = new TerminalSession(["build", "stack", "--source", sourceDir], sourceDir);

      await session.waitForText("Select a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.enter();

      // After selecting, the command should begin compilation
      await session.waitForText("Compiling stack", COMPILE_TIMEOUT_MS);
    });
  });

  describe("non-interactive with --stack flag", () => {
    // These tests use execa directly because they need the timeout option
    // which runCLI does not support
    it("should compile the specified stack directly", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;
      tempDir = await createTempDir();
      const outputDir = path.join(tempDir, "output");

      const result = await execa(
        "node",
        [
          BIN_RUN,
          "build",
          "stack",
          "--stack",
          "e2e-test-stack",
          "--output-dir",
          outputDir,
          "--source",
          sourceDir,
        ],
        { cwd: sourceDir, reject: false, timeout: COMPILE_TIMEOUT_MS },
      );
      const stdout = stripAnsi(result.stdout);

      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Compiling stack");
      expect(stdout).toContain("e2e-test-stack");
    });

    it("should create output in the specified directory", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;
      tempDir = await createTempDir();
      const outputDir = path.join(tempDir, "custom-output");

      const result = await execa(
        "node",
        [
          BIN_RUN,
          "build",
          "stack",
          "--stack",
          "e2e-test-stack",
          "--output-dir",
          outputDir,
          "--source",
          sourceDir,
        ],
        { cwd: sourceDir, reject: false, timeout: COMPILE_TIMEOUT_MS },
      );

      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);

      const stackOutputDir = path.join(outputDir, "e2e-test-stack");
      expect(await directoryExists(stackOutputDir)).toBe(true);
    });
  });

  describe("cancellation", () => {
    it("should exit when Ctrl+C is pressed during stack selection", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      session = new TerminalSession(["build", "stack", "--source", sourceDir], sourceDir);

      await session.waitForText("Select a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.ctrlC();

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });

    it("should exit when Ctrl+C is pressed after stack loads", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      session = new TerminalSession(["build", "stack", "--source", sourceDir], sourceDir);

      await session.waitForText("Select a stack", WIZARD_LOAD_TIMEOUT_MS);

      session.ctrlC();

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });
  });
});
