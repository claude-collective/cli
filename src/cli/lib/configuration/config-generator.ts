import type {
  AgentName,
  CategoryPath,
  ProjectConfig,
  SkillAssignment,
  SkillId,
  Stack,
  StackAgentConfig,
  Category,
} from "../../types";
import type { AgentScopeConfig, SkillConfig } from "../../types/config";
import { getMatrix } from "../../stores/matrix-store";
import { verbose, warn } from "../../utils/logger";
import { typedEntries, typedKeys } from "../../utils/typed-object";

export type SplitConfigResult = {
  global: ProjectConfig;
  project: ProjectConfig;
};

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
 * @param options - Optional description, author, selectedAgents, and skillConfigs fields.
 *                  When skillConfigs is provided, it is used directly as `skills` in the config.
 *                  Otherwise, SkillConfig entries are synthesized from selectedSkillIds with defaults.
 * @returns Complete ProjectConfig ready to be saved to config.ts
 */
export function generateProjectConfigFromSkills(
  name: string,
  selectedSkillIds: SkillId[],
  options?: ProjectConfigOptions & {
    selectedAgents?: AgentName[];
    skillConfigs?: SkillConfig[];
    agentConfigs?: AgentScopeConfig[];
  },
): ProjectConfig {
  const matrix = getMatrix();
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

  const agentConfigs: AgentScopeConfig[] = options?.agentConfigs
    ? agentList.map((agentName) => {
        const provided = options.agentConfigs!.find((ac) => ac.name === agentName);
        return provided ?? { name: agentName, scope: "project" as const };
      })
    : agentList.map((agentName) => ({ name: agentName, scope: "project" as const }));

  return {
    name,
    agents: agentConfigs,
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

/**
 * Splits a ProjectConfig by scope into global and project partitions.
 * Skills with `scope: "global"` go to the global partition, `scope: "project"` to the project partition.
 * Agents are split based on which skills reference them in the stack.
 * Domains are preserved in both configs as-is (the project config extends global at runtime).
 */
export function splitConfigByScope(config: ProjectConfig): SplitConfigResult {
  const globalSkills = config.skills.filter((s) => s.scope === "global");
  const projectSkills = config.skills.filter((s) => s.scope === "project");

  // Split agents by their explicit scope (mirrors skill scope pattern)
  const globalAgents = config.agents.filter((a) => a.scope === "global");
  const projectAgents = config.agents.filter((a) => a.scope === "project");

  // Split stack by agent partition
  const globalStack: typeof config.stack = {};
  const projectStack: typeof config.stack = {};

  if (config.stack) {
    for (const agent of globalAgents) {
      if (config.stack[agent.name]) {
        globalStack[agent.name] = config.stack[agent.name];
      }
    }
    for (const agent of projectAgents) {
      if (config.stack[agent.name]) {
        projectStack[agent.name] = config.stack[agent.name];
      }
    }
  }

  const globalConfig: ProjectConfig = {
    name: "global",
    agents: globalAgents,
    skills: globalSkills,
    ...(Object.keys(globalStack).length > 0 && { stack: globalStack }),
    ...(config.domains && config.domains.length > 0 && { domains: config.domains }),
  };

  const projectConfig: ProjectConfig = {
    name: config.name,
    agents: projectAgents,
    skills: projectSkills,
    ...(Object.keys(projectStack).length > 0 && { stack: projectStack }),
    ...(config.description && { description: config.description }),
    ...(config.author && { author: config.author }),
    ...(config.source && { source: config.source }),
    ...(config.marketplace && { marketplace: config.marketplace }),
    ...(config.agentsSource && { agentsSource: config.agentsSource }),
    ...(config.domains && config.domains.length > 0 && { domains: config.domains }),
    ...(config.selectedAgents &&
      config.selectedAgents.length > 0 && { selectedAgents: config.selectedAgents }),
  };

  return { global: globalConfig, project: projectConfig };
}
