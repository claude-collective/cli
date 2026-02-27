import { useCallback } from "react";
import type { Domain, MergedSkillsMatrix, SkillId } from "../../types/index.js";
import type { WizardState } from "../../stores/wizard-store.js";
import type { StepBuildProps } from "../wizard/step-build.js";

type UseBuildStepPropsOptions = {
  store: WizardState;
  matrix: MergedSkillsMatrix;
  installedSkillIds?: SkillId[];
};

export function useBuildStepProps({
  store,
  matrix,
  installedSkillIds,
}: UseBuildStepPropsOptions): StepBuildProps {
  const currentDomain = store.getCurrentDomain();
  const defaultDomains: Domain[] = ["web"];
  const effectiveDomains =
    store.selectedDomains.length > 0 ? store.selectedDomains : defaultDomains;

  const allSelections = store.getAllSelectedTechnologies();

  const activeDomain: Domain = currentDomain || effectiveDomains[0] || "web";

  const onToggle = useCallback(
    (subcategoryId: Parameters<StepBuildProps["onToggle"]>[0], techId: SkillId) => {
      const domain: Domain = store.getCurrentDomain() || "web";
      const cat = matrix.categories[subcategoryId];
      store.toggleTechnology(domain, subcategoryId, techId, cat?.exclusive ?? true);
    },
    [store, matrix],
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
    matrix,
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
