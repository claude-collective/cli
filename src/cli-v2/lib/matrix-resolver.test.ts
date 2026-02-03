import { describe, it, expect } from "vitest";
import {
  resolveAlias,
  isDisabled,
  isDiscouraged,
  isRecommended,
  getDisableReason,
  getDiscourageReason,
  getRecommendReason,
  validateSelection,
  getSkillsByCategory,
  getTopLevelCategories,
  getSubcategories,
  getAvailableSkills,
  isCategoryAllDisabled,
} from "./matrix-resolver";
import type { MergedSkillsMatrix, ResolvedSkill } from "../types-matrix";

/**
 * Create a minimal ResolvedSkill for testing
 */
function createSkill(
  id: string,
  overrides: Partial<ResolvedSkill> = {},
): ResolvedSkill {
  return {
    id,
    name: id,
    description: `Description for ${id}`,
    category: "framework",
    categoryExclusive: true,
    tags: [],
    author: "@test",
    version: "1",
    conflictsWith: [],
    recommends: [],
    recommendedBy: [],
    requires: [],
    requiredBy: [],
    alternatives: [],
    discourages: [],
    requiresSetup: [],
    providesSetupFor: [],
    path: `skills/${id}/`,
    ...overrides,
  };
}

/**
 * Create a minimal MergedSkillsMatrix for testing
 */
function createMatrix(
  skills: Record<string, ResolvedSkill>,
  aliases: Record<string, string> = {},
  categories: MergedSkillsMatrix["categories"] = {},
): MergedSkillsMatrix {
  return {
    version: "1.0.0",
    categories,
    skills,
    suggestedStacks: [],
    aliases,
    aliasesReverse: Object.fromEntries(
      Object.entries(aliases).map(([alias, fullId]) => [fullId, alias]),
    ),
    generatedAt: new Date().toISOString(),
  };
}

describe("resolveAlias", () => {
  it("should resolve an alias to full ID", () => {
    const matrix = createMatrix({}, { react: "react (@vince)" });
    const result = resolveAlias("react", matrix);
    expect(result).toBe("react (@vince)");
  });

  it("should return unchanged if already a full ID", () => {
    const matrix = createMatrix({}, { react: "react (@vince)" });
    const result = resolveAlias("react (@vince)", matrix);
    expect(result).toBe("react (@vince)");
  });

  it("should return unchanged if alias not found", () => {
    const matrix = createMatrix({}, {});
    const result = resolveAlias("unknown", matrix);
    expect(result).toBe("unknown");
  });
});

describe("isDisabled", () => {
  it("should return false for skill with no conflicts or requirements", () => {
    const skill = createSkill("skill-a");
    const matrix = createMatrix({ "skill-a": skill });

    const result = isDisabled("skill-a", [], matrix);
    expect(result).toBe(false);
  });

  it("should return true if skill conflicts with a selected skill", () => {
    const skillA = createSkill("skill-a", {
      conflictsWith: [{ skillId: "skill-b", reason: "Incompatible" }],
    });
    const skillB = createSkill("skill-b");
    const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

    const result = isDisabled("skill-a", ["skill-b"], matrix);
    expect(result).toBe(true);
  });

  it("should return true if selected skill conflicts with this skill", () => {
    const skillA = createSkill("skill-a");
    const skillB = createSkill("skill-b", {
      conflictsWith: [{ skillId: "skill-a", reason: "Incompatible" }],
    });
    const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

    const result = isDisabled("skill-a", ["skill-b"], matrix);
    expect(result).toBe(true);
  });

  it("should return true if required skills are not selected (AND logic)", () => {
    const skillA = createSkill("skill-a", {
      requires: [
        {
          skillIds: ["skill-b", "skill-c"],
          needsAny: false,
          reason: "Needs both",
        },
      ],
    });
    const skillB = createSkill("skill-b");
    const skillC = createSkill("skill-c");
    const matrix = createMatrix({
      "skill-a": skillA,
      "skill-b": skillB,
      "skill-c": skillC,
    });

    // Only skill-b selected, but needs both
    const result = isDisabled("skill-a", ["skill-b"], matrix);
    expect(result).toBe(true);
  });

  it("should return false if required skills are selected (AND logic)", () => {
    const skillA = createSkill("skill-a", {
      requires: [
        {
          skillIds: ["skill-b", "skill-c"],
          needsAny: false,
          reason: "Needs both",
        },
      ],
    });
    const skillB = createSkill("skill-b");
    const skillC = createSkill("skill-c");
    const matrix = createMatrix({
      "skill-a": skillA,
      "skill-b": skillB,
      "skill-c": skillC,
    });

    const result = isDisabled("skill-a", ["skill-b", "skill-c"], matrix);
    expect(result).toBe(false);
  });

  it("should return true if none of the required skills are selected (OR logic)", () => {
    const skillA = createSkill("skill-a", {
      requires: [
        {
          skillIds: ["skill-b", "skill-c"],
          needsAny: true,
          reason: "Needs one",
        },
      ],
    });
    const matrix = createMatrix({
      "skill-a": skillA,
      "skill-b": createSkill("skill-b"),
      "skill-c": createSkill("skill-c"),
    });

    const result = isDisabled("skill-a", [], matrix);
    expect(result).toBe(true);
  });

  it("should return false if any required skill is selected (OR logic)", () => {
    const skillA = createSkill("skill-a", {
      requires: [
        {
          skillIds: ["skill-b", "skill-c"],
          needsAny: true,
          reason: "Needs one",
        },
      ],
    });
    const matrix = createMatrix({
      "skill-a": skillA,
      "skill-b": createSkill("skill-b"),
      "skill-c": createSkill("skill-c"),
    });

    const result = isDisabled("skill-a", ["skill-c"], matrix);
    expect(result).toBe(false);
  });
});

