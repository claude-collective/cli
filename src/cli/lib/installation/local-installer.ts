import path from "path";
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
import type { InstallMode } from "./installation";
import { deriveInstallMode } from "./installation";
import type { AgentScopeConfig, SkillConfig } from "../../types/config";
import type { WizardResultV2 } from "../../components/wizard/wizard";
import { type CopiedSkill, copySkillsToLocalFlattened, deleteLocalSkill } from "../skills";
import { type MergeResult, mergeWithExistingConfig } from "../configuration";
import { loadAllAgents, loadSkillsByIds, type SourceLoadResult } from "../loading";
import { loadStackById, compileAgentForPlugin, getStackSkillIds } from "../stacks";
import { defaultStacks } from "../configuration/default-stacks";
import { resolveAgents, buildSkillRefsFromConfig } from "../resolver";
import { createLiquidEngine } from "../compiler";
import { generateProjectConfigFromSkills, buildStackProperty } from "../configuration";
import { generateConfigSource, type ConfigSourceOptions } from "../configuration/config-writer";
import { generateConfigTypesSource } from "../configuration/config-types-writer";
import { ensureDir, writeFile } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { typedEntries, typedKeys } from "../../utils/typed-object";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  DEFAULT_PLUGIN_NAME,
  GLOBAL_INSTALL_ROOT,
  LOCAL_SKILLS_PATH,
  PROJECT_ROOT,
  STANDARD_FILES,
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
   *  source from config when writing the `source` field in config.ts */
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
  /** Final project configuration (may be merged with existing config.ts) */
  config: ProjectConfig;
  /** Absolute path to the written config.ts file */
  configPath: string;
  /** Agent names that were compiled and written to `.claude/agents/` */
  compiledAgents: AgentName[];
  /** Whether the config was merged with an existing config.ts (true) or freshly created (false) */
  wasMerged: boolean;
  /** Absolute path to the pre-existing config.ts that was merged, if any */
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

function resolveInstallPaths(
  projectDir: string,
  scope: "project" | "global" = "project",
): InstallPaths {
  const baseDir = scope === "global" ? GLOBAL_INSTALL_ROOT : projectDir;
  return {
    skillsDir: path.join(baseDir, LOCAL_SKILLS_PATH),
    agentsDir: path.join(baseDir, CLAUDE_DIR, "agents"),
    configPath: path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS),
  };
}

async function prepareDirectories(paths: InstallPaths): Promise<void> {
  await ensureDir(paths.skillsDir);
  await ensureDir(paths.agentsDir);
  await ensureDir(path.dirname(paths.configPath));
}

async function deleteAndCopySkills(
  skills: SkillConfig[],
  sourceResult: SourceLoadResult,
  projectDir: string,
  skillsDir: string,
): Promise<CopiedSkill[]> {
  for (const skill of skills) {
    if (skill.source && skill.source !== "local") {
      verbose(`Using alternate source '${skill.source}' for ${skill.id}`);
      await deleteLocalSkill(projectDir, skill.id);
    }
  }

  const skillIds = skills.map((s) => s.id);
  return copySkillsToLocalFlattened(skillIds, skillsDir, sourceResult.matrix, sourceResult);
}

