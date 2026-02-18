import path from "path";
import { sortBy } from "remeda";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { fileExists, readFile, writeFile, listDirectories } from "../../utils/fs";
import { computeFileHash } from "../versioning";
import { getCurrentDate } from "../versioning";
import {
  LOCAL_SKILLS_PATH,
  SCHEMA_PATHS,
  STANDARD_FILES,
  YAML_FORMATTING,
  yamlSchemaComment,
} from "../../consts";
import type { SkillId } from "../../types";
import { formatZodErrors, localSkillMetadataSchema } from "../schemas";
import { warn } from "../../utils/logger";

/**
 * Tracks the original marketplace source of a locally-installed skill.
 *
 * Written into each skill's metadata.yaml under the `forked_from` key when a skill
 * is copied from a source repository to the local `.claude/skills/` directory.
 * Used for version comparison, update detection, and provenance tracking.
 */
export type ForkedFromMetadata = {
  /** Canonical skill ID from the source repository (e.g., "cc-ts-react-hook-form") */
  skill_id: SkillId;
  /** SHA-256 hash of the source SKILL.md content at the time of installation */
  content_hash: string;
  /** ISO date string (YYYY-MM-DD) when the skill was installed or last updated */
  date: string;
};

/**
 * Full metadata.yaml content for a locally-installed skill.
 *
 * Parsed from the `metadata.yaml` file in each skill directory under `.claude/skills/`.
 * Uses an index signature to preserve unknown fields written by other tools.
 */
export type LocalSkillMetadata = {
  /** Provenance metadata linking back to the original source skill, if any */
  forked_from?: ForkedFromMetadata;
  /** If true, this skill was installed by the Agents Inc. CLI (safe to remove on uninstall) */
  generatedByAgentsInc?: boolean;
  [key: string]: unknown;
};

/**
 * Result of comparing a local skill against its source repository version.
 *
 * Produced by {@link compareLocalSkillsWithSource} for each skill in the local
 * `.claude/skills/` directory. Used by `agentsinc outdated` to display update status.
 */
export type SkillComparisonResult = {
  /** Canonical skill ID (from forked_from metadata, or directory name if no metadata) */
  id: SkillId;
  /** SHA-256 hash of the local SKILL.md content at install time, null if no forked_from metadata */
  localHash: string | null;
  /** SHA-256 hash of the current source SKILL.md, null if source skill no longer exists */
  sourceHash: string | null;
  /** "current" if hashes match, "outdated" if they differ, "local-only" if no source link */
  status: "current" | "outdated" | "local-only";
  /** Directory name under `.claude/skills/` (may differ from skill ID for aliased skills) */
  dirName: string;
  /** Relative path within the source repository, present only when the source skill exists */
  sourcePath?: string;
};

/**
 * Reads forked-from metadata from a skill's metadata.yaml file.
 *
 * This metadata tracks the original marketplace source of a locally-installed skill,
 * enabling version comparison and update detection via content hash matching.
 *
 * @param skillDir - Absolute path to the skill directory (e.g., `/project/.claude/skills/react-hook-form`)
 * @returns The `forked_from` metadata if present and valid, `null` if the file doesn't exist,
 *          has no `forked_from` field, or fails Zod validation (warns on invalid metadata)
 *
 * @example
 * ```ts
 * const metadata = await readForkedFromMetadata("/project/.claude/skills/react-hook-form");
 * if (metadata) {
 *   console.log(`Installed from ${metadata.skill_id} on ${metadata.date}`);
 * }
 * ```
 */
export async function readForkedFromMetadata(skillDir: string): Promise<ForkedFromMetadata | null> {
  const metadataPath = path.join(skillDir, STANDARD_FILES.METADATA_YAML);

  if (!(await fileExists(metadataPath))) {
    return null;
  }

  const content = await readFile(metadataPath);
  const result = localSkillMetadataSchema.safeParse(parseYaml(content));

  if (!result.success) {
    warn(`Invalid metadata.yaml at ${metadataPath}: ${formatZodErrors(result.error.issues)}`);
    return null;
  }

  return (result.data as LocalSkillMetadata).forked_from ?? null;
}

/**
 * Reads the full local skill metadata from a skill's metadata.yaml file.
 *
 * Returns the parsed metadata including `generatedByAgentsInc` and `forked_from` fields.
 * Used by the uninstall command to determine whether a skill was created by the CLI.
 *
 * @param skillDir - Absolute path to the skill directory
 * @returns The parsed metadata if valid, `null` if the file doesn't exist or is invalid
 */
export async function readLocalSkillMetadata(
  skillDir: string,
): Promise<LocalSkillMetadata | null> {
  const metadataPath = path.join(skillDir, STANDARD_FILES.METADATA_YAML);

  if (!(await fileExists(metadataPath))) {
    return null;
  }

  const content = await readFile(metadataPath);
  const result = localSkillMetadataSchema.safeParse(parseYaml(content));

  if (!result.success) {
    warn(`Invalid metadata.yaml at ${metadataPath}: ${formatZodErrors(result.error.issues)}`);
    return null;
  }

  return result.data as LocalSkillMetadata;
}

