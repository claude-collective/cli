/**
 * Interactive skill search component.
 *
 * Features:
 * - Live text filtering as you type
 * - Multi-select checkboxes
 * - Keyboard navigation (arrows, vim keys, space, enter, c, esc)
 * - Source attribution for each skill
 *
 * Keyboard controls:
 * - Up/Down/k/j: Navigate results
 * - Space: Toggle selection
 * - Enter: Import selected skills
 * - c: Copy link of focused skill
 * - Esc: Cancel/exit
 */
import React, { useState, useCallback, useMemo } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { ThemeProvider } from "@inkjs/ui";
import { cliTheme } from "../themes/default.js";
import type { ResolvedSkill, SkillId } from "../../types/index.js";

// =============================================================================
// Types
// =============================================================================

export type SourcedSkill = ResolvedSkill & {
  /** Source name where this skill came from */
  sourceName: string;
  /** Source URL for reference */
  sourceUrl?: string;
};

export type SkillSearchResult = {
  /** Skills selected for import */
  selectedSkills: SourcedSkill[];
  /** Whether the user cancelled */
  cancelled: boolean;
};

export type SkillSearchProps = {
  /** All available skills from all sources */
  skills: SourcedSkill[];
  /** Total number of sources */
  sourceCount: number;
  /** Initial search query (from command args) */
  initialQuery?: string;
  /** Called when user completes selection (Enter) */
  onComplete: (result: SkillSearchResult) => void;
  /** Called when user cancels (Esc) */
  onCancel: () => void;
};

// =============================================================================
// Constants
// =============================================================================

/** Maximum results to show at once */
const MAX_VISIBLE_RESULTS = 10;

/** Checkbox display */
const CHECKBOX_CHECKED = "[x]";
const CHECKBOX_UNCHECKED = "[ ]";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Match skill against search query (case-insensitive substring)
 */
function matchesQuery(skill: SourcedSkill, query: string): boolean {
  if (!query.trim()) return true;

  const lowerQuery = query.toLowerCase();

  // Match against ID
  if (skill.id.toLowerCase().includes(lowerQuery)) return true;

  // Match against display name
  if (skill.displayName?.toLowerCase().includes(lowerQuery)) return true;

  // Match against description
  if (skill.description.toLowerCase().includes(lowerQuery)) return true;

  // Match against category
  if (skill.category.toLowerCase().includes(lowerQuery)) return true;

  // Match against tags
  if (skill.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
    return true;
  }

  // Match against source name
  if (skill.sourceName.toLowerCase().includes(lowerQuery)) return true;

  return false;
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// =============================================================================
// Sub-Components
// =============================================================================

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
  // Handle text input
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

// =============================================================================
// Main Component
// =============================================================================

export const SkillSearch: React.FC<SkillSearchProps> = ({
  skills,
  sourceCount,
  initialQuery = "",
  onComplete,
  onCancel,
}) => {
  const { exit } = useApp();

  // State
  const [query, setQuery] = useState(initialQuery);
  const [selectedIds, setSelectedIds] = useState<Set<SkillId>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  // Filter results based on query
  const filteredResults = useMemo(() => {
    return skills.filter((skill) => matchesQuery(skill, query));
  }, [skills, query]);

  // Ensure focus stays in bounds when results change
  const safeFocusedIndex = Math.min(focusedIndex, Math.max(0, filteredResults.length - 1));

  // Get the currently focused skill
  const focusedSkill = filteredResults[safeFocusedIndex];

  // Handle query change
  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setFocusedIndex(0);
    setScrollOffset(0);
  }, []);

  // Toggle selection
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

  // Copy skill link to clipboard
  const copySkillLink = useCallback(async (skill: SourcedSkill) => {
    const link = skill.sourceUrl ? `${skill.sourceUrl}/${skill.id}` : skill.id;

    try {
      // Use native clipboard API via process.stdout.write with OSC 52
      // This is a cross-platform terminal clipboard method
      const encoded = Buffer.from(link).toString("base64");
      process.stdout.write(`\x1b]52;c;${encoded}\x07`);
      setCopiedMessage(`Copied: ${link}`);
      setTimeout(() => setCopiedMessage(null), 2000);
    } catch {
      setCopiedMessage(`Link: ${link}`);
      setTimeout(() => setCopiedMessage(null), 3000);
    }
  }, []);

  // Handle keyboard navigation
  useInput((input, key) => {
    // Escape to cancel
    if (key.escape) {
      onCancel();
      exit();
      return;
    }

    // Enter to import selected
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

    // Space to toggle selection
    if (input === " " && focusedSkill) {
      toggleSelection(focusedSkill.id);
      return;
    }

    // c to copy link
    if ((input === "c" || input === "C") && focusedSkill) {
      void copySkillLink(focusedSkill);
      return;
    }

    // Navigation
    const isUp = key.upArrow || input === "k";
    const isDown = key.downArrow || input === "j";

    if (isUp && safeFocusedIndex > 0) {
      const newIndex = safeFocusedIndex - 1;
      setFocusedIndex(newIndex);
      // Scroll up if needed
      if (newIndex < scrollOffset) {
        setScrollOffset(newIndex);
      }
    }

    if (isDown && safeFocusedIndex < filteredResults.length - 1) {
      const newIndex = safeFocusedIndex + 1;
      setFocusedIndex(newIndex);
      // Scroll down if needed
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
