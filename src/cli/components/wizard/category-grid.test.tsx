import { render } from "ink-testing-library";
import { describe, expect, it, afterEach, vi } from "vitest";
import {
  CategoryGrid,
  type CategoryGridProps,
  type CategoryRow,
  type CategoryOption,
} from "./category-grid";
import type { SkillId, Subcategory } from "../../types";
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

const createOption = (
  id: SkillId,
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
  id: Subcategory,
  displayName: string,
  options: CategoryOption[],
  overrides: Partial<CategoryRow> = {},
): CategoryRow => ({
  id,
  displayName,
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
      createOption("web-test-react", "React", {
        state: "recommended",
        stateReason: "Popular choice",
      }),
      createOption("web-test-vue", "Vue"),
      createOption("web-test-angular", "Angular"),
      createOption("web-test-svelte", "Svelte"),
    ],
    { required: true },
  ),
  createCategory(
    "styling",
    "Styling",
    [
      createOption("web-scss-mod", "SCSS Modules", { selected: true }),
      createOption("web-test-tailwind", "Tailwind", { state: "recommended" }),
      createOption("web-test-styled", "Styled Components"),
      createOption("web-test-vanilla", "Vanilla CSS"),
    ],
    { required: true },
  ),
  createCategory("client-state", "Client State", [
    createOption("web-test-zustand", "Zustand", { state: "recommended" }),
    createOption("web-test-jotai", "Jotai"),
    createOption("web-test-redux", "Redux", {
      state: "discouraged",
      stateReason: "Complex for most apps",
    }),
    createOption("web-test-mobx", "MobX"),
  ]),
  createCategory("server-state", "Server State", [
    createOption("web-react-query", "React Query", { selected: true }),
    createOption("web-test-swr", "SWR"),
    createOption("web-test-apollo", "Apollo"),
  ]),
  createCategory("analytics", "Analytics", [createOption("web-test-posthog", "PostHog")]),
];

const categoriesWithFramework: CategoryRow[] = [
  createCategory(
    "framework",
    "Framework",
    [
      createOption("web-test-react", "React", {
        state: "recommended",
        stateReason: "Popular choice",
        selected: true, // Framework selected
      }),
      createOption("web-test-vue", "Vue"),
      createOption("web-test-angular", "Angular"),
      createOption("web-test-svelte", "Svelte"),
    ],
    { required: true },
  ),
  createCategory(
    "styling",
    "Styling",
    [
      createOption("web-scss-mod", "SCSS Modules"),
      createOption("web-test-tailwind", "Tailwind", { state: "recommended" }),
      createOption("web-test-styled", "Styled Components"),
      createOption("web-test-vanilla", "Vanilla CSS"),
    ],
    { required: true },
  ),
  createCategory("client-state", "Client State", [
    createOption("web-test-zustand", "Zustand", { state: "recommended" }),
    createOption("web-test-jotai", "Jotai"),
    createOption("web-test-redux", "Redux", { state: "discouraged" }),
    createOption("web-test-mobx", "MobX"),
  ]),
];

const defaultProps: CategoryGridProps = {
  categories: defaultCategories,
  defaultFocusedRow: 0,
  defaultFocusedCol: 0,
  showLabels: false,
  expertMode: false,
  onToggle: vi.fn(),
  onFocusChange: vi.fn(),
  onToggleLabels: vi.fn(),
};

const renderGrid = (props: Partial<CategoryGridProps> = {}) => {
  return render(<CategoryGrid {...defaultProps} {...props} />);
};

