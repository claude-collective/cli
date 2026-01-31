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
} from "../lib/plugin-finder";
import { getAgentDefinitions } from "../lib/agent-fetcher";
import { resolveSource } from "../lib/config";
import {
  directoryExists,
  ensureDir,
  glob,
  readFile,
  fileExists,
  listDirectories,
} from "../utils/fs";
import { recompileAgents } from "../lib/agent-recompiler";
import { loadPluginSkills } from "../lib/loader";
import { LOCAL_SKILLS_PATH } from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";
import type {
  AgentSourcePaths,
  PluginManifest,
  StackConfig,
  SkillDefinition,
} from "../../types";

async function loadSkillsFromDir(
  skillsDir: string,
  pathPrefix: string = "",
): Promise<Record<string, SkillDefinition>> {
  const skills: Record<string, SkillDefinition> = {};

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
      let metadata: Record<string, unknown> = {};

      if (content.startsWith("---")) {
        const endIndex = content.indexOf("---", 3);
        if (endIndex > 0) {
          const yamlContent = content.slice(3, endIndex).trim();
          const lines = yamlContent.split("\n");
          for (const line of lines) {
            const colonIndex = line.indexOf(":");
            if (colonIndex > 0) {
              const key = line.slice(0, colonIndex).trim();
              const value = line.slice(colonIndex + 1).trim();
              metadata[key] = value.replace(/^["']|["']$/g, "");
            }
          }
        }
      }

      const skillName = (metadata.name as string) || path.basename(skillDir);
      const canonicalId = skillName;

      const skill: SkillDefinition = {
        path: pathPrefix
          ? `${pathPrefix}/${relativePath}/`
          : `${relativePath}/`,
        name: skillName,
        description: (metadata.description as string) || "",
        canonicalId,
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
): Promise<Record<string, SkillDefinition>> {
  const allSkills: Record<string, SkillDefinition> = {};
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
        allSkills[id] = skill;
      }
    }
  }

  return allSkills;
}

async function discoverLocalProjectSkills(
  projectDir: string,
): Promise<Record<string, SkillDefinition>> {
  const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
  return loadSkillsFromDir(localSkillsDir, LOCAL_SKILLS_PATH);
}

/** Merge skills from multiple sources. Later sources take precedence. */
function mergeSkills(
  ...skillSources: Record<string, SkillDefinition>[]
): Record<string, SkillDefinition> {
  const merged: Record<string, SkillDefinition> = {};

  for (const source of skillSources) {
    for (const [id, skill] of Object.entries(source)) {
      merged[id] = skill;
    }
  }

  return merged;
}

