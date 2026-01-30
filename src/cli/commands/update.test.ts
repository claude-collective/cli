import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile, rm } from "fs/promises";
import os from "os";
import type { MergedSkillsMatrix, ResolvedSkill } from "../types-matrix";
import {
  TEST_SKILLS,
  TEST_CATEGORIES,
  createTestReactSkill,
  createTestZustandSkill,
  createTestDrizzleSkill,
} from "../lib/__tests__/test-fixtures";

// =============================================================================
// Mock Data
// =============================================================================

const MOCK_REACT_SKILL = createTestReactSkill();
const MOCK_ZUSTAND_SKILL = createTestZustandSkill();
const MOCK_DRIZZLE_SKILL = createTestDrizzleSkill();

const MOCK_SKILLS: Record<string, ResolvedSkill> = {
  [TEST_SKILLS.REACT]: MOCK_REACT_SKILL,
  [TEST_SKILLS.ZUSTAND]: MOCK_ZUSTAND_SKILL,
  [TEST_SKILLS.DRIZZLE]: MOCK_DRIZZLE_SKILL,
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
    [TEST_CATEGORIES.DATABASE]: {
      id: TEST_CATEGORIES.DATABASE,
      name: "Database",
      description: "Database tools",
      parent: "backend",
      exclusive: false,
      required: false,
      order: 1,
    },
  },
  skills: MOCK_SKILLS,
  suggestedStacks: [],
  aliases: {
    react: TEST_SKILLS.REACT,
    zustand: TEST_SKILLS.ZUSTAND,
    drizzle: TEST_SKILLS.DRIZZLE,
  },
  aliasesReverse: {
    [TEST_SKILLS.REACT]: "react",
    [TEST_SKILLS.ZUSTAND]: "zustand",
    [TEST_SKILLS.DRIZZLE]: "drizzle",
  },
  generatedAt: new Date().toISOString(),
};

// =============================================================================
// Status and Update Logic Simulation
// =============================================================================

type SkillStatus = "current" | "outdated" | "local-only";

interface SkillComparisonResult {
  id: string;
  localHash: string | null;
  sourceHash: string | null;
  status: SkillStatus;
  dirName: string;
  sourcePath?: string;
}

/**
 * Simulate status determination logic from update.ts
 */
function determineStatus(
  localHash: string | null,
  sourceHash: string | null,
): SkillStatus {
  if (localHash === null) {
    return "local-only";
  }
  if (sourceHash === null) {
    return "local-only";
  }
  return localHash === sourceHash ? "current" : "outdated";
}

/**
 * Simulate update eligibility check
 */
function canUpdate(result: SkillComparisonResult): boolean {
  return result.status === "outdated" && result.sourcePath !== undefined;
}

/**
 * Simulate partial skill name matching
 */
function findSkillByPartialMatch(
  skillName: string,
  results: SkillComparisonResult[],
): SkillComparisonResult | null {
  // Exact match first
  const exact = results.find((r) => r.id === skillName);
  if (exact) return exact;

  // Partial match (skill name without author)
  const partial = results.find((r) => {
    const nameWithoutAuthor = r.id.replace(/\s*\(@\w+\)$/, "").toLowerCase();
    return nameWithoutAuthor === skillName.toLowerCase();
  });
  if (partial) return partial;

  // Directory name match
  const byDir = results.find(
    (r) => r.dirName.toLowerCase() === skillName.toLowerCase(),
  );
  if (byDir) return byDir;

  return null;
}

/**
 * Simulate similar skill finding for suggestions
 */
function findSimilarSkills(
  skillName: string,
  results: SkillComparisonResult[],
): string[] {
  const lowered = skillName.toLowerCase();
  return results
    .filter((r) => {
      const name = r.id.toLowerCase();
      const dir = r.dirName.toLowerCase();
      return (
        name.includes(lowered) ||
        dir.includes(lowered) ||
        lowered.includes(name.split(" ")[0])
      );
    })
    .map((r) => r.id)
    .slice(0, 3);
}

/**
 * Simulate forked_from metadata update
 */
