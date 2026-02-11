/**
 * TypeScript types for the Stack-Based Agent Compilation System
 */

import type {
  AgentName,
  CategoryPath,
  ModelName,
  PermissionMode,
  ResolvedSubcategorySkills,
  SkillId,
} from "./cli/types-matrix";

/**
 * Skill definition from registry.yaml.
 * Contains static metadata that doesn't change per-agent.
 */
export type SkillDefinition = {
  /** Canonical skill identifier (e.g., "web-framework-react") */
  id: SkillId;
  /** Filesystem path to the skill directory */
  path: string;
  /** Brief description of the skill's purpose */
  description: string;
};

/**
 * Skill assignment in stack config.yaml.
 * Specifies whether a skill should be preloaded (embedded) or dynamic (loaded via Skill tool).
 */
export type SkillAssignment = {
  /** Canonical skill identifier */
  id: SkillId;
  /** Whether skill content is embedded in the compiled agent. @default false */
  preloaded?: boolean;
  /** True if this is a local skill from .claude/skills/ */
  local?: boolean;
  /** Relative path from project root for local skills (e.g., ".claude/skills/my-skill/") */
  path?: string;
};

/**
 * Skill reference in config.yaml (agent-specific).
 * References a skill by ID and provides context-specific usage.
 */
export type SkillReference = {
  /** Canonical skill identifier */
  id: SkillId;
  /** Context-specific description of when to use this skill */
  usage: string;
  /** Whether skill content should be embedded in compiled agent */
  preloaded?: boolean;
};

/**
 * Fully resolved skill (merged from registry.yaml + config.yaml).
 * Extends SkillDefinition with agent-specific fields.
 * This is what the compiler uses after merging.
 */
export type Skill = SkillDefinition & {
  /** Context-specific usage guidance for this agent */
  usage: string;
  /** Whether skill is listed in frontmatter (Claude Code loads automatically) */
  preloaded: boolean;
};

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

/**
 * Fully resolved agent config (agent definition + compile config)
 * This is what the compiler uses after merging agent definitions with stack config
 */
export type AgentConfig = AgentDefinition & {
  name: string;
  /** Unified skills list (loaded dynamically via Skill tool) */
  skills: Skill[];
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

/**
 * Agent configuration from agent.yaml (co-located in each agent folder)
 * Supports official Claude Code plugin format fields
 */
export type AgentYamlConfig = BaseAgentFields & {
  id: AgentName;
};

/**
 * SKILL.md frontmatter - matches official Claude Code plugin format
 * Contains: name (kebab-case identifier), description, and optional runtime behavior
 *
 * Note: `author` and `version` are in metadata.yaml (for marketplace.json), NOT here
 */
export type SkillFrontmatter = {
  /** Skill identifier in kebab-case (e.g., "react", "api-hono"). Used as plugin name. */
  name: SkillId;
  /** Brief description of the skill's purpose for Claude agents */
  description: string;
  /** AI model to use for this skill */
  model?: ModelName;
};

/**
 * metadata.yaml - relationship and catalog data for skills
 * Identity (name, description) comes from SKILL.md frontmatter
 */
export type SkillMetadataConfig = {
  category?: CategoryPath;
  category_exclusive?: boolean;
  author?: string;
  version?: string;
  tags?: string[];
  requires?: SkillId[];
  compatible_with?: SkillId[];
  conflicts_with?: SkillId[];
};

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

/**
 * Author information for plugin manifest
 */
export type PluginAuthor = {
  /** Author's display name */
  name: string;
  /** Author's email address (optional) */
  email?: string;
};

/**
 * Plugin manifest for Claude Code plugins (plugin.json)
 * Defines the structure and content of a plugin package
 */
export type PluginManifest = {
  /** Plugin name in kebab-case (e.g., "skill-react", "stack-nextjs-fullstack") */
  name: string;
  /** Plugin version in semver format (e.g., "1.0.0") */
  version?: string;
  /** Brief description of the plugin's purpose */
  description?: string;
  /** Plugin author information */
  author?: PluginAuthor;
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
};

/**
 * Remote source configuration for marketplace plugins
 */
export type MarketplaceRemoteSource = {
  /** Source type: github or url */
  source: "github" | "url";
  /** GitHub repository in owner/repo format */
  repo?: string;
  /** Direct URL to plugin archive */
  url?: string;
  /** Git ref (branch, tag, or commit) */
  ref?: string;
};

/**
 * Plugin entry in a marketplace.json file
 */
export type MarketplacePlugin = {
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
};

/**
 * Marketplace owner information
 */
export type MarketplaceOwner = {
  /** Owner's display name */
  name: string;
  /** Owner's contact email */
  email?: string;
};

/**
 * Marketplace metadata
 */
export type MarketplaceMetadata = {
  /** Root directory for plugin sources */
  pluginRoot?: string;
};

/**
 * Marketplace configuration (marketplace.json)
 * Defines a collection of Claude Code plugins
 */
export type Marketplace = {
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
};

/**
 * Result from fetching marketplace data from a remote source.
 * Contains the parsed marketplace and caching metadata.
 */
export type MarketplaceFetchResult = {
  /** Parsed marketplace data */
  marketplace: Marketplace;
  /** Path where source was fetched/cached */
  sourcePath: string;
  /** Whether result came from cache */
  fromCache: boolean;
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
