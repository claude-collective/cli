import { groupBy } from "remeda";
import type {
  CategoryPath,
  MergedSkillsMatrix,
  ResolvedSkill,
  SelectionValidation,
  SkillDisplayName,
  SkillId,
  SkillOption,
  Subcategory,
  ValidationError,
  ValidationWarning,
} from "../../types";
import { typedEntries } from "../../utils/typed-object";

function getLabel(
  skill: { displayName?: string; id: string } | undefined,
  fallback: string,
): string {
  return skill?.displayName || skill?.id || fallback;
}

/** Resolves a display name or alias to its canonical SkillId, passing through if no mapping exists. */
export function resolveAlias(aliasOrId: SkillId, matrix: MergedSkillsMatrix): SkillId {
  // Boundary cast: aliasOrId may contain a display name — try display name lookup first, fall back to SkillId
  return matrix.displayNameToId[aliasOrId as unknown as SkillDisplayName] || aliasOrId;
}

type SelectionContext = {
  resolvedSelections: SkillId[];
  selectedSet: Set<SkillId>;
};

function initializeSelectionContext(
  currentSelections: SkillId[],
  matrix: MergedSkillsMatrix,
): SelectionContext {
  const resolvedSelections = currentSelections.map((s) => resolveAlias(s, matrix));
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
 * @param matrix - Merged skills matrix with relationship data
 * @returns Skill IDs that would lose a required dependency if `skillId` were removed
 */
export function getDependentSkills(
  skillId: SkillId,
  currentSelections: SkillId[],
  matrix: MergedSkillsMatrix,
): SkillId[] {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) return [];

  const { resolvedSelections, selectedSet } = initializeSelectionContext(currentSelections, matrix);
  const dependents: SkillId[] = [];

  for (const selectedId of resolvedSelections) {
    if (selectedId === fullId) continue;

    const selectedSkill = matrix.skills[selectedId];
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

export type SkillCheckOptions = {
  expertMode?: boolean;
};

/**
 * Determines whether a skill should be disabled (unselectable) in the wizard
 * given the current selection state.
 *
 * A skill is disabled when any of these conditions are true:
 * 1. It conflicts with a currently selected skill (bidirectional check)
 * 2. It has unmet `requires` dependencies -- either all required skills are
 *    missing (AND mode) or none of the alternatives are selected (OR/needsAny mode)
 *
 * In expert mode, all constraints are bypassed and the skill is always enabled.
 * This is a pure function with no side effects.
 *
 * @param skillId - The skill to check (resolved via alias lookup)
 * @param currentSelections - Currently selected skill IDs
 * @param matrix - Merged skills matrix with conflict and requirement rules
 * @param options - Optional flags; `expertMode` bypasses all constraint checks
 * @returns true if the skill cannot be selected given current state
 */
export function isDisabled(
  skillId: SkillId,
  currentSelections: SkillId[],
  matrix: MergedSkillsMatrix,
  options?: SkillCheckOptions,
): boolean {
  if (options?.expertMode) {
    return false;
  }

  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return false;
  }

  for (const selectedId of currentSelections) {
    const selectedFullId = resolveAlias(selectedId, matrix);

    if (skill.conflictsWith.some((c) => c.skillId === selectedFullId)) {
      return true;
    }

    const selectedSkill = matrix.skills[selectedFullId];
    if (selectedSkill?.conflictsWith.some((c) => c.skillId === fullId)) {
      return true;
    }
  }

  const { selectedSet } = initializeSelectionContext(currentSelections, matrix);

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
 * Returns a human-readable reason why a skill is disabled, or undefined if it is not.
 *
 * Checks conflicts (bidirectional) and unmet requirements in the same order as
 * `isDisabled()`, returning the first matching reason with context about which
 * selected skill caused the constraint.
 *
 * @param skillId - The skill to get the disable reason for
 * @param currentSelections - Currently selected skill IDs
 * @param matrix - Merged skills matrix with relationship data
 * @returns Formatted reason string (e.g., "Incompatible (conflicts with React)") or undefined
 */
export function getDisableReason(
  skillId: SkillId,
  currentSelections: SkillId[],
  matrix: MergedSkillsMatrix,
): string | undefined {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return undefined;
  }

  const { resolvedSelections, selectedSet } = initializeSelectionContext(currentSelections, matrix);

  for (const selectedId of resolvedSelections) {
    const conflict = skill.conflictsWith.find((c) => c.skillId === selectedId);
    if (conflict) {
      const selectedSkill = matrix.skills[selectedId];
      return `${conflict.reason} (conflicts with ${getLabel(selectedSkill, selectedId)})`;
    }

    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill) {
      const reverseConflict = selectedSkill.conflictsWith.find((c) => c.skillId === fullId);
      if (reverseConflict) {
        return `${reverseConflict.reason} (conflicts with ${getLabel(selectedSkill, selectedId)})`;
      }
    }
  }

  for (const requirement of skill.requires) {
    if (requirement.needsAny) {
      const hasAny = requirement.skillIds.some((reqId) => selectedSet.has(reqId));
      if (!hasAny) {
        const requiredNames = requirement.skillIds
          .map((id) => getLabel(matrix.skills[id], id))
          .join(" or ");
        return `${requirement.reason} (requires ${requiredNames})`;
      }
    } else {
      const missingIds = requirement.skillIds.filter((reqId) => !selectedSet.has(reqId));
      if (missingIds.length > 0) {
        const missingNames = missingIds.map((id) => getLabel(matrix.skills[id], id)).join(", ");
        return `${requirement.reason} (requires ${missingNames})`;
      }
    }
  }

  return undefined;
}

