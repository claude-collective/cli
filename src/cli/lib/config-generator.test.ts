import { describe, it, expect } from "vitest";
import { generateProjectConfigFromSkills, buildStackProperty } from "./config-generator";
import type { MergedSkillsMatrix, ResolvedSkill } from "../types-matrix";
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
