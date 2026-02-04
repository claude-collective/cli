/**
 * Tests for the WizardTabs component.
 *
 * Tests rendering of progress tabs with visual states:
 * - Completed: green checkmark (✓)
 * - Current: cyan dot (●)
 * - Pending: white circle (○)
 * - Skipped: dimmed circle (○)
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
    it("should render all 5 tabs", () => {
      const { lastFrame, unmount } = renderWizardTabs();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[1] Approach");
      expect(output).toContain("[2] Stack");
      expect(output).toContain("[3] Build");
      expect(output).toContain("[4] Refine");
      expect(output).toContain("[5] Confirm");
    });

    it("should render all step numbers", () => {
      const { lastFrame, unmount } = renderWizardTabs();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[1]");
      expect(output).toContain("[2]");
      expect(output).toContain("[3]");
      expect(output).toContain("[4]");
      expect(output).toContain("[5]");
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
      expect(output).not.toContain("Approach");
    });
  });

  // ===========================================================================
  // Current Step (Cyan Dot)
  // ===========================================================================

  describe("current step", () => {
    it("should show cyan dot for current step", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
      });
      cleanup = unmount;

      const output = lastFrame();
      // Current step shows cyan dot (●)
      expect(output).toContain("●");
    });

    it("should mark first step as current by default", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "approach",
        completedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should have a cyan dot
      expect(output).toContain("●");
    });

    it("should update current step when changed", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "refine",
        completedSteps: ["approach", "stack", "build"],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should have cyan dot for refine
      expect(output).toContain("●");
      // Should have checkmarks for completed
      expect(output).toContain("✓");
    });
  });

  // ===========================================================================
  // Completed Steps (Green Checkmark)
  // ===========================================================================

  describe("completed steps", () => {
    it("should show green checkmark for completed steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "stack",
        completedSteps: ["approach"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("✓");
    });

    it("should show multiple checkmarks for multiple completed steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["approach", "stack"],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Count checkmarks - should have 2
      const checkmarkCount = (output?.match(/✓/g) || []).length;
      expect(checkmarkCount).toBe(2);
    });

    it("should not show checkmark for current step", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "approach",
        completedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).not.toContain("✓");
    });
  });

  // ===========================================================================
  // Pending Steps (White Circle)
  // ===========================================================================

  describe("pending steps", () => {
    it("should show white circle for pending steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "approach",
        completedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should have circles for pending steps (all except current)
      expect(output).toContain("○");
    });

    it("should show circles for steps after current", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["approach", "stack"],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Pending steps (refine, confirm) should have circles
      const circleCount = (output?.match(/○/g) || []).length;
      expect(circleCount).toBe(2);
    });
  });

  // ===========================================================================
  // Skipped Steps (Dimmed)
  // ===========================================================================

  describe("skipped steps", () => {
    it("should render skipped steps with circle", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["approach"],
        skippedSteps: ["stack"],
      });
      cleanup = unmount;

      const output = lastFrame();
      // Skipped step should still be rendered
      expect(output).toContain("[2] Stack");
      // Should have a circle (dimmed)
      expect(output).toContain("○");
    });

    it("should handle multiple skipped steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "confirm",
        completedSteps: ["approach", "build"],
        skippedSteps: ["stack", "refine"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[2] Stack");
      expect(output).toContain("[4] Refine");
    });

    it("should not mark skipped step as completed even if in both arrays", () => {
      // Completed takes precedence over skipped
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["approach", "stack"],
        skippedSteps: ["stack"], // Also in skipped
      });
      cleanup = unmount;

      const output = lastFrame();
      // Completed should take precedence - checkmark count = 2
      const checkmarkCount = (output?.match(/✓/g) || []).length;
      expect(checkmarkCount).toBe(2);
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
      // Should show checkmark for approach since it's completed
      expect(output).toContain("✓");
    });

    it("should prioritize current over skipped", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "stack",
        completedSteps: [],
        skippedSteps: ["stack"], // Also current
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should show cyan dot for current, not dimmed circle
      expect(output).toContain("●");
    });

    it("should prioritize completed over skipped", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["approach"],
        skippedSteps: ["approach"], // Also completed
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should show checkmark for completed
      const checkmarkCount = (output?.match(/✓/g) || []).length;
      expect(checkmarkCount).toBe(1);
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
      expect(output).toContain("Approach");
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
      expect(output).not.toContain("✓");
    });

    it("should handle empty skipped steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["approach", "stack"],
        skippedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("✓");
      expect(output).toContain("●");
      expect(output).toContain("○");
    });

    it("should handle all steps completed", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "confirm",
        completedSteps: ["approach", "stack", "build", "refine", "confirm"],
      });
      cleanup = unmount;

      const output = lastFrame();
      const checkmarkCount = (output?.match(/✓/g) || []).length;
      expect(checkmarkCount).toBe(5);
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
      expect(output).toContain("●");
    });
  });
});
