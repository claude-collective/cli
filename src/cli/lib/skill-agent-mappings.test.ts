import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SKILL_TO_AGENTS,
  PRELOADED_SKILLS,
  SUBCATEGORY_ALIASES,
  getAgentsForSkill,
  shouldPreloadSkill,
  extractCategoryKey,
  hasAgentSkillsOverride,
  isSkillAssignedToAgent,
  resolveAgentsForSkill,
} from "./skill-agent-mappings";
import { loadDefaultMappings, clearDefaultsCache, getCachedDefaults } from "./defaults-loader";

import type { AgentSkillConfig, ProjectConfig, SkillEntry } from "../../types";

// =============================================================================
// P1-18: Test Agent-skill mapping from skill-agent-mappings.ts
// =============================================================================

describe("SKILL_TO_AGENTS mappings", () => {
  it("should return correct agent list for web/* pattern", () => {
    const agents = SKILL_TO_AGENTS["web/*"];
    expect(agents).toBeDefined();
    expect(agents).toContain("web-developer");
    expect(agents).toContain("web-reviewer");
    expect(agents).toContain("web-researcher");
    expect(agents).toContain("web-pm");
  });

  it("should return correct agent list for api/* pattern", () => {
    const agents = SKILL_TO_AGENTS["api/*"];
    expect(agents).toBeDefined();
    expect(agents).toContain("api-developer");
    expect(agents).toContain("api-reviewer");
    expect(agents).toContain("api-researcher");
    expect(agents).toContain("web-architecture");
  });

  it("should return correct agent list for cli/* pattern", () => {
    const agents = SKILL_TO_AGENTS["cli/*"];
    expect(agents).toBeDefined();
    expect(agents).toContain("cli-developer");
    expect(agents).toContain("cli-reviewer");
  });

  it("should have specific pattern for web/testing", () => {
    const agents = SKILL_TO_AGENTS["web/testing"];
    expect(agents).toBeDefined();
    expect(agents).toContain("web-tester");
    expect(agents).toContain("web-developer");
    expect(agents).toContain("web-reviewer");
  });

  it("should have specific pattern for api/testing", () => {
    const agents = SKILL_TO_AGENTS["api/testing"];
    expect(agents).toBeDefined();
    expect(agents).toContain("web-tester");
    expect(agents).toContain("api-developer");
    expect(agents).toContain("api-reviewer");
  });

  it("should include common agents in most patterns", () => {
    const patternsWithCommonAgents = [
      "web/*",
      "api/*",
      "mobile/*",
      "infra/*",
      "security/*",
      "cli/*",
      "research/*",
      "methodology/*",
    ];

    for (const pattern of patternsWithCommonAgents) {
      const agents = SKILL_TO_AGENTS[pattern];
      expect(agents).toBeDefined();
      expect(agents).toContain("agent-summoner");
      expect(agents).toContain("skill-summoner");
      expect(agents).toContain("documentor");
    }
  });
});

describe("PRELOADED_SKILLS", () => {
  it("should correctly identify preloaded skills for web-developer", () => {
    const preloaded = PRELOADED_SKILLS["web-developer"];
    expect(preloaded).toBeDefined();
    expect(preloaded).toContain("framework");
    expect(preloaded).toContain("styling");
  });

  it("should correctly identify preloaded skills for api-developer", () => {
    const preloaded = PRELOADED_SKILLS["api-developer"];
    expect(preloaded).toBeDefined();
    expect(preloaded).toContain("api");
    expect(preloaded).toContain("database");
    expect(preloaded).toContain("cli");
  });

  it("should correctly identify preloaded skills for cli-developer", () => {
    const preloaded = PRELOADED_SKILLS["cli-developer"];
    expect(preloaded).toBeDefined();
    expect(preloaded).toContain("cli");
  });

  it("should correctly identify preloaded skills for web-reviewer", () => {
    const preloaded = PRELOADED_SKILLS["web-reviewer"];
    expect(preloaded).toBeDefined();
    expect(preloaded).toContain("framework");
    expect(preloaded).toContain("styling");
    expect(preloaded).toContain("reviewing");
  });

  it("should correctly identify preloaded skills for web-tester", () => {
    const preloaded = PRELOADED_SKILLS["web-tester"];
    expect(preloaded).toBeDefined();
    expect(preloaded).toContain("testing");
    expect(preloaded).toContain("mocks");
  });

  it("should return empty array for agent-summoner (no preloaded skills)", () => {
    const preloaded = PRELOADED_SKILLS["agent-summoner"];
    expect(preloaded).toBeDefined();
    expect(preloaded).toHaveLength(0);
  });

  it("should return empty array for skill-summoner (no preloaded skills)", () => {
    const preloaded = PRELOADED_SKILLS["skill-summoner"];
    expect(preloaded).toBeDefined();
    expect(preloaded).toHaveLength(0);
  });
});

