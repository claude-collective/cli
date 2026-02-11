import React from "react";
import { Flags } from "@oclif/core";
import { render, Box, Text, useApp } from "ink";
import path from "path";
import { BaseCommand } from "../base-command";
import { Confirm } from "../components/common/confirm";
import { directoryExists, fileExists, remove } from "../utils/fs";
import { claudePluginUninstall, isClaudeCLIAvailable } from "../utils/exec";
import { getCollectivePluginDir } from "../lib/plugins";
import { CLAUDE_DIR, CLAUDE_SRC_DIR } from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";

const PLUGIN_NAME = "claude-collective";

type UninstallTarget = {
  hasPlugin: boolean;
  hasLocalSkills: boolean;
  hasLocalAgents: boolean;
  hasLocalConfig: boolean;
  hasClaudeDir: boolean;
  hasClaudeSrcDir: boolean;
  pluginDir: string;
  skillsDir: string;
  agentsDir: string;
  configPath: string;
  claudeDir: string;
  claudeSrcDir: string;
};

async function detectInstallation(projectDir: string): Promise<UninstallTarget> {
  const pluginDir = getCollectivePluginDir(projectDir);
  const skillsDir = path.join(projectDir, CLAUDE_DIR, "skills");
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  const configPath = path.join(projectDir, CLAUDE_DIR, "config.yaml");
  const claudeDir = path.join(projectDir, CLAUDE_DIR);
  const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);

  const [hasPlugin, hasLocalSkills, hasLocalAgents, hasLocalConfig, hasClaudeDir, hasClaudeSrcDir] =
    await Promise.all([
      directoryExists(pluginDir),
      directoryExists(skillsDir),
      directoryExists(agentsDir),
      fileExists(configPath),
      directoryExists(claudeDir),
      directoryExists(claudeSrcDir),
    ]);

  return {
    hasPlugin,
    hasLocalSkills,
    hasLocalAgents,
    hasLocalConfig,
    hasClaudeDir,
    hasClaudeSrcDir,
    pluginDir,
    skillsDir,
    agentsDir,
    configPath,
    claudeDir,
    claudeSrcDir,
  };
}

type UninstallConfirmProps = {
  target: UninstallTarget;
  uninstallPlugin: boolean;
  uninstallLocal: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const UninstallConfirm: React.FC<UninstallConfirmProps> = ({
  target,
  uninstallPlugin,
  uninstallLocal,
  onConfirm,
  onCancel,
}) => {
  const { exit } = useApp();
  const hasPluginToRemove = uninstallPlugin && target.hasPlugin;
  const hasLocalToRemove = uninstallLocal && (target.hasClaudeDir || target.hasClaudeSrcDir);

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
          <Text color="red"> Local directories:</Text>
          {target.hasClaudeDir && <Text dimColor> {target.claudeDir}/</Text>}
          {target.hasClaudeSrcDir && <Text dimColor> {target.claudeSrcDir}/</Text>}
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
  static summary = "Remove Claude Collective from this project";

  static description =
    "Uninstall the Claude Collective plugin and/or local directories (.claude/ and .claude-src/). By default, removes everything.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --yes",
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
    const hasLocalToRemove = uninstallLocal && (target.hasClaudeDir || target.hasClaudeSrcDir);

    if (!hasPluginToRemove && !hasLocalToRemove) {
      this.warn("Nothing to uninstall.");
      this.log("");

      if (flags.plugin && !target.hasPlugin) {
        this.log("No plugin installation found.");
      }
      if (flags.local && !target.hasClaudeDir && !target.hasClaudeSrcDir) {
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
        this.log("  Local directories:");
        if (target.hasClaudeDir) {
          this.log(`    ${target.claudeDir}/`);
        }
        if (target.hasClaudeSrcDir) {
          this.log(`    ${target.claudeSrcDir}/`);
        }
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
        if (target.hasClaudeDir) {
          this.log(`[dry-run] Would remove ${target.claudeDir}/`);
        }
        if (target.hasClaudeSrcDir) {
          this.log(`[dry-run] Would remove ${target.claudeSrcDir}/`);
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
        this.error(error instanceof Error ? error.message : "Unknown error occurred", {
          exit: EXIT_CODES.ERROR,
        });
      }
    }

    // Remove local directories
    if (hasLocalToRemove) {
      this.log("Removing local directories...");

      try {
        const removed: string[] = [];

        if (target.hasClaudeDir) {
          await remove(target.claudeDir);
          removed.push(CLAUDE_DIR);
        }

        if (target.hasClaudeSrcDir) {
          await remove(target.claudeSrcDir);
          removed.push(CLAUDE_SRC_DIR);
        }

        this.logSuccess(
          `Removed ${removed.length} ${removed.length === 1 ? "directory" : "directories"}: ${removed.join(", ")}`,
        );
      } catch (error) {
        this.log("Failed to remove local directories");
        this.error(error instanceof Error ? error.message : "Unknown error occurred", {
          exit: EXIT_CODES.ERROR,
        });
      }
    }

    this.log("");
    this.log("Claude Collective has been uninstalled.");

    this.log("");
    this.logSuccess("Uninstall complete!");
    this.log("");
  }
}
