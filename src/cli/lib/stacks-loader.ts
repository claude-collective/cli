import { parse as parseYaml } from "yaml";
import path from "path";
import { mapValues } from "remeda";
import { readFile, fileExists } from "../utils/fs";
import { verbose, warn } from "../utils/logger";
import type { Stack, StacksConfig, StackAgentConfig } from "../types-stacks";
import type { SkillReference } from "../types";
import type { SkillId } from "../types-matrix";
import { stacksConfigSchema } from "./schemas";

const STACKS_FILE = "config/stacks.yaml";

const stacksCache = new Map<string, Stack[]>();

/**
 * Load all stacks from config/stacks.yaml
 * Stacks are simple agent groupings without skill mappings
 */
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

/**
 * Load a specific stack by ID
 * Returns null if stack not found
 */
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

/**
 * Subcategories considered "key" skills that should be preloaded.
 * These are primary technology choices that define the stack's core.
 */
const KEY_SUBCATEGORIES = new Set([
  "framework",
  "api",
  "database",
  "meta-framework",
  "base-framework",
  "platform",
]);

/**
 * Resolve a single agent's technology config to skill references.
 * Looks up each technology alias in skill_aliases to get full skill ID.
 *
 * @param agentConfig - The agent's technology selections (subcategory -> alias)
 * @param skillAliases - Mapping from technology aliases to full skill IDs
 * @returns Array of SkillReference objects
 */
export function resolveAgentConfigToSkills(
  agentConfig: StackAgentConfig,
  skillAliases: Partial<Record<string, SkillId>>,
): SkillReference[] {
  const skillRefs: SkillReference[] = [];

  for (const [subcategory, technologyAlias] of Object.entries(agentConfig)) {
    const fullSkillId = skillAliases[technologyAlias];

    if (!fullSkillId) {
      warn(
        `No skill alias found for '${technologyAlias}' (subcategory: ${subcategory}) in stack config. Skipping.`,
      );
      continue;
    }

    const isKeySkill = KEY_SUBCATEGORIES.has(subcategory);

    skillRefs.push({
      id: fullSkillId,
      usage: `when working with ${subcategory}`,
      preloaded: isKeySkill,
    });
  }

  return skillRefs;
}

/**
 * Resolve all agents in a stack to their skill references.
 * Takes a Stack and skill_aliases, returns a mapping of agent IDs to their resolved skills.
 *
 * @param stack - The stack definition with agent technology selections
 * @param skillAliases - Mapping from technology aliases to full skill IDs
 * @returns Record mapping agent IDs to their SkillReference arrays
 *
 * @example
 * ```typescript
 * const stack = {
 *   id: 'nextjs-fullstack',
 *   name: 'Next.js Fullstack',
 *   agents: {
 *     'web-developer': { framework: 'react', styling: 'scss-modules' },
 *     'api-developer': { api: 'hono', database: 'drizzle' }
 *   }
 * };
 *
 * const aliases = {
 *   react: 'web-framework-react',
 *   hono: 'api-framework-hono',
 *   // ...
 * };
 *
 * const result = resolveStackSkillsFromAliases(stack, aliases);
 * // Returns:
 * // {
 * //   'web-developer': [{ id: 'web-framework-react', usage: '...', preloaded: true }, ...],
 * //   'api-developer': [{ id: 'api-framework-hono', usage: '...', preloaded: true }, ...]
 * // }
 * ```
 */
export function resolveStackSkillsFromAliases(
  stack: Stack,
  skillAliases: Partial<Record<string, SkillId>>,
): Record<string, SkillReference[]> {
  const result = mapValues(stack.agents, (agentConfig) =>
    resolveAgentConfigToSkills(agentConfig, skillAliases),
  );

  verbose(`Resolved skills for ${Object.keys(result).length} agents in stack '${stack.id}'`);

  return result;
}
