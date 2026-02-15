import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addSource, removeSource, getSourceSummary } from "./source-manager";
import { loadProjectSourceConfig, saveProjectConfig } from "./config";

// Mock the source-fetcher module
vi.mock("../loading/source-fetcher", () => ({
  fetchMarketplace: vi.fn(),
}));

// Mock the local-skill-loader module
vi.mock("../skills/local-skill-loader", () => ({
  discoverLocalSkills: vi.fn(),
}));

// Mock the plugin-finder module
vi.mock("../plugins/plugin-finder", () => ({
  getPluginSkillIds: vi.fn(),
  getCollectivePluginDir: vi.fn(),
  getPluginSkillsDir: vi.fn(),
}));

describe("source-manager", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-source-mgr-test-"));
    vi.resetAllMocks();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("addSource", () => {
    it("should add a source after validating via fetchMarketplace", async () => {
      const { fetchMarketplace } = await import("../loading/source-fetcher");
      vi.mocked(fetchMarketplace).mockResolvedValue({
        marketplace: {
          name: "acme-corp",
          version: "1.0.0",
          owner: { name: "Acme Corp" },
          plugins: [
            { name: "skill-1", source: "skills/skill-1" },
            { name: "skill-2", source: "skills/skill-2" },
          ],
        },
        sourcePath: "/tmp/cached",
        fromCache: false,
      });

      const result = await addSource(tempDir, "github:acme-corp/claude-skills");

      expect(result.name).toBe("acme-corp");
      expect(result.skillCount).toBe(2);
      expect(fetchMarketplace).toHaveBeenCalledWith("github:acme-corp/claude-skills", {
        forceRefresh: true,
      });

      // Verify it was saved to config
      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.sources).toEqual([
        { name: "acme-corp", url: "github:acme-corp/claude-skills" },
      ]);
    });

    it("should throw if source name already exists", async () => {
      // Set up existing config
      await saveProjectConfig(tempDir, {
        sources: [{ name: "acme-corp", url: "github:acme-corp/skills" }],
      });

      const { fetchMarketplace } = await import("../loading/source-fetcher");
      vi.mocked(fetchMarketplace).mockResolvedValue({
        marketplace: {
          name: "acme-corp",
          version: "1.0.0",
          owner: { name: "Acme Corp" },
          plugins: [],
        },
        sourcePath: "/tmp/cached",
        fromCache: false,
      });

      await expect(addSource(tempDir, "github:acme-corp/other-skills")).rejects.toThrow(
        'Source "acme-corp" already exists',
      );
    });

    it("should throw if fetchMarketplace fails", async () => {
      const { fetchMarketplace } = await import("../loading/source-fetcher");
      vi.mocked(fetchMarketplace).mockRejectedValue(new Error("Repository not found"));

      await expect(addSource(tempDir, "github:nonexistent/repo")).rejects.toThrow(
        "Repository not found",
      );
    });

    it("should add a source when config exists but has no sources array", async () => {
      await saveProjectConfig(tempDir, { source: "github:custom/skills" });

      const { fetchMarketplace } = await import("../loading/source-fetcher");
      vi.mocked(fetchMarketplace).mockResolvedValue({
        marketplace: {
          name: "team-skills",
          version: "1.0.0",
          owner: { name: "Team" },
          plugins: [{ name: "skill-a", source: "skills/skill-a" }],
        },
        sourcePath: "/tmp/cached",
        fromCache: false,
      });

      const result = await addSource(tempDir, "github:team/skills");

      expect(result.name).toBe("team-skills");
      expect(result.skillCount).toBe(1);

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.sources).toEqual([{ name: "team-skills", url: "github:team/skills" }]);
      expect(config?.source).toBe("github:custom/skills");
    });

    it("should add a source when no config file exists at all", async () => {
      const { fetchMarketplace } = await import("../loading/source-fetcher");
      vi.mocked(fetchMarketplace).mockResolvedValue({
        marketplace: {
          name: "new-source",
          version: "1.0.0",
          owner: { name: "Owner" },
          plugins: [],
        },
        sourcePath: "/tmp/cached",
        fromCache: false,
      });

      const result = await addSource(tempDir, "github:owner/new-source");

      expect(result.name).toBe("new-source");
      expect(result.skillCount).toBe(0);

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.sources).toEqual([{ name: "new-source", url: "github:owner/new-source" }]);
    });

    it("should not save config when duplicate check fails", async () => {
      await saveProjectConfig(tempDir, {
        sources: [{ name: "existing", url: "github:org/existing" }],
      });

      const { fetchMarketplace } = await import("../loading/source-fetcher");
      vi.mocked(fetchMarketplace).mockResolvedValue({
        marketplace: {
          name: "existing",
          version: "1.0.0",
          owner: { name: "Org" },
          plugins: [{ name: "s1", source: "skills/s1" }],
        },
        sourcePath: "/tmp/cached",
        fromCache: false,
      });

      await expect(addSource(tempDir, "github:org/another")).rejects.toThrow(
        'Source "existing" already exists',
      );

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.sources).toHaveLength(1);
    });
  });

  describe("removeSource", () => {
    it("should remove a source by name", async () => {
      await saveProjectConfig(tempDir, {
        sources: [
          { name: "acme-corp", url: "github:acme-corp/skills" },
          { name: "team-skills", url: "github:team/skills" },
        ],
      });

      await removeSource(tempDir, "acme-corp");

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.sources).toEqual([{ name: "team-skills", url: "github:team/skills" }]);
    });

    it("should throw when trying to remove 'public'", async () => {
      await expect(removeSource(tempDir, "public")).rejects.toThrow(
        'Cannot remove the "public" source',
      );
    });

    it("should throw when source not found", async () => {
      await saveProjectConfig(tempDir, {
        sources: [{ name: "acme-corp", url: "github:acme-corp/skills" }],
      });

      await expect(removeSource(tempDir, "nonexistent")).rejects.toThrow(
        'Source "nonexistent" not found',
      );
    });

    it("should result in empty sources array when removing the last source", async () => {
      await saveProjectConfig(tempDir, {
        sources: [{ name: "only-source", url: "github:org/only" }],
      });

      await removeSource(tempDir, "only-source");

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.sources).toEqual([]);
    });

    it("should throw when source not found and no config file exists", async () => {
      await expect(removeSource(tempDir, "nonexistent")).rejects.toThrow(
        'Source "nonexistent" not found',
      );
    });

    it("should throw when source not found and config has no sources array", async () => {
      await saveProjectConfig(tempDir, { source: "github:custom/skills" });

      await expect(removeSource(tempDir, "nonexistent")).rejects.toThrow(
        'Source "nonexistent" not found',
      );
    });
  });

  describe("getSourceSummary", () => {
    it("should return default public source when no config exists", async () => {
      const { discoverLocalSkills } = await import("../skills/local-skill-loader");
      vi.mocked(discoverLocalSkills).mockResolvedValue(null);

      const summary = await getSourceSummary(tempDir);

      expect(summary.sources).toHaveLength(1);
      expect(summary.sources[0].name).toBe("public");
      expect(summary.sources[0].enabled).toBe(true);
      expect(summary.localSkillCount).toBe(0);
      expect(summary.pluginSkillCount).toBe(0);
    });

    it("should include configured sources", async () => {
      await saveProjectConfig(tempDir, {
        sources: [{ name: "acme-corp", url: "github:acme-corp/skills" }],
      });

      const { discoverLocalSkills } = await import("../skills/local-skill-loader");
      vi.mocked(discoverLocalSkills).mockResolvedValue(null);

      const summary = await getSourceSummary(tempDir);

      expect(summary.sources).toHaveLength(2);
      expect(summary.sources[0].name).toBe("public");
      expect(summary.sources[1].name).toBe("acme-corp");
      expect(summary.sources[1].url).toBe("github:acme-corp/skills");
    });

    it("should count local skills", async () => {
      const { discoverLocalSkills } = await import("../skills/local-skill-loader");
      vi.mocked(discoverLocalSkills).mockResolvedValue({
        skills: [
          { id: "skill-1" } as never,
          { id: "skill-2" } as never,
          { id: "skill-3" } as never,
        ],
        localSkillsPath: "/project/.claude/skills",
      });

      const summary = await getSourceSummary(tempDir);

      expect(summary.localSkillCount).toBe(3);
    });

    it("when discoverLocalSkills throws a permission error, should return localSkillCount of 0", async () => {
      const { discoverLocalSkills } = await import("../skills/local-skill-loader");
      vi.mocked(discoverLocalSkills).mockRejectedValue(new Error("Permission denied"));

      const summary = await getSourceSummary(tempDir);

      expect(summary.localSkillCount).toBe(0);
    });

    it("should count plugin skills when matrix is provided", async () => {
      const { discoverLocalSkills } = await import("../skills/local-skill-loader");
      vi.mocked(discoverLocalSkills).mockResolvedValue(null);

      const { getCollectivePluginDir, getPluginSkillsDir, getPluginSkillIds } =
        await import("../plugins/plugin-finder");
      vi.mocked(getCollectivePluginDir).mockReturnValue(
        "/project/.claude/plugins/claude-collective",
      );
      vi.mocked(getPluginSkillsDir).mockReturnValue(
        "/project/.claude/plugins/claude-collective/skills",
      );
      vi.mocked(getPluginSkillIds).mockResolvedValue([
        "web-framework-react" as never,
        "web-state-zustand" as never,
      ]);

      const matrix = { skills: {} } as never;
      const summary = await getSourceSummary(tempDir, matrix);

      expect(summary.pluginSkillCount).toBe(2);
      expect(getCollectivePluginDir).toHaveBeenCalledWith(tempDir);
    });

    it("should return pluginSkillCount of 0 when matrix is not provided", async () => {
      const { discoverLocalSkills } = await import("../skills/local-skill-loader");
      vi.mocked(discoverLocalSkills).mockResolvedValue(null);

      const summary = await getSourceSummary(tempDir);

      expect(summary.pluginSkillCount).toBe(0);
    });

    it("should return pluginSkillCount of 0 when getPluginSkillIds throws", async () => {
      const { discoverLocalSkills } = await import("../skills/local-skill-loader");
      vi.mocked(discoverLocalSkills).mockResolvedValue(null);

      const { getCollectivePluginDir, getPluginSkillsDir, getPluginSkillIds } =
        await import("../plugins/plugin-finder");
      vi.mocked(getCollectivePluginDir).mockReturnValue(
        "/project/.claude/plugins/claude-collective",
      );
      vi.mocked(getPluginSkillsDir).mockReturnValue(
        "/project/.claude/plugins/claude-collective/skills",
      );
      vi.mocked(getPluginSkillIds).mockRejectedValue(
        new Error("ENOENT: no such file or directory"),
      );

      const matrix = { skills: {} } as never;
      const summary = await getSourceSummary(tempDir, matrix);

      expect(summary.pluginSkillCount).toBe(0);
    });

    it("should use custom source URL from config for public source", async () => {
      await saveProjectConfig(tempDir, {
        source: "github:custom-org/custom-skills",
      });

      const { discoverLocalSkills } = await import("../skills/local-skill-loader");
      vi.mocked(discoverLocalSkills).mockResolvedValue(null);

      const summary = await getSourceSummary(tempDir);

      expect(summary.sources[0].name).toBe("public");
      expect(summary.sources[0].url).toBe("github:custom-org/custom-skills");
    });

    it("should include multiple configured sources in order", async () => {
      await saveProjectConfig(tempDir, {
        sources: [
          { name: "source-a", url: "github:org/source-a" },
          { name: "source-b", url: "github:org/source-b" },
          { name: "source-c", url: "github:org/source-c" },
        ],
      });

      const { discoverLocalSkills } = await import("../skills/local-skill-loader");
      vi.mocked(discoverLocalSkills).mockResolvedValue(null);

      const summary = await getSourceSummary(tempDir);

      expect(summary.sources).toHaveLength(4);
      expect(summary.sources.map((s) => s.name)).toEqual([
        "public",
        "source-a",
        "source-b",
        "source-c",
      ]);
      expect(summary.sources.every((s) => s.enabled)).toBe(true);
    });

    it("should return 0 local skills when discoverLocalSkills returns empty array", async () => {
      const { discoverLocalSkills } = await import("../skills/local-skill-loader");
      vi.mocked(discoverLocalSkills).mockResolvedValue({
        skills: [],
        localSkillsPath: "/project/.claude/skills",
      });

      const summary = await getSourceSummary(tempDir);

      expect(summary.localSkillCount).toBe(0);
    });

    it("should count both local and plugin skills together", async () => {
      const { discoverLocalSkills } = await import("../skills/local-skill-loader");
      vi.mocked(discoverLocalSkills).mockResolvedValue({
        skills: [{ id: "local-1" } as never, { id: "local-2" } as never],
        localSkillsPath: "/project/.claude/skills",
      });

      const { getCollectivePluginDir, getPluginSkillsDir, getPluginSkillIds } =
        await import("../plugins/plugin-finder");
      vi.mocked(getCollectivePluginDir).mockReturnValue(
        "/project/.claude/plugins/claude-collective",
      );
      vi.mocked(getPluginSkillsDir).mockReturnValue(
        "/project/.claude/plugins/claude-collective/skills",
      );
      vi.mocked(getPluginSkillIds).mockResolvedValue([
        "web-framework-react" as never,
        "web-state-zustand" as never,
        "api-framework-hono" as never,
      ]);

      const matrix = { skills: {} } as never;
      const summary = await getSourceSummary(tempDir, matrix);

      expect(summary.localSkillCount).toBe(2);
      expect(summary.pluginSkillCount).toBe(3);
    });
  });
});
