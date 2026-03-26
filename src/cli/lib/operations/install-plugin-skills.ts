import { claudePluginInstall } from "../../utils/exec.js";
import { getErrorMessage } from "../../utils/errors.js";
import type { SkillId } from "../../types/index.js";
import type { SkillConfig } from "../../types/config.js";

export type PluginInstallResult = {
  installed: Array<{ id: SkillId; ref: string }>;
  failed: Array<{ id: SkillId; error: string }>;
};

/**
 * Installs skill plugins via the Claude CLI, routing by scope.
 *
 * For each skill, constructs the plugin ref as `{skillId}@{marketplace}`
 * and invokes `claudePluginInstall` with the correct scope.
 */
export async function installPluginSkills(
  skills: SkillConfig[],
  marketplace: string,
  projectDir: string,
): Promise<PluginInstallResult> {
  const pluginSkills = skills.filter((s) => s.source !== "local");
  const installed: PluginInstallResult["installed"] = [];
  const failed: PluginInstallResult["failed"] = [];

  for (const skill of pluginSkills) {
    const pluginRef = `${skill.id}@${marketplace}`;
    const pluginScope = skill.scope === "global" ? "user" : "project";
    try {
      await claudePluginInstall(pluginRef, pluginScope, projectDir);
      installed.push({ id: skill.id, ref: pluginRef });
    } catch (error) {
      failed.push({ id: skill.id, error: getErrorMessage(error) });
    }
  }

  return { installed, failed };
}
