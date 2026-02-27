import { Box, useInput } from "ink";
import React, { useState } from "react";
import { DEFAULT_SCRATCH_DOMAINS } from "../../consts.js";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { MergedSkillsMatrix } from "../../types/index.js";
import { useSectionScroll } from "../hooks/use-section-scroll.js";
import { SelectionCard } from "./selection-card.js";

const INITIAL_FOCUSED_INDEX = 0;
const SCRATCH_LABEL = "Start from scratch";
const SCRATCH_DESCRIPTION = "Select domains and skills manually";

/** Number of extra items after the stack list (scratch option) */
const EXTRA_ITEMS_COUNT = 1;

export type StackSelectionProps = {
  matrix: MergedSkillsMatrix;
  /** Available height in terminal lines for the scrollable viewport. 0 = no constraint. */
  availableHeight?: number;
  onCancel?: () => void;
};

export const StackSelection: React.FC<StackSelectionProps> = ({
  matrix,
  availableHeight = 0,
  onCancel,
}) => {
  const { selectStack, setApproach, setStackAction, populateFromSkillIds, toggleDomain } =
    useWizardStore();

  const [focusedIndex, setFocusedIndex] = useState(INITIAL_FOCUSED_INDEX);

  const stacks = matrix.suggestedStacks;
  const stackCount = stacks.length;
  const scratchIndex = stackCount;
  const totalItems = stackCount + EXTRA_ITEMS_COUNT;

  const { setSectionRef, scrollEnabled, scrollTopPx } = useSectionScroll({
    sectionCount: totalItems,
    focusedIndex,
    availableHeight,
  });

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

  const noShrink = scrollEnabled ? { flexShrink: 0 } : {};

  const sectionElements = stacks.map((stack, index) => (
    <Box key={stack.id} ref={(el) => setSectionRef(index, el)} width="100%" {...noShrink}>
      <SelectionCard
        label={stack.name}
        description={stack.description}
        isFocused={index === focusedIndex}
        marginBottom={1}
      />
    </Box>
  ));

  const scratchElement = (
    <Box ref={(el) => setSectionRef(scratchIndex, el)} width="100%" {...noShrink}>
      <SelectionCard
        label={SCRATCH_LABEL}
        description={SCRATCH_DESCRIPTION}
        isFocused={focusedIndex === scratchIndex}
      />
    </Box>
  );

  return (
    <Box
      flexDirection="column"
      width="100%"
      {...(scrollEnabled
        ? { height: availableHeight, overflow: "hidden" as const }
        : { flexGrow: 1 })}
    >
      <Box flexDirection="column" marginTop={scrollTopPx > 0 ? -scrollTopPx : 0} {...noShrink}>
        {sectionElements}
        {scratchElement}
      </Box>
    </Box>
  );
};
