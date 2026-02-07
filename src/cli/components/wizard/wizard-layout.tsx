import React, { Fragment, useMemo } from "react";
import { Box, Text } from "ink";
import { useWizardStore } from "../../stores/wizard-store.js";
import { WizardTabs, WIZARD_STEPS } from "./wizard-tabs.js";

// =============================================================================
// DefinitionItem Component (reusable keyboard shortcut tag)
// =============================================================================

interface KeyHintProps {
  label: string;
  values: string[];
}

export const DefinitionItem: React.FC<KeyHintProps> = ({ label, values }) => (
  <Text>
    {values.map((value) => (
      <Fragment key={value}>
        <Text backgroundColor="black" color="white">
          {" "}
          {value}{" "}
        </Text>{" "}
      </Fragment>
    ))}
    <Text>{label}</Text>
  </Text>
);

// =============================================================================
// Constants
// =============================================================================

const HOT_KEYS: { label: string; values: string[] }[] = [
  { label: "navigate", values: ["\u2190/\u2192", "\u2191/\u2193"] },
  { label: "select", values: ["SPACE"] },
  { label: "continue", values: ["ENTER"] },
  { label: "back", values: ["ESC"] },
  { label: "export", values: ["E"] },
];

// =============================================================================
// WizardFooter Component
// =============================================================================

export const WizardFooter = () => {
  return (
    <Box
      columnGap={2}
      borderTop
      borderRight={false}
      borderBottom
      borderLeft={false}
      borderColor="blackBright"
      borderStyle="single"
      paddingLeft={1}
      paddingRight={1}
    >
      {HOT_KEYS.map((hotkey) => (
        <DefinitionItem {...hotkey} key={hotkey.label} />
      ))}
    </Box>
  );
};

// =============================================================================
// WizardLayout Component
// =============================================================================

interface WizardLayoutProps {
  version?: string;
  children: React.ReactNode;
}

export const WizardLayout: React.FC<WizardLayoutProps> = ({ version, children }) => {
  const store = useWizardStore();

  // Compute completed and skipped steps for WizardTabs
  const { completedSteps, skippedSteps } = useMemo(() => {
    const completed: string[] = [];
    const skipped: string[] = [];

    // Approach is complete when we've moved past it
    if (store.step !== "approach") {
      completed.push("approach");
    }

    // Stack step handling
    if (store.step !== "approach" && store.step !== "stack" && store.step !== "stack-options") {
      completed.push("stack");
    }

    // Build step handling
    // Stack path with defaults skips build
    if (store.approach === "stack" && store.selectedStackId && store.stackAction === "defaults") {
      skipped.push("build");
    } else if (store.step === "refine" || store.step === "confirm") {
      completed.push("build");
    }

    // Refine step
    if (store.step === "confirm") {
      completed.push("refine");
    }

    return { completedSteps: completed, skippedSteps: skipped };
  }, [store.step, store.approach, store.selectedStackId, store.stackAction]);

  return (
    <Box flexDirection="column">
      <WizardTabs
        steps={WIZARD_STEPS}
        currentStep={store.step}
        completedSteps={completedSteps}
        skippedSteps={skippedSteps}
        version={version}
      />
      {children}
      <WizardFooter />
    </Box>
  );
};
