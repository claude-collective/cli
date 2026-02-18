import path from "path";
import { fileURLToPath } from "url";

import { fileExists } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { safeLoadYamlFile } from "../../utils/yaml";
import { defaultMappingsSchema } from "../schemas";

export type DefaultMappings = {
  skillToAgents: Record<string, string[]>;
  preloadedSkills: Record<string, string[]>;
  agentSkillPrefixes?: Record<string, string[]>;
  subcategoryAliases: Record<string, string>;
};

let cachedDefaults: DefaultMappings | null = null;

function getDefaultsPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

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

  const data = await safeLoadYamlFile(defaultsPath, defaultMappingsSchema);
  if (!data) return null;

  verbose(`Loaded default mappings from ${defaultsPath}`);
  cachedDefaults = data;
  return cachedDefaults;
}

export function getCachedDefaults(): DefaultMappings | null {
  return cachedDefaults;
}

export function clearDefaultsCache(): void {
  cachedDefaults = null;
}
