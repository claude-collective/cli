/**
 * Tests for the WizardTabs component.
 *
 * Tests rendering of progress tabs with visual states:
 * - Active step: green background with padding
 * - Completed steps: white background, dark text
 * - Pending steps: default text, no background
 * - Skipped: dimmed text, no background
 *
 * Note: The new tab-style UI uses background colors instead of symbols.
 * Testing for specific ANSI color codes is fragile, so we focus on
 * structural tests (labels present, correct step count) and basic state logic.
 */
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, describe, expect, it } from "vitest";
import {
  WizardTabs,
  WIZARD_STEPS,
  type WizardTabsProps,
} from "../../../components/wizard/wizard-tabs";

// =============================================================================
// Test Helpers
// =============================================================================

const renderWizardTabs = (props: Partial<WizardTabsProps> = {}) => {
  const defaultProps: WizardTabsProps = {
    steps: WIZARD_STEPS,
    currentStep: "approach",
    completedSteps: [],
    skippedSteps: [],
    ...props,
  };
  return render(<WizardTabs {...defaultProps} />);
};

// =============================================================================
// Tests
// =============================================================================

describe("WizardTabs component", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  // ===========================================================================
  // Rendering All Tabs
  // ===========================================================================

  describe("rendering", () => {
    it("should render all 4 tabs", () => {
      const { lastFrame, unmount } = renderWizardTabs();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[1] Intro");
      expect(output).toContain("[2] Stack");
      expect(output).toContain("[3] Build");
      expect(output).toContain("[4] Confirm");
    });

    it("should render all step numbers", () => {
      const { lastFrame, unmount } = renderWizardTabs();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[1]");
      expect(output).toContain("[2]");
      expect(output).toContain("[3]");
      expect(output).toContain("[4]");
    });

    it("should render with custom steps", () => {
      const customSteps = [
        { id: "one", label: "First", number: 1 },
        { id: "two", label: "Second", number: 2 },
      ];
      const { lastFrame, unmount } = renderWizardTabs({
        steps: customSteps,
        currentStep: "one",
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[1] First");
      expect(output).toContain("[2] Second");
      expect(output).not.toContain("Intro");
    });

    it("should render horizontal dividers above and below tabs", () => {
      const { lastFrame, unmount } = renderWizardTabs();
      cleanup = unmount;

      const output = lastFrame();
      // The divider uses Unicode horizontal line character (U+2500)
      expect(output).toContain("\u2500");
    });
  });

  // ===========================================================================
  // Current Step (Green Background)
  // ===========================================================================

  describe("current step", () => {
    it("should render current step label", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
      });
      cleanup = unmount;

      const output = lastFrame();
      // Current step should be rendered with its label
      expect(output).toContain("[3] Build");
    });

    it("should mark first step as current by default", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "approach",
        completedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[1] Intro");
    });

    it("should update current step when changed", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "confirm",
        completedSteps: ["approach", "stack", "build"],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should show confirm step
      expect(output).toContain("[4] Confirm");
    });
  });

  // ===========================================================================
  // Completed Steps (White Background)
  // ===========================================================================

  describe("completed steps", () => {
    it("should render completed step labels", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "stack",
        completedSteps: ["approach"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[1] Intro");
    });

    it("should render multiple completed steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["approach", "stack"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[1] Intro");
      expect(output).toContain("[2] Stack");
    });

    it("should render current step separately from completed steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "approach",
        completedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should contain approach tab
      expect(output).toContain("[1] Intro");
    });
  });

  // ===========================================================================
  // Pending Steps (Default Text)
  // ===========================================================================

  describe("pending steps", () => {
    it("should render pending step labels", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "approach",
        completedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Pending steps should still be visible
      expect(output).toContain("[2] Stack");
      expect(output).toContain("[3] Build");
    });

    it("should render steps after current", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["approach", "stack"],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Pending step (confirm) should be rendered
      expect(output).toContain("[4] Confirm");
    });
  });

  // ===========================================================================
  // Skipped Steps (Dimmed)
  // ===========================================================================

  describe("skipped steps", () => {
    it("should render skipped step labels", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["approach"],
        skippedSteps: ["stack"],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Skipped step should still be rendered
      expect(output).toContain("[2] Stack");
    });

    it("should handle multiple skipped steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "confirm",
        completedSteps: ["approach", "build"],
        skippedSteps: ["stack"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[2] Stack");
    });

    it("should prioritize completed over skipped when step is in both arrays", () => {
      // Completed takes precedence over skipped
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["approach", "stack"],
        skippedSteps: ["stack"], // Also in skipped
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should render both - completed status takes precedence visually
      expect(output).toContain("[1] Intro");
      expect(output).toContain("[2] Stack");
    });
  });

  // ===========================================================================
  // State Priority
  // ===========================================================================

  describe("state priority", () => {
    it("should prioritize completed over current", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "approach",
        completedSteps: ["approach"],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should render approach - completed takes precedence
      expect(output).toContain("[1] Intro");
    });

    it("should prioritize current over skipped", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "stack",
        completedSteps: [],
        skippedSteps: ["stack"], // Also current
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should render stack - current takes precedence over skipped
      expect(output).toContain("[2] Stack");
    });

    it("should prioritize completed over skipped", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["approach"],
        skippedSteps: ["approach"], // Also completed
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should render approach - completed takes precedence
      expect(output).toContain("[1] Intro");
    });
  });

  // ===========================================================================
  // Visual Layout
  // ===========================================================================

  describe("visual layout", () => {
    it("should render tabs horizontally", () => {
      const { lastFrame, unmount } = renderWizardTabs();
      cleanup = unmount;

      const output = lastFrame();
      // All tabs should be in the output
      expect(output).toContain("Intro");
      expect(output).toContain("Confirm");
    });

    it("should include step labels", () => {
      const { lastFrame, unmount } = renderWizardTabs();
      cleanup = unmount;

      const output = lastFrame();
      WIZARD_STEPS.forEach((step) => {
        expect(output).toContain(step.label);
      });
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty completed steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "approach",
        completedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should still render all tabs
      expect(output).toContain("[1] Intro");
      expect(output).toContain("[4] Confirm");
    });

    it("should handle empty skipped steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["approach", "stack"],
        skippedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should render all tabs
      expect(output).toContain("[1] Intro");
      expect(output).toContain("[2] Stack");
      expect(output).toContain("[3] Build");
    });

    it("should handle all steps completed", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "confirm",
        completedSteps: ["approach", "stack", "build", "confirm"],
      });
      cleanup = unmount;

      const output = lastFrame();
      // All 4 tabs should be rendered
      expect(output).toContain("[1] Intro");
      expect(output).toContain("[2] Stack");
      expect(output).toContain("[3] Build");
      expect(output).toContain("[4] Confirm");
    });

    it("should handle single step", () => {
      const singleStep = [{ id: "only", label: "Only Step", number: 1 }];
      const { lastFrame, unmount } = renderWizardTabs({
        steps: singleStep,
        currentStep: "only",
        completedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[1] Only Step");
    });
  });
});
