/**
 * Integration tests for version:bump command.
 *
 * Tests: cc version:bump <type>
 *
 * The version:bump command increments the plugin version by a specified
 * bump type (major, minor, or patch). It uses `bumpPluginVersion` from
 * plugin-version.ts which reads, increments, and writes plugin.json.
 *
 * Note: stdout capture is limited in oclif test environment, so tests focus on:
 * - Command execution (no unhandled errors)
 * - Argument validation (valid/invalid bump types)
 * - Exit codes
 * - File system verification (plugin.json contents after bump)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { runCliCommand } from "../../helpers";

// =============================================================================
// Constants
// =============================================================================

const EXIT_CODE_ERROR = 1;
const EXIT_CODE_INVALID_ARGS = 2;

// =============================================================================
// Test Setup
// =============================================================================

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

  // ===========================================================================
  // Argument Validation
  // ===========================================================================

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

      expect(error?.oclif?.exit).toBe(EXIT_CODE_INVALID_ARGS);
    });

    it("should reject invalid bump type 'invalid'", async () => {
      const { error } = await runCliCommand(["version:bump", "invalid"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODE_INVALID_ARGS);
    });
  });

  // ===========================================================================
  // Version Incrementing
  // ===========================================================================

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

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("error handling", () => {
    it("should error when no plugin.json found", async () => {
      const { error } = await runCliCommand(["version:bump", "patch"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODE_ERROR);
    });
  });

  // ===========================================================================
  // Dry Run
  // ===========================================================================

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
