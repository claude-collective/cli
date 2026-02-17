import path from "path";
import { PROJECT_ROOT, SKILLS_DIR_PATH, SKILLS_MATRIX_PATH } from "../../consts";
import { LOCAL_DEFAULTS } from "../metadata-keys";
import type {
  AgentName,
  MergedSkillsMatrix,
  ResolvedSkill,
  ResolvedStack,
  SkillId,
  Stack,
} from "../../types";
import { fileExists } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { typedKeys } from "../../utils/typed-object";
import {
  DEFAULT_SOURCE,
  isLocalSource,
  loadProjectSourceConfig,
  resolveSource,
  type ResolvedConfig,
} from "../configuration";
import { discoverLocalSkills, type LocalSkillDiscoveryResult } from "../skills";
import {
  checkMatrixHealth,
  extractAllSkills,
  loadSkillsMatrix,
  mergeMatrixWithSkills,
} from "../matrix";
import { fetchFromSource, fetchMarketplace } from "./source-fetcher";
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

  await loadSkillsFromAllSources(result.matrix, sourceConfig, resolvedProjectDir);

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

  const mergedMatrix = await loadAndMergeFromBasePath(skillsPath);

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

  const mergedMatrix = await loadAndMergeFromBasePath(fetchResult.path);

  // Try to read marketplace name from the source's .claude-plugin/marketplace.json.
  // This handles the case where sourceConfig.marketplace is undefined (e.g. during
  // `agentsinc init --source github:user/repo` before any project config exists).
  let marketplace = sourceConfig.marketplace;
  if (!marketplace) {
    try {
      const marketplaceResult = await fetchMarketplace(source, { forceRefresh });
      // Use the actual marketplace name from marketplace.json
      marketplace = marketplaceResult.marketplace.name;
      verbose(`Using marketplace name from marketplace.json: ${marketplace}`);
    } catch {
      // No marketplace.json — getMarketplaceLabel() handles the fallback display
      verbose(`Source does not have a marketplace.json — using source name as label`);
    }
  }

  return {
    matrix: mergedMatrix,
    sourceConfig,
    sourcePath: fetchResult.path,
    isLocal: false,
    marketplace,
  };
}

// Shared logic: reads source config overrides, resolves matrix/skills/stacks from basePath
async function loadAndMergeFromBasePath(basePath: string): Promise<MergedSkillsMatrix> {
  const sourceProjectConfig = await loadProjectSourceConfig(basePath);

  const matrixRelPath = sourceProjectConfig?.matrix_file ?? SKILLS_MATRIX_PATH;
  const skillsDirRelPath = sourceProjectConfig?.skills_dir ?? SKILLS_DIR_PATH;
  const stacksRelFile = sourceProjectConfig?.stacks_file;

  // Check if source has its own matrix, otherwise fallback to CLI matrix
  const sourceMatrixPath = path.join(basePath, matrixRelPath);
  const cliMatrixPath = path.join(PROJECT_ROOT, SKILLS_MATRIX_PATH);

  let matrixPath: string;
  if (await fileExists(sourceMatrixPath)) {
    matrixPath = sourceMatrixPath;
    verbose(`Matrix from source: ${matrixPath}`);
  } else {
    matrixPath = cliMatrixPath;
    verbose(`Matrix from CLI (source has no matrix): ${matrixPath}`);
  }

  const skillsDir = path.join(basePath, skillsDirRelPath);
  verbose(`Skills from source: ${skillsDir}`);

  const matrix = await loadSkillsMatrix(matrixPath);
  const skills = await extractAllSkills(skillsDir);
  const mergedMatrix = await mergeMatrixWithSkills(matrix, skills);

  // Load stacks from source first, fall back to CLI's config/stacks.yaml
  const sourceStacks = await loadStacks(basePath, stacksRelFile);
  const stacks = sourceStacks.length > 0 ? sourceStacks : await loadStacks(PROJECT_ROOT);
  if (stacks.length > 0) {
    mergedMatrix.suggestedStacks = stacks.map((stack) => convertStackToResolvedStack(stack));
    const stackSource = sourceStacks.length > 0 ? "source" : "CLI";
    verbose(`Loaded ${stacks.length} stacks from ${stackSource}`);
  }

  return mergedMatrix;
}

// Convert a Stack to ResolvedStack for wizard compatibility.
// Stack values are already skill IDs — no alias resolution needed.
function convertStackToResolvedStack(stack: Stack): ResolvedStack {
  const allSkillIds: SkillId[] = [];
  const seenSkillIds = new Set<SkillId>();

  for (const agentId of typedKeys<AgentName>(stack.agents)) {
    const agentConfig = stack.agents[agentId];
    if (!agentConfig) continue;

    const skillRefs = resolveAgentConfigToSkills(agentConfig);

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

/**
 * Extract a human-readable name from a source URL.
 * e.g. "github:agents-inc/skills" -> "agents-inc"
 *      "github:acme-corp/claude-skills" -> "acme-corp"
 */
function extractSourceName(source: string): string {
  // Strip protocol prefix (github:, gh:, https://, etc.)
  const withoutProtocol = source.replace(/^(?:github|gh|gitlab|bitbucket|sourcehut):/, "");
  const withoutUrl = withoutProtocol.replace(/^https?:\/\/[^/]+\//, "");

  // Take the first path segment (org/owner name)
  const firstSegment = withoutUrl.split("/")[0];
  return firstSegment || source;
}

/**
 * Compute a display label for the marketplace indicator in the wizard.
 *
 * Returns undefined when the source is local (no marketplace to display).
 *
 * Format examples:
 *   "Photoroom + 1 public"   — private marketplace with public also available
 *   "Photoroom"              — private marketplace only
 *   "agents-inc (public)" — default public marketplace
 */
export function getMarketplaceLabel(sourceResult: SourceLoadResult): string | undefined {
  if (sourceResult.isLocal) return undefined;

  const { marketplace } = sourceResult;

  if (!marketplace) {
    // No private marketplace — show source name as public
    const name = extractSourceName(sourceResult.sourceConfig.source);
    return `${name} (public)`;
  }

  // Private marketplace is active.
  // When using a non-default source, the public marketplace is also available.
  const PUBLIC_MARKETPLACE_COUNT = 1;
  const isDefaultSource = sourceResult.sourceConfig.source === DEFAULT_SOURCE;
  if (!isDefaultSource) {
    return `${marketplace} + ${PUBLIC_MARKETPLACE_COUNT} public`;
  }

  return marketplace;
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

      author: LOCAL_DEFAULTS.AUTHOR,

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
