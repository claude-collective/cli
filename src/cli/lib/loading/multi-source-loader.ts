import path from "path";

import { SKILLS_DIR_PATH } from "../../consts";
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
import { discoverAllPluginSkills } from "../plugins";
import { fetchFromSource } from "./source-fetcher";

/** Default source name for skills from the primary (public) marketplace repository */
const PUBLIC_SOURCE_NAME = "public";

/**
 * Annotates every skill in the matrix with multi-source availability metadata.
 *
 * Runs a five-phase tagging pipeline that mutates `primaryMatrix.skills` in place:
 * 1. **Public** -- tags all skills with a "public" source entry
 * 2. **Local** -- tags skills with `local: true` as installed via local source
 * 3. **Plugin** -- detects plugin-installed skills via `settings.json` and global cache
 * 4. **Extra sources** -- fetches each configured extra source and tags matching skills
 * 5. **Active source** -- sets `activeSource` to the installed variant, or first available
 *
 * After this function completes, each skill in the matrix has `availableSources` (all
 * known sources) and `activeSource` (the one currently in use) populated.
 *
 * @param primaryMatrix - The merged skills matrix to annotate. Mutated in place --
 *                        `availableSources` and `activeSource` are set on each skill.
 * @param _sourceConfig - Reserved for future per-source configuration (currently unused)
 * @param projectDir - Absolute path to the project root, used to locate plugin directories
 *                     and resolve extra source configurations
 *
 * @remarks
 * **Side effects:** Mutates `primaryMatrix` in place. May perform network requests
 * to fetch extra source repositories (via giget). Errors from individual extra sources
 * are warned and skipped -- the function never throws.
 */
export async function loadSkillsFromAllSources(
  primaryMatrix: MergedSkillsMatrix,
  _sourceConfig: ResolvedConfig,
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
  for (const [, skill] of typedEntries(matrix.skills)) {
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

/** Detect plugin-installed skills and tag them across all plugin directories */
async function tagPluginSkills(matrix: MergedSkillsMatrix, projectDir: string): Promise<void> {
  const allPluginSkillIds = await collectPluginSkillIds(matrix, projectDir);

  if (allPluginSkillIds.length === 0) {
    return;
  }

  for (const skillId of allPluginSkillIds) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;

    skill.availableSources = skill.availableSources ?? [];

    // Mark the existing source as installed via plugin
    const existingSource = skill.availableSources.find((s) => s.type === "public");
    if (existingSource && !existingSource.installMode) {
      existingSource.installed = true;
      existingSource.installMode = "plugin";
    } else if (!skill.availableSources.some((s) => s.installMode === "plugin")) {
      // No existing source to mark -- add a public source with plugin install mode
      skill.availableSources.push({
        name: PUBLIC_SOURCE_NAME,
        type: "public",
        version: skill.version,
        installed: true,
        installMode: "plugin",
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
  const skillIds = Object.keys(pluginSkills) as SkillId[];

  if (skillIds.length === 0) {
    verbose("No plugin skills discovered from settings.json");
  }

  return skillIds;
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
      warn(`Failed to load extra source '${extraSource.name}' ('${extraSource.url}'): ${error}`);
    }
  }
}

/** Set activeSource on each skill to the installed variant, or "public" as default */
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
      warn(`Failed to search extra source '${source.name}' ('${source.url}'): ${error}`);
    }
  }

  return candidates;
}