function buildLocalSkillsMap(
  copiedSkills: CopiedSkill[],
  matrix: MergedSkillsMatrix,
): Record<SkillId, LocalResolvedSkill> {
  // Boundary cast: Object.fromEntries returns { [k: string]: V }
  return Object.fromEntries(
    copiedSkills
      .filter((cs) => matrix.skills[cs.skillId])
      .map((cs) => [
        cs.skillId,
        {
          id: cs.skillId,
          description: matrix.skills[cs.skillId]!.description || "",
          path: cs.destPath,
          content: "", // Content not needed for skill references
        },
      ]),
  );
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
  const skillIds = wizardResult.skills.map((s) => s.id);
  verbose(
    `buildLocalConfig: selectedStackId='${wizardResult.selectedStackId}', ` +
      `skills=[${skillIds.join(", ")}], ` +
      `selectedAgents=[${wizardResult.selectedAgents.join(", ")}]`,
  );

  let loadedStack: Stack | null = null;
  if (wizardResult.selectedStackId) {
    loadedStack = await loadStackById(wizardResult.selectedStackId, sourceResult.sourcePath);
    if (!loadedStack) {
      // Fall back to CLI's built-in default stacks
      loadedStack = defaultStacks.find((s) => s.id === wizardResult.selectedStackId) ?? null;
    }
    verbose(
      `buildLocalConfig: loadedStack=${loadedStack ? `found (id='${loadedStack.id}')` : "NOT FOUND"}`,
    );
  }

  let localConfig: ProjectConfig;

  // Pass user's agent selection and skill configs to config generator
  const agentOptions: {
    selectedAgents?: AgentName[];
    skillConfigs: SkillConfig[];
    agentConfigs?: AgentScopeConfig[];
  } = {
    skillConfigs: wizardResult.skills,
    ...(wizardResult.selectedAgents.length > 0 && {
      selectedAgents: wizardResult.selectedAgents,
    }),
    ...(wizardResult.agentConfigs.length > 0 && {
      agentConfigs: wizardResult.agentConfigs,
    }),
  };

  if (wizardResult.selectedStackId) {
    if (loadedStack) {
      // Use actual selections (may differ from stack defaults after user customization)
      localConfig = generateProjectConfigFromSkills(
        DEFAULT_PLUGIN_NAME,
        skillIds,
        sourceResult.matrix,
        agentOptions,
      );

      // Overlay preloaded flags from the stack definition — generateProjectConfigFromSkills
      // defaults all skills to preloaded: false; the stack YAML may define preloaded: true
      if (localConfig.stack) {
        const stackProperty = buildStackProperty(loadedStack);
        for (const [agentId, agentConfig] of typedEntries(stackProperty)) {
          if (!agentConfig) continue;
          for (const [category, assignments] of typedEntries(agentConfig)) {
            if (!assignments) continue;
            const localAgentConfig = localConfig.stack[agentId];
            if (!localAgentConfig?.[category]) continue;
            for (const assignment of localAgentConfig[category]) {
              const stackAssignment = assignments.find((a) => a.id === assignment.id);
              if (stackAssignment?.preloaded) {
                assignment.preloaded = true;
              }
            }
          }
        }
      }

      localConfig.description = loadedStack.description;
      // Only add stack agents that the user selected (or all if no explicit selection)
      const stackAgentIds = typedKeys<AgentName>(loadedStack.agents);
      const existingAgentNames = new Set(localConfig.agents.map((a) => a.name));
      for (const agentId of stackAgentIds) {
        if (
          !existingAgentNames.has(agentId) &&
          (wizardResult.selectedAgents.length === 0 ||
            wizardResult.selectedAgents.includes(agentId))
        ) {
          localConfig.agents.push({ name: agentId, scope: "project" });
        }
      }
      localConfig.agents.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      throw new Error(
        `Stack '${wizardResult.selectedStackId}' not found in config/stacks.ts. ` +
          `Available stacks are defined in the CLI's config/stacks.ts file.`,
      );
    }
  } else {
    localConfig = generateProjectConfigFromSkills(
      DEFAULT_PLUGIN_NAME,
      skillIds,
      sourceResult.matrix,
      agentOptions,
    );
  }

  verbose(
    `buildLocalConfig result: stack=${localConfig.stack ? Object.keys(localConfig.stack).length + " agents" : "UNDEFINED"}, ` +
      `agents=[${localConfig.agents.map((a) => a.name).join(", ")}], skills=${localConfig.skills.length}`,
  );

  return { config: localConfig, loadedStack };
}

export function setConfigMetadata(
  config: ProjectConfig,
  wizardResult: WizardResultV2,
  sourceResult: SourceLoadResult,
  sourceFlag?: string,
): void {
  // Only persist domains when non-empty (sparse output)
  if (wizardResult.selectedDomains && wizardResult.selectedDomains.length > 0) {
    config.domains = wizardResult.selectedDomains;
  }

  // Only persist selectedAgents when non-empty (sparse output)
  if (wizardResult.selectedAgents && wizardResult.selectedAgents.length > 0) {
    config.selectedAgents = wizardResult.selectedAgents;
  }

  if (sourceFlag) {
    config.source = sourceFlag;
  } else if (sourceResult.sourceConfig.source) {
    config.source = sourceResult.sourceConfig.source;
  }

  if (sourceResult.marketplace) {
    config.marketplace = sourceResult.marketplace;
  }
}

export async function buildAndMergeConfig(
  wizardResult: WizardResultV2,
  sourceResult: SourceLoadResult,
  projectDir: string,
  sourceFlag?: string,
): Promise<MergeResult> {
  const { config } = await buildLocalConfig(wizardResult, sourceResult);
  verbose(
    `buildAndMergeConfig: before merge — stack=${config.stack ? Object.keys(config.stack).length + " agents" : "UNDEFINED"}`,
  );
  setConfigMetadata(config, wizardResult, sourceResult, sourceFlag);
  const result = await mergeWithExistingConfig(config, { projectDir });
  verbose(
    `buildAndMergeConfig: after merge — stack=${result.config.stack ? Object.keys(result.config.stack).length + " agents" : "UNDEFINED"}, merged=${result.merged}`,
  );
  return result;
}

export async function writeConfigFile(
  config: ProjectConfig,
  configPath: string,
  options?: ConfigSourceOptions,
): Promise<void> {
  const source = generateConfigSource(config, options);
  await writeFile(configPath, source);
}

