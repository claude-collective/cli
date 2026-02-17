import { useState, useCallback } from "react";
import { CLI_COLORS } from "../../consts.js";
import { getErrorMessage } from "../../utils/errors.js";
import { addSource, removeSource } from "../../lib/configuration/source-manager.js";

type StatusMessage = { text: string; color: "red" | "green" } | null;

type UseSourceOperationsResult = {
  handleAdd: (url: string) => Promise<void>;
  handleRemove: (name: string) => Promise<boolean>;
  statusMessage: StatusMessage;
  clearStatus: () => void;
};

export function useSourceOperations(
  projectDir: string,
  onReload: () => Promise<void>,
): UseSourceOperationsResult {
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);

  const handleAdd = useCallback(
    async (url: string) => {
      try {
        const result = await addSource(projectDir, url);
        setStatusMessage({
          text: `Added "${result.name}" (${result.skillCount} skills)`,
          color: CLI_COLORS.SUCCESS,
        });
        await onReload();
      } catch (error) {
        const message = getErrorMessage(error);
        setStatusMessage({ text: `Failed to add source: ${message}`, color: CLI_COLORS.ERROR });
      }
    },
    [projectDir, onReload],
  );

  const handleRemove = useCallback(
    async (name: string): Promise<boolean> => {
      try {
        await removeSource(projectDir, name);
        setStatusMessage({ text: `Removed "${name}"`, color: CLI_COLORS.SUCCESS });
        await onReload();
        return true;
      } catch (error) {
        const message = getErrorMessage(error);
        setStatusMessage({ text: `Failed to remove: ${message}`, color: CLI_COLORS.ERROR });
        return false;
      }
    },
    [projectDir, onReload],
  );

  const clearStatus = useCallback(() => {
    setStatusMessage(null);
  }, []);

  return { handleAdd, handleRemove, statusMessage, clearStatus };
}
