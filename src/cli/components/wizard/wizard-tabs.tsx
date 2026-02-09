import React from "react";
import { Box, Text } from "ink";

export interface WizardTabStep {
  id: string;
  label: string;
  number: number;
}

export interface WizardTabsProps {
  steps: WizardTabStep[];
  currentStep: string;
  completedSteps: string[];
  skippedSteps?: string[];
  version?: string;
}

export const WIZARD_STEPS: WizardTabStep[] = [
  { id: "approach", label: "Intro", number: 1 },
  { id: "stack", label: "Stack", number: 2 },
  { id: "build", label: "Build", number: 3 },
  { id: "confirm", label: "Confirm", number: 4 },
];

type StepState = "completed" | "current" | "pending" | "skipped";

const getStepState = (
  stepId: string,
  currentStep: string,
  completedSteps: string[],
  skippedSteps: string[],
): StepState => {
  if (completedSteps.includes(stepId)) return "completed";
  if (stepId === currentStep) return "current";
  if (skippedSteps.includes(stepId)) return "skipped";
  return "pending";
};

interface TabProps {
  step: WizardTabStep;
  state: StepState;
}

const Tab: React.FC<TabProps> = ({ step, state }) => {
  const label = `[${step.number}] ${step.label}`;

  switch (state) {
    case "current":
      return <Text color="cyan">{label}</Text>;
    case "completed":
      return <Text>{label}</Text>;
    case "skipped":
      return <Text dimColor>{label}</Text>;
    case "pending":
    default:
      return <Text color="white">{label}</Text>;
  }
};

export const WizardTabs: React.FC<WizardTabsProps> = ({
  steps,
  currentStep,
  completedSteps,
  skippedSteps = [],
  version,
}) => {
  return (
    <Box
      flexDirection="row"
      columnGap={2}
      borderRight={false}
      borderLeft={false}
      borderColor="blackBright"
      borderStyle="single"
      paddingRight={1}
    >
      {steps.map((step) => {
        const state = getStepState(step.id, currentStep, completedSteps, skippedSteps);

        return <Tab key={step.id} step={step} state={state} />;
      })}
      <Box flexGrow={1} justifyContent="flex-end">
        <Text dimColor>{`v${version}`}</Text>
      </Box>
    </Box>
  );
};
