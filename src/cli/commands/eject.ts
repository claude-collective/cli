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
import {
  CLAUDE_SRC_DIR,
  DIRS,
  LOCAL_SKILLS_PATH,
  PROJECT_ROOT,
} from "../consts.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import {
  loadSkillsMatrixFromSource,
  type SourceLoadResult,
} from "../lib/source-loader.js";
import { copySkillsToLocalFlattened } from "../lib/skill-copier.js";
import { loadProjectConfig, resolveSource } from "../lib/config.js";

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
      outputBase = path.join(projectDir, CLAUDE_SRC_DIR);
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
          projectDir,
          flags.force,
          directOutput,
          sourceResult!,
          directOutput ? outputBase : undefined,
        );
        break;
      case "all":
        await this.ejectAgentPartials(outputBase, flags.force, directOutput);
        await this.ejectSkills(
          projectDir,
          flags.force,
          directOutput,
          sourceResult!,
          directOutput ? outputBase : undefined,
        );
        break;
    }

    // Save source to project config if --source was provided
    if (flags.source) {
      await this.saveSourceToProjectConfig(projectDir, flags.source);
    }

    // Create minimal config.yaml if it doesn't exist
    await this.ensureMinimalConfig(projectDir, flags.source, sourceResult);

    this.log("");
    this.logSuccess("Eject complete!");
    this.log("");
  }

  /**
   * Save source to project-level .claude-src/config.yaml.
   * Creates the config file if it doesn't exist, or merges with existing config.
   */
  private async saveSourceToProjectConfig(
    projectDir: string,
    source: string,
  ): Promise<void> {
    const configPath = path.join(projectDir, CLAUDE_SRC_DIR, "config.yaml");

    let config: Record<string, unknown> = {};
    if (await fileExists(configPath)) {
      const content = await readFile(configPath);
      config = (parseYaml(content) as Record<string, unknown>) || {};
    }

    config.source = source;

    await ensureDir(path.join(projectDir, CLAUDE_SRC_DIR));
    await writeFile(configPath, stringifyYaml(config, { indent: 2 }));

    this.log(`Source saved to .claude-src/config.yaml`);
  }

  /**
   * Ensure a minimal config.yaml exists so that `cc compile` can work after eject.
   * Only creates if config doesn't already exist.
   * Includes all resolved config values: source, marketplace, author, agents_source.
   */
  private async ensureMinimalConfig(
    projectDir: string,
    sourceFlag?: string,
    sourceResult?: SourceLoadResult,
  ): Promise<void> {
    const configPath = path.join(projectDir, CLAUDE_SRC_DIR, "config.yaml");

    // Don't overwrite existing config
    if (await fileExists(configPath)) {
      return;
    }

    const projectName = path.basename(projectDir);

    // Build config with all available values
    const config: Record<string, unknown> = {
      name: projectName,
      installMode: "local",
    };

    // Get resolved source config
    const resolvedConfig =
      sourceResult?.sourceConfig ??
      (await resolveSource(sourceFlag, projectDir));

    // Add source (flag overrides resolved source, but always include it)
    if (sourceFlag) {
      config.source = sourceFlag;
    } else if (resolvedConfig.source) {
      config.source = resolvedConfig.source;
    }

    // Add marketplace if available
    if (resolvedConfig.marketplace) {
      config.marketplace = resolvedConfig.marketplace;
    }

    // Load project config to get author and agents_source
    const existingProjectConfig = await loadProjectConfig(projectDir);
    if (existingProjectConfig?.author) {
      config.author = existingProjectConfig.author;
    }
    if (existingProjectConfig?.agents_source) {
      config.agents_source = existingProjectConfig.agents_source;
    }

    await ensureDir(path.join(projectDir, CLAUDE_SRC_DIR));

    // Build config YAML with commented example stack blueprint
    let configContent = stringifyYaml(config, { indent: 2 });

    // Append commented example stack configuration as a blueprint for users
    const exampleStackComment = `
# Example stack configuration (uncomment and customize):
#
# skills:
#   - web-framework-react
#   - web-styling-scss-modules
#   - api-framework-hono
#   - api-database-drizzle
#
# agents:
#   - web-developer
#   - api-developer
#   - web-reviewer
#
# stack:
#   web-developer:
#     framework: web-framework-react
#     styling: web-styling-scss-modules
#   api-developer:
#     api: api-framework-hono
#     database: api-database-drizzle
`;

    configContent += exampleStackComment;
    await writeFile(configPath, configContent);

    this.logSuccess(`Created ${CLAUDE_SRC_DIR}/config.yaml`);
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
    // When false (default): add "agents" subdirectory (to .claude-src/agents/)
    const destDir = directOutput ? outputBase : path.join(outputBase, "agents");

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
    projectDir: string,
    force: boolean,
    directOutput: boolean = false,
    sourceResult: SourceLoadResult,
    customOutputBase?: string,
  ): Promise<void> {
    // Destination directory structure:
    // When directOutput is true (custom --output): write directly to customOutputBase
    // When false (default): use .claude/skills/ (skills are runtime files, not source files)
    const destDir =
      directOutput && customOutputBase
        ? customOutputBase
        : path.join(projectDir, LOCAL_SKILLS_PATH);

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
