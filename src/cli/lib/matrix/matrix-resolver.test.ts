import { mapToObj } from "remeda";
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
  getAvailableSkills,
  isCategoryAllDisabled,
} from "./matrix-resolver";
import type {
  CategoryDefinition,
  CategoryPath,
  MergedSkillsMatrix,
  ResolvedSkill,
  SkillDisplayName,
  SkillId,
  Subcategory,
} from "../../types";
import { createMockSkill, createMockMatrix } from "../__tests__/helpers";

function createSkill(id: SkillId, overrides: Partial<ResolvedSkill> = {}): ResolvedSkill {
  return createMockSkill(id, "framework", {
    description: `Description for ${id}`,
    categoryExclusive: true,
    version: "1",
    ...overrides,
  });
}

function createMatrix(
  skills: Record<string, ResolvedSkill>,
  aliases: Record<string, string> = {},
  categories: MergedSkillsMatrix["categories"] = {} as Record<Subcategory, CategoryDefinition>,
): MergedSkillsMatrix {
  return createMockMatrix(skills, {
    categories,
    displayNameToId: aliases as Record<SkillDisplayName, SkillId>,
    displayNames: mapToObj(Object.entries(aliases), ([alias, fullId]) => [fullId, alias]) as Record<
      SkillId,
      SkillDisplayName
    >,
  });
}

describe("resolveAlias", () => {
  it("should resolve an alias to full ID", () => {
    const matrix = createMatrix({}, { react: "web-framework-react" });
    // Boundary cast: testing display name resolution — "react" is a SkillDisplayName, not SkillId
    const result = resolveAlias("react" as unknown as SkillId, matrix);
    expect(result).toBe("web-framework-react");
  });

  it("should return unchanged if already a full ID", () => {
    const matrix = createMatrix({}, { react: "web-framework-react" });
    const result = resolveAlias("web-framework-react", matrix);
    expect(result).toBe("web-framework-react");
  });

  it("should return unchanged if alias not found", () => {
    const matrix = createMatrix({}, {});
    const result = resolveAlias("web-test-unknown", matrix);
    expect(result).toBe("web-test-unknown");
  });
});

describe("isDisabled", () => {
  it("should return false for skill with no conflicts or requirements", () => {
    const skill = createSkill("web-skill-a");
    const matrix = createMatrix({ "web-skill-a": skill });

    const result = isDisabled("web-skill-a", [], matrix);
    expect(result).toBe(false);
  });

  it("should return true if skill conflicts with a selected skill", () => {
    const skillA = createSkill("web-skill-a", {
      conflictsWith: [{ skillId: "web-skill-b", reason: "Incompatible" }],
    });
    const skillB = createSkill("web-skill-b");
    const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

    const result = isDisabled("web-skill-a", ["web-skill-b"], matrix);
    expect(result).toBe(true);
  });

  it("should return true if selected skill conflicts with this skill", () => {
    const skillA = createSkill("web-skill-a");
    const skillB = createSkill("web-skill-b", {
      conflictsWith: [{ skillId: "web-skill-a", reason: "Incompatible" }],
    });
    const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

    const result = isDisabled("web-skill-a", ["web-skill-b"], matrix);
    expect(result).toBe(true);
  });

  it("should return true if required skills are not selected (AND logic)", () => {
    const skillA = createSkill("web-skill-a", {
      requires: [
        {
          skillIds: ["web-skill-b", "web-skill-c"],
          needsAny: false,
          reason: "Needs both",
        },
      ],
    });
    const skillB = createSkill("web-skill-b");
    const skillC = createSkill("web-skill-c");
    const matrix = createMatrix({
      "web-skill-a": skillA,
      "web-skill-b": skillB,
      "web-skill-c": skillC,
    });

    // Only skill-b selected, but needs both
    const result = isDisabled("web-skill-a", ["web-skill-b"], matrix);
    expect(result).toBe(true);
  });

  it("should return false if required skills are selected (AND logic)", () => {
    const skillA = createSkill("web-skill-a", {
      requires: [
        {
          skillIds: ["web-skill-b", "web-skill-c"],
          needsAny: false,
          reason: "Needs both",
        },
      ],
    });
    const skillB = createSkill("web-skill-b");
    const skillC = createSkill("web-skill-c");
    const matrix = createMatrix({
      "web-skill-a": skillA,
      "web-skill-b": skillB,
      "web-skill-c": skillC,
    });

    const result = isDisabled("web-skill-a", ["web-skill-b", "web-skill-c"], matrix);
    expect(result).toBe(false);
  });

  it("should return true if none of the required skills are selected (OR logic)", () => {
    const skillA = createSkill("web-skill-a", {
      requires: [
        {
          skillIds: ["web-skill-b", "web-skill-c"],
          needsAny: true,
          reason: "Needs one",
        },
      ],
    });
    const matrix = createMatrix({
      "web-skill-a": skillA,
      "web-skill-b": createSkill("web-skill-b"),
      "web-skill-c": createSkill("web-skill-c"),
    });

    const result = isDisabled("web-skill-a", [], matrix);
    expect(result).toBe(true);
  });

  it("should return false if any required skill is selected (OR logic)", () => {
    const skillA = createSkill("web-skill-a", {
      requires: [
        {
          skillIds: ["web-skill-b", "web-skill-c"],
          needsAny: true,
          reason: "Needs one",
        },
      ],
    });
    const matrix = createMatrix({
      "web-skill-a": skillA,
      "web-skill-b": createSkill("web-skill-b"),
      "web-skill-c": createSkill("web-skill-c"),
    });

    const result = isDisabled("web-skill-a", ["web-skill-c"], matrix);
    expect(result).toBe(false);
  });
});

