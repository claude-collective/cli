import { parse as parseYaml } from "yaml";
import path from "path";
import { readFile, fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import type { Stack, StacksConfig, StackAgentConfig } from "../types-stacks";
import type { SkillReference } from "../types";

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
    const config = parseYaml(content) as StacksConfig;

    if (!config.stacks || !Array.isArray(config.stacks)) {
      verbose(`Invalid stacks.yaml format: missing stacks array`);
      return [];
    }

    stacksCache.set(cacheKey, config.stacks);
    verbose(`Loaded ${config.stacks.length} stacks from ${stacksPath}`);

    return config.stacks;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load stacks from '${stacksPath}': ${errorMessage}`,
    );
  }
}

/**
 * Load a specific stack by ID
 * Returns null if stack not found
 */
export async function loadStackById(
  stackId: string,
  configDir: string,
): Promise<Stack | null> {
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
  skillAliases: Record<string, string>,
): SkillReference[] {
  const skillRefs: SkillReference[] = [];

  for (const [subcategory, technologyAlias] of Object.entries(agentConfig)) {
    const fullSkillId = skillAliases[technologyAlias];

    if (!fullSkillId) {
      verbose(
        `Warning: No skill alias found for '${technologyAlias}' (subcategory: ${subcategory}). Skipping.`,
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
 *   react: 'web/framework/react (@vince)',
 *   hono: 'api/framework/hono (@vince)',
 *   // ...
 * };
 *
 * const result = resolveStackSkillsFromAliases(stack, aliases);
 * // Returns:
 * // {
 * //   'web-developer': [{ id: 'web/framework/react (@vince)', usage: '...', preloaded: true }, ...],
 * //   'api-developer': [{ id: 'api/framework/hono (@vince)', usage: '...', preloaded: true }, ...]
 * // }
 * ```
 */
export function resolveStackSkillsFromAliases(
  stack: Stack,
  skillAliases: Record<string, string>,
): Record<string, SkillReference[]> {
  const result: Record<string, SkillReference[]> = {};

  for (const [agentId, agentConfig] of Object.entries(stack.agents)) {
    // Empty config {} means agent has no technology-specific skills
    if (Object.keys(agentConfig).length === 0) {
      result[agentId] = [];
      continue;
    }

    result[agentId] = resolveAgentConfigToSkills(agentConfig, skillAliases);
  }

  verbose(
    `Resolved skills for ${Object.keys(result).length} agents in stack '${stack.id}'`,
  );

  return result;
}
