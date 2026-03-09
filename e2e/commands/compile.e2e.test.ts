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
  writeProjectConfig,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { CLAUDE_DIR, STANDARD_DIRS, STANDARD_FILES } from "../../src/cli/consts.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

const COMPILE_ENV = {
  // Prevent source resolution from reading user's global config.
  // Do NOT spread process.env here — execa inherits it automatically,
  // and spreading would clobber the HOME override set by runCLI().
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

  it("should compile agents to default output directory", async () => {
    tempDir = await createTempDir();
    const { projectDir, agentsDir } = await createMinimalProject(tempDir);

    const { exitCode, combined } = await runCLI(["compile"], projectDir, {
      env: COMPILE_ENV,
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(combined).toContain("Compiling global agents");
    expect(combined).toContain("Discovered 1 local skills");
    expect(combined).toMatch(/Recompiled \d+ global agents/);
    expect(combined).toContain("Global compile complete");

    const outputFiles = await listFiles(agentsDir);
    expect(outputFiles.length).toBeGreaterThan(0);

    const mdFiles = outputFiles.filter((f) => f.endsWith(".md"));
    expect(mdFiles.length).toBe(outputFiles.length);

    expect(outputFiles).toContain("web-developer.md");
    expect(outputFiles).toContain("api-developer.md");
  });

  it("should produce valid compiled agent files with frontmatter", async () => {
    tempDir = await createTempDir();
    const { projectDir, agentsDir } = await createMinimalProject(tempDir);

    const { exitCode } = await runCLI(["compile"], projectDir, {
      env: COMPILE_ENV,
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const webDevPath = path.join(agentsDir, "web-developer.md");
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
    const { projectDir, agentsDir } = await createMinimalProject(tempDir);

    const { exitCode, combined } = await runCLI(
      ["compile", "--verbose"],
      projectDir,
      { env: COMPILE_ENV },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(combined).toContain("Recompiled");
  });

  it("should fail when no skills are available", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "empty-project");
    await mkdir(projectDir, { recursive: true });
    await writeProjectConfig(projectDir, { name: "empty", skills: [], agents: [] });

    const { exitCode, combined } = await runCLI(["compile"], projectDir, {
      env: COMPILE_ENV,
    });

    expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    expect(combined).toContain("No skills found");
  });

  describe("multiple skills", () => {
    it("should compile with multiple local skills", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await writeProjectConfig(projectDir, { name: "e2e-test", skills: [], agents: [] });

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

      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      const { exitCode, combined } = await runCLI(["compile"], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("Discovered 3 local skills");
      expect(combined).toMatch(/Recompiled \d+ global agents/);

      const outputFiles = await listFiles(agentsDir);
      expect(outputFiles.length).toBeGreaterThan(0);
    });

    it("should list compiled agent files in verbose mode", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await writeProjectConfig(projectDir, { name: "e2e-test", skills: [], agents: [] });

      await createLocalSkill(projectDir, "web-testing-e2e-content", {
        description: "Skill for compile listing verification",
        metadata: `author: "@test"\ncontentHash: "hash-content"\n`,
      });

      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      const { exitCode, combined } = await runCLI(["compile", "--verbose"], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("Discovered 1 local skills");
      expect(combined).toContain("Compiled:");

      const outputFiles = await listFiles(agentsDir);
      expect(outputFiles.length).toBeGreaterThan(0);
    });
  });

  describe("verbose output", () => {
    it("should show loaded skill names in verbose mode", async () => {
      tempDir = await createTempDir();
      const { projectDir } = await createMinimalProject(tempDir);

      const { exitCode, combined } = await runCLI(
        ["compile", "--verbose"],
        projectDir,
        { env: COMPILE_ENV },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("Loaded skill:");
      expect(combined).toContain("web-testing-e2e-compile");
    });
  });

  describe("invalid skill handling", () => {
    it("should skip skill with missing metadata.yaml", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await writeProjectConfig(projectDir, { name: "e2e-test", skills: [], agents: [] });

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

      const { exitCode, combined } = await runCLI(["compile"], projectDir, {
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
      expect(stdout).toContain("--verbose");
      expect(stdout).toContain("--source");
    });
  });

  describe("missing skills directory", () => {
    it("should exit with error when .claude/skills/ directory does not exist", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      // Create project with .claude/ but no skills/ subdirectory
      await mkdir(path.join(projectDir, CLAUDE_DIR), { recursive: true });
      await writeProjectConfig(projectDir, { name: "empty", skills: [], agents: [] });

      const { exitCode, combined } = await runCLI(["compile"], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("No skills found");
    });
  });

  describe("output directory with existing files", () => {
    it("should write compiled agents alongside pre-existing files", async () => {
      tempDir = await createTempDir();
      const { projectDir, agentsDir } = await createMinimalProject(tempDir);

      // Place a pre-existing file in the agents directory
      const preExistingFile = "existing-notes.txt";
      await mkdir(agentsDir, { recursive: true });
      await writeFile(path.join(agentsDir, preExistingFile), "pre-existing content");

      const { exitCode } = await runCLI(["compile"], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const outputFiles = await listFiles(agentsDir);

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
      const { projectDir, agentsDir } = await createMinimalProject(tempDir);

      const { exitCode } = await runCLI(["compile"], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const outputFiles = await listFiles(agentsDir);
      expect(outputFiles.length).toBeGreaterThan(0);

      for (const file of outputFiles) {
        const content = await readTestFile(path.join(agentsDir, file));

        expect(content).toMatch(/^---\n/);

        const agentName = file.replace(".md", "");
        expect(content).toContain(`name: ${agentName}`);
        expect(content).toContain("description:");
      }
    });

    it("should produce agents with content after frontmatter", async () => {
      tempDir = await createTempDir();
      const { projectDir, agentsDir } = await createMinimalProject(tempDir);

      const { exitCode } = await runCLI(["compile"], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const outputFiles = await listFiles(agentsDir);

      for (const file of outputFiles) {
        const content = await readTestFile(path.join(agentsDir, file));

        expect(content).toMatch(/^---\n/);

        const bodyStartIndex = content.indexOf("---\n", 4);
        const body = content.substring(bodyStartIndex + 4).trim();

        expect(body).toContain("#");
      }
    });

    it("should produce distinct content for each compiled agent", async () => {
      tempDir = await createTempDir();
      const { projectDir, agentsDir } = await createMinimalProject(tempDir);

      const { exitCode } = await runCLI(["compile"], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const webDevContent = await readTestFile(path.join(agentsDir, "web-developer.md"));
      const apiDevContent = await readTestFile(path.join(agentsDir, "api-developer.md"));

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
      const { projectDir, agentsDir } = await createProjectWithCustomSkill(tempDir);

      const { exitCode, combined } = await runCLI(["compile"], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(combined).toMatch(/Recompiled \d+ global agents/);

      const outputFiles = await listFiles(agentsDir);
      expect(outputFiles.length).toBeGreaterThan(0);
      expect(outputFiles).toContain("web-developer.md");
    });

    it("should include custom skill in compiled agent frontmatter", async () => {
      tempDir = await createTempDir();
      const { projectDir, agentsDir } = await createProjectWithCustomSkill(tempDir);

      const { exitCode } = await runCLI(["compile"], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const webDevPath = path.join(agentsDir, "web-developer.md");
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
      await writeProjectConfig(projectDir, { name: "e2e-test", skills: [], agents: [] });

      // Create a local skill in the project
      await createLocalSkill(projectDir, "web-testing-e2e-source-flag", {
        description: "Skill for --source flag verification",
        metadata: `author: "@test"\ncontentHash: "hash-source-flag"\n`,
      });

      // Create an E2E source directory (provides agent definitions + templates)
      const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
      sourceTempDir = srcTempDir;

      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      const { exitCode, combined } = await runCLI(
        ["compile", "--source", sourceDir],
        projectDir,
        { env: COMPILE_ENV },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("Discovered 1 local skills");
      expect(combined).toContain("Source: flag");
      expect(combined).toMatch(/Recompiled \d+ global agents/);

      const outputFiles = await listFiles(agentsDir);
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
      await writeProjectConfig(projectDir, { name: "e2e-test", skills: [], agents: [] });

      // Create a local skill in the project
      await createLocalSkill(projectDir, "web-testing-e2e-agent-source", {
        description: "Skill for --agent-source flag verification",
        metadata: `author: "@test"\ncontentHash: "hash-agent-source"\n`,
      });

      // Create an E2E source directory (provides agent definitions + templates)
      const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
      sourceTempDir = srcTempDir;

      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      const { exitCode, combined } = await runCLI(
        ["compile", "--agent-source", sourceDir],
        projectDir,
        { env: COMPILE_ENV },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("Discovered 1 local skills");
      expect(combined).toContain("Fetching agent partials...");
      expect(combined).toContain("Agent partials fetched");
      expect(combined).toMatch(/Recompiled \d+ global agents/);

      const outputFiles = await listFiles(agentsDir);
      expect(outputFiles.length).toBeGreaterThan(0);

      const mdFiles = outputFiles.filter((f) => f.endsWith(".md"));
      expect(mdFiles.length).toBeGreaterThan(0);
    });
  });

  describe("global installation fallback", () => {
    it("should use global installation paths when no project config exists", async () => {
      tempDir = await createTempDir();

      // Create a "global home" directory with .claude-src/config.ts and .claude/skills/
      const globalHome = path.join(tempDir, "global-home");
      await writeProjectConfig(globalHome, {
        name: "global-test",
        skills: [{ id: "web-testing-e2e-global", scope: "project", source: "local" }],
        agents: [{ name: "web-developer", scope: "project" }],
      });

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
      // When using global installation, dual-pass compile runs the global pass
      expect(combined).toContain("Compiling global agents");
    });
  });
});
