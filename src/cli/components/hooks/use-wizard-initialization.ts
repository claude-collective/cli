import { useRef } from "react";
import type { InstallScope } from "../../lib/installation/index.js";
import { useWizardStore, type WizardStep } from "../../stores/wizard-store.js";
import type { AgentName, Domain, MergedSkillsMatrix, SkillId } from "../../types/index.js";

type UseWizardInitializationOptions = {
  matrix: MergedSkillsMatrix;
  initialStep?: WizardStep;
  initialInstallMode?: "plugin" | "local";
  initialInstallScope?: InstallScope;
  initialDomains?: Domain[];
  initialAgents?: AgentName[];
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
  initialInstallScope,
  initialDomains,
  initialAgents,
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
    if (initialInstallScope) {
      useWizardStore.setState({ installScope: initialInstallScope });
    }
    // Restore saved domains from config, overriding the domains
    // derived by populateFromSkillIds
    if (initialDomains?.length) {
      useWizardStore.setState({ selectedDomains: initialDomains });
    }
    // Restore saved agents from config, overriding the default empty array
    if (initialAgents?.length) {
      useWizardStore.setState({ selectedAgents: initialAgents });
    }
  }
}
