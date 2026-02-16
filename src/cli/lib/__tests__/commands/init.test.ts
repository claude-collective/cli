import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { runCliCommand } from "../helpers";

describe("init command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-init-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("flag validation", () => {
    it("should accept --refresh flag", async () => {
      const { error } = await runCliCommand(["init", "--refresh"]);

      // Should not error on --refresh flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --source flag with path", async () => {
      const { error } = await runCliCommand(["init", "--source", "/some/path"]);

      // Should not error on --source flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -s shorthand for source", async () => {
      const { error } = await runCliCommand(["init", "-s", "/some/path"]);

      // Should accept -s shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --dry-run flag", async () => {
      const { error } = await runCliCommand(["init", "--dry-run"]);

      // Should not error on --dry-run flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  describe("combined flags", () => {
    it("should accept multiple flags together", async () => {
      const { error } = await runCliCommand([
        "init",
        "--refresh",
        "--dry-run",
        "--source",
        "/custom/source",
      ]);

      // Should accept all flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept shorthand flags together", async () => {
      const { error } = await runCliCommand(["init", "-s", "/custom/source"]);

      // Should accept shorthand flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("already initialized", () => {
    it("should warn and exit when project is already initialized", async () => {
      // Create a config file that detectExistingInstallation() will find
      const configDir = path.join(projectDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "name: test-project\n");

      const { stdout, stderr, error } = await runCliCommand(["init"]);

      // Should NOT have an error exit code - the command warns and returns
      expect(error?.oclif?.exit).toBeUndefined();

      // this.warn() sends to stderr, this.log() sends to stdout
      const combinedOutput = stdout + stderr + (error?.message || "");
      expect(combinedOutput).toContain("already initialized");
      expect(combinedOutput).toContain("edit");
    });

    it("should not modify existing config when already initialized", async () => {
      // Create a config file that detectExistingInstallation() will find
      const configDir = path.join(projectDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      const configPath = path.join(configDir, "config.yaml");
      await writeFile(configPath, "name: test-project\n");

      await runCliCommand(["init"]);

      // Config file should still exist unchanged
      const { stat } = await import("fs/promises");
      const configStat = await stat(configPath);
      expect(configStat.isFile()).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle invalid source path gracefully", async () => {
      const { error } = await runCliCommand(["init", "--source", "/definitely/not/real/path/xyz"]);

      // Should error but not crash
      expect(error).toBeDefined();
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCliCommand(["init", "--nonexistent-flag"]);

      // Should error on unknown flag
      expect(error).toBeDefined();
    });
  });
});