describe("getAgentsForSkill", () => {
  describe("wildcard pattern matching", () => {
    it("should match web/* pattern for skills/web/framework/react", () => {
      const agents = getAgentsForSkill("skills/web/framework/react", "web/framework");
      expect(agents).toContain("web-developer");
      expect(agents).toContain("web-reviewer");
    });

    it("should match web/* pattern for web/styling/tailwind", () => {
      const agents = getAgentsForSkill("web/styling/tailwind", "web/styling");
      expect(agents).toContain("web-developer");
      expect(agents).toContain("web-reviewer");
    });

    it("should match api/* pattern for api/api/hono", () => {
      const agents = getAgentsForSkill("api/api/hono", "api/api");
      expect(agents).toContain("api-developer");
      expect(agents).toContain("api-reviewer");
    });

    it("should match cli/* pattern for cli/commander", () => {
      const agents = getAgentsForSkill("cli/commander", "cli-framework");
      expect(agents).toContain("cli-developer");
      expect(agents).toContain("cli-reviewer");
    });

    it("should match research/* pattern for research/methodology", () => {
      const agents = getAgentsForSkill("research/methodology", "research");
      expect(agents).toContain("web-researcher");
      expect(agents).toContain("api-researcher");
      expect(agents).toContain("web-pm");
    });

    it("should match infra/* pattern for infra/monorepo", () => {
      const agents = getAgentsForSkill("infra/monorepo", "infra/monorepo");
      expect(agents).toContain("web-architecture");
      expect(agents).toContain("web-developer");
      expect(agents).toContain("api-developer");
    });
  });

  describe("exact pattern matching", () => {
    it("should prefer exact pattern over wildcard for web/testing", () => {
      const agents = getAgentsForSkill("web/testing", "web/testing");
      // The exact pattern should be matched first via category
      expect(agents).toContain("web-tester");
    });

    it("should prefer exact pattern over wildcard for web/mocks", () => {
      const agents = getAgentsForSkill("web/mocks", "web/mocks");
      expect(agents).toContain("web-tester");
    });
  });

  describe("category-based matching", () => {
    it("should use category parameter for direct lookup", () => {
      const agents = getAgentsForSkill("any/path", "web/*");
      expect(agents).toContain("web-developer");
    });

    it("should return default agents for unknown category", () => {
      const agents = getAgentsForSkill("unknown/path", "web/unknown-category");
      expect(agents).toContain("agent-summoner");
      expect(agents).toContain("skill-summoner");
      expect(agents).toContain("documentor");
    });
  });

  describe("path normalization", () => {
    it("should strip skills/ prefix from path", () => {
      const agents = getAgentsForSkill("skills/web/framework/react", "web/framework");
      expect(agents).toContain("web-developer");
    });

    it("should strip trailing slash from path", () => {
      const agents = getAgentsForSkill("web/framework/", "web/framework");
      expect(agents).toContain("web-developer");
    });

    it("should handle path without skills/ prefix", () => {
      const agents = getAgentsForSkill("web/framework/react", "web/framework");
      expect(agents).toContain("web-developer");
    });
  });

  describe("fallback behavior", () => {
    it("should return default agents when no pattern matches", () => {
      const agents = getAgentsForSkill("completely/unknown/path", "web-unknown");
      expect(agents).toEqual(["agent-summoner", "skill-summoner", "documentor"]);
    });
  });
});

