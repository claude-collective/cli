import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { runCliCommand } from "../../helpers";

const EXIT_CODE_ERROR = 1;
const EXIT_CODE_INVALID_ARGS = 2;

describe("version command (index)", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-version-index-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should run without arguments", async () => {
    const { error } = await runCliCommand(["version"]);

    // Should not error on argument parsing (may error on missing plugin.json)
    const output = error?.message || "";
    expect(output.toLowerCase()).not.toContain("missing required arg");
    expect(output.toLowerCase()).not.toContain("unexpected argument");
  });

  it("should error when no plugin.json found", async () => {
    const { error } = await runCliCommand(["version"]);

    expect(error?.oclif?.exit).toBe(EXIT_CODE_ERROR);
  });

  it("should succeed when plugin.json exists", async () => {
    const pluginDir = path.join(projectDir, ".claude-plugin");
    await mkdir(pluginDir, { recursive: true });
    await writeFile(
      path.join(pluginDir, "plugin.json"),
      JSON.stringify({ name: "test-plugin", version: "1.0.0" }),
    );

    const { error } = await runCliCommand(["version"]);

    expect(error?.oclif?.exit).toBeUndefined();
  });
});

describe("version:set command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-version-set-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("argument validation", () => {
    it("should accept a valid version argument", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, "plugin.json"),
        JSON.stringify({ name: "test-plugin", version: "1.0.0" }),
      );

      const { error } = await runCliCommand(["version:set", "2.0.0"]);

      expect(error?.oclif?.exit).toBeUndefined();
    });

    it("should reject missing version argument", async () => {
      const { error } = await runCliCommand(["version:set"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODE_INVALID_ARGS);
    });

    it("should reject invalid semver format 'abc'", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, "plugin.json"),
        JSON.stringify({ name: "test-plugin", version: "1.0.0" }),
      );

      const { error } = await runCliCommand(["version:set", "abc"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODE_INVALID_ARGS);
    });

    it("should reject incomplete semver '1.2'", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, "plugin.json"),
        JSON.stringify({ name: "test-plugin", version: "1.0.0" }),
      );

      const { error } = await runCliCommand(["version:set", "1.2"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODE_INVALID_ARGS);
    });

    it("should reject four-segment version '1.2.3.4'", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, "plugin.json"),
        JSON.stringify({ name: "test-plugin", version: "1.0.0" }),
      );

      const { error } = await runCliCommand(["version:set", "1.2.3.4"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODE_INVALID_ARGS);
    });
  });

  describe("file system updates", () => {
    it("should update plugin.json with new version", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      const manifestPath = path.join(pluginDir, "plugin.json");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(manifestPath, JSON.stringify({ name: "test-plugin", version: "1.0.0" }));

      const { error } = await runCliCommand(["version:set", "3.5.7"]);

      expect(error?.oclif?.exit).toBeUndefined();

      // Verify file was updated
      const updated = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(updated.version).toBe("3.5.7");
    });

    it("should preserve other plugin.json fields when setting version", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      const manifestPath = path.join(pluginDir, "plugin.json");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        manifestPath,
        JSON.stringify({ name: "my-plugin", version: "1.0.0", description: "A plugin" }),
      );

      await runCliCommand(["version:set", "2.0.0"]);

      const updated = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(updated.name).toBe("my-plugin");
      expect(updated.version).toBe("2.0.0");
    });
  });

  describe("error handling", () => {
    it("should error when no plugin.json found", async () => {
      const { error } = await runCliCommand(["version:set", "1.0.0"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODE_ERROR);
    });
  });

  describe("--dry-run flag", () => {
    it("should not modify plugin.json with --dry-run", async () => {
      const pluginDir = path.join(projectDir, ".claude-plugin");
      const manifestPath = path.join(pluginDir, "plugin.json");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(manifestPath, JSON.stringify({ name: "test-plugin", version: "1.0.0" }));

      const { error } = await runCliCommand(["version:set", "9.9.9", "--dry-run"]);

      expect(error?.oclif?.exit).toBeUndefined();

      // Verify file was NOT modified
      const unchanged = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(unchanged.version).toBe("1.0.0");
    });
  });
});
