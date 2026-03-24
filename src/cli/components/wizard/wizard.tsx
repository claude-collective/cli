import React, { useCallback } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { ThemeProvider } from "@inkjs/ui";
import { useWizardStore, type WizardStep } from "../../stores/wizard-store.js";
import { CLI_COLORS } from "../../consts.js";
import { cliTheme } from "../themes/default.js";
import { WizardLayout } from "./wizard-layout.js";
import { StepStack } from "./step-stack.js";
import { StepBuild } from "./step-build.js";
import { StepConfirm } from "./step-confirm.js";
import { StepSources } from "./step-sources.js";
import { StepSettings } from "./step-settings.js";
import { StepAgents } from "./step-agents.js";
import { DomainSelection } from "./domain-selection.js";
import { resolveAlias, validateSelection } from "../../lib/matrix/index.js";
import { matrix, findStack } from "../../lib/matrix/matrix-provider.js";
import {
  HOTKEY_ACCEPT_DEFAULTS,
  HOTKEY_HELP,
  HOTKEY_SCOPE,
  HOTKEY_SETTINGS,
  isHotkey,
} from "./hotkeys.js";
import type { AgentName, Domain, DomainSelections, SkillId } from "../../types/index.js";
import type { AgentScopeConfig, SkillConfig } from "../../types/config.js";
import { getStackName } from "./utils.js";
import type { StartupMessage } from "../../utils/logger.js";
import { useWizardInitialization } from "../hooks/use-wizard-initialization.js";
import { useBuildStepProps } from "../hooks/use-build-step-props.js";

export type WizardResultV2 = {
  skills: SkillConfig[];
  selectedAgents: AgentName[];
  agentConfigs: AgentScopeConfig[];
  selectedStackId: string | null;
  domainSelections: DomainSelections;
  selectedDomains: Domain[];
  cancelled: boolean;
  validation: {
    valid: boolean;
    errors: Array<{ message: string }>;
    warnings: Array<{ message: string }>;
  };
};

type WizardProps = {
  onComplete: (result: WizardResultV2) => void;
  onCancel: () => void;
  version?: string;
  logo?: string;
  initialStep?: WizardStep;
  initialDomains?: Domain[];
  initialAgents?: AgentName[];
  installedSkillIds?: SkillId[];
  installedSkillConfigs?: SkillConfig[];
  installedAgentConfigs?: AgentScopeConfig[];
  lockedSkillIds?: SkillId[];
  lockedAgentNames?: AgentName[];
  isEditingFromGlobalScope?: boolean;
  projectDir?: string;
  startupMessages?: StartupMessage[];
};

const MIN_TERMINAL_WIDTH = 80;
const MIN_TERMINAL_HEIGHT = 15;

