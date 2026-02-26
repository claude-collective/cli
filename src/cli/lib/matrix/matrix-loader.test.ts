import path from "path";
import { describe, it, expect, vi } from "vitest";
import { readFile as realReadFile } from "fs/promises";

import {
  createMockMatrixConfig,
  createMockExtractedSkill,
  createMockCategory,
} from "../__tests__/helpers";
import {
  FRAMEWORK_CATEGORY,
  MERGE_BASIC_MATRIX,
  REACT_EXTRACTED,
  REACT_EXTRACTED_BASIC,
  VUE_EXTRACTED_BASIC,
  CONFLICT_MATRIX,
  ALTERNATIVES_MATRIX,
  ZUSTAND_EXTRACTED,
  JOTAI_EXTRACTED,
  REQUIRES_MATRIX,
} from "../__tests__/mock-data";

// For extractAllSkills tests, we mock fs/loader. For loadSkillCategories/loadSkillRules,
// we use the real fs to load the actual config file for the happy path.
const mockReadFile = vi.fn();
const mockFileExists = vi.fn().mockResolvedValue(true);
const mockGlob = vi.fn().mockResolvedValue([]);
const mockParseFrontmatter = vi.fn();

vi.mock("../../utils/fs", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  fileExists: (...args: unknown[]) => mockFileExists(...args),
  glob: (...args: unknown[]) => mockGlob(...args),
}));

vi.mock("../../utils/logger");

vi.mock("../loading", () => ({
  parseFrontmatter: (...args: unknown[]) => mockParseFrontmatter(...args),
}));

import {
  loadSkillCategories,
  loadSkillRules,
  extractAllSkills,
  mergeMatrixWithSkills,
  synthesizeCategory,
} from "./matrix-loader";
import { warn } from "../../utils/logger";
import type { CategoryPath, Subcategory } from "../../types";

// Fixture root: __tests__/fixtures/ colocated with test helpers
const FIXTURES_ROOT = path.resolve(__dirname, "../__tests__/fixtures");
const VALID_CATEGORIES_PATH = path.join(FIXTURES_ROOT, "matrix/valid-categories.yaml");
const VALID_RULES_PATH = path.join(FIXTURES_ROOT, "matrix/valid-rules.yaml");

// ---------------------------------------------------------------------------
// Top-level test data for mergeMatrixWithSkills tests
// ---------------------------------------------------------------------------

const EMPTY_MATRIX = createMockMatrixConfig({});

const INVALID_ALIAS_MATRIX = createMockMatrixConfig(
  {},
  {
    // Boundary cast: intentionally invalid alias key to test error handling
    skillAliases: {
      react: "web-framework-react",
      "": "invalid-empty-key",
    } as Partial<Record<string, string>>,
  },
);

const UNRESOLVED_CONFLICT_MATRIX = createMockMatrixConfig(
  {},
  {
    relationships: {
      conflicts: [
        {
          skills: ["web-framework-react", "web-framework-nonexistent"],
          reason: "Conflict with missing skill",
        },
      ],
      discourages: [],
      recommends: [],
      requires: [],
      alternatives: [],
    },
  },
);

async function loadFixture(fixturePath: string): Promise<string> {
  return realReadFile(fixturePath, "utf-8");
}

