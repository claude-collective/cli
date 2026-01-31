/**
 * Tests for the StepApproach wizard component.
 *
 * Tests rendering and keyboard navigation for approach selection.
 *
 * Note: Select component from @inkjs/ui requires an initial render delay
 * before accepting keyboard input to avoid render loops.
 */
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StepApproach } from "../../../components/wizard/step-approach";
import { useWizardStore } from "../../../stores/wizard-store";
import {
  ARROW_DOWN,
  ARROW_UP,
  ENTER,
  RENDER_DELAY_MS,
  delay,
} from "../test-constants";

// Delay between arrow key presses for Select component
const SELECT_NAV_DELAY_MS = 100;

// =============================================================================
// Tests
// =============================================================================

describe("StepApproach component", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    useWizardStore.getState().reset();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  // ===========================================================================
  // Rendering
  // ===========================================================================

  describe("rendering", () => {
    it("should render approach options", () => {
      const { lastFrame, unmount } = render(<StepApproach />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Use a pre-built template");
      expect(output).toContain("Start from scratch");
    });

    it("should render expert mode option", () => {
      const { lastFrame, unmount } = render(<StepApproach />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Expert Mode");
    });

    it("should render install mode option", () => {
      const { lastFrame, unmount } = render(<StepApproach />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Install Mode");
    });

    it("should show current install mode", () => {
      const { lastFrame, unmount } = render(<StepApproach />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Local");
    });

    it("should render question prompt", () => {
      const { lastFrame, unmount } = render(<StepApproach />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("How would you like to set up your stack?");
    });
  });

  // ===========================================================================
  // Navigation Options
  // ===========================================================================

  describe("navigation options", () => {
    it("should navigate to stack step when selecting template", async () => {
      const { stdin, unmount } = render(<StepApproach />);
      cleanup = unmount;

      // Wait for component to be ready
      await delay(RENDER_DELAY_MS);

      // First option should be "Use a pre-built template" (stack)
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { step } = useWizardStore.getState();
      expect(step).toBe("stack");
    });

    it("should navigate to category step when selecting scratch", async () => {
      const { stdin, unmount } = render(<StepApproach />);
      cleanup = unmount;

      // Wait for component to be ready
      await delay(RENDER_DELAY_MS);

      // Navigate down to "Start from scratch"
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { step } = useWizardStore.getState();
      expect(step).toBe("category");
    });
  });

  // ===========================================================================
  // Expert Mode Toggle
  // ===========================================================================

  describe("expert mode toggle", () => {
    it("should toggle expert mode when selected", async () => {
      const { stdin, unmount } = render(<StepApproach />);
      cleanup = unmount;

      // Wait for component to be ready
      await delay(RENDER_DELAY_MS);

      // Expert mode is the 3rd option
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ENTER);
      await delay(RENDER_DELAY_MS);

      const { expertMode } = useWizardStore.getState();
      expect(expertMode).toBe(true);
    });

    it("should stay on approach step after toggling expert mode", async () => {
      const { stdin, unmount } = render(<StepApproach />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to expert mode and select
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { step } = useWizardStore.getState();
      expect(step).toBe("approach");
    });

    it("should show expert mode status when enabled", () => {
      // Enable expert mode first
      useWizardStore.getState().toggleExpertMode();

      const { lastFrame, unmount } = render(<StepApproach />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Expert Mode is ON");
    });
  });

  // ===========================================================================
  // Install Mode Toggle
  // ===========================================================================

  describe("install mode toggle", () => {
    it("should toggle install mode when selected", async () => {
      const { stdin, unmount } = render(<StepApproach />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Install mode is the 4th option
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ENTER);
      await delay(RENDER_DELAY_MS);

      const { installMode } = useWizardStore.getState();
      expect(installMode).toBe("plugin");
    });

    it("should stay on approach step after toggling install mode", async () => {
      const { stdin, unmount } = render(<StepApproach />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { step } = useWizardStore.getState();
      expect(step).toBe("approach");
    });

    it("should show plugin mode when toggled", () => {
      // Enable plugin mode first
      useWizardStore.getState().toggleInstallMode();

      const { lastFrame, unmount } = render(<StepApproach />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Plugin");
    });
  });

  // ===========================================================================
  // Arrow Key Navigation
  // ===========================================================================

  describe("arrow key navigation", () => {
    it("should navigate down through options", async () => {
      const { stdin, unmount } = render(<StepApproach />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate down to second option
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);

      // Select (should be "Start from scratch")
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { step } = useWizardStore.getState();
      expect(step).toBe("category");
    });

    it("should navigate up through options", async () => {
      const { stdin, unmount } = render(<StepApproach />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate down twice then up once
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_UP);
      await delay(SELECT_NAV_DELAY_MS);

      // Select (should be "Start from scratch" - second option)
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { step } = useWizardStore.getState();
      expect(step).toBe("category");
    });
  });

  // ===========================================================================
  // State Persistence
  // ===========================================================================

  describe("state persistence", () => {
    it("should remember last selected approach for toggles", async () => {
      const { stdin, unmount } = render(<StepApproach />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Select expert mode (stays on page)
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ENTER);
      await delay(RENDER_DELAY_MS);

      const { lastSelectedApproach } = useWizardStore.getState();
      expect(lastSelectedApproach).toBe("__expert_mode__");
    });

    it("should clear last selected approach when navigating to stack", async () => {
      const { stdin, unmount } = render(<StepApproach />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Select template (navigates away)
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { lastSelectedApproach } = useWizardStore.getState();
      expect(lastSelectedApproach).toBeNull();
    });
  });
});
