import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { Domain } from "../../types/index.js";
import { CLI_COLORS, UI_SYMBOLS } from "../../consts.js";

const CONTINUE_VALUE = "_continue";

const AVAILABLE_DOMAINS: Array<{ id: Domain; label: string; description: string }> = [
  { id: "web", label: "Web", description: "Frontend web applications" },
  {
    id: "web-extras",
    label: "Web Extras",
    description: "Animation, files, realtime, PWA, accessibility",
  },
  { id: "api", label: "API", description: "Backend APIs and services" },
  { id: "cli", label: "CLI", description: "Command-line tools" },
  { id: "mobile", label: "Mobile", description: "Mobile applications" },
];

type ListItem =
  | { type: "domain"; domain: (typeof AVAILABLE_DOMAINS)[number] }
  | { type: "continue" };

export const DomainSelection: React.FC = () => {
  const { selectedDomains, toggleDomain, setStep, setApproach, selectStack } = useWizardStore();
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleBack = () => {
    setApproach(null);
    selectStack(null);
  };

  const items: ListItem[] = [
    ...AVAILABLE_DOMAINS.map((domain) => ({ type: "domain" as const, domain })),
    ...(selectedDomains.length > 0 ? [{ type: "continue" as const }] : []),
  ];

  const totalItems = items.length;

  useInput((input, key) => {
    if (key.escape) {
      handleBack();
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

    // ENTER: continue if domains selected
    if (key.return) {
      if (selectedDomains.length > 0) {
        setStep("build");
      }
      return;
    }

    // SPACE: toggle domain selection
    if (input === " ") {
      const focusedItem = items[focusedIndex];
      if (!focusedItem) return;

      if (focusedItem.type === "domain") {
        toggleDomain(focusedItem.domain.id);
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Select domains to configure:</Text>
      <Text dimColor>Select one or more domains, then continue</Text>
      <Box flexDirection="column" marginTop={1}>
        {items.map((item, index) => {
          const isFocused = index === focusedIndex;

          if (item.type === "continue") {
            return (
              <Box key={CONTINUE_VALUE} columnGap={1}>
                <Text color={isFocused ? CLI_COLORS.PRIMARY : undefined}>
                  {isFocused ? UI_SYMBOLS.CURRENT : " "}
                </Text>
                <Text bold={isFocused} color={isFocused ? CLI_COLORS.PRIMARY : undefined}>
                  {"\u2192"} Continue with {selectedDomains.length} domain(s)
                </Text>
              </Box>
            );
          }

          const isSelected = selectedDomains.includes(item.domain.id);
          const checkbox = isSelected ? "[\u2713]" : "[ ]";

          return (
            <Box key={item.domain.id} columnGap={1}>
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
                {item.domain.label}
              </Text>
              <Text dimColor>- {item.domain.description}</Text>
            </Box>
          );
        })}
      </Box>
      {selectedDomains.length > 0 ? (
        <Box marginTop={1}>
          <Text>
            Selected: <Text color={CLI_COLORS.PRIMARY}>{selectedDomains.join(", ")}</Text>
          </Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color={CLI_COLORS.WARNING}>Please select at least one domain</Text>
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
