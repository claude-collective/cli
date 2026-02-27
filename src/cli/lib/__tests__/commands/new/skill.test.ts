import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import {
  runCliCommand,
  fileExists,
  directoryExists,
  createTempDir,
  cleanupTempDir,
} from "../../helpers";
import { EXIT_CODES } from "../../../exit-codes";
import {
  validateSkillName,
  toTitleCase,
  generateSkillMd,
  generateMetadataYaml,
} from "../../../../commands/new/skill";
import {
  LOCAL_SKILLS_PATH,
  SKILLS_DIR_PATH,
  PLUGIN_MANIFEST_DIR,
  STANDARD_FILES,
} from "../../../../consts";

const TEST_CONTENT_HASH = "abc1234";

describe("validateSkillName", () => {
  it("should return null for valid kebab-case name", () => {
    expect(validateSkillName("my-skill")).toBeNull();
  });

  it("should return null for single word lowercase name", () => {
    expect(validateSkillName("react")).toBeNull();
  });

  it("should return null for name with numbers", () => {
    expect(validateSkillName("web3-utils")).toBeNull();
  });

  it("should return error for uppercase characters", () => {
    const result = validateSkillName("MySkill");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });

  it("should return error for spaces", () => {
    const result = validateSkillName("my skill");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });

  it("should return error for empty string", () => {
    const result = validateSkillName("");
    expect(result).not.toBeNull();
    expect(result).toContain("required");
  });

  it("should return error for whitespace-only string", () => {
    const result = validateSkillName("   ");
    expect(result).not.toBeNull();
    expect(result).toContain("required");
  });

  it("should return error for name starting with number", () => {
    const result = validateSkillName("3d-utils");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });

  it("should return error for name starting with hyphen", () => {
    const result = validateSkillName("-my-skill");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });

  it("should return error for trailing hyphen", () => {
    const result = validateSkillName("my-skill-");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });

  it("should return error for consecutive hyphens", () => {
    const result = validateSkillName("my--skill");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });
});

describe("toTitleCase", () => {
  it("should convert kebab-case to Title Case", () => {
    expect(toTitleCase("web-framework")).toBe("Web Framework");
  });

  it("should handle single word", () => {
    expect(toTitleCase("react")).toBe("React");
  });

  it("should handle multiple hyphens", () => {
    expect(toTitleCase("my-cool-patterns")).toBe("My Cool Patterns");
  });
});

describe("generateSkillMd", () => {
  it("should contain frontmatter with skill name", () => {
    const content = generateSkillMd("my-skill");
    expect(content).toContain("---");
    expect(content).toContain("name: my-skill");
  });

  it("should contain description field in frontmatter", () => {
    const content = generateSkillMd("my-skill");
    expect(content).toContain("description:");
  });

  it("should contain title-cased heading", () => {
    const content = generateSkillMd("web-framework");
    expect(content).toContain("# Web Framework");
  });

  it("should not include author in name field", () => {
    const content = generateSkillMd("my-skill");
    expect(content).toContain("name: my-skill");
    expect(content).not.toContain("(@");
  });
});

describe("generateMetadataYaml", () => {
  it("should contain category field", () => {
    const content = generateMetadataYaml("my-skill", "@local", "local", TEST_CONTENT_HASH);
    expect(content).toContain("category: local");
  });

  it("should contain author field", () => {
    const content = generateMetadataYaml("my-skill", "@vince", "local", TEST_CONTENT_HASH);
    expect(content).toContain('author: "@vince"');
  });

  it("should contain title-cased displayName", () => {
    const content = generateMetadataYaml("web-framework", "@local", "local", TEST_CONTENT_HASH);
    expect(content).toContain("displayName: Web Framework");
  });

  it("should use provided category", () => {
    const content = generateMetadataYaml("my-skill", "@local", "web-framework", TEST_CONTENT_HASH);
    expect(content).toContain("category: web-framework");
  });

  it("should always include custom: true", () => {
    const content = generateMetadataYaml("my-skill", "@local", "local", TEST_CONTENT_HASH);
    expect(content).toContain("custom: true");
  });

  it("should place custom: true before category", () => {
    const content = generateMetadataYaml("my-skill", "@local", "local", TEST_CONTENT_HASH);
    const customIndex = content.indexOf("custom: true");
    const categoryIndex = content.indexOf("category: local");
    expect(customIndex).toBeLessThan(categoryIndex);
  });

  it("should contain contentHash field", () => {
    const content = generateMetadataYaml("my-skill", "@local", "local", TEST_CONTENT_HASH);
    expect(content).toContain(`contentHash: ${TEST_CONTENT_HASH}`);
  });
});

