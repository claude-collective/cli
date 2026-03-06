import type { AgentName } from "./agents";
import type { Domain } from "./matrix";
import type { SkillId, SkillReference } from "./skills";
import type { StackAgentConfig } from "./stacks";

/** Per-skill configuration with scope and source */
export type SkillConfig = {
  id: SkillId;
  scope: "project" | "global";
  source: string; // "local" | marketplace name (e.g., "agents-inc")
};

/** Per-agent configuration with scope (mirrors SkillConfig pattern) */
export type AgentScopeConfig = {
  name: AgentName;
  scope: "project" | "global";
};

/** Agent configuration for compilation - contains skills for a specific agent */
export type CompileAgentConfig = {
  skills?: SkillReference[];
};

/** Compile configuration derived from stack (agents to compile from keys of `agents`) */
export type CompileConfig = {
  name: string;
  description: string;
  /** Stack reference - resolves stack skills for agents */
  stack?: string;
  /** Keys determine which agents to compile */
  agents: Record<string, CompileAgentConfig>;
};

/** Compilation context passed through the compile pipeline */
export type CompileContext = {
  stackId: string;
  verbose: boolean;
  projectRoot: string;
  outputDir: string;
};

/** Generic validation result with errors and warnings */
export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/** Unified project configuration stored at .claude-src/config.ts */
export type ProjectConfig = {
  /** @default "1" */
  version?: "1";

  /** Project/plugin name (kebab-case) */
  name: string;

  description?: string;

  agents: AgentScopeConfig[];

  skills: SkillConfig[];

  /** Author handle (e.g., "@vince") */
  author?: string;

  /**
   * Resolved stack configuration with agent->skill mappings.
   * Keys are agent IDs, values are category->SkillAssignment[] mappings.
   * Values are normalized to SkillAssignment[] at load time (same as stacks.ts).
   * Generated during `agentsinc init` when a stack is selected.
   */
  stack?: Record<string, StackAgentConfig>;

  /**
   * Skills source path or URL.
   * Saved when --source is provided during init/eject.
   * @example "/home/user/my-skills" or "github:my-org/skills"
   */
  source?: string;

  /**
   * Marketplace identifier for plugin installation.
   * @example "agents-inc"
   */
  marketplace?: string;

  /**
   * Agents source path or URL (when agents come from a different source than skills).
   * If not specified, uses the same source as skills.
   */
  agentsSource?: string;

  /**
   * Selected domains from the wizard.
   * Persisted so edit mode can restore the user's domain selection.
   * Omitted when empty (sparse YAML output).
   */
  domains?: Domain[];

  /**
   * Selected agents from the wizard.
   * Persisted so edit mode can restore the user's agent selection.
   * Omitted when empty (sparse YAML output).
   */
  selectedAgents?: AgentName[];
};
