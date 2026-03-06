import os from "os";
import path from "path";

import { Flags } from "@oclif/core";
import { render } from "ink";

import { BaseCommand } from "../base-command.js";
import { Wizard, type WizardResultV2 } from "../components/wizard/wizard.js";
import { ASCII_LOGO, CLI_BIN_NAME, CLAUDE_SRC_DIR, GLOBAL_INSTALL_ROOT, SOURCE_DISPLAY_NAMES, STANDARD_FILES } from "../consts.js";
import { getAgentDefinitions, recompileAgents } from "../lib/agents/index.js";
import { splitConfigByScope } from "../lib/configuration/config-generator.js";
import { loadProjectConfig } from "../lib/configuration/index.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import {
  detectInstallation,
  buildAndMergeConfig,
  writeConfigFile,
  detectMigrations,
  executeMigration,
  deriveInstallMode,
} from "../lib/installation/index.js";
import { getMarketplaceLabel, loadSkillsMatrixFromSource } from "../lib/loading/index.js";
import { discoverAllPluginSkills } from "../lib/plugins/index.js";
import { deleteLocalSkill, migrateLocalSkillScope } from "../lib/skills/index.js";
import type { SkillId } from "../types/index.js";
import { getErrorMessage } from "../utils/errors.js";
import { claudePluginInstall, claudePluginUninstall } from "../utils/exec.js";
import {
  enableBuffering,
  drainBuffer,
  disableBuffering,
  pushBufferMessage,
  verbose,
  type StartupMessage,
} from "../utils/logger.js";
import { ERROR_MESSAGES, INFO_MESSAGES, STATUS_MESSAGES } from "../utils/messages.js";

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

    const projectDir = installation.projectDir;

    enableBuffering();

    if (installation.projectDir === os.homedir()) {
      pushBufferMessage("info", "No project installation found. Using global installation from ~/.claude-src/");
    }
    let sourceResult;
    let startupMessages: StartupMessage[] = [];
    try {
      sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
        projectDir,
        forceRefresh: flags.refresh,
      });

      const sourceInfo = sourceResult.isLocal ? "local" : sourceResult.sourceConfig.sourceOrigin;
      pushBufferMessage(
        "info",
        `Loaded ${Object.keys(sourceResult.matrix.skills).length} skills (${sourceInfo})`,
      );
    } catch (error) {
      disableBuffering();
      this.handleError(error);
    }

    const projectConfig = await loadProjectConfig(projectDir);

    let currentSkillIds: SkillId[];
    try {
      const discoveredSkills = await discoverAllPluginSkills(projectDir);
      // Boundary cast: discoverAllPluginSkills keys are skill IDs from frontmatter
      currentSkillIds = Object.keys(discoveredSkills) as SkillId[];

      // In local mode, plugin discovery returns empty — fall back to project config skills
      if (currentSkillIds.length === 0 && projectConfig?.config?.skills?.length) {
        currentSkillIds = projectConfig.config.skills.map(s => s.id);
        pushBufferMessage("info", `Found ${currentSkillIds.length} skills from project config`);
      } else {
        pushBufferMessage("info", `Current plugin has ${currentSkillIds.length} skills`);
      }
    } catch (error) {
      disableBuffering();
      this.handleError(error);
    }

    startupMessages = drainBuffer();
    disableBuffering();

    let wizardResult: WizardResultV2 | null = null;
    const marketplaceLabel = getMarketplaceLabel(sourceResult);

    // D9: In project context, existing global items are read-only (locked).
    // When editing from ~/ (global context), nothing is locked.
    const isGlobalDir = projectDir === GLOBAL_INSTALL_ROOT;
    const lockedSkillIds = isGlobalDir
      ? undefined
      : projectConfig?.config?.skills
          ?.filter(s => s.scope === "global")
          .map(s => s.id);
    const lockedAgentNames = isGlobalDir
      ? undefined
      : projectConfig?.config?.agents
          ?.filter(a => a.scope === "global")
          .map(a => a.name);

    const { waitUntilExit } = render(
      <Wizard
        matrix={sourceResult.matrix}
        version={this.config.version}
        marketplaceLabel={marketplaceLabel}
        logo={ASCII_LOGO}
        initialStep="build"
        initialDomains={projectConfig?.config?.domains}
        initialAgents={projectConfig?.config?.selectedAgents}
        installedSkillIds={currentSkillIds}
        installedSkillConfigs={projectConfig?.config?.skills}
        lockedSkillIds={lockedSkillIds}
        lockedAgentNames={lockedAgentNames}
        projectDir={projectDir}
        startupMessages={startupMessages}
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

    const newSkillIds = result.skills.map(s => s.id);
    const addedSkills = newSkillIds.filter((id) => !currentSkillIds.includes(id));
    const removedSkills = currentSkillIds.filter((id) => !newSkillIds.includes(id));

    const sourceChanges = new Map<SkillId, { from: string; to: string }>();
    const scopeChanges = new Map<SkillId, { from: "project" | "global"; to: "project" | "global" }>();
    if (projectConfig?.config?.skills) {
      for (const newSkill of result.skills) {
        const oldSkill = projectConfig.config.skills.find(s => s.id === newSkill.id);
        if (oldSkill && oldSkill.source !== newSkill.source) {
          sourceChanges.set(newSkill.id, {
            from: oldSkill.source,
            to: newSkill.source,
          });
        }
        if (oldSkill && oldSkill.scope !== newSkill.scope) {
          scopeChanges.set(newSkill.id, {
            from: oldSkill.scope,
            to: newSkill.scope,
          });
        }
      }
    }

    const hasSourceChanges = sourceChanges.size > 0;
    const hasScopeChanges = scopeChanges.size > 0;
    const hasSkillChanges = addedSkills.length > 0 || removedSkills.length > 0;

    if (!hasSkillChanges && !hasSourceChanges && !hasScopeChanges) {
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
    for (const [skillId, change] of scopeChanges) {
      const fromLabel = change.from === "global" ? "[G]" : "[P]";
      const toLabel = change.to === "global" ? "[G]" : "[P]";
      this.log(`  ~ ${skillId} (${fromLabel} \u2192 ${toLabel})`);
    }
    this.log("");

    // Handle per-skill mode migrations (local <-> plugin)
    const oldSkills = projectConfig?.config?.skills ?? [];
    const migrationPlan = detectMigrations(oldSkills, result.skills);
    const hasMigrations = migrationPlan.toLocal.length > 0 || migrationPlan.toPlugin.length > 0;

    if (hasMigrations) {
      if (migrationPlan.toLocal.length > 0) {
        this.log(`Switching ${migrationPlan.toLocal.length} skill(s) to local:`);
        for (const migration of migrationPlan.toLocal) {
          this.log(`  - ${migration.id}`);
        }
      }
      if (migrationPlan.toPlugin.length > 0) {
        this.log(`Switching ${migrationPlan.toPlugin.length} skill(s) to plugin:`);
        for (const migration of migrationPlan.toPlugin) {
          this.log(`  - ${migration.id}`);
        }
      }

      const migrationResult = await executeMigration(
        migrationPlan,
        projectDir,
        sourceResult,
      );

      for (const warning of migrationResult.warnings) {
        this.warn(warning);
      }
    }

    const migratedSkillIds = new Set([
      ...migrationPlan.toLocal.map(m => m.id),
      ...migrationPlan.toPlugin.map(m => m.id),
    ]);

    // Handle scope migrations (P→G or G→P) for local-mode skills
    for (const [skillId, change] of scopeChanges) {
      const skillConfig = result.skills.find(s => s.id === skillId);
      if (skillConfig?.source === "local") {
        await migrateLocalSkillScope(skillId, change.from, projectDir);
      } else if (sourceResult.marketplace && skillConfig) {
        // Plugin-mode scope change: uninstall from old scope, install to new scope
        const oldPluginScope = change.from === "global" ? "user" : "project";
        const newPluginScope = change.to === "global" ? "user" : "project";
        try {
          await claudePluginUninstall(skillId, oldPluginScope, projectDir);
          const pluginRef = `${skillId}@${sourceResult.marketplace}`;
          await claudePluginInstall(pluginRef, newPluginScope, projectDir);
        } catch (error) {
          this.warn(`Failed to migrate plugin scope for ${skillId}: ${getErrorMessage(error)}`);
        }
      }
    }

    // Handle remaining non-migration source changes (e.g., marketplace A -> marketplace B)
    for (const [skillId, change] of sourceChanges) {
      // Skip skills already handled by mode migration
      if (migratedSkillIds.has(skillId)) {
        continue;
      }
      if (change.from === "local") {
        await deleteLocalSkill(projectDir, skillId);
      }
    }

    if (sourceResult.marketplace) {
      for (const skillId of addedSkills) {
        // Find the skill config to get its scope
        const skillConfig = result.skills.find(s => s.id === skillId);
        if (!skillConfig || skillConfig.source === "local") continue;

        const pluginRef = `${skillId}@${sourceResult.marketplace}`;
        const pluginScope = skillConfig.scope === "global" ? "user" : "project";
        this.log(`Installing plugin: ${pluginRef}...`);
        try {
          await claudePluginInstall(pluginRef, pluginScope, projectDir);
        } catch (error) {
          this.warn(`Failed to install plugin ${pluginRef}: ${getErrorMessage(error)}`);
        }
      }
      for (const skillId of removedSkills) {
        // For removed skills, use old config to determine scope
        const oldSkill = projectConfig?.config?.skills?.find(s => s.id === skillId);
        const pluginScope = oldSkill?.scope === "global" ? "user" : "project";
        this.log(`Uninstalling plugin: ${skillId}...`);
        try {
          await claudePluginUninstall(skillId, pluginScope, projectDir);
        } catch (error) {
          this.warn(`Failed to uninstall plugin ${skillId}: ${getErrorMessage(error)}`);
        }
      }
    }

    // Persist wizard result to config.ts (split by scope when in project context)
    const isGlobalContext = projectDir === GLOBAL_INSTALL_ROOT;
    try {
      const mergeResult = await buildAndMergeConfig(
        result,
        sourceResult,
        projectDir,
        flags.source,
      );

      if (isGlobalContext) {
        // Editing from ~/ — write directly to global config (no import preamble)
        await writeConfigFile(mergeResult.config, installation.configPath);
        verbose(`Updated global config at ${installation.configPath}`);
      } else {
        // Editing from project — split by scope and write to both locations
        const { global: globalConfig, project: projectSplitConfig } =
          splitConfigByScope(mergeResult.config);

        // Write global config to ~/.claude-src/config.ts
        const globalConfigPath = path.join(
          GLOBAL_INSTALL_ROOT,
          CLAUDE_SRC_DIR,
          STANDARD_FILES.CONFIG_TS,
        );
        await writeConfigFile(globalConfig, globalConfigPath);
        verbose(`Updated global config at ${globalConfigPath}`);

        // Write project config with import from global
        await writeConfigFile(projectSplitConfig, installation.configPath, {
          isProjectConfig: true,
        });
        verbose(`Updated project config at ${installation.configPath}`);
      }
    } catch (error) {
      this.warn(`Could not update config: ${getErrorMessage(error)}`);
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
        installMode: deriveInstallMode(result.skills),
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
    if (hasScopeChanges) {
      summaryParts.push(`${scopeChanges.size} scope${scopeChanges.size > 1 ? "s" : ""} changed`);
    }
    this.log(`\n\u2713 Plugin updated! (${summaryParts.join(", ")})\n`);
  }
}
