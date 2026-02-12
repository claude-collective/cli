import { Flags } from "@oclif/core";
import { render } from "ink";
import { BaseCommand } from "../base-command.js";
import { Wizard, WizardResultV2 } from "../components/wizard/wizard.js";
import { loadSkillsMatrixFromSource } from "../lib/loading/index.js";
import { directoryExists, ensureDir, remove } from "../utils/fs.js";
import {
  getCollectivePluginDir,
  getPluginSkillsDir,
  getPluginSkillIds,
  bumpPluginVersion,
} from "../lib/plugins/index.js";
import { copySkillsToPluginFromSource } from "../lib/skills/index.js";
import { recompileAgents, getAgentDefinitions } from "../lib/agents/index.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { detectInstallation } from "../lib/installation/index.js";
import type { SkillId } from "../types/index.js";

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

    this.log("Reading current skills...");
    let currentSkillIds: SkillId[];
    try {
      currentSkillIds = await getPluginSkillIds(pluginSkillsDir, sourceResult.matrix);
      this.log(`✓ Current plugin has ${currentSkillIds.length} skills\n`);
    } catch (error) {
      this.handleError(error);
    }

    let wizardResult: WizardResultV2 | null = null;

    const { waitUntilExit } = render(
      <Wizard
        matrix={sourceResult.matrix}
        version={this.config.version}
        initialStep="build"
        installedSkillIds={currentSkillIds}
        onComplete={(result) => {
          wizardResult = result as WizardResultV2;
        }}
        onCancel={() => {
          this.log("\nEdit cancelled");
        }}
      />,
    );

    await waitUntilExit();

    const result = wizardResult as WizardResultV2 | null;

    if (!result || result.cancelled) {
      this.error("Cancelled", { exit: EXIT_CODES.CANCELLED });
    }

    if (!result.validation.valid) {
      const errorMessages = result.validation.errors.map((e) => e.message).join("\n  ");
      this.error(`Selection has validation errors:\n  ${errorMessages}`, {
        exit: EXIT_CODES.ERROR,
      });
    }

    const addedSkills = result.selectedSkills.filter((id) => !currentSkillIds.includes(id));
    const removedSkills = currentSkillIds.filter(
      (id) => !result.selectedSkills.includes(id),
    );

    if (result.validation.warnings.length > 0) {
      this.log("\nWarnings:");
      for (const warning of result.validation.warnings) {
        this.warn(`  ! ${warning.message}`);
      }
      this.log("");
    }

    if (addedSkills.length === 0 && removedSkills.length === 0) {
      this.log("No changes made.");
      this.log("Plugin unchanged\n");
      return;
    }

    this.log("\nChanges:");
    for (const skillId of addedSkills) {
      const skill = sourceResult.matrix.skills[skillId];
      this.log(`  + ${skill?.displayName || skillId}`);
    }
    for (const skillId of removedSkills) {
      const skill = sourceResult.matrix.skills[skillId];
      this.log(`  - ${skill?.displayName || skillId}`);
    }
    this.log("");

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
