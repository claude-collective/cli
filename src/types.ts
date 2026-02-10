/**
 * TypeScript types for the Stack-Based Agent Compilation System
 */

import type { AgentName, CategoryPath, ModelName, PermissionMode, ResolvedSubcategorySkills, SkillId, SkillRef } from "./cli/types-matrix";

/**
 * Skill definition from registry.yaml.
 * Contains static metadata that doesn't change per-agent.
 */
export interface SkillDefinition {
  /** Filesystem path to the skill directory */
  path: string;
  /** Display name derived from skill ID */
  name: string;
  /** Brief description of the skill's purpose */
  description: string;
  /** Canonical skill ID from frontmatter (e.g., "web-framework-react") */
  canonicalId: SkillId;
}

/**
 * Skill assignment in stack config.yaml.
 * Specifies whether a skill should be preloaded (embedded) or dynamic (loaded via Skill tool).
 */
export interface SkillAssignment {
  /** Canonical skill identifier */
  id: SkillId;
  /** Whether skill content is embedded in the compiled agent. @default false */
  preloaded?: boolean;
  /** True if this is a local skill from .claude/skills/ */
  local?: boolean;
  /** Relative path from project root for local skills (e.g., ".claude/skills/my-skill/") */
  path?: string;
}

/**
 * Skill reference in config.yaml (agent-specific).
 * References a skill by ID and provides context-specific usage.
 */
export interface SkillReference {
  /** Canonical skill identifier */
  id: SkillId;
  /** Context-specific description of when to use this skill */
  usage: string;
  /** Whether skill content should be embedded in compiled agent */
  preloaded?: boolean;
}

/**
 * Fully resolved skill (merged from registry.yaml + config.yaml).
 * This is what the compiler uses after merging.
 */
export interface Skill {
  /** Canonical skill identifier */
  id: SkillId;
  /** Filesystem path to the skill directory */
  path: string;
  /** Display name derived from skill ID */
  name: string;
  /** Brief description of the skill's purpose */
  description: string;
  /** Context-specific usage guidance for this agent */
  usage: string;
  /** Whether skill is listed in frontmatter (Claude Code loads automatically) */
  preloaded: boolean;
}

/**
 * Base agent definition from agents.yaml.
 * Skills are defined in stacks, not agents.
 */
export interface AgentDefinition {
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
  /** Relative path to agent directory (e.g., "developer/api-developer") */
  path?: string;
  /** Root path where this agent was loaded from (for template resolution) */
  sourceRoot?: string;
  /** Base directory for agent files relative to sourceRoot (e.g., "src/agents" or ".claude-src/agents") */
  agentBaseDir?: string;
}

// =============================================================================
// Compile Config Types (agent-centric structure)
// =============================================================================

/**
 * Agent configuration for compilation
 * Contains skills for a specific agent
 */
export interface CompileAgentConfig {
  skills?: SkillReference[]; // Optional - can come from stack
}

/**
 * Compile configuration (derived from stack)
 * Agents to compile are derived from the keys of `agents`
 */
export interface CompileConfig {
  name: string;
  description: string;
  claude_md: string;
  /** Stack reference - resolves stack skills for agents */
  stack?: string;
  agents: Record<string, CompileAgentConfig>; // Keys determine which agents to compile
}

// =============================================================================
// Resolved/Compiled Types (used during compilation)
// =============================================================================

/**
 * Fully resolved agent config (agent definition + compile config)
 * This is what the compiler uses after merging agent definitions with stack config
 */
export interface AgentConfig {
  name: string;
  title: string;
  description: string;
  model?: ModelName;
  tools: string[];
  disallowed_tools?: string[]; // Tools this agent cannot use
  permission_mode?: PermissionMode; // Permission mode for agent operations
  hooks?: Record<string, AgentHookDefinition[]>; // Lifecycle hooks
  output_format?: string;
  skills: Skill[]; // Unified skills list (loaded dynamically via Skill tool)
  path?: string; // Relative path to agent directory (e.g., "developer/api-developer")
  sourceRoot?: string; // Root path where this agent was loaded from (for template resolution)
  agentBaseDir?: string; // Base directory for agent files relative to sourceRoot (e.g., "src/agents" or ".claude-src/agents")
}

export interface CompiledAgentData {
  agent: AgentConfig;
  intro: string;
  workflow: string;
  examples: string;
  criticalRequirementsTop: string; // <critical_requirements> at TOP
  criticalReminders: string; // <critical_reminders> at BOTTOM
  outputFormat: string;
  skills: Skill[]; // Flat array of all skills
  preloadedSkills: Skill[]; // Skills with content embedded
  dynamicSkills: Skill[]; // Skills loaded via Skill tool (metadata only)
  preloadedSkillIds: SkillId[]; // IDs for frontmatter and skill tool check
}

// =============================================================================
// Validation Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Custom Agent Types (for custom_agents in config.yaml)
// =============================================================================

/**
 * Custom agent definition in config.yaml
 * Can extend a built-in agent or be completely custom
 */
