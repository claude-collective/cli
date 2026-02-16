/**
 * @deprecated This module is deprecated. Skills are now defined directly in agent YAMLs.
 * Use agent's `skills` field in agent.yaml instead of these mappings.
 * See: src/cli/lib/resolver.ts -> resolveAgentSkills()
 *
 * This file is kept for backwards compatibility with:
 * - config-generator.ts (wizard flow for generating configs from skills)
 * - Legacy stack-based configurations
 *
 * Will be removed in a future version once config-generator is updated
 * to use the new agent-centric approach.
 */

import type { AgentName, CategoryPath, ProjectConfig, SkillId, SkillIdPrefix } from "../../types";
import { getCachedDefaults } from "../loading";

// Hardcoded fallback defaults — used when YAML defaults cannot be loaded

// Boundary cast: literal strings are valid AgentName values at this data definition boundary
export const SKILL_TO_AGENTS: Record<string, AgentName[]> = {
  "web/*": [
    "web-developer",
    "web-reviewer",
    "web-researcher",
    "web-pm",
    "pattern-scout",
    "web-pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "api/*": [
    "api-developer",
    "api-reviewer",
    "api-researcher",
    "web-architecture",
    "web-pm",
    "pattern-scout",
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

  "infra/*": [
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
    "pattern-scout",
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
    "pattern-scout",
    "web-pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  "web/testing": ["web-tester", "web-developer", "web-reviewer"],
  "api/testing": ["web-tester", "api-developer", "api-reviewer"],

  "web/mocks": ["web-tester", "web-developer", "web-reviewer"],
};

// Boundary cast: literal strings are valid AgentName values
const DEFAULT_AGENTS: AgentName[] = ["agent-summoner", "skill-summoner", "documentor"];

// Priority: YAML defaults (if loaded) > hardcoded fallback
function getEffectiveSkillToAgents(): Record<string, AgentName[]> {
  const defaults = getCachedDefaults();
  if (defaults?.skill_to_agents) {
    // Boundary cast: YAML-loaded mappings contain valid AgentName values
    return defaults.skill_to_agents as Record<string, AgentName[]>;
  }
  return SKILL_TO_AGENTS;
}

export function getAgentsForSkill(
  skillPath: string,
  category: CategoryPath,
  _projectConfig?: ProjectConfig,
): AgentName[] {
  const normalizedPath = skillPath.replace(/^skills\//, "").replace(/\/$/, "");

  const skillToAgents = getEffectiveSkillToAgents();

  if (skillToAgents[category]) {
    return skillToAgents[category];
  }

  for (const [pattern, agents] of Object.entries(skillToAgents)) {
    if (normalizedPath === pattern || normalizedPath.startsWith(`${pattern}/`)) {
      return agents;
    }
  }

  for (const [pattern, agents] of Object.entries(skillToAgents)) {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (normalizedPath.startsWith(prefix)) {
        return agents;
      }
    }
  }

  return DEFAULT_AGENTS;
}

/**
 * Maps each agent to the skill ID prefixes it should receive by default.
 * Derived from the inverse of SKILL_TO_AGENTS and stacks.yaml patterns.
 *
 * - Domain-specific agents get their domain prefix(es)
 * - Cross-cutting agents (web-pm, web-architecture) get broad prefix sets
 * - Meta agents get the "meta" prefix
 * - All agents additionally receive "meta" for methodology/research skills
 */
export const AGENT_SKILL_PREFIXES: Record<AgentName, SkillIdPrefix[]> = {
  "web-developer": ["web", "mobile", "infra", "security", "meta"],
  "web-reviewer": ["web", "mobile", "security", "meta"],
  "web-researcher": ["web", "mobile", "meta"],
  "web-tester": ["web", "meta"],

  "api-developer": ["api", "infra", "security", "cli", "meta"],
  "api-reviewer": ["api", "security", "cli", "meta"],
  "api-researcher": ["api", "cli", "meta"],

  "cli-developer": ["cli", "meta"],
  "cli-tester": ["cli", "meta"],
  "cli-reviewer": ["cli", "meta"],
  "cli-migrator": ["cli", "meta"],

  // Cross-cutting agents — need full context across multiple domains
  "web-pm": ["web", "api", "cli", "mobile", "infra", "security", "meta"],
  "web-architecture": ["web", "api", "infra", "security", "cli", "meta"],

  "pattern-scout": ["web", "api", "meta"],
  "web-pattern-critique": ["web", "api", "meta"],

  "agent-summoner": ["meta"],
  "skill-summoner": ["meta"],
  documentor: ["meta"],
};

// Priority: YAML defaults (if loaded) > hardcoded fallback
function getEffectiveAgentSkillPrefixes(): Record<AgentName, SkillIdPrefix[]> {
  const defaults = getCachedDefaults();
  if (defaults?.agent_skill_prefixes) {
    // Boundary cast: YAML-loaded mappings contain valid AgentName keys and SkillIdPrefix values
    return defaults.agent_skill_prefixes as Record<AgentName, SkillIdPrefix[]>;
  }
  return AGENT_SKILL_PREFIXES;
}

/**
 * Returns sensible default skills for an agent based on its domain.
 * Only returns skills that exist in the provided `availableSkills` list.
 *
 * @param agentName - The agent to get default skills for
 * @param availableSkills - The pool of available skill IDs to select from
 * @returns Skill IDs from `availableSkills` matching the agent's domain prefixes
 */
export function getDefaultSkillsForAgent(
  agentName: AgentName,
  availableSkills: SkillId[],
): SkillId[] {
  const agentSkillPrefixes = getEffectiveAgentSkillPrefixes();
  const prefixes = agentSkillPrefixes[agentName];
  if (!prefixes || prefixes.length === 0) {
    return [];
  }

  return availableSkills.filter((skillId) =>
    prefixes.some((prefix) => skillId.startsWith(`${prefix}-`)),
  );
}
