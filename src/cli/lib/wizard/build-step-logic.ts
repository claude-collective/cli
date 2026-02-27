import { sortBy } from "remeda";
import type {
  CategoryDefinition,
  Domain,
  MergedSkillsMatrix,
  SkillId,
  SubcategorySelections,
} from "../../types/index.js";
import { getAvailableSkills, resolveAlias } from "../matrix/index.js";
import type {
  CategoryRow,
  CategoryOption,
  OptionState,
} from "../../components/wizard/category-grid.js";

const FRAMEWORK_SUBCATEGORY_ID = "web-framework";
const WEB_DOMAIN_ID = "web";

export type BuildStepValidation = {
  valid: boolean;
  message?: string;
};

export function validateBuildStep(
  categories: CategoryRow[],
  selections: SubcategorySelections,
): BuildStepValidation {
  for (const category of categories) {
    if (category.required) {
      const categorySelections = selections[category.id] || [];
      if (categorySelections.length === 0) {
        return {
          valid: false,
          message: `Select at least one skill from the ${category.displayName} category. Use arrow keys to navigate, then SPACE to select.`,
        };
      }
    }
  }
  return { valid: true };
}

export function computeOptionState(skill: {
  discouraged: boolean;
  recommended: boolean;
}): OptionState {
  if (skill.discouraged) {
    return "discouraged";
  }
  if (skill.recommended) {
    return "recommended";
  }
  return "normal";
}

export function getSkillDisplayLabel(skill: { displayName?: string; id: string }): string {
  return skill.displayName || skill.id;
}

function getStateReason(skill: {
  discouraged: boolean;
  discouragedReason?: string;
  recommended: boolean;
  recommendedReason?: string;
}): string | undefined {
  if (skill.discouraged && skill.discouragedReason) {
    return skill.discouragedReason;
  }
  if (skill.recommended && skill.recommendedReason) {
    return skill.recommendedReason;
  }
  return undefined;
}

function isFrameworkSelected(selections: SubcategorySelections): boolean {
  const frameworkSelections = selections[FRAMEWORK_SUBCATEGORY_ID] ?? [];
  return frameworkSelections.length > 0;
}

function getSelectedFrameworks(
  selections: SubcategorySelections,
  matrix: MergedSkillsMatrix,
): SkillId[] {
  const frameworkSelections = selections[FRAMEWORK_SUBCATEGORY_ID] ?? [];
  return frameworkSelections.map((alias) => resolveAlias(alias, matrix));
}

function isCompatibleWithSelectedFrameworks(
  skillId: SkillId,
  selectedFrameworkIds: SkillId[],
  matrix: MergedSkillsMatrix,
): boolean {
  const skill = matrix.skills[skillId];
  if (!skill) return false;

  // No compatibleWith = compatible with all (allows legacy skills to appear)
  if (skill.compatibleWith.length === 0) {
    return true;
  }

  return selectedFrameworkIds.some((frameworkId) => skill.compatibleWith.includes(frameworkId));
}

// Build CategoryRow[] from matrix for a domain, with framework-first filtering for web
export function buildCategoriesForDomain(
  domain: Domain,
  allSelections: SkillId[],
  matrix: MergedSkillsMatrix,
  selections: SubcategorySelections,
  installedSkillIds?: SkillId[],
): CategoryRow[] {
  const frameworkSource = selections;
  const frameworkSelected = isFrameworkSelected(frameworkSource);
  const selectedFrameworkIds = frameworkSelected
    ? getSelectedFrameworks(frameworkSource, matrix)
    : [];

  // Object.values() on a Partial record only yields values that exist — all are CategoryDefinition
  const subcategories = sortBy(
    (Object.values(matrix.categories) as CategoryDefinition[]).filter(
      (cat) => cat.domain === domain,
    ),
    (cat) => cat.order ?? 0,
  );

  const categoryRows: CategoryRow[] = subcategories.map((cat) => {
    const skillOptions = getAvailableSkills(cat.id, allSelections, matrix);

    const useFrameworkFilter =
      domain === WEB_DOMAIN_ID && cat.id !== FRAMEWORK_SUBCATEGORY_ID && frameworkSelected;
    const filteredSkillOptions = useFrameworkFilter
      ? skillOptions.filter((skill) =>
          isCompatibleWithSelectedFrameworks(skill.id, selectedFrameworkIds, matrix),
        )
      : skillOptions;

    const options: CategoryOption[] = filteredSkillOptions.map((skill) => ({
      id: skill.id,
      label: getSkillDisplayLabel(skill),
      state: computeOptionState(skill),
      stateReason: getStateReason(skill),
      selected: skill.selected,
      local: matrix.skills[skill.id]?.local,
      installed: installedSkillIds?.includes(skill.id) || false,
    }));

    return {
      id: cat.id,
      displayName: cat.displayName,
      required: cat.required ?? false,
      exclusive: cat.exclusive ?? true,
      options,
    };
  });

  return categoryRows.filter((row) => row.options.length > 0);
}