describe("isDiscouraged", () => {
  it("should return false for skill with no discourages", () => {
    const skill = createSkill("skill-a");
    const matrix = createMatrix({ "skill-a": skill });

    const result = isDiscouraged("skill-a", [], matrix);
    expect(result).toBe(false);
  });

  it("should return true if selected skill discourages this skill", () => {
    const skillA = createSkill("skill-a");
    const skillB = createSkill("skill-b", {
      discourages: [{ skillId: "skill-a", reason: "Not recommended" }],
    });
    const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

    const result = isDiscouraged("skill-a", ["skill-b"], matrix);
    expect(result).toBe(true);
  });

  it("should return true if this skill discourages a selected skill", () => {
    const skillA = createSkill("skill-a", {
      discourages: [{ skillId: "skill-b", reason: "Not recommended" }],
    });
    const skillB = createSkill("skill-b");
    const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

    const result = isDiscouraged("skill-a", ["skill-b"], matrix);
    expect(result).toBe(true);
  });
});

describe("isRecommended", () => {
  it("should return false for skill with no recommendations", () => {
    const skill = createSkill("skill-a");
    const matrix = createMatrix({ "skill-a": skill });

    const result = isRecommended("skill-a", [], matrix);
    expect(result).toBe(false);
  });

  it("should return true if selected skill recommends this skill", () => {
    const skillA = createSkill("skill-a");
    const skillB = createSkill("skill-b", {
      recommends: [{ skillId: "skill-a", reason: "Works well together" }],
    });
    const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

    const result = isRecommended("skill-a", ["skill-b"], matrix);
    expect(result).toBe(true);
  });

  it("should return false if no selected skill recommends this skill", () => {
    const skillA = createSkill("skill-a");
    const skillB = createSkill("skill-b");
    const skillC = createSkill("skill-c", {
      recommends: [{ skillId: "skill-a", reason: "Works well" }],
    });
    const matrix = createMatrix({
      "skill-a": skillA,
      "skill-b": skillB,
      "skill-c": skillC,
    });

    // skill-b is selected, but it doesn't recommend skill-a
    const result = isRecommended("skill-a", ["skill-b"], matrix);
    expect(result).toBe(false);
  });
});

describe("getDisableReason", () => {
  it("should return undefined for enabled skill", () => {
    const skill = createSkill("skill-a");
    const matrix = createMatrix({ "skill-a": skill });

    const result = getDisableReason("skill-a", [], matrix);
    expect(result).toBeUndefined();
  });

  it("should return conflict reason", () => {
    const skillA = createSkill("skill-a", {
      conflictsWith: [{ skillId: "skill-b", reason: "Cannot use together" }],
    });
    const skillB = createSkill("skill-b");
    const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

    const result = getDisableReason("skill-a", ["skill-b"], matrix);
    expect(result).toContain("Cannot use together");
    expect(result).toContain("conflicts with");
  });
});

describe("validateSelection", () => {
  it("should return valid for empty selection", () => {
    const matrix = createMatrix({});
    const result = validateSelection([], matrix);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should return valid for non-conflicting selection", () => {
    const matrix = createMatrix({
      "skill-a": createSkill("skill-a"),
      "skill-b": createSkill("skill-b"),
    });

    const result = validateSelection(["skill-a", "skill-b"], matrix);
    expect(result.valid).toBe(true);
  });

  it("should return error for conflicting skills", () => {
    const skillA = createSkill("skill-a", {
      conflictsWith: [{ skillId: "skill-b", reason: "Incompatible" }],
    });
    const skillB = createSkill("skill-b");
    const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

    const result = validateSelection(["skill-a", "skill-b"], matrix);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe("conflict");
  });

  it("should return error for missing requirements", () => {
    const skillA = createSkill("skill-a", {
      requires: [{ skillIds: ["skill-b"], needsAny: false, reason: "Needs B" }],
    });
    const skillB = createSkill("skill-b");
    const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

    const result = validateSelection(["skill-a"], matrix);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "missing_requirement")).toBe(
      true,
    );
  });

  it("should return warning for missing recommendations", () => {
    const skillA = createSkill("skill-a", {
      recommends: [{ skillId: "skill-b", reason: "Works better together" }],
    });
    const skillB = createSkill("skill-b");
    const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

    const result = validateSelection(["skill-a"], matrix);
    expect(result.valid).toBe(true); // Warnings don't make it invalid
    expect(
      result.warnings.some((w) => w.type === "missing_recommendation"),
    ).toBe(true);
  });

  it("should return error for category exclusivity violation", () => {
    const skillA = createSkill("skill-a", {
      category: "framework",
      categoryExclusive: true,
    });
    const skillB = createSkill("skill-b", {
      category: "framework",
      categoryExclusive: true,
    });
    const matrix = createMatrix(
      { "skill-a": skillA, "skill-b": skillB },
      {},
      {
        framework: {
          id: "framework",
          name: "Framework",
          description: "Frameworks",
          exclusive: true,
          required: false,
          order: 1,
        },
      },
    );

    const result = validateSelection(["skill-a", "skill-b"], matrix);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "category_exclusive")).toBe(
      true,
    );
  });
});

