/**
 * Initialize Claude Collective in this project.
 *
 * Interactive wizard to select skills and configure installation mode.
 * Supports both Plugin Mode (native install) and Local Mode (copy to .claude/).
 */
import { Flags } from "@oclif/core";
import { render, Text } from "ink";
import React from "react";
import path from "path";
import { stringify as stringifyYaml } from "yaml";
import { BaseCommand } from "../base-command.js";
import { Wizard, type WizardResult } from "../components/wizard/wizard.js";
import {
  loadSkillsMatrixFromSource,
  type SourceLoadResult,
} from "../lib/source-loader.js";
import { formatSourceOrigin } from "../lib/config.js";
import { copySkillsToLocalFlattened } from "../lib/skill-copier.js";
import { checkPermissions } from "../lib/permission-checker.js";
import { loadAllAgents, loadStack } from "../lib/loader.js";
import { resolveAgents, resolveStackSkills } from "../lib/resolver.js";
import { compileAgentForPlugin } from "../lib/stack-plugin-compiler.js";
import { installStackAsPlugin } from "../lib/stack-installer.js";
import { getCollectivePluginDir } from "../lib/plugin-finder.js";
import { createLiquidEngine } from "../lib/compiler.js";
import {
  generateConfigFromSkills,
  generateConfigFromStack,
} from "../lib/config-generator.js";
import {
  claudePluginMarketplaceExists,
  claudePluginMarketplaceAdd,
} from "../utils/exec.js";
import { ensureDir, writeFile, directoryExists } from "../utils/fs.js";
import { LOCAL_SKILLS_PATH, PROJECT_ROOT } from "../consts.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import type { CompileConfig, CompileAgentConfig, StackConfig } from "../../types.js";

