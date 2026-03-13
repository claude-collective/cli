import { verbose, warn } from "../../utils/logger";
import type {
  AlternativeGroup,
  CategoryDefinition,
  CategoryMap,
  CompatibilityGroup,
  ConflictRule,
  DiscourageRule,
  Domain,
  ExtractedSkillMetadata,
  MergedSkillsMatrix,
  RelationshipDefinitions,
  RequireRule,
  ResolvedSkill,
  SkillAlternative,
  SkillId,
  SkillRelation,
  SkillRequirement,
  SkillSlug,
  SkillSlugMap,
  Category,
} from "../../types";

/** Resolves a slug to a canonical SkillId, or null if unresolvable */
type ResolveId = (slug: SkillSlug, context?: string) => SkillId | null;

const AUTO_SYNTH_ORDER = 999;

/**
 * Synthesizes a basic CategoryDefinition for a category not defined in any
 * skill-categories.ts. This is a safety net — the preferred path is for
 * skill authors to maintain proper skill-categories.ts entries.
 */
export function synthesizeCategory(category: Category, domain: Domain): CategoryDefinition {
  const displayName = category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    id: category,
    displayName,
    description: `Auto-generated category for ${category}`,
    domain,
    exclusive: false,
    required: false,
    order: AUTO_SYNTH_ORDER,
  };
}

/**
 * Builds a bidirectional slug <-> ID map from extracted skill metadata.
 * Warns on duplicate slugs (first one wins).
 */
function buildSlugMap(skills: ExtractedSkillMetadata[]): SkillSlugMap {
  const slugToId: Partial<Record<SkillSlug, SkillId>> = {};
  const idToSlug: Partial<Record<SkillId, SkillSlug>> = {};

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

function resolveToCanonicalId(
  slug: SkillSlug,
  slugToId: SkillSlugMap["slugToId"],
  context?: string,
): SkillId | null {
  const slugResult = slugToId[slug];
  if (slugResult) {
    return slugResult;
  }
  const location = context ? ` in ${context}` : "";
  verbose(`Unresolved slug '${slug}'${location} — skipping`);
  return null;
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
export function mergeMatrixWithSkills(
  categories: CategoryMap,
  relationships: RelationshipDefinitions,
  skills: ExtractedSkillMetadata[],
): MergedSkillsMatrix {
  const slugMap = buildSlugMap(skills);
  const resolvedSkills: Partial<Record<SkillId, ResolvedSkill>> = {};

  for (const skill of skills) {
    const resolved = buildResolvedSkill(skill, categories, relationships, slugMap);
    resolvedSkills[skill.id] = resolved;
  }

  // Auto-synthesize missing categories for skills that reference undefined categories
  const synthesizedCategories = { ...categories };
  for (const skill of skills) {
    // Skip "local" pseudo-category — it's not a real Category union member
    if (skill.category === "local") continue;
    if (!synthesizedCategories[skill.category]) {
      const synthesized = synthesizeCategory(skill.category, skill.domain);
      synthesizedCategories[skill.category] = synthesized;
      verbose(`Auto-synthesized category '${skill.category}' for skill '${skill.id}'`);
    }
  }

  const merged: MergedSkillsMatrix = {
    version: "1.0.0",
    categories: synthesizedCategories,
    skills: resolvedSkills,
    suggestedStacks: [],
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
    const resolved = rule.skills
      .map((slug) => resolve(slug, "conflicts"))
      .filter((id): id is SkillId => id !== null);
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
    const resolved = group.skills
      .map((slug) => resolve(slug, "compatibleWith"))
      .filter((id): id is SkillId => id !== null);
    if (!resolved.includes(skillId)) continue;
    for (const other of resolved) {
      if (other !== skillId) {
        compatible.add(other);
      }
    }
  }

  return [...compatible];
}

/** Resolves requirements from centralized require rules */
function resolveRequirements(
  skillId: SkillId,
  requireRules: RequireRule[],
  resolve: ResolveId,
): SkillRequirement[] {
  const requires: SkillRequirement[] = [];

  for (const rule of requireRules) {
    const ruleSkillId = resolve(rule.skill, "requires.skill");
    if (ruleSkillId !== skillId) continue;
    const resolvedNeeds = rule.needs
      .map((slug) => resolve(slug, "requires.needs"))
      .filter((id): id is SkillId => id !== null);
    if (resolvedNeeds.length === 0) continue;
    requires.push({
      skillIds: resolvedNeeds,
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
    const resolved = group.skills
      .map((slug) => resolve(slug, "alternatives"))
      .filter((id): id is SkillId => id !== null);
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
    const resolved = rule.skills
      .map((slug) => resolve(slug, "discourages"))
      .filter((id): id is SkillId => id !== null);
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
): ResolvedSkill {
  const resolve: ResolveId = (slug, context) =>
    resolveToCanonicalId(slug, slugMap.slugToId, context ? `${skill.id} ${context}` : undefined);

  const slug = skill.slug;

  // Look up isRecommended/recommendedReason from flat recommends list (now slug-based)
  const recommendation = relationships.recommends.find((r) => r.skill === skill.slug);

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
    path: skill.path,
    ...(skill.custom === true ? { custom: true } : {}),
  };
}