describe("shouldPreloadSkill", () => {
  describe("category-based preloading", () => {
    it("should preload framework skill for web-developer", () => {
      const result = shouldPreloadSkill(
        "skills/web/framework/react",
        "web-framework-react",
        "framework",
        "web-developer",
      );
      expect(result).toBe(true);
    });

    it("should preload styling skill for web-developer", () => {
      const result = shouldPreloadSkill(
        "skills/web/styling/tailwind",
        "web-styling-tailwind",
        "styling",
        "web-developer",
      );
      expect(result).toBe(true);
    });

    it("should preload api skill for api-developer", () => {
      const result = shouldPreloadSkill(
        "skills/api/api/hono",
        "api-framework-hono",
        "api",
        "api-developer",
      );
      expect(result).toBe(true);
    });

    it("should preload cli skill for cli-developer", () => {
      const result = shouldPreloadSkill(
        "skills/cli/commander",
        "cli-cli-framework-commander",
        "cli-framework",
        "cli-developer",
      );
      expect(result).toBe(true);
    });
  });

  describe("path-based preloading", () => {
    it("should preload when path contains preloaded pattern", () => {
      const result = shouldPreloadSkill(
        "skills/web/framework/react",
        "web-framework-react",
        "web-other",
        "web-developer",
      );
      expect(result).toBe(true);
    });

    it("should preload when path contains testing pattern", () => {
      const result = shouldPreloadSkill(
        "skills/web/testing/vitest",
        "web-testing-vitest",
        "web-other",
        "web-tester",
      );
      expect(result).toBe(true);
    });
  });

  describe("skill ID-based preloading", () => {
    it("should preload when skill ID contains preloaded pattern", () => {
      const result = shouldPreloadSkill(
        "skills/other/path",
        "web-framework-utils",
        "web-other",
        "web-developer",
      );
      expect(result).toBe(true);
    });
  });

  describe("alias-based preloading", () => {
    it("should preload via subcategory alias", () => {
      // framework alias -> web/framework
      const result = shouldPreloadSkill(
        "skills/web/framework/react",
        "web-framework-react",
        "web-other",
        "web-developer",
      );
      expect(result).toBe(true);
    });
  });

  describe("no preloading scenarios", () => {
    it("should not preload for agent with empty preloaded list", () => {
      const result = shouldPreloadSkill(
        "skills/web/framework/react",
        "web-framework-react",
        "framework",
        "agent-summoner",
      );
      expect(result).toBe(false);
    });

    it("should not preload for unknown agent", () => {
      const result = shouldPreloadSkill(
        "skills/web/framework/react",
        "web-framework-react",
        "framework",
        "cli-tester",
      );
      expect(result).toBe(false);
    });

    it("should not preload when no patterns match", () => {
      const result = shouldPreloadSkill(
        "skills/custom/category/skill",
        "web-custom-skill",
        "web-custom",
        "web-developer",
      );
      expect(result).toBe(false);
    });
  });
});

describe("extractCategoryKey", () => {
  it("should extract subcategory (parts[1]) from normalized path", () => {
    // skills/web/framework/react -> web/framework/react -> parts[1] = "framework"
    const result = extractCategoryKey("skills/web/framework/react");
    expect(result).toBe("framework");
  });

  it("should strip skills/ prefix and return parts[1]", () => {
    // skills/api/api/hono -> api/api/hono -> parts[1] = "api"
    const result = extractCategoryKey("skills/api/api/hono");
    expect(result).toBe("api");
  });

  it("should strip trailing slash before extracting", () => {
    // skills/cli/ -> cli -> parts[0] (only one part)
    const result = extractCategoryKey("skills/cli/");
    expect(result).toBe("cli");
  });

  it("should return first part if only one level deep", () => {
    // cli -> parts[0] (only one part)
    const result = extractCategoryKey("cli");
    expect(result).toBe("cli");
  });

  it("should handle path without skills/ prefix", () => {
    // web/framework/react -> parts[1] = "framework"
    const result = extractCategoryKey("web/framework/react");
    expect(result).toBe("framework");
  });

  it("should return parts[0] when only two levels", () => {
    // web/framework -> parts[1] = "framework"
    const result = extractCategoryKey("web/framework");
    expect(result).toBe("framework");
  });

  it("should return parts[0] for single level path", () => {
    // methodology -> parts[0] = "methodology"
    const result = extractCategoryKey("methodology");
    expect(result).toBe("methodology");
  });
});

