import React, { useCallback, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { BoundSkillCandidate, SkillAlias, SkillId } from "../../types/index.js";
import { SearchModal } from "./search-modal.js";

const SEARCH_PILL_LABEL = "\u2315 Search";

export type SourceOption = {
  id: string;
  label: string;
  selected: boolean;
  installed: boolean;
};

export type SourceRow = {
  skillId: SkillId;
  displayName: string;
  alias: SkillAlias;
  options: SourceOption[];
};

export type SourceGridProps = {
  rows: SourceRow[];
  focusedRow: number;
  focusedCol: number;
  onSelect: (skillId: SkillId, sourceId: string) => void;
  onFocusChange: (row: number, col: number) => void;
  onSearch?: (alias: SkillAlias) => Promise<BoundSkillCandidate[]>;
  onBind?: (candidate: BoundSkillCandidate) => void;
  onSearchStateChange?: (active: boolean) => void;
};

type SearchPillProps = {
  isFocused: boolean;
};

const SearchPill: React.FC<SearchPillProps> = ({ isFocused }) => {
  const borderColor = isFocused ? "white" : "gray";

  return (
    <Box marginRight={1} borderColor={borderColor} borderStyle="single" borderDimColor={!isFocused}>
      <Text dimColor={!isFocused} bold={isFocused}>
        {" "}
        {SEARCH_PILL_LABEL}{" "}
      </Text>
    </Box>
  );
};

type SourceSectionProps = {
  row: SourceRow;
  isFocused: boolean;
  focusedOptionIndex: number;
  showSearchPill: boolean;
};

const SourceTag: React.FC<{ option: SourceOption; isFocused: boolean }> = ({
  option,
  isFocused,
}) => {
  const borderColor = option.selected ? "cyan" : isFocused ? "white" : "gray";
  const textColor = option.selected ? "cyan" : undefined;
  const isBold = isFocused || option.selected;

  return (
    <Box marginRight={1} borderColor={borderColor} borderStyle="single">
      <Text color={textColor} bold={isBold}>
        {" "}
        {option.label}{" "}
      </Text>
    </Box>
  );
};

const SourceSection: React.FC<SourceSectionProps> = ({
  row,
  isFocused,
  focusedOptionIndex,
  showSearchPill,
}) => {
  const searchPillIndex = row.options.length;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row">
        <Text>{row.displayName}</Text>
      </Box>

      <Box flexDirection="row" flexWrap="wrap" marginTop={0}>
        {row.options.map((option, index) => (
          <SourceTag
            key={option.id}
            option={option}
            isFocused={isFocused && index === focusedOptionIndex}
          />
        ))}
        {showSearchPill && (
          <SearchPill isFocused={isFocused && focusedOptionIndex === searchPillIndex} />
        )}
      </Box>
    </Box>
  );
};

/** Total navigable columns for a row (options + search pill if applicable) */
const getNavigableCount = (row: SourceRow, showSearchPill: boolean): number => {
  return row.options.length + (showSearchPill ? 1 : 0);
};

export const SourceGrid: React.FC<SourceGridProps> = ({
  rows,
  focusedRow,
  focusedCol,
  onSelect,
  onFocusChange,
  onSearch,
  onBind,
  onSearchStateChange,
}) => {
  const [searchingRow, setSearchingRow] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<BoundSkillCandidate[]>([]);
  const [searchAlias, setSearchAlias] = useState("");

  const showSearchPill = !!onSearch;
  const isSearchActive = searchingRow !== null;

  const handleSearchTrigger = useCallback(
    async (rowIndex: number) => {
      const row = rows[rowIndex];
      if (!row || !onSearch) return;

      const alias = row.alias;
      setSearchAlias(alias);
      setSearchingRow(rowIndex);
      onSearchStateChange?.(true);

      const results = await onSearch(alias);
      setSearchResults(results);
    },
    [rows, onSearch, onSearchStateChange],
  );

  const handleBind = useCallback(
    (candidate: BoundSkillCandidate) => {
      onBind?.(candidate);
      setSearchingRow(null);
      setSearchResults([]);
      setSearchAlias("");
      onSearchStateChange?.(false);
    },
    [onBind, onSearchStateChange],
  );

  const handleCloseSearch = useCallback(() => {
    setSearchingRow(null);
    setSearchResults([]);
    setSearchAlias("");
    onSearchStateChange?.(false);
  }, [onSearchStateChange]);

  useInput(
    useCallback(
      (
        input: string,
        key: {
          leftArrow: boolean;
          rightArrow: boolean;
          upArrow: boolean;
          downArrow: boolean;
          return: boolean;
        },
      ) => {
        // Don't handle grid input while search modal is open
        if (isSearchActive) return;

        if (input === " ") {
          const currentRow = rows[focusedRow];
          if (!currentRow) return;
          // Space on search pill triggers search
          if (showSearchPill && focusedCol === currentRow.options.length) {
            void handleSearchTrigger(focusedRow);
            return;
          }
          // Space on a source option toggles selection
          if (focusedCol < currentRow.options.length) {
            const currentOption = currentRow.options[focusedCol];
            if (currentOption) {
              onSelect(currentRow.skillId, currentOption.id);
            }
          }
          return;
        }

        const isLeft = key.leftArrow;
        const isRight = key.rightArrow;
        const isUp = key.upArrow;
        const isDown = key.downArrow;

        if (isLeft) {
          const currentRow = rows[focusedRow];
          if (!currentRow) return;
          const length = getNavigableCount(currentRow, showSearchPill);
          const newCol = focusedCol <= 0 ? length - 1 : focusedCol - 1;
          onFocusChange(focusedRow, newCol);
        } else if (isRight) {
          const currentRow = rows[focusedRow];
          if (!currentRow) return;
          const length = getNavigableCount(currentRow, showSearchPill);
          const newCol = focusedCol >= length - 1 ? 0 : focusedCol + 1;
          onFocusChange(focusedRow, newCol);
        } else if (isUp) {
          const length = rows.length;
          const newRow = focusedRow <= 0 ? length - 1 : focusedRow - 1;
          const newRowData = rows[newRow];
          const maxCol = newRowData ? getNavigableCount(newRowData, showSearchPill) - 1 : 0;
          const newCol = Math.min(focusedCol, maxCol);
          onFocusChange(newRow, Math.max(0, newCol));
        } else if (isDown) {
          const length = rows.length;
          const newRow = focusedRow >= length - 1 ? 0 : focusedRow + 1;
          const newRowData = rows[newRow];
          const maxCol = newRowData ? getNavigableCount(newRowData, showSearchPill) - 1 : 0;
          const newCol = Math.min(focusedCol, maxCol);
          onFocusChange(newRow, Math.max(0, newCol));
        }
      },
      [
        rows,
        focusedRow,
        focusedCol,
        onSelect,
        onFocusChange,
        showSearchPill,
        isSearchActive,
        handleSearchTrigger,
      ],
    ),
  );

  if (rows.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No skills to display.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {rows.map((row, rowIndex) => (
        <SourceSection
          key={row.skillId}
          row={row}
          isFocused={rowIndex === focusedRow}
          focusedOptionIndex={focusedCol}
          showSearchPill={showSearchPill}
        />
      ))}
      {isSearchActive && (
        <SearchModal
          results={searchResults}
          alias={searchAlias}
          onBind={handleBind}
          onClose={handleCloseSearch}
        />
      )}
    </Box>
  );
};
