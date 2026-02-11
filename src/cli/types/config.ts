/**
 * Configuration types — project config, compile config, and validation.
 */

import type { AgentName } from "./agents";
import type { ResolvedSubcategorySkills, SkillReference } from "./skills";

/**
 * Agent configuration for compilation
 * Contains skills for a specific agent
 */
export type CompileAgentConfig = {
  /** Skills for this agent (optional - can come from stack) */
  skills?: SkillReference[];
};

/**
 * Compile configuration (derived from stack)
 * Agents to compile are derived from the keys of `agents`
 */
export type CompileConfig = {
  name: string;
  description: string;
  /** Stack reference - resolves stack skills for agents */
  stack?: string;
  /** Agent configurations keyed by agent name (keys determine which agents to compile) */
  agents: Record<string, CompileAgentConfig>;
};

/** Compilation context passed through the compile pipeline */
export type CompileContext = {
  stackId: string;
  verbose: boolean;
  projectRoot: string;
  outputDir: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Unified project configuration for Claude Collective
 * Stored at .claude/config.yaml
 * Backward compatible with StackConfig
 */
export type ProjectConfig = {
  /**
   * Schema version for migration support
   * @default "1"
   */
  version?: "1";

  /**
   * Project/plugin name (kebab-case)
   * @example "my-project"
   */
  name: string;

  /**
   * Brief description of the project
   */
  description?: string;

  /**
   * Agents to compile
   * List of agent names from the agent registry
   */
  agents: AgentName[];

  /**
   * Author handle (e.g., "@vince")
   */
  author?: string;

  /**
   * Installation mode for this project
   * - 'local': Agents compiled to .claude/agents (committed to repo)
   * - 'plugin': Agents compiled to .claude/plugins/claude-collective
   * @default 'local'
   */
  installMode?: "local" | "plugin";

  /**
   * Resolved stack configuration with agent->skill mappings.
   * Keys are agent IDs, values are subcategory->skill ID mappings.
   * Generated during `cc init` when a stack is selected.
   *
   * @example
   * ```yaml
   * stack:
   *   web-developer:
   *     framework: web-framework-react
   *     styling: web-styling-scss-modules
   *   api-developer:
   *     api: api-framework-hono
   *     database: api-database-drizzle
   * ```
   */
  stack?: Record<string, ResolvedSubcategorySkills>;

  /**
   * Skills source path or URL.
   * Saved when --source is provided during init/eject.
   * Used to persist the source for future commands.
   * @example "/home/user/my-skills" or "github:my-org/skills"
   */
  source?: string;

  /**
   * Marketplace identifier for plugin installation.
   * Used when installing stacks from a marketplace source.
   * @example "claude-collective"
   */
  marketplace?: string;

  /**
   * Agents source path or URL.
   * Used when agents come from a different source than skills.
   * If not specified, uses the same source as skills.
   * @example "/home/user/my-agents" or "github:my-org/agents"
   */
  agents_source?: string;
};
