import path from "path";
import type { SkillId } from "../../types";
import type { SkillConfig } from "../../types/config";
import type { SourceLoadResult } from "../loading";
import { deleteLocalSkill, copySkillsToLocalFlattened } from "../skills";
import { claudePluginInstall, claudePluginUninstall } from "../../utils/exec";
import { verbose, warn } from "../../utils/logger";
import { getErrorMessage } from "../../utils/errors";
import { LOCAL_SKILLS_PATH } from "../../consts";

export type SkillMigration = {
  id: SkillId;
  oldSource: string;
  newSource: string;
  oldScope: "project" | "global";
  newScope: "project" | "global";
};

export type MigrationPlan = {
  toLocal: SkillMigration[];
  toPlugin: SkillMigration[];
  scopeChanges: SkillMigration[];
};

export type MigrationResult = {
  localizedSkills: SkillId[];
  pluginizedSkills: SkillId[];
  warnings: string[];
};

/**
 * Detect which skills changed source or scope between old and new configs
 * by comparing SkillConfig[] entries by ID.
 */
export function detectMigrations(
  oldSkills: SkillConfig[],
  newSkills: SkillConfig[],
): MigrationPlan {
  const toLocal: SkillMigration[] = [];
  const toPlugin: SkillMigration[] = [];
  const scopeChanges: SkillMigration[] = [];

  const oldById = new Map(oldSkills.map((s) => [s.id, s]));

  for (const newSkill of newSkills) {
    const oldSkill = oldById.get(newSkill.id);
    if (!oldSkill) continue;

    const migration: SkillMigration = {
      id: newSkill.id,
      oldSource: oldSkill.source,
      newSource: newSkill.source,
      oldScope: oldSkill.scope,
      newScope: newSkill.scope,
    };

    const wasLocal = oldSkill.source === "local";
    const isLocal = newSkill.source === "local";

    if (wasLocal && !isLocal) {
      toPlugin.push(migration);
    } else if (!wasLocal && isLocal) {
      toLocal.push(migration);
    }

    // Detect scope changes (independent of source changes)
    if (oldSkill.scope !== newSkill.scope && wasLocal === isLocal) {
      scopeChanges.push(migration);
    }
  }

  return { toLocal, toPlugin, scopeChanges };
}

/**
 * Execute per-skill migration: delete locals that switch to plugin,
 * copy to local for skills that switch from plugin.
 * Uses per-skill scope from the migration plan.
 */
export async function executeMigration(
  plan: MigrationPlan,
  projectDir: string,
  sourceResult: SourceLoadResult,
): Promise<MigrationResult> {
  const warnings: string[] = [];
  const localizedSkills: SkillId[] = [];
  const pluginizedSkills: SkillId[] = [];

  // Migrate skills from plugin to local
  if (plan.toLocal.length > 0) {
    try {
      const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
      const skillIds = plan.toLocal.map((m) => m.id);
      const copied = await copySkillsToLocalFlattened(
        skillIds,
        localSkillsDir,
        sourceResult.matrix,
        sourceResult,
      );
      for (const skill of copied) {
        localizedSkills.push(skill.skillId);
      }

      // Uninstall plugin references using per-skill scope
      for (const migration of plan.toLocal) {
        try {
          const pluginScope = migration.oldScope === "global" ? "user" : "project";
          await claudePluginUninstall(migration.id, pluginScope, projectDir);
          verbose(`Uninstalled plugin for ${migration.id}`);
        } catch (error) {
          warnings.push(
            `Could not uninstall plugin for ${migration.id}: ${getErrorMessage(error)}`,
          );
        }
      }
    } catch (error) {
      warnings.push(`Could not copy skills to local: ${getErrorMessage(error)}`);
    }
  }

  // Migrate skills from local to plugin
  if (plan.toPlugin.length > 0) {
    // Delete local copies
    for (const migration of plan.toPlugin) {
      await deleteLocalSkill(projectDir, migration.id);
    }

    // Install as plugins using per-skill scope
    if (sourceResult.marketplace) {
      for (const migration of plan.toPlugin) {
        try {
          const pluginScope = migration.newScope === "global" ? "user" : "project";
          const pluginRef = `${migration.id}@${sourceResult.marketplace}`;
          await claudePluginInstall(pluginRef, pluginScope, projectDir);
          pluginizedSkills.push(migration.id);
          verbose(`Installed plugin for ${migration.id}`);
        } catch (error) {
          warnings.push(`Could not install plugin for ${migration.id}: ${getErrorMessage(error)}`);
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
