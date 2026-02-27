import { stripVTControlCharacters } from "node:util";
import pty from "@lydell/node-pty";
import { Terminal } from "@xterm/headless";
import treeKill from "tree-kill";
import { BIN_RUN } from "./test-utils.js";

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 40;
const POLL_INTERVAL_MS = 50;
const DEFAULT_TIMEOUT_MS = 10_000;
const CI_TIMEOUT_MS = 20_000;

function getDefaultTimeout(): number {
  return process.env.CI ? CI_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
}

export type TerminalSessionOptions = {
  cols?: number;
  rows?: number;
  env?: Record<string, string | undefined>;
};

/**
 * Wraps @lydell/node-pty + @xterm/headless to provide clean, assertion-friendly
 * screen reads for interactive CLI E2E tests.
 *
 * PTY output is piped into a headless xterm terminal emulator, which processes
 * all ANSI escape sequences (cursor movement, clearing, etc.) and maintains a
 * proper screen buffer. getScreen() returns exactly what the user would see.
 *
 * HOME is set to cwd by default to isolate tests from the user's real global
 * config (~/.claude-src/config.yaml). Tests that need a different HOME can
 * override via options.env.
 */
export class TerminalSession {
  private ptyProcess: pty.IPty;
  private xterm: Terminal;
  private rawChunks: string[] = [];
  private destroyed = false;
  private exitPromise: Promise<{ exitCode: number; signal?: number }>;

  constructor(args: string[], cwd: string, options?: TerminalSessionOptions) {
    const cols = options?.cols ?? DEFAULT_COLS;
    const rows = options?.rows ?? DEFAULT_ROWS;

    this.xterm = new Terminal({ allowProposedApi: true, cols, rows });

    this.ptyProcess = pty.spawn("node", [BIN_RUN, ...args], {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        HOME: cwd,
        ...options?.env,
        NO_COLOR: "1",
        FORCE_COLOR: "0",
      },
    });

    this.ptyProcess.onData((data) => {
      this.rawChunks.push(data);
      this.xterm.write(data);
    });

    this.exitPromise = new Promise((resolve) => {
      this.ptyProcess.onExit(({ exitCode, signal }) => {
        resolve({ exitCode, signal });
      });
    });
  }

  /** Reads the visible screen area (viewport only, no scrollback). */
  getScreen(): string {
    const buffer = this.xterm.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buffer.viewportY + this.xterm.rows; i++) {
      const line = buffer.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    return lines.join("\n").trimEnd();
  }

  /** Reads ALL output including scrollback above the viewport. */
  getFullOutput(): string {
    const buffer = this.xterm.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    return lines.join("\n").trimEnd();
  }

  /**
   * Returns ALL raw PTY data with ANSI codes stripped.
   * Unlike getScreen/getFullOutput (which reflect xterm's processed buffer),
   * this captures every byte the process wrote — including text that Ink later
   * overwrites in the terminal buffer.
   */
  getRawOutput(): string {
    return stripVTControlCharacters(this.rawChunks.join(""));
  }

  /**
   * Polls the full output until the given text appears, or throws on timeout.
   * Timeout is CI-aware: 20s in CI, 10s locally (overridable).
   */
  async waitForText(text: string, timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? getDefaultTimeout();
    const start = Date.now();

    while (!this.getFullOutput().includes(text)) {
      if (Date.now() - start > timeout) {
        throw new Error(
          `Timeout waiting for "${text}" after ${timeout}ms.\n` +
            `Screen:\n${this.getScreen()}\n` +
            `Full output:\n${this.getFullOutput()}`,
        );
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  /** Waits for the PTY process to exit. Returns the exit code. */
  async waitForExit(timeoutMs?: number): Promise<number> {
    const timeout = timeoutMs ?? getDefaultTimeout();
    const timeoutError = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Process did not exit within ${timeout}ms`)), timeout),
    );
    const { exitCode } = await Promise.race([this.exitPromise, timeoutError]);
    return exitCode;
  }

  write(data: string): void {
    this.ptyProcess.write(data);
  }

  enter(): void {
    this.write("\r");
  }

  arrowDown(): void {
    this.write("\x1b[B");
  }

  arrowUp(): void {
    this.write("\x1b[A");
  }

  arrowLeft(): void {
    this.write("\x1b[D");
  }

  arrowRight(): void {
    this.write("\x1b[C");
  }

  tab(): void {
    this.write("\t");
  }

  escape(): void {
    this.write("\x1b");
  }

  space(): void {
    this.write(" ");
  }

  ctrlC(): void {
    this.write("\x03");
  }

  /** Kills the PTY process tree and disposes the xterm instance. Safe to call multiple times. */
  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;

    await new Promise<void>((resolve) => {
      treeKill(this.ptyProcess.pid, "SIGKILL", () => resolve());
    });
    this.xterm.dispose();
  }
}