describe("new:skill command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-new-skill-test-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  describe("argument validation", () => {
    it("should reject missing name argument", async () => {
      const { error } = await runCliCommand(["new:skill"]);

      // oclif should report missing required arg
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should reject non-kebab-case name with uppercase", async () => {
      const { error } = await runCliCommand(["new:skill", "MySkill"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
    });

    it("should reject name with spaces", async () => {
      const { error } = await runCliCommand(["new:skill", "my skill"]);

      // oclif may treat the second word as an extra arg or validation fails
      expect(error?.oclif?.exit).toBeDefined();
    });
  });

  describe("file creation", () => {
    it("should create SKILL.md and metadata.yaml in .claude/skills/{name}/", async () => {
      await runCliCommand(["new:skill", "my-test-skill"]);

      const skillDir = path.join(projectDir, LOCAL_SKILLS_PATH, "my-test-skill");
      const skillMdPath = path.join(skillDir, STANDARD_FILES.SKILL_MD);
      const metadataPath = path.join(skillDir, STANDARD_FILES.METADATA_YAML);

      expect(await directoryExists(skillDir)).toBe(true);
      expect(await fileExists(skillMdPath)).toBe(true);
      expect(await fileExists(metadataPath)).toBe(true);
    });

    it("should write correct SKILL.md content", async () => {
      await runCliCommand(["new:skill", "my-test-skill"]);

      const skillMdPath = path.join(
        projectDir,
        LOCAL_SKILLS_PATH,
        "my-test-skill",
        STANDARD_FILES.SKILL_MD,
      );
      const content = await readFile(skillMdPath, "utf-8");

      expect(content).toContain("name: my-test-skill");
      expect(content).toContain("# My Test Skill");
      expect(content).toContain("description:");
    });

    it("should write correct metadata.yaml content", async () => {
      await runCliCommand(["new:skill", "my-test-skill"]);

      const metadataPath = path.join(
        projectDir,
        LOCAL_SKILLS_PATH,
        "my-test-skill",
        STANDARD_FILES.METADATA_YAML,
      );
      const content = await readFile(metadataPath, "utf-8");

      expect(content).toContain("custom: true");
      expect(content).toContain("category: dummy-category");
      expect(content).toContain("displayName: My Test Skill");
      expect(content).toContain("contentHash:");
      expect(content).not.toContain("version:");
    });
  });

  describe("flags", () => {
    it("should accept --author flag and use it in metadata", async () => {
      await runCliCommand(["new:skill", "custom-skill", "--author", "@vince"]);

      const metadataPath = path.join(
        projectDir,
        LOCAL_SKILLS_PATH,
        "custom-skill",
        STANDARD_FILES.METADATA_YAML,
      );
      const content = await readFile(metadataPath, "utf-8");

      expect(content).toContain('author: "@vince"');
    });

    it("should accept --category flag and use it in metadata", async () => {
      await runCliCommand(["new:skill", "custom-skill", "--category", "web-framework"]);

      const metadataPath = path.join(
        projectDir,
        LOCAL_SKILLS_PATH,
        "custom-skill",
        STANDARD_FILES.METADATA_YAML,
      );
      const content = await readFile(metadataPath, "utf-8");

      expect(content).toContain("category: web-framework");
    });

    it("should not create files with --dry-run flag", async () => {
      await runCliCommand(["new:skill", "dry-run-skill", "--dry-run"]);

      const skillDir = path.join(projectDir, LOCAL_SKILLS_PATH, "dry-run-skill");
      expect(await directoryExists(skillDir)).toBe(false);
    });

    it("should contain [DRY RUN] marker in --dry-run output", async () => {
      const { stdout } = await runCliCommand(["new:skill", "dry-run-skill", "--dry-run"]);

      expect(stdout).toContain("[DRY RUN]");
    });
  });

  describe("existing skill handling", () => {
    it("should error if skill directory already exists without --force", async () => {
      // Create the skill directory first
      const skillDir = path.join(projectDir, LOCAL_SKILLS_PATH, "existing-skill");
      await mkdir(skillDir, { recursive: true });

      const { error } = await runCliCommand(["new:skill", "existing-skill"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.ERROR);
    });

    it("should overwrite existing skill with --force flag", async () => {
      // Create the skill directory first
      const skillDir = path.join(projectDir, LOCAL_SKILLS_PATH, "existing-skill");
      await mkdir(skillDir, { recursive: true });

      const { error } = await runCliCommand(["new:skill", "existing-skill", "--force"]);

      // Should not exit with error
      expect(error?.oclif?.exit).toBeUndefined();

      // Files should exist after overwrite
      const skillMdPath = path.join(skillDir, STANDARD_FILES.SKILL_MD);
      expect(await fileExists(skillMdPath)).toBe(true);
    });
  });

  describe("marketplace detection", () => {
    it("should create skill in src/skills/ when marketplace.json exists", async () => {
      const marketplaceJsonDir = path.join(projectDir, PLUGIN_MANIFEST_DIR);
      await mkdir(marketplaceJsonDir, { recursive: true });
      await writeFile(path.join(marketplaceJsonDir, "marketplace.json"), '{"name":"test"}');

      const { stdout } = await runCliCommand(["new:skill", "my-market-skill"]);

      expect(stdout).toContain("Detected marketplace context");

      const skillDir = path.join(projectDir, SKILLS_DIR_PATH, "my-market-skill");
      expect(await directoryExists(skillDir)).toBe(true);
      expect(await fileExists(path.join(skillDir, STANDARD_FILES.SKILL_MD))).toBe(true);
      expect(await fileExists(path.join(skillDir, STANDARD_FILES.METADATA_YAML))).toBe(true);
    });

    it("should create skill in .claude/skills/ when marketplace.json does not exist", async () => {
      await runCliCommand(["new:skill", "my-local-skill"]);

      const skillDir = path.join(projectDir, LOCAL_SKILLS_PATH, "my-local-skill");
      expect(await directoryExists(skillDir)).toBe(true);
      expect(await fileExists(path.join(skillDir, STANDARD_FILES.SKILL_MD))).toBe(true);
      expect(await fileExists(path.join(skillDir, STANDARD_FILES.METADATA_YAML))).toBe(true);

      const marketplaceSkillDir = path.join(projectDir, SKILLS_DIR_PATH, "my-local-skill");
      expect(await directoryExists(marketplaceSkillDir)).toBe(false);
    });

    it("should use --output flag to override marketplace detection", async () => {
      const marketplaceJsonDir = path.join(projectDir, PLUGIN_MANIFEST_DIR);
      await mkdir(marketplaceJsonDir, { recursive: true });
      await writeFile(path.join(marketplaceJsonDir, "marketplace.json"), '{"name":"test"}');

      const customOutput = path.join(tempDir, "custom-skills");
      await mkdir(customOutput, { recursive: true });

      await runCliCommand(["new:skill", "my-custom-skill", "--output", customOutput]);

      const skillDir = path.join(customOutput, "my-custom-skill");
      expect(await directoryExists(skillDir)).toBe(true);
      expect(await fileExists(path.join(skillDir, STANDARD_FILES.SKILL_MD))).toBe(true);

      // Should NOT be in marketplace location since --output overrides
      const marketplaceSkillDir = path.join(projectDir, SKILLS_DIR_PATH, "my-custom-skill");
      expect(await directoryExists(marketplaceSkillDir)).toBe(false);
    });
  });
});
