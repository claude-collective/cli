import { Flags } from "@oclif/core";
import { printTable } from "@oclif/table";
import path from "path";
import { BaseCommand } from "../base-command.js";
import { loadSkillsMatrixFromSource } from "../lib/source-loader.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { compareSkills, type SkillComparisonResult } from "../lib/skill-metadata.js";
import { fileExists } from "../utils/fs.js";
import { LOCAL_SKILLS_PATH } from "../consts.js";

/**
 * Summary counts for the comparison results
 */
interface ComparisonSummary {
  outdated: number;
  current: number;
  localOnly: number;
}

/**
 * Calculate summary counts from comparison results
 */
function calculateSummary(results: SkillComparisonResult[]): ComparisonSummary {
  return {
    outdated: results.filter((r) => r.status === "outdated").length,
    current: results.filter((r) => r.status === "current").length,
    localOnly: results.filter((r) => r.status === "local-only").length,
  };
}

/**
 * Format hash for display
 */
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
      // Check if local skills directory exists
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

      // Build source skills map for lookup
      const sourceSkills: Record<string, { path: string }> = {};
      for (const [skillId, skill] of Object.entries(matrix.skills)) {
        if (!skill.local) {
          sourceSkills[skillId] = { path: skill.path };
        }
      }

      // Compare local skills against source
      const results = await compareSkills(projectDir, sourcePath, sourceSkills);
      const summary = calculateSummary(results);

      // Output results
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
          // Use @oclif/table for table output
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

          // Display summary
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

      // Exit with appropriate code if there are outdated skills
      if (summary.outdated > 0) {
        this.error("Some skills are outdated", { exit: EXIT_CODES.ERROR });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

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
