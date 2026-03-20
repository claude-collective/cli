import { Box, Text, useInput } from "ink";
import React, { useCallback, useMemo } from "react";
import { CLI_COLORS } from "../../consts.js";
import type { AgentScopeConfig, SkillConfig } from "../../types/config.js";
import type { Domain, SkillId, Category, CategorySelections } from "../../types/index.js";
import { useFrameworkFiltering } from "../hooks/use-framework-filtering.js";
import { useMeasuredHeight } from "../hooks/use-measured-height.js";
import { useWizardStore } from "../../stores/wizard-store.js";
import { CategoryGrid } from "./category-grid.js";
import { getDomainDisplayName } from "./utils.js";
import { ViewTitle } from "./view-title.js";
import { StatsPanel } from "./stats-panel.js";

const SCOPE_COLOR_PROJECT = "#eee";

type StatsData = {
  skillsTotal: number;
  globalPlugin: number;
  globalLocal: number;
  projectPlugin: number;
  projectLocal: number;
  agentsTotal: number;
  agentsGlobal: number;
  agentsProject: number;
};

function computeStats(skillConfigs: SkillConfig[], agentConfigs: AgentScopeConfig[]): StatsData {
  let globalPlugin = 0;
  let globalLocal = 0;
  let projectPlugin = 0;
  let projectLocal = 0;

  for (const sc of skillConfigs) {
    const isLocal = sc.source === "local";
    if (sc.scope === "global") {
      if (isLocal) globalLocal++;
      else globalPlugin++;
    } else {
      if (isLocal) projectLocal++;
      else projectPlugin++;
    }
  }

  let agentsGlobal = 0;
  let agentsProject = 0;
  for (const ac of agentConfigs) {
    if (ac.scope === "global") agentsGlobal++;
    else agentsProject++;
  }

  return {
    skillsTotal: skillConfigs.length,
    globalPlugin,
    globalLocal,
    projectPlugin,
    projectLocal,
    agentsTotal: agentConfigs.length,
    agentsGlobal,
    agentsProject,
  };
}

export type StepBuildProps = {
  domain: Domain;
  selectedDomains: Domain[];
  selections: CategorySelections;
  allSelections: SkillId[];
  showLabels: boolean;
  filterIncompatible: boolean;
  /** Skill IDs already installed on disk, shown with a dimmed checkmark */
  installedSkillIds?: SkillId[];
  onToggle: (categoryId: Category, technologyId: SkillId) => void;
  onToggleLabels: () => void;
  onToggleFilterIncompatible: () => void;
  onContinue: () => void;
  onBack: () => void;
};

export const StepBuild: React.FC<StepBuildProps> = ({
  domain: activeDomain,
  selectedDomains,
  selections,
  allSelections,
  showLabels,
  filterIncompatible,
  installedSkillIds,
  onToggle,
  onToggleLabels,
  onToggleFilterIncompatible,
  onContinue,
  onBack,
}) => {
  const { ref: gridRef, measuredHeight: gridHeight } = useMeasuredHeight();
  const skillConfigs = useWizardStore((s) => s.skillConfigs);
  const agentConfigs = useWizardStore((s) => s.agentConfigs);

  const stats = useMemo(
    () => computeStats(skillConfigs, agentConfigs),
    [skillConfigs, agentConfigs],
  );

  const handleFocusedSkillChange = useCallback(
    (id: SkillId | null) => useWizardStore.getState().setFocusedSkillId(id),
    [],
  );

  const categories = useFrameworkFiltering({
    domain: activeDomain,
    allSelections,
    selections,
    installedSkillIds,
    skillConfigs,
    filterIncompatible,
  });

  useInput((_input, key) => {
    if (key.return) {
      onContinue();
    } else if (key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" width="100%" flexGrow={1} flexBasis={0}>
      <Box flexDirection="row" columnGap={2} justifyContent="flex-end">
        {/* <ViewTitle>{`Customize your ${getDomainDisplayName(activeDomain)} stack`}</ViewTitle> */}
        <StatsPanel stats={stats} />
      </Box>

      <Box ref={gridRef} flexGrow={1} flexBasis={0}>
        <CategoryGrid
          key={activeDomain}
          categories={categories}
          availableHeight={gridHeight}
          showLabels={showLabels}
          onToggle={onToggle}
          onToggleLabels={onToggleLabels}
          onToggleFilterIncompatible={onToggleFilterIncompatible}
          onFocusedSkillChange={handleFocusedSkillChange}
        />
      </Box>
    </Box>
  );
};
