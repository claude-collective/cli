import { indexBy } from "remeda";

import type { ProjectConfig } from "../../types";
import type { AgentScopeConfig, SkillConfig } from "../../types/config";
import { typedEntries } from "../../utils/typed-object";
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

/**
 * Pure merge logic: existing values take precedence for identity fields;
 * agents are merged by name (new overrides existing, keeps the rest);
 * skills are merged by ID (new overrides existing, keeps the rest);
 * stack is deep-merged by agent.
 */
export function mergeConfigs(
  newConfig: ProjectConfig,
  existingConfig: ProjectConfig,
): ProjectConfig {
  const merged = { ...newConfig };

  if (existingConfig.name) {
    merged.name = existingConfig.name;
  }

  if (existingConfig.description) {
    merged.description = existingConfig.description;
  }

  if (existingConfig.source && !newConfig.source) {
    merged.source = existingConfig.source;
  }

  // Merge agents by compound key: excluded global + active project with same name are distinct entries
  if (existingConfig.agents && existingConfig.agents.length > 0) {
    const agentKey = (a: AgentScopeConfig) => (a.excluded ? `${a.name}:excluded` : a.name);
    const newAgentsByKey = indexBy(merged.agents, agentKey);
    const existingKeys = new Set(existingConfig.agents.map((a) => agentKey(a)));
    const updatedExisting = existingConfig.agents.map(
      (existing) => newAgentsByKey[agentKey(existing)] ?? existing,
    );
    const addedAgents = merged.agents.filter((a) => !existingKeys.has(agentKey(a)));
    merged.agents = [...updatedExisting, ...addedAgents];
  }

  // Merge skills by compound key: excluded global + active project with same ID are distinct entries
  if (existingConfig.skills && existingConfig.skills.length > 0) {
    const skillKey = (s: SkillConfig) => (s.excluded ? `${s.id}:excluded` : s.id);
    const newSkillsById = indexBy(merged.skills, skillKey);
    const existingIds = new Set(existingConfig.skills.map((s: SkillConfig) => skillKey(s)));
    const updatedExisting = existingConfig.skills.map(
      (existing: SkillConfig) => newSkillsById[skillKey(existing)] ?? existing,
    );
    const addedSkills = merged.skills.filter((s) => !existingIds.has(skillKey(s)));
    merged.skills = [...updatedExisting, ...addedSkills];
  }

  if (existingConfig.stack) {
    const mergedStack = { ...merged.stack };
    for (const [agentId, agentConfig] of typedEntries(existingConfig.stack)) {
      mergedStack[agentId] = { ...mergedStack[agentId], ...agentConfig };
    }
    merged.stack = mergedStack;
  }

  if (existingConfig.author) {
    merged.author = existingConfig.author;
  }

  if (existingConfig.agentsSource) {
    merged.agentsSource = existingConfig.agentsSource;
  }

  if (existingConfig.marketplace) {
    merged.marketplace = existingConfig.marketplace;
  }

  return merged;
}

// Existing values take precedence for identity fields; arrays are unioned; stack is deep-merged
export async function mergeWithExistingConfig(
  newConfig: ProjectConfig,
  context: MergeContext,
): Promise<MergeResult> {
  const existingFullConfig = await loadProjectConfig(context.projectDir);
  if (existingFullConfig) {
    const config = mergeConfigs(newConfig, existingFullConfig.config);

    return {
      config,
      merged: true,
      existingConfigPath: existingFullConfig.configPath,
    };
  }

  // No existing full config, try simple project source config for author/agentsSource
  const localConfig = { ...newConfig };
  const existingProjectConfig = await loadProjectSourceConfig(context.projectDir);
  if (existingProjectConfig?.author) {
    localConfig.author = existingProjectConfig.author;
  }
  if (existingProjectConfig?.agentsSource) {
    localConfig.agentsSource = existingProjectConfig.agentsSource;
  }

  return { config: localConfig, merged: false };
}
