import { z } from "zod";
import type {
  AgentHookAction,
  AgentHookDefinition,
  AgentName,
  AgentYamlConfig,
  AlternativeGroup,
  BoundSkill,
  CategoryDefinition,
  CategoryPath,
  ConflictRule,
  DiscourageRule,
  Domain,
  Marketplace,
  MarketplaceMetadata,
  MarketplaceOwner,
  MarketplacePlugin,
  MarketplaceRemoteSource,
  ModelName,
  PermissionMode,
  PluginAuthor,
  PluginManifest,
  ProjectConfig,
  RecommendRule,
  RelationshipDefinitions,
  RequireRule,
  SkillAssignment,
  SkillDisplayName,
  SkillFrontmatter,
  SkillId,
  SkillMetadataConfig,
  SkillSource,
  SkillSourceType,
  SkillsMatrixConfig,
  Stack,
  StackAgentConfig,
  StacksConfig,
  Subcategory,
  ValidationResult,
} from "../types";

export const domainSchema = z.enum([
  "web",
  "web-extras",
  "api",
  "cli",
  "mobile",
  "shared",
]) as z.ZodType<Domain>;

export const skillSourceTypeSchema = z.enum([
  "public",
  "private",
  "local",
]) as z.ZodType<SkillSourceType>;

export const skillSourceSchema = z
  .object({
    name: z.string(),
    type: skillSourceTypeSchema,
    url: z.string().optional(),
    version: z.string().optional(),
    installed: z.boolean(),
    installMode: z.enum(["plugin", "local"]).optional(),
  })
  .passthrough();

export const boundSkillSchema: z.ZodType<BoundSkill> = z.object({
  id: z.string() as z.ZodType<SkillId>,
  sourceUrl: z.string(),
  sourceName: z.string(),
  boundTo: z.string(),
  description: z.string().optional(),
});

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

export const modelNameSchema = z.enum([
  "sonnet",
  "opus",
  "haiku",
  "inherit",
]) as z.ZodType<ModelName>;

export const permissionModeSchema = z.enum([
  "default",
  "acceptEdits",
  "dontAsk",
  "bypassPermissions",
  "plan",
  "delegate",
]) as z.ZodType<PermissionMode>;

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

const SKILL_ID_PATTERN = /^(web|api|cli|mobile|infra|meta|security)-.+-.+$/;

// Regex-based since Zod cannot express template literal types natively
export const skillIdSchema = z
  .string()
  .regex(
    SKILL_ID_PATTERN,
    "Must be a valid skill ID (e.g., 'web-framework-react')",
  ) as z.ZodType<SkillId>;

// Accepts: "prefix/subcategory", "prefix-subcategory", bare subcategory, or "local"
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

export const agentHookActionSchema: z.ZodType<AgentHookAction> = z.object({
  type: z.enum(["command", "script", "prompt"]),
  command: z.string().optional(),
  script: z.string().optional(),
  prompt: z.string().optional(),
});

export const agentHookDefinitionSchema: z.ZodType<AgentHookDefinition> = z.object({
  matcher: z.string().optional(),
  hooks: z.array(agentHookActionSchema).optional(),
});

export const hooksRecordSchema = z.record(z.string(), z.array(agentHookDefinitionSchema));

export const skillAssignmentSchema: z.ZodType<SkillAssignment> = z.object({
  id: skillIdSchema,
  preloaded: z.boolean().optional(),
  local: z.boolean().optional(),
  path: z.string().optional(),
});

export const skillFrontmatterSchema: z.ZodType<SkillFrontmatter> = z.object({
  name: skillIdSchema,
  description: z.string(),
  model: modelNameSchema.optional(),
});

// Lenient: accepts any string for `name` since local/custom skills may not follow strict SkillId pattern
export const skillFrontmatterLoaderSchema = z.object({
  name: z.string(),
  description: z.string(),
  model: modelNameSchema.optional(),
});

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

export const pluginAuthorSchema: z.ZodType<PluginAuthor> = z.object({
  name: z.string(),
  email: z.string().optional(),
});

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

export const projectConfigSchema: z.ZodType<ProjectConfig> = z.object({
  version: z.literal("1").optional(),
  name: z.string(),
  description: z.string().optional(),
  agents: z.array(z.string() as z.ZodType<AgentName>),
  skills: z.array(skillIdSchema),

  author: z.string().optional(),
  installMode: z.enum(["local", "plugin"]).optional(),
  stack: z.record(z.string(), z.record(subcategorySchema, skillIdSchema)).optional(),
  source: z.string().optional(),
  marketplace: z.string().optional(),
  agents_source: z.string().optional(),
});

