import path from "path";
import { stringify as stringifyYaml } from "yaml";
import type {
  AgentConfig,
  AgentDefinition,
  AgentName,
  CompileAgentConfig,
  CompileConfig,
  MergedSkillsMatrix,
  ProjectConfig,
  SkillDefinition,
  SkillId,
  Stack,
} from "../../types";
import type { WizardResultV2 } from "../../components/wizard/wizard";
import { type CopiedSkill, copySkillsToLocalFlattened, archiveLocalSkill } from "../skills";
import { type MergeResult, mergeWithExistingConfig } from "../configuration";
import {
  loadAllAgents,
  loadPluginSkills,
  loadSkillsByIds,
  type SourceLoadResult,
} from "../loading";
import { loadStackById, compileAgentForPlugin, getStackSkillIds } from "../stacks";
import { resolveAgents, buildSkillRefsFromConfig } from "../resolver";
import { createLiquidEngine } from "../compiler";
import { generateProjectConfigFromSkills, compactStackForYaml } from "../configuration";
import { directoryExists, ensureDir, listDirectories, writeFile } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { typedEntries, typedKeys } from "../../utils/typed-object";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  DEFAULT_PLUGIN_NAME,
  LOCAL_SKILLS_PATH,
  PROJECT_ROOT,
  SCHEMA_PATHS,
  STANDARD_FILES,
  YAML_FORMATTING,
  yamlSchemaComment,
} from "../../consts";

type LocalResolvedSkill = SkillDefinition & {
  content: string;
};

/**
 * Options for the local skill installation pipeline.
 *
 * Passed to {@link installLocal} to drive the full installation flow:
 * skill copying, config generation, agent compilation, and file writing.
 */
export type LocalInstallOptions = {
  /** Wizard output containing selected skills, stack, install mode, and source selections */
  wizardResult: WizardResultV2;
  /** Loaded source data including the skills matrix, source path, and source configuration */
  sourceResult: SourceLoadResult;
  /** Absolute path to the project root where `.claude/` artifacts will be written */
  projectDir: string;
  /** Optional `--source` flag override (e.g., "github:org/repo"). Takes precedence over
   *  source from config when writing the `source` field in config.yaml */
  sourceFlag?: string;
};

/**
 * Result of a completed local skill installation.
 *
 * Returned by {@link installLocal} with details about what was written to disk,
 * enabling the caller to display a summary to the user.
 */
export type LocalInstallResult = {
  /** Skills that were copied to `.claude/skills/`, with source and destination paths */
  copiedSkills: CopiedSkill[];
  /** Final project configuration (may be merged with existing config.yaml) */
  config: ProjectConfig;
  /** Absolute path to the written config.yaml file */
  configPath: string;
  /** Agent names that were compiled and written to `.claude/agents/` */
  compiledAgents: AgentName[];
  /** Whether the config was merged with an existing config.yaml (true) or freshly created (false) */
  wasMerged: boolean;
  /** Absolute path to the pre-existing config.yaml that was merged, if any */
  mergedConfigPath?: string;
  /** Absolute path to the `.claude/skills/` directory */
  skillsDir: string;
  /** Absolute path to the `.claude/agents/` directory */
  agentsDir: string;
};

type InstallPaths = {
  skillsDir: string;
  agentsDir: string;
  configPath: string;
};

function resolveInstallPaths(projectDir: string): InstallPaths {
  return {
    skillsDir: path.join(projectDir, LOCAL_SKILLS_PATH),
    agentsDir: path.join(projectDir, CLAUDE_DIR, "agents"),
    configPath: path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML),
  };
}

async function prepareDirectories(paths: InstallPaths): Promise<void> {
  await ensureDir(paths.skillsDir);
  await ensureDir(paths.agentsDir);
  await ensureDir(path.dirname(paths.configPath));
}

