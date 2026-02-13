import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Stack, StackAgentConfig } from "../../types";

// Mock file system — inline factory required because vi.resetModules() is used
// (__mocks__ directory mocks create fresh vi.fn() instances on module reset)
vi.mock("../../utils/fs", () => ({
  readFile: vi.fn(),
  fileExists: vi.fn(),
}));

vi.mock("../../utils/logger");

import {
  loadStacks,
  loadStackById,
  resolveAgentConfigToSkills,
  resolveStackSkills,
} from "./stacks-loader";
import { readFile, fileExists } from "../../utils/fs";
import { warn } from "../../utils/logger";

function createValidStacksYaml(): string {
  return `
stacks:
  - id: nextjs-fullstack
    name: Next.js Fullstack
    description: Full-stack Next.js with Hono API
    agents:
      web-developer:
        framework: web-framework-react
        styling: web-styling-scss-modules
      api-developer:
        api: api-framework-hono
        database: api-database-drizzle
  - id: vue-spa
    name: Vue SPA
    description: Vue single-page application
    agents:
      web-developer:
        framework: web-framework-vue-composition-api
        styling: web-styling-tailwind
`;
}

function createInvalidStacksYaml(): string {
  // Missing required 'stacks' array
  return `
name: invalid
`;
}

describe("stacks-loader", () => {
  beforeEach(() => {
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

    it("loads stacks from custom stacksFile path", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidStacksYaml());

      const { loadStacks: freshLoadStacks } = await import("./stacks-loader");
      const stacks = await freshLoadStacks("/project", "data/my-stacks.yaml");

      expect(stacks).toHaveLength(2);
      expect(fileExists).toHaveBeenCalledWith("/project/data/my-stacks.yaml");
    });

    it("uses default STACKS_FILE when stacksFile is undefined", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidStacksYaml());

      const { loadStacks: freshLoadStacks } = await import("./stacks-loader");
      await freshLoadStacks("/project");

      expect(fileExists).toHaveBeenCalledWith("/project/config/stacks.yaml");
    });

    it("caches separately for different stacksFile values", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidStacksYaml());

      const { loadStacks: freshLoadStacks } = await import("./stacks-loader");

      await freshLoadStacks("/project");
      await freshLoadStacks("/project", "custom/stacks.yaml");

      // readFile should be called twice — different cache keys
      expect(readFile).toHaveBeenCalledTimes(2);
    });

    it("parses agent configurations within stacks", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidStacksYaml());

      const { loadStacks: freshLoadStacks } = await import("./stacks-loader");
      const stacks = await freshLoadStacks("/project");

      const nextjsStack = stacks[0];
      expect(nextjsStack.agents["web-developer"]).toEqual({
        framework: "web-framework-react",
        styling: "web-styling-scss-modules",
      });
      expect(nextjsStack.agents["api-developer"]).toEqual({
        api: "api-framework-hono",
        database: "api-database-drizzle",
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
    it("converts skill IDs to skill references", () => {
      const agentConfig: StackAgentConfig = {
        framework: "web-framework-react",
        styling: "web-styling-scss-modules",
      };

      const skills = resolveAgentConfigToSkills(agentConfig);

      expect(skills).toHaveLength(2);
      expect(skills.find((s) => s.id === "web-framework-react")).toBeDefined();
      expect(skills.find((s) => s.id === "web-styling-scss-modules")).toBeDefined();
    });

    it("marks key subcategories as preloaded", () => {
      const agentConfig: StackAgentConfig = {
        framework: "web-framework-react",
        styling: "web-styling-scss-modules",
      };

      const skills = resolveAgentConfigToSkills(agentConfig);

      // "framework" is a KEY_SUBCATEGORY, so it should be preloaded
      const frameworkSkill = skills.find((s) => s.id === "web-framework-react");
      expect(frameworkSkill!.preloaded).toBe(true);

      // "styling" is NOT a KEY_SUBCATEGORY
      const stylingSkill = skills.find((s) => s.id === "web-styling-scss-modules");
      expect(stylingSkill!.preloaded).toBe(false);
    });

    it("includes usage description with subcategory context", () => {
      const agentConfig: StackAgentConfig = {
        database: "api-database-drizzle",
      };

      const skills = resolveAgentConfigToSkills(agentConfig);

      expect(skills[0].usage).toContain("database");
    });

    it("warns and skips invalid skill IDs", () => {
      // Boundary cast: intentionally invalid skill ID to test validation
      const agentConfig = {
        framework: "not-a-valid-id",
      } as unknown as StackAgentConfig;

      const skills = resolveAgentConfigToSkills(agentConfig);

      expect(skills).toHaveLength(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("not-a-valid-id"));
    });

    it("handles empty agent config", () => {
      const skills = resolveAgentConfigToSkills({});

      expect(skills).toEqual([]);
    });

    it("resolves full skill IDs directly", () => {
      const agentConfig: StackAgentConfig = {
        framework: "web-framework-react",
        database: "api-database-drizzle",
      };

      const skills = resolveAgentConfigToSkills(agentConfig);

      expect(skills).toHaveLength(2);
      expect(skills.find((s) => s.id === "web-framework-react")).toBeDefined();
      expect(skills.find((s) => s.id === "api-database-drizzle")).toBeDefined();
    });
  });

  describe("resolveStackSkills", () => {
    it("resolves all agents in a stack", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test",
        agents: {
          "web-developer": {
            framework: "web-framework-react",
          },
          "api-developer": {
            api: "api-framework-hono",
            database: "api-database-drizzle",
          },
        },
      };

      const result = resolveStackSkills(stack);

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

      const result = resolveStackSkills(stack);

      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
