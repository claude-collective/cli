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
import { resolveAlias, validateSelection } from "../../lib/matrix/index.js";
import type {
  AgentName,
  Domain,
  DomainSelections,
  MergedSkillsMatrix,
  SkillId,
} from "../../types/index.js";
import type { AgentScopeConfig, SkillConfig } from "../../types/config.js";
import { getStackName } from "./utils.js";
import { warn, type StartupMessage } from "../../utils/logger.js";
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
  matrix: MergedSkillsMatrix;
  onComplete: (result: WizardResultV2) => void;
  onCancel: () => void;
  version?: string;
  marketplaceLabel?: string;
  logo?: string;
  initialStep?: WizardStep;
  initialDomains?: Domain[];
  initialAgents?: AgentName[];
  installedSkillIds?: SkillId[];
  installedSkillConfigs?: SkillConfig[];
  lockedSkillIds?: SkillId[];
  lockedAgentNames?: AgentName[];
  projectDir?: string;
  startupMessages?: StartupMessage[];
};

const MIN_TERMINAL_WIDTH = 80;
const MIN_TERMINAL_HEIGHT = 15;

export const Wizard: React.FC<WizardProps> = ({
  matrix,
  onComplete,
  onCancel,
  version,
  marketplaceLabel,
  logo,
  initialStep,
  initialDomains,
  initialAgents,
  installedSkillIds,
  installedSkillConfigs,
  lockedSkillIds,
  lockedAgentNames,
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
    matrix,
    initialStep,
    initialDomains,
    initialAgents,
    installedSkillIds,
    installedSkillConfigs,
    lockedSkillIds,
    lockedAgentNames,
  });

  const buildStepProps = useBuildStepProps({ store, matrix, installedSkillIds });

  useInput((input, key) => {
    // ESC is handled by step-settings.tsx's own useKeyboardNavigation hook
    if (store.showSettings) {
      if (input === "s" || input === "S") {
        store.toggleSettings();
      }
      return;
    }

    if (store.showHelp) {
      if (key.escape || input === "?") {
        store.toggleHelp();
      }
      return;
    }

    if (input === "?") {
      store.toggleHelp();
      return;
    }

    if (key.escape) {
      // At the initial stack/scratch selection (approach not yet set), ESC cancels the wizard.
      // StackSelection handles its own ESC via the onCancel prop.
      // Other steps that don't have their own escape handler use goBack.
      if (
        store.step !== "build" &&
        store.step !== "confirm" &&
        store.step !== "sources" &&
        store.step !== "agents" &&
        store.step !== "stack"
      ) {
        store.goBack();
      }
      return;
    }

    if ((input === "a" || input === "A") && store.step === "build" && store.selectedStackId) {
      store.setStackAction("defaults");
      store.setStep("confirm");
      return;
    }

    if ((input === "s" || input === "S") && store.step === "build") {
      const focused = store.focusedSkillId;
      if (focused) {
        store.toggleSkillScope(focused);
      }
      return;
    }

    if ((input === "s" || input === "S") && store.step === "agents") {
      const focused = store.focusedAgentId;
      if (focused) {
        store.toggleAgentScope(focused);
      }
      return;
    }

    if ((input === "s" || input === "S") && store.step === "sources") {
      store.toggleSettings();
      return;
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

    const skillConfigs: SkillConfig[] = allSkills.map((id) => {
      const existing = store.skillConfigs.find((sc) => sc.id === id);
      return existing ?? { id, scope: "project" as const, source: "local" };
    });

    const validation = validateSelection(allSkills, matrix);

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
  }, [store, matrix, onComplete, exit]);

  const handleCancel = useCallback(() => {
    onCancel();
    exit();
  }, [onCancel, exit]);

  const renderStep = () => {
    switch (store.step) {
      case "stack":
        return <StepStack matrix={matrix} onCancel={handleCancel} />;

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
        return <StepAgents matrix={matrix} />;

      case "confirm": {
        const stackName = getStackName(store.selectedStackId, matrix);
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
      <WizardLayout
        version={version}
        marketplaceLabel={marketplaceLabel}
        logo={logo}
        startupMessages={startupMessages}
      >
        {renderStep()}
      </WizardLayout>
    </ThemeProvider>
  );
};
