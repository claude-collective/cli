import { Box, Text } from "ink";
import React from "react";
import { CLI_COLORS, UI_SYMBOLS } from "../../consts.js";
import { matrix } from "../../lib/matrix/matrix-provider.js";
import type { AgentScopeConfig, SkillConfig } from "../../types/config.js";
import type { SkillId } from "../../types/index.js";
import { useWizardStore } from "../../stores/wizard-store.js";

export type SkillAgentSummaryProps = {
  skillConfigs?: SkillConfig[];
  agentConfigs?: AgentScopeConfig[];
};

function getSkillDisplayName(id: SkillId): string {
  return matrix.skills[id]?.displayName ?? id;
}

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text bold color={CLI_COLORS.WARNING}>
    {children}
  </Text>
);

export const ScopeLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text color={CLI_COLORS.WHITE} backgroundColor={CLI_COLORS.LABEL_BG}>
    {` ${children} `}
  </Text>
);

export const EjectIcon: React.FC = () => (
  <Text color={CLI_COLORS.WARNING}> {UI_SYMBOLS.EJECT}</Text>
);

export const SkillAgentSummary: React.FC<SkillAgentSummaryProps> = ({
  skillConfigs,
  agentConfigs,
}) => {
  const installedSkillConfigs = useWizardStore((s) => s.installedSkillConfigs);
  const installedAgentConfigs = useWizardStore((s) => s.installedAgentConfigs);
  const isInitMode = useWizardStore((s) => s.isInitMode);

  const currentSkills = skillConfigs ?? [];
  const currentAgents = agentConfigs ?? [];

  const projectSkills = currentSkills.filter((s) => s.scope === "project" && !s.excluded);
  const globalSkills = currentSkills.filter((s) => s.scope === "global" && !s.excluded);
  const projectAgents = currentAgents.filter((a) => a.scope === "project" && !a.excluded);
  const globalAgents = currentAgents.filter((a) => a.scope === "global" && !a.excluded);
  const excludedGlobalSkills = currentSkills.filter((s) => s.scope === "global" && !!s.excluded);
  const excludedGlobalAgents = currentAgents.filter((a) => a.scope === "global" && !!a.excluded);

  const prevSkillKeySet = installedSkillConfigs
    ? new Set(installedSkillConfigs.map((s) => `${s.id}:${s.scope}`))
    : null;
  const prevAgentKeySet = installedAgentConfigs
    ? new Set(installedAgentConfigs.map((a) => `${a.name}:${a.scope}`))
    : null;

  // Skills/agents that are still globally installed but overridden at project scope
  const inheritedGlobalSkills = installedSkillConfigs
    ? installedSkillConfigs.filter(
        (s) =>
          s.scope === "global" &&
          !globalSkills.some((g) => g.id === s.id) &&
          projectSkills.some((p) => p.id === s.id),
      )
    : [];
  const inheritedGlobalAgents = installedAgentConfigs
    ? installedAgentConfigs.filter(
        (a) =>
          a.scope === "global" &&
          !globalAgents.some((g) => g.name === a.name) &&
          projectAgents.some((p) => p.name === a.name),
      )
    : [];
  const inheritedSkillIdSet = new Set(inheritedGlobalSkills.map((s) => s.id));
  const uniqueExcludedGlobalSkills = excludedGlobalSkills.filter(
    (s) => !inheritedSkillIdSet.has(s.id),
  );
  const allGlobalSkills = [
    ...globalSkills,
    ...inheritedGlobalSkills,
    ...uniqueExcludedGlobalSkills,
  ];
  const inheritedAgentNameSet = new Set(inheritedGlobalAgents.map((a) => a.name));
  const uniqueExcludedGlobalAgents = excludedGlobalAgents.filter(
    (a) => !inheritedAgentNameSet.has(a.name),
  );
  const allGlobalAgents = [
    ...globalAgents,
    ...inheritedGlobalAgents,
    ...uniqueExcludedGlobalAgents,
  ];

  const removedSkills = installedSkillConfigs
    ? installedSkillConfigs.filter((s) => !currentSkills.some((c) => c.id === s.id))
    : [];
  const removedAgents = installedAgentConfigs
    ? installedAgentConfigs.filter((a) => !currentAgents.some((c) => c.name === a.name))
    : [];

  const removedGlobalSkills = isInitMode ? [] : removedSkills.filter((s) => s.scope === "global");
  const removedProjectSkills = removedSkills.filter((s) => s.scope === "project");
  const removedGlobalAgents = isInitMode ? [] : removedAgents.filter((a) => a.scope === "global");
  const removedProjectAgents = removedAgents.filter((a) => a.scope === "project");

  const showProjectSkills = projectSkills.length > 0 || removedProjectSkills.length > 0;
  const showGlobalSkills = allGlobalSkills.length > 0 || removedGlobalSkills.length > 0;
  const showProjectAgents = projectAgents.length > 0 || removedProjectAgents.length > 0;
  const showGlobalAgents = allGlobalAgents.length > 0 || removedGlobalAgents.length > 0;

  const hasSkills = showProjectSkills || showGlobalSkills;
  const hasAgents = showProjectAgents || showGlobalAgents;

  if (!hasSkills && !hasAgents) return null;

  return (
    <Box flexDirection="row" width="100%">
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
                const isNew =
                  prevSkillKeySet === null || !prevSkillKeySet.has(`${skill.id}:${skill.scope}`);
                const prefix = isNew ? "+ " : `${UI_SYMBOLS.BULLET} `;
                const color = isNew ? CLI_COLORS.SUCCESS : CLI_COLORS.NEUTRAL;
                return (
                  <Box key={skill.id} width="50%" flexDirection="row">
                    <Text color={color}>
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
              {allGlobalSkills.map((skill) => {
                const isNew =
                  prevSkillKeySet === null || !prevSkillKeySet.has(`${skill.id}:${skill.scope}`);
                const prefix = isNew ? "+ " : `${UI_SYMBOLS.BULLET} `;
                const color = isNew ? CLI_COLORS.SUCCESS : CLI_COLORS.NEUTRAL;
                return (
                  <Box key={skill.id} width="50%" flexDirection="row">
                    <Text color={color}>
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
                const isNew =
                  prevAgentKeySet === null || !prevAgentKeySet.has(`${agent.name}:${agent.scope}`);
                const prefix = isNew ? "+ " : `${UI_SYMBOLS.BULLET} `;
                const color = isNew ? CLI_COLORS.SUCCESS : CLI_COLORS.NEUTRAL;
                return (
                  <Text key={agent.name} color={color}>
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
              {allGlobalAgents.map((agent) => {
                const isNew =
                  prevAgentKeySet === null || !prevAgentKeySet.has(`${agent.name}:${agent.scope}`);
                const prefix = isNew ? "+ " : `${UI_SYMBOLS.BULLET} `;
                const color = isNew ? CLI_COLORS.SUCCESS : CLI_COLORS.NEUTRAL;
                return (
                  <Text key={agent.name} color={color}>
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
  );
};
