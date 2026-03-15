import { Box, Text } from "ink";
import React from "react";
import { CLI_COLORS } from "../../consts.js";
import type { WizardStep } from "../../stores/wizard-store.js";
import {
  HOTKEY_HELP,
  HOTKEY_SCOPE,
  HOTKEY_SETTINGS,
  HOTKEY_TOGGLE_LABELS,
  KEY_LABEL_ENTER,
  KEY_LABEL_ESC,
  KEY_LABEL_SPACE,
  KEY_LABEL_TAB,
  KEY_LABEL_VIM,
} from "./hotkeys.js";

type HelpSection = {
  title: string;
  keys: { key: string; description: string }[];
};

const GLOBAL_KEYS: HelpSection = {
  title: "Navigation",
  keys: [
    { key: "Arrow keys", description: "Move focus" },
    { key: KEY_LABEL_SPACE, description: "Toggle selection" },
    { key: KEY_LABEL_ENTER, description: "Confirm / continue" },
    { key: KEY_LABEL_ESC, description: "Go back" },
    { key: KEY_LABEL_TAB, description: "Jump to next section" },
  ],
};

const GLOBAL_TOGGLES: HelpSection = {
  title: "Toggles",
  keys: [{ key: HOTKEY_HELP.label, description: "Toggle this help" }],
};

const BUILD_KEYS: HelpSection = {
  title: "Skills Step",
  keys: [
    { key: HOTKEY_TOGGLE_LABELS.label, description: "Toggle compatibility labels" },
    { key: HOTKEY_SCOPE.label, description: "Toggle skill scope (project/global)" },
    { key: KEY_LABEL_VIM, description: "Vim-style navigation" },
  ],
};

const SOURCES_KEYS: HelpSection = {
  title: "Sources Step",
  keys: [{ key: HOTKEY_SETTINGS.label, description: "Toggle source settings" }],
};

const AGENTS_KEYS: HelpSection = {
  title: "Agents Step",
  keys: [{ key: HOTKEY_SCOPE.label, description: "Toggle agent scope (project/global)" }],
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
  <Box flexDirection="column" marginTop={1} marginBottom={1}>
    <Text bold>{section.title}</Text>
    {section.keys.map(({ key, description }) => (
      <Box key={key} marginTop={1}>
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

      <Text dimColor>
        Press {KEY_LABEL_ESC} or {HOTKEY_HELP.label} to close
      </Text>
    </Box>
  );
};
