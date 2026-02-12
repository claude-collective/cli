import path from "path";
import { PROJECT_ROOT, SKILLS_DIR_PATH, SKILLS_MATRIX_PATH } from "../../consts";
import type {
  AgentName,
  MergedSkillsMatrix,
  ResolvedSkill,
  ResolvedStack,
  SkillDisplayName,
  SkillId,
  Stack,
} from "../../types";
import { fileExists } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { typedKeys } from "../../utils/typed-object";
import { isLocalSource, resolveSource, type ResolvedConfig } from "../configuration";
import { discoverLocalSkills, type LocalSkillDiscoveryResult } from "../skills";
import {
  checkMatrixHealth,
  extractAllSkills,
  loadSkillsMatrix,
  mergeMatrixWithSkills,
} from "../matrix";
import { fetchFromSource } from "./source-fetcher";
import { loadSkillsFromAllSources } from "./multi-source-loader";
import { loadStacks, resolveAgentConfigToSkills } from "../stacks";

export type SourceLoadOptions = {
  sourceFlag?: string;
  projectDir?: string;
  forceRefresh?: boolean;
  devMode?: boolean;
};

export type SourceLoadResult = {
  matrix: MergedSkillsMatrix;
  sourceConfig: ResolvedConfig;
  sourcePath: string;
  isLocal: boolean;
  marketplace?: string;
};

export async function loadSkillsMatrixFromSource(
  options: SourceLoadOptions = {},
): Promise<SourceLoadResult> {
  const { sourceFlag, projectDir, forceRefresh = false, devMode = false } = options;

  const sourceConfig = await resolveSource(sourceFlag, projectDir);
  const { source } = sourceConfig;

  verbose(`Loading skills from source: ${source}`);

  const isLocal = isLocalSource(source) || devMode === true;

  let result: SourceLoadResult;
  if (isLocal) {
    result = await loadFromLocal(source, sourceConfig);
  } else {
    result = await loadFromRemote(source, sourceConfig, forceRefresh);
  }

  const resolvedProjectDir = projectDir || process.cwd();
  const localSkillsResult = await discoverLocalSkills(resolvedProjectDir);

  if (localSkillsResult && localSkillsResult.skills.length > 0) {
    verbose(
      `Found ${localSkillsResult.skills.length} local skill(s) in ${localSkillsResult.localSkillsPath}`,
    );
    result.matrix = mergeLocalSkillsIntoMatrix(result.matrix, localSkillsResult);
  }

  // Annotate skills with available sources (public, local, plugin, private)
  await loadSkillsFromAllSources(result.matrix, sourceConfig, resolvedProjectDir);

  // Run matrix health check to surface referential integrity issues
  checkMatrixHealth(result.matrix);

  return result;
}

async function loadFromLocal(
  source: string,
  sourceConfig: ResolvedConfig,
): Promise<SourceLoadResult> {
  let skillsPath: string;

  if (isLocalSource(source)) {
    skillsPath = path.isAbsolute(source) ? source : path.resolve(process.cwd(), source);
  } else {
    skillsPath = PROJECT_ROOT;
  }

  verbose(`Loading skills from local path: ${skillsPath}`);

  // Check if source has its own matrix, otherwise fallback to CLI matrix
  const sourceMatrixPath = path.join(skillsPath, SKILLS_MATRIX_PATH);
  const cliMatrixPath = path.join(PROJECT_ROOT, SKILLS_MATRIX_PATH);

  let matrixPath: string;
  if (await fileExists(sourceMatrixPath)) {
    matrixPath = sourceMatrixPath;
    verbose(`Matrix from source: ${matrixPath}`);
  } else {
    matrixPath = cliMatrixPath;
    verbose(`Matrix from CLI (source has no matrix): ${matrixPath}`);
  }

  const skillsDir = path.join(skillsPath, SKILLS_DIR_PATH);
  verbose(`Skills from source: ${skillsDir}`);

  const matrix = await loadSkillsMatrix(matrixPath);
  const skills = await extractAllSkills(skillsDir);
  const mergedMatrix = await mergeMatrixWithSkills(matrix, skills);

  // Load stacks from CLI's config/stacks.yaml (Phase 6: agent-centric config)
  const stacks = await loadStacks(PROJECT_ROOT);
  if (stacks.length > 0) {
    // Phase 7: Skills are defined in stacks (per agent, per subcategory), not in agent YAMLs
    // Use skill_aliases from the matrix to resolve technology aliases to full skill IDs
    mergedMatrix.suggestedStacks = stacks.map((stack) =>
      stackToResolvedStack(stack, mergedMatrix.displayNameToId),
    );
    verbose(`Loaded ${stacks.length} stacks from config/stacks.yaml`);
  }

  return {
    matrix: mergedMatrix,
    sourceConfig,
    sourcePath: skillsPath,
    isLocal: true,
    marketplace: sourceConfig.marketplace,
  };
}

