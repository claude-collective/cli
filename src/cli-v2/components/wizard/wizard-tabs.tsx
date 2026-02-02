/**
 * WizardTabs component - horizontal progress indicator for wizard steps.
 *
 * Displays all 5 wizard steps with visual indicators:
 * - Completed: green checkmark (✓)
 * - Current: cyan dot (●)
 * - Pending: white circle (○)
 * - Skipped: dimmed circle (○)
 */
import React from "react";
import { Box, Text } from "ink";

// =============================================================================
// Types
// =============================================================================

export interface WizardTabStep {
  id: string;
  label: string;
  number: number;
}

export interface WizardTabsProps {
  /** All wizard steps in order */
  steps: WizardTabStep[];
  /** Current active step ID */
  currentStep: string;
  /** IDs of completed steps */
  completedSteps: string[];
  /** IDs of skipped/inapplicable steps (shown dimmed) */
  skippedSteps?: string[];
}

// =============================================================================
// Constants
// =============================================================================

/** Default wizard steps */
export const WIZARD_STEPS: WizardTabStep[] = [
  { id: "approach", label: "Approach", number: 1 },
  { id: "stack", label: "Stack", number: 2 },
  { id: "build", label: "Build", number: 3 },
  { id: "refine", label: "Refine", number: 4 },
  { id: "confirm", label: "Confirm", number: 5 },
];

// =============================================================================
// Step State Helpers
// =============================================================================

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

const getStatusSymbol = (state: StepState): string => {
  switch (state) {
    case "completed":
      return "✓";
    case "current":
      return "●";
    case "pending":
      return "○";
    case "skipped":
      return "○";
  }
};

const getStatusColor = (state: StepState): string | undefined => {
  switch (state) {
    case "completed":
      return "green";
    case "current":
      return "cyan";
    case "pending":
      return undefined; // default white
    case "skipped":
      return "gray";
  }
};

// =============================================================================
// Component
// =============================================================================

export const WizardTabs: React.FC<WizardTabsProps> = ({
  steps,
  currentStep,
  completedSteps,
  skippedSteps = [],
}) => {
  return (
    <Box flexDirection="row" justifyContent="space-around" marginBottom={1}>
      {steps.map((step) => {
        const state = getStepState(
          step.id,
          currentStep,
          completedSteps,
          skippedSteps,
        );
        const symbol = getStatusSymbol(state);
        const color = getStatusColor(state);
        const dimmed = state === "skipped";

        return (
          <Box key={step.id} flexDirection="column" alignItems="center">
            <Text dimColor={dimmed} color={dimmed ? "gray" : undefined}>
              [{step.number}] {step.label}
            </Text>
            <Text color={color} dimColor={dimmed}>
              {symbol}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
