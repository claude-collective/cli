import path from "path";
import { unique } from "remeda";
import {
  DIRS,
  PROJECT_ROOT,
  SKILLS_DIR_PATH,
  SKILLS_MATRIX_PATH,
  STANDARD_FILES,
} from "../../consts";
import { LOCAL_DEFAULTS } from "../metadata-keys";
import type {
  AgentName,
  MergedSkillsMatrix,
  ResolvedSkill,
  ResolvedStack,
  SkillAssignment,
  SkillId,
  Stack,
  Subcategory,
} from "../../types";
import { directoryExists, fileExists, glob, readFile } from "../../utils/fs";
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
  loadSkillsMatrix,
  mergeMatrixWithSkills,
} from "../matrix";
import {
  agentNameSchema,
  extendSchemasWithCustomValues,
  isValidSkillId,
  SKILL_ID_PATTERN,
  SUBCATEGORY_VALUES,
} from "../schemas";
import { fetchFromSource, fetchMarketplace } from "./source-fetcher";
import { loadSkillsFromAllSources } from "./multi-source-loader";
import { parseFrontmatter } from "./loader";
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

  await loadSkillsFromAllSources(
    result.matrix,
    sourceConfig,
    resolvedProjectDir,
    forceRefresh,
    result.marketplace,
  );

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

  const matrixRelPath = sourceProjectConfig?.matrixFile ?? SKILLS_MATRIX_PATH;
  const skillsDirRelPath = sourceProjectConfig?.skillsDir ?? SKILLS_DIR_PATH;
  const stacksRelFile = sourceProjectConfig?.stacksFile;

  const cliMatrixPath = path.join(PROJECT_ROOT, SKILLS_MATRIX_PATH);
  const cliMatrix = await loadSkillsMatrix(cliMatrixPath);

  let matrix = cliMatrix;

  // Discover custom values from source entities BEFORE strict matrix load
  await discoverAndExtendFromSource(basePath);

  const sourceMatrixPath = path.join(basePath, matrixRelPath);
  if (await fileExists(sourceMatrixPath)) {
    const sourceMatrix = await loadSkillsMatrix(sourceMatrixPath);
    // Source categories overlay CLI categories — source values win on conflict
    const mergedCategories = { ...cliMatrix.categories, ...sourceMatrix.categories };
    // Merge relationships: concatenate arrays from both matrices
    const mergedRelationships = {
      conflicts: [...cliMatrix.relationships.conflicts, ...sourceMatrix.relationships.conflicts],
      discourages: [
        ...cliMatrix.relationships.discourages,
        ...sourceMatrix.relationships.discourages,
      ],
      recommends: [...cliMatrix.relationships.recommends, ...sourceMatrix.relationships.recommends],
      requires: [...cliMatrix.relationships.requires, ...sourceMatrix.relationships.requires],
      alternatives: [
        ...cliMatrix.relationships.alternatives,
        ...sourceMatrix.relationships.alternatives,
      ],
    };
    // Merge skill aliases: source wins on conflict
    const mergedAliases = { ...cliMatrix.skillAliases, ...sourceMatrix.skillAliases };
    matrix = {
      version: cliMatrix.version,
      categories: mergedCategories,
      relationships: mergedRelationships,
      skillAliases: mergedAliases,
    };
    verbose(
      `Matrix merged: CLI (${typedKeys(cliMatrix.categories).length} categories) + source (${typedKeys(sourceMatrix.categories).length} categories)`,
    );
  } else {
    verbose(`Matrix from CLI only (source has no matrix): ${cliMatrixPath}`);
  }

  const skillsDir = path.join(basePath, skillsDirRelPath);
  verbose(`Skills from source: ${skillsDir}`);

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

