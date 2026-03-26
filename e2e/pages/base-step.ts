import type { TerminalSession } from "../helpers/terminal-session.js";
import { delay } from "../helpers/test-utils.js";
import { INTERNAL_DELAYS, TIMEOUTS } from "./constants.js";
import { TerminalScreen } from "./terminal-screen.js";

export abstract class BaseStep {
  protected readonly screen: TerminalScreen;

  constructor(
    protected readonly session: TerminalSession,
    protected readonly projectDir: string,
  ) {
    this.screen = new TerminalScreen(session);
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
    await this.screen.waitForText(stepText, timeout ?? TIMEOUTS.WIZARD_LOAD);
  }

  /** Wait for stable render (footer visible). */
  protected async waitForStableRender(timeout?: number): Promise<void> {
    await this.screen.waitForStableRender(timeout ?? TIMEOUTS.WIZARD_LOAD);
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
