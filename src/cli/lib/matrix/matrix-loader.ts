import { parse as parseYaml } from "yaml";
import path from "path";
import { z } from "zod";
import { glob, readFile, fileExists } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import { DIRS, STANDARD_FILES } from "../../consts";
import { METADATA_KEYS } from "../metadata-keys";
import { parseFrontmatter } from "../loading";
import {
  skillCategoriesFileSchema,
  skillRulesFileSchema,
  formatZodErrors,
  categoryPathSchema,
  skillDisplayNameSchema,
  skillIdSchema,
  extensibleDomainSchema,
  DOMAIN_VALUES,
} from "../schemas";
import type {
  AlternativeGroup,
  CategoryDefinition,
  CategoryMap,
  CategoryPath,
  ConflictRule,
  DiscourageRule,
  Domain,
  ExtractedSkillMetadata,
  MergedSkillsMatrix,
  PerSkillRules,
  RecommendRule,
  RelationshipDefinitions,
  RequireRule,
  ResolvedSkill,
  ResolvedStack,
  SkillAlternative,
  SkillDisplayName,
  SkillId,
  SkillRelation,
  SkillRequirement,
  SkillRulesConfig,
  Subcategory,
} from "../../types";

/** Resolves a raw ID (which may be a display name or alias) to a canonical SkillId */
type ResolveId = (id: SkillId, context?: string) => SkillId;

const rawMetadataSchema = z.object({
  category: categoryPathSchema,
  author: z.string(),
  displayName: z.string().optional(),
  cliDescription: z.string().optional(),
  usageGuidance: z.string().optional(),
  tags: z.array(z.string()).optional(),
  domain: extensibleDomainSchema.optional(),
  custom: z.boolean().optional(),
});

const KNOWN_DOMAINS = new Set<string>(DOMAIN_VALUES);
const AUTO_SYNTH_ORDER = 999;

/**
 * Synthesizes a basic CategoryDefinition for a category not defined in any
 * skill-categories.yaml. This is a safety net — the preferred path is for
 * skill authors to maintain proper skill-categories.yaml entries.
 */
export function synthesizeCategory(
  categoryPath: CategoryPath,
  skillDomain?: Domain,
): CategoryDefinition {
  const prefix = categoryPath.split("-")[0];
  const domain = skillDomain ?? (KNOWN_DOMAINS.has(prefix) ? (prefix as Domain) : undefined);

  const displayName = categoryPath
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    id: categoryPath as Subcategory,
    displayName,
    description: `Auto-generated category for ${categoryPath}`,
    domain,
    exclusive: true,
    required: false,
    order: AUTO_SYNTH_ORDER,
    custom: true,
  };
}

/**
 * Loads and validates a skill-categories.yaml configuration file.
 *
 * @param configPath - Absolute path to the skill-categories.yaml file
 * @returns Parsed and validated categories map
 * @throws When the file cannot be read or fails Zod schema validation
 */
export async function loadSkillCategories(configPath: string): Promise<CategoryMap> {
  const content = await readFile(configPath);
  const raw = parseYaml(content);
  const result = skillCategoriesFileSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(
      `Invalid skill categories at '${configPath}': ${formatZodErrors(result.error.issues)}`,
    );
  }

  verbose(`Loaded skill categories: ${configPath}`);
  return result.data.categories;
}

/**
 * Loads and validates a skill-rules.yaml configuration file.
 *
 * @param configPath - Absolute path to the skill-rules.yaml file
 * @returns Parsed and validated skill rules config
 * @throws When the file cannot be read or fails Zod schema validation
 */
export async function loadSkillRules(configPath: string): Promise<SkillRulesConfig> {
  const content = await readFile(configPath);
  const raw = parseYaml(content);
  const result = skillRulesFileSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(
      `Invalid skill rules at '${configPath}': ${formatZodErrors(result.error.issues)}`,
    );
  }

  const data = result.data;
  const config: SkillRulesConfig = {
    version: data.version,
    aliases: data.aliases ?? {},
    relationships: data.relationships ?? {
      conflicts: [],
      discourages: [],
      recommends: [],
      requires: [],
      alternatives: [],
    },
    perSkill: data["per-skill"] ?? {},
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
      ...(metadata.domain ? { domain: metadata.domain } : {}),
      ...(metadata.custom === true ? { custom: true } : {}),
    };

    skills.push(extracted);
    verbose(`Extracted skill: ${skillId}`);
  }

  return skills;
}