export const Wizard: React.FC<WizardProps> = ({
  onComplete,
  onCancel,
  version,
  logo,
  initialStep,
  initialDomains,
  initialAgents,
  installedSkillIds,
  installedSkillConfigs,
  installedAgentConfigs,
  lockedSkillIds,
  lockedAgentNames,
  isEditingFromGlobalScope,
  projectDir,
  startupMessages,
}) => {
  const store = useWizardStore();
  const { exit } = useApp();
  const { stdout } = useStdout();

  const terminalWidth = stdout.columns || MIN_TERMINAL_WIDTH;
  const terminalHeight = stdout.rows || MIN_TERMINAL_HEIGHT;
  const isNarrowTerminal = terminalWidth < MIN_TERMINAL_WIDTH;
  const isShortTerminal = terminalHeight < MIN_TERMINAL_HEIGHT;

  useWizardInitialization({
    initialStep,
    initialDomains,
    initialAgents,
    installedSkillIds,
    installedSkillConfigs,
    installedAgentConfigs,
    lockedSkillIds,
    lockedAgentNames,
    isEditingFromGlobalScope,
  });

  const buildStepProps = useBuildStepProps({ store, installedSkillIds });

  useInput((input, key) => {
    // ESC is handled by step-settings.tsx's own useKeyboardNavigation hook
    if (store.showSettings) {
      if (isHotkey(input, HOTKEY_SETTINGS)) {
        store.toggleSettings();
      }
      return;
    }

    if (store.showHelp) {
      if (key.escape || isHotkey(input, HOTKEY_HELP)) {
        store.toggleHelp();
      }
      return;
    }

    if (isHotkey(input, HOTKEY_HELP)) {
      store.toggleHelp();
      return;
    }

    if (key.escape) {
      // Steps with their own ESC handling (via useInput in child components):
      // - "stack": StackSelection handles ESC via onCancel prop
      // - "domains": DomainSelection handles ESC via CheckboxGrid onBack
      // - "build": StepBuild handles ESC via its own useInput
      // - "sources": StepSources handles ESC via onBack prop
      // - "confirm": StepConfirm handles ESC via onBack prop
      // - "agents": StepAgents handles ESC via its own useInput
      // All steps handle their own ESC, so this is a no-op.
      return;
    }

    if (
      isHotkey(input, HOTKEY_ACCEPT_DEFAULTS) &&
      store.step === "build" &&
      store.selectedStackId
    ) {
      store.setStackAction("defaults");
      store.setStep("confirm");
      return;
    }

    if (isHotkey(input, HOTKEY_SCOPE) && store.step === "build") {
      if (store.isEditingFromGlobalScope) return;
      const focused = store.focusedSkillId;
      if (focused) {
        store.toggleSkillScope(focused);
      }
      return;
    }

    if (isHotkey(input, HOTKEY_SCOPE) && store.step === "agents") {
      if (store.isEditingFromGlobalScope) return;
      const focused = store.focusedAgentId;
      if (focused) {
        store.toggleAgentScope(focused);
      }
      return;
    }

    if (isHotkey(input, HOTKEY_SETTINGS) && store.step === "sources") {
      store.toggleSettings();
      return;
    }
  });

  const handleComplete = useCallback(() => {
    let allSkills: SkillId[];

    if (store.selectedStackId && store.stackAction === "defaults") {
      const stack = findStack(store.selectedStackId);
      if (!stack) {
        throw new Error(`Stack not found: ${store.selectedStackId}`);
      }
      allSkills = [...stack.allSkillIds];
    } else {
      const techNames = store.getAllSelectedTechnologies();
      allSkills = techNames.map((tech) => resolveAlias(tech));
    }

    const skillConfigs: SkillConfig[] = allSkills.map((id) => {
      const existing = store.skillConfigs.find((sc) => sc.id === id);
      return existing ?? { id, scope: "global" as const, source: "local" };
    });

    const validation = validateSelection(allSkills);

    const result: WizardResultV2 = {
      skills: skillConfigs,
      selectedAgents: store.selectedAgents,
      agentConfigs: store.agentConfigs,
      selectedStackId: store.selectedStackId,
      domainSelections: store.domainSelections,
      selectedDomains: store.selectedDomains,
      cancelled: false,
      validation,
    };

    onComplete(result);
    exit();
  }, [store, onComplete, exit]);

  const handleCancel = useCallback(() => {
    onCancel();
    exit();
  }, [onCancel, exit]);

  const renderStep = () => {
    switch (store.step) {
      case "stack":
        return <StepStack onCancel={handleCancel} />;

      case "domains":
        return <DomainSelection />;

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
            projectDir={projectDir}
            onContinue={() => {
              if (!initialAgents?.length) {
                store.preselectAgentsFromDomains();
              }
              store.setStep("agents");
            }}
            onBack={store.goBack}
          />
        );
      }

      case "agents":
        return <StepAgents />;

      case "confirm": {
        const stackName = getStackName(store.selectedStackId);
        const selectedSkills = store.getAllSelectedTechnologies();
        return (
          <StepConfirm
            onComplete={handleComplete}
            stackName={stackName}
            selectedDomains={store.selectedDomains}
            domainSelections={store.domainSelections}
            technologyCount={selectedSkills.length}
            skillCount={selectedSkills.length}
            agentCount={store.selectedAgents.length}
            skillConfigs={store.skillConfigs}
            agentConfigs={store.agentConfigs}
            onBack={store.goBack}
          />
        );
      }

      default:
        return null;
    }
  };

  if (isNarrowTerminal || isShortTerminal) {
    const issue = isNarrowTerminal
      ? `too narrow (${terminalWidth} columns, need ${MIN_TERMINAL_WIDTH})`
      : `too short (${terminalHeight} rows, need ${MIN_TERMINAL_HEIGHT})`;

    return (
      <ThemeProvider theme={cliTheme}>
        <Box flexDirection="column" padding={1}>
          <Text color={CLI_COLORS.WARNING}>Terminal {issue}. Please resize your terminal.</Text>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={cliTheme}>
      <WizardLayout version={version} logo={logo} startupMessages={startupMessages}>
        {renderStep()}
      </WizardLayout>
    </ThemeProvider>
  );
};
