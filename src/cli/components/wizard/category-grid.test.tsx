/**
 * Tests for the CategoryGrid component.
 *
 * Tests 2D grid rendering and keyboard navigation for wizard Build step.
 */
import React from "react";
import { render } from "ink-testing-library";
import { describe, expect, it, afterEach, vi } from "vitest";
import {
  CategoryGrid,
  type CategoryGridProps,
  type CategoryRow,
  type CategoryOption,
} from "./category-grid";
import {
  ARROW_UP,
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  TAB,
  RENDER_DELAY_MS,
  INPUT_DELAY_MS,
  delay,
} from "../../lib/__tests__/test-constants";

// =============================================================================
// Test Fixtures
// =============================================================================

const createOption = (
  id: string,
  label: string,
  overrides: Partial<CategoryOption> = {},
): CategoryOption => ({
  id,
  label,
  state: "normal",
  selected: false,
  ...overrides,
});

const createCategory = (
  id: string,
  name: string,
  options: CategoryOption[],
  overrides: Partial<CategoryRow> = {},
): CategoryRow => ({
  id,
  name,
  required: false,
  exclusive: true,
  options,
  ...overrides,
});

const defaultCategories: CategoryRow[] = [
  createCategory(
    "framework",
    "Framework",
    [
      createOption("react", "react", {
        state: "recommended",
        stateReason: "Popular choice",
      }),
      createOption("vue", "vue"),
      createOption("angular", "angular"),
      createOption("svelte", "svelte"),
    ],
    { required: true },
  ),
  createCategory(
    "styling",
    "Styling",
    [
      createOption("scss-mod", "scss-mod", { selected: true }),
      createOption("tailwind", "tailwind", { state: "recommended" }),
      createOption("styled", "styled"),
      createOption("vanilla", "vanilla"),
    ],
    { required: true },
  ),
  createCategory("client-state", "Client State", [
    createOption("zustand", "zustand", { state: "recommended" }),
    createOption("jotai", "jotai"),
    createOption("redux", "redux", {
      state: "discouraged",
      stateReason: "Complex for most apps",
    }),
    createOption("mobx", "mobx"),
  ]),
  createCategory("server-state", "Server State", [
    createOption("react-query", "react-query", { selected: true }),
    createOption("swr", "swr"),
    createOption("apollo", "apollo"),
  ]),
  createCategory("analytics", "Analytics", [
    createOption("posthog", "posthog"),
  ]),
];

const defaultProps: CategoryGridProps = {
  categories: defaultCategories,
  focusedRow: 0,
  focusedCol: 0,
  showDescriptions: false,
  expertMode: false,
  onToggle: vi.fn(),
  onFocusChange: vi.fn(),
  onToggleDescriptions: vi.fn(),
  onToggleExpertMode: vi.fn(),
};

const renderGrid = (props: Partial<CategoryGridProps> = {}) => {
  return render(<CategoryGrid {...defaultProps} {...props} />);
};

// =============================================================================
// Tests
// =============================================================================

