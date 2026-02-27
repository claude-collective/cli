import { Box, Static, Text } from "ink";
import React, { Fragment } from "react";
import { CLI_COLORS, DEFAULT_PLUGIN_NAME } from "../../consts.js";
import type { StartupMessage } from "../../utils/logger.js";
import { useWizardStore } from "../../stores/wizard-store.js";
import { useTerminalDimensions } from "../hooks/use-terminal-dimensions.js";
import { HelpModal } from "./help-modal.js";
import { WIZARD_STEPS, WizardTabs } from "./wizard-tabs.js";

type KeyHintProps = {
  isVisible?: boolean;
  isActive?: boolean;
  label: string;
  values: string[];
};

const DefinitionItem: React.FC<KeyHintProps> = ({
  isVisible = true,
  isActive = false,
  label,
  values,
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <Text>
      {values.map((value) => (
        <Fragment key={value}>
          <Text
            backgroundColor="black"
            color={isActive ? CLI_COLORS.PRIMARY : CLI_COLORS.UNFOCUSED}
          >
            {" "}
            {value}{" "}
          </Text>{" "}
        </Fragment>
      ))}
      <Text color={isActive ? CLI_COLORS.PRIMARY : undefined}>{label}</Text>
    </Text>
  );
};

const HOT_KEYS: { label: string; values: string[] }[] = [
  { label: "navigate", values: ["\u2190/\u2192", "\u2191/\u2193"] },
  { label: "select", values: ["SPACE"] },
  { label: "continue", values: ["ENTER"] },
  { label: "back", values: ["ESC"] },
];

const WizardFooter = () => {
  const store = useWizardStore();

  return (
    <Box
      columnGap={2}
      borderTop
      borderRight={false}
      borderBottom
      borderLeft={false}
      borderColor="blackBright"
      borderStyle="single"
      paddingLeft={1}
      paddingRight={1}
    >
      <DefinitionItem
        label="Accept defaults"
        values={["A"]}
        isVisible={store.step === "build" && !!store.selectedStackId}
      />
      {HOT_KEYS.map((hotkey) => (
        <DefinitionItem {...hotkey} key={hotkey.label} />
      ))}
    </Box>
  );
};

type WizardLayoutProps = {
  version?: string;
  marketplaceLabel?: string;
  logo?: string;
  startupMessages?: StartupMessage[];
  children: React.ReactNode;
};

export const WizardLayout: React.FC<WizardLayoutProps> = ({
  version,
  marketplaceLabel,
  logo,
  startupMessages,
  children,
}) => {
  const store = useWizardStore();
  const { completedSteps, skippedSteps } = store.getStepProgress();
  const { rows: terminalHeight } = useTerminalDimensions();

  return (
    <>
      {startupMessages && startupMessages.length > 0 && (
        <Static items={startupMessages}>
          {(msg, index) => (
            <Box key={index}>
              <Text
                color={msg.level === "warn" ? "yellow" : msg.level === "error" ? "red" : undefined}
              >
                {msg.level === "warn" ? `  Warning: ${msg.text}` : msg.text}
              </Text>
            </Box>
          )}
        </Static>
      )}
      <Box flexDirection="column" paddingX={1} height={terminalHeight}>
        {logo && (
          <Box flexDirection="row" marginTop={1} columnGap={1}>
            <Text>{logo}</Text>
          </Box>
        )}
        <Box>
          <Text dimColor>Marketplace: </Text>
          <Text bold>{marketplaceLabel || `${DEFAULT_PLUGIN_NAME} (public)`}</Text>
        </Box>
        <WizardTabs
          steps={WIZARD_STEPS}
          currentStep={store.step}
          completedSteps={completedSteps}
          skippedSteps={skippedSteps}
          version={version}
        />
        {store.showHelp ? (
          <HelpModal currentStep={store.step} />
        ) : (
          <>
            <Box flexDirection="column" flexGrow={1} flexBasis={0} marginTop={1}>
              {children}
            </Box>
            <Box paddingX={1} columnGap={2} marginTop={2}>
              <DefinitionItem
                label="Labels"
                values={["D"]}
                isVisible={store.step === "build"}
                isActive={store.showLabels}
              />
              <DefinitionItem
                label="Plugin mode"
                values={["P"]}
                isActive={store.installMode === "plugin"}
              />
              <DefinitionItem
                label="Global"
                values={["G"]}
                isActive={store.installScope === "global"}
              />
              <DefinitionItem
                label="Settings"
                values={["S"]}
                isVisible={store.step === "sources"}
                isActive={store.showSettings}
              />
              <DefinitionItem label="Help" values={["?"]} />
            </Box>
            <WizardFooter />
          </>
        )}
      </Box>
    </>
  );
};
