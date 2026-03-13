import React from "react";

import { Flags } from "@oclif/core";
import { render, Box, Text, useApp } from "ink";
import fs from "fs";
import os from "os";
import path from "path";

import { BaseCommand } from "../base-command.js";
import { Wizard, type WizardResultV2 } from "../components/wizard/wizard.js";
import {
  loadSkillsMatrixFromSource,
  getMarketplaceLabel,
  fetchMarketplace,
  type SourceLoadResult,
} from "../lib/loading/index.js";
import {
  installLocal,
  installPluginConfig,
  detectGlobalInstallation,
  detectProjectInstallation,
  deriveInstallMode,
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
import { loadProjectConfig } from "../lib/configuration/project-config.js";
import {
  enableBuffering,
  drainBuffer,
  disableBuffering,
  type StartupMessage,
} from "../utils/logger.js";
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

type GlobalConfigChoice = "edit-global" | "create-project";

const GLOBAL_CONFIG_OPTIONS: SelectListItem<GlobalConfigChoice>[] = [
  { label: "Edit global installation", value: "edit-global" },
  { label: "Create new project installation", value: "create-project" },
];

type GlobalConfigPromptProps = {
  globalConfigDir: string;
  onSelect: (choice: GlobalConfigChoice) => void;
  onCancel: () => void;
};

const GlobalConfigPrompt: React.FC<GlobalConfigPromptProps> = ({
  globalConfigDir,
  onSelect,
  onCancel,
}) => {
  const { exit } = useApp();

  return (
    <Box flexDirection="column">
      <Text>A global installation was found at {globalConfigDir}</Text>
      <Text> </Text>
      <SelectList
        items={GLOBAL_CONFIG_OPTIONS}
        onSelect={(choice) => {
          onSelect(choice);
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

export type DashboardData = {
  skillCount: number;
  agentCount: number;
  mode: string;
  source?: string;
};

/** Gathers dashboard data from the installation and project config. */
export async function getDashboardData(projectDir: string): Promise<DashboardData> {
  const [info, loaded] = await Promise.all([getInstallationInfo(), loadProjectConfig(projectDir)]);

  // Skill count from config (canonical source of truth for installed skills)
  const skillCount = loaded?.config?.skills?.length ?? 0;
  // Agent count from filesystem (compiled .md files in agents dir)
  const agentCount = info?.agentCount ?? 0;
  const mode =
    info?.mode ?? (loaded?.config?.skills ? deriveInstallMode(loaded.config.skills) : "local");
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
    const individualPluginsExist = await hasIndividualPlugins(projectDir);
    const existingInstallation = await detectProjectInstallation(projectDir);

    if (individualPluginsExist || existingInstallation) {
      const selectedCommand = await showDashboard(projectDir, (msg) => this.log(msg));
      if (selectedCommand) {
        await this.config.runCommand(selectedCommand);
      }
      return;
    }

    // No project config exists: check if a global installation exists
    const globalInstallation = await detectGlobalInstallation();
    if (globalInstallation) {
      const globalConfigDir = path.join(os.homedir(), CLAUDE_SRC_DIR);

      // Non-interactive: skip prompt and fall through to wizard
      if (process.stdin.isTTY) {
        let globalChoice: GlobalConfigChoice | null = null;

        const { waitUntilExit: waitForPrompt } = render(
          <GlobalConfigPrompt
            globalConfigDir={globalConfigDir}
            onSelect={(choice) => {
              globalChoice = choice;
            }}
            onCancel={() => {
              globalChoice = null;
            }}
          />,
        );

        await waitForPrompt();
        clearTerminalOutput();

        if (globalChoice === "edit-global") {
          const editArgs: string[] = [];
          if (flags.source) {
            editArgs.push("--source", flags.source);
          }
          if (flags.refresh) {
            editArgs.push("--refresh");
          }
          await this.config.runCommand("edit", editArgs);
          return;
        }

        // User cancelled (Esc)
        if (globalChoice === null) {
          return;
        }

        // "create-project" falls through to wizard below
      }
    }

    // Auto-create blank global config on first init from a project directory.
    // This ensures the project config can always import from global.
    // Resolve both paths through realpathSync — on macOS /var is a symlink to
    // /private/var, so os.homedir() and process.cwd() can return different
    // prefixes for the same directory.
    const isGlobalRoot =
      fs.realpathSync(projectDir) === fs.realpathSync(GLOBAL_INSTALL_ROOT);
    if (!isGlobalRoot) {
      const created = await ensureBlankGlobalConfig();
      if (created) {
        this.log("Created blank global config at ~/" + CLAUDE_SRC_DIR);
      }
    }

    enableBuffering();

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
        version={this.config.version}
        marketplaceLabel={marketplaceLabel}
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
    const installMode = deriveInstallMode(result.skills);

    this.log("\n");
    this.log(`Selected ${result.skills.length} skills`);
    this.log(
      `Install mode: ${installMode === "plugin" ? "Plugin (native install)" : "Local (copy to .claude/skills/)"}`,
    );

    if (installMode === "plugin") {
      await this.installIndividualPlugins(result, sourceResult, flags, projectDir);
      return;
    }

    await this.installLocalMode(result, sourceResult, flags, projectDir);
  }

  private async installIndividualPlugins(
    result: WizardResultV2,
    sourceResult: SourceLoadResult,
    flags: { source?: string },
    projectDir: string,
  ): Promise<void> {
    // Lazily resolve marketplace name if not already set (e.g. BUILT_IN_MATRIX skips fetch)
    if (!sourceResult.marketplace) {
      try {
        const marketplaceResult = await fetchMarketplace(sourceResult.sourceConfig.source, {});
        sourceResult.marketplace = marketplaceResult.marketplace.name;
      } catch {
        this.warn("Could not resolve marketplace. Falling back to Local Mode...");
        await this.installLocalMode(result, sourceResult, flags, projectDir);
        return;
      }
    }

    // After lazy resolution, marketplace is guaranteed to be set (or we returned above)
    const marketplace = sourceResult.marketplace;

    const marketplaceExists = await claudePluginMarketplaceExists(marketplace);

    if (!marketplaceExists) {
      this.log(`Registering marketplace "${marketplace}"...`);
      try {
        const marketplaceSource = sourceResult.sourceConfig.source.replace(/^github:/, "");
        await claudePluginMarketplaceAdd(marketplaceSource);
        this.log(`Registered marketplace: ${marketplace}`);
      } catch (error) {
        this.error(getErrorMessage(error), {
          exit: EXIT_CODES.ERROR,
        });
      }
    }

    this.log("Installing skill plugins...");
    for (const skill of result.skills.filter((s) => s.source !== "local")) {
      const pluginRef = `${skill.id}@${marketplace}`;
      const pluginScope = skill.scope === "global" ? "user" : "project";
      try {
        await claudePluginInstall(pluginRef, pluginScope, projectDir);
        this.log(`  Installed ${pluginRef}`);
      } catch (error) {
        this.error(`Failed to install plugin ${pluginRef}: ${getErrorMessage(error)}`, {
          exit: EXIT_CODES.ERROR,
        });
      }
    }

    const pluginSkillCount = result.skills.filter((s) => s.source !== "local").length;
    this.log(`Installed ${pluginSkillCount} skill plugins\n`);

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

  private async installLocalMode(
    result: WizardResultV2,
    sourceResult: SourceLoadResult,
    flags: { source?: string },
    projectDir: string,
  ): Promise<void> {
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
        const displayName = getSkillById(copiedSkill.skillId).displayName;
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
