import { render } from "ink-testing-library";
import { indexBy } from "remeda";
import { describe, expect, it, afterEach, vi } from "vitest";
import { StepBuild, type StepBuildProps } from "./step-build";
import { validateBuildStep, getSkillDisplayLabel } from "../../lib/wizard/index";
import { orderDomains } from "./utils";
import type { CategoryRow as GridCategoryRow } from "./category-grid";
import type {
  CategoryDefinition,
  ResolvedSkill,
  Subcategory,
  SubcategorySelections,
} from "../../types";
import {
  ENTER,
  ESCAPE,
  RENDER_DELAY_MS,
  INPUT_DELAY_MS,
  delay,
} from "../../lib/__tests__/test-constants";
import {
  createMockCategory,
  createMockSkill,
  createMockMatrix,
  TEST_SKILLS,
  TEST_CATEGORIES,
} from "../../lib/__tests__/helpers";

const SKILL_DEFAULTS: Partial<ResolvedSkill> = { categoryExclusive: true };

// Test data construction cast: indexBy returns generic Record
const buildTestMatrix = (categories: CategoryDefinition[], skills: ResolvedSkill[]) =>
  createMockMatrix(
    indexBy(skills, (s) => s.id),
    {
      categories: indexBy(categories, (c) => c.id) as Record<Subcategory, CategoryDefinition>,
    },
  );

const frameworkCategory = {
  ...TEST_CATEGORIES.framework,
  domain: "web" as const,
  required: true,
  order: 0,
};

const stylingCategory = {
  ...TEST_CATEGORIES.styling,
  domain: "web" as const,
  required: true,
  order: 1,
};

const stateCategory = {
  ...TEST_CATEGORIES.clientState,
  domain: "web" as const,
  required: false,
  order: 2,
};

const apiFrameworkCategory = {
  ...TEST_CATEGORIES.api,
  displayName: "API Framework",
  domain: "api" as const,
  required: true,
  order: 0,
};

const databaseCategory = {
  ...TEST_CATEGORIES.database,
  domain: "api" as const,
  required: false,
  order: 1,
};

const reactSkill = { ...TEST_SKILLS.react, ...SKILL_DEFAULTS, displayName: "react" as const };
const vueSkill = { ...TEST_SKILLS.vue, ...SKILL_DEFAULTS, displayName: "vue" as const };

const tailwindSkill = createMockSkill("web-styling-tailwind", "web-styling", {
  ...SKILL_DEFAULTS,
  displayName: "tailwind",
});

const scssSkill = {
  ...TEST_SKILLS.scssModules,
  ...SKILL_DEFAULTS,
  displayName: "scss-modules" as const,
};
const zustandSkill = { ...TEST_SKILLS.zustand, ...SKILL_DEFAULTS, displayName: "zustand" as const };
const honoSkill = { ...TEST_SKILLS.hono, ...SKILL_DEFAULTS, displayName: "hono" as const };

const expressSkill = createMockSkill("api-framework-express", "api-api", {
  ...SKILL_DEFAULTS,
  displayName: "express",
});

const postgresSkill = createMockSkill("api-database-postgres", "api-database", {
  ...SKILL_DEFAULTS,
});

