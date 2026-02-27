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
  validateMarketplaceName,
  generateStacksYaml,
  generateReadme,
} from "../../../../commands/new/marketplace";
import {
  SKILL_CATEGORIES_YAML_PATH,
  SKILL_RULES_YAML_PATH,
  STACKS_FILE_PATH,
  SKILLS_DIR_PATH,
  STANDARD_FILES,
  PLUGIN_MANIFEST_DIR,
} from "../../../../consts";

describe("validateMarketplaceName", () => {
  it("should return null for valid kebab-case name", () => {
    expect(validateMarketplaceName("acme-skills")).toBeNull();
  });

  it("should return null for single word lowercase name", () => {
    expect(validateMarketplaceName("acme")).toBeNull();
  });

  it("should return null for name with numbers", () => {
    expect(validateMarketplaceName("acme2-skills")).toBeNull();
  });

  it("should return error for uppercase characters", () => {
    const result = validateMarketplaceName("AcmeSkills");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });

  it("should return error for spaces", () => {
    const result = validateMarketplaceName("acme skills");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });

  it("should return error for empty string", () => {
    const result = validateMarketplaceName("");
    expect(result).not.toBeNull();
    expect(result).toContain("required");
  });

  it("should return error for whitespace-only string", () => {
    const result = validateMarketplaceName("   ");
    expect(result).not.toBeNull();
    expect(result).toContain("required");
  });

  it("should return error for name starting with number", () => {
    const result = validateMarketplaceName("3acme");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });

  it("should return error for name starting with hyphen", () => {
    const result = validateMarketplaceName("-acme");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });

  it("should return error for name ending with hyphen", () => {
    const result = validateMarketplaceName("acme-");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });

  it("should return error for consecutive hyphens", () => {
    const result = validateMarketplaceName("acme--skills");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });
});

describe("generateStacksYaml", () => {
  it("should contain a dummy stack", () => {
    const content = generateStacksYaml("acme");
    expect(content).toContain("id: dummy-stack");
    expect(content).toContain("name: Dummy Stack");
    expect(content).toContain("description: Default stack for acme");
  });

  it("should reference dummy-skill under the dummy category", () => {
    const content = generateStacksYaml("acme");
    expect(content).toContain("dummy-category: dummy-skill");
  });

  it("should contain a philosophy field", () => {
    const content = generateStacksYaml("acme");
    expect(content).toContain("philosophy:");
  });

  it("should use dummy-stack id regardless of marketplace name", () => {
    const content = generateStacksYaml("my-org");
    expect(content).toContain("id: dummy-stack");
    expect(content).toContain("dummy-category: dummy-skill");
  });
});

describe("generateReadme", () => {
  it("should contain the marketplace name as heading", () => {
    const content = generateReadme("acme-skills");
    expect(content).toContain("# acme-skills");
  });

  it("should mention the correct directory structure", () => {
    const content = generateReadme("acme");
    expect(content).toContain(STACKS_FILE_PATH);
    expect(content).toContain(SKILLS_DIR_PATH);
  });

  it("should include usage instructions with the marketplace name", () => {
    const content = generateReadme("acme-skills");
    expect(content).toContain("acme-skills");
    expect(content).toContain("--source");
  });

  it("should reference a placeholder category in the new skill example", () => {
    const content = generateReadme("acme");
    expect(content).toContain("--category <category-name>");
  });
});

