import path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SkillsMatrixConfig } from "../../types";

// =============================================================================
// Module-level mock setup
// =============================================================================

// For extractAllSkills tests, we mock fs/loader. For loadSkillsMatrix, we
// use the real fs to load the actual config file for the happy path.
const mockReadFile = vi.fn();
const mockFileExists = vi.fn().mockResolvedValue(true);
const mockGlob = vi.fn().mockResolvedValue([]);
const mockParseFrontmatter = vi.fn();

vi.mock("../../utils/fs", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  fileExists: (...args: unknown[]) => mockFileExists(...args),
  glob: (...args: unknown[]) => mockGlob(...args),
}));

vi.mock("../../utils/logger", () => ({
  verbose: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("../loading", () => ({
  parseFrontmatter: (...args: unknown[]) => mockParseFrontmatter(...args),
}));

import { loadSkillsMatrix, extractAllSkills, mergeMatrixWithSkills } from "./matrix-loader";
import { warn } from "../../utils/logger";
import { readFile as realReadFile } from "fs/promises";

// =============================================================================
// Fixtures
// =============================================================================

/**
 * Read the actual skills-matrix.yaml from the repo.
 * This ensures the happy path test validates against real config.
 */
async function loadRealMatrixYaml(): Promise<string> {
  const matrixPath = path.resolve(__dirname, "../../../../config/skills-matrix.yaml");
  return realReadFile(matrixPath, "utf-8");
}

function createInvalidMatrixYaml(): string {
  // Missing required fields (relationships, skill_aliases)
  return `
version: "1.0.0"
categories: {}
`;
}

// =============================================================================
// Tests
// =============================================================================

describe("matrix-loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadSkillsMatrix", () => {
    it("loads and validates the real skills-matrix.yaml", async () => {
      const realContent = await loadRealMatrixYaml();
      mockReadFile.mockResolvedValue(realContent);

      const result = await loadSkillsMatrix("/project/config/skills-matrix.yaml");

      expect(result.version).toBeDefined();
      expect(result.skill_aliases).toBeDefined();
      expect(result.skill_aliases.react).toBe("web-framework-react");
      expect(result.relationships).toBeDefined();
      expect(result.categories.framework).toBeDefined();
    });

    it("throws on invalid YAML structure", async () => {
      mockReadFile.mockResolvedValue(createInvalidMatrixYaml());

      await expect(loadSkillsMatrix("/project/config/skills-matrix.yaml")).rejects.toThrow(
        /Invalid skills matrix/,
      );
    });

    it("throws on unparseable file", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT: file not found"));

      await expect(loadSkillsMatrix("/nonexistent/skills-matrix.yaml")).rejects.toThrow();
    });

    it("includes path in error message for invalid matrix", async () => {
      mockReadFile.mockResolvedValue(createInvalidMatrixYaml());

      await expect(loadSkillsMatrix("/custom/path/matrix.yaml")).rejects.toThrow(
        /\/custom\/path\/matrix\.yaml/,
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
category: web/framework
author: "@vince"
version: "1"
cli_name: react
cli_description: React framework
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
      expect(skills[0].category).toBe("web/framework");
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

    it("throws when cli_name is missing from metadata", async () => {
      mockGlob.mockResolvedValue(["no-cli/metadata.yaml"]);
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes("metadata.yaml")) {
          return `
category: web/framework
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
        /missing required 'cli_name' field/,
      );
    });

    it("skips skills with invalid SKILL.md frontmatter", async () => {
      mockGlob.mockResolvedValue(["bad-fm/metadata.yaml"]);
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes("metadata.yaml")) {
          return `
category: web/framework
author: "@test"
version: "1"
cli_name: bad-fm
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

    it("populates relationship fields from metadata", async () => {
      mockGlob.mockResolvedValue(["web-styling-scss/metadata.yaml"]);
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes("metadata.yaml")) {
          return `
category: web/styling
author: "@test"
version: "1"
cli_name: scss-modules
compatible_with:
  - web-framework-react
conflicts_with:
  - web-styling-tailwind
requires:
  - web-framework-react
`;
        }
        return `---\nname: web-styling-scss\ndescription: SCSS\n---\n# SCSS`;
      });
      mockParseFrontmatter.mockReturnValue({
        name: "web-styling-scss",
        description: "SCSS",
      });

      const skills = await extractAllSkills("/project/src/skills");

      expect(skills[0].compatibleWith).toContain("web-framework-react");
      expect(skills[0].conflictsWith).toContain("web-styling-tailwind");
      expect(skills[0].requires).toContain("web-framework-react");
    });
  });

  describe("mergeMatrixWithSkills", () => {
    it("merges matrix config with extracted skills into resolved format", async () => {
      const matrix: SkillsMatrixConfig = {
        version: "1.0.0",
        categories: {
          framework: {
            id: "framework",
            displayName: "Framework",
            description: "Web frameworks",
            exclusive: true,
            required: false,
            order: 1,
          },
        } as SkillsMatrixConfig["categories"],
        relationships: {
          conflicts: [],
          discourages: [],
          recommends: [],
          requires: [],
          alternatives: [],
        },
        skill_aliases: {
          react: "web-framework-react",
        } as SkillsMatrixConfig["skill_aliases"],
      };

      const skills = [
        {
          id: "web-framework-react" as const,
          directoryPath: "web-framework-react",
          description: "React framework",
          usageGuidance: undefined,
          category: "web/framework" as const,
          categoryExclusive: true,
          author: "@vince",
          tags: ["react"],
          compatibleWith: [],
          conflictsWith: [],
          requires: [],
          requiresSetup: [],
          providesSetupFor: [],
          path: "skills/web-framework-react/",
        },
      ];

      const merged = await mergeMatrixWithSkills(matrix, skills);

      expect(merged.version).toBe("1.0.0");
      expect(merged.skills["web-framework-react"]).toBeDefined();
      expect(merged.skills["web-framework-react"]!.id).toBe("web-framework-react");
      expect(merged.skills["web-framework-react"]!.displayName).toBe("react");
      expect(merged.displayNameToId.react).toBe("web-framework-react");
    });

    it("resolves conflict references using display name aliases", async () => {
      const matrix: SkillsMatrixConfig = {
        version: "1.0.0",
        categories: {} as SkillsMatrixConfig["categories"],
        relationships: {
          conflicts: [
            { skills: ["web-framework-react", "web-framework-vue"], reason: "Pick one framework" },
          ],
          discourages: [],
          recommends: [],
          requires: [],
          alternatives: [],
        },
        skill_aliases: {
          react: "web-framework-react",
          vue: "web-framework-vue",
        } as SkillsMatrixConfig["skill_aliases"],
      };

      const skills = [
        {
          id: "web-framework-react" as const,
          directoryPath: "web-framework-react",
          description: "React",
          usageGuidance: undefined,
          category: "web/framework" as const,
          categoryExclusive: true,
          author: "@test",
          tags: [],
          compatibleWith: [],
          conflictsWith: [],
          requires: [],
          requiresSetup: [],
          providesSetupFor: [],
          path: "skills/web-framework-react/",
        },
        {
          id: "web-framework-vue" as const,
          directoryPath: "web-framework-vue",
          description: "Vue",
          usageGuidance: undefined,
          category: "web/framework" as const,
          categoryExclusive: true,
          author: "@test",
          tags: [],
          compatibleWith: [],
          conflictsWith: [],
          requires: [],
          requiresSetup: [],
          providesSetupFor: [],
          path: "skills/web-framework-vue/",
        },
      ];

      const merged = await mergeMatrixWithSkills(matrix, skills);

      // React should have vue in its conflictsWith
      const reactSkill = merged.skills["web-framework-react"];
      expect(reactSkill).toBeDefined();
      expect(reactSkill!.conflictsWith).toEqual(
        expect.arrayContaining([expect.objectContaining({ skillId: "web-framework-vue" })]),
      );
    });

    it("handles empty skills array", async () => {
      const matrix: SkillsMatrixConfig = {
        version: "1.0.0",
        categories: {} as SkillsMatrixConfig["categories"],
        relationships: {
          conflicts: [],
          discourages: [],
          recommends: [],
          requires: [],
          alternatives: [],
        },
        skill_aliases: {} as SkillsMatrixConfig["skill_aliases"],
      };

      const merged = await mergeMatrixWithSkills(matrix, []);

      expect(Object.keys(merged.skills)).toHaveLength(0);
      expect(merged.suggestedStacks).toEqual([]);
    });

    it("warns when skill_aliases contains invalid entries", async () => {
      const matrix: SkillsMatrixConfig = {
        version: "1.0.0",
        categories: {} as SkillsMatrixConfig["categories"],
        relationships: {
          conflicts: [],
          discourages: [],
          recommends: [],
          requires: [],
          alternatives: [],
        },
        // Invalid alias: value is not a valid SkillId format
        skill_aliases: {
          react: "web-framework-react",
          "": "invalid-empty-key",
        } as SkillsMatrixConfig["skill_aliases"],
      };

      const skills = [
        {
          id: "web-framework-react" as const,
          directoryPath: "web-framework-react",
          description: "React",
          usageGuidance: undefined,
          category: "web/framework" as const,
          categoryExclusive: true,
          author: "@test",
          tags: [],
          compatibleWith: [],
          conflictsWith: [],
          requires: [],
          requiresSetup: [],
          providesSetupFor: [],
          path: "skills/web-framework-react/",
        },
      ];

      const merged = await mergeMatrixWithSkills(matrix, skills);

      // Valid alias should still work
      expect(merged.displayNames["web-framework-react"]).toBe("react");

      // The empty-key alias should trigger a warn
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill alias mapping"));
    });
  });
});
