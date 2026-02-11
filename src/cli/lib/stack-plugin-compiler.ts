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
} from "../utils/fs";
import { verbose } from "../utils/logger";
import { DIRS, PROJECT_ROOT, DEFAULT_VERSION } from "../consts";
import { createLiquidEngine } from "./compiler";
import {
  generateStackPluginManifest,
  writePluginManifest,
  getPluginManifestPath,
} from "./plugin-manifest";
import { loadSkillsByIds, loadAllAgents } from "./loader";
import { loadStackById, resolveAgentConfigToSkills } from "./stacks-loader";
import { loadSkillsMatrix } from "./matrix-loader";
import { SKILLS_MATRIX_PATH } from "../consts";
import { resolveAgents, stackToCompileConfig } from "./resolver";
import { buildStackProperty } from "./config-generator";
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
} from "../types";
import { hashString } from "./versioning";
import { pluginManifestSchema } from "./schemas";
import { unique } from "remeda";
import { typedEntries, typedKeys } from "../utils/typed-object";

const CONTENT_HASH_FILE = ".content-hash";

function parseMajorVersion(version: string): number {
  const match = version.match(/^(\d+)\./);
  return match ? parseInt(match[1], 10) : 1;
}

function bumpMajorVersion(version: string): string {
  const major = parseMajorVersion(version);
  return `${major + 1}.0.0`;
}

async function readExistingManifest(
  pluginDir: string,
): Promise<{ version: string; contentHash: string | undefined } | null> {
  const manifestPath = getPluginManifestPath(pluginDir);

  if (!(await fileExists(manifestPath))) {
    return null;
  }

  try {
    const content = await readFile(manifestPath);
    const manifest = pluginManifestSchema.parse(JSON.parse(content));

    const hashFilePath = manifestPath.replace("plugin.json", CONTENT_HASH_FILE);
    let contentHash: string | undefined;
    if (await fileExists(hashFilePath)) {
      contentHash = (await readFile(hashFilePath)).trim();
    }

    return {
      version: manifest.version ?? DEFAULT_VERSION,
      contentHash,
    };
  } catch {
    return null;
  }
}

function hashStackConfig(stack: ProjectConfig): string {
  // Collect unique skill IDs from stack property
  const stackSkillIds = stack.stack
    ? [...new Set(Object.values(stack.stack).flatMap((a) => Object.values(a)))].sort()
    : [];
  const parts: string[] = [
    `name:${stack.name}`,
    `description:${stack.description ?? ""}`,
    `skills:${stackSkillIds.join(",")}`,
    `agents:${(stack.agents || []).sort().join(",")}`,
  ];
  return hashString(parts.join("\n"));
}

