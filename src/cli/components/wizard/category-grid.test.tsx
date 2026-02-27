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
    "web-framework",
    "Framework",
    [
      createOption("web-framework-react", "React", {
        state: "recommended",
        stateReason: "Popular choice",
      }),
      createOption("web-framework-vue-composition-api", "Vue"),
      createOption("web-framework-angular-standalone", "Angular"),
      createOption("web-framework-solidjs", "SolidJS"),
    ],
    { required: true },
  ),
  createCategory(
    "web-styling",
    "Styling",
    [
      createOption("web-styling-scss-modules", "SCSS Modules", { selected: true }),
      createOption("web-styling-tailwind", "Tailwind", { state: "recommended" }),
      createOption("web-styling-cva", "CVA"),
      createOption("web-framework-nuxt", "Nuxt"),
    ],
    { required: true },
  ),
  createCategory("web-client-state", "Client State", [
    createOption("web-state-zustand", "Zustand", { state: "recommended" }),
    createOption("web-state-jotai", "Jotai"),
    createOption("web-state-redux-toolkit", "Redux", {
      state: "discouraged",
      stateReason: "Complex for most apps",
    }),
    createOption("web-state-mobx", "MobX"),
  ]),
  createCategory("web-server-state", "Server State", [
    createOption("web-server-state-react-query", "React Query", { selected: true }),
    createOption("web-data-fetching-swr", "SWR"),
    createOption("web-data-fetching-graphql-apollo", "Apollo"),
  ]),
  createCategory("api-analytics", "Analytics", [
    createOption("api-analytics-posthog-analytics", "PostHog"),
  ]),
];

const categoriesWithFramework: CategoryRow[] = [
  createCategory(
    "web-framework",
    "Framework",
    [
      createOption("web-framework-react", "React", {
        state: "recommended",
        stateReason: "Popular choice",
        selected: true, // Framework selected
      }),
      createOption("web-framework-vue-composition-api", "Vue"),
      createOption("web-framework-angular-standalone", "Angular"),
      createOption("web-framework-solidjs", "SolidJS"),
    ],
    { required: true },
  ),
  createCategory(
    "web-styling",
    "Styling",
    [
      createOption("web-styling-scss-modules", "SCSS Modules"),
      createOption("web-styling-tailwind", "Tailwind", { state: "recommended" }),
      createOption("web-styling-cva", "CVA"),
      createOption("web-framework-nuxt", "Nuxt"),
    ],
    { required: true },
  ),
  createCategory("web-client-state", "Client State", [
    createOption("web-state-zustand", "Zustand", { state: "recommended" }),
    createOption("web-state-jotai", "Jotai"),
    createOption("web-state-redux-toolkit", "Redux", { state: "discouraged" }),
    createOption("web-state-mobx", "MobX"),
  ]),
];

const manyCategories: CategoryRow[] = [
  createCategory("web-framework", "Category 0", [
    createOption("web-framework-react", "Option 0A"),
    createOption("web-framework-vue-composition-api", "Option 0B"),
    createOption("web-framework-angular-standalone", "Option 0C"),
  ]),
  createCategory("web-styling", "Category 1", [
    createOption("web-styling-tailwind", "Option 1A"),
    createOption("web-styling-scss-modules", "Option 1B"),
    createOption("web-styling-cva", "Option 1C"),
  ]),
  createCategory("web-client-state", "Category 2", [
    createOption("web-state-zustand", "Option 2A"),
    createOption("web-state-jotai", "Option 2B"),
    createOption("web-state-mobx", "Option 2C"),
  ]),
  createCategory("web-server-state", "Category 3", [
    createOption("web-server-state-react-query", "Option 3A"),
    createOption("web-data-fetching-swr", "Option 3B"),
    createOption("web-data-fetching-graphql-apollo", "Option 3C"),
  ]),
  createCategory("web-forms", "Category 4", [
    createOption("web-forms-react-hook-form", "Option 4A"),
    createOption("web-forms-vee-validate", "Option 4B"),
    createOption("web-forms-zod-validation", "Option 4C"),
  ]),
  createCategory("web-testing", "Category 5", [
    createOption("web-testing-vitest", "Option 5A"),
    createOption("web-testing-playwright-e2e", "Option 5B"),
    createOption("web-testing-cypress-e2e", "Option 5C"),
  ]),
  createCategory("web-mocking", "Category 6", [
    createOption("web-mocks-msw", "Option 6A"),
    createOption("web-testing-react-testing-library", "Option 6B"),
    createOption("web-testing-vue-test-utils", "Option 6C"),
  ]),
  createCategory("web-i18n", "Category 7", [
    createOption("web-i18n-next-intl", "Option 7A"),
    createOption("web-i18n-react-intl", "Option 7B"),
    createOption("web-i18n-vue-i18n", "Option 7C"),
  ]),
];

