import type { TerminalSession } from "../helpers/terminal-session.js";
import { cleanupTempDir, delay } from "../helpers/test-utils.js";
import { INTERNAL_DELAYS, INTERNAL_RETRIES, STEP_TEXT } from "./constants.js";
import { BuildStep } from "./steps/build-step.js";
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

  /**
   * Press Enter on the currently focused dashboard option.
   * "Edit" is the default focused option (first in DASHBOARD_OPTIONS), so this
   * launches the edit wizard in the same PTY session via this.config.runCommand.
   * Waits for the edit wizard's build step to be ready and returns a BuildStep.
   *
   * Closed-loop retry: under contention, Ink's useInput handler on the dashboard
   * may not be mounted when Enter is pressed, dropping the keystroke silently.
   * We capture the output cursor before each press and poll for sentinels that
   * appear AFTER it, retrying up to INTERNAL_RETRIES.MAX_ATTEMPTS times. This
   * matches EditWizard.launch's post-condition sequence: BUILD_FOOTER, stable
   * render, then BUILD.
   */
  async selectEdit(): Promise<BuildStep> {
    let lastError: unknown;
    for (let i = 0; i < INTERNAL_RETRIES.MAX_ATTEMPTS; i++) {
      const cursor = this.screen.getRawCursor();
      this.session.enter();
      await this.delay(INTERNAL_DELAYS.STEP_TRANSITION);
      try {
        await this.screen.waitForTextAfter(
          STEP_TEXT.BUILD_FOOTER,
          cursor,
          INTERNAL_RETRIES.INTERVAL_MS,
        );
        await this.screen.waitForStableRender(INTERNAL_RETRIES.INTERVAL_MS);
        await this.screen.waitForTextAfter(STEP_TEXT.BUILD, cursor, INTERNAL_RETRIES.INTERVAL_MS);
        return new BuildStep(this.session, this.projectDir);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
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