async function loadFromRemote(
  source: string,
  sourceConfig: ResolvedConfig,
  forceRefresh: boolean,
): Promise<SourceLoadResult> {
  verbose(`Fetching skills from remote source: ${source}`);

  const fetchResult = await fetchFromSource(source, { forceRefresh });

  verbose(`Fetched to: ${fetchResult.path}`);

  // Check if source has its own matrix, otherwise fallback to CLI matrix
  const sourceMatrixPath = path.join(fetchResult.path, SKILLS_MATRIX_PATH);
  const cliMatrixPath = path.join(PROJECT_ROOT, SKILLS_MATRIX_PATH);

  let matrixPath: string;
  if (await fileExists(sourceMatrixPath)) {
    matrixPath = sourceMatrixPath;
    verbose(`Matrix from source: ${matrixPath}`);
  } else {
    matrixPath = cliMatrixPath;
    verbose(`Matrix from CLI (source has no matrix): ${matrixPath}`);
  }

  const skillsDir = path.join(fetchResult.path, SKILLS_DIR_PATH);
  verbose(`Skills from source: ${skillsDir}`);

  const matrix = await loadSkillsMatrix(matrixPath);
  const skills = await extractAllSkills(skillsDir);
  const mergedMatrix = await mergeMatrixWithSkills(matrix, skills);

  // Load stacks from CLI's config/stacks.yaml (Phase 6: agent-centric config)
  const stacks = await loadStacks(PROJECT_ROOT);
  if (stacks.length > 0) {
    // Phase 7: Skills are defined in stacks (per agent, per subcategory), not in agent YAMLs
    // Use skill_aliases from the matrix to resolve technology aliases to full skill IDs
    mergedMatrix.suggestedStacks = stacks.map((stack) =>
      stackToResolvedStack(stack, mergedMatrix.displayNameToId),
    );
    verbose(`Loaded ${stacks.length} stacks from config/stacks.yaml`);
  }

  return {
    matrix: mergedMatrix,
    sourceConfig,
    sourcePath: fetchResult.path,
    isLocal: false,
    marketplace: sourceConfig.marketplace,
  };
}

// Convert a Stack to ResolvedStack for wizard compatibility.
// Resolves technology aliases to full skill IDs via displayNameToId.
function stackToResolvedStack(
  stack: Stack,
  displayNameToId: Partial<Record<SkillDisplayName, SkillId>>,
): ResolvedStack {
  // Collect all unique skill IDs from agent configs in this stack
  const allSkillIds: SkillId[] = [];
  const seenSkillIds = new Set<SkillId>();

  for (const agentId of typedKeys<AgentName>(stack.agents)) {
    const agentConfig = stack.agents[agentId];
    if (!agentConfig) continue;

    // Resolve this agent's technology selections to skill IDs
    const skillRefs = resolveAgentConfigToSkills(agentConfig, displayNameToId);

    for (const ref of skillRefs) {
      if (!seenSkillIds.has(ref.id)) {
        seenSkillIds.add(ref.id);
        allSkillIds.push(ref.id);
      }
    }
  }

  const agentCount = typedKeys<AgentName>(stack.agents).length;
  verbose(`Stack '${stack.id}' has ${allSkillIds.length} skills from ${agentCount} agents`);

  return {
    id: stack.id,
    name: stack.name,
    description: stack.description,
    audience: [], // Not used in new format
    skills: {} as ResolvedStack["skills"], // Skills come from stack agent configs, resolved at runtime
    allSkillIds,
    philosophy: stack.philosophy || "",
  };
}

function mergeLocalSkillsIntoMatrix(
  matrix: MergedSkillsMatrix,
  localResult: LocalSkillDiscoveryResult,
): MergedSkillsMatrix {
  for (const metadata of localResult.skills) {
    // Preserve alias and category from existing matrix entry (if skill was in source)
    const existingSkill = matrix.skills[metadata.id];

    // If overwriting an existing remote skill, inherit its category unconditionally.
    // Otherwise, use whatever the local skill declared in its metadata.yaml.
    const category = existingSkill?.category ?? metadata.category;
    const displayName = existingSkill?.displayName ?? matrix.displayNames[metadata.id];

    const resolvedSkill: ResolvedSkill = {
      id: metadata.id,
      displayName,
      description: metadata.description,
      usageGuidance: metadata.usageGuidance,

      category,
      categoryExclusive: metadata.categoryExclusive,
      tags: metadata.tags ?? [],

      author: "@local",

      conflictsWith: existingSkill?.conflictsWith ?? [],
      recommends: existingSkill?.recommends ?? [],
      requires: existingSkill?.requires ?? [],
      alternatives: existingSkill?.alternatives ?? [],
      discourages: existingSkill?.discourages ?? [],
      compatibleWith: existingSkill?.compatibleWith ?? [],

      requiresSetup: existingSkill?.requiresSetup ?? [],
      providesSetupFor: existingSkill?.providesSetupFor ?? [],

      path: metadata.path,

      local: true,
      localPath: metadata.localPath,
    };

    matrix.skills[metadata.id] = resolvedSkill;
    verbose(`Added local skill: ${metadata.id} (category: ${category})`);
  }

  return matrix;
}
