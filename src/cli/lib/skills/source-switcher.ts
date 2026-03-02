import path from "path";

import { remove } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import { LOCAL_SKILLS_PATH } from "../../consts";
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
 * Delete a local skill directory at .claude/skills/{skill-id}/
 */
export async function deleteLocalSkill(projectDir: string, skillId: SkillId): Promise<void> {
  if (!validateSkillId(skillId)) {
    warn(`Invalid skill ID for deletion: '${skillId}'`);
    return;
  }

  const skillPath = path.resolve(path.join(projectDir, LOCAL_SKILLS_PATH, skillId));
  const skillsDir = path.resolve(path.join(projectDir, LOCAL_SKILLS_PATH));

  if (!validatePathBoundary(skillPath, skillsDir)) {
    warn(`Skill ID '${skillId}' resolves outside the skills directory.`);
    return;
  }

  try {
    await remove(skillPath);
  } catch {
    // Skill may not exist — silently ignore
  }

  verbose(`Deleted local skill '${skillId}'`);
}
