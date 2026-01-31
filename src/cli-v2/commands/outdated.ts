import { Flags } from "@oclif/core";
import { printTable } from "@oclif/table";
import path from "path";
import { parse as parseYaml } from "yaml";
import { BaseCommand } from "../base-command.js";
import { loadSkillsMatrixFromSource } from "../lib/source-loader.js";
import { hashFile } from "../lib/versioning.js";
import { fileExists, readFile, listDirectories } from "../utils/fs.js";
import { LOCAL_SKILLS_PATH } from "../consts.js";
import { EXIT_CODES } from "../lib/exit-codes.js";

/**
 * Status values for skill comparison
 */
type SkillStatus = "current" | "outdated" | "local-only";

/**
 * Result of comparing a local skill to its source
 */
interface SkillComparisonResult {
  id: string;
  localHash: string | null;
  sourceHash: string | null;
  status: SkillStatus;
}

/**
 * Summary counts for the comparison results
 */
interface ComparisonSummary {
  outdated: number;
  current: number;
  localOnly: number;
}

/**
 * ForkedFrom metadata stored in local skill's metadata.yaml
 */
interface ForkedFromMetadata {
  skill_id: string;
  content_hash: string;
  date: string;
}

/**
 * Local skill metadata structure
 */
interface LocalSkillMetadata {
  forked_from?: ForkedFromMetadata;
  [key: string]: unknown;
}

/**
 * Read forked_from metadata from a local skill's metadata.yaml
 */
async function readForkedFromMetadata(
  skillDir: string,
): Promise<ForkedFromMetadata | null> {
  const metadataPath = path.join(skillDir, "metadata.yaml");

  if (!(await fileExists(metadataPath))) {
    return null;
  }

  const content = await readFile(metadataPath);
  const metadata = parseYaml(content) as LocalSkillMetadata;

  return metadata.forked_from ?? null;
}

/**
 * Get local skills with their forked_from metadata
 */
async function getLocalSkillsWithMetadata(
  projectDir: string,
): Promise<
  Map<string, { dirName: string; forkedFrom: ForkedFromMetadata | null }>
> {
  const localSkillsPath = path.join(projectDir, LOCAL_SKILLS_PATH);
  const result = new Map<
    string,
    { dirName: string; forkedFrom: ForkedFromMetadata | null }
  >();

  if (!(await fileExists(localSkillsPath))) {
    return result;
  }

  const skillDirs = await listDirectories(localSkillsPath);

  for (const dirName of skillDirs) {
    const skillDir = path.join(localSkillsPath, dirName);
    const forkedFrom = await readForkedFromMetadata(skillDir);

    // Use the skill_id from forked_from if available, otherwise use directory name
    const skillId = forkedFrom?.skill_id ?? dirName;

    result.set(skillId, { dirName, forkedFrom });
  }

  return result;
}

/**
 * Compute source hash for a skill's SKILL.md file
 */
async function computeSourceHash(
  sourcePath: string,
  skillPath: string,
): Promise<string | null> {
  const skillMdPath = path.join(sourcePath, "src", skillPath, "SKILL.md");

  if (!(await fileExists(skillMdPath))) {
    return null;
  }

  return hashFile(skillMdPath);
}

/**
 * Compare local skills against source and determine status
 */
async function compareSkills(
  projectDir: string,
  sourcePath: string,
  sourceSkills: Record<string, { path: string }>,
): Promise<SkillComparisonResult[]> {
  const results: SkillComparisonResult[] = [];
  const localSkills = await getLocalSkillsWithMetadata(projectDir);

  // Process local skills
  for (const [skillId, { forkedFrom }] of localSkills) {
    if (!forkedFrom) {
      // Local-only skill (no forked_from metadata)
      results.push({
        id: skillId,
        localHash: null,
        sourceHash: null,
        status: "local-only",
      });
      continue;
    }

    const localHash = forkedFrom.content_hash;
    const sourceSkill = sourceSkills[forkedFrom.skill_id];

    if (!sourceSkill) {
      // Skill was forked from a source that no longer exists
      results.push({
        id: forkedFrom.skill_id,
        localHash,
        sourceHash: null,
        status: "local-only",
      });
      continue;
    }

    const sourceHash = await computeSourceHash(sourcePath, sourceSkill.path);

    if (sourceHash === null) {
      // Source skill's SKILL.md not found
      results.push({
        id: forkedFrom.skill_id,
        localHash,
        sourceHash: null,
        status: "local-only",
      });
      continue;
    }

    const status: SkillStatus =
      localHash === sourceHash ? "current" : "outdated";

    results.push({
      id: forkedFrom.skill_id,
      localHash,
      sourceHash,
      status,
    });
  }

  // Sort results by skill ID
  results.sort((a, b) => a.id.localeCompare(b.id));

  return results;
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
  static summary =
    "Check which local skills are out of date compared to source";
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
