import type {
  AgentName,
  CategoryPath,
  MergedSkillsMatrix,
  ProjectConfig,
  ResolvedSubcategorySkills,
  SkillDisplayName,
  SkillId,
  Stack,
  StackAgentConfig,
  Subcategory,
} from "../types";
import { typedEntries } from "../utils/typed-object";
import { getAgentsForSkill } from "./skill-agent-mappings";

/**
 * Options for generating a ProjectConfig
 */
export type ProjectConfigOptions = {
  /** Brief description of the project */
  description?: string;
  /** Author handle */
  author?: string;
};

/**
 * Extract the subcategory from a CategoryPath.
 *
 * @example
 * "web/framework" -> "framework"
 * "framework" -> "framework"
 * "local" -> undefined (not a subcategory)
 */
function extractSubcategory(categoryPath: CategoryPath): Subcategory | undefined {
  if (categoryPath === "local") return undefined;
  const parts = categoryPath.split("/");
  // Boundary cast: the last segment of a CategoryPath is always a valid Subcategory
  return (parts.length >= 2 ? parts[1] : parts[0]) as Subcategory;
}

/**
 * Generate a minimal ProjectConfig from selected skills.
 * Returns a config with just the essentials:
 * - name
 * - stack (agent->subcategory->skillId mappings derived via getAgentsForSkill)
 * - agents array (derived from skills via getAgentsForSkill)
 */
export function generateProjectConfigFromSkills(
  name: string,
  selectedSkillIds: SkillId[],
  matrix: MergedSkillsMatrix,
  options?: ProjectConfigOptions,
): ProjectConfig {
  const neededAgents = new Set<AgentName>();
  const stackProperty: Record<string, ResolvedSubcategorySkills> = {};

  // Derive agents from skills and build stack property
  for (const skillId of selectedSkillIds) {
    const skill = matrix.skills[skillId];
    if (!skill) {
      continue;
    }

    const skillPath = skill.path;
    const category = skill.category;
    const agents = getAgentsForSkill(skillPath, category);
    const subcategory = extractSubcategory(category);

    for (const agentId of agents) {
      neededAgents.add(agentId);

      // Build stack: agent -> subcategory -> skillId
      if (subcategory) {
        if (!stackProperty[agentId]) {
          stackProperty[agentId] = {};
        }
        stackProperty[agentId][subcategory] = skillId;
      }
    }
  }

  // Build minimal config
  const config: ProjectConfig = {
    name,
    agents: Array.from(neededAgents).sort(),
  };

  // Only include stack if there are any mappings
  if (Object.keys(stackProperty).length > 0) {
    config.stack = stackProperty;
  }

  // Add optional fields only if provided
  if (options?.description) {
    config.description = options.description;
  }

  if (options?.author) {
    config.author = options.author;
  }

  return config;
}

/**
 * Build resolved stack property for ProjectConfig.
 * Maps each agent to its subcategory->skill ID mappings.
 *
 * @param stack - The Stack with agent technology mappings (display names)
 * @param displayNameToId - Display name -> skill ID mappings from skills-matrix.yaml
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
  displayNameToId: Partial<Record<SkillDisplayName, SkillId>>,
): Partial<Record<AgentName, ResolvedSubcategorySkills>> {
  const result: Partial<Record<AgentName, ResolvedSubcategorySkills>> = {};

  for (const [agentId, agentConfig] of typedEntries<AgentName, StackAgentConfig>(stack.agents)) {
    // Skip agents with empty config
    if (!agentConfig || Object.keys(agentConfig).length === 0) {
      continue;
    }

    const resolvedMappings: ResolvedSubcategorySkills = {};

    for (const [subcategoryId, displayName] of typedEntries<Subcategory, SkillDisplayName>(
      agentConfig,
    )) {
      if (!displayName) continue;
      // Resolve display name to full skill ID using skill_aliases from matrix
      const skillId = displayNameToId[displayName];
      if (skillId) {
        resolvedMappings[subcategoryId] = skillId;
      } else {
        // Boundary cast: display name not found in lookup, assumed to be a full skill ID already
        resolvedMappings[subcategoryId] = displayName as unknown as SkillId;
      }
    }

    // Only add agent if it has resolved mappings
    if (Object.keys(resolvedMappings).length > 0) {
      result[agentId] = resolvedMappings;
    }
  }

  return result;
}
