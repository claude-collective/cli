import { Flags } from "@oclif/core";
import path from "path";
import { parse as parseYaml } from "yaml";
import { BaseCommand } from "../base-command";
import { setVerbose, verbose } from "../utils/logger";
import {
  getCollectivePluginDir,
  getPluginAgentsDir,
  getPluginManifestPath,
  getProjectPluginsDir,
} from "../lib/plugins";
import { getAgentDefinitions } from "../lib/agents";
import { resolveSource } from "../lib/configuration";
import {
  directoryExists,
  ensureDir,
  glob,
  readFile,
  readFileSafe,
  fileExists,
  listDirectories,
} from "../utils/fs";
import { recompileAgents } from "../lib/agents";
import { loadPluginSkills, parseFrontmatter } from "../lib/loading";
import {
  DEFAULT_PLUGIN_NAME,
  LOCAL_SKILLS_PATH,
  MAX_PLUGIN_FILE_SIZE,
  STANDARD_FILES,
} from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  STATUS_MESSAGES,
  DRY_RUN_MESSAGES,
  INFO_MESSAGES,
} from "../utils/messages";
import { detectInstallation } from "../lib/installation";
import type {
  AgentSourcePaths,
  PluginManifest,
  ProjectConfig,
  SkillDefinition,
  SkillId,
} from "../types";
import { pluginManifestSchema, projectConfigLoaderSchema } from "../lib/schemas";
import { typedEntries } from "../utils/typed-object";

