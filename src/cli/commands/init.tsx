import { Flags } from "@oclif/core";
import { render } from "ink";
import path from "path";
import { BaseCommand } from "../base-command.js";
import { Wizard, type WizardResultV2 } from "../components/wizard/wizard.js";
import { loadSkillsMatrixFromSource, type SourceLoadResult } from "../lib/loading/index.js";
import { saveSourceToProjectConfig } from "../lib/configuration/index.js";
import { installLocal } from "../lib/installation/index.js";
import { checkPermissions } from "../lib/permission-checker.js";
import { installStackAsPlugin } from "../lib/stacks/index.js";
import { getCollectivePluginDir } from "../lib/plugins/index.js";
import { claudePluginMarketplaceExists, claudePluginMarketplaceAdd } from "../utils/exec.js";
import { directoryExists } from "../utils/fs.js";
import { CLAUDE_DIR, LOCAL_SKILLS_PATH } from "../consts.js";
import { EXIT_CODES } from "../lib/exit-codes.js";

export default class Init extends BaseCommand {
  static summary = "Initialize Claude Collective in this project";
  static description =
    "Interactive wizard to set up skills and agents. Supports Plugin Mode (native install) and Local Mode (copy to .claude/).";

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
      this.log("[dry-run] Preview mode - no files will be created\n");
    }

    const pluginDir = getCollectivePluginDir();
    const pluginExists = await directoryExists(pluginDir);

    if (pluginExists) {
      this.warn(`Claude Collective is already initialized at ${pluginDir}`);
      this.log(`Use 'cc edit' to modify skills.`);
      this.log("No changes made.");
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
      this.error(error instanceof Error ? error.message : "Unknown error occurred", {
        exit: EXIT_CODES.ERROR,
      });
    }

    let wizardResult: WizardResultV2 | null = null;

    const { waitUntilExit } = render(
      <Wizard
        matrix={sourceResult.matrix}
        version={this.config.version}
        projectDir={process.cwd()}
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
      return this.exit(EXIT_CODES.CANCELLED);
    }

    if (result.selectedSkills.length === 0) {
      return this.error("No skills selected", { exit: EXIT_CODES.ERROR });
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
      } else {
        if (result.installMode === "plugin") {
          this.log(`[dry-run] Individual skill plugin installation not yet supported`);
          this.log(`[dry-run] Would fall back to Local Mode...`);
        }
        const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
        const localAgentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
        this.log(
          `[dry-run] Would copy ${result.selectedSkills.length} skills to ${localSkillsDir}`,
        );
        this.log(`[dry-run] Would compile agents to ${localAgentsDir}`);
        this.log(`[dry-run] Would save config to .claude-src/config.yaml`);
      }
      this.log("\n[dry-run] Preview complete - no files were created");
      return;
    }

    if (result.installMode === "plugin") {
      if (result.selectedStackId) {
        await this.installPluginMode(result, sourceResult, flags);
        return;
      } else {
        this.warn("Individual skill plugin installation not yet supported in Plugin Mode.");
        this.log(`Falling back to Local Mode (copying to .claude/skills/)...`);
        this.log("To use Plugin Mode, select a pre-built stack instead of individual skills.\n");
      }
    }

    await this.installLocalMode(result, sourceResult, flags);
  }

  private async installPluginMode(
    result: WizardResultV2,
    sourceResult: SourceLoadResult,
    flags: { source?: string },
  ): Promise<void> {
    if (!result.selectedStackId) {
      throw new Error("No stack selected for plugin mode");
    }

    const projectDir = process.cwd();

    if (sourceResult.marketplace) {
      const marketplaceExists = await claudePluginMarketplaceExists(sourceResult.marketplace);

      if (!marketplaceExists) {
        this.log(`Registering marketplace "${sourceResult.marketplace}"...`);
        try {
          await claudePluginMarketplaceAdd(
            sourceResult.sourceConfig.source,
            sourceResult.marketplace,
          );
          this.log(`Registered marketplace: ${sourceResult.marketplace}`);
        } catch (error) {
          this.error(error instanceof Error ? error.message : "Unknown error", {
            exit: EXIT_CODES.ERROR,
          });
        }
      }
    }

    const installMethod = sourceResult.marketplace
      ? `Installing from marketplace "${sourceResult.marketplace}"`
      : "Compiling and installing";
    this.log(`${installMethod} stack "${result.selectedStackId}"...`);

    try {
      const installResult = await installStackAsPlugin({
        stackId: result.selectedStackId,
        projectDir,
        sourcePath: sourceResult.sourcePath,
        agentSourcePath: sourceResult.sourcePath,
        marketplace: sourceResult.marketplace,
      });

      const installedFrom = installResult.fromMarketplace
        ? `from marketplace`
        : `(compiled locally)`;
      this.log(`Installed stack plugin: ${installResult.pluginName} ${installedFrom}\n`);

      this.log("Claude Collective initialized successfully!\n");
      this.log(`Stack "${installResult.stackName}" installed as plugin`);

      if (installResult.agents.length > 0) {
        this.log("\nAgents included:");
        for (const agentName of installResult.agents) {
          this.log(`  ${agentName}`);
        }
        this.log(`\nSkills bundled: ${installResult.skills.length}`);
      }
      this.log("");

      if (flags.source) {
        await saveSourceToProjectConfig(projectDir, flags.source);
        this.log(`Source saved to .claude-src/config.yaml`);
      }

      const permissionWarning = await checkPermissions(projectDir);
      if (permissionWarning) {
        const { waitUntilExit } = render(permissionWarning);
        await waitUntilExit();
      }
    } catch (error) {
      this.error(error instanceof Error ? error.message : "Unknown error", {
        exit: EXIT_CODES.ERROR,
      });
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
      this.log("Compiling agents...");
      this.log(`Compiled ${installResult.compiledAgents.length} agents to .claude/agents/\n`);

      this.log("Claude Collective initialized successfully!\n");
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
      this.log(`  2. Run 'cc compile' to regenerate agents`);
      this.log("");

      const permissionWarning = await checkPermissions(projectDir);
      if (permissionWarning) {
        const { waitUntilExit } = render(permissionWarning);
        await waitUntilExit();
      }
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error), {
        exit: EXIT_CODES.ERROR,
      });
    }
  }
}