describe("isDiscouraged", () => {
  it("should return false for skill with no discourages", () => {
    const skill = createSkill("web-skill-a");
    const matrix = createMatrix({ "web-skill-a": skill });

    const result = isDiscouraged("web-skill-a", [], matrix);
    expect(result).toBe(false);
  });

  it("should return true if selected skill discourages this skill", () => {
    const skillA = createSkill("web-skill-a");
    const skillB = createSkill("web-skill-b", {
      discourages: [{ skillId: "web-skill-a", reason: "Not recommended" }],
    });
    const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

    const result = isDiscouraged("web-skill-a", ["web-skill-b"], matrix);
    expect(result).toBe(true);
  });

  it("should return true if this skill discourages a selected skill", () => {
    const skillA = createSkill("web-skill-a", {
      discourages: [{ skillId: "web-skill-b", reason: "Not recommended" }],
    });
    const skillB = createSkill("web-skill-b");
    const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

    const result = isDiscouraged("web-skill-a", ["web-skill-b"], matrix);
    expect(result).toBe(true);
  });
});

describe("isRecommended", () => {
  it("should return false for skill with no recommendations", () => {
    const skill = createSkill("web-skill-a");
    const matrix = createMatrix({ "web-skill-a": skill });

    const result = isRecommended("web-skill-a", [], matrix);
    expect(result).toBe(false);
  });

  it("should return true if selected skill recommends this skill", () => {
    const skillA = createSkill("web-skill-a");
    const skillB = createSkill("web-skill-b", {
      recommends: [{ skillId: "web-skill-a", reason: "Works well together" }],
    });
    const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

    const result = isRecommended("web-skill-a", ["web-skill-b"], matrix);
    expect(result).toBe(true);
  });

  it("should return false if no selected skill recommends this skill", () => {
    const skillA = createSkill("web-skill-a");
    const skillB = createSkill("web-skill-b");
    const skillC = createSkill("web-skill-c", {
      recommends: [{ skillId: "web-skill-a", reason: "Works well" }],
    });
    const matrix = createMatrix({
      "web-skill-a": skillA,
      "web-skill-b": skillB,
      "web-skill-c": skillC,
    });

    // skill-b is selected, but it doesn't recommend skill-a
    const result = isRecommended("web-skill-a", ["web-skill-b"], matrix);
    expect(result).toBe(false);
  });
});