export interface CustomAgentConfig {
  /** Display title for the agent */
  title: string;
  /** Brief description for Task tool */
  description: string;
  /** Optional built-in agent to extend (inherits tools, model, permission_mode) */
  extends?: AgentName;
  /** Optional model override */
  model?: ModelName;
  /** Tools available to this agent (overrides inherited) */
  tools?: string[];
  /** Tools this agent cannot use */
  disallowed_tools?: string[];
  /** Permission mode for agent operations */
  permission_mode?: PermissionMode;
  /** Agent-specific skill assignments */
  skills?: SkillAssignment[];
  /** Lifecycle hooks */
  hooks?: Record<string, AgentHookDefinition[]>;
}

// =============================================================================
// Unified Project Config Types (for .claude/config.yaml)
// =============================================================================

/**
 * Skill entry - can be a string (ID only) or full assignment
 */
export type SkillEntry = SkillId | SkillAssignment;

/**
 * Per-agent skill configuration
 * Supports both simple list and categorized structure
 */
export type AgentSkillConfig = SkillEntry[] | Record<string, SkillEntry[]>;

/**
 * Unified project configuration for Claude Collective
 * Stored at .claude/config.yaml
 * Backward compatible with StackConfig
 */
export interface ProjectConfig {
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
   * Skills available to agents
   * Can be skill IDs or SkillAssignment objects
   */
  skills?: SkillEntry[];

  /**
   * Agents to compile
   * List of agent names from the agent registry
   */
  agents: string[];

  /**
   * Per-agent skill assignments
   * Overrides default mappings from SKILL_TO_AGENTS
   * If not specified for an agent, uses intelligent defaults
   * Supports both simple list format and categorized structure
   */
  agent_skills?: Record<string, AgentSkillConfig>;

  /**
   * Default preload patterns per agent
   * Overrides default mappings from PRELOADED_SKILLS
   * Maps agent name to skill categories/patterns that should be preloaded
   */
  preload_patterns?: Record<string, string[]>;

  /**
   * Lifecycle hooks for the plugin
   */
  hooks?: Record<string, AgentHookDefinition[]>;

  // --- Optional metadata (for marketplace/publishing) ---

  /**
   * Author handle (e.g., "@vince")
   */
  author?: string;

  /**
   * Framework hint for agent behavior
   * @example "nextjs", "remix", "express"
   */
  framework?: string;

  /**
   * Guiding philosophy for the project
   */
  philosophy?: string;

  /**
   * Design principles
   */
  principles?: string[];

  /**
   * Tags for discoverability
   */
  tags?: string[];

  /**
   * Custom agent definitions
   * Maps custom agent ID to its definition
   */
  custom_agents?: Record<string, CustomAgentConfig>;

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
}

// =============================================================================
// Co-located Config Types (Phase 0A - replaces registry.yaml)
// =============================================================================

/**
 * Agent configuration from agent.yaml (co-located in each agent folder)
 * Supports official Claude Code plugin format fields
 */
export interface AgentYamlConfig {
  id: AgentName;
  title: string;
  description: string;
  model?: ModelName;
  tools: string[];
  disallowed_tools?: string[]; // Tools this agent cannot use
  permission_mode?: PermissionMode; // Permission mode for agent operations
  hooks?: Record<string, AgentHookDefinition[]>; // Lifecycle hooks
  output_format?: string;
  /** Skills available to this agent with inline preloaded flag */
  skills?: Record<string, { id: SkillId; preloaded: boolean }>;
}

// =============================================================================
// Phase 0B: SKILL.md as Source of Truth (Official Claude Code Plugin Format)
// =============================================================================

/**
 * SKILL.md frontmatter - matches official Claude Code plugin format
 * Contains: name (kebab-case identifier), description, and optional runtime behavior
 *
 * Note: `author` and `version` are in metadata.yaml (for marketplace.json), NOT here
 */
export interface SkillFrontmatter {
  /** Skill identifier in kebab-case (e.g., "react", "api-hono"). Used as plugin name. */
  name: SkillId;
  /** Brief description of the skill's purpose for Claude agents */
  description: string;
  /** If true, prevents the AI model from invoking this skill. Default: false */
  "disable-model-invocation"?: boolean;
  /** If true, users can invoke this skill directly. Default: true */
  "user-invocable"?: boolean;
  /** Comma-separated list of tools this skill can use (e.g., "Read, Grep, Glob") */
  "allowed-tools"?: string;
  /** AI model to use for this skill */
  model?: ModelName;
  /** Context mode for skill execution */
  context?: "fork";
  /** Agent name to use when skill is invoked */
  agent?: string;
  /** Hint for arguments when skill is invoked */
  "argument-hint"?: string;
}

/**
 * metadata.yaml - relationship and catalog data for skills
 * Identity (name, description) comes from SKILL.md frontmatter
 */
