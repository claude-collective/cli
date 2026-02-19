import { Box, Text } from "ink";
import React from "react";
import { CLI_COLORS } from "../../consts.js";
import type { WizardStep } from "../../stores/wizard-store.js";

type WizardTabStep = {
  id: WizardStep;
  label: string;
  number: number;
};

export type WizardTabsProps = {
  steps: WizardTabStep[];
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  skippedSteps?: WizardStep[];
  version?: string;
};

export const WIZARD_STEPS: WizardTabStep[] = [
  { id: "stack", label: "Stack", number: 1 },
  { id: "build", label: "Build", number: 2 },
  { id: "sources", label: "Sources", number: 3 },
  { id: "agents", label: "Agents", number: 4 },
  { id: "confirm", label: "Confirm", number: 5 },
];

type FormattedStepLabel = {
  /** The step number indicator, e.g. "[1]" */
  prefix: string;
  /** The step label text, e.g. "Stack" */
  label: string;
  /** The complete formatted string, e.g. "[1] Stack" */
  full: string;
};

/** Format a wizard step as its tab label parts and full string, e.g. "[1] Stack" */
export function formatStepLabel(stepId: WizardStep): FormattedStepLabel {
  const step = WIZARD_STEPS.find((s) => s.id === stepId);
  if (!step) return { prefix: "", label: stepId, full: stepId };
  const prefix = `[${step.number}]`;
  return { prefix, label: step.label, full: `${prefix} ${step.label}` };
}

type StepState = "completed" | "current" | "pending" | "skipped";

const getStepState = (
  stepId: WizardStep,
  currentStep: WizardStep,
  completedSteps: WizardStep[],
  skippedSteps: WizardStep[],
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

const Tab: React.FC<TabProps> = ({ step, state }) => {
  const label = `[${step.number}] ${step.label}`;

  switch (state) {
    case "current":
      return (
        <Text color={CLI_COLORS.UNFOCUSED} backgroundColor={CLI_COLORS.WARNING} bold>
          {" "}
          {label}{" "}
        </Text>
      );
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
      alignItems="center"
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
