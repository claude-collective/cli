import React, { useState } from "react";

import { Flags } from "@oclif/core";
import { render, Box, Text, useApp, useInput } from "ink";
import os from "os";
import path from "path";

import { BaseCommand } from "../base-command.js";
import { Wizard, type WizardResultV2 } from "../components/wizard/wizard.js";
import {
  loadSkillsMatrixFromSource,
  getMarketplaceLabel,
  type SourceLoadResult,
} from "../lib/loading/index.js";
import {
  installLocal,
  installPluginConfig,
  detectProjectInstallation,
} from "../lib/installation/index.js";
import { checkPermissions } from "../lib/permission-checker.js";
import { getInstallationInfo } from "../lib/plugins/plugin-info.js";
import { hasIndividualPlugins } from "../lib/plugins/index.js";
import {
  claudePluginInstall,
  claudePluginMarketplaceExists,
  claudePluginMarketplaceAdd,
} from "../utils/exec.js";
import {
  ASCII_LOGO,
  CLAUDE_DIR,
  CLI_BIN_NAME,
  CLI_COLORS,
  DEFAULT_BRANDING,
  LOCAL_SKILLS_PATH,
} from "../consts.js";
import { getErrorMessage } from "../utils/errors.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { loadProjectConfig } from "../lib/configuration/project-config.js";
import {
  enableBuffering,
  drainBuffer,
  disableBuffering,
  pushBufferMessage,
  type StartupMessage,
} from "../utils/logger.js";
import {
  SUCCESS_MESSAGES,
  STATUS_MESSAGES,
  DRY_RUN_MESSAGES,
} from "../utils/messages.js";

type DashboardOption = {
  label: string;
  command: string;
};

const DASHBOARD_OPTIONS: DashboardOption[] = [
  { label: "Edit", command: "edit" },
  { label: "Compile", command: "compile" },
  { label: "Doctor", command: "doctor" },
  { label: "List", command: "list" },
];

type DashboardProps = {
  skillCount: number;
  agentCount: number;
  source?: string;
  mode: string;
  onSelect: (command: string) => void;
  onCancel: () => void;
};

const Dashboard: React.FC<DashboardProps> = ({
  skillCount,
  agentCount,
  source,
  mode,
  onSelect,
  onCancel,
}) => {
  const { exit } = useApp();
  const [focusIndex, setFocusIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      exit();
      return;
    }
    if (key.return) {
      onSelect(DASHBOARD_OPTIONS[focusIndex].command);
      exit();
      return;
    }
    if (key.leftArrow) {
      setFocusIndex((i) => (i > 0 ? i - 1 : DASHBOARD_OPTIONS.length - 1));
    }
    if (key.rightArrow) {
      setFocusIndex((i) => (i < DASHBOARD_OPTIONS.length - 1 ? i + 1 : 0));
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>{DEFAULT_BRANDING.NAME}</Text>
      <Text> </Text>
      <Text>  Skills:  {skillCount} installed</Text>
      <Text>  Agents:  {agentCount} compiled</Text>
      <Text>  Mode:    {mode === "plugin" ? "Plugin" : "Local"}</Text>
      {source && <Text>  Source:  {source}</Text>}
      <Text> </Text>
      <Box>
        <Text>  </Text>
        {DASHBOARD_OPTIONS.map((option, index) => (
          <Box key={option.command} marginRight={1}>
            <Text
              color={index === focusIndex ? CLI_COLORS.FOCUS : undefined}
              bold={index === focusIndex}
            >
              [{option.label}]
            </Text>
          </Box>
        ))}
      </Box>
      <Text dimColor>  Use arrow keys to select, Enter to confirm, Esc to exit</Text>
    </Box>
  );
};

export type DashboardData = {
  skillCount: number;
  agentCount: number;
  mode: string;
  source?: string;
};

/** Gathers dashboard data from the installation and project config. */
export async function getDashboardData(projectDir: string): Promise<DashboardData> {
  const [info, loaded] = await Promise.all([
    getInstallationInfo(),
    loadProjectConfig(projectDir),
  ]);

  // Skill count from config (canonical source of truth for installed skills)
  const skillCount = loaded?.config?.skills?.length ?? 0;
  // Agent count from filesystem (compiled .md files in agents dir)
  const agentCount = info?.agentCount ?? 0;
  const mode = info?.mode ?? loaded?.config?.installMode ?? "local";
  const source = loaded?.config?.source;

  return { skillCount, agentCount, mode, source };
}

