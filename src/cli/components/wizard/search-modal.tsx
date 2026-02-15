import React, { useCallback } from "react";
import { Box, Text } from "ink";
import type { BoundSkillCandidate } from "../../types/index.js";
import { CLI_COLORS } from "../../consts.js";
import { useKeyboardNavigation } from "../hooks/use-keyboard-navigation.js";

export type SearchModalProps = {
  results: BoundSkillCandidate[];
  alias: string;
  onBind: (candidate: BoundSkillCandidate) => void;
  onClose: () => void;
};

const MARKER_FOCUSED = "\u25B8";
const MARKER_SPACER = " ";

type ResultRowProps = {
  candidate: BoundSkillCandidate;
  isFocused: boolean;
};

const ResultRow: React.FC<ResultRowProps> = ({ candidate, isFocused }) => {
  const marker = isFocused ? MARKER_FOCUSED : MARKER_SPACER;
  const versionLabel = candidate.version != null ? `v${candidate.version}` : "";
  const sourceLabel = `${candidate.sourceName}/${candidate.id}`;

  return (
    <Box>
      <Text bold={isFocused} color={isFocused ? CLI_COLORS.PRIMARY : undefined}>
        {marker}{" "}
      </Text>
      <Text bold={isFocused} color={isFocused ? CLI_COLORS.PRIMARY : undefined}>
        {sourceLabel}
      </Text>
      {versionLabel && (
        <Text dimColor>
          {"   "}
          {versionLabel}
        </Text>
      )}
      {candidate.description && (
        <Text dimColor>
          {"   "}
          {candidate.description}
        </Text>
      )}
    </Box>
  );
};

export const SearchModal: React.FC<SearchModalProps> = ({ results, alias, onBind, onClose }) => {
  const handleEnter = useCallback(
    (index: number) => {
      if (results.length > 0) {
        const selected = results[index];
        if (selected) {
          onBind(selected);
        }
      }
    },
    [results, onBind],
  );

  const { focusedIndex } = useKeyboardNavigation(
    results.length,
    { onEnter: handleEnter, onEscape: onClose },
    { vimKeys: false },
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={CLI_COLORS.NEUTRAL}
      paddingX={1}
      paddingY={0}
      marginTop={1}
    >
      <Text bold>Search results for &quot;{alias}&quot;</Text>
      <Text> </Text>

      {results.length === 0 ? (
        <Text dimColor>No results found</Text>
      ) : (
        results.map((candidate, index) => (
          <ResultRow
            key={`${candidate.sourceName}-${candidate.id}`}
            candidate={candidate}
            isFocused={index === focusedIndex}
          />
        ))
      )}

      <Text> </Text>
      <Text dimColor>
        {"\u2191"}/{"\u2193"} navigate ENTER bind ESC close
      </Text>
    </Box>
  );
};
