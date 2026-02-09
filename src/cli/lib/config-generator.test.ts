import { describe, it, expect } from "vitest";
import { generateProjectConfigFromSkills, buildStackProperty } from "./config-generator";
import type { Stack } from "../types-stacks";
import { createMockSkill, createMockMatrix } from "./__tests__/helpers";

describe("config-generator", () => {
  describe("generateProjectConfigFromSkills", () => {
    it("returns a minimal ProjectConfig structure", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web/framework"),
      });

      const config = generateProjectConfigFromSkills("my-project", ["web-framework-react"], matrix);

      expect(config.name).toBe("my-project");
      expect(config.agents).toBeDefined();
      expect(config.agents.length).toBeGreaterThan(0);
      expect(config.skills).toEqual(["web-framework-react"]);
      // Should NOT have these fields by default
      expect(config.version).toBeUndefined();
      expect(config.author).toBeUndefined();
      expect(config.description).toBeUndefined();
      expect(config.agent_skills).toBeUndefined();
      expect(config.preload_patterns).toBeUndefined();
    });

    it("uses string format for remote skills (minimal)", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web/framework"),
        ["web-state-zustand"]: createMockSkill("web-state-zustand", "web/state"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "web-state-zustand"],
        matrix,
      );

      expect(config.skills).toEqual(["web-framework-react", "web-state-zustand"]);
    });

    it("derives agents from skills via getAgentsForSkill", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web/framework"),
      });

      const config = generateProjectConfigFromSkills("my-project", ["web-framework-react"], matrix);

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
        "web-local-skill": createMockSkill("web-local-skill", "local", {
          local: true,
          localPath: ".claude/skills/my-local-skill/",
        }),
      });

      const config = generateProjectConfigFromSkills("my-project", ["web-local-skill"], matrix);

      expect(config.skills).toHaveLength(1);
      expect(config.skills![0]).toEqual({
        id: "web-local-skill",
        local: true,
        path: ".claude/skills/my-local-skill/",
      });
    });

    it("mixes remote (string) and local (object) skills correctly", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web/framework"),
        "meta-company-patterns": createMockSkill("meta-company-patterns", "local", {
          local: true,
          localPath: ".claude/skills/company-patterns/",
        }),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "meta-company-patterns"],
        matrix,
      );

      expect(config.skills).toHaveLength(2);
      // Remote skill should be string
      expect(config.skills![0]).toBe("web-framework-react");
      // Local skill should be object
      expect(config.skills![1]).toEqual({
        id: "meta-company-patterns",
        local: true,
        path: ".claude/skills/company-patterns/",
      });
    });

    it("includes optional fields when provided", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web/framework"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        matrix,
        {
          description: "My awesome project",
          framework: "nextjs",
          author: "@vince",
        },
      );

      expect(config.description).toBe("My awesome project");
      expect(config.framework).toBe("nextjs");
      expect(config.author).toBe("@vince");
    });

    it("includes agent_skills when includeAgentSkills is true", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web/framework"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        matrix,
        {
          includeAgentSkills: true,
        },
      );

      expect(config.agent_skills).toBeDefined();
      // web-developer should have react skill
      expect(config.agent_skills!["web-developer"]).toBeDefined();
    });

    it("agent_skills uses simple list format with preloaded flags", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web/framework"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        matrix,
        {
          includeAgentSkills: true,
        },
      );

      const webDevSkills = config.agent_skills!["web-developer"];
      expect(Array.isArray(webDevSkills)).toBe(true);

      // Skills should be in simple list format (string or {id, preloaded})
      const skillsList = webDevSkills as (string | { id: string; preloaded?: boolean })[];
      expect(skillsList.length).toBeGreaterThan(0);
    });

    it("skips unknown skills gracefully", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web/framework"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "web-unknown-skill"],
        matrix,
      );

      // Only react should be in skills
      expect(config.skills).toEqual(["web-framework-react", "web-unknown-skill"]);
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
        react: "web-framework-react",
        "scss-modules": "web-styling-scss-modules",
        hono: "api-framework-hono",
        drizzle: "api-database-drizzle",
      };

      const result = buildStackProperty(stack, skillAliases);

      expect(result).toEqual({
        "web-developer": {
          framework: "web-framework-react",
          styling: "web-styling-scss-modules",
        },
        "api-developer": {
          api: "api-framework-hono",
          database: "api-database-drizzle",
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
        react: "web-framework-react",
      };

      const result = buildStackProperty(stack, skillAliases);

      expect(result).toEqual({
        "web-developer": {
          framework: "web-framework-react",
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
        react: "web-framework-react",
      };

      const result = buildStackProperty(stack, skillAliases);

      expect(result).toEqual({
        "web-developer": {
          framework: "web-framework-react",
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
