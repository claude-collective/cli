export const SKILL_TO_AGENTS: Record<string, string[]> = {
  "frontend/*": [
    "web-developer",
    "web-reviewer",
    "web-researcher",
    "web-pm",
    "web-pattern-scout",
    "web-pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "backend/*": [
    "api-developer",
    "api-reviewer",
    "api-researcher",
    "web-architecture",
    "web-pm",
    "web-pattern-scout",
    "web-pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "mobile/*": [
    "web-developer",
    "web-reviewer",
    "web-researcher",
    "web-pm",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "setup/*": [
    "web-architecture",
    "web-developer",
    "api-developer",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "security/*": [
    "web-developer",
    "api-developer",
    "web-reviewer",
    "api-reviewer",
    "web-architecture",
    "web-pm",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "reviewing/*": [
    "web-reviewer",
    "api-reviewer",
    "cli-reviewer",
    "web-pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "cli/*": [
    "cli-developer",
    "cli-reviewer",
    "api-developer",
    "api-reviewer",
    "api-researcher",
    "web-architecture",
    "web-pm",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "research/*": [
    "web-researcher",
    "api-researcher",
    "web-pm",
    "web-pattern-scout",
    "web-pattern-critique",
    "documentor",
    "agent-summoner",
    "skill-summoner",
  ],

  "methodology/*": [
    "web-developer",
    "api-developer",
    "web-reviewer",
    "api-reviewer",
    "web-researcher",
    "api-researcher",
    "web-tester",
    "web-pm",
    "web-architecture",
    "web-pattern-scout",
    "web-pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "frontend/testing": ["web-tester", "web-developer", "web-reviewer"],
  "backend/testing": ["web-tester", "api-developer", "api-reviewer"],

  "frontend/mocks": ["web-tester", "web-developer", "web-reviewer"],
};

export const PRELOADED_SKILLS: Record<string, string[]> = {
  "web-developer": ["framework", "styling"],
  "api-developer": ["api", "database", "cli"],
  "cli-developer": ["cli"],
  "web-reviewer": ["framework", "styling", "reviewing"],
  "api-reviewer": ["api", "database", "reviewing"],
  "cli-reviewer": ["cli", "reviewing", "cli-reviewing"],
  "web-researcher": ["framework", "research-methodology"],
  "api-researcher": ["api", "research-methodology"],
  "web-tester": ["testing", "mocks"],
  "web-architecture": ["monorepo", "turborepo", "cli"],
  "web-pm": ["research-methodology"],
  "web-pattern-scout": ["research-methodology"],
  "web-pattern-critique": ["research-methodology", "reviewing"],
  documentor: ["research-methodology"],
  "agent-summoner": [],
  "skill-summoner": [],
};

export const SUBCATEGORY_ALIASES: Record<string, string> = {
  framework: "frontend/framework",
  styling: "frontend/styling",
  api: "backend/api",
  database: "backend/database",
  mocks: "frontend/mocks",
  testing: "testing",
  reviewing: "reviewing",
  "research-methodology": "research/research-methodology",
  monorepo: "setup/monorepo",
  cli: "cli",
};

export function getAgentsForSkill(
  skillPath: string,
  category: string,
): string[] {
  const normalizedPath = skillPath.replace(/^skills\//, "").replace(/\/$/, "");

  if (SKILL_TO_AGENTS[category]) {
    return SKILL_TO_AGENTS[category];
  }

  for (const [pattern, agents] of Object.entries(SKILL_TO_AGENTS)) {
    if (
      normalizedPath === pattern ||
      normalizedPath.startsWith(`${pattern}/`)
    ) {
      return agents;
    }
  }

  for (const [pattern, agents] of Object.entries(SKILL_TO_AGENTS)) {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (normalizedPath.startsWith(prefix)) {
        return agents;
      }
    }
  }

  return ["agent-summoner", "skill-summoner", "documentor"];
}

export function shouldPreloadSkill(
  skillPath: string,
  skillId: string,
  category: string,
  agentId: string,
): boolean {
  const preloadedPatterns = PRELOADED_SKILLS[agentId];
  if (!preloadedPatterns || preloadedPatterns.length === 0) {
    return false;
  }

  const normalizedPath = skillPath.replace(/^skills\//, "").replace(/\/$/, "");

  for (const pattern of preloadedPatterns) {
    if (category === pattern) {
      return true;
    }

    if (normalizedPath.includes(pattern)) {
      return true;
    }

    if (skillId.toLowerCase().includes(pattern.toLowerCase())) {
      return true;
    }

    const aliasedPath = SUBCATEGORY_ALIASES[pattern];
    if (aliasedPath && normalizedPath.includes(aliasedPath)) {
      return true;
    }
  }

  return false;
}

export function extractCategoryKey(skillPath: string): string {
  const normalizedPath = skillPath.replace(/^skills\//, "").replace(/\/$/, "");
  const parts = normalizedPath.split("/");
  return parts.length >= 2 ? parts[1] : parts[0];
}
