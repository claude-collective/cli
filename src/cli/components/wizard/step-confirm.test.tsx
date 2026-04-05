import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepConfirm } from "./step-confirm";
import { ENTER, ESCAPE, RENDER_DELAY_MS, delay } from "../../lib/__tests__/test-constants";
import { buildAgentConfigs, buildSkillConfigs } from "../../lib/__tests__/helpers";
import { initializeMatrix } from "../../lib/matrix/matrix-provider";
import { WEB_PAIR_MATRIX } from "../../lib/__tests__/mock-data/mock-matrices";
import { useWizardStore } from "../../stores/wizard-store";
import type { SkillConfig } from "../../types/config";

describe("StepConfirm component", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    initializeMatrix(WEB_PAIR_MATRIX);
    useWizardStore.setState({ installedSkillConfigs: null, installedAgentConfigs: null });
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  describe("skills tables", () => {
    it("should show global-scoped skills under Global scope label", () => {
      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={vi.fn()}
          skillConfigs={buildSkillConfigs(["web-framework-react"], { scope: "global" })}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Global");
      expect(output).toContain("React");
    });

    it("should show project-scoped skills under Project scope label", () => {
      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={vi.fn()}
          skillConfigs={buildSkillConfigs(["web-framework-react"], { scope: "project" })}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Project");
      expect(output).toContain("React");
    });

    it("should show both scope labels when both scopes have skills", () => {
      const skillConfigs: SkillConfig[] = [
        ...buildSkillConfigs(["web-framework-react"], { scope: "project" }),
        ...buildSkillConfigs(["web-state-zustand"], { scope: "global" }),
      ];

      const { lastFrame, unmount } = render(
        <StepConfirm onComplete={vi.fn()} skillConfigs={skillConfigs} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Project");
      expect(output).toContain("Global");
    });

    it("should not show Project scope label when no project-scoped skills", () => {
      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={vi.fn()}
          skillConfigs={buildSkillConfigs(["web-framework-react"], { scope: "global" })}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).not.toContain("Project");
      expect(output).toContain("Global");
    });

    it("should not show Global scope label when no global-scoped skills", () => {
      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={vi.fn()}
          skillConfigs={buildSkillConfigs(["web-framework-react"], { scope: "project" })}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Project");
      expect(output).not.toContain("Global");
    });
  });

  describe("eject icon display", () => {
    it("should show eject icon for eject-source skills", () => {
      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={vi.fn()}
          skillConfigs={buildSkillConfigs(["web-framework-react"], { source: "eject" })}
        />,
      );
      cleanup = unmount;

      expect(lastFrame()).toContain("\u23CF");
    });

    it("should not show eject icon for plugin-source skills", () => {
      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={vi.fn()}
          skillConfigs={buildSkillConfigs(["web-framework-react"], { source: "agents-inc" })}
        />,
      );
      cleanup = unmount;

      expect(lastFrame()).not.toContain("\u23CF");
    });
  });

  describe("new item markers - init mode (no prior installation)", () => {
    it("should show + prefix when installedSkillConfigs is absent", () => {
      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={vi.fn()}
          skillConfigs={buildSkillConfigs(["web-framework-react", "web-state-zustand"])}
        />,
      );
      cleanup = unmount;

      const lines = lastFrame()?.split("\n") ?? [];
      const skillLines = lines.filter((line) => line.includes("React") || line.includes("Zustand"));
      for (const line of skillLines) {
        expect(line).toContain("+");
        expect(line).not.toContain("\u2022");
      }
    });

    it("should show + prefix for agents when installedAgentConfigs is absent", () => {
      const { lastFrame, unmount } = render(
        <StepConfirm onComplete={vi.fn()} agentConfigs={buildAgentConfigs(["web-developer"])} />,
      );
      cleanup = unmount;

      const lines = lastFrame()?.split("\n") ?? [];
      const agentLine = lines.find((line) => line.includes("web-developer"));
      expect(agentLine).toBeDefined();
      expect(agentLine).toContain("+");
      expect(agentLine).not.toContain("\u2022");
    });
  });

  describe("new item markers - edit mode", () => {
    it("should show + for a skill not in installedSkillConfigs", () => {
      useWizardStore.setState({ installedSkillConfigs: [] });

      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={vi.fn()}
          skillConfigs={buildSkillConfigs(["web-framework-react"])}
        />,
      );
      cleanup = unmount;

      const lines = lastFrame()?.split("\n") ?? [];
      const reactLine = lines.find((line) => line.includes("React"));
      expect(reactLine).toBeDefined();
      expect(reactLine).toContain("+");
    });

    it("should show bullet for a skill that IS in installedSkillConfigs", () => {
      const configs = buildSkillConfigs(["web-framework-react"]);
      useWizardStore.setState({ installedSkillConfigs: configs });

      const { lastFrame, unmount } = render(
        <StepConfirm onComplete={vi.fn()} skillConfigs={configs} />,
      );
      cleanup = unmount;

      const lines = lastFrame()?.split("\n") ?? [];
      const reactLine = lines.find((line) => line.includes("React"));
      expect(reactLine).toBeDefined();
      expect(reactLine).toContain("\u2022");
      expect(reactLine).not.toMatch(/\+.*React/);
    });

    it("should show mix of + and bullet in same scope", () => {
      const existingConfigs = buildSkillConfigs(["web-framework-react"]);
      const allConfigs: SkillConfig[] = [
        ...existingConfigs,
        ...buildSkillConfigs(["web-state-zustand"]),
      ];
      useWizardStore.setState({ installedSkillConfigs: existingConfigs });

      const { lastFrame, unmount } = render(
        <StepConfirm onComplete={vi.fn()} skillConfigs={allConfigs} />,
      );
      cleanup = unmount;

      const lines = lastFrame()?.split("\n") ?? [];

      const zustandLine = lines.find((line) => line.includes("Zustand"));
      expect(zustandLine).toBeDefined();
      expect(zustandLine).toContain("+");

      const reactLine = lines.find((line) => line.includes("React"));
      expect(reactLine).toBeDefined();
      expect(reactLine).toContain("\u2022");
      expect(reactLine).not.toMatch(/\+.*React/);
    });

    it("should show + on new agent when installedAgentConfigs is empty", () => {
      useWizardStore.setState({ installedAgentConfigs: [] });

      const { lastFrame, unmount } = render(
        <StepConfirm onComplete={vi.fn()} agentConfigs={buildAgentConfigs(["web-developer"])} />,
      );
      cleanup = unmount;

      const lines = lastFrame()?.split("\n") ?? [];
      const agentLine = lines.find((line) => line.includes("web-developer"));
      expect(agentLine).toBeDefined();
      expect(agentLine).toContain("+");
    });

    it("should show bullet on agent that was already in installedAgentConfigs", () => {
      const agents = buildAgentConfigs(["web-developer"]);
      useWizardStore.setState({ installedAgentConfigs: agents });

      const { lastFrame, unmount } = render(
        <StepConfirm onComplete={vi.fn()} agentConfigs={agents} />,
      );
      cleanup = unmount;

      const lines = lastFrame()?.split("\n") ?? [];
      const agentLine = lines.find((line) => line.includes("web-developer"));
      expect(agentLine).toBeDefined();
      expect(agentLine).toContain("\u2022");
      expect(agentLine).not.toMatch(/\+.*web-developer/);
    });
  });

  describe("removed item markers - edit mode", () => {
    it("should show - for a skill in installedSkillConfigs but not in skillConfigs", () => {
      useWizardStore.setState({
        installedSkillConfigs: buildSkillConfigs(["web-framework-react"]),
      });

      const { lastFrame, unmount } = render(<StepConfirm onComplete={vi.fn()} skillConfigs={[]} />);
      cleanup = unmount;

      const lines = lastFrame()?.split("\n") ?? [];
      const reactLine = lines.find((line) => line.includes("React"));
      expect(reactLine).toBeDefined();
      expect(reactLine).toMatch(/-/);
    });

    it("should show - for a removed agent", () => {
      useWizardStore.setState({
        installedAgentConfigs: buildAgentConfigs(["web-developer"]),
      });

      const { lastFrame, unmount } = render(<StepConfirm onComplete={vi.fn()} agentConfigs={[]} />);
      cleanup = unmount;

      const lines = lastFrame()?.split("\n") ?? [];
      const agentLine = lines.find((line) => line.includes("web-developer"));
      expect(agentLine).toBeDefined();
      expect(agentLine).toMatch(/-/);
    });

    it("should show mix of bullet and - items", () => {
      useWizardStore.setState({
        installedSkillConfigs: buildSkillConfigs(["web-framework-react", "web-state-zustand"]),
      });

      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={vi.fn()}
          skillConfigs={buildSkillConfigs(["web-framework-react"])}
        />,
      );
      cleanup = unmount;

      const lines = lastFrame()?.split("\n") ?? [];

      const reactLine = lines.find((line) => line.includes("React"));
      expect(reactLine).toBeDefined();
      expect(reactLine).toContain("\u2022");
      expect(reactLine).not.toMatch(/\+.*React/);
      expect(reactLine).not.toMatch(/-.*React/);

      const zustandLine = lines.find((line) => line.includes("Zustand"));
      expect(zustandLine).toBeDefined();
      expect(zustandLine).toMatch(/-/);
    });

    it("should show scope heading when all skills in scope are removed", () => {
      useWizardStore.setState({
        installedSkillConfigs: buildSkillConfigs(["web-framework-react"], { scope: "global" }),
      });

      const { lastFrame, unmount } = render(<StepConfirm onComplete={vi.fn()} skillConfigs={[]} />);
      cleanup = unmount;

      expect(lastFrame()).toContain("Global");
    });
  });

  describe("agents tables", () => {
    it("should show global agents under Global scope label", () => {
      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={vi.fn()}
          agentConfigs={buildAgentConfigs(["web-developer"], { scope: "global" })}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Global");
      expect(output).toContain("web-developer");
    });

    it("should show project agents under Project scope label", () => {
      const { lastFrame, unmount } = render(
        <StepConfirm
          onComplete={vi.fn()}
          agentConfigs={buildAgentConfigs(["web-developer"], { scope: "project" })}
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Project");
      expect(output).toContain("web-developer");
    });
  });

  describe("keyboard navigation", () => {
    it("should call onComplete when Enter is pressed", async () => {
      const onComplete = vi.fn();

      const { stdin, unmount } = render(
        <StepConfirm
          onComplete={onComplete}
          skillConfigs={buildSkillConfigs(["web-framework-react"])}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ENTER);
      await delay(RENDER_DELAY_MS);

      expect(onComplete).toHaveBeenCalled();
    });

    it("should call onBack when Escape is pressed and onBack provided", async () => {
      const onComplete = vi.fn();
      const onBack = vi.fn();

      const { stdin, unmount } = render(
        <StepConfirm
          onComplete={onComplete}
          skillConfigs={buildSkillConfigs(["web-framework-react"])}
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

    it("should not crash when Escape is pressed but onBack is not provided", async () => {
      const onComplete = vi.fn();

      const { stdin, unmount } = render(
        <StepConfirm
          onComplete={onComplete}
          skillConfigs={buildSkillConfigs(["web-framework-react"])}
        />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ESCAPE);
      await delay(RENDER_DELAY_MS);

      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe("empty state", () => {
    it("should render without crash when no skillConfigs or agentConfigs provided", () => {
      const { lastFrame, unmount } = render(<StepConfirm onComplete={vi.fn()} />);
      cleanup = unmount;

      expect(lastFrame()).toBeDefined();
    });
  });
});
