import os from "os";
import path from "path";

import { Flags } from "@oclif/core";
import { render } from "ink";

import { BaseCommand } from "../base-command.js";
import { Wizard, type WizardResultV2 } from "../components/wizard/wizard.js";
import { CLAUDE_DIR, CLI_BIN_NAME, GLOBAL_INSTALL_ROOT, SOURCE_DISPLAY_NAMES } from "../consts.js";
import {
  detectProject,
  loadSource,
  copyLocalSkills,
  ensureMarketplace,
  installPluginSkills,
  uninstallPluginSkills,
  loadAgentDefs,
  type AgentDefs,
  writeProjectConfig,
  compileAgents,
  discoverInstalledSkills,
} from "../lib/operations/index.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import {
  type Installation,
  detectMigrations,
  executeMigration,
  deriveInstallMode,
} from "../lib/installation/index.js";
import { matrix, getSkillById } from "../lib/matrix/matrix-provider";
import type { SourceLoadResult } from "../lib/loading/index.js";
import { discoverAllPluginSkills } from "../lib/plugins/index.js";
import { deleteLocalSkill, migrateLocalSkillScope } from "../lib/skills/index.js";
import type { SkillId, AgentName, ProjectConfig } from "../types/index.js";
import { claudePluginInstall, claudePluginUninstall } from "../utils/exec.js";
import { getErrorMessage } from "../utils/errors.js";
import { remove } from "../utils/fs.js";
import { type StartupMessage } from "../utils/logger.js";
import { ERROR_MESSAGES, INFO_MESSAGES, STATUS_MESSAGES } from "../utils/messages.js";

function formatSourceDisplayName(sourceName: string): string {
  return SOURCE_DISPLAY_NAMES[sourceName] ?? sourceName;
}

