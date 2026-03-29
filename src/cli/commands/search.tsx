import { Args, Flags } from "@oclif/core";
import { printTable } from "@oclif/table";
import { render } from "ink";
import path from "path";
import { sortBy } from "remeda";

import { BaseCommand } from "../base-command.js";
import {
  SkillSearch,
  type SkillSearchResult,
  type SourcedSkill,
} from "../components/skill-search/index.js";
import { DEFAULT_SKILLS_SUBDIR, LOCAL_SKILLS_PATH, STANDARD_FILES } from "../consts.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { resolveAllSources } from "../lib/configuration/index.js";
import { loadSource } from "../lib/operations/index.js";
import { fetchFromSource, parseFrontmatter } from "../lib/loading/index.js";
import type { SourceEntry } from "../types/config.js";
import type { CategoryPath, ResolvedSkill, SkillSlug } from "../types/index.js";
import { copy, ensureDir, fileExists, listDirectories, readFile } from "../utils/fs.js";
import { SUCCESS_MESSAGES, STATUS_MESSAGES, INFO_MESSAGES } from "../utils/messages.js";
import { truncateText } from "../utils/string.js";

const MAX_DESCRIPTION_WIDTH = 50;

export default class Search extends BaseCommand {
  static summary = "Search available skills";
  static description =
    "Search skills by ID, alias, description, or category. " +
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
      description: "Search query (matches name, description, category)",
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
    json: Flags.boolean({
      description: "Output results as JSON",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Search);
    const projectDir = process.cwd();

    const isInteractive = !flags.json && (flags.interactive || !args.query);

    if (isInteractive) {
      await this.runInteractive(args.query, flags.refresh, projectDir);
    } else {
      await this.runStatic(args.query ?? "", flags);
    }
  }

  private async runInteractive(
    initialQuery: string | undefined,
    forceRefresh: boolean,
    projectDir: string,
  ): Promise<void> {
    try {
      const { allSkills, sourceCount } = await this.loadAllSourceSkills(forceRefresh, projectDir);
      const searchResult = await this.showSearchUI(allSkills, sourceCount, initialQuery);

      if (searchResult.cancelled) {
        this.log("Search cancelled");
        this.exit(EXIT_CODES.CANCELLED);
      }

      if (searchResult.selectedSkills.length === 0) {
        this.log("No skills selected");
        return;
      }

      await this.importSelectedSkills(searchResult.selectedSkills, projectDir);
    } catch (error) {
      this.handleError(error);
    }
  }

  private async loadAllSourceSkills(
    forceRefresh: boolean,
    projectDir: string,
  ): Promise<{ allSkills: SourcedSkill[]; sourceCount: number }> {
    this.log("Loading skills from all sources...");

    const { sourceResult } = await loadSource({
      sourceFlag: undefined,
      projectDir,
      forceRefresh,
    });
    const { matrix, sourcePath } = sourceResult;

    const primarySkills = Object.values(matrix.skills)
      .filter((skill): skill is ResolvedSkill => skill !== undefined)
      .map((skill) => toSourcedSkill(skill, "marketplace", sourcePath));

    const { extras } = await resolveAllSources(projectDir);

    const extraSkillArrays = await Promise.all(
      extras.map((source) => fetchSkillsFromExternalSource(source, forceRefresh)),
    );

    const allSkills: SourcedSkill[] = [...primarySkills, ...extraSkillArrays.flat()];
    const sourceCount = 1 + extras.length;

    this.log(`Loaded ${allSkills.length} skills from ${sourceCount} source(s)`);
    this.log("");

    return { allSkills, sourceCount };
  }

  private async showSearchUI(
    allSkills: SourcedSkill[],
    sourceCount: number,
    initialQuery: string | undefined,
  ): Promise<SkillSearchResult> {
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

      waitUntilExit().then(() => {
        resolve({ selectedSkills: [], cancelled: true });
      });
    });

    return searchResultPromise;
  }

  private async importSelectedSkills(skills: SourcedSkill[], projectDir: string): Promise<void> {
    this.log("");
    this.log(`Importing ${skills.length} skill(s)...`);

    const copyResults = await copySearchedSkillsToLocal(skills, projectDir);

    for (const result of copyResults) {
      if (result.copied) {
        this.logSuccess(`Imported: ${result.id}`);
      } else {
        this.warn(`Skipping ${result.id}: ${result.reason}`);
      }
    }

    const destDir = path.join(projectDir, LOCAL_SKILLS_PATH);
    this.log("");
    this.logSuccess(SUCCESS_MESSAGES.IMPORT_COMPLETE);
    this.log(`Skills location: ${destDir}`);
    this.log(INFO_MESSAGES.RUN_COMPILE);
  }

  private async runStatic(
    query: string,
    flags: { source?: string; category?: string; json?: boolean },
  ): Promise<void> {
    try {
      if (!flags.json) this.log(STATUS_MESSAGES.LOADING_SKILLS);

      const { sourceResult } = await loadSource({
        sourceFlag: flags.source,
        projectDir: process.cwd(),
      });
      const { matrix, sourcePath, isLocal } = sourceResult;

      if (!flags.json) this.log(`Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`);

      const allSkills = Object.values(matrix.skills).filter(
        (skill): skill is ResolvedSkill => skill !== undefined,
      );

      const results = sortBy(
        filterSkillsByQuery(allSkills, { query, category: flags.category }),
        (r) => r.displayName.toLowerCase(),
      );

      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              query,
              category: flags.category ?? null,
              results: results.map((skill) => ({
                id: skill.id,
                displayName: skill.displayName,
                category: skill.category,
                description: skill.description,
              })),
              total: results.length,
            },
            null,
            2,
          ),
        );
        return;
      }

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

        printTable({
          data: results.map((skill) => ({
            id: skill.displayName,
            category: skill.category,
            description: truncateText(skill.description, MAX_DESCRIPTION_WIDTH),
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

type FilterSkillsOptions = {
  query: string;
  category?: string;
};

type CopySearchedSkillResult = {
  id: string;
  copied: boolean;
  /** Reason when `copied` is false */
  reason?: string;
};

async function fetchSkillsFromExternalSource(
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

function filterSkillsByQuery(
  skills: ResolvedSkill[],
  options: FilterSkillsOptions,
): ResolvedSkill[] {
  let results = skills.filter((skill) => matchesQuery(skill, options.query));

  const category = options.category;
  if (category) {
    results = results.filter((skill) => matchesCategory(skill, category));
  }

  return results;
}

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

async function copySearchedSkillsToLocal(
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
