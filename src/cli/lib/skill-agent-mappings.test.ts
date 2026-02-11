import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SKILL_TO_AGENTS, getAgentsForSkill } from "./skill-agent-mappings";
import { loadDefaultMappings, clearDefaultsCache, getCachedDefaults } from "./defaults-loader";

import type { ProjectConfig } from "../../types";

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
});
