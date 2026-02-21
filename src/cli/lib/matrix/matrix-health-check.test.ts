import { describe, it, expect, vi } from "vitest";
import { checkMatrixHealth } from "./matrix-health-check";
import {
  createMockSkill,
  createMockMatrix,
  createMockCategory,
  TEST_SKILLS,
  TEST_CATEGORIES,
} from "../__tests__/helpers";
import type { ResolvedSkill, SkillId, Subcategory } from "../../types";

vi.mock("../../utils/logger");

import { warn } from "../../utils/logger";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const missingDomainFrameworkCategory = createMockCategory("web-framework", "Framework", {
  domain: undefined,
});
const missingDomainStylingCategory = createMockCategory("web-styling", "Styling", {
  domain: undefined,
});

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

const zustandSkill: ResolvedSkill = {
  ...TEST_SKILLS.zustand,
  recommends: [{ skillId: "web-framework-react", reason: "Works well with React" }],
};

const orphanSkill = createMockSkill("web-framework-react", "nonexistent-category" as Subcategory);

const unresolvedCompatibleWithSkill: ResolvedSkill = {
  ...TEST_SKILLS.zustand,
  compatibleWith: ["web-framework-nonexistent" as SkillId],
};

const unresolvedConflictsWithSkill: ResolvedSkill = {
  ...TEST_SKILLS.react,
  conflictsWith: [{ skillId: "web-framework-ghost" as SkillId, reason: "Conflicts" }],
};

const unresolvedRequiresSkill = createMockSkill("web-testing-cypress-e2e", "web-testing", {
  requires: [
    {
      skillIds: ["web-framework-missing" as SkillId],
      needsAny: false,
      reason: "Needs a framework",
    },
  ],
});

const unresolvedRequiresSetupSkill: ResolvedSkill = {
  ...TEST_SKILLS.react,
  requiresSetup: ["infra-setup-missing" as SkillId],
};

const unresolvedProvidesSetupForSkill = createMockSkill("infra-setup-env", "shared-tooling", {
  providesSetupFor: ["web-framework-missing" as SkillId],
});

const multipleUnresolvedRefsSkill: ResolvedSkill = {
  ...TEST_SKILLS.zustand,
  compatibleWith: ["web-framework-missing" as SkillId],
  conflictsWith: [{ skillId: "web-state-ghost" as SkillId, reason: "Conflicts" }],
  requiresSetup: ["infra-setup-missing" as SkillId],
};

const allRefsResolvedSkill: ResolvedSkill = {
  ...TEST_SKILLS.zustand,
  conflictsWith: [{ skillId: "web-framework-react", reason: "Test" }],
  requires: [
    {
      skillIds: ["web-framework-react"],
      needsAny: false,
      reason: "Needs React",
    },
  ],
  requiresSetup: ["web-framework-react"],
  providesSetupFor: ["web-framework-react"],
};

const partialUnresolvedRequiresSkill = createMockSkill("web-testing-cypress-e2e", "web-testing", {
  requires: [
    {
      skillIds: ["web-framework-react", "web-framework-missing" as SkillId],
      needsAny: true,
      reason: "Needs one framework",
    },
  ],
});

// ---------------------------------------------------------------------------
// Matrices
// ---------------------------------------------------------------------------

const healthyMatrix = createMockMatrix(
  {
    "web-framework-react": TEST_SKILLS.react,
    "web-state-zustand": zustandSkill,
  },
  {
    categories: {
      "web-framework": TEST_CATEGORIES.framework,
      "web-client-state": TEST_CATEGORIES.clientState,
    },
  },
);

const singleSkillMatrix = createMockMatrix(
  { "web-framework-react": TEST_SKILLS.react },
  {
    categories: {
      "web-framework": TEST_CATEGORIES.framework,
    },
  },
);

const emptyMatrix = createMockMatrix({});

const missingDomainMatrix = createMockMatrix(
  { "web-framework-react": TEST_SKILLS.react },
  {
    categories: {
      "web-framework": missingDomainFrameworkCategory,
    },
  },
);

const multipleMissingDomainsMatrix = createMockMatrix(
  {},
  {
    categories: {
      "web-framework": missingDomainFrameworkCategory,
      "web-styling": missingDomainStylingCategory,
      "web-client-state": TEST_CATEGORIES.clientState,
    },
  },
);

const unknownCategoryMatrix = createMockMatrix(
  { "web-framework-react": orphanSkill },
  {
    categories: {
      "web-framework": TEST_CATEGORIES.framework,
    },
  },
);