/** Formats the dashboard summary as plain text lines (for non-interactive/test output). */
export function formatDashboardText(data: DashboardData): string {
  const modeLabel = data.mode === "plugin" ? "Plugin" : "Local";
  const lines = [
    DEFAULT_BRANDING.NAME,
    "",
    `  Skills:  ${data.skillCount} installed`,
    `  Agents:  ${data.agentCount} compiled`,
    `  Mode:    ${modeLabel}`,
  ];
  if (data.source) {
    lines.push(`  Source:  ${data.source}`);
  }
  lines.push("");
  lines.push(`  [Edit]  [Compile]  [Doctor]  [List]`);
  return lines.join("\n");
}

/**
 * Shows the project dashboard and returns the selected command (or null if cancelled).
 * In non-interactive environments (no TTY), prints the summary text and returns null.
 */
export async function showDashboard(
  projectDir: string,
  log?: (message: string) => void,
): Promise<string | null> {
  const data = await getDashboardData(projectDir);

  // Non-interactive: print text summary and exit (CI, piped, tests)
  if (!process.stdin.isTTY) {
    const output = log ?? console.log;
    output(formatDashboardText(data));
    return null;
  }

  let selectedCommand: string | null = null;

  const { waitUntilExit } = render(
    <Dashboard
      skillCount={data.skillCount}
      agentCount={data.agentCount}
      source={data.source}
      mode={data.mode}
      onSelect={(command) => {
        selectedCommand = command;
      }}
      onCancel={() => {
        selectedCommand = null;
      }}
    />,
  );

  await waitUntilExit();

  return selectedCommand;
}

export default class Init extends BaseCommand {
  static summary = `Initialize ${DEFAULT_BRANDING.NAME} in this project`;
  static description =
    "Interactive wizard to set up skills and agents. Supports Plugin Mode (native install) and Local Mode (copy to .claude/).";

  static examples = [
    {
      description: "Start the setup wizard",
      command: "<%= config.bin %> <%= command.id %>",
    },
    {
      description: "Install globally to home directory",
      command: "<%= config.bin %> <%= command.id %> --global",
    },
    {
      description: "Initialize from a custom marketplace",
      command: "<%= config.bin %> <%= command.id %> --source github:org/marketplace",
    },
    {
      description: "Preview without creating files",
      command: "<%= config.bin %> <%= command.id %> --dry-run",
    },
    {
      description: "Force refresh skills from remote",
      command: "<%= config.bin %> <%= command.id %> --refresh",
    },
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    global: Flags.boolean({
      char: "g",
      description: "Install globally to home directory (~/.claude-src/)",
      default: false,
    }),
    refresh: Flags.boolean({
      description: "Force refresh from remote source",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const projectDir = flags.global ? os.homedir() : process.cwd();

    // For "already initialized" check, only look at the target directory (no global fallback)
    const individualPluginsExist = await hasIndividualPlugins(projectDir);
    const existingInstallation = await detectProjectInstallation(projectDir);

    if (individualPluginsExist || existingInstallation) {
      const selectedCommand = await showDashboard(projectDir, (msg) => this.log(msg));
      if (selectedCommand) {
        await this.config.runCommand(selectedCommand);
      }
      return;
    }

    if (flags.global) {
      this.log("Installing globally to home directory...");
    }

    enableBuffering();

    if (flags["dry-run"]) {
      pushBufferMessage("info", DRY_RUN_MESSAGES.PREVIEW_NO_FILES_CREATED);
    }

    let sourceResult: SourceLoadResult;
    let startupMessages: StartupMessage[] = [];
    try {
      sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
        projectDir,
        forceRefresh: flags.refresh,
      });
    } catch (error) {
      disableBuffering();
      this.error(getErrorMessage(error), {
        exit: EXIT_CODES.ERROR,
      });
    }

    startupMessages = drainBuffer();
    disableBuffering();

    let wizardResult: WizardResultV2 | null = null;

    const marketplaceLabel = getMarketplaceLabel(sourceResult);
    const { waitUntilExit } = render(
      <Wizard
        matrix={sourceResult.matrix}
        version={this.config.version}
        marketplaceLabel={marketplaceLabel}
        logo={ASCII_LOGO}
        projectDir={projectDir}
        initialInstallMode={sourceResult.marketplace ? "plugin" : "local"}
        startupMessages={startupMessages}
        onComplete={(result) => {
          // Boundary cast: Ink render callback returns unknown result type
          wizardResult = result as WizardResultV2;
        }}
        onCancel={() => {
          this.log("Setup cancelled");
        }}
      />,
    );

    await waitUntilExit();

    // Boundary cast: re-narrow after Ink waitUntilExit()
    const result = wizardResult as WizardResultV2 | null;
    if (!result || result.cancelled) {
      this.exit(EXIT_CODES.CANCELLED);
    }

    if (result.selectedSkills.length === 0) {
      this.error("No skills selected", { exit: EXIT_CODES.ERROR });
    }

    await this.handleInstallation(result, sourceResult, flags);
  }

