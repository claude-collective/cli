import { Flags } from "@oclif/core";
import os from "os";
import { BaseCommand } from "../base-command";
import { setVerbose, verbose } from "../utils/logger";
import {
  detectBothInstallations,
  loadAgentDefs,
  compileAgents,
  discoverInstalledSkills,
  type DiscoveredSkills,
} from "../lib/operations";
import { resolveSource } from "../lib/configuration";
import { CLI_BIN_NAME } from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";
import { ERROR_MESSAGES, STATUS_MESSAGES, INFO_MESSAGES } from "../utils/messages";
import { type Installation } from "../lib/installation";

export default class Compile extends BaseCommand {
  static summary = "Compile agents using local skills and agent definitions";

  static description =
    "Compile agents with resolved skill references. Compiles to the Claude plugin directory.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --verbose",
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    verbose: Flags.boolean({
      char: "v",
      description: "Enable verbose logging",
      default: false,
    }),
    "agent-source": Flags.string({
      description: "Remote agent partials source (default: local CLI)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Compile);

    setVerbose(flags.verbose);

    const cwd = process.cwd();
    const homeDir = os.homedir();

    const {
      global: globalInstallation,
      project: projectInstallation,
      hasBoth: hasBothScopes,
    } = await detectBothInstallations(cwd);

    if (!globalInstallation && !projectInstallation) {
      this.error(ERROR_MESSAGES.NO_INSTALLATION, {
        exit: EXIT_CODES.ERROR,
      });
    }

    // Resolve source
    this.log(STATUS_MESSAGES.RESOLVING_SOURCE);
    try {
      const sourceConfig = await resolveSource(flags.source);
      this.log(`Source: ${sourceConfig.sourceOrigin}`);
    } catch (error) {
      this.log(ERROR_MESSAGES.FAILED_RESOLVE_SOURCE);
      this.handleError(error);
    }

    // Load agent definitions
    this.log(
      flags["agent-source"]
        ? STATUS_MESSAGES.FETCHING_AGENT_PARTIALS
        : STATUS_MESSAGES.LOADING_AGENT_PARTIALS,
    );
    let agentDefs;
    try {
      const defs = await loadAgentDefs(flags["agent-source"], { projectDir: cwd });
      this.log(flags["agent-source"] ? "Agent partials fetched" : "Agent partials loaded");
      verbose(`  Agents: ${defs.agentSourcePaths.agentsDir}`);
      verbose(`  Templates: ${defs.agentSourcePaths.templatesDir}`);
      agentDefs = defs;
    } catch (error) {
      this.log(ERROR_MESSAGES.FAILED_LOAD_AGENT_PARTIALS);
      return this.handleError(error);
    }

    let totalPassesWithSkills = 0;

    // When both installations exist, filter each pass to its own scope to prevent
    // the project pass from overwriting global agents with zero-skill versions
    // (the project config's stack only has project agent entries).
    if (globalInstallation) {
      const hadSkills = await this.runCompilePass({
        label: "Global",
        projectDir: homeDir,
        installation: globalInstallation,
        sourcePath: agentDefs.sourcePath,
        scopeFilter: hasBothScopes ? "global" : undefined,
      });
      if (hadSkills) totalPassesWithSkills++;
    }

    if (projectInstallation) {
      const hadSkills = await this.runCompilePass({
        label: "Project",
        projectDir: cwd,
        installation: projectInstallation,
        sourcePath: agentDefs.sourcePath,
        scopeFilter: hasBothScopes ? "project" : undefined,
      });
      if (hadSkills) totalPassesWithSkills++;
    }

    if (totalPassesWithSkills === 0) {
      this.error(
        `No skills found. Add skills with '${CLI_BIN_NAME} add <skill>' or create in .claude/skills/.`,
        { exit: EXIT_CODES.ERROR },
      );
    }
  }

  private async discoverAllSkills(projectDir: string): Promise<DiscoveredSkills> {
    this.log(STATUS_MESSAGES.DISCOVERING_SKILLS);
    const result = await discoverInstalledSkills(projectDir);

    if (result.totalSkillCount === 0) {
      return result;
    }

    if (result.pluginSkillCount > 0 && result.totalSkillCount > result.pluginSkillCount) {
      const localCount = result.totalSkillCount - result.pluginSkillCount;
      this.log(
        `Discovered ${result.totalSkillCount} skills (${result.pluginSkillCount} from plugins, ${localCount} local)`,
      );
    } else if (result.pluginSkillCount > 0) {
      this.log(`Discovered ${result.pluginSkillCount} skills from plugins`);
    } else {
      this.log(`Discovered ${result.totalSkillCount} local skills`);
    }

    return result;
  }

  private async runCompilePass(params: {
    label: string;
    projectDir: string;
    installation: Installation;
    sourcePath: string;
    scopeFilter?: "project" | "global";
  }): Promise<boolean> {
    const { label, projectDir, installation, sourcePath, scopeFilter } = params;

    this.log("");
    this.log(`Compiling ${label.toLowerCase()} agents...`);
    this.log("");

    verbose(`  Project: ${projectDir}`);
    verbose(`  Agents: ${installation.agentsDir}`);

    const { allSkills, totalSkillCount } = await this.discoverAllSkills(projectDir);

    if (totalSkillCount === 0) {
      this.log(`No skills found for ${label.toLowerCase()} pass, skipping`);
      return false;
    }

    this.log(STATUS_MESSAGES.RECOMPILING_AGENTS);
    try {
      const recompileResult = await compileAgents({
        projectDir,
        sourcePath,
        skills: allSkills,
        pluginDir: projectDir,
        outputDir: installation.agentsDir,
        scopeFilter,
      });

      if (recompileResult.failed.length > 0) {
        this.log(
          `Recompiled ${recompileResult.compiled.length} ${label.toLowerCase()} agents (${recompileResult.failed.length} failed)`,
        );
        for (const warning of recompileResult.warnings) {
          this.warn(warning);
        }
      } else if (recompileResult.compiled.length > 0) {
        this.log(`Recompiled ${recompileResult.compiled.length} ${label.toLowerCase()} agents`);
      } else {
        this.log(INFO_MESSAGES.NO_AGENTS_TO_RECOMPILE);
      }

      if (recompileResult.compiled.length > 0) {
        verbose(`  Compiled: ${recompileResult.compiled.join(", ")}`);
      }
    } catch (error) {
      this.log(ERROR_MESSAGES.FAILED_COMPILE_AGENTS);
      this.handleError(error);
    }

    this.log("");
    this.logSuccess(`${label} compile complete!`);
    this.log("");

    return true;
  }
}
