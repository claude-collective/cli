import React from "react";

import { Flags } from "@oclif/core";
import { render, Box, Text, useApp } from "ink";
import path from "path";
import os from "os";

import { BaseCommand } from "../base-command";
import { Confirm } from "../components/common/confirm";
import { getErrorMessage } from "../utils/errors";
import { directoryExists, listDirectories, remove } from "../utils/fs";
import { claudePluginUninstall, isClaudeCLIAvailable } from "../utils/exec";
import { listPluginNames, getProjectPluginsDir } from "../lib/plugins";
import { readForkedFromMetadata } from "../lib/skills";
import { loadProjectSourceConfig } from "../lib/configuration/config";
import type { ProjectConfig } from "../types";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, CLI_COLORS, DEFAULT_BRANDING } from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";
import { SUCCESS_MESSAGES, INFO_MESSAGES } from "../utils/messages";

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
  /** Resolved project source config from .claude-src/config.ts */
  config: Partial<ProjectConfig> | null;
  /** All configured source URLs (primary + extras) */
  configuredSources: string[];
  /** Agent names from the generated config (e.g., ["web-developer"]) */
  configuredAgents: string[];
};

function collectConfiguredSources(config: Partial<ProjectConfig> | null): string[] {
  if (!config) return [];
  return [
    ...(config.source ? [config.source] : []),
    ...(config.sources?.map((entry) => entry.url) ?? []),
  ];
}

function collectConfiguredAgents(config: Partial<ProjectConfig> | null): string[] {
  if (!config?.agents) return [];
  return config.agents.map((a) => a.name);
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
  const configuredAgents = collectConfiguredAgents(config);

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
    configuredAgents,
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

function shouldRemoveSkill(
  forkedFrom: { source?: string } | null,
  configuredSources: string[],
  hasConfig: boolean,
): boolean {
  return (
    forkedFrom !== null &&
    (skillMatchesConfiguredSource(forkedFrom.source, configuredSources) ||
      (!forkedFrom.source && hasConfig))
  );
}

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

    if (target.hasPlugins) {
      this.log("Uninstalling plugins...");

      try {
        const cliAvailable = await isClaudeCLIAvailable();

        for (const pluginName of target.pluginNames) {
          if (cliAvailable) {
            try {
              const pluginScope = projectDir === os.homedir() ? "user" : "project";
              await claudePluginUninstall(pluginName, pluginScope, projectDir);
            } catch {
              // Best-effort: plugin may not be registered with Claude CLI
            }
          }

          const pluginPath = path.join(target.pluginsDir, pluginName);
          await remove(pluginPath);
          this.log(`  Uninstalled plugin '${pluginName}'`);
        }

        this.logSuccess(
          `Uninstalled ${target.pluginNames.length} ${target.pluginNames.length === 1 ? "plugin" : "plugins"}`,
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
    await this.removeMatchingSkills(target);
    await this.removeMatchingAgents(target);

    if (removeAll && target.hasClaudeSrcDir) {
      await remove(target.claudeSrcDir);
      this.logSuccess(`Removed ${CLAUDE_SRC_DIR}/`);
    }

    await this.removeEmptyClaudeDir(target);
  }

  private async removeMatchingSkills(target: UninstallTarget): Promise<void> {
    if (!target.hasLocalSkills) return;

    const skillDirNames = await listDirectories(target.skillsDir);
    let removedCount = 0;
    let skippedCount = 0;

    for (const skillDirName of skillDirNames) {
      const skillDir = path.join(target.skillsDir, skillDirName);
      const forkedFrom = await readForkedFromMetadata(skillDir);

      if (shouldRemoveSkill(forkedFrom, target.configuredSources, target.config !== null)) {
        await remove(skillDir);
        removedCount++;
        this.log(`  Uninstalled skill '${skillDirName}'`);
      } else {
        this.warn(`Skipping '${skillDirName}': not created by ${DEFAULT_BRANDING.NAME} CLI`);
        skippedCount++;
      }
    }

    if (removedCount > 0) {
      this.logSuccess(
        `Removed ${removedCount} CLI-installed ${removedCount === 1 ? "skill" : "skills"}`,
      );
    }

    if (skippedCount > 0) return;
    if (!(await directoryExists(target.skillsDir))) return;
    if (await isDirectoryEmpty(target.skillsDir)) {
      await remove(target.skillsDir);
    }
  }

  private async removeMatchingAgents(target: UninstallTarget): Promise<void> {
    if (!target.hasLocalAgents) return;
    if (target.configuredAgents.length === 0) return;

    const agentFiles = await this.listAgentFiles(target.agentsDir);
    let removedCount = 0;

    for (const agentFile of agentFiles) {
      const agentName = agentFile.replace(/\.md$/, "");
      if (!target.configuredAgents.includes(agentName)) continue;

      await remove(path.join(target.agentsDir, agentFile));
      this.log(`  Uninstalled agent '${agentName}'`);
      removedCount++;
    }

    if (removedCount > 0) {
      this.logSuccess(
        `Removed ${removedCount} compiled ${removedCount === 1 ? "agent" : "agents"}`,
      );
    }

    if (!(await directoryExists(target.agentsDir))) return;
    if (await isDirectoryEmpty(target.agentsDir)) {
      await remove(target.agentsDir);
    }
  }

  private async listAgentFiles(agentsDir: string): Promise<string[]> {
    try {
      const { readdir } = await import("fs/promises");
      return (await readdir(agentsDir)).filter((f) => f.endsWith(".md"));
    } catch {
      return [];
    }
  }

  private async removeEmptyClaudeDir(target: UninstallTarget): Promise<void> {
    if (!target.hasClaudeDir) return;
    if (!(await directoryExists(target.claudeDir))) return;

    if (await isDirectoryEmpty(target.claudeDir)) {
      await remove(target.claudeDir);
      this.logSuccess(`Removed ${CLAUDE_DIR}/`);
    } else {
      this.log(`Kept ${CLAUDE_DIR}/ (contains user content)`);
    }
  }
}
