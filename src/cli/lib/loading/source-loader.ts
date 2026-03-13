import os from "os";
import path from "path";
import {
  PROJECT_ROOT,
  SKILL_CATEGORIES_PATH,
  SKILL_RULES_PATH,
  SKILLS_DIR_PATH,
} from "../../consts";
import { defaultCategories } from "../configuration/default-categories";
import { defaultRules } from "../configuration/default-rules";
import { defaultStacks } from "../configuration/default-stacks";
import { LOCAL_DEFAULTS } from "../metadata-keys";
import type {
  AgentDefinition,
  AgentName,
  CategoryMap,
  Domain,
  MergedSkillsMatrix,
  RelationshipDefinitions,
  ResolvedSkill,
  ResolvedStack,
  SkillAssignment,
  SkillId,
  Stack,
  Category,
} from "../../types";
import { fileExists } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { typedEntries, typedKeys } from "../../utils/typed-object";
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
  loadSkillCategories,
  loadSkillRules,
  mergeMatrixWithSkills,
} from "../matrix";
import { loadAllAgents } from "./loader";
import { fetchFromSource, fetchMarketplace } from "./source-fetcher";
import { loadSkillsFromAllSources } from "./multi-source-loader";
import { loadStacks, resolveAgentConfigToSkills } from "../stacks";
import { initializeMatrix, matrix as currentMatrix } from "../matrix/matrix-provider";
import { BUILT_IN_MATRIX } from "../../types/generated/matrix";

