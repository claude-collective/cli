/**
 * Integration tests for the full Wizard component.
 *
 * Tests complete user flows through the wizard from start to finish.
 *
 * Note: Select component requires consistent delays between operations.
 */
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Wizard } from "../../../components/wizard/wizard";
import { useWizardStore } from "../../../stores/wizard-store";
import {
  createMockMatrix,
  createMockSkill,
} from "../helpers";
import { TEST_SKILLS, TEST_CATEGORIES } from "../test-fixtures";
import type { MergedSkillsMatrix, ResolvedStack } from "../../../types-matrix";
import {
  ARROW_DOWN,
  ENTER,
  ESCAPE,
  RENDER_DELAY_MS,
  delay,
} from "../test-constants";

// Longer delay for wizard step transitions
const STEP_TRANSITION_DELAY_MS = 150;

// =============================================================================
// Mock Data
// =============================================================================

const createFullMatrix = (): MergedSkillsMatrix => {
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
    [TEST_SKILLS.VITEST]: createMockSkill(
      TEST_SKILLS.VITEST,
      TEST_CATEGORIES.TESTING,
      { name: "Vitest", description: "Testing framework" },
    ),
  };

  const suggestedStacks: ResolvedStack[] = [
    {
      id: "react-fullstack",
      name: "React Fullstack",
      description: "Complete React stack",
      allSkillIds: [TEST_SKILLS.REACT, TEST_SKILLS.ZUSTAND, TEST_SKILLS.HONO],
      requiredSkillIds: [TEST_SKILLS.REACT],
      optionalSkillIds: [TEST_SKILLS.ZUSTAND, TEST_SKILLS.HONO],
      suggestedAgents: ["web-developer"],
    },
    {
      id: "testing-stack",
      name: "Testing Stack",
      description: "Testing focused stack",
      allSkillIds: [TEST_SKILLS.VITEST],
      requiredSkillIds: [TEST_SKILLS.VITEST],
      optionalSkillIds: [],
      suggestedAgents: ["tester"],
    },
  ];

  return createMockMatrix(skills, {
    suggestedStacks,
    categories: {
      frontend: { name: "Frontend", description: "Frontend skills" },
      [TEST_CATEGORIES.FRAMEWORK]: {
        name: "Framework",
        description: "UI Frameworks",
      },
      [TEST_CATEGORIES.STATE]: {
        name: "State",
        description: "State management",
      },
      backend: { name: "Backend", description: "Backend skills" },
      [TEST_CATEGORIES.BACKEND_FRAMEWORK]: {
        name: "Backend Framework",
        description: "Backend frameworks",
      },
      testing: { name: "Testing", description: "Testing tools" },
      [TEST_CATEGORIES.TESTING]: {
        name: "Testing Framework",
        description: "Testing frameworks",
      },
    },
  });
};

// =============================================================================
// Tests
// =============================================================================

