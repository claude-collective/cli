import path from "path";
import { mkdir, rm } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
  readTestFile,
  directoryExists,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  SKILL_CATEGORIES_PATH,
  SKILL_RULES_PATH,
  STANDARD_FILES,
  STANDARD_DIRS,
} from "../../src/cli/consts.js";

describe("new skill command", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  it("should display help text", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["new", "skill", "--help"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Create a new local skill");
    expect(stdout).toContain("--author");
    expect(stdout).toContain("--category");
    expect(stdout).toContain("--force");
  });

  it("should error when no skill name is provided", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(["new", "skill"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(combined).toContain("Missing 1 required arg");
  });

  it("should error with an invalid skill name", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(["new", "skill", "InvalidName"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(combined).toContain("kebab-case");
  });

  it("should create a new skill with SKILL.md and metadata.yaml", async () => {
    tempDir = await createTempDir();
    const skillName = "my-test-skill";

    const { exitCode, stdout } = await runCLI(
      ["new", "skill", skillName, "--domain", "shared"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Create New Skill");
    expect(stdout).toContain(skillName);
    expect(stdout).toContain("Skill created successfully");

    const skillDir = path.join(tempDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, skillName);

    expect(await directoryExists(skillDir)).toBe(true);

    const skillMdPath = path.join(skillDir, STANDARD_FILES.SKILL_MD);
    const metadataPath = path.join(skillDir, STANDARD_FILES.METADATA_YAML);

    expect(await fileExists(skillMdPath)).toBe(true);
    expect(await fileExists(metadataPath)).toBe(true);
  });

  it("should produce SKILL.md with proper frontmatter", async () => {
    tempDir = await createTempDir();
    const skillName = "my-frontmatter-skill";

    const { exitCode } = await runCLI(["new", "skill", skillName, "--domain", "shared"], tempDir);
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const skillMdPath = path.join(
      tempDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      skillName,
      STANDARD_FILES.SKILL_MD,
    );
    const content = await readTestFile(skillMdPath);

    expect(content).toMatch(/^---\n/);
    expect(content).toContain(`name: ${skillName}`);
    expect(content).toContain("description:");
    expect(content).toContain("# My Frontmatter Skill");
  });

  it("should produce a valid metadata.yaml", async () => {
    tempDir = await createTempDir();
    const skillName = "my-metadata-skill";

    const { exitCode } = await runCLI(["new", "skill", skillName, "--domain", "shared"], tempDir);
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const metadataPath = path.join(
      tempDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      skillName,
      STANDARD_FILES.METADATA_YAML,
    );
    const content = await readTestFile(metadataPath);

    expect(content).toContain("category:");
    expect(content).toContain("author:");
    expect(content).toContain("contentHash:");
    expect(content).toContain("custom: true");
  });

  it("should error when skill already exists without --force", async () => {
    tempDir = await createTempDir();
    const skillName = "duplicate-skill";

    const { exitCode: setupExitCode } = await runCLI(
      ["new", "skill", skillName, "--domain", "shared"],
      tempDir,
    );
    expect(setupExitCode).toBe(EXIT_CODES.SUCCESS);

    const { exitCode, combined } = await runCLI(
      ["new", "skill", skillName, "--domain", "shared"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.ERROR);
    expect(combined).toContain("already exists");
  });

  it("should overwrite existing skill with --force", async () => {
    tempDir = await createTempDir();
    const skillName = "force-skill";

    await runCLI(["new", "skill", skillName, "--domain", "shared"], tempDir);

    const { exitCode, stdout } = await runCLI(
      ["new", "skill", skillName, "--force", "--domain", "shared"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Skill created successfully");
  });

  it("should update config files when creating a skill in marketplace context", async () => {
    tempDir = await createTempDir();
    const marketplaceName = "mp-skill-config";

    // First scaffold a marketplace to establish the context
    const { exitCode: mpExitCode } = await runCLI(["new", "marketplace", marketplaceName], tempDir);
    expect(mpExitCode).toBe(EXIT_CODES.SUCCESS);

    const marketplaceDir = path.join(tempDir, marketplaceName);

    // Create a new skill inside the marketplace directory
    const { exitCode, stdout } = await runCLI(
      ["new", "skill", "my-extra-skill", "--category", "api-database", "--domain", "api"],
      marketplaceDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Skill created successfully");

    // Verify skill-categories.ts was updated with the new category
    const categoriesPath = path.join(marketplaceDir, SKILL_CATEGORIES_PATH);
    const categoriesContent = await readTestFile(categoriesPath);
    expect(categoriesContent).toContain('"api-database"');
    expect(categoriesContent).toContain('"domain": "api"');

    // Verify skill-rules.ts was updated with the new skill alias
    const rulesPath = path.join(marketplaceDir, SKILL_RULES_PATH);
    const rulesContent = await readTestFile(rulesPath);
    expect(rulesContent).toContain('"my-extra-skill"');
  });

  it("should accept a skill name containing numbers", async () => {
    tempDir = await createTempDir();
    const skillName = "skill123";

    const { exitCode, stdout } = await runCLI(
      ["new", "skill", skillName, "--domain", "shared"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Skill created successfully");
  });

  it("should accept a long skill name", async () => {
    tempDir = await createTempDir();
    const skillName = "my-very-long-skill-name-that-has-many-segments";

    const { exitCode, stdout } = await runCLI(
      ["new", "skill", skillName, "--domain", "shared"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Skill created successfully");
  });

  it("should set category in metadata.yaml when --category flag is provided", async () => {
    tempDir = await createTempDir();
    const skillName = "my-cat-skill";

    const { exitCode, stdout } = await runCLI(
      ["new", "skill", skillName, "--category", "api-database", "--domain", "api"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Skill created successfully");

    const metadataPath = path.join(
      tempDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      skillName,
      STANDARD_FILES.METADATA_YAML,
    );
    const content = await readTestFile(metadataPath);

    expect(content).toContain("category: api-database");
  });

  it("should not create config files when creating a local skill", async () => {
    tempDir = await createTempDir();
    const skillName = "local-only-skill";

    const { exitCode } = await runCLI(["new", "skill", skillName, "--domain", "shared"], tempDir);
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    // Config files should NOT exist for local skills
    expect(await fileExists(path.join(tempDir, SKILL_CATEGORIES_PATH))).toBe(false);
    expect(await fileExists(path.join(tempDir, SKILL_RULES_PATH))).toBe(false);
  });

  it("should regenerate config-types.ts with custom skill in marketplace context", async () => {
    tempDir = await createTempDir();
    const marketplaceName = "mp-types-test";

    // Scaffold a marketplace to establish the source context (src/skills/, config/, etc.)
    const { exitCode: mpExitCode } = await runCLI(["new", "marketplace", marketplaceName], tempDir);
    expect(mpExitCode).toBe(EXIT_CODES.SUCCESS);

    const marketplaceDir = path.join(tempDir, marketplaceName);

    // Create .claude-src/ directory — required for loadConfigTypesDataInBackground
    await mkdir(path.join(marketplaceDir, CLAUDE_SRC_DIR), { recursive: true });

    // Remove scaffolded config files that contain invalid dummy domain values.
    // loadSkillsMatrixFromSource validates these with Zod, and "dummy" is not
    // a valid domain. Removing them lets the source loader fall back to CLI defaults.
    await rm(path.join(marketplaceDir, SKILL_CATEGORIES_PATH), { force: true });
    await rm(path.join(marketplaceDir, SKILL_RULES_PATH), { force: true });

    // Create a new skill with custom domain/category, using --source . to point at the marketplace
    const { exitCode, stdout } = await runCLI(
      [
        "new",
        "skill",
        "custom-types-skill",
        "--domain",
        "custom-e2e-domain",
        "--category",
        "custom-e2e-category",
        "--source",
        ".",
      ],
      marketplaceDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Skill created successfully");

    // Verify config-types.ts was regenerated with custom values
    const configTypesPath = path.join(
      marketplaceDir,
      CLAUDE_SRC_DIR,
      STANDARD_FILES.CONFIG_TYPES_TS,
    );
    expect(await fileExists(configTypesPath)).toBe(true);

    const configTypesContent = await readTestFile(configTypesPath);

    // Header comment
    expect(configTypesContent).toContain("AUTO-GENERATED");

    // Section comments for custom vs marketplace values
    expect(configTypesContent).toContain("// Custom");
    expect(configTypesContent).toContain("// Marketplace");

    // Custom skill ID appears in SkillId union
    expect(configTypesContent).toContain('"custom-types-skill"');

    // Custom domain appears in Domain union
    expect(configTypesContent).toContain('"custom-e2e-domain"');

    // Custom category appears in Category union
    expect(configTypesContent).toContain('"custom-e2e-category"');
  });
});
