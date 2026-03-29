import { Box, Text, useInput } from "ink";
import React from "react";
import { CLI_COLORS, UI_SYMBOLS } from "../../consts.js";
import { matrix } from "../../lib/matrix/matrix-provider.js";
import type { AgentScopeConfig, SkillConfig } from "../../types/config.js";
import type { AgentName, SkillId } from "../../types/index.js";

type StepConfirmProps = {
  onComplete: () => void;
  skillConfigs?: SkillConfig[];
  agentConfigs?: AgentScopeConfig[];
  previousSkillConfigs?: SkillConfig[];
  previousAgentConfigs?: AgentScopeConfig[];
  onBack?: () => void;
};

function getSkillDisplayName(id: SkillId): string {
  return matrix.skills[id]?.displayName ?? id;
}

const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text bold color={CLI_COLORS.WARNING}>
    {children}
  </Text>
);

const ScopeLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text color={CLI_COLORS.WHITE} backgroundColor={CLI_COLORS.LABEL_BG}>
    {` ${children} `}
  </Text>
);

const EjectIcon: React.FC = () => <Text color={CLI_COLORS.WARNING}> {UI_SYMBOLS.EJECT}</Text>;

export const StepConfirm: React.FC<StepConfirmProps> = ({
  onComplete,
  skillConfigs,
  agentConfigs,
  previousSkillConfigs,
  previousAgentConfigs,
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

  const currentSkills = skillConfigs ?? [];
  const currentAgents = agentConfigs ?? [];

  const projectSkills = currentSkills.filter((s) => s.scope === "project");
  const globalSkills = currentSkills.filter((s) => s.scope === "global");
  const projectAgents = currentAgents.filter((a) => a.scope === "project");
  const globalAgents = currentAgents.filter((a) => a.scope === "global");

  const prevSkillIdSet = previousSkillConfigs
    ? new Set(previousSkillConfigs.map((s) => s.id))
    : null;
  const prevAgentNameSet = previousAgentConfigs
    ? new Set(previousAgentConfigs.map((a) => a.name))
    : null;

  const removedSkills = previousSkillConfigs
    ? previousSkillConfigs.filter((s) => !currentSkills.some((c) => c.id === s.id))
    : [];
  const removedAgents = previousAgentConfigs
    ? previousAgentConfigs.filter((a) => !currentAgents.some((c) => c.name === a.name))
    : [];

  const removedGlobalSkills = removedSkills.filter((s) => s.scope === "global");
  const removedProjectSkills = removedSkills.filter((s) => s.scope === "project");
  const removedGlobalAgents = removedAgents.filter((a) => a.scope === "global");
  const removedProjectAgents = removedAgents.filter((a) => a.scope === "project");

  const showProjectSkills = projectSkills.length > 0 || removedProjectSkills.length > 0;
  const showGlobalSkills = globalSkills.length > 0 || removedGlobalSkills.length > 0;
  const showProjectAgents = projectAgents.length > 0 || removedProjectAgents.length > 0;
  const showGlobalAgents = globalAgents.length > 0 || removedGlobalAgents.length > 0;

  const hasSkills = showProjectSkills || showGlobalSkills;
  const hasAgents = showProjectAgents || showGlobalAgents;

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      borderStyle="single"
      borderColor={CLI_COLORS.NEUTRAL}
      borderDimColor
    >
      {(hasSkills || hasAgents) && (
        <Box flexDirection="row">
          <Box
            flexDirection="column"
            borderStyle="single"
            flexGrow={2}
            flexBasis={0}
            borderRight={true}
            borderTop={false}
            borderBottom={false}
            borderLeft={false}
            borderColor={CLI_COLORS.NEUTRAL}
            borderRightDimColor
          >
            <TableHeader>Skills</TableHeader>
            {showProjectSkills && (
              <Box flexDirection="column" marginTop={1}>
                <ScopeLabel>Project</ScopeLabel>
                <Box flexWrap="wrap">
                  {projectSkills.map((skill) => {
                    const isNew = prevSkillIdSet !== null && !prevSkillIdSet.has(skill.id);
                    const prefix = isNew ? "+ " : `${UI_SYMBOLS.BULLET} `;
                    return (
                      <Box key={skill.id} width="50%" flexDirection="row">
                        <Text color={isNew ? CLI_COLORS.SUCCESS : CLI_COLORS.NEUTRAL}>
                          {prefix}
                          {getSkillDisplayName(skill.id)}
                        </Text>
                        {skill.source === "eject" && <EjectIcon />}
                      </Box>
                    );
                  })}
                  {removedProjectSkills.map((skill) => (
                    <Box key={`removed-${skill.id}`} width="50%" flexDirection="row">
                      <Text color={CLI_COLORS.ERROR}>- {getSkillDisplayName(skill.id)}</Text>
                      {skill.source === "eject" && <EjectIcon />}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
            {showGlobalSkills && (
              <Box flexDirection="column" marginTop={1}>
                <ScopeLabel>Global</ScopeLabel>
                <Box flexWrap="wrap">
                  {globalSkills.map((skill) => {
                    const isNew = prevSkillIdSet !== null && !prevSkillIdSet.has(skill.id);
                    const prefix = isNew ? "+ " : `${UI_SYMBOLS.BULLET} `;
                    return (
                      <Box key={skill.id} width="50%" flexDirection="row">
                        <Text color={isNew ? CLI_COLORS.SUCCESS : CLI_COLORS.NEUTRAL}>
                          {prefix}
                          {getSkillDisplayName(skill.id)}
                        </Text>
                        {skill.source === "eject" && <EjectIcon />}
                      </Box>
                    );
                  })}
                  {removedGlobalSkills.map((skill) => (
                    <Box key={`removed-${skill.id}`} width="50%" flexDirection="row">
                      <Text color={CLI_COLORS.ERROR}>- {getSkillDisplayName(skill.id)}</Text>
                      {skill.source === "eject" && <EjectIcon />}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
          <Box flexDirection="column" flexGrow={1} flexBasis={0} marginLeft={1} paddingLeft={1}>
            <TableHeader>Agents</TableHeader>
            {showProjectAgents && (
              <Box flexDirection="column" marginTop={1}>
                <ScopeLabel>Project</ScopeLabel>
                <Box flexDirection="column">
                  {projectAgents.map((agent) => {
                    const isNew = prevAgentNameSet !== null && !prevAgentNameSet.has(agent.name);
                    const prefix = isNew ? "+ " : `${UI_SYMBOLS.BULLET} `;
                    return (
                      <Text
                        key={agent.name}
                        color={isNew ? CLI_COLORS.SUCCESS : CLI_COLORS.NEUTRAL}
                      >
                        {prefix}
                        {agent.name}
                      </Text>
                    );
                  })}
                  {removedProjectAgents.map((agent) => (
                    <Text key={`removed-${agent.name}`} color={CLI_COLORS.ERROR}>
                      - {agent.name}
                    </Text>
                  ))}
                </Box>
              </Box>
            )}
            {showGlobalAgents && (
              <Box flexDirection="column" marginTop={1}>
                <ScopeLabel>Global</ScopeLabel>
                <Box flexDirection="column">
                  {globalAgents.map((agent) => {
                    const isNew = prevAgentNameSet !== null && !prevAgentNameSet.has(agent.name);
                    const prefix = isNew ? "+ " : `${UI_SYMBOLS.BULLET} `;
                    return (
                      <Text
                        key={agent.name}
                        color={isNew ? CLI_COLORS.SUCCESS : CLI_COLORS.NEUTRAL}
                      >
                        {prefix}
                        {agent.name}
                      </Text>
                    );
                  })}
                  {removedGlobalAgents.map((agent) => (
                    <Text key={`removed-${agent.name}`} color={CLI_COLORS.ERROR}>
                      - {agent.name}
                    </Text>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};
