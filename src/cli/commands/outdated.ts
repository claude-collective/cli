import { Flags } from "@oclif/core";
import { printTable } from "@oclif/table";
import path from "path";
import { countBy } from "remeda";

import { BaseCommand } from "../base-command.js";
import { getErrorMessage } from "../utils/errors.js";
import { loadSkillsMatrixFromSource } from "../lib/loading/index.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { compareLocalSkillsWithSource, type SkillComparisonResult } from "../lib/skills/index.js";
import { fileExists } from "../utils/fs.js";
import { LOCAL_SKILLS_PATH } from "../consts.js";

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
    const projectDir = process.cwd();

    try {
      const localSkillsPath = path.join(projectDir, LOCAL_SKILLS_PATH);
      if (!(await fileExists(localSkillsPath))) {
        if (flags.json) {
          this.log(
            JSON.stringify({
              skills: [],
              summary: { outdated: 0, current: 0, localOnly: 0 },
            }),
          );
        } else {
          this.warn("No local skills found. Run `cc init` or `cc edit` first.");
        }
        return;
      }

      if (!flags.json) {
        this.log("Loading skills...");
      }

      const { matrix, sourcePath, isLocal } = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
        projectDir,
      });

      if (!flags.json) {
        this.log(`Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`);
      }

      const sourceSkills: Record<string, { path: string }> = {};
      for (const [skillId, skill] of Object.entries(matrix.skills)) {
        if (!skill) continue;
        if (!skill.local) {
          sourceSkills[skillId] = { path: skill.path };
        }
      }

      const results = await compareLocalSkillsWithSource(projectDir, sourcePath, sourceSkills);
      const summary = calculateSummary(results);

      if (flags.json) {
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
      } else {
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

          const parts: string[] = [];
          if (summary.outdated > 0) {
            parts.push(`${summary.outdated} outdated`);
          }
          if (summary.current > 0) {
            parts.push(`${summary.current} current`);
          }
          if (summary.localOnly > 0) {
            parts.push(`${summary.localOnly} local-only`);
          }
          this.log(`Summary: ${parts.join(", ")}`);
        }
        this.log("");
      }

      if (summary.outdated > 0) {
        this.error("Some skills are outdated", { exit: EXIT_CODES.ERROR });
      }
    } catch (error) {
      const message = getErrorMessage(error);

      if (flags.json) {
        this.error(JSON.stringify({ error: message }), {
          exit: EXIT_CODES.ERROR,
        });
      } else {
        this.error(`Error: ${message}`, { exit: EXIT_CODES.ERROR });
      }
    }
  }
}
