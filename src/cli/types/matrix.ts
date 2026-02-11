/**
 * Matrix types — domain/category/relationship definitions for the skills matrix.
 * Includes base union types (Domain, Subcategory, ModelName, PermissionMode)
 * and all structural types from skills-matrix.yaml.
 */

import type { CategoryPath, SkillDisplayName, SkillId } from "./skills";
import type { AgentName } from "./agents";

// =============================================================================
// Base Union Types - Single Source of Truth
// =============================================================================

/** Valid domain names for skill categorization in the wizard */
export type Domain = "web" | "web-extras" | "api" | "cli" | "mobile" | "shared";

/**
 * Valid subcategory names (category IDs) within domains.
 * These are the keys in skills-matrix.yaml `categories` section.
 */
export type Subcategory =
  // Web
  | "framework"
  | "meta-framework"
  | "styling"
  | "client-state"
  | "server-state"
  | "forms"
  | "testing"
  | "ui-components"
  | "mocking"
  | "error-handling"
  | "i18n"
  | "file-upload"
  | "files"
  | "utilities"
  | "realtime"
  | "animation"
  | "pwa"
  | "accessibility"
  | "web-performance"
  // API
  | "api"
  | "database"
  | "auth"
  | "observability"
  | "analytics"
  | "email"
  | "performance"
  // Mobile
  | "mobile-framework"
  | "base-framework"
  | "platform"
  // Shared / Infrastructure
  | "monorepo"
  | "tooling"
  | "security"
  | "methodology"
  | "research"
  | "reviewing"
  | "ci-cd"
  // CLI
  | "cli-framework"
  | "cli-prompts"
  | "cli-testing";

// =============================================================================
// Shared Scalar Union Types
// =============================================================================

/** Valid AI model names for agents and skills */
export type ModelName = "sonnet" | "opus" | "haiku" | "inherit";

/** Valid permission modes for agent operations */
export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "dontAsk"
  | "bypassPermissions"
  | "plan"
  | "delegate";

// =============================================================================
// Category & Relationship Types
// =============================================================================

/**
 * Category definitions indexed by subcategory ID.
 * Used in SkillsMatrixConfig and MergedSkillsMatrix.
 */
export type CategoryMap = Partial<Record<Subcategory, CategoryDefinition>>;

/**
 * Full domain selections: Domain -> Subcategory -> SkillId[].
 * Used throughout the wizard pipeline (store, components, result).
 */
export type DomainSelections = Partial<Record<Domain, Partial<Record<Subcategory, SkillId[]>>>>;

/**
 * Category definition from skills-matrix.yaml
 * Each category belongs to a domain (web, api, cli, mobile, shared) for wizard grouping
 */
export type CategoryDefinition = {
  /** Unique identifier (e.g., "styling", "state-management") */
  id: Subcategory;

  /** Human-readable display name (e.g., "State Management") */
  displayName: string;

  /** Brief description shown in wizard */
  description: string;

  /**
   * Domain this category belongs to, for wizard domain filtering
   * @example "web" for web categories, "api" for api categories
   */
  domain?: Domain;

  /**
   * Parent domain for display-only sub-domains (e.g., "web" for "web-extras").
   * Used to inherit framework selections from the parent domain.
   */
  parent_domain?: Domain;

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
};

/**
 * All relationship types between skills
 */
export type RelationshipDefinitions = {
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
};

/**
 * Conflict rule - skills that cannot be selected together
 */
export type ConflictRule = {
  /**
   * List of skill IDs that conflict with each other.
   * Aliases are resolved to canonical IDs at the YAML parse boundary.
   * Selecting any one disables ALL others in this list.
   */
  skills: SkillId[];

  /** Human-readable explanation shown when option is disabled */
  reason: string;
};

/**
 * Discourage rule - skills that show a warning when selected together
 * Unlike conflicts, these can still be selected but show a "not recommended" warning
 */
export type DiscourageRule = {
  /**
   * List of skill IDs that discourage each other.
   * Aliases are resolved to canonical IDs at the YAML parse boundary.
   * Selecting any one shows a warning for ALL others in this list.
   */
  skills: SkillId[];

  /** Human-readable explanation shown as a warning */
  reason: string;
};

/**
 * Recommendation rule - suggests skills based on current selection
 */
export type RecommendRule = {
  /** Skill ID that triggers this recommendation */
  when: SkillId;

  /** List of skill IDs to highlight as recommended */
  suggest: SkillId[];

  /** Human-readable explanation shown with recommendation */
  reason: string;
};

