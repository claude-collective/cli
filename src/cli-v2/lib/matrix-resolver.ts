import type {
  MergedSkillsMatrix,
  ResolvedSkill,
  SkillOption,
  SelectionValidation,
  ValidationError,
  ValidationWarning,
} from "../types-matrix";

export function resolveAlias(
  aliasOrId: string,
  matrix: MergedSkillsMatrix,
): string {
  return matrix.aliases[aliasOrId] || aliasOrId;
}

export function getDependentSkills(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): string[] {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) return [];

  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );
  const dependents: string[] = [];

  for (const selectedId of resolvedSelections) {
    if (selectedId === fullId) continue;

    const selectedSkill = matrix.skills[selectedId];
    if (!selectedSkill) continue;

    for (const requirement of selectedSkill.requires) {
      if (requirement.needsAny) {
        const satisfiedReqs = requirement.skillIds.filter((reqId) =>
          resolvedSelections.includes(reqId),
        );
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

export interface SkillCheckOptions {
  expertMode?: boolean;
}

export function isDisabled(
  skillId: string,
  currentSelections: string[],
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
    if (
      selectedSkill &&
      selectedSkill.conflictsWith.some((c) => c.skillId === fullId)
    ) {
      return true;
    }
  }

  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  for (const requirement of skill.requires) {
    if (requirement.needsAny) {
      const hasAny = requirement.skillIds.some((reqId) =>
        resolvedSelections.includes(reqId),
      );
      if (!hasAny) {
        return true;
      }
    } else {
      const hasAll = requirement.skillIds.every((reqId) =>
        resolvedSelections.includes(reqId),
      );
      if (!hasAll) {
        return true;
      }
    }
  }

  return false;
}

export function getDisableReason(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): string | undefined {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return undefined;
  }

  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  for (const selectedId of resolvedSelections) {
    const conflict = skill.conflictsWith.find((c) => c.skillId === selectedId);
    if (conflict) {
      const selectedSkill = matrix.skills[selectedId];
      const selectedName = selectedSkill?.name || selectedId;
      return `${conflict.reason} (conflicts with ${selectedName})`;
    }

    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill) {
      const reverseConflict = selectedSkill.conflictsWith.find(
        (c) => c.skillId === fullId,
      );
      if (reverseConflict) {
        const selectedName = selectedSkill.name;
        return `${reverseConflict.reason} (conflicts with ${selectedName})`;
      }
    }
  }

  for (const requirement of skill.requires) {
    if (requirement.needsAny) {
      const hasAny = requirement.skillIds.some((reqId) =>
        resolvedSelections.includes(reqId),
      );
      if (!hasAny) {
        const requiredNames = requirement.skillIds
          .map((id) => matrix.skills[id]?.name || id)
          .join(" or ");
        return `${requirement.reason} (requires ${requiredNames})`;
      }
    } else {
      const missingIds = requirement.skillIds.filter(
        (reqId) => !resolvedSelections.includes(reqId),
      );
      if (missingIds.length > 0) {
        const missingNames = missingIds
          .map((id) => matrix.skills[id]?.name || id)
          .join(", ");
        return `${requirement.reason} (requires ${missingNames})`;
      }
    }
  }

  return undefined;
}

export function isDiscouraged(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): boolean {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return false;
  }

  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  for (const selectedId of resolvedSelections) {
    const selectedSkill = matrix.skills[selectedId];
    if (
      selectedSkill &&
      selectedSkill.discourages.some((d) => d.skillId === fullId)
    ) {
      return true;
    }

    if (skill.discourages.some((d) => d.skillId === selectedId)) {
      return true;
    }
  }

  return false;
}

export function getDiscourageReason(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): string | undefined {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return undefined;
  }

  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  for (const selectedId of resolvedSelections) {
    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill) {
      const discourage = selectedSkill.discourages.find(
        (d) => d.skillId === fullId,
      );
      if (discourage) {
        return discourage.reason;
      }
    }

    const reverseDiscourage = skill.discourages.find(
      (d) => d.skillId === selectedId,
    );
    if (reverseDiscourage) {
      return reverseDiscourage.reason;
    }
  }

  return undefined;
}

export function isRecommended(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): boolean {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return false;
  }

  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  for (const selectedId of resolvedSelections) {
    const selectedSkill = matrix.skills[selectedId];
    if (
      selectedSkill &&
      selectedSkill.recommends.some((r) => r.skillId === fullId)
    ) {
      return true;
    }
  }

  return false;
}

export function getRecommendReason(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): string | undefined {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return undefined;
  }

  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  for (const selectedId of resolvedSelections) {
    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill) {
      const recommendation = selectedSkill.recommends.find(
        (r) => r.skillId === fullId,
      );
      if (recommendation) {
        return `${recommendation.reason} (recommended by ${selectedSkill.name})`;
      }
    }
  }

  return undefined;
}

