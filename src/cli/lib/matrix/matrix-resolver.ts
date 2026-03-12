import { groupBy } from "remeda";
import type {
  CategoryPath,
  ResolvedSkill,
  SelectionValidation,
  SkillId,
  SkillOption,
  Category,
  ValidationError,
  ValidationWarning,
} from "../../types";
import { typedEntries } from "../../utils/typed-object";
import { matrix, getSkillById } from "./matrix-provider";

function getLabel(skill: Pick<ResolvedSkill, "displayName">): string {
  return skill.displayName;
}

/** Resolves a skill ID to its canonical SkillId. Throws if not found in the matrix. */
export function resolveAlias(skillId: SkillId): SkillId {

  if (matrix.skills[skillId]) return skillId;
  throw new Error(`Unknown skill ID: '${skillId}' — not found in the matrix`);
}

type SelectionContext = {
  resolvedSelections: SkillId[];
  selectedSet: Set<SkillId>;
};

function initializeSelectionContext(currentSelections: SkillId[]): SelectionContext {
  const resolvedSelections = currentSelections.map((s) => resolveAlias(s));
  const selectedSet = new Set<SkillId>(resolvedSelections);
  return { resolvedSelections, selectedSet };
}

/**
 * Finds all currently selected skills that depend on the given skill.
 *
 * A skill is considered dependent if it has a requirement that would become
 * unsatisfied by removing `skillId`. For `needsAny` requirements, the skill
 * is only dependent if `skillId` is the sole remaining option satisfying
 * that requirement.
 *
 * @param skillId - The skill to check dependents for (resolved via alias lookup)
 * @param currentSelections - Currently selected skill IDs in the wizard
 * @returns Skill IDs that would lose a required dependency if `skillId` were removed
 */
export function getDependentSkills(skillId: SkillId, currentSelections: SkillId[]): SkillId[] {

  const fullId = resolveAlias(skillId);
  const skill = matrix.skills[fullId];
  if (!skill) return [];

  const { resolvedSelections, selectedSet } = initializeSelectionContext(currentSelections);
  const dependents: SkillId[] = [];

  for (const selectedId of resolvedSelections) {
    if (selectedId === fullId) continue;

    const selectedSkill: ResolvedSkill | undefined = matrix.skills[selectedId];
    if (!selectedSkill) continue;

    for (const requirement of selectedSkill.requires) {
      if (requirement.needsAny) {
        const satisfiedReqs = requirement.skillIds.filter((reqId) => selectedSet.has(reqId));
        if (satisfiedReqs.length === 1 && satisfiedReqs[0] === fullId) {
          dependents.push(selectedId);
        }
      } else {
        if (requirement.skillIds.includes(fullId)) {
          dependents.push(selectedId);
        }
      }
    }
  }

  return dependents;
}

/**
 * Determines whether a skill should be discouraged (shown with yellow warning)
 * in the wizard given the current selection state.
 *
 * A skill is discouraged when any of these conditions are true:
 * 1. It has a `discourages` relationship with a currently selected skill (bidirectional)
 * 2. It conflicts with a currently selected skill (bidirectional `conflictsWith` check)
 * 3. It has unmet `requires` dependencies (AND mode or OR/needsAny mode)
 *
 * Discouraged skills remain selectable but show a yellow warning to inform the user.
 *
 * @param skillId - The skill to check (resolved via alias lookup)
 * @param currentSelections - Currently selected skill IDs
 * @returns true if the skill should show a discouraged warning
 */
