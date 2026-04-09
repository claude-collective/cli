import { describe, expect, it, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import {
  isSnakeCase,
  validateMetadataConventions,
  validateSkillFilePairs,
  validateSource,
} from "./source-validator";
import { createTempDir, cleanupTempDir } from "./__tests__/helpers";
import { STANDARD_DIRS, STANDARD_FILES } from "../consts";
import { renderSkillMd } from "./__tests__/content-generators";

describe("source-validator", () => {
  describe("isSnakeCase", () => {
    it("should return true for snake_case keys", () => {
      expect(isSnakeCase("display_name")).toBe(true);
      expect(isSnakeCase("some_key")).toBe(true);
      expect(isSnakeCase("a_b_c")).toBe(true);
    });

    it("should return false for camelCase keys", () => {
      expect(isSnakeCase("displayName")).toBe(false);
      expect(isSnakeCase("someKey")).toBe(false);
    });

    it("should return false for keys without underscores", () => {
      expect(isSnakeCase("name")).toBe(false);
      expect(isSnakeCase("slug")).toBe(false);
    });

    it("should return false for uppercase_UPPER patterns", () => {
      expect(isSnakeCase("UPPER_CASE")).toBe(false);
      expect(isSnakeCase("A_B")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isSnakeCase("")).toBe(false);
    });

    it("should return false for leading/trailing underscores without lowercase pair", () => {
      expect(isSnakeCase("_name")).toBe(false);
      expect(isSnakeCase("name_")).toBe(false);
    });
  });

  describe("validateMetadataConventions", () => {
    const VALID_METADATA = { displayName: "react", category: "web-framework" };
    const REL_PATH = "src/skills/web/framework/react/metadata.yaml";
    const DIR_NAME = "react";

    it("should return no issues for valid metadata", () => {
      const rawMetadata = { displayName: "react", category: "web-framework", slug: "react" };

      const issues = validateMetadataConventions(rawMetadata, VALID_METADATA, REL_PATH, DIR_NAME);

      expect(issues).toStrictEqual([]);
    });

    describe("snake_case key detection", () => {
      it("should report error for snake_case keys", () => {
        const rawMetadata = {
          display_name: "react",
          category: "web-framework",
        };

        const issues = validateMetadataConventions(rawMetadata, VALID_METADATA, REL_PATH, DIR_NAME);

        const snakeCaseIssues = issues.filter((i) => i.message.includes("snake_case"));
        expect(snakeCaseIssues).toHaveLength(1);
        expect(snakeCaseIssues[0]?.severity).toBe("error");
        expect(snakeCaseIssues[0]?.message).toContain("display_name");
      });

      it("should report multiple snake_case keys", () => {
        const rawMetadata = {
          display_name: "react",
          usage_guidance: "use for React",
          category: "web-framework",
        };

        const issues = validateMetadataConventions(rawMetadata, VALID_METADATA, REL_PATH, DIR_NAME);

        const snakeCaseIssues = issues.filter((i) => i.message.includes("snake_case"));
        expect(snakeCaseIssues).toHaveLength(2);
      });

      it("should not report camelCase keys", () => {
        const rawMetadata = {
          displayName: "react",
          usageGuidance: "use for React",
          category: "web-framework",
        };

        const issues = validateMetadataConventions(rawMetadata, VALID_METADATA, REL_PATH, DIR_NAME);

        const snakeCaseIssues = issues.filter((i) => i.message.includes("snake_case"));
        expect(snakeCaseIssues).toHaveLength(0);
      });

      it("should handle null rawMetadata without crashing", () => {
        const issues = validateMetadataConventions(null, VALID_METADATA, REL_PATH, DIR_NAME);

        // Should still check displayName/dir match and category
        expect(issues.every((i) => !i.message.includes("snake_case"))).toBe(true);
      });

      it("should handle array rawMetadata without crashing", () => {
        const issues = validateMetadataConventions([1, 2, 3], VALID_METADATA, REL_PATH, DIR_NAME);

        expect(issues.every((i) => !i.message.includes("snake_case"))).toBe(true);
      });
    });

    describe("displayName/directory name mismatch", () => {
      it("should warn when displayName does not match directory name", () => {
        const metadata = { displayName: "React.js", category: "web-framework" };

        const issues = validateMetadataConventions({}, metadata, REL_PATH, "react");

        const mismatchIssues = issues.filter((i) => i.message.includes("does not match directory"));
        expect(mismatchIssues).toHaveLength(1);
        expect(mismatchIssues[0]?.severity).toBe("warning");
        expect(mismatchIssues[0]?.message).toContain("React.js");
        expect(mismatchIssues[0]?.message).toContain("react");
      });

      it("should not warn when displayName matches directory name", () => {
        const metadata = { displayName: "react", category: "web-framework" };

        const issues = validateMetadataConventions({}, metadata, REL_PATH, "react");

        const mismatchIssues = issues.filter((i) => i.message.includes("does not match directory"));
        expect(mismatchIssues).toHaveLength(0);
      });
    });

    it("should set file path on all reported issues", () => {
      const rawMetadata = { display_name: "Mismatched" };
      const metadata = { displayName: "Mismatched", category: "bad-category" };

      const issues = validateMetadataConventions(rawMetadata, metadata, REL_PATH, "other-dir");

      for (const issue of issues) {
        expect(issue.file).toBe(REL_PATH);
      }
    });
  });

  describe("validateSkillFilePairs", () => {
    const SKILLS_DIR = "/source/src/skills";

    it("should return no issues when all pairs match", () => {
      const skillMdDirs = new Set(["web/framework/react", "api/database/drizzle"]);
      const metadataDirs = new Set(["web/framework/react", "api/database/drizzle"]);

      const issues = validateSkillFilePairs(skillMdDirs, metadataDirs, SKILLS_DIR);

      expect(issues).toStrictEqual([]);
    });

    it("should report error for directories with SKILL.md but no metadata.yaml", () => {
      const skillMdDirs = new Set(["web/framework/react", "web/framework/vue"]);
      const metadataDirs = new Set(["web/framework/react"]);

      const issues = validateSkillFilePairs(skillMdDirs, metadataDirs, SKILLS_DIR);

      expect(issues).toHaveLength(1);
      expect(issues[0]?.severity).toBe("error");
      expect(issues[0]?.message).toContain("Missing metadata.yaml");
      expect(issues[0]?.message).toContain("SKILL.md");
      expect(issues[0]?.file).toContain("web/framework/vue");
    });

    it("should report error for directories with metadata.yaml but no SKILL.md", () => {
      const skillMdDirs = new Set(["web/framework/react"]);
      const metadataDirs = new Set(["web/framework/react", "web/framework/vue"]);

      const issues = validateSkillFilePairs(skillMdDirs, metadataDirs, SKILLS_DIR);

      expect(issues).toHaveLength(1);
      expect(issues[0]?.severity).toBe("error");
      expect(issues[0]?.message).toContain("Missing SKILL.md");
      expect(issues[0]?.message).toContain("metadata.yaml");
      expect(issues[0]?.file).toContain("web/framework/vue");
    });

    it("should report multiple missing pairs", () => {
      const skillMdDirs = new Set(["a", "b"]);
      const metadataDirs = new Set(["c", "d"]);

      const issues = validateSkillFilePairs(skillMdDirs, metadataDirs, SKILLS_DIR);

      // a and b missing metadata.yaml, c and d missing SKILL.md
      expect(issues).toHaveLength(4);
      const missingMetadata = issues.filter((i) => i.message.includes("Missing metadata.yaml"));
      const missingSkillMd = issues.filter((i) => i.message.includes("Missing SKILL.md"));
      expect(missingMetadata).toHaveLength(2);
      expect(missingSkillMd).toHaveLength(2);
    });

    it("should return no issues for empty sets", () => {
      const skillMdDirs = new Set<string>();
      const metadataDirs = new Set<string>();

      const issues = validateSkillFilePairs(skillMdDirs, metadataDirs, SKILLS_DIR);

      expect(issues).toStrictEqual([]);
    });

    it("should construct file paths using skillsDir", () => {
      const skillMdDirs = new Set(["web/framework/react"]);
      const metadataDirs = new Set<string>();

      const issues = validateSkillFilePairs(skillMdDirs, metadataDirs, SKILLS_DIR);

      expect(issues[0]?.file).toBe("/source/src/skills/web/framework/react");
    });

    it("should handle single-entry sets correctly", () => {
      const skillMdDirs = new Set(["only-skill-md"]);
      const metadataDirs = new Set(["only-metadata"]);

      const issues = validateSkillFilePairs(skillMdDirs, metadataDirs, SKILLS_DIR);

      expect(issues).toHaveLength(2);
    });
  });

  describe("validateSource", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await createTempDir("source-validator-");
    });

    afterEach(async () => {
      await cleanupTempDir(tempDir);
    });

    it("should handle source with zero skills gracefully", async () => {
      const sourceDir = path.join(tempDir, "source");
      const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });

      const result = await validateSource(sourceDir);

      expect(result.skillCount).toBe(0);
      // Zero skills is not an error — the source simply has no skills yet
      expect(result.issues.every((i) => !i.message.includes("does not exist"))).toBe(true);
    });

    it("should report specific error for malformed YAML in metadata", async () => {
      const sourceDir = path.join(tempDir, "source");
      const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
      const skillDir = path.join(skillsDir, "web", "framework", "react");
      await mkdir(skillDir, { recursive: true });

      await writeFile(
        path.join(skillDir, STANDARD_FILES.SKILL_MD),
        renderSkillMd("web-framework-react", "React"),
      );

      // Write invalid YAML that will fail parsing
      await writeFile(
        path.join(skillDir, STANDARD_FILES.METADATA_YAML),
        "category: web-framework\n  bad-indent: [\nunmatched bracket",
      );

      const result = await validateSource(sourceDir);

      expect(result.errorCount).toBe(1);
      const yamlErrors = result.issues.filter((i) => i.message.includes("Failed to parse YAML"));
      expect(yamlErrors).toHaveLength(1);
      expect(yamlErrors[0]?.severity).toBe("error");
    });

    it("should not crash when source has skills dir but no agent directories", async () => {
      const sourceDir = path.join(tempDir, "source");
      const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });

      // Source with skills dir but no agents dir — should not crash
      const result = await validateSource(sourceDir);

      // Should complete without throwing
      expect(result).toStrictEqual(
        expect.objectContaining({
          issues: expect.any(Array),
          skillCount: expect.any(Number),
          errorCount: expect.any(Number),
          warningCount: expect.any(Number),
        }),
      );
    });
  });
});
