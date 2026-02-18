import path from "path";

import { DEFAULT_PUBLIC_SOURCE_NAME, SKILLS_DIR_PATH } from "../../consts";
import type {
  BoundSkillCandidate,
  MergedSkillsMatrix,
  SkillAlias,
  SkillId,
  SkillSource,
  SkillSourceType,
} from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { verbose, warn } from "../../utils/logger";
import { typedEntries, typedKeys } from "../../utils/typed-object";
import {
  DEFAULT_SOURCE,
  resolveAllSources,
  type ResolvedConfig,
  type SourceEntry,
} from "../configuration";
import { extractAllSkills } from "../matrix";
import { discoverAllPluginSkills } from "../plugins";
import { fetchFromSource, fetchMarketplace } from "./source-fetcher";

/**
 * Annotates every skill in the matrix with multi-source availability metadata.
 *
 * Runs a six-phase tagging pipeline that mutates `primaryMatrix.skills` in place:
 * 1. **Primary** -- tags all skills with the primary source (public or private marketplace)
 * 2. **Local** -- tags skills with `local: true` as installed via local source
 * 3. **Plugin** -- detects plugin-installed skills via `settings.json` and global cache
 * 4. **Public fallback** -- when primary is a private marketplace, fetches the default
 *    public source and tags matching skills so users can switch between sources
 * 5. **Extra sources** -- fetches each configured extra source and tags matching skills
 * 6. **Active source** -- sets `activeSource` to the installed variant, or first available
 *
 * After this function completes, each skill in the matrix has `availableSources` (all
 * known sources) and `activeSource` (the one currently in use) populated.
 *
 * @param primaryMatrix - The merged skills matrix to annotate. Mutated in place --
 *                        `availableSources` and `activeSource` are set on each skill.
 * @param sourceConfig - Resolved source configuration, used to determine whether the
 *                       primary source is a private marketplace or the default public source
 * @param projectDir - Absolute path to the project root, used to locate plugin directories
 *                     and resolve extra source configurations
 * @param forceRefresh - Whether to bypass cached source data
 * @param marketplace - Optional marketplace name resolved from the source's marketplace.json.
 *                      Takes precedence over `sourceConfig.marketplace` when provided.
 *
 * @remarks
 * **Side effects:** Mutates `primaryMatrix` in place. May perform network requests
 * to fetch extra source repositories (via giget). Errors from individual extra sources
 * are warned and skipped -- the function never throws.
 */
export async function loadSkillsFromAllSources(
  primaryMatrix: MergedSkillsMatrix,
  sourceConfig: ResolvedConfig,
  projectDir: string,
  forceRefresh = false,
  marketplace?: string,
): Promise<void> {
  const resolvedMarketplace = marketplace ?? sourceConfig.marketplace;
  const isDefaultPublicSource = sourceConfig.source === DEFAULT_SOURCE;

  const primarySourceName = resolvedMarketplace ?? DEFAULT_PUBLIC_SOURCE_NAME;
  const primarySourceType: SkillSourceType = isDefaultPublicSource ? "public" : "private";

  tagPrimarySourceSkills(primaryMatrix, primarySourceName, primarySourceType);
  tagLocalSkills(primaryMatrix);
  await tagPluginSkills(primaryMatrix, projectDir, primarySourceName, primarySourceType);

  if (!isDefaultPublicSource) {
    await tagPublicSourceSkills(primaryMatrix, forceRefresh);
  }

  await tagExtraSources(primaryMatrix, projectDir, forceRefresh);
  setActiveSources(primaryMatrix);
}

function tagPrimarySourceSkills(
  matrix: MergedSkillsMatrix,
  sourceName: string,
  sourceType: SkillSourceType,
): void {
  for (const [, skill] of typedEntries(matrix.skills)) {
    if (!skill) continue;

    const source: SkillSource = {
      name: sourceName,
      type: sourceType,
      version: skill.version,
      installed: false,
      primary: true,
    };

    skill.availableSources = skill.availableSources ?? [];
    skill.availableSources.push(source);
  }
}

