import { difference, indexBy } from "remeda";

import type { ProjectConfig } from "../../types";
import type { SkillConfig } from "../../types/config";
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

    // Merge skills by ID: new skills override existing, existing skills preserved otherwise
    if (existingConfig.skills && existingConfig.skills.length > 0) {
      const newSkillsById = indexBy(localConfig.skills, (s: SkillConfig) => s.id);
      const merged: SkillConfig[] = existingConfig.skills.map(
        (existing: SkillConfig) => newSkillsById[existing.id] ?? existing,
      );
      // Add skills that are only in the new config
      const existingIds = new Set(existingConfig.skills.map((s: SkillConfig) => s.id));
      for (const skill of localConfig.skills) {
        if (!existingIds.has(skill.id)) {
          merged.push(skill);
        }
      }
      localConfig.skills = merged;
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
