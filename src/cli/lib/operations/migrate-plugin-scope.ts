import { claudePluginInstall, claudePluginUninstall } from "../../utils/exec.js";
import { getErrorMessage } from "../../utils/errors.js";
import type { SkillId } from "../../types/index.js";

export type PluginScopeMigrationResult = {
  migrated: SkillId[];
  failed: Array<{ id: SkillId; error: string }>;
};

/**
 * Migrates plugin skills between scopes by uninstalling from the old scope
 * and reinstalling to the new scope via the Claude CLI.
 *
 * Only processes plugin skills (source !== "local"). Local skills are
 * handled separately via `migrateLocalSkillScope`.
 */
export async function migratePluginSkillScopes(
  scopeChanges: Map<SkillId, { from: "project" | "global"; to: "project" | "global" }>,
  skills: Array<{ id: SkillId; source: string }>,
  marketplace: string,
  projectDir: string,
): Promise<PluginScopeMigrationResult> {
  const migrated: SkillId[] = [];
  const failed: PluginScopeMigrationResult["failed"] = [];

  for (const [skillId, change] of scopeChanges) {
    const skillConfig = skills.find((s) => s.id === skillId);
    if (!skillConfig || skillConfig.source === "local") {
      continue;
    }

    const oldPluginScope = change.from === "global" ? "user" : "project";
    const newPluginScope = change.to === "global" ? "user" : "project";
    const pluginRef = `${skillId}@${marketplace}`;

    try {
      await claudePluginUninstall(skillId, oldPluginScope, projectDir);
      await claudePluginInstall(pluginRef, newPluginScope, projectDir);
      migrated.push(skillId);
    } catch (error) {
      failed.push({ id: skillId, error: getErrorMessage(error) });
    }
  }

  return { migrated, failed };
}
