import { BaseStep } from "../base-step.js";
import { STEP_TEXT, TIMEOUTS } from "../constants.js";
import { SearchModal } from "./search-modal.js";
import { SourcesStep } from "./sources-step.js";

export class BuildStep extends BaseStep {
  /** Tracked grid position — row resets on domain change, col resets on Tab/DOWN */
  private gridRow = 0;
  private gridCol = 0;

  /** Advance current domain without changes (Enter). */
  async advanceDomain(): Promise<void> {
    await this.waitForStableRender();
    await this.pressEnter();
    this.gridRow = 0;
    this.gridCol = 0;
  }

  /**
   * Navigate to a skill by label in the grid and press Space.
   *
   * Parses the screen to find the skill's (row, col) position,
   * navigates DOWN to the target category (which resets col to 0),
   * then RIGHT to the target column.
   */
  async selectSkill(skillLabel: string): Promise<void> {
    const { row, col, totalRows } = this.findSkillGridPosition(skillLabel);

    // Navigate DOWN to target row (DOWN always resets col to 0)
    // Normalize gridRow first — it may exceed totalRows after navigateToNextCategory calls
    const currentRow = this.gridRow % totalRows;
    const downs = (row - currentRow + totalRows) % totalRows;
    for (let i = 0; i < downs; i++) {
      await this.pressArrowDown();
    }
    this.gridRow = row;
    this.gridCol = 0;

    // Navigate RIGHT to target column
    for (let i = 0; i < col; i++) {
      await this.pressArrowRight();
    }
    this.gridCol = col;

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

  /** Navigate to the next category within the current domain (Tab). */
  async navigateToNextCategory(): Promise<void> {
    await this.pressKey("\t");
    this.gridRow++;
    this.gridCol = 0;
    await this.waitForStableRender();
  }

  /** Toggle compatibility labels on focused skill (press "d"). */
  async toggleLabels(): Promise<void> {
    await this.pressKey("d");
  }

  /** Open the search modal (press "/"). */
  async openSearch(): Promise<SearchModal> {
    await this.pressKey("/");
    return new SearchModal(this.session, this.projectDir);
  }

  /** Toggle filter incompatible skills (press "f"). */
  async toggleFilterIncompatible(): Promise<void> {
    await this.pressKey("f");
    await this.waitForStableRender();
  }

  /** Go back to domain step (Escape). */
  async goBack(): Promise<void> {
    await this.pressEscape();
  }

  /**
   * Parse the screen to find a skill's grid position (row, col).
   *
   * Category headers are non-empty text lines without box-drawing chars,
   * immediately followed by a `┌` line. This pattern only matches skill
   * category headers — step tabs, domain tabs, and info panels don't have
   * text headers before their `┌` borders.
   */
  private findSkillGridPosition(label: string): { row: number; col: number; totalRows: number } {
    const output = this.getOutput();
    const lines = output.split("\n");

    // Find category headers: non-empty text lines without box-drawing chars,
    // immediately followed by a ┌ line.
    const categoryHeaders: number[] = [];
    for (let i = 0; i < lines.length - 1; i++) {
      const trimmed = lines[i].trim();
      if (
        trimmed.length > 0 &&
        !trimmed.includes("│") &&
        !trimmed.includes("┌") &&
        !trimmed.includes("└") &&
        !trimmed.includes("┐") &&
        !trimmed.includes("┘") &&
        !trimmed.includes("─") &&
        lines[i + 1]?.trimStart().startsWith("┌")
      ) {
        categoryHeaders.push(i);
      }
    }

    if (categoryHeaders.length === 0) {
      throw new Error(
        `findSkillGridPosition: no category headers found on screen.\n` +
          `Output:\n${this.getOutput()}`,
      );
    }

    // Find which category contains the label and its column position
    for (let row = 0; row < categoryHeaders.length; row++) {
      const headerIdx = categoryHeaders[row];
      const nextHeaderIdx =
        row + 1 < categoryHeaders.length ? categoryHeaders[row + 1] : lines.length;

      // Collect content lines (│ lines) within this category's range
      let colOffset = 0;
      for (let i = headerIdx + 1; i < nextHeaderIdx; i++) {
        if (!lines[i].includes("│")) continue;

        const segments = lines[i].split("│").filter((s) => s.trim().length > 0);
        const segIdx = segments.findIndex((s) => s.includes(label));
        if (segIdx !== -1) {
          return {
            row,
            col: colOffset + segIdx,
            totalRows: categoryHeaders.length,
          };
        }
        colOffset += segments.length;
      }
    }

    throw new Error(
      `findSkillGridPosition: "${label}" not found in any category.\n` +
        `Output:\n${this.getOutput()}`,
    );
  }
}
