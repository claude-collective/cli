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
  generateSkillCategoriesYaml,
  generateSkillRulesYaml,
} from "../../../../commands/new/skill";
import {
  LOCAL_SKILLS_PATH,
  SKILL_CATEGORIES_YAML_PATH,
  SKILL_RULES_YAML_PATH,
  SKILLS_DIR_PATH,
  PLUGIN_MANIFEST_DIR,
  STANDARD_FILES,
} from "../../../../consts";
import type { CategoryPath } from "../../../../types";

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

  describe("config file updates in marketplace context", () => {
    it("should create config files when running in marketplace context", async () => {
      const marketplaceJsonDir = path.join(projectDir, PLUGIN_MANIFEST_DIR);
      await mkdir(marketplaceJsonDir, { recursive: true });
      await writeFile(path.join(marketplaceJsonDir, "marketplace.json"), '{"name":"test"}');

      await runCliCommand(["new:skill", "my-market-skill", "--category", "web-testing"]);

      const categoriesPath = path.join(projectDir, SKILL_CATEGORIES_YAML_PATH);
      const rulesPath = path.join(projectDir, SKILL_RULES_YAML_PATH);

      expect(await fileExists(categoriesPath)).toBe(true);
      expect(await fileExists(rulesPath)).toBe(true);

      const categoriesContent = await readFile(categoriesPath, "utf-8");
      expect(categoriesContent).toContain("web-testing:");
      expect(categoriesContent).toContain("domain: web");

      const rulesContent = await readFile(rulesPath, "utf-8");
      expect(rulesContent).toContain("my-market-skill:");
    });

    it("should NOT create config files for local skills", async () => {
      await runCliCommand(["new:skill", "my-local-skill"]);

      const categoriesPath = path.join(projectDir, SKILL_CATEGORIES_YAML_PATH);
      const rulesPath = path.join(projectDir, SKILL_RULES_YAML_PATH);

      expect(await fileExists(categoriesPath)).toBe(false);
      expect(await fileExists(rulesPath)).toBe(false);
    });

    it("should NOT create config files when --output is used", async () => {
      const marketplaceJsonDir = path.join(projectDir, PLUGIN_MANIFEST_DIR);
      await mkdir(marketplaceJsonDir, { recursive: true });
      await writeFile(path.join(marketplaceJsonDir, "marketplace.json"), '{"name":"test"}');

      const customOutput = path.join(tempDir, "custom-skills");
      await mkdir(customOutput, { recursive: true });

      await runCliCommand(["new:skill", "my-skill", "--output", customOutput]);

      const categoriesPath = path.join(projectDir, SKILL_CATEGORIES_YAML_PATH);
      const rulesPath = path.join(projectDir, SKILL_RULES_YAML_PATH);

      expect(await fileExists(categoriesPath)).toBe(false);
      expect(await fileExists(rulesPath)).toBe(false);
    });

    it("should append to existing config files without duplicating entries", async () => {
      const marketplaceJsonDir = path.join(projectDir, PLUGIN_MANIFEST_DIR);
      await mkdir(marketplaceJsonDir, { recursive: true });
      await writeFile(path.join(marketplaceJsonDir, "marketplace.json"), '{"name":"test"}');

      // Create first skill to generate config files
      await runCliCommand(["new:skill", "first-skill", "--category", "web-testing"]);

      // Create second skill with a different category
      await runCliCommand(["new:skill", "second-skill", "--category", "api-database"]);

      const categoriesContent = await readFile(
        path.join(projectDir, SKILL_CATEGORIES_YAML_PATH),
        "utf-8",
      );
      expect(categoriesContent).toContain("web-testing:");
      expect(categoriesContent).toContain("api-database:");

      const rulesContent = await readFile(
        path.join(projectDir, SKILL_RULES_YAML_PATH),
        "utf-8",
      );
      expect(rulesContent).toContain("first-skill:");
      expect(rulesContent).toContain("second-skill:");
    });

    it("should not duplicate existing category or alias entries", async () => {
      const marketplaceJsonDir = path.join(projectDir, PLUGIN_MANIFEST_DIR);
      await mkdir(marketplaceJsonDir, { recursive: true });
      await writeFile(path.join(marketplaceJsonDir, "marketplace.json"), '{"name":"test"}');

      // Create two skills with the same category
      await runCliCommand(["new:skill", "skill-one", "--category", "web-framework"]);
      await runCliCommand(["new:skill", "skill-one", "--category", "web-framework", "--force"]);

      const categoriesContent = await readFile(
        path.join(projectDir, SKILL_CATEGORIES_YAML_PATH),
        "utf-8",
      );
      // Should only appear once as a category key
      const matches = categoriesContent.match(/web-framework:/g);
      expect(matches).toHaveLength(1);
    });
  });
});

describe("generateSkillCategoriesYaml", () => {
  it("should contain version field", () => {
    const content = generateSkillCategoriesYaml("web-framework" as CategoryPath);
    expect(content).toContain('version: "1.0.0"');
  });

  it("should contain category entry with correct id", () => {
    const content = generateSkillCategoriesYaml("web-framework" as CategoryPath);
    expect(content).toContain("web-framework:");
    expect(content).toContain("id: web-framework");
  });

  it("should derive displayName from subcategory part", () => {
    const content = generateSkillCategoriesYaml("web-framework" as CategoryPath);
    expect(content).toContain("displayName: Framework");
  });

  it("should include domain when prefix is a known domain", () => {
    const content = generateSkillCategoriesYaml("api-database" as CategoryPath);
    expect(content).toContain("domain: api");
  });

  it("should omit domain when prefix is not a known domain", () => {
    const content = generateSkillCategoriesYaml("dummy-category" as CategoryPath);
    expect(content).not.toContain("domain:");
  });

  it("should set default values for exclusive, required, order, custom", () => {
    const content = generateSkillCategoriesYaml("web-framework" as CategoryPath);
    expect(content).toContain("exclusive: true");
    expect(content).toContain("required: false");
    expect(content).toContain("order: 99");
    expect(content).toContain("custom: true");
  });

  it("should derive displayName for multi-segment subcategory", () => {
    const content = generateSkillCategoriesYaml("web-error-handling" as CategoryPath);
    expect(content).toContain("displayName: Error Handling");
  });

  it("should handle all known domain prefixes", () => {
    for (const domain of ["web", "api", "mobile", "cli", "shared"]) {
      const content = generateSkillCategoriesYaml(`${domain}-testing` as CategoryPath);
      expect(content).toContain(`domain: ${domain}`);
    }
  });
});

describe("generateSkillRulesYaml", () => {
  it("should contain version field", () => {
    const content = generateSkillRulesYaml("my-skill");
    expect(content).toContain('version: "1.0.0"');
  });

  it("should contain aliases section with skill entry", () => {
    const content = generateSkillRulesYaml("my-skill");
    expect(content).toContain("aliases:");
    expect(content).toContain('my-skill: "my-skill"');
  });

  it("should include comment explaining alias format", () => {
    const content = generateSkillRulesYaml("my-skill");
    expect(content).toContain("# Short aliases mapping to canonical skill IDs");
  });
});
