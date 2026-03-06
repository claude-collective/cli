import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepConfirm } from "./step-confirm";
import { useWizardStore } from "../../stores/wizard-store";
import { ENTER, ESCAPE, RENDER_DELAY_MS, delay } from "../../lib/__tests__/test-constants";
import { buildSkillConfigs } from "../../lib/__tests__/helpers";

describe("StepConfirm component", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    useWizardStore.getState().reset();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  describe("stack path", () => {
    it("should render stack name in title", () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
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
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
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
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
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
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
          skillConfigs={buildSkillConfigs(["web-framework-react", "web-styling-scss-modules"], { source: "agents-inc" })}
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
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
          skillConfigs={buildSkillConfigs(["web-framework-react", "web-styling-scss-modules"])}
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
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
          onBack={onBack}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Ready to install");
    });
  });

  describe("scratch path", () => {
    it("should render custom stack title with domain names", () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={onComplete}
          selectedDomains={["web", "api"]}
          domainSelections={{
            web: {
              "web-framework": ["web-framework-react"],
              "web-styling": ["web-styling-scss-modules"],
            },
            api: { "api-api": ["api-framework-hono"] },
          }}
          technologyCount={3}
          skillCount={3}
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
          onComplete={onComplete}
          selectedDomains={["web", "api"]}
          domainSelections={{
            web: {
              "web-framework": ["web-framework-react"],
              "web-styling": ["web-styling-scss-modules"],
            },
            api: { "api-api": ["api-framework-hono"] },
          }}
          technologyCount={3}
          skillCount={3}
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
          onComplete={onComplete}
          selectedDomains={["web"]}
          domainSelections={{
            web: { "web-framework": ["web-framework-react"] },
          }}
          technologyCount={1}
          skillCount={1}
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
          onComplete={onComplete}
          selectedDomains={["web", "api"]}
          domainSelections={{
            web: { "web-framework": ["web-framework-react"] },
            api: {}, // Empty selections
          }}
          technologyCount={1}
          skillCount={1}
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

  describe("keyboard navigation", () => {
    it("should call onComplete when Enter is pressed", async () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { stdin, unmount } = render(
        <StepConfirm
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
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
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
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
          onComplete={onComplete}
          stackName="nextjs-fullstack"
          technologyCount={12}
          skillCount={12}
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

  describe("install mode display", () => {
    it('should show "Plugin" when all skills use non-local source', () => {
      const onComplete = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={onComplete}
          skillConfigs={buildSkillConfigs(["web-framework-react", "web-styling-scss-modules"], { source: "agents-inc" })}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Install mode:");
      expect(output).toContain("Plugin");
    });

    it('should show "Local (editable copies)" when all skills are local', () => {
      const onComplete = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={onComplete}
          skillConfigs={buildSkillConfigs(["web-framework-react", "web-styling-scss-modules"])}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Install mode:");
      expect(output).toContain("Local (editable copies)");
    });

    it('should show "Mixed" with counts when skills have mixed sources', () => {
      const onComplete = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={onComplete}
          skillConfigs={[
            ...buildSkillConfigs(["web-framework-react"]),
            ...buildSkillConfigs(["web-styling-scss-modules"], { source: "agents-inc" }),
            ...buildSkillConfigs(["web-state-zustand"]),
          ]}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Install mode:");
      expect(output).toContain("Mixed");
      expect(output).toContain("2 local");
      expect(output).toContain("1 plugin");
    });

    it("should not show install mode when skillConfigs is not provided", () => {
      const onComplete = vi.fn();

      const { lastFrame, unmount } = render(
        <StepConfirm onComplete={onComplete} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).not.toContain("Install mode:");
    });
  });

  describe("default props", () => {
    it("should render custom stack title when no stack name provided", () => {
      const onComplete = vi.fn();

      const { lastFrame, unmount } = render(<StepConfirm onComplete={onComplete} />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Ready to install your custom stack");
    });

    it("should not show stats when not provided", () => {
      const onComplete = vi.fn();

      const { lastFrame, unmount } = render(<StepConfirm onComplete={onComplete} />);
      cleanup = unmount;

      const output = lastFrame();
      expect(output).not.toContain("Technologies:");
      expect(output).not.toContain("Skills:");
      expect(output).not.toContain("Install mode:");
    });
  });
});
