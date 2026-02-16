import { describe, it, expect, vi } from "vitest";
import {
  getPluginInfo,
  formatPluginDisplay,
  getInstallationInfo,
  formatInstallationDisplay,
  type PluginInfo,
  type InstallationInfo,
} from "./plugin-info";
import type { Installation } from "../installation";

vi.mock("fs/promises", () => ({
  readdir: vi.fn(),
}));

vi.mock("./plugin-finder", () => ({
  getProjectPluginsDir: vi.fn(),
}));

vi.mock("./plugin-discovery", () => ({
  listPluginNames: vi.fn(),
  discoverAllPluginSkills: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../utils/fs");

vi.mock("../installation", () => ({
  detectInstallation: vi.fn(),
}));

vi.mock("../configuration", () => ({
  loadProjectConfig: vi.fn(),
}));

import { readdir } from "fs/promises";
import { getProjectPluginsDir } from "./plugin-finder";
import { discoverAllPluginSkills, listPluginNames } from "./plugin-discovery";
import { directoryExists } from "../../utils/fs";
import { detectInstallation } from "../installation";
import { loadProjectConfig } from "../configuration";

const mockedReaddir = vi.mocked(readdir);
const mockedGetProjectPluginsDir = vi.mocked(getProjectPluginsDir);
const mockedListPluginNames = vi.mocked(listPluginNames);
const mockedDiscoverAllPluginSkills = vi.mocked(discoverAllPluginSkills);
const mockedDirectoryExists = vi.mocked(directoryExists);
const mockedDetectInstallation = vi.mocked(detectInstallation);
const mockedLoadProjectConfig = vi.mocked(loadProjectConfig);

describe("plugin-info", () => {
  describe("getPluginInfo", () => {
    it("should return null when no plugins exist", async () => {
      mockedListPluginNames.mockResolvedValue([]);

      const result = await getPluginInfo();

      expect(result).toBeNull();
    });

    it("should return plugin info with skill count from plugin names", async () => {
      mockedListPluginNames.mockResolvedValue(["react@my-marketplace", "zustand@my-marketplace"]);
      mockedGetProjectPluginsDir.mockReturnValue("/project/.claude/plugins");

      const result = await getPluginInfo();

      expect(result).not.toBeNull();
      expect(result!.name).toBe("claude-collective");
      expect(result!.version).toBe("0.0.0");
      expect(result!.skillCount).toBe(2);
      expect(result!.agentCount).toBe(0);
      expect(result!.path).toBe("/project/.claude/plugins");
    });

    it("should return null when listPluginNames throws", async () => {
      mockedListPluginNames.mockRejectedValue(new Error("ENOENT"));

      const result = await getPluginInfo();

      expect(result).toBeNull();
    });

    it("should accept custom projectDir", async () => {
      mockedListPluginNames.mockResolvedValue(["react@marketplace"]);
      mockedGetProjectPluginsDir.mockReturnValue("/custom/.claude/plugins");

      const result = await getPluginInfo("/custom");

      expect(mockedListPluginNames).toHaveBeenCalledWith("/custom");
      expect(result).not.toBeNull();
      expect(result!.path).toBe("/custom/.claude/plugins");
    });
  });

  describe("formatPluginDisplay", () => {
    it("should format plugin info correctly", () => {
      const info: PluginInfo = {
        name: "my-plugin",
        version: "1.2.3",
        skillCount: 5,
        agentCount: 3,
        path: "/project/.claude/plugins",
      };

      const result = formatPluginDisplay(info);

      expect(result).toContain("Plugin: my-plugin v1.2.3");
      expect(result).toContain("Skills: 5");
      expect(result).toContain("Agents: 3");
      expect(result).toContain("Path:   /project/.claude/plugins");
    });

    it("should format info with zero counts", () => {
      const info: PluginInfo = {
        name: "empty-plugin",
        version: "0.0.0",
        skillCount: 0,
        agentCount: 0,
        path: "/project/.claude/plugins",
      };

      const result = formatPluginDisplay(info);

      expect(result).toContain("Skills: 0");
      expect(result).toContain("Agents: 0");
    });
  });

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
          skills: [],
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
        configPath: "/project/.claude-src/config.yaml",
        agentsDir: "/project/.claude/agents",
        skillsDir: "/project/.claude/plugins",
        projectDir: "/project",
      };

      mockedDetectInstallation.mockResolvedValue(installation);
      mockedDirectoryExists.mockResolvedValue(true);

      mockedLoadProjectConfig.mockResolvedValue({
        config: {
          name: "my-plugin",
          agents: ["web-developer"],
          skills: [],
          installMode: "plugin",
        },
        configPath: "/project/.claude-src/config.yaml",
      });

      // Plugin mode uses discoverAllPluginSkills instead of readdir
      mockedDiscoverAllPluginSkills.mockResolvedValue({
        "web-framework-react": {
          id: "web-framework-react",
          description: "React",
          path: "/global/cache/react",
        },
      } as Record<string, import("../../types").SkillDefinition>);

      mockedReaddir.mockImplementation((dirPath) => {
        const dir = dirPath as string;
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
      expect(result!.version).toBe("plugin");
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
          skills: [],
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
        config: { name: "test", agents: [], skills: [] },
        configPath: "/project/.claude-src/config.yaml",
      });

      mockedReaddir.mockRejectedValue(new Error("EACCES permission denied"));

      const result = await getInstallationInfo();

      expect(result).not.toBeNull();
      expect(result!.skillCount).toBe(0);
      expect(result!.agentCount).toBe(0);
    });
  });

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
        configPath: "/project/.claude-src/config.yaml",
        agentsDir: "/project/.claude/agents",
        skillsDir: "/project/.claude/plugins",
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
