import path from "path";
import { PROJECT_ROOT, SKILLS_DIR_PATH, SKILLS_MATRIX_PATH } from "../consts";
import type { AgentDefinition } from "../types";
import type {
  CategoryDefinition,
  MergedSkillsMatrix,
  ResolvedSkill,
  ResolvedStack,
} from "../types-matrix";
import type { Stack } from "../types-stacks";
import { fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { isLocalSource, resolveSource, type ResolvedConfig } from "./config";
import { loadAllAgents } from "./loader";
import {
  discoverLocalSkills,
  type LocalSkillDiscoveryResult,
} from "./local-skill-loader";
import {
  extractAllSkills,
  loadSkillsMatrix,
  mergeMatrixWithSkills,
} from "./matrix-loader";
import { fetchFromSource } from "./source-fetcher";
import { loadStacks } from "./stacks-loader";

export interface SourceLoadOptions {
  sourceFlag?: string;
  projectDir?: string;
  forceRefresh?: boolean;
  devMode?: boolean;
}

export interface SourceLoadResult {
  matrix: MergedSkillsMatrix;
  sourceConfig: ResolvedConfig;
  sourcePath: string;
  isLocal: boolean;
  marketplace?: string;
}

export async function loadSkillsMatrixFromSource(
  options: SourceLoadOptions = {},
): Promise<SourceLoadResult> {
  const {
    sourceFlag,
    projectDir,
    forceRefresh = false,
    devMode = false,
  } = options;

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
    result.matrix = mergeLocalSkillsIntoMatrix(
      result.matrix,
      localSkillsResult,
    );
  }

  return result;
}

async function loadFromLocal(
  source: string,
  sourceConfig: ResolvedConfig,
): Promise<SourceLoadResult> {
  let skillsPath: string;

  if (isLocalSource(source)) {
    skillsPath = path.isAbsolute(source)
      ? source
      : path.resolve(process.cwd(), source);
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
    // Load agents to extract skills for each stack
    const agents = await loadAllAgents(PROJECT_ROOT);
    mergedMatrix.suggestedStacks = stacks.map((stack) =>
      stackToResolvedStack(stack, agents),
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
    // Load agents to extract skills for each stack
    const agents = await loadAllAgents(PROJECT_ROOT);
    mergedMatrix.suggestedStacks = stacks.map((stack) =>
      stackToResolvedStack(stack, agents),
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

/**
 * Convert a Stack (from config/stacks.yaml) to ResolvedStack format
 * for compatibility with the wizard.
 * Extracts skills from agent definitions to populate allSkillIds.
 */
function stackToResolvedStack(
  stack: Stack,
  agents: Record<string, AgentDefinition>,
): ResolvedStack {
  // Collect all unique skill IDs from agents in this stack
  const allSkillIds: string[] = [];
  const seenSkillIds = new Set<string>();

  for (const agentId of stack.agents) {
    const agent = agents[agentId];
    if (agent?.skills) {
      for (const entry of Object.values(agent.skills)) {
        if (!seenSkillIds.has(entry.id)) {
          seenSkillIds.add(entry.id);
          allSkillIds.push(entry.id);
        }
      }
    }
  }

  verbose(
    `Stack '${stack.id}' has ${allSkillIds.length} skills from ${stack.agents.length} agents`,
  );

  return {
    id: stack.id,
    name: stack.name,
    description: stack.description,
    audience: [], // Not used in new format
    skills: {}, // Skills come from agents, not stack config
    allSkillIds,
    philosophy: stack.philosophy || "",
  };
}

const LOCAL_CATEGORY_TOP: CategoryDefinition = {
  id: "local",
  name: "Local Skills",
  description: "Project-specific skills from .claude/skills/",
  exclusive: false,
  required: false,
  order: 0,
};

const LOCAL_CATEGORY_CUSTOM: CategoryDefinition = {
  id: "local/custom",
  name: "Custom",
  description: "Your project-specific skills",
  exclusive: false,
  required: false,
  order: 0,
  parent: "local",
};

function mergeLocalSkillsIntoMatrix(
  matrix: MergedSkillsMatrix,
  localResult: LocalSkillDiscoveryResult,
): MergedSkillsMatrix {
  if (!matrix.categories["local"]) {
    matrix.categories["local"] = LOCAL_CATEGORY_TOP;
  }
  if (!matrix.categories["local/custom"]) {
    matrix.categories["local/custom"] = LOCAL_CATEGORY_CUSTOM;
  }

  for (const metadata of localResult.skills) {
    const resolvedSkill: ResolvedSkill = {
      id: metadata.id,
      alias: undefined,
      name: metadata.name,
      description: metadata.description,
      usageGuidance: metadata.usageGuidance,

      category: "local/custom",
      categoryExclusive: false,
      tags: metadata.tags ?? [],

      author: "@local",

      conflictsWith: [],
      recommends: [],
      recommendedBy: [],
      requires: [],
      requiredBy: [],
      alternatives: [],
      discourages: [],

      requiresSetup: [],
      providesSetupFor: [],

      path: metadata.path,

      local: true,
      localPath: metadata.localPath,
    };

    matrix.skills[metadata.id] = resolvedSkill;
    verbose(`Added local skill: ${metadata.id}`);
  }

  return matrix;
}
