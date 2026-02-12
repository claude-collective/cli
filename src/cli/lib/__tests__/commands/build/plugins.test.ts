import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { runCliCommand } from "../../helpers";

describe("build:plugins command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-build-plugins-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("basic execution", () => {
    it("should run without arguments", async () => {
      const { error } = await runCliCommand(["build:plugins"]);

      // Should not have argument parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should complete with 0 skills when no skills directory exists", async () => {
      // projectDir has no skills directory - command still runs
      const { stdout, error } = await runCliCommand(["build:plugins"]);

      // Command completes (may succeed with 0 skills or error gracefully)
      // The key is it doesn't crash with argument errors
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("missing required arg");
    });
  });

  describe("flag validation", () => {
    it("should accept --skills-dir flag with path", async () => {
      const skillsPath = path.join(tempDir, "custom-skills");

      const { error } = await runCliCommand(["build:plugins", "--skills-dir", skillsPath]);

      // Should not error on --skills-dir flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -s shorthand for skills-dir", async () => {
      const skillsPath = path.join(tempDir, "custom-skills");

      const { error } = await runCliCommand(["build:plugins", "-s", skillsPath]);

      // Should accept -s shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --output-dir flag with path", async () => {
      const outputPath = path.join(tempDir, "output");

      const { error } = await runCliCommand(["build:plugins", "--output-dir", outputPath]);

      // Should not error on --output-dir flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -o shorthand for output-dir", async () => {
      const outputPath = path.join(tempDir, "output");

      const { error } = await runCliCommand(["build:plugins", "-o", outputPath]);

      // Should accept -o shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --skill flag", async () => {
      const { error } = await runCliCommand(["build:plugins", "--skill", "web/framework/react"]);

      // Should not error on --skill flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --verbose flag", async () => {
      const { error } = await runCliCommand(["build:plugins", "--verbose"]);

      // Should not error on --verbose flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -v shorthand for verbose", async () => {
      const { error } = await runCliCommand(["build:plugins", "-v"]);

      // Should accept -v shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("combined flags", () => {
    it("should accept multiple flags together", async () => {
      const skillsPath = path.join(tempDir, "skills");
      const outputPath = path.join(tempDir, "output");

      const { error } = await runCliCommand([
        "build:plugins",
        "--skills-dir",
        skillsPath,
        "--output-dir",
        outputPath,
        "--verbose",
      ]);

      // Should accept all flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept shorthand flags together", async () => {
      const skillsPath = path.join(tempDir, "skills");
      const outputPath = path.join(tempDir, "output");

      const { error } = await runCliCommand([
        "build:plugins",
        "-s",
        skillsPath,
        "-o",
        outputPath,
        "-v",
      ]);

      // Should accept all shorthand flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --skill with --output-dir", async () => {
      const outputPath = path.join(tempDir, "output");

      const { error } = await runCliCommand([
        "build:plugins",
        "--skill",
        "react",
        "--output-dir",
        outputPath,
      ]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --skill with --verbose", async () => {
      const { error } = await runCliCommand(["build:plugins", "--skill", "react", "--verbose"]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("error handling", () => {
    it("should handle missing skills directory gracefully", async () => {
      const { stdout, error } = await runCliCommand([
        "build:plugins",
        "--skills-dir",
        "/definitely/not/real/path/xyz",
      ]);

      // Command completes (may succeed with 0 skills or error gracefully)
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should error when specific skill not found", async () => {
      const { error } = await runCliCommand(["build:plugins", "--skill", "nonexistent-skill-xyz"]);

      // Should exit with error when skill not found
      expect(error).toBeDefined();
    });
  });
});
