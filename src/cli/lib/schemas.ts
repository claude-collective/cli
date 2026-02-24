import { z } from "zod";
import { KEBAB_CASE_PATTERN } from "../consts";
import { warn } from "../utils/logger";
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
  RecommendRule,
  RelationshipDefinitions,
  RequireRule,
  SkillAssignment,
  SkillDisplayName,
  SkillId,
  SkillSourceType,
  SkillsMatrixConfig,
  Subcategory,
} from "../types";

/**
 * Runtime-extensible sets of custom values discovered from source matrices.
 * Populated by extendSchemasWithCustomValues() after matrix merge.
 * Checked by categoryPathSchema, stackAgentConfigSchema, and agentYamlConfigSchema
 * to accept custom categories, domains, and agent names at parse time.
 */
const customExtensions = {
  categories: new Set<string>(),
  domains: new Set<string>(),
  agentNames: new Set<string>(),
  skillIds: new Set<string>(),
};

/** Raw domain values (before cast) — single source of truth for built-in domains */
export const DOMAIN_VALUES = ["web", "api", "cli", "mobile", "shared"] as const;

// Bridge pattern: z.ZodType<ExistingType> ensures Zod output matches our union types
export const domainSchema = z.enum(DOMAIN_VALUES) as z.ZodType<Domain>;

export const skillSourceTypeSchema = z.enum([
  "public",
  "private",
  "local",
]) as z.ZodType<SkillSourceType>;

export const boundSkillSchema: z.ZodType<BoundSkill> = z.object({
  id: z.string() as z.ZodType<SkillId>,
  sourceUrl: z.string(),
  sourceName: z.string(),
  boundTo: z.string(),
  description: z.string().optional(),
});

/** Raw subcategory values (before cast) — single source of truth for built-in subcategories */
export const SUBCATEGORY_VALUES = [
  "web-framework",
  "web-styling",
  "web-client-state",
  "web-server-state",
  "web-forms",
  "web-testing",
  "web-ui-components",
  "web-mocking",
  "web-error-handling",
  "web-i18n",
  "web-file-upload",
  "web-files",
  "web-utilities",
  "web-realtime",
  "web-animation",
  "web-pwa",
  "web-accessibility",
  "web-performance",
  "web-base-framework",
  "api-api",
  "api-database",
  "api-auth",
  "api-observability",
  "api-analytics",
  "api-email",
  "api-performance",
  "mobile-framework",
  "mobile-platform",
  "shared-monorepo",
  "shared-tooling",
  "shared-security",
  "shared-methodology",
  "shared-research",
  "shared-reviewing",
  "shared-ci-cd",
  "cli-framework",
  "cli-prompts",
  "cli-testing",
] as const;

// Bridge pattern: z.ZodType<ExistingType> ensures Zod output matches our union types
export const subcategorySchema = z.enum(SUBCATEGORY_VALUES) as z.ZodType<Subcategory>;

export const agentNameSchema = z.enum([
  "web-developer",
  "api-developer",
  "cli-developer",
  "web-architecture",
  "agent-summoner",
  "documentor",
  "skill-summoner",
  "cli-migrator",
  "pattern-scout",
  "web-pattern-critique",
  "web-pm",
  "api-researcher",
  "web-researcher",
  "api-reviewer",
  "cli-reviewer",
  "web-reviewer",
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
  "react",
  "vue",
  "angular",
  "solidjs",
  "nextjs-app-router",
  "nextjs-server-actions",
  "remix",
  "nuxt",
  "scss-modules",
  "cva",
  "tailwind",
  "zustand",
  "redux-toolkit",
  "pinia",
  "ngrx-signalstore",
  "jotai",
  "mobx",
  "react-query",
  "swr",
  "graphql-apollo",
  "graphql-urql",
  "trpc",
  "react-hook-form",
  "vee-validate",
  "zod-validation",
  "vitest",
  "playwright-e2e",
  "cypress-e2e",
  "react-testing-library",
  "vue-test-utils",
  "msw",
  "shadcn-ui",
  "tanstack-table",
  "radix-ui",
  "hono",
  "express",
  "fastify",
  "drizzle",
  "prisma",
  "better-auth",
  "axiom-pino-sentry",
  "posthog",
  "posthog-flags",
  "resend",
  "github-actions",
  "react-native",
  "expo",
  "turborepo",
  "tooling",
  "posthog-setup",
  "env",
  "observability-setup",
  "email-setup",
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
  "api-testing",
  "api-performance",
  "web-performance",
  "security",
  "commander",
  "cli-commander",
  "oclif",
  "reviewing",
  "cli-reviewing",
  "research-methodology",
  "investigation-requirements",
  "anti-over-engineering",
  "success-criteria",
  "write-verification",
  "improvement-protocol",
  "context-management",
]) as z.ZodType<SkillDisplayName>;

