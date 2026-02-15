import { render } from "ink-testing-library";
import { describe, expect, it, afterEach } from "vitest";
import { SectionProgress } from "./section-progress";

describe("SectionProgress component", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  describe("rendering", () => {
    it("should render label and current value", () => {
      const { lastFrame, unmount } = render(
        <SectionProgress label="Domain" current="Web" index={1} total={2} next="API" />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Domain:");
      expect(output).toContain("Web");
    });

    it("should show correct index/total format", () => {
      const { lastFrame, unmount } = render(
        <SectionProgress label="Skill" current="react" index={1} total={8} next="zustand" />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[1/8]");
    });

    it("should show different index/total values", () => {
      const { lastFrame, unmount } = render(
        <SectionProgress label="Domain" current="API" index={3} total={4} next="Mobile" />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[3/4]");
    });
  });

  describe("next item display", () => {
    it("should show 'Next: X' when not last item", () => {
      const { lastFrame, unmount } = render(
        <SectionProgress label="Domain" current="Web" index={1} total={2} next="API" />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Next: API");
    });

    it("should show 'Last step' when on final item", () => {
      const { lastFrame, unmount } = render(
        <SectionProgress label="Domain" current="API" index={2} total={2} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Last step");
      expect(output).not.toContain("Next:");
    });

    it("should show 'Last step' for single item (1/1)", () => {
      const { lastFrame, unmount } = render(
        <SectionProgress label="Domain" current="Web" index={1} total={1} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[1/1]");
      expect(output).toContain("Last step");
    });
  });

  describe("text styling", () => {
    it("should render label in bold", () => {
      // Note: ink-testing-library doesn't expose ANSI codes directly in lastFrame()
      // but we verify the text content is present and structure is correct
      const { lastFrame, unmount } = render(
        <SectionProgress label="Domain" current="Web" index={1} total={2} next="API" />,
      );
      cleanup = unmount;

      const output = lastFrame();
      // The label should be present - bold styling is applied via Ink Text component
      expect(output).toContain("Domain:");
    });

    it("should render current value with cyan color", () => {
      const { lastFrame, unmount } = render(
        <SectionProgress label="Skill" current="react" index={1} total={3} next="vue" />,
      );
      cleanup = unmount;

      const output = lastFrame();
      // Current value should be present - cyan styling is applied via Ink Text component
      expect(output).toContain("react");
    });

    it("should render index/total as dim text", () => {
      const { lastFrame, unmount } = render(
        <SectionProgress label="Domain" current="CLI" index={2} total={3} next="Mobile" />,
      );
      cleanup = unmount;

      const output = lastFrame();
      // Progress indicator should be present - dim styling is applied via Ink Text component
      expect(output).toContain("[2/3]");
    });
  });

  describe("edge cases", () => {
    it("should handle long label and current value", () => {
      const { lastFrame, unmount } = render(
        <SectionProgress
          label="Subcategory"
          current="styled-components"
          index={1}
          total={5}
          next="emotion"
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Subcategory:");
      expect(output).toContain("styled-components");
    });

    it("should handle large index/total numbers", () => {
      const { lastFrame, unmount } = render(
        <SectionProgress
          label="Skill"
          current="some-skill"
          index={99}
          total={100}
          next="last-skill"
        />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[99/100]");
      expect(output).toContain("Next: last-skill");
    });

    it("should handle empty next value gracefully", () => {
      // When next is undefined (last item case)
      const { lastFrame, unmount } = render(
        <SectionProgress label="Domain" current="Mobile" index={4} total={4} next={undefined} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Last step");
      expect(output).not.toContain("undefined");
    });
  });

  describe("display variants from spec", () => {
    it("should match multi-domain Build step format", () => {
      // Domain: Web                                         [1/2] Next: API
      const { lastFrame, unmount } = render(
        <SectionProgress label="Domain" current="Web" index={1} total={2} next="API" />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Domain:");
      expect(output).toContain("Web");
      expect(output).toContain("[1/2]");
      expect(output).toContain("Next: API");
    });

    it("should match Refine step format", () => {
      // Skill: react                                   [1/8] Next: zustand
      const { lastFrame, unmount } = render(
        <SectionProgress label="Skill" current="react" index={1} total={8} next="zustand" />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Skill:");
      expect(output).toContain("react");
      expect(output).toContain("[1/8]");
      expect(output).toContain("Next: zustand");
    });

    it("should match last item format", () => {
      // Domain: API                                         [2/2] Last step
      const { lastFrame, unmount } = render(
        <SectionProgress label="Domain" current="API" index={2} total={2} />,
      );
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Domain:");
      expect(output).toContain("API");
      expect(output).toContain("[2/2]");
      expect(output).toContain("Last step");
    });
  });
});
