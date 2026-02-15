import React from "react";
import { Box, Text } from "ink";
import { CLI_COLORS, UI_SYMBOLS } from "../../consts.js";

type WizardTabStep = {
  id: string;
  label: string;
  number: number;
};

export type WizardTabsProps = {
  steps: WizardTabStep[];
  currentStep: string;
  completedSteps: string[];
  skippedSteps?: string[];
  version?: string;
};

export const WIZARD_STEPS: WizardTabStep[] = [
  { id: "approach", label: "Intro", number: 1 },
  { id: "stack", label: "Stack", number: 2 },
  { id: "build", label: "Build", number: 3 },
  { id: "sources", label: "Sources", number: 4 },
  { id: "confirm", label: "Confirm", number: 5 },
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

type TabProps = {
  step: WizardTabStep;
  state: StepState;
};

const STEP_STATE_SYMBOLS: Record<StepState, string> = {
  completed: UI_SYMBOLS.SELECTED,
  current: UI_SYMBOLS.CURRENT,
  pending: UI_SYMBOLS.UNSELECTED,
  skipped: UI_SYMBOLS.SKIPPED,
};

const Tab: React.FC<TabProps> = ({ step, state }) => {
  const symbol = STEP_STATE_SYMBOLS[state];
  const label = `${symbol} [${step.number}] ${step.label}`;

  switch (state) {
    case "current":
      return <Text color={CLI_COLORS.PRIMARY}>{label}</Text>;
    case "completed":
      return <Text>{label}</Text>;
    case "skipped":
      return <Text dimColor>{label}</Text>;
    case "pending":
    default:
      return <Text color={CLI_COLORS.UNFOCUSED}>{label}</Text>;
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