/** Matches SkillId format: prefix-subcategory-name (at least 3 dash-separated segments) */
export const SKILL_ID_PATTERN = /^(web|api|cli|mobile|infra|meta|security)-.+-.+$/;

/**
 * Checks if a string is a valid skill ID: either matches the built-in prefix pattern
 * (web|api|cli|mobile|infra|meta|security) or was registered as a custom skill ID
 * via extendSchemasWithCustomValues().
 */
export function isValidSkillId(id: string): boolean {
  return SKILL_ID_PATTERN.test(id) || customExtensions.skillIds.has(id);
}

// Regex-based since Zod cannot express template literal types natively
export const skillIdSchema = z
  .string()
  .regex(
    SKILL_ID_PATTERN,
    "Must be a valid skill ID (e.g., 'web-framework-react')",
  ) as z.ZodType<SkillId>;

/** Extensible schemas that accept both built-in values and custom values registered via extendSchemasWithCustomValues() */
const extensibleDomainSchema = z
  .string()
  .refine(
    (val): val is Domain =>
      domainSchema.safeParse(val).success || customExtensions.domains.has(val),
    { message: "Must be a valid domain" },
  ) as z.ZodType<Domain>;

const extensibleSkillIdSchema = z
  .string()
  .refine(
    (val): val is SkillId =>
      skillIdSchema.safeParse(val).success || customExtensions.skillIds.has(val),
    { message: "Must be a valid skill ID" },
  ) as z.ZodType<SkillId>;

const extensibleSubcategorySchema = z
  .string()
  .refine(
    (val): val is Subcategory =>
      subcategorySchema.safeParse(val).success || customExtensions.categories.has(val),
    { message: "Must be a valid subcategory" },
  ) as z.ZodType<Subcategory>;

const extensibleAgentNameSchema = z
  .string()
  .refine(
    (val): val is AgentName =>
      agentNameSchema.safeParse(val).success || customExtensions.agentNames.has(val),
    { message: "Must be a valid agent name" },
  ) as z.ZodType<AgentName>;

/** Validates category: strict categoryPathSchema by default, any kebab-case string when custom: true */
function validateCategoryField(
  val: { category?: string; custom?: boolean },
  ctx: z.RefinementCtx,
): void {
  if (!val.category) return;

  if (val.custom) {
    if (!KEBAB_CASE_PATTERN.test(val.category)) {
      ctx.addIssue({
        code: "custom",
        path: ["category"],
        message: "Custom category must be kebab-case",
      });
    }
    return;
  }

  const result = categoryPathSchema.safeParse(val.category);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({ ...issue, path: ["category"] });
    }
  }
}

/** Creates a superRefine callback that validates record keys against built-in + custom extension sets */
function validateExtensibleRecordKeys(
  builtinSet: Set<string>,
  extensionSet: Set<string>,
  label: string,
) {
  return (val: Record<string, unknown>, ctx: z.RefinementCtx) => {
    for (const key of Object.keys(val)) {
      if (!builtinSet.has(key) && !extensionSet.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `Invalid ${label} '${key}'.`,
        });
      }
    }
  };
}