const orphanSkillWithMissingDomainMatrix = createMockMatrix(
  { "web-framework-react": orphanSkill },
  {
    categories: {
      "web-framework": missingDomainFrameworkCategory,
    },
  },
);

const unresolvedCompatibleWithMatrix = createMockMatrix(
  { "web-state-zustand": unresolvedCompatibleWithSkill },
  {
    categories: {
      "web-client-state": TEST_CATEGORIES.clientState,
    },
  },
);

const unresolvedConflictsWithMatrix = createMockMatrix(
  { "web-framework-react": unresolvedConflictsWithSkill },
  {
    categories: {
      "web-framework": TEST_CATEGORIES.framework,
    },
  },
);

const unresolvedRequiresMatrix = createMockMatrix(
  { "web-testing-cypress-e2e": unresolvedRequiresSkill },
  {
    categories: {
      "web-testing": TEST_CATEGORIES.testing,
    },
  },
);

const unresolvedRequiresSetupMatrix = createMockMatrix(
  { "web-framework-react": unresolvedRequiresSetupSkill },
  {
    categories: {
      "web-framework": TEST_CATEGORIES.framework,
    },
  },
);

const unresolvedProvidesSetupForMatrix = createMockMatrix(
  { "infra-setup-env": unresolvedProvidesSetupForSkill },
  {
    categories: {
      "shared-tooling": TEST_CATEGORIES.tooling,
    },
  },
);

const multipleUnresolvedRefsMatrix = createMockMatrix(
  { "web-state-zustand": multipleUnresolvedRefsSkill },
  {
    categories: {
      "web-client-state": TEST_CATEGORIES.clientState,
    },
  },
);

const allRefsResolvedMatrix = createMockMatrix(
  {
    "web-framework-react": TEST_SKILLS.react,
    "web-state-zustand": allRefsResolvedSkill,
  },
  {
    categories: {
      "web-framework": TEST_CATEGORIES.framework,
      "web-client-state": TEST_CATEGORIES.clientState,
    },
  },
);

