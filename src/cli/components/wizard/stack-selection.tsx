import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { MergedSkillsMatrix } from "../../types/index.js";
import { MenuItem } from "./menu-item.js";
import { ViewTitle } from "./view-title.js";

const INITIAL_FOCUSED_INDEX = 0;

export type StackSelectionProps = {
  matrix: MergedSkillsMatrix;
};

export const StackSelection: React.FC<StackSelectionProps> = ({ matrix }) => {
  const { selectStack, setStep, setStackAction, populateFromSkillIds, goBack } = useWizardStore();
  const [focusedIndex, setFocusedIndex] = useState(INITIAL_FOCUSED_INDEX);

  const stacks = matrix.suggestedStacks;
  const stackCount = stacks.length;

  useInput((input, key) => {
    if (key.escape) {
      goBack();
      return;
    }

    if (key.return && stackCount > 0) {
      const focusedStack = stacks[focusedIndex];
      if (focusedStack) {
        selectStack(focusedStack.id);
        setStackAction("customize");

        const resolvedStack = matrix.suggestedStacks.find((s) => s.id === focusedStack.id);
        if (resolvedStack) {
          populateFromSkillIds(resolvedStack.allSkillIds, matrix.skills, matrix.categories);
        }

        setStep("build");
      }
      return;
    }

    if (key.upArrow || input === "k") {
      setFocusedIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow || input === "j") {
      setFocusedIndex((prev) => Math.min(stackCount - 1, prev + 1));
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <ViewTitle>Select a stack</ViewTitle>
      <Box flexDirection="column" marginTop={1}>
        {stacks.map((stack, index) => (
          <MenuItem
            key={stack.id}
            label={stack.name}
            description={stack.description}
            isFocused={index === focusedIndex}
          />
        ))}
      </Box>
      {stackCount > 0 && (
        <Box marginTop={1}>
          <Text dimColor>
            {"\u2191"}/{"\u2193"} navigate  ENTER select  ESC back
          </Text>
        </Box>
      )}
    </Box>
  );
};
