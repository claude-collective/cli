import { describe, it, expect } from "vitest";
import {
  generateConfigFromSkills,
  generateConfigFromStack,
  mergeStackWithSkills,
  generateProjectConfigFromSkills,
  generateProjectConfigFromStack,
  buildStackProperty,
} from "./config-generator";
import type { MergedSkillsMatrix, ResolvedSkill } from "../types-matrix";
import type { StackConfig, ProjectConfig } from "../../types";
import type { Stack } from "../types-stacks";

/**
 * Helper to create a minimal resolved skill for testing
 */
function createMockSkill(
  id: string,
  category: string,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return {
    id,
    name: id.replace(/ \(@.*\)$/, ""),
    description: `${id} skill`,
    category,
    categoryExclusive: false,
    tags: [],
    author: "@test",
    conflictsWith: [],
    recommends: [],
    recommendedBy: [],
    requires: [],
    requiredBy: [],
    alternatives: [],
    discourages: [],
    compatibleWith: [],
    requiresSetup: [],
    providesSetupFor: [],
    path: `skills/${category}/${id}/`,
    ...overrides,
  };
}

/**
 * Helper to create a minimal merged skills matrix for testing
 */
function createMockMatrix(skills: Record<string, ResolvedSkill>): MergedSkillsMatrix {
  return {
    version: "1.0.0",
    categories: {},
    skills,
    suggestedStacks: [],
    aliases: {},
    aliasesReverse: {},
    generatedAt: new Date().toISOString(),
  };
}

