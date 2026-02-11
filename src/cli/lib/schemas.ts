/**
 * Zod schemas for validating CLI data structures.
 *
 * DESIGN: These schemas validate data at runtime boundaries (YAML parsing,
 * user input, API responses). They do NOT replace the TypeScript types in
 * types.ts and types-matrix.ts — those remain the single source of truth.
 *
 * For union types with many members (e.g., SkillDisplayName), we use z.enum([...])
 * with the full value list to get runtime validation matching the TS types.
 *
 * For template-literal types (e.g., SkillId), we use z.string().regex()
 * since Zod cannot express template-literal patterns natively.
 */

import { z } from "zod";
import type {
  AgentYamlConfig,
  PluginManifest,
  ProjectConfig,
  SkillFrontmatter,
  SkillMetadataConfig,
  AgentHookAction,
  AgentHookDefinition,
  SkillAssignment,
  PluginAuthor,
  ValidationResult,
  Marketplace,
  MarketplaceOwner,
  MarketplaceMetadata,
  MarketplacePlugin,
  MarketplaceRemoteSource,
} from "../../types";
import type { Stack, StacksConfig, StackAgentConfig } from "../types-stacks";
import type {
  AgentName,
  AlternativeGroup,
  CategoryDefinition,
  CategoryPath,
  ConflictRule,
  DiscourageRule,
  Domain,
  ModelName,
  PermissionMode,
  RecommendRule,
  RelationshipDefinitions,
  RequireRule,
  SkillDisplayName,
  SkillId,
  SkillsMatrixConfig,
  Subcategory,
} from "../types-matrix";

// =============================================================================
// Base Union Type Schemas
// =============================================================================

/** Validates Domain values: wizard grouping domains */
export const domainSchema = z.enum([
  "web",
  "web-extras",
  "api",
  "cli",
  "mobile",
  "shared",
]) as z.ZodType<Domain>;

/** Validates Subcategory values: category IDs within domains */
export const subcategorySchema = z.enum([
  // Web
  "framework",
  "meta-framework",
  "styling",
  "client-state",
  "server-state",
  "forms",
  "testing",
  "ui-components",
  "mocking",
  "error-handling",
  "i18n",
  "file-upload",
  "files",
  "utilities",
  "realtime",
  "animation",
  "pwa",
  "accessibility",
  "web-performance",
  // API
  "api",
  "database",
  "auth",
  "observability",
  "analytics",
  "email",
  "performance",
  // Mobile
  "mobile-framework",
  // Shared / Infrastructure
  "monorepo",
  "tooling",
  "security",
  "methodology",
  "research",
  "reviewing",
  "ci-cd",
  // CLI
  "cli-framework",
  "cli-prompts",
  "cli-testing",
]) as z.ZodType<Subcategory>;

/** Validates AgentName values: built-in agent identifiers */
export const agentNameSchema = z.enum([
  // Developers
  "web-developer",
  "api-developer",
  "cli-developer",
  "web-architecture",
  // Meta
  "agent-summoner",
  "documentor",
  "skill-summoner",
  // Migration
  "cli-migrator",
  // Pattern
  "pattern-scout",
  "web-pattern-critique",
  // Planning
  "web-pm",
  // Researchers
  "api-researcher",
  "web-researcher",
  // Reviewers
  "api-reviewer",
  "cli-reviewer",
  "web-reviewer",
  // Testers
  "cli-tester",
  "web-tester",
]) as z.ZodType<AgentName>;

/** Validates ModelName values: AI model identifiers */
export const modelNameSchema = z.enum([
  "sonnet",
  "opus",
  "haiku",
  "inherit",
]) as z.ZodType<ModelName>;

/** Validates PermissionMode values: agent operation permissions */
export const permissionModeSchema = z.enum([
  "default",
  "acceptEdits",
  "dontAsk",
  "bypassPermissions",
  "plan",
  "delegate",
]) as z.ZodType<PermissionMode>;