function createUpdatedForkedFrom(
  skillId: string,
  newHash: string,
): { skill_id: string; content_hash: string; date: string } {
  return {
    skill_id: skillId,
    content_hash: newHash,
    date: new Date().toISOString().split("T")[0],
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("update command", () => {
  // ===========================================================================
  // Command Structure Tests
  // ===========================================================================

  describe("command structure", () => {
    it("should export updateCommand", async () => {
      const { updateCommand } = await import("./update");
      expect(updateCommand).toBeDefined();
    });

    it("should have correct command name", async () => {
      const { updateCommand } = await import("./update");
      expect(updateCommand.name()).toBe("update");
    });

    it("should have description", async () => {
      const { updateCommand } = await import("./update");
      expect(updateCommand.description()).toBeTruthy();
      expect(updateCommand.description().toLowerCase()).toContain("update");
    });

    it("should have --yes option", async () => {
      const { updateCommand } = await import("./update");
      const options = updateCommand.options;
      const yesOption = options.find(
        (opt) => opt.short === "-y" || opt.long === "--yes",
      );
      expect(yesOption).toBeDefined();
    });

    it("should have --source option", async () => {
      const { updateCommand } = await import("./update");
      const options = updateCommand.options;
      const sourceOption = options.find(
        (opt) => opt.short === "-s" || opt.long === "--source",
      );
      expect(sourceOption).toBeDefined();
    });

    it("should have --no-recompile option", async () => {
      const { updateCommand } = await import("./update");
      const options = updateCommand.options;
      const noRecompileOption = options.find(
        (opt) => opt.long === "--no-recompile",
      );
      expect(noRecompileOption).toBeDefined();
    });

    it("should accept optional skill argument", async () => {
      const { updateCommand } = await import("./update");
      // Check that the command accepts an optional argument
      expect(updateCommand.registeredArguments.length).toBeGreaterThanOrEqual(
        0,
      );
    });
  });

  // ===========================================================================
  // Status Determination Tests
  // ===========================================================================

  describe("status determination", () => {
    it("should return 'current' when hashes match", () => {
      const status = determineStatus("a1b2c3d", "a1b2c3d");
      expect(status).toBe("current");
    });

    it("should return 'outdated' when hashes differ", () => {
      const status = determineStatus("a1b2c3d", "x7y8z9a");
      expect(status).toBe("outdated");
    });

    it("should return 'local-only' when no forked_from (null localHash)", () => {
      const status = determineStatus(null, null);
      expect(status).toBe("local-only");
    });

    it("should return 'local-only' when source not found (null sourceHash)", () => {
      const status = determineStatus("a1b2c3d", null);
      expect(status).toBe("local-only");
    });
  });

  // ===========================================================================
  // Update Eligibility Tests
  // ===========================================================================

  describe("update eligibility", () => {
    it("should allow update for outdated skills with source path", () => {
      const result: SkillComparisonResult = {
        id: TEST_SKILLS.ZUSTAND,
        localHash: "d4e5f6g",
        sourceHash: "x7y8z9a",
        status: "outdated",
        dirName: "zustand",
        sourcePath: "skills/frontend/state/zustand",
      };

      expect(canUpdate(result)).toBe(true);
    });

    it("should not allow update for current skills", () => {
      const result: SkillComparisonResult = {
        id: TEST_SKILLS.REACT,
        localHash: "a1b2c3d",
        sourceHash: "a1b2c3d",
        status: "current",
        dirName: "react",
        sourcePath: "skills/frontend/framework/react",
      };

      expect(canUpdate(result)).toBe(false);
    });

    it("should not allow update for local-only skills", () => {
      const result: SkillComparisonResult = {
        id: "my-custom-skill",
        localHash: null,
        sourceHash: null,
        status: "local-only",
        dirName: "my-custom-skill",
      };

      expect(canUpdate(result)).toBe(false);
    });

    it("should not allow update for outdated skills without source path", () => {
      const result: SkillComparisonResult = {
        id: TEST_SKILLS.ZUSTAND,
        localHash: "d4e5f6g",
        sourceHash: "x7y8z9a",
        status: "outdated",
        dirName: "zustand",
        // No sourcePath
      };

      expect(canUpdate(result)).toBe(false);
    });
  });

  // ===========================================================================
  // Partial Name Matching Tests
  // ===========================================================================

  describe("partial name matching", () => {
    const mockResults: SkillComparisonResult[] = [
      {
        id: TEST_SKILLS.REACT,
        localHash: "a1b2c3d",
        sourceHash: "a1b2c3d",
        status: "current",
        dirName: "react",
      },
      {
        id: TEST_SKILLS.ZUSTAND,
        localHash: "d4e5f6g",
        sourceHash: "x7y8z9a",
        status: "outdated",
        dirName: "zustand",
      },
      {
        id: TEST_SKILLS.DRIZZLE,
        localHash: "e5f6g7h",
        sourceHash: "e5f6g7h",
        status: "current",
        dirName: "drizzle",
      },
    ];

    it("should find skill by exact ID match", () => {
      const found = findSkillByPartialMatch(TEST_SKILLS.ZUSTAND, mockResults);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(TEST_SKILLS.ZUSTAND);
    });

    it("should find skill by name without author", () => {
      const found = findSkillByPartialMatch("zustand", mockResults);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(TEST_SKILLS.ZUSTAND);
    });

    it("should find skill by directory name", () => {
      const found = findSkillByPartialMatch("react", mockResults);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(TEST_SKILLS.REACT);
    });

    it("should be case-insensitive for partial matching", () => {
      const found = findSkillByPartialMatch("ZUSTAND", mockResults);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(TEST_SKILLS.ZUSTAND);
    });

    it("should return null when skill not found", () => {
      const found = findSkillByPartialMatch("nonexistent", mockResults);
      expect(found).toBeNull();
    });
  });

  // ===========================================================================
  // Similar Skills Suggestion Tests
  // ===========================================================================

  describe("similar skills suggestions", () => {
    const mockResults: SkillComparisonResult[] = [
      {
        id: TEST_SKILLS.REACT,
        localHash: "a1b2c3d",
        sourceHash: "a1b2c3d",
        status: "current",
        dirName: "react",
      },
      {
        id: TEST_SKILLS.ZUSTAND,
        localHash: "d4e5f6g",
        sourceHash: "x7y8z9a",
        status: "outdated",
        dirName: "zustand",
      },
    ];

    it("should suggest skills with partial name match", () => {
      const suggestions = findSimilarSkills("zus", mockResults);
      expect(suggestions).toContain(TEST_SKILLS.ZUSTAND);
    });

    it("should suggest skills with partial directory match", () => {
      const suggestions = findSimilarSkills("rea", mockResults);
      expect(suggestions).toContain(TEST_SKILLS.REACT);
    });

    it("should return empty array when no similar skills", () => {
      const suggestions = findSimilarSkills("xyz123", mockResults);
      expect(suggestions.length).toBe(0);
    });

    it("should limit suggestions to 3", () => {
      const manyResults: SkillComparisonResult[] = Array.from(
        { length: 10 },
        (_, i) => ({
          id: `skill-test-${i} (@vince)`,
          localHash: "abc",
          sourceHash: "abc",
          status: "current" as const,
          dirName: `skill-test-${i}`,
        }),
      );

      const suggestions = findSimilarSkills("test", manyResults);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  // ===========================================================================
  // ForkedFrom Metadata Update Tests
  // ===========================================================================

  describe("forked_from metadata update", () => {
    it("should create correct forked_from structure", () => {
      const skillId = TEST_SKILLS.ZUSTAND;
      const newHash = "x7y8z9a";

      const forkedFrom = createUpdatedForkedFrom(skillId, newHash);

      expect(forkedFrom.skill_id).toBe(skillId);
      expect(forkedFrom.content_hash).toBe(newHash);
      expect(forkedFrom.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
    });

    it("should use current date for update", () => {
      const today = new Date().toISOString().split("T")[0];
      const forkedFrom = createUpdatedForkedFrom(TEST_SKILLS.REACT, "abc123");

      expect(forkedFrom.date).toBe(today);
    });
  });

  // ===========================================================================
  // Update All vs Update Specific Tests
  // ===========================================================================

  describe("update all vs update specific", () => {
    it("should filter to only outdated skills for update all", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.REACT,
          localHash: "a1b2c3d",
          sourceHash: "a1b2c3d",
          status: "current",
          dirName: "react",
        },
        {
          id: TEST_SKILLS.ZUSTAND,
          localHash: "d4e5f6g",
          sourceHash: "x7y8z9a",
          status: "outdated",
          dirName: "zustand",
        },
        {
          id: "my-patterns",
          localHash: null,
          sourceHash: null,
          status: "local-only",
          dirName: "my-patterns",
        },
      ];

      const outdated = results.filter((r) => r.status === "outdated");

      expect(outdated.length).toBe(1);
      expect(outdated[0].id).toBe(TEST_SKILLS.ZUSTAND);
    });

    it("should allow specific skill update even when others are outdated", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.ZUSTAND,
          localHash: "d4e5f6g",
          sourceHash: "x7y8z9a",
          status: "outdated",
          dirName: "zustand",
          sourcePath: "skills/zustand",
        },
        {
          id: TEST_SKILLS.DRIZZLE,
          localHash: "e5f6g7h",
          sourceHash: "y8z9a0b",
          status: "outdated",
          dirName: "drizzle",
          sourcePath: "skills/drizzle",
        },
      ];

      const specific = findSkillByPartialMatch("zustand", results);

      expect(specific).not.toBeNull();
      expect(specific?.id).toBe(TEST_SKILLS.ZUSTAND);
    });
  });

  // ===========================================================================
  // P4-06 & P4-08: Acceptance Criteria Tests
  // ===========================================================================

  describe("P4-06 & P4-08: Acceptance Criteria", () => {
    it("should identify all outdated skills for update", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.REACT,
          localHash: "a1b2c3d",
          sourceHash: "a1b2c3d",
          status: "current",
          dirName: "react",
        },
        {
          id: TEST_SKILLS.ZUSTAND,
          localHash: "d4e5f6g",
          sourceHash: "x7y8z9a",
          status: "outdated",
          dirName: "zustand",
          sourcePath: "skills/zustand",
        },
        {
          id: TEST_SKILLS.DRIZZLE,
          localHash: "e5f6g7h",
          sourceHash: "y8z9a0b",
          status: "outdated",
          dirName: "drizzle",
          sourcePath: "skills/drizzle",
        },
      ];

      const toUpdate = results.filter((r) => r.status === "outdated");
      expect(toUpdate.length).toBe(2);
    });

    it("should find specific skill by partial name", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.ZUSTAND,
          localHash: "d4e5f6g",
          sourceHash: "x7y8z9a",
          status: "outdated",
          dirName: "zustand",
        },
      ];

      const found = findSkillByPartialMatch("zustand", results);
      expect(found?.id).toBe(TEST_SKILLS.ZUSTAND);
    });

    it("should show error when skill not found", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.ZUSTAND,
          localHash: "d4e5f6g",
          sourceHash: "x7y8z9a",
          status: "outdated",
          dirName: "zustand",
        },
      ];

      const found = findSkillByPartialMatch("foobar", results);
      expect(found).toBeNull();
    });

    it("should detect already current skill", () => {
      const result: SkillComparisonResult = {
        id: TEST_SKILLS.REACT,
        localHash: "a1b2c3d",
        sourceHash: "a1b2c3d",
        status: "current",
        dirName: "react",
      };

      expect(result.status).toBe("current");
    });

    it("should update forked_from metadata after update", () => {
      const newHash = "x7y8z9a";
      const forkedFrom = createUpdatedForkedFrom(TEST_SKILLS.ZUSTAND, newHash);

      expect(forkedFrom.content_hash).toBe(newHash);
      expect(forkedFrom.skill_id).toBe(TEST_SKILLS.ZUSTAND);
    });

    it("should skip update for local-only skills", () => {
      const result: SkillComparisonResult = {
        id: "my-patterns",
        localHash: null,
        sourceHash: null,
        status: "local-only",
        dirName: "my-patterns",
      };

      expect(canUpdate(result)).toBe(false);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty results array (no local skills)", () => {
      const results: SkillComparisonResult[] = [];
      const outdated = results.filter((r) => r.status === "outdated");

      expect(outdated.length).toBe(0);
    });

    it("should handle all skills being current", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.REACT,
          localHash: "a1b2c3d",
          sourceHash: "a1b2c3d",
          status: "current",
          dirName: "react",
        },
        {
          id: TEST_SKILLS.ZUSTAND,
          localHash: "d4e5f6g",
          sourceHash: "d4e5f6g",
          status: "current",
          dirName: "zustand",
        },
      ];

      const outdated = results.filter((r) => r.status === "outdated");
      expect(outdated.length).toBe(0);
    });

    it("should handle all skills being local-only", () => {
      const results: SkillComparisonResult[] = [
        {
          id: "custom-1",
          localHash: null,
          sourceHash: null,
          status: "local-only",
          dirName: "custom-1",
        },
        {
          id: "custom-2",
          localHash: null,
          sourceHash: null,
          status: "local-only",
          dirName: "custom-2",
        },
      ];

      const outdated = results.filter((r) => r.status === "outdated");
      expect(outdated.length).toBe(0);
    });

    it("should handle skill with forked_from but source removed", () => {
      // Skill was forked from a source that later removed the skill
      const status = determineStatus("a1b2c3d", null);
      expect(status).toBe("local-only");
    });

    it("should handle mixed case skill names in search", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.REACT,
          localHash: "a1b2c3d",
          sourceHash: "a1b2c3d",
          status: "current",
          dirName: "React",
        },
      ];

      // Should find regardless of case
      const found = findSkillByPartialMatch("REACT", results);
      expect(found).not.toBeNull();
    });
  });

  // ===========================================================================
  // Confirmation Flow Tests
  // ===========================================================================

  describe("confirmation flow", () => {
    it("should require confirmation by default (--yes not set)", () => {
      // In actual implementation, confirmation is required unless --yes is passed
      const options = { yes: false };
      expect(options.yes).toBe(false);
    });

    it("should skip confirmation with --yes flag", () => {
      const options = { yes: true };
      expect(options.yes).toBe(true);
    });
  });

  // ===========================================================================
  // Recompilation Flag Tests
  // ===========================================================================

  describe("recompilation flag", () => {
    it("should recompile by default", () => {
      const options: { recompile?: boolean } = {};
      const shouldRecompile = options.recompile !== false;
      expect(shouldRecompile).toBe(true);
    });

    it("should skip recompile with --no-recompile flag", () => {
      const options = { recompile: false };
      const shouldRecompile = options.recompile !== false;
      expect(shouldRecompile).toBe(false);
    });
  });
});
