/**
 * WizardTabs component - horizontal progress indicator for wizard steps.
 *
 * Displays all 5 wizard steps with tab-style visual indicators:
 * - Active step: green background with padding
 * - Completed steps: white background, dark text
 * - Pending steps: default text, no background
 * - Skipped: dimmed text, no background
 *
 * Horizontal divider lines above and below for visual separation.
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

/** Divider line width (approximate terminal width) */
const DIVIDER_WIDTH = 75;

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

// =============================================================================
// Tab Renderer
// =============================================================================

interface TabProps {
  step: WizardTabStep;
  state: StepState;
}

const Tab: React.FC<TabProps> = ({ step, state }) => {
  const label = `[${step.number}] ${step.label}`;

  switch (state) {
    case "current":
      // Active step: cyan background with 1-char padding (matches focus color)
      return (
        <Text backgroundColor="cyan" color="black">
          {" "}
          {label}{" "}
        </Text>
      );
    case "completed":
      // Completed steps: white background, dark text
      return (
        <Text backgroundColor="white" color="black">
          {" "}
          {label}{" "}
        </Text>
      );
    case "skipped":
      // Skipped: dimmed text, no background
      return <Text dimColor>{label}</Text>;
    case "pending":
    default:
      // Pending: default text, no background
      return <Text>{label}</Text>;
  }
};

// =============================================================================
// Divider Component
// =============================================================================

const Divider: React.FC = () => {
  const line = "\u2500".repeat(DIVIDER_WIDTH);
  return <Text dimColor>{line}</Text>;
};

// =============================================================================
// Main Component
// =============================================================================

export const WizardTabs: React.FC<WizardTabsProps> = ({
  steps,
  currentStep,
  completedSteps,
  skippedSteps = [],
}) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Top divider */}
      <Divider />

      {/* Tab row */}
      <Box flexDirection="row" justifyContent="space-around" paddingY={0}>
        {steps.map((step) => {
          const state = getStepState(
            step.id,
            currentStep,
            completedSteps,
            skippedSteps,
          );

          return <Tab key={step.id} step={step} state={state} />;
        })}
      </Box>

      {/* Bottom divider */}
      <Divider />
    </Box>
  );
};