  private async handleInstallation(
    result: WizardResultV2,
    sourceResult: SourceLoadResult,
    flags: { "dry-run": boolean; source?: string; refresh: boolean; global: boolean },
  ): Promise<void> {
    const projectDir = flags.global ? os.homedir() : process.cwd();
    const pluginScope = flags.global ? "user" : "project";
    const dryRun = flags["dry-run"];

    this.log("\n");
    this.log(`Selected ${result.selectedSkills.length} skills`);
    this.log(
      `Install mode: ${result.installMode === "plugin" ? "Plugin (native install)" : "Local (copy to .claude/skills/)"}`,
    );

    if (dryRun) {
      if (result.installMode === "plugin" && result.selectedStackId) {
        const useMarketplace = !!sourceResult.marketplace;
        if (useMarketplace) {
          this.log(
            `[dry-run] Would install stack "${result.selectedStackId}" from marketplace "${sourceResult.marketplace}"`,
          );
          this.log(
            `[dry-run]   claude plugin install ${result.selectedStackId}@${sourceResult.marketplace} --scope ${pluginScope}`,
          );
        } else {
          this.log(
            `[dry-run] Would compile and install stack "${result.selectedStackId}" as a native plugin`,
          );
          this.log(
            `[dry-run]   claude plugin install ./compiled-stack/${result.selectedStackId} --scope ${pluginScope}`,
          );
          this.log(
            `[dry-run] Stack includes ${result.selectedSkills.length} skills and agents bundled together`,
          );
        }
      } else if (result.installMode === "plugin" && sourceResult.marketplace) {
        this.log(
          `[dry-run] Would install ${result.selectedSkills.length} skills as individual plugins from "${sourceResult.marketplace}"`,
        );
        for (const skillId of result.selectedSkills) {
          this.log(
            `[dry-run]   claude plugin install ${skillId}@${sourceResult.marketplace} --scope ${pluginScope}`,
          );
        }
        const localAgentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
        this.log(`[dry-run] Would compile agents to ${localAgentsDir}`);
        this.log(`[dry-run] Would save config to .claude-src/config.yaml`);
      } else {
        if (result.installMode === "plugin") {
          this.log(
            `[dry-run] Plugin Mode requires a marketplace for individual skills — would fall back to Local Mode`,
          );
        }
        const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
        const localAgentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
        this.log(
          `[dry-run] Would copy ${result.selectedSkills.length} skills to ${localSkillsDir}`,
        );
        this.log(`[dry-run] Would compile agents to ${localAgentsDir}`);
        this.log(`[dry-run] Would save config to .claude-src/config.yaml`);
      }
      this.log(`\n${DRY_RUN_MESSAGES.COMPLETE_NO_FILES_CREATED}`);
      return;
    }

    if (result.installMode === "plugin") {
      if (sourceResult.marketplace) {
        await this.installIndividualPlugins(result, sourceResult, flags, projectDir, pluginScope);
      } else {
        this.warn("Plugin Mode requires a marketplace for individual skill installation.");
        this.log(`Falling back to Local Mode (copying to .claude/skills/)...`);
        this.log("To use Plugin Mode, either select a stack or configure a marketplace source.\n");
        await this.installLocalMode(result, sourceResult, flags, projectDir);
      }
      return;
    }

    await this.installLocalMode(result, sourceResult, flags, projectDir);
  }

