import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { TIMEOUTS, EXIT_CODES, STEP_TEXT } from "../pages/constants.js";
import {
  createTempDir,
  cleanupTempDir,
  createE2ESource,
  ensureBinaryExists,
} from "../helpers/test-utils.js";
import { InteractivePrompt } from "../fixtures/interactive-prompt.js";

/**
 * E2E tests for the `search` command -- interactive mode.
 *
 * Interactive mode is triggered by running `search` without a query argument
 * or with the -i flag. It renders an Ink search UI.
 *
 * Tests use CC_SOURCE env var to point to a local source, avoiding network calls.
 *
 * Note: The search interactive UI is NOT the wizard, so it does not use
 * wizard page objects. It uses InteractivePrompt (which wraps TerminalSession
 * internally).
 */
describe("search command -- interactive mode", () => {
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
      sourceTempDir = undefined!;
    }
  });

  async function createSourceFixture(): Promise<void> {
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }

  describe("interactive search launch", () => {
    it("should render the search UI with loading message", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      prompt = new InteractivePrompt(["search"], tempDir, {
        env: { CC_SOURCE: sourceDir },
      });

      await prompt.waitForText(STEP_TEXT.LOADING_SKILLS, TIMEOUTS.WIZARD_LOAD);
    });

    it("should show the search UI header after loading", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      prompt = new InteractivePrompt(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await prompt.waitForText(STEP_TEXT.SEARCH, TIMEOUTS.WIZARD_LOAD);

      const output = prompt.getScreen();
      expect(output).toContain("navigate");
      expect(output).toContain("ESC");
    });
  });

  describe("search with query argument", () => {
    it("should launch interactive search with pre-filled query", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      prompt = new InteractivePrompt(["search", "-i", "react"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await prompt.waitForText(STEP_TEXT.SEARCH, TIMEOUTS.WIZARD_LOAD);

      const output = prompt.getScreen();
      expect(output).toContain("react");
    });
  });

  describe("interactive search with E2E source", () => {
    it("should display skills loaded from the E2E source", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      prompt = new InteractivePrompt(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await prompt.waitForText(STEP_TEXT.SEARCH, TIMEOUTS.WIZARD_LOAD);

      const output = prompt.getScreen();
      expect(output).toContain("react");
    });

    it("should filter results when typing a query", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      prompt = new InteractivePrompt(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await prompt.waitForText(STEP_TEXT.SEARCH, TIMEOUTS.WIZARD_LOAD);
      await prompt.pressEnter(); // Wait for stable render via transition delay

      for (const char of "hono") {
        await prompt.pressKey(char);
      }

      const output = prompt.getScreen();
      expect(output).toContain("hono");
    });

    it("should show no results message for unmatched interactive query", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      prompt = new InteractivePrompt(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await prompt.waitForText(STEP_TEXT.SEARCH, TIMEOUTS.WIZARD_LOAD);
      await prompt.pressEnter(); // Wait for stable render via transition delay

      for (const char of "zzzzq") {
        await prompt.pressKey(char);
      }

      const output = prompt.getScreen();
      expect(output).toContain("No skills found");
    });

    it("should show result count in status bar", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      prompt = new InteractivePrompt(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await prompt.waitForText(STEP_TEXT.SEARCH, TIMEOUTS.WIZARD_LOAD);

      const output = prompt.getScreen();
      expect(output).toMatch(/\d+ results?/);
    });
  });

  describe("arrow key navigation", () => {
    it("should navigate to a different skill and allow selecting it", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      prompt = new InteractivePrompt(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await prompt.waitForText(STEP_TEXT.SEARCH, TIMEOUTS.WIZARD_LOAD);
      await prompt.pressEnter(); // Wait for stable render via transition delay

      await prompt.space();

      const screenAfterFirstSelect = prompt.getScreen();
      expect(screenAfterFirstSelect).toContain("1 selected");

      await prompt.arrowDown();

      await prompt.space();

      const screenAfterSecondSelect = prompt.getScreen();
      expect(screenAfterSecondSelect).toContain("2 selected");
    });
  });

  describe("selection and import", () => {
    it("should show selected count and import hint after pressing SPACE", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      prompt = new InteractivePrompt(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await prompt.waitForText(STEP_TEXT.SEARCH, TIMEOUTS.WIZARD_LOAD);
      await prompt.pressEnter(); // Wait for stable render via transition delay

      await prompt.space();

      const screenAfterSelect = prompt.getScreen();
      expect(screenAfterSelect).toContain("1 selected");
      expect(screenAfterSelect).toContain("import");
    });

    // BUG: Enter triggers import but copy() receives a relative skill.path from
    // the matrix instead of an absolute path, causing the import to fail
    it.fails("should import selected skill when pressing Enter", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      prompt = new InteractivePrompt(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await prompt.waitForText(STEP_TEXT.SEARCH, TIMEOUTS.WIZARD_LOAD);
      await prompt.pressEnter(); // Wait for stable render via transition delay

      await prompt.space();
      await prompt.pressEnter();

      const exitCode = await prompt.waitForExit(TIMEOUTS.EXIT);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const rawOutput = prompt.getRawOutput();
      expect(rawOutput).toContain("Importing 1 skill");
    });
  });

  describe("scrolling with many results", () => {
    it("should allow navigating through all results with arrow keys", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      prompt = new InteractivePrompt(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await prompt.waitForText(STEP_TEXT.SEARCH, TIMEOUTS.WIZARD_LOAD);
      await prompt.pressEnter(); // Wait for stable render via transition delay

      for (let i = 0; i < 5; i++) {
        await prompt.arrowDown();
      }

      await prompt.space();

      const afterScrollScreen = prompt.getScreen();
      expect(afterScrollScreen).toMatch(/\d+ results?/);
      expect(afterScrollScreen).toContain("1 selected");
    });
  });

  describe("cancellation", () => {
    it("should exit cleanly when Ctrl+C is pressed", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      prompt = new InteractivePrompt(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await prompt.waitForText(STEP_TEXT.SEARCH, TIMEOUTS.WIZARD_LOAD);

      await prompt.ctrlC();

      const exitCode = await prompt.waitForExit(TIMEOUTS.EXIT);
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });

    it("should exit cleanly when ESC is pressed", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      prompt = new InteractivePrompt(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await prompt.waitForText(STEP_TEXT.SEARCH, TIMEOUTS.WIZARD_LOAD);

      await prompt.escape();

      const exitCode = await prompt.waitForExit(TIMEOUTS.EXIT);
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });
  });
});