/**
 * Scans all local skill directories and reads their forked-from metadata.
 *
 * Enumerates every subdirectory under `{projectDir}/.claude/skills/` and reads
 * the `forked_from` field from each skill's metadata.yaml. The returned Map is
 * keyed by skill ID (from `forked_from.skill_id` if available, otherwise the
 * directory name).
 *
 * @param projectDir - Absolute path to the project root containing `.claude/skills/`
 * @returns Map from skill identifier to its directory name and forked-from metadata.
 *          Returns an empty Map if the skills directory doesn't exist.
 *
 * @example
 * ```ts
 * const skills = await getLocalSkillsWithMetadata("/project");
 * for (const [id, { dirName, forkedFrom }] of skills) {
 *   console.log(`${id} in ${dirName}, forked: ${forkedFrom !== null}`);
 * }
 * ```
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
 * Computes the SHA-256 content hash of a skill's SKILL.md in a source repository.
 *
 * Used to compare the current source version against the locally-installed version's
 * `content_hash` to detect whether updates are available.
 *
 * @param sourcePath - Absolute path to the source repository root
 * @param skillPath - Relative path to the skill within `src/` (e.g., "web/react/react-hook-form")
 * @returns SHA-256 hash string of the source SKILL.md, or `null` if the file doesn't exist
 */
export async function computeSourceHash(
  sourcePath: string,
  skillPath: string,
): Promise<string | null> {
  const skillMdPath = path.join(sourcePath, "src", skillPath, STANDARD_FILES.SKILL_MD);

  if (!(await fileExists(skillMdPath))) {
    return null;
  }

  return computeFileHash(skillMdPath);
}

/**
 * Compares all local skills against their source repository versions.
 *
 * For each skill in `{projectDir}/.claude/skills/`, reads its `forked_from` metadata
 * and computes the current source hash. Skills are classified as:
 * - **"current"** -- local content hash matches the source (no update available)
 * - **"outdated"** -- hashes differ (source has been updated since installation)
 * - **"local-only"** -- no `forked_from` metadata, or the source skill no longer exists
 *
 * Results are sorted alphabetically by skill ID.
 *
 * @param projectDir - Absolute path to the project root containing `.claude/skills/`
 * @param sourcePath - Absolute path to the source repository root (used to locate SKILL.md files)
 * @param sourceSkills - Map of skill IDs to their relative paths within the source repository.
 *                       Typically built from the skills matrix. Keys are skill IDs, values have
 *                       a `path` field (e.g., `{ path: "web/react/react-hook-form" }`)
 * @returns Array of comparison results, one per local skill, sorted by skill ID
 *
 * @example
 * ```ts
 * const results = await compareLocalSkillsWithSource(
 *   "/project",
 *   "/tmp/source-repo",
 *   { "cc-ts-react-hook-form": { path: "web/react/react-hook-form" } },
 * );
 * const outdated = results.filter((r) => r.status === "outdated");
 * ```
 */
export async function compareLocalSkillsWithSource(
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

  return sortBy(results, (r) => r.id);
}

/**
 * Writes forked-from provenance metadata into a skill's metadata.yaml.
 *
 * Reads the existing metadata.yaml (preserving any extra fields), sets the
 * `forked_from` block with the given skill ID, content hash, and current date,
 * then writes the file back with a YAML language server schema comment.
 *
 * Called during skill installation (by the skill copier) to record where a
 * locally-installed skill originated from.
 *
 * @param destPath - Absolute path to the skill directory containing metadata.yaml.
 *                   The file must already exist (created during skill copy).
 * @param skillId - Canonical skill ID from the source repository (e.g., "cc-ts-react-hook-form")
 * @param contentHash - SHA-256 hash of the source SKILL.md content at install time
 *
 * @remarks
 * **Side effect:** Overwrites `{destPath}/metadata.yaml` on disk. Existing fields
 * are preserved if the file parses successfully; if parsing fails, only `forked_from`
 * is written (with a warning logged).
 */
export async function injectForkedFromMetadata(
  destPath: string,
  skillId: SkillId,
  contentHash: string,
): Promise<void> {
  const metadataPath = path.join(destPath, STANDARD_FILES.METADATA_YAML);
  const rawContent = await readFile(metadataPath);

  const lines = rawContent.split("\n");
  let yamlContent = rawContent;

  if (lines[0]?.startsWith("# yaml-language-server:")) {
    yamlContent = lines.slice(1).join("\n");
  }

  const parseResult = localSkillMetadataSchema.safeParse(parseYaml(yamlContent));
  if (!parseResult.success) {
    warn(`Malformed metadata.yaml at '${metadataPath}' — existing fields may be lost`);
  }
  const metadata: LocalSkillMetadata = parseResult.success
    ? (parseResult.data as LocalSkillMetadata)
    : { forked_from: undefined };

  metadata.forked_from = {
    skill_id: skillId,
    content_hash: contentHash,
    date: getCurrentDate(),
  };
  metadata.generatedByAgentsInc = true;

  const schemaComment = `${yamlSchemaComment(SCHEMA_PATHS.metadata)}\n`;
  const newYamlContent = stringifyYaml(metadata, { lineWidth: YAML_FORMATTING.LINE_WIDTH_NONE });
  await writeFile(metadataPath, `${schemaComment}${newYamlContent}`);
}
