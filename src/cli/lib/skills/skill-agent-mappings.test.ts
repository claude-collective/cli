import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SKILL_TO_AGENTS,
  AGENT_SKILL_PREFIXES,
  getAgentsForSkill,
  getDefaultSkillsForAgent,
} from "./skill-agent-mappings";
import { loadDefaultMappings, clearDefaultsCache, getCachedDefaults } from "../loading";
import { TEST_AVAILABLE_SKILLS } from "../__tests__/test-constants";

import type { ProjectConfig, SkillId } from "../../types";

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
      expect(defaults!.agent_skill_prefixes).toBeDefined();
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

  it("should have same agent_skill_prefixes mappings as hardcoded", async () => {
    const defaults = getCachedDefaults();

    // Verify every hardcoded agent has matching YAML prefixes
    for (const [agentName, prefixes] of Object.entries(AGENT_SKILL_PREFIXES)) {
      expect(defaults!.agent_skill_prefixes[agentName]).toBeDefined();
      expect(defaults!.agent_skill_prefixes[agentName]).toEqual(prefixes);
    }
  });
});

describe("project config overrides", () => {
  beforeEach(async () => {
    clearDefaultsCache();
    await loadDefaultMappings();
  });

  afterEach(() => {
    clearDefaultsCache();
  });

  describe("getAgentsForSkill with project config", () => {
    it("should still work with project config (no override for agent list yet)", () => {
      const projectConfig: ProjectConfig = {
        name: "test-project",
        agents: ["web-developer"],
        skills: [],
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
});

describe("getDefaultSkillsForAgent", () => {
  // Imported from test-constants.ts — shared across test files
  const availableSkills: SkillId[] = [...TEST_AVAILABLE_SKILLS];

  describe("web domain agents", () => {
    it("should return web, mobile, infra, security, and meta skills for web-developer", () => {
      const skills = getDefaultSkillsForAgent("web-developer", availableSkills);

      // Web skills
      expect(skills).toContain("web-framework-react");
      expect(skills).toContain("web-styling-scss-modules");
      expect(skills).toContain("web-testing-vitest");
      // Mobile skills (web-developer handles mobile too)
      expect(skills).toContain("mobile-framework-react-native");
      // Infra skills
      expect(skills).toContain("infra-monorepo-turborepo");
      // Security skills
      expect(skills).toContain("security-web-security");
      // Meta skills
      expect(skills).toContain("meta-methodology-investigation-requirements");
      // Should NOT include api or cli skills
      expect(skills).not.toContain("api-framework-hono");
      expect(skills).not.toContain("cli-framework-cli-commander");
    });

    it("should return web, mobile, security, and meta skills for web-reviewer", () => {
      const skills = getDefaultSkillsForAgent("web-reviewer", availableSkills);

      expect(skills).toContain("web-framework-react");
      expect(skills).toContain("mobile-framework-react-native");
      expect(skills).toContain("security-web-security");
      expect(skills).toContain("meta-reviewing-reviewing");
      // Should NOT include api, cli, or infra
      expect(skills).not.toContain("api-framework-hono");
      expect(skills).not.toContain("cli-framework-cli-commander");
      expect(skills).not.toContain("infra-monorepo-turborepo");
    });

    it("should return web, mobile, and meta skills for web-researcher", () => {
      const skills = getDefaultSkillsForAgent("web-researcher", availableSkills);

      expect(skills).toContain("web-framework-react");
      expect(skills).toContain("mobile-framework-react-native");
      expect(skills).toContain("meta-research-research-methodology");
      expect(skills).not.toContain("api-framework-hono");
    });

    it("should return web and meta skills for web-tester", () => {
      const skills = getDefaultSkillsForAgent("web-tester", availableSkills);

      expect(skills).toContain("web-testing-vitest");
      expect(skills).toContain("web-mocks-msw");
      expect(skills).toContain("meta-methodology-investigation-requirements");
      expect(skills).not.toContain("api-testing-api-testing");
      expect(skills).not.toContain("mobile-framework-react-native");
    });
  });

  describe("api domain agents", () => {
    it("should return api, infra, security, cli, and meta skills for api-developer", () => {
      const skills = getDefaultSkillsForAgent("api-developer", availableSkills);

      expect(skills).toContain("api-framework-hono");
      expect(skills).toContain("api-database-drizzle");
      expect(skills).toContain("infra-monorepo-turborepo");
      expect(skills).toContain("security-web-security");
      expect(skills).toContain("cli-framework-cli-commander");
      expect(skills).toContain("meta-methodology-investigation-requirements");
      // Should NOT include web or mobile
      expect(skills).not.toContain("web-framework-react");
      expect(skills).not.toContain("mobile-framework-react-native");
    });

    it("should return api, security, cli, and meta skills for api-reviewer", () => {
      const skills = getDefaultSkillsForAgent("api-reviewer", availableSkills);

      expect(skills).toContain("api-framework-hono");
      expect(skills).toContain("security-web-security");
      expect(skills).toContain("cli-framework-cli-commander");
      expect(skills).toContain("meta-reviewing-reviewing");
      expect(skills).not.toContain("web-framework-react");
      expect(skills).not.toContain("infra-monorepo-turborepo");
    });

    it("should return api, cli, and meta skills for api-researcher", () => {
      const skills = getDefaultSkillsForAgent("api-researcher", availableSkills);

      expect(skills).toContain("api-framework-hono");
      expect(skills).toContain("cli-framework-cli-commander");
      expect(skills).toContain("meta-research-research-methodology");
      expect(skills).not.toContain("web-framework-react");
    });
  });

  describe("cli domain agents", () => {
    it("should return cli and meta skills for cli-developer", () => {
      const skills = getDefaultSkillsForAgent("cli-developer", availableSkills);

      expect(skills).toContain("cli-framework-cli-commander");
      expect(skills).toContain("cli-framework-oclif");
      expect(skills).toContain("meta-methodology-investigation-requirements");
      expect(skills).not.toContain("web-framework-react");
      expect(skills).not.toContain("api-framework-hono");
    });

    it("should return cli and meta skills for cli-tester", () => {
      const skills = getDefaultSkillsForAgent("cli-tester", availableSkills);

      expect(skills).toContain("cli-framework-cli-commander");
      expect(skills).toContain("meta-methodology-investigation-requirements");
      expect(skills).not.toContain("web-testing-vitest");
    });

    it("should return cli and meta skills for cli-reviewer", () => {
      const skills = getDefaultSkillsForAgent("cli-reviewer", availableSkills);

      expect(skills).toContain("cli-framework-cli-commander");
      expect(skills).toContain("meta-reviewing-reviewing");
      expect(skills).not.toContain("web-framework-react");
    });

    it("should return cli and meta skills for cli-migrator", () => {
      const skills = getDefaultSkillsForAgent("cli-migrator", availableSkills);

      expect(skills).toContain("cli-framework-cli-commander");
      expect(skills).toContain("meta-methodology-investigation-requirements");
      expect(skills).not.toContain("api-framework-hono");
    });
  });

  describe("cross-cutting agents", () => {
    it("should return skills from ALL domains for web-pm", () => {
      const skills = getDefaultSkillsForAgent("web-pm", availableSkills);

      // web-pm gets everything — full context
      expect(skills).toContain("web-framework-react");
      expect(skills).toContain("api-framework-hono");
      expect(skills).toContain("cli-framework-cli-commander");
      expect(skills).toContain("mobile-framework-react-native");
      expect(skills).toContain("infra-monorepo-turborepo");
      expect(skills).toContain("security-web-security");
      expect(skills).toContain("meta-methodology-investigation-requirements");
      // Should include ALL available skills (all prefixes covered)
      expect(skills.length).toBe(availableSkills.length);
    });

    it("should return web, api, infra, security, cli, and meta skills for web-architecture", () => {
      const skills = getDefaultSkillsForAgent("web-architecture", availableSkills);

      expect(skills).toContain("web-framework-react");
      expect(skills).toContain("api-framework-hono");
      expect(skills).toContain("infra-monorepo-turborepo");
      expect(skills).toContain("security-web-security");
      expect(skills).toContain("cli-framework-cli-commander");
      expect(skills).toContain("meta-methodology-investigation-requirements");
      // Should NOT include mobile
      expect(skills).not.toContain("mobile-framework-react-native");
    });
  });

  describe("pattern agents", () => {
    it("should return web, api, and meta skills for pattern-scout", () => {
      const skills = getDefaultSkillsForAgent("pattern-scout", availableSkills);

      expect(skills).toContain("web-framework-react");
      expect(skills).toContain("api-framework-hono");
      expect(skills).toContain("meta-methodology-investigation-requirements");
      expect(skills).not.toContain("cli-framework-cli-commander");
    });

    it("should return web, api, and meta skills for web-pattern-critique", () => {
      const skills = getDefaultSkillsForAgent("web-pattern-critique", availableSkills);

      expect(skills).toContain("web-framework-react");
      expect(skills).toContain("api-framework-hono");
      expect(skills).toContain("meta-reviewing-reviewing");
      expect(skills).not.toContain("cli-framework-cli-commander");
    });
  });

  describe("meta agents", () => {
    it("should return only meta skills for agent-summoner", () => {
      const skills = getDefaultSkillsForAgent("agent-summoner", availableSkills);

      expect(skills).toContain("meta-methodology-investigation-requirements");
      expect(skills).toContain("meta-methodology-anti-over-engineering");
      expect(skills).toContain("meta-reviewing-reviewing");
      expect(skills).toContain("meta-research-research-methodology");
      // Should NOT include domain-specific skills
      expect(skills).not.toContain("web-framework-react");
      expect(skills).not.toContain("api-framework-hono");
      expect(skills).not.toContain("cli-framework-cli-commander");
    });

    it("should return only meta skills for skill-summoner", () => {
      const skills = getDefaultSkillsForAgent("skill-summoner", availableSkills);

      expect(skills).toContain("meta-methodology-investigation-requirements");
      expect(skills).not.toContain("web-framework-react");
    });

    it("should return only meta skills for documentor", () => {
      const skills = getDefaultSkillsForAgent("documentor", availableSkills);

      expect(skills).toContain("meta-research-research-methodology");
      expect(skills).not.toContain("api-database-drizzle");
    });
  });

  describe("edge cases", () => {
    it("should return empty array when available skills list is empty", () => {
      const skills = getDefaultSkillsForAgent("web-developer", []);
      expect(skills).toEqual([]);
    });

    it("should only return skills that exist in the available list", () => {
      const limitedSkills: SkillId[] = ["web-framework-react", "api-framework-hono"];
      const skills = getDefaultSkillsForAgent("web-developer", limitedSkills);

      // Only web-framework-react matches (web-developer gets web-* prefix)
      expect(skills).toContain("web-framework-react");
      expect(skills).not.toContain("api-framework-hono");
    });

    it("should return empty array when no available skills match the agent prefixes", () => {
      const noMatchSkills: SkillId[] = ["web-framework-react", "web-testing-vitest"];
      const skills = getDefaultSkillsForAgent("cli-developer", noMatchSkills);

      // cli-developer gets cli-* and meta-*, neither matches
      expect(skills).toEqual([]);
    });

    it("should not return duplicate skills", () => {
      const skills = getDefaultSkillsForAgent("web-pm", availableSkills);
      const uniqueSkills = [...new Set(skills)];
      expect(skills.length).toBe(uniqueSkills.length);
    });

    it("should preserve the order of available skills", () => {
      const orderedSkills: SkillId[] = [
        "web-testing-vitest",
        "web-framework-react",
        "meta-methodology-investigation-requirements",
      ];
      const skills = getDefaultSkillsForAgent("web-tester", orderedSkills);

      // web-tester gets web-* and meta-*, all 3 match, order preserved
      expect(skills).toEqual([
        "web-testing-vitest",
        "web-framework-react",
        "meta-methodology-investigation-requirements",
      ]);
    });
  });
});