describe("matrix-loader", () => {
  describe("loadSkillCategories", () => {
    it("loads and validates a valid skill-categories fixture", async () => {
      const fixtureContent = await loadFixture(VALID_CATEGORIES_PATH);
      mockReadFile.mockResolvedValue(fixtureContent);

      const categories = await loadSkillCategories("/project/config/skill-categories.yaml");

      expect(categories["web-framework"]).toBeDefined();
      expect(categories["web-framework"]!.displayName).toBe("Framework");
      expect(categories["web-framework"]!.exclusive).toBe(true);
      expect(categories["web-framework"]!.required).toBe(true);
      expect(categories["web-styling"]).toBeDefined();
      expect(categories["api-api"]).toBeDefined();
    });

    it("throws on missing file", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT: file not found"));

      await expect(loadSkillCategories("/nonexistent/skill-categories.yaml")).rejects.toThrow();
    });

    it("throws on invalid schema (missing version)", async () => {
      mockReadFile.mockResolvedValue(`
categories:
  web-framework:
    id: web-framework
    displayName: Framework
    description: Core UI framework
    exclusive: true
    required: true
    order: 1
`);

      await expect(loadSkillCategories("/project/skill-categories.yaml")).rejects.toThrow(
        /Invalid skill categories/,
      );
    });

    it("throws on invalid category definition", async () => {
      mockReadFile.mockResolvedValue(`
version: "1.0.0"
categories:
  web-framework:
    id: web-framework
    displayName: Framework
`);

      await expect(loadSkillCategories("/project/skill-categories.yaml")).rejects.toThrow(
        /Invalid skill categories/,
      );
    });

    it("includes path in error message", async () => {
      mockReadFile.mockResolvedValue(`
version: "1.0.0"
categories:
  not-a-valid-subcategory:
    id: not-a-valid-subcategory
    displayName: Invalid
    description: Invalid category
    exclusive: true
    required: false
    order: 0
`);

      await expect(loadSkillCategories("/custom/path/categories.yaml")).rejects.toThrow(
        /\/custom\/path\/categories\.yaml/,
      );
    });

    it("throws when YAML content is empty", async () => {
      mockReadFile.mockResolvedValue("");

      await expect(loadSkillCategories("/project/categories.yaml")).rejects.toThrow();
    });
  });

  describe("loadSkillRules", () => {
    it("loads and validates a valid skill-rules fixture", async () => {
      const fixtureContent = await loadFixture(VALID_RULES_PATH);
      mockReadFile.mockResolvedValue(fixtureContent);

      const result = await loadSkillRules("/project/config/skill-rules.yaml");

      expect(result.version).toBe("1.0.0");
      expect(result.aliases).toBeDefined();
      expect(result.aliases.react).toBe("web-framework-react");
      expect(result.aliases.vue).toBe("web-framework-vue-composition-api");
      expect(result.aliases.zustand).toBe("web-state-zustand");
      expect(result.relationships).toBeDefined();
      expect(result.relationships.conflicts).toHaveLength(1);
      expect(result.relationships.recommends).toHaveLength(1);
      expect(result.relationships.requires).toHaveLength(1);
      expect(result.relationships.alternatives).toHaveLength(1);
      expect(result.relationships.discourages).toHaveLength(1);
      expect(result.perSkill).toBeDefined();
      expect(result.perSkill.react).toEqual({
        compatibleWith: ["web-state-zustand"],
        conflictsWith: ["web-framework-vue-composition-api"],
      });
      expect(result.perSkill.zustand).toEqual({
        compatibleWith: ["web-framework-react", "web-server-state-react-query"],
      });
    });

    it("throws on missing file", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT: file not found"));

      await expect(loadSkillRules("/nonexistent/skill-rules.yaml")).rejects.toThrow();
    });

    it("throws on invalid schema (missing version)", async () => {
      mockReadFile.mockResolvedValue(`
aliases:
  react: "web-framework-react"
relationships:
  conflicts: []
  discourages: []
  recommends: []
  requires: []
  alternatives: []
`);

      await expect(loadSkillRules("/project/skill-rules.yaml")).rejects.toThrow(
        /Invalid skill rules/,
      );
    });

    it("parses valid aliases without error", async () => {
      mockReadFile.mockResolvedValue(`
version: "1.0.0"
aliases:
  react: "web-framework-react"
  vue: "web-framework-vue-composition-api"
`);

      const result = await loadSkillRules("/project/skill-rules.yaml");

      expect(result.aliases.react).toBe("web-framework-react");
      expect(result.aliases.vue).toBe("web-framework-vue-composition-api");
    });

    it("returns default empty arrays when relationships, aliases, and per-skill are missing", async () => {
      mockReadFile.mockResolvedValue(`
version: "1.0.0"
`);

      const result = await loadSkillRules("/project/skill-rules.yaml");

      expect(result.aliases).toEqual({});
      expect(result.relationships.conflicts).toEqual([]);
      expect(result.relationships.discourages).toEqual([]);
      expect(result.relationships.recommends).toEqual([]);
      expect(result.relationships.requires).toEqual([]);
      expect(result.relationships.alternatives).toEqual([]);
      expect(result.perSkill).toEqual({});
    });

    it("includes path in error message", async () => {
      mockReadFile.mockResolvedValue(`
aliases:
  react: "web-framework-react"
`);

      await expect(loadSkillRules("/custom/path/rules.yaml")).rejects.toThrow(
        /\/custom\/path\/rules\.yaml/,
      );
    });
  });

  describe("extractAllSkills", () => {
    it("extracts skills from metadata.yaml files with valid SKILL.md", async () => {
      mockGlob.mockResolvedValue(["web-framework-react/metadata.yaml"]);
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes("metadata.yaml")) {
          return `
category: web-framework
author: "@vince"
version: "1"
cliName: react
cliDescription: React framework
`;
        }
        // SKILL.md content
        return `---
name: web-framework-react
description: React framework
---
# React`;
      });
      mockParseFrontmatter.mockReturnValue({
        name: "web-framework-react",
        description: "React framework",
      });

      const skills = await extractAllSkills("/project/src/skills");

      expect(skills).toHaveLength(1);
      expect(skills[0].id).toBe("web-framework-react");
      expect(skills[0].category).toBe("web-framework");
      expect(skills[0].author).toBe("@vince");
    });

    it("skips skills without SKILL.md", async () => {
      mockGlob.mockResolvedValue(["orphan-skill/metadata.yaml"]);
      mockFileExists.mockResolvedValue(false);

      const skills = await extractAllSkills("/project/src/skills");

      expect(skills).toHaveLength(0);
    });

    it("skips skills with invalid metadata.yaml", async () => {
      mockGlob.mockResolvedValue(["bad-skill/metadata.yaml"]);
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes("metadata.yaml")) {
          // Missing required 'category' and 'author' fields
          return "invalid: true\n";
        }
        return `---\nname: bad-skill\ndescription: test\n---\n# Bad`;
      });

      const skills = await extractAllSkills("/project/src/skills");

      expect(skills).toHaveLength(0);
    });

    it("throws when cliName is missing from metadata", async () => {
      mockGlob.mockResolvedValue(["no-cli/metadata.yaml"]);
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes("metadata.yaml")) {
          return `
category: web-framework
author: "@test"
version: "1"
`;
        }
        return `---\nname: web-no-cli\ndescription: test\n---\n# Test`;
      });
      mockParseFrontmatter.mockReturnValue({
        name: "web-no-cli",
        description: "test",
      });

      await expect(extractAllSkills("/project/src/skills")).rejects.toThrow(
        /missing required 'cliName' field/,
      );
    });

    it("skips skills with invalid SKILL.md frontmatter", async () => {
      mockGlob.mockResolvedValue(["bad-fm/metadata.yaml"]);
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes("metadata.yaml")) {
          return `
category: web-framework
author: "@test"
version: "1"
cliName: bad-fm
`;
        }
        return "no frontmatter here";
      });
      mockParseFrontmatter.mockReturnValue(null);

      const skills = await extractAllSkills("/project/src/skills");

      expect(skills).toHaveLength(0);
    });

    it("returns empty array when no metadata files found", async () => {
      mockGlob.mockResolvedValue([]);

      const skills = await extractAllSkills("/project/src/skills");

      expect(skills).toHaveLength(0);
    });

    it("warns when metadata.yaml has invalid YAML syntax", async () => {
      mockGlob.mockResolvedValue(["broken-yaml/metadata.yaml"]);
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes("metadata.yaml")) {
          return "category: [unclosed bracket";
        }
        return `---\nname: broken\ndescription: test\n---\n# Broken`;
      });

      // YAML parse error should propagate (metadata readFile succeeds but YAML is malformed)
      await expect(extractAllSkills("/project/src/skills")).rejects.toThrow();
    });

    it("warns and skips when metadata.yaml has wrong field types", async () => {
      mockGlob.mockResolvedValue(["wrong-types/metadata.yaml"]);
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes("metadata.yaml")) {
          // category must be a valid CategoryPath string, not a number
          return `
category: 12345
author: true
version: "1"
cliName: wrong
`;
        }
        return `---\nname: wrong-types\ndescription: test\n---\n# Test`;
      });

      const skills = await extractAllSkills("/project/src/skills");

      expect(skills).toHaveLength(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("invalid metadata.yaml"));
    });

    it("extracts multiple skills and skips invalid ones in the same batch", async () => {
      mockGlob.mockResolvedValue([
        "skill-valid/metadata.yaml",
        "skill-no-skillmd/metadata.yaml",
        "skill-bad-meta/metadata.yaml",
      ]);
      mockFileExists.mockImplementation(async (filePath: string) => {
        // skill-no-skillmd has no SKILL.md
        return !filePath.includes("skill-no-skillmd");
      });
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes("skill-valid") && filePath.includes("metadata.yaml")) {
          return `category: web-framework\nauthor: "@test"\nversion: "1"\ncliName: valid`;
        }
        if (filePath.includes("skill-bad-meta") && filePath.includes("metadata.yaml")) {
          return "invalid: true\n";
        }
        return `---\nname: skill-valid\ndescription: Valid skill\n---\n# Test`;
      });
      mockParseFrontmatter.mockReturnValue({
        name: "skill-valid",
        description: "Valid skill",
      });

      const skills = await extractAllSkills("/project/src/skills");

      // Only the valid skill should be extracted
      expect(skills).toHaveLength(1);
      expect(skills[0].id).toBe("skill-valid");
    });
  });

  describe("mergeMatrixWithSkills", () => {
    it("merges matrix config with extracted skills into resolved format", async () => {
      const merged = await mergeMatrixWithSkills(
        MERGE_BASIC_MATRIX.categories,
        MERGE_BASIC_MATRIX.relationships,
        MERGE_BASIC_MATRIX.aliases,
        [REACT_EXTRACTED],
      );

      expect(merged.version).toBe("1.0.0");
      expect(merged.skills["web-framework-react"]).toBeDefined();
      expect(merged.skills["web-framework-react"]!.id).toBe("web-framework-react");
      expect(merged.skills["web-framework-react"]!.displayName).toBe("react");
      expect(merged.displayNameToId.react).toBe("web-framework-react");
    });

    it("resolves conflict references using display name aliases", async () => {
      const merged = await mergeMatrixWithSkills(
        CONFLICT_MATRIX.categories,
        CONFLICT_MATRIX.relationships,
        CONFLICT_MATRIX.aliases,
        [REACT_EXTRACTED_BASIC, VUE_EXTRACTED_BASIC],
      );

      const reactSkill = merged.skills["web-framework-react"];
      expect(reactSkill).toBeDefined();
      expect(reactSkill!.conflictsWith).toEqual(
        expect.arrayContaining([expect.objectContaining({ skillId: "web-framework-vue" })]),
      );
    });

    it("handles empty skills array", async () => {
      const merged = await mergeMatrixWithSkills(
        EMPTY_MATRIX.categories,
        EMPTY_MATRIX.relationships,
        EMPTY_MATRIX.aliases,
        [],
      );

      expect(Object.keys(merged.skills)).toHaveLength(0);
      expect(merged.suggestedStacks).toEqual([]);
    });

    it("warns when skillAliases contains invalid entries", async () => {
      const merged = await mergeMatrixWithSkills(
        INVALID_ALIAS_MATRIX.categories,
        INVALID_ALIAS_MATRIX.relationships,
        INVALID_ALIAS_MATRIX.aliases,
        [REACT_EXTRACTED_BASIC],
      );

      expect(merged.displayNames["web-framework-react"]).toBe("react");
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill alias mapping"));
    });

    it("passes through unresolved conflict references as-is", async () => {
      const merged = await mergeMatrixWithSkills(
        UNRESOLVED_CONFLICT_MATRIX.categories,
        UNRESOLVED_CONFLICT_MATRIX.relationships,
        UNRESOLVED_CONFLICT_MATRIX.aliases,
        [REACT_EXTRACTED_BASIC],
      );

      const reactSkill = merged.skills["web-framework-react"];
      expect(reactSkill).toBeDefined();
      expect(reactSkill!.conflictsWith).toEqual(
        expect.arrayContaining([expect.objectContaining({ skillId: "web-framework-nonexistent" })]),
      );
    });

    it("resolves alternative groups correctly between skills", async () => {
      const merged = await mergeMatrixWithSkills(
        ALTERNATIVES_MATRIX.categories,
        ALTERNATIVES_MATRIX.relationships,
        ALTERNATIVES_MATRIX.aliases,
        [ZUSTAND_EXTRACTED, JOTAI_EXTRACTED],
      );

      const zustand = merged.skills["web-state-zustand"];
      const jotai = merged.skills["web-state-jotai"];
      expect(zustand!.alternatives).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skillId: "web-state-jotai", purpose: "State management" }),
        ]),
      );
      expect(jotai!.alternatives).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skillId: "web-state-zustand", purpose: "State management" }),
        ]),
      );
    });

    it("resolves require rules correctly", async () => {
      const merged = await mergeMatrixWithSkills(
        REQUIRES_MATRIX.categories,
        REQUIRES_MATRIX.relationships,
        REQUIRES_MATRIX.aliases,
        [ZUSTAND_EXTRACTED, REACT_EXTRACTED_BASIC],
      );

      const zustand = merged.skills["web-state-zustand"];
      expect(zustand!.requires).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skillIds: expect.arrayContaining(["web-framework-react"]),
            reason: "Zustand needs React",
          }),
        ]),
      );
    });

    it("applies per-skill rules to resolved skills", async () => {
      const matrixWithAliases = createMockMatrixConfig(
        { "web-framework": FRAMEWORK_CATEGORY },
        {
          skillAliases: {
            react: "web-framework-react",
            zustand: "web-state-zustand",
          },
        },
      );

      const perSkillRules = {
        react: {
          compatibleWith: ["web-state-zustand" as const],
          conflictsWith: ["web-framework-vue-composition-api" as const],
        },
        zustand: {
          compatibleWith: ["web-framework-react" as const, "web-server-state-react-query" as const],
          requires: ["web-framework-react" as const],
        },
      };

      const merged = await mergeMatrixWithSkills(
        matrixWithAliases.categories,
        matrixWithAliases.relationships,
        matrixWithAliases.aliases,
        [REACT_EXTRACTED_BASIC, ZUSTAND_EXTRACTED],
        perSkillRules,
      );

      const react = merged.skills["web-framework-react"];
      expect(react).toBeDefined();
      expect(react!.compatibleWith).toContain("web-state-zustand");
      expect(react!.conflictsWith).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skillId: "web-framework-vue-composition-api" }),
        ]),
      );
      expect(react!.recommends).toEqual(
        expect.arrayContaining([expect.objectContaining({ skillId: "web-state-zustand" })]),
      );

      const zustand = merged.skills["web-state-zustand"];
      expect(zustand).toBeDefined();
      expect(zustand!.compatibleWith).toContain("web-framework-react");
      expect(zustand!.compatibleWith).toContain("web-server-state-react-query");
      expect(zustand!.requires).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skillIds: expect.arrayContaining(["web-framework-react"]),
          }),
        ]),
      );
    });

    it("returns empty relationship fields when no per-skill rules exist for a skill", async () => {
      const merged = await mergeMatrixWithSkills(
        MERGE_BASIC_MATRIX.categories,
        MERGE_BASIC_MATRIX.relationships,
        MERGE_BASIC_MATRIX.aliases,
        [REACT_EXTRACTED_BASIC],
        {},
      );

      const react = merged.skills["web-framework-react"];
      expect(react).toBeDefined();
      expect(react!.compatibleWith).toEqual([]);
      expect(react!.requiresSetup).toEqual([]);
      expect(react!.providesSetupFor).toEqual([]);
    });
  });

  describe("auto-synthesis", () => {
    it("synthesizes missing categories for skills with unknown category", async () => {
      // Boundary cast: intentionally custom category not in built-in union
      const skill = createMockExtractedSkill("web-custom-tool", {
        category: "devops-iac" as CategoryPath,
      });

      const merged = await mergeMatrixWithSkills({}, EMPTY_MATRIX.relationships, {}, [skill]);

      // Boundary cast: accessing synthesized custom category key
      const synthesized = merged.categories["devops-iac" as Subcategory];
      expect(synthesized).toBeDefined();
      expect(synthesized!.displayName).toBe("Devops Iac");
      expect(synthesized!.exclusive).toBe(true);
      expect(synthesized!.required).toBe(false);
      expect(synthesized!.order).toBe(999);
      expect(synthesized!.custom).toBe(true);
    });

    it("uses skill domain field for synthesized category domain", async () => {
      // Boundary cast: intentionally custom category not in built-in union
      const skill = createMockExtractedSkill("web-custom-tool", {
        category: "devops-iac" as CategoryPath,
        domain: "api",
      });

      const merged = await mergeMatrixWithSkills({}, EMPTY_MATRIX.relationships, {}, [skill]);

      expect(merged.categories["devops-iac" as Subcategory]!.domain).toBe("api");
    });

    it("infers domain from category prefix when skill has no domain", async () => {
      const skill = createMockExtractedSkill("web-custom-tool", {
        category: "web-custom" as CategoryPath,
      });

      const merged = await mergeMatrixWithSkills({}, EMPTY_MATRIX.relationships, {}, [skill]);

      expect(merged.categories["web-custom" as Subcategory]!.domain).toBe("web");
    });

    it("synthesized category has no domain when prefix is unknown", async () => {
      // Boundary cast: intentionally custom category not in built-in union
      const skill = createMockExtractedSkill("web-custom-tool", {
        category: "devops-iac" as CategoryPath,
      });

      const merged = await mergeMatrixWithSkills({}, EMPTY_MATRIX.relationships, {}, [skill]);

      expect(merged.categories["devops-iac" as Subcategory]!.domain).toBeUndefined();
    });

    it("does not synthesize categories that already exist", async () => {
      const existingCategories = {
        "web-framework": FRAMEWORK_CATEGORY,
      };

      const merged = await mergeMatrixWithSkills(
        existingCategories,
        EMPTY_MATRIX.relationships,
        {},
        [REACT_EXTRACTED_BASIC],
      );

      expect(merged.categories["web-framework"]).toBe(FRAMEWORK_CATEGORY);
    });
  });

  describe("synthesizeCategory", () => {
    it("creates category with known domain prefix", () => {
      // Boundary cast: custom category not in built-in union
      const cat = synthesizeCategory("web-custom" as CategoryPath);
      expect(cat.domain).toBe("web");
      expect(cat.displayName).toBe("Web Custom");
      expect(cat.custom).toBe(true);
    });

    it("creates category with explicit domain override", () => {
      // Boundary cast: custom category not in built-in union
      const cat = synthesizeCategory("devops-iac" as CategoryPath, "api");
      expect(cat.domain).toBe("api");
    });

    it("creates category with undefined domain for unknown prefix", () => {
      // Boundary cast: custom category not in built-in union
      const cat = synthesizeCategory("devops-iac" as CategoryPath);
      expect(cat.domain).toBeUndefined();
    });
  });
});
