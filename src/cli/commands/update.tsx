import React from "react";

import { Flags, Args } from "@oclif/core";
import { printTable } from "@oclif/table";
import { render } from "ink";
import path from "path";

import { BaseCommand } from "../base-command.js";
import { getErrorMessage } from "../utils/errors.js";
import { loadSkillsMatrixFromSource, type SourceLoadResult } from "../lib/loading/index.js";
import { recompileAgents } from "../lib/agents/index.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import {
  compareLocalSkillsWithSource,
  injectForkedFromMetadata,
  type SkillComparisonResult,
} from "../lib/skills/index.js";
import { fileExists, copy } from "../utils/fs.js";
import { LOCAL_SKILLS_PATH } from "../consts.js";
import { getCollectivePluginDir } from "../lib/plugins/index.js";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  STATUS_MESSAGES,
  INFO_MESSAGES,
} from "../utils/messages.js";
import { Confirm } from "../components/common/confirm.js";

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
    await copy(srcPath, destPath);
    await injectForkedFromMetadata(destPath, skill.id, skill.sourceHash);

    return { success: true, newHash: skill.sourceHash };
  } catch (error) {
    return {
      success: false,
      newHash: null,
      error: getErrorMessage(error),
    };
  }
}

function findSkillByPartialMatch(
  skillName: string,
  results: SkillComparisonResult[],
): SkillComparisonResult | null {
  const exact = results.find((r) => r.id === skillName);
  if (exact) return exact;

  const partial = results.find((r) => {
    const nameWithoutAuthor = r.id.replace(/\s*\(@\w+\)$/, "").toLowerCase();
    return nameWithoutAuthor === skillName.toLowerCase();
  });
  if (partial) return partial;

  const byDir = results.find((r) => r.dirName.toLowerCase() === skillName.toLowerCase());
  if (byDir) return byDir;

  return null;
}

function findSimilarSkills(skillName: string, results: SkillComparisonResult[]): string[] {
  const lowered = skillName.toLowerCase();
  return results
    .filter((r) => {
      const name = r.id.toLowerCase();
      const dir = r.dirName.toLowerCase();
      return (
        name.includes(lowered) || dir.includes(lowered) || lowered.includes(name.split(" ")[0])
      );
    })
    .map((r) => r.id)
    .slice(0, 3);
}

type UpdateConfirmProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

const UpdateConfirm: React.FC<UpdateConfirmProps> = ({ onConfirm, onCancel }) => {
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
      const localSkillsPath = path.join(projectDir, LOCAL_SKILLS_PATH);
      if (!(await fileExists(localSkillsPath))) {
        this.warn(ERROR_MESSAGES.NO_LOCAL_SKILLS);
        return;
      }

      this.log(STATUS_MESSAGES.LOADING_SKILLS);

      const sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
        projectDir,
      });

      this.log(
        `Loaded from ${sourceResult.isLocal ? "local" : "remote"}: ${sourceResult.sourcePath}`,
      );

      const sourceSkills: Record<string, { path: string }> = {};
      for (const [skillId, skill] of Object.entries(sourceResult.matrix.skills)) {
        if (!skill) continue;
        if (!skill.local) {
          sourceSkills[skillId] = { path: skill.path };
        }
      }

      const allResults = await compareLocalSkillsWithSource(projectDir, sourceResult.sourcePath, sourceSkills);

      let outdatedSkills = allResults.filter((r) => r.status === "outdated");

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

          this.log(`Run \`cc search ${args.skill}\` to search available skills.`);
          this.log("");
          this.error(ERROR_MESSAGES.SKILL_NOT_FOUND, { exit: EXIT_CODES.ERROR });
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
          this.log(`Skill "${foundSkill.id}" is a local-only skill (not forked from source).`);
          this.log("Cannot update local-only skills.");
          this.log("");
          return;
        }

        outdatedSkills = [foundSkill];
      }

      if (outdatedSkills.length === 0) {
        this.log("");
        this.logSuccess(SUCCESS_MESSAGES.ALL_SKILLS_UP_TO_DATE);
        this.log("");
        return;
      }

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
          this.log(INFO_MESSAGES.NO_CHANGES_MADE);
          return;
        }
      }

      this.log("");

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

      let recompiledAgents: string[] = [];

      if (shouldRecompile && updated.length > 0) {
        this.log("");
        this.log(STATUS_MESSAGES.RECOMPILING_AGENTS);

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
            this.log(INFO_MESSAGES.NO_AGENTS_TO_RECOMPILE);
          }

          if (recompileResult.warnings.length > 0) {
            for (const warning of recompileResult.warnings) {
              this.warn(warning);
            }
          }
        } catch (error) {
          this.warn("Agent recompilation failed");
          this.warn(
            `Could not recompile agents: ${getErrorMessage(error)}`,
          );
        }
      }

      this.log("");
      if (failed.length === 0) {
        const agentMsg =
          recompiledAgents.length > 0 ? `, ${recompiledAgents.length} agent(s) recompiled` : "";
        this.logSuccess(`Update complete! ${updated.length} skill(s) updated${agentMsg}.`);
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
      const message = getErrorMessage(error);
      this.error(`Update failed: ${message}`, { exit: EXIT_CODES.ERROR });
    }
  }
}
