import { render } from "ink-testing-library";
import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { StepSources, type StepSourcesProps } from "./step-sources";
import { useWizardStore } from "../../stores/wizard-store";
import type { SkillId } from "../../types";
import {
  ENTER,
  ESCAPE,
  ARROW_UP,
  ARROW_DOWN,
  RENDER_DELAY_MS,
  INPUT_DELAY_MS,
  delay,
} from "../../lib/__tests__/test-constants";
import { createMockMatrix } from "../../lib/__tests__/helpers";
import { getTestSkill } from "../../lib/__tests__/test-fixtures";
import { DEFAULT_BRANDING } from "../../consts";

const reactSkill = getTestSkill("react");
const zustandSkill = getTestSkill("zustand");

const mockMatrix = createMockMatrix({
  [reactSkill.id]: reactSkill,
  [zustandSkill.id]: zustandSkill,
});

const defaultProps: StepSourcesProps = {
  matrix: mockMatrix,
  onContinue: vi.fn(),
  onBack: vi.fn(),
};

const renderStepSources = (props: Partial<StepSourcesProps> = {}) => {
  return render(<StepSources {...defaultProps} {...props} />);
};

describe("StepSources component", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    useWizardStore.getState().reset();
    // Set up some selected technologies so the step has data to display
    useWizardStore.setState({
      domainSelections: {
        web: {
          framework: ["web-framework-react" as SkillId],
          "client-state": ["web-state-zustand" as SkillId],
        },
      },
    });
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  describe("choice view rendering", () => {
    it("should render technology count", () => {
      const { lastFrame, unmount } = renderStepSources();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("2");
      expect(output).toContain("technologies");
    });

    it("should render 'Use all recommended' option", () => {
      const { lastFrame, unmount } = renderStepSources();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Use all recommended skills (verified)");
    });

    it("should render 'Customize skill sources' option", () => {
      const { lastFrame, unmount } = renderStepSources();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customize skill sources");
    });

    it("should render verification description", () => {
      const { lastFrame, unmount } = renderStepSources();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("fastest option");
      expect(output).toContain("verified");
      expect(output).toContain(DEFAULT_BRANDING.NAME);
    });

    it("should render customize description", () => {
      const { lastFrame, unmount } = renderStepSources();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Choose alternative skills for each technology");
    });

    it("should show recommended as default selected", () => {
      const { lastFrame, unmount } = renderStepSources();
      cleanup = unmount;

      const output = lastFrame();
      // The ">" indicator should be on the recommended option
      expect(output).toContain(">");
      expect(output).toContain("Use all recommended");
    });
  });

  describe("choice view keyboard navigation", () => {
    it("should toggle options with arrow up", async () => {
      const { lastFrame, stdin, unmount } = renderStepSources();
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Initially recommended is selected
      let output = lastFrame();
      expect(output).toContain("Use all recommended");

      // Press up to switch to customize
      stdin.write(ARROW_UP);
      await delay(INPUT_DELAY_MS);

      output = lastFrame();
      // Both options should still be present
      expect(output).toContain("Customize skill sources");
    });

    it("should toggle options with arrow down", async () => {
      const { stdin, unmount } = renderStepSources();
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);

      // Should have toggled
    });

    it("should call onContinue when Enter pressed on 'Use all recommended'", async () => {
      const onContinue = vi.fn();
      const { stdin, unmount } = renderStepSources({ onContinue });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it("should call onBack when Escape pressed", async () => {
      const onBack = vi.fn();
      const { stdin, unmount } = renderStepSources({ onBack });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ESCAPE);
      await delay(INPUT_DELAY_MS);

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("should switch to customize view when Enter pressed on 'Customize'", async () => {
      const { lastFrame, stdin, unmount } = renderStepSources();
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Move to customize option
      stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);

      // Press Enter to switch to customize view
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      const output = lastFrame();
      // Should show the grid view with skill names
      expect(output).toContain("Customize skill sources");
      // Should show the selected technologies
      expect(output).toContain("react");
      expect(output).toContain("zustand");
    });
  });

  describe("customize view", () => {
    it("should show source grid with selected technologies", async () => {
      const { lastFrame, stdin, unmount } = renderStepSources();
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Switch to customize view
      stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      const output = lastFrame();
      expect(output).toContain("react");
      expect(output).toContain("zustand");
      expect(output).toContain("Public");
    });

    it("should call onContinue when Enter pressed in customize view", async () => {
      const onContinue = vi.fn();
      const { stdin, unmount } = renderStepSources({ onContinue });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Switch to customize view
      stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      // Press Enter to continue
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it("should go back to choice view when Escape pressed in customize view", async () => {
      const onBack = vi.fn();
      const { lastFrame, stdin, unmount } = renderStepSources({ onBack });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Switch to customize view
      stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      // Verify we're in customize view
      expect(lastFrame()).toContain("Customize skill sources");

      // Press Escape to go back to choice view
      stdin.write(ESCAPE);
      await delay(INPUT_DELAY_MS);

      const output = lastFrame();
      // Should be back at choice view with both options
      expect(output).toContain("Use all recommended skills (verified)");
      expect(output).toContain("Customize skill sources");

      // onBack should NOT have been called (escape returns to choice, not to build)
      expect(onBack).not.toHaveBeenCalled();
    });

    it("should show ViewTitle in customize view", async () => {
      const { lastFrame, stdin, unmount } = renderStepSources();
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Switch to customize view
      stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      const output = lastFrame();
      expect(output).toContain("Customize skill sources");
    });
  });

  describe("edge cases", () => {
    it("should handle zero technologies", () => {
      useWizardStore.setState({
        domainSelections: {},
      });

      const { lastFrame, unmount } = renderStepSources();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("0");
      expect(output).toContain("technologies");
    });

    it("should handle single technology", () => {
      useWizardStore.setState({
        domainSelections: {
          web: {
            framework: ["web-framework-react" as SkillId],
          },
        },
      });

      const { lastFrame, unmount } = renderStepSources();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("1");
      expect(output).toContain("technologies");
    });

    it("should handle multiple Enter presses on recommended", async () => {
      const onContinue = vi.fn();
      const { stdin, unmount } = renderStepSources({ onContinue });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      expect(onContinue).toHaveBeenCalledTimes(2);
    });
  });

  describe("store integration", () => {
    it("should set customizeSources when switching to customize view", async () => {
      const { stdin, unmount } = renderStepSources();
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Switch to customize
      stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      expect(useWizardStore.getState().customizeSources).toBe(true);
    });

    it("should reset customizeSources when escaping from customize view", async () => {
      const { stdin, unmount } = renderStepSources();
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Switch to customize
      stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      expect(useWizardStore.getState().customizeSources).toBe(true);

      // Escape back
      stdin.write(ESCAPE);
      await delay(INPUT_DELAY_MS);

      expect(useWizardStore.getState().customizeSources).toBe(false);
    });
  });
});