describe("SUBCATEGORY_ALIASES", () => {
  it("should map framework to web/framework", () => {
    expect(SUBCATEGORY_ALIASES["framework"]).toBe("web/framework");
  });

  it("should map styling to web/styling", () => {
    expect(SUBCATEGORY_ALIASES["styling"]).toBe("web/styling");
  });

  it("should map api to api/api", () => {
    expect(SUBCATEGORY_ALIASES["api"]).toBe("api/api");
  });

  it("should map database to api/database", () => {
    expect(SUBCATEGORY_ALIASES["database"]).toBe("api/database");
  });

  it("should map mocks to web/mocks", () => {
    expect(SUBCATEGORY_ALIASES["mocks"]).toBe("web/mocks");
  });

  it("should map research-methodology to research/research-methodology", () => {
    expect(SUBCATEGORY_ALIASES["research-methodology"]).toBe("research/research-methodology");
  });

  it("should map monorepo to infra/monorepo", () => {
    expect(SUBCATEGORY_ALIASES["monorepo"]).toBe("infra/monorepo");
  });

  it("should map cli directly to cli", () => {
    expect(SUBCATEGORY_ALIASES["cli"]).toBe("cli");
  });

  it("should map testing directly to testing", () => {
    expect(SUBCATEGORY_ALIASES["testing"]).toBe("testing");
  });

  it("should map reviewing directly to reviewing", () => {
    expect(SUBCATEGORY_ALIASES["reviewing"]).toBe("reviewing");
  });
});

// =============================================================================
// P2-05: YAML Defaults Loader Tests
// =============================================================================

describe("defaults-loader", () => {
  beforeEach(() => {
    // Clear cache before each test to ensure isolation
    clearDefaultsCache();
  });

  afterEach(() => {
    // Clean up after tests
    clearDefaultsCache();
  });

  describe("loadDefaultMappings", () => {
    it("should load default mappings from YAML file", async () => {
      const defaults = await loadDefaultMappings();

      expect(defaults).not.toBeNull();
      expect(defaults!.skill_to_agents).toBeDefined();
      expect(defaults!.preloaded_skills).toBeDefined();
      expect(defaults!.subcategory_aliases).toBeDefined();
    });

    it("should return cached result on subsequent calls", async () => {
      const first = await loadDefaultMappings();
      const second = await loadDefaultMappings();

      // Same reference (cached)
      expect(first).toBe(second);
    });

    it("should load skill_to_agents with all expected patterns", async () => {
      const defaults = await loadDefaultMappings();

      expect(defaults!.skill_to_agents["web/*"]).toBeDefined();
      expect(defaults!.skill_to_agents["api/*"]).toBeDefined();
      expect(defaults!.skill_to_agents["cli/*"]).toBeDefined();
      expect(defaults!.skill_to_agents["web/testing"]).toBeDefined();
    });

    it("should load preloaded_skills with all expected agents", async () => {
      const defaults = await loadDefaultMappings();

      expect(defaults!.preloaded_skills["web-developer"]).toBeDefined();
      expect(defaults!.preloaded_skills["api-developer"]).toBeDefined();
      expect(defaults!.preloaded_skills["cli-developer"]).toBeDefined();
      expect(defaults!.preloaded_skills["agent-summoner"]).toBeDefined();
    });

    it("should load subcategory_aliases with all expected mappings", async () => {
      const defaults = await loadDefaultMappings();

      expect(defaults!.subcategory_aliases["framework"]).toBe("web/framework");
      expect(defaults!.subcategory_aliases["api"]).toBe("api/api");
      expect(defaults!.subcategory_aliases["cli"]).toBe("cli");
    });
  });

  describe("getCachedDefaults", () => {
    it("should return null before defaults are loaded", () => {
      const cached = getCachedDefaults();
      expect(cached).toBeNull();
    });

    it("should return cached defaults after loading", async () => {
      await loadDefaultMappings();
      const cached = getCachedDefaults();

      expect(cached).not.toBeNull();
      expect(cached!.skill_to_agents).toBeDefined();
    });
  });

  describe("clearDefaultsCache", () => {
    it("should clear the cached defaults", async () => {
      await loadDefaultMappings();
      expect(getCachedDefaults()).not.toBeNull();

      clearDefaultsCache();
      expect(getCachedDefaults()).toBeNull();
    });
  });
});

