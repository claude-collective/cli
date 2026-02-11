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
  /** Path to the existing config that was merged with, if any */
  existingConfigPath?: string;
};

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

  const existingFullConfig = await loadProjectConfig(context.projectDir);
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

    // Merge agents arrays (union of existing + new)
    if (existingConfig.agents && existingConfig.agents.length > 0) {
      const newAgentIds = difference(localConfig.agents, existingConfig.agents);
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
