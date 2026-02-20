import { warn } from "../../utils/logger";
import type {
  CategoryDefinition,
  MergedSkillsMatrix,
  ResolvedSkill,
  SkillId,
  Subcategory,
} from "../../types";
import { typedEntries } from "../../utils/typed-object";

export type MatrixHealthIssue = {
  severity: "warning" | "error";
  finding: string;
  details: string;
};

export function checkMatrixHealth(matrix: MergedSkillsMatrix): MatrixHealthIssue[] {
  const issues: MatrixHealthIssue[] = [];

  checkSubcategoryDomains(matrix, issues);
  checkSkillCategories(matrix, issues);

  for (const issue of issues) {
    warn(`[matrix] ${issue.details}`);
  }

  return issues;
}

// Categories without a domain won't appear in any wizard domain view
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
