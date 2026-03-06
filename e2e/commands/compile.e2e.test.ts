import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  createMinimalProject,
  createProjectWithCustomSkill,
  createLocalSkill,
  ensureBinaryExists,
  fileExists,
  listFiles,
  readTestFile,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_DIRS, STANDARD_FILES } from "../../src/cli/consts.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

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

    const { exitCode, stdout } = await runCLI(["compile", "--output", outputDir], projectDir, {
      env: COMPILE_ENV,
    });

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

    const { exitCode } = await runCLI(["compile", "--output", outputDir], projectDir, {
      env: COMPILE_ENV,
    });

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

    const { exitCode, combined } = await runCLI(["compile", "--output", outputDir], projectDir, {
      env: COMPILE_ENV,
    });

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

      const { exitCode, stdout } = await runCLI(["compile", "--output", outputDir], projectDir, {
        env: COMPILE_ENV,
      });

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

      const { exitCode, stdout } = await runCLI(["compile", "--output", outputDir], projectDir, {
        env: COMPILE_ENV,
      });

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

      const { exitCode, combined } = await runCLI(["compile", "--output", outputDir], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("missing metadata.yaml");
      expect(combined).toContain("Discovered 1 local skills");
    });
  });

  describe("help output", () => {
    it("should display help with expected flags and description", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await mkdir(projectDir, { recursive: true });

      const { exitCode, stdout } = await runCLI(["compile", "--help"], projectDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("Compile agents");
      expect(stdout).toContain("--output");
      expect(stdout).toContain("--verbose");
      expect(stdout).toContain("--source");
    });
  });

  describe("missing skills directory", () => {
    it("should exit with error when .claude/skills/ directory does not exist", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      const outputDir = path.join(tempDir, "output");
      // Create project with .claude/ but no skills/ subdirectory
      await mkdir(path.join(projectDir, CLAUDE_DIR), { recursive: true });
      await mkdir(outputDir, { recursive: true });

      const { exitCode, combined } = await runCLI(["compile", "--output", outputDir], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("No skills found");
    });
  });

  describe("output directory with existing files", () => {
    it("should write compiled agents alongside pre-existing files", async () => {
      tempDir = await createTempDir();
      const { projectDir, outputDir } = await createMinimalProject(tempDir);

      // Place a pre-existing file in the output directory
      const preExistingFile = "existing-notes.txt";
      await writeFile(path.join(outputDir, preExistingFile), "pre-existing content");

      const { exitCode } = await runCLI(["compile", "--output", outputDir], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const outputFiles = await listFiles(outputDir);

      // Pre-existing file should still be present
      expect(outputFiles).toContain(preExistingFile);

      // Compiled agent files should also be present
      expect(outputFiles).toContain("web-developer.md");
      expect(outputFiles).toContain("api-developer.md");
    });
  });

  describe("agent YAML content verification", () => {
    it("should produce agents with valid YAML frontmatter fields", async () => {
      tempDir = await createTempDir();
      const { projectDir, outputDir } = await createMinimalProject(tempDir);

      const { exitCode } = await runCLI(["compile", "--output", outputDir], projectDir, {
        env: COMPILE_ENV,
      });

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

      const { exitCode } = await runCLI(["compile", "--output", outputDir], projectDir, {
        env: COMPILE_ENV,
      });

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

    it("should produce distinct content for each compiled agent", async () => {
      tempDir = await createTempDir();
      const { projectDir, outputDir } = await createMinimalProject(tempDir);

      const { exitCode } = await runCLI(["compile", "--output", outputDir], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const webDevContent = await readTestFile(path.join(outputDir, "web-developer.md"));
      const apiDevContent = await readTestFile(path.join(outputDir, "api-developer.md"));

      // Each agent file should have its own name: field in frontmatter
      expect(webDevContent).toContain("name: web-developer");
      expect(apiDevContent).toContain("name: api-developer");

      // The two files should not be identical — different agents have different content
      expect(webDevContent).not.toBe(apiDevContent);
    });
  });

  describe("custom skills in project config", () => {
    it("should compile agents with custom skills in config", async () => {
      tempDir = await createTempDir();
      const { projectDir, outputDir } = await createProjectWithCustomSkill(tempDir);

      const { exitCode, stdout } = await runCLI(["compile", "--output", outputDir], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toMatch(/Compiled \d+ agents/);

      const outputFiles = await listFiles(outputDir);
      expect(outputFiles.length).toBeGreaterThan(0);
      expect(outputFiles).toContain("web-developer.md");
    });

    it("should include custom skill in compiled agent frontmatter", async () => {
      tempDir = await createTempDir();
      const { projectDir, outputDir } = await createProjectWithCustomSkill(tempDir);

      const { exitCode } = await runCLI(["compile", "--output", outputDir], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const webDevPath = path.join(outputDir, "web-developer.md");
      expect(await fileExists(webDevPath)).toBe(true);

      const content = await readTestFile(webDevPath);

      // The custom skill is assigned as preloaded in the stack config,
      // so it should appear in the YAML frontmatter skills list
      expect(content).toMatch(/^---\n/);
      expect(content).toContain("web-custom-e2e-widget");
    });
  });

  describe("source flag override", () => {
    let sourceTempDir: string;

    afterEach(async () => {
      if (sourceTempDir) {
        await cleanupTempDir(sourceTempDir);
        sourceTempDir = undefined!;
      }
    });

    it("should compile using --source flag to override source resolution", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      const outputDir = path.join(tempDir, "output");
      await mkdir(outputDir, { recursive: true });

      // Create a local skill in the project
      await createLocalSkill(projectDir, "web-testing-e2e-source-flag", {
        description: "Skill for --source flag verification",
        metadata: `author: "@test"\ncontentHash: "hash-source-flag"\n`,
      });

      // Create an E2E source directory (provides agent definitions + templates)
      const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
      sourceTempDir = srcTempDir;

      const { exitCode, stdout } = await runCLI(
        ["compile", "--output", outputDir, "--source", sourceDir],
        projectDir,
        { env: COMPILE_ENV },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Discovered 1 local skills");
      expect(stdout).toContain("Source: flag");
      expect(stdout).toMatch(/Compiled \d+ agents/);

      const outputFiles = await listFiles(outputDir);
      expect(outputFiles.length).toBeGreaterThan(0);
    });
  });

  describe("--agent-source flag", () => {
    let sourceTempDir: string;

    afterEach(async () => {
      if (sourceTempDir) {
        await cleanupTempDir(sourceTempDir);
        sourceTempDir = undefined!;
      }
    });

    it("should compile using --agent-source flag to load agent definitions from custom path", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      const outputDir = path.join(tempDir, "output");
      await mkdir(outputDir, { recursive: true });

      // Create a local skill in the project
      await createLocalSkill(projectDir, "web-testing-e2e-agent-source", {
        description: "Skill for --agent-source flag verification",
        metadata: `author: "@test"\ncontentHash: "hash-agent-source"\n`,
      });

      // Create an E2E source directory (provides agent definitions + templates)
      const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
      sourceTempDir = srcTempDir;

      const { exitCode, stdout } = await runCLI(
        ["compile", "--output", outputDir, "--agent-source", sourceDir],
        projectDir,
        { env: COMPILE_ENV },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Discovered 1 local skills");
      expect(stdout).toContain("Fetching agent partials...");
      expect(stdout).toContain("Agent partials fetched");
      expect(stdout).toMatch(/Compiled \d+ agents/);

      const outputFiles = await listFiles(outputDir);
      expect(outputFiles.length).toBeGreaterThan(0);

      const mdFiles = outputFiles.filter((f) => f.endsWith(".md"));
      expect(mdFiles.length).toBeGreaterThan(0);
    });
  });

  describe("global installation fallback", () => {
    // BUG: compile detects global installation via detectInstallation() but then calls
    // discoverAllSkills() with process.cwd() (the project dir) instead of installation.projectDir
    // (the global home). Skills are at globalHome/.claude/skills/ but compile looks at cwd/.claude/skills/.
    it.fails("should use global installation paths when no project config exists", async () => {
      tempDir = await createTempDir();

      // Create a "global home" directory with .claude-src/config.ts and .claude/skills/
      const globalHome = path.join(tempDir, "global-home");
      const globalConfigDir = path.join(globalHome, CLAUDE_SRC_DIR);
      await mkdir(globalConfigDir, { recursive: true });
      await writeFile(
        path.join(globalConfigDir, STANDARD_FILES.CONFIG_TS),
        `export default ${JSON.stringify(
          {
            name: "global-test",
            skills: [{ id: "web-testing-e2e-global", scope: "project", source: "local" }],
            agents: ["web-developer"],
          },
          null,
          2,
        )};\n`,
      );

      // Create a local skill in the global home directory
      await createLocalSkill(globalHome, "web-testing-e2e-global", {
        description: "Global skill for compile fallback",
        metadata: `author: "@test"\ncontentHash: "hash-global"\n`,
      });

      // Create a project directory WITHOUT config
      const projectDir = path.join(tempDir, "project");
      await mkdir(projectDir, { recursive: true });

      // Run compile with HOME pointing to globalHome so detectInstallation falls back to global
      // compile without --output uses detectInstallation() which falls back to global
      const { exitCode, combined } = await runCLI(["compile"], projectDir, {
        env: { HOME: globalHome, AGENTSINC_SOURCE: undefined },
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // When using global installation, compile logs this message
      expect(combined).toContain("Using global installation from ~/.claude-src/");
    });
  });
});