async function archiveAndCopySkills(
  wizardResult: WizardResultV2,
  sourceResult: SourceLoadResult,
  projectDir: string,
  skillsDir: string,
): Promise<CopiedSkill[]> {
  // Archive local skills that are switching to a different source
  for (const skillId of wizardResult.selectedSkills) {
    const selectedSource = wizardResult.sourceSelections?.[skillId];
    if (selectedSource && selectedSource !== "public") {
      verbose(`Using alternate source '${selectedSource}' for ${skillId}`);
      await archiveLocalSkill(projectDir, skillId);
    }
  }

  return copySkillsToLocalFlattened(
    wizardResult.selectedSkills,
    skillsDir,
    sourceResult.matrix,
    sourceResult,
  );
}

function buildLocalSkillsMap(
  copiedSkills: CopiedSkill[],
  matrix: MergedSkillsMatrix,
): Partial<Record<SkillId, LocalResolvedSkill>> {
  const localSkillsForResolution: Partial<Record<SkillId, LocalResolvedSkill>> = {};
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

async function loadMergedAgents(sourcePath: string): Promise<Record<AgentName, AgentDefinition>> {
  const cliAgents = await loadAllAgents(PROJECT_ROOT);
  const sourceAgents = await loadAllAgents(sourcePath);
  // Boundary cast: loadAllAgents returns Record<string, AgentDefinition>, agent dirs are AgentName by convention
  return { ...cliAgents, ...sourceAgents } as Record<AgentName, AgentDefinition>;
}

async function buildLocalConfig(
  wizardResult: WizardResultV2,
  sourceResult: SourceLoadResult,
): Promise<{ config: ProjectConfig; loadedStack: Stack | null }> {
  // Try loading stack from source first, fall back to CLI
  let loadedStack: Stack | null = null;
  if (wizardResult.selectedStackId) {
    loadedStack = await loadStackById(wizardResult.selectedStackId, sourceResult.sourcePath);
    if (!loadedStack) {
      loadedStack = await loadStackById(wizardResult.selectedStackId, PROJECT_ROOT);
    }
  }

  let localConfig: ProjectConfig;

  if (wizardResult.selectedStackId) {
    if (loadedStack) {
      // Use actual selections (may differ from stack defaults after user customization)
      localConfig = generateProjectConfigFromSkills(
        DEFAULT_PLUGIN_NAME,
        wizardResult.selectedSkills,
        sourceResult.matrix,
      );

      // Preserve the stack description and ensure all stack agents are included
      localConfig.description = loadedStack.description;
      const stackAgentIds = typedKeys<AgentName>(loadedStack.agents);
      for (const agentId of stackAgentIds) {
        if (!localConfig.agents.includes(agentId)) {
          localConfig.agents.push(agentId);
        }
      }
      localConfig.agents.sort();
    } else {
      // Stack not found in CLI's config/stacks.yaml
      throw new Error(
        `Stack '${wizardResult.selectedStackId}' not found in config/stacks.yaml. ` +
          `Available stacks are defined in the CLI's config/stacks.yaml file.`,
      );
    }
  } else {
    localConfig = generateProjectConfigFromSkills(
      DEFAULT_PLUGIN_NAME,
      wizardResult.selectedSkills,
      sourceResult.matrix,
    );
  }

  return { config: localConfig, loadedStack };
}

function setConfigMetadata(
  config: ProjectConfig,
  wizardResult: WizardResultV2,
  sourceResult: SourceLoadResult,
  sourceFlag?: string,
): void {
  config.installMode = wizardResult.installMode;

  if (sourceFlag) {
    config.source = sourceFlag;
  } else if (sourceResult.sourceConfig.source) {
    config.source = sourceResult.sourceConfig.source;
  }

  if (sourceResult.marketplace) {
    config.marketplace = sourceResult.marketplace;
  }
}

async function buildAndMergeConfig(
  wizardResult: WizardResultV2,
  sourceResult: SourceLoadResult,
  projectDir: string,
  sourceFlag?: string,
): Promise<MergeResult> {
  const { config } = await buildLocalConfig(wizardResult, sourceResult);
  setConfigMetadata(config, wizardResult, sourceResult, sourceFlag);
  return mergeWithExistingConfig(config, { projectDir });
}

async function writeConfigFile(config: ProjectConfig, configPath: string): Promise<void> {
  const schemaComment = `${yamlSchemaComment(SCHEMA_PATHS.projectConfig)}\n`;
  // Compact stack for YAML output: bare strings for simple skills, objects for preloaded
  const serializable = config.stack
    ? { ...config, stack: compactStackForYaml(config.stack) }
    : config;
  const configYaml = stringifyYaml(serializable, {
    indent: YAML_FORMATTING.INDENT,
    lineWidth: YAML_FORMATTING.LINE_WIDTH,
  });
  await writeFile(configPath, `${schemaComment}${configYaml}`);
}

function buildCompileAgents(
  config: ProjectConfig,
  agents: Record<AgentName, AgentDefinition>,
): Record<AgentName, CompileAgentConfig> {
  const compileAgents: Record<AgentName, CompileAgentConfig> = {} as Record<
    AgentName,
    CompileAgentConfig
  >;
  for (const agentId of config.agents) {
    if (agents[agentId]) {
      const agentStack = config.stack?.[agentId];
      compileAgents[agentId] = agentStack ? { skills: buildSkillRefsFromConfig(agentStack) } : {};
    }
  }
  return compileAgents;
}

async function compileAndWriteAgents(
  compileConfig: CompileConfig,
  agents: Record<AgentName, AgentDefinition>,
  localSkills: Partial<Record<SkillId, LocalResolvedSkill>>,
  sourceResult: SourceLoadResult,
  projectDir: string,
  agentsDir: string,
  installMode?: "plugin" | "local",
): Promise<AgentName[]> {
  const engine = await createLiquidEngine(projectDir);
  const resolvedAgents = await resolveAgents(
    agents,
    localSkills,
    compileConfig,
    sourceResult.sourcePath,
  );

  const compiledAgentNames: AgentName[] = [];
  for (const [name, agent] of typedEntries<AgentName, AgentConfig>(resolvedAgents)) {
    const output = await compileAgentForPlugin(
      name,
      agent,
      sourceResult.sourcePath,
      engine,
      installMode,
    );
    await writeFile(path.join(agentsDir, `${name}.md`), output);
    compiledAgentNames.push(name);
  }

  return compiledAgentNames;
}

/**
 * Result of a plugin config installation (no skill copying).
 *
 * Returned by {@link installPluginConfig} with details about what was written to disk,
 * enabling the caller to display a summary to the user.
 */
export type PluginConfigResult = {
  /** Final project configuration (may be merged with existing config.yaml) */
  config: ProjectConfig;
  /** Absolute path to the written config.yaml file */
  configPath: string;
  /** Agent names that were compiled and written to `.claude/agents/` */
  compiledAgents: AgentName[];
  /** Whether the config was merged with an existing config.yaml (true) or freshly created (false) */
  wasMerged: boolean;
  /** Absolute path to the pre-existing config.yaml that was merged, if any */
  mergedConfigPath?: string;
  /** Absolute path to the `.claude/agents/` directory */
  agentsDir: string;
};

/**
 * Generates config and compiles agents for plugin mode (without copying skills).
 *
 * Used when skills are installed as native plugins and should NOT be copied
 * to `.claude/skills/`. This function performs only:
 * 1. Creates `.claude/agents/` and `.claude-src/` directories
 * 2. Loads agent definitions from both the CLI and source repository
 * 3. Generates project config.yaml from the wizard selections, merging with any
 *    existing config
 * 4. Writes config.yaml with YAML schema comment
 * 5. Compiles agent markdown files using Liquid templates and writes them to
 *    `.claude/agents/`
 *
 * @param options - Installation options containing wizard result, source data,
 *                  project directory, and optional source flag override
 * @returns Result containing config and agent artifacts (no skills)
 * @throws {Error} If the selected stack ID is not found in config/stacks.yaml
 */
export async function installPluginConfig(
  options: LocalInstallOptions,
): Promise<PluginConfigResult> {
  const { wizardResult, sourceResult, projectDir, sourceFlag } = options;

  const paths = resolveInstallPaths(projectDir);
  // Only create agents and config directories, NOT skills directory
  await ensureDir(paths.agentsDir);
  await ensureDir(path.dirname(paths.configPath));

  const agents = await loadMergedAgents(sourceResult.sourcePath);
  const mergeResult = await buildAndMergeConfig(wizardResult, sourceResult, projectDir, sourceFlag);
  const finalConfig = mergeResult.config;

  await writeConfigFile(finalConfig, paths.configPath);

  const compileAgentsConfig = buildCompileAgents(finalConfig, agents);
  const compileConfig: CompileConfig = {
    name: DEFAULT_PLUGIN_NAME,
    description:
      finalConfig.description || `Plugin setup with ${wizardResult.selectedSkills.length} skills`,
    agents: compileAgentsConfig,
  };
  // Load skill metadata from source for compilation
  // (actual skill content will be loaded from plugins at runtime)
  const stackSkillIds = finalConfig.stack ? getStackSkillIds(finalConfig.stack) : [];
  const skillsForCompilation = (await loadSkillsByIds(
    stackSkillIds.map((id) => ({ id })),
    sourceResult.sourcePath,
  )) as Partial<Record<SkillId, LocalResolvedSkill>>;

  const compiledAgentNames = await compileAndWriteAgents(
    compileConfig,
    agents,
    skillsForCompilation,
    sourceResult,
    projectDir,
    paths.agentsDir,
    wizardResult.installMode,
  );

  return {
    config: finalConfig,
    configPath: paths.configPath,
    compiledAgents: compiledAgentNames,
    wasMerged: mergeResult.merged,
    mergedConfigPath: mergeResult.existingConfigPath,
    agentsDir: paths.agentsDir,
  };
}

/**
 * Executes the full local skill installation pipeline.
 *
 * This is the main entry point for the "local" install mode (as opposed to plugin mode).
 * It performs the following steps in order:
 * 1. Creates `.claude/skills/` and `.claude/agents/` directories
 * 2. Archives local skills switching to alternate sources, then copies selected
 *    skills from the source repository into `.claude/skills/` (flattened layout)
 * 3. Loads agent definitions from both the CLI and source repository
 * 4. Generates project config.yaml from the wizard selections, merging with any
 *    existing config
 * 5. Writes config.yaml with YAML schema comment
 * 6. Compiles agent markdown files using Liquid templates and writes them to
 *    `.claude/agents/`
 *
 * @param options - Installation options containing wizard result, source data,
 *                  project directory, and optional source flag override
 * @returns Result containing all written artifacts (skills, config, agents) and
 *          metadata about the installation (merge status, paths)
 * @throws {Error} If the selected stack ID is not found in config/stacks.yaml
 *
 * @remarks
 * **Side effects:** Creates directories and writes files under `{projectDir}/.claude/`.
 * May archive existing local skills to `.claude/.archived-skills/` when source
 * selections differ from the current installation.
 */
export async function installLocal(options: LocalInstallOptions): Promise<LocalInstallResult> {
  const { wizardResult, sourceResult, projectDir, sourceFlag } = options;

  const paths = resolveInstallPaths(projectDir);
  await prepareDirectories(paths);

  const copiedSkills = await archiveAndCopySkills(
    wizardResult,
    sourceResult,
    projectDir,
    paths.skillsDir,
  );
  const localSkillsForResolution = buildLocalSkillsMap(copiedSkills, sourceResult.matrix);

  const agents = await loadMergedAgents(sourceResult.sourcePath);
  const mergeResult = await buildAndMergeConfig(wizardResult, sourceResult, projectDir, sourceFlag);
  const finalConfig = mergeResult.config;

  await writeConfigFile(finalConfig, paths.configPath);

  const compileAgentsConfig = buildCompileAgents(finalConfig, agents);
  const compileConfig: CompileConfig = {
    name: DEFAULT_PLUGIN_NAME,
    description:
      finalConfig.description || `Local setup with ${wizardResult.selectedSkills.length} skills`,
    agents: compileAgentsConfig,
  };
  const compiledAgentNames = await compileAndWriteAgents(
    compileConfig,
    agents,
    localSkillsForResolution,
    sourceResult,
    projectDir,
    paths.agentsDir,
    wizardResult.installMode,
  );

  return {
    copiedSkills,
    config: finalConfig,
    configPath: paths.configPath,
    compiledAgents: compiledAgentNames,
    wasMerged: mergeResult.merged,
    mergedConfigPath: mergeResult.existingConfigPath,
    skillsDir: paths.skillsDir,
    agentsDir: paths.agentsDir,
  };
}
