import { parse as parseYaml } from "yaml";
import path from "path";
import { z } from "zod";
import { glob, readFile, fileExists } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import { DIRS, STANDARD_FILES } from "../../consts";
import { loadConfig } from "../configuration/config-loader";
import { METADATA_KEYS } from "../metadata-keys";
import { parseFrontmatter } from "../loading";
import {
  skillCategoriesFileSchema,
  skillRulesFileSchema,
  formatZodErrors,
  categoryPathSchema,
  extensibleDomainSchema,
  DOMAIN_VALUES,
} from "../schemas";
import type {
  AlternativeGroup,
  CategoryDefinition,
  CategoryMap,
  CategoryPath,
  CompatibilityGroup,
  ConflictRule,
  DiscourageRule,
  Domain,
  ExtractedSkillMetadata,
  MergedSkillsMatrix,
  Recommendation,
  RelationshipDefinitions,
  RequireRule,
  ResolvedSkill,
  ResolvedStack,
  SetupPair,
  SkillAlternative,
  SkillId,
  SkillRelation,
  SkillRequirement,
  SkillRulesConfig,
  SkillSlug,
  SkillSlugMap,
  Category,
} from "../../types";

/** Resolves a slug to a canonical SkillId */
type ResolveId = (slug: SkillSlug, context?: string) => SkillId;

const rawMetadataSchema = z.object({
  category: categoryPathSchema,
  author: z.string(),
  displayName: z.string().optional(),
  slug: z.string() as z.ZodType<SkillSlug>,
  cliDescription: z.string().optional(),
  usageGuidance: z.string().optional(),
  tags: z.array(z.string()).optional(),
  domain: extensibleDomainSchema,
  custom: z.boolean().optional(),
});

const KNOWN_DOMAINS = new Set<string>(DOMAIN_VALUES);
const AUTO_SYNTH_ORDER = 999;

/**
 * Synthesizes a basic CategoryDefinition for a category not defined in any
 * skill-categories.ts. This is a safety net — the preferred path is for
 * skill authors to maintain proper skill-categories.ts entries.
 */
export function synthesizeCategory(categoryPath: CategoryPath, domain: Domain): CategoryDefinition {
  const displayName = categoryPath
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    id: categoryPath as Category,
    displayName,
    description: `Auto-generated category for ${categoryPath}`,
    domain,
    exclusive: true,
    required: false,
    order: AUTO_SYNTH_ORDER,
  };
}

/**
 * Loads and validates a skill-categories.ts configuration file.
 *
 * @param configPath - Absolute path to the skill-categories.ts file
 * @returns Parsed and validated categories map
 * @throws When the file cannot be read or fails Zod schema validation
 */
export async function loadSkillCategories(configPath: string): Promise<CategoryMap> {
  const data = await loadConfig<{ version: string; categories: CategoryMap }>(
    configPath,
    skillCategoriesFileSchema,
  );

  if (!data) {
    throw new Error(`Invalid skill categories at '${configPath}': failed to load or validate`);
  }

  verbose(`Loaded skill categories: ${configPath}`);
  return data.categories;
}

/**
 * Loads and validates a skill-rules.ts configuration file.
 *
 * @param configPath - Absolute path to the skill-rules.ts file
 * @returns Parsed and validated skill rules config
 * @throws When the file cannot be read or fails Zod schema validation
 */
export async function loadSkillRules(configPath: string): Promise<SkillRulesConfig> {
  const data = await loadConfig<{
    version: string;
    relationships?: SkillRulesConfig["relationships"];
  }>(configPath, skillRulesFileSchema);

  if (!data) {
    throw new Error(`Invalid skill rules at '${configPath}': failed to load or validate`);
  }

  const config: SkillRulesConfig = {
    version: data.version,
    relationships: data.relationships ?? {
      conflicts: [],
      discourages: [],
      recommends: [],
      requires: [],
      alternatives: [],
    },
  };

  verbose(`Loaded skill rules: ${configPath}`);
  return config;
}

/**
 * Scans a skills directory and extracts metadata from all valid skills.
 *
 * Discovers skills by globbing for `metadata.yaml` files, then for each:
 * 1. Validates a corresponding SKILL.md exists (skips if missing)
 * 2. Parses and validates metadata.yaml against the raw metadata schema
 * 3. Parses SKILL.md frontmatter for the canonical skill ID
 * 4. Merges metadata fields into an ExtractedSkillMetadata object
 *
 * Skills with invalid metadata are warned and skipped. Skills missing
 * the required `displayName` field in metadata.yaml cause a hard error.
 *
 * @param skillsDir - Absolute path to the skills root directory (e.g., `{root}/src/skills`)
 * @returns Array of extracted skill metadata, one per valid skill found
 * @throws When a skill's metadata.yaml is missing the required `displayName` field
 */
