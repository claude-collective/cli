import { BaseStep } from "../base-step.js";
import { STEP_TEXT, TIMEOUTS } from "../constants.js";
import { AgentsStep } from "./agents-step.js";
import { BuildStep } from "./build-step.js";

export class SourcesStep extends BaseStep {
  /** Wait for sources step to be ready. */
  async waitForReady(): Promise<void> {
    await this.screen.waitForText(STEP_TEXT.SOURCES, TIMEOUTS.WIZARD_LOAD);
    await this.waitForStableRender();
  }

  /** Accept defaults and advance to agents step. */
  async acceptDefaults(): Promise<AgentsStep> {
    await this.waitForReady();
    await this.pressEnter();
    return new AgentsStep(this.session, this.projectDir);
  }

  /** Set all sources to local (press "l"). */
  async setAllLocal(): Promise<void> {
    await this.pressKey("l");
  }

  /** Set all sources to plugin (press "p"). */
  async setAllPlugin(): Promise<void> {
    await this.pressKey("p");
  }

  /** Toggle the focused source (Space). */
  async toggleFocusedSource(): Promise<void> {
    await this.pressSpace();
  }

  /** Open settings overlay (press "s"). */
  async openSettings(): Promise<void> {
    await this.pressKey("s");
  }

  /** Close settings overlay (Escape within settings). */
  async closeSettings(): Promise<void> {
    await this.pressEscape();
  }

  /** Press "a" to add a source (within settings overlay). */
  async pressAddSource(): Promise<void> {
    await this.pressKey("a");
  }

  /** Press backspace/DEL to delete a source (within settings overlay). */
  async pressDeleteSource(): Promise<void> {
    await this.pressKey("\x7f");
  }

  /** Go back to build step (Escape). */
  async goBack(): Promise<BuildStep> {
    await this.pressEscape();
    await this.screen.waitForText(STEP_TEXT.BUILD, TIMEOUTS.WIZARD_LOAD);
    return new BuildStep(this.session, this.projectDir);
  }

  /** Advance to agents step (Enter). */
  async advance(): Promise<AgentsStep> {
    await this.pressEnter();
    return new AgentsStep(this.session, this.projectDir);
  }
}
