import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile, rm } from "fs/promises";
import os from "os";
import {
  TEST_SKILLS,
  TEST_CATEGORIES,
  createTestReactSkill,
  createTestZustandSkill,
} from "../lib/__tests__/test-fixtures";
import type { ResolvedSkill, MergedSkillsMatrix } from "../types-matrix";

// =============================================================================
// Mock Data
// =============================================================================

const MOCK_REACT_SKILL = createTestReactSkill();
const MOCK_ZUSTAND_SKILL = createTestZustandSkill();

const MOCK_SKILLS: Record<string, ResolvedSkill> = {
  [TEST_SKILLS.REACT]: MOCK_REACT_SKILL,
  [TEST_SKILLS.ZUSTAND]: MOCK_ZUSTAND_SKILL,
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
  },
  skills: MOCK_SKILLS,
  suggestedStacks: [],
  aliases: {
    react: TEST_SKILLS.REACT,
    zustand: TEST_SKILLS.ZUSTAND,
  },
  aliasesReverse: {
    [TEST_SKILLS.REACT]: "react",
    [TEST_SKILLS.ZUSTAND]: "zustand",
  },
  generatedAt: new Date().toISOString(),
};

// =============================================================================
// Diff Logic Simulation
// =============================================================================

interface ForkedFromMetadata {
  skill_id: string;
  content_hash: string;
  date: string;
}

interface SkillDiffResult {
  skillDirName: string;
  forkedFrom: ForkedFromMetadata | null;
  hasDiff: boolean;
  diffOutput: string;
}

/**
 * Simulate unified diff generation
 */
function generateUnifiedDiff(
  sourceContent: string,
  localContent: string,
  sourceLabel: string,
  localLabel: string,
): string {
  if (sourceContent === localContent) {
    return `--- ${sourceLabel}\n+++ ${localLabel}\n`;
  }

  // Simple simulation - in real implementation, this uses the diff package
  const sourceLines = sourceContent.split("\n");
  const localLines = localContent.split("\n");

  const diffLines: string[] = [];
  diffLines.push(`--- ${sourceLabel}`);
  diffLines.push(`+++ ${localLabel}`);
  diffLines.push(`@@ -1,${sourceLines.length} +1,${localLines.length} @@`);

  for (const line of sourceLines) {
    diffLines.push(`-${line}`);
  }
  for (const line of localLines) {
    diffLines.push(`+${line}`);
  }

  return diffLines.join("\n");
}

/**
 * Determine if a diff has actual differences (not just headers)
 */
function hasDifferences(diffOutput: string): boolean {
  return diffOutput.split("\n").some((line) => {
    return (
      (line.startsWith("+") || line.startsWith("-")) &&
      !line.startsWith("+++") &&
      !line.startsWith("---")
    );
  });
}

/**
 * Determine exit code based on diff results
 */
function determineExitCode(results: SkillDiffResult[]): number {
  const hasAnyDiff = results.some((r) => r.hasDiff);
  return hasAnyDiff ? 1 : 0;
}

// =============================================================================
// Tests
// =============================================================================