function buildReverseDisplayNames(
  displayNameToId: Partial<Record<SkillDisplayName, SkillId>>,
): Partial<Record<SkillId, SkillDisplayName>> {
  const reverse: Partial<Record<SkillId, SkillDisplayName>> = {};
  // Object.entries returns [string, SkillId | undefined][] — validate with Zod at boundary
  for (const [name, fullId] of Object.entries(displayNameToId)) {
    const nameResult = skillDisplayNameSchema.safeParse(name);
    const idResult = skillIdSchema.safeParse(fullId);
    if (nameResult.success && idResult.success) {
      reverse[idResult.data] = nameResult.data;
    } else {
      warn(
        `Invalid skill alias mapping: '${name}' -> '${fullId}'${!nameResult.success ? ` (invalid display name: ${nameResult.error.message})` : ""}${!idResult.success ? ` (invalid skill ID: ${idResult.error.message})` : ""}`,
      );
    }
  }
  return reverse;
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
  nameOrId: SkillId,
  displayNameToId: Partial<Record<SkillDisplayName, SkillId>>,
  directoryPathToId: Record<string, SkillId> = {},
  context?: string,
): SkillId {
  // Boundary cast: nameOrId may contain a display name from YAML — narrow to SkillDisplayName for lookup
  const displayNameResult = displayNameToId[nameOrId as unknown as SkillDisplayName];
  if (displayNameResult) {
    return displayNameResult;
  }
  if (directoryPathToId[nameOrId]) {
    return directoryPathToId[nameOrId];
  }
  if (context) {
    verbose(`Unresolved ID '${nameOrId}' in ${context} — passing through as-is`);
  }
  return nameOrId;
}

/**
 * Merges category definitions, relationship rules, and extracted skill metadata
 * into a fully resolved MergedSkillsMatrix.
 *
 * This is the core resolution step that combines:
 * - Category definitions from skill-categories.yaml
 * - Display name aliases and relationship rules from skill-rules.yaml
 * - Extracted skill metadata (from scanning skill directories)
 * - Per-skill relationship rules from skill-rules.yaml
 *
 * Each skill's raw relationship references (which may use display names, directory paths,
 * or short aliases) are resolved to canonical SkillIds. The result is the complete
 * data structure consumed by the wizard UI and validation logic.
 */
export async function mergeMatrixWithSkills(
  categories: CategoryMap,
  relationships: RelationshipDefinitions,
  aliases: Partial<Record<SkillDisplayName, SkillId>>,
  skills: ExtractedSkillMetadata[],
  perSkillRules?: Partial<Record<SkillDisplayName, PerSkillRules>>,
): Promise<MergedSkillsMatrix> {
  const displayNameToId = aliases;
  const displayNames = buildReverseDisplayNames(displayNameToId);
  const directoryPathToId = buildDirectoryPathToIdMap(skills);
  const resolvedSkills: Partial<Record<SkillId, ResolvedSkill>> = {};

  for (const skill of skills) {
    const resolved = buildResolvedSkill(
      skill,
      categories,
      relationships,
      displayNameToId,
      displayNames,
      directoryPathToId,
      perSkillRules,
    );
    resolvedSkills[skill.id] = resolved;
  }

  // Auto-synthesize missing categories for skills that reference undefined categories
  const synthesizedCategories = { ...categories };
  for (const skill of skills) {
    const subcategory = skill.category as Subcategory;
    if (!synthesizedCategories[subcategory]) {
      const synthesized = synthesizeCategory(skill.category, skill.domain);
      synthesizedCategories[subcategory] = synthesized;
      verbose(`Auto-synthesized category '${skill.category}' for skill '${skill.id}'`);
    }
  }

  const suggestedStacks = resolveSuggestedStacks();

  const merged: MergedSkillsMatrix = {
    version: "1.0.0",
    categories: synthesizedCategories,
    skills: resolvedSkills,
    suggestedStacks,
    displayNameToId,
    displayNames,
    generatedAt: new Date().toISOString(),
  };

  return merged;
}

/** Resolves conflicts from skill metadata and matrix conflict rules */
function resolveConflicts(
  skillId: SkillId,
  metadataConflicts: SkillId[],
  conflictRules: ConflictRule[],
  resolve: ResolveId,
): SkillRelation[] {
  const conflicts: SkillRelation[] = [];

  for (const conflictRef of metadataConflicts) {
    conflicts.push({
      skillId: resolve(conflictRef, "conflictsWith"),
      reason: "Defined in skill metadata",
    });
  }

  for (const rule of conflictRules) {
    const resolved = rule.skills.map((id) => resolve(id, "conflicts"));
    if (!resolved.includes(skillId)) continue;
    for (const other of resolved) {
      if (other !== skillId && !conflicts.some((c) => c.skillId === other)) {
        conflicts.push({ skillId: other, reason: rule.reason });
      }
    }
  }

  return conflicts;
}

