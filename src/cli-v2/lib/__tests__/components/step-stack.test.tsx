/**
 * Tests for the StepStack wizard component.
 *
 * Tests rendering and keyboard navigation for stack selection.
 *
 * Note: Select component requires initial render delay before accepting input.
 */
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StepStack } from "../../../components/wizard/step-stack";
import { useWizardStore } from "../../../stores/wizard-store";
import { DEFAULT_PRESELECTED_SKILLS } from "../../../consts";
import {
  createMockMatrix,
  createMockSkill,
} from "../helpers";
import { TEST_SKILLS, TEST_CATEGORIES } from "../test-fixtures";
import type { MergedSkillsMatrix, ResolvedStack } from "../../../types-matrix";
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
// Mock Data
// =============================================================================

const createMockStackWithSkills = (): MergedSkillsMatrix => {
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
    [TEST_SKILLS.HONO]: createMockSkill(
      TEST_SKILLS.HONO,
      TEST_CATEGORIES.BACKEND_FRAMEWORK,
      { name: "Hono", description: "Web framework" },
    ),
  };

  const suggestedStacks: ResolvedStack[] = [
    {
      id: "react-fullstack",
      name: "React Fullstack",
      description: "Full React stack with Zustand and Hono",
      allSkillIds: [TEST_SKILLS.REACT, TEST_SKILLS.ZUSTAND, TEST_SKILLS.HONO],
      requiredSkillIds: [TEST_SKILLS.REACT],
      optionalSkillIds: [TEST_SKILLS.ZUSTAND, TEST_SKILLS.HONO],
      suggestedAgents: ["web-developer"],
    },
    {
      id: "react-minimal",
      name: "React Minimal",
      description: "Minimal React setup",
      allSkillIds: [TEST_SKILLS.REACT],
      requiredSkillIds: [TEST_SKILLS.REACT],
      optionalSkillIds: [],
      suggestedAgents: ["web-developer"],
    },
  ];

  return createMockMatrix(skills, {
    suggestedStacks,
    categories: {
      frontend: { name: "Frontend", description: "Frontend skills" },
      backend: { name: "Backend", description: "Backend skills" },
    },
  });
};

// =============================================================================
// Tests
// =============================================================================

describe("StepStack component", () => {
  let cleanup: (() => void) | undefined;
  let mockMatrix: MergedSkillsMatrix;

  beforeEach(() => {
    useWizardStore.getState().reset();
    mockMatrix = createMockStackWithSkills();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  // ===========================================================================
  // Rendering
  // ===========================================================================

  describe("rendering", () => {
    it("should render stack options", () => {
      const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("React Fullstack");
      expect(output).toContain("React Minimal");
    });

    it("should render stack descriptions", () => {
      const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Full React stack");
      expect(output).toContain("Minimal React setup");
    });

    it("should render back option", () => {
      const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Back");
    });

    it("should render header text", () => {
      const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Select a pre-built template");
    });
  });

  // ===========================================================================
  // Stack Selection
  // ===========================================================================

  describe("stack selection", () => {
    it("should select stack and navigate to confirm", async () => {
      const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // First option after back is the first stack
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { step, selectedStack } = useWizardStore.getState();
      expect(step).toBe("confirm");
      expect(selectedStack?.id).toBe("react-fullstack");
    });

    it("should populate skills when stack is selected", async () => {
      const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { selectedSkills } = useWizardStore.getState();
      expect(selectedSkills).toContain(TEST_SKILLS.REACT);
      expect(selectedSkills).toContain(TEST_SKILLS.ZUSTAND);
      expect(selectedSkills).toContain(TEST_SKILLS.HONO);
    });

    it("should select second stack when navigated to", async () => {
      const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to second stack (skip back, skip first stack)
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { selectedStack, selectedSkills } = useWizardStore.getState();
      expect(selectedStack?.id).toBe("react-minimal");
      // Stack skills + preselected methodology skills
      expect(selectedSkills).toContain(TEST_SKILLS.REACT);
      for (const skill of DEFAULT_PRESELECTED_SKILLS) {
        expect(selectedSkills).toContain(skill);
      }
    });
  });

  // ===========================================================================
  // Back Navigation
  // ===========================================================================

  describe("back navigation", () => {
    it("should go back when selecting back option", async () => {
      // First set up history by setting step to stack
      useWizardStore.getState().setStep("stack");

      const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // First option is back
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { step } = useWizardStore.getState();
      expect(step).toBe("approach");
    });

    it("should maintain history when going back", async () => {
      // Set up proper history
      const store = useWizardStore.getState();
      store.setStep("stack"); // This adds "approach" to history

      const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      await stdin.write(ENTER); // Select back
      await delay(SELECT_NAV_DELAY_MS);

      const { step, history } = useWizardStore.getState();
      expect(step).toBe("approach");
      expect(history).toEqual([]);
    });
  });

  // ===========================================================================
  // Arrow Key Navigation
  // ===========================================================================

  describe("arrow key navigation", () => {
    it("should navigate through options with arrow keys", async () => {
      const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate down twice to get to second stack
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { selectedStack } = useWizardStore.getState();
      expect(selectedStack?.id).toBe("react-minimal");
    });

    it("should navigate up through options", async () => {
      const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Go down to last option, then up
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ARROW_UP);
      await delay(SELECT_NAV_DELAY_MS);
      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { selectedStack } = useWizardStore.getState();
      expect(selectedStack?.id).toBe("react-fullstack");
    });
  });

  // ===========================================================================
  // Empty State
  // ===========================================================================

  describe("empty state", () => {
    it("should render with no stacks available", () => {
      const emptyMatrix = createMockMatrix({}, { suggestedStacks: [] });

      const { lastFrame, unmount } = render(<StepStack matrix={emptyMatrix} />);
      cleanup = unmount;

      const output = lastFrame();
      // Should still render back option
      expect(output).toContain("Back");
    });

    it("should only show back option when no stacks", async () => {
      const emptyMatrix = createMockMatrix({}, { suggestedStacks: [] });

      // Set up history
      useWizardStore.getState().setStep("stack");

      const { stdin, unmount } = render(<StepStack matrix={emptyMatrix} />);
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      await stdin.write(ENTER);
      await delay(SELECT_NAV_DELAY_MS);

      const { step } = useWizardStore.getState();
      expect(step).toBe("approach");
    });
  });

  // ===========================================================================
  // Multiple Stack Selection
  // ===========================================================================

  describe("stack switching", () => {
    it("should replace skills when selecting different stack", () => {
      // Simulate selecting first stack then going back
      const firstStack = mockMatrix.suggestedStacks[0];
      useWizardStore.getState().selectStack(firstStack);

      // Verify initial selection
      expect(useWizardStore.getState().selectedSkills).toContain(TEST_SKILLS.ZUSTAND);

      // Now select second stack
      const secondStack = mockMatrix.suggestedStacks[1];
      useWizardStore.getState().selectStack(secondStack);

      // Skills should be replaced
      const { selectedSkills } = useWizardStore.getState();
      expect(selectedSkills).not.toContain(TEST_SKILLS.ZUSTAND);
      expect(selectedSkills).toContain(TEST_SKILLS.REACT);
    });
  });
});
