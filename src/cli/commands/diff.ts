import { Args, Flags } from "@oclif/core";
import path from "path";
import chalk from "chalk";
import { createTwoFilesPatch } from "diff";
import { BaseCommand } from "../base-command.js";
import { getErrorMessage } from "../utils/errors.js";
import {
  loadSource,
  buildSourceSkillsMap,
  collectScopedSkillDirs,
  type ScopedSkillDir,
} from "../lib/operations/index.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { CLI_BIN_NAME, LOCAL_SKILLS_PATH, STANDARD_FILES } from "../consts.js";
import { readForkedFromMetadata, type ForkedFromMetadata } from "../lib/skills/index.js";
import { fileExists, readFile } from "../utils/fs.js";

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

    const scopedDirs = await this.loadScopedDirs(projectDir, flags.quiet);
    if (!scopedDirs) return;

    try {
      const { sourceResult, sourceSkills } = await this.loadSource(flags, projectDir);
      const filteredDirs = this.filterBySkillArg(args.skill, scopedDirs, flags.quiet);
      const results = await this.generateDiffs(filteredDirs, sourceResult.sourcePath, sourceSkills);
      this.reportResults(results, flags.quiet);
    } catch (error) {
      if (!flags.quiet) {
        this.error(`Failed to compare skills: ${getErrorMessage(error)}`, {
          exit: EXIT_CODES.ERROR,
        });
      } else {
        this.exit(EXIT_CODES.ERROR);
      }
    }
  }

  private async loadScopedDirs(
    projectDir: string,
    quiet: boolean,
  ): Promise<ScopedSkillDir[] | null> {
    const { dirs, hasProject, hasGlobal } = await collectScopedSkillDirs(projectDir);

    if (!hasProject && !hasGlobal) {
      if (!quiet) {
        this.warn(
          `No local skills found. Run '${CLI_BIN_NAME} init' or '${CLI_BIN_NAME} edit' first.`,
        );
      }
      return null;
    }

    return dirs;
  }

  private async loadSource(
    flags: { source?: string; quiet: boolean },
    projectDir: string,
  ): Promise<{
    sourceResult: { sourcePath: string; isLocal: boolean };
    sourceSkills: Record<string, { path: string }>;
  }> {
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
    return { sourceResult: { sourcePath, isLocal }, sourceSkills };
  }

  private filterBySkillArg(
    skillArg: string | undefined,
    scopedDirs: ScopedSkillDir[],
    quiet: boolean,
  ): ScopedSkillDir[] {
    if (!skillArg) return scopedDirs;

    const filtered = scopedDirs.filter((d) => d.dirName === skillArg);
    if (filtered.length === 0) {
      if (!quiet) {
        this.error(`Skill '${skillArg}' not found in local skills`, {
          exit: EXIT_CODES.ERROR,
        });
      }
    }
    return filtered;
  }

  private async generateDiffs(
    dirs: ScopedSkillDir[],
    sourcePath: string,
    sourceSkills: Record<string, { path: string }>,
  ): Promise<SkillDiffResult[]> {
    const results: SkillDiffResult[] = [];
    for (const { dirName, localSkillsPath } of dirs) {
      const result = await generateSkillDiff(localSkillsPath, dirName, sourcePath, sourceSkills);
      results.push(result);
    }
    return results;
  }

  private reportResults(results: SkillDiffResult[], quiet: boolean): void {
    const skillsWithDiffs = results.filter((r) => r.hasDiff);
    const skillsWithoutForkedFrom = results.filter((r) => !r.forkedFrom).map((r) => r.skillDirName);

    if (!quiet) {
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
  }
}

type SkillDiffResult = {
  skillDirName: string;
  forkedFrom: ForkedFromMetadata | null;
  hasDiff: boolean;
  diffOutput: string;
};

async function generateSkillDiff(
  localSkillsPath: string,
  skillDirName: string,
  sourcePath: string,
  sourceSkills: Record<string, { path: string }>,
): Promise<SkillDiffResult> {
  const skillDir = path.join(localSkillsPath, skillDirName);
  const forkedFrom = await readForkedFromMetadata(skillDir);

  if (!forkedFrom) {
    return {
      skillDirName,
      forkedFrom: null,
      hasDiff: false,
      diffOutput: "",
    };
  }

  const sourceSkill = sourceSkills[forkedFrom.skillId];

  if (!sourceSkill) {
    return {
      skillDirName,
      forkedFrom,
      hasDiff: false,
      diffOutput: `Source skill '${forkedFrom.skillId}' no longer exists`,
    };
  }

  const sourceSkillMdPath = path.join(sourcePath, "src", sourceSkill.path, STANDARD_FILES.SKILL_MD);

  if (!(await fileExists(sourceSkillMdPath))) {
    return {
      skillDirName,
      forkedFrom,
      hasDiff: false,
      diffOutput: `Source ${STANDARD_FILES.SKILL_MD} not found at ${sourceSkillMdPath}`,
    };
  }

  const sourceContent = await readFile(sourceSkillMdPath);

  const localSkillMdPath = path.join(skillDir, STANDARD_FILES.SKILL_MD);

  if (!(await fileExists(localSkillMdPath))) {
    return {
      skillDirName,
      forkedFrom,
      hasDiff: false,
      diffOutput: `Local ${STANDARD_FILES.SKILL_MD} not found at ${localSkillMdPath}`,
    };
  }

  const localContent = await readFile(localSkillMdPath);

  const sourceLabel = `source/${sourceSkill.path}/SKILL.md`;
  const localLabel = `local/${LOCAL_SKILLS_PATH}/${skillDirName}/SKILL.md`;

  const diff = createTwoFilesPatch(
    sourceLabel,
    localLabel,
    sourceContent,
    localContent,
    "", // No source header
    "", // No local header
  );

  const hasDiff = diff.split("\n").some((line) => {
    return (
      (line.startsWith("+") || line.startsWith("-")) &&
      !line.startsWith("+++") &&
      !line.startsWith("---")
    );
  });

  return {
    skillDirName,
    forkedFrom,
    hasDiff,
    diffOutput: diff,
  };
}

function formatColoredDiff(diffText: string): string {
  return diffText
    .split("\n")
    .map((line) => {
      if (line.startsWith("+++") || line.startsWith("---")) {
        return chalk.bold(line);
      }
      if (line.startsWith("+")) {
        return chalk.green(line);
      }
      if (line.startsWith("-")) {
        return chalk.red(line);
      }
      if (line.startsWith("@@")) {
        return chalk.cyan(line);
      }
      return line;
    })
    .join("\n");
}