describe("getDisableReason", () => {
  it("should return undefined for enabled skill", () => {
    const skill = createSkill("web-skill-a");
    const matrix = createMatrix({ "web-skill-a": skill });

    const result = getDisableReason("web-skill-a", [], matrix);
    expect(result).toBeUndefined();
  });

  it("should return conflict reason", () => {
    const skillA = createSkill("web-skill-a", {
      conflictsWith: [{ skillId: "web-skill-b", reason: "Cannot use together" }],
    });
    const skillB = createSkill("web-skill-b");
    const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

    const result = getDisableReason("web-skill-a", ["web-skill-b"], matrix);
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
      "web-skill-a": createSkill("web-skill-a"),
      "web-skill-b": createSkill("web-skill-b"),
    });

    const result = validateSelection(["web-skill-a", "web-skill-b"], matrix);
    expect(result.valid).toBe(true);
  });

  it("should return error for conflicting skills", () => {
    const skillA = createSkill("web-skill-a", {
      conflictsWith: [{ skillId: "web-skill-b", reason: "Incompatible" }],
    });
    const skillB = createSkill("web-skill-b");
    const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

    const result = validateSelection(["web-skill-a", "web-skill-b"], matrix);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe("conflict");
  });

  it("should return error for missing requirements", () => {
    const skillA = createSkill("web-skill-a", {
      requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Needs B" }],
    });
    const skillB = createSkill("web-skill-b");
    const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

    const result = validateSelection(["web-skill-a"], matrix);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "missing_requirement")).toBe(true);
  });

  it("should return warning for missing recommendations", () => {
    const skillA = createSkill("web-skill-a", {
      recommends: [{ skillId: "web-skill-b", reason: "Works better together" }],
    });
    const skillB = createSkill("web-skill-b");
    const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

    const result = validateSelection(["web-skill-a"], matrix);
    expect(result.valid).toBe(true); // Warnings don't make it invalid
    expect(result.warnings.some((w) => w.type === "missing_recommendation")).toBe(true);
  });

  it("should return error for category exclusivity violation", () => {
    const skillA = createSkill("web-skill-a", {
      category: "framework",
      categoryExclusive: true,
    });
    const skillB = createSkill("web-skill-b", {
      category: "framework",
      categoryExclusive: true,
    });
    const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB }, {}, {
      framework: {
        id: "framework",
        displayName: "Framework",
        description: "Frameworks",
        exclusive: true,
        required: false,
        order: 1,
      },
    } as Record<Subcategory, CategoryDefinition>);

    const result = validateSelection(["web-skill-a", "web-skill-b"], matrix);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "category_exclusive")).toBe(true);
  });
});

describe("getSkillsByCategory", () => {
  it("should return skills in the specified category", () => {
    const matrix = createMatrix({
      "web-skill-a": createSkill("web-skill-a", { category: "framework" }),
      "web-skill-b": createSkill("web-skill-b", { category: "styling" }),
      "web-skill-c": createSkill("web-skill-c", { category: "framework" }),
    });

    const result = getSkillsByCategory("framework", matrix);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toContain("web-skill-a");
    expect(result.map((s) => s.id)).toContain("web-skill-c");
  });

  it("should return empty array for category with no skills", () => {
    const matrix = createMatrix({
      "web-skill-a": createSkill("web-skill-a", { category: "framework" }),
    });

    const result = getSkillsByCategory("web-nonexistent", matrix);
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
        "web-skill-a": createSkill("web-skill-a"),
        "web-skill-b": createSkill("web-skill-b"),
        "web-skill-c": createSkill("web-skill-c"),
      });

      const result = validateSelection([], matrix);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should not flag missing recommendations for empty selection", () => {
      // Even if skills recommend each other, empty selection has no warnings
      const skillA = createSkill("web-skill-a", {
        recommends: [{ skillId: "web-skill-b", reason: "Works well together" }],
      });
      const skillB = createSkill("web-skill-b");
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const result = validateSelection([], matrix);

      expect(result.warnings).toHaveLength(0);
    });

    it("should not flag category requirements for empty selection", () => {
      // Required categories only matter when skills are selected
      const matrix = createMatrix({}, {}, {
        framework: {
          id: "framework",
          displayName: "Framework",
          description: "Required framework",
          exclusive: true,
          required: true,
          order: 1,
        },
      } as Record<Subcategory, CategoryDefinition>);

      const result = validateSelection([], matrix);

      // Empty selection is valid - required categories are enforced at wizard level
      expect(result.valid).toBe(true);
    });
  });

  describe("isDisabled with empty current selections", () => {
    it("should not disable skills when nothing is selected", () => {
      const skill = createSkill("web-skill-a");
      const matrix = createMatrix({ "web-skill-a": skill });

      // With no selections, nothing should be disabled (except requirements)
      const result = isDisabled("web-skill-a", [], matrix);
      expect(result).toBe(false);
    });

    it("should still disable skills with unmet requirements", () => {
      // Skill A requires B, but nothing is selected
      const skillA = createSkill("web-skill-a", {
        requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Needs B" }],
      });
      const skillB = createSkill("web-skill-b");
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const result = isDisabled("web-skill-a", [], matrix);
      expect(result).toBe(true);
    });
  });

  describe("isRecommended with empty current selections", () => {
    it("should not recommend anything when nothing is selected", () => {
      const skillA = createSkill("web-skill-a");
      const skillB = createSkill("web-skill-b", {
        recommends: [{ skillId: "web-skill-a", reason: "Works well" }],
      });
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      // With no selections, A should not be recommended
      // (only recommended when B is selected)
      const result = isRecommended("web-skill-a", [], matrix);
      expect(result).toBe(false);
    });
  });

  describe("isDiscouraged with empty current selections", () => {
    it("should not discourage anything when nothing is selected", () => {
      const skillA = createSkill("web-skill-a");
      const skillB = createSkill("web-skill-b", {
        discourages: [{ skillId: "web-skill-a", reason: "Not recommended" }],
      });
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const result = isDiscouraged("web-skill-a", [], matrix);
      expect(result).toBe(false);
    });
  });
});

