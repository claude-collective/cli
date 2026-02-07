import type { ProjectConfig } from "../../types";
import { loadProjectConfig as loadFullProjectConfig } from "./project-config";
import { loadProjectConfig } from "./config";

export interface MergeContext {
  projectDir: string;
}

export interface MergeResult {
  config: ProjectConfig;
  merged: boolean;
  /** Path to the existing config that was merged with, if any */
  existingConfigPath?: string;
}

/**
 * Merge a newly generated ProjectConfig with any existing project config.
 *
 * Merge strategy:
 * - Existing values take precedence for identity fields (name, description, source, author)
 * - Skills arrays are unioned (existing + new, deduplicated)
 * - Agents arrays are unioned
 * - Stack is deep-merged (existing agent configs take precedence)
 * - Other optional fields preserved from existing if present
 *
 * If no existing full config is found, falls back to simple project config
 * to inherit author and agents_source.
 *
 * Returns the merged config and whether an existing config was found.
 */
export async function mergeWithExistingConfig(
  newConfig: ProjectConfig,
  context: MergeContext,
): Promise<MergeResult> {
  // Clone to avoid mutating the input
  const localConfig = { ...newConfig };

  const existingFullConfig = await loadFullProjectConfig(context.projectDir);
  if (existingFullConfig) {
    const existingConfig = existingFullConfig.config;

    // Keep existing name if present
    if (existingConfig.name) {
      localConfig.name = existingConfig.name;
    }

    // Keep existing description if present
    if (existingConfig.description) {
      localConfig.description = existingConfig.description;
    }

    // Keep existing source if present (don't overwrite user's source)
    if (existingConfig.source) {
      localConfig.source = existingConfig.source;
    }

    // Merge skills arrays (union of existing + new)
    if (existingConfig.skills && existingConfig.skills.length > 0) {
      const existingSkillIds = new Set(
        existingConfig.skills.map((s) => (typeof s === "string" ? s : s.id)),
      );
      const newSkillIds =
        localConfig.skills?.filter(
          (s) => !existingSkillIds.has(typeof s === "string" ? s : s.id),
        ) || [];
      localConfig.skills = [...existingConfig.skills, ...newSkillIds];
    }

    // Merge agents arrays (union of existing + new)
    if (existingConfig.agents && existingConfig.agents.length > 0) {
      const existingAgentIds = new Set(existingConfig.agents);
      const newAgentIds = localConfig.agents.filter((a) => !existingAgentIds.has(a));
      localConfig.agents = [...existingConfig.agents, ...newAgentIds];
    }

    // Deep merge stack (existing agent configs take precedence)
    if (existingConfig.stack) {
      const mergedStack = { ...localConfig.stack };
      for (const [agentId, agentConfig] of Object.entries(existingConfig.stack)) {
        mergedStack[agentId] = { ...mergedStack[agentId], ...agentConfig };
      }
      localConfig.stack = mergedStack;
    }

    // Keep existing author if present
    if (existingConfig.author) {
      localConfig.author = existingConfig.author;
    }

    // Keep existing agents_source if present
    if (existingConfig.agents_source) {
      localConfig.agents_source = existingConfig.agents_source;
    }

    // Keep existing marketplace if present
    if (existingConfig.marketplace) {
      localConfig.marketplace = existingConfig.marketplace;
    }

    // Keep other existing fields
    if (existingConfig.philosophy) {
      localConfig.philosophy = existingConfig.philosophy;
    }
    if (existingConfig.framework) {
      localConfig.framework = existingConfig.framework;
    }
    if (existingConfig.principles) {
      localConfig.principles = existingConfig.principles;
    }
    if (existingConfig.tags) {
      localConfig.tags = existingConfig.tags;
    }
    if (existingConfig.agent_skills) {
      localConfig.agent_skills = existingConfig.agent_skills;
    }
    if (existingConfig.preload_patterns) {
      localConfig.preload_patterns = existingConfig.preload_patterns;
    }
    if (existingConfig.custom_agents) {
      localConfig.custom_agents = existingConfig.custom_agents;
    }
    if (existingConfig.hooks) {
      localConfig.hooks = existingConfig.hooks;
    }

    return {
      config: localConfig,
      merged: true,
      existingConfigPath: existingFullConfig.configPath,
    };
  }

  // No existing full config, try simple project config for author/agents_source
  const existingProjectConfig = await loadProjectConfig(context.projectDir);
  if (existingProjectConfig?.author) {
    localConfig.author = existingProjectConfig.author;
  }
  if (existingProjectConfig?.agents_source) {
    localConfig.agents_source = existingProjectConfig.agents_source;
  }

  return { config: localConfig, merged: false };
}