const navCategories: CategoryRow[] = [
  createCategory("web-framework", "Category 0", [createOption("web-framework-react", "Option 0A")]),
  createCategory("web-styling", "Category 1", [createOption("web-styling-tailwind", "Option 1A")]),
  createCategory("web-client-state", "Category 2", [
    createOption("web-state-zustand", "Option 2A"),
  ]),
  createCategory("web-server-state", "Category 3", [
    createOption("web-server-state-react-query", "Option 3A"),
  ]),
  createCategory("web-forms", "Category 4", [
    createOption("web-forms-react-hook-form", "Option 4A"),
  ]),
  createCategory("web-testing", "Category 5", [createOption("web-testing-vitest", "Option 5A")]),
];

const defaultProps: CategoryGridProps = {
  categories: defaultCategories,
  defaultFocusedRow: 0,
  defaultFocusedCol: 0,
  showLabels: false,
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
      expect(output).toContain("SolidJS");
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

    it("should show discouraged options with warning styling", () => {
      const categories: CategoryRow[] = [
        createCategory("web-testing", "Test", [
          createOption("web-forms-react-hook-form", "Option 1"),
          createOption("web-forms-vee-validate", "Option 2", { state: "discouraged" }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      // Discouraged options should show label
      expect(output).toContain("Option 2");
    });

    it("should render selected skills with label text", () => {
      const categories: CategoryRow[] = [
        createCategory("web-forms", "Forms", [
          createOption("web-forms-react-hook-form", "Selected Skill", { selected: true }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Selected Skill");
    });

    it("should render unselected skills with label text", () => {
      const categories: CategoryRow[] = [
        createCategory("web-forms", "Forms", [
          createOption("web-forms-react-hook-form", "Unselected Skill", {
            state: "normal",
            selected: false,
          }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Unselected Skill");
    });

    it("should render discouraged skills with label text", () => {
      const categories: CategoryRow[] = [
        createCategory("web-forms", "Forms", [
          createOption("web-forms-react-hook-form", "Discouraged Skill", { state: "discouraged" }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Discouraged Skill");
    });

    it("should render discouraged+selected skills with label text", () => {
      const categories: CategoryRow[] = [
        createCategory("web-forms", "Forms", [
          createOption("web-forms-react-hook-form", "Discouraged Selected", {
            state: "discouraged",
            selected: true,
          }),
          createOption("web-forms-vee-validate", "Discouraged Only", {
            state: "discouraged",
            selected: false,
          }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Discouraged Selected");
      expect(output).toContain("Discouraged Only");
    });

    it("should render discouraged skills with label text", () => {
      const categories: CategoryRow[] = [
        createCategory("web-forms", "Forms", [
          createOption("web-forms-react-hook-form", "Discouraged Skill", { state: "discouraged" }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Discouraged Skill");
    });

    it("should render both selected and unselected skills with labels", () => {
      const categories: CategoryRow[] = [
        createCategory("web-forms", "Forms", [
          createOption("web-forms-react-hook-form", "Active", { selected: true }),
          createOption("web-forms-vee-validate", "Inactive", { selected: false }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Active");
      expect(output).toContain("Inactive");
    });

    it("should render skill label regardless of selection state", () => {
      const categories1: CategoryRow[] = [
        createCategory("web-forms", "Forms", [
          createOption("web-forms-react-hook-form", "Toggle Skill", { selected: false }),
        ]),
      ];

      const { lastFrame: frame1, unmount: unmount1 } = renderGrid({ categories: categories1 });
      const output1 = frame1();
      unmount1();

      // Second render: same option selected
      const categories2: CategoryRow[] = [
        createCategory("web-forms", "Forms", [
          createOption("web-forms-react-hook-form", "Toggle Skill", { selected: true }),
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
        createCategory("web-styling", "Styling", [
          createOption("web-styling-scss-modules", "SCSS"),
          createOption("web-styling-tailwind", "Tailwind"),
        ]),
        createCategory("web-client-state", "State", [createOption("web-state-zustand", "Zustand")]),
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

      expect(onToggle).toHaveBeenCalledWith("web-framework", "web-framework-vue-composition-api");
    });

    it("should call onToggle when pressing space on a selected option", async () => {
      const onToggle = vi.fn();
      const categories: CategoryRow[] = [
        createCategory(
          "web-framework",
          "Framework",
          [
            createOption("web-framework-react", "React", { selected: true }),
            createOption("web-framework-vue-composition-api", "Vue"),
          ],
          { required: true },
        ),
      ];
      const { stdin, unmount } = renderGrid({
        categories,
        defaultFocusedRow: 0,
        defaultFocusedCol: 0, // react (selected)
        onToggle,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(" ");
      await delay(INPUT_DELAY_MS);

      expect(onToggle).toHaveBeenCalledWith("web-framework", "web-framework-react");
    });

    it("should call onToggle for discouraged options (still selectable)", async () => {
      const onToggle = vi.fn();
      const categories: CategoryRow[] = [
        createCategory("web-testing", "Test", [
          createOption("web-forms-react-hook-form", "Option 1", { state: "discouraged" }),
          createOption("web-forms-vee-validate", "Option 2", { state: "discouraged" }),
        ]),
      ];

      const { stdin, unmount } = renderGrid({
        categories,
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
        onToggle,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(" ");
      await delay(INPUT_DELAY_MS);

      expect(onToggle).toHaveBeenCalled();
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

  describe("discouraged options navigation", () => {
    it("should navigate to discouraged options when navigating right", async () => {
      const onFocusChange = vi.fn();
      const categories: CategoryRow[] = [
        createCategory("web-testing", "Test", [
          createOption("web-forms-react-hook-form", "Option 1"),
          createOption("web-forms-vee-validate", "Option 2", { state: "discouraged" }),
          createOption("web-forms-zod-validation", "Option 3"),
        ]),
      ];

      // Options stay in original order: [opt1, opt2(discouraged), opt3]
      const { stdin, unmount } = renderGrid({
        categories,
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_RIGHT);
      await delay(INPUT_DELAY_MS);

      // Navigating right from index 0 goes to index 1 (opt2, discouraged but hoverable)
      expect(onFocusChange).toHaveBeenCalledWith(0, 1);
    });

    it("should navigate to discouraged options when navigating left", async () => {
      const onFocusChange = vi.fn();
      const categories: CategoryRow[] = [
        createCategory("web-testing", "Test", [
          createOption("web-forms-react-hook-form", "Option 1"),
          createOption("web-forms-vee-validate", "Option 2", { state: "discouraged" }),
          createOption("web-forms-zod-validation", "Option 3"),
        ]),
      ];

      // Options stay in original order: [opt1, opt2(discouraged), opt3]
      const { stdin, unmount } = renderGrid({
        categories,
        defaultFocusedRow: 0,
        defaultFocusedCol: 2, // Start at opt3 (index 2)
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_LEFT);
      await delay(INPUT_DELAY_MS);

      // Discouraged options are hoverable — navigates to index 1 (opt2)
      expect(onFocusChange).toHaveBeenCalledWith(0, 1);
    });

    it("should navigate between all-discouraged options in a row", async () => {
      const onFocusChange = vi.fn();
      const categories: CategoryRow[] = [
        createCategory("web-testing", "Test", [
          createOption("web-forms-react-hook-form", "Option 1", { state: "discouraged" }),
          createOption("web-forms-vee-validate", "Option 2", { state: "discouraged" }),
        ]),
      ];

      const { stdin, unmount } = renderGrid({
        categories,
        defaultFocusedRow: 0,
        defaultFocusedCol: 0,
        onFocusChange,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_RIGHT);
      await delay(INPUT_DELAY_MS);

      // Discouraged options are hoverable — navigates to index 1
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
    });

    it("should show discouraged label for discouraged options when showLabels is true", () => {
      const categories: CategoryRow[] = [
        createCategory("web-testing", "Test", [
          createOption("web-forms-react-hook-form", "Option 1"),
          createOption("web-forms-vee-validate", "Option 2", { state: "discouraged" }),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories, showLabels: true });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("(discouraged)");
    });
  });

  describe("option ordering", () => {
    it("should preserve original order regardless of state", () => {
      const categories: CategoryRow[] = [
        createCategory("web-client-state", "State", [
          createOption("web-state-jotai", "Jotai"),
          createOption("web-state-zustand", "Zustand", { state: "recommended" }),
          createOption("web-state-redux-toolkit", "Redux", { state: "discouraged" }),
          createOption("web-state-mobx", "MobX"),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame()!;
      const jotaiIdx = output.indexOf("Jotai");
      const zustandIdx = output.indexOf("Zustand");
      const reduxIdx = output.indexOf("Redux");
      const mobxIdx = output.indexOf("MobX");

      // Order should match the input array, not be sorted by state
      expect(jotaiIdx).toBeLessThan(zustandIdx);
      expect(zustandIdx).toBeLessThan(reduxIdx);
      expect(reduxIdx).toBeLessThan(mobxIdx);
    });

    it("should not change order when a skill is selected", () => {
      const categoriesBefore: CategoryRow[] = [
        createCategory("web-client-state", "State", [
          createOption("web-state-jotai", "Jotai"),
          createOption("web-state-zustand", "Zustand"),
          createOption("web-state-redux-toolkit", "Redux"),
        ]),
      ];

      const categoriesAfter: CategoryRow[] = [
        createCategory("web-client-state", "State", [
          createOption("web-state-jotai", "Jotai"),
          createOption("web-state-zustand", "Zustand", { selected: true }),
          createOption("web-state-redux-toolkit", "Redux"),
        ]),
      ];

      const { lastFrame: frameBefore, unmount: unmountBefore } = renderGrid({
        categories: categoriesBefore,
      });
      const outputBefore = frameBefore()!;
      unmountBefore();

      const { lastFrame: frameAfter, unmount: unmountAfter } = renderGrid({
        categories: categoriesAfter,
      });
      cleanup = unmountAfter;
      const outputAfter = frameAfter()!;

      // Verify order is preserved: Jotai < Zustand < Redux in both
      expect(outputBefore.indexOf("Jotai")).toBeLessThan(outputBefore.indexOf("Zustand"));
      expect(outputBefore.indexOf("Zustand")).toBeLessThan(outputBefore.indexOf("Redux"));
      expect(outputAfter.indexOf("Jotai")).toBeLessThan(outputAfter.indexOf("Zustand"));
      expect(outputAfter.indexOf("Zustand")).toBeLessThan(outputAfter.indexOf("Redux"));
    });

    it("should not change order when a skill state changes from normal to discouraged", () => {
      const categoriesBefore: CategoryRow[] = [
        createCategory("web-client-state", "State", [
          createOption("web-state-jotai", "Jotai"),
          createOption("web-state-zustand", "Zustand"),
          createOption("web-state-redux-toolkit", "Redux"),
        ]),
      ];

      const categoriesAfter: CategoryRow[] = [
        createCategory("web-client-state", "State", [
          createOption("web-state-jotai", "Jotai"),
          createOption("web-state-zustand", "Zustand", { state: "discouraged" }),
          createOption("web-state-redux-toolkit", "Redux"),
        ]),
      ];

      const { lastFrame: frameBefore, unmount: unmountBefore } = renderGrid({
        categories: categoriesBefore,
      });
      const outputBefore = frameBefore()!;
      unmountBefore();

      const { lastFrame: frameAfter, unmount: unmountAfter } = renderGrid({
        categories: categoriesAfter,
      });
      cleanup = unmountAfter;
      const outputAfter = frameAfter()!;

      // Zustand stays in the middle even after becoming discouraged
      expect(outputBefore.indexOf("Jotai")).toBeLessThan(outputBefore.indexOf("Zustand"));
      expect(outputBefore.indexOf("Zustand")).toBeLessThan(outputBefore.indexOf("Redux"));
      expect(outputAfter.indexOf("Jotai")).toBeLessThan(outputAfter.indexOf("Zustand"));
      expect(outputAfter.indexOf("Zustand")).toBeLessThan(outputAfter.indexOf("Redux"));
    });
  });

  describe("edge cases", () => {
    it("should handle single category", () => {
      const categories: CategoryRow[] = [
        createCategory("web-forms", "Single Category", [
          createOption("web-forms-react-hook-form", "Option 1"),
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
        createCategory("web-forms", "Single", [
          createOption("web-forms-react-hook-form", "Only Option"),
        ]),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Only Option");
    });

    it("should handle category with many options (flows naturally)", () => {
      const manySkillIds: SkillId[] = [
        "web-framework-react",
        "web-framework-vue-composition-api",
        "web-framework-angular-standalone",
        "web-framework-solidjs",
        "web-framework-nuxt",
        "web-framework-remix",
        "web-framework-nextjs-app-router",
        "web-framework-nextjs-server-actions",
        "web-styling-tailwind",
        "web-styling-scss-modules",
      ];
      const options = manySkillIds.map((id, i) => createOption(id, `Option ${i}`));
      const categories: CategoryRow[] = [createCategory("web-mocking", "Many Options", options)];

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
        createCategory("web-i18n", "Long Labels", [
          createOption("web-i18n-next-intl", "Very Long Option Name"),
          createOption("web-i18n-react-intl", "Another Long Name"),
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
        createCategory("web-framework", "Category 1", [
          createOption("web-forms-react-hook-form", "Option 1"),
          createOption("web-forms-vee-validate", "Option 2"),
        ]),
        createCategory("web-styling", "Category 2", [
          createOption("web-forms-zod-validation", "Option 3"),
        ]),
        createCategory("web-client-state", "Category 3", [
          createOption("web-testing-vitest", "Option 4"),
          createOption("web-testing-playwright-e2e", "Option 5"),
          createOption("web-testing-react-testing-library", "Option 6"),
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
          "web-framework",
          "Framework",
          [
            createOption("web-forms-react-hook-form", "Option 1", { selected: true }), // Framework selected
            createOption("web-forms-vee-validate", "Option 2"),
            createOption("web-forms-zod-validation", "Option 3"),
          ],
          { required: true },
        ),
        createCategory("web-styling", "Category 2", [
          createOption("web-testing-vitest", "Option 4"),
        ]),
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
        createCategory("web-forms", "Forms", [
          createOption("web-forms-react-hook-form", "Option 1", { installed: true }),
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
        createCategory("web-forms", "Forms", [
          createOption("web-forms-react-hook-form", "Option 1", {
            installed: true,
            selected: true,
          }),
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
        createCategory("web-forms", "Forms", [
          createOption("web-forms-react-hook-form", "Option 1", { local: true, installed: true }),
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
      const { lastFrame, unmount } = renderGrid({
        categories: manyCategories,
      });
      cleanup = unmount;

      const output = lastFrame();
      for (const category of manyCategories) {
        expect(output).toContain(category.displayName);
      }
      expect(output).not.toContain("more categories");
    });

    it("should keep focused category visible when navigating down", async () => {
      const onFocusChange = vi.fn();

      const { stdin, lastFrame, unmount } = renderGrid({
        categories: navCategories,
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

  describe("selection counter", () => {
    it("should show 'X of 1' for exclusive categories with no selection", () => {
      const categories = [
        createCategory(
          "web-framework",
          "Framework",
          [
            createOption("web-framework-react", "React"),
            createOption("web-framework-vue-composition-api", "Vue"),
          ],
          { exclusive: true },
        ),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("(0 of 1)");
    });

    it("should show '1 of 1' for exclusive categories with one selection", () => {
      const categories = [
        createCategory(
          "web-framework",
          "Framework",
          [
            createOption("web-framework-react", "React", { selected: true }),
            createOption("web-framework-vue-composition-api", "Vue"),
          ],
          { exclusive: true },
        ),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("(1 of 1)");
    });

    it("should show 'X selected' for non-exclusive categories", () => {
      const categories = [
        createCategory(
          "web-testing",
          "Testing",
          [
            createOption("web-testing-vitest", "Vitest", { selected: true }),
            createOption("web-testing-playwright-e2e", "Playwright", { selected: true }),
            createOption("web-testing-cypress-e2e", "Cypress"),
          ],
          { exclusive: false },
        ),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("(2 selected)");
    });

    it("should show '0 selected' for non-exclusive categories with no selection", () => {
      const categories = [
        createCategory(
          "web-testing",
          "Testing",
          [
            createOption("web-testing-vitest", "Vitest"),
            createOption("web-testing-playwright-e2e", "Playwright"),
          ],
          { exclusive: false },
        ),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("(0 selected)");
    });

    it("should always show selection counter", () => {
      const categories = [
        createCategory(
          "web-framework",
          "Framework",
          [createOption("web-framework-react", "React", { selected: true })],
          { exclusive: true },
        ),
        createCategory(
          "web-testing",
          "Testing",
          [createOption("web-testing-vitest", "Vitest", { selected: true })],
          { exclusive: false },
        ),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      // Counters are always visible now (no expert mode to hide them)
      expect(output).toContain("1 of 1");
      expect(output).toContain("1 selected");
    });

    it("should show correct counts for mixed exclusive and non-exclusive categories", () => {
      const categories = [
        createCategory(
          "web-framework",
          "Framework",
          [
            createOption("web-framework-react", "React", { selected: true }),
            createOption("web-framework-vue-composition-api", "Vue"),
          ],
          { exclusive: true },
        ),
        createCategory(
          "web-testing",
          "Testing",
          [
            createOption("web-testing-vitest", "Vitest", { selected: true }),
            createOption("web-testing-playwright-e2e", "Playwright", { selected: true }),
            createOption("web-testing-cypress-e2e", "Cypress"),
          ],
          { exclusive: false },
        ),
      ];

      const { lastFrame, unmount } = renderGrid({ categories });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("(1 of 1)");
      expect(output).toContain("(2 selected)");
    });
  });
});
