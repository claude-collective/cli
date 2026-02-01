import { parse as parseYaml } from "yaml";
import path from "path";
import { readFile, fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import type { Stack, StacksConfig } from "../types-stacks";

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