const defaultMatrix = buildTestMatrix(
  [frameworkCategory, stylingCategory, stateCategory, apiFrameworkCategory, databaseCategory],
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

const defaultProps: StepBuildProps = {
  matrix: defaultMatrix,
  domain: "web",
  selectedDomains: ["web"],
  selections: {},
  allSelections: [],
  showLabels: false,
  expertMode: false,
  onToggle: vi.fn(),
  onToggleLabels: vi.fn(),
  onContinue: vi.fn(),
  onBack: vi.fn(),
};

const renderStepBuild = (props: Partial<StepBuildProps> = {}) => {
  return render(<StepBuild {...defaultProps} {...props} />);
};

describe("StepBuild component", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  describe("rendering", () => {
    it("should render CategoryGrid with correct categories for domain", () => {
      // For web domain with framework-first flow, initially only shows Framework
      // To see other categories, need a framework selection
      const { lastFrame, unmount } = renderStepBuild({
        selections: { "web-framework": ["web-framework-react"] }, // Framework selected to show other categories
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
        selections: { "web-framework": ["web-framework-react"] },
      });
      cleanup = unmount;

      const output = lastFrame();
      // Framework skills (displayed as alias)
      expect(output).toContain("react");
      expect(output).toContain("vue");
      // Styling skills (visible after framework selected)
      expect(output).toContain("tailwind");
      expect(output).toContain("scss-modules");
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
        selections: { "web-framework": ["web-framework-react"] },
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should render the domain categories
      expect(output).toContain("Framework");
      expect(output).toContain("Styling");
    });
  });

  describe("domain header", () => {
    it("should show ViewTitle with current domain when multiple domains selected", () => {
      const { lastFrame, unmount } = renderStepBuild({
        selectedDomains: ["web", "api"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customize your Web stack");
    });

    it("should show ViewTitle with domain when only one selected", () => {
      const { lastFrame, unmount } = renderStepBuild({
        selectedDomains: ["web"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customize your Web stack");
    });

    it("should show ViewTitle for current domain on final domain", () => {
      const { lastFrame, unmount } = renderStepBuild({
        selectedDomains: ["web", "api"],
        domain: "api",
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customize your API stack");
    });

    it("should show correct domain display names", () => {
      const { lastFrame, unmount } = renderStepBuild({
        selectedDomains: ["web", "api", "cli"],
        domain: "api",
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customize your API stack");
    });

    it("should display domains in canonical order regardless of selection order", () => {
      // Domains selected in reverse order: CLI, Mobile, API, Web
      expect(orderDomains(["cli", "mobile", "api", "web"])).toEqual([
        "web",
        "api",
        "mobile",
        "cli",
      ]);
    });

    it("should preserve canonical order with partial domain selection", () => {
      // Only CLI and Web selected, in reverse order
      expect(orderDomains(["cli", "web"])).toEqual(["web", "cli"]);
    });
  });

  describe("category filtering", () => {
    it("should filter categories correctly by domain", () => {
      // Web domain with framework selected (to bypass framework-first filter)
      const { lastFrame: webFrame, unmount: webUnmount } = renderStepBuild({
        domain: "web",
        selections: { "web-framework": ["web-framework-react"] },
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
        selections: { "web-framework": ["web-framework-react"] },
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

  describe("option states", () => {
    it("should show selected options correctly", () => {
      const { lastFrame, unmount } = renderStepBuild({
        allSelections: ["web-framework-react"],
        selections: { "web-framework": ["web-framework-react"] },
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should show selected option (no circle symbol anymore, uses background)
      // Just verify the selected label is present (displayed as alias)
      expect(output).toContain("react");
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

    it("should pass showLabels to CategoryGrid", () => {
      const { lastFrame, unmount } = renderStepBuild({
        showLabels: true,
      });
      cleanup = unmount;

      const output = lastFrame();
      // Labels toggle is now shown globally in wizard-layout
      // Verify component renders without error
      expect(output).toBeDefined();
    });
  });

  describe("keyboard navigation", () => {
    it("should call onContinue when Enter is pressed with valid selections", async () => {
      const onContinue = vi.fn();
      // Provide selections for required categories to pass validation
      const { stdin, unmount } = renderStepBuild({
        onContinue,
        selections: {
          "web-framework": ["web-framework-react"],
          "web-styling": ["web-styling-tailwind"],
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

    it("should pass toggle callback to CategoryGrid", async () => {
      const onToggle = vi.fn();
      const { stdin, unmount } = renderStepBuild({
        onToggle,
      });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      // Space should trigger toggle
      stdin.write(" ");
      await delay(INPUT_DELAY_MS);

      expect(onToggle).toHaveBeenCalled();
    });
  });

  describe("toggle callbacks", () => {
    it("should pass onToggleLabels to CategoryGrid", async () => {
      const onToggleLabels = vi.fn();
      const { stdin, unmount } = renderStepBuild({ onToggleLabels });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write("d"); // 'd' key toggles compatibility labels
      await delay(INPUT_DELAY_MS);

      expect(onToggleLabels).toHaveBeenCalled();
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
        domain: "shared",
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
        allSelections: ["api-framework-hono", "api-database-drizzle"], // API skills (aliases)
        selections: { "web-framework": ["web-framework-react"] }, // Need framework to see other categories
      });
      cleanup = unmount;

      const output = lastFrame();
      // Should still render web categories
      expect(output).toContain("Framework");
      expect(output).toContain("Styling");
    });
  });

  describe("multi-domain scenarios", () => {
    it("should show ViewTitle for current domain in multi-domain flow", () => {
      const { lastFrame, unmount } = renderStepBuild({
        domain: "web",
        selectedDomains: ["web", "api"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customize your Web stack");
    });

    it("should show ViewTitle for last domain in multi-domain flow", () => {
      const { lastFrame, unmount } = renderStepBuild({
        domain: "api",
        selectedDomains: ["web", "api"],
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customize your API stack");
    });

    it("should show ViewTitle for current domain in three-domain flow", () => {
      // Add cli category to matrix
      const cliFrameworkCategory = createMockCategory("cli-framework", "CLI Framework", {
        domain: "cli",
        required: true,
        order: 0,
      });
      const commanderSkill = createMockSkill("cli-cli-framework-commander", "cli-framework", {
        ...SKILL_DEFAULTS,
        displayName: "commander",
      });

      const matrixWithCli = buildTestMatrix(
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
      expect(output).toContain("Customize your API stack");
    });
  });

  describe("header and selection count", () => {
    it("should show ViewTitle with domain name", () => {
      const { lastFrame, unmount } = renderStepBuild();
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customize your Web stack");
    });

    it("should render ViewTitle with domain display name", () => {
      const { lastFrame, unmount } = renderStepBuild({
        domain: "api",
      });
      cleanup = unmount;

      const output = lastFrame();
      expect(output).toContain("Customize your API stack");
    });
  });

  describe("keyboard help text", () => {
    it("should respond to d key for toggling compatibility labels", async () => {
      const onToggleLabels = vi.fn();
      const { stdin, unmount } = renderStepBuild({ onToggleLabels });
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      stdin.write("d");
      await delay(INPUT_DELAY_MS);

      expect(onToggleLabels).toHaveBeenCalled();
    });
  });

  describe("validateBuildStep", () => {
    it("should return valid when required categories have selections", () => {
      const categories: GridCategoryRow[] = [
        {
          id: "web-framework",
          displayName: "Framework",
          required: true,
          exclusive: true,
          options: [{ id: "web-framework-react", label: "React", state: "normal", selected: true }],
        },
      ];
      const selections: SubcategorySelections = { "web-framework": ["web-framework-react"] };

      const result = validateBuildStep(categories, selections);
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it("should return invalid when required category has no selection", () => {
      const categories: GridCategoryRow[] = [
        {
          id: "web-framework",
          displayName: "Framework",
          required: true,
          exclusive: true,
          options: [
            { id: "web-framework-react", label: "React", state: "normal", selected: false },
          ],
        },
      ];
      const selections: SubcategorySelections = {};

      const result = validateBuildStep(categories, selections);
      expect(result.valid).toBe(false);
      expect(result.message).toContain("Framework");
    });

    it("should return valid when optional categories have no selections", () => {
      const categories: GridCategoryRow[] = [
        {
          id: "web-client-state",
          displayName: "State Management",
          required: false,
          exclusive: true,
          options: [
            {
              id: "web-state-zustand",
              label: "Zustand",
              state: "normal",
              selected: false,
            },
          ],
        },
      ];
      const selections: SubcategorySelections = {};

      const result = validateBuildStep(categories, selections);
      expect(result.valid).toBe(true);
    });

    it("should return invalid for first missing required category", () => {
      const categories: GridCategoryRow[] = [
        {
          id: "web-framework",
          displayName: "Framework",
          required: true,
          exclusive: true,
          options: [],
        },
        {
          id: "web-styling",
          displayName: "Styling",
          required: true,
          exclusive: true,
          options: [],
        },
      ];
      const selections: SubcategorySelections = {};

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
      expect(output).toContain("Select at least one skill");
      expect(onContinue).not.toHaveBeenCalled();
    });

    it("should call onContinue when validation passes", async () => {
      const onContinue = vi.fn();
      const { stdin, unmount } = renderStepBuild({
        onContinue,
        selections: {
          "web-framework": ["web-framework-react"],
          "web-styling": ["web-styling-tailwind"],
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

describe("getSkillDisplayLabel", () => {
  it("should return displayName when available", () => {
    expect(getSkillDisplayLabel({ displayName: "react", id: "web-framework-react" })).toBe("react");
  });

  it("should return id when no displayName", () => {
    expect(getSkillDisplayLabel({ id: "web-framework-react" })).toBe("web-framework-react");
  });

  it("should prefer displayName over id", () => {
    expect(
      getSkillDisplayLabel({ displayName: "scss-modules", id: "web-styling-scss-modules" }),
    ).toBe("scss-modules");
  });
});
