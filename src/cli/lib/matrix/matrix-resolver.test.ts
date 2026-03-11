import { beforeEach, describe, it, expect } from "vitest";
import {
  resolveAlias,
  getDependentSkills,
  isDiscouraged,
  getDiscourageReason,
  isRecommended,
  validateSelection,
  getSkillsByCategory,
  getAvailableSkills,
} from "./matrix-resolver";
import type { CategoryDefinition, SkillId, Category } from "../../types";
import {
  createMockSkill,
  createMockCategory,
  createMockMatrix,
  SKILLS,
} from "../__tests__/helpers";
import { EMPTY_MATRIX } from "../__tests__/mock-data/mock-matrices";
import { TEST_CATEGORIES } from "../__tests__/test-fixtures";
import { useMatrixStore } from "../../stores/matrix-store";

describe("resolveAlias", () => {
  it("when skill ID exists in matrix, should return it unchanged", () => {
    const skill = SKILLS.react;
    const matrix = createMockMatrix(skill);
    useMatrixStore.getState().setMatrix(matrix);
    const result = resolveAlias("web-framework-react");
    expect(result).toBe("web-framework-react");
  });

  it("when skill ID does not exist in matrix, should throw", () => {
    const matrix = EMPTY_MATRIX;
    useMatrixStore.getState().setMatrix(matrix);
    expect(() => resolveAlias("web-test-unknown")).toThrow("Unknown skill ID");
  });
});

describe("isDiscouraged", () => {
  it("should return false for skill with no discourages", () => {
    const skill = createMockSkill("web-skill-a");
    const matrix = createMockMatrix(skill);
    useMatrixStore.getState().setMatrix(matrix);

    const result = isDiscouraged("web-skill-a", []);
    expect(result).toBe(false);
  });

  it("should return true if selected skill discourages this skill", () => {
    const skillA = createMockSkill("web-skill-a");
    const skillB = createMockSkill("web-skill-b", {
      discourages: [{ skillId: "web-skill-a", reason: "Not recommended" }],
    });
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const result = isDiscouraged("web-skill-a", ["web-skill-b"]);
    expect(result).toBe(true);
  });

  it("should return true if this skill discourages a selected skill", () => {
    const skillA = createMockSkill("web-skill-a", {
      discourages: [{ skillId: "web-skill-b", reason: "Not recommended" }],
    });
    const skillB = createMockSkill("web-skill-b");
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const result = isDiscouraged("web-skill-a", ["web-skill-b"]);
    expect(result).toBe(true);
  });

  it("should return true if skill conflicts with a selected skill", () => {
    const skillA = createMockSkill("web-skill-a", {
      conflictsWith: [{ skillId: "web-skill-b", reason: "Incompatible" }],
    });
    const skillB = createMockSkill("web-skill-b");
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const result = isDiscouraged("web-skill-a", ["web-skill-b"]);
    expect(result).toBe(true);
  });

  it("should return true if selected skill conflicts with this skill (reverse)", () => {
    const skillA = createMockSkill("web-skill-a");
    const skillB = createMockSkill("web-skill-b", {
      conflictsWith: [{ skillId: "web-skill-a", reason: "Incompatible" }],
    });
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const result = isDiscouraged("web-skill-a", ["web-skill-b"]);
    expect(result).toBe(true);
  });

  it("should return true if required skills are not selected (AND logic)", () => {
    const skillA = createMockSkill("web-skill-a", {
      requires: [
        { skillIds: ["web-skill-b", "web-skill-c"], needsAny: false, reason: "Needs both" },
      ],
    });
    const skillB = createMockSkill("web-skill-b");
    const skillC = createMockSkill("web-skill-c");
    const matrix = createMockMatrix(skillA, skillB, skillC);
    useMatrixStore.getState().setMatrix(matrix);

    const result = isDiscouraged("web-skill-a", ["web-skill-b"]);
    expect(result).toBe(true);
  });

  it("should return false if required skills are all selected (AND logic)", () => {
    const skillA = createMockSkill("web-skill-a", {
      requires: [
        { skillIds: ["web-skill-b", "web-skill-c"], needsAny: false, reason: "Needs both" },
      ],
    });
    const skillB = createMockSkill("web-skill-b");
    const skillC = createMockSkill("web-skill-c");
    const matrix = createMockMatrix(skillA, skillB, skillC);
    useMatrixStore.getState().setMatrix(matrix);

    const result = isDiscouraged("web-skill-a", ["web-skill-b", "web-skill-c"]);
    expect(result).toBe(false);
  });

  it("should return true if none of the required skills are selected (OR logic)", () => {
    const skillA = createMockSkill("web-skill-a", {
      requires: [{ skillIds: ["web-skill-b", "web-skill-c"], needsAny: true, reason: "Needs one" }],
    });
    const skillB = createMockSkill("web-skill-b");
    const skillC = createMockSkill("web-skill-c");
    const matrix = createMockMatrix(skillA, skillB, skillC);
    useMatrixStore.getState().setMatrix(matrix);

    const result = isDiscouraged("web-skill-a", []);
    expect(result).toBe(true);
  });

  it("should return false if any required skill is selected (OR logic)", () => {
    const skillA = createMockSkill("web-skill-a", {
      requires: [{ skillIds: ["web-skill-b", "web-skill-c"], needsAny: true, reason: "Needs one" }],
    });
    const skillB = createMockSkill("web-skill-b");
    const skillC = createMockSkill("web-skill-c");
    const matrix = createMockMatrix(skillA, skillB, skillC);
    useMatrixStore.getState().setMatrix(matrix);

    const result = isDiscouraged("web-skill-a", ["web-skill-c"]);
    expect(result).toBe(false);
  });
});