/**
 * Validates SkillDisplayName values: short display names for skills.
 * Full list from types-matrix.ts SkillDisplayName union.
 */
export const skillDisplayNameSchema = z.enum([
  // Frameworks
  "react",
  "vue",
  "angular",
  "solidjs",
  // Meta-frameworks
  "nextjs-app-router",
  "nextjs-server-actions",
  "remix",
  "nuxt",
  // Styling
  "scss-modules",
  "cva",
  "tailwind",
  // Client State
  "zustand",
  "redux-toolkit",
  "pinia",
  "ngrx-signalstore",
  "jotai",
  "mobx",
  // Server State / Data Fetching
  "react-query",
  "swr",
  "graphql-apollo",
  "graphql-urql",
  "trpc",
  // Forms & Validation
  "react-hook-form",
  "vee-validate",
  "zod-validation",
  // Testing
  "vitest",
  "playwright-e2e",
  "cypress-e2e",
  "react-testing-library",
  "vue-test-utils",
  "msw",
  // UI Components
  "shadcn-ui",
  "tanstack-table",
  "radix-ui",
  // Backend - API Framework
  "hono",
  "express",
  "fastify",
  // Backend - Database
  "drizzle",
  "prisma",
  // Backend - Auth
  "better-auth",
  // Backend - Observability
  "axiom-pino-sentry",
  // Backend - Analytics
  "posthog",
  "posthog-flags",
  // Backend - Email
  "resend",
  // Backend - CI/CD
  "github-actions",
  // Mobile
  "react-native",
  "expo",
  // Setup / Infrastructure
  "turborepo",
  "tooling",
  "posthog-setup",
  "env",
  "observability-setup",
  "email-setup",
  // Animation / PWA / Realtime / etc.
  "framer-motion",
  "css-animations",
  "view-transitions",
  "storybook",
  "error-boundaries",
  "accessibility",
  "websockets",
  "sse",
  "socket-io",
  "service-workers",
  "file-upload",
  "image-handling",
  "date-fns",
  // Backend-specific category skills
  "api-testing",
  "api-performance",
  "web-performance",
  // Security
  "security",
  // CLI
  "commander",
  "cli-commander",
  "oclif",
  // Reviewing / Meta
  "reviewing",
  "cli-reviewing",
  "research-methodology",
  // Methodology
  "investigation-requirements",
  "anti-over-engineering",
  "success-criteria",
  "write-verification",
  "improvement-protocol",
  "context-management",
]) as z.ZodType<SkillDisplayName>;

// =============================================================================
// Template Literal Type Schemas
// =============================================================================

/** Regex pattern for SkillId: prefix-name format */
const SKILL_ID_PATTERN = /^(web|api|cli|mobile|infra|meta|security)-.+$/;

/**
 * Validates SkillId format: `${SkillIdPrefix}-${string}`.
 * Uses regex since Zod cannot express template literal types natively.
 */
export const skillIdSchema = z
  .string()
  .regex(
    SKILL_ID_PATTERN,
    "Must be a valid skill ID (e.g., 'web-framework-react')",
  ) as z.ZodType<SkillId>;

/**
 * Validates CategoryPath format.
 * Accepts: "prefix/subcategory", "prefix-subcategory", bare subcategory, or "local".
 */
export const categoryPathSchema = z.string().refine(
  (val): val is CategoryPath => {
    // "local" literal
    if (val === "local") return true;
    // prefix/subcategory format
    if (/^(web|api|cli|mobile|infra|meta|security)\/.+$/.test(val)) return true;
    // prefix-subcategory format
    if (/^(web|api|cli|mobile|infra|meta|security)-.+$/.test(val)) return true;
    // Bare subcategory — validated against the subcategory union
    return subcategorySchema.safeParse(val).success;
  },
  {
    message:
      "Must be a valid category path (e.g., 'web/framework', 'web-framework', 'testing', or 'local')",
  },
) as z.ZodType<CategoryPath>;

