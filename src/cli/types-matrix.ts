/** Root configuration from skills-matrix.yaml */
export interface SkillsMatrixConfig {
  /** Semantic version of the matrix schema (e.g., "1.0.0") */
  version: string;

  /**
   * Category definitions indexed by category ID
   * Each category belongs to a domain (web, api, cli, mobile, shared)
   */
  categories: Record<string, CategoryDefinition>;

  /** Relationship rules between skills */
  relationships: RelationshipDefinitions;

  /**
   * Pre-configured technology combinations for quick setup
   * @deprecated Use config/stacks.yaml instead (Phase 6). Optional for backwards compatibility.
   */
  suggested_stacks?: SuggestedStack[];

  /**
   * Maps short alias names to normalized skill IDs
   * @example { "react": "web-framework-react", "zustand": "web-state-zustand" }
   */
  skill_aliases: Record<string, string>;
}

/**
 * Category definition from skills-matrix.yaml
 * Each category belongs to a domain (web, api, cli, mobile, shared) for wizard grouping
 */
export interface CategoryDefinition {
  /** Unique identifier (e.g., "styling", "state-management") */
  id: string;

  /** Human-readable display name (e.g., "State Management") */
  name: string;

  /** Brief description shown in wizard */
  description: string;

  /**
   * Domain this category belongs to, for wizard domain filtering
   * @example "web" for web categories, "api" for api categories
   */
  domain?: "web" | "api" | "cli" | "mobile" | "shared";

  /**
   * If true, only one skill from this category can be selected
   * @default true
   * @example true for framework (can't have React AND Vue)
   */
  exclusive: boolean;

  /**
   * If true, user MUST select something from this category
   * @default false
   * @example true for framework, false for state-management
   */
  required: boolean;

  /** Display order within domain (lower = earlier) */
  order: number;

  /** Optional emoji icon for display */
  icon?: string;
}

/**
 * All relationship types between skills
 */
export interface RelationshipDefinitions {
  /** Mutual exclusion rules - selecting one disables the others */
  conflicts: ConflictRule[];

  /** Soft warnings - selecting one shows warning for others but doesn't disable */
  discourages: DiscourageRule[];

  /** Soft suggestions - selecting one highlights recommended companions */
  recommends: RecommendRule[];

  /** Hard dependencies - skill A requires skill B to be selected first */
  requires: RequireRule[];

  /** Groups of interchangeable skills for the same purpose */
  alternatives: AlternativeGroup[];
}

/**
 * Conflict rule - skills that cannot be selected together
 */
export interface ConflictRule {
  /**
   * List of skill aliases/IDs that conflict with each other
   * Selecting any one disables ALL others in this list
   */
  skills: string[];

  /** Human-readable explanation shown when option is disabled */
  reason: string;
}

/**
 * Discourage rule - skills that show a warning when selected together
 * Unlike conflicts, these can still be selected but show a "not recommended" warning
 */
export interface DiscourageRule {
  /**
   * List of skill aliases/IDs that discourage each other
   * Selecting any one shows a warning for ALL others in this list
   */
  skills: string[];

  /** Human-readable explanation shown as a warning */
  reason: string;
}

/**
 * Recommendation rule - suggests skills based on current selection
 */
export interface RecommendRule {
  /** Skill alias/ID that triggers this recommendation */
  when: string;

  /** List of skill aliases/IDs to highlight as recommended */
  suggest: string[];

  /** Human-readable explanation shown with recommendation */
  reason: string;
}

/**
 * Requirement rule - enforces hard dependencies between skills
 */
export interface RequireRule {
  /** Skill alias/ID that has requirements */
  skill: string;

  /** Skills that must be selected before this one */
  needs: string[];

  /**
   * If true, only ONE of the `needs` skills is required (OR logic)
   * If false/undefined, ALL of the `needs` skills are required (AND logic)
   * @default false
   */
  needs_any?: boolean;

  /** Human-readable explanation shown when requirement not met */
  reason: string;
}

/**
 * Alternative group - skills that serve the same purpose
 * Used for display grouping and "similar options" suggestions
 */
export interface AlternativeGroup {
  /** Description of what these skills are for */
  purpose: string;

  /** List of interchangeable skill aliases/IDs */
  skills: string[];
}

/**
 * Pre-configured stack of skills for a specific use case
 */