// =============================================================================
// P2-05: YAML Defaults Match Hardcoded Fallbacks
// =============================================================================

describe("YAML defaults match hardcoded fallbacks", () => {
  beforeEach(async () => {
    clearDefaultsCache();
    await loadDefaultMappings();
  });

  afterEach(() => {
    clearDefaultsCache();
  });

  it("should have same skill_to_agents mappings as hardcoded", async () => {
    const defaults = getCachedDefaults();

    // Verify key patterns match
    for (const [pattern, agents] of Object.entries(SKILL_TO_AGENTS)) {
      expect(defaults!.skill_to_agents[pattern]).toBeDefined();
      expect(defaults!.skill_to_agents[pattern]).toEqual(agents);
    }
  });

  it("should have same preloaded_skills mappings as hardcoded", async () => {
    const defaults = getCachedDefaults();

    for (const [agent, patterns] of Object.entries(PRELOADED_SKILLS)) {
      expect(defaults!.preloaded_skills[agent]).toBeDefined();
      expect(defaults!.preloaded_skills[agent]).toEqual(patterns);
    }
  });

  it("should have same subcategory_aliases as hardcoded", async () => {
    const defaults = getCachedDefaults();

    for (const [alias, path] of Object.entries(SUBCATEGORY_ALIASES)) {
      expect(defaults!.subcategory_aliases[alias]).toBe(path);
    }
  });
});

// =============================================================================
// P2-05: Project Config Override Tests
// =============================================================================

describe("project config overrides", () => {
  beforeEach(async () => {
    clearDefaultsCache();
    await loadDefaultMappings();
  });

  afterEach(() => {
    clearDefaultsCache();
  });

  describe("preload_patterns override", () => {
    it("should use project config preload_patterns when provided", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer"],
        preload_patterns: {
          "web-developer": ["custom-pattern"],
        },
      };

      // With custom preload_patterns, skill should not match default patterns
      const result = shouldPreloadSkill(
        "skills/web/framework/react",
        "web-framework-react",
        "framework",
        "web-developer",
        projectConfig,
      );

      // "framework" is NOT in custom patterns, so should not preload
      expect(result).toBe(false);
    });

    it("should preload when skill matches custom pattern", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer"],
        preload_patterns: {
          "web-developer": ["custom-framework"],
        },
      };

      // Skill ID contains "custom-framework"
      const result = shouldPreloadSkill(
        "skills/custom/path",
        "web-custom-framework-skill",
        "web-custom",
        "web-developer",
        projectConfig,
      );

      expect(result).toBe(true);
    });

    it("should fall back to defaults when no project config preload_patterns", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer"],
        // No preload_patterns specified
      };

      // Should use default patterns
      const result = shouldPreloadSkill(
        "skills/web/framework/react",
        "web-framework-react",
        "framework",
        "web-developer",
        projectConfig,
      );

      expect(result).toBe(true);
    });

    it("should handle agent not in preload_patterns", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer", "api-developer"],
        preload_patterns: {
          // Only web-developer has custom patterns
          "web-developer": ["custom-pattern"],
        },
      };

      // api-developer not in custom patterns, so should return false
      // (preload_patterns completely replaces defaults when provided)
      const result = shouldPreloadSkill(
        "skills/api/api/hono",
        "api-framework-hono",
        "api",
        "api-developer",
        projectConfig,
      );

      expect(result).toBe(false);
    });
  });

  describe("hasAgentSkillsOverride", () => {
    it("should return true when agent has agent_skills override", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer"],
        agent_skills: {
          "web-developer": ["web-framework-react", "web-state-zustand"],
        },
      };

      expect(hasAgentSkillsOverride("web-developer", projectConfig)).toBe(true);
    });

    it("should return false when agent has no agent_skills override", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer", "api-developer"],
        agent_skills: {
          "web-developer": ["web-framework-react"],
        },
      };

      expect(hasAgentSkillsOverride("api-developer", projectConfig)).toBe(false);
    });

    it("should return false when project config has no agent_skills", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer"],
      };

      expect(hasAgentSkillsOverride("web-developer", projectConfig)).toBe(false);
    });

    it("should return false when project config is undefined", () => {
      expect(hasAgentSkillsOverride("web-developer", undefined)).toBe(false);
    });
  });

  describe("getAgentsForSkill with project config", () => {
    it("should still work with project config (no override for agent list yet)", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer"],
      };

      // getAgentsForSkill uses YAML defaults or hardcoded fallback
      const agents = getAgentsForSkill(
        "skills/web/framework/react",
        "web/framework",
        projectConfig,
      );

      expect(agents).toContain("web-developer");
      expect(agents).toContain("web-reviewer");
    });
  });
});

