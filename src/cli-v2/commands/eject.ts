import { Args, Flags } from "@oclif/core";
import path from "path";
import os from "os";
import { BaseCommand } from "../base-command.js";
import {
  copy,
  ensureDir,
  directoryExists,
  fileExists,
  writeFile,
} from "../utils/fs.js";
import { DIRS, PROJECT_ROOT } from "../consts.js";
import {
  getCollectivePluginDir,
  getPluginSkillsDir,
} from "../lib/plugin-finder.js";
import { EXIT_CODES } from "../lib/exit-codes.js";

const EJECT_TYPES = ["templates", "config", "skills", "agents", "all"] as const;
type EjectType = (typeof EJECT_TYPES)[number];

const DEFAULT_CONFIG_CONTENT = `# Claude Collective Configuration
# Agent-skill mappings for this project

name: my-project
description: Project description

# Agents to compile
agents:
  - web-developer
  - api-developer
  - web-tester
  - web-pm

# Agent-specific skill assignments (optional)
# If not specified, all available skills are given to all agents
agent_skills:
  web-developer:
    - react
    - zustand
    - scss-modules
  api-developer:
    - hono
    - drizzle
    - better-auth
`;

export default class Eject extends BaseCommand {
  static summary = "Eject bundled content for local customization";
  static description =
    "Copy templates, config, skills, or agent partials to your project for customization";

  static args = {
    type: Args.string({
      description: "What to eject: templates, config, skills, agents, all",
      required: false,
      options: EJECT_TYPES as unknown as string[],
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    force: Flags.boolean({
      char: "f",
      description: "Overwrite existing files",
      default: false,
    }),
    output: Flags.string({
      char: "o",
      description: "Output directory (default: .claude/ in current directory)",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Eject);
    const projectDir = process.cwd();

    if (!args.type) {
      this.error(
        "Please specify what to eject: templates, config, skills, agents, or all",
        { exit: EXIT_CODES.INVALID_ARGS },
      );
    }

    if (!EJECT_TYPES.includes(args.type as EjectType)) {
      this.error(`Unknown eject type: ${args.type}`, {
        exit: EXIT_CODES.INVALID_ARGS,
      });
    }

    // Resolve output base directory
    let outputBase: string;
    if (flags.output) {
      // Expand ~ to home directory if present
      const expandedPath = flags.output.startsWith("~")
        ? path.join(os.homedir(), flags.output.slice(1))
        : flags.output;
      outputBase = path.resolve(projectDir, expandedPath);

      // Validate output path is not an existing file
      if (await fileExists(outputBase)) {
        this.error(`Output path exists as a file: ${outputBase}`, {
          exit: EXIT_CODES.INVALID_ARGS,
        });
      }
    } else {
      outputBase = path.join(projectDir, ".claude");
    }

    this.log("");
    this.log("Claude Collective Eject");
    this.log("");

    // Show output directory when using custom path
    if (flags.output) {
      this.log(`Output directory: ${outputBase}`);
    }

    const ejectType = args.type as EjectType;
    const directOutput = !!flags.output;

    switch (ejectType) {
      case "templates":
        await this.ejectTemplates(outputBase, flags.force, directOutput);
        break;
      case "config":
        await this.ejectConfig(outputBase, flags.force, directOutput);
        break;
      case "skills":
        await this.ejectSkills(outputBase, flags.force, directOutput);
        break;
      case "agents":
        await this.ejectAgents(outputBase, flags.force, directOutput);
        break;
      case "all":
        await this.ejectTemplates(outputBase, flags.force, directOutput);
        await this.ejectConfig(outputBase, flags.force, directOutput);
        await this.ejectSkills(outputBase, flags.force, directOutput);
        await this.ejectAgents(outputBase, flags.force, directOutput);
        break;
    }

    this.log("");
    this.logSuccess("Eject complete!");
    this.log("");
  }

  private async ejectTemplates(
    outputBase: string,
    force: boolean,
    directOutput: boolean = false,
  ): Promise<void> {
    const sourceDir = path.join(PROJECT_ROOT, DIRS.templates);
    // When directOutput is true (--output used), write directly to outputBase
    // When false (default), add "templates" subdirectory for backward compatibility
    const destDir = directOutput
      ? outputBase
      : path.join(outputBase, "templates");

    if ((await directoryExists(destDir)) && !force) {
      this.warn(
        `Templates already exist at ${destDir}. Use --force to overwrite.`,
      );
      return;
    }

    await ensureDir(destDir);
    await copy(sourceDir, destDir);

    this.logSuccess(`Templates ejected to ${destDir}`);
    this.log("You can now customize agent.liquid and partials locally.");
  }

  private async ejectConfig(
    outputBase: string,
    force: boolean,
    directOutput: boolean = false,
  ): Promise<void> {
    // Config always outputs to config.yaml in the specified location
    const destPath = path.join(outputBase, "config.yaml");

    if ((await fileExists(destPath)) && !force) {
      this.warn(
        `Config already exists at ${destPath}. Use --force to overwrite.`,
      );
      return;
    }

    await ensureDir(path.dirname(destPath));
    await writeFile(destPath, DEFAULT_CONFIG_CONTENT);

    this.logSuccess(`Config template ejected to ${destPath}`);
    this.log("Customize agent-skill mappings for your project.");
  }

  private async ejectSkills(
    outputBase: string,
    force: boolean,
    directOutput: boolean = false,
  ): Promise<void> {
    // Find skills from installed plugin
    const pluginDir = getCollectivePluginDir();
    const sourceDir = getPluginSkillsDir(pluginDir);

    if (!(await directoryExists(sourceDir))) {
      this.warn("No skills found in installed plugin.");
      this.log("Install skills with 'cc init' first, then try again.");
      return;
    }

    // When directOutput is true (--output used), write directly to outputBase
    // When false (default), add "skills" subdirectory
    const destDir = directOutput ? outputBase : path.join(outputBase, "skills");

    if ((await directoryExists(destDir)) && !force) {
      this.warn(
        `Skills already exist at ${destDir}. Use --force to overwrite.`,
      );
      return;
    }

    await ensureDir(destDir);
    await copy(sourceDir, destDir);

    this.logSuccess(`Skills ejected to ${destDir}`);
    this.log("You can now customize skill content locally.");
  }

  private async ejectAgents(
    outputBase: string,
    force: boolean,
    directOutput: boolean = false,
  ): Promise<void> {
    // Source is the agents directory from PROJECT_ROOT (excluding _templates)
    const sourceDir = path.join(PROJECT_ROOT, DIRS.agents);

    if (!(await directoryExists(sourceDir))) {
      this.warn("No agent partials found.");
      return;
    }

    // When directOutput is true (--output used), write directly to outputBase
    // When false (default), add "agents/_partials" subdirectory
    const destDir = directOutput
      ? outputBase
      : path.join(outputBase, "agents", "_partials");

    if ((await directoryExists(destDir)) && !force) {
      this.warn(
        `Agent partials already exist at ${destDir}. Use --force to overwrite.`,
      );
      return;
    }

    await ensureDir(destDir);
    await copy(sourceDir, destDir);

    this.logSuccess(`Agent partials ejected to ${destDir}`);
    this.log(
      "You can now customize agent intro, workflow, and examples locally.",
    );
  }
}
