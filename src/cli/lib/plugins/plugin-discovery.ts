import type { SkillDefinition, SkillId } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { verbose } from "../../utils/logger";
import { typedEntries } from "../../utils/typed-object";
import { loadPluginSkills } from "../loading";
import { getVerifiedPluginInstallPaths } from "./plugin-settings";

/**
 * Discovers all plugin-installed skills from enabled plugins.
 *
 * Reads `.claude/settings.json` to find enabled plugins, then looks up their
 * install paths in the global plugin registry (`~/.claude/plugins/installed_plugins.json`).
 * Loads skills from the plugin cache directories.
 *
 * @param projectDir - Absolute path to the project root
 * @returns Merged map of all discovered plugin skills (later plugins override earlier)
 */
export async function discoverAllPluginSkills(
  projectDir: string,
): Promise<Partial<Record<SkillId, SkillDefinition>>> {
  const allSkills: Partial<Record<SkillId, SkillDefinition>> = {};

  try {
    const pluginPaths = await getVerifiedPluginInstallPaths(projectDir);

    if (pluginPaths.length === 0) {
      verbose(`No enabled plugins found in settings.json`);
      return allSkills;
    }

    for (const { pluginKey, installPath } of pluginPaths) {
      verbose(`Discovering skills from plugin: '${pluginKey}'`);
      try {
        const pluginSkills = await loadPluginSkills(installPath);
        // Boundary cast: loadPluginSkills returns Record<string, ...> — keys are skill IDs from parsed frontmatter
        for (const [id, skill] of typedEntries<SkillId, SkillDefinition>(pluginSkills)) {
          if (skill) {
            allSkills[id] = skill;
          }
        }
      } catch (error) {
        verbose(`Failed to load skills from '${pluginKey}': ${getErrorMessage(error)}`);
      }
    }
  } catch (error) {
    verbose(`Plugin discovery failed: ${getErrorMessage(error)}`);
  }

  return allSkills;
}

/**
 * Checks whether any plugins are enabled in settings.json.
 *
 * @param projectDir - Absolute path to the project root
 * @returns true if at least one plugin is enabled in settings.json
 */
export async function hasIndividualPlugins(projectDir: string): Promise<boolean> {
  try {
    const pluginPaths = await getVerifiedPluginInstallPaths(projectDir);
    return pluginPaths.length > 0;
  } catch (error) {
    verbose(`Failed to check for individual plugins: ${getErrorMessage(error)}`);
    return false;
  }
}

/**
 * Lists the keys of all enabled plugins.
 *
 * @param projectDir - Absolute path to the project root
 * @returns Array of plugin keys (e.g., ["web-framework-react@photoroom-marketplace"])
 */
export async function listPluginNames(projectDir: string): Promise<string[]> {
  try {
    const pluginPaths = await getVerifiedPluginInstallPaths(projectDir);
    return pluginPaths.map(({ pluginKey }) => pluginKey);
  } catch (error) {
    verbose(`Failed to list plugin names: ${getErrorMessage(error)}`);
    return [];
  }
}