export function isDiscouraged(
  skillId: SkillId,
  currentSelections: SkillId[],
  matrix: MergedSkillsMatrix,
): boolean {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return false;
  }

  const { resolvedSelections } = initializeSelectionContext(currentSelections, matrix);

  for (const selectedId of resolvedSelections) {
    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill?.discourages.some((d) => d.skillId === fullId)) {
      return true;
    }

    if (skill.discourages.some((d) => d.skillId === selectedId)) {
      return true;
    }
  }

  return false;
}

export function getDiscourageReason(
  skillId: SkillId,
  currentSelections: SkillId[],
  matrix: MergedSkillsMatrix,
): string | undefined {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return undefined;
  }

  const { resolvedSelections } = initializeSelectionContext(currentSelections, matrix);

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

  return undefined;
}

export function isRecommended(
  skillId: SkillId,
  currentSelections: SkillId[],
  matrix: MergedSkillsMatrix,
): boolean {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return false;
  }

  const { resolvedSelections } = initializeSelectionContext(currentSelections, matrix);

  for (const selectedId of resolvedSelections) {
    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill?.recommends.some((r) => r.skillId === fullId)) {
      return true;
    }
  }

  return false;
}

export function getRecommendReason(
  skillId: SkillId,
  currentSelections: SkillId[],
  matrix: MergedSkillsMatrix,
): string | undefined {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return undefined;
  }

  const { resolvedSelections } = initializeSelectionContext(currentSelections, matrix);

  for (const selectedId of resolvedSelections) {
    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill) {
      const recommendation = selectedSkill.recommends.find((r) => r.skillId === fullId);
      if (recommendation) {
        return `${recommendation.reason} (recommended by ${getLabel(selectedSkill, selectedId)})`;
      }
    }
  }

  return undefined;
}

type ValidationPartial = {
  errors: ValidationError[];
  warnings: ValidationWarning[];
};

function validateConflicts(
  resolvedSelections: SkillId[],
  matrix: MergedSkillsMatrix,
): ValidationPartial {
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
          message: `${getLabel(skillA, skillA.id)} conflicts with ${getLabel(matrix.skills[skillBId], skillBId)}: ${conflict.reason}`,
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
  matrix: MergedSkillsMatrix,
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
            message: `${getLabel(skill, skillId)} requires one of: ${requirement.skillIds.map((id) => getLabel(matrix.skills[id], id)).join(", ")}`,
            skills: [skillId, ...requirement.skillIds],
          });
        }
      } else {
        const missingIds = requirement.skillIds.filter((reqId) => !selectedSet.has(reqId));
        if (missingIds.length > 0) {
          errors.push({
            type: "missingRequirement",
            message: `${getLabel(skill, skillId)} requires: ${missingIds.map((id) => getLabel(matrix.skills[id], id)).join(", ")}`,
            skills: [skillId, ...missingIds],
          });
        }
      }
    }
  }

  return { errors, warnings: [] };
}