export function isDiscouraged(skillId: SkillId, currentSelections: SkillId[]): boolean {

  const fullId = resolveAlias(skillId);
  const skill = matrix.skills[fullId];
  if (!skill) return false;

  const { resolvedSelections, selectedSet } = initializeSelectionContext(currentSelections);

  // Check discourages relationships (bidirectional)
  for (const selectedId of resolvedSelections) {
    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill?.discourages.some((d) => d.skillId === fullId)) {
      return true;
    }

    if (skill.discourages.some((d) => d.skillId === selectedId)) {
      return true;
    }
  }

  // Check conflictsWith relationships (bidirectional)
  for (const selectedId of resolvedSelections) {
    if (skill.conflictsWith.some((c) => c.skillId === selectedId)) {
      return true;
    }

    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill?.conflictsWith.some((c) => c.skillId === fullId)) {
      return true;
    }
  }

  // Check unmet requires dependencies
  for (const requirement of skill.requires) {
    if (requirement.needsAny) {
      const hasAny = requirement.skillIds.some((reqId) => selectedSet.has(reqId));
      if (!hasAny) {
        return true;
      }
    } else {
      const hasAll = requirement.skillIds.every((reqId) => selectedSet.has(reqId));
      if (!hasAll) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Returns a human-readable reason why a skill is discouraged, or undefined if it is not.
 *
 * Checks discourages relationships, conflicts (bidirectional), and unmet requirements,
 * returning the first matching reason with context.
 *
 * @param skillId - The skill to get the discourage reason for
 * @param currentSelections - Currently selected skill IDs
 * @returns Formatted reason string or undefined
 */
export function getDiscourageReason(
  skillId: SkillId,
  currentSelections: SkillId[],
): string | undefined {

  const fullId = resolveAlias(skillId);
  const skill = matrix.skills[fullId];
  if (!skill) return undefined;

  const { resolvedSelections, selectedSet } = initializeSelectionContext(currentSelections);

  // Check discourages relationships (bidirectional)
  for (const selectedId of resolvedSelections) {
    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill) {
      const discourage = selectedSkill.discourages.find((d) => d.skillId === fullId);
      if (discourage) {
        return discourage.reason;
      }
    }

    const reverseDiscourage = skill.discourages.find((d) => d.skillId === selectedId);
    if (reverseDiscourage) {
      return reverseDiscourage.reason;
    }
  }

  // Check conflictsWith relationships (bidirectional)
  for (const selectedId of resolvedSelections) {
    const conflict = skill.conflictsWith.find((c) => c.skillId === selectedId);
    if (conflict) {
      return `${conflict.reason} (conflicts with ${getLabel(matrix.skills[selectedId]!)})`;
    }

    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill) {
      const reverseConflict = selectedSkill.conflictsWith.find((c) => c.skillId === fullId);
      if (reverseConflict) {
        return `${reverseConflict.reason} (conflicts with ${getLabel(selectedSkill)})`;
      }
    }
  }

  // Check unmet requires dependencies
  for (const requirement of skill.requires) {
    if (requirement.needsAny) {
      const hasAny = requirement.skillIds.some((reqId) => selectedSet.has(reqId));
      if (!hasAny) {
        const requiredNames = requirement.skillIds
          .map((id) => {
            const s = matrix.skills[id];
            return s ? getLabel(s) : id;
          })
          .join(" or ");
        return `${requirement.reason} (requires ${requiredNames})`;
      }
    } else {
      const missingIds = requirement.skillIds.filter((reqId) => !selectedSet.has(reqId));
      if (missingIds.length > 0) {
        const missingNames = missingIds
          .map((id) => {
            const s = matrix.skills[id];
            return s ? getLabel(s) : id;
          })
          .join(", ");
        return `${requirement.reason} (requires ${missingNames})`;
      }
    }
  }

  return undefined;
}

/**
 * Checks if a skill is recommended based on the flat recommends list
 * and compatibility with current selections.
 *
 * A skill is recommended when:
 * 1. It appears in the flat recommends list (isRecommended === true), AND
 * 2. It is compatible with the user's current selections (shares a compatibleWith
 *    group with at least one selected skill, or has no compatibility constraints)
 */
