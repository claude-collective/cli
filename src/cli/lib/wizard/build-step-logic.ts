import { sortBy } from "remeda";
import type {
  CategoryDefinition,
  Domain,
  MergedSkillsMatrix,
  SkillId,
  SkillOption,
  CategorySelections,
} from "../../types/index.js";
import type { SkillConfig } from "../../types/config.js";
import { getAvailableSkills, resolveAlias } from "../matrix/index.js";
import type {
  CategoryRow,
  CategoryOption,
  OptionState,
} from "../../components/wizard/category-grid.js";

const FRAMEWORK_CATEGORY_ID = "web-framework";
const WEB_DOMAIN_ID = "web";

export type BuildStepValidation = {
  valid: boolean;
  message?: string;
};

export function validateBuildStep(
  categories: CategoryRow[],
  selections: CategorySelections,
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

export function computeOptionState(
  skill: Pick<SkillOption, "discouraged" | "recommended">,
): OptionState {
  if (skill.discouraged) {
    return "discouraged";
  }
  if (skill.recommended) {
    return "recommended";
  }
  return "normal";
}

export function getSkillDisplayLabel(skill: Pick<SkillOption, "displayName">): string {
  return skill.displayName;
}

function getStateReason(
  skill: Pick<SkillOption, "discouraged" | "discouragedReason" | "recommended" | "recommendedReason">,
): string | undefined {
  if (skill.discouraged && skill.discouragedReason) {
    return skill.discouragedReason;
  }
  if (skill.recommended && skill.recommendedReason) {
    return skill.recommendedReason;
  }
  return undefined;
}

function isFrameworkSelected(selections: CategorySelections): boolean {
  const frameworkSelections = selections[FRAMEWORK_CATEGORY_ID] ?? [];
  return frameworkSelections.length > 0;
}

function getSelectedFrameworks(
  selections: CategorySelections,
  matrix: MergedSkillsMatrix,
): SkillId[] {
  const frameworkSelections = selections[FRAMEWORK_CATEGORY_ID] ?? [];
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
  selections: CategorySelections,
  installedSkillIds?: SkillId[],
  skillConfigs?: SkillConfig[],
): CategoryRow[] {
  const frameworkSource = selections;
  const frameworkSelected = isFrameworkSelected(frameworkSource);
  const selectedFrameworkIds = frameworkSelected
    ? getSelectedFrameworks(frameworkSource, matrix)
    : [];

  // Object.values() on a Partial record only yields values that exist — all are CategoryDefinition
  const categories = sortBy(
    (Object.values(matrix.categories) as CategoryDefinition[]).filter(
      (cat) => cat.domain === domain,
    ),
    (cat) => cat.order ?? 0,
  );

  const categoryRows: CategoryRow[] = categories.map((cat) => {
    const skillOptions = getAvailableSkills(cat.id, allSelections, matrix);

    const useFrameworkFilter =
      domain === WEB_DOMAIN_ID && cat.id !== FRAMEWORK_CATEGORY_ID && frameworkSelected;
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
      scope: skillConfigs?.find((sc) => sc.id === skill.id)?.scope,
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
