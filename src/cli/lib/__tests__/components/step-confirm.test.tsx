/**
 * Tests for the StepConfirm wizard component.
 *
 * Tests rendering and keyboard navigation for the confirm step.
 */
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepConfirm } from "../../../components/wizard/step-confirm";
import { useWizardStore } from "../../../stores/wizard-store";
import { createMockMatrix, createMockSkill } from "../helpers";


import type { CategoryDefinition, MergedSkillsMatrix, Subcategory } from "../../../types-matrix";
import { ENTER, ESCAPE, RENDER_DELAY_MS, delay } from "../test-constants";

// =============================================================================
// Mock Data
// =============================================================================

const createTestMatrix = (): MergedSkillsMatrix => {
  const skills = {
    ["web-framework-react"]: createMockSkill("web-framework-react", "framework", {
      name: "React",
      description: "React framework",
    }),
    ["web-state-zustand"]: createMockSkill("web-state-zustand", "client-state", {
      name: "Zustand",
      description: "State management",
    }),
    ["web-testing-vitest"]: createMockSkill("web-testing-vitest", "testing", {
      name: "Vitest",
      description: "Testing framework",
    }),
  };

  return createMockMatrix(skills, {
    categories: {
      ["framework"]: {
        id: "framework",
        name: "Framework",
        description: "UI Frameworks",
        exclusive: false,
        required: false,
        order: 1,
      },
      ["client-state"]: {
        id: "client-state",
        name: "State",
        description: "State management",
        exclusive: false,
        required: false,
        order: 2,
      },
      ["testing"]: {
        id: "testing",
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
  // Stack Path
  // ===========================================================================

  describe("stack path", () => {
    it("should render stack name in title", () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          matrix={mockMatrix}
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
          installMode="plugin"
          onBack={onBack}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Ready to install nextjs-fullstack");
    });

    it("should show technology count", () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          matrix={mockMatrix}
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
          installMode="plugin"
          onBack={onBack}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Technologies:");
      expect(output).toContain("12");
    });

    it("should show skill count with verified label", () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          matrix={mockMatrix}
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
          installMode="plugin"
          onBack={onBack}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Skills:");
      expect(output).toContain("(all verified)");
    });

    it("should show install mode as Plugin", () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          matrix={mockMatrix}
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
          installMode="plugin"
          onBack={onBack}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Install mode:");
      expect(output).toContain("Plugin");
    });

    it("should show install mode as Local", () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          matrix={mockMatrix}
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
          installMode="local"
          onBack={onBack}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Install mode:");
      expect(output).toContain("Local");
    });

    it("should render confirm step content", () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          matrix={mockMatrix}
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
          installMode="plugin"
          onBack={onBack}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Ready to install");
    });
  });

  // ===========================================================================
  // Scratch Path
  // ===========================================================================

  describe("scratch path", () => {
    it("should render custom stack title with domain names", () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          matrix={mockMatrix}
          onComplete={onComplete}
          selectedDomains={["web", "api"]}
          domainSelections={{
            web: { framework: ["react"], styling: ["scss-modules"] },
            api: { api: ["hono"] },
          }}
          technologyCount={3}
          skillCount={3}
          installMode="local"
          onBack={onBack}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Ready to install your custom stack");
      expect(output).toContain("Web + API");
    });

    it("should show domain breakdown with technologies", () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          matrix={mockMatrix}
          onComplete={onComplete}
          selectedDomains={["web", "api"]}
          domainSelections={{
            web: { framework: ["react"], styling: ["scss-modules"] },
            api: { api: ["hono"] },
          }}
          technologyCount={3}
          skillCount={3}
          installMode="local"
          onBack={onBack}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Web:");
      expect(output).toContain("react");
      expect(output).toContain("scss-modules");
      expect(output).toContain("API:");
      expect(output).toContain("hono");
    });

    it("should handle single domain without plus sign", () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          matrix={mockMatrix}
          onComplete={onComplete}
          selectedDomains={["web"]}
          domainSelections={{
            web: { framework: ["react"] },
          }}
          technologyCount={1}
          skillCount={1}
          installMode="local"
          onBack={onBack}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("(Web)");
      expect(output).not.toContain("+");
    });

    it("should skip domains with no selections", () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          matrix={mockMatrix}
          onComplete={onComplete}
          selectedDomains={["web", "api"]}
          domainSelections={{
            web: { framework: ["react"] },
            api: {}, // Empty selections
          }}
          technologyCount={1}
          skillCount={1}
          installMode="local"
          onBack={onBack}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Web:");
      expect(output).toContain("react");
      // API section should not appear since no technologies selected
      const lines = output?.split("\n") || [];
      const apiLine = lines.find((line) => line.includes("API:") && line.includes("hono"));
      expect(apiLine).toBeUndefined();
    });
  });

  // ===========================================================================
  // Keyboard Navigation
  // ===========================================================================

  describe("keyboard navigation", () => {
    it("should call onComplete when Enter is pressed", async () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { stdin, unmount } = render(
        <StepConfirm
          matrix={mockMatrix}
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
          installMode="plugin"
          onBack={onBack}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ENTER);
      await delay(RENDER_DELAY_MS);

      expect(onComplete).toHaveBeenCalled();
    });

    it("should call onBack when Escape is pressed", async () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { stdin, unmount } = render(
        <StepConfirm
          matrix={mockMatrix}
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
          installMode="plugin"
          onBack={onBack}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ESCAPE);
      await delay(RENDER_DELAY_MS);

      expect(onBack).toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should not call onBack when Escape is pressed but onBack is not provided", async () => {
      const onComplete = vi.fn();

      const { stdin, unmount } = render(
        <StepConfirm
          matrix={mockMatrix}
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
          installMode="plugin"
          // No onBack provided
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ESCAPE);
      await delay(RENDER_DELAY_MS);

      // Should not crash and onComplete should not be called
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Default Props
  // ===========================================================================

  describe("default props", () => {
    it("should render custom stack title when no stack name provided", () => {
      const onComplete = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Ready to install your custom stack");
    });

    it("should not show stats when not provided", () => {
      const onComplete = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm matrix={mockMatrix} onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).not.toContain("Technologies:");
      expect(output).not.toContain("Skills:");
      expect(output).not.toContain("Install mode:");
    });
  });
});