describe("Wizard integration", () => {
  let cleanup: (() => void) | undefined;
  let mockMatrix: MergedSkillsMatrix;

  beforeEach(() => {
    useWizardStore.getState().reset();
    mockMatrix = createFullMatrix();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  // ===========================================================================
  // Full Stack Selection Flow
  // ===========================================================================

  describe("stack selection flow", () => {
    it("should complete full wizard with stack selection", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard
          matrix={mockMatrix}
          onComplete={onComplete}
          onCancel={onCancel}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Step 1: Approach - select "Use a pre-built template"
      expect(lastFrame()).toContain("pre-built template");
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 2: Stack - navigate down to first stack and select
      expect(lastFrame()).toContain("React Fullstack");
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 3: Confirm - navigate to confirm and select
      expect(lastFrame()).toContain("Selected Skills");
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(onComplete).toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    });

    it("should pass selected skills to onComplete", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard
          matrix={mockMatrix}
          onComplete={onComplete}
          onCancel={onCancel}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Step 1: Select template approach
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 2: Navigate to first stack and select
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 3: Navigate to confirm and select
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      const result = onComplete.mock.calls[0]?.[0];
      expect(result).toBeDefined();
      expect(result.selectedSkills).toContain(TEST_SKILLS.REACT);
      expect(result.selectedSkills).toContain(TEST_SKILLS.ZUSTAND);
      expect(result.selectedStack?.id).toBe("react-fullstack");
    });
  });

  // ===========================================================================
  // Cancellation Flow
  // ===========================================================================

  describe("cancellation flow", () => {
    it("should call onCancel when escape pressed at approach", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard
          matrix={mockMatrix}
          onComplete={onComplete}
          onCancel={onCancel}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Press escape at first step
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(onCancel).toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should go back when escape pressed after approach", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard
          matrix={mockMatrix}
          onComplete={onComplete}
          onCancel={onCancel}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to stack step
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);
      expect(lastFrame()).toContain("React Fullstack");

      // Press escape to go back
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be back at approach
      expect(lastFrame()).toContain("pre-built template");
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Navigation History
  // ===========================================================================

  describe("navigation history", () => {
    it("should navigate back through wizard steps using escape", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard
          matrix={mockMatrix}
          onComplete={onComplete}
          onCancel={onCancel}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Go to stack
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Go to confirm by selecting a stack
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should now be at confirm
      expect(lastFrame()).toContain("Selected Skills");

      // Go back using escape
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be back at stack selection
      expect(lastFrame()).toContain("React Fullstack");
    });

    it("should preserve selections when going back", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard
          matrix={mockMatrix}
          onComplete={onComplete}
          onCancel={onCancel}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Select template
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Select first stack
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be at confirm with skills selected
      expect(lastFrame()).toContain("React");

      // Go back using escape
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Skills should still be selected in store
      const { selectedSkills } = useWizardStore.getState();
      expect(selectedSkills).toContain(TEST_SKILLS.REACT);
    });
  });

  // ===========================================================================
  // Initial Skills
  // ===========================================================================

  describe("initial skills", () => {
    it("should skip approach when initial skills provided", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { lastFrame, unmount } = render(
        <Wizard
          matrix={mockMatrix}
          onComplete={onComplete}
          onCancel={onCancel}
          initialSkills={[TEST_SKILLS.REACT]}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Should start at category, not approach
      const output = lastFrame();
      expect(output).not.toContain("pre-built template");
    });

    it("should set initial skills in store", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { unmount } = render(
        <Wizard
          matrix={mockMatrix}
          onComplete={onComplete}
          onCancel={onCancel}
          initialSkills={[TEST_SKILLS.REACT, TEST_SKILLS.VITEST]}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Should be at category step with initial skills
      const { step, selectedSkills } = useWizardStore.getState();
      expect(step).toBe("category");
      expect(selectedSkills).toContain(TEST_SKILLS.REACT);
      expect(selectedSkills).toContain(TEST_SKILLS.VITEST);
    });
  });

  // ===========================================================================
  // Selection Header
  // ===========================================================================

  describe("selection header", () => {
    it("should display ESC hint", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { lastFrame, unmount } = render(
        <Wizard
          matrix={mockMatrix}
          onComplete={onComplete}
          onCancel={onCancel}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      expect(lastFrame()).toContain("ESC to go back");
    });

    it("should display cancel hint", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { lastFrame, unmount } = render(
        <Wizard
          matrix={mockMatrix}
          onComplete={onComplete}
          onCancel={onCancel}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      expect(lastFrame()).toContain("Ctrl+C");
    });
  });

  // ===========================================================================
  // Mode Selection
  // ===========================================================================

  describe("mode selection", () => {
    it("should toggle expert mode during approach", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard
          matrix={mockMatrix}
          onComplete={onComplete}
          onCancel={onCancel}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to expert mode toggle (3rd option) with sequential writes
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(lastFrame()).toContain("Expert Mode is ON");
    });

    it("should toggle install mode during approach", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard
          matrix={mockMatrix}
          onComplete={onComplete}
          onCancel={onCancel}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to install mode toggle (4th option) with sequential writes
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(lastFrame()).toContain("Plugin");
    });
  });

  // ===========================================================================
  // Second Stack Selection
  // ===========================================================================

  describe("alternative stack selection", () => {
    it("should allow selecting second stack", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard
          matrix={mockMatrix}
          onComplete={onComplete}
          onCancel={onCancel}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Select template approach
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Navigate to second stack (Back, first stack, second stack) with sequential writes
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should show testing stack skills
      expect(lastFrame()).toContain("Vitest");
    });
  });
});
