import path from "path";
import { unique } from "remeda";
import {
  DIRS,
  PROJECT_ROOT,
  SKILL_CATEGORIES_YAML_PATH,
  SKILL_RULES_YAML_PATH,
  SKILLS_DIR_PATH,
  STANDARD_FILES,
} from "../../consts";
import { LOCAL_DEFAULTS } from "../metadata-keys";
import type {
  AgentName,
  CategoryMap,
  Domain,
  MergedSkillsMatrix,
  PerSkillRules,
  RelationshipDefinitions,
  ResolvedSkill,
  ResolvedStack,
  SkillAssignment,
  SkillDisplayName,
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
  loadSkillCategories,
  loadSkillRules,
  mergeMatrixWithSkills,
} from "../matrix";
import { loadAllAgents } from "./loader";
import {
  agentNameSchema,
  DOMAIN_VALUES,
  extendSchemasWithCustomValues,
  isValidSkillId,
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

  const skillsDirRelPath = sourceProjectConfig?.skillsDir ?? SKILLS_DIR_PATH;
  const stacksRelFile = sourceProjectConfig?.stacksFile;

  // Load CLI categories and rules from standalone files
  const cliCategoriesPath = path.join(PROJECT_ROOT, SKILL_CATEGORIES_YAML_PATH);
  const cliRulesPath = path.join(PROJECT_ROOT, SKILL_RULES_YAML_PATH);

  const cliCategories = await loadSkillCategories(cliCategoriesPath);
  const cliRules = await loadSkillRules(cliRulesPath);

  let categories: CategoryMap = cliCategories;
  let relationships: RelationshipDefinitions = cliRules.relationships;
  let aliases: Partial<Record<SkillDisplayName, SkillId>> = cliRules.aliases;
  let perSkillRules: Partial<Record<SkillDisplayName, PerSkillRules>> = cliRules.perSkill;

  // Discover custom values from source entities BEFORE strict schema validation
  await discoverAndExtendFromSource(basePath);

  // Load source categories and rules (if they exist)
  const sourceCategoriesPath = path.join(basePath, SKILL_CATEGORIES_YAML_PATH);
  const sourceRulesPath = path.join(basePath, SKILL_RULES_YAML_PATH);
  const hasSourceCategories = await fileExists(sourceCategoriesPath);
  const hasSourceRules = await fileExists(sourceRulesPath);

  if (hasSourceCategories || hasSourceRules) {
    if (hasSourceCategories) {
      const sourceCategories = await loadSkillCategories(sourceCategoriesPath);
      categories = { ...cliCategories, ...sourceCategories };
      verbose(
        `Loaded source categories: ${sourceCategoriesPath} (${typedKeys(sourceCategories).length} categories)`,
      );
    }

    if (hasSourceRules) {
      const sourceRules = await loadSkillRules(sourceRulesPath);

      // Merge relationships: concatenate arrays
      relationships = {
        conflicts: [...cliRules.relationships.conflicts, ...sourceRules.relationships.conflicts],
        discourages: [
          ...cliRules.relationships.discourages,
          ...sourceRules.relationships.discourages,
        ],
        recommends: [...cliRules.relationships.recommends, ...sourceRules.relationships.recommends],
        requires: [...cliRules.relationships.requires, ...sourceRules.relationships.requires],
        alternatives: [
          ...cliRules.relationships.alternatives,
          ...sourceRules.relationships.alternatives,
        ],
      };

      // Merge aliases: source wins on same key
      aliases = { ...cliRules.aliases, ...sourceRules.aliases };

      // Merge per-skill rules: source wins on same key
      perSkillRules = { ...cliRules.perSkill, ...sourceRules.perSkill };

      verbose(`Loaded source rules: ${sourceRulesPath}`);
    }

    verbose(`Matrix merged: CLI (${typedKeys(cliCategories).length} categories) + source`);
  } else {
    verbose(`Matrix from CLI only (source has no categories/rules files)`);
  }

  const skillsDir = path.join(basePath, skillsDirRelPath);
  verbose(`Skills from source: ${skillsDir}`);

  const skills = await extractAllSkills(skillsDir);
  const mergedMatrix = await mergeMatrixWithSkills(
    categories,
    relationships,
    aliases,
    skills,
    perSkillRules,
  );

  // Load stacks from source first, fall back to CLI's config/stacks.yaml
  const sourceStacks = await loadStacks(basePath, stacksRelFile);
  const stacks = sourceStacks.length > 0 ? sourceStacks : await loadStacks(PROJECT_ROOT);
  if (stacks.length > 0) {
    mergedMatrix.suggestedStacks = stacks.map((stack) => convertStackToResolvedStack(stack));
    const stackSource = sourceStacks.length > 0 ? "source" : "CLI";
    verbose(`Loaded ${stacks.length} stacks from ${stackSource}`);
  }

  // Collect explicit domain definitions from agent.yaml files
  const agents = await loadAllAgents(basePath);
  const agentDefinedDomains: Partial<Record<AgentName, Domain>> = {};
  for (const [agentId, agentDef] of typedEntries(agents)) {
    if (agentDef.domain) {
      // Boundary cast: agent IDs from YAML may not be in the AgentName union
      agentDefinedDomains[agentId as AgentName] = agentDef.domain;
    }
  }
  if (Object.keys(agentDefinedDomains).length > 0) {
    mergedMatrix.agentDefinedDomains = agentDefinedDomains;
    verbose(`Loaded ${Object.keys(agentDefinedDomains).length} agent domain definition(s)`);
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

/** Extract custom values from a single agent.yaml if it declares `custom: true`. */
async function discoverCustomAgentValues(
  agentsDir: string,
  file: string,
  parseYaml: (content: string) => unknown,
  builtinDomains: Set<string>,
): Promise<{ agentName?: string; domain?: string }> {
  const content = await readFile(path.join(agentsDir, file));
  // Boundary cast: raw YAML parse for lightweight pre-scan
  const raw = parseYaml(content) as Record<string, unknown>;
  if (raw?.custom !== true) return {};

  const result: { agentName?: string; domain?: string } = {};

  if (typeof raw?.id === "string" && !agentNameSchema.safeParse(raw.id).success) {
    result.agentName = raw.id;
  }

  if (typeof raw?.domain === "string" && !builtinDomains.has(raw.domain)) {
    result.domain = raw.domain;
  }

  return result;
}

/** Extract custom skill ID, category, and domain from a single skill directory if it declares `custom: true`. */
async function discoverCustomSkillValues(
  skillsDir: string,
  file: string,
  parseYaml: (content: string) => unknown,
  builtinSubcategories: Set<string>,
  builtinDomains: Set<string>,
): Promise<{ skillId?: string; category?: string; domain?: string }> {
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

  const result: { skillId?: string; category?: string; domain?: string } = {};

  result.skillId = skillId;

  const category = metadataRaw.category;
  if (typeof category === "string" && !builtinSubcategories.has(category)) {
    result.category = category;
  }

  const domain = metadataRaw.domain;
  if (typeof domain === "string" && !builtinDomains.has(domain)) {
    result.domain = domain;
  }

  return result;
}

/**
 * Pre-scans the source's agents/ and skills/ directories for custom values
 * and extends schemas before the full load.
 *
 * Discovers:
 * - Custom agent names from agents with `custom: true` in agent.yaml
 * - Custom domains from `domain` field of agents/skills with `custom: true`
 * - Custom skill IDs from skills with `custom: true` in metadata.yaml
 * - Custom categories from `category` field of skills with `custom: true`
 */
async function discoverAndExtendFromSource(basePath: string): Promise<void> {
  const { parse: parseYaml } = await import("yaml");

  const builtinSubcategories = new Set<string>(SUBCATEGORY_VALUES);
  const builtinDomains = new Set<string>(DOMAIN_VALUES);
  const customCategories: string[] = [];
  const customDomains: string[] = [];
  const customAgentNames: string[] = [];
  const customSkillIds: string[] = [];

  // Discover custom agent names and domains (only from agents that declare custom: true)
  const agentsDir = path.join(basePath, DIRS.agents);
  if (await directoryExists(agentsDir)) {
    const agentFiles = await glob(`**/${STANDARD_FILES.AGENT_YAML}`, agentsDir);
    for (const file of agentFiles) {
      try {
        const result = await discoverCustomAgentValues(agentsDir, file, parseYaml, builtinDomains);
        if (result.agentName) customAgentNames.push(result.agentName);
        if (result.domain) customDomains.push(result.domain);
      } catch {
        // Skip unreadable files — full loader will handle errors
      }
    }
  }

  // Discover custom skill IDs, categories, and domains from skills that declare custom: true in metadata.yaml
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
          builtinDomains,
        );
        if (result.skillId) customSkillIds.push(result.skillId);
        if (result.category) customCategories.push(result.category);
        if (result.domain) customDomains.push(result.domain);
      } catch {
        // Skip unreadable files
      }
    }
  }

  const hasCustomValues =
    customCategories.length > 0 ||
    customDomains.length > 0 ||
    customAgentNames.length > 0 ||
    customSkillIds.length > 0;

  if (hasCustomValues) {
    extendSchemasWithCustomValues({
      categories: unique(customCategories),
      domains: unique(customDomains),
      agentNames: customAgentNames,
      skillIds: customSkillIds,
    });
    verbose(
      `Extended schemas with ${unique(customCategories).length} custom categories, ${unique(customDomains).length} custom domains, ${customAgentNames.length} custom agents, ${customSkillIds.length} custom skill IDs`,
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
