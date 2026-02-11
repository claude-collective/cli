import { warn } from "../../utils/logger";
import type {
  CategoryDefinition,
  MergedSkillsMatrix,
  ResolvedSkill,
  SkillId,
  Subcategory,
} from "../../types";
import { typedEntries, typedKeys } from "../../utils/typed-object";

export type MatrixHealthIssue = {
  severity: "warning" | "error";
  finding: string;
  details: string;
};

/**
 * Validate referential integrity of a merged skills matrix.
 *
 * Checks for:
 * - Skill IDs in relationships that don't resolve to existing skills (ghost IDs)
 * - Categories missing a `domain` field (invisible in wizard)
 * - Skills referencing categories that don't exist in the matrix
 * - `compatibleWith` entries that reference non-existent skill IDs
 * - Stack `allSkillIds` entries that reference non-existent skill IDs
 *
 * Returns a list of issues found. Also logs warnings for each issue.
 */
export function checkMatrixHealth(matrix: MergedSkillsMatrix): MatrixHealthIssue[] {
  const issues: MatrixHealthIssue[] = [];
  const skillIds = new Set(typedKeys<SkillId>(matrix.skills));

  checkRelationshipTargets(matrix, skillIds, issues);
  checkSubcategoryDomains(matrix, issues);
  checkSkillCategories(matrix, issues);
  checkCompatibleWithTargets(matrix, skillIds, issues);
  checkStackSkillIds(matrix, skillIds, issues);

  for (const issue of issues) {
    warn(`[matrix] ${issue.details}`);
  }

  return issues;
}

/**
 * Check that all skill IDs referenced in relationships point to real skills.
 */
function checkRelationshipTargets(
  matrix: MergedSkillsMatrix,
  skillIds: Set<SkillId>,
  issues: MatrixHealthIssue[],
): void {
  for (const [skillId, skill] of typedEntries<SkillId, ResolvedSkill>(matrix.skills)) {
    if (!skill) continue;
    for (const conflict of skill.conflictsWith) {
      if (!skillIds.has(conflict.skillId)) {
        issues.push({
          severity: "warning",
          finding: "ghost-relationship-target",
          details: `Skill '${skillId}' conflicts with '${conflict.skillId}' which does not exist in the matrix`,
        });
      }
    }

    for (const recommend of skill.recommends) {
      if (!skillIds.has(recommend.skillId)) {
        issues.push({
          severity: "warning",
          finding: "ghost-relationship-target",
          details: `Skill '${skillId}' recommends '${recommend.skillId}' which does not exist in the matrix`,
        });
      }
    }

    for (const requirement of skill.requires) {
      for (const reqId of requirement.skillIds) {
        if (!skillIds.has(reqId)) {
          issues.push({
            severity: "error",
            finding: "ghost-requirement-target",
            details: `Skill '${skillId}' requires '${reqId}' which does not exist in the matrix`,
          });
        }
      }
    }

    for (const alt of skill.alternatives) {
      if (!skillIds.has(alt.skillId)) {
        issues.push({
          severity: "warning",
          finding: "ghost-alternative-target",
          details: `Skill '${skillId}' lists alternative '${alt.skillId}' which does not exist in the matrix`,
        });
      }
    }

    for (const discourage of skill.discourages) {
      if (!skillIds.has(discourage.skillId)) {
        issues.push({
          severity: "warning",
          finding: "ghost-relationship-target",
          details: `Skill '${skillId}' discourages '${discourage.skillId}' which does not exist in the matrix`,
        });
      }
    }

    for (const setupId of skill.requiresSetup) {
      if (!skillIds.has(setupId)) {
        issues.push({
          severity: "warning",
          finding: "ghost-setup-target",
          details: `Skill '${skillId}' requiresSetup '${setupId}' which does not exist in the matrix`,
        });
      }
    }

    for (const providesId of skill.providesSetupFor) {
      if (!skillIds.has(providesId)) {
        issues.push({
          severity: "warning",
          finding: "ghost-setup-target",
          details: `Skill '${skillId}' providesSetupFor '${providesId}' which does not exist in the matrix`,
        });
      }
    }
  }
}

/**
 * Check that all categories have a domain field.
 * Categories without a domain won't appear in any wizard domain view.
 */
function checkSubcategoryDomains(matrix: MergedSkillsMatrix, issues: MatrixHealthIssue[]): void {
  for (const [catId, cat] of typedEntries<Subcategory, CategoryDefinition>(matrix.categories)) {
    if (!cat) continue;
    if (!cat.domain) {
      issues.push({
        severity: "warning",
        finding: "category-missing-domain",
        details: `Category '${catId}' has no domain — it won't appear in any wizard domain view`,
      });
    }
  }
}

/**
 * Check that all skills reference categories that exist in the matrix.
 */
function checkSkillCategories(matrix: MergedSkillsMatrix, issues: MatrixHealthIssue[]): void {
  for (const [skillId, skill] of typedEntries<SkillId, ResolvedSkill>(matrix.skills)) {
    if (!skill) continue;
    // Narrowing cast: skill.category is CategoryPath which includes Subcategory | "local" | prefixed forms
    if (!matrix.categories[skill.category as Subcategory]) {
      issues.push({
        severity: "warning",
        finding: "skill-unknown-category",
        details: `Skill '${skillId}' references category '${skill.category}' which does not exist in the matrix`,
      });
    }
  }
}

/**
 * Check that all compatibleWith entries reference real skill IDs.
 */
function checkCompatibleWithTargets(
  matrix: MergedSkillsMatrix,
  skillIds: Set<SkillId>,
  issues: MatrixHealthIssue[],
): void {
  for (const [skillId, skill] of typedEntries<SkillId, ResolvedSkill>(matrix.skills)) {
    if (!skill) continue;
    for (const compatId of skill.compatibleWith) {
      if (!skillIds.has(compatId)) {
        issues.push({
          severity: "warning",
          finding: "ghost-compatible-with-target",
          details: `Skill '${skillId}' has compatibleWith '${compatId}' which does not exist in the matrix`,
        });
      }
    }
  }
}

/**
 * Check that all stack allSkillIds reference real skills in the matrix.
 */
function checkStackSkillIds(
  matrix: MergedSkillsMatrix,
  skillIds: Set<SkillId>,
  issues: MatrixHealthIssue[],
): void {
  for (const stack of matrix.suggestedStacks) {
    for (const stackSkillId of stack.allSkillIds) {
      if (!skillIds.has(stackSkillId)) {
        issues.push({
          severity: "warning",
          finding: "stack-ghost-skill",
          details: `Stack '${stack.id}' references skill '${stackSkillId}' which does not exist in the matrix`,
        });
      }
    }
  }
}
