import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../base-command.js";
import { loadSource, resolveSkillInfo } from "../lib/operations/index.js";
import { matrix } from "../lib/matrix/matrix-provider";
import { CLI_BIN_NAME } from "../consts.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { STATUS_MESSAGES } from "../utils/messages.js";
import type { ResolvedSkill, SkillRequirement } from "../types/index.js";

const CONTENT_PREVIEW_LINES = 10;

function formatRequirements(requirements: SkillRequirement[]): string {
  if (requirements.length === 0) {
    return "(none)";
  }
  return requirements
    .map((req) => {
      const prefix = req.needsAny ? "any of: " : "";
      return prefix + req.skillIds.join(", ");
    })
    .join("; ");
}

function formatSkillInfo(skill: ResolvedSkill, isInstalled: boolean): string {
  const lines: string[] = [];

  lines.push(`Skill: ${skill.id}`);
  if (skill.slug) {
    lines.push(`Slug: ${skill.slug}`);
  }
  lines.push(`Display Name: ${skill.displayName}`);
  lines.push(`Author: ${skill.author}`);
  lines.push(`Category: ${skill.category}`);
  lines.push("");
  lines.push("Description:");
  lines.push(`  ${skill.description}`);
  lines.push("");
  lines.push(`Requires: ${formatRequirements(skill.requires)}`);
  lines.push(
    `Conflicts with: ${skill.conflictsWith.length > 0 ? skill.conflictsWith.map((r) => r.skillId).join(", ") : "(none)"}`,
  );
  lines.push(
    `Recommended: ${skill.isRecommended ? `Yes${skill.recommendedReason ? ` — ${skill.recommendedReason}` : ""}` : "No"}`,
  );

  if (skill.usageGuidance) {
    lines.push("");
    lines.push("Usage Guidance:");
    lines.push(`  ${skill.usageGuidance}`);
  }

  lines.push("");
  lines.push(`Local Status: ${isInstalled ? "Installed" : "Not installed"}`);

  return lines.join("\n");
}

export default class Info extends BaseCommand {
  static summary = "Show detailed information about a skill";
  static description =
    "Display comprehensive information about a skill including metadata, relationships, and content preview";

  static examples = [
    {
      description: "Show info for a skill by ID",
      command: "<%= config.bin %> <%= command.id %> web-framework-react",
    },
    {
      description: "Show info without content preview",
      command: "<%= config.bin %> <%= command.id %> web-framework-react --no-preview",
    },
    {
      description: "Show info from a custom source",
      command: "<%= config.bin %> <%= command.id %> my-skill --source github:org/marketplace",
    },
  ];

  static args = {
    skill: Args.string({
      description: "Skill ID or alias to look up",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    preview: Flags.boolean({
      description: "Show content preview from SKILL.md",
      default: true,
      allowNo: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Info);
    const projectDir = process.cwd();

    try {
      const { sourcePath, isLocal } = await this.loadSourceAndLog(flags.source, projectDir);
      const result = await resolveSkillInfo({
        query: args.skill,
        skills: matrix.skills,
        slugToId: matrix.slugMap.slugToId,
        projectDir,
        sourcePath,
        isLocal,
        includePreview: flags.preview,
      });

      if (!result.resolved) {
        this.reportNotFound(args.skill, result.suggestions);
        return;
      }

      this.displaySkillInfo(result.resolved, flags.preview);
    } catch (error) {
      this.handleError(error);
    }
  }

  private async loadSourceAndLog(
    sourceFlag: string | undefined,
    projectDir: string,
  ): Promise<{ sourcePath: string; isLocal: boolean }> {
    this.log(STATUS_MESSAGES.LOADING_SKILLS);

    const { sourceResult } = await loadSource({ sourceFlag, projectDir });
    const { sourcePath, isLocal } = sourceResult;

    this.log(`Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`);
    return { sourcePath, isLocal };
  }

  private reportNotFound(query: string, suggestions: string[]): never {
    this.log("");
    this.error(`Skill "${query}" not found.`, { exit: false });

    if (suggestions.length > 0) {
      this.log("");
      this.log("Did you mean one of these?");
      for (const suggestion of suggestions) {
        this.log(`  - ${suggestion}`);
      }
    }

    this.log("");
    this.logInfo(`Use '${CLI_BIN_NAME} search <query>' to find available skills.`);
    this.log("");
    this.exit(EXIT_CODES.ERROR);
  }

  private displaySkillInfo(
    resolved: { skill: ResolvedSkill; isInstalled: boolean; preview: string[] },
    showPreview: boolean,
  ): void {
    const { skill, isInstalled, preview } = resolved;

    this.log("");
    this.log(formatSkillInfo(skill, isInstalled));

    if (showPreview && preview.length > 0) {
      this.log("");
      this.log(`--- Content Preview (first ${CONTENT_PREVIEW_LINES} lines) ---`);
      for (const line of preview) {
        this.log(line);
      }
    }

    this.log("");
  }
}
