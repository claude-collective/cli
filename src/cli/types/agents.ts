import type { Domain, ModelName, PermissionMode } from "./matrix";
import type { PluginSkillRef, Skill, SkillId } from "./skills";

/** Valid agent names for built-in agents */
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

/** Single hook action (command, script, or prompt) */
export type AgentHookAction = {
  type: "command" | "script" | "prompt";
  command?: string;
  script?: string;
  prompt?: string;
};

/** Hook definition with optional file matcher and actions */
export type AgentHookDefinition = {
  matcher?: string;
  hooks?: AgentHookAction[];
};

/**
 * Shared fields present on all agent type variants.
 * Extracted to avoid duplicating these 8 fields across AgentDefinition,
 * AgentConfig, and AgentYamlConfig.
 */
export type BaseAgentFields = {
  title: string;
  /** Brief description for Task tool */
  description: string;
  model?: ModelName;
  tools: string[];
  disallowedTools?: string[];
  permissionMode?: PermissionMode;
  hooks?: Record<string, AgentHookDefinition[]>;
  /** Which output format file to use */
  outputFormat?: string;
};

/** Base agent definition from agents.yaml (skills are defined in stacks, not agents) */
export type AgentDefinition = BaseAgentFields & {
  /** Relative path to agent directory (e.g., "developer/api-developer") */
  path?: string;
  /** Root path where this agent was loaded from (for template resolution) */
  sourceRoot?: string;
  /** Base directory for agent files relative to sourceRoot (e.g., "src/agents" or ".claude-src/agents") */
  agentBaseDir?: string;
  /** Explicit domain for wizard grouping (takes precedence over inference from kebab prefix) */
  domain?: Domain;
};

/** Fully resolved agent config (agent definition + stack config) used by the compiler */
export type AgentConfig = AgentDefinition & {
  name: string;
  /** Unified skills list (loaded dynamically via Skill tool) */
  skills: Skill[];
};

/** Agent configuration from agent.yaml (co-located in each agent folder) */
export type AgentYamlConfig = BaseAgentFields & {
  id: AgentName;
  /** Explicit domain for wizard grouping (takes precedence over inference from kebab prefix) */
  domain?: Domain;
  /** True if this agent was created outside the CLI's built-in vocabulary */
  custom?: boolean;
};

/** Agent frontmatter matching official Claude Code plugin format for compiled .md files */
export type AgentFrontmatter = {
  /** Used as plugin name */
  name: string;
  /** Shown in Task tool description */
  description: string;
  /** Comma-separated list of tools available to this agent */
  tools?: string;
  /** Comma-separated list of tools this agent cannot use */
  disallowedTools?: string;
  /** Use "inherit" to use parent model */
  model?: ModelName;
  permissionMode?: PermissionMode;
  /** Skill names that are preloaded for this agent */
  skills?: SkillId[];
  hooks?: Record<string, AgentHookDefinition[]>;
};

/** All data needed to render a compiled agent prompt */
export type CompiledAgentData = {
  agent: AgentConfig;
  intro: string;
  workflow: string;
  examples: string;
  /** Rendered at the top of the agent prompt */
  criticalRequirementsTop: string;
  /** Rendered at the bottom of the agent prompt */
  criticalReminders: string;
  outputFormat: string;
  skills: Skill[];
  /** Skills with content embedded in the compiled agent */
  preloadedSkills: Skill[];
  /** Skills loaded via Skill tool (metadata only) */
  dynamicSkills: Skill[];
  /** Skill IDs (local mode) or plugin refs (plugin mode) for frontmatter */
  preloadedSkillIds: (SkillId | PluginSkillRef)[];
};

/** Paths to fetched agent definition sources (directory paths, not agent data) */
export type AgentSourcePaths = {
  agentsDir: string;
  templatesDir: string;
  sourcePath: string;
};