  private async installIndividualPlugins(
    result: WizardResultV2,
    sourceResult: SourceLoadResult,
    flags: { source?: string },
    projectDir: string,
    pluginScope: "project" | "user",
  ): Promise<void> {

    if (sourceResult.marketplace) {
      const marketplaceExists = await claudePluginMarketplaceExists(sourceResult.marketplace);

      if (!marketplaceExists) {
        this.log(`Registering marketplace "${sourceResult.marketplace}"...`);
        try {
          const marketplaceSource = sourceResult.sourceConfig.source.replace(/^github:/, "");
          await claudePluginMarketplaceAdd(marketplaceSource);
          this.log(`Registered marketplace: ${sourceResult.marketplace}`);
        } catch (error) {
          this.error(getErrorMessage(error), {
            exit: EXIT_CODES.ERROR,
          });
        }
      }
    }

    this.log("Installing skill plugins...");
    for (const skillId of result.selectedSkills) {
      const pluginRef = `${skillId}@${sourceResult.marketplace}`;
      try {
        await claudePluginInstall(pluginRef, pluginScope, projectDir);
        this.log(`  Installed ${pluginRef}`);
      } catch (error) {
        this.error(`Failed to install plugin ${pluginRef}: ${getErrorMessage(error)}`, {
          exit: EXIT_CODES.ERROR,
        });
      }
    }

    this.log(`Installed ${result.selectedSkills.length} skill plugins\n`);

    this.log("Generating configuration...");
    try {
      const configResult = await installPluginConfig({
        wizardResult: result,
        sourceResult,
        projectDir,
        sourceFlag: flags.source,
      });

      if (configResult.wasMerged) {
        this.log(`Merged with existing config at ${configResult.mergedConfigPath}`);
      }

      this.log(`Configuration saved (${configResult.config.agents.length} agents)\n`);
      this.log(STATUS_MESSAGES.COMPILING_AGENTS);
      this.log(`Compiled ${configResult.compiledAgents.length} agents to .claude/agents/\n`);

      this.log(`${SUCCESS_MESSAGES.INIT_SUCCESS}\n`);
      this.log("Agents compiled to:");
      this.log(`  ${configResult.agentsDir}`);
      for (const agentName of configResult.compiledAgents) {
        this.log(`    ${agentName}.md`);
      }
      this.log("");
      this.log("Configuration:");
      this.log(`  ${configResult.configPath}`);
      this.log("");
      this.log("To customize agent-skill assignments:");
      this.log(`  1. Edit .claude-src/config.yaml`);
      this.log(`  2. Run '${CLI_BIN_NAME} compile' to regenerate agents`);
      this.log("");

      const permissionWarning = await checkPermissions(projectDir);
      if (permissionWarning) {
        const { waitUntilExit } = render(permissionWarning);
        await waitUntilExit();
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private async installLocalMode(
    result: WizardResultV2,
    sourceResult: SourceLoadResult,
    flags: { source?: string },
    projectDir: string,
  ): Promise<void> {
    const matrix = sourceResult.matrix;

    this.log("Copying skills to local directory...");
    try {
      const installResult = await installLocal({
        wizardResult: result,
        sourceResult,
        projectDir,
        sourceFlag: flags.source,
      });

      this.log(`Copied ${installResult.copiedSkills.length} skills to .claude/skills/\n`);
      this.log("Generating configuration...");

      if (installResult.wasMerged) {
        this.log(`Merged with existing config at ${installResult.mergedConfigPath}`);
      }

      this.log(`Configuration saved (${installResult.config.agents.length} agents)\n`);
      this.log(STATUS_MESSAGES.COMPILING_AGENTS);
      this.log(`Compiled ${installResult.compiledAgents.length} agents to .claude/agents/\n`);

      this.log(`${SUCCESS_MESSAGES.INIT_SUCCESS}\n`);
      this.log("Skills copied to:");
      this.log(`  ${installResult.skillsDir}`);
      for (const copiedSkill of installResult.copiedSkills) {
        const skill = matrix.skills[copiedSkill.skillId];
        const displayName = skill?.displayName || copiedSkill.skillId;
        this.log(`    ${displayName}/`);
      }
      this.log("");
      this.log("Agents compiled to:");
      this.log(`  ${installResult.agentsDir}`);
      for (const agentName of installResult.compiledAgents) {
        this.log(`    ${agentName}.md`);
      }
      this.log("");
      this.log("Configuration:");
      this.log(`  ${installResult.configPath}`);
      this.log("");
      this.log("To customize agent-skill assignments:");
      this.log(`  1. Edit .claude-src/config.yaml`);
      this.log(`  2. Run '${CLI_BIN_NAME} compile' to regenerate agents`);
      this.log("");

      const permissionWarning = await checkPermissions(projectDir);
      if (permissionWarning) {
        const { waitUntilExit } = render(permissionWarning);
        await waitUntilExit();
      }
    } catch (error) {
      this.handleError(error);
    }
  }
}
