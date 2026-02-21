import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepStack } from "./step-stack";
import { useWizardStore } from "../../stores/wizard-store";
import {
  createMockCategory,
  createMockMatrix,
  createMockResolvedStack,
  TEST_SKILLS,
} from "../../lib/__tests__/helpers";

import type { MergedSkillsMatrix } from "../../types";
import {
  ARROW_DOWN,
  ARROW_UP,
  ENTER,
  ESCAPE,
  RENDER_DELAY_MS,
  SELECT_NAV_DELAY_MS,
  delay,
} from "../../lib/__tests__/test-constants";

const createMockStackWithSkills = (): MergedSkillsMatrix => {
  const skills = {
    ["web-framework-react"]: TEST_SKILLS.react,
    ["web-state-zustand"]: TEST_SKILLS.zustand,
    ["api-framework-hono"]: TEST_SKILLS.hono,
  };

  const suggestedStacks = [
    createMockResolvedStack("react-fullstack", "React Fullstack", {
      description: "Full React stack with Zustand and Hono",
      allSkillIds: ["web-framework-react", "web-state-zustand", "api-framework-hono"],
    }),
    createMockResolvedStack("react-minimal", "React Minimal", {
      allSkillIds: ["web-framework-react"],
    }),
  ];

  return createMockMatrix(skills, {
    suggestedStacks,
    categories: {
      "web-framework": createMockCategory("web-framework", "Web", {
        exclusive: false,
      }),
      "api-api": createMockCategory("api-api", "API", {
        exclusive: false,
        order: 1,
      }),
    },
  });
};

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

  describe("unified stack/scratch selection (initial view)", () => {
    describe("rendering", () => {
      it("should render stack options and scratch option", () => {
        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("React Fullstack");
        expect(output).toContain("React Minimal");
        expect(output).toContain("Start from scratch");
      });

      it("should render focused stack description (only focused item shows description)", () => {
        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Full React stack");
      });

      it("should render ViewTitle for stack selection", () => {
        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Choose a stack");
      });

      it("should render divider between stacks and scratch option", () => {
        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("\u2500");
      });
    });

    describe("stack selection", () => {
      it("should select first stack on Enter and show domain selection", async () => {
        const { stdin, lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { approach, selectedStackId } = useWizardStore.getState();
        expect(approach).toBe("stack");
        expect(selectedStackId).toBe("react-fullstack");

        const output = lastFrame();
        expect(output).toContain("Select domains to configure");
      });

      it("should select second stack when navigated to", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { selectedStackId } = useWizardStore.getState();
        expect(selectedStackId).toBe("react-minimal");
      });
    });

    describe("scratch selection", () => {
      it("should show domain selection when scratch is selected", async () => {
        const { stdin, lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { approach, selectedStackId } = useWizardStore.getState();
        expect(approach).toBe("scratch");
        expect(selectedStackId).toBeNull();

        const output = lastFrame();
        expect(output).toContain("Select domains to configure");
      });

      it("should pre-select domains except CLI when scratch is chosen", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { selectedDomains } = useWizardStore.getState();
        expect(selectedDomains).toContain("web");
        expect(selectedDomains).toContain("api");
        expect(selectedDomains).toContain("mobile");
        expect(selectedDomains).not.toContain("cli");
      });
    });

    describe("cancel navigation", () => {
      it("should call onCancel when pressing Escape at initial view", async () => {
        const onCancel = vi.fn();
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} onCancel={onCancel} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        stdin.write(ESCAPE);
        await delay(SELECT_NAV_DELAY_MS);

        expect(onCancel).toHaveBeenCalledTimes(1);
      });
    });

    describe("arrow key navigation", () => {
      it("should navigate down to second stack card", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

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

        stdin.write(ARROW_UP);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ARROW_UP);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { selectedStackId } = useWizardStore.getState();
        expect(selectedStackId).toBe("react-fullstack");
      });

      it("should clamp at bottom boundary (scratch is last)", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ARROW_DOWN);
        await delay(SELECT_NAV_DELAY_MS);
        stdin.write(ENTER);
        await delay(SELECT_NAV_DELAY_MS);

        const { approach } = useWizardStore.getState();
        expect(approach).toBe("scratch");
      });
    });

    describe("empty state", () => {
      it("should still show scratch option with no stacks available", () => {
        const emptyMatrix = createMockMatrix({}, { suggestedStacks: [] });

        const { lastFrame, unmount } = render(<StepStack matrix={emptyMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Choose a stack");
        expect(output).toContain("Start from scratch");
      });
    });
  });

  describe("domain selection mode (after stack/scratch choice)", () => {
    beforeEach(() => {
      useWizardStore.getState().setApproach("scratch");
    });

    describe("rendering", () => {
      it("should render domain options", () => {
        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Web");
        expect(output).toContain("API");
        expect(output).toContain("CLI");
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
        // Only the focused item (Web, first in list) shows its description
        expect(output).toContain("Frontend web applications");
      });
    });

    describe("domain selection", () => {
      it("should toggle domain when selected", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // First domain (Web) is focused by default, toggle with space
        stdin.write(" ");
        await delay(SELECT_NAV_DELAY_MS);

        const { selectedDomains } = useWizardStore.getState();
        expect(selectedDomains).toContain("web");
      });

      it("should allow multiple domain selection", async () => {
        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // First domain (Web) is focused by default
        stdin.write(" ");
        await delay(SELECT_NAV_DELAY_MS);

        expect(useWizardStore.getState().selectedDomains).toContain("web");

        useWizardStore.getState().toggleDomain("api");

        const { selectedDomains } = useWizardStore.getState();
        expect(selectedDomains).toContain("web");
        expect(selectedDomains).toContain("api");
      });

      it("should show selected domains summary when domains selected", async () => {
        useWizardStore.getState().toggleDomain("web");

        const { lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        const output = lastFrame();
        expect(output).toContain("Selected:");
        expect(output).toContain("web");
      });

      it("should navigate to build step when continuing", async () => {
        useWizardStore.getState().toggleDomain("web");

        const { stdin, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        // Navigate to continue option (after 4 domains)
        for (let i = 0; i < 4; i++) {
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
      it("should return to stack/scratch selection when pressing ESC", async () => {
        const { stdin, lastFrame, unmount } = render(<StepStack matrix={mockMatrix} />);
        cleanup = unmount;

        await delay(RENDER_DELAY_MS);

        stdin.write(ESCAPE);
        await delay(SELECT_NAV_DELAY_MS);

        const { approach } = useWizardStore.getState();
        expect(approach).toBeNull();

        const output = lastFrame();
        expect(output).toContain("Choose a stack");
      });
    });
  });
});
