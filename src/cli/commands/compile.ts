import { Flags } from "@oclif/core";
import os from "os";
import path from "path";
import { BaseCommand } from "../base-command";
import { setVerbose, verbose, warn } from "../utils/logger";
import { discoverAllPluginSkills } from "../lib/plugins";
import { getAgentDefinitions } from "../lib/agents";
import { resolveSource } from "../lib/configuration";
import { directoryExists, glob, readFile, fileExists } from "../utils/fs";
import { recompileAgents } from "../lib/agents";
import { parseFrontmatter } from "../lib/loading";
import { CLI_BIN_NAME, GLOBAL_INSTALL_ROOT, LOCAL_SKILLS_PATH, STANDARD_FILES } from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";
import { ERROR_MESSAGES, STATUS_MESSAGES, INFO_MESSAGES } from "../utils/messages";
import {
  detectGlobalInstallation,
  detectProjectInstallation,
  type Installation,
} from "../lib/installation";
import type { AgentSourcePaths, SkillDefinition, SkillDefinitionMap, SkillId } from "../types";
import { typedEntries, typedKeys } from "../utils/typed-object";

async function loadSkillsFromDir(skillsDir: string, pathPrefix = ""): Promise<SkillDefinitionMap> {
  const skills: SkillDefinitionMap = {};

  if (!(await directoryExists(skillsDir))) {
    return skills;
  }

  const skillFiles = await glob("**/SKILL.md", skillsDir);

  for (const skillFile of skillFiles) {
    const skillPath = path.join(skillsDir, skillFile);
    const skillDir = path.dirname(skillPath);
    const relativePath = path.relative(skillsDir, skillDir);
    const skillDirName = path.basename(skillDir);

    const metadataPath = path.join(skillDir, STANDARD_FILES.METADATA_YAML);
    if (!(await fileExists(metadataPath))) {
      const displayPath = pathPrefix ? `${pathPrefix}/${relativePath}/` : `${relativePath}/`;
      warn(
        `Skill '${skillDirName}' in '${displayPath}' is missing ${STANDARD_FILES.METADATA_YAML} — skipped. Add ${STANDARD_FILES.METADATA_YAML} to register it with the CLI.`,
      );
      continue;
    }

    try {
      const content = await readFile(skillPath);
      const frontmatter = parseFrontmatter(content, skillPath);

      if (!frontmatter?.name) {
        warn(`Skipping skill in '${skillDirName}': missing or invalid frontmatter name`);
        continue;
      }

      const canonicalId = frontmatter.name;

      const skill: SkillDefinition = {
        id: canonicalId,
        path: pathPrefix ? `${pathPrefix}/${relativePath}/` : `${relativePath}/`,
        description: frontmatter?.description || "",
      };

      skills[canonicalId] = skill;
      verbose(`  Loaded skill: ${canonicalId}`);
    } catch (error) {
      verbose(`  Failed to load skill: ${skillFile} - ${error}`);
    }
  }

  return skills;
}

async function discoverLocalProjectSkills(projectDir: string): Promise<SkillDefinitionMap> {
  const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
  return loadSkillsFromDir(localSkillsDir, LOCAL_SKILLS_PATH);
}

/** Later sources take precedence over earlier ones */
function mergeSkills(...skillSources: SkillDefinitionMap[]): SkillDefinitionMap {
  const merged: SkillDefinitionMap = {};

  for (const source of skillSources) {
    for (const [id, skill] of typedEntries<SkillId, SkillDefinition | undefined>(source)) {
      if (skill) {
        merged[id] = skill;
      }
    }
  }

  return merged;
}

type CompileFlags = {
  source?: string;
  "agent-source"?: string;
  verbose: boolean;
};

