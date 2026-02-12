import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { ViewTitle } from "./view-title.js";
import { getSourceSummary, type SourceSummary } from "../../lib/configuration/source-manager.js";
import { addSource, removeSource } from "../../lib/configuration/source-manager.js";
import { DEFAULT_SOURCE } from "../../lib/configuration/config.js";

const DEFAULT_SOURCE_NAME = "public";
const MIN_PRINTABLE_CHAR_CODE = 32;
const MAX_PRINTABLE_CHAR_CODE = 126;

export type StepSettingsProps = {
  projectDir: string;
  onClose: () => void;
};

export const StepSettings: React.FC<StepSettingsProps> = ({ projectDir, onClose }) => {
  const [summary, setSummary] = useState<SourceSummary | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [addSourceInput, setAddSourceInput] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ text: string; color: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    try {
      const result = await getSourceSummary(projectDir);
      setSummary(result);
    } catch {
      setSummary({ sources: [{ name: DEFAULT_SOURCE_NAME, url: DEFAULT_SOURCE, enabled: true }], localSkillCount: 0, pluginSkillCount: 0 });
    }
    setIsLoading(false);
  }, [projectDir]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const sourceCount = summary?.sources.length ?? 0;

  useInput((input, key) => {
    // Clear status message on any input
    if (statusMessage) {
      setStatusMessage(null);
    }

    if (isAddingSource) {
      if (key.escape) {
        setIsAddingSource(false);
        setAddSourceInput("");
        return;
      }

      if (key.return) {
        if (addSourceInput.trim()) {
          void handleAddSource(addSourceInput.trim());
        }
        return;
      }

      if (key.backspace || key.delete) {
        setAddSourceInput((prev) => prev.slice(0, -1));
        return;
      }

      // Capture printable characters
      if (input && input.length === 1) {
        const code = input.charCodeAt(0);
        if (code >= MIN_PRINTABLE_CHAR_CODE && code <= MAX_PRINTABLE_CHAR_CODE) {
          setAddSourceInput((prev) => prev + input);
        }
      }
      return;
    }

    // Non-adding mode keyboard handling
    if (key.escape) {
      onClose();
      return;
    }

    if (key.upArrow) {
      setFocusedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setFocusedIndex((prev) => Math.min(sourceCount - 1, prev - 0 + 1));
      return;
    }

    if (key.return) {
      // Toggle enabled/disabled is a placeholder for future enabledSources store integration
      return;
    }

    if (key.backspace || key.delete) {
      if (summary && summary.sources[focusedIndex]) {
        const source = summary.sources[focusedIndex];
        if (source.name !== DEFAULT_SOURCE_NAME) {
          void handleRemoveSource(source.name);
        }
      }
      return;
    }

    if (input === "a" || input === "A") {
      setIsAddingSource(true);
      setAddSourceInput("");
      return;
    }
  });

  const handleAddSource = async (url: string) => {
    setIsAddingSource(false);
    setAddSourceInput("");
    try {
      const result = await addSource(projectDir, url);
      setStatusMessage({ text: `Added "${result.name}" (${result.skillCount} skills)`, color: "green" });
      await loadSummary();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage({ text: `Failed to add source: ${message}`, color: "red" });
    }
  };

  const handleRemoveSource = async (name: string) => {
    try {
      await removeSource(projectDir, name);
      setStatusMessage({ text: `Removed "${name}"`, color: "green" });
      setFocusedIndex((prev) => Math.max(0, prev - 1));
      await loadSummary();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage({ text: `Failed to remove: ${message}`, color: "red" });
    }
  };

  if (isLoading) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <ViewTitle>Skill Sources</ViewTitle>
        <Text dimColor>Loading sources...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2}>
      <ViewTitle>Skill Sources</ViewTitle>
      <Box marginTop={1} />

      <Text bold>Configured marketplaces:</Text>
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
        {summary?.sources.map((source, index) => {
          const isFocused = index === focusedIndex && !isAddingSource;
          const isDefault = source.name === DEFAULT_SOURCE_NAME;
          const checkmark = source.enabled ? "\u2713" : " ";
          const displayName = isDefault ? "Public" : source.name;
          const suffix = isDefault ? " (default)" : "";

          return (
            <Box key={source.name}>
              <Text color={isFocused ? "cyan" : undefined} bold={isFocused}>
                {isFocused ? ">" : " "} {checkmark} {displayName}
              </Text>
              <Text dimColor>
                {"  "}
                {source.url}
                {suffix}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box flexDirection="column" borderStyle="round" borderColor={isAddingSource ? "cyan" : "gray"} paddingX={1} marginTop={1}>
        <Text color={isAddingSource ? "cyan" : undefined}>
          + Add source: {isAddingSource ? addSourceInput : ""}
          {isAddingSource ? "\u2588" : ""}
        </Text>
      </Box>

      {statusMessage && (
        <Box marginTop={1}>
          <Text color={statusMessage.color as "red" | "green"}>{statusMessage.text}</Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          Local skills:  {summary?.localSkillCount ?? 0} in .claude/skills/
        </Text>
        <Text dimColor>
          Plugins:       {summary?.pluginSkillCount ?? 0} in .claude/plugins/
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {isAddingSource
            ? "ENTER submit  ESC cancel"
            : "A add  DEL remove  ESC close"}
        </Text>
      </Box>
    </Box>
  );
};