export function validateSelection(
  selections: string[],
  matrix: MergedSkillsMatrix,
): SelectionValidation {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const resolvedSelections = selections.map((s) => resolveAlias(s, matrix));

  for (let i = 0; i < resolvedSelections.length; i++) {
    const skillA = matrix.skills[resolvedSelections[i]];
    if (!skillA) continue;

    for (let j = i + 1; j < resolvedSelections.length; j++) {
      const skillBId = resolvedSelections[j];
      const conflict = skillA.conflictsWith.find((c) => c.skillId === skillBId);
      if (conflict) {
        errors.push({
          type: "conflict",
          message: `${skillA.name} conflicts with ${matrix.skills[skillBId]?.name || skillBId}: ${conflict.reason}`,
          skills: [skillA.id, skillBId],
        });
      }
    }
  }

  for (const skillId of resolvedSelections) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;

    for (const requirement of skill.requires) {
      if (requirement.needsAny) {
        const hasAny = requirement.skillIds.some((reqId) =>
          resolvedSelections.includes(reqId),
        );
        if (!hasAny) {
          errors.push({
            type: "missing_requirement",
            message: `${skill.name} requires one of: ${requirement.skillIds.map((id) => matrix.skills[id]?.name || id).join(", ")}`,
            skills: [skillId, ...requirement.skillIds],
          });
        }
      } else {
        const missingIds = requirement.skillIds.filter(
          (reqId) => !resolvedSelections.includes(reqId),
        );
        if (missingIds.length > 0) {
          errors.push({
            type: "missing_requirement",
            message: `${skill.name} requires: ${missingIds.map((id) => matrix.skills[id]?.name || id).join(", ")}`,
            skills: [skillId, ...missingIds],
          });
        }
      }
    }
  }

  const categorySelections = new Map<string, string[]>();
  for (const skillId of resolvedSelections) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;

    const existing = categorySelections.get(skill.category) || [];
    existing.push(skillId);
    categorySelections.set(skill.category, existing);
  }

  for (const [categoryId, skillIds] of categorySelections.entries()) {
    if (skillIds.length > 1) {
      const category = matrix.categories[categoryId];
      if (category?.exclusive) {
        errors.push({
          type: "category_exclusive",
          message: `Category "${category.name}" only allows one selection, but multiple selected: ${skillIds.map((id) => matrix.skills[id]?.name || id).join(", ")}`,
          skills: skillIds,
        });
      }
    }
  }

  for (const skillId of resolvedSelections) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;

    for (const recommendation of skill.recommends) {
      if (!resolvedSelections.includes(recommendation.skillId)) {
        const recommendedSkill = matrix.skills[recommendation.skillId];
        if (recommendedSkill) {
          const hasConflict = recommendedSkill.conflictsWith.some((c) =>
            resolvedSelections.includes(c.skillId),
          );
          if (!hasConflict) {
            warnings.push({
              type: "missing_recommendation",
              message: `${skill.name} recommends ${recommendedSkill.name}: ${recommendation.reason}`,
              skills: [skillId, recommendation.skillId],
            });
          }
        }
      }
    }
  }

  for (const skillId of resolvedSelections) {
    const skill = matrix.skills[skillId];
    if (!skill || skill.providesSetupFor.length === 0) continue;

    const hasUsageSkill = skill.providesSetupFor.some((usageId) =>
      resolvedSelections.includes(usageId),
    );
    if (!hasUsageSkill) {
      warnings.push({
        type: "unused_setup",
        message: `Setup skill "${skill.name}" selected but no corresponding usage skills: ${skill.providesSetupFor.map((id) => matrix.skills[id]?.name || id).join(", ")}`,
        skills: [skillId, ...skill.providesSetupFor],
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function getAvailableSkills(
  categoryId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
  options?: SkillCheckOptions,
): SkillOption[] {
  const skillOptions: SkillOption[] = [];
  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  for (const skill of Object.values(matrix.skills)) {
    if (skill.category !== categoryId) {
      continue;
    }

    const disabled = isDisabled(skill.id, currentSelections, matrix, options);
    const discouraged =
      !disabled && isDiscouraged(skill.id, currentSelections, matrix);
    const recommended =
      !disabled &&
      !discouraged &&
      isRecommended(skill.id, currentSelections, matrix);

    skillOptions.push({
      id: skill.id,
      alias: skill.alias,
      name: skill.name,
      description: skill.description,
      disabled,
      disabledReason: disabled
        ? getDisableReason(skill.id, currentSelections, matrix)
        : undefined,
      discouraged,
      discouragedReason: discouraged
        ? getDiscourageReason(skill.id, currentSelections, matrix)
        : undefined,
      recommended,
      recommendedReason: recommended
        ? getRecommendReason(skill.id, currentSelections, matrix)
        : undefined,
      selected: resolvedSelections.includes(skill.id),
      alternatives: skill.alternatives.map((a) => a.skillId),
    });
  }

  return skillOptions;
}

export function getSkillsByCategory(
  categoryId: string,
  matrix: MergedSkillsMatrix,
): ResolvedSkill[] {
  const skills: ResolvedSkill[] = [];

  for (const skill of Object.values(matrix.skills)) {
    if (skill.category === categoryId) {
      skills.push(skill);
    }
  }

  return skills;
}

export function isCategoryAllDisabled(
  categoryId: string,
  currentSelections: string[],
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

  const disabledSkills: Array<{ skillId: string; reason: string | undefined }> =
    [];

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

export function getSubcategories(
  parentCategoryId: string,
  matrix: MergedSkillsMatrix,
): string[] {
  const subcategories: string[] = [];

  for (const category of Object.values(matrix.categories)) {
    if (category.parent === parentCategoryId) {
      subcategories.push(category.id);
    }
  }

  subcategories.sort((a, b) => {
    const catA = matrix.categories[a];
    const catB = matrix.categories[b];
    return (catA?.order ?? 0) - (catB?.order ?? 0);
  });

  return subcategories;
}

export function getTopLevelCategories(matrix: MergedSkillsMatrix): string[] {
  const topLevel: string[] = [];

  for (const category of Object.values(matrix.categories)) {
    if (!category.parent) {
      topLevel.push(category.id);
    }
  }

  topLevel.sort((a, b) => {
    const catA = matrix.categories[a];
    const catB = matrix.categories[b];
    return (catA?.order ?? 0) - (catB?.order ?? 0);
  });

  return topLevel;
}
