import { useMemo } from "react";
import type {
  Domain,
  MergedSkillsMatrix,
  SkillId,
  SubcategorySelections,
} from "../../types/index.js";
import { buildCategoriesForDomain } from "../../lib/wizard/index.js";
import type { CategoryRow } from "../wizard/category-grid.js";

type UseFrameworkFilteringOptions = {
  domain: Domain;
  allSelections: SkillId[];
  matrix: MergedSkillsMatrix;
  selections: SubcategorySelections;
  installedSkillIds?: SkillId[];
};

export function useFrameworkFiltering({
  domain,
  allSelections,
  matrix,
  selections,
  installedSkillIds,
}: UseFrameworkFilteringOptions): CategoryRow[] {
  return useMemo(
    () => buildCategoriesForDomain(domain, allSelections, matrix, selections, installedSkillIds),
    [domain, allSelections, matrix, selections, installedSkillIds],
  );
}
