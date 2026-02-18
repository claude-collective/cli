import path from "path";
import { describe, it, expect, vi } from "vitest";
import { readFile as realReadFile } from "fs/promises";
import type { SkillsMatrixConfig } from "../../types";

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

vi.mock("../../utils/logger");

vi.mock("../loading", () => ({
  parseFrontmatter: (...args: unknown[]) => mockParseFrontmatter(...args),
}));

import { loadSkillsMatrix, extractAllSkills, mergeMatrixWithSkills } from "./matrix-loader";
import { warn } from "../../utils/logger";

// Fixture root: __tests__/fixtures/ colocated with test helpers
const FIXTURES_ROOT = path.resolve(__dirname, "../__tests__/fixtures");
const VALID_MATRIX_PATH = path.join(FIXTURES_ROOT, "matrix/valid-matrix.yaml");
const INVALID_MATRIX_PATH = path.join(FIXTURES_ROOT, "matrix/invalid-matrix.yaml");

async function loadFixture(fixturePath: string): Promise<string> {
  return realReadFile(fixturePath, "utf-8");
}

describe("matrix-loader", () => {
  describe("loadSkillsMatrix", () => {
    it("loads and validates a valid skills-matrix fixture", async () => {
      const fixtureContent = await loadFixture(VALID_MATRIX_PATH);
      mockReadFile.mockResolvedValue(fixtureContent);

      const result = await loadSkillsMatrix("/project/config/skills-matrix.yaml");

      expect(result.version).toBe("1.0.0");
      expect(result.skillAliases).toBeDefined();
      expect(result.skillAliases.react).toBe("web-framework-react");
      expect(result.relationships).toBeDefined();
      expect(result.categories.framework).toBeDefined();
    });

    it("throws on invalid YAML structure", async () => {
      const invalidContent = await loadFixture(INVALID_MATRIX_PATH);
      mockReadFile.mockResolvedValue(invalidContent);

      await expect(loadSkillsMatrix("/project/config/skills-matrix.yaml")).rejects.toThrow(
        /Invalid skills matrix/,
      );
    });

    it("throws on unparseable file", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT: file not found"));

      await expect(loadSkillsMatrix("/nonexistent/skills-matrix.yaml")).rejects.toThrow();
    });

    it("includes path in error message for invalid matrix", async () => {
      const invalidContent = await loadFixture(INVALID_MATRIX_PATH);
      mockReadFile.mockResolvedValue(invalidContent);

      await expect(loadSkillsMatrix("/custom/path/matrix.yaml")).rejects.toThrow(
        /\/custom\/path\/matrix\.yaml/,
      );
    });

    it("throws when categories contain invalid subcategory keys", async () => {
      mockReadFile.mockResolvedValue(`
version: "1.0.0"
categories:
  not-a-valid-subcategory:
    id: not-a-valid-subcategory
    displayName: Invalid
    description: Not a recognized subcategory
    exclusive: true
    required: false
    order: 0
relationships:
  conflicts: []
  discourages: []
  recommends: []
  requires: []
  alternatives: []
skillAliases: {}
`);

      await expect(loadSkillsMatrix("/project/matrix.yaml")).rejects.toThrow(
        /Invalid skills matrix/,
      );
    });

    it("throws when relationships object is missing required sub-keys", async () => {
      mockReadFile.mockResolvedValue(`
version: "1.0.0"
categories: {}
relationships:
  conflicts: []
skillAliases: {}
`);

      await expect(loadSkillsMatrix("/project/matrix.yaml")).rejects.toThrow(
        /Invalid skills matrix/,
      );
    });

    it("throws when version is missing", async () => {
      mockReadFile.mockResolvedValue(`
categories: {}
relationships:
  conflicts: []
  discourages: []
  recommends: []
  requires: []
  alternatives: []
skillAliases: {}
`);

      await expect(loadSkillsMatrix("/project/matrix.yaml")).rejects.toThrow(
        /Invalid skills matrix/,
      );
    });

    it("throws when YAML content is empty", async () => {
      mockReadFile.mockResolvedValue("");

      await expect(loadSkillsMatrix("/project/matrix.yaml")).rejects.toThrow();
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

    it("throws when cliName is missing from metadata", async () => {
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
        /missing required 'cliName' field/,
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
          return `category: web/framework\nauthor: "@test"\nversion: "1"\ncliName: valid`;
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

    it("populates relationship fields from metadata", async () => {
      mockGlob.mockResolvedValue(["web-styling-scss/metadata.yaml"]);
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes("metadata.yaml")) {
          return `
category: web/styling
author: "@test"
version: "1"
cliName: scss-modules
compatibleWith:
  - web-framework-react
conflictsWith:
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
        skillAliases: {
          react: "web-framework-react",
        } as SkillsMatrixConfig["skillAliases"],
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
        skillAliases: {
          react: "web-framework-react",
          vue: "web-framework-vue",
        } as SkillsMatrixConfig["skillAliases"],
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
        skillAliases: {} as SkillsMatrixConfig["skillAliases"],
      };

      const merged = await mergeMatrixWithSkills(matrix, []);

      expect(Object.keys(merged.skills)).toHaveLength(0);
      expect(merged.suggestedStacks).toEqual([]);
    });

    it("warns when skillAliases contains invalid entries", async () => {
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
        skillAliases: {
          react: "web-framework-react",
          "": "invalid-empty-key",
        } as SkillsMatrixConfig["skillAliases"],
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

    it("passes through unresolved conflict references as-is", async () => {
      const matrix: SkillsMatrixConfig = {
        version: "1.0.0",
        categories: {} as SkillsMatrixConfig["categories"],
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
        skillAliases: {} as SkillsMatrixConfig["skillAliases"],
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

      // Unresolved reference should be passed through as-is
      const reactSkill = merged.skills["web-framework-react"];
      expect(reactSkill).toBeDefined();
      expect(reactSkill!.conflictsWith).toEqual(
        expect.arrayContaining([expect.objectContaining({ skillId: "web-framework-nonexistent" })]),
      );
    });

    it("resolves alternative groups correctly between skills", async () => {
      const matrix: SkillsMatrixConfig = {
        version: "1.0.0",
        categories: {} as SkillsMatrixConfig["categories"],
        relationships: {
          conflicts: [],
          discourages: [],
          recommends: [],
          requires: [],
          alternatives: [
            {
              purpose: "State management",
              skills: ["web-state-zustand", "web-state-jotai"],
            },
          ],
        },
        skillAliases: {} as SkillsMatrixConfig["skillAliases"],
      };

      const skills = [
        {
          id: "web-state-zustand" as const,
          directoryPath: "web-state-zustand",
          description: "Zustand",
          usageGuidance: undefined,
          category: "web/client-state" as const,
          categoryExclusive: true,
          author: "@test",
          tags: [],
          compatibleWith: [],
          conflictsWith: [],
          requires: [],
          requiresSetup: [],
          providesSetupFor: [],
          path: "skills/web-state-zustand/",
        },
        {
          id: "web-state-jotai" as const,
          directoryPath: "web-state-jotai",
          description: "Jotai",
          usageGuidance: undefined,
          category: "web/client-state" as const,
          categoryExclusive: true,
          author: "@test",
          tags: [],
          compatibleWith: [],
          conflictsWith: [],
          requires: [],
          requiresSetup: [],
          providesSetupFor: [],
          path: "skills/web-state-jotai/",
        },
      ];

      const merged = await mergeMatrixWithSkills(matrix, skills);

      // Zustand should list Jotai as alternative and vice versa
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
      const matrix: SkillsMatrixConfig = {
        version: "1.0.0",
        categories: {} as SkillsMatrixConfig["categories"],
        relationships: {
          conflicts: [],
          discourages: [],
          recommends: [],
          requires: [
            {
              skill: "web-state-zustand",
              needs: ["web-framework-react"],
              reason: "Zustand needs React",
            },
          ],
          alternatives: [],
        },
        skillAliases: {} as SkillsMatrixConfig["skillAliases"],
      };

      const skills = [
        {
          id: "web-state-zustand" as const,
          directoryPath: "web-state-zustand",
          description: "Zustand",
          usageGuidance: undefined,
          category: "web/client-state" as const,
          categoryExclusive: true,
          author: "@test",
          tags: [],
          compatibleWith: [],
          conflictsWith: [],
          requires: [],
          requiresSetup: [],
          providesSetupFor: [],
          path: "skills/web-state-zustand/",
        },
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
  });
});