export async function extractAllSkills(skillsDir: string): Promise<ExtractedSkillMetadata[]> {
  const skills: ExtractedSkillMetadata[] = [];
  const metadataFiles = await glob(`**/${STANDARD_FILES.METADATA_YAML}`, skillsDir);

  for (const metadataFile of metadataFiles) {
    const skillDir = path.dirname(metadataFile);
    const skillMdPath = path.join(skillsDir, skillDir, STANDARD_FILES.SKILL_MD);
    const metadataPath = path.join(skillsDir, metadataFile);

    if (!(await fileExists(skillMdPath))) {
      verbose(`Skipping ${metadataFile}: No ${STANDARD_FILES.SKILL_MD} found`);
      continue;
    }

    const metadataContent = await readFile(metadataPath);
    const rawMetadata = parseYaml(metadataContent);
    const metadataResult = rawMetadataSchema.safeParse(rawMetadata);

    if (!metadataResult.success) {
      warn(
        `Skipping '${metadataFile}': invalid metadata.yaml — ${formatZodErrors(metadataResult.error.issues)}`,
      );
      continue;
    }

    const metadata = metadataResult.data;
    const skillMdContent = await readFile(skillMdPath);
    const frontmatter = parseFrontmatter(skillMdContent, skillMdPath);

    if (!frontmatter) {
      verbose(`Skipping ${metadataFile}: Invalid SKILL.md frontmatter`);
      continue;
    }

    if (!metadata.displayName) {
      throw new Error(
        `Skill at ${metadataFile} is missing required '${METADATA_KEYS.DISPLAY_NAME}' field in metadata.yaml`,
      );
    }

    const skillId = frontmatter.name;

    const extracted: ExtractedSkillMetadata = {
      id: skillId,
      directoryPath: skillDir,
      description: metadata.cliDescription || frontmatter.description,
      usageGuidance: metadata.usageGuidance,
      category: metadata.category,
      author: metadata.author,
      tags: metadata.tags ?? [],
      path: `skills/${skillDir}/`,
      domain: metadata.domain,
      displayName: metadata.displayName,
      slug: metadata.slug,
      ...(metadata.custom === true ? { custom: true } : {}),
    };

    skills.push(extracted);
    verbose(`Extracted skill: ${skillId}`);
  }

  return skills;
}

/**
 * Builds a bidirectional slug <-> ID map from extracted skill metadata.
 * Warns on duplicate slugs (first one wins).
 */
function buildSlugMap(skills: ExtractedSkillMetadata[]): SkillSlugMap {
  // Boundary cast: empty objects are populated in the loop below
  const slugToId = {} as Record<SkillSlug, SkillId>;
  const idToSlug = {} as Record<SkillId, SkillSlug>;

  for (const skill of skills) {
    const existingId = slugToId[skill.slug];
    if (existingId) {
      warn(
        `Duplicate slug '${skill.slug}': already mapped to '${existingId}', ignoring '${skill.id}'`,
      );
      continue;
    }

    slugToId[skill.slug] = skill.id;
    idToSlug[skill.id] = skill.slug;
  }

  return { slugToId, idToSlug };
}

function buildDirectoryPathToIdMap(skills: ExtractedSkillMetadata[]): Record<string, SkillId> {
  const map: Record<string, SkillId> = {};
  for (const skill of skills) {
    if (skill.directoryPath && skill.directoryPath !== skill.id) {
      map[skill.directoryPath] = skill.id;
    }
  }
  return map;
}

function resolveToCanonicalId(
  slug: SkillSlug,
  slugToId: SkillSlugMap["slugToId"],
  directoryPathToId: Record<string, SkillId> = {},
  context?: string,
): SkillId {
  const slugResult = slugToId[slug];
  if (slugResult) {
    return slugResult;
  }
  // Fallback: check directory path mapping (unlikely for slugs, but keeps backward compat)
  if (directoryPathToId[slug]) {
    return directoryPathToId[slug];
  }
  if (context) {
    verbose(`Unresolved slug '${slug}' in ${context} — passing through as-is`);
  }
  // Boundary cast: unresolved slugs pass through as-is (will be caught by matrix health check)
  return slug as unknown as SkillId;
}

