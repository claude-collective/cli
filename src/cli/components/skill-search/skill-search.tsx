import React, { useState, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { ThemeProvider } from "@inkjs/ui";
import { cliTheme } from "../themes/default.js";
import type { ResolvedSkill, SkillId } from "../../types/index.js";
import { CLI_COLORS, UI_SYMBOLS, UI_LAYOUT } from "../../consts.js";
import { useTextInput } from "../hooks/use-text-input.js";
import { useFilteredResults } from "../hooks/use-filtered-results.js";

export type SourcedSkill = ResolvedSkill & {
  sourceName: string;
  sourceUrl?: string;
};

export type SkillSearchResult = {
  selectedSkills: SourcedSkill[];
  cancelled: boolean;
};

export type SkillSearchProps = {
  skills: SourcedSkill[];
  sourceCount: number;
  initialQuery?: string;
  onComplete: (result: SkillSearchResult) => void;
  onCancel: () => void;
};

const { MAX_VISIBLE_RESULTS, DESCRIPTION_WIDTH, COPIED_MESSAGE_TIMEOUT_MS, FALLBACK_MESSAGE_TIMEOUT_MS } = UI_LAYOUT;
const { CHECKBOX_CHECKED, CHECKBOX_UNCHECKED } = UI_SYMBOLS;

function matchesQuery(skill: SourcedSkill, query: string): boolean {
  if (!query.trim()) return true;

  const lowerQuery = query.toLowerCase();

  if (skill.id.toLowerCase().includes(lowerQuery)) return true;
  if (skill.displayName?.toLowerCase().includes(lowerQuery)) return true;
  if (skill.description.toLowerCase().includes(lowerQuery)) return true;
  if (skill.category.toLowerCase().includes(lowerQuery)) return true;
  if (skill.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) return true;
  if (skill.sourceName.toLowerCase().includes(lowerQuery)) return true;

  return false;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

type HeaderProps = {
  sourceCount: number;
};

const Header: React.FC<HeaderProps> = ({ sourceCount }) => {
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      borderStyle="single"
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
    >
      <Text bold color={CLI_COLORS.PRIMARY}>
        Search Skills
      </Text>
      <Text dimColor>
        {sourceCount} source{sourceCount !== 1 ? "s" : ""}
      </Text>
    </Box>
  );
};

type SearchInputProps = {
  value: string;
};

const SearchInput: React.FC<SearchInputProps> = ({ value }) => {
  return (
    <Box paddingX={1} paddingY={1}>
      <Text color={CLI_COLORS.FOCUS}>{">"} </Text>
      <Text>{value}</Text>
      <Text color={CLI_COLORS.FOCUS}>_</Text>
    </Box>
  );
};

type ResultItemProps = {
  skill: SourcedSkill;
  isSelected: boolean;
  isFocused: boolean;
};

const ResultItem: React.FC<ResultItemProps> = ({ skill, isSelected, isFocused }) => {
  const checkbox = isSelected ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED;
  const displayName = skill.displayName || skill.id;
  return (
    <Box flexDirection="row" gap={1}>
      <Text
        color={isFocused ? CLI_COLORS.FOCUS : isSelected ? CLI_COLORS.SUCCESS : undefined}
        bold={isFocused}
        backgroundColor={isFocused ? "#333333" : undefined}
      >
        {" "}
        {checkbox}{" "}
      </Text>
      <Box width={14}>
        <Text dimColor>{truncate(skill.sourceName, 12)}</Text>
      </Box>
      <Box width={24}>
        <Text color={isFocused ? CLI_COLORS.FOCUS : undefined} bold={isFocused || isSelected}>
          {truncate(displayName, 22)}
        </Text>
      </Box>
      <Text dimColor>{truncate(skill.description, DESCRIPTION_WIDTH)}</Text>
    </Box>
  );
};

type ResultsListProps = {
  results: SourcedSkill[];
  selectedIds: Set<SkillId>;
  focusedIndex: number;
  scrollOffset: number;
};

const ResultsList: React.FC<ResultsListProps> = ({
  results,
  selectedIds,
  focusedIndex,
  scrollOffset,
}) => {
  const visibleResults = results.slice(scrollOffset, scrollOffset + MAX_VISIBLE_RESULTS);

  if (results.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>No skills found matching your search.</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderTop={false}
      borderBottom={false}
      paddingX={1}
    >
      {visibleResults.map((skill, index) => {
        const actualIndex = scrollOffset + index;
        return (
          <ResultItem
            key={skill.id}
            skill={skill}
            isSelected={selectedIds.has(skill.id)}
            isFocused={actualIndex === focusedIndex}
          />
        );
      })}
    </Box>
  );
};

type StatusBarProps = {
  resultCount: number;
  selectedCount: number;
};

const StatusBar: React.FC<StatusBarProps> = ({ resultCount, selectedCount }) => {
  return (
    <Box paddingX={1}>
      <Text dimColor>
        {resultCount} result{resultCount !== 1 ? "s" : ""}
        {selectedCount > 0 && <Text color={CLI_COLORS.SUCCESS}> | {selectedCount} selected</Text>}
      </Text>
    </Box>
  );
};

type FooterProps = {
  hasSelection: boolean;
};

const Footer: React.FC<FooterProps> = ({ hasSelection }) => {
  return (
    <Box
      flexDirection="row"
      justifyContent="center"
      gap={2}
      borderStyle="single"
      borderTop={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
      marginTop={1}
    >
      <Text dimColor>
        <Text color={CLI_COLORS.UNFOCUSED}>j/k</Text> navigate
      </Text>
      <Text dimColor>
        <Text color={CLI_COLORS.UNFOCUSED}>SPACE</Text> select
      </Text>
      {hasSelection && (
        <Text dimColor>
          <Text color={CLI_COLORS.SUCCESS}>ENTER</Text> import
        </Text>
      )}
      <Text dimColor>
        <Text color={CLI_COLORS.UNFOCUSED}>c</Text> copy link
      </Text>
      <Text dimColor>
        <Text color={CLI_COLORS.WARNING}>ESC</Text> cancel
      </Text>
    </Box>
  );
};

export const SkillSearch: React.FC<SkillSearchProps> = ({
  skills,
  sourceCount,
  initialQuery = "",
  onComplete,
  onCancel,
}) => {
  const { exit } = useApp();

  const { value: query, handleInput: handleTextInput } = useTextInput(initialQuery);
  const [selectedIds, setSelectedIds] = useState<Set<SkillId>>(new Set());
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  const {
    filteredResults,
    safeFocusedIndex,
    focusedItem: focusedSkill,
    scrollOffset,
    moveUp,
    moveDown,
  } = useFilteredResults({
    items: skills,
    query,
    filterFn: matchesQuery,
    maxVisible: MAX_VISIBLE_RESULTS,
  });

  const toggleSelection = useCallback((skillId: SkillId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  }, []);

  const copySkillLink = useCallback(async (skill: SourcedSkill) => {
    const link = skill.sourceUrl ? `${skill.sourceUrl}/${skill.id}` : skill.id;

    try {
      // OSC 52 terminal clipboard escape sequence
      const encoded = Buffer.from(link).toString("base64");
      process.stdout.write(`\x1b]52;c;${encoded}\x07`);
      setCopiedMessage(`Copied: ${link}`);
      setTimeout(() => setCopiedMessage(null), COPIED_MESSAGE_TIMEOUT_MS);
    } catch {
      setCopiedMessage(`Link: ${link}`);
      setTimeout(() => setCopiedMessage(null), FALLBACK_MESSAGE_TIMEOUT_MS);
    }
  }, []);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      exit();
      return;
    }

    if (key.return) {
      if (selectedIds.size > 0) {
        const selectedSkills = filteredResults.filter((s) => selectedIds.has(s.id));
        onComplete({
          selectedSkills,
          cancelled: false,
        });
        exit();
      }
      return;
    }

    if (input === " " && focusedSkill) {
      toggleSelection(focusedSkill.id);
      return;
    }

    if ((input === "c" || input === "C") && focusedSkill) {
      void copySkillLink(focusedSkill);
      return;
    }

    const isUp = key.upArrow || input === "k";
    const isDown = key.downArrow || input === "j";

    if (isUp) {
      moveUp();
    }

    if (isDown) {
      moveDown();
    }

    handleTextInput(input, key);
  });

  return (
    <ThemeProvider theme={cliTheme}>
      <Box flexDirection="column">
        <Header sourceCount={sourceCount} />
        <SearchInput value={query} />
        <ResultsList
          results={filteredResults}
          selectedIds={selectedIds}
          focusedIndex={safeFocusedIndex}
          scrollOffset={scrollOffset}
        />
        <StatusBar resultCount={filteredResults.length} selectedCount={selectedIds.size} />
        {copiedMessage && (
          <Box paddingX={1}>
            <Text color={CLI_COLORS.SUCCESS}>{copiedMessage}</Text>
          </Box>
        )}
        <Footer hasSelection={selectedIds.size > 0} />
      </Box>
    </ThemeProvider>
  );
};
