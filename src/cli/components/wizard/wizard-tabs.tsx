import React from "react";
import { Box, Text } from "ink";
import { CLI_COLORS, DEFAULT_BRANDING, UI_SYMBOLS } from "../../consts.js";
import type { WizardStep } from "../../stores/wizard-store.js";

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
  brandingName?: string;
};

export const WIZARD_STEPS: WizardTabStep[] = [
  { id: "stack", label: "Stack", number: 1 },
  { id: "build", label: "Build", number: 2 },
  { id: "sources", label: "Sources", number: 3 },
  { id: "confirm", label: "Confirm", number: 4 },
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
  brandingName,
}) => {
  const displayName = brandingName ?? DEFAULT_BRANDING.NAME;

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
      <Text bold color={CLI_COLORS.PRIMARY}>
        {displayName}
      </Text>
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