// Stack values are already skill IDs — no alias resolution needed
function convertStackToResolvedStack(stack: Stack): ResolvedStack {
  const allSkillIds: SkillId[] = [];
  const seenSkillIds = new Set<SkillId>();
  const skills: Partial<Record<AgentName, Partial<Record<Subcategory, SkillId[]>>>> = {};

  for (const agentId of typedKeys<AgentName>(stack.agents)) {
    const agentConfig = stack.agents[agentId];
    if (!agentConfig) continue;

    const skillRefs = resolveAgentConfigToSkills(agentConfig);
    const agentSkills: Partial<Record<Subcategory, SkillId[]>> = {};

    for (const [subcategory, assignments] of typedEntries<Subcategory, SkillAssignment[]>(
      agentConfig,
    )) {
      if (!assignments || assignments.length === 0) continue;
      const validIds = assignments.filter((a) => isValidSkillId(a.id)).map((a) => a.id);
      if (validIds.length > 0) {
        agentSkills[subcategory] = validIds;
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

/** Extract a custom agent name from a single agent.yaml if it declares `custom: true`. */
async function discoverCustomAgentName(
  agentsDir: string,
  file: string,
  parseYaml: (content: string) => unknown,
): Promise<string | undefined> {
  const content = await readFile(path.join(agentsDir, file));
  // Boundary cast: raw YAML parse for lightweight pre-scan
  const raw = parseYaml(content) as Record<string, unknown>;
  if (raw?.custom !== true) return undefined;
  if (typeof raw?.id !== "string") return undefined;
  if (agentNameSchema.safeParse(raw.id).success) return undefined;
  return raw.id;
}

/** Extract custom skill ID and category from a single skill directory if it declares `custom: true`. */
async function discoverCustomSkillValues(
  skillsDir: string,
  file: string,
  parseYaml: (content: string) => unknown,
  builtinSubcategories: Set<string>,
): Promise<{ skillId?: string; category?: string }> {
  const content = await readFile(path.join(skillsDir, file));
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) return {};

  const skillId = frontmatter.name;
  const skillDir = path.dirname(path.join(skillsDir, file));
  const metadataPath = path.join(skillDir, STANDARD_FILES.METADATA_YAML);
  if (!(await fileExists(metadataPath))) return {};

  const metadataContent = await readFile(metadataPath);
  // Boundary cast: raw YAML parse for lightweight pre-scan
  const metadataRaw = parseYaml(metadataContent) as Record<string, unknown>;
  if (metadataRaw?.custom !== true) return {};

  const result: { skillId?: string; category?: string } = {};

  if (!SKILL_ID_PATTERN.test(skillId)) {
    result.skillId = skillId;
  }

  const category = metadataRaw.category;
  if (typeof category === "string" && !builtinSubcategories.has(category)) {
    result.category = category;
  }

  return result;
}

/**
 * Pre-scans the source's agents/ and skills/ directories for custom values
 * and extends schemas before the full load.
 *
 * Discovers:
 * - Custom agent names from agents with `custom: true` in agent.yaml
 * - Custom skill IDs from skills with `custom: true` in metadata.yaml
 * - Custom categories from `category` field of skills with `custom: true`
 */
async function discoverAndExtendFromSource(basePath: string): Promise<void> {
  const { parse: parseYaml } = await import("yaml");

  const builtinSubcategories = new Set<string>(SUBCATEGORY_VALUES);
  const customCategories: string[] = [];
  const customAgentNames: string[] = [];
  const customSkillIds: string[] = [];

  // Discover custom agent names (only from agents that declare custom: true)
  const agentsDir = path.join(basePath, DIRS.agents);
  if (await directoryExists(agentsDir)) {
    const agentFiles = await glob(`**/${STANDARD_FILES.AGENT_YAML}`, agentsDir);
    for (const file of agentFiles) {
      try {
        const name = await discoverCustomAgentName(agentsDir, file, parseYaml);
        if (name) customAgentNames.push(name);
      } catch {
        // Skip unreadable files — full loader will handle errors
      }
    }
  }

  // Discover custom skill IDs and categories from skills that declare custom: true in metadata.yaml
  const skillsDir = path.join(basePath, DIRS.skills);
  if (await directoryExists(skillsDir)) {
    const skillFiles = await glob(`**/${STANDARD_FILES.SKILL_MD}`, skillsDir);
    for (const file of skillFiles) {
      try {
        const result = await discoverCustomSkillValues(
          skillsDir,
          file,
          parseYaml,
          builtinSubcategories,
        );
        if (result.skillId) customSkillIds.push(result.skillId);
        if (result.category) customCategories.push(result.category);
      } catch {
        // Skip unreadable files
      }
    }
  }

  const hasCustomValues =
    customCategories.length > 0 || customAgentNames.length > 0 || customSkillIds.length > 0;

  if (hasCustomValues) {
    extendSchemasWithCustomValues({
      categories: unique(customCategories),
      agentNames: customAgentNames,
      skillIds: customSkillIds,
    });
    verbose(
      `Extended schemas with ${unique(customCategories).length} custom categories, ${customAgentNames.length} custom agents, ${customSkillIds.length} custom skill IDs`,
    );
  }
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
