import { describe, it, expect } from "vitest";
import {
  validateBuildStep,
  computeOptionState,
  buildCategoriesForDomain,
} from "./build-step-logic";
import { createMockMatrix, SKILLS, TEST_CATEGORIES } from "../__tests__/helpers";
import type { CategoryRow } from "../../components/wizard/category-grid";
import type { SkillId, Category, CategorySelections } from "../../types";
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
    expect(result).toEqual({ valid: true });
  });

  it("should return invalid when required category has no selections", () => {
    const result = validateBuildStep([requiredCategory], {});
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Framework");
  });

  it("should return valid when required category has selections", () => {
    const result = validateBuildStep([requiredCategory], {
      "web-framework": ["web-framework-react"],
    });
    expect(result).toEqual({ valid: true });
  });

  it("should return invalid for first missing required category", () => {
    const anotherRequired: CategoryRow = {
      id: "web-client-state",
      displayName: "State Management",
      required: true,
      exclusive: true,
      options: [],
    };
    const result = validateBuildStep([requiredCategory, anotherRequired], {});
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Framework");
  });

  it("should handle empty categories array", () => {
    const result = validateBuildStep([], {});
    expect(result).toEqual({ valid: true });
  });
});

describe("computeOptionState", () => {
  it("should return discouraged when skill is discouraged", () => {
    expect(computeOptionState({ discouraged: true, recommended: false })).toBe("discouraged");
  });

  it("should return recommended when skill is recommended", () => {
    expect(computeOptionState({ discouraged: false, recommended: true })).toBe("recommended");
  });

  it("should return normal when no special state", () => {
    expect(computeOptionState({ discouraged: false, recommended: false })).toBe("normal");
  });

  it("should prioritize discouraged over recommended", () => {
    expect(computeOptionState({ discouraged: true, recommended: true })).toBe("discouraged");
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
      } as Record<Category, import("../../types").CategoryDefinition>,
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
        } as Record<Category, import("../../types").CategoryDefinition>,
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

  it("should apply framework filtering for non-framework categories in web domain", () => {
    const matrix = createMatrix();
    initializeMatrix(matrix);

    // With React selected as framework, only Zustand (compatible with React) should show
    const selections: CategorySelections = { "web-framework": ["web-framework-react"] };
    const result = buildCategoriesForDomain("web", [], selections);

    const stateRow = result.find((r) => r.id === stateCategory);
    expect(stateRow).toBeDefined();
    expect(stateRow!.options).toHaveLength(1);
    expect(stateRow!.options[0].id).toBe("web-state-zustand");
  });

  it("should not apply framework filtering when no framework is selected", () => {
    const matrix = createMatrix();
    initializeMatrix(matrix);

    const result = buildCategoriesForDomain("web", [], {});

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
});
