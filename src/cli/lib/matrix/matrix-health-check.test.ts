import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkMatrixHealth } from "./matrix-health-check";
import type { MatrixHealthIssue } from "./matrix-health-check";
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

// =============================================================================
// Helpers
// =============================================================================

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

// =============================================================================
// Tests
// =============================================================================

describe("matrix-health-check", () => {
  describe("checkMatrixHealth — healthy matrix", () => {
    it("returns no issues for a valid matrix with no broken references", () => {
      const reactSkill = createSkill("web-framework-react", "framework");
      const zustandSkill = createSkill("web-state-zustand", "client-state", {
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
            framework: createCategory("framework"),
            "client-state": createCategory("client-state"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(issues).toEqual([]);
    });

    it("does not warn when all relationship targets exist", () => {
      const skillA = createSkill("web-skill-a", "framework", {
        conflictsWith: [{ skillId: "web-skill-b", reason: "Conflicts" }],
        requires: [{ skillIds: ["web-skill-b"], needsAny: false, reason: "Requires B" }],
        alternatives: [{ skillId: "web-skill-b", purpose: "Alternative" }],
        discourages: [{ skillId: "web-skill-b", reason: "Discouraged" }],
        requiresSetup: ["web-skill-b"],
        providesSetupFor: ["web-skill-b"],
      });
      const skillB = createSkill("web-skill-b", "framework");

      const matrix = createMockMatrix(
        {
          "web-skill-a": skillA,
          "web-skill-b": skillB,
        },
        {
          categories: {
            framework: createCategory("framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(issues).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe("checkMatrixHealth — ghost relationship targets", () => {
    it("detects conflictsWith referencing non-existent skill", () => {
      const skill = createSkill("web-framework-react", "framework", {
        conflictsWith: [{ skillId: "web-framework-nonexistent", reason: "Conflict" }],
      });

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            framework: createCategory("framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(issues).toHaveLength(1);
      expect(issues[0].finding).toBe("ghost-relationship-target");
      expect(issues[0].severity).toBe("warning");
      expect(issues[0].details).toContain("web-framework-nonexistent");
      expect(issues[0].details).toContain("conflicts with");
    });

    it("detects recommends referencing non-existent skill", () => {
      const skill = createSkill("web-framework-react", "framework", {
        recommends: [{ skillId: "web-state-ghost", reason: "Recommend" }],
      });

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            framework: createCategory("framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(issues).toHaveLength(1);
      expect(issues[0].finding).toBe("ghost-relationship-target");
      expect(issues[0].details).toContain("recommends");
      expect(issues[0].details).toContain("web-state-ghost");
    });

    it("detects requires referencing non-existent skill (error severity)", () => {
      const skill = createSkill("web-state-zustand", "client-state", {
        requires: [
          { skillIds: ["web-framework-ghost"], needsAny: false, reason: "Needs framework" },
        ],
      });

      const matrix = createMockMatrix(
        { "web-state-zustand": skill },
        {
          categories: {
            "client-state": createCategory("client-state"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(issues).toHaveLength(1);
      expect(issues[0].finding).toBe("ghost-requirement-target");
      expect(issues[0].severity).toBe("error");
      expect(issues[0].details).toContain("web-framework-ghost");
    });

    it("detects alternatives referencing non-existent skill", () => {
      const skill = createSkill("web-framework-react", "framework", {
        alternatives: [{ skillId: "web-framework-ghost", purpose: "Alternative framework" }],
      });

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            framework: createCategory("framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(issues).toHaveLength(1);
      expect(issues[0].finding).toBe("ghost-alternative-target");
      expect(issues[0].details).toContain("web-framework-ghost");
    });

    it("detects discourages referencing non-existent skill", () => {
      const skill = createSkill("web-framework-react", "framework", {
        discourages: [{ skillId: "web-skill-ghost", reason: "Discourage" }],
      });

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            framework: createCategory("framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(issues).toHaveLength(1);
      expect(issues[0].finding).toBe("ghost-relationship-target");
      expect(issues[0].details).toContain("discourages");
      expect(issues[0].details).toContain("web-skill-ghost");
    });

    it("detects requiresSetup referencing non-existent skill", () => {
      const skill = createSkill("api-analytics-posthog-analytics", "analytics", {
        requiresSetup: ["api-analytics-posthog-setup-ghost"],
      });

      const matrix = createMockMatrix(
        { "api-analytics-posthog-analytics": skill },
        {
          categories: {
            analytics: createCategory("analytics", { domain: "api" }),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(issues).toHaveLength(1);
      expect(issues[0].finding).toBe("ghost-setup-target");
      expect(issues[0].details).toContain("requiresSetup");
    });

    it("detects providesSetupFor referencing non-existent skill", () => {
      const skill = createSkill("api-analytics-posthog-setup", "analytics", {
        providesSetupFor: ["api-analytics-ghost-usage"],
      });

      const matrix = createMockMatrix(
        { "api-analytics-posthog-setup": skill },
        {
          categories: {
            analytics: createCategory("analytics", { domain: "api" }),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(issues).toHaveLength(1);
      expect(issues[0].finding).toBe("ghost-setup-target");
      expect(issues[0].details).toContain("providesSetupFor");
    });

    it("detects multiple ghost targets across different relationship types", () => {
      const skill = createSkill("web-framework-react", "framework", {
        conflictsWith: [{ skillId: "web-ghost-a", reason: "Conflict" }],
        recommends: [{ skillId: "web-ghost-b", reason: "Recommend" }],
        requires: [{ skillIds: ["web-ghost-c"], needsAny: false, reason: "Require" }],
        alternatives: [{ skillId: "web-ghost-d", purpose: "Alt" }],
        discourages: [{ skillId: "web-ghost-e", reason: "Discourage" }],
        requiresSetup: ["web-ghost-f"],
        providesSetupFor: ["web-ghost-g"],
      });

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            framework: createCategory("framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      // 7 ghost references: conflict, recommend, require, alternative, discourage, requiresSetup, providesSetupFor
      expect(issues).toHaveLength(7);
    });
  });

  describe("checkMatrixHealth — category domains", () => {
    it("detects category missing domain field", () => {
      const skill = createSkill("web-framework-react", "framework");

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            framework: createCategory("framework", { domain: undefined }),
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
      const skill = createSkill("web-framework-react", "framework");

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            framework: createCategory("framework", { domain: "web" }),
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
            framework: createCategory("framework", { domain: undefined }),
            styling: createCategory("styling", { domain: undefined }),
            "client-state": createCategory("client-state", { domain: "web" }),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);
      const domainIssues = issues.filter((i) => i.finding === "category-missing-domain");

      expect(domainIssues).toHaveLength(2);
    });
  });

  describe("checkMatrixHealth — skill categories", () => {
    it("detects skill referencing unknown category", () => {
      const skill = createSkill("web-framework-react", "nonexistent-category" as Subcategory);

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            framework: createCategory("framework"),
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
      const skill = createSkill("web-framework-react", "framework");

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            framework: createCategory("framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);
      const categoryIssues = issues.filter((i) => i.finding === "skill-unknown-category");

      expect(categoryIssues).toHaveLength(0);
    });
  });

  describe("checkMatrixHealth — compatibleWith targets", () => {
    it("detects compatibleWith referencing non-existent skill", () => {
      const skill = createSkill("web-state-zustand", "client-state", {
        compatibleWith: ["web-framework-ghost"],
      });

      const matrix = createMockMatrix(
        { "web-state-zustand": skill },
        {
          categories: {
            "client-state": createCategory("client-state"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);
      const compatIssues = issues.filter((i) => i.finding === "ghost-compatible-with-target");

      expect(compatIssues).toHaveLength(1);
      expect(compatIssues[0].severity).toBe("warning");
      expect(compatIssues[0].details).toContain("web-framework-ghost");
    });

    it("does not flag compatibleWith for existing skills", () => {
      const react = createSkill("web-framework-react", "framework");
      const zustand = createSkill("web-state-zustand", "client-state", {
        compatibleWith: ["web-framework-react"],
      });

      const matrix = createMockMatrix(
        {
          "web-framework-react": react,
          "web-state-zustand": zustand,
        },
        {
          categories: {
            framework: createCategory("framework"),
            "client-state": createCategory("client-state"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);
      const compatIssues = issues.filter((i) => i.finding === "ghost-compatible-with-target");

      expect(compatIssues).toHaveLength(0);
    });

    it("detects multiple ghost compatibleWith entries", () => {
      const skill = createSkill("web-state-zustand", "client-state", {
        compatibleWith: ["web-ghost-a", "web-ghost-b", "web-ghost-c"],
      });

      const matrix = createMockMatrix(
        { "web-state-zustand": skill },
        {
          categories: {
            "client-state": createCategory("client-state"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);
      const compatIssues = issues.filter((i) => i.finding === "ghost-compatible-with-target");

      expect(compatIssues).toHaveLength(3);
    });
  });

  describe("checkMatrixHealth — stack skill IDs", () => {
    it("detects stack referencing non-existent skill", () => {
      const matrix = createMockMatrix(
        {},
        {
          suggestedStacks: [
            {
              id: "test-stack",
              name: "Test Stack",
              description: "A test stack",
              audience: ["developers"],
              skills: {},
              allSkillIds: ["web-framework-ghost"],
              philosophy: "Test",
            },
          ],
        },
      );

      const issues = checkMatrixHealth(matrix);
      const stackIssues = issues.filter((i) => i.finding === "stack-ghost-skill");

      expect(stackIssues).toHaveLength(1);
      expect(stackIssues[0].severity).toBe("warning");
      expect(stackIssues[0].details).toContain("test-stack");
      expect(stackIssues[0].details).toContain("web-framework-ghost");
    });

    it("does not flag stack with valid skill references", () => {
      const react = createSkill("web-framework-react", "framework");

      const matrix = createMockMatrix(
        { "web-framework-react": react },
        {
          categories: {
            framework: createCategory("framework"),
          } as MergedSkillsMatrix["categories"],
          suggestedStacks: [
            {
              id: "react-stack",
              name: "React Stack",
              description: "React-based stack",
              audience: ["developers"],
              skills: {},
              allSkillIds: ["web-framework-react"],
              philosophy: "React all the things",
            },
          ],
        },
      );

      const issues = checkMatrixHealth(matrix);
      const stackIssues = issues.filter((i) => i.finding === "stack-ghost-skill");

      expect(stackIssues).toHaveLength(0);
    });

    it("detects multiple ghost skills in a single stack", () => {
      const matrix = createMockMatrix(
        {},
        {
          suggestedStacks: [
            {
              id: "broken-stack",
              name: "Broken Stack",
              description: "Has ghost skills",
              audience: [],
              skills: {},
              allSkillIds: ["web-ghost-a", "web-ghost-b"],
              philosophy: "Broken",
            },
          ],
        },
      );

      const issues = checkMatrixHealth(matrix);
      const stackIssues = issues.filter((i) => i.finding === "stack-ghost-skill");

      expect(stackIssues).toHaveLength(2);
    });

    it("detects ghost skills across multiple stacks", () => {
      const matrix = createMockMatrix(
        {},
        {
          suggestedStacks: [
            {
              id: "stack-a",
              name: "Stack A",
              description: "",
              audience: [],
              skills: {},
              allSkillIds: ["web-ghost-x"],
              philosophy: "",
            },
            {
              id: "stack-b",
              name: "Stack B",
              description: "",
              audience: [],
              skills: {},
              allSkillIds: ["web-ghost-y"],
              philosophy: "",
            },
          ],
        },
      );

      const issues = checkMatrixHealth(matrix);
      const stackIssues = issues.filter((i) => i.finding === "stack-ghost-skill");

      expect(stackIssues).toHaveLength(2);
    });
  });

  describe("checkMatrixHealth — logging", () => {
    it("logs a warning for each issue found", () => {
      const skill = createSkill("web-framework-react", "framework", {
        conflictsWith: [{ skillId: "web-ghost-a", reason: "Conflict" }],
        recommends: [{ skillId: "web-ghost-b", reason: "Recommend" }],
      });

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            framework: createCategory("framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(warn).toHaveBeenCalledTimes(issues.length);
      for (const issue of issues) {
        expect(warn).toHaveBeenCalledWith(`[matrix] ${issue.details}`);
      }
    });

    it("does not log when matrix is healthy", () => {
      const skill = createSkill("web-framework-react", "framework");

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            framework: createCategory("framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      checkMatrixHealth(matrix);

      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe("checkMatrixHealth — empty matrix", () => {
    it("returns no issues for empty matrix", () => {
      const matrix = createMockMatrix({});

      const issues = checkMatrixHealth(matrix);

      expect(issues).toEqual([]);
    });

    it("returns no issues for matrix with skills but no relationships", () => {
      const skill = createSkill("web-framework-react", "framework");

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          categories: {
            framework: createCategory("framework"),
          } as MergedSkillsMatrix["categories"],
        },
      );

      const issues = checkMatrixHealth(matrix);

      expect(issues).toEqual([]);
    });
  });
});
