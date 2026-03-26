import React from "react";

import { Flags } from "@oclif/core";
import { render, Box, Text, useApp } from "ink";

import { BaseCommand } from "../base-command";
import { Confirm } from "../components/common/confirm";
import { getErrorMessage } from "../utils/errors";
import {
  detectUninstallTarget,
  removeMatchingSkills,
  removeMatchingAgents,
  uninstallPlugins,
  cleanupEmptyDirs,
} from "../lib/operations";
import type { UninstallTarget } from "../lib/operations";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, CLI_COLORS, DEFAULT_BRANDING } from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";
import { SUCCESS_MESSAGES, INFO_MESSAGES } from "../utils/messages";

type UninstallConfirmProps = {
  target: UninstallTarget;
  removeAll: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const UninstallConfirm: React.FC<UninstallConfirmProps> = ({
  target,
  removeAll,
  onConfirm,
  onCancel,
}) => {
  const { exit } = useApp();

  return (
    <Box flexDirection="column">
      <Text bold>The following will be removed:</Text>
      <Text> </Text>

      {target.hasPlugins && (
        <Box flexDirection="column">
          <Text color={CLI_COLORS.ERROR}> Plugins:</Text>
          {target.cliPluginNames.map((name) => (
            <Text key={name} dimColor>
              {" "}
              {name}
            </Text>
          ))}
        </Box>
      )}

      {(target.hasLocalSkills || target.hasLocalAgents) && (
        <Box flexDirection="column">
          <Text color={CLI_COLORS.ERROR}> CLI-managed files:</Text>
          {target.hasLocalSkills && <Text dimColor> {target.skillsDir}/ (matching sources)</Text>}
          {target.hasLocalAgents && <Text dimColor> {target.agentsDir}/ (CLI-compiled)</Text>}
        </Box>
      )}

      {removeAll && target.hasClaudeSrcDir && (
        <Box flexDirection="column">
          <Text color={CLI_COLORS.ERROR}> Config:</Text>
          <Text dimColor> {target.claudeSrcDir}/</Text>
        </Box>
      )}

      <Text> </Text>
      <Confirm
        message="Are you sure you want to uninstall?"
        onConfirm={() => {
          onConfirm();
          exit();
        }}
        onCancel={() => {
          onCancel();
          exit();
        }}
        defaultValue={false}
      />
    </Box>
  );
};

export default class Uninstall extends BaseCommand {
  static summary = `Remove ${DEFAULT_BRANDING.NAME} from this project`;

  static description = `Uninstall ${DEFAULT_BRANDING.NAME} from this project. Removes CLI-managed skills (matched by source), compiled agents, and plugins. User-created content is preserved.`;

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --yes",
    "<%= config.bin %> <%= command.id %> --all",
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    yes: Flags.boolean({
      char: "y",
      description: "Skip confirmation prompt",
      default: false,
    }),
    all: Flags.boolean({
      description: "Also remove .claude-src/ config directory",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Uninstall);
    const projectDir = process.cwd();

    this.log("");
    this.log(`${DEFAULT_BRANDING.NAME} Uninstall`);
    this.log("");

    const target = await detectUninstallTarget(projectDir);

    const hasAnythingToRemove =
      target.hasPlugins ||
      target.hasLocalSkills ||
      target.hasLocalAgents ||
      (flags.all && target.hasClaudeSrcDir);

    if (!hasAnythingToRemove) {
      this.warn("Nothing to uninstall.");
      this.log("");
      this.log(INFO_MESSAGES.NOT_INSTALLED);
      this.log("");
      this.log(INFO_MESSAGES.NO_CHANGES_MADE);
      return;
    }

    if (!flags.yes) {
      const confirmed = await new Promise<boolean>((resolve) => {
        const { waitUntilExit } = render(
          <UninstallConfirm
            target={target}
            removeAll={flags.all}
            onConfirm={() => resolve(true)}
            onCancel={() => resolve(false)}
          />,
        );

        waitUntilExit().catch(() => resolve(false));
      });

      if (!confirmed) {
        this.log("");
        this.log("Uninstall cancelled");
        this.exit(EXIT_CODES.CANCELLED);
      }
    } else {
      this.log("The following will be removed:");
      this.log("");

      if (target.hasPlugins) {
        this.log("  Plugins:");
        for (const pluginName of target.cliPluginNames) {
          this.log(`    ${pluginName}`);
        }
      }

      if (target.hasLocalSkills || target.hasLocalAgents) {
        this.log("  CLI-managed files:");
        if (target.hasLocalSkills) {
          this.log(`    ${target.skillsDir}/ (matching sources)`);
        }
        if (target.hasLocalAgents) {
          this.log(`    ${target.agentsDir}/ (CLI-compiled)`);
        }
      }

      if (flags.all && target.hasClaudeSrcDir) {
        this.log("  Config:");
        this.log(`    ${target.claudeSrcDir}/`);
      }

      this.log("");
    }

    if (target.hasPlugins) {
      this.log("Uninstalling plugins...");

      try {
        const pluginResult = await uninstallPlugins(target, projectDir, (name) =>
          this.log(`  Uninstalled plugin '${name}'`),
        );

        this.logSuccess(
          `Uninstalled ${pluginResult.totalUninstalled} ${pluginResult.totalUninstalled === 1 ? "plugin" : "plugins"}`,
        );
      } catch (error) {
        this.log("Plugin uninstall failed");
        this.error(getErrorMessage(error), {
          exit: EXIT_CODES.ERROR,
        });
      }
    }

    try {
      await this.removeLocalFiles(target, flags.all);
    } catch (error) {
      this.log("Failed to remove local files");
      this.error(getErrorMessage(error), {
        exit: EXIT_CODES.ERROR,
      });
    }

    this.log("");
    this.log(`${DEFAULT_BRANDING.NAME} has been uninstalled.`);
    this.log("");
    this.logSuccess(SUCCESS_MESSAGES.UNINSTALL_COMPLETE);
    this.log("");
  }

  private async removeLocalFiles(target: UninstallTarget, removeAll: boolean): Promise<void> {
    const skillResult = await removeMatchingSkills(
      target,
      (dirName) => this.log(`  Uninstalled skill '${dirName}'`),
      (dirName) => this.warn(`Skipping '${dirName}': not created by ${DEFAULT_BRANDING.NAME} CLI`),
    );

    if (skillResult.removedCount > 0) {
      this.logSuccess(
        `Removed ${skillResult.removedCount} CLI-installed ${skillResult.removedCount === 1 ? "skill" : "skills"}`,
      );
    }

    const agentResult = await removeMatchingAgents(target, (agentName) =>
      this.log(`  Uninstalled agent '${agentName}'`),
    );

    if (agentResult.removedCount > 0) {
      this.logSuccess(
        `Removed ${agentResult.removedCount} compiled ${agentResult.removedCount === 1 ? "agent" : "agents"}`,
      );
    }

    const cleanup = await cleanupEmptyDirs(target, removeAll);

    if (cleanup.claudeSrcDirRemoved) {
      this.logSuccess(`Removed ${CLAUDE_SRC_DIR}/`);
    }

    if (cleanup.claudeDirRemoved) {
      this.logSuccess(`Removed ${CLAUDE_DIR}/`);
    } else if (cleanup.claudeDirKept) {
      this.log(`Kept ${CLAUDE_DIR}/ (contains user content)`);
    }
  }
}
