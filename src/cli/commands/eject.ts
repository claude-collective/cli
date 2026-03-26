import { Args, Flags } from "@oclif/core";
import path from "path";
import os from "os";
import { BaseCommand } from "../base-command.js";
import { fileExists } from "../utils/fs.js";
import { CLAUDE_SRC_DIR, DEFAULT_BRANDING } from "../consts.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { type SourceLoadResult } from "../lib/loading/index.js";
import {
  loadSource,
  ejectAgentPartials,
  ejectSkills,
  ensureMinimalConfig,
} from "../lib/operations/index.js";
import { matrix } from "../lib/matrix/matrix-provider";
import { saveSourceToProjectConfig } from "../lib/configuration/index.js";

const EJECT_TYPES = ["agent-partials", "templates", "skills", "all"] as const;
type EjectType = (typeof EJECT_TYPES)[number];

function isEjectType(value: string): value is EjectType {
  return (EJECT_TYPES as readonly string[]).includes(value);
}

export default class Eject extends BaseCommand {
  static summary = "Eject skills, agent partials, or templates for local customization";
  static description =
    "Copy agent partials, templates, or skills to your project for customization. " +
    "Agent partials and templates are always copied from the CLI. " +
    "Skills are copied from the configured source (public marketplace by default).";

  static examples = [
    {
      description: "Eject agent partials for customization",
      command: "<%= config.bin %> <%= command.id %> agent-partials",
    },
    {
      description: "Eject only agent templates",
      command: "<%= config.bin %> <%= command.id %> templates",
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
      description: "What to eject: agent-partials, templates, skills, all",
      required: false,
      options: [...EJECT_TYPES],
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
      this.error("Please specify what to eject: agent-partials, templates, skills, or all", {
        exit: EXIT_CODES.INVALID_ARGS,
      });
    }

    if (!isEjectType(args.type)) {
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

    const ejectType = args.type;
    const directOutput = !!flags.output;

    let sourceResult: SourceLoadResult | undefined;
    if (ejectType === "skills" || ejectType === "all") {
      const loaded = await loadSource({
        sourceFlag: flags.source,
        projectDir,
        forceRefresh: flags.refresh,
      });
      sourceResult = loaded.sourceResult;
    }

    switch (ejectType) {
      case "agent-partials":
        await this.handleAgentPartials(outputBase, flags.force, directOutput, false);
        break;
      case "templates":
        await this.handleAgentPartials(outputBase, flags.force, directOutput, true);
        break;
      case "skills":
        await this.handleSkills(projectDir, flags.force, sourceResult!, directOutput, outputBase);
        break;
      case "all":
        await this.handleAgentPartials(outputBase, flags.force, directOutput, false);
        await this.handleAgentPartials(outputBase, true, directOutput, true);
        await this.handleSkills(projectDir, flags.force, sourceResult!, directOutput, outputBase);
        break;
      default:
        break;
    }

    if (flags.source) {
      await saveSourceToProjectConfig(projectDir, flags.source, path.basename(projectDir));
      this.log(`Source saved to .claude-src/config.ts`);
    }

    const configResult = await ensureMinimalConfig({
      projectDir,
      sourceFlag: flags.source,
      sourceResult,
    });
    if (configResult.created) {
      this.logSuccess(`Created ${CLAUDE_SRC_DIR}/config.ts`);
    }

    this.log("");
    this.logSuccess("Eject complete!");
    this.log("");
  }

  private async handleAgentPartials(
    outputBase: string,
    force: boolean,
    directOutput: boolean,
    templatesOnly: boolean,
  ): Promise<void> {
    const result = await ejectAgentPartials({
      outputBase,
      force,
      directOutput,
      templatesOnly,
    });

    if (result.skipped) {
      this.warn(result.skipReason!);
      return;
    }

    if (result.templatesSkipped) {
      this.warn(
        "Agent templates already exist — skipping templates, only ejecting agent partials.",
      );
    }

    this.logSuccess(
      `${templatesOnly ? "Agent templates" : "Agent partials"} ejected to ${result.destDir}`,
    );
    this.log(
      templatesOnly
        ? "You can now customize agent templates locally."
        : "You can now customize templates, agent intro, workflow, and examples locally.",
    );
  }

  private async handleSkills(
    projectDir: string,
    force: boolean,
    sourceResult: SourceLoadResult,
    directOutput: boolean,
    outputBase: string,
  ): Promise<void> {
    const result = await ejectSkills({
      projectDir,
      force,
      sourceResult,
      matrix,
      directOutput,
      customOutputBase: directOutput ? outputBase : undefined,
    });

    if (result.skipped) {
      this.warn(result.skipReason!);
      return;
    }

    this.logSuccess(
      `${result.copiedSkills.length} skills ejected to ${result.destDir} from ${result.sourceLabel}`,
    );
    this.log("You can now customize skill content locally.");
  }
}
