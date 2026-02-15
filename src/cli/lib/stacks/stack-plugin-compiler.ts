import path from "path";
import { Liquid } from "liquidjs";
import {
  readFile,
  readFileOptional,
  writeFile,
  ensureDir,
  copy,
  fileExists,
  directoryExists,
} from "../../utils/fs";
import { log, verbose } from "../../utils/logger";
import { DIRS, PROJECT_ROOT, STANDARD_FILES } from "../../consts";
import { createLiquidEngine, sanitizeCompiledAgentData } from "../compiler";
import {
  generateStackPluginManifest,
  writePluginManifest,
  getPluginManifestPath,
} from "../plugins";
import { loadSkillsByIds, loadAllAgents } from "../loading";
import { loadStackById, resolveAgentConfigToSkills, getStackSkillIds } from "./stacks-loader";
import { resolveAgents, convertStackToCompileConfig } from "../resolver";
import { buildStackProperty } from "../configuration";
import type {
  AgentConfig,
  AgentDefinition,
  AgentName,
  CompileConfig,
  CompiledAgentData,
  PluginManifest,
  ProjectConfig,
  SkillDefinition,
  SkillId,
  Stack,
} from "../../types";
import { computeStringHash, determinePluginVersion, writeContentHash } from "../versioning";
import { unique } from "remeda";
import { typedEntries, typedKeys } from "../../utils/typed-object";

function hashStackConfig(stack: ProjectConfig): string {
  const stackSkillIds = stack.stack ? getStackSkillIds(stack.stack).sort() : [];
  const parts: string[] = [
    `name:${stack.name}`,
    `description:${stack.description ?? ""}`,
    `skills:${stackSkillIds.join(",")}`,
    `agents:${(stack.agents || []).sort().join(",")}`,
  ];
  return computeStringHash(parts.join("\n"));
}

export type StackPluginOptions = {
  stackId: string;
  outputDir: string;
  projectRoot: string;
  agentSourcePath?: string;
  /** Optional stack configuration - if provided, bypasses loading from config/stacks.yaml */
  stack?: Stack;
};

export type CompiledStackPlugin = {
  pluginPath: string;
  manifest: PluginManifest;
  stackName: string;
  agents: AgentName[];
  skillPlugins: SkillId[];
  hasHooks: boolean;
};

export async function compileAgentForPlugin(
  name: AgentName,
  agent: AgentConfig,
  fallbackRoot: string,
  engine: Liquid,
  installMode?: "plugin" | "local",
): Promise<string> {
  verbose(`Compiling agent: ${name}`);

  // Use agent's sourceRoot if available (for multi-source loading), otherwise fallback
  const agentSourceRoot = agent.sourceRoot || fallbackRoot;
  // Use agent's agentBaseDir if available (for project agents in .claude-src/agents/)
  const agentBaseDir = agent.agentBaseDir || DIRS.agents;
  const agentDir = path.join(agentSourceRoot, agentBaseDir, agent.path || name);

  const intro = await readFile(path.join(agentDir, STANDARD_FILES.INTRO_MD));
  const workflow = await readFile(path.join(agentDir, STANDARD_FILES.WORKFLOW_MD));
  const examples = await readFileOptional(
    path.join(agentDir, STANDARD_FILES.EXAMPLES_MD),
    "## Examples\n\n_No examples defined._",
  );
  const criticalRequirementsTop = await readFileOptional(
    path.join(agentDir, STANDARD_FILES.CRITICAL_REQUIREMENTS_MD),
    "",
  );
  const criticalReminders = await readFileOptional(
    path.join(agentDir, STANDARD_FILES.CRITICAL_REMINDERS_MD),
    "",
  );

  const agentPath = agent.path || name;
  const category = agentPath.split("/")[0];
  const categoryDir = path.join(agentSourceRoot, agentBaseDir, category);

  let outputFormat = await readFileOptional(
    path.join(agentDir, STANDARD_FILES.OUTPUT_FORMAT_MD),
    "",
  );
  if (!outputFormat) {
    outputFormat = await readFileOptional(
      path.join(categoryDir, STANDARD_FILES.OUTPUT_FORMAT_MD),
      "",
    );
  }

  // In plugin mode, skills are installed as individual plugins — use pluginRef format.
  // Create new skill objects to avoid mutating the caller's data.
  const skills =
    installMode === "plugin"
      ? agent.skills.map((s) => ({ ...s, pluginRef: `${s.id}:${s.id}` as const }))
      : agent.skills;

  const preloadedSkills = skills.filter((s) => s.preloaded);
  const dynamicSkills = skills.filter((s) => !s.preloaded);
  const preloadedSkillIds = preloadedSkills.map((s) => s.pluginRef ?? s.id);

  verbose(
    `Skills for ${name}: ${preloadedSkills.length} preloaded, ${dynamicSkills.length} dynamic`,
  );

  const data: CompiledAgentData = {
    agent,
    intro,
    workflow,
    examples,
    criticalRequirementsTop,
    criticalReminders,
    outputFormat,
    skills,
    preloadedSkills,
    dynamicSkills,
    preloadedSkillIds,
  };

  return engine.renderFile("agent", sanitizeCompiledAgentData(data));
}

