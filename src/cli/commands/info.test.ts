import { describe, it, expect } from "vitest";
import type {
  ResolvedSkill,
  MergedSkillsMatrix,
  SkillRelation,
  SkillRequirement,
} from "../types-matrix";
import {
  TEST_SKILLS,
  TEST_AUTHOR,
  TEST_CATEGORIES,
  createTestReactSkill,
  createTestVueSkill,
  createTestZustandSkill,
  createTestHonoSkill,
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

// Create react skill with relations for testing
const MOCK_REACT_SKILL = createTestReactSkill({
  author: TEST_AUTHOR,
  conflictsWith: [
    { skillId: TEST_SKILLS.VUE, reason: "Cannot use both React and Vue" },
  ],
  recommends: [
    { skillId: TEST_SKILLS.ZUSTAND, reason: "Works great with React" },
  ],
});

const MOCK_VUE_SKILL = createTestVueSkill({ author: TEST_AUTHOR });
const MOCK_ZUSTAND_SKILL = createTestZustandSkill({
  author: TEST_AUTHOR,
  requires: [
    {
      skillIds: [TEST_SKILLS.REACT],
      needsAny: false,
      reason: "Zustand is a React state library",
    },
  ],
});
const MOCK_HONO_SKILL = createTestHonoSkill({ author: TEST_AUTHOR });

const MOCK_SKILLS: Record<string, ResolvedSkill> = {
  [TEST_SKILLS.REACT]: MOCK_REACT_SKILL,
  [TEST_SKILLS.VUE]: MOCK_VUE_SKILL,
  [TEST_SKILLS.ZUSTAND]: MOCK_ZUSTAND_SKILL,
  [TEST_SKILLS.HONO]: MOCK_HONO_SKILL,
};

const MOCK_MATRIX: MergedSkillsMatrix = {
  version: "1.0.0",
  categories: {
    [TEST_CATEGORIES.FRAMEWORK]: {
      id: TEST_CATEGORIES.FRAMEWORK,
      name: "Framework",
      description: "UI Frameworks",
      exclusive: true,
      required: true,
      order: 1,
    },
    [TEST_CATEGORIES.STATE]: {
      id: TEST_CATEGORIES.STATE,
      name: "State",
      description: "State management",
      exclusive: true,
      required: false,
      order: 2,
    },
    [TEST_CATEGORIES.BACKEND_FRAMEWORK]: {
      id: TEST_CATEGORIES.BACKEND_FRAMEWORK,
      name: "Backend Framework",
      description: "Backend Frameworks",
      exclusive: true,
      required: false,
      order: 3,
    },
  },
  skills: MOCK_SKILLS,
  suggestedStacks: [],
  aliases: {
    react: TEST_SKILLS.REACT,
    vue: TEST_SKILLS.VUE,
    zustand: TEST_SKILLS.ZUSTAND,
    hono: TEST_SKILLS.HONO,
  },
  aliasesReverse: {
    [TEST_SKILLS.REACT]: "react",
    [TEST_SKILLS.VUE]: "vue",
    [TEST_SKILLS.ZUSTAND]: "zustand",
    [TEST_SKILLS.HONO]: "hono",
  },
  generatedAt: new Date().toISOString(),
};

// =============================================================================
// Skill Lookup Logic Simulation
// =============================================================================

/**
 * Simulate skill lookup from info.ts
 * First try exact ID match, then try alias lookup
 */
function lookupSkill(
  matrix: MergedSkillsMatrix,
  query: string,
): ResolvedSkill | undefined {
  // Try exact ID match first
  let skill = matrix.skills[query];

  if (!skill) {
    // Try alias lookup
    const fullId = matrix.aliases[query];
    if (fullId) {
      skill = matrix.skills[fullId];
    }
  }

  return skill;
}

/**
 * Find similar skills for suggestions
 */
function findSuggestions(
  skills: Record<string, ResolvedSkill>,
  query: string,
  maxSuggestions = 5,
): string[] {
  const lowerQuery = query.toLowerCase();
  const matches: string[] = [];

  for (const skill of Object.values(skills)) {
    if (matches.length >= maxSuggestions) break;
    if (
      skill.id.toLowerCase().includes(lowerQuery) ||
      skill.alias?.toLowerCase().includes(lowerQuery) ||
      skill.name.toLowerCase().includes(lowerQuery)
    ) {
      matches.push(skill.id);
    }
  }

  return matches;
}

// =============================================================================
// Formatting Logic Simulation
// =============================================================================

/**
 * Format relations array
 */
function formatRelations(relations: SkillRelation[]): string {
  if (relations.length === 0) {
    return "(none)";
  }
  return relations.map((r) => r.skillId).join(", ");
}

/**
 * Format requirements array
 */
function formatRequirements(requirements: SkillRequirement[]): string {
  if (requirements.length === 0) {
    return "(none)";
  }
  return requirements
    .map((req) => {
      const prefix = req.needsAny ? "any of: " : "";
      return prefix + req.skillIds.join(", ");
    })
    .join("; ");
}

/**
 * Format tags array
 */
function formatTags(tags: string[]): string {
  if (tags.length === 0) {
    return "(none)";
  }
  return tags.join(", ");
}

/**
 * Strip frontmatter from content
 */
function stripFrontmatter(content: string): string {
  const lines = content.split("\n");
  let inFrontmatter = false;
  let frontmatterEndIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "---") {
      if (!inFrontmatter) {
        inFrontmatter = true;
      } else {
        frontmatterEndIndex = i + 1;
        break;
      }
    }
  }

  return lines.slice(frontmatterEndIndex).join("\n");
}

