import { parse as parseYaml } from "yaml";
import path from "path";
import { mapValues } from "remeda";
import { getErrorMessage } from "../../utils/errors";
import { readFile, fileExists } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import type {
  AgentName,
  SkillAssignment,
  SkillId,
  SkillReference,
  Stack,
  StackAgentConfig,
  Subcategory,
} from "../../types";
import { SKILL_ID_PATTERN, formatZodErrors, stacksConfigSchema } from "../schemas";
import { typedEntries } from "../../utils/typed-object";

const STACKS_FILE = "config/stacks.yaml";

const stacksCache = new Map<string, Stack[]>();

export async function loadStacks(configDir: string, stacksFile?: string): Promise<Stack[]> {
  const resolvedStacksFile = stacksFile ?? STACKS_FILE;
  const cacheKey = `${configDir}:${resolvedStacksFile}`;
  const cached = stacksCache.get(cacheKey);
  if (cached) return cached;

  const stacksPath = path.join(configDir, resolvedStacksFile);

  if (!(await fileExists(stacksPath))) {
    verbose(`No stacks file found at ${stacksPath}`);
    return [];
  }

  try {
    const content = await readFile(stacksPath);
    const result = stacksConfigSchema.safeParse(parseYaml(content));

    if (!result.success) {
      throw new Error(
        `Invalid stacks.yaml at '${stacksPath}': ${formatZodErrors(result.error.issues)}`,
      );
    }

    // Normalize: all values to SkillAssignment[] so StackAgentConfig is always SkillAssignment[]
    const stacks: Stack[] = result.data.stacks.map((stack) => ({
      ...stack,
      agents: mapValues(
        stack.agents as Partial<Record<AgentName, Record<string, unknown>>>,
        (agentConfig) =>
          mapValues(agentConfig, (value) => {
            const items = Array.isArray(value) ? value : [value];
            return items.map(
              (item): SkillAssignment =>
                typeof item === "string"
                  ? { id: item as SkillId, preloaded: false }
                  : (item as SkillAssignment),
            );
          }) as StackAgentConfig,
      ) as Stack["agents"],
    }));

    stacksCache.set(cacheKey, stacks);
    verbose(`Loaded ${stacks.length} stacks from ${stacksPath}`);

    return stacks;
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    throw new Error(`Failed to load stacks from '${stacksPath}': ${errorMessage}`);
  }
}

export async function loadStackById(stackId: string, configDir: string): Promise<Stack | null> {
  const stacks = await loadStacks(configDir);
  const stack = stacks.find((s) => s.id === stackId);

  if (!stack) {
    verbose(`Stack '${stackId}' not found`);
    return null;
  }

  verbose(`Found stack: ${stack.name} (${stackId})`);
  return stack;
}

// Converts a StackAgentConfig (subcategory -> SkillAssignment[]) to an array of SkillReferences.
// Values are already normalized to SkillAssignment[] by loadStacks().
export function resolveAgentConfigToSkills(agentConfig: StackAgentConfig): SkillReference[] {
  const skillRefs: SkillReference[] = [];

  for (const [subcategory, assignments] of typedEntries<Subcategory, SkillAssignment[]>(
    agentConfig,
  )) {
    if (!assignments) continue;

    for (const assignment of assignments) {
      if (!SKILL_ID_PATTERN.test(assignment.id)) {
        warn(
          `Invalid skill ID '${assignment.id}' for subcategory '${subcategory}' in stack config. Skipping.`,
        );
        continue;
      }

      skillRefs.push({
        id: assignment.id,
        usage: `when working with ${subcategory}`,
        preloaded: assignment.preloaded ?? false,
      });
    }
  }

  return skillRefs;
}

export function resolveStackSkills(stack: Stack): Record<string, SkillReference[]> {
  const result = mapValues(stack.agents, (agentConfig) => resolveAgentConfigToSkills(agentConfig));

  verbose(`Resolved skills for ${Object.keys(result).length} agents in stack '${stack.id}'`);

  return result;
}
