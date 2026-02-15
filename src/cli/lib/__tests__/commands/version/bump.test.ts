import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { runCliCommand } from "../../helpers";
import { EXIT_CODES } from "../../../exit-codes";

describe("version:bump command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-version-bump-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("argument validation", () => {
    it("should accept 'patch' bump type", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, "plugin.json"),
        JSON.stringify({ name: "test-plugin", version: "1.0.0" }),
      );

      const { error } = await runCliCommand(["version:bump", "patch"]);

      expect(error?.oclif?.exit).toBeUndefined();
    });

    it("should accept 'minor' bump type", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, "plugin.json"),
        JSON.stringify({ name: "test-plugin", version: "1.0.0" }),
      );

      const { error } = await runCliCommand(["version:bump", "minor"]);

      expect(error?.oclif?.exit).toBeUndefined();
    });

    it("should accept 'major' bump type", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, "plugin.json"),
        JSON.stringify({ name: "test-plugin", version: "1.0.0" }),
      );

      const { error } = await runCliCommand(["version:bump", "major"]);

      expect(error?.oclif?.exit).toBeUndefined();
    });

    it("should reject missing bump type argument", async () => {
      const { error } = await runCliCommand(["version:bump"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
    });

    it("should reject invalid bump type 'invalid'", async () => {
      const { error } = await runCliCommand(["version:bump", "invalid"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
    });
  });

  describe("version incrementing", () => {
    it("should increment patch version (1.0.0 -> 1.0.1)", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      const manifestPath = path.join(pluginDir, "plugin.json");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(manifestPath, JSON.stringify({ name: "test-plugin", version: "1.0.0" }));

      const { error } = await runCliCommand(["version:bump", "patch"]);

      expect(error?.oclif?.exit).toBeUndefined();

      const updated = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(updated.version).toBe("1.0.1");
    });

    it("should increment minor version (1.0.0 -> 1.1.0)", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      const manifestPath = path.join(pluginDir, "plugin.json");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(manifestPath, JSON.stringify({ name: "test-plugin", version: "1.0.0" }));

      const { error } = await runCliCommand(["version:bump", "minor"]);

      expect(error?.oclif?.exit).toBeUndefined();

      const updated = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(updated.version).toBe("1.1.0");
    });

    it("should increment major version (1.0.0 -> 2.0.0)", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      const manifestPath = path.join(pluginDir, "plugin.json");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(manifestPath, JSON.stringify({ name: "test-plugin", version: "1.0.0" }));

      const { error } = await runCliCommand(["version:bump", "major"]);

      expect(error?.oclif?.exit).toBeUndefined();

      const updated = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(updated.version).toBe("2.0.0");
    });
  });

  describe("error handling", () => {
    it("should error when no plugin.json found", async () => {
      const { error } = await runCliCommand(["version:bump", "patch"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.ERROR);
    });
  });

  describe("--dry-run flag", () => {
    it("should not modify plugin.json with --dry-run", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      const manifestPath = path.join(pluginDir, "plugin.json");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(manifestPath, JSON.stringify({ name: "test-plugin", version: "1.0.0" }));

      const { error } = await runCliCommand(["version:bump", "patch", "--dry-run"]);

      expect(error?.oclif?.exit).toBeUndefined();

      // Verify file was NOT modified
      const unchanged = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(unchanged.version).toBe("1.0.0");
    });
  });
});