/**
 * Get preview lines from content
 */
function getPreviewLines(
  content: string,
  maxLines: number,
  maxLineLength = 80,
): string[] {
  const body = stripFrontmatter(content);
  const lines = body.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    if (result.length >= maxLines) break;
    if (line.trim() || result.length > 0) {
      const truncated =
        line.length > maxLineLength
          ? line.slice(0, maxLineLength - 3) + "..."
          : line;
      result.push(truncated);
    }
  }

  return result;
}

// =============================================================================
// Tests
// =============================================================================

describe("info command", () => {
  // ===========================================================================
  // Command Structure Tests
  // ===========================================================================

  describe("command structure", () => {
    it("should export infoCommand", async () => {
      const { infoCommand } = await import("./info");
      expect(infoCommand).toBeDefined();
    });

    it("should have correct command name", async () => {
      const { infoCommand } = await import("./info");
      expect(infoCommand.name()).toBe("info");
    });

    it("should have description", async () => {
      const { infoCommand } = await import("./info");
      expect(infoCommand.description()).toBeTruthy();
      expect(infoCommand.description()).toContain("information");
    });

    it("should have skill argument", async () => {
      const { infoCommand } = await import("./info");
      expect(infoCommand.registeredArguments.length).toBe(1);
      expect(infoCommand.registeredArguments[0].name()).toBe("skill");
    });

    it("should have --source option", async () => {
      const { infoCommand } = await import("./info");
      const options = infoCommand.options;
      const sourceOption = options.find(
        (opt) => opt.short === "-s" || opt.long === "--source",
      );
      expect(sourceOption).toBeDefined();
    });

    it("should have --no-preview option", async () => {
      const { infoCommand } = await import("./info");
      const options = infoCommand.options;
      const previewOption = options.find((opt) => opt.long === "--no-preview");
      expect(previewOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Skill Lookup Tests
  // ===========================================================================

  describe("skill lookup by full ID", () => {
    it("should find skill by exact full ID", () => {
      const skill = lookupSkill(MOCK_MATRIX, TEST_SKILLS.REACT);

      expect(skill).toBeDefined();
      expect(skill?.id).toBe(TEST_SKILLS.REACT);
    });

    it("should find skill with parentheses in ID", () => {
      const skill = lookupSkill(MOCK_MATRIX, TEST_SKILLS.ZUSTAND);

      expect(skill).toBeDefined();
      expect(skill?.id).toBe(TEST_SKILLS.ZUSTAND);
    });

    it("should return undefined for non-existent ID", () => {
      const skill = lookupSkill(MOCK_MATRIX, "nonexistent (@author)");

      expect(skill).toBeUndefined();
    });
  });

  describe("skill lookup by alias", () => {
    it("should find skill by alias", () => {
      const skill = lookupSkill(MOCK_MATRIX, "react");

      expect(skill).toBeDefined();
      expect(skill?.id).toBe(TEST_SKILLS.REACT);
    });

    it("should find different skills by their aliases", () => {
      const zustand = lookupSkill(MOCK_MATRIX, "zustand");
      const hono = lookupSkill(MOCK_MATRIX, "hono");

      expect(zustand?.id).toBe(TEST_SKILLS.ZUSTAND);
      expect(hono?.id).toBe(TEST_SKILLS.HONO);
    });

    it("should return undefined for non-existent alias", () => {
      const skill = lookupSkill(MOCK_MATRIX, "nonexistent");

      expect(skill).toBeUndefined();
    });

    it("should prefer exact ID match over alias", () => {
      // If somehow a skill ID matches another's alias, exact ID wins
      const skillById = lookupSkill(MOCK_MATRIX, TEST_SKILLS.REACT);

      expect(skillById?.id).toBe(TEST_SKILLS.REACT);
    });
  });

  // ===========================================================================
  // Skill Not Found Suggestions
  // ===========================================================================

  describe("skill not found suggestions", () => {
    it("should suggest skills matching partial name", () => {
      const suggestions = findSuggestions(MOCK_SKILLS, "rea");

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain(TEST_SKILLS.REACT);
    });

    it("should suggest skills matching partial alias", () => {
      const suggestions = findSuggestions(MOCK_SKILLS, "zu");

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain(TEST_SKILLS.ZUSTAND);
    });

    it("should be case-insensitive", () => {
      const suggestionsLower = findSuggestions(MOCK_SKILLS, "react");
      const suggestionsUpper = findSuggestions(MOCK_SKILLS, "REACT");

      expect(suggestionsLower).toEqual(suggestionsUpper);
    });

    it("should limit number of suggestions", () => {
      const suggestions = findSuggestions(MOCK_SKILLS, "a", 2);

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it("should return empty array when no matches", () => {
      const suggestions = findSuggestions(MOCK_SKILLS, "xyz123");

      expect(suggestions.length).toBe(0);
    });
  });

  // ===========================================================================
  // Metadata Display Tests
  // ===========================================================================

  describe("metadata fields display", () => {
    it("should have all required fields on skill", () => {
      const skill = MOCK_REACT_SKILL;

      expect(skill.id).toBe(TEST_SKILLS.REACT);
      expect(skill.alias).toBe("react");
      expect(skill.author).toBe(TEST_AUTHOR);
      expect(skill.category).toBe(TEST_CATEGORIES.FRAMEWORK);
      expect(skill.description).toBeTruthy();
      expect(skill.tags).toBeInstanceOf(Array);
    });

    it("should include conflictsWith relations", () => {
      const skill = MOCK_REACT_SKILL;

      expect(skill.conflictsWith.length).toBe(1);
      expect(skill.conflictsWith[0].skillId).toBe(TEST_SKILLS.VUE);
    });

    it("should include recommends relations", () => {
      const skill = MOCK_REACT_SKILL;

      expect(skill.recommends.length).toBe(1);
      expect(skill.recommends[0].skillId).toBe(TEST_SKILLS.ZUSTAND);
    });

    it("should include requires dependencies", () => {
      const skill = MOCK_ZUSTAND_SKILL;

      expect(skill.requires.length).toBe(1);
      expect(skill.requires[0].skillIds).toContain(TEST_SKILLS.REACT);
    });

    it("should include usageGuidance when present", () => {
      const skillWithGuidance = createMockSkill({
        usageGuidance: "Use when building React apps",
      });

      expect(skillWithGuidance.usageGuidance).toBe(
        "Use when building React apps",
      );
    });
  });

  // ===========================================================================
  // Relations Formatting Tests
  // ===========================================================================

  describe("relations formatting", () => {
    it("should format empty relations as (none)", () => {
      expect(formatRelations([])).toBe("(none)");
    });

    it("should format single relation", () => {
      const relations: SkillRelation[] = [
        { skillId: TEST_SKILLS.VUE, reason: "test" },
      ];

      expect(formatRelations(relations)).toBe(TEST_SKILLS.VUE);
    });

    it("should format multiple relations with comma", () => {
      const relations: SkillRelation[] = [
        { skillId: TEST_SKILLS.VUE, reason: "test" },
        { skillId: TEST_SKILLS.HONO, reason: "test" },
      ];

      const result = formatRelations(relations);
      expect(result).toContain(TEST_SKILLS.VUE);
      expect(result).toContain(TEST_SKILLS.HONO);
      expect(result).toContain(", ");
    });
  });

  describe("requirements formatting", () => {
    it("should format empty requirements as (none)", () => {
      expect(formatRequirements([])).toBe("(none)");
    });

    it("should format single requirement", () => {
      const reqs: SkillRequirement[] = [
        { skillIds: [TEST_SKILLS.REACT], needsAny: false, reason: "test" },
      ];

      expect(formatRequirements(reqs)).toBe(TEST_SKILLS.REACT);
    });

    it("should format needsAny requirement with prefix", () => {
      const reqs: SkillRequirement[] = [
        {
          skillIds: [TEST_SKILLS.REACT, TEST_SKILLS.VUE],
          needsAny: true,
          reason: "test",
        },
      ];

      const result = formatRequirements(reqs);
      expect(result).toContain("any of:");
      expect(result).toContain(TEST_SKILLS.REACT);
      expect(result).toContain(TEST_SKILLS.VUE);
    });

    it("should format multiple requirements with semicolon", () => {
      const reqs: SkillRequirement[] = [
        { skillIds: [TEST_SKILLS.REACT], needsAny: false, reason: "test1" },
        { skillIds: [TEST_SKILLS.HONO], needsAny: false, reason: "test2" },
      ];

      const result = formatRequirements(reqs);
      expect(result).toContain(TEST_SKILLS.REACT);
      expect(result).toContain(TEST_SKILLS.HONO);
      expect(result).toContain("; ");
    });
  });

  describe("tags formatting", () => {
    it("should format empty tags as (none)", () => {
      expect(formatTags([])).toBe("(none)");
    });

    it("should format single tag", () => {
      expect(formatTags(["react"])).toBe("react");
    });

    it("should format multiple tags with comma", () => {
      const result = formatTags(["react", "frontend", "ui"]);
      expect(result).toBe("react, frontend, ui");
    });
  });

  // ===========================================================================
  // Content Preview Tests
  // ===========================================================================

  describe("content preview extraction", () => {
    it("should strip frontmatter from content", () => {
      const content = `---
name: Test
description: A test
---

# Test Skill

This is the body.`;

      const body = stripFrontmatter(content);
      expect(body).not.toContain("name: Test");
      expect(body).toContain("# Test Skill");
      expect(body).toContain("This is the body.");
    });

    it("should handle content without frontmatter", () => {
      const content = `# Test Skill

This is the body.`;

      const body = stripFrontmatter(content);
      expect(body).toContain("# Test Skill");
    });

    it("should get first N non-empty lines", () => {
      const content = `---
name: Test
---

# Test Skill

Line 1
Line 2
Line 3
Line 4
Line 5`;

      const lines = getPreviewLines(content, 3);
      expect(lines.length).toBe(3);
      expect(lines[0]).toBe("# Test Skill");
    });

    it("should truncate long lines", () => {
      const longLine = "A".repeat(100);
      const content = `---
name: Test
---

${longLine}`;

      const lines = getPreviewLines(content, 1);
      expect(lines[0].length).toBe(80);
      expect(lines[0]).toContain("...");
    });

    it("should preserve blank lines after content starts", () => {
      const content = `---
name: Test
---

# Header

Paragraph after blank.`;

      const lines = getPreviewLines(content, 5);
      expect(lines).toContain("");
    });

    it("should skip leading blank lines before content", () => {
      const content = `---
name: Test
---



# Header`;

      const lines = getPreviewLines(content, 1);
      expect(lines[0]).toBe("# Header");
    });
  });

  // ===========================================================================
  // Local Installation Status Tests
  // ===========================================================================

  describe("local installation status", () => {
    it("should identify installed skill when ID matches local skills", () => {
      const localSkillIds: string[] = [TEST_SKILLS.REACT, TEST_SKILLS.ZUSTAND];
      const skill = MOCK_REACT_SKILL;

      const isInstalled = localSkillIds.includes(skill.id);
      expect(isInstalled).toBe(true);
    });

    it("should identify not installed skill when ID not in local skills", () => {
      const localSkillIds: string[] = [TEST_SKILLS.ZUSTAND];
      const skill = MOCK_REACT_SKILL;

      const isInstalled = localSkillIds.includes(skill.id);
      expect(isInstalled).toBe(false);
    });

    it("should handle empty local skills list", () => {
      const localSkillIds: string[] = [];
      const skill = MOCK_REACT_SKILL;

      const isInstalled = localSkillIds.includes(skill.id);
      expect(isInstalled).toBe(false);
    });
  });

  // ===========================================================================
  // P4-04: Info Shows Skill Metadata and Dependencies
  // ===========================================================================

  describe("P4-04: Info shows skill metadata and deps", () => {
    it("should show skill name and ID", () => {
      const skill = lookupSkill(MOCK_MATRIX, "react");

      expect(skill).toBeDefined();
      expect(skill?.name).toBe("React");
      expect(skill?.id).toBe(TEST_SKILLS.REACT);
    });

    it("should show skill alias when available", () => {
      const skill = lookupSkill(MOCK_MATRIX, "react");

      expect(skill?.alias).toBe("react");
    });

    it("should show skill author", () => {
      const skill = lookupSkill(MOCK_MATRIX, "react");

      expect(skill?.author).toBe(TEST_AUTHOR);
    });

    it("should show skill category", () => {
      const skill = lookupSkill(MOCK_MATRIX, "react");

      expect(skill?.category).toBe(TEST_CATEGORIES.FRAMEWORK);
    });

    it("should show skill description", () => {
      const skill = lookupSkill(MOCK_MATRIX, "react");

      expect(skill?.description).toBe(
        "React framework for building user interfaces",
      );
    });

    it("should show skill tags", () => {
      const skill = lookupSkill(MOCK_MATRIX, "react");

      expect(skill?.tags).toContain("react");
      expect(skill?.tags).toContain("frontend");
    });

    it("should show conflicts with other skills", () => {
      const skill = lookupSkill(MOCK_MATRIX, "react");

      expect(skill?.conflictsWith.length).toBe(1);
      expect(skill?.conflictsWith[0].skillId).toBe(TEST_SKILLS.VUE);
    });

    it("should show recommended skills", () => {
      const skill = lookupSkill(MOCK_MATRIX, "react");

      expect(skill?.recommends.length).toBe(1);
      expect(skill?.recommends[0].skillId).toBe(TEST_SKILLS.ZUSTAND);
    });

    it("should show required dependencies", () => {
      const skill = lookupSkill(MOCK_MATRIX, "zustand");

      expect(skill?.requires.length).toBe(1);
      expect(skill?.requires[0].skillIds).toContain(TEST_SKILLS.REACT);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle skills without alias", () => {
      const skillNoAlias = createMockSkill({
        id: "no-alias-skill (@author)",
        alias: undefined,
      });

      expect(skillNoAlias.alias).toBeUndefined();
    });

    it("should handle skills without usageGuidance", () => {
      const skill = MOCK_REACT_SKILL;

      expect(skill.usageGuidance).toBeUndefined();
    });

    it("should handle skills with empty relations", () => {
      const skill = MOCK_VUE_SKILL;

      expect(skill.conflictsWith.length).toBe(0);
      expect(skill.recommends.length).toBe(0);
      expect(skill.requires.length).toBe(0);
    });

    it("should handle query with special characters", () => {
      const skill = lookupSkill(MOCK_MATRIX, `react (${TEST_AUTHOR})`);

      expect(skill).toBeDefined();
      expect(skill?.id).toBe(TEST_SKILLS.REACT);
    });

    it("should handle empty matrix gracefully", () => {
      const emptyMatrix: MergedSkillsMatrix = {
        ...MOCK_MATRIX,
        skills: {},
        aliases: {},
      };

      const skill = lookupSkill(emptyMatrix, "react");
      expect(skill).toBeUndefined();

      const suggestions = findSuggestions({}, "react");
      expect(suggestions.length).toBe(0);
    });
  });
});
