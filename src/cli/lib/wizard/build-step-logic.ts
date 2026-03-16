import { sortBy } from "remeda";
import type { CategoryDefinition, Domain, SkillId, CategorySelections } from "../../types/index.js";
import type { SkillConfig } from "../../types/config.js";
import { getAvailableSkills, resolveAlias, getDependentSkills } from "../matrix/index.js";
import { matrix, getSkillById } from "../matrix/matrix-provider.js";
import type { CategoryRow, CategoryOption } from "../../components/wizard/category-grid.js";

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
          valid: true,
          message: `No skills selected in ${category.displayName} (required category)`,
        };
      }
    }
  }
  return { valid: true };
}

function isFrameworkSelected(selections: CategorySelections): boolean {
  const frameworkSelections = selections[FRAMEWORK_CATEGORY_ID] ?? [];
  return frameworkSelections.length > 0;
}

function getSelectedFrameworks(selections: CategorySelections): SkillId[] {
  const frameworkSelections = selections[FRAMEWORK_CATEGORY_ID] ?? [];
  return frameworkSelections.map((alias) => resolveAlias(alias));
}

function isCompatibleWithSelectedFrameworks(
  skillId: SkillId,
  selectedFrameworkIds: SkillId[],
): boolean {
  const skill = getSkillById(skillId);

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
  selections: CategorySelections,
  installedSkillIds?: SkillId[],
  skillConfigs?: SkillConfig[],
): CategoryRow[] {
  const frameworkSource = selections;
  const frameworkSelected = isFrameworkSelected(frameworkSource);
  const selectedFrameworkIds = frameworkSelected ? getSelectedFrameworks(frameworkSource) : [];

  // Object.values() on a Partial record only yields values that exist — all are CategoryDefinition
  const categories = sortBy(
    (Object.values(matrix.categories) as CategoryDefinition[]).filter(
      (cat) => cat.domain === domain,
    ),
    (cat) => cat.order ?? 0,
  );

  const categoryRows: CategoryRow[] = categories.map((cat) => {
    const skillOptions = getAvailableSkills(cat.id, allSelections);

    const useFrameworkFilter =
      domain === WEB_DOMAIN_ID && cat.id !== FRAMEWORK_CATEGORY_ID && frameworkSelected;
    const filteredSkillOptions = useFrameworkFilter
      ? skillOptions.filter((skill) =>
          isCompatibleWithSelectedFrameworks(skill.id, selectedFrameworkIds),
        )
      : skillOptions;

    const options: CategoryOption[] = filteredSkillOptions.map((skill) => {
      // Check if any currently selected skill depends on this one
      const dependents = skill.selected ? getDependentSkills(skill.id, allSelections) : [];
      const firstDependent =
        dependents.length > 0 ? getSkillById(dependents[0]).displayName : undefined;

      return {
        id: skill.id,
        state: skill.advisoryState,
        selected: skill.selected,
        local: getSkillById(skill.id).local,
        installed: installedSkillIds?.includes(skill.id) || false,
        scope: skillConfigs?.find((sc) => sc.id === skill.id)?.scope,
        hasUnmetRequirements: skill.hasUnmetRequirements,
        unmetRequirementsReason: skill.unmetRequirementsReason,
        requiredBy: skill.selected ? firstDependent : undefined,
      };
    });

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
