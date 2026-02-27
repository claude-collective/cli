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
import { CLAUDE_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";

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

    const { exitCode, stdout } = await runCLI(["new", "skill", skillName], tempDir);

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

    const { exitCode } = await runCLI(["new", "skill", skillName], tempDir);
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

    const { exitCode } = await runCLI(["new", "skill", skillName], tempDir);
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

    const { exitCode: setupExitCode } = await runCLI(["new", "skill", skillName], tempDir);
    expect(setupExitCode).toBe(EXIT_CODES.SUCCESS);

    const { exitCode, combined } = await runCLI(["new", "skill", skillName], tempDir);

    expect(exitCode).toBe(EXIT_CODES.ERROR);
    expect(combined).toContain("already exists");
  });

  it("should overwrite existing skill with --force", async () => {
    tempDir = await createTempDir();
    const skillName = "force-skill";

    await runCLI(["new", "skill", skillName], tempDir);

    const { exitCode, stdout } = await runCLI(["new", "skill", skillName, "--force"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Skill created successfully");
  });
});
