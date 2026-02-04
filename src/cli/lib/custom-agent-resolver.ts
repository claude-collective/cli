import type { CustomAgentConfig, AgentDefinition } from "../../types";

/** Default tools for standalone custom agents (no extends) */
const DEFAULT_TOOLS = ["Read", "Grep", "Glob"];

/** Marker path for standalone custom agents (no extends) */
const CUSTOM_AGENT_PATH = "_custom";

/**
 * Resolve a custom agent config to a full AgentDefinition.
 * If extends is specified, inherit from the base agent.
 *
 * @param agentId - The custom agent's identifier
 * @param customConfig - The custom agent configuration from config.yaml
 * @param builtinAgents - Record of built-in agent definitions to extend from
 * @returns Fully resolved AgentDefinition
 * @throws Error if extends references an unknown agent
 */
export function resolveCustomAgent(
  agentId: string,
  customConfig: CustomAgentConfig,
  builtinAgents: Record<string, AgentDefinition>,
): AgentDefinition {
  let baseAgent: Partial<AgentDefinition> = {};

  if (customConfig.extends) {
    const base = builtinAgents[customConfig.extends];
    if (!base) {
      const availableAgents = Object.keys(builtinAgents);
      const agentList =
        availableAgents.length > 0
          ? `Available agents: ${availableAgents.slice(0, 5).join(", ")}${availableAgents.length > 5 ? ` (and ${availableAgents.length - 5} more)` : ""}`
          : "No built-in agents found";
      throw new Error(
        `Custom agent "${agentId}" extends unknown agent "${customConfig.extends}". ${agentList}`,
      );
    }
    baseAgent = { ...base };
  }

  // Merge disallowed_tools: custom + inherited
  let disallowedTools: string[] | undefined;
  if (customConfig.disallowed_tools || baseAgent.disallowed_tools) {
    const merged = new Set<string>([
      ...(baseAgent.disallowed_tools || []),
      ...(customConfig.disallowed_tools || []),
    ]);
    disallowedTools = [...merged];
  }

  // Merge hooks: custom hooks added to inherited
  let hooks: AgentDefinition["hooks"] | undefined;
  if (customConfig.hooks || baseAgent.hooks) {
    hooks = { ...baseAgent.hooks };
    if (customConfig.hooks) {
      for (const [hookType, hookDefs] of Object.entries(customConfig.hooks)) {
        if (hooks[hookType]) {
          hooks[hookType] = [...hooks[hookType], ...hookDefs];
        } else {
          hooks[hookType] = hookDefs;
        }
      }
    }
  }

  return {
    title: customConfig.title,
    description: customConfig.description,
    model: customConfig.model || baseAgent.model,
    tools: customConfig.tools || baseAgent.tools || DEFAULT_TOOLS,
    disallowed_tools: disallowedTools,
    permission_mode: customConfig.permission_mode || baseAgent.permission_mode,
    hooks,
    // Use extended agent's path for template resolution, or _custom for standalone
    path: baseAgent.path || CUSTOM_AGENT_PATH,
    sourceRoot: baseAgent.sourceRoot,
  };
}

/**
 * Resolve all custom agents from config to AgentDefinition records.
 *
 * @param customAgents - Record of custom agent configs from config.yaml
 * @param builtinAgents - Record of built-in agent definitions
 * @returns Record of resolved AgentDefinitions keyed by custom agent ID
 */
export function resolveCustomAgents(
  customAgents: Record<string, CustomAgentConfig>,
  builtinAgents: Record<string, AgentDefinition>,
): Record<string, AgentDefinition> {
  const resolved: Record<string, AgentDefinition> = {};

  for (const [id, config] of Object.entries(customAgents)) {
    resolved[id] = resolveCustomAgent(id, config, builtinAgents);
  }

  return resolved;
}

/**
 * Check if a custom agent ID conflicts with a built-in agent ID.
 *
 * @param customAgentId - The custom agent's identifier
 * @param builtinAgents - Record of built-in agent definitions
 * @returns true if there's a conflict
 */
export function hasAgentIdConflict(
  customAgentId: string,
  builtinAgents: Record<string, AgentDefinition>,
): boolean {
  return customAgentId in builtinAgents;
}

/**
 * Validate custom agents don't conflict with built-in agents.
 *
 * @param customAgents - Record of custom agent configs
 * @param builtinAgents - Record of built-in agent definitions
 * @returns Array of error messages (empty if no conflicts)
 */
export function validateCustomAgentIds(
  customAgents: Record<string, CustomAgentConfig>,
  builtinAgents: Record<string, AgentDefinition>,
): string[] {
  const errors: string[] = [];

  for (const customId of Object.keys(customAgents)) {
    if (hasAgentIdConflict(customId, builtinAgents)) {
      errors.push(
        `Custom agent "${customId}" conflicts with built-in agent of the same name. Choose a unique name.`,
      );
    }
  }

  return errors;
}