/**
 * Merges category definitions, relationship rules, and extracted skill metadata
 * into a fully resolved MergedSkillsMatrix.
 *
 * This is the core resolution step that combines:
 * - Category definitions from skill-categories.ts
 * - Slug-based alias maps derived from metadata
 * - Relationship rules from skill-rules.ts
 * - Extracted skill metadata (from scanning skill directories)
 *
 * Each skill's raw relationship references are resolved to canonical SkillIds.
 * The result is the complete data structure consumed by the wizard UI and validation logic.
 */
export async function mergeMatrixWithSkills(
  categories: CategoryMap,
  relationships: RelationshipDefinitions,
  skills: ExtractedSkillMetadata[],
): Promise<MergedSkillsMatrix> {
  const slugMap = buildSlugMap(skills);
  const directoryPathToId = buildDirectoryPathToIdMap(skills);
  const resolvedSkills: Partial<Record<SkillId, ResolvedSkill>> = {};

  for (const skill of skills) {
    const resolved = buildResolvedSkill(
      skill,
      categories,
      relationships,
      slugMap,
      directoryPathToId,
    );
    resolvedSkills[skill.id] = resolved;
  }

  // Auto-synthesize missing categories for skills that reference undefined categories
  const synthesizedCategories = { ...categories };
  for (const skill of skills) {
    const category = skill.category as Category;
    if (!synthesizedCategories[category]) {
      const synthesized = synthesizeCategory(skill.category, skill.domain);
      synthesizedCategories[category] = synthesized;
      verbose(`Auto-synthesized category '${skill.category}' for skill '${skill.id}'`);
    }
  }

  const suggestedStacks = resolveSuggestedStacks();

  const merged: MergedSkillsMatrix = {
    version: "1.0.0",
    categories: synthesizedCategories,
    skills: resolvedSkills,
    suggestedStacks,
    slugMap,
    generatedAt: new Date().toISOString(),
  };

  return merged;
}

/** Resolves conflicts from centralized conflict rules */
function resolveConflicts(
  skillId: SkillId,
  conflictRules: ConflictRule[],
  resolve: ResolveId,
): SkillRelation[] {
  const conflicts: SkillRelation[] = [];

  for (const rule of conflictRules) {
    const resolved = rule.skills.map((slug) => resolve(slug, "conflicts"));
    if (!resolved.includes(skillId)) continue;
    for (const other of resolved) {
      if (other !== skillId && !conflicts.some((c) => c.skillId === other)) {
        conflicts.push({ skillId: other, reason: rule.reason });
      }
    }
  }

  return conflicts;
}

/** Resolves compatibility from CompatibilityGroup[] — collects all co-members across all groups */
function resolveCompatibilityGroups(
  skillId: SkillId,
  compatibilityGroups: CompatibilityGroup[],
  resolve: ResolveId,
): SkillId[] {
  const compatible = new Set<SkillId>();

  for (const group of compatibilityGroups) {
    const resolved = group.skills.map((slug) => resolve(slug, "compatibleWith"));
    if (!resolved.includes(skillId)) continue;
    for (const other of resolved) {
      if (other !== skillId) {
        compatible.add(other);
      }
    }
  }

  return [...compatible];
}

/** Resolves setup pairs — returns requiresSetup and providesSetupFor for a skill */
function resolveSetupPairs(
  skillId: SkillId,
  setupPairs: SetupPair[],
  resolve: ResolveId,
): Pick<ResolvedSkill, "requiresSetup" | "providesSetupFor"> {
  const requiresSetup = new Set<SkillId>();
  const providesSetupFor = new Set<SkillId>();

  for (const pair of setupPairs) {
    const setupId = resolve(pair.setup, "setupPairs.setup");
    const configuresIds = pair.configures.map((slug) => resolve(slug, "setupPairs.configures"));

    if (setupId === skillId) {
      // This skill is a setup skill — it provides setup for the configured skills
      for (const configuredId of configuresIds) {
        providesSetupFor.add(configuredId);
      }
    }

    if (configuresIds.includes(skillId)) {
      // This skill requires the setup skill
      requiresSetup.add(setupId);
    }
  }

  return {
    requiresSetup: [...requiresSetup],
    providesSetupFor: [...providesSetupFor],
  };
}

