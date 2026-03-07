import { useRef } from "react";
import { useWizardStore, type WizardStep } from "../../stores/wizard-store.js";
import type { SkillConfig } from "../../types/config.js";
import type { AgentName, Domain, MergedSkillsMatrix, SkillId } from "../../types/index.js";

type UseWizardInitializationOptions = {
  matrix: MergedSkillsMatrix;
  initialStep?: WizardStep;
  initialDomains?: Domain[];
  initialAgents?: AgentName[];
  installedSkillIds?: SkillId[];
  installedSkillConfigs?: SkillConfig[];
  lockedSkillIds?: SkillId[];
  lockedAgentNames?: AgentName[];
};

/**
 * Runs one-time wizard store initialization before the first render.
 * Populates step, approach, and skill selections from props.
 */
export function useWizardInitialization({
  matrix,
  initialStep,
  initialDomains,
  initialAgents,
  installedSkillIds,
  installedSkillConfigs,
  lockedSkillIds,
  lockedAgentNames,
}: UseWizardInitializationOptions): void {
  const initialized = useRef(false);

  if (!initialized.current) {
    initialized.current = true;

    if (initialStep) {
      if (installedSkillIds?.length) {
        useWizardStore
          .getState()
          .populateFromSkillIds(
            installedSkillIds,
            matrix.skills,
            matrix.categories,
            installedSkillConfigs,
          );
      }
      useWizardStore.setState({ step: initialStep, approach: "scratch" });
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
    // Set locked IDs (D9: global items read-only in project context)
    if (lockedSkillIds?.length || lockedAgentNames?.length) {
      useWizardStore.setState({
        ...(lockedSkillIds?.length && { lockedSkillIds }),
        ...(lockedAgentNames?.length && { lockedAgentNames }),
      });
    }
  }
}
