import React from "react";
import { Box, Text } from "ink";
import { CLI_COLORS } from "../../consts.js";

type SectionProgressProps = {
  label: string;
  current: string;
  /** 1-based */
  index: number;
  total: number;
  next?: string;
};

export const SectionProgress: React.FC<SectionProgressProps> = ({
  label,
  current,
  index,
  total,
  next,
}) => {
  const isLast = index === total;
  const rightText = isLast ? "Last step" : `Next: ${next}`;

  return (
    <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
      <Text>
        <Text bold>{label}:</Text> <Text color={CLI_COLORS.PRIMARY}>{current}</Text>
      </Text>
      <Text>
        <Text dimColor>
          [{index}/{total}]
        </Text>{" "}
        <Text dimColor={isLast}>{rightText}</Text>
      </Text>
    </Box>
  );
};