export interface SuggestedStack {
  /** Unique identifier for this stack */
  id: string;

  /** Human-readable display name */
  name: string;

  /** Brief description of the stack's purpose */
  description: string;

  /** Target audiences (e.g., "startups", "enterprise", "personal") */
  audience: string[];

  /**
   * Skill selections organized by category
   * Structure: { category: { subcategory: skill_alias } }
   */
  skills: Record<string, Record<string, string>>;

  /** Guiding principle for this stack */
  philosophy: string;
}

/**
 * Skill metadata extracted from individual skill directories.
 * Combines SKILL.md frontmatter with metadata.yaml before merging with skills-matrix.yaml.
 */
export interface ExtractedSkillMetadata {
  /**
   * Unique skill identifier (normalized from frontmatter name)
   * Format: "category-subcategory-name" (kebab-case, no author suffix)
   * @example "web-framework-react"
   */
  id: string;

  /**
   * Directory path for filesystem access
   * Used for loading skill files from the filesystem
   * @example "web/framework/react (@vince)"
   */
  directoryPath: string;

  /**
   * Display name derived from id
   * @example "Zustand" from "zustand (@vince)"
   */
  name: string;

  /** Brief description of the skill's purpose (for CLI display) */
  description: string;

  /** When an AI agent should invoke this skill (decision criteria) */
  usageGuidance?: string;

  /**
   * Primary category this skill belongs to
   * @example "state", "styling", "framework", "api"
   */
  category: string;

  /**
   * If true, only one skill from this category can be active
   * @default true
   */
  categoryExclusive: boolean;

  /** Author handle for attribution */
  author: string;

  /** Tags for search and filtering */
  tags: string[];

  /**
   * Skills this works well with (soft recommendation)
   * @example ["react (@vince)", "hono (@vince)"]
   */
  compatibleWith: string[];

  /**
   * Skills that cannot coexist with this one
   * @example ["mobx (@vince)", "redux (@vince)"]
   */
  conflictsWith: string[];

  /**
   * Skills that must be present for this to work
   * @example ["react (@vince)"] for zustand
   */
  requires: string[];

  /**
   * Setup skills that must be completed first
   * Links usage skills to their prerequisites
   * @example ["posthog-setup (@vince)"] for posthog-analytics
   */
  requiresSetup: string[];

  /**
   * Usage skills this setup skill configures
   * Links setup skills to what they enable
   * @example ["posthog-analytics (@vince)", "posthog-flags (@vince)"]
   */
  providesSetupFor: string[];

  /**
   * Relative path from src/ to the skill directory
   * @example "skills/web/client-state-management/zustand (@vince)"
   */
  path: string;

  /** True if this skill is from .claude/skills/ (user-defined local skill) */
  local?: boolean;

  /**
   * Relative path from project root for local skills
   * @example ".claude/skills/my-skill/"
   */
  localPath?: string;
}

/**
 * Fully merged skills matrix for CLI consumption.
 * Output of mergeMatrixWithSkills() combining skills-matrix.yaml with extracted metadata.
 */
export interface MergedSkillsMatrix {
  /** Schema version for compatibility checking */
  version: string;

  /** Category definitions for wizard navigation */
  categories: Record<string, CategoryDefinition>;

  /**
   * Fully resolved skills with computed relationship data
   * Indexed by full skill ID for O(1) lookup
   */
  skills: Record<string, ResolvedSkill>;

  /** Pre-configured stacks with resolved skill references */
  suggestedStacks: ResolvedStack[];

  /**
   * Alias lookup map (alias -> normalized skill ID)
   * @example { "react": "web-framework-react" }
   */
  aliases: Record<string, string>;

  /**
   * Reverse alias lookup (normalized skill ID -> alias)
   * @example { "web-framework-react": "react" }
   */
  aliasesReverse: Record<string, string>;

  /** Generated timestamp for cache invalidation */
  generatedAt: string;
}

/** Single skill with all computed relationships resolved for CLI rendering */
export interface ResolvedSkill {
  /** Full unique identifier in normalized format: "web-state-zustand" */
  id: string;

  /**
   * Short alias if defined in skill_aliases
   * @example "zustand" for "web-state-zustand"
   */
  alias?: string;

  /** Human-readable display name */
  name: string;

  /** Brief description (for CLI display) */
  description: string;

