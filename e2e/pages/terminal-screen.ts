import type { TerminalSession } from "../helpers/terminal-session.js";

const POLL_INTERVAL_MS = 50;

export class TerminalScreen {
  constructor(private session: TerminalSession) {}

  /** Auto-retrying wait for text in the full output (xterm buffer). */
  async waitForText(text: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (!this.session.getFullOutput().includes(text)) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `TerminalScreen: timeout waiting for "${text}" after ${timeoutMs}ms.\n` +
            `Screen:\n${this.session.getScreen()}\n` +
            `Full output:\n${this.session.getFullOutput()}`,
        );
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  /** Auto-retrying wait for text in raw PTY output (no xterm processing). */
  async waitForRawText(text: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (!this.session.getRawOutput().includes(text)) {
      if (Date.now() - start > timeoutMs) {
        const rawTail = this.session.getRawOutput().slice(-2000);
        throw new Error(
          `TerminalScreen: timeout waiting for "${text}" in raw output after ${timeoutMs}ms.\n` +
            `Raw output tail:\n${rawTail}`,
        );
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  /** Auto-retrying wait for either of two texts in the full output. */
  async waitForEither(textA: string, textB: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (
      !this.session.getFullOutput().includes(textA) &&
      !this.session.getFullOutput().includes(textB)
    ) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `TerminalScreen: timeout waiting for "${textA}" or "${textB}" after ${timeoutMs}ms.\n` +
            `Screen:\n${this.session.getScreen()}\n` +
            `Full output:\n${this.session.getFullOutput()}`,
        );
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  /** Wait for the wizard footer ("select") to render, indicating stable layout. */
  async waitForStableRender(timeoutMs: number): Promise<void> {
    await this.waitForText("select", timeoutMs);
  }

  /** Get the current visible screen (viewport only). */
  getScreen(): string {
    return this.session.getScreen();
  }

  /** Get all output including scrollback. */
  getFullOutput(): string {
    return this.session.getFullOutput();
  }

  /** Get raw PTY output with ANSI stripped. */
  getRawOutput(): string {
    return this.session.getRawOutput();
  }
}
