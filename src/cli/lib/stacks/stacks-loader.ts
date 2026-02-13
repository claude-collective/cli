import { parse as parseYaml } from "yaml";
import path from "path";
import { mapValues } from "remeda";
import { readFile, fileExists } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import type { SkillId, SkillReference, Stack, StackAgentConfig, Subcategory } from "../../types";
import { SKILL_ID_PATTERN, stacksConfigSchema } from "../schemas";
import { KEY_SUBCATEGORIES } from "../../consts";
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

// Converts a StackAgentConfig (subcategory -> SkillId) to an array of SkillReferences.
// Values are already full skill IDs (e.g., "web-framework-react").
export function resolveAgentConfigToSkills(agentConfig: StackAgentConfig): SkillReference[] {
  const skillRefs: SkillReference[] = [];

  for (const [subcategory, skillId] of typedEntries<Subcategory, SkillId>(agentConfig)) {
    if (!skillId) continue;

    if (!SKILL_ID_PATTERN.test(skillId)) {
      warn(
        `Invalid skill ID '${skillId}' for subcategory '${subcategory}' in stack config. Skipping.`,
      );
      continue;
    }

    const isKeySkill = KEY_SUBCATEGORIES.has(subcategory);

    skillRefs.push({
      id: skillId,
      usage: `when working with ${subcategory}`,
      preloaded: isKeySkill,
    });
  }

  return skillRefs;
}

export function resolveStackSkills(stack: Stack): Record<string, SkillReference[]> {
  const result = mapValues(stack.agents, (agentConfig) => resolveAgentConfigToSkills(agentConfig));

  verbose(`Resolved skills for ${Object.keys(result).length} agents in stack '${stack.id}'`);

  return result;
}
