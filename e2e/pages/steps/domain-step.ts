import { BaseStep } from "../base-step.js";
import { STEP_TEXT, TIMEOUTS } from "../constants.js";
import { BuildStep } from "./build-step.js";
import { StackStep } from "./stack-step.js";

export class DomainStep extends BaseStep {
  /** Accept the default domain selection (Enter). Returns BuildStep. */
  async acceptDefaults(): Promise<BuildStep> {
    await this.waitForStableRender();
    await this.pressEnter();
    return new BuildStep(this.session, this.projectDir);
  }

  /**
   * Toggle a domain by name using Space.
   * Navigates the cursor to the line containing the domain label,
   * then presses Space to toggle it.
   */
  async toggleDomain(domainName: string): Promise<void> {
    await this.navigateCursorToItem(domainName);
    await this.pressSpace();
  }

  /** Advance to build step after toggling domains. */
  async advance(): Promise<BuildStep> {
    await this.pressEnter();
    return new BuildStep(this.session, this.projectDir);
  }

  /**
   * Deselect all currently selected domains.
   * Walks through the entire domain list, unchecking selected items.
   * Uses checkbox markers ([✓]) to detect selected state.
   */
  async deselectAll(): Promise<void> {
    // Navigate through the full list, toggling selected items.
    // The domain list is short (max 5 items), so iterating from
    // top to bottom and toggling any checked items covers all cases.
    const maxItems = 6;
    for (let i = 0; i < maxItems; i++) {
      const output = this.getOutput();
      // Check if the currently focused item has a checkmark
      // The focused item has "❯" prefix
      const lines = output.split("\n");
      const focusedLine = lines.find((l) => l.includes("❯"));
      if (focusedLine && focusedLine.includes("✓")) {
        await this.pressSpace();
      }
      await this.pressArrowDown();
    }
  }

  /** Go back to stack selection (Escape). */
  async goBack(): Promise<StackStep> {
    await this.pressEscape();
    await this.screen.waitForText(STEP_TEXT.STACK, TIMEOUTS.WIZARD_LOAD);
    return new StackStep(this.session, this.projectDir);
  }
}
