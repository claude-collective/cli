import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateProjectConfigFromSkills, buildStackProperty } from "./config-generator";
import type {
  AgentName,
  CategoryPath,
  SkillAssignment,
  SkillId,
  Stack,
  StackAgentConfig,
} from "../../types";
import { createMockSkill, createMockMatrix } from "../__tests__/helpers";
import { loadDefaultMappings, clearDefaultsCache } from "../loading";

/** Shorthand: creates a SkillAssignment from an id and optional preloaded flag */
function sa(id: SkillId, preloaded = false): SkillAssignment {
  return { id, preloaded };
}

describe("config-generator", () => {
  beforeEach(async () => {
    clearDefaultsCache();
    await loadDefaultMappings();
  });

  afterEach(() => {
    clearDefaultsCache();
  });

  describe("generateProjectConfigFromSkills", () => {
    it("returns a minimal ProjectConfig structure with stack", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
      });

      const config = generateProjectConfigFromSkills("my-project", ["web-framework-react"], matrix);

      expect(config.name).toBe("my-project");
      expect(config.agents).toBeDefined();
      expect(config.agents.length).toBeGreaterThan(0);
      // Stack should contain agent->subcategory->SkillAssignment[] mappings
      expect(config.stack).toBeDefined();
      expect(
        Object.values(config.stack!).some(
          (agent) => agent["web-framework"]?.[0]?.id === "web-framework-react",
        ),
      ).toBe(true);
      // Should NOT have these fields by default
      expect(config.version).toBeUndefined();
      expect(config.author).toBeUndefined();
      expect(config.description).toBeUndefined();
    });

    it("builds stack with subcategory->SkillAssignment[] mappings for multiple skills", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
        ["web-styling-scss-modules"]: createMockSkill("web-styling-scss-modules", "web-styling"),
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
      expect(webDev["web-framework"]?.[0]?.id).toBe("web-framework-react");
      expect(webDev["web-styling"]?.[0]?.id).toBe("web-styling-scss-modules");
    });

    it("derives agents from skills via getAgentsForSkill", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
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
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
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
        Object.values(config.stack!).some(
          (agent) => agent["web-framework"]?.[0]?.id === "web-framework-react",
        ),
      ).toBe(true);
    });

    it("includes optional fields when provided", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
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
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "web-unknown-skill"],
        matrix,
      );

      // Stack should only contain known skills
      expect(config.stack).toBeDefined();
      expect(
        Object.values(config.stack!).some(
          (agent) => agent["web-framework"]?.[0]?.id === "web-framework-react",
        ),
      ).toBe(true);
      // But agents should only be derived from known skills
      expect(config.agents.length).toBeGreaterThan(0);
    });

    it("deduplicates agents across skills in the same domain", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
        ["web-styling-scss-modules"]: createMockSkill("web-styling-scss-modules", "web-styling"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "web-styling-scss-modules"],
        matrix,
      );

      // Both web/* skills map to the same agent set, so agents should be deduplicated
      const uniqueAgents = new Set(config.agents);
      expect(config.agents.length).toBe(uniqueAgents.size);
    });

    it("sorts agents alphabetically", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
      });

      const config = generateProjectConfigFromSkills("my-project", ["web-framework-react"], matrix);

      const sortedAgents = [...config.agents].sort();
      expect(config.agents).toEqual(sortedAgents);
    });

    it("merges agents from different domains", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
        ["api-framework-hono"]: createMockSkill("api-framework-hono", "api-api"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "api-framework-hono"],
        matrix,
      );

      // web/* agents
      expect(config.agents).toContain("web-developer");
      expect(config.agents).toContain("web-reviewer");
      // api/* agents
      expect(config.agents).toContain("api-developer");
      expect(config.agents).toContain("api-reviewer");
      // Agents should still be sorted
      const sortedAgents = [...config.agents].sort();
      expect(config.agents).toEqual(sortedAgents);
    });

    it("builds separate stack entries per agent for cross-domain skills", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
        ["api-framework-hono"]: createMockSkill("api-framework-hono", "api-api"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "api-framework-hono"],
        matrix,
      );

      expect(config.stack).toBeDefined();
      // web-developer gets web-framework from web skill
      expect(config.stack!["web-developer"]?.["web-framework"]?.[0]?.id).toBe("web-framework-react");
      // api-developer gets api-api from api skill
      expect(config.stack!["api-developer"]?.["api-api"]?.[0]?.id).toBe("api-framework-hono");
    });

    it("handles bare subcategory category paths", () => {
      // Skills can have domain-prefixed subcategory as their category (without slash)
      const matrix = createMockMatrix({
        ["web-testing-vitest"]: createMockSkill("web-testing-vitest", "web-testing"),
      });

      const config = generateProjectConfigFromSkills("my-project", ["web-testing-vitest"], matrix);

      // Bare subcategory "web-testing" should still extract as subcategory
      expect(config.stack).toBeDefined();
      expect(
        Object.values(config.stack!).some(
          (agent) => agent["web-testing"]?.[0]?.id === "web-testing-vitest",
        ),
      ).toBe(true);
    });

    it("preserves all selected skill IDs in skills array", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
        ["web-styling-scss-modules"]: createMockSkill("web-styling-scss-modules", "web-styling"),
        ["api-framework-hono"]: createMockSkill("api-framework-hono", "api-api"),
      });

      const selectedSkills: SkillId[] = [
        "web-framework-react",
        "web-styling-scss-modules",
        "api-framework-hono",
      ];

      const config = generateProjectConfigFromSkills("my-project", selectedSkills, matrix);

      expect(config.skills).toEqual(selectedSkills);
    });

    it("includes unknown skill IDs in skills array even when skipped for agents", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "web-unknown-skill"],
        matrix,
      );

      // skills array is a direct copy of selectedSkillIds — includes unknowns
      expect(config.skills).toEqual(["web-framework-react", "web-unknown-skill"]);
    });

    it("produces no stack when all skills are unknown", () => {
      const matrix = createMockMatrix({});

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-nonexistent-skill", "api-nonexistent-thing"],
        matrix,
      );

      expect(config.agents).toEqual([]);
      expect(config.stack).toBeUndefined();
      // Skills array still contains the IDs even though they are unknown
      expect(config.skills).toEqual(["web-nonexistent-skill", "api-nonexistent-thing"]);
    });

    it("does not add description when options.description is empty string", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        matrix,
        { description: "", author: "@vince" },
      );

      // Empty string is falsy, so description should not be set
      expect(config.description).toBeUndefined();
      expect(config.author).toBe("@vince");
    });

    it("does not add author when options.author is empty string", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        matrix,
        { description: "A project", author: "" },
      );

      expect(config.description).toBe("A project");
      // Empty string is falsy, so author should not be set
      expect(config.author).toBeUndefined();
    });

    it("does not add optional fields when options is undefined", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        matrix,
        undefined,
      );

      expect(config.description).toBeUndefined();
      expect(config.author).toBeUndefined();
    });

    it("uses selectedAgents when provided instead of derived agents", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
      });

      const selectedAgents: AgentName[] = ["web-developer", "web-reviewer"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        matrix,
        { selectedAgents },
      );

      // Should use explicitly provided agents, sorted
      expect(config.agents).toEqual(["web-developer", "web-reviewer"]);
      // Stack should still be built from skills (for agent skill assignments)
      expect(config.stack).toBeDefined();
      expect(
        Object.values(config.stack!).some(
          (agent) => agent["web-framework"]?.[0]?.id === "web-framework-react",
        ),
      ).toBe(true);
    });

    it("derives agents when selectedAgents is not provided", () => {
      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill("web-framework-react", "web-framework"),
      });

      const config = generateProjectConfigFromSkills("my-project", ["web-framework-react"], matrix);

      // Should derive agents from skills as before
      expect(config.agents).toContain("web-developer");
      expect(config.agents.length).toBeGreaterThan(0);
    });

    it("assigns methodology skills to all methodology/* agents", () => {
      const matrix = createMockMatrix({
        ["meta-methodology-anti-over-engineering"]: createMockSkill(
          "meta-methodology-anti-over-engineering",
          "shared-methodology",
          { path: "skills/methodology/meta-methodology-anti-over-engineering/" },
        ),
      });

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["meta-methodology-anti-over-engineering"],
        matrix,
      );

      // methodology/* maps to many agents including web-developer, api-developer, etc.
      expect(config.agents).toContain("web-developer");
      expect(config.agents).toContain("api-developer");
      // Stack should have subcategory "shared-methodology" from category path
      expect(config.stack).toBeDefined();
    });
  });

  describe("buildStackProperty", () => {
    it("preserves full SkillAssignment[] from stack agents", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack for unit tests",
        agents: {
          "web-developer": {
            "web-framework": [sa("web-framework-react", true)],
            "web-styling": [sa("web-styling-scss-modules")],
          },
          "api-developer": {
            "api-api": [sa("api-framework-hono", true)],
            "api-database": [sa("api-database-drizzle", true)],
          },
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

      expect(result).toEqual({
        "web-developer": {
          "web-framework": [sa("web-framework-react", true)],
          "web-styling": [sa("web-styling-scss-modules")],
        },
        "api-developer": {
          "api-api": [sa("api-framework-hono", true)],
          "api-database": [sa("api-database-drizzle", true)],
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
            "web-framework": [sa("web-framework-react", true)],
          },
          "cli-tester": {},
          "web-pm": {},
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

      expect(result).toEqual({
        "web-developer": {
          "web-framework": [sa("web-framework-react", true)],
        },
      });
      expect(result["cli-tester"]).toBeUndefined();
      expect(result["web-pm"]).toBeUndefined();
    });

    it("preserves single-element arrays", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack",
        agents: {
          "web-developer": {
            "web-framework": [sa("web-framework-react", true)],
            "web-styling": [sa("web-styling-tailwind")],
          } as StackAgentConfig,
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

      expect(result).toEqual({
        "web-developer": {
          "web-framework": [sa("web-framework-react", true)],
          "web-styling": [sa("web-styling-tailwind")],
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

    it("preserves multi-element arrays with all assignments", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack",
        agents: {
          "pattern-scout": {
            "shared-methodology": [
              sa("meta-methodology-investigation-requirements", true),
              sa("meta-methodology-anti-over-engineering", true),
              sa("meta-methodology-success-criteria", true),
            ],
            "shared-research": [sa("meta-research-research-methodology", true)],
          } as StackAgentConfig,
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

      expect(result).toEqual({
        "pattern-scout": {
          "shared-methodology": [
            sa("meta-methodology-investigation-requirements", true),
            sa("meta-methodology-anti-over-engineering", true),
            sa("meta-methodology-success-criteria", true),
          ],
          "shared-research": [sa("meta-research-research-methodology", true)],
        },
      });
    });

    it("skips empty array subcategories", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack",
        agents: {
          "web-developer": {
            "web-framework": [sa("web-framework-react", true)],
            "shared-methodology": [],
          } as StackAgentConfig,
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

      expect(result).toEqual({
        "web-developer": {
          "web-framework": [sa("web-framework-react", true)],
          // Empty array is skipped
        },
      });
    });

    it("preserves preloaded flag in assignments", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack",
        agents: {
          "web-developer": {
            "web-framework": [sa("web-framework-react", true)],
            "web-styling": [sa("web-styling-scss-modules", false)],
          } as StackAgentConfig,
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

      // buildStackProperty now preserves full SkillAssignment[] including preloaded
      expect(result["web-developer"]?.["web-framework"]).toEqual([sa("web-framework-react", true)]);
      expect(result["web-developer"]?.["web-styling"]).toEqual([sa("web-styling-scss-modules", false)]);
    });

    it("handles multiple agents with identical subcategories", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack",
        agents: {
          "web-developer": {
            "web-framework": [sa("web-framework-react")],
          },
          "web-reviewer": {
            "web-framework": [sa("web-framework-react")],
          },
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

      // Each agent gets its own entry, even if they share the same subcategory skill
      expect(result["web-developer"]?.["web-framework"]).toEqual([sa("web-framework-react")]);
      expect(result["web-reviewer"]?.["web-framework"]).toEqual([sa("web-framework-react")]);
    });

    it("handles single agent with many subcategories", () => {
      const stack: Stack = {
        id: "fullstack",
        name: "Fullstack",
        description: "Fullstack stack",
        agents: {
          "web-developer": {
            "web-framework": [sa("web-framework-react")],
            "web-styling": [sa("web-styling-scss-modules")],
            "web-client-state": [sa("web-state-zustand")],
            "web-testing": [sa("web-testing-vitest")],
          } as StackAgentConfig,
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

      expect(result["web-developer"]).toEqual({
        "web-framework": [sa("web-framework-react")],
        "web-styling": [sa("web-styling-scss-modules")],
        "web-client-state": [sa("web-state-zustand")],
        "web-testing": [sa("web-testing-vitest")],
      });
    });

    it("handles local skill assignments in stack", () => {
      const stack: Stack = {
        id: "test-stack",
        name: "Test Stack",
        description: "Test stack with local skill",
        agents: {
          "web-developer": {
            "web-framework": [
              {
                id: "web-framework-react",
                preloaded: true,
                local: true,
                path: ".claude/skills/react/",
              },
            ],
          } as StackAgentConfig,
        } as Partial<Record<AgentName, StackAgentConfig>>,
      };

      const result = buildStackProperty(stack);

      // Full assignment is preserved including local/path
      expect(result["web-developer"]?.["web-framework"]?.[0]?.id).toBe("web-framework-react");
      expect(result["web-developer"]?.["web-framework"]?.[0]?.local).toBe(true);
    });
  });
});