/**
 * Requirement rule - enforces hard dependencies between skills
 */
export type RequireRule = {
  /** Skill ID that has requirements */
  skill: SkillId;

  /** Skills that must be selected before this one */
  needs: SkillId[];

  /**
   * If true, only ONE of the `needs` skills is required (OR logic)
   * If false/undefined, ALL of the `needs` skills are required (AND logic)
   * @default false
   */
  needs_any?: boolean;

  /** Human-readable explanation shown when requirement not met */
  reason: string;
};

/**
 * Alternative group - skills that serve the same purpose
 * Used for display grouping and "similar options" suggestions
 */
export type AlternativeGroup = {
  /** Description of what these skills are for */
  purpose: string;

  /** List of interchangeable skill IDs */
  skills: SkillId[];
};

/** Root configuration from skills-matrix.yaml */
export type SkillsMatrixConfig = {
  /** Semantic version of the matrix schema (e.g., "1.0.0") */
  version: string;

  /**
   * Category definitions indexed by category ID
   * Each category belongs to a domain (web, api, cli, mobile, shared)
   */
  categories: CategoryMap;

  /** Relationship rules between skills */
  relationships: RelationshipDefinitions;

  /**
   * Maps short display names to normalized skill IDs
   * @example { "react": "web-framework-react", "zustand": "web-state-zustand" }
   */
  skill_aliases: Partial<Record<SkillDisplayName, SkillId>>;
};

// =============================================================================
// Resolved Matrix Types
// =============================================================================

/**
 * Pre-configured stack of skills for a specific use case
 */
export type SuggestedStack = {
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
   * Structure: { agentName: { subcategory: skillId } }
   */
  skills: Record<string, Partial<Record<Subcategory, SkillId>>>;

  /** Guiding principle for this stack */
  philosophy: string;
};

/**
 * Fully merged skills matrix for CLI consumption.
 * Output of mergeMatrixWithSkills() combining skills-matrix.yaml with extracted metadata.
 */
export type MergedSkillsMatrix = {
  /** Schema version for compatibility checking */
  version: string;

  /** Category definitions for wizard navigation */
  categories: CategoryMap;

  /**
   * Fully resolved skills with computed relationship data
   * Indexed by full skill ID for O(1) lookup
   */
  skills: Partial<Record<SkillId, ResolvedSkill>>;

  /** Pre-configured stacks with resolved skill references */
  suggestedStacks: ResolvedStack[];

  /**
   * Display name to skill ID lookup map
   * @example { "react": "web-framework-react" }
   */
  displayNameToId: Partial<Record<SkillDisplayName, SkillId>>;

  /**
   * Skill ID to display name lookup (reverse map)
   * @example { "web-framework-react": "react" }
   */
  displayNames: Partial<Record<SkillId, SkillDisplayName>>;

  /** Generated timestamp for cache invalidation */
  generatedAt: string;
};

/** Single skill with all computed relationships resolved for CLI rendering */
export type ResolvedSkill = {
  /** Full unique identifier in normalized format: "web-state-zustand" */
  id: SkillId;

  /**
   * Short display name if defined in skill_aliases
   * @example "zustand" for "web-state-zustand"
   */
  displayName?: SkillDisplayName;

  /** Brief description (for CLI display) */
  description: string;

  /** When an AI agent should invoke this skill (decision criteria) */
  usageGuidance?: string;

  /** Primary category ID (matches key in matrix.categories) */
  category: CategoryPath;

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

  /** Skills that THIS skill requires (must select first) */
  requires: SkillRequirement[];

  /** Alternative skills that serve the same purpose */
  alternatives: SkillAlternative[];

  /** Skills that are discouraged when this is selected (show warning) */
  discourages: SkillRelation[];

  /**
   * Framework skill IDs this skill is compatible with.
   * Used for framework-first filtering in the Build step.
   * @example ["web-framework-react", "web-framework-vue-composition-api"]
   */
  compatibleWith: SkillId[];

  /** Setup skills that must be completed before using this */
  requiresSetup: SkillId[];

  /** Usage skills that this setup skill configures */
  providesSetupFor: SkillId[];

  /** Relative path to skill directory from src/ */
  path: string;

  /** True if this skill is from .claude/skills/ (user-defined local skill) */
  local?: boolean;

  /**
   * Relative path from project root for local skills
   * @example ".claude/skills/my-skill/"
   */
  localPath?: string;
};

