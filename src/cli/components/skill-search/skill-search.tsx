import React, { useState, useCallback, useMemo } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { ThemeProvider } from "@inkjs/ui";
import { cliTheme } from "../themes/default.js";
import type { ResolvedSkill, SkillId } from "../../types/index.js";

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

const MAX_VISIBLE_RESULTS = 10;
const CHECKBOX_CHECKED = "[x]";
const CHECKBOX_UNCHECKED = "[ ]";

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
      <Text bold color="cyan">
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
  onChange: (value: string) => void;
};

const SearchInput: React.FC<SearchInputProps> = ({ value, onChange }) => {
  useInput((input, key) => {
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input && input.length === 1) {
      // Only handle printable characters
      const charCode = input.charCodeAt(0);
      if (charCode >= 32 && charCode <= 126) {
        onChange(value + input);
      }
    }
  });

  return (
    <Box paddingX={1} paddingY={1}>
      <Text color="cyan">{">"} </Text>
      <Text>{value}</Text>
      <Text color="cyan">_</Text>
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
  const descriptionWidth = 30;

  return (
    <Box flexDirection="row" gap={1}>
      <Text
        color={isFocused ? "cyan" : isSelected ? "green" : undefined}
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
        <Text color={isFocused ? "cyan" : undefined} bold={isFocused || isSelected}>
          {truncate(displayName, 22)}
        </Text>
      </Box>
      <Text dimColor>{truncate(skill.description, descriptionWidth)}</Text>
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
        {selectedCount > 0 && <Text color="green"> | {selectedCount} selected</Text>}
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
        <Text color="white">j/k</Text> navigate
      </Text>
      <Text dimColor>
        <Text color="white">SPACE</Text> select
      </Text>
      {hasSelection && (
        <Text dimColor>
          <Text color="green">ENTER</Text> import
        </Text>
      )}
      <Text dimColor>
        <Text color="white">c</Text> copy link
      </Text>
      <Text dimColor>
        <Text color="yellow">ESC</Text> cancel
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

  const [query, setQuery] = useState(initialQuery);
  const [selectedIds, setSelectedIds] = useState<Set<SkillId>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  const filteredResults = useMemo(() => {
    return skills.filter((skill) => matchesQuery(skill, query));
  }, [skills, query]);

  const safeFocusedIndex = Math.min(focusedIndex, Math.max(0, filteredResults.length - 1));
  const focusedSkill = filteredResults[safeFocusedIndex];

  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setFocusedIndex(0);
    setScrollOffset(0);
  }, []);

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
      setTimeout(() => setCopiedMessage(null), 2000);
    } catch {
      setCopiedMessage(`Link: ${link}`);
      setTimeout(() => setCopiedMessage(null), 3000);
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

    if (isUp && safeFocusedIndex > 0) {
      const newIndex = safeFocusedIndex - 1;
      setFocusedIndex(newIndex);
      if (newIndex < scrollOffset) {
        setScrollOffset(newIndex);
      }
    }

    if (isDown && safeFocusedIndex < filteredResults.length - 1) {
      const newIndex = safeFocusedIndex + 1;
      setFocusedIndex(newIndex);
      if (newIndex >= scrollOffset + MAX_VISIBLE_RESULTS) {
        setScrollOffset(newIndex - MAX_VISIBLE_RESULTS + 1);
      }
    }
  });

  return (
    <ThemeProvider theme={cliTheme}>
      <Box flexDirection="column">
        <Header sourceCount={sourceCount} />
        <SearchInput value={query} onChange={handleQueryChange} />
        <ResultsList
          results={filteredResults}
          selectedIds={selectedIds}
          focusedIndex={safeFocusedIndex}
          scrollOffset={scrollOffset}
        />
        <StatusBar resultCount={filteredResults.length} selectedCount={selectedIds.size} />
        {copiedMessage && (
          <Box paddingX={1}>
            <Text color="green">{copiedMessage}</Text>
          </Box>
        )}
        <Footer hasSelection={selectedIds.size > 0} />
      </Box>
    </ThemeProvider>
  );
};
