import { Box } from "ink";
import React from "react";
import { useWizardStore } from "../../stores/wizard-store.js";
import { useMeasuredHeight } from "../hooks/use-measured-height.js";
import { StackSelection } from "./stack-selection.js";
import { DomainSelection } from "./domain-selection.js";
import { ViewTitle } from "./view-title.js";

type StepStackProps = {
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
export const StepStack: React.FC<StepStackProps> = ({ onCancel }) => {
  const { approach } = useWizardStore();
  const { ref: containerRef, measuredHeight } = useMeasuredHeight();

  if (approach !== null) {
    return <DomainSelection />;
  }

  return (
    <Box flexDirection="column" width="100%" flexGrow={1} flexBasis={0}>
      {/* <ViewTitle>Choose a stack</ViewTitle> */}
      <Box ref={containerRef} flexGrow={1} flexBasis={0}>
        <StackSelection availableHeight={measuredHeight} onCancel={onCancel} />
      </Box>
    </Box>
  );
};
