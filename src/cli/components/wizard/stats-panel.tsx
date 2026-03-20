import { Box, Text } from "ink";
import React from "react";
import { CLI_COLORS } from "../../consts.js";
import type { AgentScopeConfig, SkillConfig } from "../../types/config.js";

const SCOPE_COLOR_PROJECT = "#eee";

export type StatsData = {
  skillsTotal: number;
  globalPlugin: number;
  globalLocal: number;
  projectPlugin: number;
  projectLocal: number;
  agentsTotal: number;
  agentsGlobal: number;
  agentsProject: number;
};

export function computeStats(skillConfigs: SkillConfig[], agentConfigs: AgentScopeConfig[]): StatsData {
  let globalPlugin = 0;
  let globalLocal = 0;
  let projectPlugin = 0;
  let projectLocal = 0;

  for (const sc of skillConfigs) {
    const isLocal = sc.source === "local";
    if (sc.scope === "global") {
      if (isLocal) globalLocal++;
      else globalPlugin++;
    } else {
      if (isLocal) projectLocal++;
      else projectPlugin++;
    }
  }

  let agentsGlobal = 0;
  let agentsProject = 0;
  for (const ac of agentConfigs) {
    if (ac.scope === "global") agentsGlobal++;
    else agentsProject++;
  }

  return {
    skillsTotal: skillConfigs.length,
    globalPlugin,
    globalLocal,
    projectPlugin,
    projectLocal,
    agentsTotal: agentConfigs.length,
    agentsGlobal,
    agentsProject,
  };
}

export const StatsPanel: React.FC<{ stats: StatsData }> = ({ stats }) => {
  const dimGlobalAgents = stats.agentsGlobal === 0;
  const dimProjectAgents = stats.agentsProject === 0;

  return (
    <Box flexDirection="row" columnGap={0} marginTop={-4} borderStyle="single" borderColor={CLI_COLORS.NEUTRAL} borderDimColor paddingX={1}>
      <Box flexDirection="column" flexGrow={1}>
        <Text dimColor>Skills</Text>
        <Text>
          <Text dimColor color={CLI_COLORS.WARNING}>
            Global
          </Text>
          <Text>{"  "}</Text>
          <Text dimColor={stats.globalPlugin === 0}>
            <Text color={CLI_COLORS.PRIMARY}>
              {stats.globalPlugin}
            </Text>
            <Text> plugin </Text>
          </Text>
          <Text dimColor={stats.globalLocal === 0}>
            <Text color={CLI_COLORS.PRIMARY}>
              {stats.globalLocal}
            </Text>
            <Text> local</Text>
          </Text>
        </Text>
        <Text>
          <Text dimColor color={SCOPE_COLOR_PROJECT}>
            Project
          </Text>
          <Text>{"  "}</Text>
          <Text dimColor={stats.projectPlugin === 0}>
            <Text color={CLI_COLORS.PRIMARY}>
              {stats.projectPlugin}
            </Text>
            <Text> plugin </Text>
          </Text>
          <Text dimColor={stats.projectLocal === 0}>
            <Text color={CLI_COLORS.PRIMARY}>
              {stats.projectLocal}
            </Text>
            <Text> local</Text>
          </Text>
        </Text>
      </Box>
      <Box flexDirection="column" marginX={1} marginTop={0} height={3} justifyContent="center">
        <Text dimColor color={CLI_COLORS.NEUTRAL}>│</Text>
        <Text dimColor color={CLI_COLORS.NEUTRAL}>│</Text>
        <Text dimColor color={CLI_COLORS.NEUTRAL}>│</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingLeft={0}>
        <Text dimColor>Agents</Text>
        <Text>
          <Text dimColor color={CLI_COLORS.WARNING}>
            Global
          </Text>
          <Text>{"   "}</Text>
          <Text dimColor={dimGlobalAgents} color={CLI_COLORS.PRIMARY}>
            {stats.agentsGlobal}
          </Text>
        </Text>
        <Text>
          <Text dimColor color={SCOPE_COLOR_PROJECT}>
            Project
          </Text>
          <Text>{"  "}</Text>
          <Text dimColor={dimProjectAgents} color={CLI_COLORS.PRIMARY}>
            {stats.agentsProject}
          </Text>
        </Text>
      </Box>
    </Box>
  );
};
