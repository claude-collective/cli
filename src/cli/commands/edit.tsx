import { Flags } from "@oclif/core";
import { render } from "ink";
import React from "react";
import { BaseCommand } from "../base-command.js";
import { Wizard, WizardResultV2 } from "../components/wizard/wizard.js";
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
import type { SkillId } from "../types-matrix.js";

export default class Edit extends BaseCommand {
  static summary = "Edit skills in the plugin";
  static description = "Modify the currently installed skills via interactive wizard";

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
      this.error("No installation found. Run 'cc init' first to set up Claude Collective.", {
        exit: EXIT_CODES.ERROR,
      });
    }

    const pluginDir = getCollectivePluginDir();
    const pluginSkillsDir =
      installation.mode === "local" ? installation.skillsDir : getPluginSkillsDir(pluginDir);

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

      const sourceInfo = sourceResult.isLocal ? "local" : sourceResult.sourceConfig.sourceOrigin;
      this.log(
        `✓ Loaded ${Object.keys(sourceResult.matrix.skills).length} skills (${sourceInfo})\n`,
      );
    } catch (error) {
      this.handleError(error);
    }

    // Load current skills
    this.log("Reading current skills...");
    let currentSkillIds: SkillId[];
    try {
      currentSkillIds = await getPluginSkillIds(pluginSkillsDir, sourceResult.matrix);
      this.log(`✓ Current plugin has ${currentSkillIds.length} skills\n`);
    } catch (error) {
      this.handleError(error);
    }

    // Run wizard with initial skills
    let wizardResult: WizardResultV2 | null = null;

    const { waitUntilExit } = render(
      <Wizard
        matrix={sourceResult.matrix}
        version={this.config.version}
        initialSkills={currentSkillIds}
        onComplete={(result) => {
          // Wizard always returns WizardResultV2 in the current implementation
          wizardResult = result as WizardResultV2;
        }}
        onCancel={() => {
          this.log("\nEdit cancelled");
        }}
      />,
    );

    await waitUntilExit();

    // Cast to WizardResultV2 since that's what the current wizard implementation returns
    // Use non-null assertion here since we know the wizard has completed
    const result = wizardResult as WizardResultV2 | null;

    // Handle cancellation - use error() which throws and TypeScript understands
    if (!result || result.cancelled) {
      this.error("Cancelled", { exit: EXIT_CODES.CANCELLED });
    }

    // Validate selection - use error() which throws and TypeScript understands
    if (!result.validation.valid) {
      const errorMessages = result.validation.errors.map((e) => e.message).join("\n  ");
      this.error(`Selection has validation errors:\n  ${errorMessages}`, {
        exit: EXIT_CODES.ERROR,
      });
    }

    // Calculate changes
    const addedSkills = result.selectedSkills.filter((id) => !currentSkillIds.includes(id));
    const removedSkills = currentSkillIds.filter(
      (id) => !result.selectedSkills.includes(id),
    );

    // Show warnings if any
    if (result.validation.warnings.length > 0) {
      this.log("\nWarnings:");
      for (const warning of result.validation.warnings) {
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
        result.selectedSkills,
        pluginDir,
        sourceResult.matrix,
        sourceResult,
      );
      this.log(`✓ Plugin updated with ${result.selectedSkills.length} skills\n`);
    } catch (error) {
      this.handleError(error);
    }

    // Fetch agent partials
    let sourcePath: string;
    this.log(flags["agent-source"] ? "Fetching agent partials..." : "Loading agent partials...");
    try {
      const agentDefs = await getAgentDefinitions(flags["agent-source"], {
        forceRefresh: flags.refresh,
      });
      sourcePath = agentDefs.sourcePath;
      this.log(flags["agent-source"] ? "✓ Agent partials fetched\n" : "✓ Agent partials loaded\n");
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
