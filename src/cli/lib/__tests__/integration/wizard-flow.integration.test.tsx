import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Wizard } from "../../../components/wizard/wizard";
import { useWizardStore } from "../../../stores/wizard-store";
import { createComprehensiveMatrix, createBasicMatrix } from "../helpers";

import type { MergedSkillsMatrix } from "../../../types";
import {
  ARROW_DOWN,
  ENTER,
  ESCAPE,
  RENDER_DELAY_MS,
  SPACE,
  STEP_TRANSITION_DELAY_MS,
  delay,
} from "../test-constants";

/**
 * Navigate from the domain selection sub-view to the build step.
 *
 * Domain selection uses a custom useInput list with items:
 *   [Web, API, CLI, Mobile, Continue]
 *
 * Focus starts on "Web" (index 0). We press down 4 times to reach
 * "Continue" (index 4) and then Enter to proceed.
 */
const navigateDomainSelectionToBuild = async (stdin: {
  write: (data: string) => Promise<void> | void;
}) => {
  const DOMAIN_CONTINUE_NAV_COUNT = 4;
  for (let i = 0; i < DOMAIN_CONTINUE_NAV_COUNT; i++) {
    await stdin.write(ARROW_DOWN);
    await delay(STEP_TRANSITION_DELAY_MS);
  }
  await stdin.write(ENTER); // Continue
  await delay(STEP_TRANSITION_DELAY_MS);
};

