import { Box, useInput } from "ink";
import React, { useState } from "react";
import { DEFAULT_SCRATCH_DOMAINS } from "../../consts.js";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { MergedSkillsMatrix } from "../../types/index.js";
import { SelectionCard } from "./selection-card.js";
import { getDomainsFromStack } from "./utils.js";
import { ViewTitle } from "./view-title.js";

const INITIAL_FOCUSED_INDEX = 0;
const SCRATCH_LABEL = "Start from scratch";
const SCRATCH_DESCRIPTION = "Select domains and skills manually";

/** Number of extra items after the stack list (scratch option) */
const EXTRA_ITEMS_COUNT = 1;

export type StackSelectionProps = {
  matrix: MergedSkillsMatrix;
  onCancel?: () => void;
};

export const StackSelection: React.FC<StackSelectionProps> = ({ matrix, onCancel }) => {
  const { selectStack, setApproach, setStackAction, populateFromSkillIds, toggleDomain } =
    useWizardStore();
  const [focusedIndex, setFocusedIndex] = useState(INITIAL_FOCUSED_INDEX);

  const stacks = matrix.suggestedStacks;
  const stackCount = stacks.length;
  const scratchIndex = stackCount;
  const totalItems = stackCount + EXTRA_ITEMS_COUNT;

  useInput((input, key) => {
    if (key.escape) {
      if (onCancel) {
        onCancel();
      }
      return;
    }

    if (key.return) {
      if (focusedIndex === scratchIndex) {
        selectStack(null);
        setApproach("scratch");

        for (const domain of DEFAULT_SCRATCH_DOMAINS) {
          toggleDomain(domain);
        }
        return;
      }

      const focusedStack = stacks[focusedIndex];
      if (focusedStack) {
        selectStack(focusedStack.id);
        setStackAction("customize");
        populateFromSkillIds(focusedStack.allSkillIds, matrix.skills, matrix.categories);

        const stackDomains = getDomainsFromStack(focusedStack, matrix.categories);
        for (const domain of stackDomains) {
          toggleDomain(domain);
        }

        setApproach("stack");
      }
      return;
    }

    if (key.upArrow || input === "k") {
      setFocusedIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow || input === "j") {
      setFocusedIndex((prev) => Math.min(totalItems - 1, prev + 1));
    }
  });

  return (
    <Box flexDirection="column">
      <ViewTitle>Choose a stack</ViewTitle>
      <Box flexDirection="column">
        {stacks.map((stack, index) => (
          <SelectionCard
            key={stack.id}
            label={stack.name}
            description={stack.description}
            isFocused={index === focusedIndex}
            marginBottom={1}
          />
        ))}
        <SelectionCard
          label={SCRATCH_LABEL}
          description={SCRATCH_DESCRIPTION}
          isFocused={focusedIndex === scratchIndex}
        />
      </Box>
    </Box>
  );
};
