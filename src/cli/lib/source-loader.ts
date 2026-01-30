import path from "path";
import { PROJECT_ROOT, SKILLS_DIR_PATH, SKILLS_MATRIX_PATH } from "../consts";
import type {
  CategoryDefinition,
  MergedSkillsMatrix,
  ResolvedSkill,
} from "../types-matrix";
import { fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { isLocalSource, resolveSource, type ResolvedConfig } from "./config";
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

  return {
    matrix: mergedMatrix,
    sourceConfig,
    sourcePath: skillsPath,
    isLocal: true,
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

  return {
    matrix: mergedMatrix,
    sourceConfig,
    sourcePath: fetchResult.path,
    isLocal: false,
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
