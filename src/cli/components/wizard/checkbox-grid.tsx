import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { CLI_COLORS, UI_SYMBOLS } from "../../consts.js";

export type CheckboxItem<T extends string = string> = {
  id: T;
  label: string;
  description: string;
};

export type CheckboxGridProps<T extends string = string> = {
  title: string;
  subtitle: string;
  items: CheckboxItem<T>[];
  selectedIds: T[];
  onToggle: (id: T) => void;
  onContinue: () => void;
  onBack: () => void;
  /** Label for the continue button, e.g. "Continue with 3 domain(s)" */
  continueLabel?: (count: number) => string;
  /** Message shown when nothing is selected */
  emptyMessage?: string;
};

export const CheckboxGrid = <T extends string = string>({
  title,
  subtitle,
  items,
  selectedIds,
  onToggle,
  onContinue,
  onBack,
  continueLabel = (count) => `Continue with ${count} item(s)`,
  emptyMessage = "Please select at least one item",
}: CheckboxGridProps<T>): React.ReactElement => {
  // Items + continue option at the end
  const totalItems = items.length + 1;
  const [focusedIndex, setFocusedIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.upArrow || input === "k") {
      setFocusedIndex((prev) => (prev <= 0 ? totalItems - 1 : prev - 1));
      return;
    }

    if (key.downArrow || input === "j") {
      setFocusedIndex((prev) => (prev >= totalItems - 1 ? 0 : prev + 1));
      return;
    }

    if (key.return) {
      onContinue();
      return;
    }

    if (input === " ") {
      const item = items[focusedIndex];
      if (item) {
        onToggle(item.id);
      }
    }
  });

  const continueIndex = items.length;

  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      <Text dimColor>{subtitle}</Text>
      <Text> </Text>
      {items.map((item, index) => {
        const isFocused = index === focusedIndex;
        const isSelected = selectedIds.includes(item.id);
        const checkbox = isSelected ? "[\u2713]" : "[ ]";
        const pointer = isFocused ? UI_SYMBOLS.CURRENT : " ";

        return (
          <Text key={item.id}>
            <Text color={isFocused ? CLI_COLORS.PRIMARY : undefined}>{pointer}</Text>
            <Text color={isSelected || isFocused ? CLI_COLORS.PRIMARY : undefined} bold={isFocused}>
              {" "}
              {checkbox} {item.label}
            </Text>
            <Text dimColor> - {item.description}</Text>
          </Text>
        );
      })}
      <Text
        color={focusedIndex === continueIndex ? CLI_COLORS.PRIMARY : undefined}
        bold={focusedIndex === continueIndex}
      >
        {focusedIndex === continueIndex ? UI_SYMBOLS.CURRENT : " "} {"\u2192"}{" "}
        {continueLabel(selectedIds.length)}
      </Text>
      {selectedIds.length > 0 ? (
        <Text>
          {"\n"}Selected: <Text color={CLI_COLORS.PRIMARY}>{selectedIds.join(", ")}</Text>
        </Text>
      ) : emptyMessage ? (
        <Text dimColor>
          {"\n"}
          {emptyMessage}
        </Text>
      ) : null}
      <Text dimColor>
        {"\n"}
        {"\u2191"}/{"\u2193"} navigate SPACE toggle ENTER continue ESC back
      </Text>
    </Box>
  );
};