describe("isRecommended", () => {
  it("should return false for skill not in recommends list", () => {
    const skill = createMockSkill("web-skill-a");
    const matrix = createMockMatrix(skill);
    useMatrixStore.getState().setMatrix(matrix);

    const result = isRecommended("web-skill-a", []);
    expect(result).toBe(false);
  });

  it("should return true if skill is recommended and has no compatibility constraints", () => {
    const skillA = createMockSkill("web-skill-a", {
      isRecommended: true,
      recommendedReason: "Works well together",
    });
    const skillB = createMockSkill("web-skill-b");
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const result = isRecommended("web-skill-a", ["web-skill-b"]);
    expect(result).toBe(true);
  });

  it("should return false if skill is not marked as recommended", () => {
    const skillA = createMockSkill("web-skill-a");
    const skillB = createMockSkill("web-skill-b");
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const result = isRecommended("web-skill-a", ["web-skill-b"]);
    expect(result).toBe(false);
  });
});

describe("getDiscourageReason", () => {
  it("should return undefined for non-discouraged skill", () => {
    const skill = createMockSkill("web-skill-a");
    const matrix = createMockMatrix(skill);
    useMatrixStore.getState().setMatrix(matrix);

    const result = getDiscourageReason("web-skill-a", []);
    expect(result).toBeUndefined();
  });

  it("should return reason for discouraged skill", () => {
    const skillA = createMockSkill("web-skill-a");
    const skillB = createMockSkill("web-skill-b", {
      discourages: [{ skillId: "web-skill-a", reason: "Not recommended together" }],
    });
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const result = getDiscourageReason("web-skill-a", ["web-skill-b"]);
    expect(result).toContain("Not recommended together");
  });

  it("should return conflict reason when skill conflicts with selected skill", () => {
    const skillA = createMockSkill("web-skill-a", {
      conflictsWith: [{ skillId: "web-skill-b", reason: "Incompatible architectures" }],
    });
    const skillB = createMockSkill("web-skill-b");
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const reason = getDiscourageReason("web-skill-a", ["web-skill-b"]);
    expect(reason).toContain("Incompatible architectures");
    expect(reason).toContain("conflicts with");
  });

  it("should return requirement reason when dependencies are unmet", () => {
    const skillA = createMockSkill("web-skill-a", {
      requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Framework required" }],
    });
    const skillB = createMockSkill("web-skill-b");
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const reason = getDiscourageReason("web-skill-a", []);
    expect(reason).toContain("Framework required");
    expect(reason).toContain("requires");
  });
});