function validateExclusivity(
  resolvedSelections: SkillId[],
  matrix: MergedSkillsMatrix,
): ValidationPartial {
  const errors: ValidationError[] = [];

  const validSkills = resolvedSelections
    .map((skillId) => ({ skillId, skill: matrix.skills[skillId] }))
    .filter((entry): entry is { skillId: SkillId; skill: ResolvedSkill } => entry.skill != null);
  const categorySelections = groupBy(validSkills, (entry) => entry.skill.category);

  for (const [categoryId, entries] of typedEntries(categorySelections)) {
    if (entries.length > 1) {
      const skillIds = entries.map((e) => e.skillId);
      // CategoryPath -> Subcategory: categories lookup uses bare subcategory names
      const category = matrix.categories[categoryId as Subcategory];
      if (category?.exclusive) {
        errors.push({
          type: "categoryExclusive",
          message: `Category "${category.displayName}" only allows one selection, but multiple selected: ${skillIds.map((id) => getLabel(matrix.skills[id], id)).join(", ")}`,
          skills: skillIds,
        });
      }
    }
  }

  return { errors, warnings: [] };
}

function validateRecommendations(
  resolvedSelections: SkillId[],
  selectedSet: Set<SkillId>,
  matrix: MergedSkillsMatrix,
): ValidationPartial {
  const warnings: ValidationWarning[] = [];

  for (const skillId of resolvedSelections) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;

    for (const recommendation of skill.recommends) {
      if (!selectedSet.has(recommendation.skillId)) {
        const recommendedSkill = matrix.skills[recommendation.skillId];
        if (recommendedSkill) {
          const hasConflict = recommendedSkill.conflictsWith.some((c) =>
            selectedSet.has(c.skillId),
          );
          if (!hasConflict) {
            warnings.push({
              type: "missing_recommendation",
              message: `${getLabel(skill, skillId)} recommends ${getLabel(recommendedSkill, recommendation.skillId)}: ${recommendation.reason}`,
              skills: [skillId, recommendation.skillId],
            });
          }
        }
      }
    }
  }

  return { errors: [], warnings };
}