  /** When an AI agent should invoke this skill (decision criteria) */
  usageGuidance?: string;

  /** Primary category ID (matches key in matrix.categories) */
  category: string;

  /** If true, only one skill from this category can be selected */
  categoryExclusive: boolean;

  /** Tags for filtering and search */
  tags: string[];

  /** Author handle */
  author: string;

  /** DEPRECATED: Version now lives in plugin.json. Optional for backward compatibility. */
  version?: string;

  /** Skills that conflict with this one */
  conflictsWith: SkillRelation[];

  /** Skills that are recommended when this is selected */
  recommends: SkillRelation[];

  /** Skills that recommend THIS skill when THEY are selected (inverse of recommends) */
  recommendedBy: SkillRelation[];

  /** Skills that THIS skill requires (must select first) */
  requires: SkillRequirement[];

  /** Skills that require THIS skill (inverse of requires) */
  requiredBy: SkillRelation[];

  /** Alternative skills that serve the same purpose */
  alternatives: SkillAlternative[];

  /** Skills that are discouraged when this is selected (show warning) */
  discourages: SkillRelation[];

  /**
   * Framework skill IDs this skill is compatible with.
   * Used for framework-first filtering in the Build step.
   * @example ["web-framework-react", "web-framework-vue-composition-api"]
   */
  compatibleWith: string[];

  /** Setup skills that must be completed before using this */
  requiresSetup: string[];

  /** Usage skills that this setup skill configures */
  providesSetupFor: string[];

  /** Relative path to skill directory from src/ */
  path: string;

  /** True if this skill is from .claude/skills/ (user-defined local skill) */
  local?: boolean;

  /**
   * Relative path from project root for local skills
   * @example ".claude/skills/my-skill/"
   */
  localPath?: string;
}

export interface SkillRelation {
  /** Full skill ID of the related skill */
  skillId: string;

  /** Human-readable explanation of the relationship */
  reason: string;
}

export interface SkillRequirement {
  /** Full skill IDs that are required */
  skillIds: string[];

  /**
   * If true, only ONE of skillIds is needed (OR)
   * If false, ALL of skillIds are needed (AND)
   * @default false
   */
  needsAny: boolean;

  /** Human-readable explanation */
  reason: string;
}

export interface SkillAlternative {
  /** Full skill ID of the alternative */
  skillId: string;

  /** What purpose this alternative serves */
  purpose: string;
}

export interface ResolvedStack {
  /** Stack identifier */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Target audiences */
  audience: string[];

  /** Skill selections with resolved full skill IDs by category */
  skills: Record<string, Record<string, string>>;

  /** Flat list of all skill IDs in this stack */
  allSkillIds: string[];

  /** Guiding principle */
  philosophy: string;
}

/** Skill option as displayed in the wizard, computed based on current selections */
export interface SkillOption {
  /** Full skill ID */
  id: string;

  /** Short alias if available */
  alias?: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Whether this option is currently disabled */
  disabled: boolean;

  /**
   * Why this option is disabled
   * @example "Conflicts with Tailwind (already selected)"
   */
  disabledReason?: string;

  /** Whether this option is discouraged (not recommended) based on current selections */
  discouraged: boolean;

  /**
   * Why this is not recommended
   * @example "Mixing CSS paradigms is unusual"
   */
  discouragedReason?: string;

  /** Whether this option is recommended based on current selections */
  recommended: boolean;

  /**
   * Why this is recommended
   * @example "Works great with React"
   */
  recommendedReason?: string;

  /** Whether this skill is already selected */
  selected: boolean;

  /** Alternative skills that serve the same purpose */
  alternatives: string[];
}

export interface SelectionValidation {
  /** Whether the selection is valid */
  valid: boolean;

  /** Error messages if invalid */
  errors: ValidationError[];

  /** Warning messages (valid but with caveats) */
  warnings: ValidationWarning[];
}

export interface ValidationError {
  /** Type of error */
  type: "conflict" | "missing_requirement" | "category_exclusive";

  /** Human-readable message */
  message: string;

  /** Skill IDs involved in the error */
  skills: string[];
}

export interface ValidationWarning {
  /** Type of warning */
  type: "missing_recommendation" | "unused_setup";

  /** Human-readable message */
  message: string;

  /** Skill IDs involved */
  skills: string[];
}
