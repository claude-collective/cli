import React, { useCallback } from "react";
import { Box, Text, useInput } from "ink";
import type { SkillId } from "../../types/index.js";

export type SourceOption = {
  id: string;
  label: string;
  selected: boolean;
  installed: boolean;
};

export type SourceRow = {
  skillId: SkillId;
  displayName: string;
  options: SourceOption[];
};

export type SourceGridProps = {
  rows: SourceRow[];
  focusedRow: number;
  focusedCol: number;
  onSelect: (skillId: SkillId, sourceId: string) => void;
  onFocusChange: (row: number, col: number) => void;
};

type SourceTagProps = {
  option: SourceOption;
  isFocused: boolean;
};

const SourceTag: React.FC<SourceTagProps> = ({ option, isFocused }) => {
  const borderColor = option.selected ? "cyan" : isFocused ? "white" : "gray";
  const textColor = option.selected ? "cyan" : undefined;
  const isBold = isFocused || option.selected;

  return (
    <Box marginRight={1} borderColor={borderColor} borderStyle="single">
      <Text color={textColor} bold={isBold}>
        {" "}
        {option.label}{" "}
      </Text>
    </Box>
  );
};

type SourceSectionProps = {
  row: SourceRow;
  isFocused: boolean;
  focusedOptionIndex: number;
};

const SourceSection: React.FC<SourceSectionProps> = ({ row, isFocused, focusedOptionIndex }) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row">
        <Text>{row.displayName}</Text>
      </Box>

      <Box flexDirection="row" flexWrap="wrap" marginTop={0}>
        {row.options.map((option, index) => (
          <SourceTag
            key={option.id}
            option={option}
            isFocused={isFocused && index === focusedOptionIndex}
          />
        ))}
      </Box>
    </Box>
  );
};

export const SourceGrid: React.FC<SourceGridProps> = ({
  rows,
  focusedRow,
  focusedCol,
  onSelect,
  onFocusChange,
}) => {
  useInput(
    useCallback(
      (input: string, key: { leftArrow: boolean; rightArrow: boolean; upArrow: boolean; downArrow: boolean }) => {
        if (input === " ") {
          const currentRow = rows[focusedRow];
          const currentOption = currentRow?.options[focusedCol];
          if (currentRow && currentOption) {
            onSelect(currentRow.skillId, currentOption.id);
          }
          return;
        }

        const isLeft = key.leftArrow;
        const isRight = key.rightArrow;
        const isUp = key.upArrow;
        const isDown = key.downArrow;

        if (isLeft) {
          const currentRow = rows[focusedRow];
          if (!currentRow) return;
          const length = currentRow.options.length;
          const newCol = focusedCol <= 0 ? length - 1 : focusedCol - 1;
          onFocusChange(focusedRow, newCol);
        } else if (isRight) {
          const currentRow = rows[focusedRow];
          if (!currentRow) return;
          const length = currentRow.options.length;
          const newCol = focusedCol >= length - 1 ? 0 : focusedCol + 1;
          onFocusChange(focusedRow, newCol);
        } else if (isUp) {
          const length = rows.length;
          const newRow = focusedRow <= 0 ? length - 1 : focusedRow - 1;
          const newRowOptions = rows[newRow]?.options || [];
          const newCol = Math.min(focusedCol, newRowOptions.length - 1);
          onFocusChange(newRow, Math.max(0, newCol));
        } else if (isDown) {
          const length = rows.length;
          const newRow = focusedRow >= length - 1 ? 0 : focusedRow + 1;
          const newRowOptions = rows[newRow]?.options || [];
          const newCol = Math.min(focusedCol, newRowOptions.length - 1);
          onFocusChange(newRow, Math.max(0, newCol));
        }
      },
      [rows, focusedRow, focusedCol, onSelect, onFocusChange],
    ),
  );

  if (rows.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No skills to display.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {rows.map((row, rowIndex) => (
        <SourceSection
          key={row.skillId}
          row={row}
          isFocused={rowIndex === focusedRow}
          focusedOptionIndex={focusedCol}
        />
      ))}
    </Box>
  );
};
