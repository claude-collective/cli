import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  createMinimalProject,
  createLocalSkill,
  ensureBinaryExists,
  fileExists,
  listFiles,
  readTestFile,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { CLAUDE_DIR, STANDARD_DIRS, STANDARD_FILES } from "../../src/cli/consts.js";

const COMPILE_ENV = {
  ...process.env,
  // Prevent source resolution from reading user's global config
  AGENTSINC_SOURCE: undefined,
};

describe("compile command", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  it("should compile agents to a custom output directory", async () => {
    tempDir = await createTempDir();
    const { projectDir, outputDir } = await createMinimalProject(tempDir);

    const { exitCode, stdout } = await runCLI(
      ["compile", "--output", outputDir],
      projectDir,
      { env: COMPILE_ENV },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Custom Output Compile");
    expect(stdout).toContain("Discovering skills...");
    expect(stdout).toContain("Discovered 1 local skills");
    expect(stdout).toContain("Resolving source...");
    expect(stdout).toContain("Loading agent partials...");
    expect(stdout).toContain("Compiling agents...");
    expect(stdout).toMatch(/Compiled \d+ agents/);
    expect(stdout).toContain("Custom output compile complete!");

    const outputFiles = await listFiles(outputDir);
    expect(outputFiles.length).toBeGreaterThan(0);

    const mdFiles = outputFiles.filter((f) => f.endsWith(".md"));
    expect(mdFiles.length).toBe(outputFiles.length);

    expect(outputFiles).toContain("web-developer.md");
    expect(outputFiles).toContain("api-developer.md");
  });

  it("should produce valid compiled agent files with frontmatter", async () => {
    tempDir = await createTempDir();
    const { projectDir, outputDir } = await createMinimalProject(tempDir);

    const { exitCode } = await runCLI(
      ["compile", "--output", outputDir],
      projectDir,
      { env: COMPILE_ENV },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const webDevPath = path.join(outputDir, "web-developer.md");
    expect(await fileExists(webDevPath)).toBe(true);

    const content = await readTestFile(webDevPath);

    expect(content).toMatch(/^---\n/);
    expect(content).toContain("name: web-developer");
    expect(content).toContain("description:");
    expect(content).toContain("tools:");
    expect(content).toContain("model:");

    const MIN_COMPILED_AGENT_LENGTH = 500;
    expect(content.length).toBeGreaterThan(MIN_COMPILED_AGENT_LENGTH);
    expect(content).toContain("#");
  });

  it("should support --dry-run flag", async () => {
    tempDir = await createTempDir();
    const { projectDir, outputDir } = await createMinimalProject(tempDir);

    const { exitCode, stdout } = await runCLI(
      ["compile", "--output", outputDir, "--dry-run"],
      projectDir,
      { env: COMPILE_ENV },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("[dry-run]");
    expect(stdout).toContain("Preview complete - no files were written");

    const outputFiles = await listFiles(outputDir);
    expect(outputFiles.length).toBe(0);
  });

  it("should support --verbose flag", async () => {
    tempDir = await createTempDir();
    const { projectDir, outputDir } = await createMinimalProject(tempDir);

    const { exitCode, stdout } = await runCLI(
      ["compile", "--output", outputDir, "--verbose"],
      projectDir,
      { env: COMPILE_ENV },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Compiled");
  });

  it("should fail when no skills are available", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "empty-project");
    const outputDir = path.join(tempDir, "output");
    await mkdir(projectDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    const { exitCode, combined } = await runCLI(
      ["compile", "--output", outputDir],
      projectDir,
      { env: COMPILE_ENV },
    );

    expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    expect(combined).toContain("No skills found");
  });

  describe("multiple skills", () => {
    it("should compile with multiple local skills", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      const outputDir = path.join(tempDir, "output");
      await mkdir(outputDir, { recursive: true });

      await createLocalSkill(projectDir, "web-testing-e2e-first", {
        description: "First test skill",
        metadata: `author: "@test"\ncontentHash: "hash-first"\n`,
      });
      await createLocalSkill(projectDir, "web-testing-e2e-second", {
        description: "Second test skill",
        metadata: `author: "@test"\ncontentHash: "hash-second"\n`,
      });
      await createLocalSkill(projectDir, "web-testing-e2e-third", {
        description: "Third test skill",
        metadata: `author: "@test"\ncontentHash: "hash-third"\n`,
      });

      const { exitCode, stdout } = await runCLI(
        ["compile", "--output", outputDir],
        projectDir,
        { env: COMPILE_ENV },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Discovered 3 local skills");
      expect(stdout).toMatch(/Compiled \d+ agents/);

      const outputFiles = await listFiles(outputDir);
      expect(outputFiles.length).toBeGreaterThan(0);
    });

    it("should list compiled agent files in stdout", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      const outputDir = path.join(tempDir, "output");
      await mkdir(outputDir, { recursive: true });

      await createLocalSkill(projectDir, "web-testing-e2e-content", {
        description: "Skill for compile listing verification",
        metadata: `author: "@test"\ncontentHash: "hash-content"\n`,
      });

      const { exitCode, stdout } = await runCLI(
        ["compile", "--output", outputDir],
        projectDir,
        { env: COMPILE_ENV },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Discovered 1 local skills");
      expect(stdout).toContain("Agents compiled to:");

      const outputFiles = await listFiles(outputDir);
      for (const file of outputFiles) {
        expect(stdout).toContain(file);
      }
    });
  });

  describe("verbose output", () => {
    it("should show loaded skill names in verbose mode", async () => {
      tempDir = await createTempDir();
      const { projectDir, outputDir } = await createMinimalProject(tempDir);

      const { exitCode, stdout } = await runCLI(
        ["compile", "--output", outputDir, "--verbose"],
        projectDir,
        { env: COMPILE_ENV },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Loaded skill:");
      expect(stdout).toContain("web-testing-e2e-compile");
    });
  });

  describe("invalid skill handling", () => {
    it("should skip skill with missing metadata.yaml", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      const outputDir = path.join(tempDir, "output");
      await mkdir(outputDir, { recursive: true });

      // Create a valid skill
      await createLocalSkill(projectDir, "web-testing-e2e-valid", {
        description: "Valid skill",
        metadata: `author: "@test"\ncontentHash: "hash-valid"\n`,
      });

      const invalidSkillDir = path.join(
        projectDir,
        CLAUDE_DIR,
        STANDARD_DIRS.SKILLS,
        "web-testing-e2e-no-metadata",
      );
      await mkdir(invalidSkillDir, { recursive: true });
      await writeFile(
        path.join(invalidSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-testing-e2e-no-metadata\ndescription: Missing metadata\n---\n\n# No Metadata\n`,
      );

      const { exitCode, combined } = await runCLI(
        ["compile", "--output", outputDir],
        projectDir,
        { env: COMPILE_ENV },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("missing metadata.yaml");
      expect(combined).toContain("Discovered 1 local skills");
    });
  });

  describe("agent YAML content verification", () => {
    it("should produce agents with valid YAML frontmatter fields", async () => {
      tempDir = await createTempDir();
      const { projectDir, outputDir } = await createMinimalProject(tempDir);

      const { exitCode } = await runCLI(
        ["compile", "--output", outputDir],
        projectDir,
        { env: COMPILE_ENV },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const outputFiles = await listFiles(outputDir);
      expect(outputFiles.length).toBeGreaterThan(0);

      for (const file of outputFiles) {
        const content = await readTestFile(path.join(outputDir, file));

        expect(content).toMatch(/^---\n/);

        const agentName = file.replace(".md", "");
        expect(content).toContain(`name: ${agentName}`);
        expect(content).toContain("description:");
      }
    });

    it("should produce agents with content after frontmatter", async () => {
      tempDir = await createTempDir();
      const { projectDir, outputDir } = await createMinimalProject(tempDir);

      const { exitCode } = await runCLI(
        ["compile", "--output", outputDir],
        projectDir,
        { env: COMPILE_ENV },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const outputFiles = await listFiles(outputDir);

      for (const file of outputFiles) {
        const content = await readTestFile(path.join(outputDir, file));

        expect(content).toMatch(/^---\n/);

        const bodyStartIndex = content.indexOf("---\n", 4);
        const body = content.substring(bodyStartIndex + 4).trim();

        expect(body).toContain("#");
      }
    });
  });
});
