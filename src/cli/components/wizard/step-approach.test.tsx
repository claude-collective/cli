import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StepApproach } from "./step-approach";
import { useWizardStore } from "../../stores/wizard-store";
import {
  ARROW_DOWN,
  ARROW_UP,
  ENTER,
  RENDER_DELAY_MS,
  delay,
} from "../../lib/__tests__/test-constants";

const SELECT_NAV_DELAY_MS = 100;

describe("StepApproach component", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    useWizardStore.getState().reset();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  describe("rendering", () => {
    it("should render approach options", () => {
      const { lastFrame, unmount } = render(<StepApproach />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Use a pre-built template");
      expect(output).toContain("Start from scratch");
    });

    it("should not render expert mode or install mode options (now global shortcuts)", () => {
      const { lastFrame, unmount } = render(<StepApproach />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).not.toContain("Expert Mode");
      expect(output).not.toContain("Install Mode");
    });
  });

  describe("navigation options", () => {
    it("should navigate to stack step when selecting template", async () => {
      const { stdin, unmount } = render(<StepApproach />);
      cleanup = unmount;

      // Wait for component to be ready
      await delay(RENDER_DELAY_MS);

      // First option should be "Use a pre-built template" (stack)
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { step, approach } = useWizardStore.getState();
      expect(step).toBe("stack");
      expect(approach).toBe("stack");
    });

    it("should navigate to stack step (domain selection) when selecting scratch", async () => {
      const { stdin, unmount } = render(<StepApproach />);
      cleanup = unmount;

      // Wait for component to be ready
      await delay(RENDER_DELAY_MS);

      // Navigate down to "Start from scratch"
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { step, approach } = useWizardStore.getState();
      expect(step).toBe("stack"); // Goes to stack step for domain selection
      expect(approach).toBe("scratch");
    });
  });

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

      const { step, approach } = useWizardStore.getState();
      expect(step).toBe("stack"); // Goes to stack step for domain selection
      expect(approach).toBe("scratch");
    });

    it("should navigate up through options", async () => {
      const { stdin, unmount } = render(<StepApproach />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate down then up
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_UP);
      await delay(SELECT_NAV_DELAY_MS);

      // Select (should be back to "Use a pre-built template")
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { step, approach } = useWizardStore.getState();
      expect(step).toBe("stack");
      expect(approach).toBe("stack");
    });
  });
});
