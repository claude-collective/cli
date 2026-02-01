import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import {
  detectInstallation,
  getInstallationOrThrow,
  type InstallMode,
  type Installation,
} from "../installation";

describe("installation", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-installation-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // detectInstallation - local mode
  // ===========================================================================

  describe("detectInstallation - local mode", () => {
    it("should return local installation when .claude/config.yaml exists", async () => {
      // Create local config
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        `name: test-project
agents:
  - web-developer
installMode: local
`,
      );

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result?.mode).toBe("local");
      expect(result?.configPath).toBe(path.join(claudeDir, "config.yaml"));
      expect(result?.projectDir).toBe(tempDir);
    });

    it("should default to local mode when installMode is not in config", async () => {
      // Create local config without installMode field
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        `name: test-project
agents:
  - web-developer
`,
      );

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result?.mode).toBe("local");
    });

    it("should use correct paths for agentsDir and skillsDir in local mode", async () => {
      // Create local config
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        `name: test-project
agents:
  - web-developer
`,
      );

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result?.agentsDir).toBe(path.join(claudeDir, "agents"));
      expect(result?.skillsDir).toBe(path.join(claudeDir, "skills"));
    });
  });

  // ===========================================================================
  // detectInstallation - plugin mode
  // ===========================================================================

  describe("detectInstallation - plugin mode", () => {
    it("should return plugin installation when only plugin directory exists", async () => {
      // Create plugin directory (without local config)
      const pluginDir = path.join(
        tempDir,
        ".claude",
        "plugins",
        "claude-collective",
      );
      await mkdir(pluginDir, { recursive: true });

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result?.mode).toBe("plugin");
      expect(result?.configPath).toBe(path.join(pluginDir, "config.yaml"));
      expect(result?.projectDir).toBe(tempDir);
    });

    it("should use correct plugin paths for agentsDir and skillsDir", async () => {
      // Create plugin directory
      const pluginDir = path.join(
        tempDir,
        ".claude",
        "plugins",
        "claude-collective",
      );
      await mkdir(pluginDir, { recursive: true });

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result?.agentsDir).toBe(path.join(pluginDir, "agents"));
      expect(result?.skillsDir).toBe(path.join(pluginDir, "skills"));
    });
  });

  // ===========================================================================
  // detectInstallation - no installation
  // ===========================================================================

  describe("detectInstallation - no installation", () => {
    it("should return null when neither local nor plugin exists", async () => {
      // Empty temp directory - no .claude folder at all
      const result = await detectInstallation(tempDir);

      expect(result).toBeNull();
    });

    it("should return null when .claude exists but no config.yaml or plugin", async () => {
      // Create .claude directory without config or plugin
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });

      const result = await detectInstallation(tempDir);

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // detectInstallation - priority (local over plugin)
  // ===========================================================================

  describe("detectInstallation - priority", () => {
    it("should prioritize local installation over plugin when both exist", async () => {
      // Create both local config and plugin directory
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        `name: test-project
agents:
  - web-developer
`,
      );

      const pluginDir = path.join(claudeDir, "plugins", "claude-collective");
      await mkdir(pluginDir, { recursive: true });

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result?.mode).toBe("local");
    });
  });

  // ===========================================================================
  // getInstallationOrThrow
  // ===========================================================================

  describe("getInstallationOrThrow", () => {
    it("should throw helpful error when no installation found", async () => {
      // Empty temp directory
      await expect(getInstallationOrThrow(tempDir)).rejects.toThrow(
        /No Claude Collective installation found/,
      );
    });

    it("should include init suggestion in error message", async () => {
      // Empty temp directory
      await expect(getInstallationOrThrow(tempDir)).rejects.toThrow(/cc init/);
    });

    it("should return installation when found (local)", async () => {
      // Create local config
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        `name: test-project
agents:
  - web-developer
`,
      );

      const result = await getInstallationOrThrow(tempDir);

      expect(result).not.toBeNull();
      expect(result.mode).toBe("local");
      expect(result.projectDir).toBe(tempDir);
    });

    it("should return installation when found (plugin)", async () => {
      // Create plugin directory
      const pluginDir = path.join(
        tempDir,
        ".claude",
        "plugins",
        "claude-collective",
      );
      await mkdir(pluginDir, { recursive: true });

      const result = await getInstallationOrThrow(tempDir);

      expect(result).not.toBeNull();
      expect(result.mode).toBe("plugin");
      expect(result.projectDir).toBe(tempDir);
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle config with explicit installMode: plugin but no plugin dir", async () => {
      // Create local config with installMode: plugin (unusual but possible)
      // This should not return local installation since mode is explicitly plugin
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        `name: test-project
agents:
  - web-developer
installMode: plugin
`,
      );

      const result = await detectInstallation(tempDir);

      // Should not match local mode since installMode is explicitly "plugin"
      // And should not match plugin mode since plugin dir doesn't exist
      expect(result).toBeNull();
    });

    it("should treat invalid YAML config file as local mode (file exists)", async () => {
      // Create invalid config
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        "invalid: yaml: content: :",
      );

      // When config file exists but is invalid, loadProjectConfig returns null
      // The detection logic sees file exists, loaded?.config?.installMode is undefined,
      // so mode defaults to "local"
      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result?.mode).toBe("local");
    });

    it("should use process.cwd() as default when projectDir is not provided", async () => {
      // Save original cwd
      const originalCwd = process.cwd();

      try {
        // Change to temp directory
        process.chdir(tempDir);

        // Create local config in temp directory
        const claudeDir = path.join(tempDir, ".claude");
        await mkdir(claudeDir, { recursive: true });
        await writeFile(
          path.join(claudeDir, "config.yaml"),
          `name: test-project
agents:
  - web-developer
`,
        );

        // Call without projectDir argument
        const result = await detectInstallation();

        expect(result).not.toBeNull();
        expect(result?.mode).toBe("local");
        expect(result?.projectDir).toBe(tempDir);
      } finally {
        // Restore original cwd
        process.chdir(originalCwd);
      }
    });
  });
});
