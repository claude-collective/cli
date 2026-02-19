import path from "path";
import { fileURLToPath } from "url";

import { fileExists } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { safeLoadYamlFile } from "../../utils/yaml";
import { defaultMappingsSchema } from "../schemas";

export type DefaultMappings = {
  skillToAgents: Record<string, string[]>;
  agentSkillPrefixes?: Record<string, string[]>;
};

let cachedDefaults: DefaultMappings | null = null;

function getDefaultsPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  // After tsup build, dist/ is flat (chunks at dist/chunk-*.js) but defaults
  // are copied to dist/cli/defaults/. In dev mode, this file lives at
  // src/cli/lib/loading/ so ../../defaults/ resolves correctly.
  const isInDist = currentDir.includes("/dist");
  return isInDist
    ? path.join(currentDir, "cli", "defaults", "agent-mappings.yaml")
    : path.join(currentDir, "../..", "defaults", "agent-mappings.yaml");
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
