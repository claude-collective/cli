import { sortBy } from "remeda";
import type { CategoryDefinition, Domain, SkillId, CategorySelections } from "../../types/index.js";
import type { SkillConfig } from "../../types/config.js";
import { getAvailableSkills, getUnmetRequiredBy, resolveAlias } from "../matrix/index.js";
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

function getSelectedFrameworks(selections: CategorySelections): SkillId[] {
  return (selections[FRAMEWORK_CATEGORY_ID] ?? []).map((alias) => resolveAlias(alias));
}

export function isCompatibleWithSelectedFrameworks(
  skillId: SkillId,
  selectedFrameworkIds: SkillId[],
): boolean {
  const skill = getSkillById(skillId);
  if (skill.compatibleWith.length === 0) return true;
  return selectedFrameworkIds.some((frameworkId) => skill.compatibleWith.includes(frameworkId));
}

// Build CategoryRow[] from matrix for a domain
export function buildCategoriesForDomain(
  domain: Domain,
  allSelections: SkillId[],
  selections: CategorySelections,
  installedSkillIds?: SkillId[],
  skillConfigs?: SkillConfig[],
  filterIncompatible?: boolean,
): CategoryRow[] {
  const selectedFrameworkIds = getSelectedFrameworks(selections);
  const shouldFilter =
    filterIncompatible && domain === WEB_DOMAIN_ID && selectedFrameworkIds.length > 0;

  // Object.values() on a Partial record only yields values that exist — all are CategoryDefinition
  const categories = sortBy(
    (Object.values(matrix.categories) as CategoryDefinition[]).filter(
      (cat) => cat.domain === domain,
    ),
    (cat) => cat.order ?? 0,
  );

  const categoryRows: CategoryRow[] = categories.map((cat) => {
    const skillOptions = getAvailableSkills(cat.id, allSelections);

    const filteredOptions =
      shouldFilter && cat.id !== FRAMEWORK_CATEGORY_ID
        ? skillOptions.filter((skill) =>
            isCompatibleWithSelectedFrameworks(skill.id, selectedFrameworkIds),
          )
        : skillOptions;

    const isExclusive = cat.exclusive ?? true;

    const options: CategoryOption[] = filteredOptions.map((skill) => {
      const skillConfig = skillConfigs?.find((sc) => sc.id === skill.id && !sc.excluded);
      return {
        id: skill.id,
        state:
          isExclusive && skill.advisoryState.status === "incompatible"
            ? { status: "normal" }
            : skill.advisoryState,
        selected: skill.selected,
        local: getSkillById(skill.id).local,
        installed: installedSkillIds?.includes(skill.id) || false,
        scope: skillConfig?.scope,
        source: skillConfig?.source,
        hasUnmetRequirements: skill.hasUnmetRequirements,
        unmetRequirementsReason: skill.unmetRequirementsReason,
        requiredBy: skill.selected ? undefined : getUnmetRequiredBy(skill.id, allSelections),
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
