import React, { useCallback } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { ThemeProvider } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store.js";
import { cliTheme } from "../themes/default.js";
import { WizardLayout } from "./wizard-layout.js";
import { StepApproach } from "./step-approach.js";
import { StepStack } from "./step-stack.js";
import { StepBuild } from "./step-build.js";
import { StepConfirm } from "./step-confirm.js";
import { resolveAlias, validateSelection } from "../../lib/matrix/index.js";
import type { Domain, DomainSelections, MergedSkillsMatrix, SkillId } from "../../types/index.js";
import { getStackName } from "./utils.js";

export type WizardResultV2 = {
  selectedSkills: SkillId[];
  selectedStackId: string | null;
  domainSelections: DomainSelections;
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
};

function getParentDomain(domain: Domain, matrix: MergedSkillsMatrix): Domain | undefined {
  const cat = Object.values(matrix.categories).find((c) => c.domain === domain && c.parent_domain);
  return cat?.parent_domain;
}

const MIN_TERMINAL_WIDTH = 80;

export const Wizard: React.FC<WizardProps> = ({ matrix, onComplete, onCancel, version }) => {
  const store = useWizardStore();
  const { exit } = useApp();
  const { stdout } = useStdout();

  const terminalWidth = stdout.columns || MIN_TERMINAL_WIDTH;
  const isNarrowTerminal = terminalWidth < MIN_TERMINAL_WIDTH;

  useInput((input, key) => {
    if (key.escape) {
      if (store.step === "approach") {
        onCancel();
        exit();
      } else if (store.step !== "build" && store.step !== "confirm") {
        // Only handle escape globally for steps that don't have their own escape handler.
        // Build and confirm handle escape via their onBack props.
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

    // Global toggles
    if (input === "e" || input === "E") {
      store.toggleExpertMode();
      return;
    }
    if (input === "p" || input === "P") {
      store.toggleInstallMode();
      return;
    }
  });

  const handleComplete = useCallback(() => {
    let allSkills: SkillId[];

    if (store.selectedStackId && store.stackAction === "defaults") {
      const stack = matrix.suggestedStacks.find((s) => s.id === store.selectedStackId);
      if (!stack) {
        console.warn(`Stack not found in matrix: ${store.selectedStackId}`);
      }
      allSkills = [...(stack?.allSkillIds || [])];
    } else {
      const techNames = store.getAllSelectedTechnologies();
      allSkills = techNames.map((tech) => {
        const resolved = resolveAlias(tech, matrix);
        if (!matrix.skills[resolved]) {
          console.warn(
            `Warning: Technology '${tech}' could not be resolved to a skill ID — it may be missing from skill_aliases`,
          );
        }
        return resolved;
      });
    }

    const methodologySkills = store.getSelectedSkills();
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

      case "build": {
        const currentDomain = store.getCurrentDomain();
        const defaultDomains: Domain[] = ["web"];
        const effectiveDomains = store.selectedDomains.length > 0 ? store.selectedDomains : defaultDomains;

        const allSelections = store.getAllSelectedTechnologies();

        const activeDomain: Domain = currentDomain || effectiveDomains[0] || "web";
        const parentDomain = getParentDomain(activeDomain, matrix);
        const parentDomainSelections = parentDomain
          ? store.domainSelections[parentDomain]
          : undefined;

        return (
          <StepBuild
            matrix={matrix}
            domain={activeDomain}
            selectedDomains={effectiveDomains}
            selections={store.domainSelections[activeDomain] || {}}
            allSelections={allSelections}
            focusedRow={store.focusedRow}
            focusedCol={store.focusedCol}
            showDescriptions={store.showDescriptions}
            expertMode={store.expertMode}
            parentDomainSelections={parentDomainSelections}
            onToggle={(subcategoryId, techId) => {
              const domain: Domain = store.getCurrentDomain() || "web";
              const cat = matrix.categories[subcategoryId];
              store.toggleTechnology(domain, subcategoryId, techId, cat?.exclusive ?? true);
            }}
            onFocusChange={store.setFocus}
            onToggleDescriptions={store.toggleShowDescriptions}
            onContinue={() => {
              if (!store.nextDomain()) {
                store.setStep("confirm");
              }
            }}
            onBack={() => {
              if (!store.prevDomain()) {
                store.goBack();
              }
            }}
          />
        );
      }

      case "confirm": {
        const stackName = getStackName(store.selectedStackId, matrix);
        const selectedCount = store.getAllSelectedTechnologies().length;
        return (
          <StepConfirm
            onComplete={handleComplete}
            stackName={stackName}
            selectedDomains={store.selectedDomains}
            domainSelections={store.domainSelections}
            technologyCount={selectedCount}
            skillCount={selectedCount}
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
          <Text color="yellow">
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
      <WizardLayout version={version}>{renderStep()}</WizardLayout>
    </ThemeProvider>
  );
};
