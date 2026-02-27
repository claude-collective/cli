import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  delay,
  runCLI,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  KEYSTROKE_DELAY_MS,
  EXIT_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

/**
 * E2E tests for the `search` command.
 *
 * The search command runs in two modes:
 *   - Interactive (no query arg or -i flag): renders an Ink search UI
 *   - Static (with query arg): prints a table of matching skills
 *
 * Interactive tests use CC_SOURCE env var to point to a local source,
 * avoiding network calls to the marketplace.
 *
 * These tests spawn the actual CLI binary via PTY (zero mocks).
 */
describe("search command", () => {
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

  describe("search --help", () => {
    it("should display help text with command description", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await runCLI(["search", "--help"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Search available skills");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("query");
    });
  });

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

  describe("static search with query argument", () => {
    it("should display a table of matching skills", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, stdout } = await runCLI(
        ["search", "react", "--source", sourceDir!],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("react");
      expect(stdout).toContain("Category");
      expect(stdout).toContain("Description");
    });

    it("should show no results message for unmatched query", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, combined } = await runCLI(
        ["search", "zzz-nonexistent-skill-xyz", "--source", sourceDir!],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("No skills found");
    });

    it("should filter results by category flag", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, stdout } = await runCLI(
        ["search", "framework", "-c", "web-framework", "--source", sourceDir!],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("react");
      expect(stdout).toContain("Category filter");
    });

    it("should only show skills matching the category filter", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      // Search for a broad term but filter to api-api category
      const { exitCode, stdout } = await runCLI(
        ["search", "framework", "-c", "api-api", "--source", sourceDir!],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // api-api category should show hono, not react
      expect(stdout).toContain("hono");
      expect(stdout).toContain("Category filter");
      // React is in web-framework, not api-api, so it should not appear
      expect(stdout).not.toContain("react");
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

  describe("--source flag in interactive mode", () => {
    // BUG: search interactive mode hardcodes sourceFlag: undefined instead of
    // passing the --source flag value to loadSkillsMatrixFromSource()
    // (src/cli/commands/search.tsx:174)
    it("should respect --source flag in interactive mode", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      session = new TerminalSession(["search", "--source", sourceDir!], tempDir, {
        rows: 40,
        cols: 120,
      });

      await session.waitForText("Search Skills", WIZARD_LOAD_TIMEOUT_MS);

      // If --source worked, the search would show skills from our E2E source
      // (which includes web-framework-react, web-testing-vitest, etc.)
      const screen = session.getScreen();
      expect(screen).toContain("react");
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