describe("getSkillsByCategory", () => {
  it("should return skills in the specified category", () => {
    const matrix = createMatrix({
      "skill-a": createSkill("skill-a", { category: "framework" }),
      "skill-b": createSkill("skill-b", { category: "styling" }),
      "skill-c": createSkill("skill-c", { category: "framework" }),
    });

    const result = getSkillsByCategory("framework", matrix);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toContain("skill-a");
    expect(result.map((s) => s.id)).toContain("skill-c");
  });

  it("should return empty array for category with no skills", () => {
    const matrix = createMatrix({
      "skill-a": createSkill("skill-a", { category: "framework" }),
    });

    const result = getSkillsByCategory("nonexistent", matrix);
    expect(result).toHaveLength(0);
  });
});

describe("getTopLevelCategories", () => {
  it("should return categories without parents", () => {
    const matrix = createMatrix(
      {},
      {},
      {
        framework: {
          id: "framework",
          name: "Framework",
          description: "Frameworks",
          exclusive: true,
          required: false,
          order: 1,
        },
        styling: {
          id: "styling",
          name: "Styling",
          description: "Styling",
          exclusive: false,
          required: false,
          order: 2,
        },
        "styling-css": {
          id: "styling-css",
          name: "CSS",
          description: "CSS styling",
          exclusive: false,
          required: false,
          order: 1,
          parent: "styling",
        },
      },
    );

    const result = getTopLevelCategories(matrix);
    expect(result).toContain("framework");
    expect(result).toContain("styling");
    expect(result).not.toContain("styling-css");
  });

  it("should sort by order", () => {
    const matrix = createMatrix(
      {},
      {},
      {
        second: {
          id: "second",
          name: "Second",
          description: "",
          exclusive: false,
          required: false,
          order: 2,
        },
        first: {
          id: "first",
          name: "First",
          description: "",
          exclusive: false,
          required: false,
          order: 1,
        },
      },
    );

    const result = getTopLevelCategories(matrix);
    expect(result[0]).toBe("first");
    expect(result[1]).toBe("second");
  });
});

describe("getSubcategories", () => {
  it("should return subcategories of a parent", () => {
    const matrix = createMatrix(
      {},
      {},
      {
        styling: {
          id: "styling",
          name: "Styling",
          description: "",
          exclusive: false,
          required: false,
          order: 1,
        },
        "styling-css": {
          id: "styling-css",
          name: "CSS",
          description: "",
          exclusive: false,
          required: false,
          order: 1,
          parent: "styling",
        },
        "styling-tailwind": {
          id: "styling-tailwind",
          name: "Tailwind",
          description: "",
          exclusive: false,
          required: false,
          order: 2,
          parent: "styling",
        },
      },
    );

    const result = getSubcategories("styling", matrix);
    expect(result).toHaveLength(2);
    expect(result).toContain("styling-css");
    expect(result).toContain("styling-tailwind");
  });

  it("should return empty array if no subcategories", () => {
    const matrix = createMatrix(
      {},
      {},
      {
        framework: {
          id: "framework",
          name: "Framework",
          description: "",
          exclusive: true,
          required: false,
          order: 1,
        },
      },
    );

    const result = getSubcategories("framework", matrix);
    expect(result).toHaveLength(0);
  });
});

