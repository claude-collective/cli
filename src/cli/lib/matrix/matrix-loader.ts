import { parse as parseYaml } from "yaml";
import path from "path";
import { z } from "zod";
import { glob, readFile, fileExists } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import { DIRS, STANDARD_FILES } from "../../consts";
import { METADATA_KEYS } from "../metadata-keys";
import { parseFrontmatter } from "../loading";
import {
  skillsMatrixConfigSchema,
  formatZodErrors,
  categoryPathSchema,
  skillDisplayNameSchema,
  skillIdSchema,
} from "../schemas";
import type {
  AlternativeGroup,
  ConflictRule,
  DiscourageRule,
  ExtractedSkillMetadata,
  MergedSkillsMatrix,
  RecommendRule,
  RequireRule,
  ResolvedSkill,
  ResolvedStack,
  SkillAlternative,
  SkillDisplayName,
  SkillId,
  SkillRelation,
  SkillRequirement,
  SkillsMatrixConfig,
} from "../../types";

/** Resolves a raw ID (which may be a display name or alias) to a canonical SkillId */
type ResolveId = (id: SkillId, context?: string) => SkillId;

const rawMetadataSchema = z.object({
  category: categoryPathSchema,
  categoryExclusive: z.boolean().optional(),
  author: z.string(),
  cliName: z.string().optional(),
  cliDescription: z.string().optional(),
  usageGuidance: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // Lenient: accepts display names and skill IDs from YAML, resolved to canonical IDs during matrix merge
  compatibleWith: z.array(z.string() as z.ZodType<SkillId>).optional(),
  conflictsWith: z.array(z.string() as z.ZodType<SkillId>).optional(),
  requires: z.array(z.string() as z.ZodType<SkillId>).optional(),
  requiresSetup: z.array(z.string() as z.ZodType<SkillId>).optional(),
  providesSetupFor: z.array(z.string() as z.ZodType<SkillId>).optional(),
  custom: z.boolean().optional(),
});

/**
 * Loads and validates a skills matrix YAML configuration file.
 *
 * @param configPath - Absolute path to the skills-matrix.yaml file
 * @returns Parsed and validated skills matrix config
 * @throws When the file cannot be read or fails Zod schema validation
 */
export async function loadSkillsMatrix(configPath: string): Promise<SkillsMatrixConfig> {
  const content = await readFile(configPath);
  const raw = parseYaml(content);
  const result = skillsMatrixConfigSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(
      `Invalid skills matrix at '${configPath}': ${formatZodErrors(result.error.issues)}`,
    );
  }

  // Ensure optional fields have defaults for SkillsMatrixConfig compatibility
  // (relationships and skillAliases are optional in the schema for source matrices
  // that may only define custom categories)
  const data = result.data;
  const matrix: SkillsMatrixConfig = {
    version: data.version,
    categories: data.categories,
    relationships: data.relationships ?? {
      conflicts: [],
      discourages: [],
      recommends: [],
      requires: [],
      alternatives: [],
    },
    skillAliases: data.skillAliases ?? {},
  };

  verbose(`Loaded skills matrix: ${configPath}`);
  return matrix;
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
 * the required `cliName` field in metadata.yaml cause a hard error.
 *
 * @param skillsDir - Absolute path to the skills root directory (e.g., `{root}/src/skills`)
 * @returns Array of extracted skill metadata, one per valid skill found
 * @throws When a skill's metadata.yaml is missing the required `cliName` field
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

    if (!metadata.cliName) {
      throw new Error(
        `Skill at ${metadataFile} is missing required '${METADATA_KEYS.CLI_NAME}' field in metadata.yaml`,
      );
    }

    const skillId = frontmatter.name;

    const extracted: ExtractedSkillMetadata = {
      id: skillId,
      directoryPath: skillDir,
      description: metadata.cliDescription || frontmatter.description,
      usageGuidance: metadata.usageGuidance,
      category: metadata.category,
      categoryExclusive: metadata.categoryExclusive ?? true,
      author: metadata.author,
      tags: metadata.tags ?? [],
      compatibleWith: metadata.compatibleWith ?? [],
      conflictsWith: metadata.conflictsWith ?? [],
      requires: metadata.requires ?? [],
      requiresSetup: metadata.requiresSetup ?? [],
      providesSetupFor: metadata.providesSetupFor ?? [],
      path: `skills/${skillDir}/`,
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
 * Merges a skills matrix configuration with extracted skill metadata into a
 * fully resolved MergedSkillsMatrix.
 *
 * This is the core resolution step that combines:
 * - Category definitions and display name aliases from the matrix config
 * - Extracted skill metadata (from scanning skill directories)
 * - Relationship rules (conflicts, requirements, recommendations, alternatives, discourages)
 *
 * Each skill's raw relationship references (which may use display names, directory paths,
 * or short aliases) are resolved to canonical SkillIds. The result is the complete
 * data structure consumed by the wizard UI and validation logic.
 *
 * @param matrix - Parsed skills matrix config (categories, aliases, relationship rules)
 * @param skills - Extracted skill metadata from scanning skill directories
 * @returns Fully resolved matrix with canonical IDs, display names, and relationship data
 */
