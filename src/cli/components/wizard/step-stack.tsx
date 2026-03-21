import { Box } from "ink";
import React from "react";
import { useMeasuredHeight } from "../hooks/use-measured-height.js";
import { StackSelection } from "./stack-selection.js";

type StepStackProps = {
  onCancel?: () => void;
};

/**
 * First step of the wizard: select a stack or "Start from scratch".
 *
 * After selection, the wizard transitions to the "domains" step.
 */
export const StepStack: React.FC<StepStackProps> = ({ onCancel }) => {
  const { ref: containerRef, measuredHeight } = useMeasuredHeight();

  return (
    <Box flexDirection="column" width="100%" flexGrow={1} flexBasis={0}>
      <Box ref={containerRef} flexGrow={1} flexBasis={0}>
        <StackSelection availableHeight={measuredHeight} onCancel={onCancel} />
      </Box>
    </Box>
  );
};