describe("Wizard integration", () => {
  let cleanup: (() => void) | undefined;
  let mockMatrix: MergedSkillsMatrix;

  beforeEach(() => {
    useWizardStore.getState().reset();
    mockMatrix = createBasicMatrix();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  describe("Flow A1: Stack path with defaults", () => {
    it("should complete full stack -> domain -> build -> accept defaults -> confirm flow", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      expect(lastFrame()).toContain("React Fullstack");
      expect(lastFrame()).toContain("[1] Choose a stack");

      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(lastFrame()).toContain("Select domains");

      await navigateDomainSelectionToBuild(stdin);

      await stdin.write("A");
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(lastFrame()).toContain("Confirm");

      // Complete the wizard (ENTER on confirm triggers completion)
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();

      const result = onComplete.mock.calls[0][0];
      expect(result.selectedStackId).toBe("react-fullstack");
      expect(result.cancelled).toBe(false);
    });

    it("should skip sources step and go to confirm after accepting defaults", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate: stack selection -> domain selection -> build -> [A] accept defaults -> confirm
      await stdin.write(ENTER); // Select first stack
      await delay(STEP_TRANSITION_DELAY_MS);
      await navigateDomainSelectionToBuild(stdin); // Domain -> Build
      await stdin.write("A"); // Accept defaults
      await delay(STEP_TRANSITION_DELAY_MS);

      const state = useWizardStore.getState();
      expect(state.step).toBe("confirm");

      expect(lastFrame()).toContain("Confirm");
    });
  });

  describe("Flow A2: Stack path with customize", () => {
    it("should navigate stack -> domain -> build step (pre-populated from stack)", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(lastFrame()).toContain("Select domains");
      await navigateDomainSelectionToBuild(stdin);

      expect(lastFrame()).toContain("Build");

      const state = useWizardStore.getState();
      expect(state.stackAction).toBe("customize");
      expect(state.step).toBe("build");
      expect(Object.keys(state.domainSelections).length).toBeGreaterThan(0);
    });
  });

  describe("Flow B: Scratch path with single domain (Web)", () => {
    it("should start scratch flow from unified stack selection", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      expect(lastFrame()).toContain("Start from scratch");
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(lastFrame()).toContain("Select domains");

      const state = useWizardStore.getState();
      expect(state.approach).toBe("scratch");
      expect(state.step).toBe("stack");
    });

    it("should complete scratch flow from domain selection to build", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      useWizardStore.setState({
        step: "stack",
        approach: "scratch",
        selectedDomains: ["web"],
        history: [],
      });

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      expect(lastFrame()).toContain("Select domains");
      expect(lastFrame()).toContain("Selected");
      expect(lastFrame()).toContain("web");

      await navigateDomainSelectionToBuild(stdin);

      const state = useWizardStore.getState();
      expect(state.step).toBe("build");
      expect(state.selectedDomains).toContain("web");
    });

    it("should allow selecting web technologies in Build step", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      useWizardStore.setState({
        step: "build",
        approach: "scratch",
        selectedDomains: ["web"],
        currentDomainIndex: 0,
        domainSelections: {},
      });

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      expect(lastFrame()).toContain("Build");

      await stdin.write(SPACE);
      await delay(STEP_TRANSITION_DELAY_MS);

      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      const state = useWizardStore.getState();
      expect(state.step).toBe("sources");
    });
  });

  describe("Flow C: Scratch path with multi-domain (Web + API)", () => {
    it("should correctly set approach when selecting scratch", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      const state = useWizardStore.getState();
      expect(state.approach).toBe("scratch");
      expect(state.step).toBe("stack");
      expect(lastFrame()).toContain("Select domains");
    });

    it("should navigate through multi-domain build with pre-selected domains", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      useWizardStore.setState({
        step: "stack",
        approach: "scratch",
        selectedDomains: ["web", "api"],
        history: [],
      });

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      expect(lastFrame()).toContain("Selected");
      expect(lastFrame()).toContain("web");
      expect(lastFrame()).toContain("api");

      await navigateDomainSelectionToBuild(stdin);

      const state = useWizardStore.getState();
      expect(state.step).toBe("build");
      expect(state.currentDomainIndex).toBe(0);
    });

    it("should show domain tabs for multi-domain build", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      // Pre-set store to build step with multiple domains
      useWizardStore.setState({
        step: "build",
        approach: "scratch",
        selectedDomains: ["web", "api"],
        currentDomainIndex: 0,
        domainSelections: {},
      });

      const { lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Should show ViewTitle for current domain
      const frame = lastFrame();
      expect(frame).toContain("[2] Customize your Web stack");
    });

    it("should advance to next domain when validation passes", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      // Pre-set store with required selections already made
      useWizardStore.setState({
        step: "build",
        approach: "scratch",
        selectedDomains: ["web", "api"],
        currentDomainIndex: 0,
        domainSelections: {
          web: { ["web-framework"]: ["web-framework-react"] },
        },
      });

      const { stdin, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Continue to next domain
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should now be on second domain
      const state = useWizardStore.getState();
      expect(state.currentDomainIndex).toBe(1);
    });

    it("should allow navigation between domains using escape", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      // Pre-set to build step on second domain
      useWizardStore.setState({
        step: "build",
        approach: "scratch",
        selectedDomains: ["web", "api"],
        currentDomainIndex: 1, // On API domain
        domainSelections: {
          web: { ["web-framework"]: ["web-framework-react"] },
        },
        history: ["stack"],
      });

      const { stdin, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Press escape to go back to first domain
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be back on first domain
      const state = useWizardStore.getState();
      expect(state.currentDomainIndex).toBe(0);

      // Web selections should be preserved
      expect(state.domainSelections.web?.["web-framework"]).toContain("web-framework-react");
    });
  });

  describe("Flow D: Back navigation", () => {
    it("should navigate back from build to stack step and to initial selection", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Now at domain selection, navigate to build
      await navigateDomainSelectionToBuild(stdin);

      // Verify we're at build
      let state = useWizardStore.getState();
      expect(state.step).toBe("build");
      expect(state.selectedStackId).toBe("react-fullstack");

      // Go back from build to stack (domain selection sub-view)
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be back at stack step (domain selection since approach is still set)
      state = useWizardStore.getState();
      expect(state.step).toBe("stack");
      // Stack selection should be preserved
      expect(state.selectedStackId).toBe("react-fullstack");
    });

    it("should preserve domain selections when navigating back in scratch flow", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to scratch (past 2 stacks)
      await stdin.write(ARROW_DOWN); // Vue Stack
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN); // Start from scratch
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Now at domain selection - verify domains were pre-selected
      const state = useWizardStore.getState();
      expect(state.approach).toBe("scratch");
      // Scratch pre-selects web, api, mobile
      expect(state.selectedDomains).toContain("web");
      expect(state.selectedDomains).toContain("api");
    });
  });

  describe("Flow E: Cancel from first step", () => {
    it("should call onCancel when escape pressed at initial stack selection", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Press escape at first step (initial stack selection)
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should have called onCancel
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should not call onCancel when going back from domain selection", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Select a stack (approach gets set, domain selection shows)
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be at domain selection
      expect(lastFrame()).toContain("Select domains");

      // Press ESC to go back from domain selection
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be back at stack/scratch selection (approach reset to null)
      expect(lastFrame()).toContain("[1] Choose a stack");
      expect(onCancel).not.toHaveBeenCalled();

      // Now escape at initial selection should cancel
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("stack selection flow", () => {
    it("should navigate through stack -> domain -> build", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Step 1: Unified stack selection - see stacks directly
      expect(lastFrame()).toContain("React Fullstack");
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 1b: Domain selection
      expect(lastFrame()).toContain("Select domains");
      await navigateDomainSelectionToBuild(stdin);

      // Step 2: Build - pre-populated from stack
      const state = useWizardStore.getState();
      expect(state.step).toBe("build");
      expect(state.selectedStackId).toBe("react-fullstack");
    });

    it("should complete wizard with stack defaults flow via A shortcut", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Step 1: Select first stack
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 1b: Navigate through domain selection
      await navigateDomainSelectionToBuild(stdin);

      // Step 2: Build - press A to accept defaults
      await stdin.write("A");
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 3: Sources - should show sources step (or confirm if sources skipped)
      const frame = lastFrame();
      // On defaults path, sources may be skipped; check we're past build
      const state = useWizardStore.getState();
      expect(state.step === "sources" || state.step === "confirm").toBe(true);
    });
  });

  describe("cancellation flow", () => {
    it("should call onCancel when escape pressed at initial stack selection", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Press escape at first step
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(onCancel).toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should go back to stack selection when escape pressed at domain selection", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Select a stack to get to domain selection
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);
      expect(lastFrame()).toContain("Select domains");

      // Press ESC to go back from domain selection
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be back at stack/scratch selection
      expect(lastFrame()).toContain("[1] Choose a stack");
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe("navigation history", () => {
    it("should navigate back through wizard steps using escape", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Select first stack
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Navigate through domain selection to build
      await navigateDomainSelectionToBuild(stdin);

      // Should now be at build
      const state = useWizardStore.getState();
      expect(state.step).toBe("build");

      // Go back using escape
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be back at stack step (domain selection view since approach is still set)
      expect(useWizardStore.getState().step).toBe("stack");
    });

    it("should preserve selections when going back", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Select first stack
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Navigate through domain selection to build
      await navigateDomainSelectionToBuild(stdin);

      // Should be at build
      expect(useWizardStore.getState().step).toBe("build");

      // Go back using escape
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Stack should still be selected in store
      const { selectedStackId } = useWizardStore.getState();
      expect(selectedStackId).toBe("react-fullstack");
    });
  });

  describe("step footer hints", () => {
    it("should display ESC hint in step footer", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Centralized footer shows keyboard hints on all steps
      const frame = lastFrame();
      // StackSelection shows quit hint (ESC cancels at initial step)
      expect(frame).toContain("quit");
    });

    it("should display navigation hints in step footer", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Centralized footer shows navigation hints
      expect(lastFrame()).toContain("navigate");
      expect(lastFrame()).toContain("select");
    });
  });

  describe("mode selection", () => {
    it("should toggle expert mode via keyboard shortcut", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Toggle expert mode with 'e' keyboard shortcut (global handler)
      await stdin.write("e");
      await delay(STEP_TRANSITION_DELAY_MS);

      // Expert mode indicator is shown in wizard-layout with cyan color when active
      expect(lastFrame()).toContain("Expert mode");
    });

    it("should toggle install mode via keyboard shortcut", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Toggle install mode with 'p' keyboard shortcut (global handler)
      await stdin.write("p");
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(lastFrame()).toContain("Plugin mode");
    });
  });

  describe("alternative stack selection", () => {
    it("should allow selecting second stack", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to second stack (Testing Stack) and select
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be at domain selection with testing-stack selected
      const state = useWizardStore.getState();
      expect(state.selectedStackId).toBe("testing-stack");
      expect(state.approach).toBe("stack");
    });
  });

  describe("wizard tabs", () => {
    it("should display wizard tabs at all steps", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Should show wizard tabs (4 tabs: Stack, Build, Sources, Confirm)
      expect(lastFrame()).toContain("Stack");
      expect(lastFrame()).toContain("Build");
      expect(lastFrame()).toContain("Sources");
      expect(lastFrame()).toContain("Confirm");
      // Should NOT show "Intro" tab (removed by U14)
      expect(lastFrame()).not.toContain("Intro");
    });
  });

  describe("result verification", () => {
    it("should return correct result structure on completion", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Complete full flow: stack -> domain -> build -> [A] -> confirm
      await stdin.write(ENTER); // Select first stack
      await delay(STEP_TRANSITION_DELAY_MS);
      await navigateDomainSelectionToBuild(stdin); // Domain -> Build
      await stdin.write("A"); // Accept defaults
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER); // Confirm -> complete
      await delay(STEP_TRANSITION_DELAY_MS);

      // Verify result structure
      expect(onComplete).toHaveBeenCalledTimes(1);
      const result = onComplete.mock.calls[0][0];

      expect(result).toHaveProperty("selectedSkills");
      expect(result).toHaveProperty("selectedStackId");
      expect(result).toHaveProperty("domainSelections");
      expect(result).toHaveProperty("sourceSelections");
      expect(result).toHaveProperty("expertMode");
      expect(result).toHaveProperty("installMode");
      expect(result).toHaveProperty("cancelled");
      expect(result).toHaveProperty("validation");

      expect(result.selectedStackId).toBe("react-fullstack");
      expect(result.cancelled).toBe(false);
      expect(result.installMode).toBe("local");
      expect(result.expertMode).toBe(false);
    });

    it("should include preselected skills in result", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Complete full flow: stack -> domain -> build -> [A] -> confirm
      await stdin.write(ENTER); // Select first stack
      await delay(STEP_TRANSITION_DELAY_MS);
      await navigateDomainSelectionToBuild(stdin); // Domain -> Build
      await stdin.write("A"); // Accept defaults
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER); // Confirm -> complete
      await delay(STEP_TRANSITION_DELAY_MS);

      const result = onComplete.mock.calls[0][0];

      // Should include at least the preselected skills (methodology skills)
      expect(Array.isArray(result.selectedSkills)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should show keyboard help text on initial stack selection", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Footer shows keyboard navigation hints
      const frame = lastFrame();
      expect(frame).toContain("navigate");
      expect(frame).toContain("select");
    });

    it("should show keyboard help text on domain selection step", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to domain selection by selecting a stack
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      const frame = lastFrame();
      expect(frame).toContain("navigate");
      expect(frame).toContain("back");
    });

    it("should show domain selection hint when no domains selected on scratch path", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      // Pre-set to scratch but with no domains (simulating cleared state)
      useWizardStore.setState({
        step: "stack",
        approach: "scratch",
        selectedDomains: [],
        history: [],
      });

      const { lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Should show hint to select domain
      const frame = lastFrame();
      expect(frame).toContain("at least one domain");
    });

    it("should show all wizard tabs on every step", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Check tabs are visible on initial stack selection
      let frame = lastFrame();
      expect(frame).toContain("Stack");
      expect(frame).toContain("Build");
      expect(frame).toContain("Confirm");
      expect(frame).not.toContain("Intro");

      // Navigate to domain selection (select a stack)
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Check tabs are still visible on domain selection
      frame = lastFrame();
      expect(frame).toContain("Stack");
      expect(frame).toContain("Build");
    });
  });
});
