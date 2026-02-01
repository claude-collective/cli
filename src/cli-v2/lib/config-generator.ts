import type {
  StackConfig,
  SkillAssignment,
  ProjectConfig,
  SkillEntry,
  AgentSkillConfig,
} from "../../types";
import type { MergedSkillsMatrix } from "../types-matrix";
import type { Stack, StackAgentConfig } from "../types-stacks";
import {
  getAgentsForSkill,
  shouldPreloadSkill,
  extractCategoryKey,
} from "./skill-agent-mappings";
import { DEFAULT_VERSION } from "../consts";

const PLUGIN_NAME = "claude-collective";
const DEFAULT_AUTHOR = "@user";

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

export function generateConfigFromSkills(
  selectedSkillIds: string[],
  matrix: MergedSkillsMatrix,
): StackConfig {
  const agentSkills: Record<string, Record<string, SkillAssignment[]>> = {};
  const neededAgents = new Set<string>();

  for (const skillId of selectedSkillIds) {
    const skill = matrix.skills[skillId];
    if (!skill) {
      continue;
    }

    const skillPath = skill.path;
    const category = skill.category;
    const agents = getAgentsForSkill(skillPath, category);
    const categoryKey = extractCategoryKey(skillPath);

    for (const agentId of agents) {
      neededAgents.add(agentId);

      if (!agentSkills[agentId]) {
        agentSkills[agentId] = {};
      }

      if (!agentSkills[agentId][categoryKey]) {
        agentSkills[agentId][categoryKey] = [];
      }

      const isPreloaded = shouldPreloadSkill(
        skillPath,
        skillId,
        category,
        agentId,
      );

      const assignment: SkillAssignment = { id: skillId };
      if (isPreloaded) {
        assignment.preloaded = true;
      }

      agentSkills[agentId][categoryKey].push(assignment);
    }
  }

  const skills: SkillAssignment[] = selectedSkillIds.map((id) => {
    const skill = matrix.skills[id];
    if (skill?.local && skill?.localPath) {
      return {
        id,
        local: true,
        path: skill.localPath,
      };
    }
    return { id };
  });

  const config: StackConfig = {
    name: PLUGIN_NAME,
    version: DEFAULT_VERSION,
    author: DEFAULT_AUTHOR,
    description: `Custom plugin with ${selectedSkillIds.length} skills`,
    skills,
    agents: Array.from(neededAgents).sort(),
    agent_skills: agentSkills,
  };

  return config;
}

export function generateConfigFromStack(stackConfig: StackConfig): StackConfig {
  return {
    name: PLUGIN_NAME,
    version: stackConfig.version || DEFAULT_VERSION,
    author: stackConfig.author || DEFAULT_AUTHOR,
    description: stackConfig.description,
    framework: stackConfig.framework,
    skills: stackConfig.skills,
    agents: stackConfig.agents,
    agent_skills: stackConfig.agent_skills,
    hooks: stackConfig.hooks,
    philosophy: stackConfig.philosophy,
    principles: stackConfig.principles,
    tags: stackConfig.tags,
  };
}