// =============================================================================
// Hook Schemas (shared by multiple interfaces)
// =============================================================================

/** Validates AgentHookAction */
export const agentHookActionSchema: z.ZodType<AgentHookAction> = z.object({
  type: z.enum(["command", "script", "prompt"]),
  command: z.string().optional(),
  script: z.string().optional(),
  prompt: z.string().optional(),
});

/** Validates AgentHookDefinition */
export const agentHookDefinitionSchema: z.ZodType<AgentHookDefinition> = z.object({
  matcher: z.string().optional(),
  hooks: z.array(agentHookActionSchema).optional(),
});

/** Validates a hooks record: Record<string, AgentHookDefinition[]> */
export const hooksRecordSchema = z.record(z.string(), z.array(agentHookDefinitionSchema));

// =============================================================================
// Skill Schemas
// =============================================================================

/** Validates SkillAssignment */
export const skillAssignmentSchema: z.ZodType<SkillAssignment> = z.object({
  id: skillIdSchema,
  preloaded: z.boolean().optional(),
  local: z.boolean().optional(),
  path: z.string().optional(),
});

// =============================================================================
// Interface Schemas
// =============================================================================

/**
 * Validates SkillFrontmatter from SKILL.md files.
 * Fields match the official Claude Code plugin format.
 */
export const skillFrontmatterSchema: z.ZodType<SkillFrontmatter> = z.object({
  name: skillIdSchema,
  description: z.string(),
  model: modelNameSchema.optional(),
});

/**
 * Lenient version of skillFrontmatterSchema for parsing SKILL.md files.
 * Accepts any string for `name` since local skills and custom skill plugins
 * may not follow the strict SkillId pattern (e.g., "my-custom-skill (@local)").
 * Strict ID validation happens downstream in matrix resolution.
 */
export const skillFrontmatterLoaderSchema = z.object({
  name: z.string(),
  description: z.string(),
  model: modelNameSchema.optional(),
});

/**
 * Validates SkillMetadataConfig from metadata.yaml files.
 * Contains relationship and catalog data for skills.
 */
export const skillMetadataConfigSchema: z.ZodType<SkillMetadataConfig> = z.object({
  category: categoryPathSchema.optional(),
  category_exclusive: z.boolean().optional(),
  author: z.string().optional(),
  version: z.string().optional(),
  tags: z.array(z.string()).optional(),
  requires: z.array(skillIdSchema).optional(),
  compatible_with: z.array(skillIdSchema).optional(),
  conflicts_with: z.array(skillIdSchema).optional(),
});

/** Validates PluginAuthor */
export const pluginAuthorSchema: z.ZodType<PluginAuthor> = z.object({
  name: z.string(),
  email: z.string().optional(),
});

/**
 * Validates PluginManifest for Claude Code plugins (plugin.json).
 * Defines the structure and content of a plugin package.
 */
export const pluginManifestSchema: z.ZodType<PluginManifest> = z.object({
  name: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
  author: pluginAuthorSchema.optional(),
  keywords: z.array(z.string()).optional(),
  commands: z.union([z.string(), z.array(z.string())]).optional(),
  agents: z.union([z.string(), z.array(z.string())]).optional(),
  skills: z.union([z.string(), z.array(z.string())]).optional(),
  hooks: z.union([z.string(), hooksRecordSchema]).optional(),
});

/**
 * Validates AgentYamlConfig from co-located agent.yaml files.
 * Supports official Claude Code plugin format fields.
 */
export const agentYamlConfigSchema: z.ZodType<AgentYamlConfig> = z.object({
  id: agentNameSchema,
  title: z.string(),
  description: z.string(),
  model: modelNameSchema.optional(),
  tools: z.array(z.string()),
  disallowed_tools: z.array(z.string()).optional(),
  permission_mode: permissionModeSchema.optional(),
  hooks: hooksRecordSchema.optional(),
  output_format: z.string().optional(),
});