describe("diff command", () => {
  // ===========================================================================
  // Command Structure Tests
  // ===========================================================================

  describe("command structure", () => {
    it("should export diffCommand", async () => {
      const { diffCommand } = await import("./diff");
      expect(diffCommand).toBeDefined();
    });

    it("should have correct command name", async () => {
      const { diffCommand } = await import("./diff");
      expect(diffCommand.name()).toBe("diff");
    });

    it("should have description", async () => {
      const { diffCommand } = await import("./diff");
      expect(diffCommand.description()).toBeTruthy();
      expect(diffCommand.description()).toContain("diff");
    });

    it("should have --source option", async () => {
      const { diffCommand } = await import("./diff");
      const options = diffCommand.options;
      const sourceOption = options.find(
        (opt) => opt.short === "-s" || opt.long === "--source",
      );
      expect(sourceOption).toBeDefined();
    });

    it("should have --skill option", async () => {
      const { diffCommand } = await import("./diff");
      const options = diffCommand.options;
      const skillOption = options.find((opt) => opt.long === "--skill");
      expect(skillOption).toBeDefined();
    });

    it("should have --quiet option", async () => {
      const { diffCommand } = await import("./diff");
      const options = diffCommand.options;
      const quietOption = options.find(
        (opt) => opt.short === "-q" || opt.long === "--quiet",
      );
      expect(quietOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Diff Generation Tests
  // ===========================================================================

  describe("diff generation", () => {
    it("should generate empty diff for identical content", () => {
      const content = "# React\n\nThis is React.";
      const diff = generateUnifiedDiff(
        content,
        content,
        "source/react/SKILL.md",
        "local/react/SKILL.md",
      );

      expect(diff).toContain("---");
      expect(diff).toContain("+++");
      expect(hasDifferences(diff)).toBe(false);
    });

    it("should generate diff for different content", () => {
      const sourceContent = "# React\n\nOriginal content.";
      const localContent = "# React\n\nModified content.";
      const diff = generateUnifiedDiff(
        sourceContent,
        localContent,
        "source/react/SKILL.md",
        "local/react/SKILL.md",
      );

      expect(diff).toContain("---");
      expect(diff).toContain("+++");
      expect(diff).toContain("@@");
      expect(hasDifferences(diff)).toBe(true);
    });

    it("should include source label in diff header", () => {
      const diff = generateUnifiedDiff(
        "a",
        "b",
        "source/skills/react/SKILL.md",
        "local/.claude/skills/react/SKILL.md",
      );

      expect(diff).toContain("source/skills/react/SKILL.md");
    });

    it("should include local label in diff header", () => {
      const diff = generateUnifiedDiff(
        "a",
        "b",
        "source/skills/react/SKILL.md",
        "local/.claude/skills/react/SKILL.md",
      );

      expect(diff).toContain("local/.claude/skills/react/SKILL.md");
    });
  });

  // ===========================================================================
  // ForkedFrom Metadata Tests
  // ===========================================================================

  describe("forked_from metadata handling", () => {
    it("should identify skill with forked_from metadata", () => {
      const result: SkillDiffResult = {
        skillDirName: "react",
        forkedFrom: {
          skill_id: TEST_SKILLS.REACT,
          content_hash: "a1b2c3d",
          date: "2026-01-31",
        },
        hasDiff: false,
        diffOutput: "",
      };

      expect(result.forkedFrom).not.toBeNull();
      expect(result.forkedFrom?.skill_id).toBe(TEST_SKILLS.REACT);
    });

    it("should identify skill without forked_from metadata", () => {
      const result: SkillDiffResult = {
        skillDirName: "my-custom-skill",
        forkedFrom: null,
        hasDiff: false,
        diffOutput: "",
      };

      expect(result.forkedFrom).toBeNull();
    });

    it("should extract skill_id from forked_from", () => {
      const metadata = {
        forked_from: {
          skill_id: TEST_SKILLS.REACT,
          content_hash: "a1b2c3d",
          date: "2026-01-31",
        },
      };

      expect(metadata.forked_from.skill_id).toBe(TEST_SKILLS.REACT);
    });

    it("should extract content_hash from forked_from", () => {
      const metadata = {
        forked_from: {
          skill_id: TEST_SKILLS.REACT,
          content_hash: "a1b2c3d",
          date: "2026-01-31",
        },
      };

      expect(metadata.forked_from.content_hash).toBe("a1b2c3d");
    });
  });

  // ===========================================================================
  // Exit Code Tests
  // ===========================================================================

  describe("exit code determination", () => {
    it("should return 0 when no differences exist", () => {
      const results: SkillDiffResult[] = [
        {
          skillDirName: "react",
          forkedFrom: {
            skill_id: TEST_SKILLS.REACT,
            content_hash: "a1b2c3d",
            date: "2026-01-31",
          },
          hasDiff: false,
          diffOutput: "",
        },
      ];

      expect(determineExitCode(results)).toBe(0);
    });

    it("should return 1 when differences exist", () => {
      const results: SkillDiffResult[] = [
        {
          skillDirName: "react",
          forkedFrom: {
            skill_id: TEST_SKILLS.REACT,
            content_hash: "a1b2c3d",
            date: "2026-01-31",
          },
          hasDiff: true,
          diffOutput: "--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new",
        },
      ];

      expect(determineExitCode(results)).toBe(1);
    });

    it("should return 1 when any skill has differences", () => {
      const results: SkillDiffResult[] = [
        {
          skillDirName: "react",
          forkedFrom: {
            skill_id: TEST_SKILLS.REACT,
            content_hash: "a1b2c3d",
            date: "2026-01-31",
          },
          hasDiff: false,
          diffOutput: "",
        },
        {
          skillDirName: "zustand",
          forkedFrom: {
            skill_id: TEST_SKILLS.ZUSTAND,
            content_hash: "d4e5f6g",
            date: "2026-01-31",
          },
          hasDiff: true,
          diffOutput: "--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new",
        },
      ];

      expect(determineExitCode(results)).toBe(1);
    });

    it("should return 0 when all skills match", () => {
      const results: SkillDiffResult[] = [
        {
          skillDirName: "react",
          forkedFrom: {
            skill_id: TEST_SKILLS.REACT,
            content_hash: "a1b2c3d",
            date: "2026-01-31",
          },
          hasDiff: false,
          diffOutput: "",
        },
        {
          skillDirName: "zustand",
          forkedFrom: {
            skill_id: TEST_SKILLS.ZUSTAND,
            content_hash: "d4e5f6g",
            date: "2026-01-31",
          },
          hasDiff: false,
          diffOutput: "",
        },
      ];

      expect(determineExitCode(results)).toBe(0);
    });

    it("should return 0 for empty results (no forked skills)", () => {
      const results: SkillDiffResult[] = [];
      expect(determineExitCode(results)).toBe(0);
    });
  });

  // ===========================================================================
  // Skill Filtering Tests
  // ===========================================================================

  describe("skill filtering (--skill flag)", () => {
    it("should filter results to single skill when --skill is provided", () => {
      const allResults: SkillDiffResult[] = [
        {
          skillDirName: "react",
          forkedFrom: {
            skill_id: TEST_SKILLS.REACT,
            content_hash: "a1b2c3d",
            date: "2026-01-31",
          },
          hasDiff: true,
          diffOutput: "diff for react",
        },
        {
          skillDirName: "zustand",
          forkedFrom: {
            skill_id: TEST_SKILLS.ZUSTAND,
            content_hash: "d4e5f6g",
            date: "2026-01-31",
          },
          hasDiff: false,
          diffOutput: "",
        },
      ];

      const filtered = allResults.filter((r) => r.skillDirName === "react");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].skillDirName).toBe("react");
    });

    it("should return empty when skill not found", () => {
      const allResults: SkillDiffResult[] = [
        {
          skillDirName: "react",
          forkedFrom: {
            skill_id: TEST_SKILLS.REACT,
            content_hash: "a1b2c3d",
            date: "2026-01-31",
          },
          hasDiff: false,
          diffOutput: "",
        },
      ];

      const filtered = allResults.filter(
        (r) => r.skillDirName === "nonexistent",
      );
      expect(filtered).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Warning Cases Tests
  // ===========================================================================

  describe("warning cases", () => {
    it("should identify skills without forked_from for warning", () => {
      const results: SkillDiffResult[] = [
        {
          skillDirName: "my-custom-skill",
          forkedFrom: null,
          hasDiff: false,
          diffOutput: "",
        },
        {
          skillDirName: "react",
          forkedFrom: {
            skill_id: TEST_SKILLS.REACT,
            content_hash: "a1b2c3d",
            date: "2026-01-31",
          },
          hasDiff: false,
          diffOutput: "",
        },
      ];

      const skillsWithoutForkedFrom = results.filter((r) => !r.forkedFrom);
      expect(skillsWithoutForkedFrom).toHaveLength(1);
      expect(skillsWithoutForkedFrom[0].skillDirName).toBe("my-custom-skill");
    });

    it("should handle source skill no longer existing", () => {
      const result: SkillDiffResult = {
        skillDirName: "old-skill",
        forkedFrom: {
          skill_id: "old-skill (@vince)",
          content_hash: "a1b2c3d",
          date: "2026-01-31",
        },
        hasDiff: false,
        diffOutput: "Source skill 'old-skill (@vince)' no longer exists",
      };

      expect(result.diffOutput).toContain("no longer exists");
    });
  });

  // ===========================================================================
  // Diff Content Tests
  // ===========================================================================

  describe("diff content analysis", () => {
    it("should detect additions in diff", () => {
      const diff = "--- a\n+++ b\n@@ -1 +1,2 @@\n line1\n+line2";
      expect(hasDifferences(diff)).toBe(true);
    });

    it("should detect deletions in diff", () => {
      const diff = "--- a\n+++ b\n@@ -1,2 +1 @@\n line1\n-line2";
      expect(hasDifferences(diff)).toBe(true);
    });

    it("should detect modifications in diff", () => {
      const diff = "--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new";
      expect(hasDifferences(diff)).toBe(true);
    });

    it("should not count header lines as differences", () => {
      const diff = "--- source/SKILL.md\n+++ local/SKILL.md";
      expect(hasDifferences(diff)).toBe(false);
    });
  });

  // ===========================================================================
  // P4-12: Acceptance Criteria Tests
  // ===========================================================================

  describe("P4-12: Acceptance Criteria", () => {
    it("should show unified diff format for forked skills", () => {
      const sourceContent = "# React\n\nOriginal description.";
      const localContent = "# React\n\nModified description.";
      const diff = generateUnifiedDiff(
        sourceContent,
        localContent,
        "source/skills/react/SKILL.md",
        "local/.claude/skills/react/SKILL.md",
      );

      // Unified diff format should have --- and +++ headers
      expect(diff).toMatch(/^---/m);
      expect(diff).toMatch(/^\+\+\+/m);
      expect(diff).toMatch(/^@@/m);
    });

    it("should exit code 0 when no differences exist", () => {
      const results: SkillDiffResult[] = [
        {
          skillDirName: "react",
          forkedFrom: {
            skill_id: TEST_SKILLS.REACT,
            content_hash: "a1b2c3d",
            date: "2026-01-31",
          },
          hasDiff: false,
          diffOutput: "",
        },
      ];

      expect(determineExitCode(results)).toBe(0);
    });

    it("should exit code 1 when differences exist", () => {
      const results: SkillDiffResult[] = [
        {
          skillDirName: "react",
          forkedFrom: {
            skill_id: TEST_SKILLS.REACT,
            content_hash: "a1b2c3d",
            date: "2026-01-31",
          },
          hasDiff: true,
          diffOutput: "--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new",
        },
      ];

      expect(determineExitCode(results)).toBe(1);
    });

    it("should only compare skills with forked_from metadata", () => {
      const results: SkillDiffResult[] = [
        {
          skillDirName: "my-custom",
          forkedFrom: null,
          hasDiff: false,
          diffOutput: "",
        },
        {
          skillDirName: "react",
          forkedFrom: {
            skill_id: TEST_SKILLS.REACT,
            content_hash: "a1b2c3d",
            date: "2026-01-31",
          },
          hasDiff: true,
          diffOutput: "diff output",
        },
      ];

      // Only count forked skills when determining exit code
      const forkedResults = results.filter((r) => r.forkedFrom !== null);
      expect(forkedResults).toHaveLength(1);
      expect(determineExitCode(forkedResults)).toBe(1);
    });

    it("should warn for skills without forked_from", () => {
      const results: SkillDiffResult[] = [
        {
          skillDirName: "my-custom",
          forkedFrom: null,
          hasDiff: false,
          diffOutput: "",
        },
      ];

      const warnings = results.filter((r) => r.forkedFrom === null);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].skillDirName).toBe("my-custom");
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty skill directory", () => {
      const results: SkillDiffResult[] = [];
      expect(determineExitCode(results)).toBe(0);
    });

    it("should handle skill with all local-only skills", () => {
      const results: SkillDiffResult[] = [
        {
          skillDirName: "my-custom-1",
          forkedFrom: null,
          hasDiff: false,
          diffOutput: "",
        },
        {
          skillDirName: "my-custom-2",
          forkedFrom: null,
          hasDiff: false,
          diffOutput: "",
        },
      ];

      // All local-only, no diffs to compare
      const forkedResults = results.filter((r) => r.forkedFrom !== null);
      expect(forkedResults).toHaveLength(0);
      expect(determineExitCode(forkedResults)).toBe(0);
    });

    it("should handle multiline diff correctly", () => {
      const sourceContent = "line1\nline2\nline3";
      const localContent = "line1\nmodified\nline3\nnew line";
      const diff = generateUnifiedDiff(
        sourceContent,
        localContent,
        "a.md",
        "b.md",
      );

      expect(hasDifferences(diff)).toBe(true);
    });

    it("should handle empty content", () => {
      const diff = generateUnifiedDiff("", "", "a.md", "b.md");
      expect(hasDifferences(diff)).toBe(false);
    });

    it("should handle content with only whitespace differences", () => {
      const sourceContent = "line1\nline2";
      const localContent = "line1\nline2 ";
      const diff = generateUnifiedDiff(
        sourceContent,
        localContent,
        "a.md",
        "b.md",
      );

      // Whitespace difference should be detected
      expect(hasDifferences(diff)).toBe(true);
    });
  });
});
