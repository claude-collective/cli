import React, { useCallback } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { ThemeProvider } from "@inkjs/ui";
import { useWizardStore, type WizardStep } from "../../stores/wizard-store.js";
import { CLI_COLORS } from "../../consts.js";
import { cliTheme } from "../themes/default.js";
import { WizardLayout } from "./wizard-layout.js";
import { StepApproach } from "./step-approach.js";
import { StepStack } from "./step-stack.js";
import { StepBuild } from "./step-build.js";
import { StepConfirm } from "./step-confirm.js";
import { StepSources } from "./step-sources.js";
import { StepSettings } from "./step-settings.js";
import { resolveAlias, validateSelection } from "../../lib/matrix/index.js";
import type { DomainSelections, MergedSkillsMatrix, SkillId } from "../../types/index.js";
import { getStackName } from "./utils.js";
import { warn } from "../../utils/logger.js";
import { useWizardInitialization } from "../hooks/use-wizard-initialization.js";
import { useBuildStepProps } from "../hooks/use-build-step-props.js";

export type WizardResultV2 = {
  selectedSkills: SkillId[];
  selectedStackId: string | null;
  domainSelections: DomainSelections;
  sourceSelections: Partial<Record<SkillId, string>>;
  expertMode: boolean;
  installMode: "plugin" | "local";
  cancelled: boolean;
  validation: {
    valid: boolean;
    errors: Array<{ message: string }>;
    warnings: Array<{ message: string }>;
  };
};

type WizardProps = {
  matrix: MergedSkillsMatrix;
  onComplete: (result: WizardResultV2) => void;
  onCancel: () => void;
  version?: string;
  marketplaceLabel?: string;
  initialStep?: WizardStep;
  initialInstallMode?: "plugin" | "local";
  installedSkillIds?: SkillId[];
  projectDir?: string;
};

const MIN_TERMINAL_WIDTH = 80;

export const Wizard: React.FC<WizardProps> = ({
  matrix,
  onComplete,
  onCancel,
  version,
  marketplaceLabel,
  initialStep,
  initialInstallMode,
  installedSkillIds,
  projectDir,
}) => {
  const store = useWizardStore();
  const { exit } = useApp();
  const { stdout } = useStdout();

  const terminalWidth = stdout.columns || MIN_TERMINAL_WIDTH;
  const isNarrowTerminal = terminalWidth < MIN_TERMINAL_WIDTH;

  useWizardInitialization({ matrix, initialStep, initialInstallMode, installedSkillIds });

  const buildStepProps = useBuildStepProps({ store, matrix, installedSkillIds });

  useInput((input, key) => {
    // Disable global hotkeys when settings or help overlay is active
    if (store.showSettings) return;

    if (store.showHelp) {
      // Any key closes the help modal (useInput in HelpModal handles this too)
      store.toggleHelp();
      return;
    }

    if (input === "?") {
      store.toggleHelp();
      return;
    }

    if (key.escape) {
      if (store.step === "approach") {
        onCancel();
        exit();
      } else if (store.step !== "build" && store.step !== "confirm" && store.step !== "sources") {
        // Only handle escape globally for steps that don't have their own escape handler.
        store.goBack();
      }
      return;
    }

    // Accept defaults shortcut (stack path only, during build step)
    if ((input === "a" || input === "A") && store.step === "build" && store.selectedStackId) {
      store.setStackAction("defaults");
      store.setStep("confirm");
      return;
    }

    if ((input === "g" || input === "G") && store.step === "sources") {
      store.toggleSettings();
      return;
    }

    if (input === "e" || input === "E") {
      store.toggleExpertMode();
      return;
    }
    if (input === "p" || input === "P") {
      store.toggleInstallMode();
    }
  });

  const handleComplete = useCallback(() => {
    let allSkills: SkillId[];

    if (store.selectedStackId && store.stackAction === "defaults") {
      const stack = matrix.suggestedStacks.find((s) => s.id === store.selectedStackId);
      if (!stack) {
        warn(`Stack not found in matrix: '${store.selectedStackId}'`);
      }
      allSkills = [...(stack?.allSkillIds || [])];
    } else {
      const techNames = store.getAllSelectedTechnologies();
      allSkills = techNames.map((tech) => {
        const resolved = resolveAlias(tech, matrix);
        if (!matrix.skills[resolved]) {
          warn(
            `Technology '${tech}' could not be resolved to a skill ID - it may be missing from skill_aliases`,
          );
        }
        return resolved;
      });
    }

    const methodologySkills = store.getDefaultMethodologySkills();
    for (const skill of methodologySkills) {
      if (!allSkills.includes(skill)) {
        allSkills.push(skill);
      }
    }

    const validation = validateSelection(allSkills, matrix);

    const result: WizardResultV2 = {
      selectedSkills: allSkills,
      selectedStackId: store.selectedStackId,
      domainSelections: store.domainSelections,
      sourceSelections: store.sourceSelections,
      expertMode: store.expertMode,
      installMode: store.installMode,
      cancelled: false,
      validation,
    };

    onComplete(result);
    exit();
  }, [store, matrix, onComplete, exit]);

  const renderStep = () => {
    switch (store.step) {
      case "approach":
        return <StepApproach />;

      case "stack":
        return <StepStack matrix={matrix} />;

      case "build":
        return <StepBuild {...buildStepProps} />;

      case "sources": {
        if (store.showSettings) {
          return (
            <StepSettings
              projectDir={projectDir || process.cwd()}
              onClose={() => store.toggleSettings()}
            />
          );
        }
        return (
          <StepSources
            matrix={matrix}
            projectDir={projectDir}
            onContinue={() => store.setStep("confirm")}
            onBack={store.goBack}
          />
        );
      }

      case "confirm": {
        const stackName = getStackName(store.selectedStackId, matrix);
        const technologyCount = store.getTechnologyCount();
        return (
          <StepConfirm
            onComplete={handleComplete}
            stackName={stackName}
            selectedDomains={store.selectedDomains}
            domainSelections={store.domainSelections}
            technologyCount={technologyCount}
            skillCount={technologyCount}
            installMode={store.installMode}
            onBack={store.goBack}
          />
        );
      }

      default:
        return null;
    }
  };

  if (isNarrowTerminal) {
    return (
      <ThemeProvider theme={cliTheme}>
        <Box flexDirection="column" padding={1}>
          <Text color={CLI_COLORS.WARNING}>
            Terminal too narrow ({terminalWidth} columns). Please resize to at least{" "}
            {MIN_TERMINAL_WIDTH} columns.
          </Text>
          <Box marginTop={1}>
            <Text dimColor>Current width: {terminalWidth} columns</Text>
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={cliTheme}>
      <WizardLayout version={version} marketplaceLabel={marketplaceLabel}>
        {renderStep()}
      </WizardLayout>
    </ThemeProvider>
  );
};
