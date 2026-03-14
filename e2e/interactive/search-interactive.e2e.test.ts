import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  KEYSTROKE_DELAY_MS,
  EXIT_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

/**
 * E2E tests for the `search` command — interactive mode.
 *
 * Interactive mode is triggered by running `search` without a query argument
 * or with the -i flag. It renders an Ink search UI.
 *
 * Tests use CC_SOURCE env var to point to a local source, avoiding network calls.
 */
describe("search command — interactive mode", () => {
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

  async function createSourceFixture(): Promise<void> {
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }

  describe("interactive search launch", () => {
    it("should render the search UI with loading message", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search"], tempDir, {
        env: { CC_SOURCE: sourceDir },
      });

      // The search command logs "Loading skills from all sources..." before rendering the UI
      await session.waitForText("Loading skills", WIZARD_LOAD_TIMEOUT_MS);
    });

    it("should show the search UI header after loading", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      // The SkillSearch component renders "Search Skills" in the header
      await session.waitForText("Search Skills", WIZARD_LOAD_TIMEOUT_MS);

      const screen = session.getScreen();
      // The footer shows navigation hints
      expect(screen).toContain("navigate");
      expect(screen).toContain("ESC");
    });
  });

  describe("search with query argument", () => {
    it("should launch interactive search with pre-filled query", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search", "-i", "react"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      // The interactive search should render with the query pre-filled
      await session.waitForText("Search Skills", WIZARD_LOAD_TIMEOUT_MS);

      const screen = session.getScreen();
      expect(screen).toContain("react");
    });
  });

  describe("interactive search with E2E source", () => {
    it("should display skills loaded from the E2E source", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await session.waitForText("Search Skills", WIZARD_LOAD_TIMEOUT_MS);

      const screen = session.getScreen();
      // The E2E source includes skills like web-framework-react
      expect(screen).toContain("react");
    });

    it("should filter results when typing a query", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await session.waitForText("Search Skills", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Type a query to filter results
      session.write("hono");
      await delay(STEP_TRANSITION_DELAY_MS);

      const screen = session.getScreen();
      expect(screen).toContain("hono");
    });

    it("should show no results message for unmatched interactive query", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await session.waitForText("Search Skills", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Type characters one at a time to avoid PTY buffering issues
      for (const char of "zzzzq") {
        session.write(char);
        await delay(KEYSTROKE_DELAY_MS);
      }
      await delay(STEP_TRANSITION_DELAY_MS);

      const screen = session.getScreen();
      expect(screen).toContain("No skills found");
    });

    it("should show result count in status bar", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await session.waitForText("Search Skills", WIZARD_LOAD_TIMEOUT_MS);

      const screen = session.getScreen();
      // StatusBar shows "N result(s)"
      expect(screen).toMatch(/\d+ results?/);
    });
  });

  describe("arrow key navigation", () => {
    it("should navigate to a different skill and allow selecting it", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await session.waitForText("Search Skills", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Select the first (focused) skill
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      const screenAfterFirstSelect = session.getScreen();
      expect(screenAfterFirstSelect).toContain("1 selected");

      // Navigate down to a different skill and select it too
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);

      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      const screenAfterSecondSelect = session.getScreen();

      // Having "2 selected" proves arrow down moved focus to a different skill
      expect(screenAfterSecondSelect).toContain("2 selected");
    });
  });

  describe("selection and import", () => {
    it("should show selected count and import hint after pressing SPACE", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await session.waitForText("Search Skills", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // SPACE toggles selection on the focused skill
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      const screenAfterSelect = session.getScreen();

      // StatusBar should show "1 selected" after selecting one skill
      expect(screenAfterSelect).toContain("1 selected");

      // Footer should now show the ENTER/import hint (only visible when hasSelection)
      expect(screenAfterSelect).toContain("import");
    });

    // BUG: Enter triggers import but copy() receives a relative skill.path from
    // the matrix instead of an absolute path, causing the import to fail
    it.fails("should import selected skill when pressing Enter", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await session.waitForText("Search Skills", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Select and import
      session.space();
      await delay(KEYSTROKE_DELAY_MS);
      session.enter();

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const rawOutput = session.getRawOutput();
      expect(rawOutput).toContain("Importing 1 skill");
    });
  });

  describe("scrolling with many results", () => {
    it("should allow navigating through all results with arrow keys", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await session.waitForText("Search Skills", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Navigate down through multiple results (the E2E source has 10 skills)
      for (let i = 0; i < 5; i++) {
        session.arrowDown();
        await delay(KEYSTROKE_DELAY_MS);
      }

      // Select the skill at the 6th position to prove we navigated there
      session.space();
      await delay(KEYSTROKE_DELAY_MS);

      const afterScrollScreen = session.getScreen();

      expect(afterScrollScreen).toMatch(/\d+ results?/);

      expect(afterScrollScreen).toContain("1 selected");
    });
  });

  describe("cancellation", () => {
    it("should exit cleanly when Ctrl+C is pressed", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await session.waitForText("Search Skills", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.ctrlC();

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });

    it("should exit cleanly when ESC is pressed", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search"], tempDir, {
        rows: 40,
        cols: 120,
        env: { CC_SOURCE: sourceDir },
      });

      await session.waitForText("Search Skills", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      session.escape();

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      // ESC triggers onCancel which calls exit(EXIT_CODES.CANCELLED)
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });
  });
});
