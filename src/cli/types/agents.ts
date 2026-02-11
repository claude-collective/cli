/**
 * Agent types — definitions, configurations, frontmatter, hooks, and compiled data.
 */

import type { ModelName, PermissionMode } from "./matrix";
import type { Skill, SkillId } from "./skills";

// =============================================================================
// Agent Name Union
// =============================================================================

/**
 * Valid built-in agent names in the system.
 * Derived from src/agents/ directory structure and stacks.yaml.
 */
export type AgentName =
  // Developers
  | "web-developer"
  | "api-developer"
  | "cli-developer"
  | "web-architecture"
  // Meta
  | "agent-summoner"
  | "documentor"
  | "skill-summoner"
  // Migration
  | "cli-migrator"
  // Pattern
  | "pattern-scout"
  | "web-pattern-critique"
  // Planning
  | "web-pm"
  // Researchers
  | "api-researcher"
  | "web-researcher"
  // Reviewers
  | "api-reviewer"
  | "cli-reviewer"
  | "web-reviewer"
  // Testers
  | "cli-tester"
  | "web-tester";

// =============================================================================
// Hook Types
// =============================================================================

/**
 * Hook action types for agent lifecycle hooks
 */
export type AgentHookAction = {
  type: "command" | "script" | "prompt";
  command?: string;
  script?: string;
  prompt?: string;
};

/**
 * Hook definition with matcher and actions
 */
export type AgentHookDefinition = {
  matcher?: string;
  hooks?: AgentHookAction[];
};

// =============================================================================
// Agent Data Types
// =============================================================================

/**
 * Shared fields present on all agent type variants.
 * Extracted to avoid duplicating these 8 fields across AgentDefinition,
 * AgentConfig, and AgentYamlConfig.
 */
export type BaseAgentFields = {
  /** Display title (e.g., "Web Developer Agent") */
  title: string;
  /** Brief description for Task tool */
  description: string;
  /** AI model to use */
  model?: ModelName;
  /** Tools available to this agent */
  tools: string[];
  /** Tools this agent cannot use */
  disallowed_tools?: string[];
  /** Permission mode for agent operations */
  permission_mode?: PermissionMode;
  /** Lifecycle hooks */
  hooks?: Record<string, AgentHookDefinition[]>;
  /** Which output format file to use */
  output_format?: string;
};

/**
 * Base agent definition from agents.yaml.
 * Skills are defined in stacks, not agents.
 */
export type AgentDefinition = BaseAgentFields & {
  /** Relative path to agent directory (e.g., "developer/api-developer") */
  path?: string;
  /** Root path where this agent was loaded from (for template resolution) */
  sourceRoot?: string;
  /** Base directory for agent files relative to sourceRoot (e.g., "src/agents" or ".claude-src/agents") */
  agentBaseDir?: string;
};

/**
 * Fully resolved agent config (agent definition + compile config)
 * This is what the compiler uses after merging agent definitions with stack config
 */
export type AgentConfig = AgentDefinition & {
  name: string;
  /** Unified skills list (loaded dynamically via Skill tool) */
  skills: Skill[];
};

/**
 * Agent configuration from agent.yaml (co-located in each agent folder)
 * Supports official Claude Code plugin format fields
 */
export type AgentYamlConfig = BaseAgentFields & {
  id: AgentName;
};

/**
 * Agent frontmatter - matches official Claude Code plugin format for agents
 * Used in compiled agent.md files
 */
export type AgentFrontmatter = {
  /** Agent identifier in kebab-case (e.g., "web-developer"). Used as plugin name. */
  name: string;
  /** Brief description of the agent's purpose. Shown in Task tool description. */
  description: string;
  /** Comma-separated list of tools available to this agent */
  tools?: string;
  /** Comma-separated list of tools this agent cannot use */
  disallowedTools?: string;
  /** AI model to use for this agent. Use "inherit" to use parent model. */
  model?: ModelName;
  /** Permission mode for agent operations */
  permissionMode?: PermissionMode;
  /** Array of skill names that are preloaded for this agent */
  skills?: SkillId[];
  /** Lifecycle hooks for agent execution */
  hooks?: Record<string, AgentHookDefinition[]>;
};

export type CompiledAgentData = {
  agent: AgentConfig;
  intro: string;
  workflow: string;
  examples: string;
  /** Critical requirements section rendered at the top of the agent prompt */
  criticalRequirementsTop: string;
  /** Critical reminders section rendered at the bottom of the agent prompt */
  criticalReminders: string;
  outputFormat: string;
  /** Flat array of all skills */
  skills: Skill[];
  /** Skills with content embedded in the compiled agent */
  preloadedSkills: Skill[];
  /** Skills loaded via Skill tool (metadata only) */
  dynamicSkills: Skill[];
  /** Skill IDs for frontmatter and skill tool check */
  preloadedSkillIds: SkillId[];
};

/**
 * Paths to fetched agent definition sources.
 * Contains directory paths, not agent data itself.
 */
export type AgentSourcePaths = {
  /** Path to agents directory (contains agent subdirs) */
  agentsDir: string;
  /** Path to _templates directory */
  templatesDir: string;
  /** Original source path */
  sourcePath: string;
};
