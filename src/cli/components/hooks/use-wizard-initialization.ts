import { useRef } from "react";
import { useWizardStore, type WizardStep } from "../../stores/wizard-store.js";
import { WIZARD_STEPS } from "../wizard/wizard-tabs.js";
import type { AgentScopeConfig, SkillConfig } from "../../types/config.js";
import type { AgentName, Domain, SkillId } from "../../types/index.js";

type UseWizardInitializationOptions = {
  initialStep?: WizardStep;
  initialDomains?: Domain[];
  initialAgents?: AgentName[];
  installedSkillIds?: SkillId[];
  installedSkillConfigs?: SkillConfig[];
  installedAgentConfigs?: AgentScopeConfig[];
  isEditingFromGlobalScope?: boolean;
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
  isEditingFromGlobalScope,
}: UseWizardInitializationOptions): void {
  const initialized = useRef(false);

  if (!initialized.current) {
    initialized.current = true;

    useWizardStore.setState({ isInitMode: !initialStep });

    if (initialStep) {
      if (installedSkillIds?.length) {
        useWizardStore.getState().populateFromSkillIds(installedSkillIds, installedSkillConfigs);
      }
      // Walk through steps via setStep() so history builds naturally.
      // E.g. initialStep="build" → setStep("domains") then setStep("build")
      // → history=["stack", "domains"], step="build".
      useWizardStore.setState({ approach: "scratch" });
      const stepIds = WIZARD_STEPS.map((s) => s.id);
      const targetIndex = stepIds.indexOf(initialStep);
      for (let i = 1; i <= targetIndex; i++) {
        useWizardStore.getState().setStep(stepIds[i]!);
      }
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
    // Snapshot installed configs for diff rendering in SkillAgentSummary
    if (installedSkillConfigs?.length || installedAgentConfigs?.length) {
      useWizardStore.setState({
        installedSkillConfigs: installedSkillConfigs ?? null,
        installedAgentConfigs: installedAgentConfigs ?? null,
      });
    }
    if (isEditingFromGlobalScope) {
      useWizardStore.setState({ isEditingFromGlobalScope });
    }

    // Store global preselections for stack-selection.tsx to merge after stack/scratch choice.
    // In init flow (!initialStep), skills are not populated yet — the stack step runs first.
    if (!initialStep && installedSkillConfigs?.length) {
      useWizardStore.setState({ globalPreselections: installedSkillConfigs });
    }
    // Store global agent preselections so stack-selection.tsx can restore them after selectStack wipes agents.
    if (!initialStep && (initialAgents?.length || installedAgentConfigs?.length)) {
      useWizardStore.setState({
        globalAgentPreselections: {
          agents: initialAgents ?? [],
          configs: installedAgentConfigs ?? [],
        },
      });
    }
  }
}