// Lenient: name/agents optional since partial configs are valid at load time.
// Full validation happens in validateProjectConfig().
export const projectConfigLoaderSchema = z
  .object({
    version: z.literal("1").optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    agents: z.array(z.string()).optional(),
    skills: z.array(skillIdSchema).optional(),

    author: z.string().optional(),
    installMode: z.enum(["local", "plugin"]).optional(),
    stack: z.record(z.string(), z.record(z.string(), skillIdSchema)).optional(),
    source: z.string().optional(),
    marketplace: z.string().optional(),
    agents_source: z.string().optional(),
  })
  .passthrough();

export const validationResultSchema: z.ZodType<ValidationResult> = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

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

// Lenient: accepts both SkillId and SkillDisplayName, resolved to canonical IDs by matrix-loader
const skillRefInYaml = z.string() as z.ZodType<SkillId>;

export const conflictRuleSchema: z.ZodType<ConflictRule> = z.object({
  skills: z.array(skillRefInYaml),
  reason: z.string(),
});

export const discourageRuleSchema: z.ZodType<DiscourageRule> = z.object({
  skills: z.array(skillRefInYaml),
  reason: z.string(),
});

export const recommendRuleSchema: z.ZodType<RecommendRule> = z.object({
  when: skillRefInYaml,
  suggest: z.array(skillRefInYaml),
  reason: z.string(),
});

export const requireRuleSchema: z.ZodType<RequireRule> = z.object({
  skill: skillRefInYaml,
  needs: z.array(skillRefInYaml),
  needs_any: z.boolean().optional(),
  reason: z.string(),
});

export const alternativeGroupSchema: z.ZodType<AlternativeGroup> = z.object({
  purpose: z.string(),
  skills: z.array(skillRefInYaml),
});

export const relationshipDefinitionsSchema: z.ZodType<RelationshipDefinitions> = z.object({
  conflicts: z.array(conflictRuleSchema),
  discourages: z.array(discourageRuleSchema),
  recommends: z.array(recommendRuleSchema),
  requires: z.array(requireRuleSchema),
  alternatives: z.array(alternativeGroupSchema),
});

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

// All fields optional — the loader validates cli_name after parsing
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

// Lenient z.string() keys/values for forward compatibility with new subcategories/aliases
export const stackAgentConfigSchema = z.record(
  z.string(),
  z.string(),
) as z.ZodType<StackAgentConfig>;

export const stackSchema: z.ZodType<Stack> = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  agents: z.record(z.string(), stackAgentConfigSchema) as z.ZodType<Stack["agents"]>,
  philosophy: z.string().optional(),
});

export const stacksConfigSchema: z.ZodType<StacksConfig> = z.object({
  stacks: z.array(stackSchema),
});

export const marketplaceRemoteSourceSchema: z.ZodType<MarketplaceRemoteSource> = z.object({
  source: z.enum(["github", "url"]),
  repo: z.string().optional(),
  url: z.string().optional(),
  ref: z.string().optional(),
});

