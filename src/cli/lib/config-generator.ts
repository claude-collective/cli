import type { StackConfig, SkillAssignment } from "../../types";
import type { ResolvedSkill, MergedSkillsMatrix } from "../types-matrix";
import {
  getAgentsForSkill,
  shouldPreloadSkill,
  extractCategoryKey,
} from "./skill-agent-mappings";
import { DEFAULT_VERSION } from "../consts";

const PLUGIN_NAME = "claude-collective";
const DEFAULT_AUTHOR = "@user";

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
