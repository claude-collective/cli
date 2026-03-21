import { Box, Text, useInput } from "ink";
import React, { useMemo, useState } from "react";
import { CLI_COLORS, DEFAULT_SCRATCH_DOMAINS, UI_SYMBOLS } from "../../consts.js";
import { matrix } from "../../lib/matrix/matrix-provider.js";
import { useWizardStore } from "../../stores/wizard-store.js";
import { useMeasuredHeight } from "../hooks/use-measured-height.js";
import { useRowScroll } from "../hooks/use-row-scroll.js";

import type { SkillId } from "../../types/index.js";

type StackItem = { id: string; name: string; description: string };
type StackGroup = { label: string; items: StackItem[] };
type FocusId = string | "scratch";

const REACT_FRAMEWORK_ID = "web-framework-react";
const SCRATCH_LABEL = "Start from scratch";
const SCRATCH_DESCRIPTION = "Select domains and skills manually";

function groupStacks(
  stacks: { id: string; name: string; description: string; allSkillIds: SkillId[] }[],
): StackGroup[] {
  const reactItems: StackItem[] = [];
  const otherItems: StackItem[] = [];

  for (const stack of stacks) {
    const isReact = stack.allSkillIds.some((id) => id.startsWith(REACT_FRAMEWORK_ID));
    const item: StackItem = { id: stack.id, name: stack.name, description: stack.description };
    if (isReact) {
      reactItems.push(item);
    } else {
      otherItems.push(item);
    }
  }

  const groups: StackGroup[] = [];
  if (reactItems.length > 0) {
    groups.push({ label: "React", items: reactItems });
  }
  if (otherItems.length > 0) {
    groups.push({ label: "Other Frameworks", items: otherItems });
  }
  return groups;
}

function buildFocusableIds(groups: StackGroup[]): FocusId[] {
  return [...groups.flatMap((g) => g.items.map((i) => i.id)), "scratch"];
}

/** Renders a section header + stack items. Focus state is managed by the parent. */
const StackSection: React.FC<{
  title: string;
  items: StackItem[];
  focusedId: FocusId;
}> = ({ title, items, focusedId }) => (
  <Box flexDirection="column">
    <Box flexShrink={0}>
      <Text dimColor bold>
        {"  "}
        {title}
      </Text>
    </Box>
    {items.map((item) => {
      const isFocused = item.id === focusedId;
      const pointer = isFocused ? UI_SYMBOLS.CHEVRON : UI_SYMBOLS.CHEVRON_SPACER;
      return (
        <Box key={item.id} flexShrink={0}>
          <Text>
            <Text color={isFocused ? CLI_COLORS.PRIMARY : undefined}>{pointer}</Text>
            <Text color={isFocused ? CLI_COLORS.PRIMARY : undefined} bold={isFocused}>
              {" "}
              {item.name}
            </Text>
            <Text dimColor>
              {"  "}
              {item.description}
            </Text>
          </Text>
        </Box>
      );
    })}
  </Box>
);

export type StackSelectionProps = {
  /** Available height in terminal lines for the scrollable viewport. 0 = no constraint. */
  availableHeight?: number;
  onCancel?: () => void;
};

export const StackSelection: React.FC<StackSelectionProps> = ({ onCancel }) => {
  const { selectStack, setApproach, setStackAction, populateFromSkillIds, toggleDomain, setStep } =
    useWizardStore();

  const stacks = matrix.suggestedStacks;
  const groups = useMemo(() => groupStacks(stacks), [stacks]);
  const focusableIds = useMemo(() => buildFocusableIds(groups), [groups]);

  const [focusedId, setFocusedId] = useState<FocusId>(focusableIds[0] ?? "scratch");
  const { ref: listRef, measuredHeight: listHeight } = useMeasuredHeight();

  // Compute visual row counts for scroll: header + items per group, spacers between groups, spacer + scratch row
  const totalRowCount = useMemo(() => {
    const groupRows = groups.reduce(
      (sum, g, i) =>
        sum + 1 /* header */ + g.items.length + (i > 0 ? 1 : 0) /* spacer between groups */,
      0,
    );
    return groupRows + 1 /* spacer before scratch */ + 1 /* scratch row */;
  }, [groups]);

  // Map focusedId to a visual row index for scrolling
  const focusedVisualRow = useMemo(() => {
    let row = 0;
    for (let gi = 0; gi < groups.length; gi++) {
      if (gi > 0) row++; // spacer between groups
      row++; // header
      for (const item of groups[gi].items) {
        if (item.id === focusedId) return row;
        row++;
      }
    }
    row++; // spacer before scratch
    return row; // scratch row
  }, [groups, focusedId]);

  const { scrollEnabled, scrollTop } = useRowScroll({
    focusedIndex: focusedVisualRow,
    itemCount: totalRowCount,
    availableHeight: listHeight,
  });

  useInput((input, key) => {
    if (key.escape) {
      if (onCancel) {
        onCancel();
      }
      return;
    }

    const currentIdx = focusableIds.indexOf(focusedId);

    if (key.upArrow || input === "k") {
      const nextIdx = currentIdx <= 0 ? focusableIds.length - 1 : currentIdx - 1;
      setFocusedId(focusableIds[nextIdx]!);
      return;
    }
    if (key.downArrow || input === "j") {
      const nextIdx = currentIdx >= focusableIds.length - 1 ? 0 : currentIdx + 1;
      setFocusedId(focusableIds[nextIdx]!);
      return;
    }

    if (key.return) {
      if (focusedId === "scratch") {
        selectStack(null);
        setApproach("scratch");
        for (const domain of DEFAULT_SCRATCH_DOMAINS) {
          toggleDomain(domain);
        }
        setStep("domains");
        return;
      }
      const focusedStack = stacks.find((s) => s.id === focusedId);
      if (focusedStack) {
        selectStack(focusedStack.id);
        setStackAction("customize");
        populateFromSkillIds(focusedStack.allSkillIds);
        setApproach("stack");
        setStep("domains");
      }
    }
  });

  const isScratchFocused = focusedId === "scratch";
  const scratchPointer = isScratchFocused ? UI_SYMBOLS.CHEVRON : UI_SYMBOLS.CHEVRON_SPACER;

  return (
    <Box ref={listRef} flexDirection="column" flexGrow={1} flexBasis={0}>
      <Box
        flexDirection="column"
        flexGrow={1}
        {...(scrollEnabled && { overflow: "hidden" as const })}
      >
        <Box
          flexDirection="column"
          marginTop={scrollTop > 0 ? -scrollTop : 0}
          {...(scrollEnabled && { flexShrink: 0 })}
        >
          {groups.map((group, gi) => (
            <React.Fragment key={group.label}>
              {gi > 0 && (
                <Box flexShrink={0}>
                  <Text> </Text>
                </Box>
              )}
              <StackSection title={group.label} items={group.items} focusedId={focusedId} />
            </React.Fragment>
          ))}

          <Box key="scratch-spacer" flexShrink={0}>
            <Text> </Text>
          </Box>
          <Box key="scratch" flexShrink={0}>
            <Text>
              <Text color={isScratchFocused ? CLI_COLORS.PRIMARY : undefined}>
                {scratchPointer}
              </Text>
              <Text
                color={isScratchFocused ? CLI_COLORS.PRIMARY : undefined}
                bold={isScratchFocused}
              >
                {" "}
                {SCRATCH_LABEL}
              </Text>
              <Text dimColor>
                {"  "}
                {SCRATCH_DESCRIPTION}
              </Text>
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