const partialUnresolvedRequiresMatrix = createMockMatrix(
  {
    "web-framework-react": TEST_SKILLS.react,
    "web-testing-cypress-e2e": partialUnresolvedRequiresSkill,
  },
  {
    categories: {
      "web-framework": TEST_CATEGORIES.framework,
      "web-testing": TEST_CATEGORIES.testing,
    },
  },
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("matrix-health-check", () => {
  describe("healthy matrix", () => {
    it("returns no issues for a valid matrix", () => {
      const issues = checkMatrixHealth(healthyMatrix);

      expect(issues).toEqual([]);
    });

    it("does not warn when matrix is structurally valid", () => {
      checkMatrixHealth(singleSkillMatrix);

      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe("category domains", () => {
    it("detects category missing domain field", () => {
      const issues = checkMatrixHealth(missingDomainMatrix);

      const domainIssues = issues.filter((i) => i.finding === "category-missing-domain");
      expect(domainIssues).toHaveLength(1);
      expect(domainIssues[0].severity).toBe("warning");
      expect(domainIssues[0].details).toContain("framework");
      expect(domainIssues[0].details).toContain("no domain");
    });

    it("does not flag categories with valid domain", () => {
      const issues = checkMatrixHealth(singleSkillMatrix);
      const domainIssues = issues.filter((i) => i.finding === "category-missing-domain");

      expect(domainIssues).toHaveLength(0);
    });

    it("detects multiple categories missing domains", () => {
      const issues = checkMatrixHealth(multipleMissingDomainsMatrix);
      const domainIssues = issues.filter((i) => i.finding === "category-missing-domain");

      expect(domainIssues).toHaveLength(2);
    });
  });

  describe("skill categories", () => {
    it("detects skill referencing unknown category", () => {
      const issues = checkMatrixHealth(unknownCategoryMatrix);
      const categoryIssues = issues.filter((i) => i.finding === "skill-unknown-category");

      expect(categoryIssues).toHaveLength(1);
      expect(categoryIssues[0].severity).toBe("warning");
      expect(categoryIssues[0].details).toContain("web-framework-react");
      expect(categoryIssues[0].details).toContain("nonexistent-category");
    });

    it("does not flag skill with valid category", () => {
      const issues = checkMatrixHealth(singleSkillMatrix);
      const categoryIssues = issues.filter((i) => i.finding === "skill-unknown-category");

      expect(categoryIssues).toHaveLength(0);
    });
  });

  describe("logging", () => {
    it("logs a warning for each issue found", () => {
      const issues = checkMatrixHealth(orphanSkillWithMissingDomainMatrix);

      expect(issues.length).toBeGreaterThan(0);
      expect(warn).toHaveBeenCalledTimes(issues.length);
      for (const issue of issues) {
        expect(warn).toHaveBeenCalledWith(`[matrix] ${issue.details}`);
      }
    });
  });

  describe("skill relation refs", () => {
    it("detects unresolved compatibleWith reference", () => {
      const issues = checkMatrixHealth(unresolvedCompatibleWithMatrix);
      const refIssues = issues.filter((i) => i.finding === "skill-unresolved-relation-ref");

      expect(refIssues).toHaveLength(1);
      expect(refIssues[0].severity).toBe("warning");
      expect(refIssues[0].details).toContain("web-state-zustand");
      expect(refIssues[0].details).toContain("web-framework-nonexistent");
      expect(refIssues[0].details).toContain("compatibleWith");
    });

    it("detects unresolved conflictsWith reference", () => {
      const issues = checkMatrixHealth(unresolvedConflictsWithMatrix);
      const refIssues = issues.filter((i) => i.finding === "skill-unresolved-relation-ref");

      expect(refIssues).toHaveLength(1);
      expect(refIssues[0].details).toContain("web-framework-react");
      expect(refIssues[0].details).toContain("web-framework-ghost");
      expect(refIssues[0].details).toContain("conflictsWith");
    });

    it("detects unresolved requires reference", () => {
      const issues = checkMatrixHealth(unresolvedRequiresMatrix);
      const refIssues = issues.filter((i) => i.finding === "skill-unresolved-relation-ref");

      expect(refIssues).toHaveLength(1);
      expect(refIssues[0].details).toContain("web-testing-cypress-e2e");
      expect(refIssues[0].details).toContain("web-framework-missing");
      expect(refIssues[0].details).toContain("requires");
    });

    it("detects unresolved requiresSetup reference", () => {
      const issues = checkMatrixHealth(unresolvedRequiresSetupMatrix);
      const refIssues = issues.filter((i) => i.finding === "skill-unresolved-relation-ref");

      expect(refIssues).toHaveLength(1);
      expect(refIssues[0].details).toContain("web-framework-react");
      expect(refIssues[0].details).toContain("infra-setup-missing");
      expect(refIssues[0].details).toContain("requiresSetup");
    });

    it("detects unresolved providesSetupFor reference", () => {
      const issues = checkMatrixHealth(unresolvedProvidesSetupForMatrix);
      const refIssues = issues.filter((i) => i.finding === "skill-unresolved-relation-ref");

      expect(refIssues).toHaveLength(1);
      expect(refIssues[0].details).toContain("infra-setup-env");
      expect(refIssues[0].details).toContain("web-framework-missing");
      expect(refIssues[0].details).toContain("providesSetupFor");
    });

    it("detects multiple unresolved references across fields", () => {
      const issues = checkMatrixHealth(multipleUnresolvedRefsMatrix);
      const refIssues = issues.filter((i) => i.finding === "skill-unresolved-relation-ref");

      expect(refIssues).toHaveLength(3);
    });

    it("does not flag references that resolve to existing skills", () => {
      const issues = checkMatrixHealth(allRefsResolvedMatrix);
      const refIssues = issues.filter((i) => i.finding === "skill-unresolved-relation-ref");

      expect(refIssues).toHaveLength(0);
    });

    it("does not flag skills with empty relation arrays", () => {
      const issues = checkMatrixHealth(singleSkillMatrix);
      const refIssues = issues.filter((i) => i.finding === "skill-unresolved-relation-ref");

      expect(refIssues).toHaveLength(0);
    });

    it("detects unresolved refs in requires with multiple skillIds", () => {
      const issues = checkMatrixHealth(partialUnresolvedRequiresMatrix);
      const refIssues = issues.filter((i) => i.finding === "skill-unresolved-relation-ref");

      expect(refIssues).toHaveLength(1);
      expect(refIssues[0].details).toContain("web-framework-missing");
      expect(refIssues[0].details).not.toContain("web-framework-react");
    });
  });

  describe("empty matrix", () => {
    it("returns no issues for empty matrix", () => {
      const issues = checkMatrixHealth(emptyMatrix);

      expect(issues).toEqual([]);
    });

    it("returns no issues for matrix with skills but no structural problems", () => {
      const issues = checkMatrixHealth(singleSkillMatrix);

      expect(issues).toEqual([]);
    });
  });
});
