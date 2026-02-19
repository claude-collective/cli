import type { CategoryPath, SkillDisplayName, SkillId } from "./skills";
import type { AgentName } from "./agents";

/** Wizard domain grouping for skill categories */
export type Domain = "web" | "api" | "cli" | "mobile" | "shared";

/** Keys in skills-matrix.yaml `categories` section */
export type Subcategory =
  | "web-framework"
  | "web-styling"
  | "web-client-state"
  | "web-server-state"
  | "web-forms"
  | "web-testing"
  | "web-ui-components"
  | "web-mocking"
  | "web-error-handling"
  | "web-i18n"
  | "web-file-upload"
  | "web-files"
  | "web-utilities"
  | "web-realtime"
  | "web-animation"
  | "web-pwa"
  | "web-accessibility"
  | "web-performance"
  | "web-base-framework"
  | "api-api"
  | "api-database"
  | "api-auth"
  | "api-observability"
  | "api-analytics"
  | "api-email"
  | "api-performance"
  | "mobile-framework"
  | "mobile-platform"
  | "shared-monorepo"
  | "shared-tooling"
  | "shared-security"
  | "shared-methodology"
  | "shared-research"
  | "shared-reviewing"
  | "shared-ci-cd"
  | "cli-framework"
  | "cli-prompts"
  | "cli-testing";

/** Claude model selector for agent configuration */
export type ModelName = "sonnet" | "opus" | "haiku" | "inherit";

/** Agent permission mode for Claude Code tool access */
export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "dontAsk"
  | "bypassPermissions"
  | "plan"
  | "delegate";

/**
 * Category definitions indexed by subcategory ID.
 * Partial because not every Subcategory has a category definition (e.g., a marketplace
 * may only define a subset of all possible subcategories).
 */
export type CategoryMap = Partial<Record<Subcategory, CategoryDefinition>>;

/**
 * Full domain selections used throughout the wizard pipeline (store, components, result).
 *
 * Structure: `{ domain: { subcategory: [skillId, ...] } }`
 *
 * - Outer Partial: not all domains need selections (user may skip "mobile" entirely)
 * - Inner Partial: within a domain, only some subcategories may have selections
 * - SkillId[]: a subcategory can have multiple skills unless `CategoryDefinition.exclusive` is true
 */
export type DomainSelections = Partial<Record<Domain, Partial<Record<Subcategory, SkillId[]>>>>;

/** Single category definition from skills-matrix.yaml */
export type CategoryDefinition = {
  id: Subcategory;
  displayName: string;
  description: string;
  /** Domain for wizard domain filtering */
  domain?: Domain;
  /** If true, only one skill can be selected in this category (radio behavior). @default true */
  exclusive: boolean;
  /** If true, the user must select at least one skill before proceeding. @default false */
  required: boolean;
  /** Display order within domain (lower = earlier) */
  order: number;
  icon?: string;
};

/** Relationship rules between skills from skills-matrix.yaml */
export type RelationshipDefinitions = {
  /** Selecting one disables the others */
  conflicts: ConflictRule[];
  /** Selecting one shows warning for others but doesn't disable */
  discourages: DiscourageRule[];
  /** Selecting one highlights recommended companions */
  recommends: RecommendRule[];
  /** Skill A requires skill B to be selected first */
  requires: RequireRule[];
  /** Groups of interchangeable skills for the same purpose */
  alternatives: AlternativeGroup[];
};

/** Mutual exclusion rule - selecting any one skill disables ALL others */
export type ConflictRule = {
  /** Canonical skill IDs (aliases resolved at YAML parse boundary) */
  skills: SkillId[];
  reason: string;
};

/** Soft conflict rule - selecting any one shows a warning for ALL others */
export type DiscourageRule = {
  /** Canonical skill IDs (aliases resolved at YAML parse boundary) */
  skills: SkillId[];
  reason: string;
};

/** Suggestion rule - selecting a skill highlights recommended companions */
export type RecommendRule = {
  /** Skill ID that triggers this recommendation */
  when: SkillId;
  suggest: SkillId[];
  reason: string;
};

/** Dependency rule - skill A requires skill B to be selected first */
export type RequireRule = {
  skill: SkillId;
  /** Skills that must be selected before this one */
  needs: SkillId[];
  /**
   * If true, only ONE of the `needs` skills is required (OR logic).
   * If false/undefined, ALL are required (AND logic).
   * @default false
   */
  needsAny?: boolean;
  reason: string;
};

/** Group of interchangeable skills serving the same purpose */
export type AlternativeGroup = {
  purpose: string;
  skills: SkillId[];
};

