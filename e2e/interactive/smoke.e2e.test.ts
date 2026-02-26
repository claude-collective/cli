import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { TerminalSession } from "../helpers/terminal-session.js";
import { ensureBinaryExists, EXIT_CODES } from "../helpers/test-utils.js";

/**
 * Smoke tests for the TerminalSession infrastructure.
 *
 * These verify that PTY spawning, xterm-headless screen reading,
 * waitForText polling, and cleanup all work correctly.
 */
describe("TerminalSession smoke tests", () => {
  let session: TerminalSession | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await session?.destroy();
    session = undefined;
  });

  it("should capture --help output via PTY", async () => {
    session = new TerminalSession(["--help"], process.cwd());

    await session.waitForText("USAGE");

    const screen = getScreen();

    expect(screen).toContain("agentsinc");
    expect(screen).toContain("TOPICS");
    expect(screen).toContain("compile");
    expect(screen).toContain("init");
  });

  it("should capture compile --help output via PTY", async () => {
    session = new TerminalSession(["compile", "--help"], process.cwd());

    await session.waitForText("USAGE");

    const screen = getScreen();

    expect(screen).toContain("compile");
    expect(screen).toContain("--output");
    expect(screen).toContain("--dry-run");
    expect(screen).toContain("--verbose");
  });

  it("should report exit code for non-interactive commands", async () => {
    session = new TerminalSession(["--help"], process.cwd());

    const exitCode = await session.waitForExit();

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it("should include scrollback in getFullOutput()", async () => {
    // Use small terminal to force scrollback
    session = new TerminalSession(["--help"], process.cwd(), { rows: 5 });

    await session.waitForText("TOPICS");

    const screen = getScreen();
    const fullOutput = session!.getFullOutput();

    // Full output includes scrollback -- it should contain text from the
    // beginning of the help output even though only 5 rows are visible
    expect(fullOutput).toContain("USAGE");
    expect(fullOutput).toContain("TOPICS");
    expect(fullOutput.length).toBeGreaterThanOrEqual(screen.length);
  });

  it("should capture all raw output including pre-render text", async () => {
    session = new TerminalSession(["--help"], process.cwd());
    await session.waitForText("TOPICS");

    const raw = session.getRawOutput();
    expect(raw).toContain("USAGE");
    expect(raw).toContain("TOPICS");
    expect(raw).toContain("compile");
  });

  // Helper: gets screen from the active session, failing fast if session is undefined
  function getScreen(): string {
    if (!session) throw new Error("No active session");
    return session.getScreen();
  }
});
