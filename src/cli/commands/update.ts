import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  loadSkillsMatrixFromSource,
  type SourceLoadResult,
} from "../lib/source-loader";
import { hashFile } from "../lib/versioning";
import { recompileAgents } from "../lib/agent-recompiler";
import { EXIT_CODES } from "../lib/exit-codes";
import {
  fileExists,
  readFile,
  writeFile,
  listDirectories,
  copy,
} from "../utils/fs";
import { LOCAL_SKILLS_PATH } from "../consts";
import { getCollectivePluginDir } from "../lib/plugin-finder";

/**
 * Minimum column widths for table output
 */
const MIN_SKILL_WIDTH = 24;
const MIN_HASH_WIDTH = 12;

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
 * Result of comparing a local skill to its source
 */
interface SkillComparisonResult {
  id: string;
  localHash: string | null;
  sourceHash: string | null;
  status: "current" | "outdated" | "local-only";
  dirName: string;
  sourcePath?: string;
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
 * Get the current date in ISO format (YYYY-MM-DD)
 */
function getCurrentDate(): string {
  return new Date().toISOString().split("T")[0];
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

  for (const [skillId, { dirName, forkedFrom }] of localSkills) {
    if (!forkedFrom) {
      // Local-only skill (no forked_from metadata)
      results.push({
        id: skillId,
        localHash: null,
        sourceHash: null,
        status: "local-only",
        dirName,
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
        dirName,
      });
      continue;
    }

    const sourceHash = await computeSourceHash(sourcePath, sourceSkill.path);

    if (sourceHash === null) {
      results.push({
        id: forkedFrom.skill_id,
        localHash,
        sourceHash: null,
        status: "local-only",
        dirName,
      });
      continue;
    }

    const status = localHash === sourceHash ? "current" : "outdated";

    results.push({
      id: forkedFrom.skill_id,
      localHash,
      sourceHash,
      status,
      dirName,
      sourcePath: sourceSkill.path,
    });
  }

  // Sort results by skill ID
  results.sort((a, b) => a.id.localeCompare(b.id));

  return results;
}

/**
 * Update forked_from metadata in a skill's metadata.yaml
 */
async function updateForkedFromMetadata(
  skillDir: string,
  skillId: string,
  contentHash: string,
): Promise<void> {
  const metadataPath = path.join(skillDir, "metadata.yaml");
  const rawContent = await readFile(metadataPath);

  const lines = rawContent.split("\n");
  let yamlContent = rawContent;

  if (lines[0]?.startsWith("# yaml-language-server:")) {
    yamlContent = lines.slice(1).join("\n");
  }

  const metadata = parseYaml(yamlContent) as LocalSkillMetadata;

  metadata.forked_from = {
    skill_id: skillId,
    content_hash: contentHash,
    date: getCurrentDate(),
  };

  const newYamlContent = stringifyYaml(metadata, { lineWidth: 0 });
  await writeFile(metadataPath, newYamlContent);
}

/**
 * Update a single skill from source
 */
async function updateSkill(
  skill: SkillComparisonResult,
  projectDir: string,
  sourceResult: SourceLoadResult,
): Promise<{ success: boolean; newHash: string | null; error?: string }> {
  if (!skill.sourcePath || !skill.sourceHash) {
    return { success: false, newHash: null, error: "No source path available" };
  }

  const localSkillsPath = path.join(projectDir, LOCAL_SKILLS_PATH);
  const destPath = path.join(localSkillsPath, skill.dirName);
  const srcPath = path.join(sourceResult.sourcePath, "src", skill.sourcePath);

  try {
    // Copy skill files from source to local
    await copy(srcPath, destPath);

    // Update forked_from metadata
    await updateForkedFromMetadata(destPath, skill.id, skill.sourceHash);

    return { success: true, newHash: skill.sourceHash };
  } catch (error) {
    return {
      success: false,
      newHash: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Find a skill by partial name match
 */
function findSkillByPartialMatch(
  skillName: string,
  results: SkillComparisonResult[],
): SkillComparisonResult | null {
  // Exact match first
  const exact = results.find((r) => r.id === skillName);
  if (exact) return exact;

  // Partial match (skill name without author)
  const partial = results.find((r) => {
    const nameWithoutAuthor = r.id.replace(/\s*\(@\w+\)$/, "").toLowerCase();
    return nameWithoutAuthor === skillName.toLowerCase();
  });
  if (partial) return partial;

  // Directory name match
  const byDir = results.find(
    (r) => r.dirName.toLowerCase() === skillName.toLowerCase(),
  );
  if (byDir) return byDir;

  return null;
}

/**
 * Find similar skill names for suggestions
 */
function findSimilarSkills(
  skillName: string,
  results: SkillComparisonResult[],
): string[] {
  const lowered = skillName.toLowerCase();
  return results
    .filter((r) => {
      const name = r.id.toLowerCase();
      const dir = r.dirName.toLowerCase();
      return (
        name.includes(lowered) ||
        dir.includes(lowered) ||
        lowered.includes(name.split(" ")[0])
      );
    })
    .map((r) => r.id)
    .slice(0, 3);
}

/**
 * Format update table for display
 */
function formatUpdateTable(skills: SkillComparisonResult[]): string {
  if (skills.length === 0) {
    return "";
  }

  // Calculate column widths
  const skillWidth = Math.max(
    MIN_SKILL_WIDTH,
    ...skills.map((r) => r.id.length),
  );
  const hashWidth = MIN_HASH_WIDTH;

  // Build header
  const header =
    pc.bold("Skill".padEnd(skillWidth)) +
    "  " +
    pc.bold("Local Hash".padEnd(hashWidth)) +
    "  " +
    pc.bold("Source Hash");

  const separator = "-".repeat(skillWidth + hashWidth * 2 + 8);

  // Build rows
  const rows = skills.map((skill) => {
    const name = skill.id.padEnd(skillWidth);
    const localHash = (skill.localHash ?? "-").padEnd(hashWidth);
    const sourceHash = skill.sourceHash ?? "-";

    return `${pc.cyan(name)}  ${localHash}  ${pc.dim("->")}  ${pc.green(sourceHash)}`;
  });

  return [header, separator, ...rows].join("\n");
}

export const updateCommand = new Command("update")
  .description("Update local skills from source")
  .argument("[skill]", "Specific skill to update (optional)")
  .option("-y, --yes", "Skip confirmation prompt")
  .option("-s, --source <source>", "Skills source path or URL")
  .option("--no-recompile", "Skip agent recompilation after update")
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(
    async (
      skillArg: string | undefined,
      options: { yes?: boolean; source?: string; recompile?: boolean },
    ) => {
      const s = p.spinner();
      const projectDir = process.cwd();
      const shouldRecompile = options.recompile !== false;

      try {
        // Check if local skills directory exists
        const localSkillsPath = path.join(projectDir, LOCAL_SKILLS_PATH);
        if (!(await fileExists(localSkillsPath))) {
          p.log.warn(
            "No local skills found. Run `cc init` or `cc edit` first.",
          );
          process.exit(EXIT_CODES.SUCCESS);
        }

        s.start("Loading skills...");

        const sourceResult = await loadSkillsMatrixFromSource({
          sourceFlag: options.source,
          projectDir,
        });

        s.stop(
          pc.dim(
            `Loaded from ${sourceResult.isLocal ? "local" : "remote"}: ${sourceResult.sourcePath}`,
          ),
        );

        // Build source skills map for lookup
        const sourceSkills: Record<string, { path: string }> = {};
        for (const [skillId, skill] of Object.entries(
          sourceResult.matrix.skills,
        )) {
          if (!skill.local) {
            sourceSkills[skillId] = { path: skill.path };
          }
        }

        // Compare local skills against source
        const allResults = await compareSkills(
          projectDir,
          sourceResult.sourcePath,
          sourceSkills,
        );

        // Filter to just outdated skills
        let outdatedSkills = allResults.filter((r) => r.status === "outdated");

        // Handle specific skill argument
        if (skillArg) {
          const foundSkill = findSkillByPartialMatch(skillArg, allResults);

          if (!foundSkill) {
            console.log("");
            console.log(pc.red(`Error: Skill "${skillArg}" not found.`));
            console.log("");

            const similar = findSimilarSkills(skillArg, allResults);
            if (similar.length > 0) {
              console.log("Did you mean one of these?");
              for (const name of similar) {
                console.log(`  - ${pc.cyan(name)}`);
              }
              console.log("");
            }

            console.log(
              pc.dim(
                `Run \`cc search ${skillArg}\` to search available skills.`,
              ),
            );
            console.log("");
            process.exit(EXIT_CODES.ERROR);
          }

          if (foundSkill.status === "current") {
            console.log("");
            console.log(
              pc.green(`Skill "${foundSkill.id}" is already up to date.`),
            );
            console.log("");
            console.log(`  Local hash:  ${foundSkill.localHash}`);
            console.log(`  Source hash: ${foundSkill.sourceHash}`);
            console.log("");
            process.exit(EXIT_CODES.SUCCESS);
          }

          if (foundSkill.status === "local-only") {
            console.log("");
            console.log(
              pc.yellow(
                `Skill "${foundSkill.id}" is a local-only skill (not forked from source).`,
              ),
            );
            console.log(pc.dim("Cannot update local-only skills."));
            console.log("");
            process.exit(EXIT_CODES.SUCCESS);
          }

          // Only update this specific skill
          outdatedSkills = [foundSkill];
        }

        // Check if there are any outdated skills
        if (outdatedSkills.length === 0) {
          console.log("");
          p.log.success("All skills are up to date.");
          console.log("");
          process.exit(EXIT_CODES.SUCCESS);
        }

        // Show what will be updated
        console.log("");
        console.log(pc.bold("The following skills will be updated:"));
        console.log("");
        console.log(formatUpdateTable(outdatedSkills));
        console.log("");
        console.log(`${outdatedSkills.length} skill(s) will be updated.`);
        console.log("");

        // Confirm unless --yes flag
        if (!options.yes) {
          const confirmed = await p.confirm({
            message: "Proceed with update?",
            initialValue: false,
          });

          if (p.isCancel(confirmed)) {
            p.cancel("Update cancelled");
            process.exit(EXIT_CODES.CANCELLED);
          }

          if (!confirmed) {
            p.outro(pc.dim("No changes made."));
            process.exit(EXIT_CODES.SUCCESS);
          }
        }

        console.log("");

        // Update each skill
        const updated: string[] = [];
        const failed: string[] = [];

        for (const skill of outdatedSkills) {
          s.start(`Updating ${skill.id}...`);

          const result = await updateSkill(skill, projectDir, sourceResult);

          if (result.success) {
            s.stop(`Updated ${pc.cyan(skill.id)}`);
            updated.push(skill.id);
          } else {
            s.stop(pc.red(`Failed to update ${skill.id}: ${result.error}`));
            failed.push(skill.id);
          }
        }

        // Recompile agents if needed
        let recompiledAgents: string[] = [];

        if (shouldRecompile && updated.length > 0) {
          console.log("");
          s.start("Recompiling agents...");

          try {
            const pluginDir = getCollectivePluginDir(projectDir);
            const recompileResult = await recompileAgents({
              pluginDir,
              sourcePath: sourceResult.sourcePath,
              projectDir,
            });

            recompiledAgents = recompileResult.compiled;

            if (recompiledAgents.length > 0) {
              s.stop("Agents recompiled");
              for (const agent of recompiledAgents) {
                console.log(`  Recompiled: ${pc.cyan(agent)}`);
              }
            } else {
              s.stop(pc.dim("No agents to recompile"));
            }

            if (recompileResult.warnings.length > 0) {
              for (const warning of recompileResult.warnings) {
                p.log.warn(warning);
              }
            }
          } catch (error) {
            s.stop(pc.yellow("Agent recompilation failed"));
            p.log.warn(
              `Could not recompile agents: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        // Final summary
        console.log("");
        if (failed.length === 0) {
          const agentMsg =
            recompiledAgents.length > 0
              ? `, ${recompiledAgents.length} agent(s) recompiled`
              : "";
          p.log.success(
            `Update complete! ${updated.length} skill(s) updated${agentMsg}.`,
          );
        } else {
          p.log.warn(
            `Update finished with errors: ${updated.length} updated, ${failed.length} failed.`,
          );
        }
        console.log("");

        process.exit(failed.length > 0 ? EXIT_CODES.ERROR : EXIT_CODES.SUCCESS);
      } catch (error) {
        s.stop(pc.red("Update failed"));
        const message = error instanceof Error ? error.message : String(error);
        console.error(pc.red(`\nError: ${message}\n`));
        process.exit(EXIT_CODES.ERROR);
      }
    },
  );
