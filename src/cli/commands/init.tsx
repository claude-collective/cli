import React from "react";

import { Flags } from "@oclif/core";
import { render, Box, Text, useApp } from "ink";
import fs from "fs";

import { BaseCommand } from "../base-command.js";
import { Wizard, type WizardResultV2 } from "../components/wizard/wizard.js";
import { type SourceLoadResult } from "../lib/loading/index.js";
import {
  loadSource,
  loadAgentDefs,
  copyLocalSkills,
  ensureMarketplace,
  installPluginSkills,
  writeProjectConfig,
  compileAgents,
  getDashboardData,
  type DashboardData,
} from "../lib/operations/index.js";
import {
  detectProjectInstallation,
  deriveInstallMode,
  resolveInstallPaths,
  buildAgentScopeMap,
} from "../lib/installation/index.js";
import { checkPermissions } from "../lib/permission-checker.js";
import {
  ASCII_LOGO,
  CLAUDE_SRC_DIR,
  CLI_BIN_NAME,
  DEFAULT_BRANDING,
  GLOBAL_INSTALL_ROOT,
} from "../consts.js";
import { SelectList, type SelectListItem } from "../components/common/select-list.js";
import {
  KEY_LABEL_ARROWS_VERT,
  KEY_LABEL_ENTER,
  KEY_LABEL_ESC,
} from "../components/wizard/hotkeys.js";
import { getErrorMessage } from "../utils/errors.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { getSkillById } from "../lib/matrix/matrix-provider";
import { type StartupMessage } from "../utils/logger.js";
import { SUCCESS_MESSAGES, STATUS_MESSAGES } from "../utils/messages.js";
import { ensureBlankGlobalConfig } from "../lib/configuration/config-writer.js";

