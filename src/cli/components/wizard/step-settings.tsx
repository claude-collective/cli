import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { CLI_COLORS } from "../../consts.js";
import { ViewTitle } from "./view-title.js";
import { getSourceSummary, type SourceSummary } from "../../lib/configuration/source-manager.js";
import { DEFAULT_SOURCE } from "../../lib/configuration/config.js";
import { useKeyboardNavigation } from "../hooks/use-keyboard-navigation.js";
import { useModalState } from "../hooks/use-modal-state.js";
import { useSourceOperations } from "../hooks/use-source-operations.js";
import { useTextInput } from "../hooks/use-text-input.js";

const DEFAULT_SOURCE_NAME = "public";

export type StepSettingsProps = {
  projectDir: string;
  onClose: () => void;
};

export const StepSettings: React.FC<StepSettingsProps> = ({ projectDir, onClose }) => {
  const [summary, setSummary] = useState<SourceSummary | null>(null);
  const addModal = useModalState();
  const {
    value: addSourceInput,
    setValue: setAddSourceInput,
    handleInput: handleTextInput,
  } = useTextInput("");
  const [isLoading, setIsLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    try {
      const result = await getSourceSummary(projectDir);
      setSummary(result);
    } catch {
      setSummary({
        sources: [{ name: DEFAULT_SOURCE_NAME, url: DEFAULT_SOURCE, enabled: true }],
        localSkillCount: 0,
        pluginSkillCount: 0,
      });
    }
    setIsLoading(false);
  }, [projectDir]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const { handleAdd, handleRemove, statusMessage, clearStatus } = useSourceOperations(
    projectDir,
    loadSummary,
  );

  const sourceCount = summary?.sources.length ?? 0;

  const { focusedIndex, setFocusedIndex } = useKeyboardNavigation(
    sourceCount,
    { onEscape: onClose },
    { wrap: false, vimKeys: false, active: !addModal.isOpen },
  );

  useInput((input, key) => {
    if (statusMessage) {
      clearStatus();
    }

    if (addModal.isOpen) {
      if (key.escape) {
        addModal.close();
        setAddSourceInput("");
        return;
      }

      if (key.return) {
        if (addSourceInput.trim()) {
          addModal.close();
          setAddSourceInput("");
          void handleAdd(addSourceInput.trim());
        }
        return;
      }

      handleTextInput(input, key);
      return;
    }

    // Non-adding mode: up/down/escape handled by useKeyboardNavigation hook

    if (key.return) {
      // Toggle enabled/disabled is a placeholder for future enabledSources store integration
      return;
    }

    if (key.backspace || key.delete) {
      if (summary?.sources[focusedIndex]) {
        const source = summary.sources[focusedIndex];
        if (source.name !== DEFAULT_SOURCE_NAME) {
          void handleRemove(source.name).then((success) => {
            if (success) {
              setFocusedIndex((prev) => Math.max(0, prev - 1));
            }
          });
        }
      }
      return;
    }

    if (input === "a" || input === "A") {
      addModal.open(true);
      setAddSourceInput("");
    }
  });

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
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={CLI_COLORS.NEUTRAL}
        paddingX={1}
        marginTop={1}
      >
        {summary?.sources.map((source, index) => {
          const isFocused = index === focusedIndex && !addModal.isOpen;
          const isDefault = source.name === DEFAULT_SOURCE_NAME;
          const checkmark = source.enabled ? "\u2713" : " ";
          const displayName = isDefault ? "Public" : source.name;
          const suffix = isDefault ? " (default)" : "";

          return (
            <Box key={source.name}>
              <Text color={isFocused ? CLI_COLORS.PRIMARY : undefined} bold={isFocused}>
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

      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={addModal.isOpen ? CLI_COLORS.PRIMARY : CLI_COLORS.NEUTRAL}
        paddingX={1}
        marginTop={1}
      >
        <Text color={addModal.isOpen ? CLI_COLORS.PRIMARY : undefined}>
          + Add source: {addModal.isOpen ? addSourceInput : ""}
          {addModal.isOpen ? "\u2588" : ""}
        </Text>
      </Box>

      {statusMessage && (
        <Box marginTop={1}>
          <Text color={statusMessage.color as "red" | "green"}>{statusMessage.text}</Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Local skills: {summary?.localSkillCount ?? 0} in .claude/skills/</Text>
        <Text dimColor>Plugins: {summary?.pluginSkillCount ?? 0} in .claude/plugins/</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {addModal.isOpen ? "ENTER submit  ESC cancel" : "A add  DEL remove  ESC close"}
        </Text>
      </Box>
    </Box>
  );
};