export const marketplacePluginSchema: z.ZodType<MarketplacePlugin> = z.object({
  name: z.string(),
  source: z.union([z.string(), marketplaceRemoteSourceSchema]),
  description: z.string().optional(),
  version: z.string().optional(),
  author: pluginAuthorSchema.optional(),
  category: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

export const marketplaceOwnerSchema: z.ZodType<MarketplaceOwner> = z.object({
  name: z.string(),
  email: z.string().optional(),
});

export const marketplaceMetadataSchema: z.ZodType<MarketplaceMetadata> = z.object({
  pluginRoot: z.string().optional(),
});

export const marketplaceSchema: z.ZodType<Marketplace> = z.object({
  $schema: z.string().optional(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  owner: marketplaceOwnerSchema,
  metadata: marketplaceMetadataSchema.optional(),
  plugins: z.array(marketplacePluginSchema),
});

export const versionedMetadataSchema = z
  .object({
    version: z.number(),
    content_hash: z.string().optional(),
    updated: z.string().optional(),
  })
  .passthrough();

export const defaultMappingsSchema = z.object({
  skill_to_agents: z.record(z.string(), z.array(z.string())),
  preloaded_skills: z.record(z.string(), z.array(z.string())),
  subcategory_aliases: z.record(z.string(), z.string()),
});

export const permissionConfigSchema = z.object({
  allow: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
});

export const settingsFileSchema = z
  .object({
    permissions: permissionConfigSchema.optional(),
  })
  .passthrough();

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
    boundSkills: z.array(boundSkillSchema).optional(),
  })
  .passthrough();

// Strict validation schemas — used by cc validate / plugin-validator
const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// Lenient `id` (any string) since marketplace agents may have any kebab-case identifier
export const agentYamlGenerationSchema = z
  .object({
    $schema: z.string().optional(),
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    model: modelNameSchema.optional(),
    tools: z.array(z.string()),
    disallowed_tools: z.array(z.string()).optional(),
    permission_mode: permissionModeSchema.optional(),
    hooks: hooksRecordSchema.optional(),
    output_format: z.string().optional(),
  })
  .strict();

export const agentFrontmatterValidationSchema = z
  .object({
    name: z.string().regex(KEBAB_CASE_PATTERN).min(1),
    description: z.string().min(1),
    tools: z.string().optional(),
    disallowedTools: z.string().optional(),
    model: modelNameSchema.optional(),
    permissionMode: permissionModeSchema.optional(),
    skills: z.array(z.string().min(1)).optional(),
    hooks: hooksRecordSchema.optional(),
  })
  .strict();

export const skillFrontmatterValidationSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    "disable-model-invocation": z.boolean().optional(),
    "user-invocable": z.boolean().optional(),
    "allowed-tools": z.string().optional(),
    model: modelNameSchema.optional(),
    context: z.enum(["fork"]).optional(),
    agent: z.string().optional(),
    "argument-hint": z.string().optional(),
  })
  .strict();

export const metadataValidationSchema = z
  .object({
    category: z.string(),
    category_exclusive: z.boolean().optional(),
    author: z.string().regex(/^@[a-z][a-z0-9-]*$/),
    version: z.number().int().min(1).optional(),
    cli_name: z.string().min(1).max(30),
    cli_description: z.string().min(1).max(60),
    usage_guidance: z.string().min(10),
    requires: z.array(z.string().min(1)).optional(),
    compatible_with: z.array(z.string().min(1)).optional(),
    conflicts_with: z.array(z.string().min(1)).optional(),
    tags: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).optional(),
    requires_setup: z.array(z.string().min(1)).optional(),
    provides_setup_for: z.array(z.string().min(1)).optional(),
    content_hash: z
      .string()
      .regex(/^[a-f0-9]{7}$/)
      .optional(),
    updated: z.string().optional(),
    forked_from: z
      .object({
        skill_id: z.string(),
        version: z.number().int().min(1).optional(),
        content_hash: z.string(),
        source: z.string().optional(),
        date: z.string(),
      })
      .optional(),
  })
  .strict();

const stackSkillAssignmentSchema = z
  .object({
    id: z.string().min(1),
    preloaded: z.boolean().optional(),
  })
  .strict();

export const stackConfigValidationSchema = z
  .object({
    id: z.string().regex(KEBAB_CASE_PATTERN).optional(),
    name: z.string().min(1),
    version: z.string(),
    author: z.string().min(1),
    description: z.string().optional(),
    created: z.string().optional(),
    updated: z.string().optional(),
    framework: z.string().optional(),
    skills: z.array(stackSkillAssignmentSchema).min(1),
    agents: z.array(z.string().regex(KEBAB_CASE_PATTERN)).min(1),
    agent_skills: z
      .record(z.string(), z.record(z.string(), z.array(stackSkillAssignmentSchema)))
      .optional(),
    philosophy: z.string().optional(),
    principles: z.array(z.string().min(1)).optional(),
    tags: z.array(z.string().regex(KEBAB_CASE_PATTERN)).optional(),
    overrides: z
      .record(
        z.string(),
        z
          .object({
            alternatives: z.array(z.string().min(1)).optional(),
            locked: z.boolean().optional(),
          })
          .strict(),
      )
      .optional(),
    metrics: z
      .object({
        upvotes: z.number().int().min(0).optional(),
        downloads: z.number().int().min(0).optional(),
      })
      .strict()
      .optional(),
    hooks: z
      .record(
        z.string(),
        z.array(
          z.object({
            matcher: z.string().optional(),
            hooks: z.array(agentHookActionSchema).min(1),
          }),
        ),
      )
      .optional(),
  })
  .strict();
