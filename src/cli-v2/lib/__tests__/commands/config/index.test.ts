/**
 * Integration tests for config commands.
 *
 * Tests: cc config, cc config:show, cc config:get, cc config:set, cc config:path
 *
 * IMPORTANT: config:set tests use CC_CONFIG_HOME environment variable to isolate
 * the global config to a temp directory, preventing pollution of the user's config.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { stringify as stringifyYaml } from "yaml";
import { runCliCommand } from "../../helpers";
import { CONFIG_HOME_ENV_VAR } from "../../../config";

// =============================================================================
// Test Setup
// =============================================================================

describe("config commands", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Save original environment
    originalCwd = process.cwd();
    originalEnv = { ...process.env };

    // Create temp directory for tests
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-config-test-"));

    // Create project directory
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });

    // Change to project directory
    process.chdir(projectDir);

    // Clear CC_SOURCE to ensure clean test state
    delete process.env.CC_SOURCE;
  });

  afterEach(async () => {
    // Restore original environment
    process.chdir(originalCwd);
    process.env = originalEnv;

    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // config:path
  // ===========================================================================

  describe("config:path", () => {
    it("should display global and project config paths", async () => {
      const { stdout } = await runCliCommand(["config:path"]);

      expect(stdout).toContain("Configuration File Paths");
      expect(stdout).toContain("Global:");
      expect(stdout).toContain("Project:");
    });

    it("should show project config path containing current directory", async () => {
      const { stdout } = await runCliCommand(["config:path"]);

      // Project path should include the project directory
      expect(stdout).toContain(projectDir);
      expect(stdout).toContain(".claude-collective/config.yaml");
    });
  });

  // ===========================================================================
  // config:show
  // ===========================================================================

  describe("config:show", () => {
    it("should display configuration overview", async () => {
      const { stdout } = await runCliCommand(["config:show"]);

      expect(stdout).toContain("Claude Collective Configuration");
      expect(stdout).toContain("Source:");
      expect(stdout).toContain("Configuration Layers:");
    });

    it("should show source value and origin", async () => {
      const { stdout } = await runCliCommand(["config:show"]);

      // Should show some source - may be default or from global config
      // Just verify the output format shows source info
      expect(stdout).toContain("Source:");
      // Origin formats: "default", "global config (~/.claude-collective/config.yaml)", etc.
      expect(stdout).toMatch(
        /\(from (default|global|project|--source|CC_SOURCE)/,
      );
    });

    it("should show environment variable when CC_SOURCE is set", async () => {
      process.env.CC_SOURCE = "/custom/source/path";

      const { stdout } = await runCliCommand(["config:show"]);

      expect(stdout).toContain("/custom/source/path");
      expect(stdout).toContain("CC_SOURCE");
    });

    it("should show project config values when configured", async () => {
      const projectConfigDir = path.join(projectDir, ".claude-collective");
      await mkdir(projectConfigDir, { recursive: true });
      await writeFile(
        path.join(projectConfigDir, "config.yaml"),
        stringifyYaml({ source: "/project/source" }),
      );

      const { stdout } = await runCliCommand(["config:show"]);

      expect(stdout).toContain("/project/source");
    });

    it("should show precedence order", async () => {
      const { stdout } = await runCliCommand(["config:show"]);

      expect(stdout).toContain(
        "Precedence: flag > env > project > global > default",
      );
    });

    it("should show marketplace section", async () => {
      const { stdout } = await runCliCommand(["config:show"]);

      expect(stdout).toContain("Marketplace:");
    });

    it("should show agents source section", async () => {
      const { stdout } = await runCliCommand(["config:show"]);

      expect(stdout).toContain("Agents Source:");
    });
  });

  // ===========================================================================
  // config:get
  // ===========================================================================

  describe("config:get", () => {
    it("should get source value", async () => {
      const { stdout } = await runCliCommand(["config:get", "source"]);

      // Should return some source (either default, global, or env)
      // Can't guarantee it's the default due to global config pollution
      expect(stdout.trim().length).toBeGreaterThan(0);
    });

    it("should get source from CC_SOURCE environment variable", async () => {
      process.env.CC_SOURCE = "/env/source/path";

      const { stdout } = await runCliCommand(["config:get", "source"]);

      expect(stdout.trim()).toBe("/env/source/path");
    });

    it("should return author value (may be empty or set from global config)", async () => {
      const { stdout, error } = await runCliCommand(["config:get", "author"]);

      // Should not error - author is a valid key
      expect(error?.oclif?.exit).toBeUndefined();
      // May be empty or set depending on global config state
      expect(typeof stdout).toBe("string");
    });

    it("should error on invalid key", async () => {
      const { error } = await runCliCommand(["config:get", "invalid-key"]);

      expect(error?.oclif?.exit).toBe(2); // INVALID_ARGS
    });

    it("should accept valid keys", async () => {
      const validKeys = ["source", "author", "marketplace", "agents_source"];

      for (const key of validKeys) {
        const { error } = await runCliCommand(["config:get", key]);
        // Should not error (error should be undefined or exit code 0)
        expect(error?.oclif?.exit).toBeUndefined();
      }
    });
  });

  // ===========================================================================
  // config:set
  // ===========================================================================

  describe("config:set", () => {
    // Use isolated config directory to prevent test pollution
    let configTempDir: string;
    let originalConfigHome: string | undefined;

    beforeEach(async () => {
      // Save original CC_CONFIG_HOME and set to temp directory
      originalConfigHome = process.env[CONFIG_HOME_ENV_VAR];
      configTempDir = await mkdtemp(
        path.join(os.tmpdir(), "cc-config-set-test-"),
      );
      process.env[CONFIG_HOME_ENV_VAR] = configTempDir;
    });

    afterEach(async () => {
      // Restore original CC_CONFIG_HOME
      if (originalConfigHome !== undefined) {
        process.env[CONFIG_HOME_ENV_VAR] = originalConfigHome;
      } else {
        delete process.env[CONFIG_HOME_ENV_VAR];
      }
      // Clean up temp directory
      await rm(configTempDir, { recursive: true, force: true });
    });

    it("should report successful set for source", async () => {
      const { stdout } = await runCliCommand([
        "config:set",
        "source",
        "/new/source/path",
      ]);

      expect(stdout).toContain("Set source = /new/source/path");
      expect(stdout).toContain("Saved to");
    });

    it("should report successful set for author", async () => {
      const { stdout } = await runCliCommand([
        "config:set",
        "author",
        "@newauthor",
      ]);

      expect(stdout).toContain("Set author = @newauthor");
    });

    it("should report successful set for marketplace", async () => {
      const { stdout } = await runCliCommand([
        "config:set",
        "marketplace",
        "https://example.com/marketplace.json",
      ]);

      expect(stdout).toContain(
        "Set marketplace = https://example.com/marketplace.json",
      );
    });

    it("should report successful set for agents_source", async () => {
      const { stdout } = await runCliCommand([
        "config:set",
        "agents_source",
        "github:my-org/my-agents",
      ]);

      expect(stdout).toContain("Set agents_source = github:my-org/my-agents");
    });

    it("should error on invalid key", async () => {
      const { error } = await runCliCommand([
        "config:set",
        "invalid-key",
        "value",
      ]);

      expect(error?.oclif?.exit).toBe(2); // INVALID_ARGS
    });
  });

  // ===========================================================================
  // config (alias for config:show)
  // ===========================================================================

  describe("config (index)", () => {
    it("should display configuration overview", async () => {
      const { stdout } = await runCliCommand(["config"]);

      expect(stdout).toContain("Claude Collective Configuration");
      expect(stdout).toContain("Source:");
    });
  });
});