const PLUGIN_NAME = "claude-collective";

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

    this.log("Claude Collective Setup\n");

    if (flags["dry-run"]) {
      this.log("[dry-run] Preview mode - no files will be created\n");
    }

    // Check if already initialized
    const pluginDir = getCollectivePluginDir();
    const pluginExists = await directoryExists(pluginDir);

    if (pluginExists) {
      this.warn(
        `Claude Collective is already initialized at ${pluginDir}`,
      );
      this.log(`Use 'cc edit' to modify skills.`);
      this.log("No changes made.");
      return;
    }

    // Load skills matrix
    this.log("Loading skills matrix...");
    let sourceResult: SourceLoadResult;
    try {
      sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
        projectDir,
        forceRefresh: flags.refresh,
      });

      const sourceInfo = sourceResult.isLocal
        ? "local"
        : formatSourceOrigin(sourceResult.sourceConfig.sourceOrigin);
      this.log(
        `Loaded ${Object.keys(sourceResult.matrix.skills).length} skills (${sourceInfo})\n`,
      );
    } catch (error) {
      this.error(
        error instanceof Error ? error.message : "Unknown error occurred",
        { exit: EXIT_CODES.ERROR },
      );
    }

    // Store result from wizard
    let wizardResult: WizardResult | null = null;

    // Render wizard and wait for completion
    const { waitUntilExit } = render(
      <Wizard
        matrix={sourceResult.matrix}
        onComplete={(result) => {
          wizardResult = result;
        }}
        onCancel={() => {
          this.log("Setup cancelled");
        }}
      />,
    );

    await waitUntilExit();

    // Handle cancellation or no result
    if (!wizardResult || wizardResult.cancelled) {
      this.exit(EXIT_CODES.CANCELLED);
    }

    // Validate selection
    if (wizardResult.selectedSkills.length === 0) {
      this.error("No skills selected", { exit: EXIT_CODES.ERROR });
    }

    // Handle installation based on mode
    await this.handleInstallation(wizardResult, sourceResult, flags);
  }

  /**
   * Handle installation based on wizard result.
   * Supports Plugin Mode (with stack) and Local Mode (copy to .claude/).
   */
  private async handleInstallation(
    result: WizardResult,
    sourceResult: SourceLoadResult,
    flags: any,
  ): Promise<void> {
    const projectDir = process.cwd();
    const matrix = sourceResult.matrix;
    const dryRun = flags["dry-run"];

    // Show summary
    this.log("\n");
    this.log(`Selected ${result.selectedSkills.length} skills`);
    this.log(
      `Install mode: ${result.installMode === "plugin" ? "Plugin (native install)" : "Local (copy to .claude/skills/)"}`,
    );
    this.log("\n");

    // Dry run preview
    if (dryRun) {
      if (result.installMode === "plugin" && result.selectedStack) {
        // Plugin Mode with stack: install entire stack as ONE plugin
        const useMarketplace = !!sourceResult.marketplace;
        if (useMarketplace) {
          this.log(
            `[dry-run] Would install stack "${result.selectedStack.id}" from marketplace "${sourceResult.marketplace}"`,
          );
          this.log(
            `[dry-run]   claude plugin install ${result.selectedStack.id}@${sourceResult.marketplace} --scope project`,
          );
        } else {
          this.log(
            `[dry-run] Would compile and install stack "${result.selectedStack.id}" as a native plugin`,
          );
          this.log(
            `[dry-run]   claude plugin install ./compiled-stack/${result.selectedStack.id} --scope project`,
          );
          this.log(
            `[dry-run] Stack includes ${result.selectedSkills.length} skills and agents bundled together`,
          );
        }
      } else {
        // Local Mode (or Plugin Mode fallback when no stack selected)
        if (result.installMode === "plugin") {
          this.log(
            `[dry-run] Individual skill plugin installation not yet supported`,
          );
          this.log(`[dry-run] Would fall back to Local Mode...`);
        }
        const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
        const localAgentsDir = path.join(projectDir, ".claude", "agents");
        this.log(
          `[dry-run] Would copy ${result.selectedSkills.length} skills to ${localSkillsDir}`,
        );
        this.log(`[dry-run] Would compile agents to ${localAgentsDir}`);
        this.log(`[dry-run] Would save config to .claude/config.yaml`);
      }
      this.log("\n[dry-run] Preview complete - no files were created");
      return;
    }

    // Plugin Mode: Install stack as ONE native plugin
    if (result.installMode === "plugin") {
      if (result.selectedStack) {
        await this.installPluginMode(result, sourceResult);
        return;
      } else {
        // No stack selected - individual skill installation not yet supported
        this.warn(
          "Individual skill plugin installation not yet supported in Plugin Mode.",
        );
        this.log(
          `Falling back to Local Mode (copying to .claude/skills/)...`,
        );
        this.log(
          "To use Plugin Mode, select a pre-built stack instead of individual skills.\n",
        );
        // Fall through to Local Mode below
      }
    }

    // Local Mode: Copy skills and compile agents
    await this.installLocalMode(result, sourceResult);
  }

  /**
   * Install in Plugin Mode: install stack as native plugin.
   */
  private async installPluginMode(
    result: WizardResult,
    sourceResult: SourceLoadResult,
  ): Promise<void> {
    if (!result.selectedStack) {
      throw new Error("No stack selected for plugin mode");
    }

    const projectDir = process.cwd();

    // Register marketplace if needed
    if (sourceResult.marketplace) {
      const marketplaceExists = await claudePluginMarketplaceExists(
        sourceResult.marketplace,
      );

      if (!marketplaceExists) {
        this.log(`Registering marketplace "${sourceResult.marketplace}"...`);
        try {
          await claudePluginMarketplaceAdd(
            sourceResult.sourceConfig.source,
            sourceResult.marketplace,
          );
          this.log(`Registered marketplace: ${sourceResult.marketplace}`);
        } catch (error) {
          this.error(
            error instanceof Error ? error.message : "Unknown error",
            { exit: EXIT_CODES.ERROR },
          );
        }
      }
    }

    const installMethod = sourceResult.marketplace
      ? `Installing from marketplace "${sourceResult.marketplace}"`
      : "Compiling and installing";
    this.log(`${installMethod} stack "${result.selectedStack.id}"...`);

    try {
      const installResult = await installStackAsPlugin({
        stackId: result.selectedStack.id,
        projectDir,
        sourcePath: sourceResult.sourcePath,
        agentSourcePath: sourceResult.sourcePath,
        marketplace: sourceResult.marketplace,
      });

      const installedFrom = installResult.fromMarketplace
        ? `from marketplace`
        : `(compiled locally)`;
      this.log(
        `Installed stack plugin: ${installResult.pluginName} ${installedFrom}\n`,
      );

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

      const permissionWarning = await checkPermissions(projectDir);
      if (permissionWarning) {
        const { waitUntilExit } = render(permissionWarning);
        await waitUntilExit();
      }
    } catch (error) {
      this.error(
        error instanceof Error ? error.message : "Unknown error",
        { exit: EXIT_CODES.ERROR },
      );
    }
  }

  /**
   * Install in Local Mode: copy skills and compile agents to .claude/.
   */
  private async installLocalMode(
    result: WizardResult,
    sourceResult: SourceLoadResult,
  ): Promise<void> {
    const projectDir = process.cwd();
    const matrix = sourceResult.matrix;
    const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
    const localAgentsDir = path.join(projectDir, ".claude", "agents");
    const localConfigPath = path.join(projectDir, ".claude", "config.yaml");

    this.log("Copying skills to local directory...");
    try {
      await ensureDir(localSkillsDir);
      await ensureDir(localAgentsDir);

      const copiedSkills = await copySkillsToLocalFlattened(
        result.selectedSkills,
        localSkillsDir,
        matrix,
        sourceResult,
      );

      this.log(`Copied ${copiedSkills.length} skills to .claude/skills/\n`);

      this.log("Generating configuration...");

      // Load agents from both CLI and source, with source taking precedence
      const cliAgents = await loadAllAgents(PROJECT_ROOT);
      const localAgents = await loadAllAgents(sourceResult.sourcePath);
      const agents = { ...cliAgents, ...localAgents };

      const localSkillsForResolution: Record<
        string,
        {
          id: string;
          name: string;
          description: string;
          canonicalId: string;
          path: string;
          content: string;
        }
      > = {};
      for (const copiedSkill of copiedSkills) {
        const skill = matrix.skills[copiedSkill.skillId];
        if (skill) {
          localSkillsForResolution[copiedSkill.skillId] = {
            id: copiedSkill.skillId,
            name: skill.name,
            description: skill.description || "",
            canonicalId: copiedSkill.skillId,
            path: copiedSkill.destPath,
            content: "", // Content not needed for skill references
          };
        }
      }

      let localConfig: StackConfig;
      if (result.selectedStack) {
        const loadedStackConfig = await loadStack(
          result.selectedStack.id,
          sourceResult.sourcePath,
          "dev",
        );
        localConfig = generateConfigFromStack(loadedStackConfig);
      } else {
        localConfig = generateConfigFromSkills(
          result.selectedSkills,
          sourceResult.matrix,
        );
      }

      const configYaml = stringifyYaml(localConfig, {
        indent: 2,
        lineWidth: 120,
      });
      await writeFile(localConfigPath, configYaml);

      this.log(`Configuration saved (${localConfig.agents.length} agents)\n`);

      this.log("Compiling agents...");

      const compileAgents: Record<string, CompileAgentConfig> = {};
      for (const agentId of localConfig.agents) {
        if (agents[agentId]) {
          if (localConfig.agent_skills?.[agentId]) {
            const skillRefs = resolveStackSkills(
              localConfig,
              agentId,
              localSkillsForResolution,
            );
            compileAgents[agentId] = { skills: skillRefs };
          } else {
            compileAgents[agentId] = {};
          }
        }
      }

      const compileConfig: CompileConfig = {
        name: PLUGIN_NAME,
        description:
          localConfig.description ||
          `Local setup with ${result.selectedSkills.length} skills`,
        claude_md: "",
        agents: compileAgents,
      };

      const engine = await createLiquidEngine(projectDir);
      const resolvedAgents = await resolveAgents(
        agents,
        localSkillsForResolution,
        compileConfig,
        sourceResult.sourcePath,
      );

      const compiledAgentNames: string[] = [];
      for (const [name, agent] of Object.entries(resolvedAgents)) {
        const output = await compileAgentForPlugin(
          name,
          agent,
          sourceResult.sourcePath,
          engine,
        );
        await writeFile(path.join(localAgentsDir, `${name}.md`), output);
        compiledAgentNames.push(name);
      }

      this.log(
        `Compiled ${compiledAgentNames.length} agents to .claude/agents/\n`,
      );

      // Success summary
      this.log("Claude Collective initialized successfully!\n");
      this.log("Skills copied to:");
      this.log(`  ${localSkillsDir}`);
      for (const copiedSkill of copiedSkills) {
        const skill = matrix.skills[copiedSkill.skillId];
        const displayName = skill?.alias || copiedSkill.skillId;
        this.log(`    ${displayName}/`);
      }
      this.log("");
      this.log("Agents compiled to:");
      this.log(`  ${localAgentsDir}`);
      for (const agentName of compiledAgentNames) {
        this.log(`    ${agentName}.md`);
      }
      this.log("");
      this.log("Configuration:");
      this.log(`  ${localConfigPath}`);
      this.log("");
      this.log("To customize agent-skill assignments:");
      this.log(`  1. Edit .claude/config.yaml`);
      this.log(`  2. Run 'cc compile' to regenerate agents`);
      this.log("");

      const permissionWarning = await checkPermissions(projectDir);
      if (permissionWarning) {
        const { waitUntilExit } = render(permissionWarning);
        await waitUntilExit();
      }
    } catch (error) {
      this.error(
        error instanceof Error ? error.message : String(error),
        { exit: EXIT_CODES.ERROR },
      );
    }
  }
}
