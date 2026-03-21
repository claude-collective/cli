import { describe, it, expect } from "vitest";
import { validateBuildStep, buildCategoriesForDomain } from "./build-step-logic";
import { createMockMatrix, createMockSkill, SKILLS, TEST_CATEGORIES } from "../__tests__/helpers";
import type { CategoryRow } from "../../components/wizard/category-grid";
import type { SkillId, Category, CategorySelections, CategoryDefinition } from "../../types";
import type { SkillConfig } from "../../types/config";
import { initializeMatrix } from "../matrix/matrix-provider";

describe("validateBuildStep", () => {
  const requiredCategory: CategoryRow = {
    id: "web-framework",
    displayName: "Framework",
    required: true,
    exclusive: true,
    options: [],
  };

  const optionalCategory: CategoryRow = {
    id: "shared-tooling",
    displayName: "Tooling",
    required: false,
    exclusive: false,
    options: [],
  };

  it("should return valid when no categories are required", () => {
    const result = validateBuildStep([optionalCategory], {});
    expect(result).toStrictEqual({ valid: true });
  });

  it("should return advisory message when required category has no selections", () => {
    const result = validateBuildStep([requiredCategory], {});
    expect(result.valid).toBe(true);
    expect(result.message).toContain("Framework");
  });

  it("should return valid when required category has selections", () => {
    const result = validateBuildStep([requiredCategory], {
      "web-framework": ["web-framework-react"],
    });
    expect(result).toStrictEqual({ valid: true });
  });

  it("should return advisory message for first missing required category", () => {
    const anotherRequired: CategoryRow = {
      id: "web-client-state",
      displayName: "State Management",
      required: true,
      exclusive: true,
      options: [],
    };
    const result = validateBuildStep([requiredCategory, anotherRequired], {});
    expect(result.valid).toBe(true);
    expect(result.message).toContain("Framework");
  });

  it("should handle empty categories array", () => {
    const result = validateBuildStep([], {});
    expect(result).toStrictEqual({ valid: true });
  });

  it("should return valid with no message when all required categories have selections", () => {
    const anotherRequired: CategoryRow = {
      id: "web-client-state",
      displayName: "State Management",
      required: true,
      exclusive: true,
      options: [],
    };
    const result = validateBuildStep([requiredCategory, anotherRequired], {
      "web-framework": ["web-framework-react"],
      "web-client-state": ["web-state-zustand"],
    });
    expect(result).toStrictEqual({ valid: true });
    expect(result.message).toBeUndefined();
  });

  it("should skip optional categories when checking for missing selections", () => {
    const result = validateBuildStep([optionalCategory, requiredCategory], {
      "web-framework": ["web-framework-react"],
    });
    expect(result).toStrictEqual({ valid: true });
    expect(result.message).toBeUndefined();
  });

  it("should treat empty array selections the same as missing key", () => {
    const result = validateBuildStep([requiredCategory], {
      "web-framework": [],
    });
    expect(result.valid).toBe(true);
    expect(result.message).toContain("Framework");
  });

  it("should return advisory for second required category when first is satisfied", () => {
    const secondRequired: CategoryRow = {
      id: "web-styling",
      displayName: "Styling",
      required: true,
      exclusive: true,
      options: [],
    };
    const result = validateBuildStep([requiredCategory, secondRequired], {
      "web-framework": ["web-framework-react"],
    });
    expect(result.valid).toBe(true);
    expect(result.message).toContain("Styling");
  });
});

