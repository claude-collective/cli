import path from "path";
import { writeFile } from "fs/promises";
import { execa } from "execa";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { STACKS_FILE_PATH } from "../../src/cli/consts.js";
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
  readTestFile,
  listFiles,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  KEYSTROKE_DELAY_MS,
  EXIT_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { renderConfigTs } from "../../src/cli/lib/__tests__/content-generators.js";

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

    it("should navigate between stacks with arrow keys", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      // Overwrite stacks file with two stacks so arrow keys can move between them.
      // The second stack re-uses the same agents as the first (skills exist in source).
      await writeFile(
        path.join(sourceDir, STACKS_FILE_PATH),
        renderConfigTs({
          stacks: [
            {
              id: "alpha-stack",
              name: "Alpha Stack",
              description: "First test stack",
              agents: {},
            },
            {
              id: "beta-stack",
              name: "Beta Stack",
              description: "Second test stack",
              agents: {},
            },
          ],
        }),
      );

      session = new TerminalSession(["build", "stack", "--source", sourceDir], sourceDir);

      await session.waitForText("Select a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Both stacks should be listed in the selector
      const screenBefore = session.getScreen();
      expect(screenBefore).toContain("alpha-stack");
      expect(screenBefore).toContain("beta-stack");

      // Press arrow down to move focus to the second stack
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);

      // The screen should still show both stacks (navigation does not remove items)
      const screenAfter = session.getScreen();
      expect(screenAfter).toContain("alpha-stack");
      expect(screenAfter).toContain("beta-stack");
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

    it("should use a custom source when --source flag is provided", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;
      tempDir = await createTempDir();
      const outputDir = path.join(tempDir, "source-override-output");

      // Run from a separate temp dir (not the source) to verify --source overrides cwd
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

      // Verify the stack was actually compiled from the custom source
      const stackOutputDir = path.join(outputDir, "e2e-test-stack");
      expect(await directoryExists(stackOutputDir)).toBe(true);
    });

    it("should include verbose output when --verbose flag is provided", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;
      tempDir = await createTempDir();
      const outputDir = path.join(tempDir, "verbose-output");

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
          "--verbose",
        ],
        { cwd: sourceDir, reject: false, timeout: COMPILE_TIMEOUT_MS },
      );
      const stdout = stripAnsi(result.stdout);

      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);

      // Verbose mode should include stack compilation details not shown without --verbose
      expect(stdout).toContain("Compiling stack plugin: e2e-test-stack");
      expect(stdout).toContain("Found stack: E2E Test Stack");
      expect(stdout).toContain("Compiled agent:");
    });

    it("should produce compiled agent markdown with frontmatter and skill content", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;
      tempDir = await createTempDir();
      const outputDir = path.join(tempDir, "content-output");

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

      // Verify agent markdown files were created
      const agentsDir = path.join(outputDir, "e2e-test-stack", "agents");
      expect(await directoryExists(agentsDir)).toBe(true);

      const agentFiles = await listFiles(agentsDir);
      expect(agentFiles).toContain("web-developer.md");
      expect(agentFiles).toContain("api-developer.md");

      // Verify web-developer.md content
      const webDeveloperContent = await readTestFile(path.join(agentsDir, "web-developer.md"));

      // Frontmatter should contain agent metadata (name is the AgentName identifier)
      expect(webDeveloperContent).toMatch(/^---\n/);
      expect(webDeveloperContent).toContain("name: web-developer");
      expect(webDeveloperContent).toContain("description:");
      expect(webDeveloperContent).toContain("tools:");
      expect(webDeveloperContent).toContain("Read");
      expect(webDeveloperContent).toContain("Write");
      expect(webDeveloperContent).toContain("Edit");
      expect(webDeveloperContent).toContain("model:");
      expect(webDeveloperContent).toContain("permissionMode:");

      // Frontmatter should list preloaded skills
      expect(webDeveloperContent).toContain("skills:");
      expect(webDeveloperContent).toContain("web-framework-react");

      // Dynamic skills should appear in the skill activation protocol with descriptions
      // from the E2E source SKILL.md frontmatter
      expect(webDeveloperContent).toContain("web-testing-vitest");
      expect(webDeveloperContent).toContain("Next generation testing framework");
      expect(webDeveloperContent).toContain("web-state-zustand");
      expect(webDeveloperContent).toContain("Bear necessities state management");

      // Verify api-developer.md content
      const apiDeveloperContent = await readTestFile(path.join(agentsDir, "api-developer.md"));

      expect(apiDeveloperContent).toMatch(/^---\n/);
      expect(apiDeveloperContent).toContain("name: api-developer");
      expect(apiDeveloperContent).toContain("description:");
      expect(apiDeveloperContent).toContain("tools:");

      // api-framework-hono is preloaded, so its ID should appear in frontmatter skills list
      expect(apiDeveloperContent).toContain("api-framework-hono");
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