/** Resolves recommendations from skill compatibleWith and matrix recommend rules */
function resolveRecommends(
  skillId: SkillId,
  compatibleWith: SkillId[],
  recommendRules: RecommendRule[],
  resolve: ResolveId,
): SkillRelation[] {
  const recommends: SkillRelation[] = [];

  for (const compatRef of compatibleWith) {
    recommends.push({
      skillId: resolve(compatRef, "compatibleWith"),
      reason: "Compatible with this skill",
    });
  }

  for (const rule of recommendRules) {
    if (resolve(rule.when, "recommends.when") !== skillId) continue;
    for (const suggested of rule.suggest) {
      const canonicalId = resolve(suggested, "recommends.suggest");
      if (!recommends.some((r) => r.skillId === canonicalId)) {
        recommends.push({ skillId: canonicalId, reason: rule.reason });
      }
    }
  }

  return recommends;
}

/** Resolves requirements from skill metadata and matrix require rules */
function resolveRequirements(
  skillId: SkillId,
  metadataRequires: SkillId[],
  requireRules: RequireRule[],
  resolve: ResolveId,
): SkillRequirement[] {
  const requires: SkillRequirement[] = [];

  if (metadataRequires.length > 0) {
    requires.push({
      skillIds: metadataRequires.map((id) => resolve(id, "requires")),
      needsAny: false,
      reason: "Defined in skill metadata",
    });
  }

  for (const rule of requireRules) {
    if (resolve(rule.skill, "requires.skill") !== skillId) continue;
    requires.push({
      skillIds: rule.needs.map((id) => resolve(id, "requires.needs")),
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
    const resolved = group.skills.map((id) => resolve(id, "alternatives"));
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
    const resolved = rule.skills.map((id) => resolve(id, "discourages"));
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
  displayNameToId: Partial<Record<SkillDisplayName, SkillId>>,
  displayNames: Partial<Record<SkillId, SkillDisplayName>>,
  directoryPathToId: Record<string, SkillId>,
  perSkillRules?: Partial<Record<SkillDisplayName, PerSkillRules>>,
): ResolvedSkill {
  const resolve: ResolveId = (id, context) =>
    resolveToCanonicalId(
      id,
      displayNameToId,
      directoryPathToId,
      context ? `${skill.id} ${context}` : undefined,
    );

  // Look up per-skill rules by alias (display name)
  const skillAlias = displayNames[skill.id];
  const perSkill = skillAlias ? perSkillRules?.[skillAlias] : undefined;

  return {
    id: skill.id,
    displayName: displayNames[skill.id],
    description: skill.description,
    usageGuidance: skill.usageGuidance,
    category: skill.category,
    tags: skill.tags,
    author: skill.author,
    conflictsWith: resolveConflicts(
      skill.id,
      perSkill?.conflictsWith ?? [],
      relationships.conflicts,
      resolve,
    ),
    recommends: resolveRecommends(
      skill.id,
      perSkill?.compatibleWith ?? [],
      relationships.recommends,
      resolve,
    ),
    requires: resolveRequirements(
      skill.id,
      perSkill?.requires ?? [],
      relationships.requires,
      resolve,
    ),
    alternatives: resolveAlternatives(skill.id, relationships.alternatives, resolve),
    discourages: resolveDiscourages(skill.id, relationships.discourages, resolve),
    compatibleWith: (perSkill?.compatibleWith ?? []).map((id) => resolve(id, "compatibleWith")),
    requiresSetup: (perSkill?.requiresSetup ?? []).map((id) => resolve(id, "requiresSetup")),
    providesSetupFor: (perSkill?.providesSetupFor ?? []).map((id) =>
      resolve(id, "providesSetupFor"),
    ),
    path: skill.path,
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
 * @param categoriesPath - Path to the skill-categories.yaml config file
 * @param rulesPath - Path to the skill-rules.yaml config file
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
  return mergeMatrixWithSkills(
    categories,
    rules.relationships,
    rules.aliases,
    skills,
    rules.perSkill,
  );
}
