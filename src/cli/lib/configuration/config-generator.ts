import type {
  AgentName,
  CategoryPath,
  Domain,
  MergedSkillsMatrix,
  ProjectConfig,
  SkillAssignment,
  SkillId,
  Stack,
  StackAgentConfig,
  Subcategory,
} from "../../types";
import type { ConfigDomainElement, ConfigSkillElement } from "../schemas";
import { DOMAIN_VALUES, SKILL_ID_PATTERN, SUBCATEGORY_VALUES } from "../schemas";
import { verbose, warn } from "../../utils/logger";
import { typedEntries } from "../../utils/typed-object";

/** Normalizes a mixed skills array (strings + { id, custom } objects) to flat SkillId[] */
export function normalizeSkillsList(skills: ConfigSkillElement[]): SkillId[] {
  return skills.map((s) => (typeof s === "string" ? s : s.id));
}

/** Normalizes a mixed domains array (strings + { id, custom } objects) to flat Domain[] */
export function normalizeDomainsList(domains: ConfigDomainElement[]): Domain[] {
  return domains.map((d) => (typeof d === "string" ? d : d.id));
}

export type ProjectConfigOptions = {
  description?: string;
  author?: string;
};

function extractSubcategoryFromPath(categoryPath: CategoryPath): Subcategory | undefined {
  if (categoryPath === "local") return undefined;
  return categoryPath as Subcategory;
}

/**
 * Generates a ProjectConfig from a list of selected skill IDs by building the
 * stack property (agent -> subcategory -> SkillAssignment[]).
 *
 * Every selected skill is assigned to every selected agent. When no agents are
 * provided, the agents list is empty (the wizard always provides selectedAgents
 * via the agents step).
 *
 * @param name - Project name for the config
 * @param selectedSkillIds - Skill IDs selected by the user in the wizard
 * @param matrix - Merged skills matrix (used to look up skill metadata)
 * @param options - Optional description, author, and selectedAgents fields
 * @returns Complete ProjectConfig ready to be saved to config.yaml
 */
export function generateProjectConfigFromSkills(
  name: string,
  selectedSkillIds: SkillId[],
  matrix: MergedSkillsMatrix,
  options?: ProjectConfigOptions & { selectedAgents?: AgentName[] },
): ProjectConfig {
  const agentList = options?.selectedAgents ? [...options.selectedAgents].sort() : [];
  const stackProperty: Record<string, StackAgentConfig> = {};

  verbose(
    `generateProjectConfigFromSkills: ${selectedSkillIds.length} skills, ` +
      `matrix has ${Object.keys(matrix.skills).length} entries, ` +
      `agents=[${agentList.join(", ")}]`,
  );

  let foundCount = 0;
  let skippedCount = 0;

  for (const skillId of selectedSkillIds) {
    const skill = matrix.skills[skillId];
    if (!skill) {
      skippedCount++;
      warn(`Skill '${skillId}' NOT FOUND in matrix`);
      continue;
    }
    foundCount++;

    const subcategory = extractSubcategoryFromPath(skill.category);
    if (!subcategory) continue;

    for (const agentId of agentList) {
      if (!stackProperty[agentId]) {
        stackProperty[agentId] = {};
      }
      stackProperty[agentId][subcategory] = [{ id: skillId, preloaded: false }];
    }
  }

  verbose(
    `generateProjectConfigFromSkills: ${foundCount} found, ${skippedCount} not found, ` +
      `${Object.keys(stackProperty).length} agents in stack`,
  );

  if (skippedCount > 0) {
    const matrixSample = Object.keys(matrix.skills).slice(0, 5).join(", ");
    warn(
      `${skippedCount}/${selectedSkillIds.length} skills not found in matrix. ` +
        `Matrix keys sample: [${matrixSample}]`,
    );
  }

  const config: ProjectConfig = {
    name,
    agents: agentList,
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
  const KNOWN_SUBCATEGORIES = new Set<string>(SUBCATEGORY_VALUES);
  const result: Record<string, Record<string, unknown>> = {};

  for (const [agentId, agentConfig] of Object.entries(stack)) {
    const compacted: Record<string, unknown> = {};

    for (const [subcategory, assignments] of typedEntries<Subcategory, SkillAssignment[]>(
      agentConfig,
    )) {
      if (!assignments || assignments.length === 0) continue;

      const isCustomSubcategory = !KNOWN_SUBCATEGORIES.has(subcategory);

      if (assignments.length === 1) {
        const assignment = assignments[0];
        const isCustomSkill = !SKILL_ID_PATTERN.test(assignment.id);
        const needsCustomFlag = isCustomSkill || isCustomSubcategory;

        if (!assignment.preloaded && !needsCustomFlag) {
          compacted[subcategory] = assignment.id;
        } else {
          compacted[subcategory] = {
            id: assignment.id,
            ...(assignment.preloaded && { preloaded: true }),
            ...(needsCustomFlag && { custom: true as const }),
          };
        }
      } else {
        let customFlagPlaced = false;
        compacted[subcategory] = assignments.map((a) => {
          const isCustomSkill = !SKILL_ID_PATTERN.test(a.id);
          const needsCustom = isCustomSkill || (isCustomSubcategory && !customFlagPlaced);
          if (needsCustom) customFlagPlaced = true;

          if (!a.preloaded && !needsCustom) return a.id;
          return {
            id: a.id,
            ...(a.preloaded && { preloaded: true }),
            ...(needsCustom && { custom: true as const }),
          };
        });
      }
    }

    if (Object.keys(compacted).length > 0) {
      result[agentId] = compacted;
    }
  }

  return result;
}

/**
 * Compacts a ProjectConfig.skills array for YAML serialization.
 * Standard skill IDs (matching SKILL_ID_PATTERN) stay as bare strings;
 * non-standard IDs (custom skills) become { id, custom: true } objects.
 */
export function compactSkillsForYaml(
  skills: SkillId[],
): (SkillId | { id: SkillId; custom: true })[] {
  return skills.map((id) => (SKILL_ID_PATTERN.test(id) ? id : { id, custom: true }));
}

/** Compacts domains for YAML serialization. Known domains stay as strings; custom ones become { id, custom: true }. */
export function compactDomainsForYaml(
  domains: Domain[],
): (Domain | { id: Domain; custom: true })[] {
  const knownDomains = new Set<string>(DOMAIN_VALUES);
  return domains.map((d) => (knownDomains.has(d) ? d : { id: d, custom: true }));
}
