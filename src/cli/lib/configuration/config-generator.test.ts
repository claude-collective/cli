import { describe, it, expect } from "vitest";
import { generateProjectConfigFromSkills, buildStackProperty } from "./config-generator";
import type { AgentName, SkillAssignment, SkillId, Stack, StackAgentConfig } from "../../types";
import { createMockSkill, createMockMatrix } from "../__tests__/helpers";

/** Shorthand: creates a SkillAssignment from an id and optional preloaded flag */
function sa(id: SkillId, preloaded = false): SkillAssignment {
  return { id, preloaded };
}

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
    it("extracts agent-to-subcategory-to-skillId mappings from stack", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack for unit tests",
        agents: {
          "web-developer": {
            framework: [sa("web-framework-react", true)],
            styling: [sa("web-styling-scss-modules")],
          },
          "api-developer": {
            api: [sa("api-framework-hono", true)],
            database: [sa("api-database-drizzle", true)],
          },
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

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
            framework: [sa("web-framework-react", true)],
          },
          "cli-tester": {},
          "web-pm": {},
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

      expect(result).toEqual({
        "web-developer": {
          framework: "web-framework-react",
        },
      });
      expect(result["cli-tester"]).toBeUndefined();
      expect(result["web-pm"]).toBeUndefined();
    });

    it("takes first skill ID from arrays", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack",
        agents: {
          "web-developer": {
            framework: [sa("web-framework-react", true)],
            styling: [sa("web-styling-tailwind")],
          } as StackAgentConfig,
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

      expect(result).toEqual({
        "web-developer": {
          framework: "web-framework-react",
          styling: "web-styling-tailwind",
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

      const result = buildStackProperty(stack);

      expect(result).toEqual({});
    });

    it("takes first skill ID from multi-element arrays", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack",
        agents: {
          "pattern-scout": {
            methodology: [
              sa("meta-methodology-investigation-requirements", true),
              sa("meta-methodology-anti-over-engineering", true),
              sa("meta-methodology-success-criteria", true),
            ],
            research: [sa("meta-research-research-methodology", true)],
          } as StackAgentConfig,
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

      expect(result).toEqual({
        "pattern-scout": {
          // First skill from array
          methodology: "meta-methodology-investigation-requirements",
          research: "meta-research-research-methodology",
        },
      });
    });

    it("handles empty array in subcategory", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack",
        agents: {
          "web-developer": {
            framework: [sa("web-framework-react", true)],
            methodology: [],
          } as StackAgentConfig,
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

      expect(result).toEqual({
        "web-developer": {
          framework: "web-framework-react",
          // Empty array -> first element is undefined -> filtered
          methodology: undefined,
        },
      });
    });
  });
});
