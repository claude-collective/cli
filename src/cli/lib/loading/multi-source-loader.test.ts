import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadSkillsFromAllSources, searchExtraSources } from "./multi-source-loader";
import type { SkillId } from "../../types";
import type { ResolvedConfig, SourceEntry } from "../configuration";
import { createMockMatrix, createMockExtractedSkill, SKILLS } from "../__tests__/helpers";

// Mock external dependencies
vi.mock("../../utils/logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/logger")>()),
  verbose: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("../configuration", async () => {
  const actual = await vi.importActual("../configuration");
  return {
    ...actual,
    resolveAllSources: vi.fn(),
  };
});

vi.mock("./source-fetcher", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./source-fetcher")>()),
  fetchFromSource: vi.fn(),
  fetchMarketplace: vi.fn(),
}));

vi.mock("../matrix", async () => {
  const actual = await vi.importActual("../matrix");
  return {
    ...actual,
    extractAllSkills: vi.fn(),
  };
});

vi.mock("../plugins", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../plugins")>()),
  discoverAllPluginSkills: vi.fn().mockResolvedValue({}),
}));

const DEFAULT_SOURCE_CONFIG: ResolvedConfig = {
  source: "github:agents-inc/skills",
  sourceOrigin: "default",
};

describe("multi-source-loader", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset discoverAllPluginSkills to default empty result (clearAllMocks does not reset implementations)
    const { discoverAllPluginSkills } = await import("../plugins");
    vi.mocked(discoverAllPluginSkills).mockResolvedValue({});
  });

  describe("primary source tagging", () => {
    it("should tag non-local skills with public source", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [],
      });

      const matrix = createMockMatrix({ ...SKILLS.react }, { ...SKILLS.vitest });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react"]!;
      expect(react.availableSources).toStrictEqual([
        { name: "agents-inc", displayName: undefined, type: "public", installed: false, primary: true },
      ]);

      const vitest = matrix.skills["web-testing-vitest"]!;
      expect(vitest.availableSources).toStrictEqual([
        { name: "agents-inc", displayName: undefined, type: "public", installed: false, primary: true },
      ]);
    });

    it("should tag skills with private marketplace source when source is not default", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:private-org/skills" },
        extras: [],
      });

      const privateSourceConfig: ResolvedConfig = {
        source: "github:private-org/skills",
        sourceOrigin: "flag",
        marketplace: "Acme Corp",
      };

      const matrix = createMockMatrix({ ...SKILLS.react }, { ...SKILLS.vitest });

      await loadSkillsFromAllSources(matrix, privateSourceConfig, "/tmp/test");

      const react = matrix.skills["web-framework-react"]!;
      expect(react.availableSources).toStrictEqual([
        { name: "Acme Corp", displayName: undefined, type: "private", installed: false, primary: true },
      ]);

      const vitest = matrix.skills["web-testing-vitest"]!;
      expect(vitest.availableSources).toStrictEqual([
        { name: "Acme Corp", displayName: undefined, type: "private", installed: false, primary: true },
      ]);
    });

    it("should use marketplace from marketplace parameter over sourceConfig", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:private-org/skills" },
        extras: [],
      });

      const privateSourceConfig: ResolvedConfig = {
        source: "github:private-org/skills",
        sourceOrigin: "flag",
      };

      const matrix = createMockMatrix({ ...SKILLS.react });

      // marketplace parameter (from marketplace.json) takes precedence
      await loadSkillsFromAllSources(matrix, privateSourceConfig, "/tmp/test", false, "Acme Corp");

      const react = matrix.skills["web-framework-react"]!;
      expect(react.availableSources).toStrictEqual([
        { name: "Acme Corp", displayName: undefined, type: "private", installed: false, primary: true },
      ]);
    });

    it("should tag as public when default source has marketplace set", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [],
      });

      // Edge case: default source with marketplace set should use marketplace name but remain public type
      const configWithMarketplace: ResolvedConfig = {
        source: "github:agents-inc/skills",
        sourceOrigin: "default",
        marketplace: "SomeMarketplace",
      };

      const matrix = createMockMatrix({ ...SKILLS.react });

      await loadSkillsFromAllSources(matrix, configWithMarketplace, "/tmp/test");

      const react = matrix.skills["web-framework-react"]!;
      expect(react.availableSources).toStrictEqual([
        { name: "SomeMarketplace", displayName: undefined, type: "public", installed: false, primary: true },
      ]);
    });

    it("should tag local skills with both public and local sources", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [],
      });

      const matrix = createMockMatrix({
        ...SKILLS.react,
        local: true,
        localPath: "/mock-project/.claude/skills/react/",
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react"]!;
      expect(react.availableSources).toStrictEqual([
        { name: "agents-inc", displayName: undefined, type: "public", installed: false, primary: true },
        { name: "eject", type: "local", installed: true, installMode: "eject" },
      ]);

      // activeSource should be the local source (installed)
      expect(react.activeSource).toStrictEqual({
        name: "eject", type: "local", installed: true, installMode: "eject",
      });
    });
  });

  describe("local skill tagging", () => {
    it("should tag local skills with local source and installed: true", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [],
      });

      const matrix = createMockMatrix({
        ...SKILLS.react,
        local: true,
        localPath: "/mock-project/.claude/skills/react/",
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react"]!;
      expect(react.availableSources).toStrictEqual([
        { name: "agents-inc", displayName: undefined, type: "public", installed: false, primary: true },
        { name: "eject", type: "local", installed: true, installMode: "eject" },
      ]);
    });
  });

  describe("activeSource", () => {
    it("should set activeSource to installed variant when available", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [],
      });

      const matrix = createMockMatrix({
        ...SKILLS.react,
        local: true,
        localPath: "/mock-project/.claude/skills/react/",
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react"]!;
      expect(react.activeSource).toStrictEqual({
        name: "eject", type: "local", installed: true, installMode: "eject",
      });
    });

    it("should set activeSource to public when no installed variant", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [],
      });

      const matrix = createMockMatrix({ ...SKILLS.react });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react"]!;
      expect(react.activeSource).toStrictEqual({
        name: "agents-inc", displayName: undefined, type: "public", installed: false, primary: true,
      });
    });
  });

  describe("extra source failures", () => {
    it("should produce warnings for failed extra sources, not hard errors", async () => {
      const { resolveAllSources } = await import("../configuration");
      const { warn } = await import("../../utils/logger");

      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [{ name: "acme-corp", url: "github:acme-corp/skills" }],
      });

      const { fetchFromSource } = await import("./source-fetcher");
      vi.mocked(fetchFromSource).mockRejectedValue(new Error("Network timeout"));

      const matrix = createMockMatrix({ ...SKILLS.react });

      // Should not throw
      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      // Should have warned
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load extra source 'acme-corp'"),
      );

      // Original skill should still have public source
      const react = matrix.skills["web-framework-react"]!;
      expect(react.availableSources).toStrictEqual([
        { name: "agents-inc", displayName: undefined, type: "public", installed: false, primary: true },
      ]);
    });
  });

  describe("overlapping skill IDs", () => {
    it("should collect all source variants for the same skill", async () => {
      const { resolveAllSources } = await import("../configuration");
      const { fetchFromSource } = await import("./source-fetcher");
      const { extractAllSkills } = await import("../matrix");

      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [{ name: "acme-corp", url: "github:acme-corp/skills" }],
      });

      vi.mocked(fetchFromSource).mockResolvedValue({
        path: "/tmp/cached/acme-corp",
        fromCache: true,
        source: "github:acme-corp/skills",
      });

      vi.mocked(extractAllSkills).mockResolvedValue([
        createMockExtractedSkill("web-framework-react", {
          author: "@acme",
        }),
      ]);

      const matrix = createMockMatrix({ ...SKILLS.react });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react"]!;
      expect(react.availableSources).toStrictEqual([
        { name: "agents-inc", displayName: undefined, type: "public", installed: false, primary: true },
        { name: "acme-corp", type: "private", url: "github:acme-corp/skills", installed: false },
      ]);
    });
  });

  describe("plugin skill tagging", () => {
    it("should tag plugin-installed skills", async () => {
      const { resolveAllSources } = await import("../configuration");
      const { discoverAllPluginSkills } = await import("../plugins");

      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [],
      });

      // Mock discoverAllPluginSkills to return skills from global cache
      vi.mocked(discoverAllPluginSkills).mockResolvedValue({
        "web-framework-react": {
          id: "web-framework-react",
          description: "React framework skill",
          path: "/global/cache/react/skills/web/framework/react",
        },
      } as Partial<Record<SkillId, import("../../types").SkillDefinition>> as Record<
        SkillId,
        import("../../types").SkillDefinition
      >);

      const matrix = createMockMatrix({ ...SKILLS.react });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react"]!;
      // Should have a single public source marked as plugin-installed
      expect(react.availableSources).toStrictEqual([
        { name: "agents-inc", displayName: undefined, type: "public", installed: true, installMode: "plugin", primary: true },
      ]);
    });

    it("should tag skills from multiple plugins discovered via settings.json", async () => {
      const { resolveAllSources } = await import("../configuration");
      const { discoverAllPluginSkills } = await import("../plugins");

      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [],
      });

      vi.mocked(discoverAllPluginSkills).mockResolvedValue({
        "web-framework-react": {
          id: "web-framework-react",
          description: "React",
          path: "/global/cache/react/skills/web/framework/react",
        },
        "web-state-zustand": {
          id: "web-state-zustand",
          description: "Zustand",
          path: "/global/cache/zustand/skills/web/state/zustand",
        },
      } as Partial<Record<SkillId, import("../../types").SkillDefinition>> as Record<
        SkillId,
        import("../../types").SkillDefinition
      >);

      const matrix = createMockMatrix({ ...SKILLS.react }, { ...SKILLS.zustand });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react"]!;
      expect(react.availableSources).toStrictEqual([
        { name: "agents-inc", displayName: undefined, type: "public", installed: true, installMode: "plugin", primary: true },
      ]);

      const zustand = matrix.skills["web-state-zustand"]!;
      expect(zustand.availableSources).toStrictEqual([
        { name: "agents-inc", displayName: undefined, type: "public", installed: true, installMode: "plugin", primary: true },
      ]);
    });
  });

  describe("public source fallback tagging", () => {
    it("should tag matching skills with public source when primary is non-default", async () => {
      const { resolveAllSources } = await import("../configuration");
      const { fetchFromSource } = await import("./source-fetcher");
      const { fetchMarketplace } = await import("./source-fetcher");
      const { extractAllSkills } = await import("../matrix");

      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:private-org/skills" },
        extras: [],
      });

      // fetchMarketplace for public source -- return a marketplace name
      vi.mocked(fetchMarketplace).mockResolvedValue({
        marketplace: {
          name: "agents-inc",
          version: "1.0.0",
          description: "Public",
          owner: { name: "agents-inc" },
          plugins: [],
        },
        sourcePath: "/tmp/cached/agents-inc",
        fromCache: true,
      });

      // fetchFromSource for public source
      vi.mocked(fetchFromSource).mockResolvedValue({
        path: "/tmp/cached/agents-inc",
        fromCache: true,
        source: "github:agents-inc/skills",
      });

      // extractAllSkills for public source -- react exists in public, vitest does not
      vi.mocked(extractAllSkills).mockResolvedValue([
        createMockExtractedSkill("web-framework-react", {
          author: "@agents-inc",
        }),
      ]);

      const privateSourceConfig: ResolvedConfig = {
        source: "github:private-org/skills",
        sourceOrigin: "flag",
        marketplace: "Acme Corp",
      };

      const matrix = createMockMatrix({ ...SKILLS.react }, { ...SKILLS.vitest });

      await loadSkillsFromAllSources(matrix, privateSourceConfig, "/tmp/test");

      // React should have both private (Acme Corp) and public (Agents Inc) sources
      const react = matrix.skills["web-framework-react"]!;
      expect(react.availableSources).toStrictEqual([
        { name: "Acme Corp", displayName: undefined, type: "private", installed: false, primary: true },
        { name: "agents-inc", type: "public", installed: false },
      ]);

      // Vitest only exists in private source, not in public
      const vitest = matrix.skills["web-testing-vitest"]!;
      expect(vitest.availableSources).toStrictEqual([
        { name: "Acme Corp", displayName: undefined, type: "private", installed: false, primary: true },
      ]);
    });

    it("should not duplicate public source when primary IS the default source", async () => {
      const { resolveAllSources } = await import("../configuration");
      const { fetchFromSource } = await import("./source-fetcher");

      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [],
      });

      const matrix = createMockMatrix({ ...SKILLS.react });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react"]!;
      // Only the primary public source -- no duplicate public tagging
      expect(react.availableSources).toStrictEqual([
        { name: "agents-inc", displayName: undefined, type: "public", installed: false, primary: true },
      ]);

      // fetchFromSource should NOT have been called for public fallback
      expect(fetchFromSource).not.toHaveBeenCalled();
    });

    it("should use fallback name when public source has no marketplace.json", async () => {
      const { resolveAllSources } = await import("../configuration");
      const { fetchFromSource } = await import("./source-fetcher");
      const { fetchMarketplace } = await import("./source-fetcher");
      const { extractAllSkills } = await import("../matrix");

      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:private-org/skills" },
        extras: [],
      });

      // fetchMarketplace fails -- no marketplace.json in public source
      vi.mocked(fetchMarketplace).mockRejectedValue(new Error("Not found"));

      vi.mocked(fetchFromSource).mockResolvedValue({
        path: "/tmp/cached/agents-inc",
        fromCache: true,
        source: "github:agents-inc/skills",
      });

      vi.mocked(extractAllSkills).mockResolvedValue([
        createMockExtractedSkill("web-framework-react", {
          author: "@agents-inc",
        }),
      ]);

      const privateSourceConfig: ResolvedConfig = {
        source: "github:private-org/skills",
        sourceOrigin: "flag",
        marketplace: "Acme Corp",
      };

      const matrix = createMockMatrix({ ...SKILLS.react });

      await loadSkillsFromAllSources(matrix, privateSourceConfig, "/tmp/test");

      const react = matrix.skills["web-framework-react"]!;
      // Public source should use fallback name "agents-inc"
      expect(react.availableSources).toStrictEqual([
        { name: "Acme Corp", displayName: undefined, type: "private", installed: false, primary: true },
        { name: "agents-inc", type: "public", installed: false },
      ]);
    });

    it("should handle public source fetch failure gracefully", async () => {
      const { resolveAllSources } = await import("../configuration");
      const { fetchFromSource } = await import("./source-fetcher");
      const { fetchMarketplace } = await import("./source-fetcher");
      const { warn } = await import("../../utils/logger");

      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:private-org/skills" },
        extras: [],
      });

      vi.mocked(fetchMarketplace).mockRejectedValue(new Error("Not found"));
      vi.mocked(fetchFromSource).mockRejectedValue(new Error("Network error"));

      const privateSourceConfig: ResolvedConfig = {
        source: "github:private-org/skills",
        sourceOrigin: "flag",
        marketplace: "Acme Corp",
      };

      const matrix = createMockMatrix({ ...SKILLS.react });

      // Should not throw
      await loadSkillsFromAllSources(matrix, privateSourceConfig, "/tmp/test");

      // Should have warned about the failure
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Failed to load public source"));

      // Skill should still have just the private source
      const react = matrix.skills["web-framework-react"]!;
      expect(react.availableSources).toStrictEqual([
        { name: "Acme Corp", displayName: undefined, type: "private", installed: false, primary: true },
      ]);
    });
  });

  describe("searchExtraSources", () => {
    it("should return empty array when no sources configured", async () => {
      const result = await searchExtraSources("react", []);
      expect(result).toStrictEqual([]);
    });

    it("should find matching skills by alias from a single source", async () => {
      const { fetchFromSource } = await import("./source-fetcher");
      const { extractAllSkills } = await import("../matrix");

      vi.mocked(fetchFromSource).mockResolvedValue({
        path: "/tmp/cached/acme-corp",
        fromCache: true,
        source: "github:acme-corp/skills",
      });

      vi.mocked(extractAllSkills).mockResolvedValue([
        createMockExtractedSkill("web-framework-react-pro" as SkillId, {
          directoryPath: "web/framework/react",
          description: "Opinionated React with strict TS",
          author: "@acme",
          path: "skills/web/framework/react/",
        }),
        createMockExtractedSkill("web-framework-vue-pro" as SkillId, {
          directoryPath: "web/framework/vue",
          author: "@acme",
          path: "skills/web/framework/vue/",
        }),
      ]);

      const sources: SourceEntry[] = [{ name: "acme-corp", url: "github:acme-corp/skills" }];

      const result = await searchExtraSources("react", sources);

      expect(result).toStrictEqual([{
        id: "web-framework-react-pro",
        sourceName: "acme-corp",
        sourceUrl: "github:acme-corp/skills",
        alias: "react",
        description: "Opinionated React with strict TS",
      }]);
    });

    it("should find matching skills from multiple sources", async () => {
      const { fetchFromSource } = await import("./source-fetcher");
      const { extractAllSkills } = await import("../matrix");

      vi.mocked(fetchFromSource)
        .mockResolvedValueOnce({
          path: "/tmp/cached/acme-corp",
          fromCache: true,
          source: "github:acme-corp/skills",
        })
        .mockResolvedValueOnce({
          path: "/tmp/cached/team-xyz",
          fromCache: true,
          source: "github:team-xyz/skills",
        });

      vi.mocked(extractAllSkills)
        .mockResolvedValueOnce([
          createMockExtractedSkill("web-framework-react-pro" as SkillId, {
            directoryPath: "web/framework/react",
            author: "@acme",
            path: "skills/web/framework/react/",
          }),
        ])
        .mockResolvedValueOnce([
          createMockExtractedSkill("web-framework-react-strict" as SkillId, {
            directoryPath: "web/framework/react",
            author: "@team-xyz",
            path: "skills/web/framework/react/",
          }),
        ]);

      const sources: SourceEntry[] = [
        { name: "acme-corp", url: "github:acme-corp/skills" },
        { name: "team-xyz", url: "github:team-xyz/skills" },
      ];

      const result = await searchExtraSources("react", sources);

      expect(result).toStrictEqual([
        {
          id: "web-framework-react-pro",
          sourceName: "acme-corp",
          sourceUrl: "github:acme-corp/skills",
          alias: "react",
          description: "web-framework-react-pro skill",
        },
        {
          id: "web-framework-react-strict",
          sourceName: "team-xyz",
          sourceUrl: "github:team-xyz/skills",
          alias: "react",
          description: "web-framework-react-strict skill",
        },
      ]);
    });

    it("should handle failed sources gracefully without throwing", async () => {
      const { fetchFromSource } = await import("./source-fetcher");
      const { extractAllSkills } = await import("../matrix");
      const { warn } = await import("../../utils/logger");

      vi.mocked(fetchFromSource)
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockResolvedValueOnce({
          path: "/tmp/cached/team-xyz",
          fromCache: true,
          source: "github:team-xyz/skills",
        });

      vi.mocked(extractAllSkills).mockResolvedValueOnce([
        createMockExtractedSkill("web-framework-react-strict" as SkillId, {
          directoryPath: "web/framework/react",
          author: "@team-xyz",
          path: "skills/web/framework/react/",
        }),
      ]);

      const sources: SourceEntry[] = [
        { name: "broken-source", url: "github:broken/skills" },
        { name: "team-xyz", url: "github:team-xyz/skills" },
      ];

      const result = await searchExtraSources("react", sources);

      // Should still return results from the working source
      expect(result).toStrictEqual([{
        id: "web-framework-react-strict",
        sourceName: "team-xyz",
        sourceUrl: "github:team-xyz/skills",
        alias: "react",
        description: "web-framework-react-strict skill",
      }]);

      // Should have warned about the failed source
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to search extra source 'broken-source'"),
      );
    });

    it("should return empty array when no skills match the alias", async () => {
      const { fetchFromSource } = await import("./source-fetcher");
      const { extractAllSkills } = await import("../matrix");

      vi.mocked(fetchFromSource).mockResolvedValue({
        path: "/tmp/cached/acme-corp",
        fromCache: true,
        source: "github:acme-corp/skills",
      });

      vi.mocked(extractAllSkills).mockResolvedValue([
        createMockExtractedSkill("web-framework-vue-pro" as SkillId, {
          directoryPath: "web/framework/vue",
          author: "@acme",
          path: "skills/web/framework/vue/",
        }),
      ]);

      const sources: SourceEntry[] = [{ name: "acme-corp", url: "github:acme-corp/skills" }];

      const result = await searchExtraSources("react", sources);
      expect(result).toStrictEqual([]);
    });

    it("should match alias case-insensitively", async () => {
      const { fetchFromSource } = await import("./source-fetcher");
      const { extractAllSkills } = await import("../matrix");

      vi.mocked(fetchFromSource).mockResolvedValue({
        path: "/tmp/cached/acme-corp",
        fromCache: true,
        source: "github:acme-corp/skills",
      });

      vi.mocked(extractAllSkills).mockResolvedValue([
        createMockExtractedSkill("web-framework-react-pro" as SkillId, {
          directoryPath: "web/framework/React",
          author: "@acme",
          path: "skills/web/framework/React/",
        }),
      ]);

      const sources: SourceEntry[] = [{ name: "acme-corp", url: "github:acme-corp/skills" }];

      const result = await searchExtraSources("react", sources);
      expect(result).toStrictEqual([{
        id: "web-framework-react-pro",
        sourceName: "acme-corp",
        sourceUrl: "github:acme-corp/skills",
        alias: "react",
        description: "web-framework-react-pro skill",
      }]);
    });
  });
});
