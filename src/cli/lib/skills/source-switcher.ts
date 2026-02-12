import path from "path";
import { copy, directoryExists, ensureDir, remove } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import { LOCAL_SKILLS_PATH, ARCHIVED_SKILLS_DIR_NAME } from "../../consts";
import type { SkillId } from "../../types";

/**
 * Archive a local skill to .claude/skills/_archived/{skill-id}/
 * Preserves user's work before switching to a different source.
 */
export async function archiveLocalSkill(projectDir: string, skillId: SkillId): Promise<void> {
  const skillPath = path.join(projectDir, LOCAL_SKILLS_PATH, skillId);
  const archivedDir = path.join(projectDir, LOCAL_SKILLS_PATH, ARCHIVED_SKILLS_DIR_NAME);
  const archivedSkillPath = path.join(archivedDir, skillId);

  if (!(await directoryExists(skillPath))) {
    warn(`Skill directory not found for archiving: ${skillPath}`);
    return;
  }

  await ensureDir(archivedDir);
  await copy(skillPath, archivedSkillPath);
  await remove(skillPath);

  verbose(`Archived local skill '${skillId}' to ${ARCHIVED_SKILLS_DIR_NAME}/`);
}

/**
 * Restore a previously archived skill from .claude/skills/_archived/{skill-id}/
 * Returns true if found and restored, false if no archive exists.
 */
export async function restoreArchivedSkill(projectDir: string, skillId: SkillId): Promise<boolean> {
  const skillPath = path.join(projectDir, LOCAL_SKILLS_PATH, skillId);
  const archivedSkillPath = path.join(
    projectDir,
    LOCAL_SKILLS_PATH,
    ARCHIVED_SKILLS_DIR_NAME,
    skillId,
  );

  if (!(await directoryExists(archivedSkillPath))) {
    return false;
  }

  await copy(archivedSkillPath, skillPath);
  await remove(archivedSkillPath);

  verbose(`Restored archived skill '${skillId}' from ${ARCHIVED_SKILLS_DIR_NAME}/`);
  return true;
}

/**
 * Check if an archived version of a skill exists.
 */
export async function hasArchivedSkill(projectDir: string, skillId: SkillId): Promise<boolean> {
  const archivedSkillPath = path.join(
    projectDir,
    LOCAL_SKILLS_PATH,
    ARCHIVED_SKILLS_DIR_NAME,
    skillId,
  );

  return directoryExists(archivedSkillPath);
}
