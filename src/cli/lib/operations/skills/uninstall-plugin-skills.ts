import { claudePluginUninstall } from "../../../utils/exec.js";
import { getErrorMessage } from "../../../utils/errors.js";
import type { SkillId } from "../../../types/index.js";
import type { SkillConfig } from "../../../types/config.js";

export type PluginUninstallResult = {
  uninstalled: SkillId[];
  failed: Array<{ id: SkillId; error: string }>;
};

/**
 * Uninstalls skill plugins via the Claude CLI, using scope from old config.
 */
export async function uninstallPluginSkills(
  skillIds: SkillId[],
  oldSkills: SkillConfig[],
  projectDir: string,
): Promise<PluginUninstallResult> {
  const uninstalled: SkillId[] = [];
  const failed: PluginUninstallResult["failed"] = [];

  for (const skillId of skillIds) {
    const oldSkill = oldSkills.find((s) => s.id === skillId);
    const pluginScope = oldSkill?.scope === "global" ? "user" : "project";
    try {
      await claudePluginUninstall(skillId, pluginScope, projectDir);
      uninstalled.push(skillId);
    } catch (error) {
      failed.push({ id: skillId, error: getErrorMessage(error) });
    }
  }

  return { uninstalled, failed };
}
