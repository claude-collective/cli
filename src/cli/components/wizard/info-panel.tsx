import { Box, Text } from "ink";
import React from "react";
import { CLI_COLORS } from "../../consts.js";
import { useWizardStore } from "../../stores/wizard-store.js";
import { HOTKEY_INFO } from "./hotkeys.js";
import { computeStats } from "./stats-panel.js";

const SCOPE_COLOR_PROJECT = "#eee";

export const InfoPanel: React.FC = () => {
  const skillConfigs = useWizardStore((s) => s.skillConfigs);
  const agentConfigs = useWizardStore((s) => s.agentConfigs);

  const stats = computeStats(skillConfigs, agentConfigs);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={CLI_COLORS.PRIMARY}
      paddingX={2}
      paddingY={1}
      marginTop={1}
    >
      <Text bold color={CLI_COLORS.PRIMARY}>
        Info
      </Text>

      <Box flexDirection="row" marginTop={1} columnGap={0}>
        <Box flexDirection="column" flexGrow={1}>
          <Text bold>Skills ({stats.skillsTotal})</Text>
          <Text>
            <Text dimColor color={CLI_COLORS.WARNING}>
              Global
            </Text>
            <Text>{"    "}</Text>
            <Text dimColor={stats.globalPlugin === 0}>
              <Text color={CLI_COLORS.PRIMARY}>{stats.globalPlugin}</Text>
              <Text> plugin  </Text>
            </Text>
            <Text dimColor={stats.globalEject === 0}>
              <Text color={CLI_COLORS.PRIMARY}>{stats.globalEject}</Text>
              <Text> eject</Text>
            </Text>
          </Text>
          <Text>
            <Text dimColor color={SCOPE_COLOR_PROJECT}>
              Project
            </Text>
            <Text>{"   "}</Text>
            <Text dimColor={stats.projectPlugin === 0}>
              <Text color={CLI_COLORS.PRIMARY}>{stats.projectPlugin}</Text>
              <Text> plugin  </Text>
            </Text>
            <Text dimColor={stats.projectEject === 0}>
              <Text color={CLI_COLORS.PRIMARY}>{stats.projectEject}</Text>
              <Text> eject</Text>
            </Text>
          </Text>
        </Box>
        <Box flexDirection="column" marginX={1} height={3} justifyContent="center">
          <Text dimColor color={CLI_COLORS.NEUTRAL}>
            │
          </Text>
          <Text dimColor color={CLI_COLORS.NEUTRAL}>
            │
          </Text>
          <Text dimColor color={CLI_COLORS.NEUTRAL}>
            │
          </Text>
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <Text bold>Agents ({stats.agentsTotal})</Text>
          <Text>
            <Text dimColor color={CLI_COLORS.WARNING}>
              Global
            </Text>
            <Text>{"   "}</Text>
            <Text dimColor={stats.agentsGlobal === 0} color={CLI_COLORS.PRIMARY}>
              {stats.agentsGlobal}
            </Text>
          </Text>
          <Text>
            <Text dimColor color={SCOPE_COLOR_PROJECT}>
              Project
            </Text>
            <Text>{"  "}</Text>
            <Text dimColor={stats.agentsProject === 0} color={CLI_COLORS.PRIMARY}>
              {stats.agentsProject}
            </Text>
          </Text>
        </Box>
      </Box>

      <Box paddingY={1}>
        <Text dimColor>{HOTKEY_INFO.label} close</Text>
      </Box>
    </Box>
  );
};
