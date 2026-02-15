import { useRef } from "react";
import { useWizardStore, type WizardStep } from "../../stores/wizard-store.js";
import type { MergedSkillsMatrix, SkillId } from "../../types/index.js";

type UseWizardInitializationOptions = {
  matrix: MergedSkillsMatrix;
  initialStep?: WizardStep;
  initialInstallMode?: "plugin" | "local";
  installedSkillIds?: SkillId[];
};

/**
 * Runs one-time wizard store initialization before the first render.
 * Populates step, approach, install mode, and skill selections from props.
 */
export function useWizardInitialization({
  matrix,
  initialStep,
  initialInstallMode,
  installedSkillIds,
}: UseWizardInitializationOptions): void {
  const initialized = useRef(false);

  if (!initialized.current) {
    initialized.current = true;

    if (initialStep) {
      if (installedSkillIds?.length) {
        useWizardStore
          .getState()
          .populateFromSkillIds(installedSkillIds, matrix.skills, matrix.categories);
      }
      useWizardStore.setState({ step: initialStep, approach: "scratch" });
    }
    if (initialInstallMode) {
      useWizardStore.setState({ installMode: initialInstallMode });
    }
  }
}
