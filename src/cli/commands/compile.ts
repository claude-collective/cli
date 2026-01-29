import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { parse as parseYaml } from "yaml";
import { setVerbose, verbose } from "../utils/logger";
import {
  getCollectivePluginDir,
  getPluginAgentsDir,
  getPluginManifestPath,
  getProjectPluginsDir,
} from "../lib/plugin-finder";
import { fetchAgentDefinitions } from "../lib/agent-fetcher";
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
import type {
  AgentSourcePaths,
  PluginManifest,
  StackConfig,
  SkillDefinition,
} from "../types";

/**
 * Load skills from a directory containing SKILL.md files
 * Recursively finds all SKILL.md files and parses them
 * Returns SkillDefinition records for use with recompileAgents
 */
async function loadSkillsFromDir(
  skillsDir: string,
  pathPrefix: string = "",
): Promise<Record<string, SkillDefinition>> {
  const skills: Record<string, SkillDefinition> = {};

  if (!(await directoryExists(skillsDir))) {
    return skills;
  }

  // Recursively find all SKILL.md files
  const skillFiles = await glob("**/SKILL.md", skillsDir);

  for (const skillFile of skillFiles) {
    const skillPath = path.join(skillsDir, skillFile);
    const skillDir = path.dirname(skillPath);
    const relativePath = path.relative(skillsDir, skillDir);

    try {
      const content = await readFile(skillPath);

      // Parse frontmatter if present
      let metadata: Record<string, unknown> = {};

      if (content.startsWith("---")) {
        const endIndex = content.indexOf("---", 3);
        if (endIndex > 0) {
          const yamlContent = content.slice(3, endIndex).trim();

          // Simple YAML parsing for common fields
          const lines = yamlContent.split("\n");
          for (const line of lines) {
            const colonIndex = line.indexOf(":");
            if (colonIndex > 0) {
              const key = line.slice(0, colonIndex).trim();
              const value = line.slice(colonIndex + 1).trim();
              // Remove quotes if present
              metadata[key] = value.replace(/^["']|["']$/g, "");
            }
          }
        }
      }

      // Use the frontmatter name as the canonical ID (matches loadPluginSkills behavior)
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

      // Key by canonical ID for proper merging
      skills[canonicalId] = skill;
      verbose(`  Loaded skill: ${canonicalId}`);
    } catch (error) {
      verbose(`  Failed to load skill: ${skillFile} - ${error}`);
    }
  }

  return skills;
}

/**
 * Discover skills from all installed plugins in .claude/plugins/
 * Each plugin may have a skills/ subdirectory
 */
async function discoverPluginSkills(
  projectDir: string,
): Promise<Record<string, SkillDefinition>> {
  const allSkills: Record<string, SkillDefinition> = {};
  const pluginsDir = getProjectPluginsDir(projectDir);

  if (!(await directoryExists(pluginsDir))) {
    verbose(`No plugins directory found at ${pluginsDir}`);
    return allSkills;
  }

  // List all plugin directories
  const pluginDirs = await listDirectories(pluginsDir);

  for (const pluginName of pluginDirs) {
    const pluginDir = path.join(pluginsDir, pluginName);
    const pluginSkillsDir = path.join(pluginDir, "skills");

    if (await directoryExists(pluginSkillsDir)) {
      verbose(`Discovering skills from plugin: ${pluginName}`);
      const pluginSkills = await loadPluginSkills(pluginDir);

      // Merge plugin skills (later plugins can override earlier ones)
      for (const [id, skill] of Object.entries(pluginSkills)) {
        allSkills[id] = skill;
      }
    }
  }

  return allSkills;
}

/**
 * Discover skills from local .claude/skills/ directory
 * These are user-defined skills that override plugin skills
 */
async function discoverLocalProjectSkills(
  projectDir: string,
): Promise<Record<string, SkillDefinition>> {
  const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
  return loadSkillsFromDir(localSkillsDir, LOCAL_SKILLS_PATH);
}

/**
 * Merge skills from multiple sources
 * Later sources take precedence over earlier ones
 * This allows local skills to override plugin skills
 */
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

export const compileCommand = new Command("compile")
  .description(
    "Compile agents using local skills and fetched agent definitions",
  )
  .option("-v, --verbose", "Enable verbose logging", false)
  .option("--source <url>", "Marketplace source for agent definitions")
  .option("--refresh", "Force refresh agent definitions from source", false)
  .option(
    "-o, --output <dir>",
    "Output directory for compiled agents (skips plugin mode)",
  )
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options, command) => {
    // Get global --dry-run option from parent
    const dryRun = command.optsWithGlobals().dryRun ?? false;

    const s = p.spinner();

    // Set verbose mode globally
    setVerbose(options.verbose);

    // Custom output mode or plugin mode
    if (options.output) {
      await runCustomOutputCompile(s, options, dryRun);
    } else {
      await runPluginModeCompile(s, options, dryRun);
    }
  });