/** Clears the visible terminal area so the next render starts clean. */
function clearTerminalOutput(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

const DASHBOARD_OPTIONS: SelectListItem<string>[] = [
  { label: "Edit", value: "edit" },
  { label: "Compile", value: "compile" },
  { label: "Doctor", value: "doctor" },
  { label: "List", value: "list" },
];

type DashboardProps = {
  onSelect: (command: string) => void;
  onCancel: () => void;
};

const Dashboard: React.FC<DashboardProps> = ({ onSelect, onCancel }) => {
  const { exit } = useApp();

  return (
    <Box flexDirection="column">
      <Text bold>{DEFAULT_BRANDING.NAME}</Text>
      <Text> </Text>
      <SelectList
        items={DASHBOARD_OPTIONS}
        onSelect={(command) => {
          onSelect(command);
          exit();
        }}
        onCancel={() => {
          onCancel();
          exit();
        }}
      />
      <Text> </Text>
      <Text dimColor>
        {" "}
        {KEY_LABEL_ARROWS_VERT} Navigate {"  "}
        {KEY_LABEL_ENTER} Confirm {"  "}
        {KEY_LABEL_ESC} Exit
      </Text>
    </Box>
  );
};

// Re-export from operations so existing consumers can keep importing from init.
export { getDashboardData, type DashboardData } from "../lib/operations/index.js";

/** Formats the dashboard summary as plain text lines (for non-interactive/test output). */
export function formatDashboardText(data: DashboardData): string {
  const modeLabel = data.mode === "plugin" ? "Plugin" : data.mode === "mixed" ? "Mixed" : "Local";
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
      onSelect={(command) => {
        selectedCommand = command;
      }}
      onCancel={() => {
        selectedCommand = null;
      }}
    />,
  );

  await waitUntilExit();
  clearTerminalOutput();

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
      description: "Initialize from a custom marketplace",
      command: "<%= config.bin %> <%= command.id %> --source github:org/marketplace",
    },
    {
      description: "Force refresh skills from remote",
      command: "<%= config.bin %> <%= command.id %> --refresh",
    },
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    refresh: Flags.boolean({
      description: "Force refresh from remote source",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const projectDir = process.cwd();

    // For "already initialized" check, only look at the target directory (no global fallback)
    const existingInstallation = await detectProjectInstallation(projectDir);

    if (existingInstallation) {
      const selectedCommand = await showDashboard(projectDir, (msg) => this.log(msg));
      if (selectedCommand) {
        await this.config.runCommand(selectedCommand);
      }
      return;
    }

    // Auto-create blank global config on first init from a project directory.
    // This ensures the project config can always import from global.
    // Resolve both paths through realpathSync — on macOS /var is a symlink to
    // /private/var, so os.homedir() and process.cwd() can return different
    // prefixes for the same directory.
    const isGlobalRoot = fs.realpathSync(projectDir) === fs.realpathSync(GLOBAL_INSTALL_ROOT);
    if (!isGlobalRoot) {
      const created = await ensureBlankGlobalConfig();
      if (created) {
        this.log("Created blank global config at ~/" + CLAUDE_SRC_DIR);
      }
    }

    let sourceResult: SourceLoadResult;
    let startupMessages: StartupMessage[] = [];
    try {
      const loaded = await loadSource({
        sourceFlag: flags.source,
        projectDir,
        forceRefresh: flags.refresh,
        captureStartupMessages: true,
      });
      sourceResult = loaded.sourceResult;
      startupMessages = loaded.startupMessages;
    } catch (error) {
      this.error(getErrorMessage(error), {
        exit: EXIT_CODES.ERROR,
      });
    }

    let wizardResult: WizardResultV2 | null = null;

    const { waitUntilExit } = render(
      <Wizard
        version={this.config.version}
        logo={ASCII_LOGO}
        projectDir={projectDir}
        startupMessages={startupMessages}
        onComplete={(result) => {
          wizardResult = result;
        }}
        onCancel={() => {
          this.log("Setup cancelled");
        }}
      />,
    );

    await waitUntilExit();

    // TypeScript can't track that onComplete callback mutates wizardResult before waitUntilExit resolves
    const result = wizardResult as WizardResultV2 | null;

    if (!result || result.cancelled) {
      this.exit(EXIT_CODES.CANCELLED);
    }

    if (result.skills.length === 0) {
      this.error("No skills selected", { exit: EXIT_CODES.ERROR });
    }

    await this.handleInstallation(result, sourceResult, flags);
  }

  private async handleInstallation(
    result: WizardResultV2,
    sourceResult: SourceLoadResult,
    flags: { source?: string; refresh: boolean },
  ): Promise<void> {
    const projectDir = process.cwd();
    let installMode = deriveInstallMode(result.skills);

    const localSkills = result.skills.filter((s) => s.source === "local");
    const pluginSkills = result.skills.filter((s) => s.source !== "local");

    this.log("\n");
    this.log(`Selected ${result.skills.length} skills`);
    this.log(
      `Install mode: ${
        installMode === "plugin"
          ? "Plugin (native install)"
          : installMode === "mixed"
            ? `Mixed (${localSkills.length} local, ${pluginSkills.length} plugin)`
            : "Local (copy to .claude/skills/)"
      }`,
    );

    // Step 1: Copy local skills (for local or mixed modes)
    let copiedSkills: typeof localSkills = [];
    if (installMode === "local" || installMode === "mixed") {
      this.log("Copying skills to local directory...");
      const copyResult = await copyLocalSkills(localSkills, projectDir, sourceResult);
      copiedSkills = localSkills;

      if (installMode === "mixed") {
        if (copyResult.projectCopied.length > 0 && copyResult.globalCopied.length > 0) {
          this.log(
            `Copied ${copyResult.totalCopied} local skills (${copyResult.projectCopied.length} project, ${copyResult.globalCopied.length} global)`,
          );
        } else if (copyResult.globalCopied.length > 0) {
          this.log(`Copied ${copyResult.globalCopied.length} local skills to ~/.claude/skills/`);
        } else {
          this.log(`Copied ${copyResult.projectCopied.length} local skills to .claude/skills/`);
        }
      } else {
        this.log(`Copied ${copyResult.totalCopied} skills to .claude/skills/\n`);
      }
    }

    // Step 2: Marketplace + plugin installation (for plugin or mixed modes)
    let pluginModeSucceeded = false;
    if (installMode === "plugin" || installMode === "mixed") {
      const mpResult = await ensureMarketplace(sourceResult);

      if (!mpResult.marketplace) {
        this.warn("Could not resolve marketplace. Falling back to Local Mode...");
        // Marketplace unavailable — copy all plugin-intended skills locally as fallback.
        // In "mixed" mode, localSkills were already copied in Step 1; only copy plugin-intended skills.
        // In "plugin" mode, no skills were copied yet; copy all skills.
        const fallbackSkills = installMode === "mixed" ? pluginSkills : result.skills;
        const fallbackCopyResult = await copyLocalSkills(fallbackSkills, projectDir, sourceResult);
        copiedSkills = [...copiedSkills, ...fallbackSkills];
        installMode = "local";
        this.log(`Copied ${fallbackCopyResult.totalCopied} skills to .claude/skills/\n`);
      } else {
        if (mpResult.registered) {
          this.log(`Registering marketplace "${mpResult.marketplace}"...`);
        }

        this.log("Installing skill plugins...");
        const pluginResult = await installPluginSkills(
          pluginSkills,
          mpResult.marketplace,
          projectDir,
        );

        for (const item of pluginResult.installed) {
          this.log(`  Installed ${item.ref}`);
        }
        for (const item of pluginResult.failed) {
          this.warn(`Failed to install plugin ${item.id}: ${item.error}`);
        }

        this.log(`Installed ${pluginResult.installed.length} skill plugins\n`);
        pluginModeSucceeded = true;
      }
    }

    // Step 3: Write config (all modes)
    this.log("Generating configuration...");
    try {
      const configResult = await writeProjectConfig({
        wizardResult: result,
        sourceResult,
        projectDir,
        sourceFlag: flags.source,
      });

      if (configResult.wasMerged) {
        this.log(`Merged with existing config at ${configResult.existingConfigPath}`);
      }

      this.log(`Configuration saved (${configResult.config.agents.length} agents)\n`);

      // Step 4: Compile agents
      this.log(STATUS_MESSAGES.COMPILING_AGENTS);
      const projectPaths = resolveInstallPaths(projectDir, "project");
      const agentDefs = await loadAgentDefs();
      const compileResult = await compileAgents({
        projectDir,
        sourcePath: agentDefs.sourcePath,
        installMode,
        agentScopeMap: buildAgentScopeMap(configResult.config),
        outputDir: projectPaths.agentsDir,
      });
      this.log(`Compiled ${compileResult.compiled.length} agents to .claude/agents/\n`);

      // Step 5: Report success
      this.log(`${SUCCESS_MESSAGES.INIT_SUCCESS}\n`);

      // Show copied skills summary for local/mixed modes (when not in plugin-only mode)
      const isLocalOutput =
        installMode === "local" || (installMode === "mixed" && !pluginModeSucceeded);
      if (isLocalOutput && copiedSkills.length > 0) {
        this.log("Skills copied to:");
        this.log(`  ${projectPaths.skillsDir}`);
        for (const skill of copiedSkills) {
          const displayName = getSkillById(skill.id).displayName;
          this.log(`    ${displayName}/`);
        }
        this.log("");
      }
      this.log("Agents compiled to:");
      this.log(`  ${projectPaths.agentsDir}`);
      for (const agentName of compileResult.compiled) {
        this.log(`    ${agentName}.md`);
      }
      this.log("");
      this.log("Configuration:");
      this.log(`  ${configResult.configPath}`);
      this.log("");
      this.log("To customize agent-skill assignments:");
      this.log(`  1. Edit .claude-src/config.ts`);
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