export function isRecommended(skillId: SkillId, currentSelections: SkillId[]): boolean {

  const fullId = resolveAlias(skillId);
  const skill = matrix.skills[fullId];
  if (!skill) return false;

  if (!skill.isRecommended) {
    return false;
  }

  // If no selections yet, isRecommended alone is sufficient
  if (currentSelections.length === 0) {
    return true;
  }

  const { resolvedSelections } = initializeSelectionContext(currentSelections);

  // If the skill has no compatibility constraints, it's recommended unconditionally
  if (skill.compatibleWith.length === 0) {
    return true;
  }

  // Check if compatible with at least one selected skill
  for (const selectedId of resolvedSelections) {
    if (skill.compatibleWith.includes(selectedId)) {
      return true;
    }
  }

  return false;
}

/** Returns the reason from the flat recommends entry */
export function getRecommendReason(
  skillId: SkillId,
  _currentSelections: SkillId[],
): string | undefined {

  const fullId = resolveAlias(skillId);
  const skill = matrix.skills[fullId];
  if (!skill) return undefined;

  return skill.recommendedReason;
}

type ValidationPartial = {
  errors: ValidationError[];
  warnings: ValidationWarning[];
};

function validateConflicts(resolvedSelections: SkillId[]): ValidationPartial {

  const errors: ValidationError[] = [];

  for (let i = 0; i < resolvedSelections.length; i++) {
    const skillA = matrix.skills[resolvedSelections[i]];
    if (!skillA) continue;

    for (let j = i + 1; j < resolvedSelections.length; j++) {
      const skillBId = resolvedSelections[j];
      const conflict = skillA.conflictsWith.find((c) => c.skillId === skillBId);
      if (conflict) {
        errors.push({
          type: "conflict",
          message: `${getLabel(skillA)} conflicts with ${getLabel(matrix.skills[skillBId]!)}: ${conflict.reason}`,
          skills: [skillA.id, skillBId],
        });
      }
    }
  }

  return { errors, warnings: [] };
}

function validateRequirements(
  resolvedSelections: SkillId[],
  selectedSet: Set<SkillId>,
): ValidationPartial {

  const errors: ValidationError[] = [];

  for (const skillId of resolvedSelections) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;

    for (const requirement of skill.requires) {
      if (requirement.needsAny) {
        const hasAny = requirement.skillIds.some((reqId) => selectedSet.has(reqId));
        if (!hasAny) {
          errors.push({
            type: "missingRequirement",
            message: `${getLabel(skill)} requires one of: ${requirement.skillIds.map((id) => getLabel(matrix.skills[id]!)).join(", ")}`,
            skills: [skillId, ...requirement.skillIds],
          });
        }
      } else {
        const missingIds = requirement.skillIds.filter((reqId) => !selectedSet.has(reqId));
        if (missingIds.length > 0) {
          errors.push({
            type: "missingRequirement",
            message: `${getLabel(skill)} requires: ${missingIds.map((id) => getLabel(getSkillById(id))).join(", ")}`,
            skills: [skillId, ...missingIds],
          });
        }
      }
    }
  }

  return { errors, warnings: [] };
}

function validateExclusivity(resolvedSelections: SkillId[]): ValidationPartial {

  const errors: ValidationError[] = [];

  const validSkills = resolvedSelections
    .map((skillId) => ({ skillId, skill: matrix.skills[skillId] }))
    .filter((entry): entry is { skillId: SkillId; skill: ResolvedSkill } => entry.skill != null);
  const categorySelections = groupBy(validSkills, (entry) => entry.skill.category);

  for (const [categoryId, entries] of typedEntries(categorySelections)) {
    if (entries.length > 1) {
      const skillIds = entries.map((e) => e.skillId);
      // CategoryPath -> Category: categories lookup uses bare category names
      const category = matrix.categories[categoryId as Category];
      if (category?.exclusive) {
        errors.push({
          type: "categoryExclusive",
          message: `Category "${category.displayName}" only allows one selection, but multiple selected: ${skillIds.map((id) => getLabel(matrix.skills[id]!)).join(", ")}`,
          skills: skillIds,
        });
      }
    }
  }

  return { errors, warnings: [] };
}

/**
 * Validates recommendations: for each recommended skill that is NOT selected
 * but IS compatible with current selections, produce a missing_recommendation warning.
 */
