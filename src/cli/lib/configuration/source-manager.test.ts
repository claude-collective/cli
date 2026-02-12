import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
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

    it("should handle errors in local skill discovery gracefully", async () => {
      const { discoverLocalSkills } = await import("../skills/local-skill-loader");
      vi.mocked(discoverLocalSkills).mockRejectedValue(new Error("Permission denied"));

      const summary = await getSourceSummary(tempDir);

      expect(summary.localSkillCount).toBe(0);
    });
  });
});