function buildCompileAgents(
  config: ProjectConfig,
  agents: Record<AgentName, AgentDefinition>,
): Record<AgentName, CompileAgentConfig> {
  // D7 cross-scope safety net: build set of global skill IDs so global agents only see global skills
  const globalSkillIds = new Set(
    config.skills.filter((s) => s.scope === "global").map((s) => s.id),
  );

  const compileAgents: Record<AgentName, CompileAgentConfig> = {} as Record<
    AgentName,
    CompileAgentConfig
  >;
  for (const agentConfig of config.agents) {
    if (agents[agentConfig.name]) {
      const agentStack = config.stack?.[agentConfig.name];
      if (agentStack) {
        const refs = buildSkillRefsFromConfig(agentStack);
        // Global agents only see global skills (cross-scope safety net)
        const filteredRefs =
          agentConfig.scope === "global" ? refs.filter((ref) => globalSkillIds.has(ref.id)) : refs;
        compileAgents[agentConfig.name] = { skills: filteredRefs };
      } else {
        compileAgents[agentConfig.name] = {};
      }
    }
  }
  return compileAgents;
}

function buildAgentScopeMap(config: ProjectConfig): Map<AgentName, "project" | "global"> {
  const map = new Map<AgentName, "project" | "global">();
  for (const agent of config.agents) {
    map.set(agent.name, agent.scope);
  }
  return map;
}

async function writeConfigTypes(
  configPath: string,
  matrix: MergedSkillsMatrix,
  agents: Record<AgentName, AgentDefinition>,
): Promise<void> {
  const typesPath = path.join(path.dirname(configPath), STANDARD_FILES.CONFIG_TYPES_TS);
  const customAgentNames = typedKeys(agents).filter((name) => agents[name]?.custom === true);
  const source = generateConfigTypesSource(matrix, typedKeys(agents), customAgentNames);
  await writeFile(typesPath, source);
}

async function compileAndWriteAgents(
  compileConfig: CompileConfig,
  agents: Record<AgentName, AgentDefinition>,
  localSkills: Record<SkillId, LocalResolvedSkill>,
  sourceResult: SourceLoadResult,
  projectDir: string,
  agentsDir: string,
  installMode?: InstallMode,
  agentScopeMap?: Map<AgentName, "project" | "global">,
): Promise<AgentName[]> {
  const engine = await createLiquidEngine(projectDir);
  const resolvedAgents = await resolveAgents(
    agents,
    localSkills,
    compileConfig,
    sourceResult.sourcePath,
  );

  const globalAgentsDir = path.join(GLOBAL_INSTALL_ROOT, CLAUDE_DIR, "agents");

  const compiledAgentNames: AgentName[] = [];
  for (const [name, agent] of typedEntries<AgentName, AgentConfig>(resolvedAgents)) {
    const output = await compileAgentForPlugin(
      name,
      agent,
      sourceResult.sourcePath,
      engine,
      installMode,
    );

    // Route agent output by scope: global agents go to GLOBAL_INSTALL_ROOT, project agents to projectDir
    const scope = agentScopeMap?.get(name) ?? "project";
    const targetDir = scope === "global" ? globalAgentsDir : agentsDir;
    if (scope === "global") {
      await ensureDir(targetDir);
    }
    await writeFile(path.join(targetDir, `${name}.md`), output);
    compiledAgentNames.push(name);
  }

  return compiledAgentNames;
}

/** Result of plugin-mode config installation — same as LocalInstallResult without copied skills or skillsDir */
export type PluginConfigResult = Omit<LocalInstallResult, "copiedSkills" | "skillsDir">;

/**
 * Generates config and compiles agents for plugin mode (without copying skills).
 *
 * Used when skills are installed as native plugins and should NOT be copied
 * to `.claude/skills/`. This function performs only:
 * 1. Creates `.claude/agents/` and `.claude-src/` directories
 * 2. Loads agent definitions from both the CLI and source repository
 * 3. Generates project config.ts from the wizard selections, merging with any
 *    existing config
 * 4. Writes config.ts
 * 5. Compiles agent markdown files using Liquid templates and writes them to
 *    `.claude/agents/`
 *
 * @param options - Installation options containing wizard result, source data,
 *                  project directory, and optional source flag override
 * @returns Result containing config and agent artifacts (no skills)
 * @throws {Error} If the selected stack ID is not found in config/stacks.ts
 */
