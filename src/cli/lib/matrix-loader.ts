import { parse as parseYaml } from "yaml";
import path from "path";
import { z } from "zod";
import { glob, readFile, fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { DIRS } from "../consts";
import { parseFrontmatter } from "./loader";
import {
  skillsMatrixConfigSchema,
  skillRefSchema,
  categoryPathSchema,
  skillAliasSchema,
  skillIdSchema,
} from "./schemas";
import type {
  SkillsMatrixConfig,
  ExtractedSkillMetadata,
  MergedSkillsMatrix,
  ResolvedSkill,
  ResolvedStack,
  SkillRelation,
  SkillRequirement,
  SkillAlternative,
  SkillId,
  SkillAlias,
  SkillRef,
} from "../types-matrix";

/** Zod schema for RawMetadata from individual skill metadata.yaml files */
const rawMetadataSchema = z.object({
  category: categoryPathSchema,
  category_exclusive: z.boolean().optional(),
  author: z.string(),
  version: z.coerce.string(),
  cli_name: z.string().optional(),
  cli_description: z.string().optional(),
  usage_guidance: z.string().optional(),
  tags: z.array(z.string()).optional(),
  compatible_with: z.array(skillRefSchema).optional(),
  conflicts_with: z.array(skillRefSchema).optional(),
  requires: z.array(skillRefSchema).optional(),
  requires_setup: z.array(skillRefSchema).optional(),
  provides_setup_for: z.array(skillRefSchema).optional(),
});

type RawMetadata = z.infer<typeof rawMetadataSchema>;

export async function loadSkillsMatrix(configPath: string): Promise<SkillsMatrixConfig> {
  const content = await readFile(configPath);
  const raw = parseYaml(content);
  const result = skillsMatrixConfigSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(
      `Invalid skills matrix at ${configPath}: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }

  verbose(`Loaded skills matrix: ${configPath}`);
  return result.data;
}

export async function extractAllSkills(skillsDir: string): Promise<ExtractedSkillMetadata[]> {
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
    const rawMetadata = parseYaml(metadataContent);
    const metadataResult = rawMetadataSchema.safeParse(rawMetadata);

    if (!metadataResult.success) {
      verbose(`Skipping ${metadataFile}: Invalid metadata.yaml — ${metadataResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      continue;
    }

    const metadata = metadataResult.data;
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
      name: metadata.cli_name,
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
  aliases: Partial<Record<SkillAlias, SkillId>>,
): Partial<Record<SkillId, SkillAlias>> {
  const reverse: Partial<Record<SkillId, SkillAlias>> = {};
  // Object.entries returns [string, SkillId | undefined][] — validate with Zod at boundary
  for (const [alias, fullId] of Object.entries(aliases)) {
    const aliasResult = skillAliasSchema.safeParse(alias);
    const idResult = skillIdSchema.safeParse(fullId);
    if (aliasResult.success && idResult.success) {
      reverse[idResult.data] = aliasResult.data;
    }
  }
  return reverse;
}

/**
 * Build a map from short names to actual skill IDs.
 *
 * This handles multiple formats used in skill metadata:
 * - "react" -> "web-framework-react" (alias resolution)
 * - Directory paths -> normalized skill IDs
 * - Old alias targets that may still exist in metadata files
 */
function buildAliasTargetToSkillIdMap(
  aliases: Partial<Record<SkillAlias, SkillId>>,
  skills: ExtractedSkillMetadata[],
): Record<string, SkillId> {
  const map: Record<string, SkillId> = {};

  for (const skill of skills) {
    // Extract the short form: last path segment
    // e.g., "web-framework-react" -> short form for lookup
    const parts = skill.id.split("/");
    const shortForm = parts[parts.length - 1];

    if (shortForm && shortForm !== skill.id) {
      map[shortForm] = skill.id;
    }

    // Also map directory path to skill ID if different
    // e.g., directory path -> normalized skill ID
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
  aliasOrId: SkillRef,
  aliases: Partial<Record<SkillAlias, SkillId>>,
  directoryPathToId: Record<string, SkillId> = {},
  aliasTargetToSkillId: Record<string, SkillId> = {},
  context?: string,
): SkillId {
  // Partial<Record<SkillAlias, SkillId>> can't be indexed with SkillAlias | SkillId — narrow to SkillAlias for lookup
  const aliasResult = aliases[aliasOrId as SkillAlias];
  if (aliasResult) {
    return aliasResult;
  }
  if (directoryPathToId[aliasOrId]) {
    return directoryPathToId[aliasOrId];
  }
  // Handle "short author" format like "react (@vince)" that maps to full ID
  if (aliasTargetToSkillId[aliasOrId]) {
    return aliasTargetToSkillId[aliasOrId];
  }
  if (context) {
    verbose(`Unresolved ID '${aliasOrId}' in ${context} — passing through as-is`);
  }
  // Not found in aliases — treat as SkillId pass-through
  return aliasOrId as SkillId;
}

export async function mergeMatrixWithSkills(
  matrix: SkillsMatrixConfig,
  skills: ExtractedSkillMetadata[],
): Promise<MergedSkillsMatrix> {
  const aliases = matrix.skill_aliases;
  const aliasesReverse = buildReverseAliases(aliases);
  const directoryPathToId = buildDirectoryPathToIdMap(skills);
  const aliasTargetToSkillId = buildAliasTargetToSkillIdMap(aliases, skills);
  const resolvedSkills: Partial<Record<SkillId, ResolvedSkill>> = {};

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
  const suggestedStacks = resolveSuggestedStacks();

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
  aliases: Partial<Record<SkillAlias, SkillId>>,
  aliasesReverse: Partial<Record<SkillId, SkillAlias>>,
  directoryPathToId: Record<string, SkillId>,
  aliasTargetToSkillId: Record<string, SkillId>,
): ResolvedSkill {
  const conflictsWith: SkillRelation[] = [];
  const recommends: SkillRelation[] = [];
  const requires: SkillRequirement[] = [];
  const alternatives: SkillAlternative[] = [];
  const discourages: SkillRelation[] = [];

  // Helper to resolve with all maps, with context for diagnostics.
  // All canonical IDs follow the SkillId format (prefix-subcategory-name).
  const resolve = (id: SkillRef, relationContext?: string): SkillId =>
    resolveToCanonicalId(
      id,
      aliases,
      directoryPathToId,
      aliasTargetToSkillId,
      relationContext ? `${skill.id} ${relationContext}` : undefined,
    );

  for (const conflictRef of skill.conflictsWith) {
    const canonicalId = resolve(conflictRef, "conflictsWith");
    conflictsWith.push({
      skillId: canonicalId,
      reason: "Defined in skill metadata",
    });
  }

  for (const conflictRule of matrix.relationships.conflicts) {
    const resolvedSkills = conflictRule.skills.map((id) => resolve(id, "conflicts"));
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
    const canonicalId = resolve(compatRef, "compatibleWith");
    recommends.push({
      skillId: canonicalId,
      reason: "Compatible with this skill",
    });
  }

  for (const recommendRule of matrix.relationships.recommends) {
    const whenCanonicalId = resolve(recommendRule.when, "recommends.when");
    if (whenCanonicalId === skill.id) {
      for (const suggested of recommendRule.suggest) {
        const canonicalId = resolve(suggested, "recommends.suggest");
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
      skillIds: skill.requires.map((id) => resolve(id, "requires")),
      needsAny: false,
      reason: "Defined in skill metadata",
    });
  }

  for (const requireRule of matrix.relationships.requires) {
    const skillCanonicalId = resolve(requireRule.skill, "requires.skill");
    if (skillCanonicalId === skill.id) {
      requires.push({
        skillIds: requireRule.needs.map((id) => resolve(id, "requires.needs")),
        needsAny: requireRule.needs_any ?? false,
        reason: requireRule.reason,
      });
    }
  }

  for (const altGroup of matrix.relationships.alternatives) {
    const resolvedAlts = altGroup.skills.map((id) => resolve(id, "alternatives"));
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
      const resolvedSkills = discourageRule.skills.map((id) => resolve(id, "discourages"));
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

  // Preserve compatibleWith as resolved skill IDs for framework-first filtering
  const compatibleWith = skill.compatibleWith.map((id) => resolve(id, "compatibleWith"));

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
    compatibleWith,
    requiresSetup: skill.requiresSetup.map((id) => resolve(id, "requiresSetup")),
    providesSetupFor: skill.providesSetupFor.map((id) => resolve(id, "providesSetupFor")),
    path: skill.path,
  };
}

function computeInverseRelationships(skills: Partial<Record<SkillId, ResolvedSkill>>): void {
  for (const skill of Object.values(skills)) {
    if (!skill) continue;
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

function resolveSuggestedStacks(): ResolvedStack[] {
  return [];
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
