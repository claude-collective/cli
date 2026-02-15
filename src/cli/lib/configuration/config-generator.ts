import type {
  AgentName,
  CategoryPath,
  MergedSkillsMatrix,
  ProjectConfig,
  ResolvedSubcategorySkills,
  SkillAssignment,
  SkillId,
  Stack,
  StackAgentConfig,
  Subcategory,
} from "../../types";
import { typedEntries } from "../../utils/typed-object";
import { getAgentsForSkill } from "../skills";

export type ProjectConfigOptions = {
  description?: string;
  author?: string;
};

function extractSubcategoryFromPath(categoryPath: CategoryPath): Subcategory | undefined {
  if (categoryPath === "local") return undefined;
  const parts = categoryPath.split("/");
  // Boundary cast: the last segment of a CategoryPath is always a valid Subcategory
  return (parts.length >= 2 ? parts[1] : parts[0]) as Subcategory;
}

/**
 * Generates a ProjectConfig from a list of selected skill IDs by resolving which
 * agents are needed and building the stack property (agent -> subcategory -> skillId).
 *
 * For each selected skill, looks up its category and determines which agents
 * should receive it (via `getAgentsForSkill`). The resulting config includes
 * the deduplicated sorted agent list, full skill list, and optional stack
 * mappings for subcategory-based skill resolution during compilation.
 *
 * @param name - Project name for the config
 * @param selectedSkillIds - Skill IDs selected by the user in the wizard
 * @param matrix - Merged skills matrix (used to look up skill metadata)
 * @param options - Optional description and author fields
 * @returns Complete ProjectConfig ready to be saved to config.yaml
 */
export function generateProjectConfigFromSkills(
  name: string,
  selectedSkillIds: SkillId[],
  matrix: MergedSkillsMatrix,
  options?: ProjectConfigOptions,
): ProjectConfig {
  const neededAgents = new Set<AgentName>();
  const stackProperty: Record<string, ResolvedSubcategorySkills> = {};

  for (const skillId of selectedSkillIds) {
    const skill = matrix.skills[skillId];
    if (!skill) {
      continue;
    }

    const skillPath = skill.path;
    const category = skill.category;
    const agents = getAgentsForSkill(skillPath, category);
    const subcategory = extractSubcategoryFromPath(category);

    for (const agentId of agents) {
      neededAgents.add(agentId);

      if (subcategory) {
        if (!stackProperty[agentId]) {
          stackProperty[agentId] = {};
        }
        stackProperty[agentId][subcategory] = skillId;
      }
    }
  }

  const config: ProjectConfig = {
    name,
    agents: Array.from(neededAgents).sort(),
    skills: [...selectedSkillIds],
  };

  if (Object.keys(stackProperty).length > 0) {
    config.stack = stackProperty;
  }

  if (options?.description) {
    config.description = options.description;
  }

  if (options?.author) {
    config.author = options.author;
  }

  return config;
}

/**
 * Extracts the stack property (agent -> subcategory -> skillId) from a Stack definition.
 *
 * Stack values are already normalized to SkillAssignment[] by loadStacks(). This function
 * takes the first skill ID per subcategory since ResolvedSubcategorySkills only holds one.
 * All skills are still preserved in ProjectConfig.skills via resolveAgentConfigToSkills.
 *
 * @param stack - Loaded Stack definition with normalized agent configs
 * @returns Partial mapping of agent names to subcategory-skill mappings
 */
export function buildStackProperty(
  stack: Stack,
): Partial<Record<AgentName, ResolvedSubcategorySkills>> {
  const result: Partial<Record<AgentName, ResolvedSubcategorySkills>> = {};

  for (const [agentId, agentConfig] of typedEntries<AgentName, StackAgentConfig>(stack.agents)) {
    if (!agentConfig || Object.keys(agentConfig).length === 0) {
      continue;
    }

    const resolvedMappings: ResolvedSubcategorySkills = {};

    for (const [subcategoryId, assignments] of typedEntries<Subcategory, SkillAssignment[]>(
      agentConfig,
    )) {
      if (!assignments) continue;
      // Take the first skill ID — ResolvedSubcategorySkills holds one per subcategory
      resolvedMappings[subcategoryId] = assignments[0]?.id;
    }

    if (Object.keys(resolvedMappings).length > 0) {
      result[agentId] = resolvedMappings;
    }
  }

  return result;
}
