import { describe, it, expect } from "vitest";
import {
  validateBuildStep,
  computeOptionState,
  getSkillDisplayLabel,
  buildCategoriesForDomain,
} from "./build-step-logic";
import { createMockMatrix, TEST_SKILLS, TEST_CATEGORIES } from "../__tests__/helpers";
import type { CategoryRow } from "../../components/wizard/category-grid";
import type { SkillId, Subcategory } from "../../types";

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
  it("should return disabled when skill is disabled", () => {
    expect(computeOptionState({ disabled: true, discouraged: false, recommended: false })).toBe(
      "disabled",
    );
  });

  it("should return discouraged when skill is discouraged", () => {
    expect(computeOptionState({ disabled: false, discouraged: true, recommended: false })).toBe(
      "discouraged",
    );
  });

  it("should return recommended when skill is recommended", () => {
    expect(computeOptionState({ disabled: false, discouraged: false, recommended: true })).toBe(
      "recommended",
    );
  });

  it("should return normal when no special state", () => {
    expect(computeOptionState({ disabled: false, discouraged: false, recommended: false })).toBe(
      "normal",
    );
  });

  it("should prioritize disabled over discouraged", () => {
    expect(computeOptionState({ disabled: true, discouraged: true, recommended: false })).toBe(
      "disabled",
    );
  });

  it("should prioritize disabled over recommended", () => {
    expect(computeOptionState({ disabled: true, discouraged: false, recommended: true })).toBe(
      "disabled",
    );
  });

  it("should prioritize discouraged over recommended", () => {
    expect(computeOptionState({ disabled: false, discouraged: true, recommended: true })).toBe(
      "discouraged",
    );
  });
});

describe("getSkillDisplayLabel", () => {
  it("should return displayName when present", () => {
    expect(getSkillDisplayLabel({ displayName: "React", id: "web-framework-react" })).toBe("React");
  });

  it("should return id when displayName is undefined", () => {
    expect(getSkillDisplayLabel({ id: "web-framework-react" })).toBe("web-framework-react");
  });

  it("should return id when displayName is empty string", () => {
    expect(getSkillDisplayLabel({ displayName: "", id: "web-framework-react" })).toBe(
      "web-framework-react",
    );
  });
});

describe("buildCategoriesForDomain", () => {
  const frameworkCategory: Subcategory = "web-framework";
  const stateCategory: Subcategory = "web-client-state";

  function createMatrix() {
    return createMockMatrix(
      {
        "web-framework-react": TEST_SKILLS.react,
        "web-framework-vue": TEST_SKILLS.vue,
        "web-state-zustand": TEST_SKILLS.zustand,
        "web-state-pinia": TEST_SKILLS.pinia,
      },
      {
        categories: {
          [frameworkCategory]: { ...TEST_CATEGORIES.framework, required: true },
          [stateCategory]: {
            ...TEST_CATEGORIES.clientState,
            displayName: "State Management",
            order: 1,
          },
        } as Record<Subcategory, import("../../types").CategoryDefinition>,
      },
    );
  }

  it("should return categories with options for the given domain", () => {
    const matrix = createMatrix();
    const result = buildCategoriesForDomain("web", [], matrix, false, {});

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
        } as Record<Subcategory, import("../../types").CategoryDefinition>,
      },
    );

    const result = buildCategoriesForDomain("web", [], emptyMatrix, false, {});
    expect(result).toHaveLength(0);
  });

  it("should sort categories by order", () => {
    const matrix = createMatrix();
    const result = buildCategoriesForDomain("web", [], matrix, false, {});

    expect(result[0].id).toBe(frameworkCategory);
    expect(result[1].id).toBe(stateCategory);
  });

  it("should apply framework filtering for non-framework categories in web domain", () => {
    const matrix = createMatrix();

    // With React selected as framework, only Zustand (compatible with React) should show
    const selections = { "web-framework": ["web-framework-react" as SkillId] };
    const result = buildCategoriesForDomain("web", [], matrix, false, selections);

    const stateRow = result.find((r) => r.id === stateCategory);
    expect(stateRow).toBeDefined();
    expect(stateRow!.options).toHaveLength(1);
    expect(stateRow!.options[0].id).toBe("web-state-zustand");
  });

  it("should not apply framework filtering when no framework is selected", () => {
    const matrix = createMatrix();

    const result = buildCategoriesForDomain("web", [], matrix, false, {});

    const stateRow = result.find((r) => r.id === stateCategory);
    expect(stateRow).toBeDefined();
    expect(stateRow!.options).toHaveLength(2);
  });

  it("should mark installed skills", () => {
    const matrix = createMatrix();
    const installedSkillIds = ["web-framework-react" as import("../../types").SkillId];

    const result = buildCategoriesForDomain("web", [], matrix, false, {}, installedSkillIds);

    const frameworkRow = result.find((r) => r.id === frameworkCategory);
    const reactOption = frameworkRow?.options.find((o) => o.id === "web-framework-react");
    const vueOption = frameworkRow?.options.find((o) => o.id === "web-framework-vue");

    expect(reactOption?.installed).toBe(true);
    expect(vueOption?.installed).toBe(false);
  });
});
