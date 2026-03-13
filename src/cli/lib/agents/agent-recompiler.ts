import type { Liquid } from "liquidjs";
import os from "os";
import path from "path";

import { getErrorMessage } from "../../utils/errors";
import type {
  AgentConfig,
  AgentDefinition,
  AgentName,
  CompileAgentConfig,
  CompileConfig,
  ProjectConfig,
  SkillDefinitionMap,
} from "../../types";
import { type InstallMode, deriveInstallMode } from "../installation/installation";
import { CLAUDE_DIR } from "../../consts";
import { glob, writeFile, ensureDir } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { typedEntries, typedKeys } from "../../utils/typed-object";
import { createLiquidEngine } from "../compiler";
import { loadProjectConfig } from "../configuration";
import { loadAllAgents, loadProjectAgents } from "../loading";
import { getPluginAgentsDir } from "../plugins";
import { discoverAllPluginSkills } from "../plugins/plugin-discovery";
import { resolveAgents, buildSkillRefsFromConfig } from "../resolver";
import { compileAgentForPlugin } from "../stacks";

export type RecompileAgentsOptions = {
  pluginDir: string;
  sourcePath: string;
  agents?: AgentName[];
  skills?: SkillDefinitionMap;
  projectDir?: string;
  outputDir?: string;
  installMode?: InstallMode;
  /** When provided, routes agents by scope: global agents to ~/.claude/agents/, project agents to outputDir */
  agentScopeMap?: Map<AgentName, "project" | "global">;
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

  if (projectConfig?.agents?.length) {
    const agentNames = projectConfig.agents.map((a) => a.name);
    verbose(`Using agents from config: ${agentNames.join(", ")}`);
    return agentNames;
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

  // Store initialization: accumulator populated below for each agent in agentNames
  const compileAgents: Record<string, CompileAgentConfig> = {};
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
  installMode?: InstallMode;
  agentScopeMap?: Map<AgentName, "project" | "global">;
};

async function compileAndWriteAgents(
  params: CompileAndWriteParams,
  result: RecompileAgentsResult,
): Promise<void> {
  const { resolvedAgents, agentsDir, sourcePath, engine, installMode, agentScopeMap } = params;

  const globalAgentsDir = path.join(os.homedir(), CLAUDE_DIR, "agents");

  for (const [agentName, agent] of typedEntries<AgentName, AgentConfig>(resolvedAgents)) {
    try {
      const output = await compileAgentForPlugin(agentName, agent, sourcePath, engine, installMode);

      // Route agent output by scope: global agents go to ~/.claude/agents/, project agents to agentsDir
      const scope = agentScopeMap?.get(agentName) ?? "project";
      const targetDir = scope === "global" ? globalAgentsDir : agentsDir;
      if (scope === "global") {
        await ensureDir(targetDir);
      }
      await writeFile(path.join(targetDir, `${agentName}.md`), output);
      result.compiled.push(agentName);
      verbose(`  Recompiled: ${agentName} (${scope} -> ${targetDir})`);
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

  const configDir = projectDir ?? pluginDir;
  const loadedConfig = await loadProjectConfig(configDir);
  const projectConfig = loadedConfig?.config ?? null;

  const builtinAgents = await loadAllAgents(sourcePath);
  const projectAgents = projectDir ? await loadProjectAgents(projectDir) : {};

  // Priority: project agents > built-in agents
  const allAgents: Record<AgentName, AgentDefinition> = {
    ...builtinAgents,
    ...projectAgents,
  };

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

  // When skills are not provided, discover from all plugin directories.
  let pluginSkills: SkillDefinitionMap;
  if (providedSkills) {
    pluginSkills = providedSkills;
  } else {
    pluginSkills = await discoverAllPluginSkills(projectDir ?? pluginDir);
  }

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
      installMode: options.installMode ?? deriveInstallMode(projectConfig?.skills ?? []),
      agentScopeMap: options.agentScopeMap,
    },
    result,
  );

  return result;
}
