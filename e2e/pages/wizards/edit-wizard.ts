import { TerminalSession } from "../../helpers/terminal-session.js";
import { createPermissionsFile } from "../../helpers/test-utils.js";
import { STEP_TEXT, TIMEOUTS } from "../constants.js";
import { TerminalScreen } from "../terminal-screen.js";
import { BuildStep } from "../steps/build-step.js";
import type { WizardResult } from "../wizard-result.js";

export type EditWizardOptions = {
  /** Project directory (required -- must have existing installation). */
  projectDir: string;
  /** Source directory for skill resolution. */
  source?: { sourceDir: string; tempDir: string };
  /** Terminal dimensions */
  cols?: number;
  rows?: number;
  /** Custom environment variables (merged with defaults). */
  env?: Record<string, string | undefined>;
  /** Extra CLI flags to pass (e.g., ["--agent-source", "/path"]). */
  extraArgs?: string[];
};

export class EditWizard {
  readonly build: BuildStep;

  private constructor(
    private session: TerminalSession,
    private projectDir: string,
    build: BuildStep,
  ) {
    this.build = build;
  }

  /** Launch the edit wizard. Returns an EditWizard with BuildStep ready. */
  static async launch(options: EditWizardOptions): Promise<EditWizard> {
    const args = ["edit"];
    if (options.source) {
      args.push("--source", options.source.sourceDir);
    }
    if (options.extraArgs) {
      args.push(...options.extraArgs);
    }

    // Create permissions file to prevent blocking prompt after recompile
    await createPermissionsFile(options.projectDir);

    const env: Record<string, string | undefined> = {
      AGENTSINC_SOURCE: undefined,
      ...options.env,
    };

    const session = new TerminalSession(args, options.projectDir, {
      cols: options.cols,
      rows: options.rows,
      env,
    });

    // Edit wizard opens directly to the build step.
    // Wait for the category counter ("X of 1") which only appears on the build step.
    // Cannot use STEP_TEXT.BUILD ("Framework") because the stack step's "Other Frameworks"
    // group label also matches, causing premature detection.
    const screen = new TerminalScreen(session);
    await screen.waitForText(STEP_TEXT.BUILD_CATEGORY_COUNT, TIMEOUTS.WIZARD_LOAD);
    await screen.waitForStableRender(TIMEOUTS.WIZARD_LOAD);

    const build = new BuildStep(session, options.projectDir);
    return new EditWizard(session, options.projectDir, build);
  }

  /**
   * Pass through the edit wizard without changing anything.
   * Build (all domains) -> Sources -> Agents -> Confirm
   */
  async passThrough(): Promise<WizardResult> {
    const sources = await this.build.passThroughAllDomains();
    const agents = await sources.acceptDefaults();
    const confirm = await agents.acceptDefaults("edit");
    return confirm.confirm();
  }

  /** Get the full output of the session. */
  getOutput(): string {
    return this.session.getFullOutput();
  }

  /** Get the raw PTY output. */
  getRawOutput(): string {
    return this.session.getRawOutput();
  }

  /** Wait for the process to exit and return exit code. */
  async waitForExit(timeoutMs?: number): Promise<number> {
    return this.session.waitForExit(timeoutMs);
  }

  /** Abort the wizard with Ctrl+C. */
  abort(): void {
    this.session.ctrlC();
  }

  /** Destroy the session. */
  async destroy(): Promise<void> {
    await this.session.destroy();
  }
}
