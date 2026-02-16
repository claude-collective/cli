import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { useWizardStore } from "../../stores/wizard-store.js";
import type {
  BoundSkillCandidate,
  MergedSkillsMatrix,
  SkillAlias,
  SkillId,
} from "../../types/index.js";
import { CLI_COLORS, DEFAULT_BRANDING } from "../../consts.js";
import { SourceGrid } from "./source-grid.js";
import { ViewTitle } from "./view-title.js";
import { searchExtraSources } from "../../lib/loading/multi-source-loader.js";
import { resolveAllSources } from "../../lib/configuration/index.js";

export type StepSourcesProps = {
  matrix: MergedSkillsMatrix;
  projectDir?: string;
  onContinue: () => void;
  onBack: () => void;
};

type SourcesView = "choice" | "customize";

export const StepSources: React.FC<StepSourcesProps> = ({
  matrix,
  projectDir,
  onContinue,
  onBack,
}) => {
  const store = useWizardStore();
  const [view, setView] = useState<SourcesView>("choice");
  const [choiceIndex, setChoiceIndex] = useState(0);
  const [isGridSearching, setIsGridSearching] = useState(false);

  const handleGridSelect = useCallback(
    (skillId: SkillId, sourceId: string) => {
      store.setSourceSelection(skillId, sourceId);
    },
    [store],
  );

  const handleSearch = useCallback(
    async (alias: SkillAlias): Promise<BoundSkillCandidate[]> => {
      if (!projectDir) return [];
      try {
        const sources = await resolveAllSources(projectDir);
        return await searchExtraSources(alias, sources.extras);
      } catch {
        return [];
      }
    },
    [projectDir],
  );

  const handleBind = useCallback(
    (candidate: BoundSkillCandidate) => {
      store.bindSkill({
        id: candidate.id,
        sourceUrl: candidate.sourceUrl,
        sourceName: candidate.sourceName,
        boundTo: candidate.alias,
        description: candidate.description,
      });
    },
    [store],
  );

  const handleSearchStateChange = useCallback((active: boolean) => {
    setIsGridSearching(active);
  }, []);

  useInput((_input, key) => {
    if (view === "choice") {
      if (key.return) {
        if (choiceIndex === 0) {
          onContinue();
        } else {
          store.setCustomizeSources(true);
          setView("customize");
        }
      }
      if (key.escape) {
        onBack();
      }
      if (key.upArrow || key.downArrow) {
        setChoiceIndex((prev) => (prev === 0 ? 1 : 0));
      }
    } else if (view === "customize") {
      if (isGridSearching) return;

      if (key.return) {
        onContinue();
      }
      if (key.escape) {
        store.setCustomizeSources(false);
        setView("choice");
      }
    }
  });

  if (view === "customize") {
    const rows = store.buildSourceRows(matrix);
    return (
      <Box flexDirection="column" width="100%">
        <ViewTitle>Customize skill sources</ViewTitle>
        <SourceGrid
          rows={rows}
          onSelect={handleGridSelect}
          onSearch={handleSearch}
          onBind={handleBind}
          onSearchStateChange={handleSearchStateChange}
        />
      </Box>
    );
  }

  const selectedTechnologies = store.getAllSelectedTechnologies();
  const rows = store.buildSourceRows(matrix);
  const isRecommendedSelected = choiceIndex === 0;
  const hasLocalSkills = rows.some((row) =>
    row.options.some((o) => o.installed && o.id === "local"),
  );

  return (
    <Box flexDirection="column" paddingX={2}>
      <Text>
        Your stack includes{" "}
        <Text color={CLI_COLORS.PRIMARY} bold>
          {selectedTechnologies.length}
        </Text>{" "}
        technologies.
      </Text>
      <Text> </Text>

      <Box
        borderStyle="round"
        borderColor={isRecommendedSelected ? CLI_COLORS.SUCCESS : CLI_COLORS.NEUTRAL}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text
            color={isRecommendedSelected ? CLI_COLORS.SUCCESS : undefined}
            bold={isRecommendedSelected}
          >
            {isRecommendedSelected ? ">" : "\u25CB"}{" "}
            {hasLocalSkills
              ? "Use installed skill sources"
              : "Use all recommended skills (verified)"}
          </Text>
          <Text> </Text>
          <Text dimColor>
            {hasLocalSkills
              ? "Keep your current local and public skill selections."
              : "This is the fastest option. All skills are verified and"}
          </Text>
          {!hasLocalSkills && <Text dimColor>maintained by {DEFAULT_BRANDING.NAME}</Text>}
        </Box>
      </Box>

      <Box
        borderStyle="round"
        borderColor={!isRecommendedSelected ? CLI_COLORS.SUCCESS : CLI_COLORS.NEUTRAL}
        paddingX={2}
        paddingY={1}
      >
        <Box flexDirection="column">
          <Text
            color={!isRecommendedSelected ? CLI_COLORS.SUCCESS : undefined}
            bold={!isRecommendedSelected}
          >
            {!isRecommendedSelected ? ">" : "\u25CB"} Customize skill sources
          </Text>
          <Text> </Text>
          <Text dimColor>Choose alternative skills for each technology</Text>
        </Box>
      </Box>
    </Box>
  );
};
