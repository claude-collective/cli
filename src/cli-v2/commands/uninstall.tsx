import React, { useState } from "react";
import { Flags } from "@oclif/core";
import { render, Box, Text } from "ink";
import path from "path";
import { BaseCommand } from "../base-command";
import { Confirm } from "../components/common/confirm";
import { directoryExists, fileExists, remove } from "../utils/fs";
import { claudePluginUninstall, isClaudeCLIAvailable } from "../utils/exec";
import { getCollectivePluginDir } from "../lib/plugin-finder";
import { CLAUDE_DIR } from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";

const PLUGIN_NAME = "claude-collective";

interface UninstallTarget {
  hasPlugin: boolean;
  hasLocalSkills: boolean;
  hasLocalAgents: boolean;
  hasLocalConfig: boolean;
  pluginDir: string;
  skillsDir: string;
  agentsDir: string;
  configPath: string;
}

async function detectInstallation(
  projectDir: string,
): Promise<UninstallTarget> {
  const pluginDir = getCollectivePluginDir(projectDir);
  const skillsDir = path.join(projectDir, CLAUDE_DIR, "skills");
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  const configPath = path.join(projectDir, CLAUDE_DIR, "config.yaml");

  const [hasPlugin, hasLocalSkills, hasLocalAgents, hasLocalConfig] =
    await Promise.all([
      directoryExists(pluginDir),
      directoryExists(skillsDir),
      directoryExists(agentsDir),
      fileExists(configPath),
    ]);

  return {
    hasPlugin,
    hasLocalSkills,
    hasLocalAgents,
    hasLocalConfig,
    pluginDir,
    skillsDir,
    agentsDir,
    configPath,
  };
}

interface UninstallConfirmProps {
  target: UninstallTarget;
  uninstallPlugin: boolean;
  uninstallLocal: boolean;
  keepConfig: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const UninstallConfirm: React.FC<UninstallConfirmProps> = ({
  target,
  uninstallPlugin,
  uninstallLocal,
  keepConfig,
  onConfirm,
  onCancel,
}) => {
  const hasPluginToRemove = uninstallPlugin && target.hasPlugin;
  const hasLocalToRemove =
    uninstallLocal &&
    (target.hasLocalSkills || target.hasLocalAgents || target.hasLocalConfig);

  return (
    <Box flexDirection="column">
      <Text bold>The following will be removed:</Text>
      <Text> </Text>

      {hasPluginToRemove && (
        <Box flexDirection="column">
          <Text color="red"> Plugin:</Text>
          <Text dimColor> {target.pluginDir}</Text>
        </Box>
      )}

      {hasLocalToRemove && (
        <Box flexDirection="column">
          <Text color="red"> Local files:</Text>
          {target.hasLocalSkills && <Text dimColor> {target.skillsDir}</Text>}
          {target.hasLocalAgents && <Text dimColor> {target.agentsDir}</Text>}
          {target.hasLocalConfig && !keepConfig && (
            <Text dimColor> {target.configPath}</Text>
          )}
        </Box>
      )}

      {keepConfig && target.hasLocalConfig && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow"> Keeping:</Text>
          <Text dimColor> {target.configPath}</Text>
        </Box>
      )}

      <Text> </Text>
      <Confirm
        message="Are you sure you want to uninstall?"
        onConfirm={onConfirm}
        onCancel={onCancel}
        defaultValue={false}
      />
    </Box>
  );
};

export default class Uninstall extends BaseCommand {
  static summary = "Remove Claude Collective from this project";