function validateRecommendations(
  resolvedSelections: SkillId[],
  selectedSet: Set<SkillId>,
): ValidationPartial {

  const warnings: ValidationWarning[] = [];

  // Iterate the flat recommends list from relationships
  for (const [, skill] of typedEntries(matrix.skills)) {
    if (!skill) continue;
    if (!skill.isRecommended) continue;
    if (selectedSet.has(skill.id)) continue;

    // Check if compatible with current selections
    const isCompatible =
      skill.compatibleWith.length === 0 ||
      resolvedSelections.some((selectedId) => skill.compatibleWith.includes(selectedId));

    if (!isCompatible) continue;

    // Check no conflict with current selections
    const hasConflict = skill.conflictsWith.some((c) => selectedSet.has(c.skillId));
    if (hasConflict) continue;

    warnings.push({
      type: "missing_recommendation",
      message: `${getLabel(skill)} is recommended: ${skill.recommendedReason ?? ""}`,
      skills: [skill.id],
    });
  }

  return { errors: [], warnings };
}

function mergeValidationResults(results: ValidationPartial[]): ValidationPartial {
  return {
    errors: results.flatMap((r) => r.errors),
    warnings: results.flatMap((r) => r.warnings),
  };
}

/**
 * Validates a complete set of skill selections against all matrix constraints.
 *
 * Runs four validation passes:
 * 1. **Conflicts** - Checks for mutually exclusive skill pairs (errors)
 * 2. **Requirements** - Checks that all required dependencies are selected (errors)
 * 3. **Exclusivity** - Checks that exclusive categories have at most one selection (errors)
 * 4. **Recommendations** - Checks for missing recommended companion skills (warnings)
 *
 * @param selections - Complete list of selected skill IDs to validate
 * @returns Validation result with `valid` flag, error list, and warning list
 */
export function validateSelection(selections: SkillId[]): SelectionValidation {
  const { resolvedSelections, selectedSet } = initializeSelectionContext(selections);

  const { errors, warnings } = mergeValidationResults([
    validateConflicts(resolvedSelections),
    validateRequirements(resolvedSelections, selectedSet),
    validateExclusivity(resolvedSelections),
    validateRecommendations(resolvedSelections, selectedSet),
  ]);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Builds a list of skill options for a category, annotated with their current
 * state (discouraged, recommended, selected) relative to the wizard's
 * selection state.
 *
 * Each skill is checked against the current selections to determine its visual
 * and interactive state in the wizard UI. States are mutually prioritized:
 * discouraged takes precedence over recommended.
 *
 * @param categoryId - Category path to filter skills by
 * @param currentSelections - Currently selected skill IDs
 * @returns Array of skill options with state annotations and reasons
 */
export function getAvailableSkills(
  categoryId: CategoryPath,
  currentSelections: SkillId[],
): SkillOption[] {

  const skillOptions: SkillOption[] = [];
  const { selectedSet } = initializeSelectionContext(currentSelections);

  for (const skill of Object.values(matrix.skills)) {
    if (!skill) continue;
    if (skill.category !== categoryId) {
      continue;
    }

    const discouraged = isDiscouraged(skill.id, currentSelections);
    const recommended = !discouraged && isRecommended(skill.id, currentSelections);

    skillOptions.push({
      id: skill.id,
      discouraged,
      discouragedReason: discouraged ? getDiscourageReason(skill.id, currentSelections) : undefined,
      recommended,
      recommendedReason: recommended ? getRecommendReason(skill.id, currentSelections) : undefined,
      selected: selectedSet.has(skill.id),
      alternatives: skill.alternatives.map((a) => a.skillId),
    });
  }

  return skillOptions;
}

/** Returns all resolved skills belonging to the given category. */
export function getSkillsByCategory(categoryId: CategoryPath): ResolvedSkill[] {

  const skills: ResolvedSkill[] = [];

  for (const skill of Object.values(matrix.skills)) {
    if (!skill) continue;
    if (skill.category === categoryId) {
      skills.push(skill);
    }
  }

  return skills;
}
