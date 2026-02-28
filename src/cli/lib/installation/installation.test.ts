import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import os from "os";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { createTempDir, cleanupTempDir } from "../__tests__/helpers";

// Mock logger (suppress verbose/warn output during tests)
vi.mock("../../utils/logger");

import {
  detectInstallation,
  detectProjectInstallation,
  getInstallationOrThrow,
} from "./installation";

function tsConfigContent(config: Record<string, unknown>): string {
  return `export default ${JSON.stringify(config)};`;
}

const LOCAL_CONFIG = {
  name: "my-project",
  agents: ["web-developer"],
  skills: [],
  installMode: "local",
};

const LOCAL_CONFIG_NO_MODE = {
  name: "my-project",
  agents: ["web-developer"],
  skills: [],
};

async function createLocalProject(
  projectDir: string,
  options: { configContent?: Record<string, unknown> } = {},
): Promise<void> {
  const { configContent = LOCAL_CONFIG } = options;
  const configDir = path.join(projectDir, ".claude-src");
  await mkdir(configDir, { recursive: true });
  await writeFile(path.join(configDir, "config.ts"), tsConfigContent(configContent));
}

const PLUGIN_CONFIG = {
  name: "my-project",
  agents: ["web-developer"],
  skills: [],
  installMode: "plugin",
};

async function createPluginProject(projectDir: string): Promise<void> {
  const configDir = path.join(projectDir, ".claude-src");
  await mkdir(configDir, { recursive: true });
  await writeFile(path.join(configDir, "config.ts"), tsConfigContent(PLUGIN_CONFIG));
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
    it("detects local installation with .claude-src/config.ts", async () => {
      await createLocalProject(tempDir);

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result!.mode).toBe("local");
      expect(result!.scope).toBe("project");
      expect(result!.configPath).toBe(path.join(tempDir, ".claude-src/config.ts"));
      expect(result!.agentsDir).toBe(path.join(tempDir, ".claude/agents"));
      expect(result!.skillsDir).toBe(path.join(tempDir, ".claude/skills"));
      expect(result!.projectDir).toBe(tempDir);
    });

    it("defaults to local mode when installMode is not set", async () => {
      await createLocalProject(tempDir, { configContent: LOCAL_CONFIG_NO_MODE });

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result!.mode).toBe("local");
      expect(result!.scope).toBe("project");
    });

    it("detects plugin installation when installMode is plugin", async () => {
      await createPluginProject(tempDir);

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result!.mode).toBe("plugin");
      expect(result!.scope).toBe("project");
      expect(result!.configPath).toBe(path.join(tempDir, ".claude-src/config.ts"));
      expect(result!.agentsDir).toBe(path.join(tempDir, ".claude/agents"));
      expect(result!.skillsDir).toBe(path.join(tempDir, ".claude/plugins"));
    });

    it("returns null for project-level detection when no installation found", async () => {
      // Empty temp dir — no config, no plugin
      // Use detectProjectInstallation to avoid global fallback
      const result = await detectProjectInstallation(tempDir);
      expect(result).toBeNull();
    });

    it("returns null when no config file exists even if plugin dirs exist", async () => {
      // Just having plugin directories without a config file is not sufficient
      const pluginDir = path.join(tempDir, ".claude/plugins/some-skill@public");
      await mkdir(pluginDir, { recursive: true });

      // detectProjectInstallation returns null for project check
      const projectResult = await detectProjectInstallation(tempDir);
      expect(projectResult).toBeNull();
    });

    it("falls through to local even when config is invalid TS", async () => {
      // Create a config file that exists but has invalid content
      // loadProjectConfig returns null for unparseable configs
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.ts"), "invalid typescript content {{");

      const result = await detectInstallation(tempDir);

      // loadProjectConfig returns null, but the file exists so detectInstallation
      // still enters the local branch. mode defaults to "local" via ?? operator.
      expect(result).not.toBeNull();
      expect(result!.mode).toBe("local");
      expect(result!.scope).toBe("project");
    });

    it("uses provided projectDir parameter", async () => {
      // Empty dir — no installation at project level
      const result = await detectProjectInstallation(tempDir);

      expect(result).toBeNull();
    });
  });

  describe("detectProjectInstallation", () => {
    it("returns project-scoped installation when config exists", async () => {
      await createLocalProject(tempDir);

      const result = await detectProjectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result!.scope).toBe("project");
      expect(result!.projectDir).toBe(tempDir);
    });

    it("returns null when no config exists (no global fallback)", async () => {
      const result = await detectProjectInstallation(tempDir);

      expect(result).toBeNull();
    });
  });

  describe("global fallback", () => {
    it("falls back to global when project config not found", async () => {
      // If the home directory has a config, detectInstallation falls back
      const homeDir = os.homedir();
      const homeConfigPath = path.join(homeDir, ".claude-src/config.ts");
      const { fileExists } = await import("../../utils/fs");
      const homeHasConfig = await fileExists(homeConfigPath);

      if (homeHasConfig) {
        // Test the fallback: project dir without config -> uses global
        const result = await detectInstallation(tempDir);
        expect(result).not.toBeNull();
        expect(result!.scope).toBe("global");
        expect(result!.projectDir).toBe(homeDir);
      } else {
        // No global config either -> null
        const result = await detectInstallation(tempDir);
        expect(result).toBeNull();
      }
    });

    it("project takes precedence over global", async () => {
      // Project config exists — should use project, not global
      await createLocalProject(tempDir);

      const result = await detectInstallation(tempDir);

      expect(result).not.toBeNull();
      expect(result!.scope).toBe("project");
      expect(result!.projectDir).toBe(tempDir);
    });
  });

  describe("getInstallationOrThrow", () => {
    it("returns installation when found", async () => {
      await createLocalProject(tempDir);

      const result = await getInstallationOrThrow(tempDir);

      expect(result.mode).toBe("local");
      expect(result.scope).toBe("project");
      expect(result.projectDir).toBe(tempDir);
    });

    it("throws error when no installation found", async () => {
      // Only test this when home dir has no global config
      const homeDir = os.homedir();
      const homeConfigPath = path.join(homeDir, ".claude-src/config.ts");
      const { fileExists } = await import("../../utils/fs");
      const homeHasConfig = await fileExists(homeConfigPath);

      if (!homeHasConfig) {
        await expect(getInstallationOrThrow(tempDir)).rejects.toThrow(
          "No Agents Inc. installation found",
        );
      }
    });

    it("error message suggests running agentsinc init", async () => {
      const homeDir = os.homedir();
      const homeConfigPath = path.join(homeDir, ".claude-src/config.ts");
      const { fileExists } = await import("../../utils/fs");
      const homeHasConfig = await fileExists(homeConfigPath);

      if (!homeHasConfig) {
        await expect(getInstallationOrThrow(tempDir)).rejects.toThrow("agentsinc init");
      }
    });

    it("returns plugin installation when config has installMode: plugin", async () => {
      await createPluginProject(tempDir);

      const result = await getInstallationOrThrow(tempDir);

      expect(result.mode).toBe("plugin");
      expect(result.scope).toBe("project");
    });
  });
});
