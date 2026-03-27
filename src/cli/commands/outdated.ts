import { Flags } from "@oclif/core";
import { printTable } from "@oclif/table";
import os from "os";
import path from "path";
import { countBy } from "remeda";

import { BaseCommand } from "../base-command.js";
import { getErrorMessage } from "../utils/errors.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { loadSource, compareSkillsWithSource, detectProject } from "../lib/operations/index.js";
import { type SkillComparisonResult } from "../lib/skills/index.js";
import { fileExists } from "../utils/fs.js";
import { CLI_BIN_NAME, LOCAL_SKILLS_PATH } from "../consts.js";

type ComparisonSummary = {
  outdated: number;
  current: number;
  localOnly: number;
};

function calculateSummary(results: SkillComparisonResult[]): ComparisonSummary {
  const counts = countBy(results, (r) => r.status);
  return {
    outdated: counts["outdated"] ?? 0,
    current: counts["current"] ?? 0,
    localOnly: counts["local-only"] ?? 0,
  };
}

function formatHash(hash: string | null, isLocal: boolean): string {
  if (hash === null) {
    return isLocal ? "(local)" : "-";
  }
  return hash;
}

export default class Outdated extends BaseCommand {
  static summary = "Check which local skills are out of date compared to source";
  static description =
    "Compare local skills against their source repository to identify outdated skills that need updating";

  static examples = [
    {
      description: "Check for outdated skills",
      command: "<%= config.bin %> <%= command.id %>",
    },
    {
      description: "Output results as JSON",
      command: "<%= config.bin %> <%= command.id %> --json",
    },
    {
      description: "Check against a custom source",
      command: "<%= config.bin %> <%= command.id %> --source github:org/marketplace",
    },
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    json: Flags.boolean({
      description: "Output results as JSON",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Outdated);
    const detected = await detectProject();
    const projectDir = detected?.installation.projectDir ?? process.cwd();

    const hasSkills = await this.checkLocalSkillsExist(projectDir, flags.json);
    if (!hasSkills) return;

    try {
      const { results, summary, sourceResult } = await this.loadAndCompare(flags, projectDir);
      this.reportResults(results, summary, sourceResult, flags.json);

      if (summary.outdated > 0) {
        this.error("Some skills are outdated", { exit: EXIT_CODES.ERROR });
      }
    } catch (error) {
      const message = getErrorMessage(error);
      if (flags.json) {
        this.error(JSON.stringify({ error: message }), { exit: EXIT_CODES.ERROR });
      } else {
        this.error(`Error: ${message}`, { exit: EXIT_CODES.ERROR });
      }
    }
  }

  private async checkLocalSkillsExist(projectDir: string, json: boolean): Promise<boolean> {
    const homeDir = os.homedir();
    const hasProject = await fileExists(path.join(projectDir, LOCAL_SKILLS_PATH));
    const hasGlobal =
      projectDir !== homeDir && (await fileExists(path.join(homeDir, LOCAL_SKILLS_PATH)));

    if (hasProject || hasGlobal) return true;

    if (json) {
      this.log(JSON.stringify({ skills: [], summary: { outdated: 0, current: 0, localOnly: 0 } }));
    } else {
      this.warn(
        `No local skills found. Run \`${CLI_BIN_NAME} init\` or \`${CLI_BIN_NAME} edit\` first.`,
      );
    }
    return false;
  }

  private async loadAndCompare(
    flags: { source?: string; json: boolean },
    projectDir: string,
  ): Promise<{
    results: SkillComparisonResult[];
    summary: ComparisonSummary;
    sourceResult: { isLocal: boolean; sourcePath: string };
  }> {
    if (!flags.json) this.log("Loading skills...");

    const { sourceResult } = await loadSource({ sourceFlag: flags.source, projectDir });
    const { matrix, sourcePath, isLocal } = sourceResult;

    if (!flags.json) this.log(`Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`);

    const { merged: results } = await compareSkillsWithSource(projectDir, sourcePath, matrix);
    const summary = calculateSummary(results);

    return { results, summary, sourceResult: { isLocal, sourcePath } };
  }

  private reportResults(
    results: SkillComparisonResult[],
    summary: ComparisonSummary,
    _sourceResult: { isLocal: boolean; sourcePath: string },
    json: boolean,
  ): void {
    if (json) {
      this.log(
        JSON.stringify(
          {
            skills: results.map((r) => ({
              id: r.id,
              localHash: r.localHash,
              sourceHash: r.sourceHash,
              status: r.status,
            })),
            summary: {
              outdated: summary.outdated,
              current: summary.current,
              localOnly: summary.localOnly,
            },
          },
          null,
          2,
        ),
      );
      return;
    }

    this.log("");
    if (results.length === 0) {
      this.logInfo("No local skills found to compare.");
    } else {
      printTable({
        data: results.map((result) => ({
          skill: result.id,
          localHash: formatHash(result.localHash, true),
          sourceHash: formatHash(result.sourceHash, false),
          status: result.status,
        })),
        columns: [
          { key: "skill", name: "Skill" },
          { key: "localHash", name: "Local Hash" },
          { key: "sourceHash", name: "Source Hash" },
          { key: "status", name: "Status" },
        ],
        headerOptions: { bold: true },
      });

      this.log("");
      this.log(`Summary: ${formatSummaryParts(summary)}`);
    }
    this.log("");
  }
}

function formatSummaryParts(summary: ComparisonSummary): string {
  const parts: string[] = [];
  if (summary.outdated > 0) parts.push(`${summary.outdated} outdated`);
  if (summary.current > 0) parts.push(`${summary.current} current`);
  if (summary.localOnly > 0) parts.push(`${summary.localOnly} local-only`);
  return parts.join(", ");
}
