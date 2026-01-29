export const SKILL_TO_AGENTS: Record<string, string[]> = {
  "frontend/*": [
    "frontend-developer",
    "frontend-reviewer",
    "frontend-researcher",
    "pm",
    "pattern-scout",
    "pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "backend/*": [
    "backend-developer",
    "backend-reviewer",
    "backend-researcher",
    "architecture",
    "pm",
    "pattern-scout",
    "pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "mobile/*": [
    "frontend-developer",
    "frontend-reviewer",
    "frontend-researcher",
    "pm",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "setup/*": [
    "architecture",
    "frontend-developer",
    "backend-developer",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "security/*": [
    "frontend-developer",
    "backend-developer",
    "frontend-reviewer",
    "backend-reviewer",
    "architecture",
    "pm",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "reviewing/*": [
    "frontend-reviewer",
    "backend-reviewer",
    "cli-reviewer",
    "pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "cli/*": [
    "cli-developer",
    "cli-reviewer",
    "backend-developer",
    "backend-reviewer",
    "backend-researcher",
    "architecture",
    "pm",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "research/*": [
    "frontend-researcher",
    "backend-researcher",
    "pm",
    "pattern-scout",
    "pattern-critique",
    "documentor",
    "agent-summoner",
    "skill-summoner",
  ],

  "methodology/*": [
    "frontend-developer",
    "backend-developer",
    "frontend-reviewer",
    "backend-reviewer",
    "frontend-researcher",
    "backend-researcher",
    "tester",
    "pm",
    "architecture",
    "pattern-scout",
    "pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "frontend/testing": ["tester", "frontend-developer", "frontend-reviewer"],
  "backend/testing": ["tester", "backend-developer", "backend-reviewer"],

  "frontend/mocks": ["tester", "frontend-developer", "frontend-reviewer"],
};

export const PRELOADED_SKILLS: Record<string, string[]> = {
  "frontend-developer": ["framework", "styling"],
  "backend-developer": ["api", "database", "cli"],
  "cli-developer": ["cli"],
  "frontend-reviewer": ["framework", "styling", "reviewing"],
  "backend-reviewer": ["api", "database", "reviewing"],
  "cli-reviewer": ["cli", "reviewing", "cli-reviewing"],
  "frontend-researcher": ["framework", "research-methodology"],
  "backend-researcher": ["api", "research-methodology"],
  tester: ["testing", "mocks"],
  architecture: ["monorepo", "turborepo", "cli"],
  pm: ["research-methodology"],
  "pattern-scout": ["research-methodology"],
  "pattern-critique": ["research-methodology", "reviewing"],
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
