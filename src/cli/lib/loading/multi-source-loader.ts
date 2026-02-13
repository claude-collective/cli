import type {
  BoundSkillCandidate,
  MergedSkillsMatrix,
  SkillAlias,
  SkillId,
  SkillSource,
} from "../../types";
import { verbose, warn } from "../../utils/logger";
import { typedEntries } from "../../utils/typed-object";
import { resolveAllSources, type ResolvedConfig, type SourceEntry } from "../configuration";
import { extractAllSkills } from "../matrix";
import { fetchFromSource } from "./source-fetcher";
import { SKILLS_DIR_PATH } from "../../consts";
import path from "path";
import { getCollectivePluginDir, getPluginSkillIds, getPluginSkillsDir } from "../plugins";
import { directoryExists } from "../../utils/fs";

const PUBLIC_SOURCE_NAME = "public";

/**
 * Loads skill source metadata from all configured sources and annotates
 * each skill in the matrix with its available sources and active source.
 */
export async function loadSkillsFromAllSources(
  primaryMatrix: MergedSkillsMatrix,
  sourceConfig: ResolvedConfig,
  projectDir: string,
): Promise<void> {
  // 1. Tag all primary source skills with "public" source
  tagPrimarySourceSkills(primaryMatrix);

  // 2. Tag local skills
  tagLocalSkills(primaryMatrix);

  // 3. Tag plugin-installed skills
  await tagPluginSkills(primaryMatrix, projectDir);

  // 4. Load and tag extra sources
  await tagExtraSources(primaryMatrix, projectDir);

  // 5. Set activeSource on each skill
  setActiveSources(primaryMatrix);
}

/** Tag all skills in the primary matrix as "public" source */
function tagPrimarySourceSkills(matrix: MergedSkillsMatrix): void {
  for (const [, skill] of typedEntries<SkillId, NonNullable<(typeof matrix.skills)[SkillId]>>(
    matrix.skills as Record<SkillId, NonNullable<(typeof matrix.skills)[SkillId]>>,
  )) {
    if (!skill) continue;

    const source: SkillSource = {
      name: PUBLIC_SOURCE_NAME,
      type: "public",
      version: skill.version,
      installed: false,
    };

    skill.availableSources = skill.availableSources ?? [];
    skill.availableSources.push(source);
  }
}

/** Tag local skills with "local" source and mark as installed */
function tagLocalSkills(matrix: MergedSkillsMatrix): void {
  let count = 0;
  for (const [, skill] of typedEntries<SkillId, NonNullable<(typeof matrix.skills)[SkillId]>>(
    matrix.skills as Record<SkillId, NonNullable<(typeof matrix.skills)[SkillId]>>,
  )) {
    if (!skill) continue;
    if (!skill.local) continue;

    const source: SkillSource = {
      name: "local",
      type: "local",
      installed: true,
      installMode: "local",
    };

    skill.availableSources = skill.availableSources ?? [];
    skill.availableSources.push(source);
    count++;
  }

  verbose(`Tagged ${count} local skills with local source`);
}

/** Detect plugin-installed skills and tag them */
async function tagPluginSkills(matrix: MergedSkillsMatrix, projectDir: string): Promise<void> {
  const pluginDir = getCollectivePluginDir(projectDir);

  if (!(await directoryExists(pluginDir))) {
    verbose("No plugin directory found, skipping plugin skill tagging");
    return;
  }

  const pluginSkillsDir = getPluginSkillsDir(pluginDir);

  if (!(await directoryExists(pluginSkillsDir))) {
    verbose("No plugin skills directory found, skipping plugin skill tagging");
    return;
  }

  try {
    const pluginSkillIds = await getPluginSkillIds(pluginSkillsDir, matrix);

    for (const skillId of pluginSkillIds) {
      const skill = matrix.skills[skillId];
      if (!skill) continue;

      skill.availableSources = skill.availableSources ?? [];

      // Mark the existing source as installed via plugin
      const existingSource = skill.availableSources.find((s) => s.type === "public");
      if (existingSource && !existingSource.installMode) {
        existingSource.installed = true;
        existingSource.installMode = "plugin";
      } else if (!skill.availableSources.some((s) => s.installMode === "plugin")) {
        // No existing source to mark — add a public source with plugin install mode
        skill.availableSources.push({
          name: PUBLIC_SOURCE_NAME,
          type: "public",
          version: skill.version,
          installed: true,
          installMode: "plugin",
        });
      }
    }

    verbose(`Tagged ${pluginSkillIds.length} plugin-installed skills`);
  } catch (error) {
    verbose(`Failed to detect plugin skills: ${error}`);
  }
}

