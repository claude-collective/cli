import { describe, it, expect } from "vitest";
import { generateProjectConfigFromSkills, buildStackProperty } from "./config-generator";
import type { AgentName, SkillAssignment, SkillId } from "../../types";
import { createMockSkillAssignment, TEST_MATRICES } from "../__tests__/helpers";
import {
  FULLSTACK_STACK,
  EMPTY_AGENTS_STACK,
  PRELOADED_FLAG_STACK,
  SHARED_SUBCATEGORY_STACK,
  STACK_WITH_EMPTY_AGENTS,
  SINGLE_AGENT_STACK,
  MULTI_METHODOLOGY_STACK,
  STACK_WITH_EMPTY_SUBCATEGORY,
  MANY_SUBCATEGORIES_STACK,
  LOCAL_SKILL_STACK,
} from "../__tests__/mock-data/mock-stacks.js";
import {
  LOCAL_SKILL_MATRIX,
  MIXED_LOCAL_REMOTE_MATRIX,
  METHODOLOGY_MATRIX,
  VITEST_MATRIX,
} from "../__tests__/mock-data/mock-matrices.js";

/** Shorthand: creates a SkillAssignment from an id and optional preloaded flag */
const sa = (id: SkillId, preloaded = false): SkillAssignment =>
  createMockSkillAssignment(id, preloaded);

