import { Args, Flags } from "@oclif/core";
import { printTable } from "@oclif/table";
import { render } from "ink";
import path from "path";
import { sortBy } from "remeda";

import { BaseCommand } from "../base-command.js";
import { SkillSearch, type SkillSearchResult } from "../components/skill-search/index.js";
import { LOCAL_SKILLS_PATH } from "../consts.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { resolveAllSources } from "../lib/configuration/index.js";
import {
  loadSource,
  fetchSkillsFromExternalSource,
  filterSkillsByQuery,
  toSourcedSkill,
  copySearchedSkillsToLocal,
  type SourcedSkill,
} from "../lib/operations/index.js";
import type { ResolvedSkill } from "../types/index.js";
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

      const copyResults = await copySearchedSkillsToLocal(searchResult.selectedSkills, projectDir);

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

      const { sourceResult } = await loadSource({
        sourceFlag: flags.source,
        projectDir: process.cwd(),
      });
      const { matrix, sourcePath, isLocal } = sourceResult;

      this.log(`Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`);

      const allSkills = Object.values(matrix.skills).filter(
        (skill): skill is ResolvedSkill => skill !== undefined,
      );

      const results = sortBy(
        filterSkillsByQuery(allSkills, { query, category: flags.category }),
        (r) => r.displayName.toLowerCase(),
      );

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