async function determineStackVersion(
  stack: ProjectConfig,
  pluginDir: string,
): Promise<{ version: string; contentHash: string }> {
  const newHash = hashStackConfig(stack);

  const existing = await readExistingManifest(pluginDir);

  if (!existing) {
    return {
      version: DEFAULT_VERSION,
      contentHash: newHash,
    };
  }

  if (existing.contentHash !== newHash) {
    return {
      version: bumpMajorVersion(existing.version),
      contentHash: newHash,
    };
  }

  return {
    version: existing.version,
    contentHash: newHash,
  };
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
): Promise<string> {
  verbose(`Compiling agent: ${name}`);

  // Use agent's sourceRoot if available (for multi-source loading), otherwise fallback
  const agentSourceRoot = agent.sourceRoot || fallbackRoot;
  // Use agent's agentBaseDir if available (for project agents in .claude-src/agents/)
  const agentBaseDir = agent.agentBaseDir || DIRS.agents;
  const agentDir = path.join(agentSourceRoot, agentBaseDir, agent.path || name);

  const intro = await readFile(path.join(agentDir, "intro.md"));
  const workflow = await readFile(path.join(agentDir, "workflow.md"));
  const examples = await readFileOptional(
    path.join(agentDir, "examples.md"),
    "## Examples\n\n_No examples defined._",
  );
  const criticalRequirementsTop = await readFileOptional(
    path.join(agentDir, "critical-requirements.md"),
    "",
  );
  const criticalReminders = await readFileOptional(
    path.join(agentDir, "critical-reminders.md"),
    "",
  );

  const agentPath = agent.path || name;
  const category = agentPath.split("/")[0];
  const categoryDir = path.join(agentSourceRoot, agentBaseDir, category);

  let outputFormat = await readFileOptional(path.join(agentDir, "output-format.md"), "");
  if (!outputFormat) {
    outputFormat = await readFileOptional(path.join(categoryDir, "output-format.md"), "");
  }

  const preloadedSkills = agent.skills.filter((s) => s.preloaded);
  const dynamicSkills = agent.skills.filter((s) => !s.preloaded);

  const preloadedSkillIds = preloadedSkills.map((s) => s.id);

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
    skills: agent.skills,
    preloadedSkills,
    dynamicSkills,
    preloadedSkillIds,
  };

  return engine.renderFile("agent", data);
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
  lines.push(`{`);
  lines.push(`  "plugins": ["${stackId}"]`);
  lines.push(`}`);
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

  // Load agents from both local project and CLI, with local taking precedence
  const cliAgents = await loadAllAgents(PROJECT_ROOT);
  const localAgents = await loadAllAgents(localAgentRoot);
  // Boundary cast: loadAllAgents returns Record<string, AgentDefinition>, agent dirs are AgentName by convention
  const agents = { ...cliAgents, ...localAgents } as Record<AgentName, AgentDefinition>;

  verbose(
    `  Loaded ${Object.keys(localAgents).length} local agents, ${Object.keys(cliAgents).length} CLI agents`,
  );

  // Use provided stack or load from CLI's config/stacks.yaml
  const newStack = options.stack || (await loadStackById(stackId, PROJECT_ROOT));

  // Load skill aliases from the matrix to resolve technology aliases to skill IDs
  // This is needed for Phase 7 skill resolution in resolveAgents
  const matrixPath = path.join(PROJECT_ROOT, SKILLS_MATRIX_PATH);
  const matrix = await loadSkillsMatrix(matrixPath);
  const skillAliases = matrix.skill_aliases || {};

  let stack: ProjectConfig;
  if (newStack) {
    verbose(`  Found stack: ${newStack.name}`);

    // Extract skills from stack's agent configurations (Phase 7: skills in stacks, not agents)
    const agentSkillIds = new Set<SkillId>();
    for (const agentName of typedKeys<AgentName>(newStack.agents)) {
      const agentConfig = newStack.agents[agentName];
      if (!agentConfig) continue;
      const skillRefs = resolveAgentConfigToSkills(agentConfig, skillAliases);
      for (const ref of skillRefs) {
        agentSkillIds.add(ref.id);
      }
    }

    // Build ProjectConfig for rest of function
    stack = {
      name: newStack.name,
      description: newStack.description,
      agents: typedKeys<AgentName>(newStack.agents),
      stack: buildStackProperty(newStack, skillAliases) as ProjectConfig["stack"],
    };
  } else {
    throw new Error(`Stack '${stackId}' not found in config/stacks.yaml`);
  }

  // Collect unique skill IDs from stack property for loading
  const stackSkillIds = stack.stack
    ? [...new Set(Object.values(stack.stack).flatMap((a) => Object.values(a)))]
    : [];
  // Boundary cast: loadSkillsByIds returns Record<string, SkillDefinition>, keys are SkillId by construction
  const skills = (await loadSkillsByIds(
    stackSkillIds.map((id) => ({ id })),
    projectRoot,
  )) as Record<SkillId, SkillDefinition>;

  const compileConfig: CompileConfig = stackToCompileConfig(stackId, stack);

  // Pass newStack and skillAliases for Phase 7 skill resolution
  const resolvedAgents = await resolveAgents(
    agents,
    skills,
    compileConfig,
    projectRoot,
    newStack,
    skillAliases,
  );

  const pluginDir = path.join(outputDir, stackId);
  const agentsDir = path.join(pluginDir, "agents");

  await ensureDir(pluginDir);
  await ensureDir(agentsDir);

  const pluginSkillsDir = path.join(pluginDir, "skills");
  await ensureDir(pluginSkillsDir);

  const copiedSourcePaths = new Set<string>();

  for (const [, resolvedSkill] of Object.entries(skills)) {
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
  const claudeMdPath = path.join(stackDir, "CLAUDE.md");
  if (await fileExists(claudeMdPath)) {
    const claudeContent = await readFile(claudeMdPath);
    await writeFile(path.join(pluginDir, "CLAUDE.md"), claudeContent);
    verbose(`  Copied CLAUDE.md`);
  }

  const { version, contentHash } = await determineStackVersion(stack, pluginDir);

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

  const hashFilePath = getPluginManifestPath(pluginDir).replace("plugin.json", CONTENT_HASH_FILE);
  await writeFile(hashFilePath, contentHash);

  verbose(`  Wrote plugin.json (v${version})`);

  const readme = generateStackReadme(stackId, stack, compiledAgentNames, uniqueSkillPlugins);
  await writeFile(path.join(pluginDir, "README.md"), readme);
  verbose(`  Generated README.md`);

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
  console.log(`\nStack plugin compiled: ${result.stackName}`);
  console.log(`  Path: ${result.pluginPath}`);
  console.log(`  Agents: ${result.agents.length}`);
  for (const agent of result.agents) {
    console.log(`    - ${agent}`);
  }
  if (result.skillPlugins.length > 0) {
    console.log(`  Skills included: ${result.skillPlugins.length}`);
    for (const skill of result.skillPlugins) {
      console.log(`    - ${skill}`);
    }
  }
  if (result.hasHooks) {
    console.log(`  Hooks: enabled`);
  }
}