describe("config-generator", () => {
  describe("generateProjectConfigFromSkills", () => {
    it("returns a minimal ProjectConfig structure with stack when selectedAgents provided", () => {
      const selectedAgents: AgentName[] = ["web-developer", "web-reviewer"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        TEST_MATRICES.react,
        { selectedAgents },
      );

      expect(config.name).toBe("my-project");
      expect(config.agents).toEqual(["web-developer", "web-reviewer"]);
      expect(config.stack).toBeDefined();
      expect(config.stack!["web-developer"]?.["web-framework"]?.[0]?.id).toBe(
        "web-framework-react",
      );
      expect(config.stack!["web-reviewer"]?.["web-framework"]?.[0]?.id).toBe("web-framework-react");
      // Should NOT have these fields by default
      expect(config.version).toBeUndefined();
      expect(config.author).toBeUndefined();
      expect(config.description).toBeUndefined();
    });

    it("builds stack with subcategory->SkillAssignment[] mappings for multiple skills", () => {
      const selectedAgents: AgentName[] = ["web-developer", "web-reviewer"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "web-styling-scss-modules"],
        TEST_MATRICES.reactAndScss,
        { selectedAgents },
      );

      expect(config.stack).toBeDefined();
      const webDev = config.stack!["web-developer"];
      expect(webDev).toBeDefined();
      expect(webDev["web-framework"]?.[0]?.id).toBe("web-framework-react");
      expect(webDev["web-styling"]?.[0]?.id).toBe("web-styling-scss-modules");
    });

    it("uses selectedAgents when provided", () => {
      const selectedAgents: AgentName[] = ["web-developer", "web-reviewer"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        TEST_MATRICES.react,
        { selectedAgents },
      );

      expect(config.agents).toEqual(["web-developer", "web-reviewer"]);
      expect(config.stack).toBeDefined();
      expect(config.stack!["web-developer"]?.["web-framework"]?.[0]?.id).toBe(
        "web-framework-react",
      );
    });

    it("handles empty skill selection", () => {
      const config = generateProjectConfigFromSkills("my-project", [], TEST_MATRICES.empty);

      expect(config.name).toBe("my-project");
      expect(config.agents).toEqual([]);
      expect(config.stack).toBeUndefined();
    });

    it("skips local skills in stack (no subcategory)", () => {
      const selectedAgents: AgentName[] = ["web-developer"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-local-skill"],
        LOCAL_SKILL_MATRIX,
        { selectedAgents },
      );

      // Local skills have category "local" which has no subcategory
      // Agents are still set from selectedAgents
      expect(config.agents).toEqual(["web-developer"]);
      // Stack entries should not contain any "local" subcategory
      if (config.stack) {
        for (const agentConfig of Object.values(config.stack)) {
          expect(agentConfig).not.toHaveProperty("local");
        }
      }
    });

    it("handles both remote and local skills", () => {
      const selectedAgents: AgentName[] = ["web-developer", "web-reviewer"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "meta-company-patterns"],
        MIXED_LOCAL_REMOTE_MATRIX,
        { selectedAgents },
      );

      // Stack should have framework mapping from remote skill
      expect(config.stack).toBeDefined();
      expect(config.stack!["web-developer"]?.["web-framework"]?.[0]?.id).toBe(
        "web-framework-react",
      );
    });

    it("includes optional fields when provided", () => {
      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        TEST_MATRICES.react,
        {
          description: "My awesome project",
          author: "@vince",
          selectedAgents: ["web-developer"],
        },
      );

      expect(config.description).toBe("My awesome project");
      expect(config.author).toBe("@vince");
    });

    it("skips unknown skills gracefully", () => {
      const selectedAgents: AgentName[] = ["web-developer"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "web-unknown-skill"],
        TEST_MATRICES.react,
        { selectedAgents },
      );

      // Stack should only contain known skills
      expect(config.stack).toBeDefined();
      expect(config.stack!["web-developer"]?.["web-framework"]?.[0]?.id).toBe(
        "web-framework-react",
      );
      expect(config.agents).toEqual(["web-developer"]);
    });

    it("deduplicates agents across skills in the same domain", () => {
      const selectedAgents: AgentName[] = ["web-developer", "web-reviewer"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "web-styling-scss-modules"],
        TEST_MATRICES.reactAndScss,
        { selectedAgents },
      );

      const uniqueAgents = new Set(config.agents);
      expect(config.agents.length).toBe(uniqueAgents.size);
    });

    it("sorts agents alphabetically", () => {
      const selectedAgents: AgentName[] = ["web-reviewer", "api-developer", "web-developer"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        TEST_MATRICES.react,
        { selectedAgents },
      );

      const sortedAgents = [...config.agents].sort();
      expect(config.agents).toEqual(sortedAgents);
    });

    it("assigns all skills to all selectedAgents across domains", () => {
      const selectedAgents: AgentName[] = [
        "api-developer",
        "api-reviewer",
        "web-developer",
        "web-reviewer",
      ];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "api-framework-hono"],
        TEST_MATRICES.reactAndHono,
        { selectedAgents },
      );

      expect(config.agents).toContain("web-developer");
      expect(config.agents).toContain("web-reviewer");
      expect(config.agents).toContain("api-developer");
      expect(config.agents).toContain("api-reviewer");
      const sortedAgents = [...config.agents].sort();
      expect(config.agents).toEqual(sortedAgents);
    });

    it("builds stack entries for every agent with every skill subcategory", () => {
      const selectedAgents: AgentName[] = ["api-developer", "web-developer"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "api-framework-hono"],
        TEST_MATRICES.reactAndHono,
        { selectedAgents },
      );

      expect(config.stack).toBeDefined();
      // Every agent gets every skill's subcategory
      expect(config.stack!["web-developer"]?.["web-framework"]?.[0]?.id).toBe(
        "web-framework-react",
      );
      expect(config.stack!["web-developer"]?.["api-api"]?.[0]?.id).toBe("api-framework-hono");
      expect(config.stack!["api-developer"]?.["web-framework"]?.[0]?.id).toBe(
        "web-framework-react",
      );
      expect(config.stack!["api-developer"]?.["api-api"]?.[0]?.id).toBe("api-framework-hono");
    });

    it("handles bare subcategory category paths", () => {
      const selectedAgents: AgentName[] = ["web-tester"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-testing-vitest"],
        VITEST_MATRIX,
        { selectedAgents },
      );

      expect(config.stack).toBeDefined();
      expect(config.stack!["web-tester"]?.["web-testing"]?.[0]?.id).toBe("web-testing-vitest");
    });

    it("preserves all selected skill IDs in skills array", () => {
      const selectedSkills: SkillId[] = [
        "web-framework-react",
        "web-styling-scss-modules",
        "api-framework-hono",
      ];

      const config = generateProjectConfigFromSkills(
        "my-project",
        selectedSkills,
        TEST_MATRICES.reactScssAndHono,
        { selectedAgents: ["web-developer"] },
      );

      expect(config.skills).toEqual(selectedSkills);
    });

    it("includes unknown skill IDs in skills array even when skipped for agents", () => {
      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react", "web-unknown-skill"],
        TEST_MATRICES.react,
        { selectedAgents: ["web-developer"] },
      );

      expect(config.skills).toEqual(["web-framework-react", "web-unknown-skill"]);
    });

    it("produces no stack when all skills are unknown", () => {
      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-nonexistent-skill", "api-nonexistent-thing"],
        TEST_MATRICES.empty,
      );

      expect(config.agents).toEqual([]);
      expect(config.stack).toBeUndefined();
      expect(config.skills).toEqual(["web-nonexistent-skill", "api-nonexistent-thing"]);
    });

    it("does not add description when options.description is empty string", () => {
      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        TEST_MATRICES.react,
        { description: "", author: "@vince" },
      );

      expect(config.description).toBeUndefined();
      expect(config.author).toBe("@vince");
    });

    it("does not add author when options.author is empty string", () => {
      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        TEST_MATRICES.react,
        { description: "A project", author: "" },
      );

      expect(config.description).toBe("A project");
      expect(config.author).toBeUndefined();
    });

    it("does not add optional fields when options is undefined", () => {
      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        TEST_MATRICES.react,
        undefined,
      );

      expect(config.description).toBeUndefined();
      expect(config.author).toBeUndefined();
    });

    it("assigns every skill to every selected agent", () => {
      const selectedAgents: AgentName[] = ["web-developer", "web-reviewer"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        TEST_MATRICES.react,
        { selectedAgents },
      );

      // Both agents should have the skill
      expect(config.stack!["web-developer"]?.["web-framework"]?.[0]?.id).toBe(
        "web-framework-react",
      );
      expect(config.stack!["web-reviewer"]?.["web-framework"]?.[0]?.id).toBe("web-framework-react");
    });

    it("stack only contains selectedAgents", () => {
      const selectedAgents: AgentName[] = ["web-developer", "web-reviewer"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        TEST_MATRICES.react,
        { selectedAgents },
      );

      const stackAgentIds = Object.keys(config.stack || {});
      for (const agentId of stackAgentIds) {
        expect(selectedAgents).toContain(agentId);
      }

      expect(config.stack?.["agent-summoner"]).toBeUndefined();
      expect(config.stack?.["skill-summoner"]).toBeUndefined();
      expect(config.stack?.["documentor"]).toBeUndefined();
    });

    it("returns empty agents when selectedAgents is not provided", () => {
      const config = generateProjectConfigFromSkills(
        "my-project",
        ["web-framework-react"],
        TEST_MATRICES.react,
      );

      expect(config.agents).toEqual([]);
      // No agents means no stack entries
      expect(config.stack).toBeUndefined();
    });

    it("assigns methodology skills to all selectedAgents", () => {
      const selectedAgents: AgentName[] = ["web-developer", "api-developer"];

      const config = generateProjectConfigFromSkills(
        "my-project",
        ["meta-methodology-anti-over-engineering"],
        METHODOLOGY_MATRIX,
        { selectedAgents },
      );

      expect(config.agents).toEqual(["api-developer", "web-developer"]);
      expect(config.stack).toBeDefined();
      expect(config.stack!["web-developer"]?.["shared-methodology"]?.[0]?.id).toBe(
        "meta-methodology-anti-over-engineering",
      );
      expect(config.stack!["api-developer"]?.["shared-methodology"]?.[0]?.id).toBe(
        "meta-methodology-anti-over-engineering",
      );
    });
  });

  describe("buildStackProperty", () => {
    it("preserves full SkillAssignment[] from stack agents", () => {
      const result = buildStackProperty(FULLSTACK_STACK);

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
      const result = buildStackProperty(STACK_WITH_EMPTY_AGENTS);

      expect(result).toEqual({
        "web-developer": {
          "web-framework": [sa("web-framework-react", true)],
        },
      });
      expect(result["cli-tester"]).toBeUndefined();
      expect(result["web-pm"]).toBeUndefined();
    });

    it("preserves single-element arrays", () => {
      const result = buildStackProperty(SINGLE_AGENT_STACK);

      expect(result).toEqual({
        "web-developer": {
          "web-framework": [sa("web-framework-react", true)],
          "web-styling": [sa("web-styling-tailwind")],
        },
      });
    });

    it("handles stack with no agents", () => {
      const result = buildStackProperty(EMPTY_AGENTS_STACK);

      expect(result).toEqual({});
    });

    it("preserves multi-element arrays with all assignments", () => {
      const result = buildStackProperty(MULTI_METHODOLOGY_STACK);

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
      const result = buildStackProperty(STACK_WITH_EMPTY_SUBCATEGORY);

      expect(result).toEqual({
        "web-developer": {
          "web-framework": [sa("web-framework-react", true)],
          // Empty array is skipped
        },
      });
    });

    it("preserves preloaded flag in assignments", () => {
      const result = buildStackProperty(PRELOADED_FLAG_STACK);

      expect(result["web-developer"]?.["web-framework"]).toEqual([sa("web-framework-react", true)]);
      expect(result["web-developer"]?.["web-styling"]).toEqual([
        sa("web-styling-scss-modules", false),
      ]);
    });

    it("handles multiple agents with identical subcategories", () => {
      const result = buildStackProperty(SHARED_SUBCATEGORY_STACK);

      expect(result["web-developer"]?.["web-framework"]).toEqual([sa("web-framework-react")]);
      expect(result["web-reviewer"]?.["web-framework"]).toEqual([sa("web-framework-react")]);
    });

    it("handles single agent with many subcategories", () => {
      const result = buildStackProperty(MANY_SUBCATEGORIES_STACK);

      expect(result["web-developer"]).toEqual({
        "web-framework": [sa("web-framework-react")],
        "web-styling": [sa("web-styling-scss-modules")],
        "web-client-state": [sa("web-state-zustand")],
        "web-testing": [sa("web-testing-vitest")],
      });
    });

    it("handles local skill assignments in stack", () => {
      const result = buildStackProperty(LOCAL_SKILL_STACK);

      expect(result["web-developer"]?.["web-framework"]?.[0]?.id).toBe("web-framework-react");
      expect(result["web-developer"]?.["web-framework"]?.[0]?.local).toBe(true);
    });
  });
});