describe("buildCategoriesForDomain", () => {
  const frameworkCategory: Category = "web-framework";
  const stateCategory: Category = "web-client-state";

  function createMatrix() {
    return createMockMatrix(SKILLS.react, SKILLS.vue, SKILLS.zustand, SKILLS.pinia, {
      categories: {
        [frameworkCategory]: { ...TEST_CATEGORIES.framework, required: true },
        [stateCategory]: {
          ...TEST_CATEGORIES.clientState,
          displayName: "State Management",
          order: 1,
        },
      } as Record<Category, CategoryDefinition>,
    });
  }

  it("should return categories with options for the given domain", () => {
    const matrix = createMatrix();
    initializeMatrix(matrix);
    const result = buildCategoriesForDomain("web", [], {});

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(frameworkCategory);
    expect(result[1].id).toBe(stateCategory);
  });

  it("should filter categories with no options", () => {
    const emptyMatrix = createMockMatrix(
      {},
      {
        categories: {
          [frameworkCategory]: { ...TEST_CATEGORIES.framework, required: true },
        } as Record<Category, CategoryDefinition>,
      },
    );
    initializeMatrix(emptyMatrix);

    const result = buildCategoriesForDomain("web", [], {});
    expect(result).toHaveLength(0);
  });

  it("should sort categories by order", () => {
    const matrix = createMatrix();
    initializeMatrix(matrix);
    const result = buildCategoriesForDomain("web", [], {});

    expect(result[0].id).toBe(frameworkCategory);
    expect(result[1].id).toBe(stateCategory);
  });

  it("should show all skills regardless of framework selection when filtering is off", () => {
    const matrix = createMatrix();
    initializeMatrix(matrix);

    // With React selected, all state skills still show (no filtering)
    const selections: CategorySelections = { "web-framework": ["web-framework-react"] };
    const result = buildCategoriesForDomain("web", [], selections);

    const stateRow = result.find((r) => r.id === stateCategory);
    expect(stateRow).toBeDefined();
    expect(stateRow!.options).toHaveLength(2);
  });

  it("should mark installed skills", () => {
    const matrix = createMatrix();
    initializeMatrix(matrix);
    const installedSkillIds: SkillId[] = ["web-framework-react"];

    const result = buildCategoriesForDomain("web", [], {}, installedSkillIds);

    const frameworkRow = result.find((r) => r.id === frameworkCategory);
    const reactOption = frameworkRow?.options.find((o) => o.id === "web-framework-react");
    const vueOption = frameworkRow?.options.find(
      (o) => o.id === "web-framework-vue-composition-api",
    );

    expect(reactOption?.installed).toBe(true);
    expect(vueOption?.installed).toBe(false);
  });

  it("should mark all skills as not installed when no installed IDs provided", () => {
    const matrix = createMatrix();
    initializeMatrix(matrix);

    const result = buildCategoriesForDomain("web", [], {});

    const frameworkRow = result.find((r) => r.id === frameworkCategory);
    for (const option of frameworkRow!.options) {
      expect(option.installed).toBe(false);
    }
  });

  it("should set scope from skillConfigs", () => {
    const matrix = createMatrix();
    initializeMatrix(matrix);

    const skillConfigs: SkillConfig[] = [
      { id: "web-framework-react", scope: "global", source: "local" },
      { id: "web-state-zustand", scope: "project", source: "local" },
    ];

    const result = buildCategoriesForDomain("web", [], {}, [], skillConfigs);

    const frameworkRow = result.find((r) => r.id === frameworkCategory);
    const reactOption = frameworkRow?.options.find((o) => o.id === "web-framework-react");
    expect(reactOption?.scope).toBe("global");

    const stateRow = result.find((r) => r.id === stateCategory);
    const zustandOption = stateRow?.options.find((o) => o.id === "web-state-zustand");
    expect(zustandOption?.scope).toBe("project");
  });

  it("should leave scope undefined when skill not in skillConfigs", () => {
    const matrix = createMatrix();
    initializeMatrix(matrix);

    const skillConfigs: SkillConfig[] = [
      { id: "web-framework-react", scope: "project", source: "local" },
    ];

    const result = buildCategoriesForDomain("web", [], {}, [], skillConfigs);

    const frameworkRow = result.find((r) => r.id === frameworkCategory);
    const vueOption = frameworkRow?.options.find(
      (o) => o.id === "web-framework-vue-composition-api",
    );
    expect(vueOption?.scope).toBeUndefined();
  });

  it("should propagate category required and exclusive flags", () => {
    const matrix = createMockMatrix(SKILLS.react, {
      categories: {
        [frameworkCategory]: {
          ...TEST_CATEGORIES.framework,
          required: true,
          exclusive: false,
        },
      } as Record<Category, CategoryDefinition>,
    });
    initializeMatrix(matrix);

    const result = buildCategoriesForDomain("web", [], {});

    expect(result[0].required).toBe(true);
    expect(result[0].exclusive).toBe(false);
  });

  it("should default required to false and exclusive to true when not set", () => {
    // Omit required and exclusive to test ?? defaulting in buildCategoriesForDomain
    const { required, exclusive, ...frameworkWithoutFlags } = TEST_CATEGORIES.framework;
    const matrix = createMockMatrix(SKILLS.react, {
      categories: {
        [frameworkCategory]: frameworkWithoutFlags,
      } as Record<Category, CategoryDefinition>,
    });
    initializeMatrix(matrix);

    const result = buildCategoriesForDomain("web", [], {});

    expect(result[0].required).toBe(false);
    expect(result[0].exclusive).toBe(true);
  });

  it("should only return categories matching the requested domain", () => {
    const apiCategory: Category = "api-api";
    const matrix = createMockMatrix(SKILLS.react, SKILLS.hono, {
      categories: {
        [frameworkCategory]: { ...TEST_CATEGORIES.framework, required: true },
        [apiCategory]: {
          ...TEST_CATEGORIES.api,
          domain: "api" as const,
          displayName: "API Framework",
        },
      } as Record<Category, CategoryDefinition>,
    });
    initializeMatrix(matrix);

    const webResult = buildCategoriesForDomain("web", [], {});
    expect(webResult).toHaveLength(1);
    expect(webResult[0].id).toBe(frameworkCategory);

    const apiResult = buildCategoriesForDomain("api", [], {});
    expect(apiResult).toHaveLength(1);
    expect(apiResult[0].id).toBe(apiCategory);
  });

  it("should return empty array when no categories match the domain", () => {
    const matrix = createMockMatrix(SKILLS.react, {
      categories: {
        [frameworkCategory]: { ...TEST_CATEGORIES.framework },
      } as Record<Category, CategoryDefinition>,
    });
    initializeMatrix(matrix);

    const result = buildCategoriesForDomain("api", [], {});
    expect(result).toHaveLength(0);
  });

  describe("framework-first filtering", () => {
    function createFilterableMatrix() {
      return createMockMatrix(SKILLS.react, SKILLS.vue, SKILLS.zustand, SKILLS.pinia, {
        categories: {
          [frameworkCategory]: { ...TEST_CATEGORIES.framework, required: true },
          [stateCategory]: {
            ...TEST_CATEGORIES.clientState,
            displayName: "State Management",
            order: 1,
          },
        } as Record<Category, CategoryDefinition>,
      });
    }

    it("should filter incompatible skills when filterIncompatible is true and framework selected", () => {
      const matrix = createFilterableMatrix();
      initializeMatrix(matrix);

      const selections: CategorySelections = { "web-framework": ["web-framework-react"] };
      const result = buildCategoriesForDomain("web", [], selections, [], [], true);

      const stateRow = result.find((r) => r.id === stateCategory);
      expect(stateRow).toBeDefined();

      // Zustand is compatibleWith react, pinia is compatibleWith vue
      const skillIds = stateRow!.options.map((o) => o.id);
      expect(skillIds).toContain("web-state-zustand");
      expect(skillIds).not.toContain("web-state-pinia");
    });

    it("should NOT filter the framework category itself", () => {
      const matrix = createFilterableMatrix();
      initializeMatrix(matrix);

      const selections: CategorySelections = { "web-framework": ["web-framework-react"] };
      const result = buildCategoriesForDomain("web", [], selections, [], [], true);

      const frameworkRow = result.find((r) => r.id === frameworkCategory);
      expect(frameworkRow).toBeDefined();
      // Framework category should show all frameworks regardless of filtering
      expect(frameworkRow!.options).toHaveLength(2);
    });

    it("should NOT filter on non-web domains even when filterIncompatible is true", () => {
      const apiCategory: Category = "api-api";
      const apiDbCategory: Category = "api-database";
      const matrix = createMockMatrix(SKILLS.hono, SKILLS.drizzle, {
        categories: {
          [apiCategory]: {
            ...TEST_CATEGORIES.api,
            domain: "api" as const,
            required: true,
          },
          [apiDbCategory]: {
            ...TEST_CATEGORIES.database,
            domain: "api" as const,
            order: 1,
          },
        } as Record<Category, CategoryDefinition>,
      });
      initializeMatrix(matrix);

      const selections: CategorySelections = { "api-api": ["api-framework-hono"] };
      const result = buildCategoriesForDomain("api", [], selections, [], [], true);

      const dbRow = result.find((r) => r.id === apiDbCategory);
      expect(dbRow).toBeDefined();
      expect(dbRow!.options).toHaveLength(1);
    });

    it("should NOT filter when no frameworks are selected even with filterIncompatible true", () => {
      const matrix = createFilterableMatrix();
      initializeMatrix(matrix);

      const result = buildCategoriesForDomain("web", [], {}, [], [], true);

      const stateRow = result.find((r) => r.id === stateCategory);
      expect(stateRow).toBeDefined();
      // Both zustand and pinia should be visible since no framework is selected
      expect(stateRow!.options).toHaveLength(2);
    });

    it("should show skills with empty compatibleWith regardless of framework selection", () => {
      const universalSkill = createMockSkill("web-state-zustand", {
        compatibleWith: [],
      });
      const matrix = createMockMatrix(SKILLS.react, universalSkill, SKILLS.pinia, {
        categories: {
          [frameworkCategory]: { ...TEST_CATEGORIES.framework, required: true },
          [stateCategory]: {
            ...TEST_CATEGORIES.clientState,
            displayName: "State Management",
            order: 1,
          },
        } as Record<Category, CategoryDefinition>,
      });
      initializeMatrix(matrix);

      const selections: CategorySelections = { "web-framework": ["web-framework-react"] };
      const result = buildCategoriesForDomain("web", [], selections, [], [], true);

      const stateRow = result.find((r) => r.id === stateCategory);
      const skillIds = stateRow!.options.map((o) => o.id);
      // universalSkill has empty compatibleWith so it should pass through
      expect(skillIds).toContain("web-state-zustand");
    });
  });

  describe("selected skill state", () => {
    it("should mark skills as selected when in allSelections", () => {
      const matrix = createMatrix();
      initializeMatrix(matrix);

      const allSelections: SkillId[] = ["web-framework-react"];
      const result = buildCategoriesForDomain("web", allSelections, {});

      const frameworkRow = result.find((r) => r.id === frameworkCategory);
      const reactOption = frameworkRow?.options.find((o) => o.id === "web-framework-react");
      const vueOption = frameworkRow?.options.find(
        (o) => o.id === "web-framework-vue-composition-api",
      );

      expect(reactOption?.selected).toBe(true);
      expect(vueOption?.selected).toBe(false);
    });

    it("should set requiredBy for unselected skills that are required by selected ones", () => {
      // Create a skill that requires zustand
      const reactWithRequires = createMockSkill("web-framework-react", {
        requires: [
          {
            skillIds: ["web-state-zustand"],
            needsAny: false,
            reason: "Needs Zustand",
          },
        ],
      });
      const matrix = createMockMatrix(reactWithRequires, SKILLS.zustand, {
        categories: {
          [frameworkCategory]: { ...TEST_CATEGORIES.framework, required: true },
          [stateCategory]: {
            ...TEST_CATEGORIES.clientState,
            displayName: "State Management",
            order: 1,
          },
        } as Record<Category, CategoryDefinition>,
      });
      initializeMatrix(matrix);

      // React is selected but zustand is not
      const allSelections: SkillId[] = ["web-framework-react"];
      const result = buildCategoriesForDomain("web", allSelections, {});

      const stateRow = result.find((r) => r.id === stateCategory);
      const zustandOption = stateRow?.options.find((o) => o.id === "web-state-zustand");
      // zustand is not selected, so requiredBy should show the display name of the skill requiring it
      expect(zustandOption?.requiredBy).toBe("React");
    });

    it("should not set requiredBy for selected skills", () => {
      const reactWithRequires = createMockSkill("web-framework-react", {
        requires: [
          {
            skillIds: ["web-state-zustand"],
            needsAny: false,
            reason: "Needs Zustand",
          },
        ],
      });
      const matrix = createMockMatrix(reactWithRequires, SKILLS.zustand, {
        categories: {
          [frameworkCategory]: { ...TEST_CATEGORIES.framework, required: true },
          [stateCategory]: {
            ...TEST_CATEGORIES.clientState,
            displayName: "State Management",
            order: 1,
          },
        } as Record<Category, CategoryDefinition>,
      });
      initializeMatrix(matrix);

      // Both selected
      const allSelections: SkillId[] = ["web-framework-react", "web-state-zustand"];
      const result = buildCategoriesForDomain("web", allSelections, {});

      const stateRow = result.find((r) => r.id === stateCategory);
      const zustandOption = stateRow?.options.find((o) => o.id === "web-state-zustand");
      // zustand IS selected, so requiredBy should be undefined
      expect(zustandOption?.requiredBy).toBeUndefined();
    });
  });

  describe("local skills", () => {
    it("should propagate local flag from matrix skill", () => {
      const localSkill = createMockSkill("web-framework-react", { local: true });
      const matrix = createMockMatrix(localSkill, {
        categories: {
          [frameworkCategory]: { ...TEST_CATEGORIES.framework },
        } as Record<Category, CategoryDefinition>,
      });
      initializeMatrix(matrix);

      const result = buildCategoriesForDomain("web", [], {});

      const frameworkRow = result.find((r) => r.id === frameworkCategory);
      const reactOption = frameworkRow?.options.find((o) => o.id === "web-framework-react");
      expect(reactOption?.local).toBe(true);
    });

    it("should leave local undefined for non-local skills", () => {
      const matrix = createMockMatrix(SKILLS.react, {
        categories: {
          [frameworkCategory]: { ...TEST_CATEGORIES.framework },
        } as Record<Category, CategoryDefinition>,
      });
      initializeMatrix(matrix);

      const result = buildCategoriesForDomain("web", [], {});

      const frameworkRow = result.find((r) => r.id === frameworkCategory);
      const reactOption = frameworkRow?.options.find((o) => o.id === "web-framework-react");
      expect(reactOption?.local).toBeUndefined();
    });
  });

  describe("category displayName", () => {
    it("should use displayName from category definition", () => {
      const matrix = createMockMatrix(SKILLS.react, {
        categories: {
          [frameworkCategory]: {
            ...TEST_CATEGORIES.framework,
            displayName: "Web Framework",
          },
        } as Record<Category, CategoryDefinition>,
      });
      initializeMatrix(matrix);

      const result = buildCategoriesForDomain("web", [], {});
      expect(result[0].displayName).toBe("Web Framework");
    });
  });

  describe("sorting", () => {
    it("should sort categories by ascending order value", () => {
      const stylingCategory: Category = "web-styling";
      const matrix = createMockMatrix(SKILLS.react, SKILLS.zustand, SKILLS.scss, {
        categories: {
          [stateCategory]: {
            ...TEST_CATEGORIES.clientState,
            displayName: "State Management",
            order: 10,
          },
          [frameworkCategory]: { ...TEST_CATEGORIES.framework, order: 5 },
          [stylingCategory]: { ...TEST_CATEGORIES.styling, order: 1 },
        } as Record<Category, CategoryDefinition>,
      });
      initializeMatrix(matrix);

      const result = buildCategoriesForDomain("web", [], {});

      expect(result[0].id).toBe(stylingCategory);
      expect(result[1].id).toBe(frameworkCategory);
      expect(result[2].id).toBe(stateCategory);
    });

    it("should treat undefined order as 0", () => {
      // Omit order from framework to test ?? 0 defaulting in buildCategoriesForDomain
      const { order, ...frameworkWithoutOrder } = TEST_CATEGORIES.framework;
      const matrix = createMockMatrix(SKILLS.react, SKILLS.zustand, {
        categories: {
          [stateCategory]: {
            ...TEST_CATEGORIES.clientState,
            displayName: "State Management",
            order: 1,
          },
          [frameworkCategory]: frameworkWithoutOrder,
        } as Record<Category, CategoryDefinition>,
      });
      initializeMatrix(matrix);

      const result = buildCategoriesForDomain("web", [], {});

      // undefined order is treated as 0, which comes before 1
      expect(result[0].id).toBe(frameworkCategory);
      expect(result[1].id).toBe(stateCategory);
    });
  });
});
