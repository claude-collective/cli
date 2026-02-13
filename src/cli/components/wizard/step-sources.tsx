import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { BoundSkill, BoundSkillCandidate, MergedSkillsMatrix, SkillAlias, SkillId } from "../../types/index.js";
import { SourceGrid, type SourceRow } from "./source-grid.js";
import { ViewTitle } from "./view-title.js";
import { resolveAlias } from "../../lib/matrix/index.js";
import { searchExtraSources } from "../../lib/loading/multi-source-loader.js";
import { resolveAllSources } from "../../lib/configuration/index.js";
import { warn } from "../../utils/logger.js";

const DEFAULT_SOURCE_ID = "public";
const DEFAULT_SOURCE_LABEL = "Public";

/** Sort priority: local first, then public, then private/other */
const SOURCE_SORT_ORDER: Record<string, number> = {
  local: 0,
  public: 1,
  private: 2,
};

export type StepSourcesProps = {
  matrix: MergedSkillsMatrix;
  projectDir?: string;
  onContinue: () => void;
  onBack: () => void;
};

type SourcesView = "choice" | "customize";

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  public: "Public",
  local: "Local",
};

function formatSourceLabel(source: { name: string; version?: string; installed?: boolean }): string {
  const displayName = SOURCE_DISPLAY_NAMES[source.name] ?? source.name;
  const prefix = source.installed ? "\u2713 " : "";
  const versionSuffix = source.version ? ` \u00B7 v${source.version}` : "";
  return `${prefix}${displayName}${versionSuffix}`;
}

/** Extract the alias from a skill ID or use displayName from the matrix */
function getSkillAlias(skillId: SkillId, matrix: MergedSkillsMatrix): SkillAlias {
  const displayName = matrix.displayNames?.[skillId];
  if (displayName) return displayName;
  // Fallback: use the last segment of the skill ID (e.g., "web-framework-react" -> "react")
  const segments = skillId.split("-");
  const fallback = segments[segments.length - 1] || skillId;
  warn(`No display name found for skill "${skillId}", using fallback alias "${fallback}"`);
  return fallback;
}

function buildSourceRows(
  selectedTechnologies: SkillId[],
  matrix: MergedSkillsMatrix,
  sourceSelections: Partial<Record<SkillId, string>>,
  boundSkills: BoundSkill[],
): SourceRow[] {
  return selectedTechnologies.map((tech) => {
    const skillId = resolveAlias(tech, matrix);
    const skill = matrix.skills[skillId];
    const selectedSource = sourceSelections[skillId] || skill?.activeSource?.name || DEFAULT_SOURCE_ID;
    const alias = getSkillAlias(skillId, matrix);

    const sortedSources = [...(skill?.availableSources || [])].sort(
      (a, b) => (SOURCE_SORT_ORDER[a.type] ?? 3) - (SOURCE_SORT_ORDER[b.type] ?? 3),
    );

    const options =
      sortedSources.length > 0
        ? sortedSources.map((source) => ({
            id: source.name,
            label: formatSourceLabel({ name: source.name, version: source.version, installed: source.installed }),
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

    // Append bound skills for this alias
    const boundForAlias = boundSkills.filter((b) => b.boundTo === alias);
    for (const bound of boundForAlias) {
      options.push({
        id: bound.sourceName,
        label: formatSourceLabel({
          name: bound.sourceName,
          installed: false,
        }),
        selected: selectedSource === bound.sourceName,
        installed: false,
      });
    }

    return { skillId, displayName: alias, alias, options };
  });
}

export const StepSources: React.FC<StepSourcesProps> = ({ matrix, projectDir, onContinue, onBack }) => {
  const store = useWizardStore();
  const [view, setView] = useState<SourcesView>("choice");
  const [choiceIndex, setChoiceIndex] = useState(0);
  const [gridFocusedRow, setGridFocusedRow] = useState(0);
  const [gridFocusedCol, setGridFocusedCol] = useState(0);
  const [isGridSearching, setIsGridSearching] = useState(false);

  const selectedTechnologies = store.getAllSelectedTechnologies();
  const rows = buildSourceRows(selectedTechnologies, matrix, store.sourceSelections, store.boundSkills);

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
      // Don't handle Enter/Escape while search modal is open
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
    return (
      <Box flexDirection="column" width="100%">
        <ViewTitle>Customize skill sources</ViewTitle>
        <SourceGrid
          rows={rows}
          focusedRow={gridFocusedRow}
          focusedCol={gridFocusedCol}
          onSelect={handleGridSelect}
          onFocusChange={handleGridFocusChange}
          onSearch={handleSearch}
          onBind={handleBind}
          onSearchStateChange={handleSearchStateChange}
        />
      </Box>
    );
  }

  const isRecommendedSelected = choiceIndex === 0;
  const hasLocalSkills = rows.some((row) => row.options.some((o) => o.installed && o.id === "local"));

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
          {!hasLocalSkills && <Text dimColor>maintained by Claude Collective.</Text>}
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
