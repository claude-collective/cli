import path from "path";

import { copy, ensureDir } from "../../utils/fs";
import { warn } from "../../utils/logger";
import { computeFileHash } from "../versioning";
import { STANDARD_FILES } from "../../consts";
import type { MergedSkillsMatrix, ResolvedSkill, SkillId } from "../../types";
import type { SourceLoadResult } from "../loading";
import { injectForkedFromMetadata } from "./skill-metadata";

export type CopiedSkill = {
  skillId: SkillId;
  contentHash: string;
  sourcePath: string;
  destPath: string;
  local?: boolean;
};

const NULL_BYTE_PATTERN = /\0/;

/**
 * Validate that a resolved path stays within the expected parent directory.
 * Prevents path traversal attacks where skill.path contains sequences like "../../sensitive".
 */
export function validateSkillPath(
  resolvedPath: string,
  expectedParent: string,
  skillPath: string,
): void {
  if (NULL_BYTE_PATTERN.test(skillPath)) {
    throw new Error(`Invalid skill path: '${skillPath}' contains null bytes`);
  }

  const normalizedResolved = path.resolve(resolvedPath);
  const normalizedParent = path.resolve(expectedParent);

  if (
    !normalizedResolved.startsWith(normalizedParent + path.sep) &&
    normalizedResolved !== normalizedParent
  ) {
    throw new Error(
      `Invalid skill path: '${skillPath}' escapes expected directory '${normalizedParent}'`,
    );
  }
}

/**
 * Join basePath + skillPath, validate the result stays within basePath,
 * and return the resolved path. Combines path.join + validateSkillPath
 * to eliminate repeated join-then-validate boilerplate.
 */
function resolveSkillPath(basePath: string, skillPath: string): string {
  const resolved = path.join(basePath, skillPath);
  validateSkillPath(resolved, basePath, skillPath);
  return resolved;
}

function getSkillSourcePath(skill: ResolvedSkill, registryRoot: string): string {
  const srcDir = path.join(registryRoot, "src");
  return resolveSkillPath(srcDir, skill.path);
}

function getSkillDestPath(skill: ResolvedSkill, stackDir: string): string {
  const skillRelativePath = skill.path.replace(/^skills\//, "");
  const skillsDir = path.join(stackDir, "skills");
  return resolveSkillPath(skillsDir, skillRelativePath);
}

async function generateSkillHash(skillSourcePath: string): Promise<string> {
  const skillMdPath = path.join(skillSourcePath, STANDARD_FILES.SKILL_MD);
  return computeFileHash(skillMdPath);
}

export async function copySkill(
  skill: ResolvedSkill,
  stackDir: string,
  registryRoot: string,
): Promise<CopiedSkill> {
  const sourcePath = getSkillSourcePath(skill, registryRoot);
  const destPath = getSkillDestPath(skill, stackDir);

  const contentHash = await generateSkillHash(sourcePath);

  await ensureDir(path.dirname(destPath));
  await copy(sourcePath, destPath);

  await injectForkedFromMetadata(destPath, skill.id, contentHash);

  return {
    skillId: skill.id,
    contentHash,
    sourcePath,
    destPath,
  };
}

function getSkillSourcePathFromSource(
  skill: ResolvedSkill,
  sourceResult: SourceLoadResult,
): string {
  const srcDir = path.join(sourceResult.sourcePath, "src");
  return resolveSkillPath(srcDir, skill.path);
}

export async function copySkillFromSource(
  skill: ResolvedSkill,
  stackDir: string,
  sourceResult: SourceLoadResult,
): Promise<CopiedSkill> {
  const sourcePath = getSkillSourcePathFromSource(skill, sourceResult);
  const destPath = getSkillDestPath(skill, stackDir);

  const contentHash = await generateSkillHash(sourcePath);

  await ensureDir(path.dirname(destPath));
  await copy(sourcePath, destPath);

  await injectForkedFromMetadata(destPath, skill.id, contentHash);

  return {
    skillId: skill.id,
    contentHash,
    sourcePath,
    destPath,
  };
}

export type CopyProgressCallback = (completed: number, total: number) => void;

export async function copySkillsToPluginFromSource(
  selectedSkillIds: SkillId[],
  pluginDir: string,
  matrix: MergedSkillsMatrix,
  sourceResult: SourceLoadResult,
  sourceSelections?: Partial<Record<SkillId, string>>,
  onProgress?: CopyProgressCallback,
): Promise<CopiedSkill[]> {
  const total = selectedSkillIds.length;
  let completed = 0;
  const results = await Promise.all(
    selectedSkillIds.map(async (skillId): Promise<CopiedSkill | null> => {
      const skill = matrix.skills[skillId];
      if (!skill) {
        warn(`Skill not found in matrix: '${skillId}'`);
        completed++;
        onProgress?.(completed, total);
        return null;
      }

      const selectedSource = sourceSelections?.[skillId];
      const userSelectedRemote = selectedSource && selectedSource !== "local";

      let result: CopiedSkill;
      if (skill.local && skill.localPath && !userSelectedRemote) {
        const localSkillPath = path.join(process.cwd(), skill.localPath);
        const contentHash = await generateSkillHash(localSkillPath);

        result = {
          skillId: skill.id,
          sourcePath: skill.localPath,
          destPath: skill.localPath,
          contentHash,
          local: true,
        };
      } else {
        result = await copySkillFromSource(skill, pluginDir, sourceResult);
      }

      completed++;
      onProgress?.(completed, total);
      return result;
    }),
  );

  return results.filter((r): r is CopiedSkill => r !== null);
}

function getFlattenedSkillDestPath(skill: ResolvedSkill, localSkillsDir: string): string {
  return resolveSkillPath(localSkillsDir, skill.id);
}

async function copySkillToLocalFlattened(
  skill: ResolvedSkill,
  localSkillsDir: string,
  sourceResult: SourceLoadResult,
): Promise<CopiedSkill> {
  const sourcePath = getSkillSourcePathFromSource(skill, sourceResult);
  const destPath = getFlattenedSkillDestPath(skill, localSkillsDir);

  const contentHash = await generateSkillHash(sourcePath);

  await ensureDir(path.dirname(destPath));
  await copy(sourcePath, destPath);

  await injectForkedFromMetadata(destPath, skill.id, contentHash);

  return {
    skillId: skill.id,
    contentHash,
    sourcePath,
    destPath,
  };
}

export async function copySkillsToLocalFlattened(
  selectedSkillIds: SkillId[],
  localSkillsDir: string,
  matrix: MergedSkillsMatrix,
  sourceResult: SourceLoadResult,
  sourceSelections?: Partial<Record<SkillId, string>>,
): Promise<CopiedSkill[]> {
  const results = await Promise.all(
    selectedSkillIds.map(async (skillId): Promise<CopiedSkill | null> => {
      const skill = matrix.skills[skillId];
      if (!skill) {
        warn(`Skill not found in matrix: '${skillId}'`);
        return null;
      }

      const selectedSource = sourceSelections?.[skillId];
      const userSelectedRemote = selectedSource && selectedSource !== "local";

      if (skill.local && skill.localPath && !userSelectedRemote) {
        const localSkillPath = path.join(process.cwd(), skill.localPath);
        const contentHash = await generateSkillHash(localSkillPath);

        return {
          skillId: skill.id,
          sourcePath: skill.localPath,
          destPath: skill.localPath,
          contentHash,
          local: true,
        };
      }

      return copySkillToLocalFlattened(skill, localSkillsDir, sourceResult);
    }),
  );

  return results.filter((r): r is CopiedSkill => r !== null);
}