export async function installPluginConfig(
  options: LocalInstallOptions,
): Promise<PluginConfigResult> {
  const { wizardResult, sourceResult, projectDir, sourceFlag } = options;

  const paths = resolveInstallPaths(projectDir);
  await ensureDir(paths.agentsDir);
  await ensureDir(path.dirname(paths.configPath));

  const agents = await loadMergedAgents(sourceResult.sourcePath);
  const mergeResult = await buildAndMergeConfig(wizardResult, sourceResult, projectDir, sourceFlag);
  const finalConfig = mergeResult.config;

  await writeConfigFile(finalConfig, paths.configPath);

  await writeConfigTypes(paths.configPath, sourceResult.matrix, agents);

  const compileAgentsConfig = buildCompileAgents(finalConfig, agents);
  const compileConfig: CompileConfig = {
    name: DEFAULT_PLUGIN_NAME,
    description:
      finalConfig.description || `Plugin setup with ${wizardResult.skills.length} skills`,
    agents: compileAgentsConfig,
  };
  // Load skill metadata from source for compilation
  // (actual skill content will be loaded from plugins at runtime)
  const stackSkillIds = finalConfig.stack ? getStackSkillIds(finalConfig.stack) : [];
  // Boundary cast: loadSkillsByIds returns SkillDefinitionMap, LocalResolvedSkill extends SkillDefinition
  const skillsForCompilation = (await loadSkillsByIds(
    stackSkillIds.map((id) => ({ id })),
    sourceResult.sourcePath,
  )) as Record<SkillId, LocalResolvedSkill>;

  const compiledAgentNames = await compileAndWriteAgents(
    compileConfig,
    agents,
    skillsForCompilation,
    sourceResult,
    projectDir,
    paths.agentsDir,
    deriveInstallMode(finalConfig.skills),
    buildAgentScopeMap(finalConfig),
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
 * 2. Deletes local skills switching to alternate sources, then copies selected
 *    skills from the source repository into `.claude/skills/` (flattened layout)
 * 3. Loads agent definitions from both the CLI and source repository
 * 4. Generates project config.ts from the wizard selections, merging with any
 *    existing config
 * 5. Writes config.ts
 * 6. Compiles agent markdown files using Liquid templates and writes them to
 *    `.claude/agents/`
 *
 * @param options - Installation options containing wizard result, source data,
 *                  project directory, and optional source flag override
 * @returns Result containing all written artifacts (skills, config, agents) and
 *          metadata about the installation (merge status, paths)
 * @throws {Error} If the selected stack ID is not found in config/stacks.ts
 *
 * @remarks
 * **Side effects:** Creates directories and writes files under `{projectDir}/.claude/`.
 */
export async function installLocal(options: LocalInstallOptions): Promise<LocalInstallResult> {
  const { wizardResult, sourceResult, projectDir, sourceFlag } = options;

  const projectPaths = resolveInstallPaths(projectDir, "project");
  const globalPaths = resolveInstallPaths(projectDir, "global");

  // Split skills by scope for path routing
  const projectSkills = wizardResult.skills.filter((s) => s.scope !== "global");
  const globalSkills = wizardResult.skills.filter((s) => s.scope === "global");

  // Prepare directories for each scope that has skills
  await prepareDirectories(projectPaths);
  if (globalSkills.length > 0) {
    await ensureDir(globalPaths.skillsDir);
  }

  // Copy skills to their scope-appropriate directories
  const projectCopied =
    projectSkills.length > 0
      ? await deleteAndCopySkills(projectSkills, sourceResult, projectDir, projectPaths.skillsDir)
      : [];
  const globalCopied =
    globalSkills.length > 0
      ? await deleteAndCopySkills(globalSkills, sourceResult, projectDir, globalPaths.skillsDir)
      : [];
  const copiedSkills = [...projectCopied, ...globalCopied];

  const localSkillsForResolution = buildLocalSkillsMap(copiedSkills, sourceResult.matrix);

  const agents = await loadMergedAgents(sourceResult.sourcePath);
  const mergeResult = await buildAndMergeConfig(wizardResult, sourceResult, projectDir, sourceFlag);
  const finalConfig = mergeResult.config;

  await writeConfigFile(finalConfig, projectPaths.configPath);

  await writeConfigTypes(projectPaths.configPath, sourceResult.matrix, agents);

  const compileAgentsConfig = buildCompileAgents(finalConfig, agents);
  const compileConfig: CompileConfig = {
    name: DEFAULT_PLUGIN_NAME,
    description: finalConfig.description || `Local setup with ${wizardResult.skills.length} skills`,
    agents: compileAgentsConfig,
  };
  const compiledAgentNames = await compileAndWriteAgents(
    compileConfig,
    agents,
    localSkillsForResolution,
    sourceResult,
    projectDir,
    projectPaths.agentsDir,
    deriveInstallMode(finalConfig.skills),
    buildAgentScopeMap(finalConfig),
  );

  return {
    copiedSkills,
    config: finalConfig,
    configPath: projectPaths.configPath,
    compiledAgents: compiledAgentNames,
    wasMerged: mergeResult.merged,
    mergedConfigPath: mergeResult.existingConfigPath,
    skillsDir: projectPaths.skillsDir,
    agentsDir: projectPaths.agentsDir,
  };
}
