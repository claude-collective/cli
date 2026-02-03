import { Args, Flags } from "@oclif/core";
import path from "path";
import os from "os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { BaseCommand } from "../base-command.js";
import {
  copy,
  ensureDir,
  directoryExists,
  fileExists,
  readFile,
  writeFile,
} from "../utils/fs.js";
import { DIRS, LOCAL_SKILLS_PATH, PROJECT_ROOT } from "../consts.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import {
  loadSkillsMatrixFromSource,
  type SourceLoadResult,
} from "../lib/source-loader.js";
import { copySkillsToLocalFlattened } from "../lib/skill-copier.js";

const EJECT_TYPES = ["agent-partials", "skills", "all"] as const;
type EjectType = (typeof EJECT_TYPES)[number];

export default class Eject extends BaseCommand {
  static summary = "Eject skills or agent partials for local customization";
  static description =
    "Copy agent partials or skills to your project for customization. " +
    "Agent partials are always copied from the CLI. " +
    "Skills are copied from the configured source (public marketplace by default).";

  static args = {
    type: Args.string({
      description: "What to eject: agent-partials, skills, all",
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
    refresh: Flags.boolean({
      description: "Force refresh from remote source",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Eject);
    const projectDir = process.cwd();

    if (!args.type) {
      this.error(
        "Please specify what to eject: agent-partials, skills, or all",
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

    // Load source when ejecting skills or all
    let sourceResult: SourceLoadResult | undefined;
    if (ejectType === "skills" || ejectType === "all") {
      sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
        projectDir,
        forceRefresh: flags.refresh,
      });
    }

    switch (ejectType) {
      case "agent-partials":
        await this.ejectAgentPartials(outputBase, flags.force, directOutput);
        break;
      case "skills":
        await this.ejectSkills(
          outputBase,
          flags.force,
          directOutput,
          sourceResult!,
        );
        break;
      case "all":
        await this.ejectAgentPartials(outputBase, flags.force, directOutput);
        await this.ejectSkills(
          outputBase,
          flags.force,
          directOutput,
          sourceResult!,
        );
        break;
    }

    // Save source to project config if --source was provided
    if (flags.source) {
      await this.saveSourceToProjectConfig(projectDir, flags.source);
    }

    this.log("");
    this.logSuccess("Eject complete!");
    this.log("");
  }

  /**
   * Save source to project-level .claude/config.yaml.
   * Creates the config file if it doesn't exist, or merges with existing config.
   */
  private async saveSourceToProjectConfig(
    projectDir: string,
    source: string,
  ): Promise<void> {
    const configPath = path.join(projectDir, ".claude", "config.yaml");

    let config: Record<string, unknown> = {};
    if (await fileExists(configPath)) {
      const content = await readFile(configPath);
      config = (parseYaml(content) as Record<string, unknown>) || {};
    }

    config.source = source;

    await ensureDir(path.join(projectDir, ".claude"));
    await writeFile(configPath, stringifyYaml(config, { indent: 2 }));

    this.log(`Source saved to .claude/config.yaml`);
  }

  /**
   * Eject agent partials (templates + agent partial files).
   *
   * Combines the old templates and agents eject into a single operation:
   * - Copies `PROJECT_ROOT/src/agents/_templates/` to `<dest>/_templates/`
   * - Copies agent partials from `PROJECT_ROOT/src/agents/` (excluding `_templates`) to `<dest>/`
   *
   * Always copies from CLI's PROJECT_ROOT - the `--source` flag has no effect.
   */
  private async ejectAgentPartials(
    outputBase: string,
    force: boolean,
    directOutput: boolean = false,
  ): Promise<void> {
    const sourceDir = path.join(PROJECT_ROOT, DIRS.agents);

    if (!(await directoryExists(sourceDir))) {
      this.warn("No agent partials found in CLI.");
      return;
    }

    // Destination directory structure:
    // When directOutput is true: write directly to outputBase
    // When false (default): add "agents/_partials" subdirectory
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

    // Copy entire agents directory (includes _templates and all agent partials)
    await copy(sourceDir, destDir);

    this.logSuccess(`Agent partials ejected to ${destDir}`);
    this.log(
      "You can now customize templates, agent intro, workflow, and examples locally.",
    );
  }

  /**
   * Eject skills from the configured source to local .claude/skills/ directory.
   *
   * Uses the source resolution system:
   * - Default: Public marketplace
   * - `--source /path`: Custom local source
   * - `--source url`: Custom remote source
   *
   * Skills are copied in a flattened structure using their normalized skill IDs.
   */
  private async ejectSkills(
    outputBase: string,
    force: boolean,
    directOutput: boolean = false,
    sourceResult: SourceLoadResult,
  ): Promise<void> {
    // Destination directory structure:
    // When directOutput is true: write directly to outputBase
    // When false (default): add "skills" subdirectory
    const destDir = directOutput
      ? outputBase
      : path.join(outputBase, LOCAL_SKILLS_PATH.replace(".claude/", ""));

    if ((await directoryExists(destDir)) && !force) {
      this.warn(
        `Skills already exist at ${destDir}. Use --force to overwrite.`,
      );
      return;
    }

    // Get all non-local skill IDs from the source matrix
    const skillIds = Object.keys(sourceResult.matrix.skills).filter(
      (skillId) => !sourceResult.matrix.skills[skillId].local,
    );

    if (skillIds.length === 0) {
      this.warn("No skills found in source to eject.");
      return;
    }

    await ensureDir(destDir);

    // Copy skills using flattened structure
    const copiedSkills = await copySkillsToLocalFlattened(
      skillIds,
      destDir,
      sourceResult.matrix,
      sourceResult,
    );

    const sourceLabel = sourceResult.isLocal
      ? sourceResult.sourcePath
      : sourceResult.marketplace || sourceResult.sourceConfig.source;

    this.logSuccess(
      `${copiedSkills.length} skills ejected to ${destDir} from ${sourceLabel}`,
    );
    this.log("You can now customize skill content locally.");
  }
}