describe("new:marketplace command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-new-marketplace-test-");
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
      const { error } = await runCliCommand(["new:marketplace"]);

      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should reject non-kebab-case name with uppercase", async () => {
      const { error } = await runCliCommand(["new:marketplace", "MyMarket"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
    });
  });

  describe("directory creation", () => {
    it("should create the marketplace directory structure", async () => {
      await runCliCommand(["new:marketplace", "acme-skills"]);

      const marketplaceDir = path.join(projectDir, "acme-skills");
      expect(await directoryExists(marketplaceDir)).toBe(true);

      const skillDir = path.join(marketplaceDir, SKILLS_DIR_PATH, "dummy-skill");
      expect(await directoryExists(skillDir)).toBe(true);
    });

    it("should create config/stacks.yaml with valid content", async () => {
      await runCliCommand(["new:marketplace", "acme-skills"]);

      const stacksPath = path.join(projectDir, "acme-skills", STACKS_FILE_PATH);
      expect(await fileExists(stacksPath)).toBe(true);

      const content = await readFile(stacksPath, "utf-8");
      expect(content).toContain("id: dummy-stack");
      expect(content).toContain("dummy-category: dummy-skill");
    });

    it("should create SKILL.md and metadata.yaml for dummy-skill with default category", async () => {
      await runCliCommand(["new:marketplace", "acme-skills"]);

      const skillDir = path.join(projectDir, "acme-skills", SKILLS_DIR_PATH, "dummy-skill");
      expect(await fileExists(path.join(skillDir, STANDARD_FILES.SKILL_MD))).toBe(true);
      expect(await fileExists(path.join(skillDir, STANDARD_FILES.METADATA_YAML))).toBe(true);

      const metadata = await readFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), "utf-8");
      expect(metadata).toContain("category: dummy-category");
      expect(metadata).toContain("custom: true");
    });

    it("should create README.md", async () => {
      await runCliCommand(["new:marketplace", "acme-skills"]);

      const readmePath = path.join(projectDir, "acme-skills", "README.md");
      expect(await fileExists(readmePath)).toBe(true);

      const content = await readFile(readmePath, "utf-8");
      expect(content).toContain("# acme-skills");
    });

    it("should create config/skill-categories.yaml with dummy-category entry", async () => {
      await runCliCommand(["new:marketplace", "acme-skills"]);

      const categoriesPath = path.join(projectDir, "acme-skills", SKILL_CATEGORIES_YAML_PATH);
      expect(await fileExists(categoriesPath)).toBe(true);

      const content = await readFile(categoriesPath, "utf-8");
      expect(content).toContain('version: "1.0.0"');
      expect(content).toContain("dummy-category:");
      expect(content).toContain("id: dummy-category");
      expect(content).toContain("custom: true");
    });

    it("should create config/skill-rules.yaml with dummy-skill alias", async () => {
      await runCliCommand(["new:marketplace", "acme-skills"]);

      const rulesPath = path.join(projectDir, "acme-skills", SKILL_RULES_YAML_PATH);
      expect(await fileExists(rulesPath)).toBe(true);

      const content = await readFile(rulesPath, "utf-8");
      expect(content).toContain('version: "1.0.0"');
      expect(content).toContain("aliases:");
      expect(content).toContain('dummy-skill: "dummy-skill"');
    });
  });

  describe("flags", () => {
    it("should not create files with --dry-run flag", async () => {
      const { stdout } = await runCliCommand(["new:marketplace", "dry-run-market", "--dry-run"]);

      const marketplaceDir = path.join(projectDir, "dry-run-market");
      expect(await directoryExists(marketplaceDir)).toBe(false);
      expect(stdout).toContain("[DRY RUN]");
    });

    it("should list specific file paths in --dry-run output", async () => {
      const { stdout } = await runCliCommand(["new:marketplace", "dry-run-market", "--dry-run"]);

      expect(stdout).toContain(STACKS_FILE_PATH);
      expect(stdout).toContain(SKILL_CATEGORIES_YAML_PATH);
      expect(stdout).toContain(SKILL_RULES_YAML_PATH);
      expect(stdout).toContain(STANDARD_FILES.SKILL_MD);
      expect(stdout).toContain(STANDARD_FILES.METADATA_YAML);
      expect(stdout).toContain("dummy-skill");
      expect(stdout).toContain("README.md");
    });

    it("should accept --output flag to create in a different directory", async () => {
      const outputDir = path.join(tempDir, "custom-output");
      await mkdir(outputDir, { recursive: true });

      await runCliCommand(["new:marketplace", "acme-skills", "--output", outputDir]);

      const marketplaceDir = path.join(outputDir, "acme-skills");
      expect(await directoryExists(marketplaceDir)).toBe(true);
      expect(await fileExists(path.join(marketplaceDir, STACKS_FILE_PATH))).toBe(true);
    });
  });

  describe("existing directory handling", () => {
    it("should error if directory already exists without --force", async () => {
      const marketplaceDir = path.join(projectDir, "existing-market");
      await mkdir(marketplaceDir, { recursive: true });

      const { error } = await runCliCommand(["new:marketplace", "existing-market"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.ERROR);
    });

    it("should overwrite existing directory with --force flag", async () => {
      const marketplaceDir = path.join(projectDir, "existing-market");
      await mkdir(marketplaceDir, { recursive: true });

      const { error } = await runCliCommand(["new:marketplace", "existing-market", "--force"]);

      expect(error?.oclif?.exit).toBeUndefined();

      const stacksPath = path.join(marketplaceDir, STACKS_FILE_PATH);
      expect(await fileExists(stacksPath)).toBe(true);
    });

    it("should overwrite existing content with --force flag", async () => {
      const marketplaceDir = path.join(projectDir, "existing-market");
      const stacksDir = path.join(marketplaceDir, path.dirname(STACKS_FILE_PATH));
      await mkdir(stacksDir, { recursive: true });
      await writeFile(path.join(marketplaceDir, STACKS_FILE_PATH), "old: content");

      const { error } = await runCliCommand(["new:marketplace", "existing-market", "--force"]);

      expect(error?.oclif?.exit).toBeUndefined();

      const content = await readFile(path.join(marketplaceDir, STACKS_FILE_PATH), "utf-8");
      expect(content).toContain("id: dummy-stack");
      expect(content).not.toContain("old: content");
    });
  });

  describe("output messages", () => {
    it("should display success message on happy path", async () => {
      const { stdout } = await runCliCommand(["new:marketplace", "acme-skills"]);

      expect(stdout).toContain("Marketplace created successfully!");
    });
  });

  describe("build step", () => {
    it("should create .claude-plugin/marketplace.json after scaffold", async () => {
      await runCliCommand(["new:marketplace", "build-test"]);

      const marketplaceDir = path.join(projectDir, "build-test");
      const marketplaceJsonPath = path.join(
        marketplaceDir,
        PLUGIN_MANIFEST_DIR,
        "marketplace.json",
      );
      expect(await fileExists(marketplaceJsonPath)).toBe(true);

      const content = await readFile(marketplaceJsonPath, "utf-8");
      const marketplace = JSON.parse(content);
      expect(marketplace.name).toBe("build-test");
      expect(marketplace.plugins.length).toBe(1);
    });

    it("should create dist/plugins/ with built example skills", async () => {
      await runCliCommand(["new:marketplace", "build-test"]);

      const marketplaceDir = path.join(projectDir, "build-test");
      expect(await directoryExists(path.join(marketplaceDir, "dist/plugins"))).toBe(true);

      const pluginDir = path.join(marketplaceDir, "dist/plugins/dummy-skill");
      expect(await directoryExists(pluginDir)).toBe(true);
    });

    it("should log build success messages", async () => {
      const { stdout } = await runCliCommand(["new:marketplace", "build-test"]);

      expect(stdout).toContain("Building plugins...");
      expect(stdout).toContain("Built 1 skill plugins.");
      expect(stdout).toContain("Generating marketplace.json...");
      expect(stdout).toContain("Generated .claude-plugin/marketplace.json");
    });
  });

  describe("current directory initialization with dot", () => {
    it("should initialize the current directory when name is '.'", async () => {
      const dotDir = path.join(tempDir, "acme-market");
      await mkdir(dotDir, { recursive: true });
      process.chdir(dotDir);

      const { error } = await runCliCommand(["new:marketplace", "."]);

      expect(error?.oclif?.exit).toBeUndefined();
      expect(await fileExists(path.join(dotDir, STACKS_FILE_PATH))).toBe(true);
      expect(await directoryExists(path.join(dotDir, SKILLS_DIR_PATH, "dummy-skill"))).toBe(true);
    });

    it("should derive marketplace name from directory basename", async () => {
      const dotDir = path.join(tempDir, "acme-market");
      await mkdir(dotDir, { recursive: true });
      process.chdir(dotDir);

      await runCliCommand(["new:marketplace", "."]);

      const stacksPath = path.join(dotDir, STACKS_FILE_PATH);
      const content = await readFile(stacksPath, "utf-8");
      expect(content).toContain("id: dummy-stack");
      expect(content).toContain("dummy-category: dummy-skill");

      const readmePath = path.join(dotDir, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");
      expect(readmeContent).toContain("# acme-market");
    });

    it("should not create a subdirectory when name is '.'", async () => {
      const dotDir = path.join(tempDir, "acme-market");
      await mkdir(dotDir, { recursive: true });
      process.chdir(dotDir);

      await runCliCommand(["new:marketplace", "."]);

      expect(await directoryExists(path.join(dotDir, "."))).toBe(true);
      expect(await fileExists(path.join(dotDir, STACKS_FILE_PATH))).toBe(true);
    });

    it("should not error on existing directory when using '.'", async () => {
      const dotDir = path.join(tempDir, "acme-market");
      await mkdir(dotDir, { recursive: true });
      process.chdir(dotDir);

      const { error } = await runCliCommand(["new:marketplace", "."]);

      expect(error?.oclif?.exit).toBeUndefined();
    });

    it("should error when directory basename is not valid kebab-case", async () => {
      const dotDir = path.join(tempDir, "My Folder");
      await mkdir(dotDir, { recursive: true });
      process.chdir(dotDir);

      const { error } = await runCliCommand(["new:marketplace", "."]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
      expect(error?.message).toContain("not valid kebab-case");
    });

    it("should use --output directory basename when combined with '.'", async () => {
      const outputDir = path.join(tempDir, "my-org-skills");
      await mkdir(outputDir, { recursive: true });

      await runCliCommand(["new:marketplace", ".", "--output", outputDir]);

      const stacksPath = path.join(outputDir, STACKS_FILE_PATH);
      expect(await fileExists(stacksPath)).toBe(true);

      const content = await readFile(stacksPath, "utf-8");
      expect(content).toContain("id: dummy-stack");
      expect(content).toContain("dummy-category: dummy-skill");
    });

    it("should show dry-run output with derived name when using '.'", async () => {
      const dotDir = path.join(tempDir, "acme-market");
      await mkdir(dotDir, { recursive: true });
      process.chdir(dotDir);

      const { stdout } = await runCliCommand(["new:marketplace", ".", "--dry-run"]);

      expect(stdout).toContain("[DRY RUN]");
      expect(stdout).toContain("Marketplace: acme-market");
    });

    it("should omit cd step in next steps when using '.'", async () => {
      const dotDir = path.join(tempDir, "acme-market");
      await mkdir(dotDir, { recursive: true });
      process.chdir(dotDir);

      const { stdout } = await runCliCommand(["new:marketplace", "."]);

      expect(stdout).not.toContain("cd acme-market");
      expect(stdout).toContain("Marketplace created successfully!");
    });
  });
});