describe("Empty skill selection (P1-21)", () => {
  describe("validateSelection with empty skills", () => {
    it("should return valid=true for empty selection", () => {
      const matrix = createMatrix({});
      const result = validateSelection([], matrix);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should return valid=true even with skills available in matrix", () => {
      const matrix = createMatrix({
        "skill-a": createSkill("skill-a"),
        "skill-b": createSkill("skill-b"),
        "skill-c": createSkill("skill-c"),
      });

      const result = validateSelection([], matrix);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should not flag missing recommendations for empty selection", () => {
      // Even if skills recommend each other, empty selection has no warnings
      const skillA = createSkill("skill-a", {
        recommends: [{ skillId: "skill-b", reason: "Works well together" }],
      });
      const skillB = createSkill("skill-b");
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const result = validateSelection([], matrix);

      expect(result.warnings).toHaveLength(0);
    });

    it("should not flag category requirements for empty selection", () => {
      // Required categories only matter when skills are selected
      const matrix = createMatrix(
        {},
        {},
        {
          framework: {
            id: "framework",
            name: "Framework",
            description: "Required framework",
            exclusive: true,
            required: true,
            order: 1,
          },
        },
      );

      const result = validateSelection([], matrix);

      // Empty selection is valid - required categories are enforced at wizard level
      expect(result.valid).toBe(true);
    });
  });

  describe("isDisabled with empty current selections", () => {
    it("should not disable skills when nothing is selected", () => {
      const skill = createSkill("skill-a");
      const matrix = createMatrix({ "skill-a": skill });

      // With no selections, nothing should be disabled (except requirements)
      const result = isDisabled("skill-a", [], matrix);
      expect(result).toBe(false);
    });

    it("should still disable skills with unmet requirements", () => {
      // Skill A requires B, but nothing is selected
      const skillA = createSkill("skill-a", {
        requires: [
          { skillIds: ["skill-b"], needsAny: false, reason: "Needs B" },
        ],
      });
      const skillB = createSkill("skill-b");
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const result = isDisabled("skill-a", [], matrix);
      expect(result).toBe(true);
    });
  });

  describe("isRecommended with empty current selections", () => {
    it("should not recommend anything when nothing is selected", () => {
      const skillA = createSkill("skill-a");
      const skillB = createSkill("skill-b", {
        recommends: [{ skillId: "skill-a", reason: "Works well" }],
      });
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      // With no selections, A should not be recommended
      // (only recommended when B is selected)
      const result = isRecommended("skill-a", [], matrix);
      expect(result).toBe(false);
    });
  });

  describe("isDiscouraged with empty current selections", () => {
    it("should not discourage anything when nothing is selected", () => {
      const skillA = createSkill("skill-a");
      const skillB = createSkill("skill-b", {
        discourages: [{ skillId: "skill-a", reason: "Not recommended" }],
      });
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const result = isDiscouraged("skill-a", [], matrix);
      expect(result).toBe(false);
    });
  });
});