async function readPluginManifest(
  pluginDir: string,
): Promise<PluginManifest | null> {
  const manifestPath = getPluginManifestPath(pluginDir);

  if (!(await fileExists(manifestPath))) {
    return null;
  }

  try {
    const content = await readFile(manifestPath);
    return JSON.parse(content) as PluginManifest;
  } catch {
    return null;
  }
}

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
    } else {
      await this.runPluginModeCompile(flags);
    }
  }

  private async runPluginModeCompile(flags: {
    source?: string;
    "agent-source"?: string;
    refresh: boolean;
    verbose: boolean;
    "dry-run": boolean;
  }): Promise<void> {
    this.log("");
    this.log("Plugin Mode Compile");
    this.log("");

    // 1. Get the collective plugin directory (always ~/.claude/plugins/claude-collective/)
    const pluginDir = getCollectivePluginDir();
    this.log("Finding plugin...");

    // Check if plugin exists
    if (!(await directoryExists(pluginDir))) {
      this.log("No plugin found");
      this.error("No plugin found. Run 'cc init' first to create a plugin.", {
        exit: EXIT_CODES.ERROR,
      });
    }

    const manifest = await readPluginManifest(pluginDir);
    const pluginName = manifest?.name ?? "claude-collective";

    this.log(`Found plugin: ${pluginName}`);
    verbose(`  Path: ${pluginDir}`);

    const configPath = path.join(pluginDir, "config.yaml");
    const hasConfig = await fileExists(configPath);
    if (hasConfig) {
      try {
        const configContent = await readFile(configPath);
        const config = parseYaml(configContent) as StackConfig;
        const agentCount = config.agents?.length ?? 0;
        const configSkillCount = config.skills?.length ?? 0;
        this.log(
          `Using config.yaml (${agentCount} agents, ${configSkillCount} skills)`,
        );
        verbose(`  Config: ${configPath}`);
      } catch {
        this.warn("config.yaml found but could not be parsed - using defaults");
      }
    } else {
      verbose(`  No config.yaml found - using defaults`);
    }

    const projectDir = process.cwd();
    this.log("Discovering skills...");

    const pluginSkills = await discoverPluginSkills(projectDir);
    const pluginSkillCount = Object.keys(pluginSkills).length;
    verbose(`  Found ${pluginSkillCount} skills from installed plugins`);

    const localSkills = await discoverLocalProjectSkills(projectDir);
    const localSkillCount = Object.keys(localSkills).length;
    verbose(`  Found ${localSkillCount} local skills from .claude/skills/`);

    const allSkills = mergeSkills(pluginSkills, localSkills);
    const totalSkillCount = Object.keys(allSkills).length;

    if (totalSkillCount === 0) {
      this.log("No skills found");
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

    this.log("Resolving marketplace source...");
    let sourceConfig;
    try {
      sourceConfig = await resolveSource(flags.source);
      this.log(`Source: ${sourceConfig.sourceOrigin}`);
    } catch (error) {
      this.log("Failed to resolve source");
      this.error(error instanceof Error ? error.message : String(error), {
        exit: EXIT_CODES.ERROR,
      });
    }

    this.log(
      flags["agent-source"]
        ? "Fetching agent partials..."
        : "Loading agent partials...",
    );
    let agentDefs: AgentSourcePaths;
    try {
      agentDefs = await getAgentDefinitions(flags["agent-source"], {
        forceRefresh: flags.refresh,
      });
      this.log(
        flags["agent-source"]
          ? "Agent partials fetched"
          : "Agent partials loaded",
      );
      verbose(`  Agents: ${agentDefs.agentsDir}`);
      verbose(`  Templates: ${agentDefs.templatesDir}`);
    } catch (error) {
      this.log("Failed to load agent partials");
      this.error(error instanceof Error ? error.message : String(error), {
        exit: EXIT_CODES.ERROR,
      });
    }

    if (flags["dry-run"]) {
      this.log("");
      this.log(`[dry-run] Would compile ${totalSkillCount} skills`);
      this.log(
        `[dry-run] Would use agent partials from: ${agentDefs.sourcePath}`,
      );
      this.log(`[dry-run] Would output to: ${getPluginAgentsDir(pluginDir)}`);
      this.log("[dry-run] Preview complete - no files were written");
      this.log("");
      return;
    }

    this.log("Recompiling agents...");
    try {
      const recompileResult = await recompileAgents({
        pluginDir,
        sourcePath: agentDefs.sourcePath,
        skills: allSkills,
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
        this.log("No agents to recompile");
      }

      if (recompileResult.compiled.length > 0) {
        verbose(`  Compiled: ${recompileResult.compiled.join(", ")}`);
      }
    } catch (error) {
      this.log("Failed to recompile agents");
      this.error(error instanceof Error ? error.message : String(error), {
        exit: EXIT_CODES.ERROR,
      });
    }

    this.log("");
    this.logSuccess("Plugin compile complete!");
    this.log("");
  }

  private async runCustomOutputCompile(flags: {
    source?: string;
    "agent-source"?: string;
    refresh: boolean;
    verbose: boolean;
    output: string;
    "dry-run": boolean;
  }): Promise<void> {
    const outputDir = path.resolve(process.cwd(), flags.output);
    this.log("");
    this.log("Custom Output Compile");
    this.log("");
    this.log(`Output directory: ${outputDir}`);
    this.log("");

    const projectDir = process.cwd();
    this.log("Discovering skills...");

    const pluginSkills = await discoverPluginSkills(projectDir);
    const pluginSkillCount = Object.keys(pluginSkills).length;
    verbose(`  Found ${pluginSkillCount} skills from installed plugins`);

    const localSkills = await discoverLocalProjectSkills(projectDir);
    const localSkillCount = Object.keys(localSkills).length;
    verbose(`  Found ${localSkillCount} local skills from .claude/skills/`);

    const allSkills = mergeSkills(pluginSkills, localSkills);
    const totalSkillCount = Object.keys(allSkills).length;

    if (totalSkillCount === 0) {
      this.log("No skills found");
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

    this.log("Resolving source...");
    let sourceConfig;
    try {
      sourceConfig = await resolveSource(flags.source);
      this.log(`Source: ${sourceConfig.sourceOrigin}`);
    } catch (error) {
      this.log("Failed to resolve source");
      this.error(error instanceof Error ? error.message : String(error), {
        exit: EXIT_CODES.ERROR,
      });
    }

    this.log(
      flags["agent-source"]
        ? "Fetching agent partials..."
        : "Loading agent partials...",
    );
    let agentDefs: AgentSourcePaths;
    try {
      agentDefs = await getAgentDefinitions(flags["agent-source"], {
        forceRefresh: flags.refresh,
      });
      this.log(
        flags["agent-source"]
          ? "Agent partials fetched"
          : "Agent partials loaded",
      );
      verbose(`  Agents: ${agentDefs.agentsDir}`);
      verbose(`  Templates: ${agentDefs.templatesDir}`);
    } catch (error) {
      this.log("Failed to load agent partials");
      this.error(error instanceof Error ? error.message : String(error), {
        exit: EXIT_CODES.ERROR,
      });
    }

    if (flags["dry-run"]) {
      this.log("");
      this.log(`[dry-run] Would compile agents with ${totalSkillCount} skills`);
      this.log(
        `[dry-run] Would use agent definitions from: ${agentDefs.sourcePath}`,
      );
      this.log(`[dry-run] Would output to: ${outputDir}`);
      this.log("[dry-run] Preview complete - no files were written");
      this.log("");
      return;
    }

    const pluginDir = getCollectivePluginDir();

    this.log("Compiling agents...");
    try {
      await ensureDir(outputDir);

      const recompileResult = await recompileAgents({
        pluginDir,
        sourcePath: agentDefs.sourcePath,
        skills: allSkills,
        outputDir,
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
        this.log("No agents to compile");
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
      this.log("Failed to compile agents");
      this.error(error instanceof Error ? error.message : String(error), {
        exit: EXIT_CODES.ERROR,
      });
    }

    this.log("");
    this.logSuccess("Custom output compile complete!");
    this.log("");
  }
}
