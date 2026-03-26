import path from "path";
import { fileExists, readFile } from "../../utils/fs.js";
import { discoverLocalSkills } from "../skills/index.js";
import { STANDARD_FILES } from "../../consts.js";
import type { ResolvedSkill, SkillId, SkillSlug } from "../../types/index.js";
import { truncateText } from "../../utils/string.js";

const CONTENT_PREVIEW_LINES = 10;
const MAX_LINE_LENGTH = 80;
const MAX_SUGGESTIONS = 5;

export type ResolvedSkillInfo = {
  skill: ResolvedSkill;
  isInstalled: boolean;
  preview: string[];
};

export type SkillInfoResult = {
  resolved: ResolvedSkillInfo | null;
  suggestions: string[];
};

export type ResolveSkillInfoOptions = {
  /** The skill ID, slug, or search query from user input */
  query: string;
  /** Full skills map from the loaded matrix */
  skills: Partial<Record<SkillId, ResolvedSkill>>;
  /** Slug-to-ID lookup map from the loaded matrix */
  slugToId: Partial<Record<SkillSlug, SkillId>>;
  /** Project directory for local skill discovery */
  projectDir: string;
  /** Resolved source path from loadSource */
  sourcePath: string;
  /** Whether the source is local */
  isLocal: boolean;
  /** Whether to load the content preview */
  includePreview: boolean;
};

/**
 * Strips YAML frontmatter delimiters and content from markdown.
 */
function stripFrontmatter(content: string): string {
  const lines = content.split("\n");
  let inFrontmatter = false;
  let frontmatterEndIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "---") {
      if (!inFrontmatter) {
        inFrontmatter = true;
      } else {
        frontmatterEndIndex = i + 1;
        break;
      }
    }
  }

  return lines.slice(frontmatterEndIndex).join("\n");
}

/**
 * Extracts the first N non-empty lines from markdown content (after frontmatter).
 */
function getPreviewLines(content: string, maxLines: number): string[] {
  const body = stripFrontmatter(content);
  const lines = body.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    if (result.length >= maxLines) break;
    if (line.trim() || result.length > 0) {
      result.push(truncateText(line, MAX_LINE_LENGTH));
    }
  }

  return result;
}

/**
 * Finds similar skill names for "did you mean" suggestions.
 */
function findSuggestions(
  skills: Partial<Record<SkillId, ResolvedSkill>>,
  query: string,
  maxSuggestions: number,
): string[] {
  const lowerQuery = query.toLowerCase();
  const matches: string[] = [];

  for (const skill of Object.values(skills)) {
    if (!skill) continue;
    if (matches.length >= maxSuggestions) break;
    if (
      skill.id.toLowerCase().includes(lowerQuery) ||
      skill.displayName.toLowerCase().includes(lowerQuery) ||
      skill.slug.toLowerCase().includes(lowerQuery)
    ) {
      matches.push(skill.id);
    }
  }

  return matches;
}

/**
 * Resolves complete skill information for display.
 *
 * Looks up the skill by ID or slug, discovers local installation status,
 * and optionally loads a content preview from SKILL.md.
 */
export async function resolveSkillInfo(options: ResolveSkillInfoOptions): Promise<SkillInfoResult> {
  const { query, skills, slugToId, projectDir, sourcePath, isLocal, includePreview } = options;

  // CLI arg is an untyped string — try as skill ID first, then as slug
  const slugResolvedId = slugToId[query as SkillSlug];
  const skill =
    skills[query as SkillId] ?? (slugResolvedId ? skills[slugResolvedId] : undefined);

  if (!skill) {
    const suggestions = findSuggestions(skills, query, MAX_SUGGESTIONS);
    return { resolved: null, suggestions };
  }

  const localSkillsResult = await discoverLocalSkills(projectDir);
  const localSkillIds = localSkillsResult?.skills.map((s) => s.id) || [];
  const isInstalled = localSkillIds.includes(skill.id);

  let preview: string[] = [];
  if (includePreview) {
    let skillMdPath: string;

    if (skill.local && skill.localPath) {
      skillMdPath = path.join(projectDir, skill.localPath, STANDARD_FILES.SKILL_MD);
    } else {
      const sourceDir = isLocal ? sourcePath : path.dirname(sourcePath);
      skillMdPath = path.join(sourceDir, skill.path, STANDARD_FILES.SKILL_MD);
    }

    if (await fileExists(skillMdPath)) {
      const content = await readFile(skillMdPath);
      preview = getPreviewLines(content, CONTENT_PREVIEW_LINES);
    }
  }

  return {
    resolved: { skill, isInstalled, preview },
    suggestions: [],
  };
}
