/**
 * Wizard component - Main orchestrator for the skill selection wizard.
 *
 * V2 Flow:
 * - approach: Choose stack template or build from scratch
 * - stack: Select pre-built stack (stack path) OR domains (scratch path)
 * - stack-options: Continue defaults or customize (stack path only)
 * - build: CategoryGrid for technology selection
 * - refine: Skill source selection
 * - confirm: Final confirmation
 *
 * Navigation:
 * - ESC goes back through history
 * - ESC at approach cancels wizard
 * - Ctrl+C cancels at any point
 */
import React, { useCallback } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { ThemeProvider } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store.js";
import { cliTheme } from "../themes/default.js";
import { WizardLayout } from "./wizard-layout.js";
import { StepApproach } from "./step-approach.js";
import { StepStack } from "./step-stack.js";
import { StepStackOptions } from "./step-stack-options.js";
import { StepBuild } from "./step-build.js";
import { StepRefine } from "./step-refine.js";
import { StepConfirm } from "./step-confirm.js";
import { validateSelection } from "../../lib/matrix-resolver.js";
import type { MergedSkillsMatrix } from "../../types-matrix.js";

// =============================================================================
// Types
// =============================================================================

export interface WizardResultV2 {
  selectedSkills: string[];
  selectedStackId: string | null;
  domainSelections: Record<string, Record<string, string[]>>;
  expertMode: boolean;
  installMode: "plugin" | "local";
  cancelled: boolean;
  validation: {
    valid: boolean;
    errors: Array<{ message: string }>;
    warnings: Array<{ message: string }>;
  };
}

/** @deprecated Use WizardResultV2 instead */
export interface WizardResult {
  selectedSkills: string[];
  selectedStack: { id: string } | null;
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
  onComplete: (result: WizardResultV2 | WizardResult) => void;
  onCancel: () => void;
  initialSkills?: string[];
  version?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum terminal width required for the wizard */
const MIN_TERMINAL_WIDTH = 80;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get display name for a domain.
 */
function getDomainDisplayName(domain: string): string {
  const displayNames: Record<string, string> = {
    web: "Web",
    api: "API",
    cli: "CLI",
    mobile: "Mobile",
    shared: "Shared",
  };
  return displayNames[domain] || domain.charAt(0).toUpperCase() + domain.slice(1);
}

/**
 * Get stack name from matrix by stack ID.
 */
function getStackName(stackId: string | null, matrix: MergedSkillsMatrix): string | undefined {
  if (!stackId) return undefined;
  const stack = matrix.suggestedStacks.find((s) => s.id === stackId);
  return stack?.name;
}

/**
 * Count technologies in a stack.
 */
function getStackTechnologyCount(stackId: string | null, matrix: MergedSkillsMatrix): number {
  if (!stackId) return 0;
  const stack = matrix.suggestedStacks.find((s) => s.id === stackId);
  if (!stack) return 0;
  return stack.allSkillIds.length;
}

// =============================================================================
// Main Component
// =============================================================================

export const Wizard: React.FC<WizardProps> = ({ matrix, onComplete, onCancel, version }) => {
  const store = useWizardStore();
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Check terminal width
  const terminalWidth = stdout.columns || MIN_TERMINAL_WIDTH;
  const isNarrowTerminal = terminalWidth < MIN_TERMINAL_WIDTH;

  // Global keyboard shortcut handler
  useInput((input, key) => {
    if (key.escape) {
      if (store.step === "approach") {
        onCancel();
        exit();
      } else {
        store.goBack();
      }
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

  // Handle wizard completion
  const handleComplete = useCallback(() => {
    let allSkills: string[];

    if (store.selectedStackId && store.stackAction === "defaults") {
      // Stack + defaults path: use stack's allSkillIds directly
      const stack = matrix.suggestedStacks.find((s) => s.id === store.selectedStackId);
      if (!stack) {
        console.warn(`Stack not found in matrix: ${store.selectedStackId}`);
      }
      allSkills = [...(stack?.allSkillIds || [])];
    } else {
      // Scratch / Customize path: resolve domainSelections via aliases
      const techNames = store.getAllSelectedTechnologies();
      // Resolve each technology name to its full skill ID via aliases
      allSkills = techNames.map((tech) => matrix.aliases[tech] || tech);
    }

    // Add methodology skills (always included)
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

  // Render current step
  const renderStep = () => {
    switch (store.step) {
      case "approach":
        return <StepApproach />;

      case "stack":
        return <StepStack matrix={matrix} />;

      case "stack-options": {
        const stackName = getStackName(store.selectedStackId, matrix) || "Selected Stack";
        const techCount = getStackTechnologyCount(store.selectedStackId, matrix);
        return (
          <StepStackOptions stackName={stackName} technologyCount={techCount} matrix={matrix} />
        );
      }

      case "build": {
        const currentDomain = store.getCurrentDomain();
        // For stack path with customize, use all domains from stack
        // For scratch path, use selectedDomains
        const effectiveDomains = store.selectedDomains.length > 0 ? store.selectedDomains : ["web"]; // Default to web if no domains selected

        const allSelections = store.getAllSelectedTechnologies();

        return (
          <StepBuild
            matrix={matrix}
            domain={currentDomain || effectiveDomains[0] || "web"}
            selectedDomains={effectiveDomains}
            selections={store.domainSelections[currentDomain || "web"] || {}}
            allSelections={allSelections}
            focusedRow={store.focusedRow}
            focusedCol={store.focusedCol}
            showDescriptions={store.showDescriptions}
            expertMode={store.expertMode}
            onToggle={(subcategoryId, techId) => {
              const domain = store.getCurrentDomain() || "web";
              const cat = matrix.categories[subcategoryId];
              store.toggleTechnology(domain, subcategoryId, techId, cat?.exclusive ?? true);
            }}
            onFocusChange={store.setFocus}
            onToggleDescriptions={store.toggleShowDescriptions}
            onContinue={() => {
              if (!store.nextDomain()) {
                store.setStep("refine");
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

      case "refine":
        return (
          <StepRefine
            technologyCount={store.getAllSelectedTechnologies().length}
            refineAction={store.refineAction}
            onSelectAction={store.setRefineAction}
            onContinue={() => store.setStep("confirm")}
            onBack={store.goBack}
          />
        );

      case "confirm": {
        const stackName = getStackName(store.selectedStackId, matrix);
        return (
          <StepConfirm
            matrix={matrix}
            onComplete={handleComplete}
            stackName={stackName}
            selectedDomains={store.selectedDomains}
            domainSelections={store.domainSelections}
            technologyCount={store.getAllSelectedTechnologies().length}
            skillCount={store.getSelectedSkills().length}
            installMode={store.installMode}
            onBack={store.goBack}
          />
        );
      }

      default:
        return null;
    }
  };

  // Show warning if terminal is too narrow
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
