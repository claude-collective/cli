import type { Category, ModelName } from "./matrix";

/** Prefix segments used in skill IDs, including non-domain prefixes (infra, meta, security) */
export type SkillIdPrefix = "web" | "api" | "cli" | "mobile" | "infra" | "meta" | "security";

/** Skill ID format: prefix-category-name segments in kebab-case (at least 3 segments) */
export type SkillId = `${SkillIdPrefix}-${string}-${string}`;

/** Fully-qualified plugin skill reference: "plugin-name:skill-name" for Claude Code plugin resolution */
export type PluginSkillRef = `${SkillId}:${SkillId}`;

/** Kebab-case short key for alias resolution, search, and relationship rules */
export type SkillSlug =
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
  | "gitlab-ci"
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
  | "result-types"
  | "accessibility"
  | "websockets"
  | "sse"
  | "socket-io"
  | "service-workers"
  | "offline-first"
  | "file-upload"
  | "image-handling"
  | "date-fns"
  // Backend-specific category skills
  | "api-performance"
  | "web-performance"
  // Security
  | "security"
  | "auth-patterns"
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
 * Either "prefix-category" (e.g., "web-framework"), a standalone category,
 * or "local" for user-defined local skills.
 */
export type CategoryPath = `${SkillIdPrefix}-${string}` | Category | "local";

/**
 * Category-keyed selections mapping to arrays of canonical skill IDs.
 * Used in the wizard Build step for single-domain selections.
 * Partial because only categories the user has interacted with will have entries.
 */
export type CategorySelections = Partial<Record<Category, SkillId[]>>;

/**
 * Resolved category-to-skill mappings after alias resolution.
 * Maps each category to a single canonical skill ID (used in stack configs
 * where each category has exactly one skill per agent).
 */
export type ResolvedCategorySkills = Partial<Record<Category, SkillId>>;

/** Skill definition from registry.yaml (static metadata that doesn't change per-agent) */
export type SkillDefinition = {
  id: SkillId;
  path: string;
  description: string;
};

/** Map of skill IDs to their definitions — index-signature semantics via template literal key */
export type SkillDefinitionMap = Record<SkillId, SkillDefinition>;

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
