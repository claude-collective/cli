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
import { matrix } from "../matrix/matrix-provider";
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
  // TypeScript narrows CategoryPath to Category after excluding "local"
  return categoryPath;
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
  const agentList = options?.selectedAgents ? [...options.selectedAgents].sort() : [];

  verbose(
    `generateProjectConfigFromSkills: ${selectedSkillIds.length} skills, ` +
      `matrix has ${typedKeys<SkillId>(matrix.skills).length} entries, ` +
      `agents=[${agentList.join(", ")}]`,
  );

  const looked = selectedSkillIds.map((skillId) => {
    const skill = matrix.skills[skillId];
    if (!skill) warn(`Skill '${skillId}' NOT FOUND in matrix`, { suppressInTest: true });
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
      { suppressInTest: true },
    );
  }

  // Group skills by category so multiple skills in the same category all survive
  const grouped = new Map<Category, SkillAssignment[]>();
  for (const { skillId, category } of validSkills) {
    const arr = grouped.get(category) ?? [];
    arr.push({ id: skillId, preloaded: false });
    grouped.set(category, arr);
  }

  const stackProperty =
    agentList.length > 0 && grouped.size > 0
      ? Object.fromEntries(
          agentList.map((agentId) => [
            agentId,
            // Structural cast: Object.fromEntries returns Record<string, V>, narrowing to typed keys
            Object.fromEntries(grouped) as StackAgentConfig,
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
  // Structural casts: Object.fromEntries returns Record<string, V>, narrowing to typed keys
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

  // Split stack by agent partition, filtering global agents' stacks to only reference global skills.
  // Project agents keep ALL skill references (both project and global) since global skills are available everywhere.
  const globalSkillIds = new Set(globalSkills.map((s) => s.id));
  const globalStack: typeof config.stack = {};
  const projectStack: typeof config.stack = {};

  if (config.stack) {
    for (const agent of globalAgents) {
      const agentStack = config.stack[agent.name];
      if (agentStack) {
        // Split each category's assignments: global skills -> global config, project skills -> project config
        const globalFiltered: StackAgentConfig = {};
        const projectFiltered: StackAgentConfig = {};
        for (const [category, assignments] of typedEntries<Category, SkillAssignment[]>(
          agentStack,
        )) {
          if (!assignments) continue;
          const globalOnly = assignments.filter((a) => globalSkillIds.has(a.id));
          const projectOnly = assignments.filter((a) => !globalSkillIds.has(a.id));
          if (globalOnly.length > 0) {
            globalFiltered[category] = globalOnly;
          }
          if (projectOnly.length > 0) {
            projectFiltered[category] = projectOnly;
          }
        }
        if (typedKeys<Category>(globalFiltered).length > 0) {
          globalStack[agent.name] = globalFiltered;
        }
        if (typedKeys<Category>(projectFiltered).length > 0) {
          projectStack[agent.name] = projectFiltered;
        }
      }
    }
    for (const agent of projectAgents) {
      if (config.stack[agent.name]) {
        projectStack[agent.name] = config.stack[agent.name];
      }
    }
  }

  // Split selectedAgents by scope: global agents go to global config, project agents to project config
  const globalAgentNames = new Set(globalAgents.map((a) => a.name));
  const globalSelectedAgents = config.selectedAgents?.filter((a) => globalAgentNames.has(a)) ?? [];
  const projectSelectedAgents =
    config.selectedAgents?.filter((a) => !globalAgentNames.has(a)) ?? [];

  // Domains are a UI/preference concept — all selected domains go in global config.
  // Project config inherits domains from global at runtime, so it gets none.
  const globalConfig: ProjectConfig = {
    ...config,
    name: "global",
    agents: globalAgents,
    skills: globalSkills,
    ...(Object.keys(globalStack).length > 0 ? { stack: globalStack } : { stack: undefined }),
    domains: config.domains,
    selectedAgents: globalSelectedAgents.length > 0 ? globalSelectedAgents : undefined,
  };

  const projectConfig: ProjectConfig = {
    ...config,
    name: config.name,
    agents: projectAgents,
    skills: projectSkills,
    ...(Object.keys(projectStack).length > 0 ? { stack: projectStack } : { stack: undefined }),
    domains: undefined,
    selectedAgents: projectSelectedAgents.length > 0 ? projectSelectedAgents : undefined,
  };

  return { global: globalConfig, project: projectConfig };
}
