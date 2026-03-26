import { BaseStep } from "../base-step.js";
import { STEP_TEXT } from "../constants.js";
import { DomainStep } from "./domain-step.js";

export class StackStep extends BaseStep {
  /** Wait for the stack step to be ready. */
  async waitForReady(timeout?: number): Promise<void> {
    await this.waitForStep(STEP_TEXT.STACK, timeout);
    await this.waitForStableRender(timeout);
  }

  /** Select the first stack in the list (Enter on default selection). */
  async selectFirstStack(): Promise<DomainStep> {
    await this.pressEnter();
    return new DomainStep(this.session, this.projectDir);
  }

  /** Select a stack by name. Scrolls cursor to it, then presses Enter. */
  async selectStack(stackName: string): Promise<DomainStep> {
    await this.navigateCursorToItem(stackName);
    await this.pressEnter();
    return new DomainStep(this.session, this.projectDir);
  }

  /** Select "Start from scratch" option by scrolling until the cursor is on it. */
  async selectScratch(): Promise<DomainStep> {
    await this.navigateCursorToItem(STEP_TEXT.START_FROM_SCRATCH);
    await this.pressEnter();
    return new DomainStep(this.session, this.projectDir);
  }

  /** Cancel the wizard from the stack step (Escape). */
  async cancel(): Promise<void> {
    await this.pressEscape();
  }

  /** Open help modal (press "?"). */
  async openHelp(): Promise<void> {
    await this.pressKey("?");
  }

  /** Close help modal (Escape). */
  async closeHelp(): Promise<void> {
    await this.pressEscape();
  }
}
