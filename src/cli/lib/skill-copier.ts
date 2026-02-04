import path from "path";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import { copy, ensureDir, readFile, writeFile } from "../utils/fs";
import { hashFile } from "./versioning";
import type { MergedSkillsMatrix, ResolvedSkill } from "../types-matrix";
import type { SourceLoadResult } from "./source-loader";

interface ForkedFromMetadata {
  skill_id: string;
  content_hash: string;
  date: string;
}

interface SkillMetadata {
  content_hash?: string;
  forked_from?: ForkedFromMetadata;
  [key: string]: unknown;
}

const METADATA_FILE_NAME = "metadata.yaml";

export interface CopiedSkill {
  skillId: string;
  contentHash: string;
  sourcePath: string;
  destPath: string;
  local?: boolean;
}

function getSkillSourcePath(
  skill: ResolvedSkill,
  registryRoot: string,
): string {
  return path.join(registryRoot, "src", skill.path);
}

function getSkillDestPath(skill: ResolvedSkill, stackDir: string): string {
  const skillRelativePath = skill.path.replace(/^skills\//, "");
  return path.join(stackDir, "skills", skillRelativePath);
}

async function generateSkillHash(skillSourcePath: string): Promise<string> {
  const skillMdPath = path.join(skillSourcePath, "SKILL.md");
  return hashFile(skillMdPath);
}

function getCurrentDate(): string {
  return new Date().toISOString().split("T")[0];
}

async function injectForkedFromMetadata(
  destPath: string,
  skillId: string,
  contentHash: string,
): Promise<void> {
  const metadataPath = path.join(destPath, METADATA_FILE_NAME);
  const rawContent = await readFile(metadataPath);

  const lines = rawContent.split("\n");
  let yamlContent = rawContent;

  if (lines[0]?.startsWith("# yaml-language-server:")) {
    yamlContent = lines.slice(1).join("\n");
  }

  const metadata = parseYaml(yamlContent) as SkillMetadata;

  metadata.forked_from = {
    skill_id: skillId,
    content_hash: contentHash,
    date: getCurrentDate(),
  };

  const newYamlContent = stringifyYaml(metadata, { lineWidth: 0 });
  await writeFile(metadataPath, newYamlContent);
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
  return path.join(sourceResult.sourcePath, "src", skill.path);
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

export async function copySkillsToPluginFromSource(
  selectedSkillIds: string[],
  pluginDir: string,
  matrix: MergedSkillsMatrix,
  sourceResult: SourceLoadResult,
): Promise<CopiedSkill[]> {
  const copiedSkills: CopiedSkill[] = [];

  for (const skillId of selectedSkillIds) {
    const skill = matrix.skills[skillId];
    if (!skill) {
      console.warn(`Warning: Skill not found in matrix: ${skillId}`);
      continue;
    }

    if (skill.local && skill.localPath) {
      const localSkillPath = path.join(process.cwd(), skill.localPath);
      const contentHash = await generateSkillHash(localSkillPath);

      copiedSkills.push({
        skillId: skill.id,
        sourcePath: skill.localPath,
        destPath: skill.localPath,
        contentHash,
        local: true,
      });
      continue;
    }

    const copied = await copySkillFromSource(skill, pluginDir, sourceResult);
    copiedSkills.push(copied);
  }

  return copiedSkills;
}

/**
 * Get the destination path for a skill when copying to local flattened structure.
 *
 * Uses the normalized skill ID (kebab-case) as the folder name.
 *
 * @example
 * // skill.id = "web-framework-react"
 * // Returns: "{localSkillsDir}/web-framework-react"
 */
function getFlattenedSkillDestPath(
  skill: ResolvedSkill,
  localSkillsDir: string,
): string {
  return path.join(localSkillsDir, skill.id);
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
  selectedSkillIds: string[],
  localSkillsDir: string,
  matrix: MergedSkillsMatrix,
  sourceResult: SourceLoadResult,
): Promise<CopiedSkill[]> {
  const copiedSkills: CopiedSkill[] = [];

  for (const skillId of selectedSkillIds) {
    const skill = matrix.skills[skillId];
    if (!skill) {
      console.warn(`Warning: Skill not found in matrix: ${skillId}`);
      continue;
    }

    if (skill.local && skill.localPath) {
      const localSkillPath = path.join(process.cwd(), skill.localPath);
      const contentHash = await generateSkillHash(localSkillPath);

      copiedSkills.push({
        skillId: skill.id,
        sourcePath: skill.localPath,
        destPath: skill.localPath,
        contentHash,
        local: true,
      });
      continue;
    }

    const copied = await copySkillToLocalFlattened(
      skill,
      localSkillsDir,
      sourceResult,
    );
    copiedSkills.push(copied);
  }

  return copiedSkills;
}
