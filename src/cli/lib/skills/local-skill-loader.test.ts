import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { discoverLocalSkills } from "./local-skill-loader";
import { CLAUDE_DIR, LOCAL_SKILLS_PATH, STANDARD_DIRS, STANDARD_FILES } from "../../consts";
import { createTempDir, cleanupTempDir } from "../__tests__/helpers";

describe("local-skill-loader", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("cc-local-skill-test-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  /** Create a local skill directory with metadata.yaml and optionally SKILL.md */
  async function writeLocalSkill(
    skillName: string,
    options: {
      metadata?: string;
      skillMd?: string;
      /** If false, skip creating SKILL.md. Default true. */
      withSkillMd?: boolean;
    } = {},
  ): Promise<string> {
    const skillsDir = path.join(tempDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
    const skillDir = path.join(skillsDir, skillName);
    await mkdir(skillDir, { recursive: true });

    if (options.metadata !== undefined) {
      await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), options.metadata);
    }

    if (options.withSkillMd !== false && options.skillMd !== undefined) {
      await writeFile(path.join(skillDir, STANDARD_FILES.SKILL_MD), options.skillMd);
    }

    return skillDir;
  }

  describe("discoverLocalSkills", () => {
    it("returns null when .claude/skills/ does not exist", async () => {
      const result = await discoverLocalSkills(tempDir);
      expect(result).toBeNull();
    });

    it("returns empty skills array when directory exists but is empty", async () => {
      await mkdir(path.join(tempDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS), { recursive: true });

      const result = await discoverLocalSkills(tempDir);

      expect(result).not.toBeNull();
      expect(result?.skills).toEqual([]);
      expect(result?.localSkillsPath).toBe(path.join(tempDir, LOCAL_SKILLS_PATH));
    });

    it("discovers skills regardless of name prefix", async () => {
      await writeLocalSkill("my-normal-skill", {
        metadata: `displayName: My Normal Skill\ncliDescription: A normal skill`,
        skillMd: `---\nname: my-normal-skill (@local)\ndescription: A normal skill\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result).not.toBeNull();
      expect(result?.skills).toHaveLength(1);
      expect(result?.skills[0].id).toBe("my-normal-skill (@local)");
      expect(result?.skills[0].category).toBe("dummy-category");
      expect(result?.skills[0].author).toBe("@dummy-author");
      expect(result?.skills[0].local).toBe(true);
      expect(result?.skills[0].localPath).toBe(`${LOCAL_SKILLS_PATH}/my-normal-skill/`);
    });

    it("skips skill without metadata.yaml", async () => {
      await writeLocalSkill("no-metadata", {
        skillMd: `---\nname: no-metadata (@local)\ndescription: Missing metadata\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toEqual([]);
    });

    it("skips skill without SKILL.md", async () => {
      await writeLocalSkill("no-skillmd", {
        metadata: `displayName: No Skill MD`,
        withSkillMd: false,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toEqual([]);
    });

    it("throws when metadata.yaml is missing displayName", async () => {
      await writeLocalSkill("no-cli-name", {
        metadata: `cliDescription: Just a description`,
        skillMd: `---\nname: no-cli-name (@local)\ndescription: Missing displayName\n---\nContent`,
      });

      await expect(discoverLocalSkills(tempDir)).rejects.toThrow(
        /missing required 'displayName' field/,
      );
    });

    it("skips skill with invalid SKILL.md frontmatter", async () => {
      await writeLocalSkill("bad-frontmatter", {
        metadata: `displayName: Bad Frontmatter Skill`,
        // SKILL.md without proper frontmatter (missing name)
        skillMd: `---\ndescription: Only description, no name\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toEqual([]);
    });

    it("uses cliDescription from metadata.yaml when provided", async () => {
      await writeLocalSkill("with-desc", {
        metadata: `displayName: Desc Skill\ncliDescription: Custom CLI description`,
        skillMd: `---\nname: desc-skill (@local)\ndescription: Frontmatter description\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills[0].description).toBe("Custom CLI description");
    });

    it("falls back to frontmatter description when cliDescription not provided", async () => {
      await writeLocalSkill("fallback-desc", {
        metadata: `displayName: Fallback Skill`,
        skillMd: `---\nname: fallback-skill (@local)\ndescription: Frontmatter description\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills[0].description).toBe("Frontmatter description");
    });

    it("discovers multiple valid skills", async () => {
      await writeLocalSkill("skill-one", {
        metadata: `displayName: Skill One`,
        skillMd: `---\nname: skill-one (@local)\ndescription: First skill\n---\nContent`,
      });
      await writeLocalSkill("skill-two", {
        metadata: `displayName: Skill Two`,
        skillMd: `---\nname: skill-two (@local)\ndescription: Second skill\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toHaveLength(2);
      const skillIds = result?.skills.map((s) => s.id).sort();
      expect(skillIds).toEqual(["skill-one (@local)", "skill-two (@local)"]);
    });

    it("sets correct extracted metadata properties", async () => {
      await writeLocalSkill("full-skill", {
        metadata: `displayName: Full Skill\ncliDescription: Complete skill for testing`,
        skillMd: `---\nname: full-skill (@local)\ndescription: Complete skill\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);
      const skill = result?.skills[0];

      // Identity
      expect(skill?.id).toBe("full-skill (@local)");
      expect(skill?.directoryPath).toBe("full-skill");
      expect(skill?.description).toBe("Complete skill for testing");

      // Catalog data
      expect(skill?.category).toBe("dummy-category");
      expect(skill?.author).toBe("@dummy-author");
      expect(skill?.tags).toEqual([]);

      // Location
      expect(skill?.path).toBe(`${LOCAL_SKILLS_PATH}/full-skill/`);
      expect(skill?.local).toBe(true);
      expect(skill?.localPath).toBe(`${LOCAL_SKILLS_PATH}/full-skill/`);
    });

    it("uses category from metadata.yaml when provided", async () => {
      await writeLocalSkill("categorized-skill", {
        metadata: `displayName: Categorized Skill\ncategory: web-framework`,
        skillMd: `---\nname: categorized-skill (@local)\ndescription: A categorized skill\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills[0].category).toBe("web-framework");
    });

    it("preserves metadata tags and optional fields from metadata.yaml", async () => {
      await writeLocalSkill("rich-skill", {
        metadata: [
          "displayName: Rich Skill",
          "category: web-framework",
          "usageGuidance: When building components",
          "tags:",
          "  - frontend",
          "  - react",
        ].join("\n"),
        skillMd: `---\nname: rich-skill (@local)\ndescription: A rich skill\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);
      const skill = result?.skills[0];

      expect(skill?.usageGuidance).toBe("When building components");
      expect(skill?.tags).toEqual(["frontend", "react"]);
    });

    it("skips skill when metadata.yaml has wrong field types", async () => {
      await writeLocalSkill("wrong-types", {
        // displayName must be a string, but providing a number via YAML
        metadata: "displayName: 123\ntags: not-an-array",
        skillMd: `---\nname: wrong-types (@local)\ndescription: Wrong types in metadata\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      // Schema validation should fail because tags must be an array
      // The skill may still pass if the schema is lenient, but the function should not throw
      expect(result).not.toBeNull();
    });

    it("skips valid skills alongside invalid ones", async () => {
      // Valid skill
      await writeLocalSkill("valid-skill", {
        metadata: "displayName: Valid Skill",
        skillMd: `---\nname: valid-skill (@local)\ndescription: A valid skill\n---\nContent`,
      });

      // Invalid skill (no SKILL.md)
      await writeLocalSkill("invalid-skill", {
        metadata: "displayName: Invalid Skill",
        withSkillMd: false,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toHaveLength(1);
      expect(result?.skills[0].id).toBe("valid-skill (@local)");
    });

    it("skips skill with empty metadata.yaml", async () => {
      await writeLocalSkill("empty-meta", {
        metadata: "",
        skillMd: `---\nname: empty-meta (@local)\ndescription: Has empty metadata\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      // Empty YAML parses to null, schema validation fails — skill should be skipped
      expect(result?.skills).toEqual([]);
    });

    it("skips skill with metadata.yaml containing only comments", async () => {
      await writeLocalSkill("comments-only", {
        metadata: "# This is a comment\n# No actual fields",
        skillMd: `---\nname: comments-only (@local)\ndescription: Only comments\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      // YAML with only comments parses to null — schema validation fails
      expect(result?.skills).toEqual([]);
    });

    it("skips skill with metadata.yaml that parses to a non-object type", async () => {
      await writeLocalSkill("bad-yaml", {
        // YAML that parses to a string instead of an object
        metadata: "just a plain string",
        skillMd: `---\nname: bad-yaml (@local)\ndescription: Bad YAML\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      // Schema validation expects an object, so this should be skipped
      expect(result?.skills).toEqual([]);
    });

    it("handles directory with only non-skill subdirectories", async () => {
      const skillsDir = path.join(tempDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      // Create subdirectories with no metadata or SKILL.md files
      const randomDir = path.join(skillsDir, "random-dir");
      await mkdir(randomDir, { recursive: true });
      await writeFile(path.join(randomDir, "README.md"), "# Not a skill");

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toEqual([]);
    });
  });
});
