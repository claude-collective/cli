import React from "react";
import { render } from "ink-testing-library";
import { describe, expect, it, afterEach, vi } from "vitest";
import { SourceGrid, type SourceGridProps, type SourceRow, type SourceOption } from "./source-grid";
import type { SkillId } from "../../types";
import {
  ARROW_UP,
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  RENDER_DELAY_MS,
  INPUT_DELAY_MS,
  delay,
} from "../../lib/__tests__/test-constants";

const createSourceOption = (
  id: string,
  label: string,
  overrides: Partial<SourceOption> = {},
): SourceOption => ({
  id,
  label,
  selected: false,
  installed: false,
  ...overrides,
});

const createSourceRow = (
  skillId: SkillId,
  displayName: string,
  options: SourceOption[],
): SourceRow => ({
  skillId,
  displayName,
  options,
});

const defaultRows: SourceRow[] = [
  createSourceRow("web-framework-react", "react", [
    createSourceOption("public", "Public", { selected: true }),
  ]),
  createSourceRow("web-state-zustand", "zustand", [
    createSourceOption("public", "Public", { selected: true }),
  ]),
  createSourceRow("web-testing-vitest", "vitest", [
    createSourceOption("public", "Public", { selected: true }),
  ]),
];

const multiSourceRows: SourceRow[] = [
  createSourceRow("web-framework-react", "react", [
    createSourceOption("public", "Public", { selected: true }),
    createSourceOption("acme-corp", "Acme Corp"),
  ]),
  createSourceRow("web-state-zustand", "zustand", [
    createSourceOption("public", "Public", { selected: true }),
    createSourceOption("acme-corp", "Acme Corp"),
    createSourceOption("internal", "Internal"),
  ]),
];

const defaultProps: SourceGridProps = {
  rows: defaultRows,
  focusedRow: 0,
  focusedCol: 0,
  onSelect: vi.fn(),
  onFocusChange: vi.fn(),
};

const renderGrid = (props: Partial<SourceGridProps> = {}) => {
  return render(<SourceGrid {...defaultProps} {...props} />);
};

describe("SourceGrid component", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  describe("rendering", () => {
    it("should render all skill rows", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("react");
      expect(output).toContain("zustand");
      expect(output).toContain("vitest");
    });

    it("should render source option labels", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Public");
    });

    it("should render multiple source options per row", () => {
      const { lastFrame, unmount } = renderGrid({ rows: multiSourceRows });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Public");
      expect(output).toContain("Acme Corp");
    });

    it("should handle empty rows array", () => {
      const { lastFrame, unmount } = renderGrid({ rows: [] });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("No skills to display");
    });

    it("should render single row", () => {
      const rows: SourceRow[] = [
        createSourceRow("web-framework-react", "react", [
          createSourceOption("public", "Public", { selected: true }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ rows });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("react");
      expect(output).toContain("Public");
    });
  });

  describe("keyboard navigation - vertical", () => {
    it("should move down with arrow down", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(1, 0);
    });

    it("should move up with arrow up", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 1,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ARROW_UP);
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });

    it("should wrap down to first row from last row", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 2, // Last row (Vitest)
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });

    it("should wrap up to last row from first row", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ARROW_UP);
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(2, 0);
    });

    it("should clamp column when moving to row with fewer options", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        rows: multiSourceRows,
        focusedRow: 1, // Zustand has 3 options
        focusedCol: 2, // Internal (index 2)
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ARROW_UP);
      await delay(INPUT_DELAY_MS);

      // React only has 2 options, so col should be clamped to 1
      expect(onFocusChange).toHaveBeenCalledWith(0, 1);
    });
  });

  describe("keyboard navigation - horizontal", () => {
    it("should move right with arrow right", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        rows: multiSourceRows,
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ARROW_RIGHT);
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(0, 1);
    });

    it("should move left with arrow left", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        rows: multiSourceRows,
        focusedRow: 0,
        focusedCol: 1,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ARROW_LEFT);
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });

    it("should wrap right to first column from last column", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        rows: multiSourceRows,
        focusedRow: 0,
        focusedCol: 1, // Last option in React row
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ARROW_RIGHT);
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });

    it("should wrap left to last column from first column", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        rows: multiSourceRows,
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ARROW_LEFT);
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(0, 1);
    });
  });

  describe("selection", () => {
    it("should call onSelect when pressing space", async () => {
      const onSelect = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
        onSelect,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(" ");
      await delay(INPUT_DELAY_MS);

      expect(onSelect).toHaveBeenCalledWith("web-framework-react", "public");
    });

    it("should call onSelect with correct skill and source IDs", async () => {
      const onSelect = vi.fn();
      const { stdin, unmount } = renderGrid({
        rows: multiSourceRows,
        focusedRow: 0,
        focusedCol: 1, // Acme Corp
        onSelect,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(" ");
      await delay(INPUT_DELAY_MS);

      expect(onSelect).toHaveBeenCalledWith("web-framework-react", "acme-corp");
    });

    it("should call onSelect on second row", async () => {
      const onSelect = vi.fn();
      const { stdin, unmount } = renderGrid({
        rows: multiSourceRows,
        focusedRow: 1,
        focusedCol: 2, // Internal
        onSelect,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(" ");
      await delay(INPUT_DELAY_MS);

      expect(onSelect).toHaveBeenCalledWith("web-state-zustand", "internal");
    });
  });

  describe("edge cases", () => {
    it("should handle single option per row", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ARROW_RIGHT);
      await delay(INPUT_DELAY_MS);

      // Should wrap to 0 (only one option)
      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });

    it("should handle many rows", () => {
      const rows: SourceRow[] = Array.from({ length: 10 }, (_, i) =>
        createSourceRow(`web-test-${i}`, `test-${i}`, [
          createSourceOption("public", "Public", { selected: true }),
        ]),
      );

      const { lastFrame, unmount } = renderGrid({ rows });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("test-0");
      expect(output).toContain("test-9");
    });
  });
});