/**
 * Read plugin manifest from the collective plugin directory
 * Returns null if manifest doesn't exist or is invalid
 */
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

/**
 * Run compilation in plugin mode
 * Uses local skills but fetches agent definitions from marketplace
 */
async function runPluginModeCompile(
  s: ReturnType<typeof p.spinner>,
  options: { source?: string; refresh?: boolean; verbose?: boolean },
  dryRun: boolean,
): Promise<void> {
  console.log(`\n${pc.cyan("Plugin Mode Compile")}\n`);

  // 1. Get the collective plugin directory (always ~/.claude/plugins/claude-collective/)
  const pluginDir = getCollectivePluginDir();
  s.start("Finding plugin...");

  // Check if plugin exists
  if (!(await directoryExists(pluginDir))) {
    s.stop("No plugin found");
    p.log.error("No plugin found.");
    p.log.info(`Run ${pc.cyan("cc init")} first to create a plugin.`);
    process.exit(1);
  }

  // Read manifest to get plugin name
  const manifest = await readPluginManifest(pluginDir);
  const pluginName = manifest?.name ?? "claude-collective";

  s.stop(`Found plugin: ${pluginName}`);
  verbose(`  Path: ${pluginDir}`);

  // 1.5 Check for config.yaml
  const configPath = path.join(pluginDir, "config.yaml");
  const hasConfig = await fileExists(configPath);
  if (hasConfig) {
    try {
      const configContent = await readFile(configPath);
      const config = parseYaml(configContent) as StackConfig;
      const agentCount = config.agents?.length ?? 0;
      const configSkillCount = config.skills?.length ?? 0;
      p.log.info(
        `Using ${pc.cyan("config.yaml")} (${agentCount} agents, ${configSkillCount} skills)`,
      );
      verbose(`  Config: ${configPath}`);
    } catch {
      p.log.warn(`config.yaml found but could not be parsed - using defaults`);
    }
  } else {
    verbose(`  No config.yaml found - using defaults`);
  }

  // 2. Discover skills from both installed plugins AND local .claude/skills/
  const projectDir = process.cwd();
  s.start("Discovering skills...");

  // 2a. Discover skills from installed plugins (.claude/plugins/*/skills/)
  const pluginSkills = await discoverPluginSkills(projectDir);
  const pluginSkillCount = Object.keys(pluginSkills).length;
  verbose(`  Found ${pluginSkillCount} skills from installed plugins`);

  // 2b. Discover local skills from .claude/skills/
  const localSkills = await discoverLocalProjectSkills(projectDir);
  const localSkillCount = Object.keys(localSkills).length;
  verbose(`  Found ${localSkillCount} local skills from .claude/skills/`);

  // 2c. Merge skills (local takes precedence over plugin skills)
  const allSkills = mergeSkills(pluginSkills, localSkills);
  const totalSkillCount = Object.keys(allSkills).length;

  if (totalSkillCount === 0) {
    s.stop("No skills found");
    p.log.warn(
      "No skills found. Add skills with 'cc add <skill>' or create in .claude/skills/.",
    );
    process.exit(1);
  }

  // Display skill count breakdown
  if (localSkillCount > 0 && pluginSkillCount > 0) {
    s.stop(
      `Discovered ${totalSkillCount} skills (${pluginSkillCount} from plugins, ${localSkillCount} local)`,
    );
  } else if (localSkillCount > 0) {
    s.stop(`Discovered ${localSkillCount} local skills`);
  } else {
    s.stop(`Discovered ${pluginSkillCount} skills from plugins`);
  }

  // 3. Resolve source and fetch agent definitions from marketplace
  s.start("Resolving marketplace source...");
  let sourceConfig;
  try {
    sourceConfig = await resolveSource(options.source);
    s.stop(`Source: ${sourceConfig.sourceOrigin}`);
  } catch (error) {
    s.stop("Failed to resolve source");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  s.start("Fetching agent definitions...");
  let agentDefs: AgentSourcePaths;
  try {
    agentDefs = await fetchAgentDefinitions(sourceConfig.source, {
      forceRefresh: options.refresh,
    });
    s.stop("Agent definitions fetched");
    verbose(`  Agents: ${agentDefs.agentsDir}`);
    verbose(`  Templates: ${agentDefs.templatesDir}`);
  } catch (error) {
    s.stop("Failed to fetch agent definitions");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  if (dryRun) {
    console.log(
      pc.yellow(`\n[dry-run] Would compile ${totalSkillCount} skills`),
    );
    console.log(
      pc.yellow(
        `[dry-run] Would use agent definitions from: ${agentDefs.sourcePath}`,
      ),
    );
    console.log(
      pc.yellow(`[dry-run] Would output to: ${getPluginAgentsDir(pluginDir)}`),
    );
    p.outro(pc.green("[dry-run] Preview complete - no files were written"));
    return;
  }

  // 4. Compile agents using merged skills + fetched definitions
  s.start("Recompiling agents...");
  try {
    const recompileResult = await recompileAgents({
      pluginDir,
      sourcePath: agentDefs.sourcePath,
      skills: allSkills,
    });

    if (recompileResult.failed.length > 0) {
      s.stop(
        `Recompiled ${recompileResult.compiled.length} agents (${recompileResult.failed.length} failed)`,
      );
      for (const warning of recompileResult.warnings) {
        p.log.warn(warning);
      }
    } else if (recompileResult.compiled.length > 0) {
      s.stop(`Recompiled ${recompileResult.compiled.length} agents`);
    } else {
      s.stop("No agents to recompile");
    }

    // Show compiled agents
    if (recompileResult.compiled.length > 0) {
      verbose(`  Compiled: ${recompileResult.compiled.join(", ")}`);
    }
  } catch (error) {
    s.stop("Failed to recompile agents");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  p.outro(pc.green("Plugin compile complete!"));
}

/**
 * Run compilation with custom output directory
 * Compiles agents directly to the specified directory without plugin structure
 */
async function runCustomOutputCompile(
  s: ReturnType<typeof p.spinner>,
  options: {
    source?: string;
    refresh?: boolean;
    verbose?: boolean;
    output: string;
  },
  dryRun: boolean,
): Promise<void> {
  const outputDir = path.resolve(process.cwd(), options.output);
  console.log(`\n${pc.cyan("Custom Output Compile")}\n`);
  console.log(`Output directory: ${pc.cyan(outputDir)}\n`);

  // 1. Discover skills from both installed plugins AND local .claude/skills/
  const projectDir = process.cwd();
  s.start("Discovering skills...");

  // 1a. Discover skills from installed plugins (.claude/plugins/*/skills/)
  const pluginSkills = await discoverPluginSkills(projectDir);
  const pluginSkillCount = Object.keys(pluginSkills).length;
  verbose(`  Found ${pluginSkillCount} skills from installed plugins`);

  // 1b. Discover local skills from .claude/skills/
  const localSkills = await discoverLocalProjectSkills(projectDir);
  const localSkillCount = Object.keys(localSkills).length;
  verbose(`  Found ${localSkillCount} local skills from .claude/skills/`);

  // 1c. Merge skills (local takes precedence over plugin skills)
  const allSkills = mergeSkills(pluginSkills, localSkills);
  const totalSkillCount = Object.keys(allSkills).length;

  if (totalSkillCount === 0) {
    s.stop("No skills found");
    p.log.warn(
      "No skills found. Add skills with 'cc add <skill>' or create in .claude/skills/.",
    );
    process.exit(1);
  }

  // Display skill count breakdown
  if (localSkillCount > 0 && pluginSkillCount > 0) {
    s.stop(
      `Discovered ${totalSkillCount} skills (${pluginSkillCount} from plugins, ${localSkillCount} local)`,
    );
  } else if (localSkillCount > 0) {
    s.stop(`Discovered ${localSkillCount} local skills`);
  } else {
    s.stop(`Discovered ${pluginSkillCount} skills from plugins`);
  }

  // 2. Resolve source and fetch agent definitions
  s.start("Resolving source...");
  let sourceConfig;
  try {
    sourceConfig = await resolveSource(options.source);
    s.stop(`Source: ${sourceConfig.sourceOrigin}`);
  } catch (error) {
    s.stop("Failed to resolve source");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  s.start("Fetching agent definitions...");
  let agentDefs: AgentSourcePaths;
  try {
    agentDefs = await fetchAgentDefinitions(sourceConfig.source, {
      forceRefresh: options.refresh,
    });
    s.stop("Agent definitions fetched");
    verbose(`  Agents: ${agentDefs.agentsDir}`);
    verbose(`  Templates: ${agentDefs.templatesDir}`);
  } catch (error) {
    s.stop("Failed to fetch agent definitions");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  if (dryRun) {
    console.log(
      pc.yellow(
        `\n[dry-run] Would compile agents with ${totalSkillCount} skills`,
      ),
    );
    console.log(
      pc.yellow(
        `[dry-run] Would use agent definitions from: ${agentDefs.sourcePath}`,
      ),
    );
    console.log(pc.yellow(`[dry-run] Would output to: ${outputDir}`));
    p.outro(pc.green("[dry-run] Preview complete - no files were written"));
    return;
  }

  // 3. Compile agents to custom output directory
  // Use .claude/plugins/claude-collective/ as pluginDir for config, but output to custom dir
  const pluginDir = getCollectivePluginDir();

  s.start("Compiling agents...");
  try {
    // Ensure output directory exists
    await ensureDir(outputDir);

    const recompileResult = await recompileAgents({
      pluginDir,
      sourcePath: agentDefs.sourcePath,
      skills: allSkills,
      outputDir,
    });

    if (recompileResult.failed.length > 0) {
      s.stop(
        `Compiled ${recompileResult.compiled.length} agents (${recompileResult.failed.length} failed)`,
      );
      for (const warning of recompileResult.warnings) {
        p.log.warn(warning);
      }
    } else if (recompileResult.compiled.length > 0) {
      s.stop(`Compiled ${recompileResult.compiled.length} agents`);
    } else {
      s.stop("No agents to compile");
    }

    // Show compiled agents
    if (recompileResult.compiled.length > 0) {
      verbose(`  Compiled: ${recompileResult.compiled.join(", ")}`);
      console.log(`\n${pc.dim("Agents compiled to:")}`);
      console.log(`  ${pc.cyan(outputDir)}`);
      for (const agentName of recompileResult.compiled) {
        console.log(`    ${pc.dim(`${agentName}.md`)}`);
      }
    }
  } catch (error) {
    s.stop("Failed to compile agents");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  p.outro(pc.green("Custom output compile complete!"));
}