describe("config-generator", () => {
  describe("generateConfigFromSkills", () => {
    it("returns a valid StackConfig structure", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
      });

      const config = generateConfigFromSkills(["react (@vince)"], matrix);

      expect(config.name).toBe("claude-collective");
      expect(config.version).toBe("1.0.0");
      expect(config.author).toBe("@user");
      expect(config.description).toBe("Custom plugin with 1 skills");
      expect(config.skills).toBeDefined();
      expect(config.agents).toBeDefined();
      expect(config.agent_skills).toBeDefined();
    });

    it("includes selected skills in skills array", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
        "zustand (@vince)": createMockSkill("zustand (@vince)", "web/state"),
      });

      const config = generateConfigFromSkills(["react (@vince)", "zustand (@vince)"], matrix);

      expect(config.skills).toHaveLength(2);
      expect(config.skills.map((s) => s.id)).toContain("react (@vince)");
      expect(config.skills.map((s) => s.id)).toContain("zustand (@vince)");
    });

    it("skips unknown skills gracefully", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
      });

      const config = generateConfigFromSkills(["react (@vince)", "unknown-skill (@test)"], matrix);

      // Only react should be in skills (no error thrown)
      expect(config.skills.filter((s) => s.id === "react (@vince)")).toHaveLength(1);
    });

    it("handles empty skill selection", () => {
      const matrix = createMockMatrix({});

      const config = generateConfigFromSkills([], matrix);

      expect(config.skills).toEqual([]);
      expect(config.agents).toEqual([]);
      expect(config.description).toBe("Custom plugin with 0 skills");
    });

    it("includes local flag and path for local skills", () => {
      const matrix = createMockMatrix({
        "my-local-skill (@local)": createMockSkill("my-local-skill (@local)", "local/custom", {
          local: true,
          localPath: ".claude/skills/my-local-skill/",
        }),
      });

      const config = generateConfigFromSkills(["my-local-skill (@local)"], matrix);

      expect(config.skills).toHaveLength(1);
      expect(config.skills[0]).toEqual({
        id: "my-local-skill (@local)",
        local: true,
        path: ".claude/skills/my-local-skill/",
      });
    });

    it("regular skills do not have local or path properties", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
      });

      const config = generateConfigFromSkills(["react (@vince)"], matrix);

      expect(config.skills[0]).toEqual({ id: "react (@vince)" });
      expect(config.skills[0]).not.toHaveProperty("local");
      expect(config.skills[0]).not.toHaveProperty("path");
    });

    it("mixes local and remote skills correctly", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
        "company-patterns (@local)": createMockSkill("company-patterns (@local)", "local/custom", {
          local: true,
          localPath: ".claude/skills/company-patterns/",
        }),
      });

      const config = generateConfigFromSkills(
        ["react (@vince)", "company-patterns (@local)"],
        matrix,
      );

      const remoteSkill = config.skills.find((s) => s.id === "react (@vince)");
      const localSkill = config.skills.find((s) => s.id === "company-patterns (@local)");

      expect(remoteSkill).toEqual({ id: "react (@vince)" });
      expect(localSkill).toEqual({
        id: "company-patterns (@local)",
        local: true,
        path: ".claude/skills/company-patterns/",
      });
    });
  });

  describe("generateConfigFromStack", () => {
    it("returns a valid StackConfig with consistent structure", () => {
      const stackConfig: StackConfig = {
        name: "Test Stack",
        version: "2.0.0",
        author: "@original",
        description: "Original description",
        agents: ["web-developer"],
        skills: [{ id: "react (@vince)" }],
      };

      const config = generateConfigFromStack(stackConfig);

      expect(config.name).toBe("claude-collective");
      expect(config.version).toBe("2.0.0");
      expect(config.author).toBe("@original");
      expect(config.description).toBe("Original description");
      expect(config.agents).toEqual(["web-developer"]);
      expect(config.skills).toEqual([{ id: "react (@vince)" }]);
    });

    it("uses defaults when version/author missing", () => {
      // Cast through unknown to test handling of incomplete config
      const stackConfig = {
        name: "Minimal Stack",
        agents: [],
        skills: [],
      } as unknown as StackConfig;

      const config = generateConfigFromStack(stackConfig);

      expect(config.version).toBe("1.0.0");
      expect(config.author).toBe("@user");
    });

    it("preserves optional stack fields", () => {
      const stackConfig: StackConfig = {
        name: "Full Stack",
        version: "1.0.0",
        author: "@test",
        description: "Full description",
        framework: "React",
        agents: ["web-developer"],
        skills: [],
        agent_skills: { "web-developer": { framework: [] } },
        hooks: { "pre-commit": [] },
        philosophy: "Test philosophy",
        principles: ["Principle 1"],
        tags: ["tag1", "tag2"],
      };

      const config = generateConfigFromStack(stackConfig);

      expect(config.framework).toBe("React");
      expect(config.agent_skills).toEqual({
        "web-developer": { framework: [] },
      });
      expect(config.hooks).toEqual({ "pre-commit": [] });
      expect(config.philosophy).toBe("Test philosophy");
      expect(config.principles).toEqual(["Principle 1"]);
      expect(config.tags).toEqual(["tag1", "tag2"]);
    });
  });

  describe("mergeStackWithSkills", () => {
    it("returns base config when no skills changed", () => {
      const baseStack: StackConfig = {
        name: "Base Stack",
        version: "1.0.0",
        author: "@test",
        description: "Base description",
        agents: ["web-developer"],
        skills: [{ id: "react (@vince)" }],
      };

      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
      });

      const config = mergeStackWithSkills(baseStack, ["react (@vince)"], matrix);

      expect(config.skills).toEqual([{ id: "react (@vince)" }]);
    });

    it("adds new skills to the config", () => {
      const baseStack: StackConfig = {
        name: "Base Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [{ id: "react (@vince)" }],
        agent_skills: {},
      };

      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
        "zustand (@vince)": createMockSkill("zustand (@vince)", "web/state"),
      });

      const config = mergeStackWithSkills(
        baseStack,
        ["react (@vince)", "zustand (@vince)"],
        matrix,
      );

      expect(config.skills.map((s) => s.id)).toContain("zustand (@vince)");
      expect(config.description).toContain("based on Base Stack");
    });

    it("handles local skills in merged config", () => {
      const baseStack: StackConfig = {
        name: "Base Stack",
        version: "1.0.0",
        author: "@test",
        agents: [],
        skills: [{ id: "react (@vince)" }],
        agent_skills: {},
      };

      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
        "local-skill (@local)": createMockSkill("local-skill (@local)", "local/custom", {
          local: true,
          localPath: ".claude/skills/local-skill/",
        }),
      });

      const config = mergeStackWithSkills(
        baseStack,
        ["react (@vince)", "local-skill (@local)"],
        matrix,
      );

      const localSkill = config.skills.find((s) => s.id === "local-skill (@local)");
      expect(localSkill).toEqual({
        id: "local-skill (@local)",
        local: true,
        path: ".claude/skills/local-skill/",
      });
    });
  });

  describe("generateProjectConfigFromSkills", () => {
    it("returns a minimal ProjectConfig structure", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
      });

      const config = generateProjectConfigFromSkills("my-project", ["react (@vince)"], matrix);

      expect(config.name).toBe("my-project");
      expect(config.agents).toBeDefined();
      expect(config.agents.length).toBeGreaterThan(0);
      expect(config.skills).toEqual(["react (@vince)"]);
      // Should NOT have these fields by default
      expect(config.version).toBeUndefined();
      expect(config.author).toBeUndefined();
      expect(config.description).toBeUndefined();
      expect(config.agent_skills).toBeUndefined();
      expect(config.preload_patterns).toBeUndefined();
    });

    it("uses string format for remote skills (minimal)", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
        "zustand (@vince)": createMockSkill("zustand (@vince)", "web/state"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["react (@vince)", "zustand (@vince)"],
        matrix,
      );

      expect(config.skills).toEqual(["react (@vince)", "zustand (@vince)"]);
    });

    it("derives agents from skills via getAgentsForSkill", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
      });

      const config = generateProjectConfigFromSkills("my-project", ["react (@vince)"], matrix);

      // web/* skills should include web-developer, web-reviewer, etc.
      expect(config.agents).toContain("web-developer");
      expect(config.agents).toContain("web-reviewer");
    });

    it("handles empty skill selection", () => {
      const matrix = createMockMatrix({});

      const config = generateProjectConfigFromSkills("my-project", [], matrix);

      expect(config.name).toBe("my-project");
      expect(config.agents).toEqual([]);
      expect(config.skills).toBeUndefined(); // No skills = undefined (minimal)
    });

    it("includes local skills with proper path entries", () => {
      const matrix = createMockMatrix({
        "my-local-skill (@local)": createMockSkill("my-local-skill (@local)", "local/custom", {
          local: true,
          localPath: ".claude/skills/my-local-skill/",
        }),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["my-local-skill (@local)"],
        matrix,
      );

      expect(config.skills).toHaveLength(1);
      expect(config.skills![0]).toEqual({
        id: "my-local-skill (@local)",
        local: true,
        path: ".claude/skills/my-local-skill/",
      });
    });

    it("mixes remote (string) and local (object) skills correctly", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
        "company-patterns (@local)": createMockSkill("company-patterns (@local)", "local/custom", {
          local: true,
          localPath: ".claude/skills/company-patterns/",
        }),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["react (@vince)", "company-patterns (@local)"],
        matrix,
      );

      expect(config.skills).toHaveLength(2);
      // Remote skill should be string
      expect(config.skills![0]).toBe("react (@vince)");
      // Local skill should be object
      expect(config.skills![1]).toEqual({
        id: "company-patterns (@local)",
        local: true,
        path: ".claude/skills/company-patterns/",
      });
    });

    it("includes optional fields when provided", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
      });

      const config = generateProjectConfigFromSkills("my-project", ["react (@vince)"], matrix, {
        description: "My awesome project",
        framework: "nextjs",
        author: "@vince",
      });

      expect(config.description).toBe("My awesome project");
      expect(config.framework).toBe("nextjs");
      expect(config.author).toBe("@vince");
    });

    it("includes agent_skills when includeAgentSkills is true", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
      });

      const config = generateProjectConfigFromSkills("my-project", ["react (@vince)"], matrix, {
        includeAgentSkills: true,
      });

      expect(config.agent_skills).toBeDefined();
      // web-developer should have react skill
      expect(config.agent_skills!["web-developer"]).toBeDefined();
    });

    it("agent_skills uses simple list format with preloaded flags", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
      });

      const config = generateProjectConfigFromSkills("my-project", ["react (@vince)"], matrix, {
        includeAgentSkills: true,
      });

      const webDevSkills = config.agent_skills!["web-developer"];
      expect(Array.isArray(webDevSkills)).toBe(true);

      // Skills should be in simple list format (string or {id, preloaded})
      const skillsList = webDevSkills as (string | { id: string; preloaded?: boolean })[];
      expect(skillsList.length).toBeGreaterThan(0);
    });

    it("skips unknown skills gracefully", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill("react (@vince)", "web/framework"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["react (@vince)", "unknown-skill (@test)"],
        matrix,
      );

      // Only react should be in skills
      expect(config.skills).toEqual(["react (@vince)", "unknown-skill (@test)"]);
      // But agents should only be derived from known skills
      expect(config.agents.length).toBeGreaterThan(0);
    });
  });

  describe("generateProjectConfigFromStack", () => {
    it("converts StackConfig to ProjectConfig", () => {
      const stackConfig: StackConfig = {
        name: "Test Stack",
        version: "2.0.0",
        author: "@original",
        description: "Original description",
        agents: ["web-developer"],
        skills: [{ id: "react (@vince)" }],
      };

      const config = generateProjectConfigFromStack(stackConfig);

      expect(config.name).toBe("Test Stack");
      expect(config.agents).toEqual(["web-developer"]);
      expect(config.description).toBe("Original description");
      expect(config.author).toBe("@original");
      // version should NOT be copied (it's semver in StackConfig)
      expect(config.version).toBeUndefined();
    });

    it("uses minimal string format for simple skills", () => {
      const stackConfig: StackConfig = {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [{ id: "react (@vince)" }, { id: "zustand (@vince)" }],
      };

      const config = generateProjectConfigFromStack(stackConfig);

      // Skills without preloaded/local should be strings
      expect(config.skills).toEqual(["react (@vince)", "zustand (@vince)"]);
    });

    it("preserves preloaded flag in object format", () => {
      const stackConfig: StackConfig = {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [{ id: "react (@vince)", preloaded: true }, { id: "zustand (@vince)" }],
      };

      const config = generateProjectConfigFromStack(stackConfig);

      expect(config.skills).toEqual([
        { id: "react (@vince)", preloaded: true },
        "zustand (@vince)",
      ]);
    });

    it("preserves local skills with path", () => {
      const stackConfig: StackConfig = {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [
          { id: "react (@vince)" },
          { id: "my-local", local: true, path: ".claude/skills/my-local/" },
        ],
      };

      const config = generateProjectConfigFromStack(stackConfig);

      expect(config.skills).toEqual([
        "react (@vince)",
        { id: "my-local", local: true, path: ".claude/skills/my-local/" },
      ]);
    });

    it("preserves agent_skills categorized format", () => {
      const stackConfig: StackConfig = {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
        agent_skills: {
          "web-developer": {
            framework: [{ id: "react (@vince)", preloaded: true }],
            state: [{ id: "zustand (@vince)" }],
          },
        },
      };

      const config = generateProjectConfigFromStack(stackConfig);

      expect(config.agent_skills).toEqual({
        "web-developer": {
          framework: [{ id: "react (@vince)", preloaded: true }],
          state: [{ id: "zustand (@vince)" }],
        },
      });
    });

    it("preserves optional stack fields", () => {
      const stackConfig: StackConfig = {
        name: "Full Stack",
        version: "1.0.0",
        author: "@test",
        description: "Full description",
        framework: "React",
        agents: ["web-developer"],
        skills: [],
        hooks: { "pre-commit": [] },
        philosophy: "Test philosophy",
        principles: ["Principle 1"],
        tags: ["tag1", "tag2"],
      };

      const config = generateProjectConfigFromStack(stackConfig);

      expect(config.framework).toBe("React");
      expect(config.hooks).toEqual({ "pre-commit": [] });
      expect(config.philosophy).toBe("Test philosophy");
      expect(config.principles).toEqual(["Principle 1"]);
      expect(config.tags).toEqual(["tag1", "tag2"]);
    });

    it("omits empty/undefined optional fields for minimal output", () => {
      const stackConfig: StackConfig = {
        name: "Minimal Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
      };

      const config = generateProjectConfigFromStack(stackConfig);

      expect(config.name).toBe("Minimal Stack");
      expect(config.agents).toEqual(["web-developer"]);
      // These should be undefined (not included)
      expect(config.skills).toBeUndefined();
      expect(config.description).toBeUndefined();
      expect(config.framework).toBeUndefined();
      expect(config.hooks).toBeUndefined();
      expect(config.philosophy).toBeUndefined();
      expect(config.principles).toBeUndefined();
      expect(config.tags).toBeUndefined();
    });

    it("generated config matches ProjectConfig type", () => {
      const stackConfig: StackConfig = {
        name: "Type Test Stack",
        version: "1.0.0",
        author: "@test",
        description: "Testing types",
        framework: "nextjs",
        agents: ["web-developer", "api-developer"],
        skills: [
          { id: "react (@vince)", preloaded: true },
          { id: "hono (@vince)" },
          {
            id: "local-skill",
            local: true,
            path: ".claude/skills/local-skill/",
          },
        ],
        agent_skills: {
          "web-developer": {
            framework: [{ id: "react (@vince)", preloaded: true }],
          },
        },
        philosophy: "Ship fast",
        principles: ["Keep it simple"],
        tags: ["nextjs"],
      };

      const config: ProjectConfig = generateProjectConfigFromStack(stackConfig);

      // Type assertion would fail at compile time if types don't match
      expect(config.name).toBe("Type Test Stack");
      expect(config.agents).toEqual(["web-developer", "api-developer"]);
      expect(config.skills).toHaveLength(3);
      expect(config.agent_skills).toBeDefined();
      expect(config.philosophy).toBe("Ship fast");
      expect(config.principles).toEqual(["Keep it simple"]);
      expect(config.tags).toEqual(["nextjs"]);
    });
  });

  describe("buildStackProperty", () => {
    it("resolves aliases to full skill IDs", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack for unit tests",
        agents: {
          "web-developer": {
            framework: "react",
            styling: "scss-modules",
          },
          "api-developer": {
            api: "hono",
            database: "drizzle",
          },
        },
      };

      const skillAliases: Record<string, string> = {
        react: "web/framework/react (@vince)",
        "scss-modules": "web/styling/scss-modules (@vince)",
        hono: "api/framework/hono (@vince)",
        drizzle: "api/database/drizzle (@vince)",
      };

      const result = buildStackProperty(stack, skillAliases);

      expect(result).toEqual({
        "web-developer": {
          framework: "web/framework/react (@vince)",
          styling: "web/styling/scss-modules (@vince)",
        },
        "api-developer": {
          api: "api/framework/hono (@vince)",
          database: "api/database/drizzle (@vince)",
        },
      });
    });

    it("skips agents with empty config", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack",
        agents: {
          "web-developer": {
            framework: "react",
          },
          "cli-tester": {},
          "web-pm": {},
        },
      };

      const skillAliases: Record<string, string> = {
        react: "web/framework/react (@vince)",
      };

      const result = buildStackProperty(stack, skillAliases);

      expect(result).toEqual({
        "web-developer": {
          framework: "web/framework/react (@vince)",
        },
      });
      expect(result["cli-tester"]).toBeUndefined();
      expect(result["web-pm"]).toBeUndefined();
    });

    it("uses alias as-is when not found in skillAliases", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack",
        agents: {
          "web-developer": {
            framework: "react",
            custom: "some-unknown-alias",
          },
        },
      };

      const skillAliases: Record<string, string> = {
        react: "web/framework/react (@vince)",
      };

      const result = buildStackProperty(stack, skillAliases);

      expect(result).toEqual({
        "web-developer": {
          framework: "web/framework/react (@vince)",
          custom: "some-unknown-alias",
        },
      });
    });

    it("handles stack with no agents", () => {
      const stack: Stack = {
        id: "empty-stack",
        name: "Empty Stack",
        description: "No agents",
        agents: {},
      };

      const result = buildStackProperty(stack, {});

      expect(result).toEqual({});
    });
  });
});