// Accepts: "prefix-subcategory", bare subcategory, "local", or custom category from extended schema
export const categoryPathSchema = z.string().refine(
  (val): val is CategoryPath => {
    if (val === "local") return true;
    if (/^(web|api|cli|mobile|infra|meta|security|shared)-.+$/.test(val)) return true;
    if (subcategorySchema.safeParse(val).success) return true;
    // Accept custom categories registered via extendSchemasWithCustomValues()
    return customExtensions.categories.has(val);
  },
  {
    message: "Must be a valid category path (e.g., 'web-framework', 'shared-testing', or 'local')",
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

/** Strict hook definition — hooks array is required and must have at least one action */
const strictAgentHookDefinitionSchema = z.object({
  matcher: z.string().optional(),
  hooks: z.array(agentHookActionSchema).min(1),
});

/** Strict hooks record for validation schemas (requires at least one hook action per definition) */
export const strictHooksRecordSchema = z.record(
  z.string(),
  z.array(strictAgentHookDefinitionSchema),
);

export const skillAssignmentSchema: z.ZodType<SkillAssignment> = z.object({
  id: extensibleSkillIdSchema,
  preloaded: z.boolean().optional(),
  local: z.boolean().optional(),
  path: z.string().optional(),
});

// Lenient: accepts any string for `name` since local/custom skills may not follow strict SkillId pattern
export const skillFrontmatterLoaderSchema = z.object({
  name: z.string(),
  description: z.string(),
  model: modelNameSchema.optional(),
});

// Loader schema: category strictness depends on custom field (see validateCategoryField)
export const skillMetadataLoaderSchema = z
  .object({
    // Field accepts any string; cross-field validation in superRefine enforces strict/custom rules
    category: (z.string() as z.ZodType<CategoryPath>).optional(),
    categoryExclusive: z.boolean().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
    requires: z.array(skillIdSchema).optional(),
    compatibleWith: z.array(skillIdSchema).optional(),
    conflictsWith: z.array(skillIdSchema).optional(),
    custom: z.boolean().optional(),
  })
  .passthrough()
  .superRefine(validateCategoryField);

export const pluginAuthorSchema: z.ZodType<PluginAuthor> = z.object({
  name: z.string().min(1),
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

/** Strict schema for plugin.json validation (IDE, agentsinc validate). Rejects unknown fields. */
export const pluginManifestValidationSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().optional(),
    description: z.string().optional(),
    author: pluginAuthorSchema.optional(),
    keywords: z.array(z.string()).optional(),
    commands: z.union([z.string(), z.array(z.string())]).optional(),
    agents: z.union([z.string(), z.array(z.string())]).optional(),
    skills: z.union([z.string(), z.array(z.string())]).optional(),
    hooks: z.union([z.string(), strictHooksRecordSchema]).optional(),
  })
  .strict();

export const agentYamlConfigSchema: z.ZodType<AgentYamlConfig> = z.object({
  id: extensibleAgentNameSchema,
  title: z.string(),
  description: z.string(),
  model: modelNameSchema.optional(),
  tools: z.array(z.string()),
  disallowedTools: z.array(z.string()).optional(),
  permissionMode: permissionModeSchema.optional(),
  hooks: hooksRecordSchema.optional(),
  outputFormat: z.string().optional(),
  custom: z.boolean().optional(),
});

// Defined before projectConfigLoaderSchema so it can reference stackAgentConfigSchema
// Single skill assignment element: either a bare SkillId string or an object { id, preloaded? }
const skillAssignmentElementSchema = z.union([skillIdSchema, skillAssignmentSchema]);

/**
 * Agent config within a stack: maps subcategory to skill assignment(s).
 * Keys restricted to valid Subcategory values from skills-matrix.yaml.
 * Lenient: accepts bare string, object, or array from YAML.
 * Consumers normalize all values to SkillAssignment[] after parsing.
 *
 * Uses z.record(z.string()) with superRefine for key validation because
 * z.record(z.enum()) treats all enum values as required properties.
 */
const stackSubcategoryValues: Set<string> = new Set(SUBCATEGORY_VALUES);
export const stackAgentConfigSchema = z
  .record(
    z.string(),
    z.union([skillAssignmentElementSchema, z.array(skillAssignmentElementSchema)]),
  )
  .superRefine(
    validateExtensibleRecordKeys(
      stackSubcategoryValues,
      customExtensions.categories,
      "subcategory",
    ),
  );

/**
 * Lenient loader for .claude/config.yaml (ProjectConfig).
 * name/agents optional since partial configs are valid at load time.
 * Full validation happens in validateProjectConfig().
 */
export const projectConfigLoaderSchema = z
  .object({
    version: z.literal("1").optional(),
    /** Project/plugin name in kebab-case */
    name: z.string().optional(),
    description: z.string().optional(),
    /** Agent IDs to compile (e.g., ["web-developer", "api-developer"]) */
    agents: z.array(z.string()).optional(),
    /** Flat list of all skill IDs used by this project */
    skills: z.array(extensibleSkillIdSchema).optional(),

    /** Author handle (e.g., "@vince") */
    author: z.string().optional(),
    /** "local" = .claude/agents, "plugin" = .claude/plugins/ (DEFAULT_PLUGIN_NAME) */
    installMode: z.enum(["local", "plugin"]).optional(),
    /** Whether expert mode (advanced/niche skills) was enabled in the wizard */
    expertMode: z.boolean().optional(),
    /** Selected domains from the wizard (persisted for edit mode restoration) */
    domains: z.array(extensibleDomainSchema).optional(),
    /** Selected agents from the wizard (persisted for edit mode restoration) */
    selectedAgents: z.array(z.string()).optional(),
    /** Agent-to-subcategory-to-skill mappings from selected stack (accepts same formats as stacks.yaml) */
    stack: z.record(z.string(), stackAgentConfigSchema).optional(),
    /** Skills source path or URL (e.g., "github:my-org/skills") */
    source: z.string().optional(),
    /** Marketplace identifier for plugin installation */
    marketplace: z.string().optional(),
    /** Separate source for agents when different from skills source */
    agentsSource: z.string().optional(),
  })
  .passthrough();

/**
 * Strict schema for IDE validation of .claude-src/config.yaml (ProjectConfig).
 * Used to generate project-config.schema.json for yaml-language-server.
 * Requires name/agents (the fields validateProjectConfig checks) and
 * does NOT use .passthrough() so the IDE flags unknown properties.
 */
export const projectConfigValidationSchema = z.object({
  version: z.literal("1").optional(),
  /** Project/plugin name in kebab-case */
  name: z.string(),
  description: z.string().optional(),
  /** Agent IDs to compile (e.g., ["web-developer", "api-developer"]) */
  agents: z.array(z.string()),
  /** Flat list of all skill IDs used by this project */
  skills: z.array(skillIdSchema),
  /** Author handle (e.g., "@vince") */
  author: z.string().optional(),
  /** "local" = .claude/agents, "plugin" = .claude/plugins/ (DEFAULT_PLUGIN_NAME) */
  installMode: z.enum(["local", "plugin"]),
  /** Whether expert mode (advanced/niche skills) was enabled in the wizard */
  expertMode: z.boolean().optional(),
  /** Selected domains from the wizard (persisted for edit mode restoration) */
  domains: z.array(domainSchema).optional(),
  /** Selected agents from the wizard (persisted for edit mode restoration) */
  selectedAgents: z.array(z.string()).optional(),
  /** Agent-to-subcategory-to-skill mappings from selected stack */
  stack: z.record(z.string(), stackAgentConfigSchema),
  /** Skills source path or URL (e.g., "github:my-org/skills") */
  source: z.string(),
  /** Marketplace identifier for plugin installation */
  marketplace: z.string().optional(),
  /** Separate source for agents when different from skills source */
  agentsSource: z.string().optional(),
});

export const categoryDefinitionSchema: z.ZodType<CategoryDefinition> = z.object({
  id: extensibleSubcategorySchema,
  displayName: z.string(),
  description: z.string(),
  domain: extensibleDomainSchema.optional() as z.ZodType<Domain | undefined>,
  exclusive: z.boolean(),
  required: z.boolean(),
  order: z.number(),
  icon: z.string().optional(),
  custom: z.boolean().optional(),
});

// Lenient: accepts both SkillId and SkillDisplayName, resolved to canonical IDs by matrix-loader
const skillRefInYaml = z.string() as z.ZodType<SkillId>;

export const conflictRuleSchema: z.ZodType<ConflictRule> = z.object({
  skills: z.array(skillRefInYaml).min(2),
  reason: z.string(),
});

export const discourageRuleSchema: z.ZodType<DiscourageRule> = z.object({
  skills: z.array(skillRefInYaml).min(2),
  reason: z.string(),
});

export const recommendRuleSchema: z.ZodType<RecommendRule> = z.object({
  when: skillRefInYaml,
  suggest: z.array(skillRefInYaml).min(1),
  reason: z.string(),
});

export const requireRuleSchema: z.ZodType<RequireRule> = z.object({
  skill: skillRefInYaml,
  needs: z.array(skillRefInYaml).min(1),
  needsAny: z.boolean().optional(),
  reason: z.string(),
});

export const alternativeGroupSchema: z.ZodType<AlternativeGroup> = z.object({
  purpose: z.string(),
  skills: z.array(skillRefInYaml).min(1),
});

export const relationshipDefinitionsSchema: z.ZodType<RelationshipDefinitions> = z.object({
  conflicts: z.array(conflictRuleSchema),
  discourages: z.array(discourageRuleSchema),
  recommends: z.array(recommendRuleSchema),
  requires: z.array(requireRuleSchema),
  alternatives: z.array(alternativeGroupSchema),
});

/**
 * Skills matrix config schema with runtime-extensible key validation.
 * Category keys and skill alias entries accept custom values registered via
 * extendSchemasWithCustomValues() (called by discoverAndExtendFromSource).
 *
 * Uses z.record(z.string()) + superRefine for key validation (same pattern as
 * stackAgentConfigSchema) because z.record(z.enum()) cannot be extended at runtime.
 *
 * Relationships and skillAliases are optional since source matrices may only define
 * custom categories without relationships or aliases.
 */
const builtinSubcategoryValues: Set<string> = new Set(SUBCATEGORY_VALUES);
// Bridge cast removed: optional fields require runtime defaults in loadSkillsMatrix()
export const skillsMatrixConfigSchema = z.object({
  version: z.string(),
  categories: z
    .record(z.string(), categoryDefinitionSchema)
    .superRefine(
      validateExtensibleRecordKeys(
        builtinSubcategoryValues,
        customExtensions.categories,
        "category key",
      ),
    ) as z.ZodType<SkillsMatrixConfig["categories"]>,
  relationships: relationshipDefinitionsSchema.optional(),
  skillAliases: z.record(z.string(), extensibleSkillIdSchema).optional(),
});

/**
 * Raw metadata from a local skill's metadata.yaml.
 * All fields optional — the loader validates cliName after parsing.
 */
export const localRawMetadataSchema = z
  .object({
    /** Short name shown in the wizard grid (e.g., "my-custom-react") */
    cliName: z.string().optional(),
    /** One-line description for the wizard */
    cliDescription: z.string().optional(),
    /** Subcategory to place this skill in (e.g., "web-framework") */
    // Field accepts any string; cross-field validation in superRefine enforces strict/custom rules
    category: (z.string() as z.ZodType<CategoryPath>).optional(),
    /** If true, only one skill from this category can be selected */
    categoryExclusive: z.boolean().optional(),
    /** When an AI agent should invoke this skill */
    usageGuidance: z.string().optional(),
    tags: z.array(z.string()).optional(),
    /** Framework skills this is compatible with (for Build step filtering) */
    compatibleWith: z.array(skillIdSchema).optional(),
    /** Skills that cannot coexist with this one */
    conflictsWith: z.array(skillIdSchema).optional(),
    /** Skills that must be selected before this one */
    requires: z.array(skillIdSchema).optional(),
    /** Setup skills that must be installed first (e.g., env setup) */
    requiresSetup: z.array(skillIdSchema).optional(),
    /** Usage skills this setup skill configures (inverse relationship) */
    providesSetupFor: z.array(skillIdSchema).optional(),
    /** True if this skill was created outside the CLI's built-in vocabulary */
    custom: z.boolean().optional(),
  })
  .passthrough()
  .superRefine(validateCategoryField);

/** Metadata for local skills that were forked/copied from a marketplace skill */
export const localSkillMetadataSchema = z
  .object({
    forkedFrom: z
      .object({
        /** Original skill ID before forking (e.g., "web-framework-react") */
        skillId: skillIdSchema,
        /** SHA hash of the original content at fork time (for diff detection) */
        contentHash: z.string(),
        /** ISO date when the fork was created */
        date: z.string(),
        /** Source URL the skill was installed from (e.g., "github:agents-inc/skills") */
        source: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

export const stackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  /** Maps agent IDs to their subcategory-to-skill assignments */
  agents: z.record(z.string(), stackAgentConfigSchema),
  /** High-level philosophy guiding this stack's technology choices */
  philosophy: z.string().optional(),
});

// Pre-normalization schema: values may be string or string[].
// loadStacks() normalizes to StacksConfig (all values SkillId[]) after parsing.
export const stacksConfigSchema = z.object({
  stacks: z.array(stackSchema).min(1),
});

export const marketplaceRemoteSourceSchema: z.ZodType<MarketplaceRemoteSource> = z.object({
  source: z.enum(["github", "url"]),
  repo: z.string().optional(),
  url: z.string().optional(),
  ref: z.string().optional(),
});

export const marketplacePluginSchema: z.ZodType<MarketplacePlugin> = z.object({
  name: z.string().min(1),
  /** Local directory path (relative to pluginRoot) or remote source config */
  source: z.union([z.string(), marketplaceRemoteSourceSchema]),
  description: z.string().optional(),
  version: z.string().optional(),
  author: pluginAuthorSchema.optional(),
  /** Marketplace category for grouping (e.g., "framework", "testing") */
  category: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

export const marketplaceOwnerSchema: z.ZodType<MarketplaceOwner> = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
});

export const marketplaceMetadataSchema: z.ZodType<MarketplaceMetadata> = z.object({
  /** Base directory for resolving plugin source paths (e.g., "plugins/") */
  pluginRoot: z.string().optional(),
});

export const marketplaceSchema: z.ZodType<Marketplace> = z.object({
  $schema: z.string().optional(),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  owner: marketplaceOwnerSchema,
  metadata: marketplaceMetadataSchema.optional(),
  plugins: z.array(marketplacePluginSchema).min(1),
});

/** Tool permission overrides (allow/deny lists for Claude Code tool access) */
export const permissionConfigSchema = z.object({
  /** Tool names or patterns to explicitly allow */
  allow: z.array(z.string()).optional(),
  /** Tool names or patterns to explicitly deny */
  deny: z.array(z.string()).optional(),
});

/** Settings file schema (.claude/settings.yaml) for project-level configuration */
export const settingsFileSchema = z
  .object({
    permissions: permissionConfigSchema.optional(),
  })
  .passthrough();

/** Metadata for skills imported via `agentsinc import skill` (tracks original source for updates) */
export const importedSkillMetadataSchema = z
  .object({
    forkedFrom: z
      .object({
        /** Source URL or identifier where the skill was imported from */
        source: z.string(),
        /** Original skill name in the source */
        skillName: z.string(),
        /** SHA hash of the original content at import time */
        contentHash: z.string(),
        /** ISO date when the import was performed */
        date: z.string(),
      })
      .optional(),
  })
  .passthrough();

/** Branding overrides for white-labeling the CLI */
export const brandingConfigSchema = z.object({
  /** Custom CLI name (e.g., "Acme Dev Tools") */
  name: z.string().optional(),
  /** Custom tagline shown in wizard header */
  tagline: z.string().optional(),
});

/**
 * Project source configuration from .claude/config.yaml.
 * Stores multi-source settings, custom directory overrides, and bound skills.
 */
export const projectSourceConfigSchema = z
  .object({
    /** Primary skills source (path or URL) */
    source: z.string().optional(),
    /** Author handle for this project's config */
    author: z.string().optional(),
    /** Marketplace identifier for plugin installation */
    marketplace: z.string().optional(),
    /** Separate source for agent definitions (when different from skills) */
    agentsSource: z.string().optional(),
    /** Additional skill sources (private marketplaces, custom repos) */
    sources: z
      .array(
        z.object({
          /** Display name for the source (shown in wizard) */
          name: z.string(),
          /** Source URL (e.g., "github:acme-corp/claude-skills") */
          url: z.string(),
          description: z.string().optional(),
          /** Git ref (branch/tag/commit) for the source */
          ref: z.string().optional(),
        }),
      )
      .optional(),
    /** Skills explicitly bound to subcategories via search (from Step Sources) */
    boundSkills: z.array(boundSkillSchema).optional(),
    /** Branding overrides for white-labeling the CLI */
    branding: brandingConfigSchema.optional(),
    /** Custom skills directory override (default: "src/skills") */
    skillsDir: z.string().optional(),
    /** Custom agents directory override (default: "src/agents") */
    agentsDir: z.string().optional(),
    /** Custom stacks file path override (default: "config/stacks.yaml") */
    stacksFile: z.string().optional(),
    /** Custom matrix file path override (default: "config/skills-matrix.yaml") */
    matrixFile: z.string().optional(),
  })
  .passthrough();

/**
 * Strict schema for IDE validation of .claude-src/config.yaml (ProjectSourceConfig).
 * Used to generate project-source-config.schema.json for yaml-language-server.
 * All fields optional (source configs may have any subset) but no unknown properties.
 */
export const projectSourceConfigValidationSchema = z.object({
  source: z.string().optional(),
  author: z.string().optional(),
  marketplace: z.string().optional(),
  agentsSource: z.string().optional(),
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
  branding: brandingConfigSchema.optional(),
  skillsDir: z.string().optional(),
  agentsDir: z.string().optional(),
  stacksFile: z.string().optional(),
  matrixFile: z.string().optional(),
});

// Strict validation schemas enforce all constraints and use .strict() to reject unknown fields,
// unlike the lenient loader schemas above which use .passthrough() for forward compatibility at parse boundaries

/** Strict schema for compiled agent.yaml output. Lenient id (any string) since marketplace agents may use custom identifiers. */
export const agentYamlGenerationSchema = z
  .object({
    $schema: z.string().optional(),
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    model: modelNameSchema.optional(),
    tools: z.array(z.string()).min(1),
    disallowedTools: z.array(z.string()).optional(),
    permissionMode: permissionModeSchema.optional(),
    hooks: strictHooksRecordSchema.optional(),
    outputFormat: z.string().optional(),
    custom: z.boolean().optional(),
  })
  .strict();

/** Strict validation for agent AGENT.md frontmatter (used by plugin-validator) */
export const agentFrontmatterValidationSchema = z
  .object({
    /** Agent name in kebab-case (becomes the Task tool identifier) */
    name: z.string().regex(KEBAB_CASE_PATTERN).min(1),
    description: z.string().min(1),
    /** Comma-separated list of allowed tools */
    tools: z.string().optional(),
    /** Comma-separated list of denied tools */
    disallowedTools: z.string().optional(),
    model: modelNameSchema.optional(),
    permissionMode: permissionModeSchema.optional(),
    /** Skill names to preload (embed in agent prompt) */
    skills: z.array(z.string().min(1)).optional(),
    hooks: strictHooksRecordSchema.optional(),
  })
  .strict();

/** Strict validation for SKILL.md frontmatter (matches Claude Code plugin spec) */
export const skillFrontmatterValidationSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    /** If true, Claude cannot invoke this skill on its own */
    "disable-model-invocation": z.boolean().optional(),
    /** If true, user can invoke this skill directly */
    "user-invocable": z.boolean().optional(),
    /** Comma-separated list of tools this skill can use */
    "allowed-tools": z.string().optional(),
    model: modelNameSchema.optional(),
    /** "fork" means skill runs in a forked context (separate conversation) */
    context: z.enum(["fork"]).optional(),
    /** Agent name this skill is scoped to */
    agent: z.string().optional(),
    /** Hint text shown when user invokes the skill */
    "argument-hint": z.string().optional(),
  })
  .strict();

/** Strict validation for metadata.yaml in published skills (enforces author format, length limits) */
export const metadataValidationSchema = z
  .object({
    /** Domain-prefixed subcategory (e.g., "web-framework") */
    category: extensibleSubcategorySchema,
    categoryExclusive: z.boolean().optional(),
    /** Author handle — must start with @ (e.g., "@vince") */
    author: z.string().regex(/^@[a-z][a-z0-9-]*$/),
    /** Short display name for the wizard grid (max 30 chars) */
    cliName: z.string().min(1).max(30),
    /** One-line description for the wizard (max 60 chars) */
    cliDescription: z.string().min(1).max(60),
    /** When an AI agent should invoke this skill (min 10 chars to ensure usefulness) */
    usageGuidance: z.string().min(10),
    requires: z.array(z.string().min(1)).optional(),
    compatibleWith: z.array(z.string().min(1)).optional(),
    conflictsWith: z.array(z.string().min(1)).optional(),
    /** Searchable tags — kebab-case only */
    tags: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).optional(),
    requiresSetup: z.array(z.string().min(1)).optional(),
    providesSetupFor: z.array(z.string().min(1)).optional(),
    /** 7-char hex SHA of skill content (for change detection) */
    contentHash: z
      .string()
      .regex(/^[a-f0-9]{7}$/)
      .optional(),
    /** ISO date of last update */
    updated: z.string().optional(),
    /** Provenance tracking when skill was forked from another */
    forkedFrom: z
      .object({
        /** Original skill ID */
        skillId: z.string(),
        /** Version of the original at fork time */
        version: z.number().int().min(1).optional(),
        /** Content hash of the original at fork time */
        contentHash: z.string(),
        /** Source URL or identifier */
        source: z.string().optional(),
        /** ISO date of the fork */
        date: z.string(),
      })
      .optional(),
    /** True if this skill was created outside the CLI's built-in vocabulary */
    custom: z.boolean().optional(),
  })
  .strict();

const stackSkillAssignmentSchema = z
  .object({
    id: z.string().min(1),
    /** If true, skill content is embedded in the compiled agent prompt */
    preloaded: z.boolean().optional(),
  })
  .strict();

/** Strict validation for published stack config.yaml (marketplace stacks) */
export const stackConfigValidationSchema = z
  .object({
    /** Unique stack identifier in kebab-case */
    id: z.string().regex(KEBAB_CASE_PATTERN).optional(),
    name: z.string().min(1),
    version: z.string(),
    author: z.string().min(1),
    description: z.string().optional(),
    /** ISO date when this stack was first created */
    created: z.string().optional(),
    /** ISO date of last update */
    updated: z.string().optional(),
    /** Primary framework this stack is designed for (e.g., "nextjs", "remix") */
    framework: z.string().optional(),
    /** All skills used in this stack (flat list, at least one required) */
    skills: z.array(stackSkillAssignmentSchema).min(1),
    /** Agent IDs this stack compiles (at least one required) */
    agents: z.array(z.string().regex(KEBAB_CASE_PATTERN)).min(1),
    /** Per-agent skill assignments: { agentId: { subcategory: [skillAssignment] } } */
    agentSkills: z
      .record(z.string(), z.record(z.string(), z.array(stackSkillAssignmentSchema)))
      .optional(),
    /** High-level philosophy guiding technology choices */
    philosophy: z.string().optional(),
    /** Guiding principles for agents using this stack */
    principles: z.array(z.string().min(1)).optional(),
    tags: z.array(z.string().regex(KEBAB_CASE_PATTERN)).optional(),
    /** Per-skill overrides: alternative suggestions and lock status */
    overrides: z
      .record(
        z.string(),
        z
          .object({
            /** Suggested alternative skill IDs if this one is swapped */
            alternatives: z.array(z.string().min(1)).optional(),
            /** If true, this skill cannot be swapped by the user */
            locked: z.boolean().optional(),
          })
          .strict(),
      )
      .optional(),
    /** Community metrics for sorting/ranking */
    metrics: z
      .object({
        upvotes: z.number().int().min(0).optional(),
        downloads: z.number().int().min(0).optional(),
      })
      .strict()
      .optional(),
    /** Lifecycle hooks triggered by file changes or commands */
    hooks: z
      .record(
        z.string(),
        z.array(
          z.object({
            /** Glob pattern to match file paths (e.g., "*.tsx") */
            matcher: z.string().optional(),
            hooks: z.array(agentHookActionSchema).min(1),
          }),
        ),
      )
      .optional(),
  })
  .strict();

/** Format Zod validation issues into a human-readable string (e.g., "path.to.field: Expected string; other: Required") */
export function formatZodErrors(issues: z.ZodIssue[]): string {
  return issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

/**
 * Validates that a parsed JSON/YAML value does not exceed a maximum nesting depth.
 * Returns true if the structure is within limits, false if it exceeds maxDepth.
 */
export function validateNestingDepth(value: unknown, maxDepth: number): boolean {
  function check(val: unknown, depth: number): boolean {
    if (depth > maxDepth) return false;
    if (Array.isArray(val)) {
      return val.every((item) => check(item, depth + 1));
    }
    if (val !== null && typeof val === "object") {
      return Object.values(val).every((v) => check(v, depth + 1));
    }
    return true;
  }
  return check(value, 0);
}

/**
 * Logs warnings for unknown fields in a parsed object compared to a list of expected keys.
 * Used at security-critical parsing boundaries (marketplace, settings) where `.passthrough()`
 * is kept for forward compatibility but unexpected fields should be surfaced.
 */
export function warnUnknownFields(
  parsed: Record<string, unknown>,
  expectedKeys: readonly string[],
  context: string,
): void {
  const expectedSet = new Set(expectedKeys);
  const unknownKeys = Object.keys(parsed).filter((k) => !expectedSet.has(k));
  if (unknownKeys.length > 0) {
    warn(`Unknown fields in ${context}: ${unknownKeys.join(", ")}`);
  }
}

export type SchemaExtensionOptions = {
  categories?: string[];
  domains?: string[];
  agentNames?: string[];
  skillIds?: string[];
};

/**
 * Extends runtime schema validation to accept custom values discovered from
 * source matrices, agent directories, and skill directories.
 *
 * This populates the customExtensions sets checked by categoryPathSchema,
 * stackAgentConfigSchema, agentYamlConfigSchema, metadataValidationSchema,
 * skillAssignmentSchema, and projectConfigLoaderSchema at parse time.
 *
 * Idempotent: calling multiple times accumulates values (Set deduplicates).
 */
export function extendSchemasWithCustomValues(options: SchemaExtensionOptions): void {
  for (const category of options.categories ?? []) {
    customExtensions.categories.add(category);
  }
  for (const domain of options.domains ?? []) {
    customExtensions.domains.add(domain);
  }
  for (const agentName of options.agentNames ?? []) {
    customExtensions.agentNames.add(agentName);
  }
  for (const skillId of options.skillIds ?? []) {
    customExtensions.skillIds.add(skillId);
  }
}

/**
 * Clears all custom schema extensions. Used in tests to reset state between runs.
 */
export function resetSchemaExtensions(): void {
  customExtensions.categories.clear();
  customExtensions.domains.clear();
  customExtensions.agentNames.clear();
  customExtensions.skillIds.clear();
}
