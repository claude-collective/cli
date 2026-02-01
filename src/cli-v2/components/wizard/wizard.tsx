import React, { useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { ThemeProvider } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store.js";
import { cliTheme } from "../themes/default.js";
import { SelectionHeader } from "./selection-header.js";
import { StepApproach } from "./step-approach.js";
import { StepStack } from "./step-stack.js";
import { StepCategory } from "./step-category.js";
import { StepSubcategory } from "./step-subcategory.js";
import { StepConfirm } from "./step-confirm.js";
import { validateSelection } from "../../lib/matrix-resolver.js";
import type { MergedSkillsMatrix, ResolvedStack } from "../../types-matrix.js";

export interface WizardResult {
  selectedSkills: string[];
  selectedStack: ResolvedStack | null;
  expertMode: boolean;
  installMode: "plugin" | "local";
  cancelled: boolean;
  validation: {
    valid: boolean;
    errors: Array<{ message: string }>;
    warnings: Array<{ message: string }>;
  };
}

interface WizardProps {
  matrix: MergedSkillsMatrix;
  onComplete: (result: WizardResult) => void;
  onCancel: () => void;
  initialSkills?: string[];
}

export const Wizard: React.FC<WizardProps> = ({
  matrix,
  onComplete,
  onCancel,
  initialSkills = [],
}) => {
  const {
    step,
    goBack,
    reset,
    selectedSkills,
    selectedStack,
    expertMode,
    installMode,
  } = useWizardStore();
  const { exit } = useApp();

  // Initialize store with initial skills if provided
  React.useEffect(() => {
    if (initialSkills.length > 0) {
      reset({ initialSkills });
    }
  }, []);

  // Handle ESC key for back navigation
  useInput((input, key) => {
    if (key.escape) {
      if (step === "approach") {
        onCancel();
        exit();
      } else {
        goBack();
      }
    }
  });

  const handleComplete = useCallback(() => {
    const validation = validateSelection(selectedSkills, matrix);
    onComplete({
      selectedSkills,
      selectedStack,
      expertMode,
      installMode,
      cancelled: false,
      validation,
    });
    exit();
  }, [
    selectedSkills,
    selectedStack,
    expertMode,
    installMode,
    matrix,
    onComplete,
    exit,
  ]);

  const renderStep = () => {
    switch (step) {
      case "approach":
        return <StepApproach />;
      case "stack":
        return <StepStack matrix={matrix} />;
      case "category":
        return <StepCategory matrix={matrix} />;
      case "subcategory":
        return <StepSubcategory matrix={matrix} />;
      case "confirm":
        return <StepConfirm matrix={matrix} onComplete={handleComplete} />;
      default:
        return null;
    }
  };

  return (
    <ThemeProvider theme={cliTheme}>
      <Box flexDirection="column" padding={1}>
        <SelectionHeader matrix={matrix} />
        {renderStep()}
        <Box marginTop={1}>
          <Text dimColor>ESC to go back, Ctrl+C to cancel</Text>
        </Box>
      </Box>
    </ThemeProvider>
  );
};
