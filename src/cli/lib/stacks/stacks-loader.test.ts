import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SkillAssignment, SkillId, Stack, StackAgentConfig } from "../../types";

// Mock file system — inline factory required because vi.resetModules() is used
// (__mocks__ directory mocks create fresh vi.fn() instances on module reset)
vi.mock("../../utils/fs", () => ({
  readFile: vi.fn(),
  fileExists: vi.fn(),
}));

vi.mock("../../utils/logger");

import { resolveAgentConfigToSkills, resolveStackSkills } from "./stacks-loader";
import { readFile, fileExists } from "../../utils/fs";
import { warn } from "../../utils/logger";

/** Shorthand: creates a SkillAssignment from an id and optional preloaded flag */
function sa(id: SkillId, preloaded = false): SkillAssignment {
  return { id, preloaded };
}

function createValidStacksYaml(): string {
  return `
stacks:
  - id: nextjs-fullstack
    name: Next.js Fullstack
    description: Full-stack Next.js with Hono API
    agents:
      web-developer:
        web-framework: web-framework-react
        web-styling: web-styling-scss-modules
      api-developer:
        api-api: api-framework-hono
        api-database: api-database-drizzle
  - id: vue-spa
    name: Vue SPA
    description: Vue single-page application
    agents:
      web-developer:
        web-framework: web-framework-vue-composition-api
        web-styling: web-styling-tailwind
`;
}

function createStacksYamlWithArrays(): string {
  return `
stacks:
  - id: multi-select-stack
    name: Multi-Select Stack
    description: Stack with array-valued subcategories
    agents:
      web-developer:
        web-framework: web-framework-react
        shared-methodology:
          - meta-methodology-investigation-requirements
          - meta-methodology-anti-over-engineering
          - meta-methodology-success-criteria
      pattern-scout:
        shared-methodology:
          - meta-methodology-investigation-requirements
          - meta-methodology-anti-over-engineering
        shared-research: meta-research-research-methodology
`;
}