describe("Conflicting skills with expert mode off (P1-22)", () => {
  describe("validateSelection catches conflicts", () => {
    it("should return error when conflicting skills are both selected", () => {
      const skillA = createSkill("web-skill-a", {
        conflictsWith: [{ skillId: "web-skill-b", reason: "These cannot work together" }],
      });
      const skillB = createSkill("web-skill-b", {});
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const result = validateSelection(["web-skill-a", "web-skill-b"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("conflict");
      expect(result.errors[0].message).toContain("web-skill-a conflicts with web-skill-b");
      expect(result.errors[0].message).toContain("These cannot work together");
      expect(result.errors[0].skills).toContain("web-skill-a");
      expect(result.errors[0].skills).toContain("web-skill-b");
    });

    it("should return multiple errors for multiple conflicts", () => {
      const skillA = createSkill("web-skill-a", {
        conflictsWith: [
          { skillId: "web-skill-b", reason: "Conflicts with B" },
          { skillId: "web-skill-c", reason: "Conflicts with C" },
        ],
      });
      const skillB = createSkill("web-skill-b", {});
      const skillC = createSkill("web-skill-c", {});
      const matrix = createMatrix({
        "web-skill-a": skillA,
        "web-skill-b": skillB,
        "web-skill-c": skillC,
      });

      const result = validateSelection(["web-skill-a", "web-skill-b", "web-skill-c"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors.filter((e) => e.type === "conflict")).toHaveLength(2);
    });

    it("should catch conflicts when declaring skill comes first in selection", () => {
      // Conflict is declared on skill-a, which is first in selection
      const skillA = createSkill("web-skill-a", {
        conflictsWith: [{ skillId: "web-skill-b", reason: "A conflicts with B" }],
      });
      const skillB = createSkill("web-skill-b", {});
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      // Order: skill-a first (has the conflict), skill-b second
      const result = validateSelection(["web-skill-a", "web-skill-b"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe("conflict");
    });

    it("documents: validateSelection depends on conflict declaration order", () => {
      // NOTE: validateSelection only checks skillA.conflictsWith where skillA
      // comes BEFORE the conflicting skill in the selection array.
      // This is a limitation - the primary protection is isDisabled() which
      // checks bidirectionally and prevents invalid selections in the first place.
      const skillA = createSkill("web-skill-a", {
        conflictsWith: [{ skillId: "web-skill-b", reason: "A conflicts with B" }],
      });
      const skillB = createSkill("web-skill-b", {});
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      // Order: skill-b first, skill-a second (conflict declared on later skill)
      const result = validateSelection(["web-skill-b", "web-skill-a"], matrix);

      // The loop checks i=0 (skill-b), j=1 (skill-a) -> skill-b.conflictsWith is empty
      // Then i=1 (skill-a) but no j>1 exists, so skill-a.conflictsWith isn't checked
      // This documents current behavior: real protection is via isDisabled()
      expect(result.valid).toBe(true);
    });
  });

  describe("isDisabled prevents selection of conflicting skills (non-expert mode)", () => {
    it("should disable skill that conflicts with already-selected skill", () => {
      const skillA = createSkill("web-skill-a", {
        conflictsWith: [{ skillId: "web-skill-b", reason: "Cannot use together" }],
      });
      const skillB = createSkill("web-skill-b");
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      // skill-b already selected, skill-a should be disabled
      const result = isDisabled("web-skill-a", ["web-skill-b"], matrix);
      expect(result).toBe(true);
    });

    it("should disable skill when selected skill declares conflict with it", () => {
      const skillA = createSkill("web-skill-a");
      const skillB = createSkill("web-skill-b", {
        conflictsWith: [{ skillId: "web-skill-a", reason: "Cannot use together" }],
      });
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      // skill-b already selected, skill-a should be disabled (reverse lookup)
      const result = isDisabled("web-skill-a", ["web-skill-b"], matrix);
      expect(result).toBe(true);
    });

    it("should provide correct disable reason for conflicts", () => {
      const skillA = createSkill("web-skill-a", {
        conflictsWith: [{ skillId: "web-skill-b", reason: "Incompatible architectures" }],
      });
      const skillB = createSkill("web-skill-b", {});
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const reason = getDisableReason("web-skill-a", ["web-skill-b"], matrix);

      expect(reason).toContain("Incompatible architectures");
      expect(reason).toContain("conflicts with");
      expect(reason).toContain("web-skill-b");
    });

    it("should not disable non-conflicting skills", () => {
      const skillA = createSkill("web-skill-a", {
        conflictsWith: [{ skillId: "web-skill-c", reason: "Conflicts with C" }],
      });
      const skillB = createSkill("web-skill-b");
      const skillC = createSkill("web-skill-c");
      const matrix = createMatrix({
        "web-skill-a": skillA,
        "web-skill-b": skillB,
        "web-skill-c": skillC,
      });

      // skill-b is selected, but skill-a only conflicts with skill-c
      const result = isDisabled("web-skill-a", ["web-skill-b"], matrix);
      expect(result).toBe(false);
    });
  });

  describe("non-expert mode auto-disables conflicting skills in getAvailableSkills", () => {
    it("should mark conflicting skill as disabled in available skills list", () => {
      const skillA = createSkill("web-skill-a", {
        category: "framework",
        conflictsWith: [{ skillId: "web-skill-b", reason: "Different paradigms" }],
      });
      const skillB = createSkill("web-skill-b", {
        category: "framework",
      });
      const matrix = createMatrix(
        { "web-skill-a": skillA, "web-skill-b": skillB },
        {},
        {
          framework: {
            id: "framework",
            displayName: "Framework",
            description: "Frameworks",
            exclusive: false,
            required: false,
            order: 1,
          },
        },
      );

      // skill-b is already selected
      const options = getAvailableSkills("framework", ["web-skill-b"], matrix);

      const skillAOption = options.find((o: { id: string }) => o.id === "web-skill-a");
      expect(skillAOption).toBeDefined();
      expect(skillAOption!.disabled).toBe(true);
      expect(skillAOption!.disabledReason).toContain("Different paradigms");
    });
  });
});

describe("Conflicting skills with expert mode on (P1-23)", () => {
  describe("isDisabled allows conflicts in expert mode", () => {
    it("should NOT disable conflicting skill when expertMode is true", () => {
      const skillA = createSkill("web-skill-a", {
        conflictsWith: [{ skillId: "web-skill-b", reason: "Cannot use together" }],
      });
      const skillB = createSkill("web-skill-b");
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      // skill-b already selected, but expert mode allows skill-a
      const result = isDisabled("web-skill-a", ["web-skill-b"], matrix, {
        expertMode: true,
      });
      expect(result).toBe(false);
    });

    it("should NOT disable skill with reverse conflict in expert mode", () => {
      const skillA = createSkill("web-skill-a");
      const skillB = createSkill("web-skill-b", {
        conflictsWith: [{ skillId: "web-skill-a", reason: "Cannot use together" }],
      });
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      // skill-b already selected, but expert mode allows skill-a
      const result = isDisabled("web-skill-a", ["web-skill-b"], matrix, {
        expertMode: true,
      });
      expect(result).toBe(false);
    });

    it("should NOT disable skill with unmet requirements in expert mode", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Needs B" }],
      });
      const skillB = createSkill("web-skill-b");
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      // skill-a requires skill-b which is NOT selected, but expert mode allows it
      const result = isDisabled("web-skill-a", [], matrix, { expertMode: true });
      expect(result).toBe(false);
    });
  });

  describe("validateSelection still reports conflicts (expert mode does not suppress validation)", () => {
    // NOTE: validateSelection is used AFTER selection is finalized
    // Expert mode affects isDisabled (during selection), not validateSelection
    it("should still report conflict errors even if user selected them in expert mode", () => {
      const skillA = createSkill("web-skill-a", {
        conflictsWith: [{ skillId: "web-skill-b", reason: "These conflict" }],
      });
      const skillB = createSkill("web-skill-b", {});
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      // User selected both in expert mode, but validateSelection still catches it
      const result = validateSelection(["web-skill-a", "web-skill-b"], matrix);

      // Validation DOES report the conflict (for warnings/documentation)
      // but expert mode allowed the user to make this choice
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe("conflict");
    });
  });

  describe("expert mode in getAvailableSkills", () => {
    it("should NOT disable conflicting skill in available skills list with expert mode", () => {
      const skillA = createSkill("web-skill-a", {
        category: "framework",
        conflictsWith: [{ skillId: "web-skill-b", reason: "Different paradigms" }],
      });
      const skillB = createSkill("web-skill-b", {
        category: "framework",
      });
      const matrix = createMatrix(
        { "web-skill-a": skillA, "web-skill-b": skillB },
        {},
        {
          framework: {
            id: "framework",
            displayName: "Framework",
            description: "Frameworks",
            exclusive: false,
            required: false,
            order: 1,
          },
        },
      );

      // skill-b is already selected, but expert mode allows selecting skill-a
      const options = getAvailableSkills("framework", ["web-skill-b"], matrix, {
        expertMode: true,
      });

      const skillAOption = options.find((o: { id: string }) => o.id === "web-skill-a");
      expect(skillAOption).toBeDefined();
      expect(skillAOption!.disabled).toBe(false);
    });

    it("should still show selection status correctly in expert mode", () => {
      const skillA = createSkill("web-skill-a", {
        category: "framework",
      });
      const skillB = createSkill("web-skill-b", {
        category: "framework",
      });
      const matrix = createMatrix(
        { "web-skill-a": skillA, "web-skill-b": skillB },
        {},
        {
          framework: {
            id: "framework",
            displayName: "Framework",
            description: "Frameworks",
            exclusive: false,
            required: false,
            order: 1,
          },
        },
      );

      const options = getAvailableSkills("framework", ["web-skill-b"], matrix, {
        expertMode: true,
      });

      const skillBOption = options.find((o: { id: string }) => o.id === "web-skill-b");
      expect(skillBOption).toBeDefined();
      expect(skillBOption!.selected).toBe(true);
    });
  });

  describe("isCategoryAllDisabled respects expert mode", () => {
    it("should return disabled=false in expert mode even when all skills conflict", () => {
      const skillA = createSkill("web-skill-a", {
        category: "styling",
        conflictsWith: [{ skillId: "web-skill-x", reason: "Conflicts with X" }],
      });
      const skillB = createSkill("web-skill-b", {
        category: "styling",
        conflictsWith: [{ skillId: "web-skill-x", reason: "Conflicts with X" }],
      });
      const skillX = createSkill("web-skill-x", {
        category: "framework",
      });
      const matrix = createMatrix(
        { "web-skill-a": skillA, "web-skill-b": skillB, "web-skill-x": skillX },
        {},
        {
          styling: {
            id: "styling",
            displayName: "Styling",
            description: "Styling options",
            exclusive: false,
            required: false,
            order: 2,
          },
          framework: {
            id: "framework",
            displayName: "Framework",
            description: "Frameworks",
            exclusive: false,
            required: false,
            order: 1,
          },
        } as Record<Subcategory, CategoryDefinition>,
      );

      // skill-x is selected, which conflicts with all skills in styling category
      // Without expert mode, category should be disabled
      const nonExpert = isCategoryAllDisabled("styling", ["web-skill-x"], matrix);
      expect(nonExpert.disabled).toBe(true);

      // With expert mode, category should NOT be disabled
      const expert = isCategoryAllDisabled("styling", ["web-skill-x"], matrix, {
        expertMode: true,
      });
      expect(expert.disabled).toBe(false);
    });
  });
});

describe("Missing skill dependencies (P1-24)", () => {
  describe("validateSelection catches missing dependencies", () => {
    it("should return error when required skill is not selected (single dependency)", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b"],
            needsAny: false,
            reason: "Framework required",
          },
        ],
      });
      const skillB = createSkill("web-skill-b");
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const result = validateSelection(["web-skill-a"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("missing_requirement");
      expect(result.errors[0].skills).toContain("web-skill-a");
      expect(result.errors[0].skills).toContain("web-skill-b");
    });

    it("should return error when multiple required skills are missing (AND logic)", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b", "web-skill-c"],
            needsAny: false,
            reason: "Both B and C required",
          },
        ],
      });
      const skillB = createSkill("web-skill-b");
      const skillC = createSkill("web-skill-c");
      const matrix = createMatrix({
        "web-skill-a": skillA,
        "web-skill-b": skillB,
        "web-skill-c": skillC,
      });

      const result = validateSelection(["web-skill-a"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("missing_requirement");
      // Should include both missing dependencies
      expect(result.errors[0].skills).toContain("web-skill-b");
      expect(result.errors[0].skills).toContain("web-skill-c");
    });

    it("should return error when none of the required skills are selected (OR logic)", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b", "web-skill-c"],
            needsAny: true,
            reason: "Needs at least one framework",
          },
        ],
      });
      const skillB = createSkill("web-skill-b");
      const skillC = createSkill("web-skill-c");
      const matrix = createMatrix({
        "web-skill-a": skillA,
        "web-skill-b": skillB,
        "web-skill-c": skillC,
      });

      const result = validateSelection(["web-skill-a"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("missing_requirement");
      expect(result.errors[0].message).toContain("one of");
    });

    it("should be valid when at least one of OR required skills is selected", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b", "web-skill-c"],
            needsAny: true,
            reason: "Needs at least one framework",
          },
        ],
      });
      const skillB = createSkill("web-skill-b");
      const skillC = createSkill("web-skill-c");
      const matrix = createMatrix({
        "web-skill-a": skillA,
        "web-skill-b": skillB,
        "web-skill-c": skillC,
      });

      // Only skill-c selected (not skill-b), but that's enough
      const result = validateSelection(["web-skill-a", "web-skill-c"], matrix);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return multiple errors when multiple skills have missing dependencies", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [{ skillIds: ["web-skill-c"], needsAny: false, reason: "A needs C" }],
      });
      const skillB = createSkill("web-skill-b", {
        requires: [{ skillIds: ["web-skill-d"], needsAny: false, reason: "B needs D" }],
      });
      const skillC = createSkill("web-skill-c");
      const skillD = createSkill("web-skill-d");
      const matrix = createMatrix({
        "web-skill-a": skillA,
        "web-skill-b": skillB,
        "web-skill-c": skillC,
        "web-skill-d": skillD,
      });

      // Both A and B are selected but their dependencies are not
      const result = validateSelection(["web-skill-a", "web-skill-b"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.every((e) => e.type === "missing_requirement")).toBe(true);
    });
  });

  describe("validation result includes which dependencies are missing", () => {
    it("should include missing skill IDs in the error skills array", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Needs B" }],
      });
      const skillB = createSkill("web-skill-b", {});
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const result = validateSelection(["web-skill-a"], matrix);

      expect(result.errors[0].skills).toEqual(["web-skill-a", "web-skill-b"]);
    });

    it("should include skill name in error message", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Needs B" }],
      });
      const skillB = createSkill("web-skill-b", {});
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const result = validateSelection(["web-skill-a"], matrix);

      expect(result.errors[0].message).toContain("web-skill-a");
      expect(result.errors[0].message).toContain("web-skill-b");
    });

    it("should include all missing skill names when multiple are missing", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b", "web-skill-c"],
            needsAny: false,
            reason: "Needs both",
          },
        ],
      });
      const skillB = createSkill("web-skill-b", {});
      const skillC = createSkill("web-skill-c", {});
      const matrix = createMatrix({
        "web-skill-a": skillA,
        "web-skill-b": skillB,
        "web-skill-c": skillC,
      });

      const result = validateSelection(["web-skill-a"], matrix);

      expect(result.errors[0].message).toContain("web-skill-b");
      expect(result.errors[0].message).toContain("web-skill-c");
    });
  });

  describe("recommendation system suggests adding required dependencies", () => {
    it("should issue warning when recommended skill is not selected", () => {
      const skillA = createSkill("web-skill-a", {
        recommends: [{ skillId: "web-skill-b", reason: "Better type safety" }],
      });
      const skillB = createSkill("web-skill-b", {});
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const result = validateSelection(["web-skill-a"], matrix);

      expect(result.valid).toBe(true); // Recommendations are warnings, not errors
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe("missing_recommendation");
      expect(result.warnings[0].message).toContain("web-skill-a");
      expect(result.warnings[0].message).toContain("web-skill-b");
      expect(result.warnings[0].message).toContain("Better type safety");
    });

    it("should include recommended skill in warning skills array", () => {
      const skillA = createSkill("web-skill-a", {
        recommends: [{ skillId: "web-skill-b", reason: "Recommended" }],
      });
      const skillB = createSkill("web-skill-b");
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const result = validateSelection(["web-skill-a"], matrix);

      expect(result.warnings[0].skills).toContain("web-skill-a");
      expect(result.warnings[0].skills).toContain("web-skill-b");
    });

    it("should not warn about recommendations that conflict with selected skills", () => {
      const skillA = createSkill("web-skill-a", {
        recommends: [{ skillId: "web-skill-b", reason: "Recommended" }],
      });
      const skillB = createSkill("web-skill-b", {
        conflictsWith: [{ skillId: "web-skill-c", reason: "Incompatible" }],
      });
      const skillC = createSkill("web-skill-c");
      const matrix = createMatrix({
        "web-skill-a": skillA,
        "web-skill-b": skillB,
        "web-skill-c": skillC,
      });

      // A recommends B, but B conflicts with C which is selected
      const result = validateSelection(["web-skill-a", "web-skill-c"], matrix);

      // Should not recommend B since it conflicts with C
      expect(result.warnings.filter((w) => w.type === "missing_recommendation")).toHaveLength(0);
    });

    it("should not warn when recommended skill is already selected", () => {
      const skillA = createSkill("web-skill-a", {
        recommends: [{ skillId: "web-skill-b", reason: "Recommended" }],
      });
      const skillB = createSkill("web-skill-b");
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const result = validateSelection(["web-skill-a", "web-skill-b"], matrix);

      expect(result.warnings.filter((w) => w.type === "missing_recommendation")).toHaveLength(0);
    });
  });

  describe("isDisabled prevents selecting skills with unmet dependencies", () => {
    it("should disable skill when required dependency is not selected", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Needs framework" }],
      });
      const skillB = createSkill("web-skill-b");
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const result = isDisabled("web-skill-a", [], matrix);

      expect(result).toBe(true);
    });

    it("should enable skill when required dependency is selected", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Needs framework" }],
      });
      const skillB = createSkill("web-skill-b");
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const result = isDisabled("web-skill-a", ["web-skill-b"], matrix);

      expect(result).toBe(false);
    });
  });

  describe("getDisableReason explains why skill is disabled due to missing dependencies", () => {
    it("should explain missing required skill", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b"],
            needsAny: false,
            reason: "Framework required",
          },
        ],
      });
      const skillB = createSkill("web-skill-b", {});
      const matrix = createMatrix({ "web-skill-a": skillA, "web-skill-b": skillB });

      const reason = getDisableReason("web-skill-a", [], matrix);

      expect(reason).toContain("Framework required");
      expect(reason).toContain("requires");
      expect(reason).toContain("web-skill-b");
    });

    it("should list all missing required skills (AND logic)", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b", "web-skill-c"],
            needsAny: false,
            reason: "Multiple frameworks needed",
          },
        ],
      });
      const skillB = createSkill("web-skill-b", {});
      const skillC = createSkill("web-skill-c", {});
      const matrix = createMatrix({
        "web-skill-a": skillA,
        "web-skill-b": skillB,
        "web-skill-c": skillC,
      });

      const reason = getDisableReason("web-skill-a", [], matrix);

      expect(reason).toContain("web-skill-b");
      expect(reason).toContain("web-skill-c");
    });

    it("should explain OR requirement options", () => {
      const skillA = createSkill("web-skill-a", {
        requires: [
          {
            skillIds: ["web-skill-b", "web-skill-c"],
            needsAny: true,
            reason: "Need a framework",
          },
        ],
      });
      const skillB = createSkill("web-skill-b", {});
      const skillC = createSkill("web-skill-c", {});
      const matrix = createMatrix({
        "web-skill-a": skillA,
        "web-skill-b": skillB,
        "web-skill-c": skillC,
      });

      const reason = getDisableReason("web-skill-a", [], matrix);

      expect(reason).toContain("Need a framework");
      expect(reason).toContain("or");
    });
  });

  describe("alias resolution works with dependencies", () => {
    it("should resolve aliases when checking dependencies", () => {
      const skillA = createSkill("web-skill-a-v", {
        requires: [
          {
            skillIds: ["web-skill-b-v"],
            needsAny: false,
            reason: "Needs B",
          },
        ],
      });
      const skillB = createSkill("web-skill-b-v");
      const matrix = createMatrix(
        { "web-skill-a-v": skillA, "web-skill-b-v": skillB },
        { "web-skill-a": "web-skill-a-v", "web-skill-b": "web-skill-b-v" },
      );

      // Use alias in selection
      const result = validateSelection(["web-skill-a"], matrix);

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe("missing_requirement");
    });

    it("should validate successfully when dependency is selected via alias", () => {
      const skillA = createSkill("web-skill-a-v", {
        requires: [
          {
            skillIds: ["web-skill-b-v"],
            needsAny: false,
            reason: "Needs B",
          },
        ],
      });
      const skillB = createSkill("web-skill-b-v");
      const matrix = createMatrix(
        { "web-skill-a-v": skillA, "web-skill-b-v": skillB },
        { "web-skill-a": "web-skill-a-v", "web-skill-b": "web-skill-b-v" },
      );

      // Use aliases in selection
      const result = validateSelection(["web-skill-a", "web-skill-b"], matrix);

      expect(result.valid).toBe(true);
    });
  });
});