/** Load extra sources from project config and tag matching skills */
async function tagExtraSources(matrix: MergedSkillsMatrix, projectDir: string): Promise<void> {
  let allSources;
  try {
    allSources = await resolveAllSources(projectDir);
  } catch (error) {
    verbose(`Failed to resolve extra sources: ${error}`);
    return;
  }

  if (allSources.extras.length === 0) {
    verbose("No extra sources configured");
    return;
  }

  for (const extraSource of allSources.extras) {
    verbose(`Loading extra source: ${extraSource.name} (${extraSource.url})`);

    try {
      const fetchResult = await fetchFromSource(extraSource.url, { forceRefresh: false });
      const skillsDir = path.join(fetchResult.path, SKILLS_DIR_PATH);
      const skills = await extractAllSkills(skillsDir);

      let matchCount = 0;
      for (const extractedSkill of skills) {
        const matrixSkill = matrix.skills[extractedSkill.id];
        if (!matrixSkill) continue;

        const source: SkillSource = {
          name: extraSource.name,
          type: "private",
          url: extraSource.url,
          installed: false,
        };

        matrixSkill.availableSources = matrixSkill.availableSources ?? [];
        matrixSkill.availableSources.push(source);
        matchCount++;
      }

      verbose(
        `Extra source '${extraSource.name}': ${skills.length} skills found, ${matchCount} matching`,
      );
    } catch (error) {
      warn(`Failed to load extra source '${extraSource.name}' (${extraSource.url}): ${error}`);
    }
  }
}

/** Set activeSource on each skill to the installed variant, or "public" as default */
function setActiveSources(matrix: MergedSkillsMatrix): void {
  for (const [, skill] of typedEntries<SkillId, NonNullable<(typeof matrix.skills)[SkillId]>>(
    matrix.skills as Record<SkillId, NonNullable<(typeof matrix.skills)[SkillId]>>,
  )) {
    if (!skill) continue;
    if (!skill.availableSources || skill.availableSources.length === 0) continue;

    // Prefer installed source, then fall back to first available
    const installedSource = skill.availableSources.find((s) => s.installed);
    skill.activeSource = installedSource ?? skill.availableSources[0];
  }
}

/**
 * Search configured extra sources for skills matching a given alias.
 * Returns candidates with source name, skill ID, and description.
 * Errors per-source are warned and skipped (never throws).
 */
export async function searchExtraSources(
  alias: SkillAlias,
  configuredSources: SourceEntry[],
): Promise<BoundSkillCandidate[]> {
  const candidates: BoundSkillCandidate[] = [];

  if (configuredSources.length === 0) {
    return candidates;
  }

  const lowerAlias = alias.toLowerCase();

  for (const source of configuredSources) {
    try {
      const fetchResult = await fetchFromSource(source.url, { forceRefresh: false });
      const skillsDir = path.join(fetchResult.path, SKILLS_DIR_PATH);
      const skills = await extractAllSkills(skillsDir);

      for (const skill of skills) {
        // Match by last segment of directory path (the alias/display-name convention)
        const segments = skill.directoryPath.split("/");
        const lastSegment = segments[segments.length - 1]?.toLowerCase();

        if (lastSegment === lowerAlias) {
          candidates.push({
            id: skill.id,
            sourceUrl: source.url,
            sourceName: source.name,
            alias,
            description: skill.description,
          });
        }
      }
    } catch (error) {
      warn(`Failed to search extra source '${source.name}' (${source.url}): ${error}`);
    }
  }

  return candidates;
}
