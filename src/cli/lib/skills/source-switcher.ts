import path from "path";

import { getErrorMessage } from "../../utils/errors";
import { copy, directoryExists, ensureDir, remove } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import { LOCAL_SKILLS_PATH, ARCHIVED_SKILLS_DIR_NAME } from "../../consts";
import { isValidSkillId } from "../schemas";
import type { SkillId } from "../../types";

/**
 * Validates a skill ID is safe for use in filesystem paths.
 * Checks format, traversal sequences, and null bytes at runtime
 * since TypeScript template literal types don't prevent malformed data from YAML/JSON.
 * Accepts built-in skill ID patterns and custom IDs registered via extendSchemasWithCustomValues().
 */
function validateSkillId(skillId: SkillId): boolean {
  if (!isValidSkillId(skillId)) {
    return false;
  }
  // Block null bytes and path traversal sequences
  return !(
    skillId.includes("\0") ||
    skillId.includes("..") ||
    skillId.includes("/") ||
    skillId.includes("\\")
  );
}

/**
 * Validates a resolved path stays within the expected parent directory.
 * Prevents path traversal attacks where crafted input escapes the skills directory.
 */
function validatePathBoundary(resolvedPath: string, expectedParent: string): boolean {
  const normalizedPath = path.resolve(resolvedPath);
  const normalizedParent = path.resolve(expectedParent);
  return normalizedPath.startsWith(normalizedParent + path.sep);
}

/**
 * Archive a local skill to .claude/skills/_archived/{skill-id}/
 * Preserves user's work before switching to a different source.
 */
export async function archiveLocalSkill(projectDir: string, skillId: SkillId): Promise<void> {
  if (!validateSkillId(skillId)) {
    warn(`Invalid skill ID for archiving: '${skillId}'`);
    return;
  }

  const skillsDir = path.resolve(path.join(projectDir, LOCAL_SKILLS_PATH));
  const skillPath = path.resolve(path.join(skillsDir, skillId));
  const archivedDir = path.resolve(path.join(skillsDir, ARCHIVED_SKILLS_DIR_NAME));
  const archivedSkillPath = path.resolve(path.join(archivedDir, skillId));

  if (
    !validatePathBoundary(skillPath, skillsDir) ||
    !validatePathBoundary(archivedSkillPath, archivedDir)
  ) {
    warn(`Skill ID '${skillId}' resolves outside the skills directory.`);
    return;
  }

  try {
    await ensureDir(archivedDir);
    await copy(skillPath, archivedSkillPath);
    await remove(skillPath);
  } catch (error) {
    warn(`Failed to archive skill '${skillId}': ${getErrorMessage(error)}`);
    return;
  }

  verbose(`Archived local skill '${skillId}' to ${ARCHIVED_SKILLS_DIR_NAME}/`);
}

/**
 * Restore a previously archived skill from .claude/skills/_archived/{skill-id}/
 * Returns true if found and restored, false if no archive exists.
 */
export async function restoreArchivedSkill(projectDir: string, skillId: SkillId): Promise<boolean> {
  if (!validateSkillId(skillId)) {
    warn(`Invalid skill ID for restoring: '${skillId}'`);
    return false;
  }

  const skillsDir = path.resolve(path.join(projectDir, LOCAL_SKILLS_PATH));
  const skillPath = path.resolve(path.join(skillsDir, skillId));
  const archivedDir = path.resolve(path.join(skillsDir, ARCHIVED_SKILLS_DIR_NAME));
  const archivedSkillPath = path.resolve(path.join(archivedDir, skillId));

  if (
    !validatePathBoundary(skillPath, skillsDir) ||
    !validatePathBoundary(archivedSkillPath, archivedDir)
  ) {
    warn(`Skill ID '${skillId}' resolves outside the skills directory.`);
    return false;
  }

  try {
    await copy(archivedSkillPath, skillPath);
    await remove(archivedSkillPath);
  } catch {
    // Archive doesn't exist or can't be read — nothing to restore
    return false;
  }

  verbose(`Restored archived skill '${skillId}' from ${ARCHIVED_SKILLS_DIR_NAME}/`);
  return true;
}

/**
 * Check if an archived version of a skill exists.
 */
export async function hasArchivedSkill(projectDir: string, skillId: SkillId): Promise<boolean> {
  if (!validateSkillId(skillId)) {
    warn(`Invalid skill ID for archive check: '${skillId}'`);
    return false;
  }

  const skillsDir = path.resolve(path.join(projectDir, LOCAL_SKILLS_PATH));
  const archivedDir = path.resolve(path.join(skillsDir, ARCHIVED_SKILLS_DIR_NAME));
  const archivedSkillPath = path.resolve(path.join(archivedDir, skillId));

  if (!validatePathBoundary(archivedSkillPath, archivedDir)) {
    warn(`Skill ID '${skillId}' resolves outside the skills directory.`);
    return false;
  }

  return directoryExists(archivedSkillPath);
}
