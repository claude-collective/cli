import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { createTempDir, cleanupTempDir } from "../__tests__/helpers";

// Mock logger (suppress verbose/warn output during tests)
vi.mock("../../utils/logger");

import { detectInstallation, getInstallationOrThrow } from "./installation";

const LOCAL_CONFIG_CONTENT = `name: my-project
agents:
  - web-developer
skills: []
installMode: local
`;

const LOCAL_CONFIG_NO_MODE = `name: my-project
agents:
  - web-developer
skills: []
`;

async function createLocalProject(
  projectDir: string,
  options: { useSrcDir?: boolean; configContent?: string } = {},
): Promise<void> {
  const { useSrcDir = true, configContent = LOCAL_CONFIG_CONTENT } = options;
  const configDir = useSrcDir
    ? path.join(projectDir, ".claude-src")
    : path.join(projectDir, ".claude");
  await mkdir(configDir, { recursive: true });
  await writeFile(path.join(configDir, "config.yaml"), configContent);
}

const PLUGIN_CONFIG_CONTENT = `name: my-project
agents:
  - web-developer
skills: []
installMode: plugin
`;

async function createPluginProject(projectDir: string): Promise<void> {
  const configDir = path.join(projectDir, ".claude-src");
  await mkdir(configDir, { recursive: true });
  await writeFile(path.join(configDir, "config.yaml"), PLUGIN_CONFIG_CONTENT);
}

describe("installation", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("installation-test-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("detectInstallation", () => {
    it("detects local installation with .claude-src/config.yaml", async () => {
      await createLocalProject(tempDir);

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result!.mode).toBe("local");
      expect(result!.configPath).toBe(path.join(tempDir, ".claude-src/config.yaml"));
      expect(result!.agentsDir).toBe(path.join(tempDir, ".claude/agents"));
      expect(result!.skillsDir).toBe(path.join(tempDir, ".claude/skills"));
      expect(result!.projectDir).toBe(tempDir);
    });

    it("detects local installation with legacy .claude/config.yaml", async () => {
      await createLocalProject(tempDir, { useSrcDir: false });

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result!.mode).toBe("local");
      expect(result!.configPath).toBe(path.join(tempDir, ".claude/config.yaml"));
    });

    it("defaults to local mode when installMode is not set", async () => {
      await createLocalProject(tempDir, { configContent: LOCAL_CONFIG_NO_MODE });

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result!.mode).toBe("local");
    });

    it("detects plugin installation when installMode is plugin", async () => {
      await createPluginProject(tempDir);

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result!.mode).toBe("plugin");
      expect(result!.configPath).toBe(path.join(tempDir, ".claude-src/config.yaml"));
      expect(result!.agentsDir).toBe(path.join(tempDir, ".claude/agents"));
      expect(result!.skillsDir).toBe(path.join(tempDir, ".claude/plugins"));
    });

    it("returns null when no installation found", async () => {
      // Empty temp dir — no config, no plugin
      const result = await detectInstallation(tempDir);

      expect(result).toBeNull();
    });

    it("returns null when no config file exists even if plugin dirs exist", async () => {
      // Just having plugin directories without a config file is not sufficient
      const pluginDir = path.join(tempDir, ".claude/plugins/some-skill@public");
      await mkdir(pluginDir, { recursive: true });

      const result = await detectInstallation(tempDir);

      expect(result).toBeNull();
    });

    it("falls through to local even when config is invalid YAML", async () => {
      // Create a config file that exists but has invalid content
      // loadProjectConfig returns null for unparseable configs
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "not: [valid: yaml: {{");

      const result = await detectInstallation(tempDir);

      // loadProjectConfig returns null, but the file exists so detectInstallation
      // still enters the local branch. mode defaults to "local" via ?? operator.
      expect(result).not.toBeNull();
      expect(result!.mode).toBe("local");
    });

    it("prefers .claude-src/config.yaml over .claude/config.yaml", async () => {
      // Both config files exist
      await createLocalProject(tempDir, { useSrcDir: true });
      await createLocalProject(tempDir, { useSrcDir: false });

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      // Should use .claude-src/config.yaml (checked first)
      expect(result!.configPath).toBe(path.join(tempDir, ".claude-src/config.yaml"));
    });

    it("uses provided projectDir parameter", async () => {
      // Empty dir — no installation
      const result = await detectInstallation(tempDir);

      expect(result).toBeNull();
    });
  });

  describe("getInstallationOrThrow", () => {
    it("returns installation when found", async () => {
      await createLocalProject(tempDir);

      const result = await getInstallationOrThrow(tempDir);

      expect(result.mode).toBe("local");
      expect(result.projectDir).toBe(tempDir);
    });

    it("throws error when no installation found", async () => {
      await expect(getInstallationOrThrow(tempDir)).rejects.toThrow(
        "No Claude Collective installation found",
      );
    });

    it("error message suggests running cc init", async () => {
      await expect(getInstallationOrThrow(tempDir)).rejects.toThrow("cc init");
    });

    it("returns plugin installation when config has installMode: plugin", async () => {
      await createPluginProject(tempDir);

      const result = await getInstallationOrThrow(tempDir);

      expect(result.mode).toBe("plugin");
    });
  });
});