// =============================================================================
// P2-05: Fallback Behavior Tests
// =============================================================================

describe("fallback to hardcoded when YAML not loaded", () => {
  beforeEach(() => {
    // Ensure cache is cleared so we use hardcoded fallbacks
    clearDefaultsCache();
  });

  it("should use hardcoded SKILL_TO_AGENTS when cache is empty", () => {
    // Don't load defaults, cache is empty
    const agents = getAgentsForSkill("skills/web/framework/react", "web/framework");

    // Should still work using hardcoded fallback
    expect(agents).toContain("web-developer");
    expect(agents).toContain("web-reviewer");
  });

  it("should use hardcoded PRELOADED_SKILLS when cache is empty", () => {
    // Don't load defaults, cache is empty
    const result = shouldPreloadSkill(
      "skills/web/framework/react",
      "web-framework-react",
      "framework",
      "web-developer",
    );

    // Should still work using hardcoded fallback
    expect(result).toBe(true);
  });

  it("should use hardcoded SUBCATEGORY_ALIASES when cache is empty", () => {
    // Don't load defaults, cache is empty
    const result = shouldPreloadSkill(
      "skills/web/framework/react",
      "web-framework-react",
      "web-other", // Not matching category
      "web-developer",
    );

    // Should preload via alias-based matching
    expect(result).toBe(true);
  });
});

// =============================================================================
// P2-07: isSkillAssignedToAgent Tests
// =============================================================================

