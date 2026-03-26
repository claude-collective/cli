import React from "react";

import { Flags, Args } from "@oclif/core";
import { printTable } from "@oclif/table";
import { render } from "ink";
import os from "os";

import { BaseCommand } from "../base-command.js";
import { getErrorMessage } from "../utils/errors.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import {
  loadSource,
  compareSkillsWithSource,
  compileAgents,
  updateLocalSkills,
  collectScopedSkillDirs,
  findSkillMatch,
} from "../lib/operations/index.js";
import { CLI_BIN_NAME } from "../consts.js";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  STATUS_MESSAGES,
  INFO_MESSAGES,
} from "../utils/messages.js";
import { Confirm } from "../components/common/confirm.js";

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
      const homeDir = os.homedir();
      const { hasProject, hasGlobal } = await collectScopedSkillDirs(projectDir);

      if (!hasProject && !hasGlobal) {
        this.warn(ERROR_MESSAGES.NO_LOCAL_SKILLS);
        return;
      }

      this.log(STATUS_MESSAGES.LOADING_SKILLS);

      const { sourceResult } = await loadSource({
        sourceFlag: flags.source,
        projectDir,
      });

      this.log(
        `Loaded from ${sourceResult.isLocal ? "local" : "remote"}: ${sourceResult.sourcePath}`,
      );

      const comparison = await compareSkillsWithSource(
        projectDir,
        sourceResult.sourcePath,
        sourceResult.matrix,
      );
      const allResults = comparison.merged;
      // Build skillBaseDir from separate results for updateLocalSkills dest path
      const skillBaseDir = new Map<string, string>();
      for (const r of comparison.projectResults) skillBaseDir.set(r.id, projectDir);
      for (const r of comparison.globalResults) {
        if (!skillBaseDir.has(r.id)) skillBaseDir.set(r.id, homeDir);
      }

      let outdatedSkills = allResults.filter((r) => r.status === "outdated");

      if (args.skill) {
        const { match: foundSkill, similar } = findSkillMatch(args.skill, allResults);

        if (!foundSkill) {
          this.log("");
          this.log(`Error: Skill "${args.skill}" not found.`);
          this.log("");

          if (similar.length > 0) {
            this.log("Did you mean one of these?");
            for (const name of similar) {
              this.log(`  - ${name}`);
            }
            this.log("");
          }

          this.log(`Run \`${CLI_BIN_NAME} search ${args.skill}\` to search available skills.`);
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

      const updateResult = await updateLocalSkills({
        skills: outdatedSkills,
        sourceResult,
        skillBaseDir,
        onProgress: (skillId) => this.log(`Updating ${skillId}...`),
      });

      for (const item of updateResult.updated) {
        this.log(`  Updated ${item.id}`);
      }
      for (const item of updateResult.failed) {
        this.log(`  Failed to update ${item.id}: ${item.error}`);
      }

      let recompiledAgents: string[] = [];

      if (shouldRecompile && updateResult.totalUpdated > 0) {
        this.log("");
        this.log(STATUS_MESSAGES.RECOMPILING_AGENTS);

        try {
          const recompileResult = await compileAgents({
            projectDir,
            sourcePath: sourceResult.sourcePath,
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
          this.warn(`Could not recompile agents: ${getErrorMessage(error)}`);
        }
      }

      this.log("");
      if (updateResult.totalFailed === 0) {
        const agentMsg =
          recompiledAgents.length > 0 ? `, ${recompiledAgents.length} agent(s) recompiled` : "";
        this.logSuccess(
          `Update complete! ${updateResult.totalUpdated} skill(s) updated${agentMsg}.`,
        );
      } else {
        this.warn(
          `Update finished with errors: ${updateResult.totalUpdated} updated, ${updateResult.totalFailed} failed.`,
        );
      }
      this.log("");

      if (updateResult.totalFailed > 0) {
        this.error("Some updates failed", { exit: EXIT_CODES.ERROR });
      }
    } catch (error) {
      const message = getErrorMessage(error);
      this.error(`Update failed: ${message}`, { exit: EXIT_CODES.ERROR });
    }
  }
}
