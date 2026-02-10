import React from "react";
import { Box, Text, useInput } from "ink";
import type { MergedSkillsMatrix, DomainSelections, Domain } from "../../types-matrix.js";

// =============================================================================
// Types
// =============================================================================

export interface StepConfirmProps {
  matrix: MergedSkillsMatrix;
  onComplete: () => void;
  stackName?: string;
  selectedDomains?: Domain[];
  domainSelections?: DomainSelections;
  technologyCount?: number;
  skillCount?: number;
  installMode?: "plugin" | "local";
  onBack?: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format domain name for display.
 */
const formatDomainName = (domain: Domain): string => {
  const names: Partial<Record<Domain, string>> = {
    web: "Web",
    "web-extras": "Web Extras",
    api: "API",
    cli: "CLI",
    mobile: "Mobile",
  };
  return names[domain] || domain.charAt(0).toUpperCase() + domain.slice(1);
};

// =============================================================================
// Component
// =============================================================================

export const StepConfirm: React.FC<StepConfirmProps> = ({
  matrix,
  onComplete,
  stackName,
  selectedDomains,
  domainSelections,
  technologyCount,
  skillCount,
  installMode,
  onBack,
}) => {
  useInput((input, key) => {
    if (key.return) {
      onComplete();
    }
    if (key.escape && onBack) {
      onBack();
    }
  });

  // Build title based on stack vs scratch path
  const domainsText = selectedDomains?.map(formatDomainName).join(" + ") || "";
  const title = stackName
    ? `Ready to install ${stackName}`
    : `Ready to install your custom stack${domainsText ? ` (${domainsText})` : ""}`;

  return (
    <Box flexDirection="column" paddingX={2}>
      <Text bold color="green">
        {title}
      </Text>
      <Text> </Text>

      {/* Domain breakdown (for scratch path) */}
      {domainSelections && selectedDomains && !stackName && (
        <Box flexDirection="column" marginBottom={1}>
          {selectedDomains.map((domain) => {
            const selections = domainSelections[domain] || {};
            const techs = Object.values(selections).flat();
            if (techs.length === 0) return null;
            return (
              <Text key={domain}>
                <Text bold>{formatDomainName(domain)}:</Text> <Text>{techs.join(", ")}</Text>
              </Text>
            );
          })}
        </Box>
      )}

      {/* Summary stats */}
      <Box flexDirection="column" marginY={1}>
        {technologyCount !== undefined && (
          <Text>
            <Text dimColor>Technologies:</Text> <Text bold>{technologyCount}</Text>
          </Text>
        )}
        {skillCount !== undefined && (
          <Text>
            <Text dimColor>Skills:</Text> <Text bold>{skillCount}</Text>{" "}
            <Text color="green">(all verified)</Text>
          </Text>
        )}
        {installMode && (
          <Text>
            <Text dimColor>Install mode:</Text>{" "}
            <Text bold>{installMode === "plugin" ? "Plugin" : "Local"}</Text>
          </Text>
        )}
      </Box>
    </Box>
  );
};
