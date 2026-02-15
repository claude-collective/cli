import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadSkillsFromAllSources, searchExtraSources } from "./multi-source-loader";
import type { SkillId } from "../../types";
import type { ResolvedConfig, SourceEntry } from "../configuration";
import { createMockSkill, createMockMatrix } from "../__tests__/helpers";

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
}));

vi.mock("../matrix", async () => {
  const actual = await vi.importActual("../matrix");
  return {
    ...actual,
    extractAllSkills: vi.fn(),
  };
});

vi.mock("../plugins", () => ({
  getCollectivePluginDir: vi.fn().mockReturnValue("/fake/.claude/plugins/claude-collective"),
  getPluginSkillsDir: vi.fn().mockReturnValue("/fake/.claude/plugins/claude-collective/skills"),
  getPluginSkillIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../utils/fs", () => ({
  directoryExists: vi.fn().mockResolvedValue(false),
}));

const DEFAULT_SOURCE_CONFIG: ResolvedConfig = {
  source: "github:claude-collective/skills",
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
        primary: { name: "marketplace", url: "github:claude-collective/skills" },
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
      expect(react.availableSources![0].name).toBe("public");
      expect(react.availableSources![0].installed).toBe(false);

      const vitest = matrix.skills["web-testing-vitest" as SkillId]!;
      expect(vitest.availableSources).toBeDefined();
      expect(vitest.availableSources).toHaveLength(1);
      expect(vitest.availableSources![0].type).toBe("public");
    });

    it("should tag local skills with both public and local sources", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:claude-collective/skills" },
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
        primary: { name: "marketplace", url: "github:claude-collective/skills" },
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
        primary: { name: "marketplace", url: "github:claude-collective/skills" },
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
        primary: { name: "marketplace", url: "github:claude-collective/skills" },
        extras: [],
      });

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react" as SkillId, "testing"),
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      expect(react.activeSource).toBeDefined();
      expect(react.activeSource!.type).toBe("public");
      expect(react.activeSource!.name).toBe("public");
    });
  });

  describe("extra source failures", () => {
    it("should produce warnings for failed extra sources, not hard errors", async () => {
      const { resolveAllSources } = await import("../configuration");
      const { warn } = await import("../../utils/logger");

      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:claude-collective/skills" },
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
        primary: { name: "marketplace", url: "github:claude-collective/skills" },
        extras: [{ name: "acme-corp", url: "github:acme-corp/skills", description: "Acme skills" }],
      });

      vi.mocked(fetchFromSource).mockResolvedValue({
        path: "/tmp/cached/acme-corp",
        fromCache: true,
        source: "github:acme-corp/skills",
      });

      vi.mocked(extractAllSkills).mockResolvedValue([
        {
          id: "web-framework-react" as SkillId,
          directoryPath: "web/framework/react",
          description: "Acme React",
          category: "framework",
          categoryExclusive: true,
          author: "@acme",
          tags: [],
          compatibleWith: [],
          conflictsWith: [],
          requires: [],
          requiresSetup: [],
          providesSetupFor: [],
          path: "skills/web/framework/react/",
        },
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
    });
  });

  describe("plugin skill tagging", () => {
    it("should tag plugin-installed skills", async () => {
      const { resolveAllSources } = await import("../configuration");
      const { getPluginSkillIds } = await import("../plugins");
      const { directoryExists } = await import("../../utils/fs");

      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:claude-collective/skills" },
        extras: [],
      });

      vi.mocked(directoryExists).mockResolvedValue(true);
      vi.mocked(getPluginSkillIds).mockResolvedValue(["web-framework-react" as SkillId]);

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
        {
          id: "web-framework-react-pro" as SkillId,
          directoryPath: "web/framework/react",
          description: "Opinionated React with strict TS",
          category: "framework",
          categoryExclusive: true,
          author: "@acme",
          tags: [],
          compatibleWith: [],
          conflictsWith: [],
          requires: [],
          requiresSetup: [],
          providesSetupFor: [],
          path: "skills/web/framework/react/",
        },
        {
          id: "web-framework-vue-pro" as SkillId,
          directoryPath: "web/framework/vue",
          description: "Acme Vue",
          category: "framework",
          categoryExclusive: true,
          author: "@acme",
          tags: [],
          compatibleWith: [],
          conflictsWith: [],
          requires: [],
          requiresSetup: [],
          providesSetupFor: [],
          path: "skills/web/framework/vue/",
        },
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
          {
            id: "web-framework-react-pro" as SkillId,
            directoryPath: "web/framework/react",
            description: "Acme React Pro",
            category: "framework",
            categoryExclusive: true,
            author: "@acme",
            tags: [],
            compatibleWith: [],
            conflictsWith: [],
            requires: [],
            requiresSetup: [],
            providesSetupFor: [],
            path: "skills/web/framework/react/",
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "web-framework-react-strict" as SkillId,
            directoryPath: "web/framework/react",
            description: "Strict React",
            category: "framework",
            categoryExclusive: true,
            author: "@team-xyz",
            tags: [],
            compatibleWith: [],
            conflictsWith: [],
            requires: [],
            requiresSetup: [],
            providesSetupFor: [],
            path: "skills/web/framework/react/",
          },
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
        {
          id: "web-framework-react-strict" as SkillId,
          directoryPath: "web/framework/react",
          description: "Strict React",
          category: "framework",
          categoryExclusive: true,
          author: "@team-xyz",
          tags: [],
          compatibleWith: [],
          conflictsWith: [],
          requires: [],
          requiresSetup: [],
          providesSetupFor: [],
          path: "skills/web/framework/react/",
        },
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
        {
          id: "web-framework-vue-pro" as SkillId,
          directoryPath: "web/framework/vue",
          description: "Acme Vue",
          category: "framework",
          categoryExclusive: true,
          author: "@acme",
          tags: [],
          compatibleWith: [],
          conflictsWith: [],
          requires: [],
          requiresSetup: [],
          providesSetupFor: [],
          path: "skills/web/framework/vue/",
        },
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
        {
          id: "web-framework-react-pro" as SkillId,
          directoryPath: "web/framework/React",
          description: "Acme React Pro",
          category: "framework",
          categoryExclusive: true,
          author: "@acme",
          tags: [],
          compatibleWith: [],
          conflictsWith: [],
          requires: [],
          requiresSetup: [],
          providesSetupFor: [],
          path: "skills/web/framework/React/",
        },
      ]);

      const sources: SourceEntry[] = [{ name: "acme-corp", url: "github:acme-corp/skills" }];

      const result = await searchExtraSources("react", sources);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("web-framework-react-pro");
    });
  });
});