function tagLocalSkills(matrix: MergedSkillsMatrix): void {
  let count = 0;
  for (const [, skill] of typedEntries(matrix.skills)) {
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

async function tagPluginSkills(
  matrix: MergedSkillsMatrix,
  projectDir: string,
  primarySourceName: string,
  primarySourceType: SkillSourceType,
): Promise<void> {
  const allPluginSkillIds = await collectPluginSkillIds(matrix, projectDir);

  if (allPluginSkillIds.length === 0) {
    return;
  }

  for (const skillId of allPluginSkillIds) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;

    skill.availableSources = skill.availableSources ?? [];

    const existingSource = skill.availableSources.find((s) => s.name === primarySourceName);
    if (existingSource && !existingSource.installMode) {
      existingSource.installed = true;
      existingSource.installMode = "plugin";
    } else if (!skill.availableSources.some((s) => s.installMode === "plugin")) {
      skill.availableSources.push({
        name: primarySourceName,
        type: primarySourceType,
        version: skill.version,
        installed: true,
        installMode: "plugin",
        primary: true,
      });
    }
  }

  verbose(`Tagged ${allPluginSkillIds.length} plugin-installed skills`);
}

/**
 * Collects skill IDs from all enabled plugins via settings.json and global cache.
 * Uses {@link discoverAllPluginSkills} to find skills from the plugin registry.
 */
async function collectPluginSkillIds(
  _matrix: MergedSkillsMatrix,
  projectDir: string,
): Promise<SkillId[]> {
  const pluginSkills = await discoverAllPluginSkills(projectDir);
  const skillIds = typedKeys<SkillId>(pluginSkills);

  if (skillIds.length === 0) {
    verbose("No plugin skills discovered from settings.json");
  }

  return skillIds;
}

/**
 * When the primary source is a private marketplace, fetch the default public source
 * and tag matching skills so the user can switch between private and public sources
 * in the Sources step.
 */
async function tagPublicSourceSkills(
  matrix: MergedSkillsMatrix,
  forceRefresh: boolean,
): Promise<void> {
  let publicSourceName = DEFAULT_PUBLIC_SOURCE_NAME;

  try {
    const marketplaceResult = await fetchMarketplace(DEFAULT_SOURCE, { forceRefresh });
    publicSourceName = marketplaceResult.marketplace.name;
    verbose(`Public marketplace name from marketplace.json: ${publicSourceName}`);
  } catch {
    verbose("Public source has no marketplace.json -- using default label");
  }

  try {
    const fetchResult = await fetchFromSource(DEFAULT_SOURCE, { forceRefresh });
    const skillsDir = path.join(fetchResult.path, SKILLS_DIR_PATH);
    const publicSkills = await extractAllSkills(skillsDir);

    let matchCount = 0;
    for (const publicSkill of publicSkills) {
      const matrixSkill = matrix.skills[publicSkill.id];
      if (!matrixSkill) continue;

      const source: SkillSource = {
        name: publicSourceName,
        type: "public",
        installed: false,
      };

      matrixSkill.availableSources = matrixSkill.availableSources ?? [];
      matrixSkill.availableSources.push(source);
      matchCount++;
    }

    verbose(
      `Public source: ${publicSkills.length} skills found, ${matchCount} matching primary matrix`,
    );
  } catch (error) {
    warn(`Failed to load public source for alternative tagging: ${getErrorMessage(error)}`);
  }
}

async function tagExtraSources(
  matrix: MergedSkillsMatrix,
  projectDir: string,
  forceRefresh: boolean,
): Promise<void> {
  let allSources;
  try {
    allSources = await resolveAllSources(projectDir);
  } catch (error) {
    verbose(`Failed to resolve extra sources: ${getErrorMessage(error)}`);
    return;
  }

  if (allSources.extras.length === 0) {
    verbose("No extra sources configured");
    return;
  }

  for (const extraSource of allSources.extras) {
    verbose(`Loading extra source: ${extraSource.name} (${extraSource.url})`);

    try {
      const fetchResult = await fetchFromSource(extraSource.url, { forceRefresh });
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
      warn(`Failed to load extra source '${extraSource.name}' ('${extraSource.url}'): ${getErrorMessage(error)}`);
    }
  }
}

/** Prefers installed source so the wizard shows current state; falls back to first available */
function setActiveSources(matrix: MergedSkillsMatrix): void {
  for (const [, skill] of typedEntries(matrix.skills)) {
    if (!skill) continue;
    if (!skill.availableSources || skill.availableSources.length === 0) continue;

    // Prefer installed source, then fall back to first available
    const installedSource = skill.availableSources.find((s) => s.installed);
    skill.activeSource = installedSource ?? skill.availableSources[0];
  }
}

/**
 * Searches configured extra sources for skills matching a given alias.
 *
 * For each configured source, fetches the repository (using cached data when available),
 * extracts all skill metadata, and matches by the last segment of the skill's directory
 * path against the provided alias (case-insensitive). Used by the wizard's skill search
 * modal to find foreign skills that can be bound to a subcategory.
 *
 * @param alias - Skill alias to search for (e.g., "react", "zustand"). Matched
 *                case-insensitively against the last path segment of each skill's
 *                directory path in the source repository.
 * @param configuredSources - Array of extra source entries from project/global config.
 *                            Each entry has `name` (display name) and `url` (giget-compatible
 *                            source URL like "github:org/repo").
 * @returns Array of matching candidates with skill ID, source URL, source name, alias,
 *          and description. Returns an empty array if no sources are configured or no
 *          matches are found. Never throws -- errors per-source are warned and skipped.
 *
 * @remarks
 * **Side effects:** May perform network requests to fetch source repositories via giget.
 * Uses cached source data when available (controlled by `forceRefresh: false`).
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
      warn(`Failed to search extra source '${source.name}' ('${source.url}'): ${getErrorMessage(error)}`);
    }
  }

  return candidates;
}
