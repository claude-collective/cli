import path from "path";
import type { SkillId } from "../../types";
import type { SourceLoadResult } from "../loading";
import { deleteLocalSkill, copySkillsToLocalFlattened } from "../skills";
import { claudePluginInstall, claudePluginUninstall } from "../../utils/exec";
import { verbose, warn } from "../../utils/logger";
import { getErrorMessage } from "../../utils/errors";
import { LOCAL_SKILLS_PATH } from "../../consts";

export type MigrationPlan = {
  toLocal: SkillId[];
  toPlugin: SkillId[];
};

export type MigrationResult = {
  localizedSkills: SkillId[];
  pluginizedSkills: SkillId[];
  warnings: string[];
};

/**
 * Detect which skills changed between local and plugin mode
 * by comparing old and new source selections.
 */
export function detectMigrations(
  oldSelections: Partial<Record<SkillId, string>>,
  newSelections: Partial<Record<SkillId, string>>,
  allSkills: SkillId[],
): MigrationPlan {
  const toLocal: SkillId[] = [];
  const toPlugin: SkillId[] = [];

  for (const skillId of allSkills) {
    const oldSource = oldSelections[skillId];
    const newSource = newSelections[skillId];

    const wasLocal = oldSource === "local";
    const isLocal = newSource === "local";

    if (wasLocal && !isLocal) {
      toPlugin.push(skillId);
    } else if (!wasLocal && isLocal) {
      toLocal.push(skillId);
    }
  }

  return { toLocal, toPlugin };
}

/**
 * Execute per-skill migration: delete locals that switch to plugin,
 * copy to local for skills that switch from plugin.
 */
export async function executeMigration(
  plan: MigrationPlan,
  projectDir: string,
  sourceResult: SourceLoadResult,
  scope: "project" | "user",
): Promise<MigrationResult> {
  const warnings: string[] = [];
  const localizedSkills: SkillId[] = [];
  const pluginizedSkills: SkillId[] = [];

  // Migrate skills from plugin to local
  if (plan.toLocal.length > 0) {
    try {
      const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
      const copied = await copySkillsToLocalFlattened(
        plan.toLocal,
        localSkillsDir,
        sourceResult.matrix,
        sourceResult,
      );
      for (const skill of copied) {
        localizedSkills.push(skill.skillId);
      }

      // Uninstall plugin references
      for (const skillId of plan.toLocal) {
        try {
          await claudePluginUninstall(skillId, scope, projectDir);
          verbose(`Uninstalled plugin for ${skillId}`);
        } catch (error) {
          warnings.push(`Could not uninstall plugin for ${skillId}: ${getErrorMessage(error)}`);
        }
      }
    } catch (error) {
      warnings.push(`Could not copy skills to local: ${getErrorMessage(error)}`);
    }
  }

  // Migrate skills from local to plugin
  if (plan.toPlugin.length > 0) {
    // Delete local copies
    for (const skillId of plan.toPlugin) {
      await deleteLocalSkill(projectDir, skillId);
    }

    // Install as plugins
    if (sourceResult.marketplace) {
      for (const skillId of plan.toPlugin) {
        try {
          const pluginRef = `${skillId}@${sourceResult.marketplace}`;
          await claudePluginInstall(pluginRef, scope, projectDir);
          pluginizedSkills.push(skillId);
          verbose(`Installed plugin for ${skillId}`);
        } catch (error) {
          warnings.push(`Could not install plugin for ${skillId}: ${getErrorMessage(error)}`);
        }
      }
    } else {
      warnings.push(
        "No marketplace configured — cannot install skills as plugins. Skills deleted but not plugin-installed.",
      );
    }
  }

  return { localizedSkills, pluginizedSkills, warnings };
}