/** Root configuration from skills-matrix.yaml */
export type SkillsMatrixConfig = {
  version: string;
  categories: CategoryMap;
  relationships: RelationshipDefinitions;
  /** Maps short display names to normalized skill IDs */
  skillAliases: Partial<Record<SkillDisplayName, SkillId>>;
};

/** Pre-configured stack of skills for a specific use case */
export type SuggestedStack = {
  id: string;
  name: string;
  description: string;
  audience: string[];
  /** Structure: { agentName: { subcategory: skillId } } */
  skills: Record<string, Partial<Record<Subcategory, SkillId>>>;
  philosophy: string;
};

/**
 * Output of mergeMatrixWithSkills() combining skills-matrix.yaml with extracted metadata.
 * This is the primary read model consumed by the wizard and CLI commands.
 */
export type MergedSkillsMatrix = {
  version: string;
  categories: CategoryMap;
  /** Indexed by full skill ID for O(1) lookup */
  skills: Partial<Record<SkillId, ResolvedSkill>>;
  /** Stacks with all skill aliases resolved to canonical IDs */
  suggestedStacks: ResolvedStack[];
  /** Forward map: display name (e.g., "react") to canonical skill ID (e.g., "web-framework-react") */
  displayNameToId: Partial<Record<SkillDisplayName, SkillId>>;
  /** Reverse map: canonical skill ID to display name */
  displayNames: Partial<Record<SkillId, SkillDisplayName>>;
  /** ISO timestamp of when this matrix was generated */
  generatedAt: string;
};

/**
 * Single skill with all computed relationships resolved for CLI rendering.
 * Produced by mergeMatrixWithSkills() after resolving aliases, relationships, and sources.
 */
export type ResolvedSkill = {
  id: SkillId;
  /** Short display name (e.g., "react"); absent for skills without an alias in skillAliases */
  displayName?: SkillDisplayName;
  description: string;
  /** When an AI agent should invoke this skill (decision criteria) */
  usageGuidance?: string;
  /** Matches key in matrix.categories; determines which wizard subcategory grid this skill appears in */
  category: CategoryPath;
  /** If true, selecting this skill deselects others in the same category (radio vs checkbox behavior) */
  categoryExclusive: boolean;
  tags: string[];
  /** Author handle (e.g., "@vince") from metadata.yaml */
  author: string;
  /** DEPRECATED: Version now lives in plugin.json */
  version?: string;
  /** Selecting this skill disables these others (hard exclusion) */
  conflictsWith: SkillRelation[];
  /** Selecting this skill highlights these as good companions (soft suggestion) */
  recommends: SkillRelation[];
  /** Skills that THIS skill requires (must select first) */
  requires: SkillRequirement[];
  /** Other skills that serve the same purpose (informational, not enforced) */
  alternatives: SkillAlternative[];
  /** Selecting this skill shows a warning for these others (soft conflict) */
  discourages: SkillRelation[];
  /**
   * Framework skill IDs this skill is compatible with.
   * Used for framework-first filtering in the Build step: if a framework is selected,
   * only skills listing that framework in compatibleWith (or with an empty list) are shown.
   */
  compatibleWith: SkillId[];
  /** Setup skills that must be installed before this skill can function (e.g., "infra-env-setup") */
  requiresSetup: SkillId[];
  /** Usage skills that this setup skill configures (inverse of requiresSetup) */
  providesSetupFor: SkillId[];
  /** Relative path to skill directory from src/ */
  path: string;
  /** True if from .claude/skills/ (user-defined local skill) */
  local?: boolean;
  /** Relative path from project root for local skills */
  localPath?: string;
  /** All known sources that provide this skill (populated by multi-source-loader) */
  availableSources?: SkillSource[];
  /** Currently active/installed source (if any) */
  activeSource?: SkillSource;
};

/** Skill-to-skill relationship with reason */
export type SkillRelation = {
  skillId: SkillId;
  reason: string;
};

/** Resolved skill dependency with AND/OR logic */
export type SkillRequirement = {
  skillIds: SkillId[];
  /**
   * If true, only ONE of skillIds is needed (OR).
   * If false, ALL are needed (AND).
   * @default false
   */
  needsAny: boolean;
  reason: string;
};

/** Alternative skill that serves the same purpose */
export type SkillAlternative = {
  skillId: SkillId;
  purpose: string;
};

/** Stack with resolved skill IDs and agent mappings */
export type ResolvedStack = {
  id: string;
  name: string;
  description: string;
  audience: string[];
  /** Skill selections with resolved full skill IDs by category */
  skills: Partial<Record<AgentName, Partial<Record<Subcategory, SkillId>>>>;
  /** Flat list of all skill IDs in this stack */
  allSkillIds: SkillId[];
  philosophy: string;
};

/** Short alias used for subcategory-level search (e.g., "react", "zustand") */
export type SkillAlias = string;