  static description =
    "Uninstall the Claude Collective plugin and/or local files (.claude/skills, .claude/agents, .claude/config.yaml). By default, removes everything.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --yes",
    "<%= config.bin %> <%= command.id %> --keep-config",
    "<%= config.bin %> <%= command.id %> --plugin",
    "<%= config.bin %> <%= command.id %> --local",
    "<%= config.bin %> <%= command.id %> --dry-run",
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    yes: Flags.boolean({
      char: "y",
      description: "Skip confirmation prompt",
      default: false,
    }),
    "keep-config": Flags.boolean({
      description: "Keep .claude/config.yaml",
      default: false,
    }),
    plugin: Flags.boolean({
      description: "Only uninstall the plugin (not local files)",
      default: false,
    }),
    local: Flags.boolean({
      description: "Only remove local files (not the plugin)",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Uninstall);
    const projectDir = process.cwd();

    this.log("");
    this.log("Claude Collective Uninstall");
    this.log("");

    if (flags["dry-run"]) {
      this.log("[dry-run] Preview mode - no files will be removed");
      this.log("");
    }

    // Detect what's installed
    const target = await detectInstallation(projectDir);

    // Determine what to uninstall based on flags
    const uninstallPlugin = !flags.local;
    const uninstallLocal = !flags.plugin;

    // Check if there's anything to uninstall
    const hasPluginToRemove = uninstallPlugin && target.hasPlugin;
    const hasLocalToRemove =
      uninstallLocal &&
      (target.hasLocalSkills || target.hasLocalAgents || target.hasLocalConfig);

    if (!hasPluginToRemove && !hasLocalToRemove) {
      this.warn("Nothing to uninstall.");
      this.log("");

      if (flags.plugin && !target.hasPlugin) {
        this.log("No plugin installation found.");
      }
      if (flags.local && !target.hasLocalSkills && !target.hasLocalAgents) {
        this.log("No local installation found.");
      }
      if (!flags.plugin && !flags.local) {
        this.log("Claude Collective is not installed in this project.");
      }

      this.log("");
      this.log("No changes made.");
      return;
    }

    // Show what will be removed and get confirmation (unless --yes or --dry-run)
    if (!flags.yes && !flags["dry-run"]) {
      const confirmed = await new Promise<boolean>((resolve) => {
        const { waitUntilExit } = render(
          <UninstallConfirm
            target={target}
            uninstallPlugin={uninstallPlugin}
            uninstallLocal={uninstallLocal}
            keepConfig={flags["keep-config"]}
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
      // In dry-run or --yes mode, just show what will be removed
      this.log("The following will be removed:");
      this.log("");

      if (hasPluginToRemove) {
        this.log("  Plugin:");
        this.log(`    ${target.pluginDir}`);
      }

      if (hasLocalToRemove) {
        this.log("  Local files:");
        if (target.hasLocalSkills) {
          this.log(`    ${target.skillsDir}`);
        }
        if (target.hasLocalAgents) {
          this.log(`    ${target.agentsDir}`);
        }
        if (target.hasLocalConfig && !flags["keep-config"]) {
          this.log(`    ${target.configPath}`);
        }
      }

      if (flags["keep-config"] && target.hasLocalConfig) {
        this.log("");
        this.log("  Keeping:");
        this.log(`    ${target.configPath}`);
      }

      this.log("");
    }

    // Dry run - show what would happen
    if (flags["dry-run"]) {
      if (hasPluginToRemove) {
        this.log(`[dry-run] Would uninstall plugin "${PLUGIN_NAME}"`);
        this.log(`[dry-run] Would remove ${target.pluginDir}`);
      }
      if (hasLocalToRemove) {
        if (target.hasLocalSkills) {
          this.log(`[dry-run] Would remove ${target.skillsDir}`);
        }
        if (target.hasLocalAgents) {
          this.log(`[dry-run] Would remove ${target.agentsDir}`);
        }
        if (target.hasLocalConfig && !flags["keep-config"]) {
          this.log(`[dry-run] Would remove ${target.configPath}`);
        }
      }
      this.log("");
      this.log("[dry-run] Preview complete - no files were removed");
      this.log("");
      return;
    }

    // Uninstall plugin
    if (hasPluginToRemove) {
      this.log("Uninstalling plugin...");

      try {
        // Try to use claude CLI to uninstall (handles settings.json)
        const cliAvailable = await isClaudeCLIAvailable();
        if (cliAvailable) {
          await claudePluginUninstall(PLUGIN_NAME, "project", projectDir);
        }

        // Remove plugin directory
        await remove(target.pluginDir);

        this.logSuccess("Plugin uninstalled");
      } catch (error) {
        this.log("Plugin uninstall failed");
        this.error(
          error instanceof Error ? error.message : "Unknown error occurred",
          { exit: EXIT_CODES.ERROR },
        );
      }
    }

    // Remove local files
    if (hasLocalToRemove) {
      this.log("Removing local files...");

      try {
        const removed: string[] = [];

        if (target.hasLocalSkills) {
          await remove(target.skillsDir);
          removed.push(".claude/skills/");
        }

        if (target.hasLocalAgents) {
          await remove(target.agentsDir);
          removed.push(".claude/agents/");
        }

        if (target.hasLocalConfig && !flags["keep-config"]) {
          await remove(target.configPath);
          removed.push(".claude/config.yaml");
        }

        this.logSuccess(
          `Removed ${removed.length} ${removed.length === 1 ? "item" : "items"}`,
        );
      } catch (error) {
        this.log("Failed to remove local files");
        this.error(
          error instanceof Error ? error.message : "Unknown error occurred",
          { exit: EXIT_CODES.ERROR },
        );
      }
    }

    this.log("");
    this.log("Claude Collective has been uninstalled.");

    if (flags["keep-config"]) {
      this.log("");
      this.log("Configuration preserved at .claude/config.yaml");
      this.log("Run `cc init` to reinstall with your existing configuration.");
    }

    this.log("");
    this.logSuccess("Uninstall complete!");
    this.log("");
  }
}