function validateSetupUsage(
  resolvedSelections: SkillId[],
  selectedSet: Set<SkillId>,
  matrix: MergedSkillsMatrix,
): ValidationPartial {
  const warnings: ValidationWarning[] = [];

  for (const skillId of resolvedSelections) {
    const skill = matrix.skills[skillId];
    if (!skill || skill.providesSetupFor.length === 0) continue;

    const hasUsageSkill = skill.providesSetupFor.some((usageId) => selectedSet.has(usageId));
    if (!hasUsageSkill) {
      warnings.push({
        type: "unused_setup",
        message: `Setup skill "${getLabel(skill, skillId)}" selected but no corresponding usage skills: ${skill.providesSetupFor.map((id) => getLabel(matrix.skills[id], id)).join(", ")}`,
        skills: [skillId, ...skill.providesSetupFor],
      });
    }
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
 * Runs five validation passes:
 * 1. **Conflicts** - Checks for mutually exclusive skill pairs (errors)
 * 2. **Requirements** - Checks that all required dependencies are selected (errors)
 * 3. **Exclusivity** - Checks that exclusive categories have at most one selection (errors)
 * 4. **Recommendations** - Checks for missing recommended companion skills (warnings)
 * 5. **Setup usage** - Checks that setup-only skills have corresponding usage skills (warnings)
 *
 * @param selections - Complete list of selected skill IDs to validate
 * @param matrix - Merged skills matrix with all relationship rules
 * @returns Validation result with `valid` flag, error list, and warning list
 */
export function validateSelection(
  selections: SkillId[],
  matrix: MergedSkillsMatrix,
): SelectionValidation {
  const { resolvedSelections, selectedSet } = initializeSelectionContext(selections, matrix);

  const { errors, warnings } = mergeValidationResults([
    validateConflicts(resolvedSelections, matrix),
    validateRequirements(resolvedSelections, selectedSet, matrix),
    validateExclusivity(resolvedSelections, matrix),
    validateRecommendations(resolvedSelections, selectedSet, matrix),
    validateSetupUsage(resolvedSelections, selectedSet, matrix),
  ]);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Builds a list of skill options for a category, annotated with their current
 * state (disabled, discouraged, recommended, selected) relative to the wizard's
 * selection state.
 *
 * Each skill is checked against the current selections to determine its visual
 * and interactive state in the wizard UI. States are mutually prioritized:
 * disabled takes precedence over discouraged, which takes precedence over recommended.
 *
 * @param categoryId - Category path to filter skills by
 * @param currentSelections - Currently selected skill IDs
 * @param matrix - Merged skills matrix
 * @param options - Optional flags (e.g., expertMode bypasses constraint checks)
 * @returns Array of skill options with state annotations and reasons
 */
export function getAvailableSkills(
  categoryId: CategoryPath,
  currentSelections: SkillId[],
  matrix: MergedSkillsMatrix,
  options?: SkillCheckOptions,
): SkillOption[] {
  const skillOptions: SkillOption[] = [];
  const { selectedSet } = initializeSelectionContext(currentSelections, matrix);

  for (const skill of Object.values(matrix.skills)) {
    if (!skill) continue;
    if (skill.category !== categoryId) {
      continue;
    }

    const disabled = isDisabled(skill.id, currentSelections, matrix, options);
    const discouraged = !disabled && isDiscouraged(skill.id, currentSelections, matrix);
    const recommended =
      !disabled && !discouraged && isRecommended(skill.id, currentSelections, matrix);

    skillOptions.push({
      id: skill.id,
      displayName: skill.displayName,
      description: skill.description,
      disabled,
      disabledReason: disabled ? getDisableReason(skill.id, currentSelections, matrix) : undefined,
      discouraged,
      discouragedReason: discouraged
        ? getDiscourageReason(skill.id, currentSelections, matrix)
        : undefined,
      recommended,
      recommendedReason: recommended
        ? getRecommendReason(skill.id, currentSelections, matrix)
        : undefined,
      selected: selectedSet.has(skill.id),
      alternatives: skill.alternatives.map((a) => a.skillId),
    });
  }

  return skillOptions;
}

/** Returns all resolved skills belonging to the given category. */
export function getSkillsByCategory(
  categoryId: CategoryPath,
  matrix: MergedSkillsMatrix,
): ResolvedSkill[] {
  const skills: ResolvedSkill[] = [];

  for (const skill of Object.values(matrix.skills)) {
    if (!skill) continue;
    if (skill.category === categoryId) {
      skills.push(skill);
    }
  }

  return skills;
}

/**
 * Checks whether every skill in a category is disabled given the current selections.
 *
 * Used by the wizard to dim entire category tiles when no selectable skills remain.
 * Returns the first disable reason (truncated to the core message before parenthetical
 * details) when all skills are disabled.
 *
 * @param categoryId - Category path to check
 * @param currentSelections - Currently selected skill IDs
 * @param matrix - Merged skills matrix
 * @param options - Optional flags; expertMode always returns not disabled
 * @returns Object with `disabled` flag and optional short `reason` string
 */
export function isCategoryAllDisabled(
  categoryId: CategoryPath,
  currentSelections: SkillId[],
  matrix: MergedSkillsMatrix,
  options?: SkillCheckOptions,
): { disabled: boolean; reason?: string } {
  if (options?.expertMode) {
    return { disabled: false };
  }

  const skills = getSkillsByCategory(categoryId, matrix);

  if (skills.length === 0) {
    return { disabled: false };
  }

  const disabledSkills: Array<{ skillId: SkillId; reason: string | undefined }> = [];

  for (const skill of skills) {
    if (isDisabled(skill.id, currentSelections, matrix, options)) {
      disabledSkills.push({
        skillId: skill.id,
        reason: getDisableReason(skill.id, currentSelections, matrix),
      });
    }
  }

  if (disabledSkills.length === skills.length) {
    const firstReason = disabledSkills[0]?.reason;
    const shortReason = firstReason?.split(" (")[0] || "requirements not met";
    return { disabled: true, reason: shortReason };
  }

  return { disabled: false };
}