async function loadSkillsFromDir(
  skillsDir: string,
  pathPrefix = "",
): Promise<Partial<Record<SkillId, SkillDefinition>>> {
  const skills: Partial<Record<SkillId, SkillDefinition>> = {};

  if (!(await directoryExists(skillsDir))) {
    return skills;
  }

  const skillFiles = await glob("**/SKILL.md", skillsDir);

  for (const skillFile of skillFiles) {
    const skillPath = path.join(skillsDir, skillFile);
    const skillDir = path.dirname(skillPath);
    const relativePath = path.relative(skillsDir, skillDir);

    try {
      const content = await readFile(skillPath);
      const frontmatter = parseFrontmatter(content, skillPath);

      const skillName = frontmatter?.name || path.basename(skillDir);
      // Boundary cast: skill name from frontmatter/directory is an untyped string
      const canonicalId = skillName as SkillId;

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

async function discoverPluginSkills(
  projectDir: string,
): Promise<Partial<Record<SkillId, SkillDefinition>>> {
  const allSkills: Partial<Record<SkillId, SkillDefinition>> = {};
  const pluginsDir = getProjectPluginsDir(projectDir);

  if (!(await directoryExists(pluginsDir))) {
    verbose(`No plugins directory found at ${pluginsDir}`);
    return allSkills;
  }

  const pluginDirs = await listDirectories(pluginsDir);

  for (const pluginName of pluginDirs) {
    const pluginDir = path.join(pluginsDir, pluginName);
    const pluginSkillsDir = path.join(pluginDir, "skills");

    if (await directoryExists(pluginSkillsDir)) {
      verbose(`Discovering skills from plugin: ${pluginName}`);
      const pluginSkills = await loadPluginSkills(pluginDir);

      for (const [id, skill] of Object.entries(pluginSkills)) {
        // Boundary cast: loadPluginSkills keys are skill IDs from frontmatter
        allSkills[id as SkillId] = skill;
      }
    }
  }

  return allSkills;
}

async function discoverLocalProjectSkills(
  projectDir: string,
): Promise<Partial<Record<SkillId, SkillDefinition>>> {
  const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
  return loadSkillsFromDir(localSkillsDir, LOCAL_SKILLS_PATH);
}

/** Merge skills from multiple sources. Later sources take precedence. */
function mergeSkills(
  ...skillSources: Partial<Record<SkillId, SkillDefinition>>[]
): Partial<Record<SkillId, SkillDefinition>> {
  const merged: Partial<Record<SkillId, SkillDefinition>> = {};

  for (const source of skillSources) {
    for (const [id, skill] of typedEntries<SkillId, SkillDefinition | undefined>(source)) {
      if (skill) {
        merged[id] = skill;
      }
    }
  }

  return merged;
}

async function readPluginManifest(pluginDir: string): Promise<PluginManifest | null> {
  const manifestPath = getPluginManifestPath(pluginDir);

  if (!(await fileExists(manifestPath))) {
    return null;
  }

  try {
    const content = await readFileSafe(manifestPath, MAX_PLUGIN_FILE_SIZE);
    return pluginManifestSchema.parse(JSON.parse(content));
  } catch {
    return null;
  }
}

type CompileFlags = {
  source?: string;
  "agent-source"?: string;
  refresh: boolean;
  verbose: boolean;
  "dry-run": boolean;
};

type DiscoveredSkills = {
  allSkills: Partial<Record<SkillId, SkillDefinition>>;
  totalSkillCount: number;
};

export default class Compile extends BaseCommand {
  static summary = "Compile agents using local skills and agent definitions";

  static description =
    "Compile agents with resolved skill references. By default, compiles to the Claude plugin directory. Use --output to compile to a custom directory.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --verbose",
    "<%= config.bin %> <%= command.id %> --output ./agents",
    "<%= config.bin %> <%= command.id %> --dry-run",
    "<%= config.bin %> <%= command.id %> --source /path/to/marketplace --refresh",
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
    refresh: Flags.boolean({
      description: "Force refresh from remote sources",
      default: false,
    }),
    output: Flags.string({
      char: "o",
      description: "Output directory for compiled agents (skips plugin mode)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Compile);

    setVerbose(flags.verbose);

    if (flags.output) {
      await this.runCustomOutputCompile({
        ...flags,
        output: flags.output,
      });
      return;
    }

    const installation = await detectInstallation();

    if (!installation) {
      this.error(ERROR_MESSAGES.NO_INSTALLATION, {
        exit: EXIT_CODES.ERROR,
      });
    }

    if (installation.mode === "local") {
      this.log("");
      this.log("Local Mode Compile (auto-detected)");
      this.log("");
      await this.runCustomOutputCompile({
        ...flags,
        output: installation.agentsDir,
      });
    } else {
      await this.runPluginModeCompile(flags);
    }
  }

  private async discoverAllSkills(): Promise<DiscoveredSkills> {
    const projectDir = process.cwd();
    this.log(STATUS_MESSAGES.DISCOVERING_SKILLS);

    const pluginSkills = await discoverPluginSkills(projectDir);
    const pluginSkillCount = Object.keys(pluginSkills).length;
    verbose(`  Found ${pluginSkillCount} skills from installed plugins`);

    const localSkills = await discoverLocalProjectSkills(projectDir);
    const localSkillCount = Object.keys(localSkills).length;
    verbose(`  Found ${localSkillCount} local skills from .claude/skills/`);

    const allSkills = mergeSkills(pluginSkills, localSkills);
    const totalSkillCount = Object.keys(allSkills).length;

    if (totalSkillCount === 0) {
      this.log(ERROR_MESSAGES.NO_SKILLS_FOUND);
      this.error(
        "No skills found. Add skills with 'cc add <skill>' or create in .claude/skills/.",
        { exit: EXIT_CODES.ERROR },
      );
    }

    if (localSkillCount > 0 && pluginSkillCount > 0) {
      this.log(
        `Discovered ${totalSkillCount} skills (${pluginSkillCount} from plugins, ${localSkillCount} local)`,
      );
    } else if (localSkillCount > 0) {
      this.log(`Discovered ${localSkillCount} local skills`);
    } else {
      this.log(`Discovered ${pluginSkillCount} skills from plugins`);
    }

    return { allSkills, totalSkillCount };
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
        forceRefresh: flags.refresh,
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

  private async runPluginModeCompile(flags: CompileFlags): Promise<void> {
    this.log("");
    this.log("Plugin Mode Compile");
    this.log("");

    const pluginDir = getCollectivePluginDir();
    this.log("Finding plugin...");

    if (!(await directoryExists(pluginDir))) {
      this.log("No plugin found");
      this.error("No plugin found. Run 'cc init' first to create a plugin.", {
        exit: EXIT_CODES.ERROR,
      });
    }

    const manifest = await readPluginManifest(pluginDir);
    const pluginName = manifest?.name ?? DEFAULT_PLUGIN_NAME;

    this.log(`Found plugin: ${pluginName}`);
    verbose(`  Path: ${pluginDir}`);

    const configPath = path.join(pluginDir, STANDARD_FILES.CONFIG_YAML);
    const hasConfig = await fileExists(configPath);
    if (hasConfig) {
      try {
        const configContent = await readFile(configPath);
        const parsed = parseYaml(configContent);
        const configResult = projectConfigLoaderSchema.safeParse(parsed);
        if (configResult.success) {
          // Boundary cast: Zod loader schema validates structure; cast narrows passthrough output
          const config = configResult.data as ProjectConfig;
          const agentCount = config.agents?.length ?? 0;
          const stackSkillCount = config.stack
            ? new Set(Object.values(config.stack).flatMap((a) => Object.values(a))).size
            : 0;
          this.log(`Using config.yaml (${agentCount} agents, ${stackSkillCount} skills)`);
          verbose(`  Config: ${configPath}`);
        } else {
          this.warn("config.yaml found but has invalid structure - using defaults");
        }
      } catch {
        this.warn("config.yaml found but could not be parsed - using defaults");
      }
    } else {
      verbose(`  No config.yaml found - using defaults`);
    }

    const { allSkills, totalSkillCount } = await this.discoverAllSkills();
    await this.resolveSourceForCompile(flags);
    const agentDefs = await this.loadAgentDefsForCompile(flags);

    if (flags["dry-run"]) {
      this.log("");
      this.log(`[dry-run] Would compile ${totalSkillCount} skills`);
      this.log(`[dry-run] Would use agent partials from: ${agentDefs.sourcePath}`);
      this.log(`[dry-run] Would output to: ${getPluginAgentsDir(pluginDir)}`);
      this.log(DRY_RUN_MESSAGES.COMPLETE_NO_FILES_WRITTEN);
      this.log("");
      return;
    }

    this.log(STATUS_MESSAGES.RECOMPILING_AGENTS);
    try {
      const recompileResult = await recompileAgents({
        pluginDir,
        sourcePath: agentDefs.sourcePath,
        skills: allSkills,
        projectDir: process.cwd(),
      });

      if (recompileResult.failed.length > 0) {
        this.log(
          `Recompiled ${recompileResult.compiled.length} agents (${recompileResult.failed.length} failed)`,
        );
        for (const warning of recompileResult.warnings) {
          this.warn(warning);
        }
      } else if (recompileResult.compiled.length > 0) {
        this.log(`Recompiled ${recompileResult.compiled.length} agents`);
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
    this.logSuccess(SUCCESS_MESSAGES.PLUGIN_COMPILE_COMPLETE);
    this.log("");
  }

  private async runCustomOutputCompile(flags: CompileFlags & { output: string }): Promise<void> {
    const outputDir = path.resolve(process.cwd(), flags.output);
    this.log("");
    this.log("Custom Output Compile");
    this.log("");
    this.log(`Output directory: ${outputDir}`);
    this.log("");

    const { allSkills, totalSkillCount } = await this.discoverAllSkills();
    await this.resolveSourceForCompile(flags);
    const agentDefs = await this.loadAgentDefsForCompile(flags);

    if (flags["dry-run"]) {
      this.log("");
      this.log(`[dry-run] Would compile agents with ${totalSkillCount} skills`);
      this.log(`[dry-run] Would use agent definitions from: ${agentDefs.sourcePath}`);
      this.log(`[dry-run] Would output to: ${outputDir}`);
      this.log(DRY_RUN_MESSAGES.COMPLETE_NO_FILES_WRITTEN);
      this.log("");
      return;
    }

    const pluginDir = getCollectivePluginDir();

    this.log(STATUS_MESSAGES.COMPILING_AGENTS);
    try {
      await ensureDir(outputDir);

      const recompileResult = await recompileAgents({
        pluginDir,
        sourcePath: agentDefs.sourcePath,
        skills: allSkills,
        outputDir,
        projectDir: process.cwd(),
      });

      if (recompileResult.failed.length > 0) {
        this.log(
          `Compiled ${recompileResult.compiled.length} agents (${recompileResult.failed.length} failed)`,
        );
        for (const warning of recompileResult.warnings) {
          this.warn(warning);
        }
      } else if (recompileResult.compiled.length > 0) {
        this.log(`Compiled ${recompileResult.compiled.length} agents`);
      } else {
        this.log(INFO_MESSAGES.NO_AGENTS_TO_COMPILE);
      }

      if (recompileResult.compiled.length > 0) {
        verbose(`  Compiled: ${recompileResult.compiled.join(", ")}`);
        this.log("");
        this.log("Agents compiled to:");
        this.log(`  ${outputDir}`);
        for (const agentName of recompileResult.compiled) {
          this.log(`    ${agentName}.md`);
        }
      }
    } catch (error) {
      this.log(ERROR_MESSAGES.FAILED_COMPILE_AGENTS);
      this.handleError(error);
    }

    this.log("");
    this.logSuccess(SUCCESS_MESSAGES.CUSTOM_COMPILE_COMPLETE);
    this.log("");
  }
}
