import React from "react";

import { Flags } from "@oclif/core";
import { render, Box, Text, useApp } from "ink";
import path from "path";

import { BaseCommand } from "../base-command";
import { Confirm } from "../components/common/confirm";
import { getErrorMessage } from "../utils/errors";
import { directoryExists, listDirectories, remove } from "../utils/fs";
import { claudePluginUninstall, isClaudeCLIAvailable } from "../utils/exec";
import { listPluginNames, getProjectPluginsDir } from "../lib/plugins";
import { readForkedFromMetadata } from "../lib/skills";
import { loadProjectSourceConfig } from "../lib/configuration/config";
import type { ProjectSourceConfig } from "../lib/configuration/config";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, CLI_COLORS, DEFAULT_BRANDING } from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";
import { SUCCESS_MESSAGES, INFO_MESSAGES, DRY_RUN_MESSAGES } from "../utils/messages";

type UninstallTarget = {
  hasPlugins: boolean;
  pluginNames: string[];
  hasLocalSkills: boolean;
  hasLocalAgents: boolean;
  hasClaudeDir: boolean;
  hasClaudeSrcDir: boolean;
  pluginsDir: string;
  skillsDir: string;
  agentsDir: string;
  claudeDir: string;
  claudeSrcDir: string;
  /** Resolved project source config from .claude-src/config.yaml */
  config: ProjectSourceConfig | null;
  /** All configured source URLs (primary + extras) */
  configuredSources: string[];
};

function collectConfiguredSources(config: ProjectSourceConfig | null): string[] {
  if (!config) return [];

  const sources: string[] = [];

  if (config.source) {
    sources.push(config.source);
  }

  if (config.sources) {
    for (const entry of config.sources) {
      sources.push(entry.url);
    }
  }

  return sources;
}

async function detectUninstallTarget(projectDir: string): Promise<UninstallTarget> {
  const pluginsDir = getProjectPluginsDir(projectDir);
  const skillsDir = path.join(projectDir, CLAUDE_DIR, "skills");
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  const claudeDir = path.join(projectDir, CLAUDE_DIR);
  const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);

  const [hasLocalSkills, hasLocalAgents, hasClaudeDir, hasClaudeSrcDir, config] = await Promise.all(
    [
      directoryExists(skillsDir),
      directoryExists(agentsDir),
      directoryExists(claudeDir),
      directoryExists(claudeSrcDir),
      loadProjectSourceConfig(projectDir),
    ],
  );

  let pluginNames: string[] = [];
  try {
    pluginNames = await listPluginNames(projectDir);
  } catch {
    // Best-effort: plugin detection may fail
  }

  const configuredSources = collectConfiguredSources(config);

  return {
    hasPlugins: pluginNames.length > 0,
    pluginNames,
    hasLocalSkills,
    hasLocalAgents,
    hasClaudeDir,
    hasClaudeSrcDir,
    pluginsDir,
    skillsDir,
    agentsDir,
    claudeDir,
    claudeSrcDir,
    config,
    configuredSources,
  };
}

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
          <Text dimColor> {target.pluginsDir}</Text>
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

async function isDirectoryEmpty(dirPath: string): Promise<boolean> {
  const { readdir } = await import("fs/promises");
  try {
    const allEntries = await readdir(dirPath);
    return allEntries.length === 0;
  } catch {
    return true;
  }
}

function skillMatchesConfiguredSource(
  forkedFromSource: string | undefined,
  configuredSources: string[],
): boolean {
  if (!forkedFromSource || configuredSources.length === 0) return false;
  return configuredSources.includes(forkedFromSource);
}

export default class Uninstall extends BaseCommand {
  static summary = `Remove ${DEFAULT_BRANDING.NAME} from this project`;

  static description = `Uninstall ${DEFAULT_BRANDING.NAME} from this project. Removes CLI-managed skills (matched by source), compiled agents, and plugins. User-created content is preserved.`;

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --yes",
    "<%= config.bin %> <%= command.id %> --all",
    "<%= config.bin %> <%= command.id %> --dry-run",
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

    if (flags["dry-run"]) {
      this.log(DRY_RUN_MESSAGES.PREVIEW_NO_FILES_REMOVED);
      this.log("");
    }

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

