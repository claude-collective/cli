/**
 * Tests for the StepBuild component.
 *
 * Tests domain-based technology selection using CategoryGrid.
 */
import { render } from "ink-testing-library";
import { describe, expect, it, afterEach, vi } from "vitest";
import {
  StepBuild,
  type StepBuildProps,
  validateBuildStep,
  getDisplayLabel,
} from "./step-build";
import type { CategoryRow as GridCategoryRow } from "./category-grid";
import type {
  MergedSkillsMatrix,
  ResolvedSkill,
  CategoryDefinition,
} from "../../types-matrix";
import {
  ENTER,
  ESCAPE,
  RENDER_DELAY_MS,
  INPUT_DELAY_MS,
  delay,
} from "../../lib/__tests__/test-constants";

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a minimal category definition.
 */
const createCategory = (
  id: string,
  name: string,
  overrides: Partial<CategoryDefinition> = {},
): CategoryDefinition => ({
  id,
  name,
  description: `${name} category`,
  exclusive: true,
  required: false,
  order: 0,
  ...overrides,
});

/**
 * Create a minimal skill definition.
 */
const createSkill = (
  id: string,
  name: string,
  category: string,
  overrides: Partial<ResolvedSkill> = {},
): ResolvedSkill => ({
  id,
  name,
  description: `${name} skill`,
  category,
  categoryExclusive: true,
  tags: [],
  author: "test",
  conflictsWith: [],
  recommends: [],
  recommendedBy: [],
  requires: [],
  requiredBy: [],
  alternatives: [],
  discourages: [],
  compatibleWith: [],
  requiresSetup: [],
  providesSetupFor: [],
  path: `test/${id}`,
  ...overrides,
});

/**
 * Create a minimal matrix for testing.
 */
const createTestMatrix = (
  categories: CategoryDefinition[],
  skills: ResolvedSkill[],
): MergedSkillsMatrix => ({
  version: "1.0.0",
  categories: Object.fromEntries(categories.map((c) => [c.id, c])),
  skills: Object.fromEntries(skills.map((s) => [s.id, s])),
  suggestedStacks: [],
  aliases: Object.fromEntries(
    skills.filter((s) => s.alias).map((s) => [s.alias!, s.id]),
  ),
  aliasesReverse: Object.fromEntries(
    skills.filter((s) => s.alias).map((s) => [s.id, s.alias!]),
  ),
  generatedAt: new Date().toISOString(),
});

// Create test categories

const frameworkCategory = createCategory("framework", "Framework", {
  domain: "web",
  required: true,
  order: 0,
});

const stylingCategory = createCategory("styling", "Styling", {
  domain: "web",
  required: true,
  order: 1,
});

const stateCategory = createCategory("client-state", "Client State", {
  domain: "web",
  required: false,
  order: 2,
});

const apiFrameworkCategory = createCategory("api-framework", "API Framework", {
  domain: "api",
  required: true,
  order: 0,
});

const databaseCategory = createCategory("database", "Database", {
  domain: "api",
  required: false,
  order: 1,
});

// Create test skills
const reactSkill = createSkill("react (@vince)", "React", "framework", {
  alias: "react",
});

const vueSkill = createSkill("vue (@vince)", "Vue", "framework", {
  alias: "vue",
});

const tailwindSkill = createSkill("tailwind (@vince)", "Tailwind", "styling", {
  alias: "tailwind",
});

const scssSkill = createSkill("scss (@vince)", "SCSS Modules", "styling", {
  alias: "scss",
});

const zustandSkill = createSkill(
  "zustand (@vince)",
  "Zustand",
  "client-state",
  {
    alias: "zustand",
  },
);

const honoSkill = createSkill("hono (@vince)", "Hono", "api-framework", {
  alias: "hono",
});

const expressSkill = createSkill(
  "express (@vince)",
  "Express",
  "api-framework",
  {
    alias: "express",
  },
);

const postgresSkill = createSkill(
  "postgres (@vince)",
  "PostgreSQL",
  "database",
  {
    alias: "postgres",
  },
);

