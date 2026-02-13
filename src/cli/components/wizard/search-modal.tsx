import React, { useCallback, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { BoundSkillCandidate } from "../../types/index.js";

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
      <Text bold={isFocused} color={isFocused ? "cyan" : undefined}>
        {marker}{" "}
      </Text>
      <Text bold={isFocused} color={isFocused ? "cyan" : undefined}>
        {sourceLabel}
      </Text>
      {versionLabel && (
        <Text dimColor>{"   "}{versionLabel}</Text>
      )}
      {candidate.description && (
        <Text dimColor>{"   "}{candidate.description}</Text>
      )}
    </Box>
  );
};

export const SearchModal: React.FC<SearchModalProps> = ({
  results,
  alias,
  onBind,
  onClose,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(0);

  useInput(
    useCallback(
      (_input: string, key: { upArrow: boolean; downArrow: boolean; return: boolean; escape: boolean }) => {
        if (key.escape) {
          onClose();
          return;
        }

        if (key.return && results.length > 0) {
          const selected = results[focusedIndex];
          if (selected) {
            onBind(selected);
          }
          return;
        }

        if (key.upArrow) {
          setFocusedIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
          return;
        }

        if (key.downArrow) {
          setFocusedIndex((prev) => (prev >= results.length - 1 ? 0 : prev + 1));
          return;
        }
      },
      [results, focusedIndex, onBind, onClose],
    ),
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      paddingY={0}
      marginTop={1}
    >
      <Text bold>
        Search results for &quot;{alias}&quot;
      </Text>
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
        {"\u2191"}/{"\u2193"} navigate   ENTER bind   ESC close
      </Text>
    </Box>
  );
};
