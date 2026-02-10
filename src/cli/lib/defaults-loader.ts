import path from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";
import { readFile, fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { defaultMappingsSchema } from "./schemas";

/**
 * Default mappings loaded from agent-mappings.yaml
 */
export interface DefaultMappings {
  skill_to_agents: Record<string, string[]>;
  preloaded_skills: Record<string, string[]>;
  subcategory_aliases: Record<string, string>;
}

// Cached defaults (loaded once per process)
let cachedDefaults: DefaultMappings | null = null;

/**
 * Get the path to the defaults directory.
 * Works both in development (src/) and production (dist/).
 */
function getDefaultsPath(): string {
  // In ESM, we can use import.meta.url to get the current file's path
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  // Navigate from lib/ to defaults/
  return path.join(currentDir, "..", "defaults", "agent-mappings.yaml");
}

/**
 * Load default mappings from YAML file.
 * Returns cached result on subsequent calls.
 *
 * @returns Default mappings or null if file cannot be loaded
 */
export async function loadDefaultMappings(): Promise<DefaultMappings | null> {
  // Return cached defaults if available
  if (cachedDefaults !== null) {
    return cachedDefaults;
  }

  const defaultsPath = getDefaultsPath();

  // Check if file exists
  if (!(await fileExists(defaultsPath))) {
    verbose(`Default mappings file not found at ${defaultsPath}`);
    return null;
  }

  try {
    const content = await readFile(defaultsPath);
    const parsed = parseYaml(content);
    const result = defaultMappingsSchema.safeParse(parsed);

    if (!result.success) {
      verbose(`Invalid default mappings structure at ${defaultsPath}: ${result.error.message}`);
      return null;
    }

    verbose(`Loaded default mappings from ${defaultsPath}`);
    cachedDefaults = result.data;
    return cachedDefaults;
  } catch (error) {
    verbose(`Failed to parse default mappings: ${error}`);
    return null;
  }
}

/**
 * Synchronously get cached defaults.
 * Returns null if defaults haven't been loaded yet.
 *
 * This is useful for functions that need defaults but cannot be async.
 * Call loadDefaultMappings() first to populate the cache.
 */
export function getCachedDefaults(): DefaultMappings | null {
  return cachedDefaults;
}

/**
 * Clear the cached defaults (for testing).
 */
export function clearDefaultsCache(): void {
  cachedDefaults = null;
}