function generateStackReadme(
  stackId: string,
  stack: ProjectConfig,
  agents: AgentName[],
  skillPlugins: SkillId[],
): string {
  const lines: string[] = [];

  lines.push(`# ${stack.name}`);
  lines.push("");
  lines.push(stack.description || "A Claude Code stack plugin.");
  lines.push("");

  lines.push("## Installation");
  lines.push("");
  lines.push("Add this plugin to your Claude Code configuration:");
  lines.push("");
  lines.push("```json");
  lines.push("{");
  lines.push(`  "plugins": ["${stackId}"]`);
  lines.push("}");
  lines.push("```");
  lines.push("");

  lines.push("## Agents");
  lines.push("");
  lines.push("This stack includes the following agents:");
  lines.push("");
  for (const agent of agents) {
    lines.push(`- \`${agent}\``);
  }
  lines.push("");

  if (skillPlugins.length > 0) {
    lines.push("## Included Skills");
    lines.push("");
    lines.push("This stack includes the following skills:");
    lines.push("");
    const uniqueSkills = unique(skillPlugins).sort();
    for (const skill of uniqueSkills) {
      lines.push(`- \`${skill}\``);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("*Generated by Claude Collective stack-plugin-compiler*");
  lines.push("");

  return lines.join("\n");
}

export async function compileStackPlugin(
  options: StackPluginOptions,
): Promise<CompiledStackPlugin> {
  const { stackId, outputDir, projectRoot, agentSourcePath } = options;
  const localAgentRoot = agentSourcePath || projectRoot;

  verbose(`Compiling stack plugin: ${stackId}`);
  verbose(`  Stack/skills source: ${projectRoot}`);
  verbose(`  Local agent source: ${localAgentRoot}`);
  verbose(`  CLI agent source: ${PROJECT_ROOT}`);

  const cliAgents = await loadAllAgents(PROJECT_ROOT);
  const localAgents = await loadAllAgents(localAgentRoot);
  // Boundary cast: loadAllAgents returns Record<string, AgentDefinition>, agent dirs are AgentName by convention
  const agents = { ...cliAgents, ...localAgents } as Record<AgentName, AgentDefinition>;

  verbose(
    `  Loaded ${Object.keys(localAgents).length} local agents, ${Object.keys(cliAgents).length} CLI agents`,
  );

  // Use provided stack or load from source's config/stacks.yaml, falling back to CLI
  let newStack = options.stack || (await loadStackById(stackId, projectRoot));
  if (!newStack) {
    newStack = await loadStackById(stackId, PROJECT_ROOT);
  }

  let stack: ProjectConfig;
  if (newStack) {
    verbose(`  Found stack: ${newStack.name}`);

    const agentSkillIds = new Set<SkillId>();
    for (const agentName of typedKeys<AgentName>(newStack.agents)) {
      const agentConfig = newStack.agents[agentName];
      if (!agentConfig) continue;
      const skillRefs = resolveAgentConfigToSkills(agentConfig);
      for (const ref of skillRefs) {
        agentSkillIds.add(ref.id);
      }
    }

    stack = {
      name: newStack.name,
      description: newStack.description,
      agents: typedKeys<AgentName>(newStack.agents),
      skills: [...agentSkillIds],
      stack: buildStackProperty(newStack) as ProjectConfig["stack"],
    };
  } else {
    throw new Error(`Stack '${stackId}' not found in config/stacks.yaml`);
  }

  const stackSkillIds = stack.stack ? getStackSkillIds(stack.stack) : [];
  // Boundary cast: loadSkillsByIds returns Record<string, SkillDefinition>, keys are SkillId by construction
  const skills = (await loadSkillsByIds(
    stackSkillIds.map((id) => ({ id })),
    projectRoot,
  )) as Record<SkillId, SkillDefinition>;

  const compileConfig: CompileConfig = convertStackToCompileConfig(stackId, stack);

  const resolvedAgents = await resolveAgents(agents, skills, compileConfig, projectRoot, newStack);

  const pluginDir = path.join(outputDir, stackId);
  const agentsDir = path.join(pluginDir, "agents");

  await ensureDir(pluginDir);
  await ensureDir(agentsDir);

  const pluginSkillsDir = path.join(pluginDir, "skills");
  await ensureDir(pluginSkillsDir);

  const copiedSourcePaths = new Set<string>();

  for (const resolvedSkill of Object.values(skills)) {
    const sourceSkillDir = path.join(projectRoot, resolvedSkill.path);

    if (copiedSourcePaths.has(resolvedSkill.path)) {
      continue;
    }

    const destSkillDir = path.join(pluginSkillsDir, resolvedSkill.id);

    if (await directoryExists(sourceSkillDir)) {
      await copy(sourceSkillDir, destSkillDir);
      copiedSourcePaths.add(resolvedSkill.path);
      verbose(`  Copied skill: ${resolvedSkill.id}`);
    } else {
      verbose(`  Warning: Skill directory not found: ${sourceSkillDir}`);
    }
  }

  const engine = await createLiquidEngine();

  const compiledAgentNames: AgentName[] = [];
  const allSkillPlugins: SkillId[] = [];

  for (const [name, agent] of typedEntries<AgentName, AgentConfig>(resolvedAgents)) {
    const output = await compileAgentForPlugin(name, agent, PROJECT_ROOT, engine);
    await writeFile(path.join(agentsDir, `${name}.md`), output);
    compiledAgentNames.push(name);

    for (const skill of agent.skills) {
      allSkillPlugins.push(skill.id);
    }

    verbose(`  Compiled agent: ${name}`);
  }

  const stackDir = path.join(projectRoot, DIRS.stacks, stackId);
  const claudeMdPath = path.join(stackDir, STANDARD_FILES.CLAUDE_MD);
  if (await fileExists(claudeMdPath)) {
    const claudeContent = await readFile(claudeMdPath);
    await writeFile(path.join(pluginDir, STANDARD_FILES.CLAUDE_MD), claudeContent);
    verbose(`  Copied ${STANDARD_FILES.CLAUDE_MD}`);
  }

  const newHash = hashStackConfig(stack);
  const { version, contentHash } = await determinePluginVersion(
    newHash,
    pluginDir,
    getPluginManifestPath,
  );

  const uniqueSkillPlugins = unique(allSkillPlugins);
  const manifest = generateStackPluginManifest({
    stackName: stackId,
    description: stack.description,
    author: stack.author,
    version,
    keywords: undefined,
    hasAgents: true,
    hasHooks: false,
    hasSkills: true,
  });

  await writePluginManifest(pluginDir, manifest);

  await writeContentHash(pluginDir, contentHash, getPluginManifestPath);

  verbose(`  Wrote plugin.json (v${version})`);

  const readme = generateStackReadme(stackId, stack, compiledAgentNames, uniqueSkillPlugins);
  await writeFile(path.join(pluginDir, "README.md"), readme);
  verbose("  Generated README.md");

  return {
    pluginPath: pluginDir,
    manifest,
    stackName: stack.name,
    agents: compiledAgentNames,
    skillPlugins: uniqueSkillPlugins,
    hasHooks: false,
  };
}

export function printStackCompilationSummary(result: CompiledStackPlugin): void {
  log(`\nStack plugin compiled: ${result.stackName}`);
  log(`  Path: ${result.pluginPath}`);
  log(`  Agents: ${result.agents.length}`);
  for (const agent of result.agents) {
    log(`    - ${agent}`);
  }
  if (result.skillPlugins.length > 0) {
    log(`  Skills included: ${result.skillPlugins.length}`);
    for (const skill of result.skillPlugins) {
      log(`    - ${skill}`);
    }
  }
  if (result.hasHooks) {
    log("  Hooks: enabled");
  }
}
