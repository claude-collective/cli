import type { TerminalSession } from "../../helpers/terminal-session.js";
import { BaseStep } from "../base-step.js";
import { STEP_TEXT, TIMEOUTS } from "../constants.js";
import { WizardResult } from "../wizard-result.js";

export class ConfirmStep extends BaseStep {
  constructor(
    session: TerminalSession,
    projectDir: string,
    private wizardType: "init" | "edit",
  ) {
    super(session, projectDir);
  }

  /** Wait for confirm step to be ready. */
  async waitForReady(): Promise<void> {
    await this.screen.waitForText(STEP_TEXT.CONFIRM, TIMEOUTS.WIZARD_LOAD);
  }

  /** Confirm and wait for completion. Returns WizardResult. */
  async confirm(): Promise<WizardResult> {
    await this.screen.waitForText(STEP_TEXT.CONFIRM, TIMEOUTS.WIZARD_LOAD);
    await this.waitForStableRender();
    await this.pressEnter();
    if (this.wizardType === "init") {
      await this.screen.waitForText(STEP_TEXT.INIT_SUCCESS, TIMEOUTS.INSTALL);
    } else {
      // Edit can produce "Plugin updated" or "Plugin unchanged"
      await this.screen.waitForEither(
        STEP_TEXT.EDIT_SUCCESS,
        STEP_TEXT.EDIT_UNCHANGED,
        TIMEOUTS.INSTALL,
      );
    }
    return new WizardResult(this.session, this.projectDir);
  }

  /** Go back from confirm step (Escape). */
  async goBack(): Promise<void> {
    await this.pressEscape();
  }

  /** Go back from confirm step to agents step (Escape + wait). */
  async goBackToAgents(): Promise<import("./agents-step.js").AgentsStep> {
    const { AgentsStep } = await import("./agents-step.js");
    await this.pressEscape();
    await this.screen.waitForText(STEP_TEXT.AGENTS, TIMEOUTS.WIZARD_LOAD);
    return new AgentsStep(this.session, this.projectDir);
  }
}
