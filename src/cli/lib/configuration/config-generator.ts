import type {
  AgentName,
  CategoryPath,
  MergedSkillsMatrix,
  ProjectConfig,
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
 * agents are needed and building the stack property (agent -> subcategory -> SkillAssignment[]).
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
  const stackProperty: Record<string, StackAgentConfig> = {};

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
        // Wizard selections are bare IDs with preloaded: false
        stackProperty[agentId][subcategory] = [{ id: skillId, preloaded: false }];
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
 * Extracts the stack property (agent -> subcategory -> SkillAssignment[]) from a Stack definition.
 *
 * Stack values are already normalized to SkillAssignment[] by loadStacks().
 * Preserves all assignments and preloaded flags for round-trip fidelity.
 *
 * @param stack - Loaded Stack definition with normalized agent configs
 * @returns Partial mapping of agent names to subcategory-skill assignment mappings
 */
export function buildStackProperty(stack: Stack): Partial<Record<AgentName, StackAgentConfig>> {
  const result: Partial<Record<AgentName, StackAgentConfig>> = {};

  for (const [agentId, agentConfig] of typedEntries<AgentName, StackAgentConfig>(stack.agents)) {
    if (!agentConfig || Object.keys(agentConfig).length === 0) {
      continue;
    }

    const resolvedMappings: StackAgentConfig = {};

    for (const [subcategoryId, assignments] of typedEntries<Subcategory, SkillAssignment[]>(
      agentConfig,
    )) {
      if (!assignments || assignments.length === 0) continue;
      resolvedMappings[subcategoryId] = assignments;
    }

    if (Object.keys(resolvedMappings).length > 0) {
      result[agentId] = resolvedMappings;
    }
  }

  return result;
}

/**
 * Compacts a ProjectConfig.stack for YAML serialization.
 * Converts SkillAssignment[] to the most compact form:
 *   - Single skill with preloaded=false -> bare string (e.g., "web-framework-react")
 *   - Single skill with preloaded=true -> object (e.g., { id: "...", preloaded: true })
 *   - Multiple skills -> array of objects/strings
 * This ensures round-trip fidelity: bare strings stay bare, rich format stays rich.
 */
export function compactStackForYaml(
  stack: Record<string, StackAgentConfig>,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};

  for (const [agentId, agentConfig] of Object.entries(stack)) {
    const compacted: Record<string, unknown> = {};

    for (const [subcategory, assignments] of typedEntries<Subcategory, SkillAssignment[]>(
      agentConfig,
    )) {
      if (!assignments || assignments.length === 0) continue;

      if (assignments.length === 1) {
        const assignment = assignments[0];
        // Single skill, no preloaded -> bare string
        if (!assignment.preloaded) {
          compacted[subcategory] = assignment.id;
        } else {
          compacted[subcategory] = { id: assignment.id, preloaded: true };
        }
      } else {
        // Multiple skills -> array, compact each element
        compacted[subcategory] = assignments.map((a) =>
          !a.preloaded ? a.id : { id: a.id, preloaded: true },
        );
      }
    }

    if (Object.keys(compacted).length > 0) {
      result[agentId] = compacted;
    }
  }

  return result;
}
