import { describe, it, expect } from "vitest";
import type { ResolvedSkill, MergedSkillsMatrix } from "../types-matrix";
import {
  TEST_SKILLS,
  TEST_AUTHOR,
  TEST_CATEGORIES,
  createTestReactSkill,
  createTestVueSkill,
  createTestZustandSkill,
  createTestHonoSkill,
  createTestAuthPatternsSkill,
} from "../lib/__tests__/test-fixtures";

// =============================================================================
// Mock Data
// =============================================================================

const createMockSkill = (
  overrides: Partial<ResolvedSkill> = {},
): ResolvedSkill => ({
  id: "test-skill (@author)",
  alias: "test-skill",
  name: "Test Skill",
  description: "A test skill for testing",
  category: "testing",
  categoryExclusive: false,
  tags: ["test", "mock"],
  author: "@author",
  conflictsWith: [],
  recommends: [],
  recommendedBy: [],
  requires: [],
  requiredBy: [],
  alternatives: [],
  discourages: [],
  requiresSetup: [],
  providesSetupFor: [],
  path: "skills/test-skill",
  ...overrides,
});

const MOCK_REACT_SKILL = createTestReactSkill();
const MOCK_VUE_SKILL = createTestVueSkill();
const MOCK_ZUSTAND_SKILL = createTestZustandSkill();
const MOCK_HONO_SKILL = createTestHonoSkill();
const MOCK_AUTH_SKILL = createTestAuthPatternsSkill();

const MOCK_SKILLS: Record<string, ResolvedSkill> = {
  [TEST_SKILLS.REACT]: MOCK_REACT_SKILL,
  [TEST_SKILLS.VUE]: MOCK_VUE_SKILL,
  [TEST_SKILLS.ZUSTAND]: MOCK_ZUSTAND_SKILL,
  [TEST_SKILLS.HONO]: MOCK_HONO_SKILL,
  [TEST_SKILLS.AUTH_PATTERNS]: MOCK_AUTH_SKILL,
};

const MOCK_MATRIX: MergedSkillsMatrix = {
  version: "1.0.0",
  categories: {
    frontend: {
      id: "frontend",
      name: "Frontend",
      description: "Frontend development",
      exclusive: false,
      required: false,
      order: 0,
    },
    [TEST_CATEGORIES.FRAMEWORK]: {
      id: TEST_CATEGORIES.FRAMEWORK,
      name: "Framework",
      description: "UI Frameworks",
      parent: "frontend",
      exclusive: true,
      required: true,
      order: 1,
    },
    [TEST_CATEGORIES.STATE]: {
      id: TEST_CATEGORIES.STATE,
      name: "State",
      description: "State management",
      parent: "frontend",
      exclusive: true,
      required: false,
      order: 2,
    },
    backend: {
      id: "backend",
      name: "Backend",
      description: "Backend development",
      exclusive: false,
      required: false,
      order: 1,
    },
    [TEST_CATEGORIES.BACKEND_FRAMEWORK]: {
      id: TEST_CATEGORIES.BACKEND_FRAMEWORK,
      name: "Framework",
      description: "Backend Frameworks",
      parent: "backend",
      exclusive: true,
      required: false,
      order: 1,
    },
    [TEST_CATEGORIES.SECURITY]: {
      id: TEST_CATEGORIES.SECURITY,
      name: "Security",
      description: "Security patterns",
      parent: "backend",
      exclusive: false,
      required: false,
      order: 2,
    },
  },
  skills: MOCK_SKILLS,
  suggestedStacks: [],
  aliases: {
    react: TEST_SKILLS.REACT,
    vue: TEST_SKILLS.VUE,
    zustand: TEST_SKILLS.ZUSTAND,
    hono: TEST_SKILLS.HONO,
    auth: TEST_SKILLS.AUTH_PATTERNS,
  },
  aliasesReverse: {
    [TEST_SKILLS.REACT]: "react",
    [TEST_SKILLS.VUE]: "vue",
    [TEST_SKILLS.ZUSTAND]: "zustand",
    [TEST_SKILLS.HONO]: "hono",
    [TEST_SKILLS.AUTH_PATTERNS]: "auth",
  },
  generatedAt: new Date().toISOString(),
};

// =============================================================================
// Search Logic Simulation
// =============================================================================

/**
 * Simulate matching logic from search.ts
 */
function matchesQuery(skill: ResolvedSkill, query: string): boolean {
  const lowerQuery = query.toLowerCase();

  if (skill.name.toLowerCase().includes(lowerQuery)) return true;
  if (skill.id.toLowerCase().includes(lowerQuery)) return true;
  if (skill.alias?.toLowerCase().includes(lowerQuery)) return true;
  if (skill.description.toLowerCase().includes(lowerQuery)) return true;
  if (skill.category.toLowerCase().includes(lowerQuery)) return true;
  if (skill.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
    return true;
  }

  return false;
}

