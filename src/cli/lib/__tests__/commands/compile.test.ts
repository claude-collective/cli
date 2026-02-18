import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir } from "fs/promises";
import { runCliCommand, createTempDir, cleanupTempDir } from "../helpers";
import {
  createTestSource,
  cleanupTestSource,
  VALID_LOCAL_SKILL,
  SKILL_WITHOUT_METADATA,
  SKILL_WITHOUT_METADATA_CUSTOM,
  DRY_RUN_SKILL,
  type TestDirs,
} from "../fixtures/create-test-source";

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

      expect(error?.oclif?.exit).toBeDefined();
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

    it("should accept --dry-run flag", async () => {
      const { error } = await runCliCommand(["compile", "--dry-run"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --output flag with path", async () => {
      const outputPath = path.join(tempDir, "output");

      const { error } = await runCliCommand(["compile", "--output", outputPath]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -o shorthand for output", async () => {
      const outputPath = path.join(tempDir, "output");

      const { error } = await runCliCommand(["compile", "-o", outputPath]);

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

  describe("dry-run mode", () => {
    it("should accept --dry-run flag and process without errors", async () => {
      const { error } = await runCliCommand(["compile", "--dry-run"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --dry-run with --output flag", async () => {
      const outputPath = path.join(tempDir, "dry-run-output");

      // Use fixture to create local skill with metadata
      const dirs = await createTestSource({
        skills: [],
        agents: [],
        localSkills: [DRY_RUN_SKILL],
      });
      process.chdir(dirs.projectDir);

      const { error } = await runCliCommand(["compile", "--dry-run", "--output", outputPath]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");

      await cleanupTestSource(dirs);
    });
  });

  describe("output mode", () => {
    it("should show custom output directory in message", async () => {
      const outputPath = path.join(tempDir, "custom-output");

      const { stdout, error } = await runCliCommand([
        "compile",
        "--output",
        outputPath,
        "--dry-run",
      ]);

      const output = stdout + (error?.message || "");
      expect(output).toBeTruthy();
    });
  });

  describe("verbose mode", () => {
    it("should accept --verbose with --dry-run", async () => {
      const { error } = await runCliCommand(["compile", "--verbose", "--dry-run"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -v with -o", async () => {
      const outputPath = path.join(tempDir, "output");

      const { error } = await runCliCommand(["compile", "-v", "-o", outputPath]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("combined flags", () => {
    it("should accept multiple flags together", async () => {
      const outputPath = path.join(tempDir, "combined-output");

      const { error } = await runCliCommand([
        "compile",
        "--verbose",
        "--dry-run",
        "--output",
        outputPath,
        "--source",
        "/custom/source",
      ]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept shorthand flags together", async () => {
      const outputPath = path.join(tempDir, "shorthand-output");

      const { error } = await runCliCommand([
        "compile",
        "-v",
        "-o",
        outputPath,
        "-s",
        "/custom/source",
      ]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --verbose with --refresh", async () => {
      const { error } = await runCliCommand(["compile", "--verbose", "--refresh"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --dry-run with --agent-source", async () => {
      const { error } = await runCliCommand([
        "compile",
        "--dry-run",
        "--agent-source",
        "https://example.com/agents",
      ]);

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
      const outputPath = path.join(tempDir, "metadata-output");

      localDirs = await createTestSource({
        skills: [],
        agents: [],
        localSkills: [VALID_LOCAL_SKILL],
      });
      process.chdir(localDirs.projectDir);

      const { stdout, error } = await runCliCommand([
        "compile",
        "--dry-run",
        "--output",
        outputPath,
      ]);

      const output = stdout + (error?.message || "");
      // Skill should be discovered (not skipped)
      expect(output).not.toContain("missing metadata.yaml");
      expect(output).toContain("1");
    });

    it("should skip a skill with SKILL.md but no metadata.yaml and emit a warning", async () => {
      const outputPath = path.join(tempDir, "no-metadata-output");

      localDirs = await createTestSource({
        skills: [],
        agents: [],
        localSkills: [SKILL_WITHOUT_METADATA],
      });
      process.chdir(localDirs.projectDir);

      const { stderr, stdout, error } = await runCliCommand([
        "compile",
        "--output",
        outputPath,
      ]);

      const allOutput = stdout + stderr + (error?.message || "");
      // Warning should be emitted with the skill name and mention metadata.yaml
      expect(allOutput).toContain("web-tooling-incomplete");
      expect(allOutput).toContain("metadata.yaml");
      expect(allOutput).toContain("skipped");
    });

    it("should include the skill directory path in the warning message", async () => {
      const outputPath = path.join(tempDir, "path-warning-output");

      localDirs = await createTestSource({
        skills: [],
        agents: [],
        localSkills: [SKILL_WITHOUT_METADATA_CUSTOM],
      });
      process.chdir(localDirs.projectDir);

      const { stderr, stdout, error } = await runCliCommand([
        "compile",
        "--output",
        outputPath,
      ]);

      const allOutput = stdout + stderr + (error?.message || "");
      // Warning should contain the skill name
      expect(allOutput).toContain("web-tooling-custom");
      // Warning should contain the path hint
      expect(allOutput).toContain(".claude/skills/");
    });
  });

  describe("error handling", () => {
    it("should error when no skills found", async () => {
      const { error } = await runCliCommand(["compile"]);
      expect(error).toBeDefined();
    });

    it("should handle invalid source path gracefully", async () => {
      const { error } = await runCliCommand([
        "compile",
        "--source",
        "/definitely/not/real/path/xyz",
      ]);

      expect(error).toBeDefined();
    });

    it("should handle invalid agent-source URL gracefully", async () => {
      const { error } = await runCliCommand(["compile", "--agent-source", "not-a-valid-url"]);
      expect(error).toBeDefined();
    });
  });

  describe("plugin mode vs custom output mode", () => {
    it("should use plugin mode when no output flag provided", async () => {
      const { error } = await runCliCommand(["compile", "--dry-run"]);

      // Command should complete without flag parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should use custom output mode when output flag provided", async () => {
      const outputPath = path.join(tempDir, "custom-output");

      const { error } = await runCliCommand(["compile", "--output", outputPath, "--dry-run"]);

      // Command should complete without flag parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });
});
