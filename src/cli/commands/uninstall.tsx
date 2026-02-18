import React from "react";

import { Flags } from "@oclif/core";
import { render, Box, Text, useApp } from "ink";
import path from "path";

import { BaseCommand } from "../base-command";
import { Confirm } from "../components/common/confirm";
import { directoryExists, fileExists, listDirectories, remove } from "../utils/fs";
import { claudePluginUninstall, isClaudeCLIAvailable } from "../utils/exec";
import { listPluginNames, getProjectPluginsDir } from "../lib/plugins";
import { readLocalSkillMetadata } from "../lib/skills";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  CLI_COLORS,
  DEFAULT_BRANDING,
  STANDARD_FILES,
} from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  INFO_MESSAGES,
  DRY_RUN_MESSAGES,
} from "../utils/messages";

type UninstallTarget = {
  hasPlugins: boolean;
  pluginNames: string[];
  hasLocalSkills: boolean;
  hasLocalAgents: boolean;
  hasLocalConfig: boolean;
  hasClaudeDir: boolean;
  hasClaudeSrcDir: boolean;
  pluginsDir: string;
  skillsDir: string;
  agentsDir: string;
  configPath: string;
  claudeDir: string;
  claudeSrcDir: string;
};

async function detectUninstallTarget(projectDir: string): Promise<UninstallTarget> {
  const pluginsDir = getProjectPluginsDir(projectDir);
  const skillsDir = path.join(projectDir, CLAUDE_DIR, "skills");
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  const configPath = path.join(projectDir, CLAUDE_DIR, STANDARD_FILES.CONFIG_YAML);
  const claudeDir = path.join(projectDir, CLAUDE_DIR);
  const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);

  const [hasLocalSkills, hasLocalAgents, hasLocalConfig, hasClaudeDir, hasClaudeSrcDir] =
    await Promise.all([
      directoryExists(skillsDir),
      directoryExists(agentsDir),
      fileExists(configPath),
      directoryExists(claudeDir),
      directoryExists(claudeSrcDir),
    ]);

  let pluginNames: string[] = [];
  try {
    pluginNames = await listPluginNames(projectDir);
  } catch {
    // Best-effort: plugin detection may fail
  }

  return {
    hasPlugins: pluginNames.length > 0,
    pluginNames,
    hasLocalSkills,
    hasLocalAgents,
    hasLocalConfig,
    hasClaudeDir,
    hasClaudeSrcDir,
    pluginsDir,
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
  const hasPluginToRemove = uninstallPlugin && target.hasPlugins;
  const hasLocalToRemove = uninstallLocal && (target.hasClaudeDir || target.hasClaudeSrcDir);

  return (
    <Box flexDirection="column">
      <Text bold>The following will be removed:</Text>
      <Text> </Text>

      {hasPluginToRemove && (
        <Box flexDirection="column">
          <Text color={CLI_COLORS.ERROR}> Plugins:</Text>
          <Text dimColor> {target.pluginsDir}</Text>
        </Box>
      )}

      {hasLocalToRemove && (
        <Box flexDirection="column">
          <Text color={CLI_COLORS.ERROR}> Local directories:</Text>
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

/**
 * Checks whether a directory is empty (contains no entries).
 * Returns true if the directory has no subdirectories or files.
 */
async function isDirectoryEmpty(dirPath: string): Promise<boolean> {
  const entries = await listDirectories(dirPath);
  // listDirectories only returns directories; also check for files
  const { readdir } = await import("fs/promises");
  try {
    const allEntries = await readdir(dirPath);
    return allEntries.length === 0;
  } catch {
    return true;
  }
}

export default class Uninstall extends BaseCommand {
  static summary = `Remove ${DEFAULT_BRANDING.NAME} from this project`;

  static description = `Uninstall the ${DEFAULT_BRANDING.NAME} plugin and/or local directories (.claude/ and .claude-src/). By default, removes everything. Only removes skills that were installed by the CLI (marked with generatedByAgentsInc in metadata.yaml).`;

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
    this.log(`${DEFAULT_BRANDING.NAME} Uninstall`);
    this.log("");

    if (flags["dry-run"]) {
      this.log(DRY_RUN_MESSAGES.PREVIEW_NO_FILES_REMOVED);
      this.log("");
    }

    const target = await detectUninstallTarget(projectDir);

    const uninstallPlugin = !flags.local;
    const uninstallLocal = !flags.plugin;

    const hasPluginToRemove = uninstallPlugin && target.hasPlugins;
    const hasLocalToRemove = uninstallLocal && (target.hasClaudeDir || target.hasClaudeSrcDir);

    if (!hasPluginToRemove && !hasLocalToRemove) {
      this.warn("Nothing to uninstall.");
      this.log("");

      if (flags.plugin && !target.hasPlugins) {
        this.log(INFO_MESSAGES.NO_PLUGIN_INSTALLATION);
      }
      if (flags.local && !target.hasClaudeDir && !target.hasClaudeSrcDir) {
        this.log(INFO_MESSAGES.NO_LOCAL_INSTALLATION);
      }
      if (!flags.plugin && !flags.local) {
        this.log(INFO_MESSAGES.NOT_INSTALLED);
      }

      this.log("");
      this.log(INFO_MESSAGES.NO_CHANGES_MADE);
      return;
    }

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
      this.log("The following will be removed:");
      this.log("");

      if (hasPluginToRemove) {
        this.log("  Plugins:");
        this.log(`    ${target.pluginsDir}`);
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

    if (flags["dry-run"]) {
      if (hasPluginToRemove) {
        this.log(`[dry-run] Would uninstall ${target.pluginNames.length} plugins:`);
        for (const pluginName of target.pluginNames) {
          this.log(`[dry-run]   ${pluginName}`);
        }
      }
      if (hasLocalToRemove) {
        await this.dryRunLocalRemoval(target);
      }
      this.log("");
      this.log(DRY_RUN_MESSAGES.COMPLETE_NO_FILES_REMOVED);
      this.log("");
      return;
    }

    if (hasPluginToRemove) {
      this.log("Uninstalling plugins...");

      try {
        const cliAvailable = await isClaudeCLIAvailable();

        for (const pluginName of target.pluginNames) {
          if (cliAvailable) {
            try {
              await claudePluginUninstall(pluginName, "project", projectDir);
            } catch {
              // Best-effort: plugin may not be registered with Claude CLI
            }
          }

          const pluginPath = path.join(target.pluginsDir, pluginName);
          await remove(pluginPath);
        }

        this.logSuccess("Plugins uninstalled");
      } catch (error) {
        this.log("Plugin uninstall failed");
        this.error(error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR, {
          exit: EXIT_CODES.ERROR,
        });
      }
    }

    if (hasLocalToRemove) {
      this.log("Removing local files...");

      try {
        await this.removeLocalFiles(target);
      } catch (error) {
        this.log("Failed to remove local files");
        this.error(error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR, {
          exit: EXIT_CODES.ERROR,
        });
      }
    }

    this.log("");
    this.log(`${DEFAULT_BRANDING.NAME} has been uninstalled.`);

    this.log("");
    this.logSuccess(SUCCESS_MESSAGES.UNINSTALL_COMPLETE);
    this.log("");
  }

  /**
   * Selectively removes local files installed by the CLI.
   *
   * - Skills: only removes skill dirs with `generatedByAgentsInc: true` in metadata.yaml
   * - Agents: removes the entire `.claude/agents/` directory (compiled by CLI)
   * - Config: removes `.claude-src/` entirely (CLI-owned config)
   * - `.claude/`: only removed if empty after selective cleanup
   */
  private async removeLocalFiles(target: UninstallTarget): Promise<void> {
    let removedSkillCount = 0;
    let skippedSkillCount = 0;

    // Selectively remove skills based on generatedByAgentsInc flag
    if (target.hasLocalSkills) {
      const skillDirNames = await listDirectories(target.skillsDir);

      for (const skillDirName of skillDirNames) {
        const skillDir = path.join(target.skillsDir, skillDirName);
        const metadata = await readLocalSkillMetadata(skillDir);

        if (metadata?.generatedByAgentsInc) {
          await remove(skillDir);
          removedSkillCount++;
        } else {
          this.warn(`Skipping '${skillDirName}': not created by ${DEFAULT_BRANDING.NAME} CLI`);
          skippedSkillCount++;
        }
      }

      if (removedSkillCount > 0) {
        this.logSuccess(
          `Removed ${removedSkillCount} CLI-installed ${removedSkillCount === 1 ? "skill" : "skills"}`,
        );
      }

      // Remove skills/ directory if now empty
      if (skippedSkillCount === 0 && (await directoryExists(target.skillsDir))) {
        if (await isDirectoryEmpty(target.skillsDir)) {
          await remove(target.skillsDir);
        }
      }
    }

    // Remove compiled agents directory entirely (generated by CLI)
    if (target.hasLocalAgents) {
      await remove(target.agentsDir);
      this.logSuccess("Removed compiled agents");
    }

    // Remove .claude-src/ entirely (CLI-owned config)
    if (target.hasClaudeSrcDir) {
      await remove(target.claudeSrcDir);
      this.logSuccess(`Removed ${CLAUDE_SRC_DIR}/`);
    }

    // Only remove .claude/ itself if it is empty after cleanup
    if (target.hasClaudeDir && (await directoryExists(target.claudeDir))) {
      if (await isDirectoryEmpty(target.claudeDir)) {
        await remove(target.claudeDir);
        this.logSuccess(`Removed ${CLAUDE_DIR}/`);
      } else {
        this.log(`Kept ${CLAUDE_DIR}/ (contains user content)`);
      }
    }
  }

  /**
   * Dry-run preview of local file removal.
   * Shows what would be removed/skipped without making changes.
   */
  private async dryRunLocalRemoval(target: UninstallTarget): Promise<void> {
    // Preview skill removal
    if (target.hasLocalSkills) {
      const skillDirNames = await listDirectories(target.skillsDir);

      for (const skillDirName of skillDirNames) {
        const skillDir = path.join(target.skillsDir, skillDirName);
        const metadata = await readLocalSkillMetadata(skillDir);

        if (metadata?.generatedByAgentsInc) {
          this.log(`[dry-run] Would remove skill '${skillDirName}'`);
        } else {
          this.log(
            `[dry-run] Would skip '${skillDirName}': not created by ${DEFAULT_BRANDING.NAME} CLI`,
          );
        }
      }
    }

    // Preview agents removal
    if (target.hasLocalAgents) {
      this.log(`[dry-run] Would remove ${target.agentsDir}/`);
    }

    // Preview .claude-src/ removal
    if (target.hasClaudeSrcDir) {
      this.log(`[dry-run] Would remove ${target.claudeSrcDir}/`);
    }

    // Preview .claude/ removal
    if (target.hasClaudeDir) {
      this.log(`[dry-run] Would remove ${target.claudeDir}/ only if empty after cleanup`);
    }
  }
}
