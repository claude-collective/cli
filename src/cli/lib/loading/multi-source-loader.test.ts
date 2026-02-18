import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadSkillsFromAllSources, searchExtraSources } from "./multi-source-loader";
import type { SkillId } from "../../types";
import type { ResolvedConfig, SourceEntry } from "../configuration";
import { createMockSkill, createMockMatrix, createMockExtractedSkill } from "../__tests__/helpers";

// Mock external dependencies
vi.mock("../../utils/logger", () => ({
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

vi.mock("./source-fetcher", () => ({
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

vi.mock("../plugins", () => ({
  discoverAllPluginSkills: vi.fn().mockResolvedValue({}),
}));

const DEFAULT_SOURCE_CONFIG: ResolvedConfig = {
  source: "github:agents-inc/skills",
  sourceOrigin: "default",
};

describe("multi-source-loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("primary source tagging", () => {
    it("should tag non-local skills with public source", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [],
      });

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
        "web-testing-vitest": createMockSkill("web-testing-vitest" as SkillId, "testing"),
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.availableSources).toBeDefined();
      expect(react.availableSources).toHaveLength(1);
      expect(react.availableSources![0].type).toBe("public");
      expect(react.availableSources![0].name).toBe("Agents Inc");
      expect(react.availableSources![0].installed).toBe(false);
      expect(react.availableSources![0].primary).toBe(true);

      const vitest = matrix.skills["web-testing-vitest" as SkillId]!;
      expect(vitest.availableSources).toBeDefined();
      expect(vitest.availableSources).toHaveLength(1);
      expect(vitest.availableSources![0].type).toBe("public");
      expect(vitest.availableSources![0].primary).toBe(true);
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
        marketplace: "Photoroom",
      };

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
        "web-testing-vitest": createMockSkill("web-testing-vitest" as SkillId, "testing"),
      });

      await loadSkillsFromAllSources(matrix, privateSourceConfig, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.availableSources).toBeDefined();
      expect(react.availableSources).toHaveLength(1);
      expect(react.availableSources![0].type).toBe("private");
      expect(react.availableSources![0].name).toBe("Photoroom");
      expect(react.availableSources![0].installed).toBe(false);
      expect(react.availableSources![0].primary).toBe(true);

      const vitest = matrix.skills["web-testing-vitest" as SkillId]!;
      expect(vitest.availableSources).toBeDefined();
      expect(vitest.availableSources).toHaveLength(1);
      expect(vitest.availableSources![0].type).toBe("private");
      expect(vitest.availableSources![0].name).toBe("Photoroom");
      expect(vitest.availableSources![0].primary).toBe(true);
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

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
      });

      // marketplace parameter (from marketplace.json) takes precedence
      await loadSkillsFromAllSources(
        matrix,
        privateSourceConfig,
        "/tmp/test",
        false,
        "Acme Corp",
      );

      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.availableSources).toBeDefined();
      expect(react.availableSources).toHaveLength(1);
      expect(react.availableSources![0].type).toBe("private");
      expect(react.availableSources![0].name).toBe("Acme Corp");
      expect(react.availableSources![0].primary).toBe(true);
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

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
      });

      await loadSkillsFromAllSources(matrix, configWithMarketplace, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.availableSources).toBeDefined();
      expect(react.availableSources).toHaveLength(1);
      expect(react.availableSources![0].type).toBe("public");
      expect(react.availableSources![0].name).toBe("SomeMarketplace");
      expect(react.availableSources![0].primary).toBe(true);
    });

    it("should tag local skills with both public and local sources", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [],
      });

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing", {
          local: true,
          localPath: ".claude/skills/react/",
        }),
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.availableSources).toBeDefined();
      expect(react.availableSources).toHaveLength(2);

      const publicSource = react.availableSources!.find((s) => s.type === "public");
      expect(publicSource).toBeDefined();
      expect(publicSource!.installed).toBe(false);
      expect(publicSource!.primary).toBe(true);

      const localSource = react.availableSources!.find((s) => s.type === "local");
      expect(localSource).toBeDefined();
      expect(localSource!.installed).toBe(true);
      expect(localSource!.installMode).toBe("local");

      // activeSource should be the local source (installed)
      expect(react.activeSource).toBeDefined();
      expect(react.activeSource!.type).toBe("local");
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
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing", {
          local: true,
          localPath: ".claude/skills/react/",
        }),
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.availableSources).toBeDefined();
      const localSource = react.availableSources!.find((s) => s.type === "local");
      expect(localSource).toBeDefined();
      expect(localSource!.name).toBe("local");
      expect(localSource!.installed).toBe(true);
      expect(localSource!.installMode).toBe("local");
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
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing", {
          local: true,
          localPath: ".claude/skills/react/",
        }),
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.activeSource).toBeDefined();
      expect(react.activeSource!.type).toBe("local");
      expect(react.activeSource!.installed).toBe(true);
    });

    it("should set activeSource to public when no installed variant", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [],
      });

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.activeSource).toBeDefined();
      expect(react.activeSource!.type).toBe("public");
      expect(react.activeSource!.name).toBe("Agents Inc");
    });
  });

  describe("extra source failures", () => {
    it("should produce warnings for failed extra sources, not hard errors", async () => {
      const { resolveAllSources } = await import("../configuration");
      const { warn } = await import("../../utils/logger");

      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [
          { name: "acme-corp", url: "github:acme-corp/skills", description: "Private skills" },
        ],
      });

      const { fetchFromSource } = await import("./source-fetcher");
      vi.mocked(fetchFromSource).mockRejectedValue(new Error("Network timeout"));

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
      });

      // Should not throw
      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      // Should have warned
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load extra source 'acme-corp'"),
      );

      // Original skill should still have public source
      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.availableSources).toBeDefined();
      expect(react.availableSources).toHaveLength(1);
      expect(react.availableSources![0].type).toBe("public");
    });
  });

  describe("overlapping skill IDs", () => {
    it("should collect all source variants for the same skill", async () => {
      const { resolveAllSources } = await import("../configuration");
      const { fetchFromSource } = await import("./source-fetcher");
      const { extractAllSkills } = await import("../matrix");

      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [{ name: "acme-corp", url: "github:acme-corp/skills", description: "Acme skills" }],
      });

      vi.mocked(fetchFromSource).mockResolvedValue({
        path: "/tmp/cached/acme-corp",
        fromCache: true,
        source: "github:acme-corp/skills",
      });

      vi.mocked(extractAllSkills).mockResolvedValue([
        createMockExtractedSkill("web-framework-react" as SkillId, {
          description: "Acme React",
          author: "@acme",
        }),
      ]);

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.availableSources).toBeDefined();
      expect(react.availableSources!.length).toBe(2);

      const types = react.availableSources!.map((s) => s.type);
      expect(types).toContain("public");
      expect(types).toContain("private");

      const privateSource = react.availableSources!.find((s) => s.type === "private")!;
      expect(privateSource.name).toBe("acme-corp");
      expect(privateSource.url).toBe("github:acme-corp/skills");
      expect(privateSource.installed).toBe(false);
      expect(privateSource.primary).toBeUndefined();
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
          id: "web-framework-react" as SkillId,
          description: "React framework skill",
          path: "/global/cache/react/skills/web/framework/react",
        },
      } as Partial<Record<SkillId, import("../../types").SkillDefinition>> as Record<
        SkillId,
        import("../../types").SkillDefinition
      >);

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.availableSources).toBeDefined();

      // Should have a single public source marked as plugin-installed
      expect(react.availableSources).toHaveLength(1);
      const publicSource = react.availableSources![0];
      expect(publicSource.type).toBe("public");
      expect(publicSource.installed).toBe(true);
      expect(publicSource.installMode).toBe("plugin");
      expect(publicSource.primary).toBe(true);
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
          id: "web-framework-react" as SkillId,
          description: "React",
          path: "/global/cache/react/skills/web/framework/react",
        },
        "web-state-zustand": {
          id: "web-state-zustand" as SkillId,
          description: "Zustand",
          path: "/global/cache/zustand/skills/web/state/zustand",
        },
      } as Partial<Record<SkillId, import("../../types").SkillDefinition>> as Record<
        SkillId,
        import("../../types").SkillDefinition
      >);

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
        "web-state-zustand": createMockSkill("web-state-zustand" as SkillId, "testing"),
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.availableSources![0].installed).toBe(true);
      expect(react.availableSources![0].installMode).toBe("plugin");

      const zustand = matrix.skills["web-state-zustand" as SkillId]!;
      expect(zustand.availableSources![0].installed).toBe(true);
      expect(zustand.availableSources![0].installMode).toBe("plugin");
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
          name: "Agents Inc",
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
        createMockExtractedSkill("web-framework-react" as SkillId, {
          description: "Public React",
          author: "@agents-inc",
        }),
      ]);

      const privateSourceConfig: ResolvedConfig = {
        source: "github:private-org/skills",
        sourceOrigin: "flag",
        marketplace: "Photoroom",
      };

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
        "web-testing-vitest": createMockSkill("web-testing-vitest" as SkillId, "testing"),
      });

      await loadSkillsFromAllSources(matrix, privateSourceConfig, "/tmp/test");

      // React should have both private (Photoroom) and public (Agents Inc) sources
      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.availableSources).toBeDefined();
      expect(react.availableSources).toHaveLength(2);

      const privateSource = react.availableSources!.find((s) => s.type === "private");
      expect(privateSource).toBeDefined();
      expect(privateSource!.name).toBe("Photoroom");
      expect(privateSource!.primary).toBe(true);

      const publicSource = react.availableSources!.find((s) => s.type === "public");
      expect(publicSource).toBeDefined();
      expect(publicSource!.name).toBe("Agents Inc");
      expect(publicSource!.installed).toBe(false);
      expect(publicSource!.primary).toBeUndefined();

      // Vitest only exists in private source, not in public
      const vitest = matrix.skills["web-testing-vitest" as SkillId]!;
      expect(vitest.availableSources).toHaveLength(1);
      expect(vitest.availableSources![0].type).toBe("private");
      expect(vitest.availableSources![0].name).toBe("Photoroom");
      expect(vitest.availableSources![0].primary).toBe(true);
    });

    it("should not duplicate public source when primary IS the default source", async () => {
      const { resolveAllSources } = await import("../configuration");
      const { fetchFromSource } = await import("./source-fetcher");

      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:agents-inc/skills" },
        extras: [],
      });

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      // Only the primary public source -- no duplicate public tagging
      expect(react.availableSources).toHaveLength(1);
      expect(react.availableSources![0].type).toBe("public");
      expect(react.availableSources![0].name).toBe("Agents Inc");

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
        createMockExtractedSkill("web-framework-react" as SkillId, {
          description: "Public React",
          author: "@agents-inc",
        }),
      ]);

      const privateSourceConfig: ResolvedConfig = {
        source: "github:private-org/skills",
        sourceOrigin: "flag",
        marketplace: "Photoroom",
      };

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
      });

      await loadSkillsFromAllSources(matrix, privateSourceConfig, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.availableSources).toHaveLength(2);

      // Public source should use fallback name "Agents Inc"
      const publicSource = react.availableSources!.find((s) => s.type === "public");
      expect(publicSource).toBeDefined();
      expect(publicSource!.name).toBe("Agents Inc");
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
        marketplace: "Photoroom",
      };

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
      });

      // Should not throw
      await loadSkillsFromAllSources(matrix, privateSourceConfig, "/tmp/test");

      // Should have warned about the failure
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load public source"),
      );

      // Skill should still have just the private source
      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.availableSources).toHaveLength(1);
      expect(react.availableSources![0].type).toBe("private");
      expect(react.availableSources![0].name).toBe("Photoroom");
    });
  });

  describe("searchExtraSources", () => {
    it("should return empty array when no sources configured", async () => {
      const result = await searchExtraSources("react", []);
      expect(result).toEqual([]);
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
          description: "Acme Vue",
          author: "@acme",
          path: "skills/web/framework/vue/",
        }),
      ]);

      const sources: SourceEntry[] = [{ name: "acme-corp", url: "github:acme-corp/skills" }];

      const result = await searchExtraSources("react", sources);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("web-framework-react-pro");
      expect(result[0].sourceName).toBe("acme-corp");
      expect(result[0].sourceUrl).toBe("github:acme-corp/skills");
      expect(result[0].alias).toBe("react");
      expect(result[0].description).toBe("Opinionated React with strict TS");
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
            description: "Acme React Pro",
            author: "@acme",
            path: "skills/web/framework/react/",
          }),
        ])
        .mockResolvedValueOnce([
          createMockExtractedSkill("web-framework-react-strict" as SkillId, {
            directoryPath: "web/framework/react",
            description: "Strict React",
            author: "@team-xyz",
            path: "skills/web/framework/react/",
          }),
        ]);

      const sources: SourceEntry[] = [
        { name: "acme-corp", url: "github:acme-corp/skills" },
        { name: "team-xyz", url: "github:team-xyz/skills" },
      ];

      const result = await searchExtraSources("react", sources);

      expect(result).toHaveLength(2);
      expect(result[0].sourceName).toBe("acme-corp");
      expect(result[0].id).toBe("web-framework-react-pro");
      expect(result[1].sourceName).toBe("team-xyz");
      expect(result[1].id).toBe("web-framework-react-strict");
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
          description: "Strict React",
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
      expect(result).toHaveLength(1);
      expect(result[0].sourceName).toBe("team-xyz");

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
          description: "Acme Vue",
          author: "@acme",
          path: "skills/web/framework/vue/",
        }),
      ]);

      const sources: SourceEntry[] = [{ name: "acme-corp", url: "github:acme-corp/skills" }];

      const result = await searchExtraSources("react", sources);
      expect(result).toHaveLength(0);
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
          description: "Acme React Pro",
          author: "@acme",
          path: "skills/web/framework/React/",
        }),
      ]);

      const sources: SourceEntry[] = [{ name: "acme-corp", url: "github:acme-corp/skills" }];

      const result = await searchExtraSources("react", sources);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("web-framework-react-pro");
    });
  });
});