/** Source type classification for skill provenance (where the skill comes from) */
export type SkillSourceType = "public" | "private" | "local";

/** A single source from which a skill can be obtained */
export type SkillSource = {
  /** Source identifier: "public", marketplace name, "local" */
  name: string;
  type: SkillSourceType;
  /** Source URL for remote sources (e.g., "github:acme-corp/claude-skills") */
  url?: string;
  /** Skill content version from metadata.yaml */
  version?: string;
  /** Whether this source's version is currently installed on disk */
  installed: boolean;
  /** How the skill was installed on disk (separate from provenance) */
  installMode?: "plugin" | "local";
  /** True for the primary marketplace source (scoped or default public). Set by multi-source-loader. */
  primary?: boolean;
};

/** A foreign skill explicitly bound to a subcategory via search */
export type BoundSkill = {
  /** The foreign skill's actual ID */
  id: SkillId;
  /** Source URL (e.g., "github:awesome-dev/skills") */
  sourceUrl: string;
  /** Display name of the source (e.g., "awesome-dev") */
  sourceName: string;
  /** Subcategory alias this skill is bound to (e.g., "react") */
  boundTo: SkillAlias;
  /** Skill description from the source */
  description?: string;
};

/** Search result candidate before being bound to a subcategory */
export type BoundSkillCandidate = {
  /** The foreign skill's actual ID */
  id: SkillId;
  /** Source URL (e.g., "github:awesome-dev/skills") */
  sourceUrl: string;
  /** Display name of the source (e.g., "awesome-dev") */
  sourceName: string;
  /** Skill alias / display name from the source */
  alias: SkillAlias;
  /** Skill content version from metadata */
  version?: number;
  /** Skill description from the source */
  description?: string;
};

/**
 * Skill option as displayed in the wizard, computed based on current selections.
 * Recomputed by matrix-resolver on every selection change.
 */
export type SkillOption = {
  id: SkillId;
  displayName?: SkillDisplayName;
  description: string;
  /** True if a conflict rule prevents selection (grayed out in UI) */
  disabled: boolean;
  /** Explains which conflict rule caused the disable (shown as tooltip) */
  disabledReason?: string;
  /** True if a discourage rule applies (shown with warning indicator) */
  discouraged: boolean;
  /** Explains which discourage rule applies */
  discouragedReason?: string;
  /** True if a recommend rule from another selected skill suggests this one */
  recommended: boolean;
  /** Explains why this skill is recommended */
  recommendedReason?: string;
  /** True if this skill is currently selected by the user */
  selected: boolean;
  /** Other skills that serve the same purpose (for "or try X" hints) */
  alternatives: SkillId[];
};

/** Result of validating the current skill selections */
export type SelectionValidation = {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
};

/** Blocking validation error requiring user action */
export type ValidationError = {
  type: "conflict" | "missingRequirement" | "categoryExclusive";
  message: string;
  skills: SkillId[];
};

/** Non-blocking validation warning for user awareness */
export type ValidationWarning = {
  type: "missing_recommendation" | "unused_setup";
  message: string;
  skills: SkillId[];
};

/**
 * Skill metadata extracted from SKILL.md frontmatter + metadata.yaml before matrix merge.
 *
 * Important: relationship fields (compatibleWith, conflictsWith, requires) may contain
 * display names (e.g., "react") at this stage. They are resolved to canonical SkillIds
 * (e.g., "web-framework-react") during mergeMatrixWithSkills() via resolveAlias().
 */
export type ExtractedSkillMetadata = {
  /** Normalized from frontmatter name, e.g. "web-framework-react" */
  id: SkillId;
  /** Directory path for filesystem access, e.g. "web/framework/react" */
  directoryPath: string;
  description: string;
  /** When an AI agent should invoke this skill (decision criteria) */
  usageGuidance?: string;
  category: CategoryPath;
  /** @default true */
  categoryExclusive: boolean;
  author: string;
  tags: string[];
  /**
   * May contain display names at parse time; resolved to canonical IDs during matrix merge.
   */
  compatibleWith: SkillId[];
  /** May contain display names at parse time; resolved during matrix merge */
  conflictsWith: SkillId[];
  /** May contain display names at parse time; resolved during matrix merge */
  requires: SkillId[];
  /** Setup skills that must be completed first. Resolved during matrix merge. */
  requiresSetup: SkillId[];
  /** Usage skills this setup skill configures. Resolved during matrix merge. */
  providesSetupFor: SkillId[];
  /** Relative path from src/ to the skill directory */
  path: string;
  /** True if from .claude/skills/ (user-defined local skill) */
  local?: boolean;
  /** Relative path from project root for local skills */
  localPath?: string;
};
