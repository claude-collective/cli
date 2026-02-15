import { difference } from "remeda";

import type { ProjectConfig } from "../../types";
import { loadProjectConfig } from "./project-config";
import { loadProjectSourceConfig } from "./config";

export type MergeContext = {
  projectDir: string;
};

export type MergeResult = {
  config: ProjectConfig;
  merged: boolean;
  existingConfigPath?: string;
};

// Existing values take precedence for identity fields; arrays are unioned; stack is deep-merged
export async function mergeWithExistingConfig(
  newConfig: ProjectConfig,
  context: MergeContext,
): Promise<MergeResult> {
  const localConfig = { ...newConfig };

  const existingFullConfig = await loadProjectConfig(context.projectDir);
  if (existingFullConfig) {
    const existingConfig = existingFullConfig.config;

    if (existingConfig.name) {
      localConfig.name = existingConfig.name;
    }

    if (existingConfig.description) {
      localConfig.description = existingConfig.description;
    }

    if (existingConfig.source) {
      localConfig.source = existingConfig.source;
    }

    if (existingConfig.agents && existingConfig.agents.length > 0) {
      const newAgentIds = difference(localConfig.agents, existingConfig.agents);
      localConfig.agents = [...existingConfig.agents, ...newAgentIds];
    }

    if (existingConfig.stack) {
      const mergedStack = { ...localConfig.stack };
      for (const [agentId, agentConfig] of Object.entries(existingConfig.stack)) {
        mergedStack[agentId] = { ...mergedStack[agentId], ...agentConfig };
      }
      localConfig.stack = mergedStack;
    }

    if (existingConfig.author) {
      localConfig.author = existingConfig.author;
    }

    if (existingConfig.agents_source) {
      localConfig.agents_source = existingConfig.agents_source;
    }

    if (existingConfig.marketplace) {
      localConfig.marketplace = existingConfig.marketplace;
    }

    return {
      config: localConfig,
      merged: true,
      existingConfigPath: existingFullConfig.configPath,
    };
  }

  // No existing full config, try simple project source config for author/agents_source
  const existingProjectConfig = await loadProjectSourceConfig(context.projectDir);
  if (existingProjectConfig?.author) {
    localConfig.author = existingProjectConfig.author;
  }
  if (existingProjectConfig?.agents_source) {
    localConfig.agents_source = existingProjectConfig.agents_source;
  }

  return { config: localConfig, merged: false };
}
