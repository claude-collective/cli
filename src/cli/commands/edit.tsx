import { Flags } from "@oclif/core";
import { render } from "ink";

import { BaseCommand } from "../base-command.js";
import { Wizard, type WizardResultV2 } from "../components/wizard/wizard.js";
import { getErrorMessage } from "../utils/errors.js";
import { loadSkillsMatrixFromSource, getMarketplaceLabel } from "../lib/loading/index.js";
import { discoverAllPluginSkills } from "../lib/plugins/index.js";
import { archiveLocalSkill, restoreArchivedSkill } from "../lib/skills/index.js";
import { recompileAgents, getAgentDefinitions } from "../lib/agents/index.js";
import { CLI_BIN_NAME } from "../consts.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { detectInstallation } from "../lib/installation/index.js";
import { loadProjectConfig } from "../lib/configuration/index.js";
import { ERROR_MESSAGES, STATUS_MESSAGES, INFO_MESSAGES } from "../utils/messages.js";
import { claudePluginInstall, claudePluginUninstall } from "../utils/exec.js";
import type { SkillId } from "../types/index.js";
import { typedEntries } from "../utils/typed-object.js";

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  public: "Public",
  local: "Local",
};

function formatSourceDisplayName(sourceName: string): string {
  return SOURCE_DISPLAY_NAMES[sourceName] ?? sourceName;
}

export default class Edit extends BaseCommand {
  static summary = "Edit skills in the plugin";
  static description = "Modify the currently installed skills via interactive wizard";

  static examples = [
    {
      description: "Open the edit wizard",
      command: "<%= config.bin %> <%= command.id %>",
    },
    {
      description: "Edit with a custom source",
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
      this.error(ERROR_MESSAGES.NO_INSTALLATION, {
        exit: EXIT_CODES.ERROR,
      });
    }

    const projectDir = process.cwd();
    const isPluginMode = installation.mode === "plugin";

    const modeLabel = installation.mode === "local" ? "Local" : "Plugin";
    this.log(`Edit ${modeLabel} Skills\n`);

    this.log(STATUS_MESSAGES.LOADING_MARKETPLACE_SOURCE);
    let sourceResult;
    try {
      sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
        projectDir,
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
      const discoveredSkills = await discoverAllPluginSkills(projectDir);
      // Boundary cast: discoverAllPluginSkills keys are skill IDs from frontmatter
      currentSkillIds = Object.keys(discoveredSkills) as SkillId[];
      this.log(`✓ Current plugin has ${currentSkillIds.length} skills\n`);
    } catch (error) {
      this.handleError(error);
    }

    let wizardResult: WizardResultV2 | null = null;
    const marketplaceLabel = getMarketplaceLabel(sourceResult);

    // Read saved installMode from config; fall back to marketplace-derived default only if absent
    const projectConfig = await loadProjectConfig(projectDir);
    const savedInstallMode = projectConfig?.config?.installMode;
    const initialInstallMode = savedInstallMode ?? (sourceResult.marketplace ? "plugin" : "local");

    const { waitUntilExit } = render(
      <Wizard
        matrix={sourceResult.matrix}
        version={this.config.version}
        marketplaceLabel={marketplaceLabel}
        initialStep="build"
        initialInstallMode={initialInstallMode}
        initialExpertMode={projectConfig?.config?.expertMode}
        initialDomains={projectConfig?.config?.domains}
        installedSkillIds={currentSkillIds}
        projectDir={process.cwd()}
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
    const removedSkills = currentSkillIds.filter((id) => !result.selectedSkills.includes(id));

    const sourceChanges = new Map<SkillId, { from: string; to: string }>();
    for (const [skillId, selectedSource] of typedEntries<SkillId, string>(
      result.sourceSelections,
    )) {
      const skill = sourceResult.matrix.skills[skillId];
      if (skill?.activeSource && skill.activeSource.name !== selectedSource) {
        sourceChanges.set(skillId, {
          from: skill.activeSource.name,
          to: selectedSource,
        });
      }
    }

    const hasSourceChanges = sourceChanges.size > 0;
    const hasSkillChanges = addedSkills.length > 0 || removedSkills.length > 0;

    if (result.validation.warnings.length > 0) {
      this.log("\nWarnings:");
      for (const warning of result.validation.warnings) {
        this.warn(`  ! ${warning.message}`);
      }
      this.log("");
    }

    if (!hasSkillChanges && !hasSourceChanges) {
      this.log(INFO_MESSAGES.NO_CHANGES_MADE);
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
    for (const [skillId, change] of sourceChanges) {
      const fromLabel = formatSourceDisplayName(change.from);
      const toLabel = formatSourceDisplayName(change.to);
      this.log(`  ~ ${skillId} (${fromLabel} \u2192 ${toLabel})`);
    }
    this.log("");

    for (const [skillId, change] of sourceChanges) {
      if (change.from === "local") {
        await archiveLocalSkill(projectDir, skillId);
      }
      if (change.to === "local") {
        await restoreArchivedSkill(projectDir, skillId);
      }
    }

    if (isPluginMode && sourceResult.marketplace) {
      for (const skillId of addedSkills) {
        const pluginRef = `${skillId}@${sourceResult.marketplace}`;
        this.log(`Installing plugin: ${pluginRef}...`);
        try {
          await claudePluginInstall(pluginRef, "project", projectDir);
        } catch (error) {
          this.warn(`Failed to install plugin ${pluginRef}: ${getErrorMessage(error)}`);
        }
      }
      for (const skillId of removedSkills) {
        this.log(`Uninstalling plugin: ${skillId}...`);
        try {
          await claudePluginUninstall(skillId, "project", projectDir);
        } catch (error) {
          this.warn(`Failed to uninstall plugin ${skillId}: ${getErrorMessage(error)}`);
        }
      }
    }

    let sourcePath: string;
    this.log(
      flags["agent-source"]
        ? STATUS_MESSAGES.FETCHING_AGENT_PARTIALS
        : STATUS_MESSAGES.LOADING_AGENT_PARTIALS,
    );
    try {
      const agentDefs = await getAgentDefinitions(flags["agent-source"], {
        forceRefresh: flags.refresh,
      });
      sourcePath = agentDefs.sourcePath;
      this.log(flags["agent-source"] ? "✓ Agent partials fetched\n" : "✓ Agent partials loaded\n");
    } catch (error) {
      this.handleError(error);
    }

    this.log(STATUS_MESSAGES.RECOMPILING_AGENTS);
    try {
      const recompileSkills = await discoverAllPluginSkills(projectDir);

      const recompileResult = await recompileAgents({
        pluginDir: projectDir,
        sourcePath,
        skills: recompileSkills,
        projectDir,
        outputDir: installation.agentsDir,
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
      this.warn(`Agent recompilation failed: ${getErrorMessage(error)}`);
      this.log(`You can manually recompile with '${CLI_BIN_NAME} compile'.\n`);
    }

    const summaryParts = [`${addedSkills.length} added`, `${removedSkills.length} removed`];
    if (hasSourceChanges) {
      summaryParts.push(`${sourceChanges.size} source${sourceChanges.size > 1 ? "s" : ""} changed`);
    }
    this.log(`\n\u2713 Plugin updated! (${summaryParts.join(", ")})\n`);
  }
}
