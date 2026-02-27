import path from "path";
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
  SKILL_CATEGORIES_YAML_PATH,
  SKILL_RULES_YAML_PATH,
  SKILLS_DIR_PATH,
  STACKS_FILE_PATH,
  STANDARD_FILES,
  PLUGIN_MANIFEST_DIR,
} from "../../src/cli/consts.js";

describe("new marketplace command", () => {
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

    const { exitCode, stdout } = await runCLI(["new", "marketplace", "--help"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Scaffold a new private marketplace project");
    expect(stdout).toContain("--force");
    expect(stdout).toContain("--output");
  });

  it("should error when no name is provided", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(["new", "marketplace"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(combined).toContain("Missing 1 required arg");
  });

  it("should error with an invalid marketplace name", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(["new", "marketplace", "InvalidName"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(combined).toContain("kebab-case");
  });

  it("should create a marketplace with proper directory structure", async () => {
    tempDir = await createTempDir();
    const marketplaceName = "my-test-marketplace";

    const { exitCode, stdout } = await runCLI(["new", "marketplace", marketplaceName], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Create New Marketplace");
    expect(stdout).toContain("Marketplace created successfully");

    const marketplaceDir = path.join(tempDir, marketplaceName);
    expect(await directoryExists(marketplaceDir)).toBe(true);

    // Verify stacks.yaml exists
    const stacksPath = path.join(marketplaceDir, STACKS_FILE_PATH);
    expect(await fileExists(stacksPath)).toBe(true);

    // Verify skills directory exists with dummy skill
    const dummySkillDir = path.join(marketplaceDir, SKILLS_DIR_PATH, "dummy-skill");
    expect(await directoryExists(dummySkillDir)).toBe(true);

    // Verify SKILL.md and metadata.yaml for dummy skill
    expect(await fileExists(path.join(dummySkillDir, STANDARD_FILES.SKILL_MD))).toBe(true);
    expect(await fileExists(path.join(dummySkillDir, STANDARD_FILES.METADATA_YAML))).toBe(true);

    // Verify README.md exists
    expect(await fileExists(path.join(marketplaceDir, "README.md"))).toBe(true);
  });

  it("should produce a valid stacks.yaml with marketplace name", async () => {
    tempDir = await createTempDir();
    const marketplaceName = "my-stacks-test";

    const { exitCode } = await runCLI(["new", "marketplace", marketplaceName], tempDir);
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const stacksPath = path.join(tempDir, marketplaceName, STACKS_FILE_PATH);
    const content = await readTestFile(stacksPath);

    expect(content).toContain("stacks:");
    expect(content).toContain(marketplaceName);
    expect(content).toContain("dummy-stack");
  });

  it("should produce a README with marketplace name", async () => {
    tempDir = await createTempDir();
    const marketplaceName = "my-readme-test";

    const { exitCode } = await runCLI(["new", "marketplace", marketplaceName], tempDir);
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const readmePath = path.join(tempDir, marketplaceName, "README.md");
    const content = await readTestFile(readmePath);

    expect(content).toContain(`# ${marketplaceName}`);
    expect(content).toContain("Private marketplace");
    expect(content).toContain(STACKS_FILE_PATH);
    expect(content).toContain(SKILLS_DIR_PATH);
  });

  it("should build marketplace.json during scaffold", async () => {
    tempDir = await createTempDir();
    const marketplaceName = "my-build-test";

    const { exitCode, stdout } = await runCLI(["new", "marketplace", marketplaceName], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Building plugins");
    expect(stdout).toContain("Generating marketplace.json");

    const marketplaceJsonPath = path.join(
      tempDir,
      marketplaceName,
      PLUGIN_MANIFEST_DIR,
      "marketplace.json",
    );
    expect(await fileExists(marketplaceJsonPath)).toBe(true);
  });

  it("should error when marketplace already exists without --force", async () => {
    tempDir = await createTempDir();
    const marketplaceName = "duplicate-marketplace";

    const { exitCode: setupExitCode } = await runCLI(
      ["new", "marketplace", marketplaceName],
      tempDir,
    );
    expect(setupExitCode).toBe(EXIT_CODES.SUCCESS);

    const { exitCode, combined } = await runCLI(["new", "marketplace", marketplaceName], tempDir);

    expect(exitCode).toBe(EXIT_CODES.ERROR);
    expect(combined).toContain("already exists");
  });

  it("should overwrite existing marketplace with --force", async () => {
    tempDir = await createTempDir();
    const marketplaceName = "force-marketplace";

    const { exitCode: setupExitCode } = await runCLI(
      ["new", "marketplace", marketplaceName],
      tempDir,
    );
    expect(setupExitCode).toBe(EXIT_CODES.SUCCESS);

    const { exitCode, stdout } = await runCLI(
      ["new", "marketplace", marketplaceName, "--force"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Marketplace created successfully");
  });

  it("should support --output to specify parent directory", async () => {
    tempDir = await createTempDir();
    const marketplaceName = "output-test";
    const outputDir = path.join(tempDir, "custom-parent");

    const { exitCode, stdout } = await runCLI(
      ["new", "marketplace", marketplaceName, "--output", outputDir],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Marketplace created successfully");

    const marketplaceDir = path.join(outputDir, marketplaceName);
    expect(await directoryExists(marketplaceDir)).toBe(true);
    expect(await fileExists(path.join(marketplaceDir, STACKS_FILE_PATH))).toBe(true);
  });

  it("should produce a valid skill-categories.yaml with dummy category", async () => {
    tempDir = await createTempDir();
    const marketplaceName = "my-categories-test";

    const { exitCode } = await runCLI(["new", "marketplace", marketplaceName], tempDir);
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const categoriesPath = path.join(tempDir, marketplaceName, SKILL_CATEGORIES_YAML_PATH);
    expect(await fileExists(categoriesPath)).toBe(true);

    const content = await readTestFile(categoriesPath);
    expect(content).toContain('version: "1.0.0"');
    expect(content).toContain("dummy-category:");
    expect(content).toContain("id: dummy-category");
    expect(content).toContain("custom: true");
  });

  it("should produce a valid skill-rules.yaml with dummy skill alias", async () => {
    tempDir = await createTempDir();
    const marketplaceName = "my-rules-test";

    const { exitCode } = await runCLI(["new", "marketplace", marketplaceName], tempDir);
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const rulesPath = path.join(tempDir, marketplaceName, SKILL_RULES_YAML_PATH);
    expect(await fileExists(rulesPath)).toBe(true);

    const content = await readTestFile(rulesPath);
    expect(content).toContain('version: "1.0.0"');
    expect(content).toContain("aliases:");
    expect(content).toContain('dummy-skill: "dummy-skill"');
  });
});
