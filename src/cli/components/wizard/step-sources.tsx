import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { MergedSkillsMatrix, SkillId } from "../../types/index.js";
import { SourceGrid, type SourceRow } from "./source-grid.js";
import { ViewTitle } from "./view-title.js";

const DEFAULT_SOURCE_ID = "public";
const DEFAULT_SOURCE_LABEL = "Public";

export type StepSourcesProps = {
  matrix: MergedSkillsMatrix;
  onContinue: () => void;
  onBack: () => void;
};

type SourcesView = "choice" | "customize";

function formatSourceLabel(source: { name: string; version?: string }): string {
  const displayName = source.name === "public" ? "Public" : source.name;
  return source.version ? `${displayName} \u00B7 v${source.version}` : displayName;
}

function buildSourceRows(
  selectedTechnologies: SkillId[],
  matrix: MergedSkillsMatrix,
  sourceSelections: Partial<Record<SkillId, string>>,
): SourceRow[] {
  return selectedTechnologies.map((skillId) => {
    const skill = matrix.skills[skillId];
    const displayName = skill?.displayName || skillId;
    const selectedSource = sourceSelections[skillId] || DEFAULT_SOURCE_ID;

    const availableSources = skill?.availableSources || [];

    const options =
      availableSources.length > 0
        ? availableSources.map((source) => ({
            id: source.name,
            label: formatSourceLabel(source),
            selected: selectedSource === source.name,
            installed: source.installed,
          }))
        : [
            {
              id: DEFAULT_SOURCE_ID,
              label: DEFAULT_SOURCE_LABEL,
              selected: selectedSource === DEFAULT_SOURCE_ID,
              installed: false,
            },
          ];

    return { skillId, displayName, options };
  });
}

export const StepSources: React.FC<StepSourcesProps> = ({ matrix, onContinue, onBack }) => {
  const store = useWizardStore();
  const [view, setView] = useState<SourcesView>("choice");
  const [choiceIndex, setChoiceIndex] = useState(0);
  const [gridFocusedRow, setGridFocusedRow] = useState(0);
  const [gridFocusedCol, setGridFocusedCol] = useState(0);

  const selectedTechnologies = store.getAllSelectedTechnologies();
  const rows = buildSourceRows(selectedTechnologies, matrix, store.sourceSelections);

  const handleGridSelect = useCallback(
    (skillId: SkillId, sourceId: string) => {
      store.setSourceSelection(skillId, sourceId);
    },
    [store],
  );

  const handleGridFocusChange = useCallback((row: number, col: number) => {
    setGridFocusedRow(row);
    setGridFocusedCol(col);
  }, []);

  useInput((input, key) => {
    if (view === "choice") {
      if (key.return) {
        if (choiceIndex === 0) {
          // "Use all recommended" -> continue
          onContinue();
        } else {
          // "Customize skill sources" -> switch to grid view
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
    return (
      <Box flexDirection="column" width="100%">
        <ViewTitle>Customize skill sources</ViewTitle>
        <SourceGrid
          rows={rows}
          focusedRow={gridFocusedRow}
          focusedCol={gridFocusedCol}
          onSelect={handleGridSelect}
          onFocusChange={handleGridFocusChange}
        />
      </Box>
    );
  }

  const isRecommendedSelected = choiceIndex === 0;

  return (
    <Box flexDirection="column" paddingX={2}>
      <Text>
        Your stack includes{" "}
        <Text color="cyan" bold>
          {selectedTechnologies.length}
        </Text>{" "}
        technologies.
      </Text>
      <Text> </Text>

      <Box
        borderStyle="round"
        borderColor={isRecommendedSelected ? "green" : "gray"}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text color={isRecommendedSelected ? "green" : undefined} bold={isRecommendedSelected}>
            {isRecommendedSelected ? ">" : "\u25CB"} Use all recommended skills (verified)
          </Text>
          <Text> </Text>
          <Text dimColor>This is the fastest option. All skills are verified and</Text>
          <Text dimColor>maintained by Claude Collective.</Text>
        </Box>
      </Box>

      <Box
        borderStyle="round"
        borderColor={!isRecommendedSelected ? "green" : "gray"}
        paddingX={2}
        paddingY={1}
      >
        <Box flexDirection="column">
          <Text color={!isRecommendedSelected ? "green" : undefined} bold={!isRecommendedSelected}>
            {!isRecommendedSelected ? ">" : "\u25CB"} Customize skill sources
          </Text>
          <Text> </Text>
          <Text dimColor>Choose alternative skills for each technology</Text>
        </Box>
      </Box>
    </Box>
  );
};
