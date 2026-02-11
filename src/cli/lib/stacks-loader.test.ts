import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SkillId, SkillDisplayName, Subcategory } from "../types-matrix";
import type { StackAgentConfig, Stack } from "../types-stacks";

// Mock file system
vi.mock("../utils/fs", () => ({
  readFile: vi.fn(),
  fileExists: vi.fn(),
}));

// Mock logger
vi.mock("../utils/logger", () => ({
  verbose: vi.fn(),
  warn: vi.fn(),
}));

import {
  loadStacks,
  loadStackById,
  resolveAgentConfigToSkills,
  resolveStackSkillsFromDisplayNames,
} from "./stacks-loader";
import { readFile, fileExists } from "../utils/fs";
import { warn } from "../utils/logger";

// =============================================================================
// Fixtures
// =============================================================================

function createValidStacksYaml(): string {
  return `
stacks:
  - id: nextjs-fullstack
    name: Next.js Fullstack
    description: Full-stack Next.js with Hono API
    agents:
      web-developer:
        framework: react
        styling: scss-modules
      api-developer:
        api: hono
        database: drizzle
  - id: vue-spa
    name: Vue SPA
    description: Vue single-page application
    agents:
      web-developer:
        framework: vue
        styling: tailwind
`;
}

function createInvalidStacksYaml(): string {
  // Missing required 'stacks' array
  return `
name: invalid
`;
}

// =============================================================================
// Tests
// =============================================================================

