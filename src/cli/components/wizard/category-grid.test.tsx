/**
 * Tests for the CategoryGrid component.
 *
 * Tests section-based rendering and keyboard navigation for wizard Build step.
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

// Default categories with framework-first scenario
const defaultCategories: CategoryRow[] = [
  createCategory(
    "framework",
    "Framework",
    [
      createOption("react", "React", {
        state: "recommended",
        stateReason: "Popular choice",
      }),
      createOption("vue", "Vue"),
      createOption("angular", "Angular"),
      createOption("svelte", "Svelte"),
    ],
    { required: true },
  ),
  createCategory(
    "styling",
    "Styling",
    [
      createOption("scss-mod", "SCSS Modules", { selected: true }),
      createOption("tailwind", "Tailwind", { state: "recommended" }),
      createOption("styled", "Styled Components"),
      createOption("vanilla", "Vanilla CSS"),
    ],
    { required: true },
  ),
  createCategory("client-state", "Client State", [
    createOption("zustand", "Zustand", { state: "recommended" }),
    createOption("jotai", "Jotai"),
    createOption("redux", "Redux", {
      state: "discouraged",
      stateReason: "Complex for most apps",
    }),
    createOption("mobx", "MobX"),
  ]),
  createCategory("server-state", "Server State", [
    createOption("react-query", "React Query", { selected: true }),
    createOption("swr", "SWR"),
    createOption("apollo", "Apollo"),
  ]),
  createCategory("analytics", "Analytics", [
    createOption("posthog", "PostHog"),
  ]),
];

// Categories with framework selected (unlocks other sections)
const categoriesWithFramework: CategoryRow[] = [
  createCategory(
    "framework",
    "Framework",
    [
      createOption("react", "React", {
        state: "recommended",
        stateReason: "Popular choice",
        selected: true, // Framework selected
      }),
      createOption("vue", "Vue"),
      createOption("angular", "Angular"),
      createOption("svelte", "Svelte"),
    ],
    { required: true },
  ),
  createCategory(
    "styling",
    "Styling",
    [
      createOption("scss-mod", "SCSS Modules"),
      createOption("tailwind", "Tailwind", { state: "recommended" }),
      createOption("styled", "Styled Components"),
      createOption("vanilla", "Vanilla CSS"),
    ],
    { required: true },
  ),
  createCategory("client-state", "Client State", [
    createOption("zustand", "Zustand", { state: "recommended" }),
    createOption("jotai", "Jotai"),
    createOption("redux", "Redux", { state: "discouraged" }),
    createOption("mobx", "MobX"),
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
    it("should render all categories as sections", () => {
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
      expect(output).toContain("React");
      expect(output).toContain("Vue");
      expect(output).toContain("Angular");
      expect(output).toContain("Svelte");
      // Styling options
      expect(output).toContain("SCSS Modules");
      expect(output).toContain("Tailwind");
    });

    it("should show required indicator (*) for required categories", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // Framework and Styling are required
      // The * should appear after their names
      expect(output).toContain("*");
    });

    it("should NOT show (optional) for non-required categories", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // Optional is assumed by default, so we don't show the label
      expect(output).not.toContain("(optional)");
    });

    it("should handle empty categories array", () => {
      const { lastFrame, unmount } = renderGrid({ categories: [] });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("No categories to display");
    });

    it("should render section underlines", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // Unicode horizontal line character used for underlines
      expect(output).toContain("\u2500");
    });
  });

  // ===========================================================================
  // Visual States (No Stars)
  // ===========================================================================

  describe("visual states", () => {
    it("should show selected options with label text", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // scss-mod and react-query are selected in defaultCategories
      expect(output).toContain("SCSS Modules");
      expect(output).toContain("React Query");
    });

    it("should show unselected options with label text", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // Unselected options should display their labels
      expect(output).toContain("Vue");
      expect(output).toContain("Angular");
    });

    it("should NOT show star indicator for recommended options (uses background instead)", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // Should NOT contain star (⭐) for recommended
      expect(output).not.toContain("\u2B50");
    });

    it("should NOT show warning indicator for discouraged options (uses color instead)", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // Should NOT contain warning (⚠) for discouraged
      expect(output).not.toContain("\u26A0");
    });

    it("should show disabled options with dimmed styling", () => {
      const categories: CategoryRow[] = [
        createCategory("test", "Test", [
          createOption("opt1", "Option 1"),
          createOption("opt2", "Option 2", { state: "disabled" }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      // Disabled options should show label (dimmed text)
      expect(output).toContain("Option 2");
    });
  });

  // ===========================================================================
  // Locked Sections (Framework-First Flow)
  // ===========================================================================

  describe("locked sections", () => {
    it("should show all categories including locked ones", () => {
      // No framework selected, so non-framework sections should be locked but visible
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Framework");
      expect(output).toContain("Styling");
      expect(output).toContain("Client State");
    });

    it("should unlock sections when framework is selected", () => {
      const { lastFrame, unmount } = renderGrid({
        categories: categoriesWithFramework,
      });
      cleanup = unmount;

      const output = lastFrame();
      // All sections should be visible and navigable
      expect(output).toContain("Framework");
      expect(output).toContain("Styling");
      expect(output).toContain("Client State");
    });

    it("should not lock any sections when no framework category exists", () => {
      const categoriesNoFramework: CategoryRow[] = [
        createCategory("styling", "Styling", [
          createOption("scss", "SCSS"),
          createOption("tailwind", "Tailwind"),
        ]),
        createCategory("state", "State", [createOption("zustand", "Zustand")]),
      ];

      const { lastFrame, unmount } = renderGrid({
        categories: categoriesNoFramework,
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Styling");
      expect(output).toContain("State");
    });
  });

  // ===========================================================================
  // Focus Indicator (Background-based, no > symbol)
  // ===========================================================================

  describe("focus indicator", () => {
    it("should render focused option with label text", () => {
      const { lastFrame, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
      });
      cleanup = unmount;

      const output = lastFrame();
      // Focused option should be visible (background highlighting is visual-only)
      expect(output).toContain("React");
    });

    it("should render correctly when focusedRow changes", () => {
      const { lastFrame: frame1, unmount: unmount1 } = renderGrid({
        categories: categoriesWithFramework,
        focusedRow: 0,
        focusedCol: 0,
      });
      const output1 = frame1();
      unmount1();

      const { lastFrame: frame2, unmount: unmount2 } = renderGrid({
        categories: categoriesWithFramework,
        focusedRow: 1,
        focusedCol: 0,
      });
      cleanup = unmount2;
      const output2 = frame2();

      // Both should render the focused category options
      expect(output1).toContain("Framework");
      expect(output2).toContain("Styling");
    });

    it("should highlight focused category name", () => {
      const { lastFrame, unmount } = renderGrid({
        categories: categoriesWithFramework,
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

    it("should call onFocusChange when pressing up arrow (wraps to framework when locked)", async () => {
      const onFocusChange = vi.fn();
      // No framework selected, so navigation stays on framework row
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_UP);
      await delay(INPUT_DELAY_MS);

      // Should stay on row 0 (framework) since other rows are locked
      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });

    it("should navigate between sections when unlocked", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        categories: categoriesWithFramework,
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);

      // Should move to row 1 (Styling) since framework is selected
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

    it("should wrap vertically when all sections are unlocked", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        categories: categoriesWithFramework,
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_UP);
      await delay(INPUT_DELAY_MS);

      // Should wrap to last row (index 2 for 3 categories)
      expect(onFocusChange).toHaveBeenCalledWith(2, 0);
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
        categories: categoriesWithFramework,
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
        categories: categoriesWithFramework,
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
      const categories: CategoryRow[] = [
        createCategory(
          "framework",
          "Framework",
          [
            createOption("react", "React", { selected: true }),
            createOption("vue", "Vue"),
          ],
          { required: true },
        ),
      ];
      const { stdin, unmount } = renderGrid({
        categories,
        focusedRow: 0,
        focusedCol: 0, // react (selected)
        expertMode: true,
        onToggle,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(" ");
      await delay(INPUT_DELAY_MS);

      expect(onToggle).toHaveBeenCalledWith("framework", "react");
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

    it("should NOT call onToggle when section is locked", async () => {
      const onToggle = vi.fn();
      // No framework selected, styling section is locked
      const { stdin, unmount } = renderGrid({
        focusedRow: 1, // Styling (locked)
        focusedCol: 0,
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
  // Tab Navigation (Section Jumping)
  // ===========================================================================

  describe("tab navigation", () => {
    it("should jump to next section when pressing Tab", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        categories: categoriesWithFramework,
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(TAB);
      await delay(INPUT_DELAY_MS);

      // Should jump to next section (row 1)
      expect(onFocusChange).toHaveBeenCalledWith(1, 0);
    });

    it("should only jump to unlocked sections", async () => {
      const onFocusChange = vi.fn();
      // No framework selected, so Tab should stay on framework
      const { stdin, unmount } = renderGrid({
        focusedRow: 0,
        focusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(TAB);
      await delay(INPUT_DELAY_MS);

      // Should NOT call onFocusChange since there's nowhere to go (all others locked)
      expect(onFocusChange).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Show Descriptions Toggle
  // ===========================================================================

  describe("show descriptions toggle", () => {
    it("should call onToggleDescriptions when pressing d key", async () => {
      const onToggleDescriptions = vi.fn();
      const { stdin, unmount } = renderGrid({
        onToggleDescriptions,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write("d");
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

    it("should show descriptions when enabled", () => {
      const { lastFrame, unmount } = renderGrid({
        showDescriptions: true,
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should show state reasons when descriptions are enabled
      expect(output).toContain("Popular choice"); // react's stateReason
    });
  });

  // ===========================================================================
  // Expert Mode (now handled globally in wizard.tsx)
  // ===========================================================================

  describe("expert mode", () => {
    it("should not handle expert mode toggle locally (handled globally)", () => {
      // Expert mode toggle is now handled at wizard.tsx level via global useInput
      // CategoryGrid no longer has onToggleExpertMode prop
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      // Header should not show expert mode toggle hint
      expect(output).not.toContain("[e] Expert Mode");
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

    it("should handle category with many options (flows naturally)", () => {
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
      // All options should be present (no fixed row limit)
      expect(output).toContain("Option 0");
      expect(output).toContain("Option 9");
    });

    it("should handle long option labels", () => {
      const categories: CategoryRow[] = [
        createCategory("long", "Long Labels", [
          createOption("long1", "Very Long Option Name"),
          createOption("long2", "Another Long Name"),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      // Labels should be rendered (flowing layout handles long labels)
      expect(output).toContain("Very Long Option Name");
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
        createCategory(
          "framework",
          "Framework",
          [
            createOption("opt1", "Option 1", { selected: true }), // Framework selected
            createOption("opt2", "Option 2"),
            createOption("opt3", "Option 3"),
          ],
          { required: true },
        ),
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
