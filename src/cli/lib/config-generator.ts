import type { ProjectConfig, SkillEntry, AgentSkillConfig } from "../../types";
import type { AgentName, MergedSkillsMatrix, SkillId } from "../types-matrix";
import type { Stack, StackAgentConfig } from "../types-stacks";
import { getAgentsForSkill, shouldPreloadSkill } from "./skill-agent-mappings";

/**
 * Options for generating a ProjectConfig
 */
export interface ProjectConfigOptions {
  /** Brief description of the project */
  description?: string;
  /** Framework hint for agent behavior */
  framework?: string;
  /** Author handle */
  author?: string;
  /** Include agent_skills customizations (default: false - use defaults) */
  includeAgentSkills?: boolean;
}

/**
 * Generate a minimal ProjectConfig from selected skills.
 * Returns a config with just the essentials:
 * - name
 * - skills array (string IDs for remote, objects for local)
 * - agents array (derived from skills via getAgentsForSkill)
 * - Optionally agent_skills if includeAgentSkills is true
 *
 * Does NOT include preload_patterns (rely on defaults)
 */
export function generateProjectConfigFromSkills(
  name: string,
  selectedSkillIds: string[],
  matrix: MergedSkillsMatrix,
  options?: ProjectConfigOptions,
): ProjectConfig {
  const neededAgents = new Set<string>();

  // Derive agents from skills
  for (const skillId of selectedSkillIds) {
    const skill = matrix.skills[skillId];
    if (!skill) {
      continue;
    }

    const skillPath = skill.path;
    const category = skill.category;
    const agents = getAgentsForSkill(skillPath, category);

    for (const agentId of agents) {
      neededAgents.add(agentId);
    }
  }

  // Build minimal skills array (selectedSkillIds are data boundary from wizard)
  const skills: SkillEntry[] = selectedSkillIds.map((id) => {
    const skillId = id as SkillId;
    const skill = matrix.skills[id];
    if (skill?.local && skill?.localPath) {
      return {
        id: skillId,
        local: true as const,
        path: skill.localPath,
      };
    }
    // For remote skills, just use string ID (minimal format)
    return skillId;
  });

  // Build minimal config
  const config: ProjectConfig = {
    name,
    agents: Array.from(neededAgents).sort(),
  };

  // Only include skills if there are any
  if (skills.length > 0) {
    config.skills = skills;
  }

  // Add optional fields only if provided
  if (options?.description) {
    config.description = options.description;
  }

  if (options?.framework) {
    config.framework = options.framework;
  }

  if (options?.author) {
    config.author = options.author;
  }

  // Only include agent_skills if explicitly requested
  if (options?.includeAgentSkills) {
    const agentSkills = buildAgentSkills(selectedSkillIds, matrix, neededAgents);
    if (Object.keys(agentSkills).length > 0) {
      config.agent_skills = agentSkills;
    }
  }

  return config;
}

/**
 * Build agent_skills mapping for ProjectConfig.
 * Uses simple list format for each agent (not categorized).
 */
function buildAgentSkills(
  selectedSkillIds: string[],
  matrix: MergedSkillsMatrix,
  neededAgents: Set<string>,
): Record<string, AgentSkillConfig> {
  const agentSkills: Record<string, SkillEntry[]> = {};

  for (const skillId of selectedSkillIds) {
    const skill = matrix.skills[skillId];
    if (!skill) {
      continue;
    }

    const skillPath = skill.path;
    const category = skill.category;
    const agents = getAgentsForSkill(skillPath, category);

    for (const agentId of agents) {
      if (!neededAgents.has(agentId)) continue;

      if (!agentSkills[agentId]) {
        agentSkills[agentId] = [];
      }

      const typedSkillId = skillId as SkillId;
      const isPreloaded = shouldPreloadSkill(
        skillPath,
        typedSkillId,
        category,
        agentId as AgentName,
      );

      // Use minimal format: string for non-preloaded, object only if preloaded
      if (isPreloaded) {
        agentSkills[agentId].push({ id: typedSkillId, preloaded: true });
      } else {
        agentSkills[agentId].push(typedSkillId);
      }
    }
  }

  return agentSkills;
}

/**
 * Build resolved stack property for ProjectConfig.
 * Maps each agent to its subcategory->skill ID mappings.
 *
 * @param stack - The Stack with agent technology mappings
 * @param skillAliases - Alias->skill ID mappings from skills-matrix.yaml
 * @returns Record<agentId, Record<subcategoryId, skillId>>
 *
 * @example
 * Input stack.agents:
 *   web-developer:
 *     framework: react
 *     styling: scss-modules
 *
 * Output:
 *   web-developer:
 *     framework: web-framework-react
 *     styling: web-styling-scss-modules
 */
export function buildStackProperty(
  stack: Stack,
  skillAliases: Record<string, string>,
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};

  for (const [agentId, agentConfig] of Object.entries(stack.agents)) {
    // Skip agents with empty config
    if (!agentConfig || Object.keys(agentConfig).length === 0) {
      continue;
    }

    const resolvedMappings: Record<string, string> = {};

    for (const [subcategoryId, alias] of Object.entries(agentConfig as StackAgentConfig)) {
      // Resolve alias to full skill ID using skill_aliases from matrix
      const skillId = skillAliases[alias];
      if (skillId) {
        resolvedMappings[subcategoryId] = skillId;
      } else {
        // If alias not found, use the alias as-is (might be a full skill ID already)
        resolvedMappings[subcategoryId] = alias;
      }
    }

    // Only add agent if it has resolved mappings
    if (Object.keys(resolvedMappings).length > 0) {
      result[agentId] = resolvedMappings;
    }
  }

  return result;
}
