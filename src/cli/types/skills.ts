/**
 * Skill types — definitions, assignments, references, and ID types.
 * Contains template literal types (SkillId, CategoryPath) and
 * skill-specific structures used across the compilation pipeline.
 */

import type { ModelName, Subcategory } from "./matrix";

// =============================================================================
// Template Literal Types - Derived from Base Types
// =============================================================================

/**
 * Prefix segments used in skill IDs.
 * Includes domains plus path-based prefixes (infra, meta, security)
 * that appear in skill ID format but are not wizard domains.
 */
export type SkillIdPrefix = "web" | "api" | "cli" | "mobile" | "infra" | "meta" | "security";

/**
 * Skill ID format: prefix-subcategory-name segments in kebab-case.
 * @example "web-framework-react", "api-database-drizzle", "meta-reviewing-reviewing"
 */
export type SkillId = `${SkillIdPrefix}-${string}`;

/**
 * Skill display names — short human-readable labels for skills.
 * These are the keys in skills-matrix.yaml `skill_aliases` section.
 * Display names are resolved to canonical SkillId at the YAML parse boundary.
 */
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
 * Category ID format used in resolved skills.
 * Either "prefix-subcategory" (e.g., "web-framework", "api-database") or a standalone subcategory (e.g., "testing").
 * Includes "local" for user-defined local skills.
 */
export type CategoryPath =
  | `${SkillIdPrefix}/${string}`
  | `${SkillIdPrefix}-${string}`
  | Subcategory
  | "local";

/**
 * Subcategory-keyed selections mapping to arrays of canonical skill IDs.
 * Used for wizard domain selections at the subcategory level.
 */
export type SubcategorySelections = Partial<Record<Subcategory, SkillId[]>>;

/**
 * Resolved subcategory-to-skill mappings after alias resolution.
 * Maps each subcategory to its resolved SkillId.
 */
export type ResolvedSubcategorySkills = Partial<Record<Subcategory, SkillId>>;

// =============================================================================
// Skill Data Types
// =============================================================================

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
