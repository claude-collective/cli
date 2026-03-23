import path from "path";
import { writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { EXIT_CODES, STEP_TEXT, TIMEOUTS } from "../pages/constants.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  directoryExists,
  readTestFile,
  listFiles,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { CLI } from "../fixtures/cli.js";
import { InteractivePrompt } from "../fixtures/interactive-prompt.js";

const COMPILE_TIMEOUT_MS = TIMEOUTS.INSTALL;

/** Stacks config file path (self-contained -- no src/cli import). */
const STACKS_FILE_PATH = "config/stacks.ts";

/**
 * Renders a minimal config.ts export from a plain object.
 * Self-contained helper -- no src/cli import needed.
 */
function renderStacksConfig(data: Record<string, unknown>): string {
  return `export default ${JSON.stringify(data, null, 2)};\n`;
}

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
  let prompt: InteractivePrompt | undefined;
  let sourceDir: string | undefined;
  let sourceTempDir: string | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await prompt?.destroy();
    prompt = undefined;
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
    if (sourceTempDir) {
      await cleanupTempDir(sourceTempDir);
      sourceTempDir = undefined;
    }
  });

  describe("build stack --help", () => {
    it("should display help text with command description", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await CLI.run(["build", "stack", "--help"], { dir: tempDir });

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

      prompt = new InteractivePrompt(["build", "stack", "--source", sourceDir], sourceDir);

      await prompt.waitForText("Select a stack to compile", TIMEOUTS.WIZARD_LOAD);
    });

    it("should display the E2E test stack name in the selector", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      prompt = new InteractivePrompt(["build", "stack", "--source", sourceDir], sourceDir);

      await prompt.waitForText("Select a stack to compile", TIMEOUTS.WIZARD_LOAD);

      const output = prompt.getScreen();
      expect(output).toContain("e2e-test-stack");
    });

    it("should select stack and begin compilation on Enter", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      prompt = new InteractivePrompt(["build", "stack", "--source", sourceDir], sourceDir);

      await prompt.waitForText("Select a stack to compile", TIMEOUTS.WIZARD_LOAD);
      await prompt.pressEnter();

      // After selecting, the command should begin compilation
      await prompt.waitForText(STEP_TEXT.COMPILING_STACK, COMPILE_TIMEOUT_MS);
    });

    it("should navigate between stacks with arrow keys", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      // Overwrite stacks file with two stacks so arrow keys can move between them.
      await writeFile(
        path.join(sourceDir, STACKS_FILE_PATH),
        renderStacksConfig({
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

      prompt = new InteractivePrompt(["build", "stack", "--source", sourceDir], sourceDir);

      await prompt.waitForText("Select a stack to compile", TIMEOUTS.WIZARD_LOAD);

      // Both stacks should be listed in the selector
      const screenBefore = prompt.getScreen();
      expect(screenBefore).toContain("alpha-stack");
      expect(screenBefore).toContain("beta-stack");

      // Press arrow down to move focus to the second stack
      await prompt.arrowDown();

      // The screen should still show both stacks (navigation does not remove items)
      const screenAfter = prompt.getScreen();
      expect(screenAfter).toContain("alpha-stack");
      expect(screenAfter).toContain("beta-stack");
    });
  });

  describe("non-interactive with --stack flag", () => {
    it("should compile the specified stack directly", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;
      tempDir = await createTempDir();
      const outputDir = path.join(tempDir, "output");

      const { exitCode, output } = await CLI.run(
        [
          "build",
          "stack",
          "--stack",
          "e2e-test-stack",
          "--output-dir",
          outputDir,
          "--source",
          sourceDir,
        ],
        { dir: sourceDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain(STEP_TEXT.COMPILING_STACK);
      expect(output).toContain("e2e-test-stack");
    });

    it("should create output in the specified directory", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;
      tempDir = await createTempDir();
      const outputDir = path.join(tempDir, "custom-output");

      const { exitCode } = await CLI.run(
        [
          "build",
          "stack",
          "--stack",
          "e2e-test-stack",
          "--output-dir",
          outputDir,
          "--source",
          sourceDir,
        ],
        { dir: sourceDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const stackOutputDir = path.join(outputDir, "e2e-test-stack");
      expect(await directoryExists(stackOutputDir)).toBe(true);
    });

    it("should use a custom source when --source flag is provided", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;
      tempDir = await createTempDir();
      const outputDir = path.join(tempDir, "source-override-output");

      const { exitCode, output } = await CLI.run(
        [
          "build",
          "stack",
          "--stack",
          "e2e-test-stack",
          "--output-dir",
          outputDir,
          "--source",
          sourceDir,
        ],
        { dir: sourceDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain(STEP_TEXT.COMPILING_STACK);
      expect(output).toContain("e2e-test-stack");

      const stackOutputDir = path.join(outputDir, "e2e-test-stack");
      expect(await directoryExists(stackOutputDir)).toBe(true);
    });

    it("should include verbose output when --verbose flag is provided", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;
      tempDir = await createTempDir();
      const outputDir = path.join(tempDir, "verbose-output");

      const { exitCode, output } = await CLI.run(
        [
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
        { dir: sourceDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("Compiling stack plugin: e2e-test-stack");
      expect(output).toContain("Found stack: E2E Test Stack");
      expect(output).toContain("Compiled agent:");
    });

    it("should produce compiled agent markdown with frontmatter and skill content", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;
      tempDir = await createTempDir();
      const outputDir = path.join(tempDir, "content-output");

      const { exitCode } = await CLI.run(
        [
          "build",
          "stack",
          "--stack",
          "e2e-test-stack",
          "--output-dir",
          outputDir,
          "--source",
          sourceDir,
        ],
        { dir: sourceDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Verify agent markdown files were created
      const agentsDir = path.join(outputDir, "e2e-test-stack", "agents");
      expect(await directoryExists(agentsDir)).toBe(true);

      const agentFiles = await listFiles(agentsDir);
      expect(agentFiles).toContain("web-developer.md");
      expect(agentFiles).toContain("api-developer.md");

      // Verify web-developer.md content
      const webDeveloperContent = await readTestFile(path.join(agentsDir, "web-developer.md"));

      expect(webDeveloperContent).toMatch(/^---\n/);
      expect(webDeveloperContent).toContain("name: web-developer");
      expect(webDeveloperContent).toContain("description:");
      expect(webDeveloperContent).toContain("tools:");
      expect(webDeveloperContent).toContain("Read");
      expect(webDeveloperContent).toContain("Write");
      expect(webDeveloperContent).toContain("Edit");
      expect(webDeveloperContent).toContain("model:");
      expect(webDeveloperContent).toContain("permissionMode:");
      expect(webDeveloperContent).toContain("skills:");
      expect(webDeveloperContent).toContain("web-framework-react");
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
      expect(apiDeveloperContent).toContain("api-framework-hono");
    });
  });

  describe("cancellation", () => {
    it("should exit when Ctrl+C is pressed during stack selection", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      prompt = new InteractivePrompt(["build", "stack", "--source", sourceDir], sourceDir);

      await prompt.waitForText("Select a stack to compile", TIMEOUTS.WIZARD_LOAD);

      await prompt.ctrlC();

      const exitCode = await prompt.waitForExit(TIMEOUTS.EXIT);
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });

    it("should exit when Ctrl+C is pressed after stack loads", async () => {
      const source = await createE2ESource();
      sourceDir = source.sourceDir;
      sourceTempDir = source.tempDir;

      prompt = new InteractivePrompt(["build", "stack", "--source", sourceDir], sourceDir);

      await prompt.waitForText("Select a stack to compile", TIMEOUTS.WIZARD_LOAD);

      await prompt.ctrlC();

      const exitCode = await prompt.waitForExit(TIMEOUTS.EXIT);
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });
  });
});
