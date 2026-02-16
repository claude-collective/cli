import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  discoverAllPluginSkills,
  hasIndividualPlugins,
  listPluginNames,
} from "./plugin-discovery";
import type { SkillId } from "../../types";

// Mock all utilities before importing them
const mockLoadPluginSkills = vi.fn();
const mockGetVerifiedPluginInstallPaths = vi.fn();
const mockVerbose = vi.fn();
const mockGetErrorMessage = vi.fn((e: unknown) => (e instanceof Error ? e.message : String(e)));

vi.mock("../../utils/logger", () => ({
  verbose: mockVerbose,
}));

vi.mock("../../utils/errors", () => ({
  getErrorMessage: mockGetErrorMessage,
}));

vi.mock("../loading", () => ({
  loadPluginSkills: mockLoadPluginSkills,
}));

vi.mock("./plugin-settings", () => ({
  getVerifiedPluginInstallPaths: mockGetVerifiedPluginInstallPaths,
}));

describe("plugin-discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("discoverAllPluginSkills", () => {
    it("should return empty map when no plugins are enabled", async () => {
      mockGetVerifiedPluginInstallPaths.mockResolvedValue([]);

      const result = await discoverAllPluginSkills("/project");

      expect(result).toEqual({});
    });

    it("should discover skills from verified plugin paths", async () => {
      mockGetVerifiedPluginInstallPaths.mockResolvedValue([
        { pluginKey: "react@my-marketplace", installPath: "/cache/react" },
        { pluginKey: "zustand@my-marketplace", installPath: "/cache/zustand" },
      ]);

      const reactId = "web-framework-react" as SkillId;
      const zustandId = "web-state-zustand" as SkillId;

      mockLoadPluginSkills
        .mockResolvedValueOnce({
          [reactId]: {
            id: reactId,
            path: "skills/web-framework-react/",
            description: "React skill",
          },
        })
        .mockResolvedValueOnce({
          [zustandId]: {
            id: zustandId,
            path: "skills/web-state-zustand/",
            description: "Zustand skill",
          },
        });

      const result = await discoverAllPluginSkills("/project");

      expect(Object.keys(result)).toHaveLength(2);
      expect(result[reactId]).toBeDefined();
      expect(result[zustandId]).toBeDefined();
      expect(mockLoadPluginSkills).toHaveBeenCalledWith("/cache/react");
      expect(mockLoadPluginSkills).toHaveBeenCalledWith("/cache/zustand");
    });

    it("should allow later plugins to override earlier ones (same skill ID)", async () => {
      mockGetVerifiedPluginInstallPaths.mockResolvedValue([
        { pluginKey: "react@marketplace-a", installPath: "/cache/react-a" },
        { pluginKey: "react@marketplace-b", installPath: "/cache/react-b" },
      ]);

      const skillId = "web-framework-react" as SkillId;

      mockLoadPluginSkills
        .mockResolvedValueOnce({
          [skillId]: {
            id: skillId,
            path: "skills/web-framework-react/",
            description: "Old description",
          },
        })
        .mockResolvedValueOnce({
          [skillId]: {
            id: skillId,
            path: "skills/web-framework-react/",
            description: "New description",
          },
        });

      const result = await discoverAllPluginSkills("/project");

      expect(result[skillId]!.description).toBe("New description");
    });

    it("should handle loadPluginSkills errors gracefully with verbose logging", async () => {
      mockGetVerifiedPluginInstallPaths.mockResolvedValue([
        { pluginKey: "broken-plugin", installPath: "/cache/broken" },
        { pluginKey: "good-plugin", installPath: "/cache/good" },
      ]);

      const skillId = "web-framework-react" as SkillId;

      mockLoadPluginSkills
        .mockRejectedValueOnce(new Error("Parse error"))
        .mockResolvedValueOnce({
          [skillId]: {
            id: skillId,
            path: "skills/web-framework-react/",
            description: "React",
          },
        });

      const result = await discoverAllPluginSkills("/project");

      // Should still have the good plugin's skills
      expect(Object.keys(result)).toHaveLength(1);
      expect(result[skillId]).toBeDefined();
    });

    it("should handle getVerifiedPluginInstallPaths errors gracefully", async () => {
      mockGetVerifiedPluginInstallPaths.mockRejectedValue(new Error("Unexpected error"));

      const result = await discoverAllPluginSkills("/project");

      expect(result).toEqual({});
    });

    it("should pass projectDir to getVerifiedPluginInstallPaths", async () => {
      mockGetVerifiedPluginInstallPaths.mockResolvedValue([]);

      await discoverAllPluginSkills("/my/project");

      expect(mockGetVerifiedPluginInstallPaths).toHaveBeenCalledWith("/my/project");
    });
  });

  describe("hasIndividualPlugins", () => {
    it("should return false when no plugins are verified", async () => {
      mockGetVerifiedPluginInstallPaths.mockResolvedValue([]);

      const result = await hasIndividualPlugins("/project");

      expect(result).toBe(false);
    });

    it("should return true when verified plugins exist", async () => {
      mockGetVerifiedPluginInstallPaths.mockResolvedValue([
        { pluginKey: "react@my-marketplace", installPath: "/cache/react" },
      ]);

      const result = await hasIndividualPlugins("/project");

      expect(result).toBe(true);
    });

    it("should return true with multiple verified plugins", async () => {
      mockGetVerifiedPluginInstallPaths.mockResolvedValue([
        { pluginKey: "react@my-marketplace", installPath: "/cache/react" },
        { pluginKey: "zustand@my-marketplace", installPath: "/cache/zustand" },
      ]);

      const result = await hasIndividualPlugins("/project");

      expect(result).toBe(true);
    });

    it("should return false when getVerifiedPluginInstallPaths throws", async () => {
      mockGetVerifiedPluginInstallPaths.mockRejectedValue(new Error("Unexpected error"));

      const result = await hasIndividualPlugins("/project");

      expect(result).toBe(false);
    });

    it("should pass projectDir to getVerifiedPluginInstallPaths", async () => {
      mockGetVerifiedPluginInstallPaths.mockResolvedValue([]);

      await hasIndividualPlugins("/my/project");

      expect(mockGetVerifiedPluginInstallPaths).toHaveBeenCalledWith("/my/project");
    });
  });

  describe("listPluginNames", () => {
    it("should return empty array when no plugins are verified", async () => {
      mockGetVerifiedPluginInstallPaths.mockResolvedValue([]);

      const result = await listPluginNames("/project");

      expect(result).toEqual([]);
    });

    it("should return all verified plugin keys", async () => {
      mockGetVerifiedPluginInstallPaths.mockResolvedValue([
        { pluginKey: "react@my-marketplace", installPath: "/cache/react" },
        { pluginKey: "zustand@my-marketplace", installPath: "/cache/zustand" },
      ]);

      const result = await listPluginNames("/project");

      expect(result).toEqual(["react@my-marketplace", "zustand@my-marketplace"]);
    });

    it("should return empty array when getVerifiedPluginInstallPaths throws", async () => {
      mockGetVerifiedPluginInstallPaths.mockRejectedValue(new Error("Unexpected error"));

      const result = await listPluginNames("/project");

      expect(result).toEqual([]);
    });

    it("should pass projectDir to getVerifiedPluginInstallPaths", async () => {
      mockGetVerifiedPluginInstallPaths.mockResolvedValue([]);

      await listPluginNames("/custom/project");

      expect(mockGetVerifiedPluginInstallPaths).toHaveBeenCalledWith("/custom/project");
    });
  });
});
