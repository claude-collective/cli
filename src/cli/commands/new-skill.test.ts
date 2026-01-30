import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, readFile } from "fs/promises";
import { existsSync } from "fs";
import { parse as parseYaml } from "yaml";
import { TEST_AUTHOR } from "../lib/__tests__/test-fixtures";

// Note: We test the internal functions and file operations rather than
// the CLI command itself to avoid process.exit() issues in tests

describe("cc new skill", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-new-skill-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // =========================================================================
  // P4-11/P4-13: Test `cc new skill <name>` creates proper structure
  // Acceptance Criteria:
  // 1. Creates skill directory in `.claude/skills/<name>/`
  // 2. SKILL.md has valid frontmatter with name and description
  // 3. metadata.yaml has all required fields
  // 4. Author defaults from global config
  // 5. --author flag overrides default
  // 6. Validates skill name (kebab-case)
  // 7. Fails if directory exists (unless --force)
  // =========================================================================

  describe("validateSkillName", () => {
    it("should accept valid kebab-case names", async () => {
      const { validateSkillName } = await import("./new-skill");

      expect(validateSkillName("my-skill")).toBeNull();
      expect(validateSkillName("react")).toBeNull();
      expect(validateSkillName("my-awesome-patterns")).toBeNull();
      expect(validateSkillName("auth123")).toBeNull();
      expect(validateSkillName("a")).toBeNull();
      expect(validateSkillName("skill-v2")).toBeNull();
    });

    it("should reject empty names", async () => {
      const { validateSkillName } = await import("./new-skill");

      expect(validateSkillName("")).not.toBeNull();
      expect(validateSkillName("   ")).not.toBeNull();
    });

    it("should reject names with uppercase letters", async () => {
      const { validateSkillName } = await import("./new-skill");

      expect(validateSkillName("MySkill")).not.toBeNull();
      expect(validateSkillName("mySkill")).not.toBeNull();
      expect(validateSkillName("SKILL")).not.toBeNull();
    });

    it("should reject names starting with numbers", async () => {
      const { validateSkillName } = await import("./new-skill");

      expect(validateSkillName("123skill")).not.toBeNull();
      expect(validateSkillName("2fast")).not.toBeNull();
    });

    it("should reject names with special characters", async () => {
      const { validateSkillName } = await import("./new-skill");

      expect(validateSkillName("my_skill")).not.toBeNull();
      expect(validateSkillName("my.skill")).not.toBeNull();
      expect(validateSkillName("my skill")).not.toBeNull();
      expect(validateSkillName("my@skill")).not.toBeNull();
    });

    it("should reject names starting with hyphens", async () => {
      const { validateSkillName } = await import("./new-skill");

      expect(validateSkillName("-skill")).not.toBeNull();
      expect(validateSkillName("-")).not.toBeNull();
    });
  });

  describe("toTitleCase", () => {
    it("should convert kebab-case to Title Case", async () => {
      const { toTitleCase } = await import("./new-skill");

      expect(toTitleCase("my-skill")).toBe("My Skill");
      expect(toTitleCase("react")).toBe("React");
      expect(toTitleCase("my-awesome-patterns")).toBe("My Awesome Patterns");
      expect(toTitleCase("auth")).toBe("Auth");
    });
  });

  describe("generateSkillMd", () => {
    it("should generate SKILL.md with correct frontmatter", async () => {
      const { generateSkillMd } = await import("./new-skill");

      const content = generateSkillMd("my-patterns", TEST_AUTHOR);

      // Check frontmatter
      expect(content).toContain("---");
      expect(content).toContain(`name: my-patterns (${TEST_AUTHOR})`);
      expect(content).toContain("description: Brief description of this skill");
    });

    it("should generate SKILL.md with correct title", async () => {
      const { generateSkillMd } = await import("./new-skill");

      const content = generateSkillMd("my-awesome-patterns", TEST_AUTHOR);

      expect(content).toContain("# My Awesome Patterns");
    });

    it("should include all required sections", async () => {
      const { generateSkillMd } = await import("./new-skill");

      const content = generateSkillMd("test-skill", TEST_AUTHOR);

      expect(content).toContain("<critical_requirements>");
      expect(content).toContain("</critical_requirements>");
      expect(content).toContain("<patterns>");
      expect(content).toContain("</patterns>");
      expect(content).toContain("<critical_reminders>");
      expect(content).toContain("</critical_reminders>");
      expect(content).toContain("**When to use:**");
      expect(content).toContain("**Key patterns covered:**");
    });
  });

  describe("generateMetadataYaml", () => {
    it("should generate valid YAML with required fields", async () => {
      const { generateMetadataYaml } = await import("./new-skill");

      const content = generateMetadataYaml("my-skill", TEST_AUTHOR, "local");
      const parsed = parseYaml(content);

      expect(parsed.category).toBe("local");
      expect(parsed.category_exclusive).toBe(false);
      expect(parsed.author).toBe(TEST_AUTHOR);
      expect(parsed.version).toBe(1);
      expect(parsed.cli_name).toBe("My Skill");
      expect(parsed.cli_description).toBe("Brief description");
      expect(parsed.usage_guidance).toBe("Use when <guidance>.");
      expect(parsed.tags).toEqual(["local", "custom"]);
    });

    it("should use custom category when provided", async () => {
      const { generateMetadataYaml } = await import("./new-skill");

      const content = generateMetadataYaml(
        "auth-helpers",
        TEST_AUTHOR,
        "security",
      );
      const parsed = parseYaml(content);

      expect(parsed.category).toBe("security");
    });

    it("should generate proper cli_name from kebab-case", async () => {
      const { generateMetadataYaml } = await import("./new-skill");

      const content = generateMetadataYaml(
        "my-awesome-skill",
        TEST_AUTHOR,
        "local",
      );
      const parsed = parseYaml(content);

      expect(parsed.cli_name).toBe("My Awesome Skill");
    });
  });

  describe("skill creation (file operations)", () => {
    it("should create skill directory structure", async () => {
      const { writeFile, directoryExists } = await import("../utils/fs");
      const { generateSkillMd, generateMetadataYaml } =
        await import("./new-skill");
      const { LOCAL_SKILLS_PATH } = await import("../consts");

      const skillName = "test-skill";
      const skillDir = path.join(tempDir, LOCAL_SKILLS_PATH, skillName);

      // Generate content
      const skillMdContent = generateSkillMd(skillName, TEST_AUTHOR);
      const metadataContent = generateMetadataYaml(
        skillName,
        TEST_AUTHOR,
        "local",
      );

      // Write files
      await writeFile(path.join(skillDir, "SKILL.md"), skillMdContent);
      await writeFile(path.join(skillDir, "metadata.yaml"), metadataContent);

      // Verify directory was created
      expect(await directoryExists(skillDir)).toBe(true);
      expect(existsSync(path.join(skillDir, "SKILL.md"))).toBe(true);
      expect(existsSync(path.join(skillDir, "metadata.yaml"))).toBe(true);
    });

    it("should create SKILL.md with parseable frontmatter", async () => {
      const { writeFile } = await import("../utils/fs");
      const { generateSkillMd } = await import("./new-skill");
      const { LOCAL_SKILLS_PATH } = await import("../consts");
      const matter = await import("gray-matter");

      const skillName = "parseable-skill";
      const skillDir = path.join(tempDir, LOCAL_SKILLS_PATH, skillName);

      const skillMdContent = generateSkillMd(skillName, TEST_AUTHOR);
      await writeFile(path.join(skillDir, "SKILL.md"), skillMdContent);

      // Read and parse
      const content = await readFile(path.join(skillDir, "SKILL.md"), "utf-8");
      const { data: frontmatter, content: body } = matter.default(content);

      expect(frontmatter.name).toBe(`${skillName} (${TEST_AUTHOR})`);
      expect(frontmatter.description).toBe("Brief description of this skill");
      expect(body).toContain("# Parseable Skill");
    });

    it("should create metadata.yaml with all required fields for discovery", async () => {
      const { writeFile } = await import("../utils/fs");
      const { generateMetadataYaml } = await import("./new-skill");
      const { LOCAL_SKILLS_PATH } = await import("../consts");

      const skillName = "discoverable-skill";
      const skillDir = path.join(tempDir, LOCAL_SKILLS_PATH, skillName);

      const metadataContent = generateMetadataYaml(
        skillName,
        TEST_AUTHOR,
        "local",
      );
      await writeFile(path.join(skillDir, "metadata.yaml"), metadataContent);

      // Read and parse
      const content = await readFile(
        path.join(skillDir, "metadata.yaml"),
        "utf-8",
      );
      const parsed = parseYaml(content);

      // These are the required fields for local-skill-loader.ts to discover the skill
      expect(parsed.cli_name).toBeDefined();
      expect(typeof parsed.cli_name).toBe("string");
      expect(parsed.cli_name.length).toBeGreaterThan(0);
    });
  });

  describe("command options", () => {
    it("should have skill subcommand with required argument", async () => {
      const { newCommand } = await import("./new-agent");

      const skillCmd = newCommand.commands.find((c) => c.name() === "skill");
      expect(skillCmd).toBeDefined();

      // Check that it has a required argument
      const args = skillCmd?.registeredArguments || [];
      expect(args.length).toBe(1);
      expect(args[0].name()).toBe("name");
      expect(args[0].required).toBe(true);
    });

    it("should accept author option", async () => {
      const { newCommand } = await import("./new-agent");

      const skillCmd = newCommand.commands.find((c) => c.name() === "skill");
      const options = skillCmd?.options || [];
      const authorOpt = options.find((o) => o.long === "--author");
      expect(authorOpt).toBeDefined();
    });

    it("should accept category option with default value", async () => {
      const { newCommand } = await import("./new-agent");

      const skillCmd = newCommand.commands.find((c) => c.name() === "skill");
      const options = skillCmd?.options || [];
      const categoryOpt = options.find((o) => o.long === "--category");
      expect(categoryOpt).toBeDefined();
      expect(categoryOpt?.defaultValue).toBe("local");
    });

    it("should accept force flag", async () => {
      const { newCommand } = await import("./new-agent");

      const skillCmd = newCommand.commands.find((c) => c.name() === "skill");
      const options = skillCmd?.options || [];
      const forceOpt = options.find((o) => o.long === "--force");
      expect(forceOpt).toBeDefined();
      expect(forceOpt?.defaultValue).toBe(false);
    });
  });

  describe("skill discovery after creation", () => {
    it("should create skill that can be discovered by local-skill-loader", async () => {
      const { writeFile } = await import("../utils/fs");
      const { generateSkillMd, generateMetadataYaml } =
        await import("./new-skill");
      const { discoverLocalSkills } = await import("../lib/local-skill-loader");
      const { LOCAL_SKILLS_PATH } = await import("../consts");

      const skillName = "my-custom-skill";
      const skillDir = path.join(tempDir, LOCAL_SKILLS_PATH, skillName);

      // Generate and write skill files
      const skillMdContent = generateSkillMd(skillName, TEST_AUTHOR);
      const metadataContent = generateMetadataYaml(
        skillName,
        TEST_AUTHOR,
        "local",
      );

      await writeFile(path.join(skillDir, "SKILL.md"), skillMdContent);
      await writeFile(path.join(skillDir, "metadata.yaml"), metadataContent);

      // Discover local skills
      const result = await discoverLocalSkills(tempDir);

      expect(result).not.toBeNull();
      expect(result!.skills.length).toBe(1);

      const skill = result!.skills[0];
      expect(skill.id).toBe(`${skillName} (${TEST_AUTHOR})`);
      expect(skill.local).toBe(true);
    });
  });

  describe("directory exists handling", () => {
    it("should detect existing directory", async () => {
      const { ensureDir, directoryExists } = await import("../utils/fs");
      const { LOCAL_SKILLS_PATH } = await import("../consts");

      const skillName = "existing-skill";
      const skillDir = path.join(tempDir, LOCAL_SKILLS_PATH, skillName);

      // Create directory first
      await ensureDir(skillDir);

      // Verify it exists
      expect(await directoryExists(skillDir)).toBe(true);
    });
  });
});
