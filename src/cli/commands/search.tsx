/**
 * Search available skills command.
 *
 * Supports two modes:
 * - Static mode (with query arg): Traditional table output for scripting
 * - Interactive mode (no args or -i flag): Full-screen search with multi-select
 *
 * Interactive mode features:
 * - Live filtering as you type
 * - Multi-select for batch import
 * - Keyboard navigation (arrows, vim keys)
 * - Copy skill link to clipboard
 */
import React from "react";
import { Args, Flags } from "@oclif/core";
import { render } from "ink";
import { printTable } from "@oclif/table";
import path from "path";
import { BaseCommand } from "../base-command.js";
import { loadSkillsMatrixFromSource } from "../lib/source-loader.js";
import { resolveAllSources, type SourceEntry } from "../lib/config.js";
import { fetchFromSource } from "../lib/source-fetcher.js";
import { listDirectories, fileExists, copy, ensureDir } from "../utils/fs.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { SkillSearch, type SkillSearchResult } from "../components/skill-search/index.js";
import type { SourcedSkill } from "../components/skill-search/skill-search.js";
import type { ResolvedSkill } from "../types-matrix.js";
import { LOCAL_SKILLS_PATH } from "../consts.js";

/**
 * Maximum description width for table output
 */
const MAX_DESCRIPTION_WIDTH = 50;

/** Default skills subdirectory in third-party repos */
const DEFAULT_SKILLS_SUBDIR = "skills";

/**
 * Truncate a string to a maximum length with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Check if a skill matches the search query (case-insensitive)
 */
function matchesQuery(skill: ResolvedSkill, query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // Match against name
  if (skill.name.toLowerCase().includes(lowerQuery)) return true;

  // Match against ID
  if (skill.id.toLowerCase().includes(lowerQuery)) return true;

  // Match against alias
  if (skill.alias?.toLowerCase().includes(lowerQuery)) return true;

  // Match against description
  if (skill.description.toLowerCase().includes(lowerQuery)) return true;

  // Match against category
  if (skill.category.toLowerCase().includes(lowerQuery)) return true;

  // Match against tags
  if (skill.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
    return true;
  }

  return false;
}

/**
 * Check if a skill matches the category filter (case-insensitive)
 */
function matchesCategory(skill: ResolvedSkill, category: string): boolean {
  const lowerCategory = category.toLowerCase();
  return skill.category.toLowerCase().includes(lowerCategory);
}

/**
 * Convert ResolvedSkill to SourcedSkill with source attribution
 */
