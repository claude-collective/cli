import path from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { sortBy } from "remeda";
import { fileExists, readFile, writeFile, listDirectories } from "../utils/fs";
import { hashFile } from "./versioning";
import { getCurrentDate } from "./versioning";
import { LOCAL_SKILLS_PATH } from "../consts";
import type { SkillId } from "../types";
import { localSkillMetadataSchema } from "./schemas";
import { warn } from "../utils/logger";

/**
 * ForkedFrom metadata stored in local skill's metadata.yaml
 */
export type ForkedFromMetadata = {
  skill_id: SkillId;
  content_hash: string;
  date: string;
};

/**
 * Local skill metadata structure
 */
export type LocalSkillMetadata = {
  forked_from?: ForkedFromMetadata;
  [key: string]: unknown;
};

/**
 * Result of comparing a local skill to its source
 */
export type SkillComparisonResult = {
  id: SkillId;
  localHash: string | null;
  sourceHash: string | null;
  status: "current" | "outdated" | "local-only";
  dirName: string;
  sourcePath?: string;
};

/**
 * Read forked_from metadata from a local skill's metadata.yaml
 */
export async function readForkedFromMetadata(skillDir: string): Promise<ForkedFromMetadata | null> {
  const metadataPath = path.join(skillDir, "metadata.yaml");

  if (!(await fileExists(metadataPath))) {
    return null;
  }

  const content = await readFile(metadataPath);
  const result = localSkillMetadataSchema.safeParse(parseYaml(content));

  if (!result.success) {
    warn(
      `Invalid metadata.yaml at ${metadataPath}: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
    return null;
  }

  return (result.data as LocalSkillMetadata).forked_from ?? null;
}

/**
 * Get local skills with their forked_from metadata
 */
export async function getLocalSkillsWithMetadata(
  projectDir: string,
): Promise<Map<string, { dirName: string; forkedFrom: ForkedFromMetadata | null }>> {
  const localSkillsPath = path.join(projectDir, LOCAL_SKILLS_PATH);
  const result = new Map<string, { dirName: string; forkedFrom: ForkedFromMetadata | null }>();

  if (!(await fileExists(localSkillsPath))) {
    return result;
  }

  const skillDirs = await listDirectories(localSkillsPath);

  for (const dirName of skillDirs) {
    const skillDir = path.join(localSkillsPath, dirName);
    const forkedFrom = await readForkedFromMetadata(skillDir);

    // Use the skill_id from forked_from if available, otherwise use directory name
    const skillId = forkedFrom?.skill_id ?? dirName;

    result.set(skillId, { dirName, forkedFrom });
  }

  return result;
}

/**
 * Compute source hash for a skill's SKILL.md file
 */
export async function computeSourceHash(
  sourcePath: string,
  skillPath: string,
): Promise<string | null> {
  const skillMdPath = path.join(sourcePath, "src", skillPath, "SKILL.md");

  if (!(await fileExists(skillMdPath))) {
    return null;
  }

  return hashFile(skillMdPath);
}

/**
 * Compare local skills against source and determine status
 */
export async function compareSkills(
  projectDir: string,
  sourcePath: string,
  sourceSkills: Record<string, { path: string }>,
): Promise<SkillComparisonResult[]> {
  const results: SkillComparisonResult[] = [];
  const localSkills = await getLocalSkillsWithMetadata(projectDir);

  for (const [skillId, { dirName, forkedFrom }] of localSkills) {
    if (!forkedFrom) {
      // Local-only skill (no forked_from metadata)
      // Boundary cast: skillId comes from Map<string, ...> keys (directory names or forkedFrom.skill_id)
      results.push({
        id: skillId as SkillId,
        localHash: null,
        sourceHash: null,
        status: "local-only",
        dirName,
      });
      continue;
    }

    const localHash = forkedFrom.content_hash;
    const sourceSkill = sourceSkills[forkedFrom.skill_id];

    if (!sourceSkill) {
      // Skill was forked from a source that no longer exists
      results.push({
        id: forkedFrom.skill_id,
        localHash,
        sourceHash: null,
        status: "local-only",
        dirName,
      });
      continue;
    }

    const sourceHash = await computeSourceHash(sourcePath, sourceSkill.path);

    if (sourceHash === null) {
      results.push({
        id: forkedFrom.skill_id,
        localHash,
        sourceHash: null,
        status: "local-only",
        dirName,
      });
      continue;
    }

    const status = localHash === sourceHash ? "current" : "outdated";

    results.push({
      id: forkedFrom.skill_id,
      localHash,
      sourceHash,
      status,
      dirName,
      sourcePath: sourceSkill.path,
    });
  }

  // Sort results by skill ID
  return sortBy(results, (r) => r.id);
}

/**
 * Inject or update forked_from metadata in a skill's metadata.yaml.
 */
export async function injectForkedFromMetadata(
  destPath: string,
  skillId: SkillId,
  contentHash: string,
): Promise<void> {
  const metadataPath = path.join(destPath, "metadata.yaml");
  const rawContent = await readFile(metadataPath);

  const lines = rawContent.split("\n");
  let yamlContent = rawContent;

  if (lines[0]?.startsWith("# yaml-language-server:")) {
    yamlContent = lines.slice(1).join("\n");
  }

  const parseResult = localSkillMetadataSchema.safeParse(parseYaml(yamlContent));
  const metadata: LocalSkillMetadata = parseResult.success
    ? (parseResult.data as LocalSkillMetadata)
    : { forked_from: undefined };

  metadata.forked_from = {
    skill_id: skillId,
    content_hash: contentHash,
    date: getCurrentDate(),
  };

  const newYamlContent = stringifyYaml(metadata, { lineWidth: 0 });
  await writeFile(metadataPath, newYamlContent);
}
