import type { TerminalSession } from "../helpers/terminal-session.js";
import { delay } from "../helpers/test-utils.js";
import { INTERNAL_DELAYS, INTERNAL_RETRIES, TIMEOUTS } from "./constants.js";
import { TerminalScreen } from "./terminal-screen.js";

export abstract class BaseStep {
  protected readonly screen: TerminalScreen;
  protected readonly defaultTimeout: number;

  constructor(
    protected readonly session: TerminalSession,
    protected readonly projectDir: string,
  ) {
    this.screen = new TerminalScreen(session);
    this.defaultTimeout = TIMEOUTS.WIZARD_LOAD;
  }

  protected async pressEnter(): Promise<void> {
    this.session.enter();
    await this.delay(INTERNAL_DELAYS.STEP_TRANSITION);
  }

  protected async pressSpace(): Promise<void> {
    this.session.space();
    await this.delay(INTERNAL_DELAYS.KEYSTROKE);
  }

  protected async pressKey(key: string): Promise<void> {
    this.session.write(key);
    await this.delay(INTERNAL_DELAYS.KEYSTROKE);
  }

  protected async pressEscape(): Promise<void> {
    this.session.escape();
    await this.delay(INTERNAL_DELAYS.KEYSTROKE);
  }

  protected async pressArrowDown(): Promise<void> {
    this.session.arrowDown();
    await this.delay(INTERNAL_DELAYS.KEYSTROKE);
  }

  protected async pressArrowUp(): Promise<void> {
    this.session.arrowUp();
    await this.delay(INTERNAL_DELAYS.KEYSTROKE);
  }

  protected async pressArrowRight(): Promise<void> {
    this.session.arrowRight();
    await this.delay(INTERNAL_DELAYS.KEYSTROKE);
  }

  protected async pressCtrlC(): Promise<void> {
    this.session.ctrlC();
    await this.delay(INTERNAL_DELAYS.KEYSTROKE);
  }

  /** Wait for an item to be visible on screen. Scrolls down looking for it, throws if not found. */
  protected async waitForItemVisible(label: string, maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const screen = this.screen.getFullOutput();
      if (screen.includes(label)) {
        // Found the label on screen. Now we need to check if the cursor is on it.
        // We can't easily determine cursor position, so we use a strategy:
        // look at the screen, and if the label appears, press down until we find
        // a line where the cursor indicator (>) is on the same line as the label.
        // For simplicity, since items are rendered with highlight, check if the
        // current screen shows the label — if so, it is accessible.
        return;
      }
      await this.pressArrowDown();
    }
    throw new Error(
      `waitForItemVisible: could not find "${label}" after ${maxAttempts} attempts.\n` +
        `Screen:\n${this.screen.getScreen()}`,
    );
  }

  /**
   * Navigate the cursor to a specific item by label.
   * Unlike waitForItemVisible (which just checks visibility), this method
   * moves the cursor until the focused line (marked with ❯) contains the label.
   */
  protected async navigateCursorToItem(label: string, maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const output = this.screen.getFullOutput();
      const lines = output.split("\n");
      const focusedLine = lines.find((l) => l.includes("❯"));
      if (focusedLine && focusedLine.includes(label)) {
        return;
      }
      await this.pressArrowDown();
    }
    throw new Error(
      `navigateCursorToItem: could not focus "${label}" after ${maxAttempts} attempts.\n` +
        `Screen:\n${this.screen.getScreen()}`,
    );
  }

  /** Wait for a specific step to be visible. */
  protected async waitForStep(stepText: string, timeout?: number): Promise<void> {
    await this.screen.waitForText(stepText, timeout ?? this.defaultTimeout);
  }

  /**
   * Cursor-anchored version of waitForStep. Waits for `stepText` to appear
   * in raw output AFTER `cursor`. Use when a previous wizard step may have
   * left identical text in scrollback (e.g. "API" or "Methodology" tab
   * labels rendered in the build step header for every domain).
   */
  protected async waitForStepAfter(
    stepText: string,
    cursor: number,
    timeout?: number,
  ): Promise<void> {
    await this.screen.waitForTextAfter(stepText, cursor, timeout ?? this.defaultTimeout);
  }

  /** Wait for stable render (footer visible). */
  protected async waitForStableRender(timeout?: number): Promise<void> {
    await this.screen.waitForStableRender(timeout ?? this.defaultTimeout);
  }

  /**
   * Cursor-anchored version of waitForStableRender. Waits for the footer
   * sentinel "select" to appear in raw output AFTER `cursor`. The footer
   * is present in every wizard step, so the non-anchored variant returns
   * instantly on scrollback residue.
   */
  protected async waitForStableRenderAfter(cursor: number, timeout?: number): Promise<void> {
    await this.screen.waitForStableRenderAfter(cursor, timeout ?? this.defaultTimeout);
  }

  /** Capture raw-output cursor for use with waitForStepAfter / waitForStableRenderAfter. */
  protected getRawCursor(): number {
    return this.screen.getRawCursor();
  }

  /**
   * Press Enter and wait for `nextStepText` to appear AFTER the snapshot cursor.
   *
   * Closed-loop retry: under parallel-suite contention, Ink's useInput handler
   * for the next step may not be mounted when the first Enter fires, dropping
   * the keystroke silently. We snapshot the cursor before each press and poll
   * for the sentinel post-cursor; if the sentinel does not appear within
   * INTERNAL_RETRIES.INTERVAL_MS we re-press. Mirrors DashboardSession.selectEdit.
   *
   * IMPORTANT: the sentinel must be text that is ONLY printed by the next
   * step's first frame — not text that also appears in the current step's
   * footer or tabs. Otherwise this helper returns prematurely on the Enter's
   * own repaint.
   */
  protected async pressEnterAndWaitFor(nextStepText: string): Promise<void> {
    let lastError: unknown;
    for (let i = 0; i < INTERNAL_RETRIES.MAX_ATTEMPTS; i++) {
      const cursor = this.getRawCursor();
      this.session.enter();
      await this.delay(INTERNAL_DELAYS.STEP_TRANSITION);
      try {
        await this.screen.waitForTextAfter(nextStepText, cursor, INTERNAL_RETRIES.INTERVAL_MS);
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  /** Get the full output including scrollback (for test assertions). */
  getOutput(): string {
    return this.screen.getFullOutput();
  }

  /** Get the visible screen only (for test assertions). */
  getScreen(): string {
    return this.screen.getScreen();
  }

  /** Abort the wizard with Ctrl+C. */
  async abort(): Promise<void> {
    await this.pressCtrlC();
  }

  /** Navigate down one item (arrow down). */
  async navigateDown(): Promise<void> {
    await this.pressArrowDown();
  }

  /** Navigate up one item (arrow up). */
  async navigateUp(): Promise<void> {
    await this.pressArrowUp();
  }

  /** Navigate right one item (arrow right). */
  async navigateRight(): Promise<void> {
    await this.pressArrowRight();
  }

  protected delay(ms: number): Promise<void> {
    return delay(ms);
  }
}
