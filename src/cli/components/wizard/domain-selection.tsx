import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { Domain } from "../../types/index.js";
import { CLI_COLORS } from "../../consts.js";

const BACK_VALUE = "_back";
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

export const DomainSelection: React.FC = () => {
  const { selectedDomains, toggleDomain, setStep, goBack } = useWizardStore();

  const domainOptions = AVAILABLE_DOMAINS.map((domain) => {
    const isSelected = selectedDomains.includes(domain.id);
    const checkbox = isSelected ? "[\u2713]" : "[ ]";
    return {
      value: domain.id,
      label: `${checkbox} ${domain.label} - ${domain.description}`,
    };
  });

  const options = [
    { value: BACK_VALUE, label: "\u2190 Back" },
    ...domainOptions,
    ...(selectedDomains.length > 0
      ? [
          {
            value: CONTINUE_VALUE,
            label: `\u2192 Continue with ${selectedDomains.length} domain(s)`,
          },
        ]
      : []),
  ];

  const handleSelect = (value: string) => {
    if (value === BACK_VALUE) {
      goBack();
      return;
    }

    if (value === CONTINUE_VALUE) {
      if (selectedDomains.length > 0) {
        setStep("build");
      }
      return;
    }

    // Toggle domain selection (value comes from Select UI component - data boundary)
    toggleDomain(value as Domain);
  };

  return (
    <Box flexDirection="column">
      <Text bold>Select domains to configure:</Text>
      <Text dimColor>Select one or more domains, then continue</Text>
      <Box marginTop={1}>
        <Select options={options} onChange={handleSelect} />
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
          {"\u2191"}/{"\u2193"} navigate ENTER toggle/select ESC back
        </Text>
      </Box>
    </Box>
  );
};