describe("stacks-loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the internal cache between tests by re-importing
    // The module has a stacksCache Map that persists across calls
    vi.resetModules();
  });

  describe("loadStacks", () => {
    it("loads and parses stacks from config/stacks.yaml", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidStacksYaml());

      // Re-import after resetModules to clear cache
      const { loadStacks: freshLoadStacks } = await import("./stacks-loader");
      const stacks = await freshLoadStacks("/project");

      expect(stacks).toHaveLength(2);
      expect(stacks[0].id).toBe("nextjs-fullstack");
      expect(stacks[0].name).toBe("Next.js Fullstack");
      expect(stacks[1].id).toBe("vue-spa");
    });

    it("returns empty array when stacks file does not exist", async () => {
      vi.mocked(fileExists).mockResolvedValue(false);

      const { loadStacks: freshLoadStacks } = await import("./stacks-loader");
      const stacks = await freshLoadStacks("/project");

      expect(stacks).toEqual([]);
      expect(readFile).not.toHaveBeenCalled();
    });

    it("throws on invalid stacks.yaml structure", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createInvalidStacksYaml());

      const { loadStacks: freshLoadStacks } = await import("./stacks-loader");

      await expect(freshLoadStacks("/project")).rejects.toThrow(/Failed to load stacks/);
    });

    it("throws descriptive error for malformed YAML", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const { loadStacks: freshLoadStacks } = await import("./stacks-loader");

      await expect(freshLoadStacks("/project")).rejects.toThrow(/Failed to load stacks/);
    });

    it("caches loaded stacks for the same configDir", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidStacksYaml());

      const { loadStacks: freshLoadStacks } = await import("./stacks-loader");

      const first = await freshLoadStacks("/project");
      const second = await freshLoadStacks("/project");

      // readFile should only be called once due to caching
      expect(readFile).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it("parses agent configurations within stacks", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidStacksYaml());

      const { loadStacks: freshLoadStacks } = await import("./stacks-loader");
      const stacks = await freshLoadStacks("/project");

      const nextjsStack = stacks[0];
      expect(nextjsStack.agents["web-developer"]).toEqual({
        framework: "react",
        styling: "scss-modules",
      });
      expect(nextjsStack.agents["api-developer"]).toEqual({
        api: "hono",
        database: "drizzle",
      });
    });
  });

  describe("loadStackById", () => {
    it("returns stack matching the given ID", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidStacksYaml());

      const { loadStackById: freshLoadStackById } = await import("./stacks-loader");
      const stack = await freshLoadStackById("vue-spa", "/project");

      expect(stack).not.toBeNull();
      expect(stack!.id).toBe("vue-spa");
      expect(stack!.name).toBe("Vue SPA");
    });

    it("returns null when stack ID not found", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidStacksYaml());

      const { loadStackById: freshLoadStackById } = await import("./stacks-loader");
      const stack = await freshLoadStackById("nonexistent-stack", "/project");

      expect(stack).toBeNull();
    });

    it("returns null when no stacks file exists", async () => {
      vi.mocked(fileExists).mockResolvedValue(false);

      const { loadStackById: freshLoadStackById } = await import("./stacks-loader");
      const stack = await freshLoadStackById("nextjs-fullstack", "/project");

      expect(stack).toBeNull();
    });
  });

  describe("resolveAgentConfigToSkills", () => {
    it("resolves display names to full skill IDs", () => {
      const agentConfig: StackAgentConfig = {
        framework: "react" as SkillDisplayName,
        styling: "scss-modules" as SkillDisplayName,
      };

      const displayNameToId: Partial<Record<string, SkillId>> = {
        react: "web-framework-react",
        "scss-modules": "web-styling-scss-modules",
      };

      const skills = resolveAgentConfigToSkills(agentConfig, displayNameToId);

      expect(skills).toHaveLength(2);
      expect(skills.find((s) => s.id === "web-framework-react")).toBeDefined();
      expect(skills.find((s) => s.id === "web-styling-scss-modules")).toBeDefined();
    });

    it("marks key subcategories as preloaded", () => {
      const agentConfig: StackAgentConfig = {
        framework: "react" as SkillDisplayName,
        styling: "scss-modules" as SkillDisplayName,
      };

      const displayNameToId: Partial<Record<string, SkillId>> = {
        react: "web-framework-react",
        "scss-modules": "web-styling-scss-modules",
      };

      const skills = resolveAgentConfigToSkills(agentConfig, displayNameToId);

      // "framework" is a KEY_SUBCATEGORY, so it should be preloaded
      const frameworkSkill = skills.find((s) => s.id === "web-framework-react");
      expect(frameworkSkill!.preloaded).toBe(true);

      // "styling" is NOT a KEY_SUBCATEGORY
      const stylingSkill = skills.find((s) => s.id === "web-styling-scss-modules");
      expect(stylingSkill!.preloaded).toBe(false);
    });

    it("skips display names not found in lookup map and warns", () => {
      const agentConfig: StackAgentConfig = {
        framework: "unknown-framework" as SkillDisplayName,
      };

      const displayNameToId: Partial<Record<string, SkillId>> = {};

      const skills = resolveAgentConfigToSkills(agentConfig, displayNameToId);

      expect(skills).toHaveLength(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown-framework"));
    });

    it("includes usage description with subcategory context", () => {
      const agentConfig: StackAgentConfig = {
        database: "drizzle" as SkillDisplayName,
      };

      const displayNameToId: Partial<Record<string, SkillId>> = {
        drizzle: "api-database-drizzle",
      };

      const skills = resolveAgentConfigToSkills(agentConfig, displayNameToId);

      expect(skills[0].usage).toContain("database");
    });

    it("handles empty agent config", () => {
      const skills = resolveAgentConfigToSkills({}, {});

      expect(skills).toEqual([]);
    });
  });

  describe("resolveStackSkillsFromDisplayNames", () => {
    it("resolves all agents in a stack", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test",
        agents: {
          "web-developer": {
            framework: "react" as SkillDisplayName,
          } as StackAgentConfig,
          "api-developer": {
            api: "hono" as SkillDisplayName,
            database: "drizzle" as SkillDisplayName,
          } as StackAgentConfig,
        },
      };

      const displayNameToId: Partial<Record<string, SkillId>> = {
        react: "web-framework-react",
        hono: "api-framework-hono",
        drizzle: "api-database-drizzle",
      };

      const result = resolveStackSkillsFromDisplayNames(stack, displayNameToId);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result["web-developer"]).toHaveLength(1);
      expect(result["web-developer"][0].id).toBe("web-framework-react");
      expect(result["api-developer"]).toHaveLength(2);
    });

    it("handles stack with no agents", () => {
      const stack = {
        id: "empty-stack",
        name: "Empty",
        description: "No agents",
        agents: {},
      };

      const result = resolveStackSkillsFromDisplayNames(stack, {});

      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
