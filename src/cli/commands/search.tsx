import { Args, Flags } from "@oclif/core";
import { printTable } from "@oclif/table";
import { render } from "ink";
import path from "path";
import { sortBy } from "remeda";

import { BaseCommand } from "../base-command.js";
import { SkillSearch, type SkillSearchResult } from "../components/skill-search/index.js";
import type { SourcedSkill } from "../components/skill-search/skill-search.js";
import { DEFAULT_SKILLS_SUBDIR, LOCAL_SKILLS_PATH, STANDARD_FILES } from "../consts.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { resolveAllSources, type SourceEntry } from "../lib/configuration/index.js";
import { loadSkillsMatrixFromSource, fetchFromSource } from "../lib/loading/index.js";
import type { CategoryPath, ResolvedSkill, SkillId } from "../types/index.js";
import { listDirectories, fileExists, copy, ensureDir } from "../utils/fs.js";
import {
  SUCCESS_MESSAGES,
  STATUS_MESSAGES,
  INFO_MESSAGES,
} from "../utils/messages.js";

const MAX_DESCRIPTION_WIDTH = 50;

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

function matchesQuery(skill: ResolvedSkill, query: string): boolean {
  const lowerQuery = query.toLowerCase();

  if (skill.id.toLowerCase().includes(lowerQuery)) return true;
  if (skill.displayName?.toLowerCase().includes(lowerQuery)) return true;
  if (skill.description.toLowerCase().includes(lowerQuery)) return true;
  if (skill.category.toLowerCase().includes(lowerQuery)) return true;

  if (skill.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
    return true;
  }

  return false;
}

function matchesCategory(skill: ResolvedSkill, category: CategoryPath): boolean {
  const lowerCategory = category.toLowerCase();
  return skill.category.toLowerCase().includes(lowerCategory);
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

async function fetchSkillsFromSource(
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
      if (await fileExists(skillMdPath)) {
        skills.push({
          // Directory name is an untyped string — cast at data boundary
          id: skillDir as SkillId,
          description: `Skill from ${source.name}`,
          // Synthetic category for third-party sources — not in CategoryPath union
          category: "imported" as CategoryPath,
          categoryExclusive: false,
          tags: [],
          author: "@" + source.name,
          conflictsWith: [],
          recommends: [],
          requires: [],
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
    "Search skills by ID, alias, description, category, or tags. " +
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

    const isInteractive = flags.interactive || !args.query;

    if (isInteractive) {
      await this.runInteractive(args.query, flags.refresh, projectDir);
    } else {
      await this.runStatic(args.query!, flags);
    }
  }

  private async runInteractive(
    initialQuery: string | undefined,
    forceRefresh: boolean,
    projectDir: string,
  ): Promise<void> {
    this.log("Loading skills from all sources...");

    try {
      const { matrix, sourcePath } = await loadSkillsMatrixFromSource({
        sourceFlag: undefined,
        projectDir,
        forceRefresh,
      });

      const primarySkills = Object.values(matrix.skills)
        .filter((skill): skill is ResolvedSkill => skill !== undefined)
        .map((skill) => toSourcedSkill(skill, "marketplace", sourcePath));

      const { extras } = await resolveAllSources(projectDir);

      const extraSkillArrays = await Promise.all(
        extras.map((source) => fetchSkillsFromSource(source, forceRefresh)),
      );

      const allSkills: SourcedSkill[] = [...primarySkills, ...extraSkillArrays.flat()];
      const sourceCount = 1 + extras.length;

      this.log(`Loaded ${allSkills.length} skills from ${sourceCount} source(s)`);
      this.log("");

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

      const searchResult = await searchResultPromise;

      if (searchResult.cancelled) {
        this.log("Search cancelled");
        this.exit(EXIT_CODES.CANCELLED);
      }

      if (searchResult.selectedSkills.length === 0) {
        this.log("No skills selected");
        return;
      }

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
      this.logSuccess(SUCCESS_MESSAGES.IMPORT_COMPLETE);
      this.log(`Skills location: ${destDir}`);
      this.log(INFO_MESSAGES.RUN_COMPILE);
    } catch (error) {
      this.handleError(error);
    }
  }

  private async runStatic(
    query: string,
    flags: { source?: string; category?: string },
  ): Promise<void> {
    try {
      this.log(STATUS_MESSAGES.LOADING_SKILLS);

      const { matrix, sourcePath, isLocal } = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
      });

      this.log(`Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`);

      const allSkills = Object.values(matrix.skills).filter(
        (skill): skill is ResolvedSkill => skill !== undefined,
      );

      let results = allSkills.filter((skill) => matchesQuery(skill, query));

      if (flags.category) {
        // CLI flag is an untyped string — cast at data boundary
        results = results.filter((skill) => matchesCategory(skill, flags.category as CategoryPath));
      }

      results = sortBy(results, (r) => r.displayName || r.id);

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
            id: skill.displayName || skill.id,
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