export interface SkillMetadataConfig {
  category?: CategoryPath;
  category_exclusive?: boolean;
  author?: string;
  version?: string;
  tags?: string[];
  requires?: SkillRef[];
  compatible_with?: SkillRef[];
  conflicts_with?: SkillRef[];
}

// =============================================================================
// Phase 0C: Agent Frontmatter (Official Claude Code Plugin Format)
// =============================================================================

/**
 * Hook action types for agent lifecycle hooks
 */
export interface AgentHookAction {
  type: "command" | "script" | "prompt";
  command?: string;
  script?: string;
  prompt?: string;
}

/**
 * Hook definition with matcher and actions
 */
export interface AgentHookDefinition {
  matcher?: string;
  hooks?: AgentHookAction[];
}

/**
 * Agent frontmatter - matches official Claude Code plugin format for agents
 * Used in compiled agent.md files
 */
export interface AgentFrontmatter {
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
}

// =============================================================================
// Plugin Manifest Types (Claude Code Plugin System)
// =============================================================================

/**
 * Author information for plugin manifest
 */
export interface PluginAuthor {
  /** Author's display name */
  name: string;
  /** Author's email address (optional) */
  email?: string;
}

/**
 * Plugin manifest for Claude Code plugins (plugin.json)
 * Defines the structure and content of a plugin package
 */
export interface PluginManifest {
  /** Plugin name in kebab-case (e.g., "skill-react", "stack-nextjs-fullstack") */
  name: string;
  /** Plugin version in semver format (e.g., "1.0.0") */
  version?: string;
  /** Brief description of the plugin's purpose */
  description?: string;
  /** Plugin author information */
  author?: PluginAuthor;
  /** URL to plugin documentation or homepage */
  homepage?: string;
  /** URL to plugin source repository */
  repository?: string;
  /** SPDX license identifier */
  license?: string;
  /** Keywords for discoverability */
  keywords?: string[];
  /** Path(s) to commands directory or files */
  commands?: string | string[];
  /** Path(s) to agents directory or files */
  agents?: string | string[];
  /** Path(s) to skills directory or files */
  skills?: string | string[];
  /** Path to hooks config file or inline hooks object */
  hooks?: string | Record<string, AgentHookDefinition[]>;
  /** Path to MCP servers config file or inline object */
  mcpServers?: string | object;
}

// =============================================================================
// Marketplace Types (for marketplace.json)
// =============================================================================

/**
 * Remote source configuration for marketplace plugins
 */
export interface MarketplaceRemoteSource {
  /** Source type: github or url */
  source: "github" | "url";
  /** GitHub repository in owner/repo format */
  repo?: string;
  /** Direct URL to plugin archive */
  url?: string;
  /** Git ref (branch, tag, or commit) */
  ref?: string;
}

/**
 * Plugin entry in a marketplace.json file
 */
export interface MarketplacePlugin {
  /** Plugin name in kebab-case (e.g., "skill-react") */
  name: string;
  /** Local path or remote source configuration */
  source: string | MarketplaceRemoteSource;
  /** Brief description of the plugin */
  description?: string;
  /** Plugin version */
  version?: string;
  /** Plugin author information */
  author?: PluginAuthor;
  /** Plugin category for organization (e.g., "frontend", "backend") */
  category?: string;
  /** Keywords for discoverability */
  keywords?: string[];
}

/**
 * Marketplace owner information
 */
export interface MarketplaceOwner {
  /** Owner's display name */
  name: string;
  /** Owner's contact email */
  email?: string;
}

/**
 * Marketplace metadata
 */
export interface MarketplaceMetadata {
  /** Root directory for plugin sources */
  pluginRoot?: string;
}

/**
 * Marketplace configuration (marketplace.json)
 * Defines a collection of Claude Code plugins
 */
export interface Marketplace {
  /** JSON schema reference URL */
  $schema?: string;
  /** Marketplace name in kebab-case */
  name: string;
  /** Marketplace version (semantic versioning) */
  version: string;
  /** Brief description of the marketplace */
  description?: string;
  /** Marketplace owner information */
  owner: MarketplaceOwner;
  /** Additional marketplace metadata */
  metadata?: MarketplaceMetadata;
  /** List of plugins in the marketplace */
  plugins: MarketplacePlugin[];
}

// =============================================================================
// Fetcher Types (for unified cc init flow)
// =============================================================================

/**
 * Result from fetching marketplace data from a remote source.
 * Contains the parsed marketplace and caching metadata.
 */
export interface MarketplaceFetchResult {
  /** Parsed marketplace data */
  marketplace: Marketplace;
  /** Path where source was fetched/cached */
  sourcePath: string;
  /** Whether result came from cache */
  fromCache: boolean;
  /** Cache key for invalidation (optional) */
  cacheKey?: string;
}

/**
 * Paths to fetched agent definition sources.
 * Contains directory paths, not agent data itself.
 */
export interface AgentSourcePaths {
  /** Path to agents directory (contains agent subdirs) */
  agentsDir: string;
  /** Path to _templates directory */
  templatesDir: string;
  /** Original source path */
  sourcePath: string;
}
