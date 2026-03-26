import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../base-command.js";
import { getErrorMessage } from "../utils/errors.js";
import {
  loadSource,
  buildSourceSkillsMap,
  collectScopedSkillDirs,
  generateSkillDiff,
  formatColoredDiff,
  type SkillDiffResult,
} from "../lib/operations/index.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { CLI_BIN_NAME } from "../consts.js";

export default class Diff extends BaseCommand {
  static summary = "Show differences between local forked skills and their source versions";
  static description =
    "Compare local forked skills with their source versions and display differences using unified diff format with colored output";

  static examples = [
    {
      description: "Show diffs for all forked skills",
      command: "<%= config.bin %> <%= command.id %>",
    },
    {
      description: "Show diff for a specific skill",
      command: "<%= config.bin %> <%= command.id %> my-skill",
    },
    {
      description: "Check for diffs without output (exit code only)",
      command: "<%= config.bin %> <%= command.id %> --quiet",
    },
  ];

  static args = {
    skill: Args.string({
      description: "Show diff for specific skill only",
      required: false,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    quiet: Flags.boolean({
      char: "q",
      description: "Suppress output, only return exit code",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Diff);
    const projectDir = process.cwd();
    const { dirs: scopedDirs, hasProject, hasGlobal } = await collectScopedSkillDirs(projectDir);

    if (!hasProject && !hasGlobal) {
      if (!flags.quiet) {
        this.warn(
          `No local skills found. Run '${CLI_BIN_NAME} init' or '${CLI_BIN_NAME} edit' first.`,
        );
      }
      return;
    }

    try {
      if (!flags.quiet) {
        this.log("Loading skills...");
      }

      const { sourceResult } = await loadSource({
        sourceFlag: flags.source,
        projectDir,
      });
      const { matrix, sourcePath, isLocal } = sourceResult;

      if (!flags.quiet) {
        this.log(chalk.dim(`Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`));
      }

      const sourceSkills = buildSourceSkillsMap(matrix);

      let filteredDirs = scopedDirs;
      if (args.skill) {
        filteredDirs = scopedDirs.filter((d) => d.dirName === args.skill);
        if (filteredDirs.length === 0) {
          if (!flags.quiet) {
            this.error(`Skill '${args.skill}' not found in local skills`, {
              exit: EXIT_CODES.ERROR,
            });
          }
        }
      }

      const results: SkillDiffResult[] = [];
      const skillsWithoutForkedFrom: string[] = [];

      for (const { dirName, localSkillsPath } of filteredDirs) {
        const result = await generateSkillDiff(localSkillsPath, dirName, sourcePath, sourceSkills);
        results.push(result);

        if (!result.forkedFrom) {
          skillsWithoutForkedFrom.push(dirName);
        }
      }

      const skillsWithDiffs = results.filter((r) => r.hasDiff);

      if (!flags.quiet) {
        this.log("");

        if (skillsWithoutForkedFrom.length > 0) {
          for (const skillName of skillsWithoutForkedFrom) {
            this.warn(`Skill '${skillName}' has no forkedFrom metadata - cannot compare`);
          }
          this.log("");
        }

        const forkedSkills = results.filter((r) => r.forkedFrom);

        if (forkedSkills.length === 0) {
          this.logInfo("No forked skills to compare.");
        } else if (skillsWithDiffs.length === 0) {
          this.logSuccess(`All ${forkedSkills.length} forked skill(s) are up to date with source.`);
        } else {
          for (const result of skillsWithDiffs) {
            this.log(
              chalk.bold(
                `\n=== ${result.skillDirName} (forked from ${result.forkedFrom?.skillId}) ===\n`,
              ),
            );
            this.log(formatColoredDiff(result.diffOutput));
          }

          this.log("");
          this.logInfo(
            `Found differences in ${chalk.yellow(String(skillsWithDiffs.length))} skill(s).`,
          );
        }

        this.log("");
      }

      if (skillsWithDiffs.length > 0) {
        this.exit(EXIT_CODES.ERROR);
      }
      this.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      if (!flags.quiet) {
        const message = getErrorMessage(error);
        this.error(`Failed to compare skills: ${message}`, {
          exit: EXIT_CODES.ERROR,
        });
      } else {
        this.exit(EXIT_CODES.ERROR);
      }
    }
  }
}
