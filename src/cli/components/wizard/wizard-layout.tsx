import React, { Fragment, useMemo } from "react";
import { Box, Text } from "ink";
import { useWizardStore } from "../../stores/wizard-store.js";
import { WizardTabs, WIZARD_STEPS } from "./wizard-tabs.js";

type KeyHintProps = {
  isVisible?: boolean;
  isActive?: boolean;
  label: string;
  values: string[];
};

export const DefinitionItem: React.FC<KeyHintProps> = ({
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
          <Text backgroundColor="black" color="white">
            {" "}
            {value}{" "}
          </Text>{" "}
        </Fragment>
      ))}
      <Text color={isActive ? "cyan" : undefined}>{label}</Text>
    </Text>
  );
};

const HOT_KEYS: { label: string; values: string[] }[] = [
  { label: "navigate", values: ["\u2190/\u2192", "\u2191/\u2193"] },
  { label: "select", values: ["SPACE"] },
  { label: "continue", values: ["ENTER"] },
  { label: "back", values: ["ESC"] },
];

export const WizardFooter = () => {
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
  children: React.ReactNode;
};

export const WizardLayout: React.FC<WizardLayoutProps> = ({ version, children }) => {
  const store = useWizardStore();

  const { completedSteps, skippedSteps } = useMemo(() => {
    const completed: string[] = [];
    const skipped: string[] = [];

    if (store.step !== "approach") {
      completed.push("approach");
    }

    if (store.step !== "approach" && store.step !== "stack") {
      completed.push("stack");
    }

    // Stack path with defaults skips build and sources
    if (store.approach === "stack" && store.selectedStackId && store.stackAction === "defaults") {
      skipped.push("build");
      skipped.push("sources");
    } else if (store.step === "confirm") {
      completed.push("build");
      completed.push("sources");
    } else if (store.step === "sources") {
      completed.push("build");
    }

    return { completedSteps: completed, skippedSteps: skipped };
  }, [store.step, store.approach, store.selectedStackId, store.stackAction]);

  return (
    <Box flexDirection="column" paddingX={1}>
      <WizardTabs
        steps={WIZARD_STEPS}
        currentStep={store.step}
        completedSteps={completedSteps}
        skippedSteps={skippedSteps}
        version={version}
      />
      <Box marginTop={1}>{children}</Box>
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
      </Box>
      <WizardFooter />
    </Box>
  );
};
