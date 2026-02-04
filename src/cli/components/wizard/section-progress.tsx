import React from "react";
import { Box, Text } from "ink";

export interface SectionProgressProps {
  /** Section label (e.g., "Domain" or "Skill") */
  label: string;
  /** Current item name (e.g., "Web" or "react") */
  current: string;
  /** 1-based index */
  index: number;
  /** Total count */
  total: number;
  /** Next item name, or undefined if last */
  next?: string;
}

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
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={2}
      marginBottom={1}
    >
      <Text>
        <Text bold>{label}:</Text> <Text color="cyan">{current}</Text>
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
