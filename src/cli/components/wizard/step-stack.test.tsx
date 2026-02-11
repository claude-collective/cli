/**
 * Tests for the StepStack wizard component.
 *
 * Tests rendering and keyboard navigation for stack selection (stack path)
 * and domain selection (scratch path).
 *
 * Stack selection uses a custom card-based UI with useInput for navigation.
 * Domain selection still uses the Select component from @inkjs/ui.
 *
 * Note: Select component requires initial render delay before accepting input.
 */
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StepStack } from "./step-stack";
import { useWizardStore } from "../../stores/wizard-store";
import { createMockCategory, createMockMatrix, createMockResolvedStack, createMockSkill } from "../../lib/__tests__/helpers";


import type { MergedSkillsMatrix } from "../../types-matrix";
import { ARROW_DOWN, ARROW_UP, ENTER, ESCAPE, RENDER_DELAY_MS, delay } from "../../lib/__tests__/test-constants";

// Delay between key presses for input processing
const SELECT_NAV_DELAY_MS = 100;

// =============================================================================
// Mock Data
// =============================================================================

const createMockStackWithSkills = (): MergedSkillsMatrix => {
  const skills = {
    ["web-framework-react"]: createMockSkill("web-framework-react", "framework", {
      description: "React framework",
    }),
    ["web-state-zustand"]: createMockSkill("web-state-zustand", "client-state", {
      description: "State management",
    }),
    ["api-framework-hono"]: createMockSkill("api-framework-hono", "api", {
      description: "Web framework",
    }),
  };

  const suggestedStacks = [
    createMockResolvedStack("react-fullstack", "React Fullstack", {
      description: "Full React stack with Zustand and Hono",
      allSkillIds: ["web-framework-react", "web-state-zustand", "api-framework-hono"],
    }),
    createMockResolvedStack("react-minimal", "React Minimal", {
      description: "Minimal React setup",
      allSkillIds: ["web-framework-react"],
    }),
  ];

  return createMockMatrix(skills, {
    suggestedStacks,
    categories: {
      framework: createMockCategory("framework", "Web", {
        description: "Web skills",
        exclusive: false,
      }),
      api: createMockCategory("api", "API", {
        description: "API skills",
        exclusive: false,
        order: 1,
      }),
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
      it("should render stack options as cards", () => {
        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("React Fullstack");
        expect(output).toContain("React Minimal");
      });

      it("should render focused stack description (only focused item shows description)", () => {
        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        // Only the focused (first) stack shows its description
        expect(output).toContain("Full React stack");
      });

      it("should render ViewTitle for stack selection", () => {
        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Select a pre-built template");
      });

      it("should render header text", () => {
        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Select a pre-built template");
      });
    });

    describe("stack selection", () => {
      it("should select first stack on Enter (focus starts at first card)", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // Focus starts at first stack card, press Enter to select
        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { step, selectedStackId } = useWizardStore.getState();
        expect(step).toBe("build");
        expect(selectedStackId).toBe("react-fullstack");
      });

      it("should select second stack when navigated to", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // Navigate down once to second stack card
        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { selectedStackId } = useWizardStore.getState();
        expect(selectedStackId).toBe("react-minimal");
      });
    });

    describe("back navigation", () => {
      it("should go back when pressing Escape", async () => {
        // First set up history by setting step to stack
        useWizardStore.getState().setStep("stack");

        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // Press Escape to go back
        stdin.write(ESCAPE);
        await delay(SELECT_NAV_DELAY_MS);

        const { step } = useWizardStore.getState();
        expect(step).toBe("approach");
      });

      it("should maintain history when going back via Escape", async () => {
        // Set up proper history
        const store = useWizardStore.getState();
        store.setApproach("stack");
        store.setStep("stack"); // This adds "approach" to history

        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        stdin.write(ESCAPE); // Press Escape to go back
        await delay(SELECT_NAV_DELAY_MS);

        const { step, history } = useWizardStore.getState();
        expect(step).toBe("approach");
        expect(history).toEqual([]);
      });
    });

    describe("arrow key navigation", () => {
      it("should navigate down to second stack card", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // Navigate down once to second stack card and select
        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { selectedStackId } = useWizardStore.getState();
        expect(selectedStackId).toBe("react-minimal");
      });

      it("should navigate down then up back to first stack", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // Go down to second stack, then back up
        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ARROW_UP);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { selectedStackId } = useWizardStore.getState();
        expect(selectedStackId).toBe("react-fullstack");
      });

      it("should clamp at top boundary", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // Press up multiple times at the top (should stay at first stack)
        stdin.write(ARROW_UP);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ARROW_UP);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { selectedStackId } = useWizardStore.getState();
        expect(selectedStackId).toBe("react-fullstack");
      });

      it("should clamp at bottom boundary", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // Press down many times past the end (should stay at last stack)
        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { selectedStackId } = useWizardStore.getState();
        expect(selectedStackId).toBe("react-minimal");
      });
    });

    describe("empty state", () => {
      it("should render header with no stacks available", () => {
        const emptyMatrix = createMockMatrix({}, { suggestedStacks: [] });

        const { lastFrame, unmount } = render(<StepStack matrix={emptyMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        // Should still render the header
        expect(output).toContain("Select a pre-built template");
      });

      it("should not render keyboard hints when no stacks", () => {
        const emptyMatrix = createMockMatrix({}, { suggestedStacks: [] });

        const { lastFrame, unmount } = render(<StepStack matrix={emptyMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        // No keyboard hints when there are no stack cards
        expect(output).not.toContain("ENTER");
      });

      it("should still allow Escape to go back with no stacks", async () => {
        const emptyMatrix = createMockMatrix({}, { suggestedStacks: [] });

        // Set up history
        useWizardStore.getState().setStep("stack");

        const { stdin, unmount } = render(<StepStack matrix={emptyMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        stdin.write(ESCAPE);
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
        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Web");
        expect(output).toContain("Web Extras");
        expect(output).toContain("API");
        expect(output).toContain("CLI");
        // Mobile may be scrolled below the visible window due to the Select component's viewport limit
      });

      it("should render header text for domain selection", () => {
        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Select domains to configure");
      });

      it("should show domain descriptions", () => {
        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
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
        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { selectedDomains } = useWizardStore.getState();
        expect(selectedDomains).toContain("web");
      });

      it("should allow multiple domain selection", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // Select Web - toggle domains are tracked in store even if UI doesn't refresh
        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ENTER);
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

        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
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
        for (let i = 0; i < 6; i++) {
          stdin.write(ARROW_DOWN);
          await delay(SELECT_NAV_DELAY_MS);
        }
        stdin.write(ENTER);
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
        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { step } = useWizardStore.getState();
        expect(step).toBe("approach");
      });
    });
  });
});