describe("validateSelection", () => {
  it("when no skills are selected, should return valid with no errors", () => {
    const matrix = EMPTY_MATRIX;
    useMatrixStore.getState().setMatrix(matrix);
    const result = validateSelection([]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should return valid for non-conflicting selection", () => {
    const matrix = createMockMatrix(createMockSkill("web-skill-a"), createMockSkill("web-skill-b"));
    useMatrixStore.getState().setMatrix(matrix);

    const result = validateSelection(["web-skill-a", "web-skill-b"]);
    expect(result.valid).toBe(true);
  });

  it("should return error for conflicting skills", () => {
    const skillA = createMockSkill("web-skill-a", {
      conflictsWith: [{ skillId: "web-skill-b", reason: "Incompatible" }],
    });
    const skillB = createMockSkill("web-skill-b");
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const result = validateSelection(["web-skill-a", "web-skill-b"]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe("conflict");
  });

  it("should return error for missing requirements", () => {
    const skillA = createMockSkill("web-skill-a", {
      requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Needs B" }],
    });
    const skillB = createMockSkill("web-skill-b");
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const result = validateSelection(["web-skill-a"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "missingRequirement")).toBe(true);
  });

  it("should return warning for missing recommendations", () => {
    const skillA = createMockSkill("web-skill-a");
    const skillB = createMockSkill("web-skill-b", {
      isRecommended: true,
      recommendedReason: "Works better together",
    });
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const result = validateSelection(["web-skill-a"]);
    expect(result.valid).toBe(true); // Warnings don't make it invalid
    expect(result.warnings.some((w) => w.type === "missing_recommendation")).toBe(true);
  });

  it("should return error for category exclusivity violation", () => {
    const skillA = createMockSkill("web-skill-a", {
      category: "web-framework",
    });
    const skillB = createMockSkill("web-skill-b", {
      category: "web-framework",
    });
    const matrix = createMockMatrix(skillA, skillB, {
      categories: {
        "web-framework": { ...TEST_CATEGORIES.framework, description: "Frameworks", order: 1 },
      } as Record<Category, CategoryDefinition>,
    });
    useMatrixStore.getState().setMatrix(matrix);

    const result = validateSelection(["web-skill-a", "web-skill-b"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "categoryExclusive")).toBe(true);
  });
});

describe("getSkillsByCategory", () => {
  it("should return skills in the specified category", () => {
    const matrix = createMockMatrix(
      createMockSkill("web-skill-a", { category: "web-framework" }),
      createMockSkill("web-skill-b", { category: "web-styling" }),
      createMockSkill("web-skill-c", { category: "web-framework" }),
    );
    useMatrixStore.getState().setMatrix(matrix);

    const result = getSkillsByCategory("web-framework");
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toContain("web-skill-a");
    expect(result.map((s) => s.id)).toContain("web-skill-c");
  });

  it("should return empty array for category with no skills", () => {
    const matrix = createMockMatrix(createMockSkill("web-skill-a", { category: "web-framework" }));
    useMatrixStore.getState().setMatrix(matrix);

    const result = getSkillsByCategory("web-nonexistent");
    expect(result).toHaveLength(0);
  });
});

describe("Empty skill selection", () => {
  describe("validateSelection with empty skills", () => {
    it("should return valid=true for empty selection", () => {
      const matrix = EMPTY_MATRIX;
      useMatrixStore.getState().setMatrix(matrix);
      const result = validateSelection([]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should return valid=true even with skills available in matrix", () => {
      const matrix = createMockMatrix(
        createMockSkill("web-skill-a"),
        createMockSkill("web-skill-b"),
        createMockSkill("web-skill-c"),
      );
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection([]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should not flag missing recommendations for empty selection when recommended skills have compatibility constraints", () => {
      // Recommended skill with compatibleWith won't trigger warning when nothing is selected
      const skillA = createMockSkill("web-skill-a");
      const skillB = createMockSkill("web-skill-b", {
        isRecommended: true,
        recommendedReason: "Works well together",
        compatibleWith: ["web-skill-a"],
      });
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection([]);

      // skillB is recommended but has compatibleWith constraint — not compatible with empty selection
      expect(result.warnings).toHaveLength(0);
    });

    it("should not flag category requirements for empty selection", () => {
      // Required categories only matter when skills are selected
      const matrix = createMockMatrix(
        {},
        {
          categories: {
            "web-framework": {
              ...TEST_CATEGORIES.framework,
              description: "Required framework",
              required: true,
              order: 1,
            },
          } as Record<Category, CategoryDefinition>,
        },
      );
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection([]);

      // Empty selection is valid - required categories are enforced at wizard level
      expect(result.valid).toBe(true);
    });
  });

  describe("isDiscouraged with empty current selections", () => {
    it("should not discourage skills when nothing is selected (no conflicts)", () => {
      const skill = createMockSkill("web-skill-a");
      const matrix = createMockMatrix(skill);
      useMatrixStore.getState().setMatrix(matrix);

      const result = isDiscouraged("web-skill-a", []);
      expect(result).toBe(false);
    });

    it("should discourage skills with unmet requirements even with no selections", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Needs B" }],
      });
      const skillB = createMockSkill("web-skill-b");
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = isDiscouraged("web-skill-a", []);
      expect(result).toBe(true);
    });
  });

  describe("isRecommended with empty current selections", () => {
    it("should recommend skill with isRecommended even when nothing is selected", () => {
      const skillA = createMockSkill("web-skill-a", {
        isRecommended: true,
        recommendedReason: "Works well",
      });
      const matrix = createMockMatrix(skillA);
      useMatrixStore.getState().setMatrix(matrix);

      // With no selections, isRecommended alone is sufficient
      const result = isRecommended("web-skill-a", []);
      expect(result).toBe(true);
    });

    it("should not recommend skill without isRecommended flag", () => {
      const skillA = createMockSkill("web-skill-a");
      const matrix = createMockMatrix(skillA);
      useMatrixStore.getState().setMatrix(matrix);

      const result = isRecommended("web-skill-a", []);
      expect(result).toBe(false);
    });
  });

  describe("isDiscouraged with empty current selections", () => {
    it("should not discourage anything when nothing is selected", () => {
      const skillA = createMockSkill("web-skill-a");
      const skillB = createMockSkill("web-skill-b", {
        discourages: [{ skillId: "web-skill-a", reason: "Not recommended" }],
      });
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = isDiscouraged("web-skill-a", []);
      expect(result).toBe(false);
    });
  });
});

describe("Conflicting skills", () => {
  describe("validateSelection catches conflicts", () => {
    it("should return error when conflicting skills are both selected", () => {
      const skillA = createMockSkill("web-skill-a", {
        conflictsWith: [{ skillId: "web-skill-b", reason: "These cannot work together" }],
      });
      const skillB = createMockSkill("web-skill-b");
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a", "web-skill-b"]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("conflict");
      expect(result.errors[0].message).toContain("A conflicts with B");
      expect(result.errors[0].message).toContain("These cannot work together");
      expect(result.errors[0].skills).toContain("web-skill-a");
      expect(result.errors[0].skills).toContain("web-skill-b");
    });

    it("should return multiple errors for multiple conflicts", () => {
      const skillA = createMockSkill("web-skill-a", {
        conflictsWith: [
          { skillId: "web-skill-b", reason: "Conflicts with B" },
          { skillId: "web-skill-c", reason: "Conflicts with C" },
        ],
      });
      const skillB = createMockSkill("web-skill-b");
      const skillC = createMockSkill("web-skill-c");
      const matrix = createMockMatrix(skillA, skillB, skillC);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a", "web-skill-b", "web-skill-c"]);

      expect(result.valid).toBe(false);
      expect(result.errors.filter((e) => e.type === "conflict")).toHaveLength(2);
    });

    it("should catch conflicts when declaring skill comes first in selection", () => {
      const skillA = createMockSkill("web-skill-a", {
        conflictsWith: [{ skillId: "web-skill-b", reason: "A conflicts with B" }],
      });
      const skillB = createMockSkill("web-skill-b");
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a", "web-skill-b"]);

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe("conflict");
    });

    it("documents: validateSelection depends on conflict declaration order", () => {
      // NOTE: validateSelection only checks skillA.conflictsWith where skillA
      // comes BEFORE the conflicting skill in the selection array.
      // This is a limitation — the primary protection is isDiscouraged() which
      // checks bidirectionally and warns about invalid selections in the UI.
      const skillA = createMockSkill("web-skill-a", {
        conflictsWith: [{ skillId: "web-skill-b", reason: "A conflicts with B" }],
      });
      const skillB = createMockSkill("web-skill-b");
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-b", "web-skill-a"]);

      expect(result.valid).toBe(true);
    });
  });

  describe("conflicting skills are discouraged in getAvailableSkills", () => {
    const skillA = createMockSkill("web-skill-a", {
      category: "web-framework",
      conflictsWith: [{ skillId: "web-skill-b", reason: "Different paradigms" }],
    });
    const skillB = createMockSkill("web-skill-b", {
      category: "web-framework",
    });
    const matrix = createMockMatrix(skillA, skillB, {
      categories: {
        "web-framework": {
          ...TEST_CATEGORIES.framework,
          description: "Frameworks",
          exclusive: false,
          order: 1,
        },
      },
    });

    beforeEach(() => {
      useMatrixStore.getState().setMatrix(matrix);
    });

    it("when conflicting skill is selected, should mark skill as discouraged", () => {
      const options = getAvailableSkills("web-framework", ["web-skill-b"]);

      const skillAOption = options.find((o: { id: string }) => o.id === "web-skill-a");
      expect(skillAOption).toBeDefined();
      expect(skillAOption!.discouraged).toBe(true);
    });

    it("when conflicting skill is selected, should set discouragedReason with conflict reason", () => {
      const options = getAvailableSkills("web-framework", ["web-skill-b"]);

      const skillAOption = options.find((o: { id: string }) => o.id === "web-skill-a");
      expect(skillAOption).toBeDefined();
      expect(skillAOption!.discouragedReason).toContain("Different paradigms");
    });
  });
});

describe("Missing skill dependencies", () => {
  describe("validateSelection catches missing dependencies", () => {
    it("should return error when required skill is not selected (single dependency)", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b"],
            needsAny: false,
            reason: "Framework required",
          },
        ],
      });
      const skillB = createMockSkill("web-skill-b");
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a"]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("missingRequirement");
      expect(result.errors[0].skills).toContain("web-skill-a");
      expect(result.errors[0].skills).toContain("web-skill-b");
    });

    it("should return error when multiple required skills are missing (AND logic)", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b", "web-skill-c"],
            needsAny: false,
            reason: "Both B and C required",
          },
        ],
      });
      const skillB = createMockSkill("web-skill-b");
      const skillC = createMockSkill("web-skill-c");
      const matrix = createMockMatrix(skillA, skillB, skillC);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a"]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("missingRequirement");
      // Should include both missing dependencies
      expect(result.errors[0].skills).toContain("web-skill-b");
      expect(result.errors[0].skills).toContain("web-skill-c");
    });

    it("should return error when none of the required skills are selected (OR logic)", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b", "web-skill-c"],
            needsAny: true,
            reason: "Needs at least one framework",
          },
        ],
      });
      const skillB = createMockSkill("web-skill-b");
      const skillC = createMockSkill("web-skill-c");
      const matrix = createMockMatrix(skillA, skillB, skillC);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a"]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("missingRequirement");
      expect(result.errors[0].message).toContain("one of");
    });

    it("should be valid when at least one of OR required skills is selected", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b", "web-skill-c"],
            needsAny: true,
            reason: "Needs at least one framework",
          },
        ],
      });
      const skillB = createMockSkill("web-skill-b");
      const skillC = createMockSkill("web-skill-c");
      const matrix = createMockMatrix(skillA, skillB, skillC);
      useMatrixStore.getState().setMatrix(matrix);

      // Only skill-c selected (not skill-b), but that's enough
      const result = validateSelection(["web-skill-a", "web-skill-c"]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return multiple errors when multiple skills have missing dependencies", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [{ skillIds: ["web-skill-c"], needsAny: false, reason: "A needs C" }],
      });
      const skillB = createMockSkill("web-skill-b", {
        requires: [{ skillIds: ["web-skill-d"], needsAny: false, reason: "B needs D" }],
      });
      const skillC = createMockSkill("web-skill-c");
      const skillD = createMockSkill("web-skill-d");
      const matrix = createMockMatrix(skillA, skillB, skillC, skillD);
      useMatrixStore.getState().setMatrix(matrix);

      // Both A and B are selected but their dependencies are not
      const result = validateSelection(["web-skill-a", "web-skill-b"]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.every((e) => e.type === "missingRequirement")).toBe(true);
    });
  });

  describe("validation result includes which dependencies are missing", () => {
    it("should include missing skill IDs in the error skills array", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Needs B" }],
      });
      const skillB = createMockSkill("web-skill-b");
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a"]);

      expect(result.errors[0].skills).toEqual(["web-skill-a", "web-skill-b"]);
    });

    it("should include skill display name in error message", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Needs B" }],
      });
      const skillB = createMockSkill("web-skill-b");
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a"]);

      expect(result.errors[0].message).toContain("A");
      expect(result.errors[0].message).toContain("B");
    });

    it("should include all missing skill display names when multiple are missing", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b", "web-skill-c"],
            needsAny: false,
            reason: "Needs both",
          },
        ],
      });
      const skillB = createMockSkill("web-skill-b");
      const skillC = createMockSkill("web-skill-c");
      const matrix = createMockMatrix(skillA, skillB, skillC);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a"]);

      expect(result.errors[0].message).toContain("B");
      expect(result.errors[0].message).toContain("C");
    });
  });

  describe("recommendation system suggests adding recommended skills", () => {
    it("should issue warning when recommended skill is not selected", () => {
      const skillA = createMockSkill("web-skill-a");
      const skillB = createMockSkill("web-skill-b", {
        isRecommended: true,
        recommendedReason: "Better type safety",
      });
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a"]);

      expect(result.valid).toBe(true); // Recommendations are warnings, not errors
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe("missing_recommendation");
      expect(result.warnings[0].message).toContain("B");
      expect(result.warnings[0].message).toContain("Better type safety");
    });

    it("should include recommended skill in warning skills array", () => {
      const skillA = createMockSkill("web-skill-a");
      const skillB = createMockSkill("web-skill-b", {
        isRecommended: true,
        recommendedReason: "Recommended",
      });
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a"]);

      expect(result.warnings[0].skills).toContain("web-skill-b");
    });

    it("should not warn about recommendations that conflict with selected skills", () => {
      const skillA = createMockSkill("web-skill-a");
      const skillB = createMockSkill("web-skill-b", {
        isRecommended: true,
        recommendedReason: "Recommended",
        conflictsWith: [{ skillId: "web-skill-c", reason: "Incompatible" }],
      });
      const skillC = createMockSkill("web-skill-c");
      const matrix = createMockMatrix(skillA, skillB, skillC);
      useMatrixStore.getState().setMatrix(matrix);

      // B is recommended but conflicts with C which is selected
      const result = validateSelection(["web-skill-a", "web-skill-c"]);

      // Should not recommend B since it conflicts with C
      expect(result.warnings.filter((w) => w.type === "missing_recommendation")).toHaveLength(0);
    });

    it("should not warn when recommended skill is already selected", () => {
      const skillA = createMockSkill("web-skill-a");
      const skillB = createMockSkill("web-skill-b", {
        isRecommended: true,
        recommendedReason: "Recommended",
      });
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a", "web-skill-b"]);

      expect(result.warnings.filter((w) => w.type === "missing_recommendation")).toHaveLength(0);
    });
  });

  describe("isDiscouraged warns about skills with unmet dependencies", () => {
    it("should discourage skill when required dependency is not selected", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Needs framework" }],
      });
      const skillB = createMockSkill("web-skill-b");
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = isDiscouraged("web-skill-a", []);

      expect(result).toBe(true);
    });

    it("should not discourage skill when required dependency is selected", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Needs framework" }],
      });
      const skillB = createMockSkill("web-skill-b");
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = isDiscouraged("web-skill-a", ["web-skill-b"]);

      expect(result).toBe(false);
    });
  });

  describe("getDiscourageReason explains why skill is discouraged due to missing dependencies", () => {
    it("should explain missing required skill", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b"],
            needsAny: false,
            reason: "Framework required",
          },
        ],
      });
      const skillB = createMockSkill("web-skill-b");
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const reason = getDiscourageReason("web-skill-a", []);

      expect(reason).toContain("Framework required");
      expect(reason).toContain("requires");
      expect(reason).toContain("B");
    });

    it("should list all missing required skills (AND logic)", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b", "web-skill-c"],
            needsAny: false,
            reason: "Multiple frameworks needed",
          },
        ],
      });
      const skillB = createMockSkill("web-skill-b");
      const skillC = createMockSkill("web-skill-c");
      const matrix = createMockMatrix(skillA, skillB, skillC);
      useMatrixStore.getState().setMatrix(matrix);

      const reason = getDiscourageReason("web-skill-a", []);

      expect(reason).toContain("B");
      expect(reason).toContain("C");
    });

    it("should explain OR requirement options", () => {
      const skillA = createMockSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b", "web-skill-c"],
            needsAny: true,
            reason: "Need a framework",
          },
        ],
      });
      const skillB = createMockSkill("web-skill-b");
      const skillC = createMockSkill("web-skill-c");
      const matrix = createMockMatrix(skillA, skillB, skillC);
      useMatrixStore.getState().setMatrix(matrix);

      const reason = getDiscourageReason("web-skill-a", []);

      expect(reason).toContain("Need a framework");
      expect(reason).toContain("or");
    });
  });

  describe("skill ID resolution works with dependencies", () => {
    it("should detect missing requirement when dependency is not selected", () => {
      const skillA = createMockSkill("web-skill-a-v", {
        requires: [
          {
            skillIds: ["web-skill-b-v"],
            needsAny: false,
            reason: "Needs B",
          },
        ],
      });
      const skillB = createMockSkill("web-skill-b-v");
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a-v"]);

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe("missingRequirement");
    });

    it("should validate successfully when dependency is selected", () => {
      const skillA = createMockSkill("web-skill-a-v", {
        requires: [
          {
            skillIds: ["web-skill-b-v"],
            needsAny: false,
            reason: "Needs B",
          },
        ],
      });
      const skillB = createMockSkill("web-skill-b-v");
      const matrix = createMockMatrix(skillA, skillB);
      useMatrixStore.getState().setMatrix(matrix);

      const result = validateSelection(["web-skill-a-v", "web-skill-b-v"]);

      expect(result.valid).toBe(true);
    });
  });
});

