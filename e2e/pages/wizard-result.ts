import type { TerminalSession } from "../helpers/terminal-session.js";
import { TIMEOUTS } from "./constants.js";

export type ProjectHandle = {
  dir: string;
};

export class WizardResult {
  readonly project: ProjectHandle;

  constructor(
    private session: TerminalSession,
    projectDir: string,
  ) {
    this.project = { dir: projectDir };
  }

  /** Get the exit code (waits for process to exit). */
  get exitCode(): Promise<number> {
    return this.session.waitForExit(TIMEOUTS.EXIT_WAIT);
  }

  /** Get the full output of the session. */
  get output(): string {
    return this.session.getFullOutput();
  }

  /** Get the raw PTY output. */
  get rawOutput(): string {
    return this.session.getRawOutput();
  }

  /** Destroy the session (cleanup). */
  async destroy(): Promise<void> {
    await this.session.destroy();
  }
}
