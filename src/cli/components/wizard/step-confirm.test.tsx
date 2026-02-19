import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepConfirm } from "./step-confirm";
import { useWizardStore } from "../../stores/wizard-store";
import { ENTER, ESCAPE, RENDER_DELAY_MS, delay } from "../../lib/__tests__/test-constants";

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
          onComplete={onComplete}
          selectedDomains={["web"]}
          domainSelections={{
            web: { "web-framework": ["web-framework-react"] },
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
          onComplete={onComplete}
          selectedDomains={["web", "api"]}
          domainSelections={{
            web: { "web-framework": ["web-framework-react"] },
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