export async function mergeMatrixWithSkills(
  matrix: SkillsMatrixConfig,
  skills: ExtractedSkillMetadata[],
): Promise<MergedSkillsMatrix> {
  const displayNameToId = matrix.skillAliases;
  const displayNames = buildReverseDisplayNames(displayNameToId);
  const directoryPathToId = buildDirectoryPathToIdMap(skills);
  const resolvedSkills: Partial<Record<SkillId, ResolvedSkill>> = {};

  for (const skill of skills) {
    const resolved = buildResolvedSkill(
      skill,
      matrix,
      displayNameToId,
      displayNames,
      directoryPathToId,
    );
    resolvedSkills[skill.id] = resolved;
  }

  const suggestedStacks = resolveSuggestedStacks();

  const merged: MergedSkillsMatrix = {
    version: matrix.version,
    categories: matrix.categories,
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
  matrix: SkillsMatrixConfig,
  displayNameToId: Partial<Record<SkillDisplayName, SkillId>>,
  displayNames: Partial<Record<SkillId, SkillDisplayName>>,
  directoryPathToId: Record<string, SkillId>,
): ResolvedSkill {
  const resolve: ResolveId = (id, context) =>
    resolveToCanonicalId(
      id,
      displayNameToId,
      directoryPathToId,
      context ? `${skill.id} ${context}` : undefined,
    );

  const { relationships } = matrix;

  return {
    id: skill.id,
    displayName: displayNames[skill.id],
    description: skill.description,
    usageGuidance: skill.usageGuidance,
    category: skill.category,
    categoryExclusive: skill.categoryExclusive,
    tags: skill.tags,
    author: skill.author,
    conflictsWith: resolveConflicts(
      skill.id,
      skill.conflictsWith,
      relationships.conflicts,
      resolve,
    ),
    recommends: resolveRecommends(
      skill.id,
      skill.compatibleWith,
      relationships.recommends,
      resolve,
    ),
    requires: resolveRequirements(skill.id, skill.requires, relationships.requires, resolve),
    alternatives: resolveAlternatives(skill.id, relationships.alternatives, resolve),
    discourages: resolveDiscourages(skill.id, relationships.discourages, resolve),
    compatibleWith: skill.compatibleWith.map((id) => resolve(id, "compatibleWith")),
    requiresSetup: skill.requiresSetup.map((id) => resolve(id, "requiresSetup")),
    providesSetupFor: skill.providesSetupFor.map((id) => resolve(id, "providesSetupFor")),
    path: skill.path,
  };
}

function resolveSuggestedStacks(): ResolvedStack[] {
  return [];
}

/**
 * Convenience function that loads a skills matrix file, extracts all skills from
 * the project's skills directory, and merges them into a MergedSkillsMatrix.
 *
 * @param matrixPath - Path to the skills-matrix.yaml config file
 * @param projectRoot - Project root directory (skills are scanned from `{root}/src/skills`)
 * @returns Fully resolved and merged skills matrix
 */
export async function loadAndMergeSkillsMatrix(
  matrixPath: string,
  projectRoot: string,
): Promise<MergedSkillsMatrix> {
  const matrix = await loadSkillsMatrix(matrixPath);
  const skillsDir = path.join(projectRoot, DIRS.skills);
  const skills = await extractAllSkills(skillsDir);
  return mergeMatrixWithSkills(matrix, skills);
}
