import type { CategoryPath, SkillDisplayName, SkillId } from "./skills";
import type { AgentName } from "./agents";

/** Wizard domain grouping for skill categories */
export type Domain = "web" | "web-extras" | "api" | "cli" | "mobile" | "shared";

/** Keys in skills-matrix.yaml `categories` section */
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

/** Category definitions indexed by subcategory ID */
export type CategoryMap = Partial<Record<Subcategory, CategoryDefinition>>;

/** Full domain selections used throughout the wizard pipeline (store, components, result) */
export type DomainSelections = Partial<Record<Domain, Partial<Record<Subcategory, SkillId[]>>>>;

/** Single category definition from skills-matrix.yaml */
export type CategoryDefinition = {
  id: Subcategory;
  displayName: string;
  description: string;
  /** Domain for wizard domain filtering */
  domain?: Domain;
  /** Parent domain for display-only sub-domains, used to inherit framework selections */
  parent_domain?: Domain;
  /** @default true */
  exclusive: boolean;
  /** @default false */
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
  needs_any?: boolean;
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
  skill_aliases: Partial<Record<SkillDisplayName, SkillId>>;
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

/** Output of mergeMatrixWithSkills() combining skills-matrix.yaml with extracted metadata */
export type MergedSkillsMatrix = {
  version: string;
  categories: CategoryMap;
  /** Indexed by full skill ID for O(1) lookup */
  skills: Partial<Record<SkillId, ResolvedSkill>>;
  suggestedStacks: ResolvedStack[];
  displayNameToId: Partial<Record<SkillDisplayName, SkillId>>;
  /** Reverse map: skill ID to display name */
  displayNames: Partial<Record<SkillId, SkillDisplayName>>;
  generatedAt: string;
};

/** Single skill with all computed relationships resolved for CLI rendering */
export type ResolvedSkill = {
  id: SkillId;
  displayName?: SkillDisplayName;
  description: string;
  /** When an AI agent should invoke this skill (decision criteria) */
  usageGuidance?: string;
  /** Matches key in matrix.categories */
  category: CategoryPath;
  categoryExclusive: boolean;
  tags: string[];
  author: string;
  /** DEPRECATED: Version now lives in plugin.json */
  version?: string;
  conflictsWith: SkillRelation[];
  recommends: SkillRelation[];
  /** Skills that THIS skill requires (must select first) */
  requires: SkillRequirement[];
  alternatives: SkillAlternative[];
  discourages: SkillRelation[];
  /**
   * Framework skill IDs this skill is compatible with.
   * Used for framework-first filtering in the Build step.
   */
  compatibleWith: SkillId[];
  requiresSetup: SkillId[];
  providesSetupFor: SkillId[];
  /** Relative path to skill directory from src/ */
  path: string;
  /** True if from .claude/skills/ (user-defined local skill) */
  local?: boolean;
  /** Relative path from project root for local skills */
  localPath?: string;
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

/** Skill option as displayed in the wizard, computed based on current selections */
export type SkillOption = {
  id: SkillId;
  displayName?: SkillDisplayName;
  description: string;
  disabled: boolean;
  disabledReason?: string;
  discouraged: boolean;
  discouragedReason?: string;
  recommended: boolean;
  recommendedReason?: string;
  selected: boolean;
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
  type: "conflict" | "missing_requirement" | "category_exclusive";
  message: string;
  skills: SkillId[];
};

/** Non-blocking validation warning for user awareness */
export type ValidationWarning = {
  type: "missing_recommendation" | "unused_setup";
  message: string;
  skills: SkillId[];
};

/** Skill metadata extracted from SKILL.md frontmatter + metadata.yaml before matrix merge */
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
