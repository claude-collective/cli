import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { DEFAULT_BRANDING, DEFAULT_PLUGIN_NAME } from "../../../consts";
import { createTempDir, cleanupTempDir } from "../helpers";
import { detectInstallation, getInstallationOrThrow } from "../../installation";

describe("installation", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("cc-installation-test-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("detectInstallation - local mode", () => {
    it("should return local installation when .claude-src/config.yaml exists", async () => {
      const claudeSrcDir = path.join(tempDir, ".claude-src");
      await mkdir(claudeSrcDir, { recursive: true });
      await writeFile(
        path.join(claudeSrcDir, "config.yaml"),
        `name: test-project
agents:
  - web-developer
installMode: local
`,
      );

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result?.mode).toBe("local");
      expect(result?.configPath).toBe(path.join(claudeSrcDir, "config.yaml"));
      expect(result?.projectDir).toBe(tempDir);
    });

    it("should fall back to .claude/config.yaml for legacy projects", async () => {
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
      const claudeSrcDir = path.join(tempDir, ".claude-src");
      await mkdir(claudeSrcDir, { recursive: true });
      await writeFile(
        path.join(claudeSrcDir, "config.yaml"),
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
      const claudeSrcDir = path.join(tempDir, ".claude-src");
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeSrcDir, { recursive: true });
      await writeFile(
        path.join(claudeSrcDir, "config.yaml"),
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

  describe("detectInstallation - plugin mode", () => {
    it("should return plugin installation when config has installMode: plugin", async () => {
      const claudeSrcDir = path.join(tempDir, ".claude-src");
      await mkdir(claudeSrcDir, { recursive: true });
      await writeFile(
        path.join(claudeSrcDir, "config.yaml"),
        `name: test-project
agents:
  - web-developer
installMode: plugin
`,
      );

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result?.mode).toBe("plugin");
      expect(result?.configPath).toBe(path.join(claudeSrcDir, "config.yaml"));
      expect(result?.projectDir).toBe(tempDir);
    });

    it("should use correct plugin paths for agentsDir and skillsDir", async () => {
      const claudeSrcDir = path.join(tempDir, ".claude-src");
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeSrcDir, { recursive: true });
      await writeFile(
        path.join(claudeSrcDir, "config.yaml"),
        `name: test-project
agents:
  - web-developer
installMode: plugin
`,
      );

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result?.agentsDir).toBe(path.join(claudeDir, "agents"));
      expect(result?.skillsDir).toBe(path.join(claudeDir, "plugins"));
    });

    it("should return null when only plugin directory exists without config", async () => {
      const pluginDir = path.join(tempDir, ".claude", "plugins", DEFAULT_PLUGIN_NAME);
      await mkdir(pluginDir, { recursive: true });

      const result = await detectInstallation(tempDir);

      expect(result).toBeNull();
    });
  });

  describe("detectInstallation - no installation", () => {
    it("should return null when neither local nor plugin exists", async () => {
      const result = await detectInstallation(tempDir);

      expect(result).toBeNull();
    });

    it("should return null when .claude exists but no config.yaml or plugin", async () => {
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });

      const result = await detectInstallation(tempDir);

      expect(result).toBeNull();
    });
  });

  describe("detectInstallation - priority", () => {
    it("should prioritize local installation over plugin when both exist", async () => {
      const claudeSrcDir = path.join(tempDir, ".claude-src");
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeSrcDir, { recursive: true });
      await writeFile(
        path.join(claudeSrcDir, "config.yaml"),
        `name: test-project
agents:
  - web-developer
`,
      );

      const pluginDir = path.join(claudeDir, "plugins", DEFAULT_PLUGIN_NAME);
      await mkdir(pluginDir, { recursive: true });

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result?.mode).toBe("local");
    });
  });

  describe("getInstallationOrThrow", () => {
    it("should throw helpful error when no installation found", async () => {
      await expect(getInstallationOrThrow(tempDir)).rejects.toThrow(
        `No ${DEFAULT_BRANDING.NAME} installation found`,
      );
    });

    it("should include init suggestion in error message", async () => {
      await expect(getInstallationOrThrow(tempDir)).rejects.toThrow(/cc init/);
    });

    it("should return installation when found (local)", async () => {
      const claudeSrcDir = path.join(tempDir, ".claude-src");
      await mkdir(claudeSrcDir, { recursive: true });
      await writeFile(
        path.join(claudeSrcDir, "config.yaml"),
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
      const claudeSrcDir = path.join(tempDir, ".claude-src");
      await mkdir(claudeSrcDir, { recursive: true });
      await writeFile(
        path.join(claudeSrcDir, "config.yaml"),
        `name: test-project
agents:
  - web-developer
installMode: plugin
`,
      );

      const result = await getInstallationOrThrow(tempDir);

      expect(result).not.toBeNull();
      expect(result.mode).toBe("plugin");
      expect(result.projectDir).toBe(tempDir);
    });
  });

  describe("edge cases", () => {
    it("should handle config with explicit installMode: plugin even without plugin dir", async () => {
      const claudeSrcDir = path.join(tempDir, ".claude-src");
      await mkdir(claudeSrcDir, { recursive: true });
      await writeFile(
        path.join(claudeSrcDir, "config.yaml"),
        `name: test-project
agents:
  - web-developer
installMode: plugin
`,
      );

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result?.mode).toBe("plugin");
      expect(result?.configPath).toBe(path.join(claudeSrcDir, "config.yaml"));
    });

    it("should treat invalid YAML config file as local mode (file exists)", async () => {
      const claudeSrcDir = path.join(tempDir, ".claude-src");
      await mkdir(claudeSrcDir, { recursive: true });
      await writeFile(path.join(claudeSrcDir, "config.yaml"), "invalid: yaml: content: :");

      // When config file exists but is invalid, loadProjectConfig returns null
      // The detection logic sees file exists, loaded?.config?.installMode is undefined,
      // so mode defaults to "local"
      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result?.mode).toBe("local");
    });

    it("should use process.cwd() as default when projectDir is not provided", async () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(tempDir);

        const claudeSrcDir = path.join(tempDir, ".claude-src");
        await mkdir(claudeSrcDir, { recursive: true });
        await writeFile(
          path.join(claudeSrcDir, "config.yaml"),
          `name: test-project
agents:
  - web-developer
`,
        );

        const result = await detectInstallation();

        expect(result).not.toBeNull();
        expect(result?.mode).toBe("local");
        expect(result?.projectDir).toBe(fs.realpathSync(tempDir));
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
