import path from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";
import { readFile, fileExists } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { defaultMappingsSchema } from "../schemas";

export type DefaultMappings = {
  skill_to_agents: Record<string, string[]>;
  preloaded_skills: Record<string, string[]>;
  subcategory_aliases: Record<string, string>;
};

// Cached defaults (loaded once per process)
let cachedDefaults: DefaultMappings | null = null;

function getDefaultsPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  // Navigate from lib/loading/ to defaults/
  return path.join(currentDir, "../..", "defaults", "agent-mappings.yaml");
}

export async function loadDefaultMappings(): Promise<DefaultMappings | null> {
  if (cachedDefaults !== null) {
    return cachedDefaults;
  }

  const defaultsPath = getDefaultsPath();

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

// Returns null if loadDefaultMappings() hasn't been called yet
export function getCachedDefaults(): DefaultMappings | null {
  return cachedDefaults;
}

export function clearDefaultsCache(): void {
  cachedDefaults = null;
}
