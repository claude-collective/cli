import type { AgentName } from "./agents";
import type { ResolvedSubcategorySkills, SkillReference } from "./skills";

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

/** Unified project configuration stored at .claude/config.yaml */
export type ProjectConfig = {
  /** @default "1" */
  version?: "1";

  /** Project/plugin name (kebab-case) */
  name: string;

  description?: string;

  agents: AgentName[];

  /** Author handle (e.g., "@vince") */
  author?: string;

  /**
   * - 'local': Agents compiled to .claude/agents (committed to repo)
   * - 'plugin': Agents compiled to .claude/plugins/claude-collective
   * @default 'local'
   */
  installMode?: "local" | "plugin";

  /**
   * Resolved stack configuration with agent->skill mappings.
   * Keys are agent IDs, values are subcategory->skill ID mappings.
   * Generated during `cc init` when a stack is selected.
   */
  stack?: Record<string, ResolvedSubcategorySkills>;

  /**
   * Skills source path or URL.
   * Saved when --source is provided during init/eject.
   * @example "/home/user/my-skills" or "github:my-org/skills"
   */
  source?: string;

  /**
   * Marketplace identifier for plugin installation.
   * @example "claude-collective"
   */
  marketplace?: string;

  /**
   * Agents source path or URL (when agents come from a different source than skills).
   * If not specified, uses the same source as skills.
   */
  agents_source?: string;
};
