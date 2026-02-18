import React from "react";
import { Box, Text } from "ink";
import { CLI_COLORS } from "../../consts.js";
import type { WizardStep } from "../../stores/wizard-store.js";

type HelpSection = {
  title: string;
  keys: { key: string; description: string }[];
};

const GLOBAL_KEYS: HelpSection = {
  title: "Navigation",
  keys: [
    { key: "Arrow keys", description: "Move focus" },
    { key: "SPACE", description: "Toggle selection" },
    { key: "ENTER", description: "Confirm / continue" },
    { key: "ESC", description: "Go back" },
    { key: "TAB", description: "Jump to next section" },
  ],
};

const GLOBAL_TOGGLES: HelpSection = {
  title: "Global Toggles",
  keys: [
    { key: "E", description: "Toggle expert mode" },
    { key: "P", description: "Toggle plugin/local install mode" },
    { key: "?", description: "Toggle this help" },
  ],
};

const BUILD_KEYS: HelpSection = {
  title: "Build Step",
  keys: [
    { key: "D", description: "Toggle compatibility labels" },
    { key: "A", description: "Accept stack defaults (stack path only)" },
    { key: "h/j/k/l", description: "Vim-style navigation" },
  ],
};

const SOURCES_KEYS: HelpSection = {
  title: "Sources Step",
  keys: [{ key: "G", description: "Toggle source settings" }],
};

const AGENTS_KEYS: HelpSection = {
  title: "Agents Step",
  keys: [],
};

const STEP_SECTIONS: Partial<Record<WizardStep, HelpSection>> = {
  build: BUILD_KEYS,
  sources: SOURCES_KEYS,
  agents: AGENTS_KEYS,
};

const KEY_COLUMN_WIDTH = 14;

type HelpSectionViewProps = {
  section: HelpSection;
};

const HelpSectionView: React.FC<HelpSectionViewProps> = ({ section }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Text bold underline>
      {section.title}
    </Text>
    {section.keys.map(({ key, description }) => (
      <Box key={key}>
        <Box width={KEY_COLUMN_WIDTH}>
          <Text backgroundColor="black" color={CLI_COLORS.UNFOCUSED}>
            {" "}
            {key}{" "}
          </Text>
        </Box>
        <Text>{description}</Text>
      </Box>
    ))}
  </Box>
);

export type HelpModalProps = {
  currentStep: WizardStep;
};

export const HelpModal: React.FC<HelpModalProps> = ({ currentStep }) => {
  const stepSection = STEP_SECTIONS[currentStep];

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={CLI_COLORS.PRIMARY}
      paddingX={2}
      paddingY={1}
      marginTop={1}
    >
      <Text bold color={CLI_COLORS.PRIMARY}>
        Keyboard Shortcuts
      </Text>
      <Text> </Text>

      <HelpSectionView section={GLOBAL_KEYS} />
      <HelpSectionView section={GLOBAL_TOGGLES} />
      {stepSection && <HelpSectionView section={stepSection} />}

      <Text dimColor>Press ESC or ? to close</Text>
    </Box>
  );
};
