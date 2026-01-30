import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { parse as parseYaml } from "yaml";
import { loadSkillsMatrixFromSource } from "../lib/source-loader";
import { discoverLocalSkills } from "../lib/local-skill-loader";
import { hashFile } from "../lib/versioning";
import { EXIT_CODES } from "../lib/exit-codes";
import { fileExists, readFile, listDirectories } from "../utils/fs";
import { LOCAL_SKILLS_PATH } from "../consts";

/**
 * Minimum column widths for table output
 */
const MIN_SKILL_WIDTH = 24;
const MIN_HASH_WIDTH = 12;
const MIN_STATUS_WIDTH = 11;

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
 * Format status with color
 */
function formatStatus(status: SkillStatus): string {
  switch (status) {
    case "current":
      return pc.green("current");
    case "outdated":
      return pc.yellow("outdated");
    case "local-only":
      return pc.dim("local-only");
  }
}

/**
 * Format hash for display
 */
function formatHash(hash: string | null, isLocal: boolean): string {
  if (hash === null) {
    return isLocal ? pc.dim("(local)") : pc.dim("-");
  }
  return hash;
}

/**
 * Format results as a table for display
 */
function formatResultsTable(results: SkillComparisonResult[]): string {
  if (results.length === 0) {
    return "";
  }

  // Calculate column widths
  const skillWidth = Math.max(
    MIN_SKILL_WIDTH,
    ...results.map((r) => r.id.length),
  );
  const hashWidth = MIN_HASH_WIDTH;
  const statusWidth = MIN_STATUS_WIDTH;

  // Build header
  const header =
    pc.bold("Skill".padEnd(skillWidth)) +
    "  " +
    pc.bold("Local Hash".padEnd(hashWidth)) +
    "  " +
    pc.bold("Source Hash".padEnd(hashWidth)) +
    "  " +
    pc.bold("Status");

  const separator = "-".repeat(skillWidth + hashWidth * 2 + statusWidth + 6);

  // Build rows
  const rows = results.map((result) => {
    const skill = result.id.padEnd(skillWidth);
    const localHash = formatHash(result.localHash, true).padEnd(hashWidth);
    const sourceHash = formatHash(result.sourceHash, false).padEnd(hashWidth);
    const status = formatStatus(result.status);

    return `${pc.cyan(skill)}  ${localHash}  ${sourceHash}  ${status}`;
  });

  return [header, separator, ...rows].join("\n");
}

/**
 * Format summary line
 */
function formatSummary(summary: ComparisonSummary): string {
  const parts: string[] = [];

  if (summary.outdated > 0) {
    parts.push(pc.yellow(`${summary.outdated} outdated`));
  }
  if (summary.current > 0) {
    parts.push(pc.green(`${summary.current} current`));
  }
  if (summary.localOnly > 0) {
    parts.push(pc.dim(`${summary.localOnly} local-only`));
  }

  return `Summary: ${parts.join(", ")}`;
}

/**
 * Format results as JSON
 */
function formatResultsJson(
  results: SkillComparisonResult[],
  summary: ComparisonSummary,
): string {
  return JSON.stringify(
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
  );
}

export const outdatedCommand = new Command("outdated")
  .description("Check which local skills are out of date compared to source")
  .option("-s, --source <source>", "Skills source path or URL")
  .option("--json", "Output results as JSON")
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options: { source?: string; json?: boolean }) => {
    const s = p.spinner();
    const projectDir = process.cwd();

    try {
      // Check if local skills directory exists
      const localSkillsPath = path.join(projectDir, LOCAL_SKILLS_PATH);
      if (!(await fileExists(localSkillsPath))) {
        if (options.json) {
          console.log(
            JSON.stringify({
              skills: [],
              summary: { outdated: 0, current: 0, localOnly: 0 },
            }),
          );
        } else {
          p.log.warn(
            "No local skills found. Run `cc init` or `cc edit` first.",
          );
        }
        process.exit(EXIT_CODES.SUCCESS);
      }

      if (!options.json) {
        s.start("Loading skills...");
      }

      const { matrix, sourcePath, isLocal } = await loadSkillsMatrixFromSource({
        sourceFlag: options.source,
        projectDir,
      });

      if (!options.json) {
        s.stop(
          pc.dim(`Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`),
        );
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
      if (options.json) {
        console.log(formatResultsJson(results, summary));
      } else {
        console.log("");
        if (results.length === 0) {
          p.log.info("No local skills found to compare.");
        } else {
          console.log(formatResultsTable(results));
          console.log("");
          console.log(formatSummary(summary));
        }
        console.log("");
      }

      // Exit with appropriate code
      if (summary.outdated > 0) {
        process.exit(EXIT_CODES.ERROR);
      }
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      if (!options.json) {
        s.stop(pc.red("Failed to check for updates"));
      }
      const message = error instanceof Error ? error.message : String(error);

      if (options.json) {
        console.error(JSON.stringify({ error: message }));
      } else {
        console.error(pc.red(`\nError: ${message}\n`));
      }
      process.exit(EXIT_CODES.ERROR);
    }
  });
