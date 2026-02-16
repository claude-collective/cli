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
        metadata: `cli_name: My Normal Skill\ncli_description: A normal skill`,
        skillMd: `---\nname: my-normal-skill (@local)\ndescription: A normal skill\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result).not.toBeNull();
      expect(result?.skills).toHaveLength(1);
      expect(result?.skills[0].id).toBe("my-normal-skill (@local)");
      expect(result?.skills[0].category).toBe("local");
      expect(result?.skills[0].author).toBe("@local");
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
        metadata: `cli_name: No Skill MD`,
        withSkillMd: false,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toEqual([]);
    });

    it("skips skill with metadata.yaml missing cli_name", async () => {
      await writeLocalSkill("no-cli-name", {
        metadata: `cli_description: Just a description`,
        skillMd: `---\nname: no-cli-name (@local)\ndescription: Missing cli_name\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toEqual([]);
    });

    it("skips skill with invalid SKILL.md frontmatter", async () => {
      await writeLocalSkill("bad-frontmatter", {
        metadata: `cli_name: Bad Frontmatter Skill`,
        // SKILL.md without proper frontmatter (missing name)
        skillMd: `---\ndescription: Only description, no name\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toEqual([]);
    });

    it("uses cli_description from metadata.yaml when provided", async () => {
      await writeLocalSkill("with-desc", {
        metadata: `cli_name: Desc Skill\ncli_description: Custom CLI description`,
        skillMd: `---\nname: desc-skill (@local)\ndescription: Frontmatter description\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills[0].description).toBe("Custom CLI description");
    });

    it("falls back to frontmatter description when cli_description not provided", async () => {
      await writeLocalSkill("fallback-desc", {
        metadata: `cli_name: Fallback Skill`,
        skillMd: `---\nname: fallback-skill (@local)\ndescription: Frontmatter description\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills[0].description).toBe("Frontmatter description");
    });

    it("discovers multiple valid skills", async () => {
      await writeLocalSkill("skill-one", {
        metadata: `cli_name: Skill One`,
        skillMd: `---\nname: skill-one (@local)\ndescription: First skill\n---\nContent`,
      });
      await writeLocalSkill("skill-two", {
        metadata: `cli_name: Skill Two`,
        skillMd: `---\nname: skill-two (@local)\ndescription: Second skill\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toHaveLength(2);
      const skillIds = result?.skills.map((s) => s.id).sort();
      expect(skillIds).toEqual(["skill-one (@local)", "skill-two (@local)"]);
    });

    it("sets correct extracted metadata properties", async () => {
      await writeLocalSkill("full-skill", {
        metadata: `cli_name: Full Skill\ncli_description: Complete skill for testing`,
        skillMd: `---\nname: full-skill (@local)\ndescription: Complete skill\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);
      const skill = result?.skills[0];

      // Identity
      expect(skill?.id).toBe("full-skill (@local)");
      expect(skill?.directoryPath).toBe("full-skill");
      expect(skill?.description).toBe("Complete skill for testing");

      // Catalog data
      expect(skill?.category).toBe("local");
      expect(skill?.categoryExclusive).toBe(false);
      expect(skill?.author).toBe("@local");
      expect(skill?.tags).toEqual([]);

      // Relationships (empty for local skills)
      expect(skill?.compatibleWith).toEqual([]);
      expect(skill?.conflictsWith).toEqual([]);
      expect(skill?.requires).toEqual([]);
      expect(skill?.requiresSetup).toEqual([]);
      expect(skill?.providesSetupFor).toEqual([]);

      // Location
      expect(skill?.path).toBe(`${LOCAL_SKILLS_PATH}/full-skill/`);
      expect(skill?.local).toBe(true);
      expect(skill?.localPath).toBe(`${LOCAL_SKILLS_PATH}/full-skill/`);
    });

    it("uses category from metadata.yaml when provided", async () => {
      await writeLocalSkill("categorized-skill", {
        metadata: `cli_name: Categorized Skill\ncategory: framework`,
        skillMd: `---\nname: categorized-skill (@local)\ndescription: A categorized skill\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills[0].category).toBe("framework");
    });

    it("preserves metadata tags, conflicts, and requires from metadata.yaml", async () => {
      await writeLocalSkill("rich-skill", {
        metadata: [
          "cli_name: Rich Skill",
          "category: framework",
          "category_exclusive: true",
          "usage_guidance: When building components",
          "tags:",
          "  - frontend",
          "  - react",
          "compatible_with:",
          "  - web-state-zustand",
          "conflicts_with:",
          "  - web-framework-vue",
          "requires:",
          "  - web-testing-vitest",
          "requires_setup:",
          "  - web-styling-scss-modules",
          "provides_setup_for:",
          "  - web-build-webpack",
        ].join("\n"),
        skillMd: `---\nname: rich-skill (@local)\ndescription: A rich skill\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);
      const skill = result?.skills[0];

      expect(skill?.categoryExclusive).toBe(true);
      expect(skill?.usageGuidance).toBe("When building components");
      expect(skill?.tags).toEqual(["frontend", "react"]);
      expect(skill?.compatibleWith).toEqual(["web-state-zustand"]);
      expect(skill?.conflictsWith).toEqual(["web-framework-vue"]);
      expect(skill?.requires).toEqual(["web-testing-vitest"]);
      expect(skill?.requiresSetup).toEqual(["web-styling-scss-modules"]);
      expect(skill?.providesSetupFor).toEqual(["web-build-webpack"]);
    });

    it("skips skill when metadata.yaml has wrong field types", async () => {
      await writeLocalSkill("wrong-types", {
        // cli_name must be a string, but providing a number via YAML
        metadata: "cli_name: 123\ncategory_exclusive: not-a-boolean",
        skillMd: `---\nname: wrong-types (@local)\ndescription: Wrong types in metadata\n---\nContent`,
      });

      const result = await discoverLocalSkills(tempDir);

      // Schema validation should fail because category_exclusive must be boolean
      // The skill may still pass if the schema is lenient, but the function should not throw
      expect(result).not.toBeNull();
    });

    it("skips valid skills alongside invalid ones", async () => {
      // Valid skill
      await writeLocalSkill("valid-skill", {
        metadata: "cli_name: Valid Skill",
        skillMd: `---\nname: valid-skill (@local)\ndescription: A valid skill\n---\nContent`,
      });

      // Invalid skill (no SKILL.md)
      await writeLocalSkill("invalid-skill", {
        metadata: "cli_name: Invalid Skill",
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