    if (!flags.yes && !flags["dry-run"]) {
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
        this.log(`    ${target.pluginsDir}`);
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

    if (flags["dry-run"]) {
      if (target.hasPlugins) {
        this.log(`[dry-run] Would uninstall ${target.pluginNames.length} plugins:`);
        for (const pluginName of target.pluginNames) {
          this.log(`[dry-run]   ${pluginName}`);
        }
      }

      await this.dryRunLocalRemoval(target, flags.all);

      this.log("");
      this.log(DRY_RUN_MESSAGES.COMPLETE_NO_FILES_REMOVED);
      this.log("");
      return;
    }

    if (target.hasPlugins) {
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

  /**
   * Selectively removes local files installed by the CLI using config-based matching.
   *
   * - Skills: removes skill dirs whose forked_from.source matches a configured source
   * - Agents: removes agents whose frontmatter name matches a configured agent, or
   *           all agents if config.yaml exists (CLI was used to compile them)
   * - Plugins: removed separately (always)
   * - .claude-src/: only removed with --all flag
   * - .claude/: only removed if empty after selective cleanup
   */
  private async removeLocalFiles(target: UninstallTarget, removeAll: boolean): Promise<void> {
    let removedSkillCount = 0;
    let skippedSkillCount = 0;

    if (target.hasLocalSkills) {
      const skillDirNames = await listDirectories(target.skillsDir);

      for (const skillDirName of skillDirNames) {
        const skillDir = path.join(target.skillsDir, skillDirName);
        const forkedFrom = await readForkedFromMetadata(skillDir);

        const shouldRemove =
          forkedFrom !== null &&
          (skillMatchesConfiguredSource(forkedFrom.source, target.configuredSources) ||
            // Legacy skills without source field are treated as CLI-managed when config exists
            (!forkedFrom.source && target.config !== null));

        if (shouldRemove) {
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

      if (skippedSkillCount === 0 && (await directoryExists(target.skillsDir))) {
        if (await isDirectoryEmpty(target.skillsDir)) {
          await remove(target.skillsDir);
        }
      }
    }

    if (target.hasLocalAgents) {
      // config.yaml presence indicates the CLI compiled these agents
      if (target.config !== null) {
        await remove(target.agentsDir);
        this.logSuccess("Removed compiled agents");
      }
    }

    if (removeAll && target.hasClaudeSrcDir) {
      await remove(target.claudeSrcDir);
      this.logSuccess(`Removed ${CLAUDE_SRC_DIR}/`);
    }

    if (target.hasClaudeDir && (await directoryExists(target.claudeDir))) {
      if (await isDirectoryEmpty(target.claudeDir)) {
        await remove(target.claudeDir);
        this.logSuccess(`Removed ${CLAUDE_DIR}/`);
      } else {
        this.log(`Kept ${CLAUDE_DIR}/ (contains user content)`);
      }
    }
  }

  private async dryRunLocalRemoval(target: UninstallTarget, removeAll: boolean): Promise<void> {
    if (target.hasLocalSkills) {
      const skillDirNames = await listDirectories(target.skillsDir);

      for (const skillDirName of skillDirNames) {
        const skillDir = path.join(target.skillsDir, skillDirName);
        const forkedFrom = await readForkedFromMetadata(skillDir);

        const shouldRemove =
          forkedFrom !== null &&
          (skillMatchesConfiguredSource(forkedFrom.source, target.configuredSources) ||
            (!forkedFrom.source && target.config !== null));

        if (shouldRemove) {
          this.log(`[dry-run] Would remove skill '${skillDirName}'`);
        } else {
          this.log(
            `[dry-run] Would skip '${skillDirName}': not created by ${DEFAULT_BRANDING.NAME} CLI`,
          );
        }
      }
    }

    if (target.hasLocalAgents && target.config !== null) {
      this.log(`[dry-run] Would remove ${target.agentsDir}/`);
    }

    if (removeAll && target.hasClaudeSrcDir) {
      this.log(`[dry-run] Would remove ${target.claudeSrcDir}/`);
    }

    if (target.hasClaudeDir) {
      this.log(`[dry-run] Would remove ${target.claudeDir}/ only if empty after cleanup`);
    }
  }
}
