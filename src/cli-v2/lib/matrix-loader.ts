import { parse as parseYaml } from "yaml";
import path from "path";
import { glob, readFile, fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { DIRS } from "../consts";
import { parseFrontmatter } from "./loader";
import type {
  SkillsMatrixConfig,
  ExtractedSkillMetadata,
  MergedSkillsMatrix,
  ResolvedSkill,
  ResolvedStack,
  SkillRelation,
  SkillRequirement,
  SkillAlternative,
} from "../types-matrix";

interface RawMetadata {
  category: string;
  category_exclusive?: boolean;
  author: string;
  version: string;
  cli_name?: string;
  cli_description?: string;
  usage_guidance?: string;
  tags?: string[];
  compatible_with?: string[];
  conflicts_with?: string[];
  requires?: string[];
  requires_setup?: string[];
  provides_setup_for?: string[];
}

export async function loadSkillsMatrix(
  configPath: string,
): Promise<SkillsMatrixConfig> {
  const content = await readFile(configPath);
  const config = parseYaml(content) as SkillsMatrixConfig;

  validateMatrixStructure(config, configPath);

  verbose(`Loaded skills matrix: ${configPath}`);
  return config;
}

function validateMatrixStructure(
  config: SkillsMatrixConfig,
  configPath: string,
): void {
  // Note: suggested_stacks removed from required - stacks now defined in config/stacks.yaml (Phase 6)
  const requiredFields = [
    "version",
    "categories",
    "relationships",
    "skill_aliases",
  ];
  const missing = requiredFields.filter((field) => !(field in config));

  if (missing.length > 0) {
    throw new Error(
      `Skills matrix at ${configPath} is missing required fields: ${missing.join(", ")}`,
    );
  }

  const relationshipFields = [
    "conflicts",
    "recommends",
    "requires",
    "alternatives",
  ];
  const missingRelationships = relationshipFields.filter(
    (field) => !config.relationships || !(field in config.relationships),
  );

  if (missingRelationships.length > 0) {
    throw new Error(
      `Skills matrix relationships missing required fields: ${missingRelationships.join(", ")}`,
    );
  }

  for (const [categoryId, category] of Object.entries(config.categories)) {
    const requiredCategoryFields = [
      "id",
      "name",
      "description",
      "exclusive",
      "required",
      "order",
    ];
    const missingCategoryFields = requiredCategoryFields.filter(
      (field) => !(field in category),
    );

    if (missingCategoryFields.length > 0) {
      throw new Error(
        `Category "${categoryId}" missing required fields: ${missingCategoryFields.join(", ")}`,
      );
    }
  }
}

export async function extractAllSkills(
  skillsDir: string,
): Promise<ExtractedSkillMetadata[]> {
  const skills: ExtractedSkillMetadata[] = [];
  const metadataFiles = await glob("**/metadata.yaml", skillsDir);

  for (const metadataFile of metadataFiles) {
    const skillDir = path.dirname(metadataFile);
    const skillMdPath = path.join(skillsDir, skillDir, "SKILL.md");
    const metadataPath = path.join(skillsDir, metadataFile);

    if (!(await fileExists(skillMdPath))) {
      verbose(`Skipping ${metadataFile}: No SKILL.md found`);
      continue;
    }

    const metadataContent = await readFile(metadataPath);
    const metadata = parseYaml(metadataContent) as RawMetadata;
    const skillMdContent = await readFile(skillMdPath);
    const frontmatter = parseFrontmatter(skillMdContent);

    if (!frontmatter) {
      verbose(`Skipping ${metadataFile}: Invalid SKILL.md frontmatter`);
      continue;
    }

    if (!metadata.cli_name) {
      throw new Error(
        `Skill at ${metadataFile} is missing required 'cli_name' field in metadata.yaml`,
      );
    }

    const skillId = frontmatter.name;

    const extracted: ExtractedSkillMetadata = {
      id: skillId,
      directoryPath: skillDir,
      name: `${metadata.cli_name} ${metadata.author}`,
      description: metadata.cli_description || frontmatter.description,
      usageGuidance: metadata.usage_guidance,
      category: metadata.category,
      categoryExclusive: metadata.category_exclusive ?? true,
      author: metadata.author,
      tags: metadata.tags ?? [],
      compatibleWith: metadata.compatible_with ?? [],
      conflictsWith: metadata.conflicts_with ?? [],
      requires: metadata.requires ?? [],
      requiresSetup: metadata.requires_setup ?? [],
      providesSetupFor: metadata.provides_setup_for ?? [],
      path: `skills/${skillDir}/`,
    };

    skills.push(extracted);
    verbose(`Extracted skill: ${skillId}`);
  }

  return skills;
}

function buildReverseAliases(
  aliases: Record<string, string>,
): Record<string, string> {
  const reverse: Record<string, string> = {};
  for (const [alias, fullId] of Object.entries(aliases)) {
    reverse[fullId] = alias;
  }
  return reverse;
}

/**
 * Build a map from short names to actual skill IDs.
 *
 * This handles multiple formats used in skill metadata:
 * - "react (@vince)" -> "web/framework/react (@vince)"
 * - "react" -> "web/framework/react (@vince)"
 * - Old alias targets that may still exist in metadata files
 */
function buildAliasTargetToSkillIdMap(
  aliases: Record<string, string>,
  skills: ExtractedSkillMetadata[],
): Record<string, string> {
  const map: Record<string, string> = {};

  for (const skill of skills) {
    // Extract the "short author" form: last path segment with author
    // e.g., "web/framework/react (@vince)" -> "react (@vince)"
    const parts = skill.id.split("/");
    const shortForm = parts[parts.length - 1];

    if (shortForm && shortForm !== skill.id) {
      map[shortForm] = skill.id;
    }

    // Also map directory name without author if different
    // e.g., "web/framework/react" -> "web/framework/react (@vince)"
    if (skill.directoryPath && skill.directoryPath !== skill.id) {
      map[skill.directoryPath] = skill.id;
    }
  }

  // Also include any old-style alias targets that might still be referenced
  const aliasTargets = new Set(Object.values(aliases));
  for (const skill of skills) {
    for (const aliasTarget of aliasTargets) {
      if (
        aliasTarget !== skill.id &&
        (skill.id.endsWith(`/${aliasTarget}`) || skill.id === aliasTarget)
      ) {
        map[aliasTarget] = skill.id;
      }
    }
  }

  return map;
}

function buildDirectoryPathToIdMap(
  skills: ExtractedSkillMetadata[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const skill of skills) {
    if (skill.directoryPath && skill.directoryPath !== skill.id) {
      map[skill.directoryPath] = skill.id;
    }
  }
  return map;
}

function resolveToCanonicalId(
  aliasOrId: string,
  aliases: Record<string, string>,
  directoryPathToId: Record<string, string> = {},
  aliasTargetToSkillId: Record<string, string> = {},
): string {
  if (aliases[aliasOrId]) {
    return aliases[aliasOrId];
  }
  if (directoryPathToId[aliasOrId]) {
    return directoryPathToId[aliasOrId];
  }
  // Handle "short author" format like "react (@vince)" that maps to full ID
  if (aliasTargetToSkillId[aliasOrId]) {
    return aliasTargetToSkillId[aliasOrId];
  }
  return aliasOrId;
}

export async function mergeMatrixWithSkills(
  matrix: SkillsMatrixConfig,
  skills: ExtractedSkillMetadata[],
): Promise<MergedSkillsMatrix> {
  const aliases = matrix.skill_aliases;
  const aliasesReverse = buildReverseAliases(aliases);
  const directoryPathToId = buildDirectoryPathToIdMap(skills);
  const aliasTargetToSkillId = buildAliasTargetToSkillIdMap(aliases, skills);
  const resolvedSkills: Record<string, ResolvedSkill> = {};

  for (const skill of skills) {
    const resolved = buildResolvedSkill(
      skill,
      matrix,
      aliases,
      aliasesReverse,
      directoryPathToId,
      aliasTargetToSkillId,
    );
    resolvedSkills[skill.id] = resolved;
  }

  computeInverseRelationships(resolvedSkills);
  const suggestedStacks = resolveSuggestedStacks(
    matrix,
    aliases,
    aliasTargetToSkillId,
  );

  const merged: MergedSkillsMatrix = {
    version: matrix.version,
    categories: matrix.categories,
    skills: resolvedSkills,
    suggestedStacks,
    aliases,
    aliasesReverse,
    generatedAt: new Date().toISOString(),
  };

  return merged;
}

function buildResolvedSkill(
  skill: ExtractedSkillMetadata,
  matrix: SkillsMatrixConfig,
  aliases: Record<string, string>,
  aliasesReverse: Record<string, string>,
  directoryPathToId: Record<string, string>,
  aliasTargetToSkillId: Record<string, string>,
): ResolvedSkill {
  const conflictsWith: SkillRelation[] = [];
  const recommends: SkillRelation[] = [];
  const requires: SkillRequirement[] = [];
  const alternatives: SkillAlternative[] = [];
  const discourages: SkillRelation[] = [];

  // Helper to resolve with all maps
  const resolve = (id: string) =>
    resolveToCanonicalId(id, aliases, directoryPathToId, aliasTargetToSkillId);

  for (const conflictRef of skill.conflictsWith) {
    const canonicalId = resolve(conflictRef);
    conflictsWith.push({
      skillId: canonicalId,
      reason: "Defined in skill metadata",
    });
  }

  for (const conflictRule of matrix.relationships.conflicts) {
    const resolvedSkills = conflictRule.skills.map(resolve);
    if (resolvedSkills.includes(skill.id)) {
      for (const otherSkill of resolvedSkills) {
        if (otherSkill !== skill.id) {
          if (!conflictsWith.some((c) => c.skillId === otherSkill)) {
            conflictsWith.push({
              skillId: otherSkill,
              reason: conflictRule.reason,
            });
          }
        }
      }
    }
  }

  for (const compatRef of skill.compatibleWith) {
    const canonicalId = resolve(compatRef);
    recommends.push({
      skillId: canonicalId,
      reason: "Compatible with this skill",
    });
  }

  for (const recommendRule of matrix.relationships.recommends) {
    const whenCanonicalId = resolve(recommendRule.when);
    if (whenCanonicalId === skill.id) {
      for (const suggested of recommendRule.suggest) {
        const canonicalId = resolve(suggested);
        if (!recommends.some((r) => r.skillId === canonicalId)) {
          recommends.push({
            skillId: canonicalId,
            reason: recommendRule.reason,
          });
        }
      }
    }
  }

  if (skill.requires.length > 0) {
    requires.push({
      skillIds: skill.requires.map(resolve),
      needsAny: false,
      reason: "Defined in skill metadata",
    });
  }

  for (const requireRule of matrix.relationships.requires) {
    const skillCanonicalId = resolve(requireRule.skill);
    if (skillCanonicalId === skill.id) {
      requires.push({
        skillIds: requireRule.needs.map(resolve),
        needsAny: requireRule.needs_any ?? false,
        reason: requireRule.reason,
      });
    }
  }

  for (const altGroup of matrix.relationships.alternatives) {
    const resolvedAlts = altGroup.skills.map(resolve);
    if (resolvedAlts.includes(skill.id)) {
      for (const altSkill of resolvedAlts) {
        if (altSkill !== skill.id) {
          alternatives.push({
            skillId: altSkill,
            purpose: altGroup.purpose,
          });
        }
      }
    }
  }

  if (matrix.relationships.discourages) {
    for (const discourageRule of matrix.relationships.discourages) {
      const resolvedSkills = discourageRule.skills.map(resolve);
      if (resolvedSkills.includes(skill.id)) {
        for (const otherSkill of resolvedSkills) {
          if (otherSkill !== skill.id) {
            if (!discourages.some((d) => d.skillId === otherSkill)) {
              discourages.push({
                skillId: otherSkill,
                reason: discourageRule.reason,
              });
            }
          }
        }
      }
    }
  }

  return {
    id: skill.id,
    alias: aliasesReverse[skill.id],
    name: skill.name,
    description: skill.description,
    usageGuidance: skill.usageGuidance,
    category: skill.category,
    categoryExclusive: skill.categoryExclusive,
    tags: skill.tags,
    author: skill.author,
    conflictsWith,
    recommends,
    recommendedBy: [],
    requires,
    requiredBy: [],
    alternatives,
    discourages,
    requiresSetup: skill.requiresSetup.map(resolve),
    providesSetupFor: skill.providesSetupFor.map(resolve),
    path: skill.path,
  };
}

function computeInverseRelationships(
  skills: Record<string, ResolvedSkill>,
): void {
  for (const skill of Object.values(skills)) {
    for (const recommend of skill.recommends) {
      const targetSkill = skills[recommend.skillId];
      if (targetSkill) {
        targetSkill.recommendedBy.push({
          skillId: skill.id,
          reason: recommend.reason,
        });
      }
    }

    for (const requirement of skill.requires) {
      for (const requiredId of requirement.skillIds) {
        const targetSkill = skills[requiredId];
        if (targetSkill) {
          targetSkill.requiredBy.push({
            skillId: skill.id,
            reason: requirement.reason,
          });
        }
      }
    }
  }
}

function resolveSuggestedStacks(
  matrix: SkillsMatrixConfig,
  aliases: Record<string, string>,
  aliasTargetToSkillId: Record<string, string>,
): ResolvedStack[] {
  // Phase 6: suggested_stacks is now optional (stacks moved to config/stacks.yaml)
  if (!matrix.suggested_stacks) {
    return [];
  }
  return matrix.suggested_stacks.map((stack) => {
    const resolvedSkillsMap: Record<string, Record<string, string>> = {};
    const allSkillIds: string[] = [];

    for (const [category, subcategories] of Object.entries(stack.skills)) {
      resolvedSkillsMap[category] = {};
      for (const [subcategory, alias] of Object.entries(subcategories)) {
        // First resolve the alias to its target (e.g., "react" -> "react (@vince)")
        const aliasTarget = resolveToCanonicalId(alias, aliases);
        // Then check if the alias target needs to be mapped to a full skill ID
        // (e.g., "react (@vince)" -> "web/framework/react (@vince)")
        const canonicalId = aliasTargetToSkillId[aliasTarget] || aliasTarget;
        resolvedSkillsMap[category][subcategory] = canonicalId;
        allSkillIds.push(canonicalId);
      }
    }

    return {
      id: stack.id,
      name: stack.name,
      description: stack.description,
      audience: stack.audience,
      skills: resolvedSkillsMap,
      allSkillIds,
      philosophy: stack.philosophy,
    };
  });
}

export async function loadAndMergeSkillsMatrix(
  matrixPath: string,
  projectRoot: string,
): Promise<MergedSkillsMatrix> {
  const matrix = await loadSkillsMatrix(matrixPath);
  const skillsDir = path.join(projectRoot, DIRS.skills);
  const skills = await extractAllSkills(skillsDir);
  return mergeMatrixWithSkills(matrix, skills);
}