type DiscoveredSkills = {
  allSkills: SkillDefinitionMap;
  totalSkillCount: number;
};

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

    const globalInstallation = await detectGlobalInstallation();
    // Skip project detection when cwd is home directory to avoid double-compile
    const projectInstallation = cwd === homeDir ? null : await detectProjectInstallation(cwd);

    if (!globalInstallation && !projectInstallation) {
      this.error(ERROR_MESSAGES.NO_INSTALLATION, {
        exit: EXIT_CODES.ERROR,
      });
    }

    await this.resolveSourceForCompile(flags);
    const agentDefs = await this.loadAgentDefsForCompile(flags);

    let totalPassesWithSkills = 0;

    if (globalInstallation) {
      const hadSkills = await this.runCompilePass({
        label: "Global",
        projectDir: homeDir,
        installation: globalInstallation,
        agentDefs,
        flags,
      });
      if (hadSkills) totalPassesWithSkills++;
    }

    if (projectInstallation) {
      const hadSkills = await this.runCompilePass({
        label: "Project",
        projectDir: cwd,
        installation: projectInstallation,
        agentDefs,
        flags,
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

  private async discoverAllSkills(projectDir: string = process.cwd()): Promise<DiscoveredSkills> {
    this.log(STATUS_MESSAGES.DISCOVERING_SKILLS);

    const pluginSkills = await discoverAllPluginSkills(projectDir);
    const pluginSkillCount = typedKeys<SkillId>(pluginSkills).length;
    verbose(`  Found ${pluginSkillCount} skills from installed plugins`);

    // Load global local skills (skip if projectDir is already the home directory to avoid double-loading)
    const isGlobalProject = projectDir === GLOBAL_INSTALL_ROOT;
    const globalLocalSkillsDir = path.join(GLOBAL_INSTALL_ROOT, LOCAL_SKILLS_PATH);
    const globalLocalSkills = isGlobalProject
      ? {}
      : await loadSkillsFromDir(globalLocalSkillsDir, LOCAL_SKILLS_PATH);
    const globalLocalSkillCount = typedKeys<SkillId>(globalLocalSkills).length;
    if (globalLocalSkillCount > 0) {
      verbose(`  Found ${globalLocalSkillCount} global local skills from ~/.claude/skills/`);
    }

    const localSkills = await discoverLocalProjectSkills(projectDir);
    const localSkillCount = typedKeys<SkillId>(localSkills).length;
    verbose(`  Found ${localSkillCount} local skills from .claude/skills/`);

    // Global skills loaded first, project skills second — project wins on conflict (later sources override)
    const allSkills = mergeSkills(pluginSkills, globalLocalSkills, localSkills);
    const totalSkillCount = typedKeys<SkillId>(allSkills).length;

    if (totalSkillCount === 0) {
      return { allSkills, totalSkillCount };
    }

    if (pluginSkillCount > 0 && totalSkillCount > pluginSkillCount) {
      const localCount = totalSkillCount - pluginSkillCount;
      this.log(
        `Discovered ${totalSkillCount} skills (${pluginSkillCount} from plugins, ${localCount} local)`,
      );
    } else if (pluginSkillCount > 0) {
      this.log(`Discovered ${pluginSkillCount} skills from plugins`);
    } else {
      this.log(`Discovered ${totalSkillCount} local skills`);
    }

    return { allSkills, totalSkillCount };
  }

  private async runCompilePass(params: {
    label: string;
    projectDir: string;
    installation: Installation;
    agentDefs: AgentSourcePaths;
    flags: CompileFlags;
  }): Promise<boolean> {
    const { label, projectDir, installation, agentDefs, flags } = params;

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
      const recompileResult = await recompileAgents({
        pluginDir: projectDir,
        sourcePath: agentDefs.sourcePath,
        skills: allSkills,
        projectDir,
        outputDir: installation.agentsDir,
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

  private async resolveSourceForCompile(flags: CompileFlags): Promise<void> {
    this.log(STATUS_MESSAGES.RESOLVING_SOURCE);
    try {
      const sourceConfig = await resolveSource(flags.source);
      this.log(`Source: ${sourceConfig.sourceOrigin}`);
    } catch (error) {
      this.log(ERROR_MESSAGES.FAILED_RESOLVE_SOURCE);
      this.handleError(error);
    }
  }

  private async loadAgentDefsForCompile(flags: CompileFlags): Promise<AgentSourcePaths> {
    const projectDir = process.cwd();
    this.log(
      flags["agent-source"]
        ? STATUS_MESSAGES.FETCHING_AGENT_PARTIALS
        : STATUS_MESSAGES.LOADING_AGENT_PARTIALS,
    );

    try {
      const agentDefs = await getAgentDefinitions(flags["agent-source"], {
        projectDir,
      });
      this.log(flags["agent-source"] ? "Agent partials fetched" : "Agent partials loaded");
      verbose(`  Agents: ${agentDefs.agentsDir}`);
      verbose(`  Templates: ${agentDefs.templatesDir}`);
      return agentDefs;
    } catch (error) {
      this.log(ERROR_MESSAGES.FAILED_LOAD_AGENT_PARTIALS);
      return this.handleError(error);
    }
  }
}
