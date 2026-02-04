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

import type { ProjectConfig } from "../../types";
import { getCachedDefaults } from "./defaults-loader";

// =============================================================================
// Hardcoded Fallback Defaults (DEPRECATED)
// These are used when YAML defaults cannot be loaded (bundled fallback)
// Skills should now be defined in agent.yaml files directly.
// =============================================================================

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

// =============================================================================
// Default Agents for Unknown Categories
// =============================================================================

const DEFAULT_AGENTS = ["agent-summoner", "skill-summoner", "documentor"];

// =============================================================================
// Helper Functions to Get Effective Mappings
// =============================================================================

/**
 * Get the effective skill_to_agents mappings.
 * Priority: YAML defaults (if loaded) > hardcoded fallback
 */
function getEffectiveSkillToAgents(): Record<string, string[]> {
  const defaults = getCachedDefaults();
  if (defaults?.skill_to_agents) {
    return defaults.skill_to_agents;
  }
  return SKILL_TO_AGENTS;
}

/**
 * Get the effective preloaded_skills mappings.
 * Priority: Project config preload_patterns > YAML defaults > hardcoded fallback
 */
function getEffectivePreloadedSkills(
  projectConfig?: ProjectConfig,
): Record<string, string[]> {
  // Project config preload_patterns take priority
  if (projectConfig?.preload_patterns) {
    return projectConfig.preload_patterns;
  }

  // Then YAML defaults
  const defaults = getCachedDefaults();
  if (defaults?.preloaded_skills) {
    return defaults.preloaded_skills;
  }

  // Finally hardcoded fallback
  return PRELOADED_SKILLS;
}

/**
 * Get the effective subcategory aliases.
 * Priority: YAML defaults > hardcoded fallback
 */