// --- Edge case tests ---

describe("getDependentSkills", () => {
  it("should return empty array when no skills depend on target", () => {
    const skillA = createMockSkill("web-skill-a");
    const skillB = createMockSkill("web-skill-b");
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const result = getDependentSkills("web-skill-a", ["web-skill-a", "web-skill-b"]);
    expect(result).toEqual([]);
  });

  it("should throw when skill is not in matrix", () => {
    const matrix = EMPTY_MATRIX;
    useMatrixStore.getState().setMatrix(matrix);

    expect(() => getDependentSkills("web-skill-nonexistent", [])).toThrow("Unknown skill ID");
  });

  it("should find single dependent with AND requirement", () => {
    const skillA = createMockSkill("web-skill-a");
    const skillB = createMockSkill("web-skill-b", {
      requires: [{ skillIds: ["web-skill-a"], needsAny: false, reason: "Needs A" }],
    });
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const result = getDependentSkills("web-skill-a", ["web-skill-a", "web-skill-b"]);
    expect(result).toEqual(["web-skill-b"]);
  });

  it("should find multiple dependents", () => {
    const skillA = createMockSkill("web-skill-a");
    const skillB = createMockSkill("web-skill-b", {
      requires: [{ skillIds: ["web-skill-a"], needsAny: false, reason: "B needs A" }],
    });
    const skillC = createMockSkill("web-skill-c", {
      requires: [{ skillIds: ["web-skill-a"], needsAny: false, reason: "C needs A" }],
    });
    const matrix = createMockMatrix(skillA, skillB, skillC);
    useMatrixStore.getState().setMatrix(matrix);

    const result = getDependentSkills("web-skill-a", ["web-skill-a", "web-skill-b", "web-skill-c"]);
    expect(result).toContain("web-skill-b");
    expect(result).toContain("web-skill-c");
    expect(result).toHaveLength(2);
  });

  it("should detect OR dependency when target is the sole satisfier", () => {
    const skillA = createMockSkill("web-skill-a");
    const skillB = createMockSkill("web-skill-b");
    const skillC = createMockSkill("web-skill-c", {
      requires: [{ skillIds: ["web-skill-a", "web-skill-b"], needsAny: true, reason: "Needs one" }],
    });
    const matrix = createMockMatrix(skillA, skillB, skillC);
    useMatrixStore.getState().setMatrix(matrix);

    // Only A and C selected, so A is the sole satisfier of C's OR requirement
    const result = getDependentSkills("web-skill-a", ["web-skill-a", "web-skill-c"]);
    expect(result).toEqual(["web-skill-c"]);
  });

  it("should NOT detect OR dependency when another satisfier is also selected", () => {
    const skillA = createMockSkill("web-skill-a");
    const skillB = createMockSkill("web-skill-b");
    const skillC = createMockSkill("web-skill-c", {
      requires: [{ skillIds: ["web-skill-a", "web-skill-b"], needsAny: true, reason: "Needs one" }],
    });
    const matrix = createMockMatrix(skillA, skillB, skillC);
    useMatrixStore.getState().setMatrix(matrix);

    // Both A and B selected, so removing A would still leave B to satisfy C
    const result = getDependentSkills("web-skill-a", ["web-skill-a", "web-skill-b", "web-skill-c"]);
    expect(result).toEqual([]);
  });

  it("should skip the target skill itself in selections", () => {
    // If skill-a requires itself (odd but shouldn't crash), it should skip
    const skillA = createMockSkill("web-skill-a", {
      requires: [{ skillIds: ["web-skill-a"], needsAny: false, reason: "Self-ref" }],
    });
    const matrix = createMockMatrix(skillA);
    useMatrixStore.getState().setMatrix(matrix);

    const result = getDependentSkills("web-skill-a", ["web-skill-a"]);
    // A cannot depend on itself in getDependentSkills — it skips selectedId === fullId
    expect(result).toEqual([]);
  });

  it("should handle transitive chain (only direct dependents returned)", () => {
    // A <- B <- C (B requires A, C requires B)
    const skillA = createMockSkill("web-skill-a");
    const skillB = createMockSkill("web-skill-b", {
      requires: [{ skillIds: ["web-skill-a"], needsAny: false, reason: "B needs A" }],
    });
    const skillC = createMockSkill("web-skill-c", {
      requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "C needs B" }],
    });
    const matrix = createMockMatrix(skillA, skillB, skillC);
    useMatrixStore.getState().setMatrix(matrix);

    // getDependentSkills returns DIRECT dependents only
    const result = getDependentSkills("web-skill-a", ["web-skill-a", "web-skill-b", "web-skill-c"]);
    // Only B directly depends on A; C depends on B (transitive, not returned)
    expect(result).toEqual(["web-skill-b"]);
  });

  it("should handle circular requirements without infinite loop", () => {
    // A requires B, B requires A — both selected
    const skillA = createMockSkill("web-skill-a", {
      requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "A needs B" }],
    });
    const skillB = createMockSkill("web-skill-b", {
      requires: [{ skillIds: ["web-skill-a"], needsAny: false, reason: "B needs A" }],
    });
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    // Asking "who depends on A?" -> B depends on A
    const resultA = getDependentSkills("web-skill-a", ["web-skill-a", "web-skill-b"]);
    expect(resultA).toEqual(["web-skill-b"]);

    // Asking "who depends on B?" -> A depends on B
    const resultB = getDependentSkills("web-skill-b", ["web-skill-a", "web-skill-b"]);
    expect(resultB).toEqual(["web-skill-a"]);
  });

  it("should find dependents using full skill IDs", () => {
    const skillA = createMockSkill("web-skill-a-v");
    const skillB = createMockSkill("web-skill-b-v", {
      requires: [{ skillIds: ["web-skill-a-v"], needsAny: false, reason: "B needs A" }],
    });
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    const result = getDependentSkills("web-skill-a-v", ["web-skill-a-v", "web-skill-b-v"]);
    expect(result).toEqual(["web-skill-b-v"]);
  });

  it("should handle skill with multiple AND requirements including target", () => {
    const skillA = createMockSkill("web-skill-a");
    const skillB = createMockSkill("web-skill-b");
    const skillC = createMockSkill("web-skill-c", {
      requires: [
        { skillIds: ["web-skill-a", "web-skill-b"], needsAny: false, reason: "Needs both" },
      ],
    });
    const matrix = createMockMatrix(skillA, skillB, skillC);
    useMatrixStore.getState().setMatrix(matrix);

    // C requires both A and B (AND), so C is dependent on A
    const result = getDependentSkills("web-skill-a", ["web-skill-a", "web-skill-b", "web-skill-c"]);
    expect(result).toEqual(["web-skill-c"]);
  });

  it("should find dependents even when target is not in current selections", () => {
    const skillA = createMockSkill("web-skill-a");
    const skillB = createMockSkill("web-skill-b", {
      requires: [{ skillIds: ["web-skill-a"], needsAny: false, reason: "B needs A" }],
    });
    const matrix = createMockMatrix(skillA, skillB);
    useMatrixStore.getState().setMatrix(matrix);

    // A is not in selections — asking who depends on A among current selections
    const result = getDependentSkills("web-skill-a", ["web-skill-b"]);
    // B depends on A, so it should still be returned
    expect(result).toEqual(["web-skill-b"]);
  });
});

