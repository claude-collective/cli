/**
 * Local mode installation: copy skills, build config, compile agents.
 *
 * This module extracts the local installation logic from init.tsx into
 * a pure function that does the work and returns a result object.
 * The command file handles all logging based on the result.
 */
import path from "path";
import { stringify as stringifyYaml } from "yaml";
import type {
  CompileConfig,
  CompileAgentConfig,
  ProjectConfig,
  AgentDefinition,
  AgentConfig,
  SkillDefinition,
} from "../../types";
import type { SourceLoadResult } from "./source-loader";
import type { WizardResultV2 } from "../components/wizard/wizard";
import type { CopiedSkill } from "./skill-copier";
import type { Stack } from "../types-stacks";
import type { AgentName, MergedSkillsMatrix, SkillId } from "../types-matrix";
import { copySkillsToLocalFlattened } from "./skill-copier";
import { mergeWithExistingConfig } from "./config-merger";
import { loadAllAgents } from "./loader";
import { loadStackById } from "./stacks-loader";
import { resolveAgents, resolveAgentSkillsFromStack } from "./resolver";
import { compileAgentForPlugin } from "./stack-plugin-compiler";
import { createLiquidEngine } from "./compiler";
import { generateProjectConfigFromSkills, buildStackProperty } from "./config-generator";
import { ensureDir, writeFile } from "../utils/fs";
import { typedEntries, typedKeys } from "../utils/typed-object";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, LOCAL_SKILLS_PATH, PROJECT_ROOT } from "../consts";

const PLUGIN_NAME = "claude-collective";

const YAML_INDENT = 2;
const YAML_LINE_WIDTH = 120;

/**
 * Resolved local skill for agent compilation.
 * Extends SkillDefinition with content field.
 */
type LocalResolvedSkill = SkillDefinition & {
  content: string;
};

export type LocalInstallOptions = {
  /** Wizard result with selected skills and mode */
  wizardResult: WizardResultV2;
  /** Source load result with matrix and paths */
  sourceResult: SourceLoadResult;
  /** Project directory (cwd) */
  projectDir: string;
  /** Source flag value (if provided) */
  sourceFlag?: string;
};

export type LocalInstallResult = {
  /** Skills that were copied */
  copiedSkills: CopiedSkill[];
  /** Final merged project config */
  config: ProjectConfig;
  /** Path where config was saved */
  configPath: string;
  /** Names of compiled agents */
  compiledAgents: AgentName[];
  /** Whether config was merged with existing */
  wasMerged: boolean;
  /** Path to the existing config that was merged with, if any */
  mergedConfigPath?: string;
  /** Local skills directory path */
  skillsDir: string;
  /** Local agents directory path */
  agentsDir: string;
};

/**
 * Build a map of local skills for resolution during agent compilation.
 */
function buildLocalSkillsMap(
  copiedSkills: CopiedSkill[],
  matrix: MergedSkillsMatrix,
): Record<SkillId, LocalResolvedSkill> {
  const localSkillsForResolution: Record<SkillId, LocalResolvedSkill> = {} as Record<
    SkillId,
    LocalResolvedSkill
  >;
  for (const copiedSkill of copiedSkills) {
    const skill = matrix.skills[copiedSkill.skillId];
    if (skill) {
      localSkillsForResolution[copiedSkill.skillId] = {
        id: copiedSkill.skillId,
        description: skill.description || "",
        path: copiedSkill.destPath,
        content: "", // Content not needed for skill references
      };
    }
  }
  return localSkillsForResolution;
}

/**
 * Build the initial ProjectConfig from wizard result.
 * Uses stack config if a stack was selected, otherwise generates from individual skills.
 */
async function buildLocalConfig(
  wizardResult: WizardResultV2,
  sourceResult: SourceLoadResult,
  displayNameToId: Record<string, string>,
): Promise<{ config: ProjectConfig; loadedStack: Stack | null }> {
  const loadedStack = wizardResult.selectedStackId
    ? await loadStackById(wizardResult.selectedStackId, PROJECT_ROOT)
    : null;

  let localConfig: ProjectConfig;

  if (wizardResult.selectedStackId) {
    if (loadedStack) {
      // Phase 7 format: Stack agents are Partial<Record<AgentName, StackAgentConfig>>
      const agentIds = typedKeys<AgentName>(loadedStack.agents);

      // Build resolved stack property with agent->skill mappings
      const stackProperty = buildStackProperty(loadedStack, displayNameToId);

      localConfig = {
        name: PLUGIN_NAME,
        installMode: wizardResult.installMode,
        description: loadedStack.description,
        agents: agentIds,
        stack: stackProperty as ProjectConfig["stack"],
      };
    } else {
      // Stack not found in CLI's config/stacks.yaml
      throw new Error(
        `Stack '${wizardResult.selectedStackId}' not found in config/stacks.yaml. ` +
          `Available stacks are defined in the CLI's config/stacks.yaml file.`,
      );
    }
  } else {
    localConfig = generateProjectConfigFromSkills(
      PLUGIN_NAME,
      wizardResult.selectedSkills,
      sourceResult.matrix,
    );
  }

  return { config: localConfig, loadedStack };
}

/**
 * Set metadata fields on the config (installMode, source, marketplace).
 */
function setConfigMetadata(
  config: ProjectConfig,
  wizardResult: WizardResultV2,
  sourceResult: SourceLoadResult,
  sourceFlag?: string,
): void {
  // Add installMode to config
  config.installMode = wizardResult.installMode;

  // Add source to config (flag overrides resolved source, but always include it)
  if (sourceFlag) {
    config.source = sourceFlag;
  } else if (sourceResult.sourceConfig.source) {
    config.source = sourceResult.sourceConfig.source;
  }

  // Add marketplace if available from resolved config
  if (sourceResult.marketplace) {
    config.marketplace = sourceResult.marketplace;
  }
}