export type SourceLoadOptions = {
  sourceFlag?: string;
  projectDir?: string;
  forceRefresh?: boolean;
  devMode?: boolean;
  /** Skip loading skills from extra sources (multi-source). Only needed for wizard UI tagging. */
  skipExtraSources?: boolean;
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

  let result: SourceLoadResult;

  if (source === DEFAULT_SOURCE && !devMode) {
    // Default source: use pre-computed BUILT_IN_MATRIX instead of loading from disk
    result = {
      matrix: {
        ...BUILT_IN_MATRIX,
        skills: { ...BUILT_IN_MATRIX.skills },
        categories: { ...BUILT_IN_MATRIX.categories },
        suggestedStacks: [...BUILT_IN_MATRIX.suggestedStacks],
      },
      sourceConfig,
      sourcePath: "",
      isLocal: false,
      marketplace: sourceConfig.marketplace,
    };
  } else {
    const isLocal = isLocalSource(source) || devMode === true;

    if (isLocal) {
      result = await loadFromLocal(source, sourceConfig);
    } else {
      result = await loadFromRemote(source, sourceConfig, forceRefresh);
    }
  }

  const resolvedProjectDir = projectDir || process.cwd();

  let localSkillsResult = await discoverLocalSkills(resolvedProjectDir);

  // If no local skills in project, try global (home directory)
  const homeDir = os.homedir();
  if (
    (!localSkillsResult || localSkillsResult.skills.length === 0) &&
    resolvedProjectDir !== homeDir
  ) {
    localSkillsResult = await discoverLocalSkills(homeDir);
  }

  if (localSkillsResult && localSkillsResult.skills.length > 0) {
    verbose(
      `Found ${localSkillsResult.skills.length} local skill(s) in ${localSkillsResult.localSkillsPath}`,
    );
    result.matrix = mergeLocalSkillsIntoMatrix(result.matrix, localSkillsResult);
  }

  if (!options.skipExtraSources) {
    await loadSkillsFromAllSources(
      result.matrix,
      sourceConfig,
      resolvedProjectDir,
      forceRefresh,
      result.marketplace,
    );
  }

  checkMatrixHealth(result.matrix);
  initializeMatrix(result.matrix);

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

async function loadAndMergeFromBasePath(basePath: string): Promise<MergedSkillsMatrix> {
  const sourceProjectConfig = await loadProjectSourceConfig(basePath);

  const skillsDirRelPath = sourceProjectConfig?.skillsDir ?? SKILLS_DIR_PATH;
  const stacksRelFile = sourceProjectConfig?.stacksFile;

  let categories: CategoryMap = defaultCategories;
  let relationships: RelationshipDefinitions = defaultRules.relationships;

  // Load source categories and rules (if they exist)
  const sourceCategoriesPath = path.join(basePath, SKILL_CATEGORIES_PATH);
  const sourceRulesPath = path.join(basePath, SKILL_RULES_PATH);
  const hasSourceCategories = await fileExists(sourceCategoriesPath);
  const hasSourceRules = await fileExists(sourceRulesPath);

  if (hasSourceCategories || hasSourceRules) {
    if (hasSourceCategories) {
      const sourceCategories = await loadSkillCategories(sourceCategoriesPath);
      categories = { ...defaultCategories, ...sourceCategories };
      verbose(
        `Loaded source categories: ${sourceCategoriesPath} (${typedKeys(sourceCategories).length} categories)`,
      );
    }

    if (hasSourceRules) {
      const sourceRules = await loadSkillRules(sourceRulesPath);

      // Merge relationships: concatenate arrays
      relationships = {
        conflicts: [
          ...defaultRules.relationships.conflicts,
          ...sourceRules.relationships.conflicts,
        ],
        discourages: [
          ...defaultRules.relationships.discourages,
          ...sourceRules.relationships.discourages,
        ],
        recommends: [
          ...defaultRules.relationships.recommends,
          ...sourceRules.relationships.recommends,
        ],
        requires: [...defaultRules.relationships.requires, ...sourceRules.relationships.requires],
        alternatives: [
          ...defaultRules.relationships.alternatives,
          ...sourceRules.relationships.alternatives,
        ],
        compatibleWith: [
          ...(defaultRules.relationships.compatibleWith ?? []),
          ...(sourceRules.relationships.compatibleWith ?? []),
        ],
      };

      verbose(`Loaded source rules: ${sourceRulesPath}`);
    }

    verbose(`Matrix merged: CLI (${typedKeys(defaultCategories).length} categories) + source`);
  } else {
    verbose(`Matrix from CLI only (source has no categories/rules files)`);
  }

  const skillsDir = path.join(basePath, skillsDirRelPath);
  verbose(`Skills from source: ${skillsDir}`);

  const skills = await extractAllSkills(skillsDir);
  const mergedMatrix = mergeMatrixWithSkills(categories, relationships, skills);

  // Load stacks from source first, fall back to CLI's built-in defaults
  const sourceStacks = await loadStacks(basePath, stacksRelFile);
  const stacks = sourceStacks.length > 0 ? sourceStacks : defaultStacks;
  if (stacks.length > 0) {
    mergedMatrix.suggestedStacks = stacks.map((stack) =>
      convertStackToResolvedStack(stack),
    );
    const stackSource = sourceStacks.length > 0 ? "source" : "CLI";
    verbose(`Loaded ${stacks.length} stacks from ${stackSource}`);
  }

  // Collect explicit domain definitions from agent metadata.yaml files
  const agents = await loadAllAgents(basePath);
  const agentDefinedDomains: Partial<Record<AgentName, Domain>> = {};
  for (const [agentId, agentDef] of typedEntries<AgentName, AgentDefinition>(agents)) {
    if (agentDef.domain) {
      agentDefinedDomains[agentId] = agentDef.domain;
    }
  }
  if (typedKeys(agentDefinedDomains).length > 0) {
    mergedMatrix.agentDefinedDomains = agentDefinedDomains;
    verbose(`Loaded ${typedKeys(agentDefinedDomains).length} agent domain definition(s)`);
  }

  return mergedMatrix;
}

// Stack values are already skill IDs — no alias resolution needed
function convertStackToResolvedStack(stack: Stack): ResolvedStack {
  const allSkillIds: SkillId[] = [];
  const seenSkillIds = new Set<SkillId>();
  const skills: Partial<Record<AgentName, Partial<Record<Category, SkillId[]>>>> = {};

  for (const agentId of typedKeys<AgentName>(stack.agents)) {
    const agentConfig = stack.agents[agentId];
    if (!agentConfig) continue;

    const skillRefs = resolveAgentConfigToSkills(agentConfig);
    const agentSkills: Partial<Record<Category, SkillId[]>> = {};

    for (const [category, assignments] of typedEntries<Category, SkillAssignment[]>(agentConfig)) {
      if (!assignments || assignments.length === 0) continue;
      const validIds = assignments.filter((a) => a.id in currentMatrix.skills).map((a) => a.id);
      if (validIds.length > 0) {
        agentSkills[category] = validIds;
      }
    }

    skills[agentId] = agentSkills;

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
    skills,
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
 *   "Acme Corp + 1 public"   — private marketplace with public also available
 *   "Acme Corp"              — private marketplace only
 *   "agents-inc (public)" — default public marketplace
 */
export function getMarketplaceLabel(sourceResult: SourceLoadResult): string | undefined {
  if (sourceResult.isLocal) return undefined;

  const { marketplace } = sourceResult;

  if (!marketplace) {
    const name = extractSourceName(sourceResult.sourceConfig.source);
    return `${name} (public)`;
  }

  // When using a non-default source, the public marketplace is also available
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
    const existingSkill = matrix.skills[metadata.id];

    // If overwriting an existing remote skill, inherit its category unconditionally.
    // Otherwise, use whatever the local skill declared in its metadata.yaml.
    const category = existingSkill?.category ?? metadata.category;
    const slug = existingSkill?.slug ?? metadata.slug;
    const displayName = existingSkill?.displayName ?? metadata.displayName;

    const resolvedSkill: ResolvedSkill = {
      id: metadata.id,
      slug,
      displayName,
      description: metadata.description,
      usageGuidance: metadata.usageGuidance,

      category,
      tags: metadata.tags ?? [],

      author: LOCAL_DEFAULTS.AUTHOR,

      conflictsWith: existingSkill?.conflictsWith ?? [],
      isRecommended: existingSkill?.isRecommended ?? false,
      recommendedReason: existingSkill?.recommendedReason,
      requires: existingSkill?.requires ?? [],
      alternatives: existingSkill?.alternatives ?? [],
      discourages: existingSkill?.discourages ?? [],
      compatibleWith: existingSkill?.compatibleWith ?? [],

      path: metadata.path,

      local: true,
      localPath: metadata.localPath,
      custom: metadata.custom,
    };

    matrix.skills[metadata.id] = resolvedSkill;

    // Ensure the skill's category exists in matrix.categories so that
    // config-types generation can discover its domain and category.
    // Skip "local" — it is a pseudo-category, not a real Category union member.
    if (category !== "local" && !matrix.categories[category] && metadata.domain) {
      matrix.categories[category] = {
        id: category,
        displayName: category,
        description: `Local skill category`,
        domain: metadata.domain,
        exclusive: false,
        required: false,
        order: 0,
      };
      verbose(`Added local category: ${category} (domain: ${metadata.domain})`);
    }

    verbose(`Added local skill: ${metadata.id} (category: ${category})`);
  }

  return matrix;
}
