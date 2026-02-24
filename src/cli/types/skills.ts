import type { ModelName, Subcategory } from "./matrix";

/** Prefix segments used in skill IDs, including non-domain prefixes (infra, meta, security) */
export type SkillIdPrefix = "web" | "api" | "cli" | "mobile" | "infra" | "meta" | "security";

/** Skill ID format: prefix-subcategory-name segments in kebab-case (at least 3 segments) */
export type SkillId = `${SkillIdPrefix}-${string}-${string}`;

/** Fully-qualified plugin skill reference: "plugin-name:skill-name" for Claude Code plugin resolution */
export type PluginSkillRef = `${SkillId}:${SkillId}`;

/** Short human-readable labels resolved to canonical SkillId at the YAML parse boundary */
export type SkillDisplayName =
  // Frameworks
  | "react"
  | "vue"
  | "angular"
  | "solidjs"
  // Meta-frameworks
  | "nextjs-app-router"
  | "nextjs-server-actions"
  | "remix"
  | "nuxt"
  // Styling
  | "scss-modules"
  | "cva"
  | "tailwind"
  // Client State
  | "zustand"
  | "redux-toolkit"
  | "pinia"
  | "ngrx-signalstore"
  | "jotai"
  | "mobx"
  // Server State / Data Fetching
  | "react-query"
  | "swr"
  | "graphql-apollo"
  | "graphql-urql"
  | "trpc"
  // Forms & Validation
  | "react-hook-form"
  | "vee-validate"
  | "zod-validation"
  // Testing
  | "vitest"
  | "playwright-e2e"
  | "cypress-e2e"
  | "react-testing-library"
  | "vue-test-utils"
  | "msw"
  // UI Components
  | "shadcn-ui"
  | "tanstack-table"
  | "radix-ui"
  // Backend - API Framework
  | "hono"
  | "express"
  | "fastify"
  // Backend - Database
  | "drizzle"
  | "prisma"
  // Backend - Auth
  | "better-auth"
  // Backend - Observability
  | "axiom-pino-sentry"
  // Backend - Analytics
  | "posthog"
  | "posthog-flags"
  // Backend - Email
  | "resend"
  // Backend - CI/CD
  | "github-actions"
  // Mobile
  | "react-native"
  | "expo"
  // Setup / Infrastructure
  | "turborepo"
  | "tooling"
  | "posthog-setup"
  | "env"
  | "observability-setup"
  | "email-setup"
  // Animation / PWA / Realtime / etc.
  | "framer-motion"
  | "css-animations"
  | "view-transitions"
  | "storybook"
  | "error-boundaries"
  | "accessibility"
  | "websockets"
  | "sse"
  | "socket-io"
  | "service-workers"
  | "file-upload"
  | "image-handling"
  | "date-fns"
  // Backend-specific category skills
  | "api-testing"
  | "api-performance"
  | "web-performance"
  // Security
  | "security"
  // CLI
  | "commander"
  | "cli-commander"
  | "oclif"
  // Reviewing / Meta
  | "reviewing"
  | "cli-reviewing"
  | "research-methodology"
  // Methodology
  | "investigation-requirements"
  | "anti-over-engineering"
  | "success-criteria"
  | "write-verification"
  | "improvement-protocol"
  | "context-management";

/**
 * Either "prefix-subcategory" (e.g., "web-framework"), a standalone subcategory,
 * or "local" for user-defined local skills.
 */
export type CategoryPath = `${SkillIdPrefix}-${string}` | Subcategory | "local";

/**
 * Subcategory-keyed selections mapping to arrays of canonical skill IDs.
 * Used in the wizard Build step for single-domain selections.
 * Partial because only subcategories the user has interacted with will have entries.
 */
export type SubcategorySelections = Partial<Record<Subcategory, SkillId[]>>;

/**
 * Resolved subcategory-to-skill mappings after alias resolution.
 * Maps each subcategory to a single canonical skill ID (used in stack configs
 * where each subcategory has exactly one skill per agent).
 */
export type ResolvedSubcategorySkills = Partial<Record<Subcategory, SkillId>>;

/** Skill definition from registry.yaml (static metadata that doesn't change per-agent) */
export type SkillDefinition = {
  id: SkillId;
  path: string;
  description: string;
};

/** Skill assignment in stack config.yaml, specifies preloaded (embedded) vs dynamic (Skill tool) */
export type SkillAssignment = {
  id: SkillId;
  /**
   * If true, skill content is embedded directly in the compiled agent prompt.
   * If false, the agent loads the skill via Claude Code's Skill tool at runtime.
   * @default false
   */
  preloaded?: boolean;
  /** True if this is a local skill from .claude/skills/ */
  local?: boolean;
  /** Relative path from project root for local skills */
  path?: string;
};

/** Skill reference in config.yaml (agent-specific) */
export type SkillReference = {
  id: SkillId;
  /** Context-specific description of when to use this skill */
  usage: string;
  preloaded?: boolean;
};

/** Fully resolved skill used by the compiler (merged from registry.yaml + config.yaml) */
export type Skill = SkillDefinition & {
  /** Context-specific usage guidance for this agent */
  usage: string;
  /** Whether skill is listed in frontmatter (Claude Code loads automatically) */
  preloaded: boolean;
  /** Fully-qualified plugin reference (e.g., "web-framework-react:web-framework-react") for plugin mode */
  pluginRef?: PluginSkillRef;
};

/**
 * SKILL.md frontmatter - matches official Claude Code plugin format.
 * Note: `author` is in metadata.yaml (for marketplace.json), NOT here.
 */
export type SkillFrontmatter = {
  /** Skill identifier in kebab-case (e.g., "react", "api-hono") */
  name: SkillId;
  description: string;
  model?: ModelName;
};

/**
 * metadata.yaml fields - relationship and catalog data (identity comes from SKILL.md frontmatter).
 * All fields optional because metadata.yaml is supplementary; SKILL.md is the primary source.
 */
export type SkillMetadataConfig = {
  /** Which subcategory this skill belongs to (e.g., "web-framework" or "web-testing") */
  category?: CategoryPath;
  /** If true, only one skill from this category can be selected. Overrides CategoryDefinition. */
  categoryExclusive?: boolean;
  /** Author handle (e.g., "@vince") */
  author?: string;
  /** Searchable tags for filtering (e.g., ["react", "hooks", "state"]) */
  tags?: string[];
  /** Skill IDs that must be selected before this skill (dependency) */
  requires?: SkillId[];
  /** Framework skill IDs this skill works with (for framework-first filtering) */
  compatibleWith?: SkillId[];
  /** Skill IDs that cannot be selected alongside this skill (mutual exclusion) */
  conflictsWith?: SkillId[];
  /** True if this skill was created outside the CLI's built-in vocabulary */
  custom?: boolean;
};