export type SkillRelation = {
  /** Full skill ID of the related skill */
  skillId: SkillId;

  /** Human-readable explanation of the relationship */
  reason: string;
};

export type SkillRequirement = {
  /** Full skill IDs that are required */
  skillIds: SkillId[];

  /**
   * If true, only ONE of skillIds is needed (OR)
   * If false, ALL of skillIds are needed (AND)
   * @default false
   */
  needsAny: boolean;

  /** Human-readable explanation */
  reason: string;
};

export type SkillAlternative = {
  /** Full skill ID of the alternative */
  skillId: SkillId;

  /** What purpose this alternative serves */
  purpose: string;
};

export type ResolvedStack = {
  /** Stack identifier */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Target audiences */
  audience: string[];

  /** Skill selections with resolved full skill IDs by category */
  skills: Partial<Record<AgentName, Partial<Record<Subcategory, SkillId>>>>;

  /** Flat list of all skill IDs in this stack */
  allSkillIds: SkillId[];

  /** Guiding principle */
  philosophy: string;
};

/** Skill option as displayed in the wizard, computed based on current selections */
export type SkillOption = {
  /** Full skill ID */
  id: SkillId;

  /** Short display name if available */
  displayName?: SkillDisplayName;

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
  alternatives: SkillId[];
};

export type SelectionValidation = {
  /** Whether the selection is valid */
  valid: boolean;

  /** Error messages if invalid */
  errors: ValidationError[];

  /** Warning messages (valid but with caveats) */
  warnings: ValidationWarning[];
};

export type ValidationError = {
  /** Type of error */
  type: "conflict" | "missing_requirement" | "category_exclusive";

  /** Human-readable message */
  message: string;

  /** Skill IDs involved in the error */
  skills: SkillId[];
};

export type ValidationWarning = {
  /** Type of warning */
  type: "missing_recommendation" | "unused_setup";

  /** Human-readable message */
  message: string;

  /** Skill IDs involved */
  skills: SkillId[];
};

/**
 * Skill metadata extracted from individual skill directories.
 * Combines SKILL.md frontmatter with metadata.yaml before merging with skills-matrix.yaml.
 */
export type ExtractedSkillMetadata = {
  /**
   * Unique skill identifier (normalized from frontmatter name)
   * Format: "category-subcategory-name" (kebab-case, no author suffix)
   * @example "web-framework-react"
   */
  id: SkillId;

  /**
   * Directory path for filesystem access
   * Used for loading skill files from the filesystem
   * @example "web/framework/react"
   */
  directoryPath: string;

  /** Brief description of the skill's purpose (for CLI display) */
  description: string;

  /** When an AI agent should invoke this skill (decision criteria) */
  usageGuidance?: string;

  /**
   * Primary category this skill belongs to
   * @example "state", "styling", "framework", "api"
   */
  category: CategoryPath;

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
   * Skills this works well with (soft recommendation).
   * May contain display names at parse time; resolved to canonical IDs during matrix merge.
   * @example ["web-framework-react", "api-framework-hono"]
   */
  compatibleWith: SkillId[];

  /**
   * Skills that cannot coexist with this one.
   * May contain display names at parse time; resolved to canonical IDs during matrix merge.
   * @example ["web-state-mobx", "web-state-redux"]
   */
  conflictsWith: SkillId[];

  /**
   * Skills that must be present for this to work.
   * May contain display names at parse time; resolved to canonical IDs during matrix merge.
   * @example ["web-framework-react"] for web-state-zustand
   */
  requires: SkillId[];

  /**
   * Setup skills that must be completed first.
   * May contain display names at parse time; resolved to canonical IDs during matrix merge.
   * Links usage skills to their prerequisites.
   * @example ["api-analytics-posthog-setup"] for api-analytics-posthog-analytics
   */
  requiresSetup: SkillId[];

  /**
   * Usage skills this setup skill configures.
   * May contain display names at parse time; resolved to canonical IDs during matrix merge.
   * Links setup skills to what they enable.
   * @example ["api-analytics-posthog-analytics", "api-analytics-posthog-flags"]
   */
  providesSetupFor: SkillId[];

  /**
   * Relative path from src/ to the skill directory
   * @example "skills/web/client-state/zustand/"
   */
  path: string;

  /** True if this skill is from .claude/skills/ (user-defined local skill) */
  local?: boolean;

  /**
   * Relative path from project root for local skills
   * @example ".claude/skills/my-skill/"
   */
  localPath?: string;
};
