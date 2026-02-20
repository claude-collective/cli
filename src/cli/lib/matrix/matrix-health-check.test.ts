import { describe, it, expect, vi } from "vitest";
import { checkMatrixHealth } from "./matrix-health-check";
import { createMockSkill, createMockMatrix } from "../__tests__/helpers";
import type {
  CategoryDefinition,
  MergedSkillsMatrix,
  ResolvedSkill,
  SkillId,
  Subcategory,
} from "../../types";

// Mock logger to suppress warnings during tests (manual mock from __mocks__ directory)
vi.mock("../../utils/logger");

import { warn } from "../../utils/logger";

function createCategory(
  id: Subcategory,
  overrides?: Partial<CategoryDefinition>,
): CategoryDefinition {
  return {
    id,
    displayName: id,
    description: `${id} category`,
    domain: "web",
    exclusive: true,
    required: false,
    order: 0,
    ...overrides,
  };
}

function createSkill(
  id: SkillId,
  category: Subcategory,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return createMockSkill(id, category, {
    description: `${id} skill`,
    categoryExclusive: true,
    ...overrides,
  });
}

describe("matrix-health-check", () => {
  describe("healthy matrix", () => {
    it("returns no issues for a valid matrix", () => {
      const reactSkill = createSkill("web-framework-react", "web-framework");
      const zustandSkill = createSkill("web-state-zustand", "web-client-state", {
        compatibleWith: ["web-framework-react"],
        recommends: [{ skillId: "web-framework-react", reason: "Works well with React" }],
      });

      const matrix = createMockMatrix(
        {
          "web-framework-react": reactSkill,
          "web-state-zustand": zustandSkill,
        },
        {
          categories: {
            "web-framework": createCategory("web-framework"),
            "web-client-state": createCategory("web-client-state"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(issues).toEqual([]);
    });

    it("does not warn when matrix is structurally valid", () => {
      const skill = createSkill("web-framework-react", "web-framework");

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            "web-framework": createCategory("web-framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      checkMatrixHealth(matrix);

      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe("category domains", () => {
    it("detects category missing domain field", () => {
      const skill = createSkill("web-framework-react", "web-framework");

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            "web-framework": createCategory("web-framework", { domain: undefined }),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      const domainIssues = issues.filter((i) => i.finding === "category-missing-domain");
      expect(domainIssues).toHaveLength(1);
      expect(domainIssues[0].severity).toBe("warning");
      expect(domainIssues[0].details).toContain("framework");
      expect(domainIssues[0].details).toContain("no domain");
    });

    it("does not flag categories with valid domain", () => {
      const skill = createSkill("web-framework-react", "web-framework");

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            "web-framework": createCategory("web-framework", { domain: "web" }),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);
      const domainIssues = issues.filter((i) => i.finding === "category-missing-domain");

      expect(domainIssues).toHaveLength(0);
    });

    it("detects multiple categories missing domains", () => {
      const matrix = createMockMatrix(
        {},
        {
          categories: {
            "web-framework": createCategory("web-framework", { domain: undefined }),
            "web-styling": createCategory("web-styling", { domain: undefined }),
            "web-client-state": createCategory("web-client-state", { domain: "web" }),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);
      const domainIssues = issues.filter((i) => i.finding === "category-missing-domain");

      expect(domainIssues).toHaveLength(2);
    });
  });

  describe("skill categories", () => {
    it("detects skill referencing unknown category", () => {
      const skill = createSkill("web-framework-react", "nonexistent-category" as Subcategory);

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            "web-framework": createCategory("web-framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);
      const categoryIssues = issues.filter((i) => i.finding === "skill-unknown-category");

      expect(categoryIssues).toHaveLength(1);
      expect(categoryIssues[0].severity).toBe("warning");
      expect(categoryIssues[0].details).toContain("web-framework-react");
      expect(categoryIssues[0].details).toContain("nonexistent-category");
    });

    it("does not flag skill with valid category", () => {
      const skill = createSkill("web-framework-react", "web-framework");

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            "web-framework": createCategory("web-framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);
      const categoryIssues = issues.filter((i) => i.finding === "skill-unknown-category");

      expect(categoryIssues).toHaveLength(0);
    });
  });

  describe("logging", () => {
    it("logs a warning for each issue found", () => {
      const skill = createSkill("web-framework-react", "nonexistent-category" as Subcategory);

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            "web-framework": createCategory("web-framework", { domain: undefined }),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(issues.length).toBeGreaterThan(0);
      expect(warn).toHaveBeenCalledTimes(issues.length);
      for (const issue of issues) {
        expect(warn).toHaveBeenCalledWith(`[matrix] ${issue.details}`);
      }
    });
  });

  describe("empty matrix", () => {
    it("returns no issues for empty matrix", () => {
      const matrix = createMockMatrix({});

      const issues = checkMatrixHealth(matrix);

      expect(issues).toEqual([]);
    });

    it("returns no issues for matrix with skills but no structural problems", () => {
      const skill = createSkill("web-framework-react", "web-framework");

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            "web-framework": createCategory("web-framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(issues).toEqual([]);
    });
  });
});
