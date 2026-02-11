import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPluginInfo,
  formatPluginDisplay,
  getInstallationInfo,
  formatInstallationDisplay,
  type PluginInfo,
  type InstallationInfo,
} from "./plugin-info";
import type { PluginManifest } from "../../types";
import type { InstallMode, Installation } from "../installation";

// =============================================================================
// Mocks
// =============================================================================

vi.mock("fs/promises", () => ({
  readdir: vi.fn(),
}));

vi.mock("./plugin-finder", () => ({
  getCollectivePluginDir: vi.fn(),
  getPluginSkillsDir: vi.fn(),
  getPluginAgentsDir: vi.fn(),
  readPluginManifest: vi.fn(),
}));

vi.mock("../../utils/fs");

vi.mock("../installation", () => ({
  detectInstallation: vi.fn(),
}));

vi.mock("../configuration", () => ({
  loadProjectConfig: vi.fn(),
}));

// =============================================================================
// Typed mock imports
// =============================================================================

import { readdir } from "fs/promises";
import {
  getCollectivePluginDir,
  getPluginSkillsDir,
  getPluginAgentsDir,
  readPluginManifest,
} from "./plugin-finder";
import { directoryExists } from "../../utils/fs";
import { detectInstallation } from "../installation";
import { loadProjectConfig } from "../configuration";

const mockedReaddir = vi.mocked(readdir);
const mockedGetCollectivePluginDir = vi.mocked(getCollectivePluginDir);
const mockedGetPluginSkillsDir = vi.mocked(getPluginSkillsDir);
const mockedGetPluginAgentsDir = vi.mocked(getPluginAgentsDir);
const mockedReadPluginManifest = vi.mocked(readPluginManifest);
const mockedDirectoryExists = vi.mocked(directoryExists);
const mockedDetectInstallation = vi.mocked(detectInstallation);
const mockedLoadProjectConfig = vi.mocked(loadProjectConfig);

// =============================================================================
// Helpers
// =============================================================================

/** Create a fake Dirent-like object for readdir({ withFileTypes: true }) */
function createDirent(name: string, opts: { isDir?: boolean; isFile?: boolean }) {
  return {
    name,
    isDirectory: () => opts.isDir ?? false,
    isFile: () => opts.isFile ?? false,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    parentPath: "",
    path: "",
  } as unknown as import("fs").Dirent;
}

// =============================================================================
// Tests
// =============================================================================

