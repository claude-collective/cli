import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import path from "path";
import { createTwoFilesPatch } from "diff";
import { BaseCommand } from "../base-command.js";
import { getErrorMessage } from "../utils/errors.js";
import { loadSkillsMatrixFromSource } from "../lib/loading/index.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { readForkedFromMetadata, type ForkedFromMetadata } from "../lib/skills/index.js";
import { fileExists, readFile, listDirectories } from "../utils/fs.js";
import { CLI_BIN_NAME, LOCAL_SKILLS_PATH, STANDARD_FILES } from "../consts.js";

type SkillDiffResult = {
  skillDirName: string;
  forkedFrom: ForkedFromMetadata | null;
  hasDiff: boolean;
  diffOutput: string;
};

function colorDiff(diffText: string): string {
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

async function diffSkill(
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
    const localSkillsPath = path.join(projectDir, LOCAL_SKILLS_PATH);

    if (!(await fileExists(localSkillsPath))) {
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

      const { matrix, sourcePath, isLocal } = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
        projectDir,
      });

      if (!flags.quiet) {
        this.log(chalk.dim(`Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`));
      }

      const sourceSkills: Record<string, { path: string }> = {};
      for (const [skillId, skill] of Object.entries(matrix.skills)) {
        if (!skill) continue;
        if (!skill.local) {
          sourceSkills[skillId] = { path: skill.path };
        }
      }

      let skillDirs = await listDirectories(localSkillsPath);

      if (args.skill) {
        skillDirs = skillDirs.filter((dir) => dir === args.skill);
        if (skillDirs.length === 0) {
          if (!flags.quiet) {
            this.error(`Skill '${args.skill}' not found in local skills`, {
              exit: EXIT_CODES.ERROR,
            });
          }
        }
      }

      const results: SkillDiffResult[] = [];
      const skillsWithoutForkedFrom: string[] = [];

      for (const skillDirName of skillDirs) {
        const result = await diffSkill(localSkillsPath, skillDirName, sourcePath, sourceSkills);
        results.push(result);

        if (!result.forkedFrom) {
          skillsWithoutForkedFrom.push(skillDirName);
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
            this.log(colorDiff(result.diffOutput));
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
