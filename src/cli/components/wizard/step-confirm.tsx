import React from "react";
import { Box, Text, useInput } from "ink";
import type { DomainSelections, Domain } from "../../types/index.js";
import { CLI_COLORS } from "../../consts.js";
import { getDomainDisplayName } from "./utils.js";

type StepConfirmProps = {
  onComplete: () => void;
  stackName?: string;
  selectedDomains?: Domain[];
  domainSelections?: DomainSelections;
  technologyCount?: number;
  skillCount?: number;
  installMode?: "plugin" | "local";
  onBack?: () => void;
};

export const StepConfirm: React.FC<StepConfirmProps> = ({
  onComplete,
  stackName,
  selectedDomains,
  domainSelections,
  technologyCount,
  skillCount,
  installMode,
  onBack,
}) => {
  useInput((_input, key) => {
    if (key.return) {
      onComplete();
    }
    if (key.escape && onBack) {
      onBack();
    }
  });

  const domainsText = selectedDomains?.map(getDomainDisplayName).join(" + ") || "";
  const title = stackName
    ? `Ready to install ${stackName}`
    : `Ready to install your custom stack${domainsText ? ` (${domainsText})` : ""}`;

  return (
    <Box flexDirection="column" paddingX={2}>
      <Text bold color={CLI_COLORS.SUCCESS}>
        {title}
      </Text>
      <Text> </Text>

      {domainSelections && selectedDomains && !stackName && (
        <Box flexDirection="column" marginBottom={1}>
          {selectedDomains.map((domain) => {
            const selections = domainSelections[domain] || {};
            const techs = Object.values(selections).flat();
            if (techs.length === 0) return null;
            return (
              <Text key={domain}>
                <Text bold>{getDomainDisplayName(domain)}:</Text> <Text>{techs.join(", ")}</Text>
              </Text>
            );
          })}
        </Box>
      )}

      <Box flexDirection="column" marginY={1}>
        {technologyCount !== undefined && (
          <Text>
            <Text dimColor>Technologies:</Text> <Text bold>{technologyCount}</Text>
          </Text>
        )}
        {skillCount !== undefined && (
          <Text>
            <Text dimColor>Skills:</Text> <Text bold>{skillCount}</Text>{" "}
            <Text color={CLI_COLORS.SUCCESS}>(all verified)</Text>
          </Text>
        )}
        {installMode && (
          <Text>
            <Text dimColor>Install mode:</Text>{" "}
            <Text bold>{installMode === "plugin" ? "Plugin" : "Local"}</Text>
          </Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>ENTER install  ESC go back</Text>
      </Box>
    </Box>
  );
};
