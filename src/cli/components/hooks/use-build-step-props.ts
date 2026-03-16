import { useCallback } from "react";
import type { Category, Domain, SkillId } from "../../types/index.js";
import type { WizardState } from "../../stores/wizard-store.js";
import { matrix } from "../../lib/matrix/matrix-provider.js";
import { getDependentSkills } from "../../lib/matrix/matrix-resolver.js";
import type { StepBuildProps } from "../wizard/step-build.js";

type UseBuildStepPropsOptions = {
  store: WizardState;
  installedSkillIds?: SkillId[];
};

export function useBuildStepProps({
  store,
  installedSkillIds,
}: UseBuildStepPropsOptions): StepBuildProps {
  const currentDomain = store.getCurrentDomain();
  const defaultDomains: Domain[] = ["web"];
  const effectiveDomains =
    store.selectedDomains.length > 0 ? store.selectedDomains : defaultDomains;

  const allSelections = store.getAllSelectedTechnologies();

  const activeDomain: Domain = currentDomain || effectiveDomains[0] || "web";

  const onToggle = useCallback(
    (categoryId: Parameters<StepBuildProps["onToggle"]>[0], techId: SkillId) => {
      const domain: Domain = store.getCurrentDomain() || "web";
      const cat = matrix.categories[categoryId];
      const exclusive = cat?.exclusive ?? true;

      // Check if this is a deselection
      const currentCategorySelections = store.domainSelections[domain]?.[categoryId] || [];
      const isDeselecting = currentCategorySelections.includes(techId);

      if (isDeselecting) {
        // Block deselection if other selected skills depend on this one
        const dependents = getDependentSkills(techId, allSelections);
        if (dependents.length > 0) {
          return; // Blocked — skill is required by dependents
        }
      }

      // Perform the toggle
      store.toggleTechnology(domain, categoryId, techId, exclusive);

      // After selecting: auto-select required skills that aren't yet selected
      if (!isDeselecting) {
        const skill = matrix.skills[techId];
        if (skill) {
          for (const req of skill.requires) {
            if (req.needsAny) continue; // Can't auto-select when there's a choice
            for (const reqId of req.skillIds) {
              const reqSkill = matrix.skills[reqId];
              if (!reqSkill) continue;
              // Check if already selected (across all domains)
              if (!allSelections.includes(reqId)) {
                // Boundary cast: CategoryPath includes "local" but matrix.categories only has Category keys
                const reqCategoryId = reqSkill.category as Category;
                const reqCat = matrix.categories[reqCategoryId];
                if (!reqCat) continue;
                const reqDomain = reqCat.domain as Domain;
                store.toggleTechnology(reqDomain, reqCategoryId, reqId, reqCat.exclusive ?? true);
              }
            }
          }
        }
      }
    },
    [store, allSelections],
  );

  const onContinue = useCallback(() => {
    if (!store.nextDomain()) {
      store.setStep("sources");
    }
  }, [store]);

  const onBack = useCallback(() => {
    if (!store.prevDomain()) {
      store.goBack();
    }
  }, [store]);

  return {
    domain: activeDomain,
    selectedDomains: effectiveDomains,
    selections: store.domainSelections[activeDomain] || {},
    allSelections,
    showLabels: store.showLabels,
    installedSkillIds,
    onToggle,
    onToggleLabels: store.toggleShowLabels,
    onContinue,
    onBack,
  };
}
