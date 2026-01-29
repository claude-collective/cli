import { describe, it, expect } from "vitest";
import {
  generateConfigFromSkills,
  generateConfigFromStack,
  mergeStackWithSkills,
} from "./config-generator";
import type { MergedSkillsMatrix, ResolvedSkill } from "../types-matrix";
import type { StackConfig } from "../../types";

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
    requiresSetup: [],
    providesSetupFor: [],
    path: `skills/${category}/${id}/`,
    ...overrides,
  };
}

/**
 * Helper to create a minimal merged skills matrix for testing
 */
function createMockMatrix(
  skills: Record<string, ResolvedSkill>,
): MergedSkillsMatrix {
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
        "react (@vince)": createMockSkill(
          "react (@vince)",
          "frontend/framework",
        ),
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
        "react (@vince)": createMockSkill(
          "react (@vince)",
          "frontend/framework",
        ),
        "zustand (@vince)": createMockSkill(
          "zustand (@vince)",
          "frontend/state",
        ),
      });

      const config = generateConfigFromSkills(
        ["react (@vince)", "zustand (@vince)"],
        matrix,
      );

      expect(config.skills).toHaveLength(2);
      expect(config.skills.map((s) => s.id)).toContain("react (@vince)");
      expect(config.skills.map((s) => s.id)).toContain("zustand (@vince)");
    });

    it("skips unknown skills gracefully", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill(
          "react (@vince)",
          "frontend/framework",
        ),
      });

      const config = generateConfigFromSkills(
        ["react (@vince)", "unknown-skill (@test)"],
        matrix,
      );

      // Only react should be in skills (no error thrown)
      expect(
        config.skills.filter((s) => s.id === "react (@vince)"),
      ).toHaveLength(1);
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
        "my-local-skill (@local)": createMockSkill(
          "my-local-skill (@local)",
          "local/custom",
          {
            local: true,
            localPath: ".claude/skills/my-local-skill/",
          },
        ),
      });

      const config = generateConfigFromSkills(
        ["my-local-skill (@local)"],
        matrix,
      );

      expect(config.skills).toHaveLength(1);
      expect(config.skills[0]).toEqual({
        id: "my-local-skill (@local)",
        local: true,
        path: ".claude/skills/my-local-skill/",
      });
    });

    it("regular skills do not have local or path properties", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill(
          "react (@vince)",
          "frontend/framework",
        ),
      });

      const config = generateConfigFromSkills(["react (@vince)"], matrix);

      expect(config.skills[0]).toEqual({ id: "react (@vince)" });
      expect(config.skills[0]).not.toHaveProperty("local");
      expect(config.skills[0]).not.toHaveProperty("path");
    });

    it("mixes local and remote skills correctly", () => {
      const matrix = createMockMatrix({
        "react (@vince)": createMockSkill(
          "react (@vince)",
          "frontend/framework",
        ),
        "company-patterns (@local)": createMockSkill(
          "company-patterns (@local)",
          "local/custom",
          {
            local: true,
            localPath: ".claude/skills/company-patterns/",
          },
        ),
      });

      const config = generateConfigFromSkills(
        ["react (@vince)", "company-patterns (@local)"],
        matrix,
      );

      const remoteSkill = config.skills.find((s) => s.id === "react (@vince)");
      const localSkill = config.skills.find(
        (s) => s.id === "company-patterns (@local)",
      );

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
      const stackConfig: StackConfig = {
        name: "Minimal Stack",
        agents: [],
        skills: [],
      };

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
        "react (@vince)": createMockSkill(
          "react (@vince)",
          "frontend/framework",
        ),
      });

      const config = mergeStackWithSkills(
        baseStack,
        ["react (@vince)"],
        matrix,
      );

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
        "react (@vince)": createMockSkill(
          "react (@vince)",
          "frontend/framework",
        ),
        "zustand (@vince)": createMockSkill(
          "zustand (@vince)",
          "frontend/state",
        ),
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
        "react (@vince)": createMockSkill(
          "react (@vince)",
          "frontend/framework",
        ),
        "local-skill (@local)": createMockSkill(
          "local-skill (@local)",
          "local/custom",
          {
            local: true,
            localPath: ".claude/skills/local-skill/",
          },
        ),
      });

      const config = mergeStackWithSkills(
        baseStack,
        ["react (@vince)", "local-skill (@local)"],
        matrix,
      );

      const localSkill = config.skills.find(
        (s) => s.id === "local-skill (@local)",
      );
      expect(localSkill).toEqual({
        id: "local-skill (@local)",
        local: true,
        path: ".claude/skills/local-skill/",
      });
    });
  });
});