export function mergeStackWithSkills(
  baseStackConfig: StackConfig,
  selectedSkillIds: string[],
  matrix: MergedSkillsMatrix,
): StackConfig {
  const baseSkillIds = new Set(baseStackConfig.skills.map((s) => s.id));
  const selectedSet = new Set(selectedSkillIds);
  const addedSkills = selectedSkillIds.filter((id) => !baseSkillIds.has(id));
  const removedSkills = [...baseSkillIds].filter((id) => !selectedSet.has(id));

  if (addedSkills.length === 0 && removedSkills.length === 0) {
    return generateConfigFromStack(baseStackConfig);
  }

  const config = generateConfigFromStack(baseStackConfig);

  config.skills = selectedSkillIds.map((id) => {
    const skill = matrix.skills[id];
    if (skill?.local && skill?.localPath) {
      return {
        id,
        local: true,
        path: skill.localPath,
      };
    }
    return { id };
  });

  if (addedSkills.length > 0 && config.agent_skills) {
    for (const skillId of addedSkills) {
      const skill = matrix.skills[skillId];
      if (!skill) continue;

      const skillPath = skill.path;
      const category = skill.category;
      const categoryKey = extractCategoryKey(skillPath);
      const agents = getAgentsForSkill(skillPath, category);

      for (const agentId of agents) {
        if (!config.agent_skills[agentId]) {
          config.agent_skills[agentId] = {};
        }
        if (!config.agent_skills[agentId][categoryKey]) {
          config.agent_skills[agentId][categoryKey] = [];
        }

        const isPreloaded = shouldPreloadSkill(
          skillPath,
          skillId,
          category,
          agentId,
        );
        const assignment: SkillAssignment = { id: skillId };
        if (isPreloaded) {
          assignment.preloaded = true;
        }

        config.agent_skills[agentId][categoryKey].push(assignment);
      }
    }
  }

  if (removedSkills.length > 0 && config.agent_skills) {
    const removedSet = new Set(removedSkills);
    for (const agentId of Object.keys(config.agent_skills)) {
      for (const categoryKey of Object.keys(config.agent_skills[agentId])) {
        config.agent_skills[agentId][categoryKey] = config.agent_skills[
          agentId
        ][categoryKey].filter((s) => !removedSet.has(s.id));

        if (config.agent_skills[agentId][categoryKey].length === 0) {
          delete config.agent_skills[agentId][categoryKey];
        }
      }

      if (Object.keys(config.agent_skills[agentId]).length === 0) {
        delete config.agent_skills[agentId];
      }
    }
  }

  config.description = `Custom plugin based on ${baseStackConfig.name} with ${selectedSkillIds.length} skills`;

  return config;
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

  // Build minimal skills array
  const skills: SkillEntry[] = selectedSkillIds.map((id) => {
    const skill = matrix.skills[id];
    if (skill?.local && skill?.localPath) {
      return {
        id,
        local: true,
        path: skill.localPath,
      };
    }
    // For remote skills, just use string ID (minimal format)
    return id;
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
    const agentSkills = buildAgentSkills(
      selectedSkillIds,
      matrix,
      neededAgents,
    );
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

      const isPreloaded = shouldPreloadSkill(
        skillPath,
        skillId,
        category,
        agentId,
      );

      // Use minimal format: string for non-preloaded, object only if preloaded
      if (isPreloaded) {
        agentSkills[agentId].push({ id: skillId, preloaded: true });
      } else {
        agentSkills[agentId].push(skillId);
      }
    }
  }

  return agentSkills;
}

/**
 * Generate a ProjectConfig from an existing StackConfig.
 * Converts legacy StackConfig format to new ProjectConfig format.
 */
export function generateProjectConfigFromStack(
  stackConfig: StackConfig,
): ProjectConfig {
  const config: ProjectConfig = {
    name: stackConfig.name,
    agents: stackConfig.agents,
  };

  // Convert skills array to SkillEntry[] format
  if (stackConfig.skills && stackConfig.skills.length > 0) {
    config.skills = stackConfig.skills.map((skill) => {
      // If skill has local flag, preserve full object
      if (skill.local && skill.path) {
        return {
          id: skill.id,
          local: true,
          path: skill.path,
        };
      }
      // If skill has preloaded flag, preserve object format
      if (skill.preloaded) {
        return {
          id: skill.id,
          preloaded: true,
        };
      }
      // Otherwise, use minimal string format
      return skill.id;
    });
  }

  // Copy optional fields only if present
  if (stackConfig.description) {
    config.description = stackConfig.description;
  }

  if (stackConfig.framework) {
    config.framework = stackConfig.framework;
  }

  if (stackConfig.author) {
    config.author = stackConfig.author;
  }

  // Convert agent_skills (StackConfig uses categorized format)
  if (stackConfig.agent_skills) {
    // Keep the categorized format as-is for ProjectConfig
    // (ProjectConfig supports both simple list and categorized)
    config.agent_skills = stackConfig.agent_skills;
  }

  if (stackConfig.hooks) {
    config.hooks = stackConfig.hooks;
  }

  if (stackConfig.philosophy) {
    config.philosophy = stackConfig.philosophy;
  }

  if (stackConfig.principles && stackConfig.principles.length > 0) {
    config.principles = stackConfig.principles;
  }

  if (stackConfig.tags && stackConfig.tags.length > 0) {
    config.tags = stackConfig.tags;
  }

  return config;
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
 *     framework: web/framework/react (@vince)
 *     styling: web/styling/scss-modules (@vince)
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

    for (const [subcategoryId, alias] of Object.entries(
      agentConfig as StackAgentConfig,
    )) {
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