/**
 * Validates ProjectConfig from .claude/config.yaml.
 * Unified project configuration for Claude Collective.
 */
export const projectConfigSchema: z.ZodType<ProjectConfig> = z.object({
  version: z.literal("1").optional(),
  name: z.string(),
  description: z.string().optional(),
  agents: z.array(z.string() as z.ZodType<AgentName>),

  author: z.string().optional(),
  installMode: z.enum(["local", "plugin"]).optional(),
  stack: z.record(z.string(), z.record(subcategorySchema, skillIdSchema)).optional(),
  source: z.string().optional(),
  marketplace: z.string().optional(),
  agents_source: z.string().optional(),
});

/**
 * Lenient version of projectConfigSchema for loading YAML files.
 * Makes `name` and `agents` optional since partial configs (e.g., with only
 * `source` and `author`) are valid at load time. Full validation of required
 * fields happens in validateProjectConfig().
 *
 * Uses .passthrough() to preserve unknown keys for forward compatibility.
 */
export const projectConfigLoaderSchema = z
  .object({
    version: z.literal("1").optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    agents: z.array(z.string()).optional(),

    author: z.string().optional(),
    installMode: z.enum(["local", "plugin"]).optional(),
    // Uses z.record(z.string(), ...) for stack keys since real-world stack
    // data has sparse subcategory records (not all subcategories present)
    stack: z.record(z.string(), z.record(z.string(), skillIdSchema)).optional(),
    source: z.string().optional(),
    marketplace: z.string().optional(),
    agents_source: z.string().optional(),
  })
  .passthrough();

/** Validates ValidationResult */
export const validationResultSchema: z.ZodType<ValidationResult> = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

// =============================================================================
// Skills Matrix Schemas (skills-matrix.yaml)
// =============================================================================

/** Validates CategoryDefinition from skills-matrix.yaml categories */
export const categoryDefinitionSchema: z.ZodType<CategoryDefinition> = z.object({
  id: subcategorySchema,
  displayName: z.string(),
  description: z.string(),
  domain: domainSchema.optional(),
  parent_domain: domainSchema.optional(),
  exclusive: z.boolean(),
  required: z.boolean(),
  order: z.number(),
  icon: z.string().optional(),
});

/**
 * Lenient schema for skill references in YAML relationships.
 * Accepts both SkillId ("web-framework-react") and SkillDisplayName ("react").
 * Display names are resolved to canonical SkillIds by matrix-loader after parsing.
 * Boundary cast: z.string() widens, cast narrows to SkillId post-resolution.
 */
const skillRefInYaml = z.string() as z.ZodType<SkillId>;

/** Validates ConflictRule: mutual exclusion between skills */
export const conflictRuleSchema: z.ZodType<ConflictRule> = z.object({
  skills: z.array(skillRefInYaml),
  reason: z.string(),
});

/** Validates DiscourageRule: soft warning between skills */
export const discourageRuleSchema: z.ZodType<DiscourageRule> = z.object({
  skills: z.array(skillRefInYaml),
  reason: z.string(),
});

/** Validates RecommendRule: suggestion based on current selection */
export const recommendRuleSchema: z.ZodType<RecommendRule> = z.object({
  when: skillRefInYaml,
  suggest: z.array(skillRefInYaml),
  reason: z.string(),
});

/** Validates RequireRule: hard dependency between skills */
export const requireRuleSchema: z.ZodType<RequireRule> = z.object({
  skill: skillRefInYaml,
  needs: z.array(skillRefInYaml),
  needs_any: z.boolean().optional(),
  reason: z.string(),
});

/** Validates AlternativeGroup: interchangeable skills */
export const alternativeGroupSchema: z.ZodType<AlternativeGroup> = z.object({
  purpose: z.string(),
  skills: z.array(skillRefInYaml),
});