describe("plugin-info", () => {
  // ===========================================================================
  // getPluginInfo
  // ===========================================================================

  describe("getPluginInfo", () => {
    it("should return null when plugin directory does not exist", async () => {
      mockedGetCollectivePluginDir.mockReturnValue("/project/.claude/plugins/claude-collective");
      mockedDirectoryExists.mockResolvedValue(false);

      const result = await getPluginInfo();

      expect(result).toBeNull();
      expect(mockedDirectoryExists).toHaveBeenCalledWith(
        "/project/.claude/plugins/claude-collective",
      );
    });

    it("should return null when manifest is not found", async () => {
      mockedGetCollectivePluginDir.mockReturnValue("/project/.claude/plugins/claude-collective");
      mockedDirectoryExists.mockResolvedValue(true);
      mockedReadPluginManifest.mockResolvedValue(null);

      const result = await getPluginInfo();

      expect(result).toBeNull();
    });

    it("should return plugin info with skill and agent counts", async () => {
      const pluginDir = "/project/.claude/plugins/claude-collective";
      const manifest: PluginManifest = {
        name: "my-plugin",
        version: "1.2.3",
      };

      mockedGetCollectivePluginDir.mockReturnValue(pluginDir);
      mockedDirectoryExists.mockResolvedValue(true);
      mockedReadPluginManifest.mockResolvedValue(manifest);
      mockedGetPluginSkillsDir.mockReturnValue(`${pluginDir}/skills`);
      mockedGetPluginAgentsDir.mockReturnValue(`${pluginDir}/agents`);

      // Skills directory has 2 skill directories and 1 file (should only count dirs)
      mockedReaddir.mockImplementation((dirPath) => {
        const dir = dirPath as string;
        if (dir.endsWith("/skills")) {
          return Promise.resolve([
            createDirent("web-framework-react", { isDir: true }),
            createDirent("web-state-zustand", { isDir: true }),
            createDirent("README.md", { isFile: true }),
          ]) as unknown as ReturnType<typeof readdir>;
        }
        if (dir.endsWith("/agents")) {
          return Promise.resolve([
            createDirent("web-developer.md", { isFile: true }),
            createDirent("api-developer.md", { isFile: true }),
            createDirent("cli-developer.md", { isFile: true }),
            createDirent("templates", { isDir: true }),
          ]) as unknown as ReturnType<typeof readdir>;
        }
        return Promise.resolve([]) as unknown as ReturnType<typeof readdir>;
      });

      const result = await getPluginInfo();

      expect(result).not.toBeNull();
      expect(result!.name).toBe("my-plugin");
      expect(result!.version).toBe("1.2.3");
      expect(result!.skillCount).toBe(2);
      expect(result!.agentCount).toBe(3);
      expect(result!.path).toBe(pluginDir);
    });

    it("should use default name when manifest has no name", async () => {
      const pluginDir = "/project/.claude/plugins/claude-collective";
      const manifest: PluginManifest = {
        name: "",
        version: "1.0.0",
      };

      mockedGetCollectivePluginDir.mockReturnValue(pluginDir);
      mockedDirectoryExists.mockResolvedValue(true);
      mockedReadPluginManifest.mockResolvedValue(manifest);
      mockedGetPluginSkillsDir.mockReturnValue(`${pluginDir}/skills`);
      mockedGetPluginAgentsDir.mockReturnValue(`${pluginDir}/agents`);

      // Empty directories
      mockedReaddir.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof readdir>>);

      const result = await getPluginInfo();

      expect(result).not.toBeNull();
      expect(result!.name).toBe("claude-collective");
    });

    it("should use default version when manifest has no version", async () => {
      const pluginDir = "/project/.claude/plugins/claude-collective";
      const manifest: PluginManifest = {
        name: "my-plugin",
      };

      mockedGetCollectivePluginDir.mockReturnValue(pluginDir);
      mockedDirectoryExists.mockResolvedValue(true);
      mockedReadPluginManifest.mockResolvedValue(manifest);
      mockedGetPluginSkillsDir.mockReturnValue(`${pluginDir}/skills`);
      mockedGetPluginAgentsDir.mockReturnValue(`${pluginDir}/agents`);

      // Empty directories
      mockedReaddir.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof readdir>>);

      const result = await getPluginInfo();

      expect(result).not.toBeNull();
      expect(result!.version).toBe("0.0.0");
    });

    it("should return zero counts when skills and agents directories do not exist", async () => {
      const pluginDir = "/project/.claude/plugins/claude-collective";
      const manifest: PluginManifest = {
        name: "my-plugin",
        version: "1.0.0",
      };

      mockedGetCollectivePluginDir.mockReturnValue(pluginDir);
      mockedGetPluginSkillsDir.mockReturnValue(`${pluginDir}/skills`);
      mockedGetPluginAgentsDir.mockReturnValue(`${pluginDir}/agents`);
      mockedReadPluginManifest.mockResolvedValue(manifest);

      // First call: plugin dir exists, subsequent calls: skills/agents dirs don't
      mockedDirectoryExists.mockImplementation((dirPath) => {
        if (dirPath === pluginDir) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      const result = await getPluginInfo();

      expect(result).not.toBeNull();
      expect(result!.skillCount).toBe(0);
      expect(result!.agentCount).toBe(0);
    });

    it("should not count non-md files as agents", async () => {
      const pluginDir = "/project/.claude/plugins/claude-collective";
      const manifest: PluginManifest = {
        name: "test",
        version: "1.0.0",
      };

      mockedGetCollectivePluginDir.mockReturnValue(pluginDir);
      mockedDirectoryExists.mockResolvedValue(true);
      mockedReadPluginManifest.mockResolvedValue(manifest);
      mockedGetPluginSkillsDir.mockReturnValue(`${pluginDir}/skills`);
      mockedGetPluginAgentsDir.mockReturnValue(`${pluginDir}/agents`);

      mockedReaddir.mockImplementation((dirPath) => {
        const dir = dirPath as string;
        if (dir.endsWith("/agents")) {
          return Promise.resolve([
            createDirent("web-developer.md", { isFile: true }),
            createDirent("config.yaml", { isFile: true }),
            createDirent("agent.json", { isFile: true }),
          ]) as unknown as ReturnType<typeof readdir>;
        }
        return Promise.resolve([]) as unknown as ReturnType<typeof readdir>;
      });

      const result = await getPluginInfo();

      expect(result!.agentCount).toBe(1);
    });
  });

  // ===========================================================================
  // formatPluginDisplay
  // ===========================================================================

  describe("formatPluginDisplay", () => {
    it("should format plugin info correctly", () => {
      const info: PluginInfo = {
        name: "my-plugin",
        version: "1.2.3",
        skillCount: 5,
        agentCount: 3,
        path: "/project/.claude/plugins/claude-collective",
      };

      const result = formatPluginDisplay(info);

      expect(result).toContain("Plugin: my-plugin v1.2.3");
      expect(result).toContain("Skills: 5");
      expect(result).toContain("Agents: 3");
      expect(result).toContain("Path:   /project/.claude/plugins/claude-collective");
    });

    it("should format info with zero counts", () => {
      const info: PluginInfo = {
        name: "empty-plugin",
        version: "0.0.0",
        skillCount: 0,
        agentCount: 0,
        path: "/project/.claude/plugins/claude-collective",
      };

      const result = formatPluginDisplay(info);

      expect(result).toContain("Skills: 0");
      expect(result).toContain("Agents: 0");
    });
  });

  // ===========================================================================
  // getInstallationInfo
  // ===========================================================================

  describe("getInstallationInfo", () => {
    it("should return null when no installation is detected", async () => {
      mockedDetectInstallation.mockResolvedValue(null);

      const result = await getInstallationInfo();

      expect(result).toBeNull();
    });

    it("should return local installation info", async () => {
      const installation: Installation = {
        mode: "local",
        configPath: "/project/.claude-src/config.yaml",
        agentsDir: "/project/.claude/agents",
        skillsDir: "/project/.claude/skills",
        projectDir: "/project",
      };

      mockedDetectInstallation.mockResolvedValue(installation);
      mockedDirectoryExists.mockResolvedValue(true);

      // Skills: 2 directories
      // Agents: 1 .md file
      mockedReaddir.mockImplementation((dirPath) => {
        const dir = dirPath as string;
        if (dir.endsWith("/skills")) {
          return Promise.resolve([
            createDirent("web-framework-react", { isDir: true }),
            createDirent("web-state-zustand", { isDir: true }),
          ]) as unknown as ReturnType<typeof readdir>;
        }
        if (dir.endsWith("/agents")) {
          return Promise.resolve([
            createDirent("web-developer.md", { isFile: true }),
          ]) as unknown as ReturnType<typeof readdir>;
        }
        return Promise.resolve([]) as unknown as ReturnType<typeof readdir>;
      });

      mockedLoadProjectConfig.mockResolvedValue({
        config: {
          name: "my-local-project",
          agents: ["web-developer"],
        },
        configPath: "/project/.claude-src/config.yaml",
      });

      const result = await getInstallationInfo();

      expect(result).not.toBeNull();
      expect(result!.mode).toBe("local");
      expect(result!.name).toBe("my-local-project");
      expect(result!.version).toBe("local");
      expect(result!.skillCount).toBe(2);
      expect(result!.agentCount).toBe(1);
      expect(result!.configPath).toBe("/project/.claude-src/config.yaml");
      expect(result!.agentsDir).toBe("/project/.claude/agents");
      expect(result!.skillsDir).toBe("/project/.claude/skills");
    });

    it("should return plugin installation info", async () => {
      const installation: Installation = {
        mode: "plugin",
        configPath: "/project/.claude/plugins/claude-collective/config.yaml",
        agentsDir: "/project/.claude/plugins/claude-collective/agents",
        skillsDir: "/project/.claude/plugins/claude-collective/skills",
        projectDir: "/project",
      };

      const manifest: PluginManifest = {
        name: "my-plugin",
        version: "2.0.0",
      };

      mockedDetectInstallation.mockResolvedValue(installation);
      mockedDirectoryExists.mockResolvedValue(true);
      mockedGetCollectivePluginDir.mockReturnValue("/project/.claude/plugins/claude-collective");
      mockedReadPluginManifest.mockResolvedValue(manifest);

      mockedReaddir.mockImplementation((dirPath) => {
        const dir = dirPath as string;
        if (dir.endsWith("/skills")) {
          return Promise.resolve([
            createDirent("skill-a", { isDir: true }),
          ]) as unknown as ReturnType<typeof readdir>;
        }
        if (dir.endsWith("/agents")) {
          return Promise.resolve([
            createDirent("agent-1.md", { isFile: true }),
            createDirent("agent-2.md", { isFile: true }),
          ]) as unknown as ReturnType<typeof readdir>;
        }
        return Promise.resolve([]) as unknown as ReturnType<typeof readdir>;
      });

      const result = await getInstallationInfo();

      expect(result).not.toBeNull();
      expect(result!.mode).toBe("plugin");
      expect(result!.name).toBe("my-plugin");
      expect(result!.version).toBe("2.0.0");
      expect(result!.skillCount).toBe(1);
      expect(result!.agentCount).toBe(2);
    });

    it("should use default name when local config has no name", async () => {
      const installation: Installation = {
        mode: "local",
        configPath: "/project/.claude-src/config.yaml",
        agentsDir: "/project/.claude/agents",
        skillsDir: "/project/.claude/skills",
        projectDir: "/project",
      };

      mockedDetectInstallation.mockResolvedValue(installation);
      mockedDirectoryExists.mockResolvedValue(false);
      mockedLoadProjectConfig.mockResolvedValue({
        config: {
          name: "",
          agents: [],
        },
        configPath: "/project/.claude-src/config.yaml",
      });

      const result = await getInstallationInfo();

      expect(result).not.toBeNull();
      expect(result!.name).toBe("claude-collective");
    });

    it("should use default name when loadProjectConfig returns null", async () => {
      const installation: Installation = {
        mode: "local",
        configPath: "/project/.claude-src/config.yaml",
        agentsDir: "/project/.claude/agents",
        skillsDir: "/project/.claude/skills",
        projectDir: "/project",
      };

      mockedDetectInstallation.mockResolvedValue(installation);
      mockedDirectoryExists.mockResolvedValue(false);
      mockedLoadProjectConfig.mockResolvedValue(null);

      const result = await getInstallationInfo();

      expect(result).not.toBeNull();
      expect(result!.name).toBe("claude-collective");
      expect(result!.version).toBe("0.0.0");
    });

    it("should use default name and version when plugin manifest is missing", async () => {
      const installation: Installation = {
        mode: "plugin",
        configPath: "/project/.claude/plugins/claude-collective/config.yaml",
        agentsDir: "/project/.claude/plugins/claude-collective/agents",
        skillsDir: "/project/.claude/plugins/claude-collective/skills",
        projectDir: "/project",
      };

      mockedDetectInstallation.mockResolvedValue(installation);
      mockedDirectoryExists.mockResolvedValue(false);
      mockedGetCollectivePluginDir.mockReturnValue("/project/.claude/plugins/claude-collective");
      mockedReadPluginManifest.mockResolvedValue(null);

      const result = await getInstallationInfo();

      expect(result).not.toBeNull();
      expect(result!.name).toBe("claude-collective");
      expect(result!.version).toBe("0.0.0");
    });

    it("should handle readdir errors gracefully for skills", async () => {
      const installation: Installation = {
        mode: "local",
        configPath: "/project/.claude-src/config.yaml",
        agentsDir: "/project/.claude/agents",
        skillsDir: "/project/.claude/skills",
        projectDir: "/project",
      };

      mockedDetectInstallation.mockResolvedValue(installation);
      mockedDirectoryExists.mockResolvedValue(true);
      mockedLoadProjectConfig.mockResolvedValue({
        config: { name: "test", agents: [] },
        configPath: "/project/.claude-src/config.yaml",
      });

      // readdir throws for both skills and agents
      mockedReaddir.mockRejectedValue(new Error("EACCES permission denied"));

      const result = await getInstallationInfo();

      expect(result).not.toBeNull();
      expect(result!.skillCount).toBe(0);
      expect(result!.agentCount).toBe(0);
    });
  });

  // ===========================================================================
  // formatInstallationDisplay
  // ===========================================================================

  describe("formatInstallationDisplay", () => {
    it("should format local installation info", () => {
      const info: InstallationInfo = {
        mode: "local",
        name: "my-project",
        version: "local",
        skillCount: 5,
        agentCount: 3,
        configPath: "/project/.claude-src/config.yaml",
        agentsDir: "/project/.claude/agents",
        skillsDir: "/project/.claude/skills",
      };

      const result = formatInstallationDisplay(info);

      expect(result).toContain("Installation: my-project (local mode)");
      expect(result).toContain("Mode:    Local");
      expect(result).toContain("Skills:  5");
      expect(result).toContain("Agents:  3");
      expect(result).toContain("Config:  /project/.claude-src/config.yaml");
      expect(result).toContain("Agents:  /project/.claude/agents");
    });

    it("should format plugin installation info", () => {
      const info: InstallationInfo = {
        mode: "plugin",
        name: "my-plugin",
        version: "1.2.3",
        skillCount: 10,
        agentCount: 5,
        configPath: "/project/.claude/plugins/claude-collective/config.yaml",
        agentsDir: "/project/.claude/plugins/claude-collective/agents",
        skillsDir: "/project/.claude/plugins/claude-collective/skills",
      };

      const result = formatInstallationDisplay(info);

      expect(result).toContain("Installation: my-plugin v1.2.3");
      expect(result).toContain("Mode:    Plugin");
      expect(result).toContain("Skills:  10");
      expect(result).toContain("Agents:  5");
    });

    it("should show zero counts correctly", () => {
      const info: InstallationInfo = {
        mode: "local",
        name: "empty-project",
        version: "local",
        skillCount: 0,
        agentCount: 0,
        configPath: "/project/.claude-src/config.yaml",
        agentsDir: "/project/.claude/agents",
        skillsDir: "/project/.claude/skills",
      };

      const result = formatInstallationDisplay(info);

      expect(result).toContain("Skills:  0");
      expect(result).toContain("Agents:  0");
    });
  });
});
