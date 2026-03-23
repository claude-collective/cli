import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  createLocalSkill,
  ensureBinaryExists,
  fileExists,
  listFiles,
  readTestFile,
  renderSkillMd,
  agentsPath,
  writeProjectConfig,
} from "../helpers/test-utils.js";
import { ProjectBuilder } from "../fixtures/project-builder.js";
import { EXIT_CODES, DIRS, FILES } from "../pages/constants.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { CLI } from "../fixtures/cli.js";
import "../matchers/setup.js";

describe("compile command", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  });

  it("should compile agents to default output directory", async () => {
    const project = await ProjectBuilder.minimal();
    tempDir = path.dirname(project.dir);
    const agentsDir = agentsPath(project.dir);

    const { exitCode, output } = await CLI.run(["compile"], { dir: project.dir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(output).toContain("Compiling global agents");
    expect(output).toContain("Discovered 1 local skills");
    expect(output).toMatch(/Recompiled \d+ global agents/);
    expect(output).toContain("Global compile complete");

    const outputFiles = await listFiles(agentsDir);
    expect(outputFiles.length).toBeGreaterThan(0);

    const mdFiles = outputFiles.filter((f) => f.endsWith(".md"));
    expect(mdFiles.length).toBe(outputFiles.length);

    expect(outputFiles).toContain("web-developer.md");
    expect(outputFiles).toContain("api-developer.md");
  });

  it("should produce valid compiled agent files with frontmatter", async () => {
    const project = await ProjectBuilder.minimal();
    tempDir = path.dirname(project.dir);

    const { exitCode } = await CLI.run(["compile"], { dir: project.dir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    await expect({ dir: project.dir }).toHaveCompiledAgent("web-developer");
    await expect({ dir: project.dir }).toHaveCompiledAgentContent("web-developer", {
      contains: ["name: web-developer", "description:", "tools:", "model:", "#"],
    });

    // Verify substantial content
    const content = await readTestFile(path.join(agentsPath(project.dir), "web-developer.md"));
    const MIN_COMPILED_AGENT_LENGTH = 500;
    expect(content.length).toBeGreaterThan(MIN_COMPILED_AGENT_LENGTH);
  });

  it("should support --verbose flag", async () => {
    const project = await ProjectBuilder.minimal();
    tempDir = path.dirname(project.dir);

    const { exitCode, output } = await CLI.run(["compile", "--verbose"], { dir: project.dir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(output).toContain("Recompiled");
  });

  it("should fail when no skills are available", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "empty-project");
    await mkdir(projectDir, { recursive: true });
    await writeProjectConfig(projectDir, { name: "empty", skills: [], agents: [] });

    const { exitCode, output } = await CLI.run(["compile"], { dir: projectDir });

    expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    expect(output).toContain("No skills found");
  });

  describe("multiple skills", () => {
    it("should compile with multiple local skills", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await writeProjectConfig(projectDir, { name: "e2e-test", skills: [], agents: [] });

      await createLocalSkill(projectDir, "web-testing-react-testing-library", {
        description: "First test skill",
        metadata: `author: "@test"\ncontentHash: "hash-first"\n`,
      });
      await createLocalSkill(projectDir, "web-testing-vue-test-utils", {
        description: "Second test skill",
        metadata: `author: "@test"\ncontentHash: "hash-second"\n`,
      });
      await createLocalSkill(projectDir, "web-mocks-msw", {
        description: "Third test skill",
        metadata: `author: "@test"\ncontentHash: "hash-third"\n`,
      });

      const agentsDir = agentsPath(projectDir);
      const { exitCode, output } = await CLI.run(["compile"], { dir: projectDir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("Discovered 3 local skills");
      expect(output).toMatch(/Recompiled \d+ global agents/);

      const outputFiles = await listFiles(agentsDir);
      expect(outputFiles.length).toBeGreaterThan(0);
    });

    it("should list compiled agent files in verbose mode", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await writeProjectConfig(projectDir, { name: "e2e-test", skills: [], agents: [] });

      await createLocalSkill(projectDir, "web-forms-zod-validation", {
        description: "Skill for compile listing verification",
        metadata: `author: "@test"\ncontentHash: "hash-content"\n`,
      });

      const agentsDir = agentsPath(projectDir);
      const { exitCode, output } = await CLI.run(["compile", "--verbose"], { dir: projectDir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("Discovered 1 local skills");
      expect(output).toContain("Compiled:");

      const outputFiles = await listFiles(agentsDir);
      expect(outputFiles.length).toBeGreaterThan(0);
    });
  });

  describe("verbose output", () => {
    it("should show loaded skill names in verbose mode", async () => {
      const project = await ProjectBuilder.minimal();
      tempDir = path.dirname(project.dir);

      const { exitCode, output } = await CLI.run(["compile", "--verbose"], { dir: project.dir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("Loaded skill:");
      expect(output).toContain("web-testing-vitest");
    });
  });

  describe("invalid skill handling", () => {
    it("should skip skill with missing metadata.yaml", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await writeProjectConfig(projectDir, { name: "e2e-test", skills: [], agents: [] });

      // Create a valid skill
      await createLocalSkill(projectDir, "web-state-jotai", {
        description: "Valid skill",
        metadata: `author: "@test"\ncontentHash: "hash-valid"\n`,
      });

      const invalidSkillDir = path.join(projectDir, DIRS.CLAUDE, DIRS.SKILLS, "web-state-mobx");
      await mkdir(invalidSkillDir, { recursive: true });
      await writeFile(
        path.join(invalidSkillDir, FILES.SKILL_MD),
        renderSkillMd("web-state-mobx", "Missing metadata", "# No Metadata"),
      );

      const { exitCode, output } = await CLI.run(["compile"], { dir: projectDir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("missing metadata.yaml");
      expect(output).toContain("Discovered 1 local skills");
    });
  });

  describe("help output", () => {
    it("should display help with expected flags and description", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await mkdir(projectDir, { recursive: true });

      const { exitCode, stdout } = await CLI.run(["compile", "--help"], { dir: projectDir });

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
      await mkdir(path.join(projectDir, DIRS.CLAUDE), { recursive: true });
      await writeProjectConfig(projectDir, { name: "empty", skills: [], agents: [] });

      const { exitCode, output } = await CLI.run(["compile"], { dir: projectDir });

      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("No skills found");
    });
  });

  describe("output directory with existing files", () => {
    it("should write compiled agents alongside pre-existing files", async () => {
      const project = await ProjectBuilder.minimal();
      tempDir = path.dirname(project.dir);
      const projectDir = project.dir;
      const agentsDir = agentsPath(project.dir);

      // Place a pre-existing file in the agents directory
      const preExistingFile = "existing-notes.txt";
      await mkdir(agentsDir, { recursive: true });
      await writeFile(path.join(agentsDir, preExistingFile), "pre-existing content");

      const { exitCode } = await CLI.run(["compile"], { dir: projectDir });

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
      const project = await ProjectBuilder.minimal();
      tempDir = path.dirname(project.dir);
      const agentsDir = agentsPath(project.dir);

      const { exitCode } = await CLI.run(["compile"], { dir: project.dir });

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
      const project = await ProjectBuilder.minimal();
      tempDir = path.dirname(project.dir);
      const agentsDir = agentsPath(project.dir);

      const { exitCode } = await CLI.run(["compile"], { dir: project.dir });

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
      const project = await ProjectBuilder.minimal();
      tempDir = path.dirname(project.dir);
      const agentsDir = agentsPath(project.dir);

      const { exitCode } = await CLI.run(["compile"], { dir: project.dir });

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
      const project = await ProjectBuilder.withCustomSkill();
      tempDir = path.dirname(project.dir);
      const agentsDir = agentsPath(project.dir);

      const { exitCode, output } = await CLI.run(["compile"], { dir: project.dir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toMatch(/Recompiled \d+ global agents/);

      const outputFiles = await listFiles(agentsDir);
      expect(outputFiles.length).toBeGreaterThan(0);
      expect(outputFiles).toContain("web-developer.md");
    });

    it("should include custom skill in compiled agent frontmatter", async () => {
      const project = await ProjectBuilder.withCustomSkill();
      tempDir = path.dirname(project.dir);

      const { exitCode } = await CLI.run(["compile"], { dir: project.dir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // The custom skill is assigned as preloaded in the stack config,
      // so it should appear in the YAML frontmatter skills list
      await expect({ dir: project.dir }).toHaveCompiledAgent("web-developer");
      await expect({ dir: project.dir }).toHaveCompiledAgentContent("web-developer", {
        contains: ["web-custom-e2e-widget"],
      });
    });
  });

  describe("source flag override", () => {
    let sourceTempDir: string;

    afterEach(async () => {
      if (sourceTempDir) {
        await cleanupTempDir(sourceTempDir);
      }
    });

    it("should compile using --source flag to override source resolution", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await writeProjectConfig(projectDir, { name: "e2e-test", skills: [], agents: [] });

      // Create a local skill in the project
      await createLocalSkill(projectDir, "web-state-pinia", {
        description: "Skill for --source flag verification",
        metadata: `author: "@test"\ncontentHash: "hash-source-flag"\n`,
      });

      // Create an E2E source directory (provides agent definitions + templates)
      const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
      sourceTempDir = srcTempDir;

      const agentsDir = agentsPath(projectDir);
      const { exitCode, output } = await CLI.run(["compile", "--source", sourceDir], {
        dir: projectDir,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("Discovered 1 local skills");
      expect(output).toContain("Source: flag");
      expect(output).toMatch(/Recompiled \d+ global agents/);

      const outputFiles = await listFiles(agentsDir);
      expect(outputFiles.length).toBeGreaterThan(0);
    });
  });

  describe("--agent-source flag", () => {
    let sourceTempDir: string;

    afterEach(async () => {
      if (sourceTempDir) {
        await cleanupTempDir(sourceTempDir);
      }
    });

    it("should compile using --agent-source flag to load agent definitions from custom path", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await writeProjectConfig(projectDir, { name: "e2e-test", skills: [], agents: [] });

      // Create a local skill in the project
      await createLocalSkill(projectDir, "web-state-redux-toolkit", {
        description: "Skill for --agent-source flag verification",
        metadata: `author: "@test"\ncontentHash: "hash-agent-source"\n`,
      });

      // Create an E2E source directory (provides agent definitions + templates)
      const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
      sourceTempDir = srcTempDir;

      const agentsDir = agentsPath(projectDir);
      const { exitCode, output } = await CLI.run(["compile", "--agent-source", sourceDir], {
        dir: projectDir,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("Discovered 1 local skills");
      expect(output).toContain("Fetching agent partials...");
      expect(output).toContain("Agent partials fetched");
      expect(output).toMatch(/Recompiled \d+ global agents/);

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
        skills: [{ id: "web-testing-cypress-e2e", scope: "project", source: "local" }],
        agents: [{ name: "web-developer", scope: "project" }],
      });

      // Create a local skill in the global home directory
      await createLocalSkill(globalHome, "web-testing-cypress-e2e", {
        description: "Global skill for compile fallback",
        metadata: `author: "@test"\ncontentHash: "hash-global"\n`,
      });

      // Create a project directory WITHOUT config
      const projectDir = path.join(tempDir, "project");
      await mkdir(projectDir, { recursive: true });

      // Run compile with HOME pointing to globalHome so detectInstallation falls back to global
      // compile without --output uses detectInstallation() which falls back to global
      const { exitCode, output } = await CLI.run(
        ["compile"],
        { dir: projectDir },
        { env: { HOME: globalHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // When using global installation, dual-pass compile runs the global pass
      expect(output).toContain("Compiling global agents");
    });
  });
});
