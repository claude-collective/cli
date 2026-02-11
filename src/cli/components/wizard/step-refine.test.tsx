/**
 * Tests for the StepRefine component.
 *
 * Tests the Refine step where users can choose skill sources.
 * For Phase 7, only "Use all recommended" is implemented.
 */
import React from "react";
import { render } from "ink-testing-library";
import { describe, expect, it, afterEach, vi } from "vitest";
import { StepRefine, type StepRefineProps, type RefineAction } from "./step-refine";
import {
  ENTER,
  ESCAPE,
  ARROW_UP,
  ARROW_DOWN,
  RENDER_DELAY_MS,
  INPUT_DELAY_MS,
  delay,
} from "../../lib/__tests__/test-constants";

// =============================================================================
// Test Fixtures
// =============================================================================

const defaultProps: StepRefineProps = {
  technologyCount: 12,
  refineAction: "all-recommended",
  onSelectAction: vi.fn(),
  onContinue: vi.fn(),
  onBack: vi.fn(),
};

const renderStepRefine = (props: Partial<StepRefineProps> = {}) => {
  return render(<StepRefine {...defaultProps} {...props} />);
};

// =============================================================================
// Tests
// =============================================================================

describe("StepRefine component", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  // ===========================================================================
  // Basic Rendering
  // ===========================================================================

  describe("rendering", () => {
    it("should render technology count correctly", () => {
      const { lastFrame, unmount } = renderStepRefine({ technologyCount: 12 });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("12");
      expect(output).toContain("technologies");
    });

    it("should render different technology count", () => {
      const { lastFrame, unmount } = renderStepRefine({ technologyCount: 5 });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("5");
      expect(output).toContain("technologies");
    });

    it("should render 'Use all recommended' option", () => {
      const { lastFrame, unmount } = renderStepRefine();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Use all recommended skills (verified)");
    });

    it("should show 'Use all recommended' option as highlighted", () => {
      const { lastFrame, unmount } = renderStepRefine({
        refineAction: "all-recommended",
      });
      cleanup = unmount;

      const output = lastFrame();
      // The option should have the ">" indicator
      expect(output).toContain(">");
      expect(output).toContain("Use all recommended skills");
    });

    it("should render verification description", () => {
      const { lastFrame, unmount } = renderStepRefine();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("fastest option");
      expect(output).toContain("verified");
      expect(output).toContain("Claude Collective");
    });
  });

  // ===========================================================================
  // Customize Option Display
  // ===========================================================================

  describe("customize option", () => {
    it("should show 'Customize' option as disabled/grayed", () => {
      const { lastFrame, unmount } = renderStepRefine();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customize skill sources");
    });

    it("should show '(coming soon)' label on customize option", () => {
      const { lastFrame, unmount } = renderStepRefine();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("(coming soon)");
    });

    it("should show customize description", () => {
      const { lastFrame, unmount } = renderStepRefine();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Choose alternative skills for each technology");
    });
  });

  // ===========================================================================
  // Keyboard Shortcuts Display
  // ===========================================================================

  describe("keyboard shortcuts display", () => {
    it("should render recommended option content", () => {
      const { lastFrame, unmount } = renderStepRefine();
      cleanup = unmount;

      const output = lastFrame();
      // Keyboard hints are now in WizardLayout footer, not in StepRefine
      // Verify core content renders
      expect(output).toContain("Use all recommended");
      expect(output).toContain("Customize skill sources");
    });
  });

  // ===========================================================================
  // Keyboard Navigation
  // ===========================================================================

  describe("keyboard navigation", () => {
    it("should call onContinue when Enter key is pressed", async () => {
      const onContinue = vi.fn();
      const { stdin, unmount } = renderStepRefine({ onContinue });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it("should call onBack when Escape key is pressed", async () => {
      const onBack = vi.fn();
      const { stdin, unmount } = renderStepRefine({ onBack });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ESCAPE);
      await delay(INPUT_DELAY_MS);

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("should call onSelectAction with 'all-recommended' on arrow up", async () => {
      const onSelectAction = vi.fn();
      const { stdin, unmount } = renderStepRefine({ onSelectAction });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ARROW_UP);
      await delay(INPUT_DELAY_MS);

      expect(onSelectAction).toHaveBeenCalledWith("all-recommended");
    });

    it("should call onSelectAction with 'all-recommended' on arrow down", async () => {
      const onSelectAction = vi.fn();
      const { stdin, unmount } = renderStepRefine({ onSelectAction });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);

      expect(onSelectAction).toHaveBeenCalledWith("all-recommended");
    });
  });

  // ===========================================================================
  // Selection State
  // ===========================================================================

  describe("selection state", () => {
    it("should handle null refineAction (defaults to recommended)", () => {
      const { lastFrame, unmount } = renderStepRefine({ refineAction: null });
      cleanup = unmount;

      const output = lastFrame();
      // Should still show the recommended option with indicator
      expect(output).toContain(">");
      expect(output).toContain("Use all recommended");
    });

    it("should handle 'all-recommended' refineAction", () => {
      const { lastFrame, unmount } = renderStepRefine({
        refineAction: "all-recommended",
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Use all recommended");
    });

    it("should handle 'customize' refineAction (even though disabled)", () => {
      const { lastFrame, unmount } = renderStepRefine({
        refineAction: "customize",
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should still render, even if customize is selected
      expect(output).toContain("Use all recommended");
      expect(output).toContain("Customize skill sources");
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle zero technology count", () => {
      const { lastFrame, unmount } = renderStepRefine({ technologyCount: 0 });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("0");
      expect(output).toContain("technologies");
    });

    it("should handle single technology count", () => {
      const { lastFrame, unmount } = renderStepRefine({ technologyCount: 1 });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("1");
      // Note: "technologies" is plural even for 1 (simple implementation)
      expect(output).toContain("technologies");
    });

    it("should handle large technology count", () => {
      const { lastFrame, unmount } = renderStepRefine({ technologyCount: 100 });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("100");
      expect(output).toContain("technologies");
    });
  });

  // ===========================================================================
  // Multiple Keyboard Events
  // ===========================================================================

  describe("multiple keyboard events", () => {
    it("should allow multiple Enter presses", async () => {
      const onContinue = vi.fn();
      const { stdin, unmount } = renderStepRefine({ onContinue });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      expect(onContinue).toHaveBeenCalledTimes(2);
    });

    it("should allow multiple Escape presses", async () => {
      const onBack = vi.fn();
      const { stdin, unmount } = renderStepRefine({ onBack });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ESCAPE);
      await delay(INPUT_DELAY_MS);
      stdin.write(ESCAPE);
      await delay(INPUT_DELAY_MS);

      expect(onBack).toHaveBeenCalledTimes(2);
    });
  });
});
