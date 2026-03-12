import { BUILT_IN_MATRIX } from "../../types/generated/matrix";
import type { MergedSkillsMatrix, ResolvedSkill, ResolvedStack, SkillId, SkillSlug } from "../../types";

/** The current matrix — starts as BUILT_IN_MATRIX, replaced after local skill merge on startup */
export let matrix: MergedSkillsMatrix = BUILT_IN_MATRIX;

/** Merge local/custom skills on top of BUILT_IN_MATRIX. Called once on CLI startup. */
export function initializeMatrix(merged: MergedSkillsMatrix): void {
  matrix = merged;
}

/** Asserting skill lookup by ID — throws if not found. */
export function getSkillById(id: SkillId): ResolvedSkill {
  const skill = matrix.skills[id];
  if (!skill) throw new Error(`Skill not found: ${id}`);
  return skill;
}

/** Asserting skill lookup by slug — resolves slug to ID, throws if not found. */
export function getSkillBySlug(slug: SkillSlug): ResolvedSkill {
  const id = matrix.slugMap.slugToId[slug];
  if (!id) throw new Error(`Skill not found for slug: ${slug}`);
  return getSkillById(id);
}

/** Optional stack lookup by ID. */
export function findStack(stackId: string): ResolvedStack | undefined {
  return matrix.suggestedStacks.find((s) => s.id === stackId);
}