describe("isSkillAssignedToAgent", () => {
  describe("simple list format", () => {
    it("should return true when skill ID is in simple list", () => {
      const agentSkills: Record<string, AgentSkillConfig> = {
        "web-developer": ["web-framework-react", "web-state-zustand"],
      };

      expect(isSkillAssignedToAgent("web-framework-react", "web-developer", agentSkills)).toBe(
        true,
      );
    });

    it("should return false when skill ID is not in simple list", () => {
      const agentSkills: Record<string, AgentSkillConfig> = {
        "web-developer": ["web-framework-react", "web-state-zustand"],
      };

      expect(isSkillAssignedToAgent("api-framework-hono", "web-developer", agentSkills)).toBe(
        false,
      );
    });

    it("should return false when agent is not in config", () => {
      const agentSkills: Record<string, AgentSkillConfig> = {
        "web-developer": ["web-framework-react"],
      };

      expect(isSkillAssignedToAgent("web-framework-react", "api-developer", agentSkills)).toBe(
        false,
      );
    });
  });

  describe("SkillAssignment objects in list", () => {
    it("should match SkillAssignment by id field", () => {
      const agentSkills: Record<string, AgentSkillConfig> = {
        "web-developer": [
          { id: "web-framework-react", preloaded: true },
          { id: "web-state-zustand" },
        ],
      };

      expect(isSkillAssignedToAgent("web-framework-react", "web-developer", agentSkills)).toBe(
        true,
      );
      expect(isSkillAssignedToAgent("web-state-zustand", "web-developer", agentSkills)).toBe(true);
    });

    it("should handle mixed string and SkillAssignment entries", () => {
      const agentSkills: Record<string, AgentSkillConfig> = {
        "web-developer": ["web-framework-react", { id: "web-state-zustand", preloaded: true }],
      };

      expect(isSkillAssignedToAgent("web-framework-react", "web-developer", agentSkills)).toBe(
        true,
      );
      expect(isSkillAssignedToAgent("web-state-zustand", "web-developer", agentSkills)).toBe(true);
    });
  });

  describe("categorized format", () => {
    it("should find skill in categorized format", () => {
      const agentSkills: Record<string, AgentSkillConfig> = {
        "web-developer": {
          framework: ["web-framework-react"],
          "state-management": ["web-state-zustand"],
        },
      };

      expect(isSkillAssignedToAgent("web-framework-react", "web-developer", agentSkills)).toBe(
        true,
      );
      expect(isSkillAssignedToAgent("web-state-zustand", "web-developer", agentSkills)).toBe(true);
    });

    it("should return false when skill not in any category", () => {
      const agentSkills: Record<string, AgentSkillConfig> = {
        "web-developer": {
          framework: ["web-framework-react"],
        },
      };

      expect(isSkillAssignedToAgent("api-framework-hono", "web-developer", agentSkills)).toBe(
        false,
      );
    });

    it("should handle SkillAssignment objects in categories", () => {
      const agentSkills: Record<string, AgentSkillConfig> = {
        "web-developer": {
          framework: [{ id: "web-framework-react", preloaded: true }],
        },
      };

      expect(isSkillAssignedToAgent("web-framework-react", "web-developer", agentSkills)).toBe(
        true,
      );
    });
  });
});

// =============================================================================
// P2-07: resolveAgentsForSkill Tests
// =============================================================================