describe("Conflicting skills with expert mode off (P1-22)", () => {
  describe("validateSelection catches conflicts", () => {
    it("should return error when conflicting skills are both selected", () => {
      const skillA = createSkill("skill-a", {
        name: "Skill A",
        conflictsWith: [
          { skillId: "skill-b", reason: "These cannot work together" },
        ],
      });
      const skillB = createSkill("skill-b", { name: "Skill B" });
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const result = validateSelection(["skill-a", "skill-b"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("conflict");
      expect(result.errors[0].message).toContain(
        "Skill A conflicts with Skill B",
      );
      expect(result.errors[0].message).toContain("These cannot work together");
      expect(result.errors[0].skills).toContain("skill-a");
      expect(result.errors[0].skills).toContain("skill-b");
    });

    it("should return multiple errors for multiple conflicts", () => {
      const skillA = createSkill("skill-a", {
        name: "Skill A",
        conflictsWith: [
          { skillId: "skill-b", reason: "Conflicts with B" },
          { skillId: "skill-c", reason: "Conflicts with C" },
        ],
      });
      const skillB = createSkill("skill-b", { name: "Skill B" });
      const skillC = createSkill("skill-c", { name: "Skill C" });
      const matrix = createMatrix({
        "skill-a": skillA,
        "skill-b": skillB,
        "skill-c": skillC,
      });

      const result = validateSelection(
        ["skill-a", "skill-b", "skill-c"],
        matrix,
      );

      expect(result.valid).toBe(false);
      expect(result.errors.filter((e) => e.type === "conflict")).toHaveLength(
        2,
      );
    });

    it("should catch conflicts when declaring skill comes first in selection", () => {
      // Conflict is declared on skill-a, which is first in selection
      const skillA = createSkill("skill-a", {
        name: "Skill A",
        conflictsWith: [{ skillId: "skill-b", reason: "A conflicts with B" }],
      });
      const skillB = createSkill("skill-b", { name: "Skill B" });
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      // Order: skill-a first (has the conflict), skill-b second
      const result = validateSelection(["skill-a", "skill-b"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe("conflict");
    });

    it("documents: validateSelection depends on conflict declaration order", () => {
      // NOTE: validateSelection only checks skillA.conflictsWith where skillA
      // comes BEFORE the conflicting skill in the selection array.
      // This is a limitation - the primary protection is isDisabled() which
      // checks bidirectionally and prevents invalid selections in the first place.
      const skillA = createSkill("skill-a", {
        name: "Skill A",
        conflictsWith: [{ skillId: "skill-b", reason: "A conflicts with B" }],
      });
      const skillB = createSkill("skill-b", { name: "Skill B" });
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      // Order: skill-b first, skill-a second (conflict declared on later skill)
      const result = validateSelection(["skill-b", "skill-a"], matrix);

      // The loop checks i=0 (skill-b), j=1 (skill-a) -> skill-b.conflictsWith is empty
      // Then i=1 (skill-a) but no j>1 exists, so skill-a.conflictsWith isn't checked
      // This documents current behavior: real protection is via isDisabled()
      expect(result.valid).toBe(true);
    });
  });

  describe("isDisabled prevents selection of conflicting skills (non-expert mode)", () => {
    it("should disable skill that conflicts with already-selected skill", () => {
      const skillA = createSkill("skill-a", {
        conflictsWith: [{ skillId: "skill-b", reason: "Cannot use together" }],
      });
      const skillB = createSkill("skill-b");
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      // skill-b already selected, skill-a should be disabled
      const result = isDisabled("skill-a", ["skill-b"], matrix);
      expect(result).toBe(true);
    });

    it("should disable skill when selected skill declares conflict with it", () => {
      const skillA = createSkill("skill-a");
      const skillB = createSkill("skill-b", {
        conflictsWith: [{ skillId: "skill-a", reason: "Cannot use together" }],
      });
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      // skill-b already selected, skill-a should be disabled (reverse lookup)
      const result = isDisabled("skill-a", ["skill-b"], matrix);
      expect(result).toBe(true);
    });

    it("should provide correct disable reason for conflicts", () => {
      const skillA = createSkill("skill-a", {
        name: "Skill A",
        conflictsWith: [
          { skillId: "skill-b", reason: "Incompatible architectures" },
        ],
      });
      const skillB = createSkill("skill-b", { name: "Skill B" });
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const reason = getDisableReason("skill-a", ["skill-b"], matrix);

      expect(reason).toContain("Incompatible architectures");
      expect(reason).toContain("conflicts with");
      expect(reason).toContain("Skill B");
    });

    it("should not disable non-conflicting skills", () => {
      const skillA = createSkill("skill-a", {
        conflictsWith: [{ skillId: "skill-c", reason: "Conflicts with C" }],
      });
      const skillB = createSkill("skill-b");
      const skillC = createSkill("skill-c");
      const matrix = createMatrix({
        "skill-a": skillA,
        "skill-b": skillB,
        "skill-c": skillC,
      });

      // skill-b is selected, but skill-a only conflicts with skill-c
      const result = isDisabled("skill-a", ["skill-b"], matrix);
      expect(result).toBe(false);
    });
  });

  describe("non-expert mode auto-disables conflicting skills in getAvailableSkills", () => {
    it("should mark conflicting skill as disabled in available skills list", () => {
      const skillA = createSkill("skill-a", {
        name: "Skill A",
        category: "framework",
        conflictsWith: [{ skillId: "skill-b", reason: "Different paradigms" }],
      });
      const skillB = createSkill("skill-b", {
        name: "Skill B",
        category: "framework",
      });
      const matrix = createMatrix(
        { "skill-a": skillA, "skill-b": skillB },
        {},
        {
          framework: {
            id: "framework",
            name: "Framework",
            description: "Frameworks",
            exclusive: false,
            required: false,
            order: 1,
          },
        },
      );

      // skill-b is already selected
      const options = getAvailableSkills("framework", ["skill-b"], matrix);

      const skillAOption = options.find(
        (o: { id: string }) => o.id === "skill-a",
      );
      expect(skillAOption).toBeDefined();
      expect(skillAOption!.disabled).toBe(true);
      expect(skillAOption!.disabledReason).toContain("Different paradigms");
    });
  });
});

describe("Conflicting skills with expert mode on (P1-23)", () => {
  describe("isDisabled allows conflicts in expert mode", () => {
    it("should NOT disable conflicting skill when expertMode is true", () => {
      const skillA = createSkill("skill-a", {
        conflictsWith: [{ skillId: "skill-b", reason: "Cannot use together" }],
      });
      const skillB = createSkill("skill-b");
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      // skill-b already selected, but expert mode allows skill-a
      const result = isDisabled("skill-a", ["skill-b"], matrix, {
        expertMode: true,
      });
      expect(result).toBe(false);
    });

    it("should NOT disable skill with reverse conflict in expert mode", () => {
      const skillA = createSkill("skill-a");
      const skillB = createSkill("skill-b", {
        conflictsWith: [{ skillId: "skill-a", reason: "Cannot use together" }],
      });
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      // skill-b already selected, but expert mode allows skill-a
      const result = isDisabled("skill-a", ["skill-b"], matrix, {
        expertMode: true,
      });
      expect(result).toBe(false);
    });

    it("should NOT disable skill with unmet requirements in expert mode", () => {
      const skillA = createSkill("skill-a", {
        requires: [
          { skillIds: ["skill-b"], needsAny: false, reason: "Needs B" },
        ],
      });
      const skillB = createSkill("skill-b");
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      // skill-a requires skill-b which is NOT selected, but expert mode allows it
      const result = isDisabled("skill-a", [], matrix, { expertMode: true });
      expect(result).toBe(false);
    });
  });

  describe("validateSelection still reports conflicts (expert mode does not suppress validation)", () => {
    // NOTE: validateSelection is used AFTER selection is finalized
    // Expert mode affects isDisabled (during selection), not validateSelection
    it("should still report conflict errors even if user selected them in expert mode", () => {
      const skillA = createSkill("skill-a", {
        name: "Skill A",
        conflictsWith: [{ skillId: "skill-b", reason: "These conflict" }],
      });
      const skillB = createSkill("skill-b", { name: "Skill B" });
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      // User selected both in expert mode, but validateSelection still catches it
      const result = validateSelection(["skill-a", "skill-b"], matrix);

      // Validation DOES report the conflict (for warnings/documentation)
      // but expert mode allowed the user to make this choice
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe("conflict");
    });
  });

  describe("expert mode in getAvailableSkills", () => {
    it("should NOT disable conflicting skill in available skills list with expert mode", () => {
      const skillA = createSkill("skill-a", {
        name: "Skill A",
        category: "framework",
        conflictsWith: [{ skillId: "skill-b", reason: "Different paradigms" }],
      });
      const skillB = createSkill("skill-b", {
        name: "Skill B",
        category: "framework",
      });
      const matrix = createMatrix(
        { "skill-a": skillA, "skill-b": skillB },
        {},
        {
          framework: {
            id: "framework",
            name: "Framework",
            description: "Frameworks",
            exclusive: false,
            required: false,
            order: 1,
          },
        },
      );

      // skill-b is already selected, but expert mode allows selecting skill-a
      const options = getAvailableSkills("framework", ["skill-b"], matrix, {
        expertMode: true,
      });

      const skillAOption = options.find(
        (o: { id: string }) => o.id === "skill-a",
      );
      expect(skillAOption).toBeDefined();
      expect(skillAOption!.disabled).toBe(false);
    });

    it("should still show selection status correctly in expert mode", () => {
      const skillA = createSkill("skill-a", {
        name: "Skill A",
        category: "framework",
      });
      const skillB = createSkill("skill-b", {
        name: "Skill B",
        category: "framework",
      });
      const matrix = createMatrix(
        { "skill-a": skillA, "skill-b": skillB },
        {},
        {
          framework: {
            id: "framework",
            name: "Framework",
            description: "Frameworks",
            exclusive: false,
            required: false,
            order: 1,
          },
        },
      );

      const options = getAvailableSkills("framework", ["skill-b"], matrix, {
        expertMode: true,
      });

      const skillBOption = options.find(
        (o: { id: string }) => o.id === "skill-b",
      );
      expect(skillBOption).toBeDefined();
      expect(skillBOption!.selected).toBe(true);
    });
  });

  describe("isCategoryAllDisabled respects expert mode", () => {
    it("should return disabled=false in expert mode even when all skills conflict", () => {
      const skillA = createSkill("skill-a", {
        name: "Skill A",
        category: "styling",
        conflictsWith: [{ skillId: "skill-x", reason: "Conflicts with X" }],
      });
      const skillB = createSkill("skill-b", {
        name: "Skill B",
        category: "styling",
        conflictsWith: [{ skillId: "skill-x", reason: "Conflicts with X" }],
      });
      const skillX = createSkill("skill-x", {
        name: "Skill X",
        category: "framework",
      });
      const matrix = createMatrix(
        { "skill-a": skillA, "skill-b": skillB, "skill-x": skillX },
        {},
        {
          styling: {
            id: "styling",
            name: "Styling",
            description: "Styling options",
            exclusive: false,
            required: false,
            order: 2,
          },
          framework: {
            id: "framework",
            name: "Framework",
            description: "Frameworks",
            exclusive: false,
            required: false,
            order: 1,
          },
        },
      );

      // skill-x is selected, which conflicts with all skills in styling category
      // Without expert mode, category should be disabled
      const nonExpert = isCategoryAllDisabled("styling", ["skill-x"], matrix);
      expect(nonExpert.disabled).toBe(true);

      // With expert mode, category should NOT be disabled
      const expert = isCategoryAllDisabled("styling", ["skill-x"], matrix, {
        expertMode: true,
      });
      expect(expert.disabled).toBe(false);
    });
  });
});

/**
 * P1-24: Test Missing Skill Dependencies
 *
 * Tests that validation catches when a skill requires another skill that isn't selected,
 * includes which dependencies are missing, and the recommendation system suggests adding them.
 */
describe("Missing skill dependencies (P1-24)", () => {
  describe("validateSelection catches missing dependencies", () => {
    it("should return error when required skill is not selected (single dependency)", () => {
      const skillA = createSkill("skill-a", {
        requires: [
          {
            skillIds: ["skill-b"],
            needsAny: false,
            reason: "Framework required",
          },
        ],
      });
      const skillB = createSkill("skill-b");
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const result = validateSelection(["skill-a"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("missing_requirement");
      expect(result.errors[0].skills).toContain("skill-a");
      expect(result.errors[0].skills).toContain("skill-b");
    });

    it("should return error when multiple required skills are missing (AND logic)", () => {
      const skillA = createSkill("skill-a", {
        requires: [
          {
            skillIds: ["skill-b", "skill-c"],
            needsAny: false,
            reason: "Both B and C required",
          },
        ],
      });
      const skillB = createSkill("skill-b");
      const skillC = createSkill("skill-c");
      const matrix = createMatrix({
        "skill-a": skillA,
        "skill-b": skillB,
        "skill-c": skillC,
      });

      const result = validateSelection(["skill-a"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("missing_requirement");
      // Should include both missing dependencies
      expect(result.errors[0].skills).toContain("skill-b");
      expect(result.errors[0].skills).toContain("skill-c");
    });

    it("should return error when none of the required skills are selected (OR logic)", () => {
      const skillA = createSkill("skill-a", {
        requires: [
          {
            skillIds: ["skill-b", "skill-c"],
            needsAny: true,
            reason: "Needs at least one framework",
          },
        ],
      });
      const skillB = createSkill("skill-b");
      const skillC = createSkill("skill-c");
      const matrix = createMatrix({
        "skill-a": skillA,
        "skill-b": skillB,
        "skill-c": skillC,
      });

      const result = validateSelection(["skill-a"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("missing_requirement");
      expect(result.errors[0].message).toContain("one of");
    });

    it("should be valid when at least one of OR required skills is selected", () => {
      const skillA = createSkill("skill-a", {
        requires: [
          {
            skillIds: ["skill-b", "skill-c"],
            needsAny: true,
            reason: "Needs at least one framework",
          },
        ],
      });
      const skillB = createSkill("skill-b");
      const skillC = createSkill("skill-c");
      const matrix = createMatrix({
        "skill-a": skillA,
        "skill-b": skillB,
        "skill-c": skillC,
      });

      // Only skill-c selected (not skill-b), but that's enough
      const result = validateSelection(["skill-a", "skill-c"], matrix);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return multiple errors when multiple skills have missing dependencies", () => {
      const skillA = createSkill("skill-a", {
        requires: [
          { skillIds: ["skill-c"], needsAny: false, reason: "A needs C" },
        ],
      });
      const skillB = createSkill("skill-b", {
        requires: [
          { skillIds: ["skill-d"], needsAny: false, reason: "B needs D" },
        ],
      });
      const skillC = createSkill("skill-c");
      const skillD = createSkill("skill-d");
      const matrix = createMatrix({
        "skill-a": skillA,
        "skill-b": skillB,
        "skill-c": skillC,
        "skill-d": skillD,
      });

      // Both A and B are selected but their dependencies are not
      const result = validateSelection(["skill-a", "skill-b"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.every((e) => e.type === "missing_requirement")).toBe(
        true,
      );
    });
  });

  describe("validation result includes which dependencies are missing", () => {
    it("should include missing skill IDs in the error skills array", () => {
      const skillA = createSkill("skill-a", {
        name: "Skill A",
        requires: [
          { skillIds: ["skill-b"], needsAny: false, reason: "Needs B" },
        ],
      });
      const skillB = createSkill("skill-b", { name: "Skill B" });
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const result = validateSelection(["skill-a"], matrix);

      expect(result.errors[0].skills).toEqual(["skill-a", "skill-b"]);
    });

    it("should include skill name in error message", () => {
      const skillA = createSkill("skill-a", {
        name: "My Custom Skill",
        requires: [
          { skillIds: ["skill-b"], needsAny: false, reason: "Needs B" },
        ],
      });
      const skillB = createSkill("skill-b", { name: "Required Skill" });
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const result = validateSelection(["skill-a"], matrix);

      expect(result.errors[0].message).toContain("My Custom Skill");
      expect(result.errors[0].message).toContain("Required Skill");
    });

    it("should include all missing skill names when multiple are missing", () => {
      const skillA = createSkill("skill-a", {
        name: "Consumer Skill",
        requires: [
          {
            skillIds: ["skill-b", "skill-c"],
            needsAny: false,
            reason: "Needs both",
          },
        ],
      });
      const skillB = createSkill("skill-b", { name: "First Required" });
      const skillC = createSkill("skill-c", { name: "Second Required" });
      const matrix = createMatrix({
        "skill-a": skillA,
        "skill-b": skillB,
        "skill-c": skillC,
      });

      const result = validateSelection(["skill-a"], matrix);

      expect(result.errors[0].message).toContain("First Required");
      expect(result.errors[0].message).toContain("Second Required");
    });
  });

  describe("recommendation system suggests adding required dependencies", () => {
    it("should issue warning when recommended skill is not selected", () => {
      const skillA = createSkill("skill-a", {
        name: "TypeScript",
        recommends: [{ skillId: "skill-b", reason: "Better type safety" }],
      });
      const skillB = createSkill("skill-b", { name: "ESLint" });
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const result = validateSelection(["skill-a"], matrix);

      expect(result.valid).toBe(true); // Recommendations are warnings, not errors
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe("missing_recommendation");
      expect(result.warnings[0].message).toContain("TypeScript");
      expect(result.warnings[0].message).toContain("ESLint");
      expect(result.warnings[0].message).toContain("Better type safety");
    });

    it("should include recommended skill in warning skills array", () => {
      const skillA = createSkill("skill-a", {
        recommends: [{ skillId: "skill-b", reason: "Recommended" }],
      });
      const skillB = createSkill("skill-b");
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const result = validateSelection(["skill-a"], matrix);

      expect(result.warnings[0].skills).toContain("skill-a");
      expect(result.warnings[0].skills).toContain("skill-b");
    });

    it("should not warn about recommendations that conflict with selected skills", () => {
      const skillA = createSkill("skill-a", {
        recommends: [{ skillId: "skill-b", reason: "Recommended" }],
      });
      const skillB = createSkill("skill-b", {
        conflictsWith: [{ skillId: "skill-c", reason: "Incompatible" }],
      });
      const skillC = createSkill("skill-c");
      const matrix = createMatrix({
        "skill-a": skillA,
        "skill-b": skillB,
        "skill-c": skillC,
      });

      // A recommends B, but B conflicts with C which is selected
      const result = validateSelection(["skill-a", "skill-c"], matrix);

      // Should not recommend B since it conflicts with C
      expect(
        result.warnings.filter((w) => w.type === "missing_recommendation"),
      ).toHaveLength(0);
    });

    it("should not warn when recommended skill is already selected", () => {
      const skillA = createSkill("skill-a", {
        recommends: [{ skillId: "skill-b", reason: "Recommended" }],
      });
      const skillB = createSkill("skill-b");
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const result = validateSelection(["skill-a", "skill-b"], matrix);

      expect(
        result.warnings.filter((w) => w.type === "missing_recommendation"),
      ).toHaveLength(0);
    });
  });

  describe("isDisabled prevents selecting skills with unmet dependencies", () => {
    it("should disable skill when required dependency is not selected", () => {
      const skillA = createSkill("skill-a", {
        requires: [
          { skillIds: ["skill-b"], needsAny: false, reason: "Needs framework" },
        ],
      });
      const skillB = createSkill("skill-b");
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const result = isDisabled("skill-a", [], matrix);

      expect(result).toBe(true);
    });

    it("should enable skill when required dependency is selected", () => {
      const skillA = createSkill("skill-a", {
        requires: [
          { skillIds: ["skill-b"], needsAny: false, reason: "Needs framework" },
        ],
      });
      const skillB = createSkill("skill-b");
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const result = isDisabled("skill-a", ["skill-b"], matrix);

      expect(result).toBe(false);
    });
  });

  describe("getDisableReason explains why skill is disabled due to missing dependencies", () => {
    it("should explain missing required skill", () => {
      const skillA = createSkill("skill-a", {
        requires: [
          {
            skillIds: ["skill-b"],
            needsAny: false,
            reason: "Framework required",
          },
        ],
      });
      const skillB = createSkill("skill-b", { name: "React" });
      const matrix = createMatrix({ "skill-a": skillA, "skill-b": skillB });

      const reason = getDisableReason("skill-a", [], matrix);

      expect(reason).toContain("Framework required");
      expect(reason).toContain("requires");
      expect(reason).toContain("React");
    });

    it("should list all missing required skills (AND logic)", () => {
      const skillA = createSkill("skill-a", {
        requires: [
          {
            skillIds: ["skill-b", "skill-c"],
            needsAny: false,
            reason: "Multiple frameworks needed",
          },
        ],
      });
      const skillB = createSkill("skill-b", { name: "React" });
      const skillC = createSkill("skill-c", { name: "TypeScript" });
      const matrix = createMatrix({
        "skill-a": skillA,
        "skill-b": skillB,
        "skill-c": skillC,
      });

      const reason = getDisableReason("skill-a", [], matrix);

      expect(reason).toContain("React");
      expect(reason).toContain("TypeScript");
    });

    it("should explain OR requirement options", () => {
      const skillA = createSkill("skill-a", {
        requires: [
          {
            skillIds: ["skill-b", "skill-c"],
            needsAny: true,
            reason: "Need a framework",
          },
        ],
      });
      const skillB = createSkill("skill-b", { name: "React" });
      const skillC = createSkill("skill-c", { name: "Vue" });
      const matrix = createMatrix({
        "skill-a": skillA,
        "skill-b": skillB,
        "skill-c": skillC,
      });

      const reason = getDisableReason("skill-a", [], matrix);

      expect(reason).toContain("Need a framework");
      expect(reason).toContain("or");
    });
  });

  describe("alias resolution works with dependencies", () => {
    it("should resolve aliases when checking dependencies", () => {
      const skillA = createSkill("skill-a (@vince)", {
        requires: [
          {
            skillIds: ["skill-b (@vince)"],
            needsAny: false,
            reason: "Needs B",
          },
        ],
      });
      const skillB = createSkill("skill-b (@vince)");
      const matrix = createMatrix(
        { "skill-a (@vince)": skillA, "skill-b (@vince)": skillB },
        { "skill-a": "skill-a (@vince)", "skill-b": "skill-b (@vince)" },
      );

      // Use alias in selection
      const result = validateSelection(["skill-a"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe("missing_requirement");
    });

    it("should validate successfully when dependency is selected via alias", () => {
      const skillA = createSkill("skill-a (@vince)", {
        requires: [
          {
            skillIds: ["skill-b (@vince)"],
            needsAny: false,
            reason: "Needs B",
          },
        ],
      });
      const skillB = createSkill("skill-b (@vince)");
      const matrix = createMatrix(
        { "skill-a (@vince)": skillA, "skill-b (@vince)": skillB },
        { "skill-a": "skill-a (@vince)", "skill-b": "skill-b (@vince)" },
      );

      // Use aliases in selection
      const result = validateSelection(["skill-a", "skill-b"], matrix);

      expect(result.valid).toBe(true);
    });
  });
});
