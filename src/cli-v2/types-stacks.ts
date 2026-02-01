/**
 * Stack types for agent-centric configuration (Phase 6)
 * Stacks are simple agent groupings without skill mappings
 */

/**
 * Stack definition from config/stacks.yaml
 * Groups agents together for a specific workflow or framework
 */
export interface Stack {
  /** Unique stack identifier (kebab-case) */
  id: string;
  /** Human-readable stack name */
  name: string;
  /** Brief description of the stack's purpose */
  description: string;
  /** List of agent IDs included in this stack */
  agents: string[];
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