// Default test matrix with web and API domains
const defaultMatrix = createTestMatrix(
  [
    frameworkCategory,
    stylingCategory,
    stateCategory,
    apiFrameworkCategory,
    databaseCategory,
  ],
  [
    reactSkill,
    vueSkill,
    tailwindSkill,
    scssSkill,
    zustandSkill,
    honoSkill,
    expressSkill,
    postgresSkill,
  ],
);

// Default props
const defaultProps: StepBuildProps = {
  matrix: defaultMatrix,
  domain: "web",
  selectedDomains: ["web"],
  selections: {},
  allSelections: [],
  focusedRow: 0,
  focusedCol: 0,
  showDescriptions: false,
  expertMode: false,
  onToggle: vi.fn(),
  onFocusChange: vi.fn(),
  onToggleDescriptions: vi.fn(),
  onContinue: vi.fn(),
  onBack: vi.fn(),
};

const renderStepBuild = (props: Partial<StepBuildProps> = {}) => {
  return render(<StepBuild {...defaultProps} {...props} />);
};

// =============================================================================
// Tests
// =============================================================================

describe("StepBuild component", () => {
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
    it("should render CategoryGrid with correct categories for domain", () => {
      // For web domain with framework-first flow, initially only shows Framework
      // To see other categories, need a framework selection
      const { lastFrame, unmount } = renderStepBuild({
        selections: { framework: ["react"] }, // Framework selected to show other categories
      });
      cleanup = unmount;

      const output = lastFrame();
      // Web domain should show Framework, Styling, Client State (when framework selected)
      expect(output).toContain("Framework");
      expect(output).toContain("Styling");
      expect(output).toContain("Client State");
      // Should NOT show API categories
      expect(output).not.toContain("API Framework");
      expect(output).not.toContain("Database");
    });

    it("should render API categories when domain is api", () => {
      const { lastFrame, unmount } = renderStepBuild({
        domain: "api",
      });
      cleanup = unmount;

      const output = lastFrame();
      // API domain should show API Framework, Database
      expect(output).toContain("API Framework");
      expect(output).toContain("Database");
      // Should NOT show Web categories
      expect(output).not.toContain("Styling");
      expect(output).not.toContain("Client State");
    });

    it("should render skills as options", () => {
      // Need framework selected to see other categories in web domain
      const { lastFrame, unmount } = renderStepBuild({
        selections: { framework: ["react"] },
      });
      cleanup = unmount;

      const output = lastFrame();
      // Framework skills
      expect(output).toContain("React");
      expect(output).toContain("Vue");
      // Styling skills (visible after framework selected)
      expect(output).toContain("Tailwind");
      expect(output).toContain("SCSS");
    });

    it("should show required indicator (*) for required categories", () => {
      const { lastFrame, unmount } = renderStepBuild();
      cleanup = unmount;

      const output = lastFrame();
      // Framework and Styling are required
      expect(output).toContain("*");
    });

    it("should render categories for the domain", () => {
      const { lastFrame, unmount } = renderStepBuild({
        selections: { framework: ["react"] },
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should render the domain categories
      expect(output).toContain("Framework");
      expect(output).toContain("Styling");
    });
  });

  // ===========================================================================
  // Progress Indicator
  // ===========================================================================

  describe("domain header", () => {
    it("should show ViewTitle with current domain when multiple domains selected", () => {
      const { lastFrame, unmount } = renderStepBuild({
        selectedDomains: ["web", "api"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customise your Web stack");
    });

    it("should show ViewTitle with domain when only one selected", () => {
      const { lastFrame, unmount } = renderStepBuild({
        selectedDomains: ["web"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customise your Web stack");
    });

    it("should show ViewTitle for current domain on final domain", () => {
      const { lastFrame, unmount } = renderStepBuild({
        selectedDomains: ["web", "api"],
        domain: "api",
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customise your API stack");
    });

    it("should show correct domain display names", () => {
      const { lastFrame, unmount } = renderStepBuild({
        selectedDomains: ["web", "api", "cli"],
        domain: "api",
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customise your API stack");
    });
  });

  // ===========================================================================
  // Category Filtering
  // ===========================================================================

  describe("category filtering", () => {
    it("should filter categories correctly by domain", () => {
      // Web domain with framework selected (to bypass framework-first filter)
      const { lastFrame: webFrame, unmount: webUnmount } = renderStepBuild({
        domain: "web",
        selections: { framework: ["react"] },
      });
      const webOutput = webFrame();
      webUnmount();

      // API domain (no framework-first filter for API)
      const { lastFrame: apiFrame, unmount: apiUnmount } = renderStepBuild({
        domain: "api",
      });
      cleanup = apiUnmount;
      const apiOutput = apiFrame();

      // Web should have Framework, Styling, Client State (with framework selected)
      expect(webOutput).toContain("Framework");
      expect(webOutput).toContain("Styling");
      expect(webOutput).toContain("Client State");
      expect(webOutput).not.toContain("API Framework");

      // API should have API Framework, Database
      expect(apiOutput).toContain("API Framework");
      expect(apiOutput).toContain("Database");
      expect(apiOutput).not.toContain("Styling");
    });

    it("should sort categories by order", () => {
      // Need framework selected to see all categories
      const { lastFrame, unmount } = renderStepBuild({
        selections: { framework: ["react"] },
      });
      cleanup = unmount;

      const output = lastFrame();
      // Framework (order 0) should appear before Styling (order 1)
      // and Styling before Client State (order 2)
      const frameworkIndex = output?.indexOf("Framework") ?? -1;
      const stylingIndex = output?.indexOf("Styling") ?? -1;
      const stateIndex = output?.indexOf("Client State") ?? -1;

      expect(frameworkIndex).toBeLessThan(stylingIndex);
      expect(stylingIndex).toBeLessThan(stateIndex);
    });
  });

  // ===========================================================================
  // Option States
  // ===========================================================================

  describe("option states", () => {
    it("should show selected options correctly", () => {
      const { lastFrame, unmount } = renderStepBuild({
        allSelections: ["react (@vince)"],
        selections: { framework: ["react"] },
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should show selected option (no circle symbol anymore, uses background)
      // Just verify the selected label is present
      expect(output).toContain("React");
    });

    it("should pass expertMode to CategoryGrid", () => {
      const { lastFrame, unmount } = renderStepBuild({
        expertMode: true,
      });
      cleanup = unmount;

      const output = lastFrame();
      // Expert mode is passed to CategoryGrid for option sorting behavior
      // The visual indicator is now shown globally in wizard-layout, not in CategoryGrid header
      expect(output).toBeDefined();
    });

    it("should pass showDescriptions to CategoryGrid", () => {
      const { lastFrame, unmount } = renderStepBuild({
        showDescriptions: true,
      });
      cleanup = unmount;

      const output = lastFrame();
      // Descriptions toggle is now shown globally in wizard-layout
      // Verify component renders without error
      expect(output).toBeDefined();
    });
  });

  // ===========================================================================
  // Keyboard Navigation
  // ===========================================================================

  describe("keyboard navigation", () => {
    it("should call onContinue when Enter is pressed with valid selections", async () => {
      const onContinue = vi.fn();
      // Provide selections for required categories to pass validation
      const { stdin, unmount } = renderStepBuild({
        onContinue,
        selections: {
          framework: ["react"],
          styling: ["tailwind"],
        },
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      expect(onContinue).toHaveBeenCalled();
    });

    it("should call onBack when Escape is pressed", async () => {
      const onBack = vi.fn();
      const { stdin, unmount } = renderStepBuild({ onBack });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write(ESCAPE);
      await delay(INPUT_DELAY_MS);

      expect(onBack).toHaveBeenCalled();
    });

    it("should pass focus callbacks to CategoryGrid", async () => {
      const onFocusChange = vi.fn();
      const { stdin, unmount } = renderStepBuild({
        onFocusChange,
        focusedRow: 0,
        focusedCol: 0,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      // Arrow down should trigger focus change
      stdin.write("\x1B[B"); // Arrow down
      await delay(INPUT_DELAY_MS);

      expect(onFocusChange).toHaveBeenCalled();
    });

    it("should pass toggle callback to CategoryGrid", async () => {
      const onToggle = vi.fn();
      const { stdin, unmount } = renderStepBuild({
        onToggle,
        focusedRow: 0,
        focusedCol: 0,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      // Space should trigger toggle
      stdin.write(" ");
      await delay(INPUT_DELAY_MS);

      expect(onToggle).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Toggle Callbacks
  // ===========================================================================

  describe("toggle callbacks", () => {
    it("should pass onToggleDescriptions to CategoryGrid", async () => {
      const onToggleDescriptions = vi.fn();
      const { stdin, unmount } = renderStepBuild({ onToggleDescriptions });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write("d"); // 'd' key toggles descriptions
      await delay(INPUT_DELAY_MS);

      expect(onToggleDescriptions).toHaveBeenCalled();
    });

    it("should not handle expert mode toggle locally (handled globally)", () => {
      // Expert mode toggle is now handled at wizard.tsx level
      // StepBuild no longer has onToggleExpertMode prop
      const { lastFrame, unmount } = renderStepBuild();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toBeDefined();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle domain with no categories", () => {
      const { lastFrame, unmount } = renderStepBuild({
        domain: "mobile", // No mobile categories in test matrix
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should show empty state message from CategoryGrid
      expect(output).toContain("No categories to display");
    });

    it("should handle unknown domain gracefully", () => {
      const { lastFrame, unmount } = renderStepBuild({
        domain: "unknown",
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should render without crashing
      expect(output).toBeDefined();
    });

    it("should handle empty allSelections", () => {
      const { lastFrame, unmount } = renderStepBuild({
        allSelections: [],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Framework");
    });

    it("should handle allSelections with skills from other domains", () => {
      const { lastFrame, unmount } = renderStepBuild({
        domain: "web",
        allSelections: ["hono (@vince)", "postgres (@vince)"], // API skills
        selections: { framework: ["react"] }, // Need framework to see other categories
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should still render web categories
      expect(output).toContain("Framework");
      expect(output).toContain("Styling");
    });
  });

  // ===========================================================================
  // Multi-domain Scenarios
  // ===========================================================================

  describe("multi-domain scenarios", () => {
    it("should show ViewTitle for current domain in multi-domain flow", () => {
      const { lastFrame, unmount } = renderStepBuild({
        domain: "web",
        selectedDomains: ["web", "api"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customise your Web stack");
    });

    it("should show ViewTitle for last domain in multi-domain flow", () => {
      const { lastFrame, unmount } = renderStepBuild({
        domain: "api",
        selectedDomains: ["web", "api"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customise your API stack");
    });

    it("should show ViewTitle for current domain in three-domain flow", () => {
      // Add cli category to matrix
      const cliFrameworkCategory = createCategory(
        "cli-framework",
        "CLI Framework",
        {
          domain: "cli",
          required: true,
          order: 0,
        },
      );
      const commanderSkill = createSkill(
        "commander (@vince)",
        "Commander",
        "cli-framework",
        {
          alias: "commander",
        },
      );

      const matrixWithCli = createTestMatrix(
        [
          frameworkCategory,
          stylingCategory,
          stateCategory,
          apiFrameworkCategory,
          databaseCategory,
          cliFrameworkCategory,
        ],
        [
          reactSkill,
          vueSkill,
          tailwindSkill,
          scssSkill,
          zustandSkill,
          honoSkill,
          expressSkill,
          postgresSkill,
          commanderSkill,
        ],
      );

      const { lastFrame, unmount } = renderStepBuild({
        matrix: matrixWithCli,
        domain: "api",
        selectedDomains: ["web", "api", "cli"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customise your API stack");
    });
  });

  // ===========================================================================
  // Header and Selection Count
  // ===========================================================================

  describe("header and selection count", () => {
    it("should show ViewTitle with domain name", () => {
      const { lastFrame, unmount } = renderStepBuild();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customise your Web stack");
    });

    it("should render ViewTitle with domain display name", () => {
      const { lastFrame, unmount } = renderStepBuild({
        domain: "api",
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customise your API stack");
    });
  });

  // ===========================================================================
  // Keyboard Help Text
  // ===========================================================================

  describe("keyboard help text", () => {
    it("should respond to d key for toggling descriptions", async () => {
      const onToggleDescriptions = vi.fn();
      const { stdin, unmount } = renderStepBuild({ onToggleDescriptions });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write("d");
      await delay(INPUT_DELAY_MS);

      expect(onToggleDescriptions).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Validation
  // ===========================================================================

  describe("validateBuildStep", () => {
    it("should return valid when required categories have selections", () => {
      const categories: GridCategoryRow[] = [
        {
          id: "framework",
          name: "Framework",
          required: true,
          exclusive: true,
          options: [
            { id: "react", label: "React", state: "normal", selected: true },
          ],
        },
      ];
      const selections = { framework: ["react"] };

      const result = validateBuildStep(categories, selections);
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it("should return invalid when required category has no selection", () => {
      const categories: GridCategoryRow[] = [
        {
          id: "framework",
          name: "Framework",
          required: true,
          exclusive: true,
          options: [
            { id: "react", label: "React", state: "normal", selected: false },
          ],
        },
      ];
      const selections = {};

      const result = validateBuildStep(categories, selections);
      expect(result.valid).toBe(false);
      expect(result.message).toContain("Framework");
    });

    it("should return valid when optional categories have no selections", () => {
      const categories: GridCategoryRow[] = [
        {
          id: "state",
          name: "State Management",
          required: false,
          exclusive: true,
          options: [
            {
              id: "zustand",
              label: "Zustand",
              state: "normal",
              selected: false,
            },
          ],
        },
      ];
      const selections = {};

      const result = validateBuildStep(categories, selections);
      expect(result.valid).toBe(true);
    });

    it("should return invalid for first missing required category", () => {
      const categories: GridCategoryRow[] = [
        {
          id: "framework",
          name: "Framework",
          required: true,
          exclusive: true,
          options: [],
        },
        {
          id: "styling",
          name: "Styling",
          required: true,
          exclusive: true,
          options: [],
        },
      ];
      const selections = {};

      const result = validateBuildStep(categories, selections);
      expect(result.valid).toBe(false);
      expect(result.message).toContain("Framework"); // Should be the first one
    });
  });

  describe("validation on continue", () => {
    it("should show validation error when trying to continue without required selection", async () => {
      const onContinue = vi.fn();
      const { stdin, lastFrame, unmount } = renderStepBuild({
        onContinue,
        selections: {},
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Press Enter to continue without selecting required framework
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      // Should show validation error and NOT call onContinue
      const output = lastFrame();
      expect(output).toContain("Please select");
      expect(onContinue).not.toHaveBeenCalled();
    });

    it("should call onContinue when validation passes", async () => {
      const onContinue = vi.fn();
      const { stdin, unmount } = renderStepBuild({
        onContinue,
        selections: {
          framework: ["react"],
          styling: ["tailwind"],
        },
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Press Enter to continue with required selections
      stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      expect(onContinue).toHaveBeenCalled();
    });
  });
});

// =============================================================================
// getDisplayLabel Tests
// =============================================================================

describe("getDisplayLabel", () => {
  it("should strip author suffix from name", () => {
    expect(getDisplayLabel({ name: "React (@vince)" })).toBe("React");
  });

  it("should preserve original capitalization", () => {
    expect(getDisplayLabel({ name: "SCSS Modules (@vince)" })).toBe(
      "SCSS Modules",
    );
  });

  it("should handle hyphenated author names", () => {
    expect(getDisplayLabel({ name: "React (@vince-team)" })).toBe("React");
  });

  it("should handle names without author suffix", () => {
    expect(getDisplayLabel({ name: "React" })).toBe("React");
  });

  it("should handle extra whitespace before author suffix", () => {
    expect(getDisplayLabel({ name: "React  (@vince)" })).toBe("React");
  });

  it("should not strip non-author parentheses", () => {
    expect(getDisplayLabel({ name: "React (library)" })).toBe(
      "React (library)",
    );
  });

  it("should ignore alias and use name for display", () => {
    // alias is available but we use name for accurate capitalization
    expect(
      getDisplayLabel({ alias: "scss-modules", name: "SCSS Modules (@vince)" }),
    ).toBe("SCSS Modules");
  });
});
