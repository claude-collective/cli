import { Box, Text, useInput } from "ink";
import React from "react";
import { CLI_COLORS } from "../../consts.js";
import type { AgentScopeConfig, SkillConfig } from "../../types/config.js";
import type { Domain, DomainSelections } from "../../types/index.js";
import { KEY_LABEL_ENTER, KEY_LABEL_ESC } from "./hotkeys.js";
import { getDomainDisplayName } from "./utils.js";
import { Toast } from "./toast.js";

type StepConfirmProps = {
  onComplete: () => void;
  stackName?: string;
  selectedDomains?: Domain[];
  domainSelections?: DomainSelections;
  technologyCount?: number;
  skillCount?: number;
  agentCount?: number;
  skillConfigs?: SkillConfig[];
  agentConfigs?: AgentScopeConfig[];
  onBack?: () => void;
};

const getInstallModeLabel = (skillConfigs: SkillConfig[]): string => {
  if (skillConfigs.length === 0) return "Local (editable copies)";

  const localCount = skillConfigs.filter((s) => s.source === "local").length;
  const pluginCount = skillConfigs.length - localCount;

  if (localCount === 0) return "Plugin";
  if (pluginCount === 0) return "Local (editable copies)";
  return `Mixed (${localCount} local, ${pluginCount} plugin)`;
};

export const StepConfirm: React.FC<StepConfirmProps> = ({
  onComplete,
  stackName,
  selectedDomains,
  domainSelections,
  technologyCount,
  skillCount,
  agentCount,
  skillConfigs,
  agentConfigs,
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

  return (
    <Box flexDirection="column" paddingX={2}>
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

      <Box flexDirection="column">
        {technologyCount !== undefined && (
          <Text>
            <Text dimColor>Technologies:</Text> <Text bold>{technologyCount}</Text>
          </Text>
        )}
        {skillCount !== undefined && (
          <Text>
            <Text dimColor>Skills:</Text> <Text bold>{skillCount}</Text>{" "}
            <Text color={CLI_COLORS.PRIMARY}>(all verified)</Text>
          </Text>
        )}
        {agentCount !== undefined && (
          <Text>
            <Text dimColor>Agents:</Text> <Text bold>{agentCount}</Text>
            {agentConfigs && agentConfigs.length > 0 && (
              <Text>
                {" "}
                <Text dimColor>
                  ({agentConfigs.filter((a) => a.scope === "project").length} project
                  {agentConfigs.some((a) => a.scope === "global") &&
                    `, ${agentConfigs.filter((a) => a.scope === "global").length} global`}
                  )
                </Text>
              </Text>
            )}
          </Text>
        )}
        {skillConfigs && skillConfigs.length > 0 && (
          <>
            <Text>
              <Text dimColor>Install mode:</Text>{" "}
              <Text bold>{getInstallModeLabel(skillConfigs)}</Text>
            </Text>
            <Text>
              <Text dimColor>Scope:</Text>{" "}
              <Text bold>
                {skillConfigs.filter((s) => s.scope === "project").length} project
                {skillConfigs.some((s) => s.scope === "global") &&
                  `, ${skillConfigs.filter((s) => s.scope === "global").length} global`}
              </Text>
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
};
