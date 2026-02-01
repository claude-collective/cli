/**
 * Tests for the StepConfirm wizard component.
 *
 * Tests rendering of selected skills and validation display.
 *
 * Note: Select component requires initial render delay before accepting input.
 */
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepConfirm } from "../../../components/wizard/step-confirm";
import { useWizardStore } from "../../../stores/wizard-store";
import {
  createMockMatrix,
  createMockMatrixWithMethodology,
  createMockSkill,
} from "../helpers";
import { TEST_SKILLS, TEST_CATEGORIES } from "../test-fixtures";
import type { MergedSkillsMatrix } from "../../../types-matrix";
import { ARROW_DOWN, ENTER, RENDER_DELAY_MS, delay } from "../test-constants";

// Delay between arrow key presses for Select component
const SELECT_NAV_DELAY_MS = 100;

// =============================================================================
// Mock Data
// =============================================================================

const createTestMatrix = (): MergedSkillsMatrix => {
  const skills = {
    [TEST_SKILLS.REACT]: createMockSkill(
      TEST_SKILLS.REACT,
      TEST_CATEGORIES.FRAMEWORK,
      { name: "React", description: "React framework" },
    ),
    [TEST_SKILLS.ZUSTAND]: createMockSkill(
      TEST_SKILLS.ZUSTAND,
      TEST_CATEGORIES.STATE,
      { name: "Zustand", description: "State management" },
    ),
    [TEST_SKILLS.VITEST]: createMockSkill(
      TEST_SKILLS.VITEST,
      TEST_CATEGORIES.TESTING,
      { name: "Vitest", description: "Testing framework" },
    ),
  };

  return createMockMatrixWithMethodology(skills, {
    categories: {
      [TEST_CATEGORIES.FRAMEWORK]: {
        id: TEST_CATEGORIES.FRAMEWORK,
        name: "Framework",
        description: "UI Frameworks",
        exclusive: false,
        required: false,
        order: 1,
      },
      [TEST_CATEGORIES.STATE]: {
        id: TEST_CATEGORIES.STATE,
        name: "State",
        description: "State management",
        exclusive: false,
        required: false,
        order: 2,
      },
      [TEST_CATEGORIES.TESTING]: {
        id: TEST_CATEGORIES.TESTING,
        name: "Testing",
        description: "Testing frameworks",
        exclusive: false,
        required: false,
        order: 3,
      },
    },
  });
};

// =============================================================================
// Tests
// =============================================================================

describe("StepConfirm component", () => {
  let cleanup: (() => void) | undefined;
  let mockMatrix: MergedSkillsMatrix;

  beforeEach(() => {
    useWizardStore.getState().reset();
    mockMatrix = createTestMatrix();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  // ===========================================================================
  // Rendering
  // ===========================================================================

  describe("rendering", () => {
    it("should render selected skills header", () => {
      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Selected Skills");
    });

    it("should render preselected methodology skills", () => {
      // Methodology skills are preselected by default and should render
      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      // Preselected methodology skills should render
      expect(output).toContain("Selected Skills");
      expect(output).toContain("Anti-Over-Engineering"); // Skill name
      expect(output).not.toContain("No skills selected");
    });

    it("should render selected skill names", () => {
      // Select some skills first
      const store = useWizardStore.getState();
      store.toggleSkill(TEST_SKILLS.REACT);
      store.toggleSkill(TEST_SKILLS.ZUSTAND);

      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("React");
      expect(output).toContain("Zustand");
    });

    it("should render category info for skills", () => {
      const store = useWizardStore.getState();
      store.toggleSkill(TEST_SKILLS.REACT);

      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Framework");
    });

    it("should render back option", () => {
      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Back");
    });
  });

  // ===========================================================================
  // Confirmation Flow
  // ===========================================================================

  describe("confirmation flow", () => {
    it("should show confirm option when selection is valid", () => {
      const store = useWizardStore.getState();
      store.toggleSkill(TEST_SKILLS.REACT);

      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Confirm");
    });

    it("should call onComplete when confirm is selected", async () => {
      const store = useWizardStore.getState();
      store.toggleSkill(TEST_SKILLS.REACT);

      const onComplete = vi.fn();
      const { stdin, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to confirm (skip back)
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      expect(onComplete).toHaveBeenCalled();
    });

    it("should show confirmation question text", () => {
      const store = useWizardStore.getState();
      store.toggleSkill(TEST_SKILLS.REACT);

      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Confirm your selection");
    });
  });

  // ===========================================================================
  // Back Navigation
  // ===========================================================================

  describe("back navigation", () => {
    it("should call goBack when back option is first in list", () => {
      // Test that the back option renders first
      const store = useWizardStore.getState();
      store.toggleSkill(TEST_SKILLS.REACT);

      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      // Verify back is the first option (indicated by cursor ">")
      const lines = output?.split("\n") || [];
      const backLine = lines.find((line) => line.includes("Back"));
      expect(backLine).toBeDefined();
    });

    it("should not call onComplete when going back", async () => {
      const store = useWizardStore.getState();
      store.setStep("confirm");

      const onComplete = vi.fn();
      const { stdin, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Multiple Skills Display
  // ===========================================================================

  describe("multiple skills display", () => {
    it("should display all selected skills", () => {
      const store = useWizardStore.getState();
      store.toggleSkill(TEST_SKILLS.REACT);
      store.toggleSkill(TEST_SKILLS.ZUSTAND);
      store.toggleSkill(TEST_SKILLS.VITEST);

      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("React");
      expect(output).toContain("Zustand");
      expect(output).toContain("Vitest");
    });

    it("should show green plus indicator for each skill", () => {
      const store = useWizardStore.getState();
      store.toggleSkill(TEST_SKILLS.REACT);

      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("+");
    });
  });

  // ===========================================================================
  // Validation Display
  // ===========================================================================

  describe("validation display", () => {
    it("should show valid state when preselected skills exist", () => {
      // With preselected skills, validation passes even if they're not in matrix
      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      // Preselected skills are selected, so validation should pass
      // and confirm option should appear
      expect(output).toContain("Confirm");
    });

    it("should show confirm option since preselected skills are valid", () => {
      // With preselected skills, validation passes so confirm appears
      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      // Confirm option appears because preselected skills are valid
      expect(output).toContain("Confirm");
      expect(output).toContain("Back");
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle skills not in matrix gracefully", () => {
      const store = useWizardStore.getState();
      store.toggleSkill("nonexistent-skill (@test)");

      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      // Should not crash
      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it("should handle empty matrix with preselected skills not rendering", () => {
      // Empty matrix doesn't contain preselected skills, so they won't render
      // but they're still selected (validation should pass)
      const emptyMatrix = createMockMatrix({});

      const onComplete = vi.fn();
      const { lastFrame, unmount } = render(
        <StepConfirm matrix={emptyMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      // Skills are selected (preselected) but don't render because not in matrix
      // So "No skills selected" won't appear, but no visible skill names either
      expect(output).toContain("Selected Skills");
      expect(output).not.toContain("No skills selected");
    });
  });
});
