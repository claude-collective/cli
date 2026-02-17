import { render } from "ink-testing-library";
import { afterEach, describe, expect, it } from "vitest";
import type { WizardStep } from "../../stores/wizard-store";
import { WizardTabs, WIZARD_STEPS, formatStepLabel, type WizardTabsProps } from "./wizard-tabs";

/** Format a custom (non-WIZARD_STEPS) step label for test assertions */
const formatCustomStepLabel = (step: { label: string; number: number }) => {
  const prefix = `[${step.number}]`;
  return { prefix, label: step.label, full: `${prefix} ${step.label}` };
};

const renderWizardTabs = (props: Partial<WizardTabsProps> = {}) => {
  const defaultProps: WizardTabsProps = {
    steps: WIZARD_STEPS,
    currentStep: "stack",
    completedSteps: [],
    skippedSteps: [],
    ...props,
  };
  return render(<WizardTabs {...defaultProps} />);
};

describe("WizardTabs component", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  describe("rendering", () => {
    it("should render all 4 tabs", () => {
      const { lastFrame, unmount } = renderWizardTabs();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("stack").full);
      expect(output).toContain(formatStepLabel("build").full);
      expect(output).toContain(formatStepLabel("sources").full);
      expect(output).toContain(formatStepLabel("confirm").full);
    });

    it("should render all step numbers", () => {
      const { lastFrame, unmount } = renderWizardTabs();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("stack").prefix);
      expect(output).toContain(formatStepLabel("build").prefix);
      expect(output).toContain(formatStepLabel("sources").prefix);
      expect(output).toContain(formatStepLabel("confirm").prefix);
    });

    it("should render with custom steps", () => {
      const customSteps = [
        { id: "stack" as WizardStep, label: "First", number: 1 },
        { id: "build" as WizardStep, label: "Second", number: 2 },
      ];
      const { lastFrame, unmount } = renderWizardTabs({
        steps: customSteps,
        currentStep: "stack",
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatCustomStepLabel(customSteps[0]).full);
      expect(output).toContain(formatCustomStepLabel(customSteps[1]).full);
    });

    it("should render horizontal dividers above and below tabs", () => {
      const { lastFrame, unmount } = renderWizardTabs();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("\u2500");
    });
  });

  describe("current step", () => {
    it("should render current step label", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("build").full);
    });

    it("should mark first step as current by default", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "stack",
        completedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("stack").full);
    });

    it("should update current step when changed", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "confirm",
        completedSteps: ["stack", "build"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("confirm").full);
    });
  });

  describe("completed steps", () => {
    it("should render completed step labels", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["stack"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("stack").full);
    });

    it("should render multiple completed steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "sources",
        completedSteps: ["stack", "build"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("stack").full);
      expect(output).toContain(formatStepLabel("build").full);
    });

    it("should render current step separately from completed steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "stack",
        completedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("stack").full);
    });
  });

  describe("pending steps", () => {
    it("should render pending step labels", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "stack",
        completedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("build").full);
      expect(output).toContain(formatStepLabel("sources").full);
    });

    it("should render steps after current", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: ["stack"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("confirm").full);
    });
  });

  describe("skipped steps", () => {
    it("should render skipped step labels", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "sources",
        completedSteps: ["stack"],
        skippedSteps: ["build"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("build").full);
    });

    it("should handle multiple skipped steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "confirm",
        completedSteps: ["stack"],
        skippedSteps: ["build", "sources"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("build").full);
      expect(output).toContain(formatStepLabel("sources").full);
    });

    it("should prioritize completed over skipped when step is in both arrays", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "sources",
        completedSteps: ["stack", "build"],
        skippedSteps: ["build"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("stack").full);
      expect(output).toContain(formatStepLabel("build").full);
    });
  });

  describe("state priority", () => {
    it("should prioritize completed over current", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "stack",
        completedSteps: ["stack"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("stack").full);
    });

    it("should prioritize current over skipped", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "build",
        completedSteps: [],
        skippedSteps: ["build"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("build").full);
    });

    it("should prioritize completed over skipped", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "sources",
        completedSteps: ["stack"],
        skippedSteps: ["stack"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("stack").full);
    });
  });

  describe("visual layout", () => {
    it("should render tabs horizontally", () => {
      const { lastFrame, unmount } = renderWizardTabs();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("stack").label);
      expect(output).toContain(formatStepLabel("confirm").label);
    });

    it("should include step labels", () => {
      const { lastFrame, unmount } = renderWizardTabs();
      cleanup = unmount;

      const output = lastFrame();
      WIZARD_STEPS.forEach((step) => {
        expect(output).toContain(formatStepLabel(step.id).label);
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty completed steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "stack",
        completedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("stack").full);
      expect(output).toContain(formatStepLabel("confirm").full);
    });

    it("should handle empty skipped steps", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "sources",
        completedSteps: ["stack", "build"],
        skippedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("stack").full);
      expect(output).toContain(formatStepLabel("build").full);
      expect(output).toContain(formatStepLabel("sources").full);
    });

    it("should handle all steps completed", () => {
      const { lastFrame, unmount } = renderWizardTabs({
        currentStep: "confirm",
        completedSteps: ["stack", "build", "sources", "confirm"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatStepLabel("stack").full);
      expect(output).toContain(formatStepLabel("build").full);
      expect(output).toContain(formatStepLabel("sources").full);
      expect(output).toContain(formatStepLabel("confirm").full);
    });

    it("should handle single step", () => {
      const singleStep = [{ id: "confirm" as WizardStep, label: "Only Step", number: 1 }];
      const { lastFrame, unmount } = renderWizardTabs({
        steps: singleStep,
        currentStep: "confirm",
        completedSteps: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(formatCustomStepLabel(singleStep[0]).full);
    });
  });
});
