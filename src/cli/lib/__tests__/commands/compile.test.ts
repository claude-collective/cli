import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, readdir, readFile } from "fs/promises";
import {
  runCliCommand,
  createTempDir,
  cleanupTempDir,
  buildTestProjectConfig,
  directoryExists,
  fileExists,
} from "../helpers";
import { EXIT_CODES } from "../../exit-codes";
import { createTestSource, cleanupTestSource, type TestDirs } from "../fixtures/create-test-source";
import {
  VALID_LOCAL_SKILL,
  SKILL_WITHOUT_METADATA,
  SKILL_WITHOUT_METADATA_CUSTOM,
} from "../mock-data/mock-skills";
import { CLAUDE_DIR } from "../../../consts";

describe("compile command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-compile-test-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  describe("basic execution", () => {
    it("should run without arguments", async () => {
      const { error } = await runCliCommand(["compile"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should fail when no plugin exists", async () => {
      const { error } = await runCliCommand(["compile"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.ERROR);
    });
  });

  describe("flag validation", () => {
    it("should accept --verbose flag", async () => {
      const { error } = await runCliCommand(["compile", "--verbose"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -v shorthand for verbose", async () => {
      const { error } = await runCliCommand(["compile", "-v"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --source flag", async () => {
      const { error } = await runCliCommand(["compile", "--source", "/some/path"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -s shorthand for source", async () => {
      const { error } = await runCliCommand(["compile", "-s", "/some/path"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --agent-source flag", async () => {
      const { error } = await runCliCommand([
        "compile",
        "--agent-source",
        "https://example.com/agents",
      ]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --refresh flag", async () => {
      const { error } = await runCliCommand(["compile", "--refresh"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("combined flags", () => {
    it("should accept multiple flags together", async () => {
      const { error } = await runCliCommand(["compile", "--verbose", "--source", "/custom/source"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept shorthand flags together", async () => {
      const { error } = await runCliCommand(["compile", "-v", "-s", "/custom/source"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --verbose with --refresh", async () => {
      const { error } = await runCliCommand(["compile", "--verbose", "--refresh"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("metadata.yaml requirement for local skills", () => {
    let localDirs: TestDirs;

    afterEach(async () => {
      if (localDirs) {
        await cleanupTestSource(localDirs);
      }
    });

    it("should include a skill that has both SKILL.md and metadata.yaml", async () => {
      localDirs = await createTestSource({
        skills: [],
        agents: [],
        localSkills: [VALID_LOCAL_SKILL],
        projectConfig: buildTestProjectConfig([], []),
        asPlugin: true,
      });
      process.chdir(localDirs.projectDir);

      const { stdout, error } = await runCliCommand(["compile"]);

      const output = stdout + (error?.message || "");
      // Skill should be discovered (not skipped)
      expect(output).not.toContain("missing metadata.yaml");
      expect(output).toContain("Discovered 1 local skill");
    });

    it("should skip a skill with SKILL.md but no metadata.yaml and emit a warning", async () => {
      localDirs = await createTestSource({
        skills: [],
        agents: [],
        localSkills: [SKILL_WITHOUT_METADATA],
        projectConfig: buildTestProjectConfig([], []),
        asPlugin: true,
      });
      process.chdir(localDirs.projectDir);

      const { stderr, stdout, error } = await runCliCommand(["compile"]);

      const allOutput = stdout + stderr + (error?.message || "");
      // Warning should be emitted with the skill name and mention metadata.yaml
      expect(allOutput).toContain("web-tooling-incomplete");
      expect(allOutput).toContain("metadata.yaml");
      expect(allOutput).toContain("skipped");
    });

    it("should include the skill directory path in the warning message", async () => {
      localDirs = await createTestSource({
        skills: [],
        agents: [],
        localSkills: [SKILL_WITHOUT_METADATA_CUSTOM],
        projectConfig: buildTestProjectConfig([], []),
        asPlugin: true,
      });
      process.chdir(localDirs.projectDir);

      const { stderr, stdout, error } = await runCliCommand(["compile"]);

      const allOutput = stdout + stderr + (error?.message || "");
      // Warning should contain the skill name
      expect(allOutput).toContain("web-tooling-custom");
      // Warning should contain the path hint
      expect(allOutput).toContain(".claude/skills/");
    });
  });

  describe("compilation output", () => {
    let localDirs: TestDirs;

    afterEach(async () => {
      if (localDirs) {
        await cleanupTestSource(localDirs);
      }
    });

    it("should produce compiled agent files in .claude/agents/", async () => {
      localDirs = await createTestSource({
        localSkills: [VALID_LOCAL_SKILL],
        projectConfig: buildTestProjectConfig(["web-developer", "api-developer"], []),
        asPlugin: true,
      });
      process.chdir(localDirs.projectDir);

      const { stdout, error } = await runCliCommand(["compile"]);

      const output = stdout + (error?.message || "");
      expect(output).toContain("Recompiled");
      expect(output).toContain("compile complete");

      const agentsDir = path.join(localDirs.projectDir, CLAUDE_DIR, "agents");
      expect(await directoryExists(agentsDir)).toBe(true);

      const entries = await readdir(agentsDir);
      expect(entries).toContain("web-developer.md");
      expect(entries).toContain("api-developer.md");
    });

    it("should produce non-empty agent markdown files with frontmatter", async () => {
      localDirs = await createTestSource({
        localSkills: [VALID_LOCAL_SKILL],
        projectConfig: buildTestProjectConfig(["web-developer"], []),
        asPlugin: true,
      });
      process.chdir(localDirs.projectDir);

      await runCliCommand(["compile"]);

      const agentPath = path.join(localDirs.projectDir, CLAUDE_DIR, "agents", "web-developer.md");
      expect(await fileExists(agentPath)).toBe(true);

      const content = await readFile(agentPath, "utf-8");
      // Compiled agent should have YAML frontmatter with agent metadata
      expect(content).toContain("---");
      expect(content).toContain("name: web-developer");
      expect(content).toContain("description:");
    });

    it("should report discovery and compilation counts in output", async () => {
      localDirs = await createTestSource({
        localSkills: [VALID_LOCAL_SKILL],
        projectConfig: buildTestProjectConfig(["web-developer"], []),
        asPlugin: true,
      });
      process.chdir(localDirs.projectDir);

      const { stdout, error } = await runCliCommand(["compile"]);

      const output = stdout + (error?.message || "");
      expect(output).toContain("Discovered 1 local skill");
      expect(output).toMatch(/Recompiled \d+ project agent/);
    });
  });

  describe("error handling", () => {
    it("should error when no skills found", async () => {
      const { error } = await runCliCommand(["compile"]);
      expect(error?.oclif?.exit).toBe(EXIT_CODES.ERROR);
    });

    it("should include actionable guidance in error message", async () => {
      const { error } = await runCliCommand(["compile"]);
      // Without installation, command errors with guidance to run init first
      expect(error?.message).toContain("No installation found");
    });

    it("should handle invalid source path gracefully", async () => {
      const { error } = await runCliCommand([
        "compile",
        "--source",
        "/definitely/not/real/path/xyz",
      ]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.ERROR);
    });

    it("should handle invalid agent-source URL gracefully", async () => {
      const { error } = await runCliCommand(["compile", "--agent-source", "not-a-valid-url"]);
      expect(error?.oclif?.exit).toBe(EXIT_CODES.ERROR);
    });
  });
});