describe("getAvailableSkills edge cases", () => {
  it("should return empty array for category with no skills", () => {
    const matrix = createMockMatrix(createMockSkill("web-skill-a", { category: "web-framework" }), {
      categories: {
        "web-styling": {
          ...TEST_CATEGORIES.styling,
          description: "Styling options",
          exclusive: false,
          order: 1,
        },
      } as Record<Category, CategoryDefinition>,
    });
    useMatrixStore.getState().setMatrix(matrix);

    const result = getAvailableSkills("web-styling", []);
    expect(result).toEqual([]);
  });

  it("should handle large number of skills without issues", () => {
    const SKILL_COUNT = 200;
    const skills = Object.fromEntries(
      Array.from({ length: SKILL_COUNT }, (_, i) => {
        const id = `web-perf-skill${i}` as SkillId;
        return [id, createMockSkill(id, { category: "api-performance" })];
      }),
    );
    const matrix = createMockMatrix(skills, {
      categories: {
        "api-performance": createMockCategory("api-performance", "Performance", {
          description: "Performance tools",
          exclusive: false,
          order: 1,
        }),
      } as Record<Category, CategoryDefinition>,
    });
    useMatrixStore.getState().setMatrix(matrix);

    const result = getAvailableSkills("api-performance", []);
    expect(result).toHaveLength(SKILL_COUNT);
    expect(result.every((o) => !o.selected)).toBe(true);
  });

  it("should include alternatives in skill options", () => {
    const skillA = createMockSkill("web-skill-a", {
      category: "web-framework",
      alternatives: [
        { skillId: "web-skill-b", purpose: "Alternative framework" },
        { skillId: "web-skill-c", purpose: "Another alternative" },
      ],
    });
    const skillB = createMockSkill("web-skill-b", {
      category: "web-framework",
    });
    const skillC = createMockSkill("web-skill-c", {
      category: "web-framework",
    });
    const matrix = createMockMatrix(skillA, skillB, skillC, {
      categories: {
        "web-framework": {
          ...TEST_CATEGORIES.framework,
          description: "Frameworks",
          exclusive: false,
          order: 1,
        },
      } as Record<Category, CategoryDefinition>,
    });
    useMatrixStore.getState().setMatrix(matrix);

    const result = getAvailableSkills("web-framework", []);
    const optionA = result.find((o) => o.id === "web-skill-a");
    expect(optionA).toBeDefined();
    expect(optionA!.alternatives).toEqual(["web-skill-b", "web-skill-c"]);
  });

  it("should correctly mark selected skills", () => {
    const skillA = createMockSkill("web-skill-a", {
      category: "web-framework",
    });
    const skillB = createMockSkill("web-skill-b", {
      category: "web-framework",
    });
    const matrix = createMockMatrix(skillA, skillB, {
      categories: {
        "web-framework": {
          ...TEST_CATEGORIES.framework,
          description: "Frameworks",
          exclusive: false,
          order: 1,
        },
      } as Record<Category, CategoryDefinition>,
    });
    useMatrixStore.getState().setMatrix(matrix);

    const result = getAvailableSkills("web-framework", ["web-skill-a"]);
    const optionA = result.find((o) => o.id === "web-skill-a");
    const optionB = result.find((o) => o.id === "web-skill-b");
    expect(optionA!.selected).toBe(true);
    expect(optionB!.selected).toBe(false);
  });

  it("should set discouraged and discouragedReason when applicable", () => {
    const skillA = createMockSkill("web-skill-a", {
      category: "web-framework",
      discourages: [{ skillId: "web-skill-b", reason: "Not ideal pairing" }],
    });
    const skillB = createMockSkill("web-skill-b", {
      category: "web-framework",
    });
    const matrix = createMockMatrix(skillA, skillB, {
      categories: {
        "web-framework": {
          ...TEST_CATEGORIES.framework,
          description: "Frameworks",
          exclusive: false,
          order: 1,
        },
      } as Record<Category, CategoryDefinition>,
    });
    useMatrixStore.getState().setMatrix(matrix);

    const result = getAvailableSkills("web-framework", ["web-skill-a"]);
    const optionB = result.find((o) => o.id === "web-skill-b");
    expect(optionB!.discouraged).toBe(true);
    expect(optionB!.discouragedReason).toContain("Not ideal pairing");
  });

  it("should set recommended and recommendedReason when applicable", () => {
    const skillA = createMockSkill("web-skill-a", {
      category: "web-framework",
    });
    const skillB = createMockSkill("web-skill-b", {
      category: "web-framework",
      isRecommended: true,
      recommendedReason: "Great combination",
    });
    const matrix = createMockMatrix(skillA, skillB, {
      categories: {
        "web-framework": {
          ...TEST_CATEGORIES.framework,
          description: "Frameworks",
          exclusive: false,
          order: 1,
        },
      } as Record<Category, CategoryDefinition>,
    });
    useMatrixStore.getState().setMatrix(matrix);

    const result = getAvailableSkills("web-framework", ["web-skill-a"]);
    const optionB = result.find((o) => o.id === "web-skill-b");
    expect(optionB!.recommended).toBe(true);
    expect(optionB!.recommendedReason).toContain("Great combination");
  });

  it("should mark discouraged when skill conflicts with selected skill", () => {
    const skillA = createMockSkill("web-skill-a", {
      category: "web-framework",
      conflictsWith: [{ skillId: "web-skill-b", reason: "Incompatible" }],
      discourages: [{ skillId: "web-skill-b", reason: "Not ideal" }],
    });
    const skillB = createMockSkill("web-skill-b", {
      category: "web-framework",
    });
    const matrix = createMockMatrix(skillA, skillB, {
      categories: {
        "web-framework": {
          ...TEST_CATEGORIES.framework,
          description: "Frameworks",
          exclusive: false,
          order: 1,
        },
      } as Record<Category, CategoryDefinition>,
    });
    useMatrixStore.getState().setMatrix(matrix);

    const result = getAvailableSkills("web-framework", ["web-skill-a"]);
    const optionB = result.find((o) => o.id === "web-skill-b");
    // Conflicts now produce discouraged state (not disabled)
    expect(optionB!.discouraged).toBe(true);
  });

  it("discouraged takes priority over recommended when skill has conflicts", () => {
    const skillA = createMockSkill("web-skill-a", {
      category: "web-framework",
      conflictsWith: [{ skillId: "web-skill-b", reason: "Incompatible" }],
    });
    const skillB = createMockSkill("web-skill-b", {
      category: "web-framework",
      isRecommended: true,
      recommendedReason: "Good pairing",
    });
    const matrix = createMockMatrix(skillA, skillB, {
      categories: {
        "web-framework": {
          ...TEST_CATEGORIES.framework,
          description: "Frameworks",
          exclusive: false,
          order: 1,
        },
      } as Record<Category, CategoryDefinition>,
    });
    useMatrixStore.getState().setMatrix(matrix);

    const result = getAvailableSkills("web-framework", ["web-skill-a"]);
    const optionB = result.find((o) => o.id === "web-skill-b");
    // Discouraged takes priority over recommended
    expect(optionB!.discouraged).toBe(true);
    expect(optionB!.recommended).toBe(false);
  });
});

