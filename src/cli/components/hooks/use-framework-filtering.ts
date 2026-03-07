import { useMemo } from "react";
import type { Domain, MergedSkillsMatrix, SkillId, CategorySelections } from "../../types/index.js";
import type { SkillConfig } from "../../types/config.js";
import { buildCategoriesForDomain } from "../../lib/wizard/index.js";
import type { CategoryRow } from "../wizard/category-grid.js";

type UseFrameworkFilteringOptions = {
  domain: Domain;
  allSelections: SkillId[];
  matrix: MergedSkillsMatrix;
  selections: CategorySelections;
  installedSkillIds?: SkillId[];
  skillConfigs?: SkillConfig[];
};

export function useFrameworkFiltering({
  domain,
  allSelections,
  matrix,
  selections,
  installedSkillIds,
  skillConfigs,
}: UseFrameworkFilteringOptions): CategoryRow[] {
  return useMemo(
    () =>
      buildCategoriesForDomain(
        domain,
        allSelections,
        matrix,
        selections,
        installedSkillIds,
        skillConfigs,
      ),
    [domain, allSelections, matrix, selections, installedSkillIds, skillConfigs],
  );
}
