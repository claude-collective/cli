import { describe, it, expect } from "vitest";
import { generateProjectConfigFromSkills, buildStackProperty } from "./config-generator";
import type { Stack, StackAgentConfig } from "../types-stacks";
import type { AgentName, SkillDisplayName, SkillId } from "../types-matrix";
import { createMockSkill, createMockMatrix } from "./__tests__/helpers";

describe("config-generator", () => {
  describe("generateProjectConfigFromSkills", () => {
    it("returns a minimal ProjectConfig structure with stack", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web/framework"),
      });

      const config = generateProjectConfigFromSkills("my-project", ["web-framework-react"], matrix);

      expect(config.name).toBe("my-project");
      expect(config.agents).toBeDefined();
      expect(config.agents.length).toBeGreaterThan(0);
      // Stack should contain agent->subcategory->skillId mappings
      expect(config.stack).toBeDefined();
      expect(
        Object.values(config.stack!).some((agent) => agent.framework === "web-framework-react"),
      ).toBe(true);
      // Should NOT have these fields by default
      expect(config.version).toBeUndefined();
      expect(config.author).toBeUndefined();
      expect(config.description).toBeUndefined();
    });

    it("builds stack with subcategory->skillId mappings for multiple skills", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web/framework"),
        ["web-styling-scss-modules"]: createMockSkill("web-styling-scss-modules", "web/styling"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "web-styling-scss-modules"],
        matrix,
      );

      // Stack should have agent entries with subcategory mappings
      expect(config.stack).toBeDefined();
      // web-developer should have both framework and styling subcategories
      const webDev = config.stack!["web-developer"];
      expect(webDev).toBeDefined();
      expect(webDev.framework).toBe("web-framework-react");
      expect(webDev.styling).toBe("web-styling-scss-modules");
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
      expect(config.stack).toBeUndefined(); // No skills = no stack
    });

    it("skips local skills in stack (no subcategory)", () => {
      const matrix = createMockMatrix({
        "web-local-skill": createMockSkill("web-local-skill", "local", {
          local: true,
          localPath: ".claude/skills/my-local-skill/",
        }),
      });

      const config = generateProjectConfigFromSkills("my-project", ["web-local-skill"], matrix);

      // Local skills have category "local" which has no subcategory
      // They still derive agents, but don't appear in stack subcategory mappings
      expect(config.agents.length).toBeGreaterThan(0);
      // Stack entries should not contain any "local" subcategory
      if (config.stack) {
        for (const agentConfig of Object.values(config.stack)) {
          expect(agentConfig).not.toHaveProperty("local");
        }
      }
    });

    it("handles both remote and local skills", () => {
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

      // Stack should have framework mapping from remote skill
      expect(config.stack).toBeDefined();
      expect(
        Object.values(config.stack!).some((agent) => agent.framework === "web-framework-react"),
      ).toBe(true);
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
          author: "@vince",
        },
      );

      expect(config.description).toBe("My awesome project");
      expect(config.author).toBe("@vince");
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

      // Stack should only contain known skills
      expect(config.stack).toBeDefined();
      expect(
        Object.values(config.stack!).some((agent) => agent.framework === "web-framework-react"),
      ).toBe(true);
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
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      // Boundary cast: test literals to proper union types
      const displayNameToId = {
        react: "web-framework-react",
        "scss-modules": "web-styling-scss-modules",
        hono: "api-framework-hono",
        drizzle: "api-database-drizzle",
      } as Partial<Record<SkillDisplayName, SkillId>>;

      const result = buildStackProperty(stack, displayNameToId);

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
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      // Boundary cast: test literals to proper union types
      const displayNameToId = {
        react: "web-framework-react",
      } as Partial<Record<SkillDisplayName, SkillId>>;

      const result = buildStackProperty(stack, displayNameToId);

      expect(result).toEqual({
        "web-developer": {
          framework: "web-framework-react",
        },
      });
      expect(result["cli-tester"]).toBeUndefined();
      expect(result["web-pm"]).toBeUndefined();
    });

    it("uses display name as-is when not found in displayNameToId", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack",
        agents: {
          "web-developer": {
            framework: "react",
            custom: "some-unknown-alias",
          } as StackAgentConfig,
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      // Boundary cast: test literals to proper union types
      const displayNameToId = {
        react: "web-framework-react",
      } as Partial<Record<SkillDisplayName, SkillId>>;

      const result = buildStackProperty(stack, displayNameToId);

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
        agents: {} as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack, {});

      expect(result).toEqual({});
    });
  });
});
