import React, { Fragment } from "react";
import { Box, Text } from "ink";
import { useWizardStore } from "../../stores/wizard-store.js";
import { CLI_COLORS } from "../../consts.js";
import { WizardTabs, WIZARD_STEPS } from "./wizard-tabs.js";
import { HelpModal } from "./help-modal.js";

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
          <Text backgroundColor="black" color={CLI_COLORS.UNFOCUSED}>
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
  brandingName?: string;
  /** Terminal height in rows, used to constrain the layout for flexGrow measurement */
  terminalHeight: number;
  children: React.ReactNode;
};

export const WizardLayout: React.FC<WizardLayoutProps> = ({
  version,
  marketplaceLabel,
  brandingName,
  terminalHeight,
  children,
}) => {
  const store = useWizardStore();
  const { completedSteps, skippedSteps } = store.getStepProgress();

  // Constrain height only during the build step so flexGrow-based measurement
  // can determine the grid area. Other steps grow to fit their content.
  const constrainedHeight = store.step === "build" ? terminalHeight : undefined;

  return (
    <Box flexDirection="column" paddingX={1} height={constrainedHeight}>
      <WizardTabs
        steps={WIZARD_STEPS}
        currentStep={store.step}
        completedSteps={completedSteps}
        skippedSteps={skippedSteps}
        version={version}
        brandingName={brandingName}
      />
      {marketplaceLabel && (
        <Box paddingLeft={1} marginTop={1}>
          <Text dimColor>Marketplace: </Text>
          <Text bold>{marketplaceLabel}</Text>
        </Box>
      )}
      {store.showHelp ? (
        <HelpModal currentStep={store.step} />
      ) : (
        <>
          <Box flexGrow={1} marginTop={1}>
            {children}
          </Box>
          <Box paddingX={1} columnGap={2} marginTop={2}>
            <DefinitionItem label="Expert mode" values={["E"]} isActive={store.expertMode} />
            <DefinitionItem
              label="Descriptions"
              values={["D"]}
              isVisible={store.step === "build"}
              isActive={store.showDescriptions}
            />
            <DefinitionItem
              label="Plugin mode"
              values={["P"]}
              isActive={store.installMode === "plugin"}
            />
            <DefinitionItem
              label="Settings"
              values={["G"]}
              isVisible={store.step === "sources"}
              isActive={store.showSettings}
            />
            <DefinitionItem label="Help" values={["?"]} />
          </Box>
          <WizardFooter />
        </>
      )}
    </Box>
  );
};
