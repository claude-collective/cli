import type { Liquid } from "liquidjs";
import os from "os";
import path from "path";

import { getErrorMessage } from "../../utils/errors";
import type {
  AgentConfig,
  AgentDefinition,
  AgentName,
  CompileConfig,
  ProjectConfig,
  SkillDefinitionMap,
} from "../../types";
import { type InstallMode, deriveInstallMode } from "../installation/installation";
import { buildCompileAgents } from "../installation/local-installer";
import { CLAUDE_DIR } from "../../consts";
import { glob, writeFile, ensureDir } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { typedEntries, typedKeys } from "../../utils/typed-object";
import { createLiquidEngine } from "../compiler";
import { loadProjectConfig } from "../configuration";
import { loadAllAgents, loadProjectAgents } from "../loading";
import { getPluginAgentsDir } from "../plugins";
import { discoverAllPluginSkills } from "../plugins/plugin-discovery";
import { resolveAgents } from "../resolver";
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

  // Ensure both directories exist before writing agents.
  // ensureDir is idempotent (mkdir -p), so calling it when dirs already exist is safe.
  await ensureDir(globalAgentsDir);

  for (const [agentName, agent] of typedEntries<AgentName, AgentConfig>(resolvedAgents)) {
    try {
      const output = await compileAgentForPlugin(agentName, agent, sourcePath, engine, installMode);

      // Route agent output by scope: global agents go to ~/.claude/agents/, project agents to agentsDir
      const scope = agentScopeMap?.get(agentName) ?? "project";
      const targetDir = scope === "global" ? globalAgentsDir : agentsDir;
      await writeFile(path.join(targetDir, `${agentName}.md`), output);
      result.compiled.push(agentName);
      verbose(`  Recompiled: ${agentName} (${scope} -> ${targetDir})`);
    } catch (error) {
      result.failed.push(agentName);
      result.warnings.push(`Failed to compile ${agentName}: ${getErrorMessage(error)}`);
    }
  }
}

export function filterExcludedEntries(config: ProjectConfig): ProjectConfig {
  const activeIds = new Set(config.skills.filter((s) => !s.excluded).map((s) => s.id));
  const excludedIds = new Set(
    config.skills.filter((s) => s.excluded && !activeIds.has(s.id)).map((s) => s.id),
  );
  const activeSkills = config.skills.filter((s) => !s.excluded);
  const activeAgents = config.agents.filter((a) => !a.excluded);

  // Also remove excluded skill refs from stack assignments
  const filteredStack = config.stack
    ? Object.fromEntries(
        typedEntries(config.stack).map(([agentName, agentStack]) => [
          agentName,
          Object.fromEntries(
            typedEntries(agentStack).map(([category, assignments]) => [
              category,
              assignments.filter((a) => !excludedIds.has(a.id)),
            ]),
          ),
        ]),
      )
    : undefined;

  return { ...config, skills: activeSkills, agents: activeAgents, stack: filteredStack };
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

  // Filter excluded entries once at the entry point — callees receive clean data
  const filteredConfig = projectConfig ? filterExcludedEntries(projectConfig) : null;

  const builtinAgents = await loadAllAgents(sourcePath);
  const projectAgents = projectDir ? await loadProjectAgents(projectDir) : {};

  // Priority: project agents > built-in agents
  const allAgents: Record<AgentName, AgentDefinition> = {
    ...builtinAgents,
    ...projectAgents,
  };

  const agentNames = await resolveAgentNames({
    specifiedAgents: options.agents,
    projectConfig: filteredConfig,
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

  const configAgents = filteredConfig ? buildCompileAgents(filteredConfig, allAgents) : {};

  // buildCompileAgents only includes agents from config.agents — also include
  // any resolved agents (from options or existing files) that exist in allAgents
  for (const name of agentNames) {
    if (allAgents[name] && !configAgents[name]) {
      configAgents[name] = {};
    } else if (!allAgents[name]) {
      result.warnings.push(`Agent "${name}" not found in source definitions`);
    }
  }

  const compileConfig: CompileConfig = {
    name: filteredConfig?.name || path.basename(pluginDir),
    description: filteredConfig?.description || "Recompiled plugin",
    agents: configAgents,
  };

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
      installMode: options.installMode ?? deriveInstallMode(filteredConfig?.skills ?? []),
      agentScopeMap: options.agentScopeMap,
    },
    result,
  );

  return result;
}
