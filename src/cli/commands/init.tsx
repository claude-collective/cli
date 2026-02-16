import { Flags } from "@oclif/core";
import { render } from "ink";
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
  detectInstallation as detectExistingInstallation,
} from "../lib/installation/index.js";
import { checkPermissions } from "../lib/permission-checker.js";
import { hasIndividualPlugins } from "../lib/plugins/index.js";
import {
  claudePluginInstall,
  claudePluginMarketplaceExists,
  claudePluginMarketplaceAdd,
} from "../utils/exec.js";
import { CLAUDE_DIR, DEFAULT_BRANDING, LOCAL_SKILLS_PATH } from "../consts.js";
import { getErrorMessage } from "../utils/errors.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { resolveBranding } from "../lib/configuration/config.js";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  STATUS_MESSAGES,
  INFO_MESSAGES,
  DRY_RUN_MESSAGES,
} from "../utils/messages.js";

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
    refresh: Flags.boolean({
      description: "Force refresh from remote source",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const projectDir = process.cwd();

    this.log(
      `       
 █████╗  ██████╗ ███████╗███╗   ██╗████████╗███████╗      ██╗███╗   ██╗ ██████╗
██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██╔════╝      ██║████╗  ██║██╔════╝
███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ███████╗      ██║██╔██╗ ██║██║     
██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ╚════██║      ██║██║╚██╗██║██║     
██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ███████║      ██║██║ ╚████║╚██████╗
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝      ╚═╝╚═╝  ╚═══╝ ╚═════╝
`,
    );

    if (flags["dry-run"]) {
      this.log(`${DRY_RUN_MESSAGES.PREVIEW_NO_FILES_CREATED}\n`);
    }

    const individualPluginsExist = await hasIndividualPlugins(projectDir);
    const existingInstallation = await detectExistingInstallation(projectDir);

    if (individualPluginsExist || existingInstallation) {
      const location = individualPluginsExist
        ? `.claude/settings.json`
        : (existingInstallation?.configPath ?? projectDir);
      this.warn(`${DEFAULT_BRANDING.NAME} is already initialized at ${location}`);
      this.log(`Use 'agentsinc edit' to modify skills.`);
      this.log(INFO_MESSAGES.NO_CHANGES_MADE);
      return;
    }

    let sourceResult: SourceLoadResult;
    try {
      sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
        projectDir,
        forceRefresh: flags.refresh,
      });
    } catch (error) {
      this.error(getErrorMessage(error), {
        exit: EXIT_CODES.ERROR,
      });
    }

    let wizardResult: WizardResultV2 | null = null;

    const marketplaceLabel = getMarketplaceLabel(sourceResult);
    const branding = await resolveBranding(projectDir);

    const { waitUntilExit } = render(
      <Wizard
        matrix={sourceResult.matrix}
        version={this.config.version}
        marketplaceLabel={marketplaceLabel}
        brandingName={branding.name}
        projectDir={process.cwd()}
        initialInstallMode={sourceResult.marketplace ? "plugin" : "local"}
        onComplete={(result) => {
          wizardResult = result as WizardResultV2;
        }}
        onCancel={() => {
          this.log("Setup cancelled");
        }}
      />,
    );

    await waitUntilExit();

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
    flags: { "dry-run": boolean; source?: string; refresh: boolean },
  ): Promise<void> {
    const projectDir = process.cwd();
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
            `[dry-run]   claude plugin install ${result.selectedStackId}@${sourceResult.marketplace} --scope project`,
          );
        } else {
          this.log(
            `[dry-run] Would compile and install stack "${result.selectedStackId}" as a native plugin`,
          );
          this.log(
            `[dry-run]   claude plugin install ./compiled-stack/${result.selectedStackId} --scope project`,
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
            `[dry-run]   claude plugin install ${skillId}@${sourceResult.marketplace} --scope project`,
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
        await this.installIndividualPlugins(result, sourceResult, flags);
      } else {
        this.warn("Plugin Mode requires a marketplace for individual skill installation.");
        this.log(`Falling back to Local Mode (copying to .claude/skills/)...`);
        this.log("To use Plugin Mode, either select a stack or configure a marketplace source.\n");
        await this.installLocalMode(result, sourceResult, flags);
      }
      return;
    }

    await this.installLocalMode(result, sourceResult, flags);
  }

  private async installIndividualPlugins(
    result: WizardResultV2,
    sourceResult: SourceLoadResult,
    flags: { source?: string },
  ): Promise<void> {
    const projectDir = process.cwd();

    if (sourceResult.marketplace) {
      const marketplaceExists = await claudePluginMarketplaceExists(sourceResult.marketplace);

      if (!marketplaceExists) {
        this.log(`Registering marketplace "${sourceResult.marketplace}"...`);
        try {
          await claudePluginMarketplaceAdd(sourceResult.marketplace);
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
        await claudePluginInstall(pluginRef, "project", projectDir);
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
      this.log(`  2. Run 'agentsinc compile' to regenerate agents`);
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
  ): Promise<void> {
    const projectDir = process.cwd();
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
      this.log(`  2. Run 'agentsinc compile' to regenerate agents`);
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
