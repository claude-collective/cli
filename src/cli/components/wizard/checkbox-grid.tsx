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

const CONTINUE_VALUE = "_continue";

type ListItem<T extends string> = { type: "item"; item: CheckboxItem<T> } | { type: "continue" };

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
  const [focusedIndex, setFocusedIndex] = useState(0);

  const listItems: ListItem<T>[] = [
    ...items.map((item) => ({ type: "item" as const, item })),
    ...(selectedIds.length > 0 ? [{ type: "continue" as const }] : []),
  ];

  const totalItems = listItems.length;

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
      if (selectedIds.length > 0) {
        onContinue();
      }
      return;
    }

    if (input === " ") {
      const focusedItem = listItems[focusedIndex];
      if (!focusedItem) return;

      if (focusedItem.type === "item") {
        onToggle(focusedItem.item.id);
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      <Text dimColor>{subtitle}</Text>
      <Box flexDirection="column" marginTop={1}>
        {listItems.map((listItem, index) => {
          const isFocused = index === focusedIndex;

          if (listItem.type === "continue") {
            return (
              <Box key={CONTINUE_VALUE} columnGap={1}>
                <Text color={isFocused ? CLI_COLORS.PRIMARY : undefined}>
                  {isFocused ? UI_SYMBOLS.CURRENT : " "}
                </Text>
                <Text bold={isFocused} color={isFocused ? CLI_COLORS.PRIMARY : undefined}>
                  {"\u2192"} {continueLabel(selectedIds.length)}
                </Text>
              </Box>
            );
          }

          const isSelected = selectedIds.includes(listItem.item.id);
          const checkbox = isSelected ? "[\u2713]" : "[ ]";

          return (
            <Box key={listItem.item.id} columnGap={1}>
              <Text color={isFocused ? CLI_COLORS.PRIMARY : undefined}>
                {isFocused ? UI_SYMBOLS.CURRENT : " "}
              </Text>
              <Text
                bold={isFocused}
                color={isSelected || isFocused ? CLI_COLORS.PRIMARY : undefined}
              >
                {checkbox}
              </Text>
              <Text bold={isFocused} color={isFocused ? CLI_COLORS.PRIMARY : undefined}>
                {listItem.item.label}
              </Text>
              <Text dimColor>- {listItem.item.description}</Text>
            </Box>
          );
        })}
      </Box>
      {selectedIds.length > 0 ? (
        <Box marginTop={1}>
          <Text>
            Selected: <Text color={CLI_COLORS.PRIMARY}>{selectedIds.join(", ")}</Text>
          </Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color={CLI_COLORS.WARNING}>{emptyMessage}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          {"\u2191"}/{"\u2193"} navigate SPACE toggle ENTER continue ESC back
        </Text>
      </Box>
    </Box>
  );
};
