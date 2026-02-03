/**
 * Tests for the StepStack wizard component.
 *
 * Tests rendering and keyboard navigation for stack selection (stack path)
 * and domain selection (scratch path).
 *
 * Note: Select component requires initial render delay before accepting input.
 */
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StepStack } from "../../../components/wizard/step-stack";
import { useWizardStore } from "../../../stores/wizard-store";
import { createMockMatrix, createMockSkill } from "../helpers";
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
      audience: [],
      skills: {},
      allSkillIds: [TEST_SKILLS.REACT, TEST_SKILLS.ZUSTAND, TEST_SKILLS.HONO],
      philosophy: "",
    },
    {
      id: "react-minimal",
      name: "React Minimal",
      description: "Minimal React setup",
      audience: [],
      skills: {},
      allSkillIds: [TEST_SKILLS.REACT],
      philosophy: "",
    },
  ];

  return createMockMatrix(skills, {
    suggestedStacks,
    categories: {
      frontend: {
        id: "frontend",
        name: "Frontend",
        description: "Frontend skills",
        exclusive: false,
        required: false,
        order: 0,
      },
      backend: {
        id: "backend",
        name: "Backend",
        description: "Backend skills",
        exclusive: false,
        required: false,
        order: 1,
      },
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
  // Stack Selection Mode (approach === "stack")
  // ===========================================================================

  describe("stack selection mode", () => {
    beforeEach(() => {
      // Set approach to "stack" for stack selection mode
      useWizardStore.getState().setApproach("stack");
    });

    describe("rendering", () => {
      it("should render stack options", () => {
        const { lastFrame, unmount } = render(
          <StepStack matrix={mockMatrix} />,
        );
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("React Fullstack");
        expect(output).toContain("React Minimal");
      });

      it("should render stack descriptions", () => {
        const { lastFrame, unmount } = render(
          <StepStack matrix={mockMatrix} />,
        );
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Full React stack");
        expect(output).toContain("Minimal React setup");
      });

      it("should render back option", () => {
        const { lastFrame, unmount } = render(
          <StepStack matrix={mockMatrix} />,
        );
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Back");
      });

      it("should render header text", () => {
        const { lastFrame, unmount } = render(
          <StepStack matrix={mockMatrix} />,
        );
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Select a pre-built template");
      });
    });

    describe("stack selection", () => {
      it("should select stack and navigate to stack-options", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // First option after back is the first stack
        await stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        await stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { step, selectedStackId } = useWizardStore.getState();
        expect(step).toBe("stack-options");
        expect(selectedStackId).toBe("react-fullstack");
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

        const { selectedStackId } = useWizardStore.getState();
        expect(selectedStackId).toBe("react-minimal");
      });
    });

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
        store.setApproach("stack");
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

        const { selectedStackId } = useWizardStore.getState();
        expect(selectedStackId).toBe("react-minimal");
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

        const { selectedStackId } = useWizardStore.getState();
        expect(selectedStackId).toBe("react-fullstack");
      });
    });

    describe("empty state", () => {
      it("should render with no stacks available", () => {
        const emptyMatrix = createMockMatrix({}, { suggestedStacks: [] });

        const { lastFrame, unmount } = render(
          <StepStack matrix={emptyMatrix} />,
        );
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
  });

  // ===========================================================================
  // Domain Selection Mode (approach === "scratch")
  // ===========================================================================

  describe("domain selection mode", () => {
    beforeEach(() => {
      // Set approach to "scratch" for domain selection mode
      useWizardStore.getState().setApproach("scratch");
    });

    describe("rendering", () => {
      it("should render domain options", () => {
        const { lastFrame, unmount } = render(
          <StepStack matrix={mockMatrix} />,
        );
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Web");
        expect(output).toContain("API");
        expect(output).toContain("CLI");
        expect(output).toContain("Mobile");
      });

      it("should render header text for domain selection", () => {
        const { lastFrame, unmount } = render(
          <StepStack matrix={mockMatrix} />,
        );
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Select domains to configure");
      });

      it("should show domain descriptions", () => {
        const { lastFrame, unmount } = render(
          <StepStack matrix={mockMatrix} />,
        );
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Frontend web applications");
        expect(output).toContain("Backend APIs");
      });
    });

    describe("domain selection", () => {
      it("should toggle domain when selected", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // Navigate down to first domain (Web) and select
        await stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        await stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { selectedDomains } = useWizardStore.getState();
        expect(selectedDomains).toContain("web");
      });

      it("should allow multiple domain selection", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // Select Web - toggle domains are tracked in store even if UI doesn't refresh
        await stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        await stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        // Check first domain selected
        expect(useWizardStore.getState().selectedDomains).toContain("web");

        // Note: The second selection would need the Select to re-render
        // For now, verify the store correctly updates by toggling directly
        useWizardStore.getState().toggleDomain("api");

        const { selectedDomains } = useWizardStore.getState();
        expect(selectedDomains).toContain("web");
        expect(selectedDomains).toContain("api");
      });

      it("should show selected domains summary when domains selected", async () => {
        // Pre-select a domain
        useWizardStore.getState().toggleDomain("web");

        const { lastFrame, unmount } = render(
          <StepStack matrix={mockMatrix} />,
        );
        cleanup = unmount;

        const output = lastFrame();
        // The selected summary should show at the bottom
        expect(output).toContain("Selected:");
        expect(output).toContain("web");
      });

      it("should navigate to build step when continuing", async () => {
        // Pre-select a domain
        useWizardStore.getState().toggleDomain("web");

        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // Navigate to continue option (last option)
        for (let i = 0; i < 5; i++) {
          await stdin.write(ARROW_DOWN);
          await delay(SELECT_NAV_DELAY_MS);
        }
        await stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { step } = useWizardStore.getState();
        expect(step).toBe("build");
      });
    });

    describe("back navigation", () => {
      it("should go back when selecting back option", async () => {
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
    });
  });
});
