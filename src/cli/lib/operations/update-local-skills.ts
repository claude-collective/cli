import path from "path";
import { copy } from "../../utils/fs.js";
import { getErrorMessage } from "../../utils/errors.js";
import { injectForkedFromMetadata } from "../skills/index.js";
import { LOCAL_SKILLS_PATH } from "../../consts.js";
import type { SourceLoadResult } from "../loading/source-loader.js";
import type { SkillComparisonResult } from "../skills/index.js";

export type SkillUpdateResult = {
  id: string;
  success: boolean;
  newHash: string | null;
  error?: string;
};

export type UpdateLocalSkillsResult = {
  updated: SkillUpdateResult[];
  failed: SkillUpdateResult[];
  totalUpdated: number;
  totalFailed: number;
};

export type UpdateLocalSkillsOptions = {
  skills: SkillComparisonResult[];
  sourceResult: SourceLoadResult;
  skillBaseDir: Map<string, string>;
  /** Called before each skill update starts. Use for progress logging. */
  onProgress?: (skillId: string) => void;
};

/**
 * Updates local skills by copying from source and injecting metadata.
 *
 * For each outdated skill, copies the source version to the local skills
 * directory and injects forked-from metadata for change tracking.
 */
export async function updateLocalSkills(
  options: UpdateLocalSkillsOptions,
): Promise<UpdateLocalSkillsResult> {
  const { skills, sourceResult, skillBaseDir, onProgress } = options;
  const updated: SkillUpdateResult[] = [];
  const failed: SkillUpdateResult[] = [];

  for (const skill of skills) {
    onProgress?.(skill.id);
    if (!skill.sourcePath || !skill.sourceHash) {
      failed.push({
        id: skill.id,
        success: false,
        newHash: null,
        error: "No source path available",
      });
      continue;
    }

    const baseDir = skillBaseDir.get(skill.id) ?? process.cwd();
    const localSkillsPath = path.join(baseDir, LOCAL_SKILLS_PATH);
    const destPath = path.join(localSkillsPath, skill.dirName);
    const srcPath = path.join(sourceResult.sourcePath, "src", skill.sourcePath);

    try {
      await copy(srcPath, destPath);
      await injectForkedFromMetadata(destPath, skill.id, skill.sourceHash);
      updated.push({ id: skill.id, success: true, newHash: skill.sourceHash });
    } catch (error) {
      failed.push({ id: skill.id, success: false, newHash: null, error: getErrorMessage(error) });
    }
  }

  return {
    updated,
    failed,
    totalUpdated: updated.length,
    totalFailed: failed.length,
  };
}
