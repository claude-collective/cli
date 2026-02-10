import path from "path";
import { glob, writeFile, ensureDir, readFile, fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { loadAllAgents, loadPluginSkills, loadProjectAgents } from "./loader";
import { resolveAgents, resolveStackSkills } from "./resolver";
import { compileAgentForPlugin } from "./stack-plugin-compiler";
import { getPluginAgentsDir } from "./plugin-finder";
import { createLiquidEngine } from "./compiler";
import { loadProjectConfig, type LoadedProjectConfig } from "./project-config";
import { resolveCustomAgents, validateCustomAgentIds } from "./custom-agent-resolver";
import { parse as parseYaml } from "yaml";
import { projectConfigLoaderSchema } from "./schemas";
import type {
  CompileConfig,
  CompileAgentConfig,
  SkillReference,
  SkillDefinition,
  ProjectConfig,
  AgentDefinition,
} from "../../types";
import type { AgentName } from "../types-matrix";
import { typedKeys } from "../utils/typed-object";

export interface RecompileAgentsOptions {
  pluginDir: string;
  sourcePath: string;
  agents?: string[];
  skills?: Record<string, SkillDefinition>;
  projectDir?: string;
  outputDir?: string;
}

export interface RecompileAgentsResult {
  compiled: AgentName[];
  failed: AgentName[];
  warnings: string[];
}

async function getExistingAgentNames(pluginDir: string): Promise<AgentName[]> {
  const agentsDir = getPluginAgentsDir(pluginDir);
  const files = await glob("*.md", agentsDir);
  // Boundary cast: directory names from filesystem are agent names by convention
  return files.map((f) => path.basename(f, ".md") as AgentName);
}

/**
 * Load config from either:
 * 1. pluginDir/config.yaml (legacy plugin location)
 * 2. pluginDir/.claude/config.yaml (new project config location)
 *
 * This provides backward compatibility with existing plugins.
 */
async function loadConfigWithFallback(pluginDir: string): Promise<LoadedProjectConfig | null> {
  // First try the legacy plugin location (pluginDir/config.yaml)
  const legacyConfigPath = path.join(pluginDir, "config.yaml");
  if (await fileExists(legacyConfigPath)) {
    try {
      const content = await readFile(legacyConfigPath);
      const parsed = parseYaml(content);
      const result = projectConfigLoaderSchema.safeParse(parsed);

      if (result.success) {
        verbose(`Loaded config.yaml from ${legacyConfigPath}`);
        return {
          // Loader schema validates field types but allows partial configs;
          // required field validation happens in validateProjectConfig()
          config: result.data as ProjectConfig,
          configPath: legacyConfigPath,
          isLegacy: false,
        };
      } else {
        verbose(`Invalid config.yaml at ${legacyConfigPath}: ${result.error.message}`);
      }
    } catch (error) {
      verbose(`Failed to parse config.yaml: ${error}`);
    }
  }

  // Fall back to project config location (.claude/config.yaml)
  return loadProjectConfig(pluginDir);
}

export async function recompileAgents(
  options: RecompileAgentsOptions,
): Promise<RecompileAgentsResult> {
  const {
    pluginDir,
    sourcePath,
    agents: specifiedAgents,
    skills: providedSkills,
    projectDir,
    outputDir,
  } = options;

  const result: RecompileAgentsResult = {
    compiled: [],
    failed: [],
    warnings: [],
  };

  // Load project config (handles both legacy plugin config and new ProjectConfig)
  // Try plugin dir first, then fall back to project dir for local mode
  let loadedConfig = await loadConfigWithFallback(pluginDir);
  if (!loadedConfig && projectDir) {
    loadedConfig = await loadConfigWithFallback(projectDir);
  }
  const projectConfig = loadedConfig?.config ?? null;

  // Load built-in agents from source
  const builtinAgents = await loadAllAgents(sourcePath);

  // Load project agents from .claude-src/agents/ (if projectDir provided)
  const projectAgents = projectDir ? await loadProjectAgents(projectDir) : {};

  // Resolve custom agents and merge with built-in agents
  // Priority: custom_agents > project agents > built-in agents
  let allAgents: Record<string, AgentDefinition> = {
    ...builtinAgents,
    ...projectAgents,
  };
  if (projectConfig?.custom_agents) {
    // Validate custom agent IDs don't conflict with built-in agents
    const idConflicts = validateCustomAgentIds(projectConfig.custom_agents, builtinAgents);
    if (idConflicts.length > 0) {
      for (const error of idConflicts) {
        result.warnings.push(error);
      }
    }

    // Resolve custom agents to AgentDefinition
    try {
      const resolvedCustomAgents = resolveCustomAgents(projectConfig.custom_agents, builtinAgents);
      // Merge: custom agents can override built-in if same name (though we warn above)
      allAgents = { ...builtinAgents, ...resolvedCustomAgents };
      verbose(`Resolved ${Object.keys(resolvedCustomAgents).length} custom agents`);
    } catch (error) {
      result.warnings.push(
        `Failed to resolve custom agents: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  let agentNames: AgentName[];
  if (specifiedAgents) {
    // Boundary cast: user-specified agent names from CLI options
    agentNames = specifiedAgents as AgentName[];
  } else if (projectConfig?.agents) {
    // Boundary cast: agent names from config.yaml
    agentNames = projectConfig.agents as AgentName[];
    verbose(`Using agents from config.yaml: ${agentNames.join(", ")}`);
  } else if (outputDir) {
    agentNames = typedKeys<AgentName>(allAgents);
    verbose(`Using all available agents from source: ${agentNames.join(", ")}`);
  } else {
    agentNames = await getExistingAgentNames(pluginDir);
  }

  if (agentNames.length === 0) {
    result.warnings.push("No agents found to recompile");
    return result;
  }

  verbose(`Recompiling ${agentNames.length} agents in ${outputDir ?? pluginDir}`);

  const pluginSkills = providedSkills ?? (await loadPluginSkills(pluginDir));

  const compileAgents: Record<string, CompileAgentConfig> = {};
  for (const agentName of agentNames) {
    if (allAgents[agentName]) {
      // Check if this is a custom agent with its own skills defined
      const customAgentConfig = projectConfig?.custom_agents?.[agentName];
      if (customAgentConfig?.skills && customAgentConfig.skills.length > 0) {
        // Custom agent has explicit skills defined
        const skillRefs: SkillReference[] = customAgentConfig.skills.map((s) => ({
          id: typeof s === "string" ? s : s.id,
          usage: `when working with ${(typeof s === "string" ? s : s.id).split(" ")[0]}`,
          preloaded: (typeof s === "object" && "preloaded" in s && s.preloaded) ?? false,
        }));
        compileAgents[agentName] = { skills: skillRefs };
        verbose(`  Agent ${agentName}: ${skillRefs.length} skills from custom_agents`);
      } else if (projectConfig?.agent_skills?.[agentName]) {
        const skillRefs = resolveStackSkills(projectConfig, agentName, pluginSkills);
        compileAgents[agentName] = { skills: skillRefs };
        verbose(`  Agent ${agentName}: ${skillRefs.length} skills from config`);
      } else if (projectConfig?.skills) {
        // Fall back to all skills in the config
        const skillRefs: SkillReference[] = projectConfig.skills.map((s) => {
          const id = typeof s === "string" ? s : s.id;
          const preloaded =
            typeof s === "object" && "preloaded" in s ? (s.preloaded ?? false) : false;
          return {
            id,
            usage: `when working with ${id.split(" ")[0]}`,
            preloaded,
          };
        });
        compileAgents[agentName] = { skills: skillRefs };
        verbose(`  Agent ${agentName}: ${skillRefs.length} skills (all)`);
      } else {
        compileAgents[agentName] = {};
      }
    } else {
      result.warnings.push(`Agent "${agentName}" not found in source definitions`);
    }
  }

  const compileConfig: CompileConfig = {
    name: projectConfig?.name || path.basename(pluginDir),
    description: projectConfig?.description || "Recompiled plugin",
    claude_md: "",
    agents: compileAgents,
  };

  const engine = await createLiquidEngine(projectDir);
  const resolvedAgents = await resolveAgents(allAgents, pluginSkills, compileConfig, sourcePath);

  const agentsDir = outputDir ?? getPluginAgentsDir(pluginDir);
  await ensureDir(agentsDir);

  for (const [name, agent] of Object.entries(resolvedAgents)) {
    // Boundary cast: Object.entries keys are string, resolved agents keyed by AgentName
    const agentName = name as AgentName;
    try {
      const output = await compileAgentForPlugin(agentName, agent, sourcePath, engine);
      await writeFile(path.join(agentsDir, `${agentName}.md`), output);
      result.compiled.push(agentName);
      verbose(`  Recompiled: ${agentName}`);
    } catch (error) {
      result.failed.push(agentName);
      result.warnings.push(
        `Failed to compile ${agentName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return result;
}
