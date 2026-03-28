import { Box, Text } from "ink";
import React from "react";
import { CLI_COLORS } from "../../consts.js";
import { matrix } from "../../lib/matrix/matrix-provider.js";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { AgentScopeConfig, SkillConfig } from "../../types/config.js";
import { HOTKEY_INFO } from "./hotkeys.js";

const SCOPE_COLOR_PROJECT = "#eee";
const LABEL_WIDTH = 10;
const ITEM_WIDTH = 20;

function getSkillDisplayName(config: SkillConfig): string {
  return matrix.skills[config.id]?.slug ?? config.id;
}

function isEjectSource(config: SkillConfig): boolean {
  return config.source === "eject";
}

type SkillBuckets = {
  globalPlugin: string[];
  globalEject: string[];
  projectPlugin: string[];
  projectEject: string[];
};

function groupSkillsByBucket(configs: SkillConfig[]): SkillBuckets {
  const buckets: SkillBuckets = {
    globalPlugin: [],
    globalEject: [],
    projectPlugin: [],
    projectEject: [],
  };

  for (const config of configs) {
    const name = getSkillDisplayName(config);
    if (config.scope === "global") {
      if (isEjectSource(config)) buckets.globalEject.push(name);
      else buckets.globalPlugin.push(name);
    } else {
      if (isEjectSource(config)) buckets.projectEject.push(name);
      else buckets.projectPlugin.push(name);
    }
  }

  return buckets;
}

type AgentBuckets = {
  global: string[];
  project: string[];
};

function groupAgentsByScope(configs: AgentScopeConfig[]): AgentBuckets {
  const buckets: AgentBuckets = { global: [], project: [] };

  for (const config of configs) {
    if (config.scope === "global") buckets.global.push(config.name);
    else buckets.project.push(config.name);
  }

  return buckets;
}

const ItemPairs: React.FC<{ items: string[] }> = ({ items }) => {
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(
      <Box key={i}>
        <Box width={ITEM_WIDTH}>
          <Text>{items[i]}</Text>
        </Box>
        {items[i + 1] && (
          <Box width={ITEM_WIDTH}>
            <Text>{items[i + 1]}</Text>
          </Box>
        )}
      </Box>,
    );
  }
  return <>{rows}</>;
};

type ScopeColumnsProps = {
  globalItems: string[];
  projectItems: string[];
};

const ScopeColumns: React.FC<ScopeColumnsProps> = ({ globalItems, projectItems }) => (
  <Box flexDirection="row">
    <Box flexDirection="column" flexGrow={1}>
      <ItemPairs items={globalItems} />
    </Box>
    <Box flexDirection="column" flexGrow={1}>
      <ItemPairs items={projectItems} />
    </Box>
  </Box>
);

export const InfoPanel: React.FC = () => {
  const skillConfigs = useWizardStore((s) => s.skillConfigs);
  const agentConfigs = useWizardStore((s) => s.agentConfigs);

  const skills = groupSkillsByBucket(skillConfigs);
  const agents = groupAgentsByScope(agentConfigs);

  const hasEjectSkills = skills.globalEject.length > 0 || skills.projectEject.length > 0;

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

      <Box marginTop={1}>
        <Text bold>SKILLS ({skillConfigs.length})</Text>
      </Box>

      <Box flexDirection="row" marginTop={0}>
        <Box width={LABEL_WIDTH} />
        <Box flexGrow={1}>
          <Text dimColor color={CLI_COLORS.WARNING}>
            Global
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text dimColor color={SCOPE_COLOR_PROJECT}>
            Project
          </Text>
        </Box>
      </Box>

      <Box flexDirection="row">
        <Box width={LABEL_WIDTH}>
          <Text dimColor>Plugin</Text>
        </Box>
        <ScopeColumns globalItems={skills.globalPlugin} projectItems={skills.projectPlugin} />
      </Box>

      {hasEjectSkills && (
        <Box flexDirection="row" marginTop={1}>
          <Box width={LABEL_WIDTH}>
            <Text dimColor>Eject</Text>
          </Box>
          <ScopeColumns globalItems={skills.globalEject} projectItems={skills.projectEject} />
        </Box>
      )}

      <Box marginTop={1}>
        <Text bold>AGENTS ({agentConfigs.length})</Text>
      </Box>

      <Box flexDirection="row" marginTop={0}>
        <Box width={LABEL_WIDTH} />
        <Box flexGrow={1}>
          <Text dimColor color={CLI_COLORS.WARNING}>
            Global
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text dimColor color={SCOPE_COLOR_PROJECT}>
            Project
          </Text>
        </Box>
      </Box>

      <Box flexDirection="row">
        <Box width={LABEL_WIDTH} />
        <ScopeColumns globalItems={agents.global} projectItems={agents.project} />
      </Box>

      <Box paddingY={1}>
        <Text dimColor>{HOTKEY_INFO.label} close</Text>
      </Box>
    </Box>
  );
};
