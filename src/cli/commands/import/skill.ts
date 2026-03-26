import { Args, Flags } from "@oclif/core";
import path from "path";
import { BaseCommand } from "../../base-command.js";
import { getErrorMessage } from "../../utils/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { directoryExists } from "../../utils/fs.js";
import { DEFAULT_SKILLS_SUBDIR, LOCAL_SKILLS_PATH } from "../../consts.js";
import { STATUS_MESSAGES, INFO_MESSAGES } from "../../utils/messages.js";
import {
  parseGitHubSource,
  fetchSkillSource,
  discoverValidSkills,
  importSkillFromSource,
} from "../../lib/operations/import-skill.js";

export default class ImportSkill extends BaseCommand {
  static summary = "Import a skill from a third-party GitHub repository";
  static description =
    "Download and import skills from external GitHub repositories into your local " +
    ".claude/skills/ directory. Supports importing specific skills or listing available skills.";

  static examples = [
    {
      description: "List available skills from a repository",
      command: "<%= config.bin %> import skill github:vercel-labs/agent-skills --list",
    },
    {
      description: "Import a specific skill",
      command:
        "<%= config.bin %> import skill github:vercel-labs/agent-skills --skill react-best-practices",
    },
    {
      description: "Import all skills from a repository",
      command: "<%= config.bin %> import skill github:vercel-labs/agent-skills --all",
    },
    {
      description: "Import with custom skills directory",
      command:
        "<%= config.bin %> import skill github:owner/repo --skill my-skill --subdir custom-skills",
    },
  ];

  static args = {
    source: Args.string({
      description:
        "GitHub repository source (github:owner/repo, https://github.com/owner/repo, or owner/repo)",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    skill: Flags.string({
      char: "n",
      description: "Name of the specific skill to import",
      required: false,
    }),
    all: Flags.boolean({
      char: "a",
      description: "Import all skills from the repository",
      default: false,
    }),
    list: Flags.boolean({
      char: "l",
      description: "List available skills without importing",
      default: false,
    }),
    subdir: Flags.string({
      description: "Subdirectory containing skills (default: skills)",
      default: DEFAULT_SKILLS_SUBDIR,
    }),
    force: Flags.boolean({
      char: "f",
      description: "Overwrite existing skills",
      default: false,
    }),
    refresh: Flags.boolean({
      description: "Force refresh from remote (ignore cache)",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ImportSkill);
    const projectDir = process.cwd();

    this.log("");
    this.log("Import Third-Party Skill");
    this.log("");

    if (!flags.list && !flags.skill && !flags.all) {
      this.error("Please specify --skill <name>, --all, or --list to list available skills", {
        exit: EXIT_CODES.INVALID_ARGS,
      });
    }

    if (flags.skill && flags.all) {
      this.error("Cannot use --skill and --all together", {
        exit: EXIT_CODES.INVALID_ARGS,
      });
    }

    const { gigetSource, displaySource } = parseGitHubSource(args.source);
    this.log(`Source: ${displaySource}`);

    this.log(STATUS_MESSAGES.FETCHING_REPOSITORY);

    let repoPath: string;
    try {
      const result = await fetchSkillSource({
        gigetSource,
        forceRefresh: flags.refresh,
      });
      repoPath = result.path;
      this.log(result.fromCache ? "Using cached source" : "Downloaded fresh copy");
    } catch (error) {
      this.error(error instanceof Error ? error.message : `Failed to fetch: ${args.source}`, {
        exit: EXIT_CODES.NETWORK_ERROR,
      });
    }

    // Validate --subdir to prevent path traversal outside repository boundary
    const subdir = flags.subdir;
    if (/\0/.test(subdir)) {
      this.error("--subdir contains null bytes", {
        exit: EXIT_CODES.INVALID_ARGS,
      });
    }
    if (path.isAbsolute(subdir)) {
      this.error(`--subdir must be a relative path, got: ${subdir}`, {
        exit: EXIT_CODES.INVALID_ARGS,
      });
    }
    const skillsDir = path.resolve(path.join(repoPath, subdir));
    const resolvedRepoPath = path.resolve(repoPath);
    if (!skillsDir.startsWith(resolvedRepoPath + path.sep) && skillsDir !== resolvedRepoPath) {
      this.error(`--subdir path escapes repository boundary: ${subdir}`, {
        exit: EXIT_CODES.INVALID_ARGS,
      });
    }

    if (!(await directoryExists(skillsDir))) {
      this.error(
        `Skills directory not found: ${flags.subdir}\n` +
          `The repository doesn't have a '${flags.subdir}' directory.\n` +
          `Use --subdir to specify a different location.`,
        { exit: EXIT_CODES.INVALID_ARGS },
      );
    }

    const availableSkills = await discoverValidSkills(skillsDir);

    if (availableSkills.length === 0) {
      this.error(`No valid skills found in ${flags.subdir}/\nSkills must have a SKILL.md file.`, {
        exit: EXIT_CODES.ERROR,
      });
    }

    if (flags.list) {
      this.log("");
      this.log(`Available skills (${availableSkills.length}):`);
      this.log("");
      for (const skill of availableSkills) {
        this.log(`  - ${skill}`);
      }
      this.log("");
      this.log("Use --skill <name> to import a specific skill, or --all to import all.");
      return;
    }

    let skillsToImport: string[] = [];

    if (flags.all) {
      skillsToImport = availableSkills;
    } else if (flags.skill) {
      if (!availableSkills.includes(flags.skill)) {
        this.error(
          `Skill '${flags.skill}' not found in repository.\n` +
            `Available skills: ${availableSkills.join(", ")}\n` +
            `Use --list to see all available skills.`,
          { exit: EXIT_CODES.INVALID_ARGS },
        );
      }
      skillsToImport = [flags.skill];
    }

    const destDir = path.join(projectDir, LOCAL_SKILLS_PATH);

    this.log("");
    this.log(`Importing ${skillsToImport.length} skill(s)...`);

    let imported = 0;
    let skipped = 0;

    for (const skillName of skillsToImport) {
      const sourcePath = path.join(skillsDir, skillName);
      const destPath = path.join(destDir, skillName);

      if (await directoryExists(destPath)) {
        if (!flags.force) {
          this.warn(`Skipping '${skillName}': already exists. Use --force to overwrite.`);
          skipped++;
          continue;
        }
      }

      try {
        await importSkillFromSource({ sourcePath, destPath, skillName, displaySource });
        this.logSuccess(`Imported: ${skillName}`);
        imported++;
      } catch (error) {
        this.warn(`Failed to import '${skillName}': ${getErrorMessage(error)}`);
        skipped++;
      }
    }

    this.log("");
    this.logSuccess(`Import complete: ${imported} imported, ${skipped} skipped`);
    this.log(`Skills location: ${destDir}`);
    this.log("");
    this.log(INFO_MESSAGES.RUN_COMPILE);
    this.log("");
  }
}