/**
 * Simulate category filter from search.ts
 */
function matchesCategory(skill: ResolvedSkill, category: string): boolean {
  const lowerCategory = category.toLowerCase();
  return skill.category.toLowerCase().includes(lowerCategory);
}

/**
 * Simulate truncation from search.ts
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Simulate search execution
 */
function simulateSearch(
  matrix: MergedSkillsMatrix,
  query: string,
  options: { category?: string } = {},
): ResolvedSkill[] {
  let results = Object.values(matrix.skills).filter((skill) =>
    matchesQuery(skill, query),
  );

  if (options.category) {
    results = results.filter((skill) =>
      matchesCategory(skill, options.category!),
    );
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

// =============================================================================
// Tests
// =============================================================================

describe("search command", () => {
  // ===========================================================================
  // Command Structure Tests
  // ===========================================================================

  describe("command structure", () => {
    it("should export searchCommand", async () => {
      const { searchCommand } = await import("./search");
      expect(searchCommand).toBeDefined();
    });

    it("should have correct command name", async () => {
      const { searchCommand } = await import("./search");
      expect(searchCommand.name()).toBe("search");
    });

    it("should have description", async () => {
      const { searchCommand } = await import("./search");
      expect(searchCommand.description()).toBeTruthy();
      expect(searchCommand.description()).toContain("Search");
    });

    it("should have query argument", async () => {
      const { searchCommand } = await import("./search");
      // Command has arguments defined
      expect(searchCommand.registeredArguments.length).toBe(1);
      expect(searchCommand.registeredArguments[0].name()).toBe("query");
    });

    it("should have --source option", async () => {
      const { searchCommand } = await import("./search");
      const options = searchCommand.options;
      const sourceOption = options.find(
        (opt) => opt.short === "-s" || opt.long === "--source",
      );
      expect(sourceOption).toBeDefined();
    });

    it("should have --category option", async () => {
      const { searchCommand } = await import("./search");
      const options = searchCommand.options;
      const categoryOption = options.find(
        (opt) => opt.short === "-c" || opt.long === "--category",
      );
      expect(categoryOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Search Matching Tests
  // ===========================================================================

  describe("search matching logic", () => {
    it("should find skills by name (case-insensitive)", () => {
      const results = simulateSearch(MOCK_MATRIX, "react");

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.id === TEST_SKILLS.REACT)).toBe(true);
    });

    it("should find skills by description", () => {
      const results = simulateSearch(MOCK_MATRIX, "user interfaces");

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(TEST_SKILLS.REACT);
    });

    it("should find skills by category", () => {
      const results = simulateSearch(MOCK_MATRIX, "backend");

      expect(results.length).toBe(2);
      expect(results.some((s) => s.id === TEST_SKILLS.HONO)).toBe(true);
      expect(results.some((s) => s.id === TEST_SKILLS.AUTH_PATTERNS)).toBe(
        true,
      );
    });

    it("should find skills by tag", () => {
      const results = simulateSearch(MOCK_MATRIX, "serverless");

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(TEST_SKILLS.HONO);
    });

    it("should find skills by alias", () => {
      const results = simulateSearch(MOCK_MATRIX, "auth");

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.alias === "auth")).toBe(true);
    });

    it("should be case-insensitive for name", () => {
      const resultsLower = simulateSearch(MOCK_MATRIX, "react");
      const resultsUpper = simulateSearch(MOCK_MATRIX, "REACT");
      const resultsMixed = simulateSearch(MOCK_MATRIX, "ReAcT");

      expect(resultsLower.length).toBe(resultsUpper.length);
      expect(resultsLower.length).toBe(resultsMixed.length);
    });

    it("should be case-insensitive for description", () => {
      const resultsLower = simulateSearch(MOCK_MATRIX, "bear necessities");
      const resultsUpper = simulateSearch(MOCK_MATRIX, "BEAR NECESSITIES");

      expect(resultsLower.length).toBe(resultsUpper.length);
      expect(resultsLower.length).toBe(1);
    });

    it("should be case-insensitive for tags", () => {
      const resultsLower = simulateSearch(MOCK_MATRIX, "jwt");
      const resultsUpper = simulateSearch(MOCK_MATRIX, "JWT");

      expect(resultsLower.length).toBe(resultsUpper.length);
      expect(resultsLower.length).toBe(1);
    });

    it("should return empty array when no matches", () => {
      const results = simulateSearch(MOCK_MATRIX, "nonexistent-skill-xyz");

      expect(results.length).toBe(0);
    });

    it("should sort results alphabetically by name", () => {
      const results = simulateSearch(MOCK_MATRIX, "frontend");

      // Should be sorted: React, Vue, Zustand
      const names = results.map((s) => s.name);
      const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sortedNames);
    });
  });

  // ===========================================================================
  // Category Filter Tests
  // ===========================================================================

  describe("category filtering", () => {
    it("should filter by exact category match", () => {
      const results = simulateSearch(MOCK_MATRIX, "framework", {
        category: TEST_CATEGORIES.FRAMEWORK,
      });

      expect(results.length).toBe(2);
      expect(
        results.every((s) => s.category === TEST_CATEGORIES.FRAMEWORK),
      ).toBe(true);
    });

    it("should filter by partial category match", () => {
      const results = simulateSearch(MOCK_MATRIX, "framework", {
        category: "frontend",
      });

      // React and Vue have "frontend" in their category
      expect(results.length).toBe(2);
    });

    it("should combine query and category filter", () => {
      const results = simulateSearch(MOCK_MATRIX, "framework", {
        category: "backend",
      });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(TEST_SKILLS.HONO);
    });

    it("should return empty when query matches but category doesn't", () => {
      const results = simulateSearch(MOCK_MATRIX, "react", {
        category: "backend",
      });

      expect(results.length).toBe(0);
    });
  });

  // ===========================================================================
  // Result Formatting Tests
  // ===========================================================================

  describe("result formatting", () => {
    it("should truncate long descriptions", () => {
      const longDescription = "A".repeat(100);
      const truncated = truncate(longDescription, 50);

      expect(truncated.length).toBe(50);
      expect(truncated).toContain("...");
      expect(truncated).toBe("A".repeat(47) + "...");
    });

    it("should not truncate short descriptions", () => {
      const shortDescription = "Short desc";
      const truncated = truncate(shortDescription, 50);

      expect(truncated).toBe(shortDescription);
      expect(truncated).not.toContain("...");
    });

    it("should handle exact length descriptions", () => {
      const exactDescription = "A".repeat(50);
      const truncated = truncate(exactDescription, 50);

      expect(truncated).toBe(exactDescription);
      expect(truncated).not.toContain("...");
    });

    it("should use alias if available in display", () => {
      const skill = MOCK_REACT_SKILL;
      const displayId = skill.alias || skill.id;

      expect(displayId).toBe("react");
    });

    it("should use full ID when no alias available", () => {
      const skill = createMockSkill({
        id: "no-alias-skill (@author)",
        alias: undefined,
      });
      const displayId = skill.alias || skill.id;

      expect(displayId).toBe("no-alias-skill (@author)");
    });
  });

  // ===========================================================================
  // P4-03: Search finds skills by name/description
  // ===========================================================================

  describe("P4-03: Search finds skills by name/description", () => {
    it("should find skill by exact name", () => {
      const results = simulateSearch(MOCK_MATRIX, "React");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe("React");
    });

    it("should find skill by partial name", () => {
      const results = simulateSearch(MOCK_MATRIX, "rea");

      // "rea" matches: React (name), Vue (tag: reactive), Zustand (tag: react)
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((s) => s.name === "React")).toBe(true);
    });

    it("should find skill by description keyword", () => {
      const results = simulateSearch(MOCK_MATRIX, "bear");

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Zustand");
    });

    it("should find multiple skills matching query", () => {
      const results = simulateSearch(MOCK_MATRIX, "framework");

      // Should find react, vue (frontend/framework) and hono (backend/framework)
      expect(results.length).toBeGreaterThanOrEqual(3);
    });

    it("should find skills by ID substring", () => {
      const results = simulateSearch(MOCK_MATRIX, TEST_AUTHOR);

      // All skills have @vince in their ID
      expect(results.length).toBe(5);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty skills matrix", () => {
      const emptyMatrix: MergedSkillsMatrix = {
        ...MOCK_MATRIX,
        skills: {},
      };

      const results = simulateSearch(emptyMatrix, "react");
      expect(results.length).toBe(0);
    });

    it("should handle single character query", () => {
      const results = simulateSearch(MOCK_MATRIX, "r");

      // Should find skills with 'r' in name/description/etc
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle query with special characters", () => {
      const results = simulateSearch(MOCK_MATRIX, `(${TEST_AUTHOR})`);

      // All skills have (@vince) in their ID
      expect(results.length).toBe(5);
    });

    it("should handle whitespace in query", () => {
      const results = simulateSearch(MOCK_MATRIX, "user interfaces");

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(TEST_SKILLS.REACT);
    });
  });
});