function createStacksYamlWithObjects(): string {
  return `
stacks:
  - id: object-stack
    name: Object Stack
    description: Stack with object-form skill assignments
    agents:
      web-developer:
        web-framework:
          - id: web-framework-react
            preloaded: true
        web-styling: web-styling-scss-modules
        shared-methodology:
          - id: meta-methodology-investigation-requirements
            preloaded: true
          - meta-methodology-anti-over-engineering
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

    it("normalizes bare string values to SkillAssignment[] with preloaded: false", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidStacksYaml());

      const { loadStacks: freshLoadStacks } = await import("./stacks-loader");
      const stacks = await freshLoadStacks("/project");

      const nextjsStack = stacks[0];
      // Bare YAML strings are normalized to SkillAssignment[] with preloaded: false
      expect(nextjsStack.agents["web-developer"]).toEqual({
        "web-framework": [sa("web-framework-react")],
        "web-styling": [sa("web-styling-scss-modules")],
      });
      expect(nextjsStack.agents["api-developer"]).toEqual({
        "api-api": [sa("api-framework-hono")],
        "api-database": [sa("api-database-drizzle")],
      });
    });

    it("normalizes bare string arrays to SkillAssignment[] with preloaded: false", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createStacksYamlWithArrays());

      const { loadStacks: freshLoadStacks } = await import("./stacks-loader");
      const stacks = await freshLoadStacks("/project");

      expect(stacks).toHaveLength(1);
      const stack = stacks[0];
      expect(stack.id).toBe("multi-select-stack");

      // Array values should be normalized to SkillAssignment[]
      expect(stack.agents["web-developer"]!["shared-methodology"]).toEqual([
        sa("meta-methodology-investigation-requirements"),
        sa("meta-methodology-anti-over-engineering"),
        sa("meta-methodology-success-criteria"),
      ]);

      // Single YAML values normalized to SkillAssignment[]
      expect(stack.agents["web-developer"]!["web-framework"]).toEqual([sa("web-framework-react")]);
      expect(stack.agents["pattern-scout"]!["shared-research"]).toEqual([
        sa("meta-research-research-methodology"),
      ]);
    });

    it("preserves object-form assignments with preloaded: true", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createStacksYamlWithObjects());

      const { loadStacks: freshLoadStacks } = await import("./stacks-loader");
      const stacks = await freshLoadStacks("/project");

      const stack = stacks[0];
      expect(stack.id).toBe("object-stack");

      // Object-form with preloaded: true preserved
      expect(stack.agents["web-developer"]!["web-framework"]).toEqual([sa("web-framework-react", true)]);

      // Bare string normalized to preloaded: false
      expect(stack.agents["web-developer"]!["web-styling"]).toEqual([sa("web-styling-scss-modules")]);

      // Mixed array: object + bare string
      expect(stack.agents["web-developer"]!["shared-methodology"]).toEqual([
        sa("meta-methodology-investigation-requirements", true),
        sa("meta-methodology-anti-over-engineering"),
      ]);
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
    it("converts skill assignments to skill references", () => {
      const agentConfig: StackAgentConfig = {
        "web-framework": [sa("web-framework-react", true)],
        "web-styling": [sa("web-styling-scss-modules")],
      };

      const skills = resolveAgentConfigToSkills(agentConfig);

      expect(skills).toHaveLength(2);
      expect(skills.find((s) => s.id === "web-framework-react")).toBeDefined();
      expect(skills.find((s) => s.id === "web-styling-scss-modules")).toBeDefined();
    });

    it("reads preloaded from assignment directly", () => {
      const agentConfig: StackAgentConfig = {
        "web-framework": [sa("web-framework-react", true)],
        "web-styling": [sa("web-styling-scss-modules")],
      };

      const skills = resolveAgentConfigToSkills(agentConfig);

      // preloaded: true set explicitly on framework assignment
      const frameworkSkill = skills.find((s) => s.id === "web-framework-react");
      expect(frameworkSkill!.preloaded).toBe(true);

      // preloaded defaults to false when not set
      const stylingSkill = skills.find((s) => s.id === "web-styling-scss-modules");
      expect(stylingSkill!.preloaded).toBe(false);
    });

    it("includes usage description with subcategory context", () => {
      const agentConfig: StackAgentConfig = {
        "api-database": [sa("api-database-drizzle", true)],
      };

      const skills = resolveAgentConfigToSkills(agentConfig);

      expect(skills[0].usage).toContain("api-database");
    });

    it("warns and skips invalid skill IDs", () => {
      // Boundary cast: intentionally invalid skill ID to test validation
      const agentConfig = {
        "web-framework": [{ id: "not-a-valid-id", preloaded: false }],
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
        "web-framework": [sa("web-framework-react", true)],
        "api-database": [sa("api-database-drizzle", true)],
      };

      const skills = resolveAgentConfigToSkills(agentConfig);

      expect(skills).toHaveLength(2);
      expect(skills.find((s) => s.id === "web-framework-react")).toBeDefined();
      expect(skills.find((s) => s.id === "api-database-drizzle")).toBeDefined();
    });

    it("resolves array of skill assignments for multi-select categories", () => {
      const agentConfig: StackAgentConfig = {
        "shared-methodology": [
          sa("meta-methodology-investigation-requirements", true),
          sa("meta-methodology-anti-over-engineering", true),
          sa("meta-methodology-success-criteria", true),
        ],
      };

      const skills = resolveAgentConfigToSkills(agentConfig);

      expect(skills).toHaveLength(3);
      expect(
        skills.find((s) => s.id === "meta-methodology-investigation-requirements"),
      ).toBeDefined();
      expect(skills.find((s) => s.id === "meta-methodology-anti-over-engineering")).toBeDefined();
      expect(skills.find((s) => s.id === "meta-methodology-success-criteria")).toBeDefined();
    });

    it("handles single-element arrays", () => {
      const agentConfig: StackAgentConfig = {
        "web-framework": [sa("web-framework-react", true)],
        "shared-methodology": [
          sa("meta-methodology-investigation-requirements", true),
          sa("meta-methodology-anti-over-engineering", true),
        ],
        "web-styling": [sa("web-styling-scss-modules")],
      };

      const skills = resolveAgentConfigToSkills(agentConfig);

      expect(skills).toHaveLength(4);
      expect(skills.find((s) => s.id === "web-framework-react")).toBeDefined();
      expect(
        skills.find((s) => s.id === "meta-methodology-investigation-requirements"),
      ).toBeDefined();
      expect(skills.find((s) => s.id === "meta-methodology-anti-over-engineering")).toBeDefined();
      expect(skills.find((s) => s.id === "web-styling-scss-modules")).toBeDefined();
    });

    it("handles empty array", () => {
      const agentConfig: StackAgentConfig = {
        "shared-methodology": [],
      };

      const skills = resolveAgentConfigToSkills(agentConfig);

      expect(skills).toEqual([]);
    });

    it("warns and skips invalid skill IDs within arrays", () => {
      // Boundary cast: intentionally invalid skill ID within array to test validation
      const agentConfig = {
        "shared-methodology": [
          { id: "meta-methodology-investigation-requirements", preloaded: true },
          { id: "not-a-valid-id", preloaded: false },
          { id: "meta-methodology-anti-over-engineering", preloaded: true },
        ],
      } as unknown as StackAgentConfig;

      const skills = resolveAgentConfigToSkills(agentConfig);

      // Should include valid IDs and skip invalid one
      expect(skills).toHaveLength(2);
      expect(
        skills.find((s) => s.id === "meta-methodology-investigation-requirements"),
      ).toBeDefined();
      expect(skills.find((s) => s.id === "meta-methodology-anti-over-engineering")).toBeDefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("not-a-valid-id"));
    });

    it("reads preloaded from each assignment individually", () => {
      const agentConfig: StackAgentConfig = {
        "shared-methodology": [
          sa("meta-methodology-investigation-requirements", true),
          sa("meta-methodology-anti-over-engineering", false),
        ],
      };

      const skills = resolveAgentConfigToSkills(agentConfig);

      const preloadedSkill = skills.find(
        (s) => s.id === "meta-methodology-investigation-requirements",
      );
      expect(preloadedSkill!.preloaded).toBe(true);

      const dynamicSkill = skills.find((s) => s.id === "meta-methodology-anti-over-engineering");
      expect(dynamicSkill!.preloaded).toBe(false);
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
            "web-framework": [sa("web-framework-react", true)],
          },
          "api-developer": {
            "api-api": [sa("api-framework-hono", true)],
            "api-database": [sa("api-database-drizzle", true)],
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

    it("resolves agents with array-valued subcategories", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test",
        agents: {
          "pattern-scout": {
            "shared-methodology": [
              sa("meta-methodology-investigation-requirements", true),
              sa("meta-methodology-anti-over-engineering", true),
            ],
            "shared-research": [sa("meta-research-research-methodology", true)],
          },
        },
      };

      const result = resolveStackSkills(stack);

      expect(Object.keys(result)).toHaveLength(1);
      // 2 methodology skills + 1 research skill = 3 total
      expect(result["pattern-scout"]).toHaveLength(3);
      expect(
        result["pattern-scout"].find((s) => s.id === "meta-methodology-investigation-requirements"),
      ).toBeDefined();
      expect(
        result["pattern-scout"].find((s) => s.id === "meta-methodology-anti-over-engineering"),
      ).toBeDefined();
      expect(
        result["pattern-scout"].find((s) => s.id === "meta-research-research-methodology"),
      ).toBeDefined();
    });
  });
});