type EditContext = {
  installation: Installation;
  projectConfig: ProjectConfig | null;
  projectDir: string;
  sourceResult: SourceLoadResult;
  startupMessages: StartupMessage[];
  currentSkillIds: SkillId[];
};

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
    const cwd = process.cwd();

    const context = await this.loadContext(flags);
    const result = await this.runEditWizard(context, cwd);
    if (!result) this.error("Cancelled", { exit: EXIT_CODES.CANCELLED });

    this.reportValidationErrors(result);

    const changes = detectConfigChanges(context.projectConfig, result, context.currentSkillIds);
    if (!hasAnyChanges(changes)) {
      this.log(INFO_MESSAGES.NO_CHANGES_MADE);
      this.log("Plugin unchanged\n");
      return;
    }

    this.logChangeSummary(changes);
    const migratedSkillIds = await this.applyMigrations(changes, result, context, cwd);
    await this.applyScopeChanges(changes, result, context, cwd);
    await this.applySourceChanges(changes, result, context, cwd, migratedSkillIds);
    await this.applyPluginChanges(changes, result, context, cwd);
    await this.copyNewLocalSkills(changes, result, context, cwd);
    await this.writeConfigAndCompile(result, context, flags, cwd);
    await this.cleanupStaleAgentFiles(changes, cwd);
    this.logCompletionSummary(changes);
  }

  private async loadContext(flags: { source?: string; refresh: boolean }): Promise<EditContext> {
    const detected = await detectProject();
    if (!detected) {
      this.error(ERROR_MESSAGES.NO_INSTALLATION, {
        exit: EXIT_CODES.ERROR,
      });
    }
    const { installation, config: projectConfig } = detected;

    // Use installation.projectDir for reads (loading config, discovering installed skills).
    // Use cwd for writes (config saves, plugin installs, scope migrations, recompilation output)
    // and for the locked-items check (determining whether global items are read-only).
    const projectDir = installation.projectDir;

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

      const sourceInfo = sourceResult.isLocal ? "local" : sourceResult.sourceConfig.sourceOrigin;
      startupMessages.push({
        level: "info",
        text: `Loaded ${Object.keys(matrix.skills).length} skills (${sourceInfo})`,
      });
    } catch (error) {
      this.handleError(error);
    }

    let currentSkillIds: SkillId[];
    try {
      const discoveredSkills = await discoverAllPluginSkills(projectDir);
      // Boundary cast: discoverAllPluginSkills keys are skill IDs from frontmatter
      const pluginSkillIds = Object.keys(discoveredSkills) as SkillId[];

      // Merge plugin-discovered skills with config skills (catches local skills and
      // global-scoped plugins that discoverAllPluginSkills doesn't find).
      const configSkillIds = projectConfig?.skills?.map((s) => s.id) ?? [];
      const mergedIds = new Set<SkillId>([...pluginSkillIds, ...configSkillIds]);
      currentSkillIds = [...mergedIds];

      startupMessages.push({
        level: "info",
        text: `Found ${currentSkillIds.length} installed skills`,
      });
    } catch (error) {
      this.handleError(error);
    }

    return { installation, projectConfig, projectDir, sourceResult, startupMessages, currentSkillIds };
  }

  private async runEditWizard(
    context: EditContext,
    cwd: string,
  ): Promise<WizardResultV2 | null> {
    const { projectConfig, projectDir, currentSkillIds } = context;

    let wizardResult: WizardResultV2 | null = null;

    // D9: In project context, existing global items are read-only (locked).
    // When editing from ~/ (global context), nothing is locked.
    // Uses cwd (not projectDir) so that global items are correctly locked
    // even when detectInstallation() fell back to the global installation.
    const isGlobalDir = cwd === GLOBAL_INSTALL_ROOT;
    const lockedSkillIds = isGlobalDir
      ? undefined
      : projectConfig?.skills?.filter((s) => s.scope === "global").map((s) => s.id);
    const lockedAgentNames = isGlobalDir
      ? undefined
      : projectConfig?.agents?.filter((a) => a.scope === "global").map((a) => a.name);

    const { waitUntilExit } = render(
      <Wizard
        version={this.config.version}
        initialStep="build"
        initialDomains={projectConfig?.domains}
        initialAgents={projectConfig?.selectedAgents}
        installedSkillIds={currentSkillIds}
        installedSkillConfigs={projectConfig?.skills}
        lockedSkillIds={lockedSkillIds}
        installedAgentConfigs={projectConfig?.agents}
        lockedAgentNames={lockedAgentNames}
        isEditingFromGlobalScope={isGlobalDir}
        projectDir={projectDir}
        startupMessages={context.startupMessages}
        onComplete={(result) => {
          wizardResult = result;
        }}
        onCancel={() => {
          this.log("\nEdit cancelled");
        }}
      />,
    );

    await waitUntilExit();

    // TypeScript can't track that onComplete callback mutates wizardResult before waitUntilExit resolves
    const result = wizardResult as WizardResultV2 | null;

    if (!result || result.cancelled) return null;
    return result;
  }

  private reportValidationErrors(result: WizardResultV2): void {
    if (result.validation.errors.length > 0) {
      for (const err of result.validation.errors) {
        this.warn(err.message);
      }
    }
  }

  private logChangeSummary(changes: ConfigChanges): void {
    const {
      addedSkills,
      removedSkills,
      addedAgents,
      removedAgents,
      sourceChanges,
      scopeChanges,
      agentScopeChanges,
    } = changes;

    this.log("\nChanges:");
    for (const skillId of addedSkills) {
      this.log(`  + ${getSkillById(skillId).displayName}`);
    }
    for (const skillId of removedSkills) {
      const skill = matrix.skills[skillId];
      this.log(`  - ${skill?.displayName ?? skillId}`);
    }
    for (const agentName of addedAgents) {
      this.log(`  + ${agentName} (agent)`);
    }
    for (const agentName of removedAgents) {
      this.log(`  - ${agentName} (agent)`);
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
    for (const [agentName, change] of agentScopeChanges) {
      const fromLabel = change.from === "global" ? "[G]" : "[P]";
      const toLabel = change.to === "global" ? "[G]" : "[P]";
      this.log(`  ~ ${agentName} (${fromLabel} \u2192 ${toLabel})`);
    }
    this.log("");
  }

  private async applyMigrations(
    _changes: ConfigChanges,
    result: WizardResultV2,
    context: EditContext,
    cwd: string,
  ): Promise<Set<SkillId>> {
    const oldSkills = context.projectConfig?.skills ?? [];
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

      const migrationResult = await executeMigration(migrationPlan, cwd, context.sourceResult);

      for (const warning of migrationResult.warnings) {
        this.warn(warning);
      }
    }

    return new Set([
      ...migrationPlan.toLocal.map((m) => m.id),
      ...migrationPlan.toPlugin.map((m) => m.id),
    ]);
  }

  private async applyScopeChanges(
    changes: ConfigChanges,
    result: WizardResultV2,
    context: EditContext,
    cwd: string,
  ): Promise<void> {
    const { scopeChanges } = changes;

    // Handle scope migrations (P->G or G->P) for local-mode skills
    for (const [skillId, change] of scopeChanges) {
      const skillConfig = result.skills.find((s) => s.id === skillId);
      if (skillConfig?.source === "local") {
        await migrateLocalSkillScope(skillId, change.from, cwd);
      }
    }

    // Handle scope migrations for plugin-mode skills
    if (context.sourceResult.marketplace && scopeChanges.size > 0) {
      const pluginScopeResult = await migratePluginSkillScopes(
        scopeChanges,
        result.skills,
        context.sourceResult.marketplace,
        cwd,
      );
      for (const item of pluginScopeResult.failed) {
        this.warn(`Failed to migrate plugin scope for ${item.id}: ${item.error}`);
      }
    }
  }

  private async applySourceChanges(
    changes: ConfigChanges,
    _result: WizardResultV2,
    context: EditContext,
    cwd: string,
    migratedSkillIds: Set<SkillId>,
  ): Promise<void> {
    const { sourceChanges } = changes;

    // Handle remaining non-migration source changes (e.g., marketplace A -> marketplace B)
    for (const [skillId, change] of sourceChanges) {
      // Skip skills already handled by mode migration
      if (migratedSkillIds.has(skillId)) {
        continue;
      }
      if (change.from === "local") {
        const oldSkill = context.projectConfig?.skills?.find((s) => s.id === skillId);
        const deleteDir = oldSkill?.scope === "global" ? os.homedir() : cwd;
        await deleteLocalSkill(deleteDir, skillId);
      }
    }
  }

  private async applyPluginChanges(
    changes: ConfigChanges,
    result: WizardResultV2,
    context: EditContext,
    cwd: string,
  ): Promise<void> {
    const { addedSkills, removedSkills } = changes;

    if (context.sourceResult.marketplace) {
      const mpResult = await ensureMarketplace(context.sourceResult);
      if (mpResult.registered) {
        this.log(`Registered marketplace: ${mpResult.marketplace}`);
      }

      const addedPluginSkills = result.skills.filter(
        (s) => addedSkills.includes(s.id) && s.source !== "local",
      );
      if (addedPluginSkills.length > 0) {
        const pluginResult = await installPluginSkills(
          addedPluginSkills,
          context.sourceResult.marketplace,
          cwd,
        );
        for (const item of pluginResult.installed) {
          this.log(`Installing plugin: ${item.ref}...`);
        }
        for (const item of pluginResult.failed) {
          this.warn(`Failed to install plugin ${item.id}: ${item.error}`);
        }
      }

      if (removedSkills.length > 0) {
        const uninstallResult = await uninstallPluginSkills(
          removedSkills,
          context.projectConfig?.skills ?? [],
          cwd,
        );
        for (const id of uninstallResult.uninstalled) {
          this.log(`Uninstalling plugin: ${id}...`);
        }
        for (const item of uninstallResult.failed) {
          this.warn(`Failed to uninstall plugin ${item.id}: ${item.error}`);
        }
      }
    }
  }

  private async copyNewLocalSkills(
    changes: ConfigChanges,
    result: WizardResultV2,
    context: EditContext,
    cwd: string,
  ): Promise<void> {
    const { addedSkills } = changes;

    // Copy newly added local-source skills to .claude/skills/ (split by scope)
    const addedLocalSkills = result.skills.filter(
      (s) => addedSkills.includes(s.id) && s.source === "local",
    );

    if (addedLocalSkills.length > 0) {
      const copyResult = await copyLocalSkills(addedLocalSkills, cwd, context.sourceResult);
      this.log(`Copied ${copyResult.totalCopied} local skill(s) to .claude/skills/`);
    }
  }

  private async writeConfigAndCompile(
    result: WizardResultV2,
    context: EditContext,
    flags: { source?: string; refresh: boolean; "agent-source"?: string },
    cwd: string,
  ): Promise<void> {
    // Load agent definitions — needed for both config-types.ts and recompilation
    let agentDefsResult: AgentDefs;
    this.log(
      flags["agent-source"]
        ? STATUS_MESSAGES.FETCHING_AGENT_PARTIALS
        : STATUS_MESSAGES.LOADING_AGENT_PARTIALS,
    );
    try {
      agentDefsResult = await loadAgentDefs(flags["agent-source"], {
        forceRefresh: flags.refresh,
      });
      this.log(flags["agent-source"] ? "✓ Agent partials fetched\n" : "✓ Agent partials loaded\n");
    } catch (error) {
      this.handleError(error);
    }

    // Persist wizard result to config.ts and config-types.ts (split by scope when in project context)
    try {
      await writeProjectConfig({
        wizardResult: result,
        sourceResult: context.sourceResult,
        projectDir: cwd,
        sourceFlag: flags.source,
        agents: agentDefsResult.agents,
      });
    } catch (error) {
      this.warn(`Could not update config: ${getErrorMessage(error)}`);
    }

    this.log(STATUS_MESSAGES.RECOMPILING_AGENTS);
    try {
      const agentScopeMap = new Map(result.agentConfigs.map((a) => [a.name, a.scope] as const));
      const { allSkills } = await discoverInstalledSkills(cwd);
      const compilationResult = await compileAgents({
        projectDir: cwd,
        sourcePath: agentDefsResult.sourcePath,
        skills: allSkills,
        pluginDir: cwd,
        outputDir: path.join(cwd, CLAUDE_DIR, "agents"),
        installMode: deriveInstallMode(result.skills),
        agentScopeMap,
      });

      if (compilationResult.failed.length > 0) {
        this.log(
          `✓ Recompiled ${compilationResult.compiled.length} agents (${compilationResult.failed.length} failed)\n`,
        );
        for (const warning of compilationResult.warnings) {
          this.warn(warning);
        }
      } else if (compilationResult.compiled.length > 0) {
        this.log(`✓ Recompiled ${compilationResult.compiled.length} agents\n`);
      } else {
        this.log("✓ No agents to recompile\n");
      }
    } catch (error) {
      this.warn(`Agent recompilation failed: ${getErrorMessage(error)}`);
      this.log(`You can manually recompile with '${CLI_BIN_NAME} compile'.\n`);
    }
  }

  private async cleanupStaleAgentFiles(changes: ConfigChanges, cwd: string): Promise<void> {
    const { agentScopeChanges } = changes;

    // Clean up old agent .md files after scope changes.
    // Recompilation wrote the new file to the correct scope directory;
    // now delete the stale copy from the old scope directory.
    for (const [agentName, change] of agentScopeChanges) {
      const oldBaseDir = change.from === "global" ? os.homedir() : cwd;
      const oldAgentPath = path.join(oldBaseDir, CLAUDE_DIR, "agents", `${agentName}.md`);
      try {
        await remove(oldAgentPath);
      } catch (error) {
        this.warn(`Could not remove old agent file ${oldAgentPath}: ${getErrorMessage(error)}`);
      }
    }
  }

  private logCompletionSummary(changes: ConfigChanges): void {
    const {
      addedSkills,
      removedSkills,
      addedAgents,
      removedAgents,
      sourceChanges,
      scopeChanges,
      agentScopeChanges,
    } = changes;

    const hasAgentChanges = addedAgents.length > 0 || removedAgents.length > 0;
    const hasSourceChanges = sourceChanges.size > 0;
    const hasScopeChanges = scopeChanges.size > 0;
    const hasAgentScopeChanges = agentScopeChanges.size > 0;

    const summaryParts = [`${addedSkills.length} added`, `${removedSkills.length} removed`];
    if (hasAgentChanges) {
      summaryParts.push(
        `${addedAgents.length} agent${addedAgents.length !== 1 ? "s" : ""} added, ${removedAgents.length} agent${removedAgents.length !== 1 ? "s" : ""} removed`,
      );
    }
    if (hasSourceChanges) {
      summaryParts.push(`${sourceChanges.size} source${sourceChanges.size > 1 ? "s" : ""} changed`);
    }
    if (hasScopeChanges || hasAgentScopeChanges) {
      const totalScopeChanges = scopeChanges.size + agentScopeChanges.size;
      summaryParts.push(`${totalScopeChanges} scope${totalScopeChanges > 1 ? "s" : ""} changed`);
    }
    this.log(`\n\u2713 Plugin updated! (${summaryParts.join(", ")})\n`);
  }
}

