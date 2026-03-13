import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { CLAUDE_DIR } from "../../src/cli/consts.js";
import {
  isClaudeCLIAvailable,
  claudePluginMarketplaceList,
  claudePluginInstall,
  claudePluginUninstall,
  execCommand,
} from "../../src/cli/utils/exec.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
} from "../helpers/test-utils.js";

/**
 * E2E smoke tests for Claude CLI plugin commands.
 *
 * These tests verify that `claude plugin install`, `claude plugin marketplace add`,
 * and `claude plugin uninstall` work in the test environment. They call the real
 * `claude` binary via the exec utilities in src/cli/utils/exec.ts.
 *
 * The entire suite is skipped when the Claude CLI is not available (e.g. CI
 * without Claude installed).
 */

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("claude plugin install (smoke)", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  describe("claude CLI availability", () => {
    it("should report the Claude CLI version", async () => {
      const result = await execCommand("claude", ["--version"], {});

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBeTruthy();
    });
  });

  describe("marketplace commands", () => {
    it("should list marketplaces without error", async () => {
      const marketplaces = await claudePluginMarketplaceList();

      // The list may be empty or populated -- we just verify it returns an array
      expect(Array.isArray(marketplaces)).toBe(true);
    });

    it("should add a marketplace from a local directory source", async () => {
      tempDir = await createTempDir();

      // Create a minimal marketplace structure that `claude plugin marketplace add`
      // expects: a directory with a marketplace.json in .claude-plugin/
      const marketplaceDir = path.join(tempDir, "test-marketplace");
      const pluginDir = path.join(marketplaceDir, ".claude-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, "marketplace.json"),
        JSON.stringify({
          name: "e2e-smoke-test-marketplace",
          plugins: [],
        }),
      );

      // Attempt to add the local directory as a marketplace.
      // This may fail if the Claude CLI rejects the format -- that's useful
      // information too. We capture the result to understand the behavior.
      const result = await execCommand(
        "claude",
        ["plugin", "marketplace", "add", marketplaceDir],
        {},
      );

      // Record what happened for diagnostic purposes
      const combined = result.stdout + result.stderr;

      // The command should either succeed or fail with a descriptive error.
      // We don't assert exitCode === 0 because the marketplace format may not
      // match what the Claude CLI expects. Instead, we verify the command
      // doesn't hang (which was the original concern).
      expect(typeof result.exitCode).toBe("number");
      expect(combined).toBeTruthy();
    });
  });

  describe("plugin install and uninstall", () => {
    it("should attempt plugin install and return a result without hanging", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await mkdir(projectDir, { recursive: true });

      // Create .claude directory so the CLI has a valid project context
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });

      // Attempt to install a nonexistent plugin to verify the command doesn't hang.
      // We expect this to fail (plugin doesn't exist) but the key assertion is
      // that the command completes within a reasonable time.
      let didComplete = false;
      let errorMessage = "";

      try {
        await claudePluginInstall(
          "nonexistent-plugin@nonexistent-marketplace",
          "project",
          projectDir,
        );
        didComplete = true;
      } catch (error) {
        didComplete = true;
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      // The critical assertion: the command completed (didn't hang)
      expect(didComplete).toBe(true);

      // It should have failed with an error about the nonexistent plugin
      expect(errorMessage).toBeTruthy();
      expect(errorMessage).toContain("Plugin installation failed");
    });

    it("should attempt plugin uninstall and return a result without hanging", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await mkdir(projectDir, { recursive: true });

      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });

      // Uninstalling a nonexistent plugin should succeed silently (the exec
      // wrapper treats "not installed" / "not found" as non-errors)
      await expect(
        claudePluginUninstall("nonexistent-plugin@nonexistent-marketplace", "project", projectDir),
      ).resolves.toBeUndefined();
    });
  });

  describe("plugin install with raw exec", () => {
    it("should run claude plugin install via raw execCommand and complete", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await mkdir(projectDir, { recursive: true });

      const result = await execCommand(
        "claude",
        ["plugin", "install", "fake-skill@fake-marketplace", "--scope", "project"],
        { cwd: projectDir },
      );

      // The command should complete (not hang) and return a non-zero exit code
      // since the plugin doesn't exist
      expect(typeof result.exitCode).toBe("number");
      expect(result.exitCode).not.toBe(0);

      const combined = result.stdout + result.stderr;
      expect(combined).toBeTruthy();
    });

    it("should run claude plugin uninstall via raw execCommand and complete", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await mkdir(projectDir, { recursive: true });

      const result = await execCommand(
        "claude",
        ["plugin", "uninstall", "fake-skill@fake-marketplace", "--scope", "project"],
        { cwd: projectDir },
      );

      // Should complete without hanging
      expect(typeof result.exitCode).toBe("number");
    });
  });

  describe("settings.json side effects", () => {
    it("should not create settings.json when plugin install fails", async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");
      await mkdir(projectDir, { recursive: true });

      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });

      const settingsPath = path.join(claudeDir, "settings.json");

      // Attempt an install that will fail
      try {
        await claudePluginInstall(
          "nonexistent-plugin@nonexistent-marketplace",
          "project",
          projectDir,
        );
      } catch {
        // Expected to fail
      }

      // A failed install should not create or modify settings.json
      expect(await fileExists(settingsPath)).toBe(false);
    });
  });
});
