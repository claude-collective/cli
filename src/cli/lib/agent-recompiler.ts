import path from "path";
import { glob, writeFile, ensureDir, readFile, fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { loadAllAgents, loadPluginSkills } from "./loader";
import { resolveAgents, resolveStackSkills } from "./resolver";
import { compileAgentForPlugin } from "./stack-plugin-compiler";
import { getPluginAgentsDir } from "./plugin-finder";
import { createLiquidEngine } from "./compiler";
import {
  loadProjectConfig,
  isLegacyStackConfig,
  normalizeStackConfig,
  type LoadedProjectConfig,
} from "./project-config";
import {
  resolveCustomAgents,
  validateCustomAgentIds,
} from "./custom-agent-resolver";
import { parse as parseYaml } from "yaml";
import type {
  CompileConfig,
  CompileAgentConfig,
  StackConfig,
  SkillReference,
  SkillDefinition,
  ProjectConfig,
  AgentDefinition,
} from "../../types";

export interface RecompileAgentsOptions {
  pluginDir: string;
  sourcePath: string;
  agents?: string[];
  skills?: Record<string, SkillDefinition>;
  projectDir?: string;
  outputDir?: string;
}

export interface RecompileAgentsResult {
  compiled: string[];
  failed: string[];
  warnings: string[];
}

async function getExistingAgentNames(pluginDir: string): Promise<string[]> {
  const agentsDir = getPluginAgentsDir(pluginDir);
  const files = await glob("*.md", agentsDir);
  return files.map((f) => path.basename(f, ".md"));
}

/**
 * Load config from either:
 * 1. pluginDir/config.yaml (legacy plugin location)
 * 2. pluginDir/.claude/config.yaml (new project config location)
 *
 * This provides backward compatibility with existing plugins.
 */
async function loadConfigWithFallback(
  pluginDir: string,
): Promise<LoadedProjectConfig | null> {
  // First try the legacy plugin location (pluginDir/config.yaml)
  const legacyConfigPath = path.join(pluginDir, "config.yaml");
  if (await fileExists(legacyConfigPath)) {
    try {
      const content = await readFile(legacyConfigPath);
      const parsed = parseYaml(content);

      if (parsed && typeof parsed === "object") {
        verbose(`Loaded config.yaml from ${legacyConfigPath}`);

        // Check if it's legacy StackConfig format
        if (isLegacyStackConfig(parsed)) {
          const normalized = normalizeStackConfig(parsed as StackConfig);
          return {
            config: normalized,
            configPath: legacyConfigPath,
            isLegacy: true,
          };
        }

        return {
          config: parsed as ProjectConfig,
          configPath: legacyConfigPath,
          isLegacy: false,
        };
      }
    } catch (error) {
      verbose(`Failed to parse config.yaml: ${error}`);
    }
  }

  // Fall back to project config location (.claude/config.yaml)
  return loadProjectConfig(pluginDir);
}

/**
 * Convert ProjectConfig to StackConfig-like structure for compatibility
 * with existing resolveStackSkills function
 */
function projectConfigToStackLike(config: ProjectConfig): StackConfig {
  return {
    name: config.name,
    version: "1.0.0",
    author: config.author ?? "@unknown",
    description: config.description,
    skills:
      config.skills?.map((s) => (typeof s === "string" ? { id: s } : s)) ?? [],
    agents: config.agents,
    agent_skills: config.agent_skills as StackConfig["agent_skills"],
    hooks: config.hooks,
    framework: config.framework,
    philosophy: config.philosophy,
    principles: config.principles,
    tags: config.tags,
  };
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
  const loadedConfig = await loadConfigWithFallback(pluginDir);
  const projectConfig = loadedConfig?.config ?? null;

  // Load built-in agents from source
  const builtinAgents = await loadAllAgents(sourcePath);

  // Resolve custom agents and merge with built-in agents
  let allAgents: Record<string, AgentDefinition> = { ...builtinAgents };
  if (projectConfig?.custom_agents) {
    // Validate custom agent IDs don't conflict with built-in agents
    const idConflicts = validateCustomAgentIds(
      projectConfig.custom_agents,
      builtinAgents,
    );
    if (idConflicts.length > 0) {
      for (const error of idConflicts) {
        result.warnings.push(error);
      }
    }

    // Resolve custom agents to AgentDefinition
    try {
      const resolvedCustomAgents = resolveCustomAgents(
        projectConfig.custom_agents,
        builtinAgents,
      );
      // Merge: custom agents can override built-in if same name (though we warn above)
      allAgents = { ...builtinAgents, ...resolvedCustomAgents };
      verbose(
        `Resolved ${Object.keys(resolvedCustomAgents).length} custom agents`,
      );
    } catch (error) {
      result.warnings.push(
        `Failed to resolve custom agents: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Convert to StackConfig-like for compatibility with existing functions
  const pluginConfig = projectConfig
    ? projectConfigToStackLike(projectConfig)
    : null;

  let agentNames: string[];
  if (specifiedAgents) {
    agentNames = specifiedAgents;
  } else if (pluginConfig?.agents) {
    agentNames = pluginConfig.agents;
    verbose(`Using agents from config.yaml: ${agentNames.join(", ")}`);
  } else if (outputDir) {
    agentNames = Object.keys(allAgents);
    verbose(`Using all available agents from source: ${agentNames.join(", ")}`);
  } else {
    agentNames = await getExistingAgentNames(pluginDir);
  }

  if (agentNames.length === 0) {
    result.warnings.push("No agents found to recompile");
    return result;
  }

  verbose(
    `Recompiling ${agentNames.length} agents in ${outputDir ?? pluginDir}`,
  );

  const pluginSkills = providedSkills ?? (await loadPluginSkills(pluginDir));

  const compileAgents: Record<string, CompileAgentConfig> = {};
  for (const agentName of agentNames) {
    if (allAgents[agentName]) {
      // Check if this is a custom agent with its own skills defined
      const customAgentConfig = projectConfig?.custom_agents?.[agentName];
      if (customAgentConfig?.skills && customAgentConfig.skills.length > 0) {
        // Custom agent has explicit skills defined
        const skillRefs: SkillReference[] = customAgentConfig.skills.map(
          (s) => ({
            id: typeof s === "string" ? s : s.id,
            usage: `when working with ${(typeof s === "string" ? s : s.id).split(" ")[0]}`,
            preloaded:
              (typeof s === "object" && "preloaded" in s && s.preloaded) ??
              false,
          }),
        );
        compileAgents[agentName] = { skills: skillRefs };
        verbose(
          `  Agent ${agentName}: ${skillRefs.length} skills from custom_agents`,
        );
      } else if (pluginConfig?.agent_skills?.[agentName]) {
        const skillRefs = resolveStackSkills(
          pluginConfig,
          agentName,
          pluginSkills,
        );
        compileAgents[agentName] = { skills: skillRefs };
        verbose(`  Agent ${agentName}: ${skillRefs.length} skills from config`);
      } else if (pluginConfig?.skills) {
        // Fall back to all skills in the config
        const skillRefs: SkillReference[] = pluginConfig.skills.map((s) => ({
          id: s.id,
          usage: `when working with ${s.id.split(" ")[0]}`,
          preloaded: s.preloaded ?? false,
        }));
        compileAgents[agentName] = { skills: skillRefs };
        verbose(`  Agent ${agentName}: ${skillRefs.length} skills (all)`);
      } else {
        compileAgents[agentName] = {};
      }
    } else {
      result.warnings.push(
        `Agent "${agentName}" not found in source definitions`,
      );
    }
  }

  const compileConfig: CompileConfig = {
    name: pluginConfig?.name || path.basename(pluginDir),
    description: pluginConfig?.description || "Recompiled plugin",
    claude_md: "",
    agents: compileAgents,
  };

  const engine = await createLiquidEngine(projectDir);
  const resolvedAgents = await resolveAgents(
    allAgents,
    pluginSkills,
    compileConfig,
    sourcePath,
  );

  const agentsDir = outputDir ?? getPluginAgentsDir(pluginDir);
  await ensureDir(agentsDir);

  for (const [name, agent] of Object.entries(resolvedAgents)) {
    try {
      const output = await compileAgentForPlugin(
        name,
        agent,
        sourcePath,
        engine,
      );
      await writeFile(path.join(agentsDir, `${name}.md`), output);
      result.compiled.push(name);
      verbose(`  Recompiled: ${name}`);
    } catch (error) {
      result.failed.push(name);
      result.warnings.push(
        `Failed to compile ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return result;
}
