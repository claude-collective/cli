/**
 * Integration tests for version:show command.
 *
 * Tests: cc version:show
 *
 * The version:show command displays the current plugin version.
 * It looks for plugin.json in .claude-plugin/ directory starting from
 * current directory and walking up to parent directories.
 *
 * Note: stdout capture is limited in oclif test environment, so tests focus on:
 * - Command execution (no unhandled errors)
 * - Error handling when plugin.json is missing
 * - Exit codes
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { runCliCommand } from "../../helpers";

// =============================================================================
// Test Setup
// =============================================================================

describe("version:show command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-version-show-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // Basic Execution
  // ===========================================================================

  describe("basic execution", () => {
    it("should run without arguments", async () => {
      const { error } = await runCliCommand(["version:show"]);

      // Should not error on argument parsing (may error on missing plugin.json)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should error when no plugin.json exists", async () => {
      const { error } = await runCliCommand(["version:show"]);

      // Should error because plugin.json is not found
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should succeed when plugin.json exists", async () => {
      // Create plugin structure
      const pluginDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, "plugin.json"),
        JSON.stringify({
          name: "test-plugin",
          version: "1.2.3",
        }),
      );

      const { error } = await runCliCommand(["version:show"]);

      // Should complete without error
      expect(error?.oclif?.exit).toBeUndefined();
    });
  });

  // ===========================================================================
  // Version Display
  // ===========================================================================

  describe("version display", () => {
    it("should find plugin.json in current directory", async () => {
      // Create plugin structure in current directory
      const pluginDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, "plugin.json"),
        JSON.stringify({
          name: "test-plugin",
          version: "2.0.0",
        }),
      );

      const { error } = await runCliCommand(["version:show"]);

      // Should succeed
      expect(error?.oclif?.exit).toBeUndefined();
    });

    it("should find plugin.json in parent directory", async () => {
      // Create plugin structure in parent (projectDir)
      const pluginDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, "plugin.json"),
        JSON.stringify({
          name: "test-plugin",
          version: "3.0.0",
        }),
      );

      // Create a subdirectory and run from there
      const subDir = path.join(projectDir, "subdirectory");
      await mkdir(subDir, { recursive: true });
      process.chdir(subDir);

      const { error } = await runCliCommand(["version:show"]);

      // Should find plugin.json in parent and succeed
      expect(error?.oclif?.exit).toBeUndefined();
    });

    it("should handle version with prerelease tag", async () => {
      // Create plugin structure with prerelease version
      const pluginDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, "plugin.json"),
        JSON.stringify({
          name: "test-plugin",
          version: "1.0.0-beta.1",
        }),
      );

      const { error } = await runCliCommand(["version:show"]);

      // Should succeed with prerelease version
      expect(error?.oclif?.exit).toBeUndefined();
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("error handling", () => {
    it("should error with helpful message when plugin.json not found", async () => {
      const { error } = await runCliCommand(["version:show"]);

      // Should include helpful error message
      expect(error?.message).toBeDefined();
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should handle malformed plugin.json gracefully", async () => {
      // Create plugin structure with invalid JSON
      const pluginDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(path.join(pluginDir, "plugin.json"), "{ invalid json }");

      const { error } = await runCliCommand(["version:show"]);

      // Should error due to invalid JSON
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should handle missing version field", async () => {
      // Create plugin structure without version field
      const pluginDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, "plugin.json"),
        JSON.stringify({
          name: "test-plugin",
          // version intentionally missing
        }),
      );

      const { error } = await runCliCommand(["version:show"]);

      // May succeed with default version or error - depends on implementation
      // At minimum, should not crash
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("cannot read");
    });
  });

  // ===========================================================================
  // Alias Check
  // ===========================================================================

  describe("command aliases", () => {
    it("should be accessible as version:show", async () => {
      const { error } = await runCliCommand(["version:show"]);

      // Should not error with "command not found"
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("command version:show not found");
    });
  });
});