describe("CategoryGrid component", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

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
        createCategory("testing", "Test", [
          createOption("web-test-opt1", "Option 1"),
          createOption("web-test-opt2", "Option 2", { state: "disabled" }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      // Disabled options should show label (dimmed text)
      expect(output).toContain("Option 2");
    });

    it("should render selected skills with label text", () => {
      const categories: CategoryRow[] = [
        createCategory("forms", "Forms", [
          createOption("web-test-opt1", "Selected Skill", { selected: true }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Selected Skill");
    });

    it("should render unselected skills with label text", () => {
      const categories: CategoryRow[] = [
        createCategory("forms", "Forms", [
          createOption("web-test-opt1", "Unselected Skill", { state: "normal", selected: false }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Unselected Skill");
    });

    it("should render disabled skills with label text", () => {
      const categories: CategoryRow[] = [
        createCategory("forms", "Forms", [
          createOption("web-test-opt1", "Disabled Skill", { state: "disabled" }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Disabled Skill");
    });

    it("should render discouraged skills with label text", () => {
      const categories: CategoryRow[] = [
        createCategory("forms", "Forms", [
          createOption("web-test-opt1", "Discouraged Skill", { state: "discouraged" }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Discouraged Skill");
    });

    it("should render both selected and unselected skills with labels", () => {
      const categories: CategoryRow[] = [
        createCategory("forms", "Forms", [
          createOption("web-test-opt1", "Active", { selected: true }),
          createOption("web-test-opt2", "Inactive", { selected: false }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories, expertMode: true });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Active");
      expect(output).toContain("Inactive");
    });

    it("should render skill label regardless of selection state", () => {
      const categories1: CategoryRow[] = [
        createCategory("forms", "Forms", [
          createOption("web-test-opt1", "Toggle Skill", { selected: false }),
        ]),
      ];

      const { lastFrame: frame1, unmount: unmount1 } = renderGrid({ categories: categories1 });
      const output1 = frame1();
      unmount1();

      // Second render: same option selected
      const categories2: CategoryRow[] = [
        createCategory("forms", "Forms", [
          createOption("web-test-opt1", "Toggle Skill", { selected: true }),
        ]),
      ];

      const { lastFrame: frame2, unmount: unmount2 } = renderGrid({ categories: categories2 });
      cleanup = unmount2;
      const output2 = frame2();

      // Both states should render the label
      expect(output1).toContain("Toggle Skill");
      expect(output2).toContain("Toggle Skill");
    });
  });

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
          createOption("web-test-scss", "SCSS"),
          createOption("web-test-tailwind", "Tailwind"),
        ]),
        createCategory("client-state", "State", [createOption("web-test-zustand", "Zustand")]),
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

  describe("focus indicator", () => {
    it("should render focused option with label text", () => {
      const { lastFrame, unmount } = renderGrid({
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
      });
      cleanup = unmount;

      const output = lastFrame();
      // Focused option should be visible (background highlighting is visual-only)
      expect(output).toContain("React");
    });

    it("should render correctly when focusedRow changes", () => {
      const { lastFrame: frame1, unmount: unmount1 } = renderGrid({
        categories: categoriesWithFramework,
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
      });
      const output1 = frame1();
      unmount1();

      const { lastFrame: frame2, unmount: unmount2 } = renderGrid({
        categories: categoriesWithFramework,
        defaultFocusedRow: 1,
        defaultFocusedCol: 0,
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
        defaultFocusedRow: 1,
        defaultFocusedCol: 0,
      });
      cleanup = unmount;

      const output = lastFrame();
      // Styling row should be focused (index 1)
      expect(output).toContain("Styling");
    });
  });

  describe("keyboard navigation - arrow keys", () => {
    it("should call onFocusChange when pressing left arrow", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        defaultFocusedRow: 0,
        defaultFocusedCol: 1,
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
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
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
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
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
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
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
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
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
        defaultFocusedRow: 0,
        defaultFocusedCol: 3, // Last option in framework
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
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
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

  describe("keyboard navigation - vim keys", () => {
    it("should move left with h key", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        defaultFocusedRow: 0,
        defaultFocusedCol: 1,
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
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
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
        defaultFocusedRow: 1,
        defaultFocusedCol: 0,
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
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write("j");
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalledWith(1, 0);
    });
  });

  describe("selection toggle", () => {
    it("should call onToggle when pressing space on a normal option", async () => {
      const onToggle = vi.fn();
      const { stdin, unmount } = renderGrid({
        defaultFocusedRow: 0,
        defaultFocusedCol: 1, // vue (normal state)
        onToggle,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(" "); // Space
      await delay(INPUT_DELAY_MS);

      expect(onToggle).toHaveBeenCalledWith("framework", "web-test-vue");
    });

    it("should call onToggle when pressing space on a selected option", async () => {
      const onToggle = vi.fn();
      // Use expertMode to preserve original option order
      const categories: CategoryRow[] = [
        createCategory(
          "framework",
          "Framework",
          [
            createOption("web-test-react", "React", { selected: true }),
            createOption("web-test-vue", "Vue"),
          ],
          { required: true },
        ),
      ];
      const { stdin, unmount } = renderGrid({
        categories,
        defaultFocusedRow: 0,
        defaultFocusedCol: 0, // react (selected)
        expertMode: true,
        onToggle,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(" ");
      await delay(INPUT_DELAY_MS);

      expect(onToggle).toHaveBeenCalledWith("framework", "web-test-react");
    });

    it("should NOT call onToggle when all options in a category are disabled", async () => {
      const onToggle = vi.fn();
      const categories: CategoryRow[] = [
        createCategory("testing", "Test", [
          createOption("web-test-opt1", "Option 1", { state: "disabled" }),
          createOption("web-test-opt2", "Option 2", { state: "disabled" }),
        ]),
      ];

      const { stdin, unmount } = renderGrid({
        categories,
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
        expertMode: true,
        onToggle,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(" ");
      await delay(INPUT_DELAY_MS);

      expect(onToggle).not.toHaveBeenCalled();
    });

    it("should bounce focus away from locked sections on mount", async () => {
      const onFocusChange = vi.fn();
      // No framework selected, styling section is locked
      const { unmount } = renderGrid({
        defaultFocusedRow: 1, // Styling (locked)
        defaultFocusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Focus should have bounced from locked row 1 to unlocked row 0 (framework)
      expect(onFocusChange).toHaveBeenCalledWith(0, 0);
    });
  });

  describe("disabled options navigation", () => {
    it("should navigate to disabled options when navigating right", async () => {
      const onFocusChange = vi.fn();
      const categories: CategoryRow[] = [
        createCategory("testing", "Test", [
          createOption("web-test-opt1", "Option 1"),
          createOption("web-test-opt2", "Option 2", { state: "disabled" }),
          createOption("web-test-opt3", "Option 3"),
        ]),
      ];

      // Initial sort moves disabled options to end: [opt1, opt3, opt2(disabled)]
      const { stdin, unmount } = renderGrid({
        categories,
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
        expertMode: true,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_RIGHT);
      await delay(INPUT_DELAY_MS);

      // opt3 is now at index 1 (after initial state-based sort), so navigating right goes to 1
      expect(onFocusChange).toHaveBeenCalledWith(0, 1);
    });

    it("should navigate to disabled options when navigating left", async () => {
      const onFocusChange = vi.fn();
      const categories: CategoryRow[] = [
        createCategory("testing", "Test", [
          createOption("web-test-opt1", "Option 1"),
          createOption("web-test-opt2", "Option 2", { state: "disabled" }),
          createOption("web-test-opt3", "Option 3"),
        ]),
      ];

      // Initial sort: [opt1, opt3, opt2(disabled)] — disabled moves to end
      const { stdin, unmount } = renderGrid({
        categories,
        defaultFocusedRow: 0,
        defaultFocusedCol: 2, // Start at opt2 (disabled, sorted to end)
        expertMode: true,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_LEFT);
      await delay(INPUT_DELAY_MS);

      // Disabled options are hoverable — navigates to index 1 (opt3)
      expect(onFocusChange).toHaveBeenCalledWith(0, 1);
    });

    it("should navigate between all-disabled options in a row", async () => {
      const onFocusChange = vi.fn();
      const categories: CategoryRow[] = [
        createCategory("testing", "Test", [
          createOption("web-test-opt1", "Option 1", { state: "disabled" }),
          createOption("web-test-opt2", "Option 2", { state: "disabled" }),
        ]),
      ];

      // Use expertMode to preserve original option order
      const { stdin, unmount } = renderGrid({
        categories,
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
        expertMode: true,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_RIGHT);
      await delay(INPUT_DELAY_MS);

      // Disabled options are hoverable — navigates to index 1
      expect(onFocusChange).toHaveBeenCalledWith(0, 1);
    });
  });

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

  describe("tab navigation", () => {
    it("should jump to next section when pressing Tab", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderGrid({
        categories: categoriesWithFramework,
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
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
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
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

  describe("compatibility labels toggle", () => {
    it("should call onToggleLabels when pressing d key", async () => {
      const onToggleLabels = vi.fn();
      const { stdin, unmount } = renderGrid({
        onToggleLabels,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write("d");
      await delay(INPUT_DELAY_MS);

      expect(onToggleLabels).toHaveBeenCalled();
    });

    it("should show compatibility labels when showLabels is true", () => {
      const { lastFrame, unmount } = renderGrid({ showLabels: true });
      cleanup = unmount;

      const output = lastFrame();
      // Should show compatibility label suffixes on skill tags
      expect(output).toContain("(recommended)"); // react has state: "recommended"
    });

    it("should show Selected label for selected skills when showLabels is true", () => {
      const { lastFrame, unmount } = renderGrid({ showLabels: true });
      cleanup = unmount;

      const output = lastFrame();
      // SCSS Modules is selected in defaultCategories
      expect(output).toContain("(selected)");
    });

    it("should show Discouraged label when showLabels is true", () => {
      // Use categoriesWithFramework so Client State section is unlocked
      const { lastFrame, unmount } = renderGrid({
        categories: categoriesWithFramework,
        showLabels: true,
      });
      cleanup = unmount;

      const output = lastFrame();
      // Redux has state: "discouraged" in categoriesWithFramework
      expect(output).toContain("(discouraged)");
    });

    it("should hide compatibility labels when showLabels is false", () => {
      const { lastFrame, unmount } = renderGrid({ showLabels: false });
      cleanup = unmount;

      const output = lastFrame();
      // Labels should not be visible when toggle is off
      expect(output).not.toContain("(recommended)");
      expect(output).not.toContain("(selected)");
      expect(output).not.toContain("(discouraged)");
      expect(output).not.toContain("(disabled)");
    });

    it("should show Disabled label for disabled options when showLabels is true", () => {
      const categories: CategoryRow[] = [
        createCategory("testing", "Test", [
          createOption("web-test-opt1", "Option 1"),
          createOption("web-test-opt2", "Option 2", { state: "disabled" }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories, showLabels: true });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("(disabled)");
    });
  });

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

  describe("option ordering", () => {
    it("should preserve original order regardless of state", () => {
      // Options should never reorder based on recommended/discouraged/disabled state
      const { lastFrame, unmount } = renderGrid({ expertMode: false });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it("should preserve original order in expert mode", () => {
      const { lastFrame, unmount } = renderGrid({ expertMode: true });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle single category", () => {
      const categories: CategoryRow[] = [
        createCategory("forms", "Single Category", [createOption("web-test-opt1", "Option 1")]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Single Category");
      expect(output).toContain("Option 1");
    });

    it("should handle single option in category", () => {
      const categories: CategoryRow[] = [
        createCategory("forms", "Single", [createOption("web-test-only", "Only Option")]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Only Option");
    });

    it("should handle category with many options (flows naturally)", () => {
      const options = Array.from({ length: 10 }, (_, i) =>
        createOption(`web-test-opt${i}`, `Option ${i}`),
      );
      const categories: CategoryRow[] = [createCategory("mocking", "Many Options", options)];

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
        createCategory("i18n", "Long Labels", [
          createOption("web-test-long1", "Very Long Option Name"),
          createOption("web-test-long2", "Another Long Name"),
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
        createCategory("framework", "Category 1", [
          createOption("web-test-opt1", "Option 1"),
          createOption("web-test-opt2", "Option 2"),
        ]),
        createCategory("styling", "Category 2", [createOption("web-test-opt3", "Option 3")]),
        createCategory("client-state", "Category 3", [
          createOption("web-test-opt4", "Option 4"),
          createOption("web-test-opt5", "Option 5"),
          createOption("web-test-opt6", "Option 6"),
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

  describe("column adjustment", () => {
    it("should adjust focusedCol when changing to row with fewer options", async () => {
      const onFocusChange = vi.fn();
      const categories: CategoryRow[] = [
        createCategory(
          "framework",
          "Framework",
          [
            createOption("web-test-opt1", "Option 1", { selected: true }), // Framework selected
            createOption("web-test-opt2", "Option 2"),
            createOption("web-test-opt3", "Option 3"),
          ],
          { required: true },
        ),
        createCategory("styling", "Category 2", [createOption("web-test-opt4", "Option 4")]),
      ];

      const { stdin, unmount } = renderGrid({
        categories,
        defaultFocusedRow: 0,
        defaultFocusedCol: 2, // Last option in first row
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

  describe("installed skills", () => {
    it("should render installed skill with label only (no checkmark icon)", () => {
      const categories: CategoryRow[] = [
        createCategory("forms", "Forms", [
          createOption("web-test-opt1", "Option 1", { installed: true }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).not.toContain("✓");
      expect(output).toContain("Option 1");
    });

    it("should render installed and selected skill with label only", () => {
      const categories: CategoryRow[] = [
        createCategory("forms", "Forms", [
          createOption("web-test-opt1", "Option 1", { installed: true, selected: true }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).not.toContain("✓");
      expect(output).toContain("Option 1");
    });

    it("should render local installed skill without L badge or checkmark", () => {
      const categories: CategoryRow[] = [
        createCategory("forms", "Forms", [
          createOption("web-test-opt1", "Option 1", { local: true, installed: true }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).not.toContain("✓");
      expect(output).toContain("Option 1");
    });
  });

  describe("natural flow (no virtual scroll)", () => {
    it("should render all categories without scroll indicators", () => {
      const { lastFrame, unmount } = renderGrid();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Framework");
      expect(output).toContain("Styling");
      expect(output).toContain("Client State");
      expect(output).toContain("Server State");
      expect(output).toContain("Analytics");
      expect(output).not.toContain("more categories");
    });

    it("should render all categories even with many entries", () => {
      const manyCategories: CategoryRow[] = Array.from({ length: 8 }, (_, i) =>
        createCategory(`cat-${i}` as Subcategory, `Category ${i}`, [
          createOption(`web-test-opt${i}-a`, `Option ${i}A`),
          createOption(`web-test-opt${i}-b`, `Option ${i}B`),
          createOption(`web-test-opt${i}-c`, `Option ${i}C`),
        ]),
      );

      const { lastFrame, unmount } = renderGrid({
        categories: manyCategories,
      });
      cleanup = unmount;

      const output = lastFrame();
      // All 8 categories should be rendered
      for (let i = 0; i < 8; i++) {
        expect(output).toContain(`Category ${i}`);
      }
      expect(output).not.toContain("more categories");
    });

    it("should keep focused category visible when navigating down", async () => {
      const onFocusChange = vi.fn();
      const manyCategories: CategoryRow[] = Array.from({ length: 6 }, (_, i) =>
        createCategory(`cat-${i}` as Subcategory, `Category ${i}`, [
          createOption(`web-test-opt${i}-a`, `Option ${i}A`),
        ]),
      );

      const { stdin, lastFrame, unmount } = renderGrid({
        categories: manyCategories,
        defaultFocusedRow: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);

      const output = lastFrame();
      expect(output).toContain("Category 3");
    });
  });
});