describe("resolveAgentsForSkill", () => {
  beforeEach(() => {
    clearDefaultsCache();
  });

  afterEach(() => {
    clearDefaultsCache();
  });

  describe("without project config", () => {
    it("should fall back to default mappings when no config", () => {
      const agents = resolveAgentsForSkill(
        "web-framework-react",
        "skills/web/framework/react",
        "web/framework",
        undefined,
      );

      // Should use default mappings
      expect(agents).toContain("web-developer");
      expect(agents).toContain("web-reviewer");
    });

    it("should fall back to defaults when config has no agent_skills", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer"],
        // No agent_skills
      };

      const agents = resolveAgentsForSkill(
        "web-framework-react",
        "skills/web/framework/react",
        "web/framework",
        projectConfig,
      );

      // Should use default mappings
      expect(agents).toContain("web-developer");
      expect(agents).toContain("web-reviewer");
    });
  });

  // ===========================================================================
  // P2-08: Test custom agent_skills in config.yaml
  // ===========================================================================

  describe("P2-08: custom agent_skills in config", () => {
    it("should only return agents whose config includes the skill", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer", "api-developer"],
        agent_skills: {
          "web-developer": ["web-framework-react", "web-state-zustand"],
          "api-developer": ["api-framework-hono", "api-database-drizzle"],
        },
      };

      // React should only go to web-developer
      const reactAgents = resolveAgentsForSkill(
        "web-framework-react",
        "skills/web/framework/react",
        "web/framework",
        projectConfig,
      );
      expect(reactAgents).toEqual(["web-developer"]);

      // Hono should only go to api-developer
      const honoAgents = resolveAgentsForSkill(
        "api-framework-hono",
        "skills/api/api/hono",
        "api/api",
        projectConfig,
      );
      expect(honoAgents).toEqual(["api-developer"]);
    });

    it("should return empty array when skill not in any agent config", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer"],
        agent_skills: {
          "web-developer": ["web-framework-react"],
        },
      };

      // Vue not in any config
      const agents = resolveAgentsForSkill(
        "web-framework-vue",
        "skills/web/framework/vue",
        "web/framework",
        projectConfig,
      );

      expect(agents).toEqual([]);
    });

    it("should return multiple agents when skill is in multiple configs", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer", "web-reviewer"],
        agent_skills: {
          "web-developer": ["web-framework-react"],
          "web-reviewer": ["web-framework-react"],
        },
      };

      const agents = resolveAgentsForSkill(
        "web-framework-react",
        "skills/web/framework/react",
        "web/framework",
        projectConfig,
      );

      expect(agents).toContain("web-developer");
      expect(agents).toContain("web-reviewer");
      expect(agents).toHaveLength(2);
    });

    it("should handle categorized agent_skills format", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer"],
        agent_skills: {
          "web-developer": {
            framework: ["web-framework-react"],
            "state-management": ["web-state-zustand"],
          },
        },
      };

      const reactAgents = resolveAgentsForSkill(
        "web-framework-react",
        "skills/web/framework/react",
        "web/framework",
        projectConfig,
      );
      expect(reactAgents).toEqual(["web-developer"]);

      const zustandAgents = resolveAgentsForSkill(
        "web-state-zustand",
        "skills/web/state/zustand",
        "web/state",
        projectConfig,
      );
      expect(zustandAgents).toEqual(["web-developer"]);
    });

    it("should handle SkillAssignment objects in agent_skills", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer"],
        agent_skills: {
          "web-developer": [
            { id: "web-framework-react", preloaded: true },
            { id: "web-state-zustand" },
          ],
        },
      };

      const agents = resolveAgentsForSkill(
        "web-framework-react",
        "skills/web/framework/react",
        "web/framework",
        projectConfig,
      );

      expect(agents).toEqual(["web-developer"]);
    });
  });

  // ===========================================================================
  // P2-09: Test override default mappings via project config
  // ===========================================================================

  describe("P2-09: override default mappings", () => {
    it("should allow adding an agent that would not normally get a skill", () => {
      // By default, cli-developer would not get a web skill
      // But with config override, we can assign it
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["cli-developer"],
        agent_skills: {
          "cli-developer": ["web-framework-react"], // Override: CLI dev gets React
        },
      };

      const agents = resolveAgentsForSkill(
        "web-framework-react",
        "skills/web/framework/react",
        "web/framework",
        projectConfig,
      );

      expect(agents).toEqual(["cli-developer"]);
    });

    it("should allow removing an agent that would normally get a skill", () => {
      // By default, web-developer would get web skills
      // But with config override, we can exclude them
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer", "web-reviewer"],
        agent_skills: {
          // Only web-reviewer gets React, web-developer is excluded
          "web-reviewer": ["web-framework-react"],
        },
      };

      const agents = resolveAgentsForSkill(
        "web-framework-react",
        "skills/web/framework/react",
        "web/framework",
        projectConfig,
      );

      // web-developer excluded despite being in agents list
      expect(agents).toEqual(["web-reviewer"]);
      expect(agents).not.toContain("web-developer");
    });

    it("should completely override defaults when agent_skills is present", () => {
      // Even if an agent would normally get many skills via default mappings,
      // when agent_skills is specified, ONLY those skills are assigned
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer"],
        agent_skills: {
          "web-developer": ["web-state-zustand"], // Only zustand, NOT react
        },
      };

      // React should NOT go to web-developer despite being a web skill
      const reactAgents = resolveAgentsForSkill(
        "web-framework-react",
        "skills/web/framework/react",
        "web/framework",
        projectConfig,
      );
      expect(reactAgents).toEqual([]);

      // Zustand should go to web-developer as specified
      const zustandAgents = resolveAgentsForSkill(
        "web-state-zustand",
        "skills/web/state/zustand",
        "web/state",
        projectConfig,
      );
      expect(zustandAgents).toEqual(["web-developer"]);
    });

    it("should support cross-domain skill assignment via override", () => {
      // Assign an api skill to a web developer via override
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer"],
        agent_skills: {
          "web-developer": ["web-framework-react", "api-framework-hono"], // Fullstack!
        },
      };

      const honoAgents = resolveAgentsForSkill(
        "api-framework-hono",
        "skills/api/api/hono",
        "api/api",
        projectConfig,
      );

      expect(honoAgents).toEqual(["web-developer"]);
    });
  });
});
