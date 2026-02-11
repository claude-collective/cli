/**
 * Integration tests for the uninstall command.
 *
 * Tests: cc uninstall, cc uninstall --yes, cc uninstall --dry-run,
 *        cc uninstall --plugin, cc uninstall --local
 *
 * The uninstall command removes Claude Collective from a project:
 * - Detects plugin dir (.claude/plugins/claude-collective/)
 * - Detects local dirs (.claude/, .claude-src/)
 * - Shows what will be removed
 * - Asks for confirmation (interactive Ink prompt)
 * - Removes directories
 *
 * Tests focus on non-interactive paths to avoid Ink render complexities:
 * - Nothing to uninstall (exits before prompt)
 * - --yes flag (bypasses prompt)
 * - --dry-run flag (previews without prompt)
 * - --plugin / --local flag targeting
 * - Flag validation
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { runCliCommand, directoryExists } from "../helpers";

// =============================================================================
// Mocks
// =============================================================================

vi.mock("../../../utils/exec.js", () => ({
  claudePluginUninstall: vi.fn(),
  isClaudeCLIAvailable: vi.fn().mockResolvedValue(true),
}));

// =============================================================================
// Constants
// =============================================================================

const CLAUDE_DIR = ".claude";
const CLAUDE_SRC_DIR = ".claude-src";
const PLUGIN_SUBPATH = path.join(CLAUDE_DIR, "plugins", "claude-collective");

// =============================================================================
// Helpers
// =============================================================================

async function createPluginDir(projectDir: string): Promise<string> {
  const pluginDir = path.join(projectDir, PLUGIN_SUBPATH);
  await mkdir(pluginDir, { recursive: true });
  return pluginDir;
}

async function createLocalDirs(
  projectDir: string,
): Promise<{ claudeDir: string; claudeSrcDir: string }> {
  const claudeDir = path.join(projectDir, CLAUDE_DIR);
  const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);
  await mkdir(claudeDir, { recursive: true });
  await mkdir(claudeSrcDir, { recursive: true });
  return { claudeDir, claudeSrcDir };
}

// =============================================================================
// Test Setup
// =============================================================================

describe("uninstall command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-uninstall-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // Flag Validation
  // ===========================================================================

  describe("flag validation", () => {
    it("should run without arguments", async () => {
      const { error } = await runCliCommand(["uninstall"]);

      // Should not have argument parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --yes flag", async () => {
      const { error } = await runCliCommand(["uninstall", "--yes"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -y shorthand for yes", async () => {
      const { error } = await runCliCommand(["uninstall", "-y"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --plugin flag", async () => {
      const { error } = await runCliCommand(["uninstall", "--plugin"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --local flag", async () => {
      const { error } = await runCliCommand(["uninstall", "--local"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --dry-run flag", async () => {
      const { error } = await runCliCommand(["uninstall", "--dry-run"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Nothing to Uninstall
  // ===========================================================================

  describe("nothing to uninstall", () => {
    it("should show nothing to uninstall when project is empty", async () => {
      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes"]);

      const output = stdout + stderr;
      expect(output).toContain("Nothing to uninstall");
    });

    it("should show not installed message when no flags specified", async () => {
      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes"]);

      const output = stdout + stderr;
      expect(output).toContain("not installed");
    });

    it("should show no plugin found with --plugin flag", async () => {
      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes", "--plugin"]);

      const output = stdout + stderr;
      expect(output).toContain("No plugin installation found");
    });

    it("should show no local found with --local flag", async () => {
      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes", "--local"]);

      const output = stdout + stderr;
      expect(output).toContain("No local installation found");
    });
  });

  // ===========================================================================
  // Dry Run Mode
  // ===========================================================================

  describe("dry-run mode", () => {
    it("should show preview header in dry-run", async () => {
      await createPluginDir(projectDir);

      const { stdout } = await runCliCommand(["uninstall", "--dry-run"]);

      expect(stdout).toContain("[dry-run]");
      expect(stdout).toContain("Preview mode");
    });

    it("should preview plugin removal in dry-run", async () => {
      await createPluginDir(projectDir);

      const { stdout } = await runCliCommand(["uninstall", "--dry-run"]);

      expect(stdout).toContain("[dry-run] Would uninstall plugin");
      expect(stdout).toContain("[dry-run] Would remove");
      expect(stdout).toContain("Preview complete");
    });

    it("should preview local directory removal in dry-run", async () => {
      await createLocalDirs(projectDir);

      const { stdout } = await runCliCommand(["uninstall", "--dry-run"]);

      expect(stdout).toContain("[dry-run] Would remove");
      expect(stdout).toContain(CLAUDE_DIR);
      expect(stdout).toContain(CLAUDE_SRC_DIR);
    });

    it("should not remove files in dry-run", async () => {
      const pluginDir = await createPluginDir(projectDir);
      const { claudeDir, claudeSrcDir } = await createLocalDirs(projectDir);

      await runCliCommand(["uninstall", "--dry-run"]);

      // Verify nothing was actually removed
      expect(await directoryExists(pluginDir)).toBe(true);
      expect(await directoryExists(claudeDir)).toBe(true);
      expect(await directoryExists(claudeSrcDir)).toBe(true);
    });

    it("should show nothing to uninstall in dry-run when empty", async () => {
      const { stdout, stderr } = await runCliCommand(["uninstall", "--dry-run"]);

      const output = stdout + stderr;
      expect(output).toContain("Nothing to uninstall");
    });
  });

  // ===========================================================================
  // Uninstall with --yes (Plugin)
  // ===========================================================================

  describe("uninstall with --yes (plugin)", () => {
    it("should remove plugin directory", async () => {
      const pluginDir = await createPluginDir(projectDir);

      // Verify plugin exists before uninstall
      expect(await directoryExists(pluginDir)).toBe(true);

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      // Verify plugin was removed
      expect(await directoryExists(pluginDir)).toBe(false);
      expect(stdout).toContain("Plugin uninstalled");
    });

    it("should show what will be removed", async () => {
      await createPluginDir(projectDir);

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(stdout).toContain("The following will be removed");
      expect(stdout).toContain("Plugin:");
    });

    it("should show uninstall complete message", async () => {
      await createPluginDir(projectDir);

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(stdout).toContain("Claude Collective has been uninstalled");
      expect(stdout).toContain("Uninstall complete");
    });
  });

  // ===========================================================================
  // Uninstall with --yes (Local)
  // ===========================================================================

  describe("uninstall with --yes (local directories)", () => {
    it("should remove .claude and .claude-src directories", async () => {
      const { claudeDir, claudeSrcDir } = await createLocalDirs(projectDir);

      // Verify dirs exist before uninstall
      expect(await directoryExists(claudeDir)).toBe(true);
      expect(await directoryExists(claudeSrcDir)).toBe(true);

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      // Verify dirs were removed
      expect(await directoryExists(claudeDir)).toBe(false);
      expect(await directoryExists(claudeSrcDir)).toBe(false);
      expect(stdout).toContain("Removed 2 directories");
    });

    it("should remove only .claude when .claude-src does not exist", async () => {
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(await directoryExists(claudeDir)).toBe(false);
      expect(stdout).toContain("Removed 1 directory");
    });
  });

  // ===========================================================================
  // Flag Targeting (--plugin / --local)
  // ===========================================================================

  describe("flag targeting", () => {
    it("should only remove plugin with --plugin flag", async () => {
      const pluginDir = await createPluginDir(projectDir);
      const { claudeDir, claudeSrcDir } = await createLocalDirs(projectDir);

      await runCliCommand(["uninstall", "--yes", "--plugin"]);

      // Plugin should be removed
      expect(await directoryExists(pluginDir)).toBe(false);
      // Local dirs should remain (--plugin skips local)
      // Note: .claude dir is parent of plugin dir, so it may still exist
      // but .claude-src should definitely remain
      expect(await directoryExists(claudeSrcDir)).toBe(true);
    });

    it("should only remove local dirs with --local flag", async () => {
      const { claudeSrcDir } = await createLocalDirs(projectDir);

      await runCliCommand(["uninstall", "--yes", "--local"]);

      // .claude and .claude-src should be removed
      expect(await directoryExists(claudeSrcDir)).toBe(false);
    });

    it("should show nothing when --plugin but no plugin installed", async () => {
      await createLocalDirs(projectDir);

      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes", "--plugin"]);

      const output = stdout + stderr;
      expect(output).toContain("Nothing to uninstall");
      expect(output).toContain("No plugin installation found");
    });

    it("should show nothing when --local but no local dirs exist", async () => {
      // Empty project - no .claude/ or .claude-src/
      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes", "--local"]);

      const output = stdout + stderr;
      expect(output).toContain("Nothing to uninstall");
      expect(output).toContain("No local installation found");
    });
  });

  // ===========================================================================
  // Dry Run with Flag Targeting
  // ===========================================================================

  describe("dry-run with flag targeting", () => {
    it("should preview only plugin removal with --dry-run --plugin", async () => {
      await createPluginDir(projectDir);
      await createLocalDirs(projectDir);

      const { stdout } = await runCliCommand(["uninstall", "--dry-run", "--plugin"]);

      expect(stdout).toContain("[dry-run] Would uninstall plugin");
      expect(stdout).not.toContain(CLAUDE_SRC_DIR);
    });

    it("should preview only local removal with --dry-run --local", async () => {
      await createPluginDir(projectDir);
      await createLocalDirs(projectDir);

      const { stdout } = await runCliCommand(["uninstall", "--dry-run", "--local"]);

      expect(stdout).toContain("[dry-run] Would remove");
      expect(stdout).toContain(CLAUDE_SRC_DIR);
      expect(stdout).not.toContain("Would uninstall plugin");
    });
  });
});
