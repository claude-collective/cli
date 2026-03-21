import type { TerminalSession } from "../helpers/terminal-session.js";
import { cleanupTempDir, delay } from "../helpers/test-utils.js";
import { INTERNAL_DELAYS } from "./constants.js";
import { TerminalScreen } from "./terminal-screen.js";

/**
 * A wrapper for the dashboard mode of init (when project is already initialized).
 * The dashboard is NOT a wizard flow, so it has a simpler API.
 */
export class DashboardSession {
  private screen: TerminalScreen;

  constructor(
    private session: TerminalSession,
    readonly projectDir: string,
    private cleanupDirs: string[],
  ) {
    this.screen = new TerminalScreen(session);
  }

  private delay(ms: number): Promise<void> {
    return delay(ms);
  }

  /** Wait for specific text to appear. */
  async waitForText(text: string, timeoutMs: number): Promise<void> {
    await this.screen.waitForText(text, timeoutMs);
  }

  /** Get the full output. */
  getOutput(): string {
    return this.screen.getFullOutput();
  }

  /** Get the visible screen. */
  getScreen(): string {
    return this.screen.getScreen();
  }

  /** Press Escape. */
  escape(): void {
    this.session.escape();
  }

  /** Press Ctrl+C. */
  ctrlC(): void {
    this.session.ctrlC();
  }

  /** Navigate down (with delay for PTY processing). */
  async arrowDown(): Promise<void> {
    this.session.arrowDown();
    await this.delay(INTERNAL_DELAYS.KEYSTROKE);
  }

  /** Navigate up (with delay for PTY processing). */
  async arrowUp(): Promise<void> {
    this.session.arrowUp();
    await this.delay(INTERNAL_DELAYS.KEYSTROKE);
  }

  /** Wait for exit. */
  async waitForExit(timeoutMs?: number): Promise<number> {
    return this.session.waitForExit(timeoutMs);
  }

  /** Destroy the session and clean up temp dirs. */
  async destroy(): Promise<void> {
    await this.session.destroy();
    for (const dir of this.cleanupDirs) {
      await cleanupTempDir(dir);
    }
  }
}
