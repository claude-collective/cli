import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadSkillsFromAllSources } from "./multi-source-loader";
import type { MergedSkillsMatrix, ResolvedSkill, SkillId, SkillSource } from "../../types";
import type { ResolvedConfig } from "../configuration";

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

function createTestSkill(id: SkillId, overrides: Partial<ResolvedSkill> = {}): ResolvedSkill {
  return {
    id,
    description: `Test skill ${id}`,
    category: "testing",
    categoryExclusive: true,
    tags: [],
    author: "@test",
    conflictsWith: [],
    recommends: [],
    requires: [],
    alternatives: [],
    discourages: [],
    compatibleWith: [],
    requiresSetup: [],
    providesSetupFor: [],
    path: `skills/${id}/`,
    ...overrides,
  };
}

function createTestMatrix(skills: Record<string, ResolvedSkill>): MergedSkillsMatrix {
  return {
    version: "1.0.0",
    categories: {},
    skills: skills as MergedSkillsMatrix["skills"],
    suggestedStacks: [],
    displayNameToId: {},
    displayNames: {},
    generatedAt: new Date().toISOString(),
  };
}

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

      const matrix = createTestMatrix({
        "web-framework-react": createTestSkill("web-framework-react" as SkillId),
        "web-testing-vitest": createTestSkill("web-testing-vitest" as SkillId),
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

    it("should not tag local skills as public", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:claude-collective/skills" },
        extras: [],
      });

      const matrix = createTestMatrix({
        "web-framework-react": createTestSkill("web-framework-react" as SkillId, {
          local: true,
          localPath: ".claude/skills/react/",
        }),
      });

      await loadSkillsFromAllSources(matrix, DEFAULT_SOURCE_CONFIG, "/tmp/test");

      const react = matrix.skills["web-framework-react" as SkillId]!;
      // Should have "local" source, not "public"
      expect(react.availableSources).toBeDefined();
      const publicSources = react.availableSources!.filter((s) => s.type === "public");
      expect(publicSources).toHaveLength(0);
      const localSources = react.availableSources!.filter((s) => s.type === "local");
      expect(localSources).toHaveLength(1);
    });
  });

  describe("local skill tagging", () => {
    it("should tag local skills with local source and installed: true", async () => {
      const { resolveAllSources } = await import("../configuration");
      vi.mocked(resolveAllSources).mockResolvedValue({
        primary: { name: "marketplace", url: "github:claude-collective/skills" },
        extras: [],
      });

      const matrix = createTestMatrix({
        "web-framework-react": createTestSkill("web-framework-react" as SkillId, {
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

      const matrix = createTestMatrix({
        "web-framework-react": createTestSkill("web-framework-react" as SkillId, {
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

      const matrix = createTestMatrix({
        "web-framework-react": createTestSkill("web-framework-react" as SkillId),
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

      const matrix = createTestMatrix({
        "web-framework-react": createTestSkill("web-framework-react" as SkillId),
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

      const matrix = createTestMatrix({
        "web-framework-react": createTestSkill("web-framework-react" as SkillId),
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

      const matrix = createTestMatrix({
        "web-framework-react": createTestSkill("web-framework-react" as SkillId),
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
});
