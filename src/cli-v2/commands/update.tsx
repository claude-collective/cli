import React, { useState } from "react";
import { render } from "ink";
import { Flags, Args } from "@oclif/core";
import { printTable } from "@oclif/table";
import path from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { BaseCommand } from "../base-command.js";
import {
  loadSkillsMatrixFromSource,
  type SourceLoadResult,
} from "../lib/source-loader.js";
import { hashFile } from "../lib/versioning.js";
import { recompileAgents } from "../lib/agent-recompiler.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import {
  fileExists,
  readFile,
  writeFile,
  listDirectories,
  copy,
} from "../utils/fs.js";
import { LOCAL_SKILLS_PATH } from "../consts.js";
import { getCollectivePluginDir } from "../lib/plugin-finder.js";
import { Confirm } from "../components/common/confirm.js";

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
 * Confirmation component for update operation
 */
interface UpdateConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const UpdateConfirm: React.FC<UpdateConfirmProps> = ({
  onConfirm,
  onCancel,
}) => {
  return (
    <Confirm
      message="Proceed with update?"
      onConfirm={onConfirm}
      onCancel={onCancel}
      defaultValue={false}
    />
  );
};

export default class Update extends BaseCommand {
  static summary = "Update local skills from source";

  static description =
    "Update local skills from the source repository. By default, checks all skills for updates. Specify a skill name to update only that skill.";

  static args = {
    skill: Args.string({
      description: "Specific skill to update (optional)",
      required: false,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    yes: Flags.boolean({
      char: "y",
      description: "Skip confirmation prompt",
      default: false,
    }),
    "no-recompile": Flags.boolean({
      description: "Skip agent recompilation after update",
      default: false,
    }),
  };

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> my-skill",
    "<%= config.bin %> <%= command.id %> --yes",
    "<%= config.bin %> <%= command.id %> --source /path/to/marketplace",
    "<%= config.bin %> <%= command.id %> --no-recompile",
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Update);
    const projectDir = process.cwd();
    const shouldRecompile = !flags["no-recompile"];

    try {
      // Check if local skills directory exists
      const localSkillsPath = path.join(projectDir, LOCAL_SKILLS_PATH);
      if (!(await fileExists(localSkillsPath))) {
        this.warn("No local skills found. Run `cc init` or `cc edit` first.");
        return;
      }

      this.log("Loading skills...");

      const sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
        projectDir,
      });

      this.log(
        `Loaded from ${sourceResult.isLocal ? "local" : "remote"}: ${sourceResult.sourcePath}`,
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
      if (args.skill) {
        const foundSkill = findSkillByPartialMatch(args.skill, allResults);

        if (!foundSkill) {
          this.log("");
          this.log(`Error: Skill "${args.skill}" not found.`);
          this.log("");

          const similar = findSimilarSkills(args.skill, allResults);
          if (similar.length > 0) {
            this.log("Did you mean one of these?");
            for (const name of similar) {
              this.log(`  - ${name}`);
            }
            this.log("");
          }

          this.log(
            `Run \`cc search ${args.skill}\` to search available skills.`,
          );
          this.log("");
          this.error("Skill not found", { exit: EXIT_CODES.ERROR });
        }

        if (foundSkill.status === "current") {
          this.log("");
          this.log(`Skill "${foundSkill.id}" is already up to date.`);
          this.log("");
          this.log(`  Local hash:  ${foundSkill.localHash}`);
          this.log(`  Source hash: ${foundSkill.sourceHash}`);
          this.log("");
          return;
        }

        if (foundSkill.status === "local-only") {
          this.log("");
          this.log(
            `Skill "${foundSkill.id}" is a local-only skill (not forked from source).`,
          );
          this.log("Cannot update local-only skills.");
          this.log("");
          return;
        }

        // Only update this specific skill
        outdatedSkills = [foundSkill];
      }

      // Check if there are any outdated skills
      if (outdatedSkills.length === 0) {
        this.log("");
        this.logSuccess("All skills are up to date.");
        this.log("");
        return;
      }

      // Show what will be updated
      this.log("");
      this.log("The following skills will be updated:");
      this.log("");

      printTable({
        data: outdatedSkills.map((skill) => ({
          skill: skill.id,
          localHash: skill.localHash ?? "-",
          sourceHash: skill.sourceHash ?? "-",
        })),
        columns: [
          { key: "skill", name: "Skill" },
          { key: "localHash", name: "Local Hash" },
          { key: "sourceHash", name: "Source Hash" },
        ],
        headerOptions: { bold: true },
      });

      this.log("");
      this.log(`${outdatedSkills.length} skill(s) will be updated.`);
      this.log("");

      // Confirm unless --yes flag
      if (!flags.yes) {
        let confirmed = false;
        let cancelled = false;

        const { waitUntilExit } = render(
          <UpdateConfirm
            onConfirm={() => {
              confirmed = true;
            }}
            onCancel={() => {
              cancelled = true;
            }}
          />,
        );

        await waitUntilExit();

        if (cancelled) {
          this.log("Update cancelled");
          this.exit(EXIT_CODES.CANCELLED);
        }

        if (!confirmed) {
          this.log("No changes made.");
          return;
        }
      }

      this.log("");

      // Update each skill
      const updated: string[] = [];
      const failed: string[] = [];

      for (const skill of outdatedSkills) {
        this.log(`Updating ${skill.id}...`);

        const result = await updateSkill(skill, projectDir, sourceResult);

        if (result.success) {
          this.log(`  Updated ${skill.id}`);
          updated.push(skill.id);
        } else {
          this.log(`  Failed to update ${skill.id}: ${result.error}`);
          failed.push(skill.id);
        }
      }

      // Recompile agents if needed
      let recompiledAgents: string[] = [];

      if (shouldRecompile && updated.length > 0) {
        this.log("");
        this.log("Recompiling agents...");

        try {
          const pluginDir = getCollectivePluginDir(projectDir);
          const recompileResult = await recompileAgents({
            pluginDir,
            sourcePath: sourceResult.sourcePath,
            projectDir,
          });

          recompiledAgents = recompileResult.compiled;

          if (recompiledAgents.length > 0) {
            this.log("Agents recompiled");
            for (const agent of recompiledAgents) {
              this.log(`  Recompiled: ${agent}`);
            }
          } else {
            this.log("No agents to recompile");
          }

          if (recompileResult.warnings.length > 0) {
            for (const warning of recompileResult.warnings) {
              this.warn(warning);
            }
          }
        } catch (error) {
          this.warn("Agent recompilation failed");
          this.warn(
            `Could not recompile agents: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // Final summary
      this.log("");
      if (failed.length === 0) {
        const agentMsg =
          recompiledAgents.length > 0
            ? `, ${recompiledAgents.length} agent(s) recompiled`
            : "";
        this.logSuccess(
          `Update complete! ${updated.length} skill(s) updated${agentMsg}.`,
        );
      } else {
        this.warn(
          `Update finished with errors: ${updated.length} updated, ${failed.length} failed.`,
        );
      }
      this.log("");

      if (failed.length > 0) {
        this.error("Some updates failed", { exit: EXIT_CODES.ERROR });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Update failed: ${message}`, { exit: EXIT_CODES.ERROR });
    }
  }
}
