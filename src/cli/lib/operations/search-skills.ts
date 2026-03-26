import path from "path";

import { DEFAULT_SKILLS_SUBDIR, LOCAL_SKILLS_PATH, STANDARD_FILES } from "../../consts.js";
import type { SourceEntry } from "../../types/config.js";
import type { CategoryPath, ResolvedSkill, SkillSlug } from "../../types/index.js";
import { copy, ensureDir, fileExists, listDirectories, readFile } from "../../utils/fs.js";
import { fetchFromSource, parseFrontmatter } from "../loading/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A skill with source provenance info, used for search results and imports. */
export type SourcedSkill = ResolvedSkill & {
  sourceName: string;
  sourceUrl?: string;
};

export type FilterSkillsOptions = {
  query: string;
  category?: string;
};

export type CopySearchedSkillResult = {
  id: string;
  copied: boolean;
  /** Reason when `copied` is false */
  reason?: string;
};

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * Fetches skills from an external (non-primary) source entry.
 *
 * Discovers SKILL.md files in the source's skills directory, parses
 * frontmatter, and returns typed SourcedSkill entries.
 * Returns an empty array when the source is unavailable or has no skills.
 */
export async function fetchSkillsFromExternalSource(
  source: SourceEntry,
  forceRefresh: boolean,
): Promise<SourcedSkill[]> {
  try {
    const result = await fetchFromSource(source.url, { forceRefresh });
    const skillsDir = path.join(result.path, DEFAULT_SKILLS_SUBDIR);

    if (!(await fileExists(skillsDir))) {
      return [];
    }

    const skillDirs = await listDirectories(skillsDir);
    const skills: SourcedSkill[] = [];

    for (const skillDir of skillDirs) {
      const skillMdPath = path.join(skillsDir, skillDir, STANDARD_FILES.SKILL_MD);
      if (!(await fileExists(skillMdPath))) continue;

      const content = await readFile(skillMdPath);
      const frontmatter = parseFrontmatter(content, skillMdPath);
      if (!frontmatter) continue;

      skills.push({
        id: frontmatter.name,
        description: frontmatter.description,
        // Boundary cast: directory name used as slug for third-party source skill
        slug: skillDir as SkillSlug,
        displayName: skillDir,
        // Boundary cast: external source skills have no real category; "imported" is a display-only placeholder
        category: "imported" as CategoryPath,
        author: `@${source.name}`,
        conflictsWith: [],
        isRecommended: false,
        requires: [],
        alternatives: [],
        discourages: [],
        compatibleWith: [],
        sourceName: source.name,
        sourceUrl: source.url,
        path: path.join(skillsDir, skillDir),
      });
    }

    return skills;
  } catch {
    // Source unavailable, return empty
    return [];
  }
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function matchesQuery(skill: ResolvedSkill, query: string): boolean {
  const lowerQuery = query.toLowerCase();

  if (skill.id.toLowerCase().includes(lowerQuery)) return true;
  if (skill.displayName.toLowerCase().includes(lowerQuery)) return true;
  if (skill.slug.toLowerCase().includes(lowerQuery)) return true;
  if (skill.description.toLowerCase().includes(lowerQuery)) return true;
  if (skill.category.toLowerCase().includes(lowerQuery)) return true;

  return false;
}

function matchesCategory(skill: ResolvedSkill, category: string): boolean {
  const lowerCategory = category.toLowerCase();
  return skill.category.toLowerCase().includes(lowerCategory);
}

/**
 * Filters skills by text query and optional category.
 *
 * Matches against id, displayName, slug, description, and category fields.
 */
export function filterSkillsByQuery(
  skills: ResolvedSkill[],
  options: FilterSkillsOptions,
): ResolvedSkill[] {
  let results = skills.filter((skill) => matchesQuery(skill, options.query));

  if (options.category) {
    results = results.filter((skill) => matchesCategory(skill, options.category!));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

/** Converts a ResolvedSkill to a SourcedSkill by attaching source provenance. */
export function toSourcedSkill(
  skill: ResolvedSkill,
  sourceName: string,
  sourceUrl?: string,
): SourcedSkill {
  return {
    ...skill,
    sourceName,
    sourceUrl,
  };
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/**
 * Copies selected searched skills to the project's local skills directory.
 *
 * Each skill must have a `path` property pointing to its source directory.
 * Skills without a path are skipped and reported in the result.
 */
export async function copySearchedSkillsToLocal(
  skills: SourcedSkill[],
  projectDir: string,
): Promise<CopySearchedSkillResult[]> {
  const destDir = path.join(projectDir, LOCAL_SKILLS_PATH);
  const results: CopySearchedSkillResult[] = [];

  for (const skill of skills) {
    if (skill.path) {
      const destPath = path.join(destDir, skill.id);
      await ensureDir(path.dirname(destPath));
      await copy(skill.path, destPath);
      results.push({ id: skill.id, copied: true });
    } else {
      results.push({ id: skill.id, copied: false, reason: "No source path available" });
    }
  }

  return results;
}
