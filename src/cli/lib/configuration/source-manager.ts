import type { SourceEntry } from "./config";
import { loadProjectSourceConfig, saveProjectConfig, DEFAULT_SOURCE } from "./config";
import { fetchMarketplace } from "../loading/source-fetcher";
import { discoverLocalSkills } from "../skills/local-skill-loader";
import { discoverAllPluginSkills } from "../plugins/plugin-discovery";
import { verbose } from "../../utils/logger";

const DEFAULT_SOURCE_NAME = "public";

export type SourceSummary = {
  sources: Array<SourceEntry & { enabled: boolean }>;
  localSkillCount: number;
  pluginSkillCount: number;
};

/**
 * Add a new source to the project configuration.
 * Validates the URL by fetching the marketplace.
 */
export async function addSource(
  projectDir: string,
  url: string,
): Promise<{ name: string; skillCount: number }> {
  const result = await fetchMarketplace(url, { forceRefresh: true });
  const name = result.marketplace.name;
  const skillCount = result.marketplace.plugins.length;

  const config = (await loadProjectSourceConfig(projectDir)) ?? {};
  const sources = config.sources ?? [];

  const exists = sources.some((s) => s.name === name);
  if (exists) {
    throw new Error(`Source "${name}" already exists`);
  }

  sources.push({ name, url });
  config.sources = sources;
  await saveProjectConfig(projectDir, config);

  verbose(`Added source "${name}" with ${skillCount} skills`);
  return { name, skillCount };
}

/**
 * Remove a source by name. Cannot remove "public" (the default).
 */
export async function removeSource(projectDir: string, name: string): Promise<void> {
  if (name === DEFAULT_SOURCE_NAME) {
    throw new Error(`Cannot remove the "${DEFAULT_SOURCE_NAME}" source`);
  }

  const config = (await loadProjectSourceConfig(projectDir)) ?? {};
  const sources = config.sources ?? [];

  const filtered = sources.filter((s) => s.name !== name);
  if (filtered.length === sources.length) {
    throw new Error(`Source "${name}" not found`);
  }

  config.sources = filtered;
  await saveProjectConfig(projectDir, config);

  verbose(`Removed source "${name}"`);
}

/**
 * Get summary of all configured sources and local/plugin counts.
 */
export async function getSourceSummary(projectDir: string): Promise<SourceSummary> {
  const config = (await loadProjectSourceConfig(projectDir)) ?? {};

  const sources: Array<SourceEntry & { enabled: boolean }> = [
    {
      name: DEFAULT_SOURCE_NAME,
      url: config.source ?? DEFAULT_SOURCE,
      enabled: true,
    },
  ];

  if (config.sources) {
    for (const source of config.sources) {
      sources.push({ ...source, enabled: true });
    }
  }

  let localSkillCount = 0;
  try {
    const localResult = await discoverLocalSkills(projectDir);
    if (localResult) {
      localSkillCount = localResult.skills.length;
    }
  } catch {
    verbose("Failed to discover local skills for source summary");
  }

  let pluginSkillCount = 0;
  try {
    const discoveredSkills = await discoverAllPluginSkills(projectDir);
    pluginSkillCount = Object.keys(discoveredSkills).length;
  } catch {
    verbose("Failed to discover plugin skills for source summary");
  }

  return { sources, localSkillCount, pluginSkillCount };
}