/** Resolves requirements from centralized require rules */
function resolveRequirements(
  skillId: SkillId,
  requireRules: RequireRule[],
  resolve: ResolveId,
): SkillRequirement[] {
  const requires: SkillRequirement[] = [];

  for (const rule of requireRules) {
    if (resolve(rule.skill, "requires.skill") !== skillId) continue;
    requires.push({
      skillIds: rule.needs.map((slug) => resolve(slug, "requires.needs")),
      needsAny: rule.needsAny ?? false,
      reason: rule.reason,
    });
  }

  return requires;
}

/** Resolves alternatives from matrix alternative groups */
function resolveAlternatives(
  skillId: SkillId,
  alternativeGroups: AlternativeGroup[],
  resolve: ResolveId,
): SkillAlternative[] {
  const alternatives: SkillAlternative[] = [];

  for (const group of alternativeGroups) {
    const resolved = group.skills.map((slug) => resolve(slug, "alternatives"));
    if (!resolved.includes(skillId)) continue;
    for (const alt of resolved) {
      if (alt !== skillId) {
        alternatives.push({ skillId: alt, purpose: group.purpose });
      }
    }
  }

  return alternatives;
}

/** Resolves discourages from matrix discourage rules */
function resolveDiscourages(
  skillId: SkillId,
  discourageRules: DiscourageRule[] | undefined,
  resolve: ResolveId,
): SkillRelation[] {
  if (!discourageRules) return [];
  const discourages: SkillRelation[] = [];

  for (const rule of discourageRules) {
    const resolved = rule.skills.map((slug) => resolve(slug, "discourages"));
    if (!resolved.includes(skillId)) continue;
    for (const other of resolved) {
      if (other !== skillId && !discourages.some((d) => d.skillId === other)) {
        discourages.push({ skillId: other, reason: rule.reason });
      }
    }
  }

  return discourages;
}

function buildResolvedSkill(
  skill: ExtractedSkillMetadata,
  _categories: CategoryMap,
  relationships: RelationshipDefinitions,
  slugMap: SkillSlugMap,
  directoryPathToId: Record<string, SkillId>,
): ResolvedSkill {
  const resolve: ResolveId = (slug, context) =>
    resolveToCanonicalId(
      slug,
      slugMap.slugToId,
      directoryPathToId,
      context ? `${skill.id} ${context}` : undefined,
    );

  const slug = skill.slug;

  // Look up isRecommended/recommendedReason from flat recommends list (now slug-based)
  const recommendation = relationships.recommends.find((r) => r.skill === skill.slug);

  // Resolve setup pairs
  const { requiresSetup, providesSetupFor } = resolveSetupPairs(
    skill.id,
    relationships.setupPairs ?? [],
    resolve,
  );

  return {
    id: skill.id,
    slug,
    displayName: skill.displayName,
    description: skill.description,
    usageGuidance: skill.usageGuidance,
    category: skill.category,
    tags: skill.tags,
    author: skill.author,
    conflictsWith: resolveConflicts(skill.id, relationships.conflicts, resolve),
    isRecommended: recommendation != null,
    recommendedReason: recommendation?.reason,
    requires: resolveRequirements(skill.id, relationships.requires, resolve),
    alternatives: resolveAlternatives(skill.id, relationships.alternatives, resolve),
    discourages: resolveDiscourages(skill.id, relationships.discourages, resolve),
    compatibleWith: resolveCompatibilityGroups(
      skill.id,
      relationships.compatibleWith ?? [],
      resolve,
    ),
    requiresSetup,
    providesSetupFor,
    path: skill.path,
    ...(skill.custom === true ? { custom: true } : {}),
  };
}

function resolveSuggestedStacks(): ResolvedStack[] {
  return [];
}

/**
 * Convenience function that loads categories and rules from standalone files,
 * extracts all skills from the project's skills directory, and merges them
 * into a MergedSkillsMatrix.
 *
 * @param categoriesPath - Path to the skill-categories.ts config file
 * @param rulesPath - Path to the skill-rules.ts config file
 * @param projectRoot - Project root directory (skills are scanned from `{root}/src/skills`)
 * @returns Fully resolved and merged skills matrix
 */
export async function loadAndMergeSkillsMatrix(
  categoriesPath: string,
  rulesPath: string,
  projectRoot: string,
): Promise<MergedSkillsMatrix> {
  const categories = await loadSkillCategories(categoriesPath);
  const rules = await loadSkillRules(rulesPath);
  const skillsDir = path.join(projectRoot, DIRS.skills);
  const skills = await extractAllSkills(skillsDir);
  return mergeMatrixWithSkills(categories, rules.relationships, skills);
}