/** Validates RelationshipDefinitions: all relationship types */
export const relationshipDefinitionsSchema: z.ZodType<RelationshipDefinitions> = z.object({
  conflicts: z.array(conflictRuleSchema),
  discourages: z.array(discourageRuleSchema),
  recommends: z.array(recommendRuleSchema),
  requires: z.array(requireRuleSchema),
  alternatives: z.array(alternativeGroupSchema),
});

/**
 * Validates SkillsMatrixConfig from skills-matrix.yaml.
 * Root configuration containing categories, relationships, and alias mappings.
 */
export const skillsMatrixConfigSchema: z.ZodType<SkillsMatrixConfig> = z.object({
  version: z.string(),
  categories: z.record(subcategorySchema, categoryDefinitionSchema) as z.ZodType<
    SkillsMatrixConfig["categories"]
  >,
  relationships: relationshipDefinitionsSchema,
  skill_aliases: z.record(skillDisplayNameSchema, skillIdSchema) as z.ZodType<
    SkillsMatrixConfig["skill_aliases"]
  >,
});

// =============================================================================
// Local Skill Schemas
// =============================================================================

/**
 * Lenient schema for LocalRawMetadata from local skill metadata.yaml files.
 * All fields optional (including cli_name) since the loader already checks
 * `if (!metadata.cli_name)` after parsing. Uses .passthrough() for forward
 * compatibility with new fields.
 */
export const localRawMetadataSchema = z
  .object({
    cli_name: z.string().optional(),
    cli_description: z.string().optional(),
    category: categoryPathSchema.optional(),
    category_exclusive: z.boolean().optional(),
    usage_guidance: z.string().optional(),
    tags: z.array(z.string()).optional(),
    compatible_with: z.array(skillIdSchema).optional(),
    conflicts_with: z.array(skillIdSchema).optional(),
    requires: z.array(skillIdSchema).optional(),
    requires_setup: z.array(skillIdSchema).optional(),
    provides_setup_for: z.array(skillIdSchema).optional(),
  })
  .passthrough();

/**
 * Lenient schema for LocalSkillMetadata from local skill metadata.yaml files.
 * Used by skill-metadata.ts to parse forked_from metadata. The forked_from
 * field is optional since not all local skills are forked. Uses .passthrough()
 * to preserve all other metadata fields (cli_name, tags, etc.) through
 * round-trip serialization.
 */
export const localSkillMetadataSchema = z
  .object({
    forked_from: z
      .object({
        skill_id: skillIdSchema,
        content_hash: z.string(),
        date: z.string(),
      })
      .optional(),
  })
  .passthrough();

// =============================================================================
// Stacks Schemas (config/stacks.yaml)
// =============================================================================

/**
 * Validates StackAgentConfig: maps subcategory IDs to technology aliases.
 * Uses lenient z.string() keys/values since real-world YAML contains
 * subcategory keys (e.g., "base-framework", "platform", "methodology")
 * and alias values not always present in the strict enums.
 */
export const stackAgentConfigSchema = z.record(
  z.string(),
  z.string(),
) as z.ZodType<StackAgentConfig>;

/**
 * Validates Stack definition from config/stacks.yaml.
 * Uses lenient z.string() for agent keys since stacks may reference agents
 * not in the strict AgentName enum (forward compatibility).
 */
export const stackSchema: z.ZodType<Stack> = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  agents: z.record(z.string(), stackAgentConfigSchema) as z.ZodType<Stack["agents"]>,
  philosophy: z.string().optional(),
});

/** Validates StacksConfig: top-level structure of config/stacks.yaml */
export const stacksConfigSchema: z.ZodType<StacksConfig> = z.object({
  stacks: z.array(stackSchema),
});

// =============================================================================
// Marketplace Schemas (marketplace.json)
// =============================================================================

/** Validates MarketplaceRemoteSource for remote plugin sources */
export const marketplaceRemoteSourceSchema: z.ZodType<MarketplaceRemoteSource> = z.object({
  source: z.enum(["github", "url"]),
  repo: z.string().optional(),
  url: z.string().optional(),
  ref: z.string().optional(),
});

