import React from "react";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { MergedSkillsMatrix } from "../../types/index.js";
import { StackSelection } from "./stack-selection.js";
import { DomainSelection } from "./domain-selection.js";

type StepStackProps = {
  matrix: MergedSkillsMatrix;
  onCancel?: () => void;
};

/**
 * Unified first step of the wizard.
 *
 * Sub-step 1 (approach is null): Shows stacks + "Start from scratch" in a single list.
 * Sub-step 2 (approach is set): Shows domain selection with pre-selected domains.
 *
 * After domain selection, proceeds to the "build" step.
 */
export const StepStack: React.FC<StepStackProps> = ({ matrix, onCancel }) => {
  const { approach } = useWizardStore();

  if (approach !== null) {
    return <DomainSelection matrix={matrix} />;
  }

  return <StackSelection matrix={matrix} onCancel={onCancel} />;
};