describe("validateSelection edge cases", () => {
  it("when selected skill does not exist in matrix, should throw", () => {
    const matrix = EMPTY_MATRIX;
    useMatrixStore.getState().setMatrix(matrix);

    // Selecting a skill that doesn't exist in the matrix is a bug
    expect(() => validateSelection(["web-skill-nonexistent"])).toThrow("Unknown skill ID");
  });

  it("should detect category exclusivity with more than 2 skills in same exclusive category", () => {
    const skillA = createMockSkill("web-skill-a", {
      category: "web-framework",
    });
    const skillB = createMockSkill("web-skill-b", {
      category: "web-framework",
    });
    const skillC = createMockSkill("web-skill-c", {
      category: "web-framework",
    });
    const matrix = createMockMatrix(skillA, skillB, skillC, {
      categories: {
        "web-framework": { ...TEST_CATEGORIES.framework, description: "Frameworks", order: 1 },
      } as Record<Category, CategoryDefinition>,
    });
    useMatrixStore.getState().setMatrix(matrix);

    const result = validateSelection(["web-skill-a", "web-skill-b", "web-skill-c"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "categoryExclusive")).toBe(true);
  });

  it("should report unused_setup warning when setup skill has no corresponding usage skill", () => {
    const setupSkill = createMockSkill("web-skill-setup", {
      providesSetupFor: ["web-skill-usage"],
    });
    const usageSkill = createMockSkill("web-skill-usage", {});
    const matrix = createMockMatrix(setupSkill, usageSkill);
    useMatrixStore.getState().setMatrix(matrix);

    // Select setup but not usage
    const result = validateSelection(["web-skill-setup"]);
    expect(result.warnings.some((w) => w.type === "unused_setup")).toBe(true);
  });

  it("should not report unused_setup when usage skill is also selected", () => {
    const setupSkill = createMockSkill("web-skill-setup", {
      providesSetupFor: ["web-skill-usage"],
    });
    const usageSkill = createMockSkill("web-skill-usage", {});
    const matrix = createMockMatrix(setupSkill, usageSkill);
    useMatrixStore.getState().setMatrix(matrix);

    const result = validateSelection(["web-skill-setup", "web-skill-usage"]);
    expect(result.warnings.filter((w) => w.type === "unused_setup")).toHaveLength(0);
  });

  it("should handle skill with both conflicts and requirements", () => {
    const skillA = createMockSkill("web-skill-a", {
      conflictsWith: [{ skillId: "web-skill-b", reason: "Conflicts" }],
      requires: [{ skillIds: ["web-skill-c"], needsAny: false, reason: "Needs C" }],
    });
    const skillB = createMockSkill("web-skill-b");
    const skillC = createMockSkill("web-skill-c");
    const matrix = createMockMatrix(skillA, skillB, skillC);
    useMatrixStore.getState().setMatrix(matrix);

    // A conflicts with B AND requires C — selecting A+B should produce conflict error
    const result = validateSelection(["web-skill-a", "web-skill-b"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "conflict")).toBe(true);
    // Also reports missing requirement for C
    expect(result.errors.some((e) => e.type === "missingRequirement")).toBe(true);
  });
});