/** Validates MarketplacePlugin entry in marketplace.json */
export const marketplacePluginSchema: z.ZodType<MarketplacePlugin> = z.object({
  name: z.string(),
  source: z.union([z.string(), marketplaceRemoteSourceSchema]),
  description: z.string().optional(),
  version: z.string().optional(),
  author: pluginAuthorSchema.optional(),
  category: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

/** Validates MarketplaceOwner information */
export const marketplaceOwnerSchema: z.ZodType<MarketplaceOwner> = z.object({
  name: z.string(),
  email: z.string().optional(),
});

/** Validates MarketplaceMetadata */
export const marketplaceMetadataSchema: z.ZodType<MarketplaceMetadata> = z.object({
  pluginRoot: z.string().optional(),
});

/**
 * Validates Marketplace from marketplace.json.
 * Contains plugin listings and marketplace metadata.
 */
export const marketplaceSchema: z.ZodType<Marketplace> = z.object({
  $schema: z.string().optional(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  owner: marketplaceOwnerSchema,
  metadata: marketplaceMetadataSchema.optional(),
  plugins: z.array(marketplacePluginSchema),
});

// =============================================================================
// Versioned Metadata Schema (metadata.yaml with version tracking)
// =============================================================================

/**
 * Lenient schema for VersionedMetadata from skill metadata.yaml files.
 * Used by versioning.ts for version bumping. The version and content_hash
 * fields are the primary concern; other fields are preserved via passthrough.
 */
export const versionedMetadataSchema = z
  .object({
    version: z.number(),
    content_hash: z.string().optional(),
    updated: z.string().optional(),
  })
  .passthrough();

// =============================================================================
// Default Mappings Schema (agent-mappings.yaml)
// =============================================================================

/**
 * Validates DefaultMappings from agent-mappings.yaml.
 * Contains skill-to-agent assignments, preloaded skill patterns,
 * and subcategory alias mappings.
 */
export const defaultMappingsSchema = z.object({
  skill_to_agents: z.record(z.string(), z.array(z.string())),
  preloaded_skills: z.record(z.string(), z.array(z.string())),
  subcategory_aliases: z.record(z.string(), z.string()),
});

// =============================================================================
// Settings File Schema (.claude/settings.json)
// =============================================================================

/** Validates permission configuration in settings.json */
export const permissionConfigSchema = z.object({
  allow: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
});

/**
 * Lenient schema for .claude/settings.json files.
 * Only validates the permissions field; other fields are preserved via passthrough.
 */
export const settingsFileSchema = z
  .object({
    permissions: permissionConfigSchema.optional(),
  })
  .passthrough();

// =============================================================================
// Import Skill Metadata Schema (for import command)
// =============================================================================

/**
 * Lenient schema for imported skill metadata.yaml files.
 * Used by the import command when injecting forked_from metadata.
 * Uses passthrough to preserve all existing fields through round-trip.
 */
export const importedSkillMetadataSchema = z
  .object({
    forked_from: z
      .object({
        source: z.string(),
        skill_name: z.string(),
        content_hash: z.string(),
        date: z.string(),
      })
      .optional(),
  })
  .passthrough();

/**
 * Lenient schema for ProjectSourceConfig loaded from config.yaml.
 * Used by config.ts for source/author resolution.
 * Uses passthrough to allow extra config.yaml fields (name, agents, etc.)
 * that ProjectSourceConfig doesn't define.
 */
export const projectSourceConfigSchema = z
  .object({
    source: z.string().optional(),
    author: z.string().optional(),
    marketplace: z.string().optional(),
    agents_source: z.string().optional(),
    sources: z
      .array(
        z.object({
          name: z.string(),
          url: z.string(),
          description: z.string().optional(),
          ref: z.string().optional(),
        }),
      )
      .optional(),
  })
  .passthrough();
