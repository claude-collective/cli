/**
 * Stack types for agent-centric configuration (Phase 7)
 * Stacks define agent groupings with technology selections per agent
 */

/**
 * Technology selections for a specific agent within a stack.
 * Maps subcategory IDs to technology aliases.
 *
 * @example
 * ```typescript
 * const webDevConfig: StackAgentConfig = {
 *   framework: 'react',
 *   styling: 'scss-modules',
 *   'client-state': 'zustand',
 *   'server-state': 'react-query',
 *   testing: 'vitest'
 * };
 * ```
 */
export interface StackAgentConfig {
  /** Maps subcategory ID to technology alias */
  [subcategoryId: string]: string;
}

/**
 * Stack definition from config/stacks.yaml
 * Groups agents together with their technology selections
 */
export interface Stack {
  /** Unique stack identifier (kebab-case) */
  id: string;
  /** Human-readable stack name */
  name: string;
  /** Brief description of the stack's purpose */
  description: string;
  /**
   * Agent configurations mapping agent IDs to their technology selections.
   * Each agent has a StackAgentConfig specifying which technology to use
   * for each relevant subcategory.
   *
   * @example
   * ```typescript
   * agents: {
   *   'web-developer': {
   *     framework: 'react',
   *     styling: 'scss-modules'
   *   },
   *   'api-developer': {
   *     api: 'hono',
   *     database: 'drizzle'
   *   }
   * }
   * ```
   */
  agents: Record<string, StackAgentConfig>;
  /** Optional guiding philosophy for the stack */
  philosophy?: string;
}

/**
 * Top-level structure of config/stacks.yaml
 * Contains all available stack definitions
 */
export interface StacksConfig {
  /** All available stacks indexed by ID */
  stacks: Stack[];
}
