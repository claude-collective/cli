import { Args, Flags } from "@oclif/core";
import path from "path";
import os from "os";
import { stringify as stringifyYaml } from "yaml";
import { BaseCommand } from "../base-command.js";
import { copy, ensureDir, directoryExists, fileExists, writeFile } from "../utils/fs.js";
import {
  CLAUDE_SRC_DIR,
  DEFAULT_BRANDING,
  DIRS,
  LOCAL_SKILLS_PATH,
  PROJECT_ROOT,
  STANDARD_FILES,
  YAML_FORMATTING,
} from "../consts.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { loadSkillsMatrixFromSource, type SourceLoadResult } from "../lib/loading/index.js";
import { copySkillsToLocalFlattened } from "../lib/skills/index.js";
import type { SkillId } from "../types/index.js";
import { typedKeys } from "../utils/typed-object.js";
import {
  loadProjectSourceConfig,
  resolveSource,
  saveSourceToProjectConfig,
} from "../lib/configuration/index.js";

const EJECT_TYPES = ["agent-partials", "skills", "all"] as const;
type EjectType = (typeof EJECT_TYPES)[number];

export default class Eject extends BaseCommand {
  static summary = "Eject skills or agent partials for local customization";
  static description =
    "Copy agent partials or skills to your project for customization. " +
    "Agent partials are always copied from the CLI. " +
    "Skills are copied from the configured source (public marketplace by default).";

  static examples = [
    {
      description: "Eject agent partials for customization",
      command: "<%= config.bin %> <%= command.id %> agent-partials",
    },
    {
      description: "Eject skills to local directory",
      command: "<%= config.bin %> <%= command.id %> skills",
    },
    {
      description: "Eject everything with force overwrite",
      command: "<%= config.bin %> <%= command.id %> all --force",
    },
    {
      description: "Eject to a custom output directory",
      command: "<%= config.bin %> <%= command.id %> skills -o ./custom-dir",
    },
  ];

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
      this.error("Please specify what to eject: agent-partials, skills, or all", {
        exit: EXIT_CODES.INVALID_ARGS,
      });
    }

    if (!EJECT_TYPES.includes(args.type as EjectType)) {
      this.error(`Unknown eject type: ${args.type}`, {
        exit: EXIT_CODES.INVALID_ARGS,
      });
    }

    let outputBase: string;
    if (flags.output) {
      const expandedPath = flags.output.startsWith("~")
        ? path.join(os.homedir(), flags.output.slice(1))
        : flags.output;
      outputBase = path.resolve(projectDir, expandedPath);

      if (await fileExists(outputBase)) {
        this.error(`Output path exists as a file: ${outputBase}`, {
          exit: EXIT_CODES.INVALID_ARGS,
        });
      }
    } else {
      outputBase = path.join(projectDir, CLAUDE_SRC_DIR);
    }

    this.log("");
    this.log(`${DEFAULT_BRANDING.NAME} Eject`);
    this.log("");

    if (flags.output) {
      this.log(`Output directory: ${outputBase}`);
    }

    const ejectType = args.type as EjectType;
    const directOutput = !!flags.output;

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
          sourceResult!,
          directOutput,
          directOutput ? outputBase : undefined,
        );
        break;
      case "all":
        await this.ejectAgentPartials(outputBase, flags.force, directOutput);
        await this.ejectSkills(
          projectDir,
          flags.force,
          sourceResult!,
          directOutput,
          directOutput ? outputBase : undefined,
        );
        break;
      default:
        break;
    }

    if (flags.source) {
      await saveSourceToProjectConfig(projectDir, flags.source);
      this.log(`Source saved to .claude-src/config.yaml`);
    }

    await this.ensureMinimalConfig(projectDir, flags.source, sourceResult);

    this.log("");
    this.logSuccess("Eject complete!");
    this.log("");
  }

  // Ensures a minimal config.yaml exists so `cc compile` works after eject
  private async ensureMinimalConfig(
    projectDir: string,
    sourceFlag?: string,
    sourceResult?: SourceLoadResult,
  ): Promise<void> {
    const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);

    if (await fileExists(configPath)) {
      return;
    }

    const projectName = path.basename(projectDir);

    const config: Record<string, unknown> = {
      name: projectName,
      installMode: "local",
    };

    const resolvedConfig =
      sourceResult?.sourceConfig ?? (await resolveSource(sourceFlag, projectDir));

    if (sourceFlag) {
      config.source = sourceFlag;
    } else if (resolvedConfig.source) {
      config.source = resolvedConfig.source;
    }

    if (resolvedConfig.marketplace) {
      config.marketplace = resolvedConfig.marketplace;
    }

    const existingProjectConfig = await loadProjectSourceConfig(projectDir);
    if (existingProjectConfig?.author) {
      config.author = existingProjectConfig.author;
    }
    if (existingProjectConfig?.agents_source) {
      config.agents_source = existingProjectConfig.agents_source;
    }

    await ensureDir(path.join(projectDir, CLAUDE_SRC_DIR));

    let configContent = stringifyYaml(config, { indent: YAML_FORMATTING.INDENT });

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

  private async ejectAgentPartials(
    outputBase: string,
    force: boolean,
    directOutput = false,
  ): Promise<void> {
    const sourceDir = path.join(PROJECT_ROOT, DIRS.agents);

    if (!(await directoryExists(sourceDir))) {
      this.warn("No agent partials found in CLI.");
      return;
    }

    const destDir = directOutput ? outputBase : path.join(outputBase, "agents");

    if ((await directoryExists(destDir)) && !force) {
      this.warn(`Agent partials already exist at ${destDir}. Use --force to overwrite.`);
      return;
    }

    await ensureDir(destDir);

    await copy(sourceDir, destDir);

    this.logSuccess(`Agent partials ejected to ${destDir}`);
    this.log("You can now customize templates, agent intro, workflow, and examples locally.");
  }

  private async ejectSkills(
    projectDir: string,
    force: boolean,
    sourceResult: SourceLoadResult,
    directOutput = false,
    customOutputBase?: string,
  ): Promise<void> {
    const destDir =
      directOutput && customOutputBase
        ? customOutputBase
        : path.join(projectDir, LOCAL_SKILLS_PATH);

    if ((await directoryExists(destDir)) && !force) {
      this.warn(`Skills already exist at ${destDir}. Use --force to overwrite.`);
      return;
    }

    const skillIds = typedKeys<SkillId>(sourceResult.matrix.skills).filter(
      (skillId) => !sourceResult.matrix.skills[skillId]?.local,
    );

    if (skillIds.length === 0) {
      this.warn("No skills found in source to eject.");
      return;
    }

    await ensureDir(destDir);

    const copiedSkills = await copySkillsToLocalFlattened(
      skillIds,
      destDir,
      sourceResult.matrix,
      sourceResult,
    );

    const sourceLabel = sourceResult.isLocal
      ? sourceResult.sourcePath
      : sourceResult.marketplace || sourceResult.sourceConfig.source;

    this.logSuccess(`${copiedSkills.length} skills ejected to ${destDir} from ${sourceLabel}`);
    this.log("You can now customize skill content locally.");
  }
}