function toSourcedSkill(
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

/**
 * Fetch skills from a third-party source.
 * Returns array of SourcedSkills with source attribution.
 */
async function fetchSkillsFromSource(
  source: SourceEntry,
  forceRefresh: boolean,
): Promise<SourcedSkill[]> {
  try {
    const result = await fetchFromSource(source.url, { forceRefresh });
    const skillsDir = path.join(result.path, DEFAULT_SKILLS_SUBDIR);

    // Check if skills directory exists
    if (!(await fileExists(skillsDir))) {
      return [];
    }

    // List skill directories
    const skillDirs = await listDirectories(skillsDir);
    const skills: SourcedSkill[] = [];

    for (const skillDir of skillDirs) {
      const skillMdPath = path.join(skillsDir, skillDir, "SKILL.md");
      if (await fileExists(skillMdPath)) {
        // Create a minimal skill entry
        skills.push({
          id: skillDir,
          name: skillDir
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
          description: `Skill from ${source.name}`,
          category: "imported",
          categoryExclusive: false,
          tags: [],
          author: "@" + source.name,
          conflictsWith: [],
          recommends: [],
          recommendedBy: [],
          requires: [],
          requiredBy: [],
          alternatives: [],
          discourages: [],
          compatibleWith: [],
          requiresSetup: [],
          providesSetupFor: [],
          sourceName: source.name,
          sourceUrl: source.url,
          path: path.join(skillsDir, skillDir),
        });
      }
    }

    return skills;
  } catch {
    // Source unavailable, return empty
    return [];
  }
}

export default class Search extends BaseCommand {
  static summary = "Search available skills";
  static description =
    "Search skills by name, description, category, or tags. " +
    "Run without arguments or with -i for interactive mode with multi-select.";

  static examples = [
    {
      description: "Search for React skills",
      command: "<%= config.bin %> search react",
    },
    {
      description: "Interactive search mode",
      command: "<%= config.bin %> search",
    },
    {
      description: "Interactive with pre-filled query",
      command: "<%= config.bin %> search -i react",
    },
    {
      description: "Search with category filter",
      command: "<%= config.bin %> search state -c frontend",
    },
  ];

  static args = {
    query: Args.string({
      description: "Search query (matches name, description, category, tags)",
      required: false,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    interactive: Flags.boolean({
      char: "i",
      description: "Launch interactive search with multi-select",
      default: false,
    }),
    category: Flags.string({
      char: "c",
      description: "Filter by category",
      required: false,
    }),
    refresh: Flags.boolean({
      description: "Force refresh from remote sources",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Search);
    const projectDir = process.cwd();

    // Determine mode: interactive if no query or -i flag
    const isInteractive = flags.interactive || !args.query;

    if (isInteractive) {
      await this.runInteractive(args.query, flags.refresh, projectDir);
    } else {
      await this.runStatic(args.query!, flags);
    }
  }

  /**
   * Run interactive search mode with full-screen UI
   */
  private async runInteractive(
    initialQuery: string | undefined,
    forceRefresh: boolean,
    projectDir: string,
  ): Promise<void> {
    this.log("Loading skills from all sources...");

    try {
      // Load primary source skills
      const { matrix, sourcePath } = await loadSkillsMatrixFromSource({
        sourceFlag: undefined,
        projectDir,
        forceRefresh,
      });

      // Convert to SourcedSkills
      const primarySkills = Object.values(matrix.skills).map((skill) =>
        toSourcedSkill(skill, "marketplace", sourcePath),
      );

      // Get configured extra sources
      const { extras } = await resolveAllSources(projectDir);

      // Fetch skills from extra sources
      const extraSkillArrays = await Promise.all(
        extras.map((source) => fetchSkillsFromSource(source, forceRefresh)),
      );

      // Merge all skills (primary first, then extras)
      const allSkills: SourcedSkill[] = [...primarySkills, ...extraSkillArrays.flat()];

      // Total source count
      const sourceCount = 1 + extras.length;

      this.log(`Loaded ${allSkills.length} skills from ${sourceCount} source(s)`);
      this.log("");

      // Render interactive search
      const searchResultPromise = new Promise<SkillSearchResult>((resolve) => {
        const { waitUntilExit } = render(
          <SkillSearch
            skills={allSkills}
            sourceCount={sourceCount}
            initialQuery={initialQuery}
            onComplete={(result) => {
              resolve(result);
            }}
            onCancel={() => {
              resolve({ selectedSkills: [], cancelled: true });
            }}
          />,
        );

        // Also resolve on app exit
        waitUntilExit().then(() => {
          resolve({ selectedSkills: [], cancelled: true });
        });
      });

      const searchResult = await searchResultPromise;

      // Handle result
      if (searchResult.cancelled) {
        this.log("Search cancelled");
        this.exit(EXIT_CODES.CANCELLED);
      }

      if (searchResult.selectedSkills.length === 0) {
        this.log("No skills selected");
        return;
      }

      // Import selected skills
      this.log("");
      this.log(`Importing ${searchResult.selectedSkills.length} skill(s)...`);

      const destDir = path.join(projectDir, LOCAL_SKILLS_PATH);

      for (const skill of searchResult.selectedSkills) {
        if (skill.path) {
          const destPath = path.join(destDir, skill.id);
          await ensureDir(path.dirname(destPath));
          await copy(skill.path, destPath);
          this.logSuccess(`Imported: ${skill.id}`);
        } else {
          this.warn(`Skipping ${skill.id}: No source path available`);
        }
      }

      this.log("");
      this.logSuccess("Import complete!");
      this.log(`Skills location: ${destDir}`);
      this.log("Run 'cc compile' to include imported skills in your agents.");
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Run static search mode with table output
   */
  private async runStatic(
    query: string,
    flags: { source?: string; category?: string },
  ): Promise<void> {
    try {
      this.log("Loading skills...");

      const { matrix, sourcePath, isLocal } = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
      });

      this.log(`Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`);

      // Get all skills as array
      const allSkills = Object.values(matrix.skills);

      // Filter by query
      let results = allSkills.filter((skill) => matchesQuery(skill, query));

      // Apply category filter if provided
      if (flags.category) {
        results = results.filter((skill) => matchesCategory(skill, flags.category as string));
      }

      // Sort results by name
      results.sort((a, b) => a.name.localeCompare(b.name));

      // Display results
      this.log("");
      if (results.length === 0) {
        this.warn(`No skills found matching "${query}"`);
        if (flags.category) {
          this.logInfo(`Category filter: ${flags.category}`);
        }
      } else {
        this.logInfo(
          `Found ${results.length} skill${results.length === 1 ? "" : "s"} matching "${query}"`,
        );
        if (flags.category) {
          this.logInfo(`Category filter: ${flags.category}`);
        }
        this.log("");

        // Use @oclif/table for table output
        printTable({
          data: results.map((skill) => ({
            id: skill.alias || skill.id,
            category: skill.category,
            description: truncate(skill.description, MAX_DESCRIPTION_WIDTH),
          })),
          columns: [
            { key: "id", name: "ID" },
            { key: "category", name: "Category" },
            { key: "description", name: "Description" },
          ],
          headerOptions: { bold: true },
        });
      }
      this.log("");
    } catch (error) {
      this.handleError(error);
    }
  }
}
