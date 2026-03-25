import { describe, it, expect } from "vitest";
import { validateBuildStep, buildCategoriesForDomain } from "./build-step-logic";
import {
  BUILD_STEP_ADVISORY_STATES_MATRIX,
  BUILD_STEP_API_DB_MATRIX,
  BUILD_STEP_CONFLICTS_EXCLUSIVE_MATRIX,
  BUILD_STEP_CONFLICTS_NON_EXCLUSIVE_MATRIX,
  BUILD_STEP_DISPLAY_NAME_MATRIX,
  BUILD_STEP_EMPTY_FRAMEWORK_MATRIX,
  BUILD_STEP_FRAMEWORK_API_MATRIX,
  BUILD_STEP_FRAMEWORK_NO_FLAGS_MATRIX,
  BUILD_STEP_FRAMEWORK_NON_EXCLUSIVE_MATRIX,
  BUILD_STEP_FRAMEWORK_ONLY_MATRIX,
  BUILD_STEP_LOCAL_SKILL_MATRIX,
  BUILD_STEP_NON_LOCAL_MATRIX,
  BUILD_STEP_REQUIRES_MATRIX,
  BUILD_STEP_SORTING_MATRIX,
  BUILD_STEP_UNDEFINED_ORDER_MATRIX,
  BUILD_STEP_UNIVERSAL_COMPAT_MATRIX,
  BUILD_STEP_WEB_MATRIX,
} from "../__tests__/mock-data/mock-matrices";
import type { CategoryRow } from "../../components/wizard/category-grid";
import type { SkillId, Category, CategorySelections } from "../../types";
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

  it("should return categories with options for the given domain", () => {
    initializeMatrix(BUILD_STEP_WEB_MATRIX);
    const result = buildCategoriesForDomain("web", [], {});

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(frameworkCategory);
    expect(result[1].id).toBe(stateCategory);
  });

  it("should filter categories with no options", () => {
    initializeMatrix(BUILD_STEP_EMPTY_FRAMEWORK_MATRIX);

    const result = buildCategoriesForDomain("web", [], {});
    expect(result).toHaveLength(0);
  });

  it("should sort categories by order", () => {
    initializeMatrix(BUILD_STEP_WEB_MATRIX);
    const result = buildCategoriesForDomain("web", [], {});

    expect(result[0].id).toBe(frameworkCategory);
    expect(result[1].id).toBe(stateCategory);
  });

  it("should show all skills regardless of framework selection when filtering is off", () => {
    initializeMatrix(BUILD_STEP_WEB_MATRIX);

    // With React selected, all state skills still show (no filtering)
    const selections: CategorySelections = { "web-framework": ["web-framework-react"] };
    const result = buildCategoriesForDomain("web", [], selections);

    const stateRow = result.find((r) => r.id === stateCategory);
    expect(stateRow).toBeDefined();
    expect(stateRow!.options).toHaveLength(2);
  });

  it("should mark installed skills", () => {
    initializeMatrix(BUILD_STEP_WEB_MATRIX);
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
    initializeMatrix(BUILD_STEP_WEB_MATRIX);

    const result = buildCategoriesForDomain("web", [], {});

    const frameworkRow = result.find((r) => r.id === frameworkCategory);
    for (const option of frameworkRow!.options) {
      expect(option.installed).toBe(false);
    }
  });

  it("should set scope from skillConfigs", () => {
    initializeMatrix(BUILD_STEP_WEB_MATRIX);

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
    initializeMatrix(BUILD_STEP_WEB_MATRIX);

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
    initializeMatrix(BUILD_STEP_FRAMEWORK_NON_EXCLUSIVE_MATRIX);

    const result = buildCategoriesForDomain("web", [], {});

    expect(result[0].required).toBe(true);
    expect(result[0].exclusive).toBe(false);
  });

  it("should default required to false and exclusive to true when not set", () => {
    initializeMatrix(BUILD_STEP_FRAMEWORK_NO_FLAGS_MATRIX);

    const result = buildCategoriesForDomain("web", [], {});

    expect(result[0].required).toBe(false);
    expect(result[0].exclusive).toBe(true);
  });

  it("should only return categories matching the requested domain", () => {
    const apiCategory: Category = "api-api";
    initializeMatrix(BUILD_STEP_FRAMEWORK_API_MATRIX);

    const webResult = buildCategoriesForDomain("web", [], {});
    expect(webResult).toHaveLength(1);
    expect(webResult[0].id).toBe(frameworkCategory);

    const apiResult = buildCategoriesForDomain("api", [], {});
    expect(apiResult).toHaveLength(1);
    expect(apiResult[0].id).toBe(apiCategory);
  });

  it("should return empty array when no categories match the domain", () => {
    initializeMatrix(BUILD_STEP_FRAMEWORK_ONLY_MATRIX);

    const result = buildCategoriesForDomain("api", [], {});
    expect(result).toHaveLength(0);
  });

  describe("framework-first filtering", () => {
    it("should filter incompatible skills when filterIncompatible is true and framework selected", () => {
      initializeMatrix(BUILD_STEP_WEB_MATRIX);

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
      initializeMatrix(BUILD_STEP_WEB_MATRIX);

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
      initializeMatrix(BUILD_STEP_API_DB_MATRIX);

      const selections: CategorySelections = { "api-api": ["api-framework-hono"] };
      const result = buildCategoriesForDomain("api", [], selections, [], [], true);

      const dbRow = result.find((r) => r.id === apiDbCategory);
      expect(dbRow).toBeDefined();
      expect(dbRow!.options).toHaveLength(1);
    });

    it("should NOT filter when no frameworks are selected even with filterIncompatible true", () => {
      initializeMatrix(BUILD_STEP_WEB_MATRIX);

      const result = buildCategoriesForDomain("web", [], {}, [], [], true);

      const stateRow = result.find((r) => r.id === stateCategory);
      expect(stateRow).toBeDefined();
      // Both zustand and pinia should be visible since no framework is selected
      expect(stateRow!.options).toHaveLength(2);
    });

    it("should show skills with empty compatibleWith regardless of framework selection", () => {
      initializeMatrix(BUILD_STEP_UNIVERSAL_COMPAT_MATRIX);

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
      initializeMatrix(BUILD_STEP_WEB_MATRIX);

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
      initializeMatrix(BUILD_STEP_REQUIRES_MATRIX);

      // React is selected but zustand is not
      const allSelections: SkillId[] = ["web-framework-react"];
      const result = buildCategoriesForDomain("web", allSelections, {});

      const stateRow = result.find((r) => r.id === stateCategory);
      const zustandOption = stateRow?.options.find((o) => o.id === "web-state-zustand");
      // zustand is not selected, so requiredBy should show the display name of the skill requiring it
      expect(zustandOption?.requiredBy).toBe("React");
    });

    it("should not set requiredBy for selected skills", () => {
      initializeMatrix(BUILD_STEP_REQUIRES_MATRIX);

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
      initializeMatrix(BUILD_STEP_LOCAL_SKILL_MATRIX);

      const result = buildCategoriesForDomain("web", [], {});

      const frameworkRow = result.find((r) => r.id === frameworkCategory);
      const reactOption = frameworkRow?.options.find((o) => o.id === "web-framework-react");
      expect(reactOption?.local).toBe(true);
    });

    it("should leave local undefined for non-local skills", () => {
      initializeMatrix(BUILD_STEP_NON_LOCAL_MATRIX);

      const result = buildCategoriesForDomain("web", [], {});

      const frameworkRow = result.find((r) => r.id === frameworkCategory);
      const reactOption = frameworkRow?.options.find((o) => o.id === "web-framework-react");
      expect(reactOption?.local).toBeUndefined();
    });
  });

  describe("category displayName", () => {
    it("should use displayName from category definition", () => {
      initializeMatrix(BUILD_STEP_DISPLAY_NAME_MATRIX);

      const result = buildCategoriesForDomain("web", [], {});
      expect(result[0].displayName).toBe("Web Framework");
    });
  });

  describe("sorting", () => {
    it("should sort categories by ascending order value", () => {
      const stylingCategory: Category = "web-styling";
      initializeMatrix(BUILD_STEP_SORTING_MATRIX);

      const result = buildCategoriesForDomain("web", [], {});

      expect(result[0].id).toBe(stylingCategory);
      expect(result[1].id).toBe(frameworkCategory);
      expect(result[2].id).toBe(stateCategory);
    });

    it("should treat undefined order as 0", () => {
      initializeMatrix(BUILD_STEP_UNDEFINED_ORDER_MATRIX);

      const result = buildCategoriesForDomain("web", [], {});

      // undefined order is treated as 0, which comes before 1
      expect(result[0].id).toBe(frameworkCategory);
      expect(result[1].id).toBe(stateCategory);
    });
  });

  describe("exclusive category incompatibility suppression", () => {
    it("should neutralize incompatible state in exclusive categories", () => {
      // React and Vue conflict with each other — selecting React makes Vue incompatible
      initializeMatrix(BUILD_STEP_CONFLICTS_EXCLUSIVE_MATRIX);

      // React is selected — Vue would normally be "incompatible"
      const allSelections: SkillId[] = ["web-framework-react"];
      const result = buildCategoriesForDomain("web", allSelections, {});

      const frameworkRow = result.find((r) => r.id === frameworkCategory);
      const vueOption = frameworkRow?.options.find(
        (o) => o.id === "web-framework-vue-composition-api",
      );
      // In an exclusive category, incompatible is suppressed to normal
      expect(vueOption?.state).toStrictEqual({ status: "normal" });
    });

    it("should preserve incompatible state in non-exclusive categories", () => {
      // Zustand and Pinia conflict with each other
      initializeMatrix(BUILD_STEP_CONFLICTS_NON_EXCLUSIVE_MATRIX);

      // Zustand is selected — Pinia should remain incompatible in a non-exclusive category
      const allSelections: SkillId[] = ["web-state-zustand"];
      const result = buildCategoriesForDomain("web", allSelections, {});

      const stateRow = result.find((r) => r.id === stateCategory);
      const piniaOption = stateRow?.options.find((o) => o.id === "web-state-pinia");
      expect(piniaOption?.state.status).toBe("incompatible");
    });

    it("should preserve recommended and discouraged states in exclusive categories", () => {
      initializeMatrix(BUILD_STEP_ADVISORY_STATES_MATRIX);

      // No selections — React should be recommended
      const resultNoSelection = buildCategoriesForDomain("web", [], {});
      const frameworkRow = resultNoSelection.find((r) => r.id === frameworkCategory);
      const reactOption = frameworkRow?.options.find((o) => o.id === "web-framework-react");
      expect(reactOption?.state.status).toBe("recommended");

      // SCSS selected — Vue should be discouraged (not suppressed)
      const resultWithScss = buildCategoriesForDomain("web", ["web-styling-scss-modules"], {});
      const frameworkRow2 = resultWithScss.find((r) => r.id === frameworkCategory);
      const vueOption = frameworkRow2?.options.find(
        (o) => o.id === "web-framework-vue-composition-api",
      );
      expect(vueOption?.state.status).toBe("discouraged");
    });
  });
});
