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
import { type CopiedSkill, copySkillsToLocalFlattened } from "../skills";
import { mergeWithExistingConfig } from "../configuration";
import { loadAllAgents, type SourceLoadResult } from "../loading";
import { loadStackById, compileAgentForPlugin } from "../stacks";
import { resolveAgents, resolveAgentSkillsFromStack } from "../resolver";
import { createLiquidEngine } from "../compiler";
import { generateProjectConfigFromSkills } from "../configuration";
import { ensureDir, writeFile } from "../../utils/fs";
import { typedEntries, typedKeys } from "../../utils/typed-object";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, LOCAL_SKILLS_PATH, PROJECT_ROOT } from "../../consts";

const PLUGIN_NAME = "claude-collective";

const YAML_INDENT = 2;
const YAML_LINE_WIDTH = 120;

type LocalResolvedSkill = SkillDefinition & {
  content: string;
};

export type LocalInstallOptions = {
  wizardResult: WizardResultV2;
  sourceResult: SourceLoadResult;
  projectDir: string;
  sourceFlag?: string;
};

export type LocalInstallResult = {
  copiedSkills: CopiedSkill[];
  config: ProjectConfig;
  configPath: string;
  compiledAgents: AgentName[];
  wasMerged: boolean;
  mergedConfigPath?: string;
  skillsDir: string;
  agentsDir: string;
};

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

async function buildLocalConfig(
  wizardResult: WizardResultV2,
  sourceResult: SourceLoadResult,
): Promise<{ config: ProjectConfig; loadedStack: Stack | null }> {
  const loadedStack = wizardResult.selectedStackId
    ? await loadStackById(wizardResult.selectedStackId, PROJECT_ROOT)
    : null;

  let localConfig: ProjectConfig;

  if (wizardResult.selectedStackId) {
    if (loadedStack) {
      // Generate config from the user's actual skill selections (which may differ
      // from the original stack if the user customized). This ensures the stack
      // property reflects customizations (e.g., swapping commander for oclif).
      localConfig = generateProjectConfigFromSkills(
        PLUGIN_NAME,
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
      PLUGIN_NAME,
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

  // Flag overrides resolved source
  if (sourceFlag) {
    config.source = sourceFlag;
  } else if (sourceResult.sourceConfig.source) {
    config.source = sourceResult.sourceConfig.source;
  }

  if (sourceResult.marketplace) {
    config.marketplace = sourceResult.marketplace;
  }
}

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
  const { config: builtConfig, loadedStack } = await buildLocalConfig(wizardResult, sourceResult);

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
