import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import path from "path";
import os from "os";
import {
  getEnabledPluginKeys,
  resolvePluginInstallPaths,
  getVerifiedPluginInstallPaths,
} from "./plugin-settings";

// Use vi.hoisted so mock fns are available when vi.mock factories run (hoisted to top)
const { mockFileExists, mockReadFileSafe, mockVerbose, mockGetErrorMessage } = vi.hoisted(() => ({
  mockFileExists: vi.fn(),
  mockReadFileSafe: vi.fn(),
  mockVerbose: vi.fn(),
  mockGetErrorMessage: vi.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
}));

vi.mock("../../utils/fs", () => ({
  fileExists: mockFileExists,
  readFileSafe: mockReadFileSafe,
}));

vi.mock("../../utils/logger", () => ({
  verbose: mockVerbose,
}));

vi.mock("../../utils/errors", () => ({
  getErrorMessage: mockGetErrorMessage,
}));

vi.mock("../../consts", () => ({
  CLAUDE_DIR: ".claude",
  PLUGINS_SUBDIR: "plugins",
  MAX_CONFIG_FILE_SIZE: 1048576,
  PLUGIN_MANIFEST_DIR: ".claude-plugin",
  PLUGIN_MANIFEST_FILE: "plugin.json",
}));

describe("plugin-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEnabledPluginKeys", () => {
    it("should return empty array when settings.json does not exist", async () => {
      mockFileExists.mockResolvedValue(false);

      const result = await getEnabledPluginKeys("/project");

      expect(result).toEqual([]);
      expect(mockFileExists).toHaveBeenCalledWith(
        path.join("/project", ".claude", "settings.json"),
      );
    });

    it("should return enabled plugin keys from settings.json", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockResolvedValue(
        JSON.stringify({
          enabledPlugins: {
            "web-framework-react@my-marketplace": true,
            "web-state-zustand@my-marketplace": true,
          },
        }),
      );

      const result = await getEnabledPluginKeys("/project");

      expect(result).toEqual([
        "web-framework-react@my-marketplace",
        "web-state-zustand@my-marketplace",
      ]);
    });

    it("should filter out disabled plugins", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockResolvedValue(
        JSON.stringify({
          enabledPlugins: {
            "web-framework-react@my-marketplace": true,
            "web-state-zustand@my-marketplace": false,
            "api-framework-hono@my-marketplace": true,
          },
        }),
      );

      const result = await getEnabledPluginKeys("/project");

      expect(result).toEqual([
        "web-framework-react@my-marketplace",
        "api-framework-hono@my-marketplace",
      ]);
    });

    it("should return empty array when enabledPlugins is missing", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockResolvedValue(JSON.stringify({}));

      const result = await getEnabledPluginKeys("/project");

      expect(result).toEqual([]);
    });

    it("should return empty array when enabledPlugins is empty", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockResolvedValue(JSON.stringify({ enabledPlugins: {} }));

      const result = await getEnabledPluginKeys("/project");

      expect(result).toEqual([]);
    });

    it("should enforce strict equality check (=== true)", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockResolvedValue(
        JSON.stringify({
          enabledPlugins: {
            "web-framework-react@my-marketplace": true,
            "web-state-zustand@my-marketplace": 1, // truthy but not true
            "api-framework-hono@my-marketplace": "yes", // truthy but not true
          },
        }),
      );

      const result = await getEnabledPluginKeys("/project");

      expect(result).toEqual(["web-framework-react@my-marketplace"]);
    });

    it("should return empty array when JSON parsing fails", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockResolvedValue("invalid json");

      const result = await getEnabledPluginKeys("/project");

      expect(result).toEqual([]);
    });

    it("should return empty array when file reading fails", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockRejectedValue(new Error("Read error"));

      const result = await getEnabledPluginKeys("/project");

      expect(result).toEqual([]);
    });
  });

  describe("resolvePluginInstallPaths", () => {
    const getRegistryPath = () =>
      path.join(os.homedir(), ".claude", "plugins", "installed_plugins.json");

    it("should return empty array when pluginKeys is empty", async () => {
      const result = await resolvePluginInstallPaths([], "/project");

      expect(result).toEqual([]);
      expect(mockFileExists).not.toHaveBeenCalled();
    });

    it("should return empty array when registry does not exist", async () => {
      mockFileExists.mockResolvedValue(false);

      const result = await resolvePluginInstallPaths(
        ["web-framework-react@my-marketplace"],
        "/project",
      );

      expect(result).toEqual([]);
      expect(mockFileExists).toHaveBeenCalledWith(getRegistryPath());
    });

    it("should resolve project-scoped installations", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockResolvedValue(
        JSON.stringify({
          version: 2,
          plugins: {
            "web-framework-react@my-marketplace": [
              {
                scope: "project",
                projectPath: "/project",
                installPath: "/cache/web-framework-react/1.0.0",
                version: "1.0.0",
                installedAt: "2024-01-01",
              },
            ],
          },
        }),
      );

      const result = await resolvePluginInstallPaths(
        ["web-framework-react@my-marketplace"],
        "/project",
      );

      expect(result).toEqual([
        {
          pluginKey: "web-framework-react@my-marketplace",
          installPath: "/cache/web-framework-react/1.0.0",
        },
      ]);
    });

    it("should resolve user-scoped installations as fallback", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockResolvedValue(
        JSON.stringify({
          version: 2,
          plugins: {
            "web-framework-react@my-marketplace": [
              {
                scope: "user",
                installPath: "/cache/user/web-framework-react/1.0.0",
                version: "1.0.0",
                installedAt: "2024-01-01",
              },
            ],
          },
        }),
      );

      const result = await resolvePluginInstallPaths(
        ["web-framework-react@my-marketplace"],
        "/project",
      );

      expect(result).toEqual([
        {
          pluginKey: "web-framework-react@my-marketplace",
          installPath: "/cache/user/web-framework-react/1.0.0",
        },
      ]);
    });

    it("should prefer project-scoped over user-scoped", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockResolvedValue(
        JSON.stringify({
          version: 2,
          plugins: {
            "web-framework-react@my-marketplace": [
              {
                scope: "user",
                installPath: "/cache/user/web-framework-react/1.0.0",
                version: "1.0.0",
                installedAt: "2024-01-01",
              },
              {
                scope: "project",
                projectPath: "/project",
                installPath: "/cache/project/web-framework-react/1.0.0",
                version: "1.0.0",
                installedAt: "2024-01-01",
              },
            ],
          },
        }),
      );

      const result = await resolvePluginInstallPaths(
        ["web-framework-react@my-marketplace"],
        "/project",
      );

      expect(result).toEqual([
        {
          pluginKey: "web-framework-react@my-marketplace",
          installPath: "/cache/project/web-framework-react/1.0.0",
        },
      ]);
    });

    it("should resolve multiple plugins", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockResolvedValue(
        JSON.stringify({
          version: 2,
          plugins: {
            "web-framework-react@my-marketplace": [
              {
                scope: "project",
                projectPath: "/project",
                installPath: "/cache/web-framework-react/1.0.0",
                version: "1.0.0",
                installedAt: "2024-01-01",
              },
            ],
            "web-state-zustand@my-marketplace": [
              {
                scope: "user",
                installPath: "/cache/web-state-zustand/1.0.0",
                version: "1.0.0",
                installedAt: "2024-01-01",
              },
            ],
          },
        }),
      );

      const result = await resolvePluginInstallPaths(
        ["web-framework-react@my-marketplace", "web-state-zustand@my-marketplace"],
        "/project",
      );

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        pluginKey: "web-framework-react@my-marketplace",
        installPath: "/cache/web-framework-react/1.0.0",
      });
      expect(result).toContainEqual({
        pluginKey: "web-state-zustand@my-marketplace",
        installPath: "/cache/web-state-zustand/1.0.0",
      });
    });

    it("should skip plugins not found in registry", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockResolvedValue(
        JSON.stringify({
          version: 2,
          plugins: {},
        }),
      );

      const result = await resolvePluginInstallPaths(
        ["web-framework-react@my-marketplace"],
        "/project",
      );

      expect(result).toEqual([]);
    });

    it("should skip plugins with empty installations array", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockResolvedValue(
        JSON.stringify({
          version: 2,
          plugins: {
            "web-framework-react@my-marketplace": [],
          },
        }),
      );

      const result = await resolvePluginInstallPaths(
        ["web-framework-react@my-marketplace"],
        "/project",
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when JSON parsing fails", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockResolvedValue("invalid json");

      const result = await resolvePluginInstallPaths(
        ["web-framework-react@my-marketplace"],
        "/project",
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when file reading fails", async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFileSafe.mockRejectedValue(new Error("Read error"));

      const result = await resolvePluginInstallPaths(
        ["web-framework-react@my-marketplace"],
        "/project",
      );

      expect(result).toEqual([]);
    });
  });

  describe("getVerifiedPluginInstallPaths", () => {
    it("should return empty array when no plugins are enabled", async () => {
      mockFileExists.mockResolvedValue(false);

      const result = await getVerifiedPluginInstallPaths("/project");

      expect(result).toEqual([]);
    });

    it("should return verified plugin paths", async () => {
      // Mock settings.json read
      mockFileExists.mockResolvedValueOnce(true); // settings.json exists
      mockReadFileSafe.mockResolvedValueOnce(
        JSON.stringify({
          enabledPlugins: {
            "web-framework-react@my-marketplace": true,
          },
        }),
      );

      // Mock registry read
      mockFileExists.mockResolvedValueOnce(true); // registry exists
      mockReadFileSafe.mockResolvedValueOnce(
        JSON.stringify({
          version: 2,
          plugins: {
            "web-framework-react@my-marketplace": [
              {
                scope: "project",
                projectPath: "/project",
                installPath: "/cache/web-framework-react/1.0.0",
                version: "1.0.0",
                installedAt: "2024-01-01",
              },
            ],
          },
        }),
      );

      // Mock plugin.json existence check
      mockFileExists.mockResolvedValueOnce(true);

      const result = await getVerifiedPluginInstallPaths("/project");

      expect(result).toEqual([
        {
          pluginKey: "web-framework-react@my-marketplace",
          installPath: "/cache/web-framework-react/1.0.0",
        },
      ]);
    });

    it("should filter out plugins whose install paths don't exist", async () => {
      // Mock settings.json read
      mockFileExists.mockResolvedValueOnce(true);
      mockReadFileSafe.mockResolvedValueOnce(
        JSON.stringify({
          enabledPlugins: {
            "web-framework-react@my-marketplace": true,
            "web-state-zustand@my-marketplace": true,
          },
        }),
      );

      // Mock registry read
      mockFileExists.mockResolvedValueOnce(true);
      mockReadFileSafe.mockResolvedValueOnce(
        JSON.stringify({
          version: 2,
          plugins: {
            "web-framework-react@my-marketplace": [
              {
                scope: "project",
                projectPath: "/project",
                installPath: "/cache/web-framework-react/1.0.0",
                version: "1.0.0",
                installedAt: "2024-01-01",
              },
            ],
            "web-state-zustand@my-marketplace": [
              {
                scope: "project",
                projectPath: "/project",
                installPath: "/cache/web-state-zustand/1.0.0",
                version: "1.0.0",
                installedAt: "2024-01-01",
              },
            ],
          },
        }),
      );

      // Mock plugin.json existence checks
      mockFileExists.mockResolvedValueOnce(true); // react exists
      mockFileExists.mockResolvedValueOnce(false); // zustand doesn't exist

      const result = await getVerifiedPluginInstallPaths("/project");

      expect(result).toEqual([
        {
          pluginKey: "web-framework-react@my-marketplace",
          installPath: "/cache/web-framework-react/1.0.0",
        },
      ]);
    });

    it("should verify plugin.json path independently", async () => {
      mockFileExists.mockResolvedValueOnce(true); // settings.json
      mockReadFileSafe.mockResolvedValueOnce(
        JSON.stringify({
          enabledPlugins: {
            "web-framework-react@my-marketplace": true,
          },
        }),
      );

      mockFileExists.mockResolvedValueOnce(true); // registry
      mockReadFileSafe.mockResolvedValueOnce(
        JSON.stringify({
          version: 2,
          plugins: {
            "web-framework-react@my-marketplace": [
              {
                scope: "project",
                projectPath: "/project",
                installPath: "/cache/web-framework-react/1.0.0",
                version: "1.0.0",
                installedAt: "2024-01-01",
              },
            ],
          },
        }),
      );

      mockFileExists.mockResolvedValueOnce(true); // plugin.json

      const result = await getVerifiedPluginInstallPaths("/project");

      expect(mockFileExists).toHaveBeenNthCalledWith(
        3,
        path.join("/cache/web-framework-react/1.0.0", ".claude-plugin", "plugin.json"),
      );
      expect(result).toHaveLength(1);
    });
  });
});
