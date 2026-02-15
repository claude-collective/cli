import React from "react";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { MergedSkillsMatrix } from "../../types/index.js";
import { StackSelection } from "./stack-selection.js";
import { DomainSelection } from "./domain-selection.js";

type StepStackProps = {
  matrix: MergedSkillsMatrix;
};

export const StepStack: React.FC<StepStackProps> = ({ matrix }) => {
  const { approach } = useWizardStore();

  if (approach === "stack") {
    return <StackSelection matrix={matrix} />;
  }

  // approach === "scratch"
  return <DomainSelection />;
};
