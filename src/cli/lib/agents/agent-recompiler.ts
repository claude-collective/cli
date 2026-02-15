import type { Liquid } from "liquidjs";
import path from "path";
import { parse as parseYaml } from "yaml";

import { getErrorMessage } from "../../utils/errors";
import { STANDARD_FILES } from "../../consts";
import type {
  AgentConfig,
  AgentDefinition,
  AgentName,
  CompileAgentConfig,
  CompileConfig,
  ProjectConfig,
  SkillDefinition,
  SkillId,
} from "../../types";
import { glob, writeFile, ensureDir, readFile, fileExists } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { typedEntries, typedKeys } from "../../utils/typed-object";
import { createLiquidEngine } from "../compiler";
import { loadProjectConfig, type LoadedProjectConfig } from "../configuration";
import { loadAllAgents, loadPluginSkills, loadProjectAgents } from "../loading";
import { getPluginAgentsDir } from "../plugins";
import { resolveAgents, buildSkillRefsFromConfig } from "../resolver";
import { projectConfigLoaderSchema } from "../schemas";
import { compileAgentForPlugin } from "../stacks";

export type RecompileAgentsOptions = {
  pluginDir: string;
  sourcePath: string;
  agents?: AgentName[];
  skills?: Partial<Record<SkillId, SkillDefinition>>;
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
  const legacyConfigPath = path.join(pluginDir, STANDARD_FILES.CONFIG_YAML);
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

type ResolveAgentNamesParams = {
  specifiedAgents?: AgentName[];
  projectConfig: ProjectConfig | null;
  allAgents: Record<AgentName, AgentDefinition>;
  outputDir?: string;
  pluginDir: string;
};

async function resolveAgentNames(params: ResolveAgentNamesParams): Promise<AgentName[]> {
  const { specifiedAgents, projectConfig, allAgents, outputDir, pluginDir } = params;

  if (specifiedAgents) {
    return specifiedAgents;
  }

  if (projectConfig?.agents) {
    verbose(`Using agents from config.yaml: ${projectConfig.agents.join(", ")}`);
    return projectConfig.agents;
  }

  if (outputDir) {
    const names = typedKeys<AgentName>(allAgents);
    verbose(`Using all available agents from source: ${names.join(", ")}`);
    return names;
  }

  return getExistingAgentNames(pluginDir);
}

type BuildCompileConfigParams = {
  agentNames: AgentName[];
  allAgents: Record<AgentName, AgentDefinition>;
  projectConfig: ProjectConfig | null;
  pluginDir: string;
};

type BuildCompileConfigResult = {
  compileConfig: CompileConfig;
  warnings: string[];
};

function buildCompileConfig(params: BuildCompileConfigParams): BuildCompileConfigResult {
  const { agentNames, allAgents, projectConfig, pluginDir } = params;
  const warnings: string[] = [];

  // Store initialization: accumulator filled below for each agent in agentNames
  const compileAgents = {} as Record<AgentName, CompileAgentConfig>;
  for (const agentName of agentNames) {
    if (allAgents[agentName]) {
      const agentStack = projectConfig?.stack?.[agentName];
      compileAgents[agentName] = agentStack ? { skills: buildSkillRefsFromConfig(agentStack) } : {};
    } else {
      warnings.push(`Agent "${agentName}" not found in source definitions`);
    }
  }

  const compileConfig: CompileConfig = {
    name: projectConfig?.name || path.basename(pluginDir),
    description: projectConfig?.description || "Recompiled plugin",
    agents: compileAgents,
  };

  return { compileConfig, warnings };
}

type CompileAndWriteParams = {
  resolvedAgents: Record<AgentName, AgentConfig>;
  agentsDir: string;
  sourcePath: string;
  engine: Liquid;
  installMode: ProjectConfig["installMode"];
};

async function compileAndWriteAgents(
  params: CompileAndWriteParams,
  result: RecompileAgentsResult,
): Promise<void> {
  const { resolvedAgents, agentsDir, sourcePath, engine, installMode } = params;

  for (const [agentName, agent] of typedEntries<AgentName, AgentConfig>(resolvedAgents)) {
    try {
      const output = await compileAgentForPlugin(agentName, agent, sourcePath, engine, installMode);
      await writeFile(path.join(agentsDir, `${agentName}.md`), output);
      result.compiled.push(agentName);
      verbose(`  Recompiled: ${agentName}`);
    } catch (error) {
      result.failed.push(agentName);
      result.warnings.push(`Failed to compile ${agentName}: ${getErrorMessage(error)}`);
    }
  }
}

export async function recompileAgents(
  options: RecompileAgentsOptions,
): Promise<RecompileAgentsResult> {
  const { pluginDir, sourcePath, skills: providedSkills, projectDir, outputDir } = options;

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

  const agentNames = await resolveAgentNames({
    specifiedAgents: options.agents,
    projectConfig,
    allAgents,
    outputDir,
    pluginDir,
  });

  if (agentNames.length === 0) {
    result.warnings.push("No agents found to recompile");
    return result;
  }

  verbose(`Recompiling ${agentNames.length} agents in ${outputDir ?? pluginDir}`);

  const pluginSkills = providedSkills ?? (await loadPluginSkills(pluginDir));

  const { compileConfig, warnings } = buildCompileConfig({
    agentNames,
    allAgents,
    projectConfig,
    pluginDir,
  });
  result.warnings.push(...warnings);

  const engine = await createLiquidEngine(projectDir);
  const resolvedAgents = await resolveAgents(allAgents, pluginSkills, compileConfig, sourcePath);

  const agentsDir = outputDir ?? getPluginAgentsDir(pluginDir);
  await ensureDir(agentsDir);

  await compileAndWriteAgents(
    {
      resolvedAgents,
      agentsDir,
      sourcePath,
      engine,
      installMode: projectConfig?.installMode,
    },
    result,
  );

  return result;
}
