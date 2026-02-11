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

import type { AgentName, CategoryPath, ProjectConfig } from "../types";
import { getCachedDefaults } from "./defaults-loader";

// =============================================================================
// Hardcoded Fallback Defaults (DEPRECATED)
// These are used when YAML defaults cannot be loaded (bundled fallback)
// Skills should now be defined in agent.yaml files directly.
// =============================================================================

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

// =============================================================================
// Default Agents for Unknown Categories
// =============================================================================

// Boundary cast: literal strings are valid AgentName values
const DEFAULT_AGENTS: AgentName[] = ["agent-summoner", "skill-summoner", "documentor"];

// =============================================================================
// Helper Functions to Get Effective Mappings
// =============================================================================

/**
 * Get the effective skill_to_agents mappings.
 * Priority: YAML defaults (if loaded) > hardcoded fallback
 */
function getEffectiveSkillToAgents(): Record<string, AgentName[]> {
  const defaults = getCachedDefaults();
  if (defaults?.skill_to_agents) {
    // Boundary cast: YAML-loaded mappings contain valid AgentName values
    return defaults.skill_to_agents as Record<string, AgentName[]>;
  }
  return SKILL_TO_AGENTS;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get agents that should receive a skill based on its path and category.
 *
 * Resolution priority:
 * 1. YAML defaults (if loaded)
 * 2. Hardcoded fallback
 *
 * @param skillPath - Full path to the skill (e.g., "skills/web/framework/react")
 * @param category - Skill category (e.g., "web/*" or "web/testing")
 * @param projectConfig - Optional project config for overrides
 * @returns Array of agent IDs that should receive this skill
 */
export function getAgentsForSkill(
  skillPath: string,
  category: CategoryPath,
  projectConfig?: ProjectConfig,
): AgentName[] {
  const normalizedPath = skillPath.replace(/^skills\//, "").replace(/\/$/, "");

  // Get effective mappings (YAML defaults or hardcoded fallback)
  const skillToAgents = getEffectiveSkillToAgents();

  // Check direct category match
  if (skillToAgents[category]) {
    return skillToAgents[category];
  }

  // Check exact path match or path prefix match
  for (const [pattern, agents] of Object.entries(skillToAgents)) {
    if (normalizedPath === pattern || normalizedPath.startsWith(`${pattern}/`)) {
      return agents;
    }
  }

  // Check wildcard pattern match
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
