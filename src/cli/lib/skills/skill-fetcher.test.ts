import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "path";
import type { Marketplace, MarketplacePlugin, SkillId } from "../../types";

// Mock dependencies before importing the module under test (manual mocks from __mocks__ directories)
vi.mock("../../utils/fs");
vi.mock("../../utils/logger");

import { fetchSkills } from "./skill-fetcher";
import { copy, ensureDir, directoryExists, glob } from "../../utils/fs";

const mockDirectoryExists = vi.mocked(directoryExists);
const mockGlob = vi.mocked(glob);
const mockCopy = vi.mocked(copy);
const mockEnsureDir = vi.mocked(ensureDir);

function createMarketplace(plugins: MarketplacePlugin[] = []): Marketplace {
  return {
    name: "test-marketplace",
    version: "1.0.0",
    owner: { name: "Test Owner" },
    plugins,
  };
}

function createMarketplacePlugin(
  name: string,
  source: MarketplacePlugin["source"] = "local",
): MarketplacePlugin {
  return {
    name,
    source,
  };
}

describe("skill-fetcher", () => {
  const OUTPUT_DIR = "/test/output";
  const SOURCE_PATH = "/test/source";
  const SKILLS_OUTPUT_DIR = path.join(OUTPUT_DIR, "skills");

  describe("fetchSkills", () => {
    it("should create skills output directory", async () => {
      const marketplace = createMarketplace();

      // findSkillPath: baseDir does not exist
      mockDirectoryExists.mockResolvedValue(false);

      await expect(
        fetchSkills(["web-framework-react"], marketplace, OUTPUT_DIR, SOURCE_PATH),
      ).rejects.toThrow("Skill not found: web-framework-react");

      // ensureDir should have been called for the skills output dir
      expect(mockEnsureDir).toHaveBeenCalledWith(SKILLS_OUTPUT_DIR);
    });

    it("should return empty array when no skill IDs are provided", async () => {
      const marketplace = createMarketplace();

      const result = await fetchSkills([], marketplace, OUTPUT_DIR, SOURCE_PATH);

      expect(result).toEqual([]);
      expect(mockEnsureDir).toHaveBeenCalledWith(SKILLS_OUTPUT_DIR);
    });

    it("should find and copy a skill by glob pattern match", async () => {
      const marketplace = createMarketplace();
      const skillId: SkillId = "web-framework-react";
      const skillSourceDir = path.join(SOURCE_PATH, "src", "skills");

      // findSkillPath: baseDir exists
      mockDirectoryExists
        .mockResolvedValueOnce(true) // baseDir exists for findSkillPath
        .mockResolvedValue(true); // any subsequent checks

      // skillId does not contain "/", so glob is used
      mockGlob.mockResolvedValueOnce(["web/framework/web-framework-react/SKILL.md"]);

      const result = await fetchSkills([skillId], marketplace, OUTPUT_DIR, SOURCE_PATH);

      expect(result).toEqual([skillId]);

      // Should have called glob to find the skill
      // Dashes are NOT escaped by the regex - only special regex chars are
      expect(mockGlob).toHaveBeenCalledWith(`**/web-framework-react*/SKILL.md`, skillSourceDir);

      // Should have copied the skill
      expect(mockCopy).toHaveBeenCalledTimes(1);
      const copyCallSrc = mockCopy.mock.calls[0][0];
      const copyCallDest = mockCopy.mock.calls[0][1];
      expect(copyCallSrc).toBe(path.join(skillSourceDir, "web/framework/web-framework-react"));
      expect(copyCallDest).toBe(path.join(SKILLS_OUTPUT_DIR, "web/framework/web-framework-react"));
    });

    it("should find a skill by direct path when skillId contains a slash", async () => {
      const marketplace = createMarketplace();
      const skillId = "web/framework-react" as SkillId;
      const skillSourceDir = path.join(SOURCE_PATH, "src", "skills");

      // findSkillPath: baseDir exists, then direct path exists
      mockDirectoryExists
        .mockResolvedValueOnce(true) // baseDir exists
        .mockResolvedValueOnce(true); // fullPath (skillId with slash) exists

      const result = await fetchSkills([skillId], marketplace, OUTPUT_DIR, SOURCE_PATH);

      expect(result).toEqual([skillId]);
      expect(mockCopy).toHaveBeenCalledTimes(1);
      expect(mockCopy.mock.calls[0][0]).toBe(path.join(skillSourceDir, skillId));
    });

    it("should throw when skill is not found", async () => {
      const marketplace = createMarketplace();
      const skillId = "web-nonexistent-skill" as SkillId;

      // findSkillPath: baseDir exists but no matches
      mockDirectoryExists.mockResolvedValueOnce(true);
      mockGlob.mockResolvedValueOnce([]); // no glob matches

      await expect(fetchSkills([skillId], marketplace, OUTPUT_DIR, SOURCE_PATH)).rejects.toThrow(
        "Skill not found: web-nonexistent-skill",
      );
    });

    it("should throw when skill base directory does not exist", async () => {
      const marketplace = createMarketplace();
      const skillId: SkillId = "web-framework-react";

      // findSkillPath: baseDir does not exist
      mockDirectoryExists.mockResolvedValueOnce(false);

      await expect(fetchSkills([skillId], marketplace, OUTPUT_DIR, SOURCE_PATH)).rejects.toThrow(
        "Skill not found: web-framework-react",
      );
    });

    it("should copy multiple skills", async () => {
      const marketplace = createMarketplace();
      const skillIds: SkillId[] = ["web-framework-react", "api-framework-hono"];
      const skillSourceDir = path.join(SOURCE_PATH, "src", "skills");

      // For each skill: baseDir exists, glob finds a match
      mockDirectoryExists
        .mockResolvedValueOnce(true) // baseDir for first skill
        .mockResolvedValueOnce(true); // baseDir for second skill

      mockGlob
        .mockResolvedValueOnce(["web/framework/web-framework-react/SKILL.md"])
        .mockResolvedValueOnce(["api/api/api-framework-hono/SKILL.md"]);

      const result = await fetchSkills(skillIds, marketplace, OUTPUT_DIR, SOURCE_PATH);

      expect(result).toEqual(skillIds);
      expect(mockCopy).toHaveBeenCalledTimes(2);
    });

    it("should stop processing on first skill not found (throws)", async () => {
      const marketplace = createMarketplace();
      const skillIds: SkillId[] = [
        "web-framework-react",
        "web-nonexistent-skill",
        "api-framework-hono",
      ];

      // First skill found
      mockDirectoryExists
        .mockResolvedValueOnce(true) // baseDir for first skill
        .mockResolvedValueOnce(true); // baseDir for second skill

      mockGlob
        .mockResolvedValueOnce(["web/framework/web-framework-react/SKILL.md"])
        .mockResolvedValueOnce([]); // second skill not found

      await expect(fetchSkills(skillIds, marketplace, OUTPUT_DIR, SOURCE_PATH)).rejects.toThrow(
        "Skill not found: web-nonexistent-skill",
      );

      // First skill should have been copied before the error
      expect(mockCopy).toHaveBeenCalledTimes(1);
    });

    it("should resolve plugin source URL from marketplace when plugin exists", async () => {
      const marketplace = createMarketplace([
        createMarketplacePlugin("skill-web-framework-react", {
          source: "url",
          url: "https://example.com/react-skill.tar.gz",
        }),
      ]);
      const skillId: SkillId = "web-framework-react";

      // findSkillPath: baseDir exists, glob finds match
      mockDirectoryExists.mockResolvedValueOnce(true);
      mockGlob.mockResolvedValueOnce(["web/framework/web-framework-react/SKILL.md"]);

      const result = await fetchSkills([skillId], marketplace, OUTPUT_DIR, SOURCE_PATH);

      // Should still copy from source path (marketplace info is logged but not used for copy)
      expect(result).toEqual([skillId]);
      expect(mockCopy).toHaveBeenCalledTimes(1);
    });

    it("should resolve plugin source from github repo format", async () => {
      const marketplace = createMarketplace([
        createMarketplacePlugin("skill-web-framework-react", {
          repo: "my-org/react-skill",
          ref: "v1.0.0",
          source: "github",
        }),
      ]);
      const skillId: SkillId = "web-framework-react";

      mockDirectoryExists.mockResolvedValueOnce(true);
      mockGlob.mockResolvedValueOnce(["web/framework/web-framework-react/SKILL.md"]);

      const result = await fetchSkills([skillId], marketplace, OUTPUT_DIR, SOURCE_PATH);

      expect(result).toEqual([skillId]);
    });

    it("should resolve plugin source from string source", async () => {
      const marketplace = createMarketplace([
        createMarketplacePlugin("skill-web-framework-react", "github:my-org/react-skill"),
      ]);
      const skillId: SkillId = "web-framework-react";

      mockDirectoryExists.mockResolvedValueOnce(true);
      mockGlob.mockResolvedValueOnce(["web/framework/web-framework-react/SKILL.md"]);

      const result = await fetchSkills([skillId], marketplace, OUTPUT_DIR, SOURCE_PATH);

      expect(result).toEqual([skillId]);
    });

    it("should handle skill with author suffix in findSkillPath fallback", async () => {
      const marketplace = createMarketplace();
      // A skill ID that has an author-like suffix pattern - tested via glob fallback
      const skillId: SkillId = "web-framework-react";
      const skillSourceDir = path.join(SOURCE_PATH, "src", "skills");

      mockDirectoryExists.mockResolvedValueOnce(true); // baseDir exists
      // First glob (exact) finds nothing, so no author suffix stripping happens
      // (author suffix stripping only occurs for IDs matching /\s*\(@\w+\)$/)
      mockGlob.mockResolvedValueOnce(["web/framework/web-framework-react/SKILL.md"]);

      const result = await fetchSkills([skillId], marketplace, OUTPUT_DIR, SOURCE_PATH);

      expect(result).toEqual([skillId]);
    });

    it("should try path without author suffix for slash-containing IDs", async () => {
      const marketplace = createMarketplace();
      // Skill ID with a slash and an author suffix pattern
      const skillId = "web/react (@author)" as SkillId;
      const skillSourceDir = path.join(SOURCE_PATH, "src", "skills");

      mockDirectoryExists
        .mockResolvedValueOnce(true) // baseDir exists
        .mockResolvedValueOnce(false) // fullPath with author doesn't exist
        .mockResolvedValueOnce(true); // path without author exists

      const result = await fetchSkills([skillId], marketplace, OUTPUT_DIR, SOURCE_PATH);

      expect(result).toEqual([skillId]);
      expect(mockCopy).toHaveBeenCalledTimes(1);
      // The copy source should be the path without the author suffix
      expect(mockCopy.mock.calls[0][0]).toBe(path.join(skillSourceDir, "web/react"));
    });

    it("should try glob without author suffix when initial glob finds nothing", async () => {
      const marketplace = createMarketplace();
      // Skill ID with author suffix (non-slash form)
      const skillId = "web-react (@author)" as SkillId;
      const skillSourceDir = path.join(SOURCE_PATH, "src", "skills");

      mockDirectoryExists.mockResolvedValueOnce(true); // baseDir exists

      // First glob (with author suffix, escaped) finds nothing
      mockGlob.mockResolvedValueOnce([]);
      // Second glob (without author suffix) finds the skill
      mockGlob.mockResolvedValueOnce(["web/framework/web-react/SKILL.md"]);

      const result = await fetchSkills([skillId], marketplace, OUTPUT_DIR, SOURCE_PATH);

      expect(result).toEqual([skillId]);
      expect(mockGlob).toHaveBeenCalledTimes(2);
      // Second glob should be called without the author suffix
      // Dashes are NOT escaped by the regex - only special regex chars are
      expect(mockGlob.mock.calls[1][0]).toBe(`**/web-react*/SKILL.md`);
    });

    it("should handle marketplace plugin with repo source but no ref", async () => {
      const marketplace = createMarketplace([
        createMarketplacePlugin("skill-web-framework-react", {
          repo: "my-org/react-skill",
          source: "github",
        }),
      ]);
      const skillId: SkillId = "web-framework-react";

      mockDirectoryExists.mockResolvedValueOnce(true);
      mockGlob.mockResolvedValueOnce(["web/framework/web-framework-react/SKILL.md"]);

      const result = await fetchSkills([skillId], marketplace, OUTPUT_DIR, SOURCE_PATH);

      expect(result).toEqual([skillId]);
    });

    it("should use plugin name as fallback source when source is an object without url or repo", async () => {
      const marketplace = createMarketplace([
        createMarketplacePlugin("skill-web-framework-react", {
          source: "github",
          // No url and no repo - falls through to plugin.name fallback
        } as MarketplacePlugin["source"]),
      ]);
      const skillId: SkillId = "web-framework-react";

      mockDirectoryExists.mockResolvedValueOnce(true);
      mockGlob.mockResolvedValueOnce(["web/framework/web-framework-react/SKILL.md"]);

      const result = await fetchSkills([skillId], marketplace, OUTPUT_DIR, SOURCE_PATH);

      expect(result).toEqual([skillId]);
    });

    it("should not match marketplace plugin when plugin name does not match skill-{skillId}", async () => {
      const marketplace = createMarketplace([
        createMarketplacePlugin("skill-other-plugin", "local"),
      ]);
      const skillId: SkillId = "web-framework-react";

      mockDirectoryExists.mockResolvedValueOnce(true);
      mockGlob.mockResolvedValueOnce(["web/framework/web-framework-react/SKILL.md"]);

      const result = await fetchSkills([skillId], marketplace, OUTPUT_DIR, SOURCE_PATH);

      // Should still work - just copies from source path
      expect(result).toEqual([skillId]);
    });
  });
});
