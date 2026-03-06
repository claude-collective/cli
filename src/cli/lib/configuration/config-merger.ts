import { indexBy } from "remeda";

import type { ProjectConfig } from "../../types";
import type { SkillConfig } from "../../types/config";
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
      const existingNames = new Set(existingConfig.agents.map((a) => a.name));
      const newAgents = localConfig.agents.filter((a) => !existingNames.has(a.name));
      localConfig.agents = [...existingConfig.agents, ...newAgents];
    }

    // Merge skills by ID: new skills override existing, existing skills preserved otherwise
    if (existingConfig.skills && existingConfig.skills.length > 0) {
      const newSkillsById = indexBy(localConfig.skills, (s: SkillConfig) => s.id);
      const existingIds = new Set(existingConfig.skills.map((s: SkillConfig) => s.id));
      const updatedExisting = existingConfig.skills.map(
        (existing: SkillConfig) => newSkillsById[existing.id] ?? existing,
      );
      const addedSkills = localConfig.skills.filter((s) => !existingIds.has(s.id));
      localConfig.skills = [...updatedExisting, ...addedSkills];
    }

    if (existingConfig.stack) {
      const mergedStack = { ...localConfig.stack };
      for (const [agentId, agentConfig] of typedEntries(existingConfig.stack)) {
        mergedStack[agentId] = { ...mergedStack[agentId], ...agentConfig };
      }
      localConfig.stack = mergedStack;
    }

    if (existingConfig.author) {
      localConfig.author = existingConfig.author;
    }

    if (existingConfig.agentsSource) {
      localConfig.agentsSource = existingConfig.agentsSource;
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

  // No existing full config, try simple project source config for author/agentsSource
  const existingProjectConfig = await loadProjectSourceConfig(context.projectDir);
  if (existingProjectConfig?.author) {
    localConfig.author = existingProjectConfig.author;
  }
  if (existingProjectConfig?.agentsSource) {
    localConfig.agentsSource = existingProjectConfig.agentsSource;
  }

  return { config: localConfig, merged: false };
}