type ConfigChanges = {
  addedSkills: SkillId[];
  removedSkills: SkillId[];
  addedAgents: AgentName[];
  removedAgents: AgentName[];
  sourceChanges: Map<SkillId, { from: string; to: string }>;
  scopeChanges: Map<SkillId, { from: "project" | "global"; to: "project" | "global" }>;
  agentScopeChanges: Map<AgentName, { from: "project" | "global"; to: "project" | "global" }>;
};

function detectConfigChanges(
  oldConfig: ProjectConfig | null,
  wizardResult: WizardResultV2,
  currentSkillIds: SkillId[],
): ConfigChanges {
  const newSkillIds = wizardResult.skills.map((s) => s.id);
  const addedSkills = newSkillIds.filter((id) => !currentSkillIds.includes(id));
  const removedSkills = currentSkillIds.filter((id) => !newSkillIds.includes(id));

  const oldAgentNames = oldConfig?.agents?.map((a) => a.name) ?? [];
  const newAgentNames = wizardResult.agentConfigs.map((a) => a.name);
  const addedAgents = newAgentNames.filter((name) => !oldAgentNames.includes(name));
  const removedAgents = oldAgentNames.filter((name) => !newAgentNames.includes(name));

  const sourceChanges = new Map<SkillId, { from: string; to: string }>();
  const scopeChanges = new Map<SkillId, { from: "project" | "global"; to: "project" | "global" }>();
  if (oldConfig?.skills) {
    for (const newSkill of wizardResult.skills) {
      const oldSkill = oldConfig.skills.find((s) => s.id === newSkill.id);
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

  const agentScopeChanges = new Map<
    AgentName,
    { from: "project" | "global"; to: "project" | "global" }
  >();
  if (oldConfig?.agents) {
    for (const newAgent of wizardResult.agentConfigs) {
      const oldAgent = oldConfig.agents.find((a) => a.name === newAgent.name);
      if (oldAgent && oldAgent.scope !== newAgent.scope) {
        agentScopeChanges.set(newAgent.name, {
          from: oldAgent.scope,
          to: newAgent.scope,
        });
      }
    }
  }

  return {
    addedSkills,
    removedSkills,
    addedAgents,
    removedAgents,
    sourceChanges,
    scopeChanges,
    agentScopeChanges,
  };
}

function hasAnyChanges(changes: ConfigChanges): boolean {
  return (
    changes.addedSkills.length > 0 ||
    changes.removedSkills.length > 0 ||
    changes.addedAgents.length > 0 ||
    changes.removedAgents.length > 0 ||
    changes.sourceChanges.size > 0 ||
    changes.scopeChanges.size > 0 ||
    changes.agentScopeChanges.size > 0
  );
}

type PluginScopeMigrationResult = {
  migrated: SkillId[];
  failed: Array<{ id: SkillId; error: string }>;
};

async function migratePluginSkillScopes(
  scopeChanges: Map<SkillId, { from: "project" | "global"; to: "project" | "global" }>,
  skills: Array<{ id: SkillId; source: string }>,
  marketplace: string,
  projectDir: string,
): Promise<PluginScopeMigrationResult> {
  const migrated: SkillId[] = [];
  const failed: PluginScopeMigrationResult["failed"] = [];

  for (const [skillId, change] of scopeChanges) {
    const skillConfig = skills.find((s) => s.id === skillId);
    if (!skillConfig || skillConfig.source === "local") {
      continue;
    }

    const oldPluginScope = change.from === "global" ? "user" : "project";
    const newPluginScope = change.to === "global" ? "user" : "project";
    const pluginRef = `${skillId}@${marketplace}`;

    try {
      await claudePluginUninstall(skillId, oldPluginScope, projectDir);
      await claudePluginInstall(pluginRef, newPluginScope, projectDir);
      migrated.push(skillId);
    } catch (error) {
      failed.push({ id: skillId, error: getErrorMessage(error) });
    }
  }

  return { migrated, failed };
}
