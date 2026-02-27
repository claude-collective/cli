import React, { useCallback } from "react";
import { Box, Text, useInput } from "ink";
import type { BoundSkillCandidate, SkillAlias, SkillId } from "../../types/index.js";
import { CLI_COLORS } from "../../consts.js";
import { useFocusedListItem } from "../hooks/use-focused-list-item.js";
import { useSectionScroll } from "../hooks/use-section-scroll.js";
import { useSourceGridSearchModal } from "../hooks/use-source-grid-search-modal.js";
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
  /** Available height in terminal lines for the scrollable viewport. 0 = no constraint. */
  availableHeight?: number;
  onSelect: (skillId: SkillId, sourceId: string) => void;
  onSearch?: (alias: SkillAlias) => Promise<BoundSkillCandidate[]>;
  onBind?: (candidate: BoundSkillCandidate) => void;
  onSearchStateChange?: (active: boolean) => void;
  /** Optional initial focus row (default: 0). Use with React `key` to reset. */
  defaultFocusedRow?: number;
  /** Optional initial focus col (default: 0). Use with React `key` to reset. */
  defaultFocusedCol?: number;
  /** Optional callback fired whenever the focused position changes */
  onFocusChange?: (row: number, col: number) => void;
};

type SearchPillProps = {
  isFocused: boolean;
};

const SearchPill: React.FC<SearchPillProps> = ({ isFocused }) => {
  const borderColor = isFocused ? CLI_COLORS.UNFOCUSED : CLI_COLORS.NEUTRAL;

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
  const getBorderColor = (): string => {
    if (isFocused) {
      return option.selected ? CLI_COLORS.PRIMARY : CLI_COLORS.UNFOCUSED;
    }
    return CLI_COLORS.NEUTRAL;
  };

  const textColor = option.selected ? CLI_COLORS.PRIMARY : CLI_COLORS.NEUTRAL;
  const isBold = isFocused || option.selected;

  return (
    <Box
      marginRight={1}
      borderColor={getBorderColor()}
      borderStyle="single"
      borderDimColor={!isFocused}
    >
      <Text color={textColor} bold={isBold} dimColor={false}>
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
  availableHeight = 0,
  onSelect,
  onSearch,
  onBind,
  onSearchStateChange,
  defaultFocusedRow = 0,
  defaultFocusedCol = 0,
  onFocusChange,
}) => {
  const {
    searchModal,
    searchResults,
    searchAlias,
    handleSearchTrigger,
    handleBind,
    handleCloseSearch,
  } = useSourceGridSearchModal({ rows, onSearch, onBind, onSearchStateChange });

  const showSearchPill = !!onSearch;

  const getColCount = useCallback(
    (row: number): number => {
      const rowData = rows[row];
      return rowData ? getNavigableCount(rowData, showSearchPill) : 0;
    },
    [rows, showSearchPill],
  );

  const { focusedRow, focusedCol, moveFocus } = useFocusedListItem(rows.length, getColCount, {
    wrap: true,
    onChange: onFocusChange,
    initialRow: defaultFocusedRow,
    initialCol: defaultFocusedCol,
  });

  const { setSectionRef, scrollEnabled, scrollTopPx } = useSectionScroll({
    sectionCount: rows.length,
    focusedIndex: focusedRow,
    availableHeight,
  });

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
        if (input === " ") {
          const currentRow = rows[focusedRow];
          if (!currentRow) return;
          if (showSearchPill && focusedCol === currentRow.options.length) {
            void handleSearchTrigger(focusedRow);
            return;
          }
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
          moveFocus("left");
        } else if (isRight) {
          moveFocus("right");
        } else if (isUp) {
          moveFocus("up");
        } else if (isDown) {
          moveFocus("down");
        }
      },
      [rows, focusedRow, focusedCol, onSelect, showSearchPill, handleSearchTrigger, moveFocus],
    ),
    { isActive: !searchModal.isOpen },
  );

  if (rows.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No skills to display.</Text>
      </Box>
    );
  }

  const noShrink = scrollEnabled ? { flexShrink: 0 } : {};

  const sectionElements = rows.map((row, rowIndex) => (
    <Box key={row.skillId} ref={(el) => setSectionRef(rowIndex, el)} {...noShrink}>
      <SourceSection
        row={row}
        isFocused={rowIndex === focusedRow}
        focusedOptionIndex={focusedCol}
        showSearchPill={showSearchPill}
      />
    </Box>
  ));

  const searchModalElement = searchModal.isOpen && (
    <SearchModal
      results={searchResults}
      alias={searchAlias}
      onBind={handleBind}
      onClose={handleCloseSearch}
    />
  );

  return (
    <Box
      flexDirection="column"
      {...(scrollEnabled ? { height: availableHeight } : { flexGrow: 1 })}
    >
      <Box flexDirection="column" overflow="hidden" flexGrow={1}>
        <Box flexDirection="column" marginTop={scrollTopPx > 0 ? -scrollTopPx : 0} {...noShrink}>
          {sectionElements}
        </Box>
      </Box>
      {searchModalElement}
    </Box>
  );
};
