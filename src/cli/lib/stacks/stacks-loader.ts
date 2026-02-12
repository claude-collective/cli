import { parse as parseYaml } from "yaml";
import path from "path";
import { mapValues } from "remeda";
import { readFile, fileExists } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import type { SkillId, SkillReference, Stack, StackAgentConfig, Subcategory } from "../../types";
import { stacksConfigSchema } from "../schemas";
import { KEY_SUBCATEGORIES } from "../../consts";

const STACKS_FILE = "config/stacks.yaml";

const stacksCache = new Map<string, Stack[]>();

export async function loadStacks(configDir: string): Promise<Stack[]> {
  const cacheKey = configDir;
  const cached = stacksCache.get(cacheKey);
  if (cached) return cached;

  const stacksPath = path.join(configDir, STACKS_FILE);

  if (!(await fileExists(stacksPath))) {
    verbose(`No stacks file found at ${stacksPath}`);
    return [];
  }

  try {
    const content = await readFile(stacksPath);
    const result = stacksConfigSchema.safeParse(parseYaml(content));

    if (!result.success) {
      throw new Error(
        `Invalid stacks.yaml at ${stacksPath}: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
    }

    const config = result.data;

    stacksCache.set(cacheKey, config.stacks);
    verbose(`Loaded ${config.stacks.length} stacks from ${stacksPath}`);

    return config.stacks;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
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

// Resolves each technology display name in the agent config to a full skill ID
export function resolveAgentConfigToSkills(
  agentConfig: StackAgentConfig,
  displayNameToId: Partial<Record<string, SkillId>>,
): SkillReference[] {
  const skillRefs: SkillReference[] = [];

  for (const [subcategory, technologyDisplayName] of Object.entries(agentConfig)) {
    const fullSkillId = displayNameToId[technologyDisplayName];

    if (!fullSkillId) {
      warn(
        `No skill found for display name '${technologyDisplayName}' (subcategory: ${subcategory}) in stack config. Skipping.`,
      );
      continue;
    }

    // Boundary cast: Object.entries() loses StackAgentConfig key type
    const isKeySkill = KEY_SUBCATEGORIES.has(subcategory as Subcategory);

    skillRefs.push({
      id: fullSkillId,
      usage: `when working with ${subcategory}`,
      preloaded: isKeySkill,
    });
  }

  return skillRefs;
}

export function resolveStackSkillsFromDisplayNames(
  stack: Stack,
  displayNameToId: Partial<Record<string, SkillId>>,
): Record<string, SkillReference[]> {
  const result = mapValues(stack.agents, (agentConfig) =>
    resolveAgentConfigToSkills(agentConfig, displayNameToId),
  );

  verbose(`Resolved skills for ${Object.keys(result).length} agents in stack '${stack.id}'`);

  return result;
}
