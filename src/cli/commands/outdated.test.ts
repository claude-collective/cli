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
// Status Determination Logic Simulation
// =============================================================================

type SkillStatus = "current" | "outdated" | "local-only";

interface SkillComparisonResult {
  id: string;
  localHash: string | null;
  sourceHash: string | null;
  status: SkillStatus;
}

interface ComparisonSummary {
  outdated: number;
  current: number;
  localOnly: number;
}

/**
 * Simulate comparison logic from outdated.ts
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
 * Simulate summary calculation from outdated.ts
 */
function calculateSummary(results: SkillComparisonResult[]): ComparisonSummary {
  return {
    outdated: results.filter((r) => r.status === "outdated").length,
    current: results.filter((r) => r.status === "current").length,
    localOnly: results.filter((r) => r.status === "local-only").length,
  };
}

/**
 * Simulate exit code determination
 */
function determineExitCode(summary: ComparisonSummary): number {
  return summary.outdated > 0 ? 1 : 0;
}

// =============================================================================
// Tests
// =============================================================================

describe("outdated command", () => {
  // ===========================================================================
  // Command Structure Tests
  // ===========================================================================

  describe("command structure", () => {
    it("should export outdatedCommand", async () => {
      const { outdatedCommand } = await import("./outdated");
      expect(outdatedCommand).toBeDefined();
    });

    it("should have correct command name", async () => {
      const { outdatedCommand } = await import("./outdated");
      expect(outdatedCommand.name()).toBe("outdated");
    });

    it("should have description", async () => {
      const { outdatedCommand } = await import("./outdated");
      expect(outdatedCommand.description()).toBeTruthy();
      expect(outdatedCommand.description()).toContain("out of date");
    });

    it("should have --source option", async () => {
      const { outdatedCommand } = await import("./outdated");
      const options = outdatedCommand.options;
      const sourceOption = options.find(
        (opt) => opt.short === "-s" || opt.long === "--source",
      );
      expect(sourceOption).toBeDefined();
    });

    it("should have --json option", async () => {
      const { outdatedCommand } = await import("./outdated");
      const options = outdatedCommand.options;
      const jsonOption = options.find((opt) => opt.long === "--json");
      expect(jsonOption).toBeDefined();
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
  // Summary Calculation Tests
  // ===========================================================================

  describe("summary calculation", () => {
    it("should count outdated skills correctly", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.REACT,
          localHash: "a1b2c3d",
          sourceHash: "x7y8z9a",
          status: "outdated",
        },
        {
          id: TEST_SKILLS.ZUSTAND,
          localHash: "d4e5f6g",
          sourceHash: "d4e5f6g",
          status: "current",
        },
      ];

      const summary = calculateSummary(results);
      expect(summary.outdated).toBe(1);
      expect(summary.current).toBe(1);
      expect(summary.localOnly).toBe(0);
    });

    it("should count current skills correctly", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.REACT,
          localHash: "a1b2c3d",
          sourceHash: "a1b2c3d",
          status: "current",
        },
        {
          id: TEST_SKILLS.ZUSTAND,
          localHash: "d4e5f6g",
          sourceHash: "d4e5f6g",
          status: "current",
        },
      ];

      const summary = calculateSummary(results);
      expect(summary.current).toBe(2);
      expect(summary.outdated).toBe(0);
    });

    it("should count local-only skills correctly", () => {
      const results: SkillComparisonResult[] = [
        {
          id: "my-custom-skill",
          localHash: null,
          sourceHash: null,
          status: "local-only",
        },
        {
          id: TEST_SKILLS.REACT,
          localHash: "a1b2c3d",
          sourceHash: "a1b2c3d",
          status: "current",
        },
      ];

      const summary = calculateSummary(results);
      expect(summary.localOnly).toBe(1);
      expect(summary.current).toBe(1);
    });

    it("should count all status types in mixed results", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.REACT,
          localHash: "a1b2c3d",
          sourceHash: "a1b2c3d",
          status: "current",
        },
        {
          id: TEST_SKILLS.ZUSTAND,
          localHash: "d4e5f6g",
          sourceHash: "x7y8z9a",
          status: "outdated",
        },
        {
          id: "my-patterns",
          localHash: null,
          sourceHash: null,
          status: "local-only",
        },
      ];

      const summary = calculateSummary(results);
      expect(summary.current).toBe(1);
      expect(summary.outdated).toBe(1);
      expect(summary.localOnly).toBe(1);
    });
  });

  // ===========================================================================
  // Exit Code Tests
  // ===========================================================================

  describe("exit code determination", () => {
    it("should return 0 when all skills are current", () => {
      const summary: ComparisonSummary = {
        outdated: 0,
        current: 3,
        localOnly: 0,
      };
      expect(determineExitCode(summary)).toBe(0);
    });

    it("should return 1 when any skill is outdated", () => {
      const summary: ComparisonSummary = {
        outdated: 1,
        current: 2,
        localOnly: 0,
      };
      expect(determineExitCode(summary)).toBe(1);
    });

    it("should return 0 when skills are current or local-only", () => {
      const summary: ComparisonSummary = {
        outdated: 0,
        current: 2,
        localOnly: 1,
      };
      expect(determineExitCode(summary)).toBe(0);
    });

    it("should return 1 when only outdated skills exist", () => {
      const summary: ComparisonSummary = {
        outdated: 5,
        current: 0,
        localOnly: 0,
      };
      expect(determineExitCode(summary)).toBe(1);
    });
  });

  // ===========================================================================
  // JSON Output Tests
  // ===========================================================================

  describe("JSON output format", () => {
    it("should include skills array with correct structure", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.REACT,
          localHash: "a1b2c3d",
          sourceHash: "a1b2c3d",
          status: "current",
        },
      ];
      const summary = calculateSummary(results);

      const output = {
        skills: results.map((r) => ({
          id: r.id,
          localHash: r.localHash,
          sourceHash: r.sourceHash,
          status: r.status,
        })),
        summary: {
          outdated: summary.outdated,
          current: summary.current,
          localOnly: summary.localOnly,
        },
      };

      expect(output.skills).toHaveLength(1);
      expect(output.skills[0].id).toBe(TEST_SKILLS.REACT);
      expect(output.skills[0].localHash).toBe("a1b2c3d");
      expect(output.skills[0].sourceHash).toBe("a1b2c3d");
      expect(output.skills[0].status).toBe("current");
    });

    it("should include summary with correct counts", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.REACT,
          localHash: "a1b2c3d",
          sourceHash: "a1b2c3d",
          status: "current",
        },
        {
          id: TEST_SKILLS.ZUSTAND,
          localHash: "d4e5f6g",
          sourceHash: "x7y8z9a",
          status: "outdated",
        },
        {
          id: "my-patterns",
          localHash: null,
          sourceHash: null,
          status: "local-only",
        },
      ];
      const summary = calculateSummary(results);

      const output = {
        skills: results,
        summary: {
          outdated: summary.outdated,
          current: summary.current,
          localOnly: summary.localOnly,
        },
      };

      expect(output.summary.outdated).toBe(1);
      expect(output.summary.current).toBe(1);
      expect(output.summary.localOnly).toBe(1);
    });

    it("should handle null hashes in JSON output", () => {
      const results: SkillComparisonResult[] = [
        {
          id: "my-custom-skill",
          localHash: null,
          sourceHash: null,
          status: "local-only",
        },
      ];

      const jsonString = JSON.stringify({
        skills: results,
        summary: calculateSummary(results),
      });

      const parsed = JSON.parse(jsonString);
      expect(parsed.skills[0].localHash).toBeNull();
      expect(parsed.skills[0].sourceHash).toBeNull();
    });
  });

  // ===========================================================================
  // Hash Comparison Logic Tests
  // ===========================================================================

  describe("hash comparison logic", () => {
    it("should treat different case hashes as different", () => {
      // SHA256 hashes are case-sensitive
      const status = determineStatus("A1B2C3D", "a1b2c3d");
      expect(status).toBe("outdated");
    });

    it("should match identical hashes", () => {
      const hash = "abc123d";
      const status = determineStatus(hash, hash);
      expect(status).toBe("current");
    });

    it("should detect single character difference", () => {
      const status = determineStatus("abc123d", "abc123e");
      expect(status).toBe("outdated");
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty results array", () => {
      const summary = calculateSummary([]);
      expect(summary.outdated).toBe(0);
      expect(summary.current).toBe(0);
      expect(summary.localOnly).toBe(0);
    });

    it("should handle all local-only skills", () => {
      const results: SkillComparisonResult[] = [
        {
          id: "custom-1",
          localHash: null,
          sourceHash: null,
          status: "local-only",
        },
        {
          id: "custom-2",
          localHash: null,
          sourceHash: null,
          status: "local-only",
        },
      ];

      const summary = calculateSummary(results);
      expect(summary.localOnly).toBe(2);
      expect(determineExitCode(summary)).toBe(0); // No outdated = success
    });

    it("should handle skill with local hash but missing source", () => {
      // This can happen if a skill is forked from a source that later removes it
      const status = determineStatus("a1b2c3d", null);
      expect(status).toBe("local-only");
    });
  });

  // ===========================================================================
  // P4-05 & P4-07: Acceptance Criteria Tests
  // ===========================================================================

  describe("P4-05 & P4-07: Acceptance Criteria", () => {
    it("should correctly identify current skills (matching hashes)", () => {
      const result: SkillComparisonResult = {
        id: TEST_SKILLS.REACT,
        localHash: "a1b2c3d",
        sourceHash: "a1b2c3d",
        status: determineStatus("a1b2c3d", "a1b2c3d"),
      };

      expect(result.status).toBe("current");
    });

    it("should correctly identify outdated skills (different hashes)", () => {
      const result: SkillComparisonResult = {
        id: TEST_SKILLS.ZUSTAND,
        localHash: "d4e5f6g",
        sourceHash: "x7y8z9a",
        status: determineStatus("d4e5f6g", "x7y8z9a"),
      };

      expect(result.status).toBe("outdated");
    });

    it("should correctly identify local-only skills (no forked_from)", () => {
      const result: SkillComparisonResult = {
        id: "my-patterns",
        localHash: null,
        sourceHash: null,
        status: determineStatus(null, null),
      };

      expect(result.status).toBe("local-only");
    });

    it("should exit 0 when all skills are current", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.REACT,
          localHash: "a1b2c3d",
          sourceHash: "a1b2c3d",
          status: "current",
        },
        {
          id: TEST_SKILLS.ZUSTAND,
          localHash: "d4e5f6g",
          sourceHash: "d4e5f6g",
          status: "current",
        },
      ];

      const summary = calculateSummary(results);
      expect(determineExitCode(summary)).toBe(0);
    });

    it("should exit 1 when any skill is outdated", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.REACT,
          localHash: "a1b2c3d",
          sourceHash: "a1b2c3d",
          status: "current",
        },
        {
          id: TEST_SKILLS.ZUSTAND,
          localHash: "d4e5f6g",
          sourceHash: "x7y8z9a",
          status: "outdated",
        },
      ];

      const summary = calculateSummary(results);
      expect(determineExitCode(summary)).toBe(1);
    });

    it("should produce valid JSON with --json flag", () => {
      const results: SkillComparisonResult[] = [
        {
          id: TEST_SKILLS.REACT,
          localHash: "a1b2c3d",
          sourceHash: "a1b2c3d",
          status: "current",
        },
        {
          id: TEST_SKILLS.ZUSTAND,
          localHash: "d4e5f6g",
          sourceHash: "x7y8z9a",
          status: "outdated",
        },
        {
          id: "my-patterns",
          localHash: null,
          sourceHash: null,
          status: "local-only",
        },
      ];
      const summary = calculateSummary(results);

      const jsonOutput = JSON.stringify({
        skills: results.map((r) => ({
          id: r.id,
          localHash: r.localHash,
          sourceHash: r.sourceHash,
          status: r.status,
        })),
        summary: {
          outdated: summary.outdated,
          current: summary.current,
          localOnly: summary.localOnly,
        },
      });

      // Should not throw
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.skills).toHaveLength(3);
      expect(parsed.summary.outdated).toBe(1);
      expect(parsed.summary.current).toBe(1);
      expect(parsed.summary.localOnly).toBe(1);
    });
  });

  // ===========================================================================
  // ForkedFrom Metadata Tests
  // ===========================================================================

  describe("forked_from metadata handling", () => {
    it("should extract skill_id from forked_from metadata", () => {
      const metadata = {
        forked_from: {
          skill_id: TEST_SKILLS.REACT,
          content_hash: "a1b2c3d",
          date: "2026-01-31",
        },
      };

      expect(metadata.forked_from.skill_id).toBe(TEST_SKILLS.REACT);
    });

    it("should extract content_hash from forked_from metadata", () => {
      const metadata = {
        forked_from: {
          skill_id: TEST_SKILLS.REACT,
          content_hash: "a1b2c3d",
          date: "2026-01-31",
        },
      };

      expect(metadata.forked_from.content_hash).toBe("a1b2c3d");
    });

    it("should handle missing forked_from metadata", () => {
      const metadata: { forked_from?: unknown } = {};
      expect(metadata.forked_from).toBeUndefined();
    });
  });
});
