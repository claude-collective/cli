import { Flags } from "@oclif/core";
import { render } from "ink";
import React from "react";
import { BaseCommand } from "../base-command.js";
import { Wizard, WizardResult } from "../components/wizard/wizard.js";
import { loadSkillsMatrixFromSource } from "../lib/source-loader.js";
import { directoryExists, ensureDir, remove } from "../utils/fs.js";
import {
  getCollectivePluginDir,
  getPluginSkillsDir,
  getPluginSkillIds,
} from "../lib/plugin-finder.js";
import { copySkillsToPluginFromSource } from "../lib/skill-copier.js";
import { recompileAgents } from "../lib/agent-recompiler.js";
import { bumpPluginVersion } from "../lib/plugin-version.js";
import { getAgentDefinitions } from "../lib/agent-fetcher.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { detectInstallation } from "../lib/installation.js";

export default class Edit extends BaseCommand {
  static summary = "Edit skills in the plugin";
  static description =
    "Modify the currently installed skills via interactive wizard";

  static flags = {
    ...BaseCommand.baseFlags,
    refresh: Flags.boolean({
      description: "Force refresh from remote sources",
      default: false,
    }),
    "agent-source": Flags.string({
      description: "Remote agent partials source (default: local CLI)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Edit);

    // Detect installation mode
    const installation = await detectInstallation();

    if (!installation) {
      this.error(
        "No installation found. Run 'cc init' first to set up Claude Collective.",
        { exit: EXIT_CODES.ERROR },
      );
    }

    const pluginDir = getCollectivePluginDir();
    const pluginSkillsDir =
      installation.mode === "local"
        ? installation.skillsDir
        : getPluginSkillsDir(pluginDir);

    const modeLabel = installation.mode === "local" ? "Local" : "Plugin";
    this.log(`Edit ${modeLabel} Skills\n`);

    // Load skills matrix
    this.log("Resolving marketplace source...");
    let sourceResult;
    try {
      sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
        projectDir: process.cwd(),
        forceRefresh: flags.refresh,
      });

      const sourceInfo = sourceResult.isLocal
        ? "local"
        : sourceResult.sourceConfig.sourceOrigin;
      this.log(`✓ Loaded ${Object.keys(sourceResult.matrix.skills).length} skills (${sourceInfo})\n`);
    } catch (error) {
      this.handleError(error);
    }

    // Load current skills
    this.log("Reading current skills...");
    let currentSkillIds: string[];
    try {
      currentSkillIds = await getPluginSkillIds(
        pluginSkillsDir,
        sourceResult.matrix,
      );
      this.log(`✓ Current plugin has ${currentSkillIds.length} skills\n`);
    } catch (error) {
      this.handleError(error);
    }

    // Run wizard with initial skills
    let wizardResult: WizardResult | null = null;

    const { waitUntilExit } = render(
      <Wizard
        matrix={sourceResult.matrix}
        initialSkills={currentSkillIds}
        onComplete={(result) => {
          wizardResult = result;
        }}
        onCancel={() => {
          this.log("\nEdit cancelled");
        }}
      />,
    );

    await waitUntilExit();

    // Handle cancellation
    if (!wizardResult || wizardResult.cancelled) {
      this.exit(EXIT_CODES.CANCELLED);
    }

    // Validate selection
    if (!wizardResult.validation.valid) {
      this.error("Selection has validation errors:");
      for (const error of wizardResult.validation.errors) {
        this.log(`  ${error.message}`);
      }
      this.exit(EXIT_CODES.ERROR);
    }

    // Calculate changes
    const addedSkills = wizardResult.selectedSkills.filter(
      (id) => !currentSkillIds.includes(id),
    );
    const removedSkills = currentSkillIds.filter(
      (id) => !wizardResult.selectedSkills.includes(id),
    );

    // Show warnings if any
    if (wizardResult.validation.warnings.length > 0) {
      this.log("\nWarnings:");
      for (const warning of wizardResult.validation.warnings) {
        this.warn(`  ! ${warning.message}`);
      }
      this.log("");
    }

    // Check if there are no changes
    if (addedSkills.length === 0 && removedSkills.length === 0) {
      this.log("No changes made.");
      this.log("Plugin unchanged\n");
      return;
    }

    // Show changes
    this.log("\nChanges:");
    for (const skillId of addedSkills) {
      const skill = sourceResult.matrix.skills[skillId];
      this.log(`  + ${skill?.name || skillId}`);
    }
    for (const skillId of removedSkills) {
      const skill = sourceResult.matrix.skills[skillId];
      this.log(`  - ${skill?.name || skillId}`);
    }
    this.log("");

    // Update plugin skills
    this.log("Updating plugin skills...");
    try {
      if (await directoryExists(pluginSkillsDir)) {
        await remove(pluginSkillsDir);
      }
      await ensureDir(pluginSkillsDir);

      await copySkillsToPluginFromSource(
        wizardResult.selectedSkills,
        pluginDir,
        sourceResult.matrix,
        sourceResult,
      );
      this.log(
        `✓ Plugin updated with ${wizardResult.selectedSkills.length} skills\n`,
      );
    } catch (error) {
      this.handleError(error);
    }

    // Fetch agent partials
    let sourcePath: string;
    this.log(
      flags["agent-source"]
        ? "Fetching agent partials..."
        : "Loading agent partials...",
    );
    try {
      const agentDefs = await getAgentDefinitions(flags["agent-source"], {
        forceRefresh: flags.refresh,
      });
      sourcePath = agentDefs.sourcePath;
      this.log(
        flags["agent-source"]
          ? "✓ Agent partials fetched\n"
          : "✓ Agent partials loaded\n",
      );
    } catch (error) {
      this.handleError(error);
    }

    // Recompile agents
    this.log("Recompiling agents...");
    try {
      const recompileResult = await recompileAgents({
        pluginDir,
        sourcePath,
      });

      if (recompileResult.failed.length > 0) {
        this.log(
          `✓ Recompiled ${recompileResult.compiled.length} agents (${recompileResult.failed.length} failed)\n`,
        );
        for (const warning of recompileResult.warnings) {
          this.warn(warning);
        }
      } else if (recompileResult.compiled.length > 0) {
        this.log(`✓ Recompiled ${recompileResult.compiled.length} agents\n`);
      } else {
        this.log("✓ No agents to recompile\n");
      }
    } catch (error) {
      this.warn(
        `Agent recompilation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.log("You can manually recompile with 'cc compile'.\n");
    }

    // Update plugin version
    this.log("Updating plugin version...");
    try {
      const newVersion = await bumpPluginVersion(pluginDir, "patch");
      this.log(`✓ Version bumped to ${newVersion}\n`);
    } catch (error) {
      this.handleError(error);
    }

    this.log(
      `\n✓ Plugin updated! (${addedSkills.length} added, ${removedSkills.length} removed)\n`,
    );
  }
}
