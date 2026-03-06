import type {
  AgentName,
  CategoryPath,
  MergedSkillsMatrix,
  ProjectConfig,
  SkillAssignment,
  SkillId,
  Stack,
  StackAgentConfig,
  Category,
} from "../../types";
import type { SkillConfig } from "../../types/config";
import { verbose, warn } from "../../utils/logger";
import { typedEntries, typedKeys } from "../../utils/typed-object";

export type ProjectConfigOptions = {
  description?: string;
  author?: string;
};

function extractCategoryFromPath(categoryPath: CategoryPath): Category | undefined {
  if (categoryPath === "local") return undefined;
  return categoryPath as Category;
}

/**
 * Generates a ProjectConfig from a list of selected skill IDs by building the
 * stack property (agent -> category -> SkillAssignment[]).
 *
 * Every selected skill is assigned to every selected agent. When no agents are
 * provided, the agents list is empty (the wizard always provides selectedAgents
 * via the agents step).
 *
 * @param name - Project name for the config
 * @param selectedSkillIds - Skill IDs selected by the user in the wizard
 * @param matrix - Merged skills matrix (used to look up skill metadata)
 * @param options - Optional description, author, selectedAgents, and skillConfigs fields.
 *                  When skillConfigs is provided, it is used directly as `skills` in the config.
 *                  Otherwise, SkillConfig entries are synthesized from selectedSkillIds with defaults.
 * @returns Complete ProjectConfig ready to be saved to config.ts
 */
export function generateProjectConfigFromSkills(
  name: string,
  selectedSkillIds: SkillId[],
  matrix: MergedSkillsMatrix,
  options?: ProjectConfigOptions & { selectedAgents?: AgentName[]; skillConfigs?: SkillConfig[] },
): ProjectConfig {
  const agentList = options?.selectedAgents ? [...options.selectedAgents].sort() : [];

  verbose(
    `generateProjectConfigFromSkills: ${selectedSkillIds.length} skills, ` +
      `matrix has ${typedKeys<SkillId>(matrix.skills).length} entries, ` +
      `agents=[${agentList.join(", ")}]`,
  );

  const looked = selectedSkillIds.map((skillId) => {
    const skill = matrix.skills[skillId];
    if (!skill) warn(`Skill '${skillId}' NOT FOUND in matrix`);
    return { skillId, skill };
  });

  const found = looked.filter(
    (entry): entry is typeof entry & { skill: NonNullable<typeof entry.skill> } =>
      entry.skill != null,
  );
  const skippedCount = looked.length - found.length;

  const validSkills = found
    .map(({ skillId, skill }) => ({
      skillId,
      category: extractCategoryFromPath(skill.category),
    }))
    .filter((entry): entry is typeof entry & { category: Category } => entry.category != null);

  verbose(
    `generateProjectConfigFromSkills: ${found.length} found, ${skippedCount} not found, ` +
      `${agentList.length} agents in stack`,
  );

  if (skippedCount > 0) {
    const matrixSample = typedKeys<SkillId>(matrix.skills).slice(0, 5).join(", ");
    warn(
      `${skippedCount}/${selectedSkillIds.length} skills not found in matrix. ` +
        `Matrix keys sample: [${matrixSample}]`,
    );
  }

  const stackProperty =
    agentList.length > 0 && validSkills.length > 0
      ? Object.fromEntries(
          agentList.map((agentId) => [
            agentId,
            Object.fromEntries(
              validSkills.map(({ skillId, category }) => [
                category,
                [{ id: skillId, preloaded: false }],
              ]),
            ) as StackAgentConfig,
          ]),
        )
      : undefined;

  const skills: SkillConfig[] =
    options?.skillConfigs ??
    selectedSkillIds.map((id) => ({ id, scope: "project" as const, source: "local" }));

  return {
    name,
    agents: agentList,
    skills,
    ...(stackProperty && { stack: stackProperty }),
    ...(options?.description && { description: options.description }),
    ...(options?.author && { author: options.author }),
  };
}

/**
 * Extracts the stack property (agent -> category -> SkillAssignment[]) from a Stack definition.
 *
 * Stack values are already normalized to SkillAssignment[] by loadStacks().
 * Preserves all assignments and preloaded flags for round-trip fidelity.
 *
 * @param stack - Loaded Stack definition with normalized agent configs
 * @returns Partial mapping of agent names to category-skill assignment mappings
 */
export function buildStackProperty(stack: Stack): Partial<Record<AgentName, StackAgentConfig>> {
  return Object.fromEntries(
    typedEntries<AgentName, StackAgentConfig>(stack.agents)
      .filter(([, agentConfig]) => agentConfig && typedKeys<Category>(agentConfig).length > 0)
      .map(([agentId, agentConfig]) => {
        const resolvedMappings = Object.fromEntries(
          typedEntries<Category, SkillAssignment[]>(agentConfig).filter(
            ([, assignments]) => assignments && assignments.length > 0,
          ),
        ) as StackAgentConfig;
        return [agentId, resolvedMappings] as const;
      })
      .filter(([, mappings]) => typedKeys<Category>(mappings).length > 0),
  ) as Partial<Record<AgentName, StackAgentConfig>>;
}

/**
 * Compacts a ProjectConfig.stack for YAML serialization.
 * Converts SkillAssignment[] to the most compact form:
 *   - Single skill with preloaded=false -> bare string (e.g., "web-framework-react")
 *   - Single skill with preloaded=true -> object (e.g., { id: "...", preloaded: true })
 *   - Multiple skills -> array of objects/strings
 * This ensures round-trip fidelity: bare strings stay bare, rich format stays rich.
 */
function compactAssignment(assignment: SkillAssignment): unknown {
  return assignment.preloaded ? { id: assignment.id, preloaded: true } : assignment.id;
}

export function compactStackForYaml(
  stack: Partial<Record<AgentName, StackAgentConfig>>,
): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    typedEntries<AgentName, StackAgentConfig>(stack)
      .map(([agentId, agentConfig]) => {
        const compacted = Object.fromEntries(
          typedEntries<Category, SkillAssignment[]>(agentConfig)
            .filter(([, assignments]) => assignments && assignments.length > 0)
            .map(([category, assignments]) => [
              category,
              assignments.length === 1
                ? compactAssignment(assignments[0])
                : assignments.map(compactAssignment),
            ]),
        );
        return [agentId, compacted] as const;
      })
      .filter(([, compacted]) => Object.keys(compacted).length > 0),
  );
}
