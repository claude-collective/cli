import { BaseStep } from "../base-step.js";
import { STEP_TEXT, TIMEOUTS } from "../constants.js";
import { SearchModal } from "./search-modal.js";
import { SourcesStep } from "./sources-step.js";

export class BuildStep extends BaseStep {
  /** Advance current domain without changes (Enter). */
  async advanceDomain(): Promise<void> {
    await this.waitForStableRender();
    await this.pressEnter();
  }

  /** Toggle a skill by scrolling until it is visible and pressing Space. */
  async toggleSkill(skillLabel: string): Promise<void> {
    await this.waitForItemVisible(skillLabel);
    await this.pressSpace();
  }

  /** Navigate cursor to a skill by label, then toggle it with Space. */
  async selectSkill(skillLabel: string): Promise<void> {
    await this.navigateCursorToItem(skillLabel);
    await this.pressSpace();
  }

  /** Toggle the currently focused skill selection (Space). */
  async toggleFocusedSkill(): Promise<void> {
    await this.pressSpace();
  }

  /** Toggle scope on the currently focused skill (press "s"). */
  async toggleScopeOnFocusedSkill(): Promise<void> {
    await this.pressKey("s");
  }

  /**
   * Pass through all domains one by one, then advance to SourcesStep.
   * Expects Web, API, and Methodology domains (matches the standard E2E source).
   */
  async passThroughAllDomains(): Promise<SourcesStep> {
    // Web domain
    await this.screen.waitForText(STEP_TEXT.BUILD, TIMEOUTS.WIZARD_LOAD);
    await this.waitForStableRender();
    await this.pressEnter();

    // API domain
    await this.screen.waitForText(STEP_TEXT.DOMAIN_API, TIMEOUTS.WIZARD_LOAD);
    await this.waitForStableRender();
    await this.pressEnter();

    // Methodology domain
    await this.screen.waitForText(STEP_TEXT.DOMAIN_META, TIMEOUTS.WIZARD_LOAD);
    await this.waitForStableRender();
    await this.pressEnter();

    return new SourcesStep(this.session, this.projectDir);
  }

  /**
   * Pass through all domains dynamically — keeps pressing Enter until Sources step appears.
   * Use for non-standard sources (e.g., real marketplace) where domain count is unknown.
   */
  async passThroughAllDomainsGeneric(): Promise<SourcesStep> {
    await this.waitForStableRender();
    for (let i = 0; i < 10; i++) {
      await this.pressEnter();
      // Check if we've reached the sources step
      const output = this.screen.getFullOutput();
      if (output.includes(STEP_TEXT.SOURCES)) {
        return new SourcesStep(this.session, this.projectDir);
      }
      await this.waitForStableRender();
    }
    throw new Error(
      "passThroughAllDomainsGeneric: did not reach Sources step after 10 Enter presses",
    );
  }

  /**
   * Pass through scratch domains (Web, API, Mobile) one by one.
   * Web needs a skill selected (Space). API's required skill is auto-selected.
   * Mobile has no E2E source skills ("No categories to display"), just advance.
   */
  async passThroughScratchDomains(): Promise<SourcesStep> {
    // Web domain — select required skill
    await this.screen.waitForText(STEP_TEXT.DOMAIN_WEB, TIMEOUTS.WIZARD_LOAD);
    await this.waitForStableRender();
    await this.pressSpace();
    await this.pressEnter();

    // API domain — select required skill
    await this.screen.waitForText(STEP_TEXT.DOMAIN_API, TIMEOUTS.WIZARD_LOAD);
    await this.waitForStableRender();
    await this.pressSpace();
    await this.pressEnter();

    // Mobile domain — no skills in E2E source, just advance
    await this.screen.waitForText(STEP_TEXT.DOMAIN_MOBILE, TIMEOUTS.WIZARD_LOAD);
    await this.waitForStableRender();
    await this.pressEnter();

    return new SourcesStep(this.session, this.projectDir);
  }

  /**
   * Pass through Web and Methodology domains (when API is deselected).
   */
  async passThroughWebAndMethodologyDomains(): Promise<SourcesStep> {
    // Web domain
    await this.screen.waitForText(STEP_TEXT.BUILD, TIMEOUTS.WIZARD_LOAD);
    await this.waitForStableRender();
    await this.pressEnter();

    // Methodology domain
    await this.screen.waitForText(STEP_TEXT.DOMAIN_META, TIMEOUTS.WIZARD_LOAD);
    await this.waitForStableRender();
    await this.pressEnter();

    return new SourcesStep(this.session, this.projectDir);
  }

  /**
   * Advance through the current domain and go to SourcesStep.
   * Use when the project has only one domain.
   */
  async advanceToSources(): Promise<SourcesStep> {
    await this.waitForStableRender();
    await this.pressEnter();
    return new SourcesStep(this.session, this.projectDir);
  }

  /** Open the search modal (press "/"). */
  async openSearch(): Promise<SearchModal> {
    await this.pressKey("/");
    return new SearchModal(this.session, this.projectDir);
  }

  /** Go back to domain step (Escape). */
  async goBack(): Promise<void> {
    await this.pressEscape();
  }
}