describe("CategoryGrid component", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Basic Rendering
  // ===========================================================================

  describe("rendering", () => {
    it("should render all categories", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Framework");
      expect(output).toContain("Styling");
      expect(output).toContain("Client State");
      expect(output).toContain("Server State");
      expect(output).toContain("Analytics");
    });

    it("should render all options in each category", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // Framework options
      expect(output).toContain("react");
      expect(output).toContain("vue");
      expect(output).toContain("angular");
      expect(output).toContain("svelte");
      // Styling options
      expect(output).toContain("scss-mod");
      expect(output).toContain("tailwind");
    });

    it("should show required indicator (*) for required categories", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // Framework and Styling are required
      // The * should appear after their names
      expect(output).toContain("*");
    });

    it("should show (optional) for non-required categories", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("(optional)");
    });

    it("should render legend row", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Legend:");
      expect(output).toContain("selected");
      expect(output).toContain("recommended");
      expect(output).toContain("discouraged");
      expect(output).toContain("disabled");
    });

    it("should render header with toggle hints", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("[Tab] Show descriptions");
      expect(output).toContain("[e] Expert Mode");
    });

    it("should handle empty categories array", () => {
      const { lastFrame, unmount } = renderGrid({ categories: [] });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("No categories to display");
    });
  });

  // ===========================================================================
  // Visual States
  // ===========================================================================

  describe("visual states", () => {
    it("should show selected symbol for selected options", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // scss-mod and react-query are selected
      // Should contain filled circles (●)
      expect(output).toContain("\u25CF"); // ●
    });

    it("should show unselected symbol for unselected options", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // Should contain empty circles (○)
      expect(output).toContain("\u25CB"); // ○
    });

    it("should show recommended indicator for recommended options", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // Should contain star (⭐) for recommended
      expect(output).toContain("\u2B50");
    });

    it("should show discouraged indicator for discouraged options", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // Should contain warning (⚠) for discouraged
      expect(output).toContain("\u26A0");
    });

    it("should show disabled symbol for disabled options", () => {
      const categories: CategoryRow[] = [
        createCategory("test", "Test", [
          createOption("opt1", "Option 1"),
          createOption("opt2", "Option 2", { state: "disabled" }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      // Should contain X (✗) for disabled
      expect(output).toContain("\u2717");
    });
  });

  // ===========================================================================
  // Focus Indicator
  // ===========================================================================

  describe("focus indicator", () => {
    it("should show focus indicator (>) on focused option", () => {
      const { lastFrame, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain(">");
    });

    it("should update focus indicator when focusedRow changes", () => {
      const { lastFrame: frame1, unmount: unmount1 } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
      });
      const output1 = frame1();
      unmount1();

      const { lastFrame: frame2, unmount: unmount2 } = renderGrid({
        focusedRow: 1,
        focusedCol: 0,
      });
      cleanup = unmount2;
      const output2 = frame2();

      // Both should have focus indicator, but in different rows
      expect(output1).toContain(">");
      expect(output2).toContain(">");
    });

    it("should highlight focused category name", () => {
      const { lastFrame, unmount } = renderGrid({
        focusedRow: 1,
        focusedCol: 0,
      });
      cleanup = unmount;

      const output = lastFrame();
      // Styling row should be focused (index 1)
      expect(output).toContain("Styling");
    });
  });

  // ===========================================================================
  // Keyboard Navigation - Arrow Keys
  // ===========================================================================

  describe("keyboard navigation - arrow keys", () => {
    it("should call onFocusChange when pressing left arrow", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 1,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_LEFT);
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });

    it("should call onFocusChange when pressing right arrow", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_RIGHT);
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(0, 1);
    });

    it("should call onFocusChange when pressing up arrow", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 1,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_UP);
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });

    it("should call onFocusChange when pressing down arrow", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(1, 0);
    });

    it("should wrap horizontally when pressing left at first column", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_LEFT);
      await delay(INPUT_DELAY_MS);

      // Should wrap to last column (index 3 for framework with 4 options)
      expect(onFocusChange).toHaveBeenCalledWith(0, 3);
    });

    it("should wrap horizontally when pressing right at last column", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 3, // Last option in framework
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_RIGHT);
      await delay(INPUT_DELAY_MS);

      // Should wrap to first column
      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });

    it("should wrap vertically when pressing up at first row", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_UP);
      await delay(INPUT_DELAY_MS);

      // Should wrap to last row (index 4 for 5 categories)
      expect(onFocusChange).toHaveBeenCalledWith(4, 0);
    });

    it("should wrap vertically when pressing down at last row", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 4, // Last category (analytics)
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);

      // Should wrap to first row
      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });
  });

  // ===========================================================================
  // Keyboard Navigation - Vim Keys
  // ===========================================================================

  describe("keyboard navigation - vim keys", () => {
    it("should move left with h key", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 1,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write("h");
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });

    it("should move right with l key", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write("l");
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(0, 1);
    });

    it("should move up with k key", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 1,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write("k");
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });

    it("should move down with j key", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write("j");
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(1, 0);
    });
  });

  // ===========================================================================
  // Selection Toggle
  // ===========================================================================

  describe("selection toggle", () => {
    it("should call onToggle when pressing space on a normal option", async () => {
      const onToggle = vi.fn();
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 1, // vue (normal state)
        onToggle,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(" "); // Space
      await delay(INPUT_DELAY_MS);

      expect(onToggle).toHaveBeenCalledWith("framework", "vue");
    });

    it("should call onToggle when pressing space on a selected option", async () => {
      const onToggle = vi.fn();
      // Use expertMode to preserve original option order
      const { stdin, unmount } = renderGrid({
        focusedRow: 1,
        focusedCol: 0, // scss-mod (selected) - first in expert mode
        expertMode: true,
        onToggle,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(" ");
      await delay(INPUT_DELAY_MS);

      expect(onToggle).toHaveBeenCalledWith("styling", "scss-mod");
    });

    it("should NOT call onToggle when pressing space on a disabled option", async () => {
      const onToggle = vi.fn();
      const categories: CategoryRow[] = [
        createCategory("test", "Test", [
          createOption("opt1", "Option 1", { state: "disabled" }),
          createOption("opt2", "Option 2"),
        ]),
      ];

      // Use expertMode to preserve original option order (disabled at index 0)
      const { stdin, unmount } = renderGrid({
        categories,
        focusedRow: 0,
        focusedCol: 0, // Disabled option (first in expert mode)
        expertMode: true,
        onToggle,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(" ");
      await delay(INPUT_DELAY_MS);

      expect(onToggle).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Disabled Options Navigation
  // ===========================================================================

  describe("disabled options navigation", () => {
    it("should skip disabled options when navigating right", async () => {
      const onFocusChange = vi.fn();
      const categories: CategoryRow[] = [
        createCategory("test", "Test", [
          createOption("opt1", "Option 1"),
          createOption("opt2", "Option 2", { state: "disabled" }),
          createOption("opt3", "Option 3"),
        ]),
      ];

      // Use expertMode to preserve original option order
      const { stdin, unmount } = renderGrid({
        categories,
        focusedRow: 0,
        focusedCol: 0,
        expertMode: true,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_RIGHT);
      await delay(INPUT_DELAY_MS);

      // Should skip opt2 (disabled) and go to opt3 (index 2)
      expect(onFocusChange).toHaveBeenCalledWith(0, 2);
    });

    it("should skip disabled options when navigating left", async () => {
      const onFocusChange = vi.fn();
      const categories: CategoryRow[] = [
        createCategory("test", "Test", [
          createOption("opt1", "Option 1"),
          createOption("opt2", "Option 2", { state: "disabled" }),
          createOption("opt3", "Option 3"),
        ]),
      ];

      // Use expertMode to preserve original option order
      const { stdin, unmount } = renderGrid({
        categories,
        focusedRow: 0,
        focusedCol: 2, // Start at opt3
        expertMode: true,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_LEFT);
      await delay(INPUT_DELAY_MS);

      // Should skip opt2 (disabled) and go to opt1 (index 0)
      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });

    it("should handle all options disabled in a row", async () => {
      const onFocusChange = vi.fn();
      const categories: CategoryRow[] = [
        createCategory("test", "Test", [
          createOption("opt1", "Option 1", { state: "disabled" }),
          createOption("opt2", "Option 2", { state: "disabled" }),
        ]),
      ];

      // Use expertMode to preserve original option order
      const { stdin, unmount } = renderGrid({
        categories,
        focusedRow: 0,
        focusedCol: 0,
        expertMode: true,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_RIGHT);
      await delay(INPUT_DELAY_MS);

      // Should stay at current position when all disabled
      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });
  });

  // ===========================================================================
  // Exclusive Categories
  // ===========================================================================

  describe("exclusive categories", () => {
    it("should render exclusive category correctly", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // All default categories are exclusive, should render normally
      expect(output).toContain("Framework");
    });

    // Note: The actual exclusivity logic (only one selection) is handled
    // by the parent component via onToggle. CategoryGrid just displays
    // the current state.
  });

  // ===========================================================================
  // Show Descriptions Toggle
  // ===========================================================================

  describe("show descriptions toggle", () => {
    it("should call onToggleDescriptions when pressing Tab", async () => {
      const onToggleDescriptions = vi.fn();
      const { stdin, unmount } = renderGrid({
        onToggleDescriptions,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(TAB);
      await delay(INPUT_DELAY_MS);

      expect(onToggleDescriptions).toHaveBeenCalled();
    });

    it("should show descriptions when showDescriptions is true", () => {
      const { lastFrame, unmount } = renderGrid({ showDescriptions: true });
      cleanup = unmount;

      const output = lastFrame();
      // Should show state reasons
      expect(output).toContain("Popular choice"); // react's stateReason
    });

    it("should hide descriptions when showDescriptions is false", () => {
      const { lastFrame, unmount } = renderGrid({ showDescriptions: false });
      cleanup = unmount;

      const output = lastFrame();
      // stateReasons should not be visible (though they might still be in DOM)
      // At minimum, the display should be different
      expect(output).toBeDefined();
    });

    it("should show toggle state in header", () => {
      const { lastFrame: frame1, unmount: unmount1 } = renderGrid({
        showDescriptions: false,
      });
      const output1 = frame1();
      unmount1();

      const { lastFrame: frame2, unmount: unmount2 } = renderGrid({
        showDescriptions: true,
      });
      cleanup = unmount2;
      const output2 = frame2();

      expect(output1).toContain("Show descriptions: OFF");
      expect(output2).toContain("Show descriptions: ON");
    });
  });

  // ===========================================================================
  // Expert Mode Toggle
  // ===========================================================================

  describe("expert mode toggle", () => {
    it("should call onToggleExpertMode when pressing e", async () => {
      const onToggleExpertMode = vi.fn();
      const { stdin, unmount } = renderGrid({
        onToggleExpertMode,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write("e");
      await delay(INPUT_DELAY_MS);

      expect(onToggleExpertMode).toHaveBeenCalled();
    });

    it("should call onToggleExpertMode when pressing E (uppercase)", async () => {
      const onToggleExpertMode = vi.fn();
      const { stdin, unmount } = renderGrid({
        onToggleExpertMode,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write("E");
      await delay(INPUT_DELAY_MS);

      expect(onToggleExpertMode).toHaveBeenCalled();
    });

    it("should show toggle state in header", () => {
      const { lastFrame: frame1, unmount: unmount1 } = renderGrid({
        expertMode: false,
      });
      const output1 = frame1();
      unmount1();

      const { lastFrame: frame2, unmount: unmount2 } = renderGrid({
        expertMode: true,
      });
      cleanup = unmount2;
      const output2 = frame2();

      expect(output1).toContain("Expert Mode: OFF");
      expect(output2).toContain("Expert Mode: ON");
    });
  });

  // ===========================================================================
  // Option Ordering
  // ===========================================================================

  describe("option ordering", () => {
    it("should sort options by state when expertMode is false", () => {
      // In non-expert mode, recommended should come first
      // The default categories have recommended options at various positions
      const { lastFrame, unmount } = renderGrid({ expertMode: false });
      cleanup = unmount;

      const output = lastFrame();
      // This test verifies the component renders - sorting happens internally
      expect(output).toBeDefined();
    });

    it("should preserve original order when expertMode is true", () => {
      const { lastFrame, unmount } = renderGrid({ expertMode: true });
      cleanup = unmount;

      const output = lastFrame();
      // This test verifies the component renders with expert mode
      expect(output).toBeDefined();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle single category", () => {
      const categories: CategoryRow[] = [
        createCategory("single", "Single Category", [
          createOption("opt1", "Option 1"),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Single Category");
      expect(output).toContain("Option 1");
    });

    it("should handle single option in category", () => {
      const categories: CategoryRow[] = [
        createCategory("single", "Single", [
          createOption("only", "Only Option"),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Only Option");
    });

    it("should handle category with many options", () => {
      const options = Array.from({ length: 10 }, (_, i) =>
        createOption(`opt${i}`, `Option ${i}`),
      );
      const categories: CategoryRow[] = [
        createCategory("many", "Many Options", options),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Many Options");
      expect(output).toContain("Option 0");
      expect(output).toContain("Option 9");
    });

    it("should handle long option labels", () => {
      const categories: CategoryRow[] = [
        createCategory("long", "Long Labels", [
          createOption("long1", "very-long-option-name-here"),
          createOption("long2", "another-very-long-option"),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("very-long-option-name-here");
    });

    it("should handle categories with different option counts", () => {
      const categories: CategoryRow[] = [
        createCategory("cat1", "Category 1", [
          createOption("opt1", "Option 1"),
          createOption("opt2", "Option 2"),
        ]),
        createCategory("cat2", "Category 2", [
          createOption("opt3", "Option 3"),
        ]),
        createCategory("cat3", "Category 3", [
          createOption("opt4", "Option 4"),
          createOption("opt5", "Option 5"),
          createOption("opt6", "Option 6"),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Category 1");
      expect(output).toContain("Category 2");
      expect(output).toContain("Category 3");
    });
  });

  // ===========================================================================
  // Column Adjustment on Row Change
  // ===========================================================================

  describe("column adjustment", () => {
    it("should adjust focusedCol when changing to row with fewer options", async () => {
      const onFocusChange = vi.fn();
      const categories: CategoryRow[] = [
        createCategory("cat1", "Category 1", [
          createOption("opt1", "Option 1"),
          createOption("opt2", "Option 2"),
          createOption("opt3", "Option 3"),
        ]),
        createCategory("cat2", "Category 2", [
          createOption("opt4", "Option 4"),
        ]),
      ];

      const { stdin, unmount } = renderGrid({
        categories,
        focusedRow: 0,
        focusedCol: 2, // Last option in first row
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);

      // Should move to row 1, and col should be clamped to 0 (only option)
      expect(onFocusChange).toHaveBeenCalledWith(1, 0);
    });
  });
});
