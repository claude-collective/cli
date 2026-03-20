import { useRef } from "react";
import { useWizardStore, type WizardStep } from "../../stores/wizard-store.js";
import type { AgentScopeConfig, SkillConfig } from "../../types/config.js";
import type { AgentName, Domain, SkillId } from "../../types/index.js";

type UseWizardInitializationOptions = {
  initialStep?: WizardStep;
  initialDomains?: Domain[];
  initialAgents?: AgentName[];
  installedSkillIds?: SkillId[];
  installedSkillConfigs?: SkillConfig[];
  installedAgentConfigs?: AgentScopeConfig[];
  lockedSkillIds?: SkillId[];
  lockedAgentNames?: AgentName[];
};

/**
 * Runs one-time wizard store initialization before the first render.
 * Populates step, approach, and skill selections from props.
 */
export function useWizardInitialization({
  initialStep,
  initialDomains,
  initialAgents,
  installedSkillIds,
  installedSkillConfigs,
  installedAgentConfigs,
  lockedSkillIds,
  lockedAgentNames,
}: UseWizardInitializationOptions): void {
  const initialized = useRef(false);

  if (!initialized.current) {
    initialized.current = true;

    if (initialStep) {
      if (installedSkillIds?.length) {
        useWizardStore.getState().populateFromSkillIds(installedSkillIds, installedSkillConfigs);
      }
      useWizardStore.setState({ step: initialStep, approach: "scratch" });
    }
    // Restore saved domains from config, overriding the domains
    // derived by populateFromSkillIds
    if (initialDomains?.length) {
      useWizardStore.setState({ selectedDomains: initialDomains, currentDomainIndex: 0 });
    }
    // Restore saved agents from config, overriding the default empty array
    if (initialAgents?.length) {
      useWizardStore.setState({ selectedAgents: initialAgents });
    }
    // Restore saved agent scope configs (project vs global)
    if (initialAgents?.length && installedAgentConfigs?.length) {
      useWizardStore.setState({ agentConfigs: installedAgentConfigs });
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