/**
 * Build CompileAgentConfig map for agent compilation.
 */
function buildCompileAgents(
  config: ProjectConfig,
  agents: Record<AgentName, AgentDefinition>,
  loadedStack: Stack | null,
  displayNameToId: Record<string, string>,
  localSkills: Record<SkillId, LocalResolvedSkill>,
): Record<AgentName, CompileAgentConfig> {
  const compileAgents: Record<AgentName, CompileAgentConfig> = {} as Record<
    AgentName,
    CompileAgentConfig
  >;
  for (const agentId of config.agents) {
    if (agents[agentId]) {
      // Phase 7: Skills come from stack's technology mappings
      if (loadedStack) {
        const skillRefs = resolveAgentSkillsFromStack(agentId, loadedStack, displayNameToId);
        compileAgents[agentId] = { skills: skillRefs };
      } else {
        // No stack: empty skills
        compileAgents[agentId] = {};
      }
    }
  }
  return compileAgents;
}

/**
 * Compile agents and write them to the agents directory.
 */
async function compileAndWriteAgents(
  compileConfig: CompileConfig,
  agents: Record<AgentName, AgentDefinition>,
  localSkills: Record<SkillId, LocalResolvedSkill>,
  sourceResult: SourceLoadResult,
  loadedStack: Stack | null,
  displayNameToId: Record<string, string>,
  projectDir: string,
  agentsDir: string,
): Promise<AgentName[]> {
  const engine = await createLiquidEngine(projectDir);
  const resolvedAgents = await resolveAgents(
    agents,
    localSkills,
    compileConfig,
    sourceResult.sourcePath,
    loadedStack ?? undefined,
    displayNameToId,
  );

  const compiledAgentNames: AgentName[] = [];
  for (const [name, agent] of typedEntries<AgentName, AgentConfig>(resolvedAgents)) {
    const output = await compileAgentForPlugin(name, agent, sourceResult.sourcePath, engine);
    await writeFile(path.join(agentsDir, `${name}.md`), output);
    compiledAgentNames.push(name);
  }

  return compiledAgentNames;
}

/**
 * Install in Local Mode: copy skills, generate config, compile agents.
 *
 * Steps:
 * 1. Create directories (.claude/skills, .claude/agents, .claude-src/)
 * 2. Copy selected skills to .claude/skills/ (flattened)
 * 3. Generate project config from skills/stack selection
 * 4. Set source, marketplace, installMode on config
 * 5. Merge with existing project config (if any)
 * 6. Write config to .claude-src/config.yaml
 * 7. Compile agents to .claude/agents/
 *
 * Returns structured result for the caller to format output.
 */
export async function installLocal(options: LocalInstallOptions): Promise<LocalInstallResult> {
  const { wizardResult, sourceResult, projectDir, sourceFlag } = options;
  const matrix = sourceResult.matrix;
  const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_PATH);
  const localAgentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  const localConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, "config.yaml");

  // 1. Create directories
  await ensureDir(localSkillsDir);
  await ensureDir(localAgentsDir);
  await ensureDir(path.dirname(localConfigPath));

  // 2. Copy selected skills
  const copiedSkills = await copySkillsToLocalFlattened(
    wizardResult.selectedSkills,
    localSkillsDir,
    matrix,
    sourceResult,
  );

  // 3. Build local skills map for resolution
  const localSkillsForResolution = buildLocalSkillsMap(copiedSkills, matrix);
  const displayNameToId = matrix.displayNameToId || {};

  // 4. Load agents from both CLI and source, with source taking precedence
  const cliAgents = await loadAllAgents(PROJECT_ROOT);
  const localAgents = await loadAllAgents(sourceResult.sourcePath);
  // Boundary cast: loadAllAgents returns Record<string, AgentDefinition>, agent dirs are AgentName by convention
  const agents = { ...cliAgents, ...localAgents } as Record<AgentName, AgentDefinition>;

  // 5. Build config
  const { config: builtConfig, loadedStack } = await buildLocalConfig(
    wizardResult,
    sourceResult,
    displayNameToId,
  );

  // 6. Set metadata
  setConfigMetadata(builtConfig, wizardResult, sourceResult, sourceFlag);

  // 7. Merge with existing config
  const mergeResult = await mergeWithExistingConfig(builtConfig, { projectDir });
  const finalConfig = mergeResult.config;

  // 8. Write config
  const configYaml = stringifyYaml(finalConfig, {
    indent: YAML_INDENT,
    lineWidth: YAML_LINE_WIDTH,
  });
  await writeFile(localConfigPath, configYaml);

  // 9. Build compile agents config
  const compileAgentsConfig = buildCompileAgents(
    finalConfig,
    agents,
    loadedStack,
    displayNameToId,
    localSkillsForResolution,
  );

  const compileConfig: CompileConfig = {
    name: PLUGIN_NAME,
    description:
      finalConfig.description || `Local setup with ${wizardResult.selectedSkills.length} skills`,
    agents: compileAgentsConfig,
  };

  // 10. Compile and write agents
  const compiledAgentNames = await compileAndWriteAgents(
    compileConfig,
    agents,
    localSkillsForResolution,
    sourceResult,
    loadedStack,
    displayNameToId,
    projectDir,
    localAgentsDir,
  );

  return {
    copiedSkills,
    config: finalConfig,
    configPath: localConfigPath,
    compiledAgents: compiledAgentNames,
    wasMerged: mergeResult.merged,
    mergedConfigPath: mergeResult.existingConfigPath,
    skillsDir: localSkillsDir,
    agentsDir: localAgentsDir,
  };
}
