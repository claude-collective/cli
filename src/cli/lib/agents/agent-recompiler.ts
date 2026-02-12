import path from "path";
import { glob, writeFile, ensureDir, readFile, fileExists } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { loadAllAgents, loadPluginSkills, loadProjectAgents } from "../loading";
import { resolveAgents } from "../resolver";
import { compileAgentForPlugin } from "../stacks";
import { getPluginAgentsDir } from "../plugins";
import { createLiquidEngine } from "../compiler";
import { loadProjectConfig, type LoadedProjectConfig } from "../configuration";
import { parse as parseYaml } from "yaml";
import { projectConfigLoaderSchema } from "../schemas";
import type {
  AgentConfig,
  AgentDefinition,
  AgentName,
  CompileAgentConfig,
  CompileConfig,
  ProjectConfig,
  SkillDefinition,
} from "../../types";
import { typedEntries, typedKeys } from "../../utils/typed-object";

export type RecompileAgentsOptions = {
  pluginDir: string;
  sourcePath: string;
  agents?: AgentName[];
  skills?: Record<string, SkillDefinition>;
  projectDir?: string;
  outputDir?: string;
};

export type RecompileAgentsResult = {
  compiled: AgentName[];
  failed: AgentName[];
  warnings: string[];
};

async function getExistingAgentNames(pluginDir: string): Promise<AgentName[]> {
  const agentsDir = getPluginAgentsDir(pluginDir);
  const files = await glob("*.md", agentsDir);
  // Boundary cast: directory names from filesystem are agent names by convention
  return files.map((f) => path.basename(f, ".md") as AgentName);
}

// Tries pluginDir/config.yaml (legacy) then pluginDir/.claude/config.yaml
async function loadConfigWithFallback(pluginDir: string): Promise<LoadedProjectConfig | null> {
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

  let loadedConfig = await loadConfigWithFallback(pluginDir);
  if (!loadedConfig && projectDir) {
    loadedConfig = await loadConfigWithFallback(projectDir);
  }
  const projectConfig = loadedConfig?.config ?? null;

  const builtinAgents = await loadAllAgents(sourcePath);
  const projectAgents = projectDir ? await loadProjectAgents(projectDir) : {};

  // Boundary cast: loadAllAgents returns Record<string, AgentDefinition>, agent dirs are AgentName by convention
  // Priority: project agents > built-in agents
  const allAgents = {
    ...builtinAgents,
    ...projectAgents,
  } as Record<AgentName, AgentDefinition>;

  let agentNames: AgentName[];
  if (specifiedAgents) {
    agentNames = specifiedAgents;
  } else if (projectConfig?.agents) {
    agentNames = projectConfig.agents;
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

  const compileAgents = {} as Record<AgentName, CompileAgentConfig>;
  for (const agentName of agentNames) {
    if (allAgents[agentName]) {
      compileAgents[agentName] = {};
    } else {
      result.warnings.push(`Agent "${agentName}" not found in source definitions`);
    }
  }

  const compileConfig: CompileConfig = {
    name: projectConfig?.name || path.basename(pluginDir),
    description: projectConfig?.description || "Recompiled plugin",
    agents: compileAgents,
  };

  const engine = await createLiquidEngine(projectDir);
  const resolvedAgents = await resolveAgents(allAgents, pluginSkills, compileConfig, sourcePath);

  const agentsDir = outputDir ?? getPluginAgentsDir(pluginDir);
  await ensureDir(agentsDir);

  for (const [agentName, agent] of typedEntries<AgentName, AgentConfig>(resolvedAgents)) {
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