function getEffectiveSubcategoryAliases(): Record<string, string> {
  const defaults = getCachedDefaults();
  if (defaults?.subcategory_aliases) {
    return defaults.subcategory_aliases;
  }
  return SUBCATEGORY_ALIASES;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get agents that should receive a skill based on its path and category.
 *
 * Resolution priority:
 * 1. Project config agent_skills (if agentId provided and config has mapping)
 * 2. YAML defaults (if loaded)
 * 3. Hardcoded fallback
 *
 * @param skillPath - Full path to the skill (e.g., "skills/frontend/framework/react")
 * @param category - Skill category (e.g., "frontend/*" or "frontend/testing")
 * @param projectConfig - Optional project config for overrides
 * @returns Array of agent IDs that should receive this skill
 */
export function getAgentsForSkill(
  skillPath: string,
  category: string,
  projectConfig?: ProjectConfig,
): string[] {
  const normalizedPath = skillPath.replace(/^skills\//, "").replace(/\/$/, "");

  // Get effective mappings (YAML defaults or hardcoded fallback)
  const skillToAgents = getEffectiveSkillToAgents();

  // Check direct category match
  if (skillToAgents[category]) {
    return skillToAgents[category];
  }

  // Check exact path match or path prefix match
  for (const [pattern, agents] of Object.entries(skillToAgents)) {
    if (
      normalizedPath === pattern ||
      normalizedPath.startsWith(`${pattern}/`)
    ) {
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

/**
 * Check if a skill should be preloaded (embedded) for a specific agent.
 *
 * Resolution priority for preload patterns:
 * 1. Project config preload_patterns (if provided)
 * 2. YAML defaults (if loaded)
 * 3. Hardcoded fallback
 *
 * @param skillPath - Full path to the skill
 * @param skillId - Skill identifier
 * @param category - Skill category
 * @param agentId - Agent identifier
 * @param projectConfig - Optional project config for overrides
 * @returns true if skill should be preloaded for this agent
 */
export function shouldPreloadSkill(
  skillPath: string,
  skillId: string,
  category: string,
  agentId: string,
  projectConfig?: ProjectConfig,
): boolean {
  const preloadedSkills = getEffectivePreloadedSkills(projectConfig);
  const preloadedPatterns = preloadedSkills[agentId];

  if (!preloadedPatterns || preloadedPatterns.length === 0) {
    return false;
  }

  const normalizedPath = skillPath.replace(/^skills\//, "").replace(/\/$/, "");
  const subcategoryAliases = getEffectiveSubcategoryAliases();

  for (const pattern of preloadedPatterns) {
    // Category match
    if (category === pattern) {
      return true;
    }

    // Path contains pattern
    if (normalizedPath.includes(pattern)) {
      return true;
    }

    // Skill ID contains pattern (case-insensitive)
    if (skillId.toLowerCase().includes(pattern.toLowerCase())) {
      return true;
    }

    // Alias-based matching
    const aliasedPath = subcategoryAliases[pattern];
    if (aliasedPath && normalizedPath.includes(aliasedPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract the category key from a skill path.
 * Used for categorizing skills by their subdirectory.
 *
 * @param skillPath - Full path to the skill
 * @returns Category key (e.g., "framework" from "skills/frontend/framework/react")
 */
export function extractCategoryKey(skillPath: string): string {
  const normalizedPath = skillPath.replace(/^skills\//, "").replace(/\/$/, "");
  const parts = normalizedPath.split("/");
  return parts.length >= 2 ? parts[1] : parts[0];
}

/**
 * Check if project config has agent_skills overrides for a specific agent.
 *
 * @param agentId - Agent identifier
 * @param projectConfig - Project config to check
 * @returns true if config has agent_skills for this agent
 */
export function hasAgentSkillsOverride(
  agentId: string,
  projectConfig?: ProjectConfig,
): boolean {
  if (!projectConfig?.agent_skills) {
    return false;
  }
  return agentId in projectConfig.agent_skills;
}

/**
 * Check if a skill is assigned to an agent in project config.
 *
 * Handles both simple list format (SkillEntry[]) and categorized format (Record<string, SkillEntry[]>).
 * Matches by skill ID - supports both string entries and SkillAssignment objects.
 *
 * @param skillId - Skill identifier to check (e.g., "react (@vince)")
 * @param agentId - Agent identifier (e.g., "web-developer")
 * @param agentSkills - The agent_skills record from project config
 * @returns true if the skill is assigned to the agent
 */
export function isSkillAssignedToAgent(
  skillId: string,
  agentId: string,
  agentSkills: Record<string, import("../../types").AgentSkillConfig>,
): boolean {
  const agentConfig = agentSkills[agentId];
  if (!agentConfig) {
    return false;
  }

  // Helper to check if a SkillEntry matches the skillId
  const matchesSkillId = (entry: import("../../types").SkillEntry): boolean => {
    if (typeof entry === "string") {
      return entry === skillId;
    }
    // SkillAssignment has an id field
    return entry.id === skillId;
  };

  // Check if it's a simple list format (array)
  if (Array.isArray(agentConfig)) {
    return agentConfig.some(matchesSkillId);
  }

  // Categorized format: Record<string, SkillEntry[]>
  for (const categorySkills of Object.values(agentConfig)) {
    if (categorySkills.some(matchesSkillId)) {
      return true;
    }
  }

  return false;
}

/**
 * Get agents for a skill, respecting project config overrides.
 *
 * Resolution priority:
 * 1. If project config has `agent_skills`:
 *    Return only agents whose config includes this skill
 * 2. Otherwise:
 *    Use default mappings (YAML > hardcoded)
 *
 * @param skillId - Skill identifier (e.g., "react (@vince)")
 * @param skillPath - Full path to the skill (e.g., "skills/frontend/framework/react")
 * @param category - Skill category (e.g., "frontend/*" or "frontend/testing")
 * @param projectConfig - Optional project config for overrides
 * @returns Array of agent IDs that should receive this skill
 */
export function resolveAgentsForSkill(
  skillId: string,
  skillPath: string,
  category: string,
  projectConfig?: ProjectConfig,
): string[] {
  // If project config has agent_skills, use that as the source of truth
  if (projectConfig?.agent_skills) {
    const matchingAgents: string[] = [];

    for (const agentId of Object.keys(projectConfig.agent_skills)) {
      if (
        isSkillAssignedToAgent(skillId, agentId, projectConfig.agent_skills)
      ) {
        matchingAgents.push(agentId);
      }
    }

    return matchingAgents;
  }

  // Fall back to default mappings (YAML > hardcoded)
  return getAgentsForSkill(skillPath, category, projectConfig);
}
