import path from "path";
import { glob, writeFile, ensureDir, readFile, fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { loadAllAgents, loadPluginSkills } from "./loader";
import { resolveAgents, resolveStackSkills } from "./resolver";
import { compileAgentForPlugin } from "./stack-plugin-compiler";
import { getPluginAgentsDir } from "./plugin-finder";
import { createLiquidEngine } from "./compiler";
import { parse as parseYaml } from "yaml";
import type {
  CompileConfig,
  CompileAgentConfig,
  StackConfig,
  SkillReference,
  SkillDefinition,
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

async function loadPluginConfig(
  pluginDir: string,
): Promise<StackConfig | null> {
  const configPath = path.join(pluginDir, "config.yaml");
  if (!(await fileExists(configPath))) {
    verbose(`No config.yaml found at ${configPath}`);
    return null;
  }

  try {
    const content = await readFile(configPath);
    const config = parseYaml(content) as StackConfig;
    verbose(`Loaded config.yaml from ${configPath}`);
    return config;
  } catch (error) {
    verbose(`Failed to parse config.yaml: ${error}`);
    return null;
  }
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

  const pluginConfig = await loadPluginConfig(pluginDir);
  const allAgents = await loadAllAgents(sourcePath);

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
      if (pluginConfig?.agent_skills?.[agentName]) {
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
