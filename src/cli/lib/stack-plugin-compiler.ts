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
import type { Stack } from "../types-stacks";
import { hashString, getCurrentDate } from "./versioning";
import type {
  PluginManifest,
  ProjectConfig,
  AgentConfig,
  CompileConfig,
  Skill,
  CompiledAgentData,
  AgentHookDefinition,
} from "../../types";
import type { SkillId } from "../types-matrix";

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
    const manifest = JSON.parse(content) as PluginManifest;

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
  const parts: string[] = [
    `name:${stack.name}`,
    `description:${stack.description ?? ""}`,
    `skills:${(stack.skills || [])
      .map((s) => (typeof s === "string" ? s : s.id))
      .sort()
      .join(",")}`,
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

export interface StackPluginOptions {
  stackId: string;
  outputDir: string;
  projectRoot: string;
  agentSourcePath?: string;
  /** Optional stack configuration - if provided, bypasses loading from config/stacks.yaml */
  stack?: Stack;
}

export interface CompiledStackPlugin {
  pluginPath: string;
  manifest: PluginManifest;
  stackName: string;
  agents: string[];
  skillPlugins: string[];
  hasHooks: boolean;
}

export async function compileAgentForPlugin(
  name: string,
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
  agents: string[],
  skillPlugins: string[],
): string {
  const lines: string[] = [];

  lines.push(`# ${stack.name}`);
  lines.push("");
  lines.push(stack.description || "A Claude Code stack plugin.");
  lines.push("");

  if (stack.tags && stack.tags.length > 0) {
    lines.push("## Tags");
    lines.push("");
    lines.push(stack.tags.map((t) => `\`${t}\``).join(" "));
    lines.push("");
  }

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
    const uniqueSkills = [...new Set(skillPlugins)].sort();
    for (const skill of uniqueSkills) {
      lines.push(`- \`${skill}\``);
    }
    lines.push("");
  }

  if (stack.philosophy) {
    lines.push("## Philosophy");
    lines.push("");
    lines.push(stack.philosophy);
    lines.push("");
  }

  if (stack.principles && stack.principles.length > 0) {
    lines.push("## Principles");
    lines.push("");
    for (const principle of stack.principles) {
      lines.push(`- ${principle}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("*Generated by Claude Collective stack-plugin-compiler*");
  lines.push("");

  return lines.join("\n");
}

interface HooksJsonOutput {
  hooks: Record<string, AgentHookDefinition[]>;
}

function stackHasHooks(stack: ProjectConfig): boolean {
  return stack.hooks !== undefined && Object.keys(stack.hooks).length > 0;
}

function generateHooksJson(hooks: Record<string, AgentHookDefinition[]>): string {
  const output: HooksJsonOutput = { hooks };
  return JSON.stringify(output, null, 2);
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
  const agents = { ...cliAgents, ...localAgents };

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
    const agentSkillIds = new Set<string>();
    for (const agentName of Object.keys(newStack.agents)) {
      const agentConfig = newStack.agents[agentName];
      const skillRefs = resolveAgentConfigToSkills(agentConfig, skillAliases);
      for (const ref of skillRefs) {
        agentSkillIds.add(ref.id);
      }
    }

    // Build ProjectConfig for rest of function
    stack = {
      name: newStack.name,
      description: newStack.description,
      skills: Array.from(agentSkillIds).map((id) => ({ id: id as SkillId })),
      agents: Object.keys(newStack.agents),
      philosophy: newStack.philosophy,
    };
  } else {
    throw new Error(`Stack '${stackId}' not found in config/stacks.yaml`);
  }

  const normalizedSkillIds = (stack.skills || []).map((s) =>
    typeof s === "string" ? { id: s } : s,
  );
  const skills = await loadSkillsByIds(normalizedSkillIds, projectRoot);

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

    const destSkillDir = path.join(pluginSkillsDir, resolvedSkill.canonicalId);

    if (await directoryExists(sourceSkillDir)) {
      await copy(sourceSkillDir, destSkillDir);
      copiedSourcePaths.add(resolvedSkill.path);
      verbose(`  Copied skill: ${resolvedSkill.canonicalId}`);
    } else {
      verbose(`  Warning: Skill directory not found: ${sourceSkillDir}`);
    }
  }

  const engine = await createLiquidEngine();

  const compiledAgentNames: string[] = [];
  const allSkillPlugins: string[] = [];

  for (const [name, agent] of Object.entries(resolvedAgents)) {
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

  const hasHooks = stackHasHooks(stack);
  if (hasHooks && stack.hooks) {
    const hooksDir = path.join(pluginDir, "hooks");
    await ensureDir(hooksDir);
    const hooksJson = generateHooksJson(stack.hooks);
    await writeFile(path.join(hooksDir, "hooks.json"), hooksJson);
    verbose(`  Generated hooks/hooks.json`);
  }

  const { version, contentHash } = await determineStackVersion(stack, pluginDir);

  const uniqueSkillPlugins = [...new Set(allSkillPlugins)];
  const manifest = generateStackPluginManifest({
    stackName: stackId,
    description: stack.description,
    author: stack.author,
    version,
    keywords: stack.tags,
    hasAgents: true,
    hasHooks,
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
    hasHooks,
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
