import path from "path";
import { fileURLToPath } from "url";
import { mkdir, writeFile, readFile } from "fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { run, Errors } from "@oclif/core";
import ansis from "ansis";
import { createJiti } from "jiti";
import {
  CLAUDE_SRC_DIR,
  DEFAULT_BRANDING,
  DEFAULT_PLUGIN_NAME,
  STANDARD_FILES,
} from "../../consts";
import { typedEntries } from "../../utils/typed-object";
import { computeSkillFolderHash } from "../versioning";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CLI_ROOT = path.resolve(__dirname, "../../../..");

/** Resolve @agents-inc/cli/config to the source config-exports.ts so jiti can load it in dev. */
const CONFIG_EXPORTS_PATH = path.resolve(__dirname, "../../config-exports.ts");

export const OUTPUT_STRINGS = {
  CONFIG_HEADER: `${DEFAULT_BRANDING.NAME} Configuration`,
  CONFIG_PATHS_HEADER: "Configuration File Paths",
  CONFIG_LAYERS_HEADER: "Configuration Layers:",
  CONFIG_PRECEDENCE: "Precedence: flag > env > project > global > default",
  SOURCE_LABEL: "Source:",
  MARKETPLACE_LABEL: "Marketplace:",
  AGENTS_SOURCE_LABEL: "Agents Source:",
  GLOBAL_LABEL: "Global:",
  PROJECT_LABEL: "Project:",

  // Setup/Init outputs
  INIT_HEADER: `${DEFAULT_BRANDING.NAME} Setup`,
  INIT_SUCCESS: `${DEFAULT_BRANDING.NAME} initialized successfully!`,
  LOADING_MATRIX: "Loading skills matrix...",
  LOADING_SKILLS: "Loading skills...",
  LOADING_AGENTS: "Loading agent partials...",

  // Plugin/installation outputs
  NO_PLUGIN_FOUND: "No plugin found",
  NO_INSTALLATION_FOUND: "No installation found",
  NO_PLUGIN_INSTALLATION: "No plugin installation found",
  NOT_INSTALLED: `${DEFAULT_BRANDING.NAME} is not installed`,
  UNINSTALL_HEADER: `${DEFAULT_BRANDING.NAME} Uninstall`,
  UNINSTALL_COMPLETE: `${DEFAULT_BRANDING.NAME} has been uninstalled`,
  EJECT_HEADER: `${DEFAULT_BRANDING.NAME} Eject`,

  // Doctor command outputs
  DOCTOR_HEADER: `${DEFAULT_BRANDING.NAME} Doctor`,

  // Error message patterns (lowercase for case-insensitive matching)
  ERROR_MISSING_ARG: "missing required arg",
  ERROR_UNEXPECTED_ARG: "unexpected argument",
  ERROR_UNKNOWN_FLAG: "unknown flag",
  ERROR_PARSE: "parse",
} as const;

/**
 * Run a CLI command and capture its output.
 *
 * Bun's `console.log` does not go through `process.stdout.write`, so
 * `@oclif/test`'s `runCommand` (which only intercepts `process.stdout.write`)
 * returns empty stdout/stderr in bun. This helper intercepts both layers
 * to work correctly in both Node.js and bun environments.
 */
export async function runCliCommand(args: string[]) {
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  const stdoutBuf: string[] = [];
  const stderrBuf: string[] = [];

  // Intercept process.stdout/stderr.write (Node.js path)
  process.stdout.write = function (str: unknown, encoding?: unknown, cb?: unknown): boolean {
    stdoutBuf.push(String(str));
    if (typeof encoding === "function") {
      (encoding as () => void)();
    } else if (typeof cb === "function") {
      (cb as () => void)();
    }
    return true;
  } as typeof process.stdout.write;

  process.stderr.write = function (str: unknown, encoding?: unknown, cb?: unknown): boolean {
    stderrBuf.push(String(str));
    if (typeof encoding === "function") {
      (encoding as () => void)();
    } else if (typeof cb === "function") {
      (cb as () => void)();
    }
    return true;
  } as typeof process.stderr.write;

  // Intercept console methods (bun path — console.log bypasses process.stdout.write)
  console.log = (...logArgs: unknown[]) => {
    stdoutBuf.push(logArgs.map(String).join(" ") + "\n");
  };
  console.warn = (...warnArgs: unknown[]) => {
    stderrBuf.push(warnArgs.map(String).join(" ") + "\n");
  };
  console.error = (...errArgs: unknown[]) => {
    stderrBuf.push(errArgs.map(String).join(" ") + "\n");
  };

  let error: (Error & Partial<Errors.CLIError>) | undefined;
  try {
    await run(args, { root: CLI_ROOT });
  } catch (e) {
    if (e instanceof Error) {
      error = Object.assign(e, { message: ansis.strip(e.message) }) as Error &
        Partial<Errors.CLIError>;
    }
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }

  return {
    stdout: stdoutBuf.map((s) => ansis.strip(s)).join(""),
    stderr: stderrBuf.map((s) => ansis.strip(s)).join(""),
    error,
  };
}
import type {
  AgentConfig,
  AgentDefinition,
  AgentName,
  AgentScopeConfig,
  CategoryDefinition,
  CategoryPath,
  CompiledAgentData,
  CompileAgentConfig,
  CompileConfig,
  CompileContext,
  Domain,
  DomainSelections,
  ExtractedSkillMetadata,
  Marketplace,
  MarketplacePlugin,
  MergedSkillsMatrix,
  ProjectConfig,
  ResolvedSkill,
  ResolvedStack,
  Skill,
  SkillAssignment,
  SkillConfig,
  SkillDefinition,
  SkillSlug,
  SkillSlugMap,
  SkillId,
  SkillSource,
  SkillSourceType,
  RelationshipDefinitions,
  RawStacksConfig,
  Stack,
  StackAgentConfig,
  Category,
} from "../../types";
import type { CompiledStackPlugin } from "../stacks/stack-plugin-compiler";
import type { WizardResultV2 } from "../../components/wizard/wizard";
import type { SourceLoadResult } from "../loading/source-loader";
import type { ResolvedConfig } from "../configuration/config";
import { useWizardStore } from "../../stores/wizard-store";
import { resolveAlias, validateSelection } from "../matrix";
import type { TestProjectConfig, TestSkill } from "./fixtures/create-test-source";
import { getTestSkill, TEST_SKILLS, TEST_CATEGORIES } from "./test-fixtures";

export { fileExists, directoryExists } from "./test-fs-utils";

export async function readTestYaml<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  // Boundary cast: YAML parse returns `unknown`, caller provides expected type
  return parseYaml(content) as T;
}

/**
 * Load a config file using jiti. Handles defineConfig(), satisfies, and plain exports.
 */
export async function readTestTsConfig<T>(filePath: string): Promise<T> {
  const jiti = createJiti(import.meta.url, {
    moduleCache: false,
    interopDefault: true,
    alias: { "@agents-inc/cli/config": CONFIG_EXPORTS_PATH },
  });
  // Boundary cast: jiti returns unknown, caller provides expected type
  const result = await jiti.import(filePath, { default: true });
  return result as T;
}

/** Writes a config file with the given object into the given subdirectory (defaults to CLAUDE_SRC_DIR) */
export async function writeTestTsConfig(
  projectDir: string,
  config: Record<string, unknown>,
  configSubdir: string = CLAUDE_SRC_DIR,
): Promise<void> {
  const configDir = path.join(projectDir, configSubdir);
  await mkdir(configDir, { recursive: true });
  const content = `export default ${JSON.stringify(config, null, 2)};`;
  await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_TS), content);
}

export function buildProjectConfig(overrides?: Partial<ProjectConfig>): ProjectConfig {
  return {
    name: "test-project",
    agents: [{ name: "web-developer", scope: "project" }],
    skills: buildSkillConfigs(["web-framework-react"]),
    ...overrides,
  };
}

export function buildWizardResult(
  skills: SkillConfig[],
  overrides?: Partial<WizardResultV2>,
): WizardResultV2 {
  return {
    skills,
    selectedAgents: [],
    agentConfigs: [],
    selectedStackId: null,
    domainSelections: {} as DomainSelections,
    selectedDomains: [],
    cancelled: false,
    validation: { valid: true, errors: [], warnings: [] },
    ...overrides,
  };
}

/** Build a SkillConfig array from skill IDs with default scope and source */
export function buildSkillConfigs(
  skillIds: SkillId[],
  overrides?: Partial<Omit<SkillConfig, "id">>,
): SkillConfig[] {
  return skillIds.map((id) => ({
    id,
    scope: overrides?.scope ?? "project",
    source: overrides?.source ?? "local",
  }));
}

export function buildAgentConfigs(
  agentNames: AgentName[],
  overrides?: Partial<Omit<AgentScopeConfig, "name">>,
): AgentScopeConfig[] {
  return agentNames.map((name) => ({
    name,
    scope: overrides?.scope ?? "project",
  }));
}

export function buildSourceResult(
  matrix: MergedSkillsMatrix,
  sourcePath: string,
  overrides?: Partial<SourceLoadResult>,
): SourceLoadResult {
  const sourceConfig: ResolvedConfig = {
    source: sourcePath,
    sourceOrigin: "flag",
  };
  return {
    matrix,
    sourceConfig,
    sourcePath,
    isLocal: true,
    ...overrides,
  };
}

/**
 * Lightweight frontmatter parser for test assertions.
 * Returns raw key-value pairs (unlike the production parseFrontmatter which
 * returns typed SkillFrontmatter with Zod validation).
 */
export function parseTestFrontmatter(content: string): Record<string, unknown> | null {
  if (!content.startsWith("---")) {
    return null;
  }

  const endIndex = content.indexOf("---", 3);
  if (endIndex === -1) {
    return null;
  }

  const yamlContent = content.slice(3, endIndex).trim();
  try {
    // Boundary cast: YAML parse returns `unknown`
    return parseYaml(yamlContent) as Record<string, unknown>;
  } catch {
    return null;
  }
}

import { createTempDir, cleanupTempDir } from "./test-fs-utils";
export { createTempDir, cleanupTempDir };

export interface PluginTestDirs {
  tempDir: string;
  projectDir: string;
  pluginDir: string;
  skillsDir: string;
  agentsDir: string;
}

export async function createTestDirs(prefix = "ai-test-"): Promise<PluginTestDirs> {
  const tempDir = await createTempDir(prefix);
  const projectDir = path.join(tempDir, "project");
  const pluginDir = path.join(projectDir, ".claude", "plugins", DEFAULT_PLUGIN_NAME);
  const skillsDir = path.join(pluginDir, "skills");
  const agentsDir = path.join(pluginDir, "agents");

  await mkdir(skillsDir, { recursive: true });
  await mkdir(agentsDir, { recursive: true });

  return { tempDir, projectDir, pluginDir, skillsDir, agentsDir };
}

export async function cleanupTestDirs(dirs: PluginTestDirs): Promise<void> {
  await cleanupTempDir(dirs.tempDir);
}

export function createMockSkill(
  id: SkillId,
  category: CategoryPath,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  // Derive slug from skill ID: strip domain-category prefix to get the last segment(s)
  // e.g., "web-framework-react" -> "react", "meta-methodology-anti-over-engineering" -> "anti-over-engineering"
  const segments = id.split("-");
  const defaultSlug = (segments.length >= 3 ? segments.slice(2).join("-") : id) as SkillSlug;

  // Derive display name from slug: title-case each segment
  const defaultDisplayName = defaultSlug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    id,
    slug: defaultSlug,
    displayName: defaultDisplayName,
    description: `${id} skill`,
    category,
    tags: [],
    author: "@test",
    conflictsWith: [],
    isRecommended: false,
    requires: [],
    alternatives: [],
    discourages: [],
    compatibleWith: [],
    requiresSetup: [],
    providesSetupFor: [],
    path: `skills/${category}/${id}/`,
    ...overrides,
  };
}

export function createMockSkillSource(
  type: SkillSourceType,
  overrides?: Partial<SkillSource>,
): SkillSource {
  const defaults: Record<SkillSourceType, SkillSource> = {
    public: { name: "public", type: "public", installed: false },
    private: {
      name: "private-source",
      type: "private",
      url: "github:org/skills",
      installed: false,
    },
    local: { name: "local", type: "local", installed: true, installMode: "local" },
  };
  return { ...defaults[type], ...overrides };
}

/**
 * Creates a mock ExtractedSkillMetadata for testing.
 * Used when mocking extractAllSkills() return values.
 */
export function createMockExtractedSkill(
  id: SkillId,
  overrides?: Partial<ExtractedSkillMetadata>,
): ExtractedSkillMetadata {
  // Derive directory path and category from the skill ID convention: "domain-category-name"
  const segments = id.split("-");
  const domain = segments[0] ?? "web";
  const category = segments[1] ?? "framework";
  const name = segments.slice(2).join("-") || "skill";
  const directoryPath = `${domain}/${category}/${name}`;

  return {
    id,
    directoryPath,
    description: `${id} skill`,
    category: `${domain}-${category}` as CategoryPath,
    author: "@test",
    tags: [],
    path: `skills/${directoryPath}/`,
    domain: domain as Domain,
    displayName: name,
    slug: name as SkillSlug,
    ...overrides,
  };
}

export function createMockMatrix(
  skills: Record<string, ResolvedSkill>,
  overrides?: Partial<MergedSkillsMatrix>,
): MergedSkillsMatrix {
  // Boundary cast: empty objects are populated in the loop below
  const autoSlugToId = {} as Record<SkillSlug, SkillId>;
  const autoIdToSlug = {} as Record<SkillId, SkillSlug>;
  for (const [id, skill] of typedEntries(skills)) {
    if (skill.slug) {
      autoSlugToId[skill.slug] = id as SkillId;
      autoIdToSlug[id as SkillId] = skill.slug;
    }
  }

  return {
    version: "1.0.0",
    categories: {} as Record<Category, import("../../types").CategoryDefinition>,
    skills,
    suggestedStacks: [],
    slugMap: { slugToId: autoSlugToId, idToSlug: autoIdToSlug },
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockAgent(
  name: string,
  overrides?: Partial<AgentDefinition>,
): AgentDefinition {
  return {
    title: name,
    description: `${name} agent`,
    tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
    model: "opus",
    permissionMode: "default",
    ...overrides,
  };
}

export function createMockAgentConfig(
  name: string,
  skills: Skill[] = [],
  overrides?: Partial<AgentConfig>,
): AgentConfig {
  return {
    name,
    title: `${name} agent`,
    description: `Test ${name}`,
    tools: ["Read", "Write"],
    skills,
    path: name,
    ...overrides,
  };
}

export function createMockSkillEntry(
  id: SkillId,
  preloaded = false,
  overrides?: Partial<Skill>,
): Skill {
  return {
    id,
    path: `skills/${id}/`,
    description: `${id} skill`,
    usage: `when working with ${id}`,
    preloaded,
    ...overrides,
  };
}

export function createCompileContext(overrides?: Partial<CompileContext>): CompileContext {
  return {
    stackId: "test-stack",
    verbose: false,
    projectRoot: "/project",
    outputDir: `/project/.claude/plugins/${DEFAULT_PLUGIN_NAME}`,
    ...overrides,
  };
}

export function createSkillContent(name: string, description = "A test skill"): string {
  return `---
name: ${name}
description: ${description}
category: test
---

# ${name}

This is a test skill.
`;
}

export function createAgentYamlContent(name: string, description = `Test ${name} agent`): string {
  return `id: ${name}
title: ${name} Agent
description: ${description}
tools:
  - Read
  - Write`;
}

export async function writeTestSkill(
  skillsDir: string,
  skillId: SkillId,
  options: {
    slug: SkillSlug;
    category: CategoryPath;
    author?: string;
    description?: string;
    /** Extra fields to merge into metadata.yaml (e.g., forkedFrom, displayName) */
    extraMetadata?: Record<string, unknown>;
    /** Skip metadata.yaml creation entirely */
    skipMetadata?: boolean;
    /** Custom SKILL.md content (overrides default generated content) */
    skillContent?: string;
  },
): Promise<string> {
  const skillDir = path.join(skillsDir, skillId);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    options.skillContent ?? createSkillContent(skillId, options.description),
  );

  if (!options.skipMetadata) {
    const contentHash = await computeSkillFolderHash(skillDir);
    const domain = options.category.split("-")[0] ?? "web";
    const baseMetadata = {
      author: options.author ?? "@test",
      category: options.category,
      domain,
      slug: options.slug,
      contentHash,
    };
    if (options.extraMetadata) {
      const metadata = {
        ...baseMetadata,
        ...options.extraMetadata,
      };
      await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), stringifyYaml(metadata));
    } else {
      await writeFile(
        path.join(skillDir, STANDARD_FILES.METADATA_YAML),
        stringifyYaml(baseMetadata),
      );
    }
  }

  return skillDir;
}

/**
 * Creates a source-level skill directory with SKILL.md and rich metadata.yaml.
 * Use this when testing `extractAllSkills()` and `mergeMatrixWithSkills()`.
 *
 * Unlike `writeTestSkill()` which creates installed skills, this writes skills
 * in the source directory layout (under `src/skills/<domain>/<category>/<name>/`).
 */
export async function writeSourceSkill(
  skillsDir: string,
  directoryPath: string,
  config: TestSkill,
): Promise<string> {
  const skillDir = path.join(skillsDir, directoryPath);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    createSkillContent(config.id, config.description),
  );

  const domain = config.domain;
  const slug = config.slug;
  const metadata: Record<string, unknown> = {
    displayName: config.id,
    slug,
    category: config.category,
    domain,
    author: config.author ?? "@test",
  };
  if (config.tags) {
    metadata.tags = config.tags;
  }

  await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), stringifyYaml(metadata));

  return skillDir;
}

export async function writeTestAgent(
  agentsDir: string,
  agentName: string,
  options?: { description?: string },
): Promise<string> {
  const agentDir = path.join(agentsDir, agentName);
  await mkdir(agentDir, { recursive: true });

  await writeFile(
    path.join(agentDir, STANDARD_FILES.AGENT_METADATA_YAML),
    createAgentYamlContent(agentName, options?.description),
  );

  return agentDir;
}

export function createMockCategory(
  id: Category,
  displayName: string,
  overrides?: Partial<CategoryDefinition>,
): CategoryDefinition {
  return {
    id,
    displayName,
    description: `${displayName} category`,
    domain: "web",
    exclusive: true,
    required: false,
    order: 0,
    ...overrides,
  };
}

export function createMockResolvedStack(
  id: string,
  name: string,
  overrides?: Partial<ResolvedStack>,
): ResolvedStack {
  return {
    id,
    name,
    description: `${name} stack`,
    skills: {},
    allSkillIds: [],
    philosophy: "",
    ...overrides,
  };
}

/**
 * Builds a comprehensive test matrix with 13 skills across 7 categories,
 * 2 suggested stacks, display name mappings, and relationship data
 * (conflicts, recommends). Includes all 6 DEFAULT_PRESELECTED_SKILLS
 * (methodology) so wizard handleComplete can resolve them.
 * @returns A fully populated MergedSkillsMatrix with realistic test data
 */
export function createComprehensiveMatrix(
  overrides?: Partial<MergedSkillsMatrix>,
): MergedSkillsMatrix {
  // Skill categories use domain-prefixed Category IDs (matching production
  // metadata.yaml and the categories map keys, e.g., "web-framework", "api-api").
  const skills = {
    "web-framework-react": getTestSkill("react", { category: "web-framework" }),
    "web-framework-vue": getTestSkill("vue", {
      category: "web-framework",
      conflictsWith: [{ skillId: "web-framework-react", reason: "Choose one framework" }],
    }),
    "web-state-zustand": getTestSkill("zustand", {
      category: "web-client-state",
    }),
    "web-styling-scss-modules": getTestSkill("scss-modules", { category: "web-styling" }),
    "api-framework-hono": getTestSkill("hono", { category: "api-api" }),
    "api-database-drizzle": getTestSkill("drizzle", { category: "api-database" }),
    "web-testing-vitest": getTestSkill("vitest", { category: "web-testing" }),
    // Methodology skills (DEFAULT_PRESELECTED_SKILLS) — auto-injected by wizard
    "meta-methodology-investigation-requirements": TEST_SKILLS["investigation-requirements"],
    "meta-methodology-anti-over-engineering": TEST_SKILLS["anti-over-engineering"],
    "meta-methodology-success-criteria": TEST_SKILLS["success-criteria"],
    "meta-methodology-write-verification": TEST_SKILLS["write-verification"],
    "meta-methodology-improvement-protocol": TEST_SKILLS["improvement-protocol"],
    "meta-methodology-context-management": TEST_SKILLS["context-management"],
  };

  const categories = {
    "web-framework": {
      ...TEST_CATEGORIES.framework,
      domain: "web",
      exclusive: true,
      required: true,
    },
    "web-client-state": { ...TEST_CATEGORIES.clientState, domain: "web", order: 1 },
    "web-styling": { ...TEST_CATEGORIES.styling, domain: "web", order: 2 },
    "api-api": { ...TEST_CATEGORIES.api, domain: "api", exclusive: true, required: true },
    "api-database": { ...TEST_CATEGORIES.database, domain: "api", order: 1 },
    "web-testing": {
      ...TEST_CATEGORIES.testing,
      domain: "shared",
      exclusive: false,
      order: 10,
    },
    "shared-methodology": {
      ...TEST_CATEGORIES.methodology,
      domain: "shared",
      exclusive: false,
      required: false,
      order: 11,
    },
  } as Record<Category, CategoryDefinition>;

  const suggestedStacks: ResolvedStack[] = [
    createMockResolvedStack("nextjs-fullstack", "Next.js Fullstack", {
      description: "Complete Next.js stack with React and Hono",
      skills: {
        "web-developer": {
          "web-framework": ["web-framework-react"],
          "web-client-state": ["web-state-zustand"],
          "web-styling": ["web-styling-scss-modules"],
        },
        "api-developer": {
          "api-api": ["api-framework-hono"],
          "api-database": ["api-database-drizzle"],
        },
      } as ResolvedStack["skills"],
      allSkillIds: [
        "web-framework-react",
        "web-state-zustand",
        "web-styling-scss-modules",
        "api-framework-hono",
        "api-database-drizzle",
      ],
      philosophy: "Modern, type-safe fullstack development",
    }),
    createMockResolvedStack("vue-stack", "Vue Stack", {
      description: "Vue.js frontend stack",
      skills: {
        "web-developer": {
          "web-framework": ["web-framework-vue"],
        },
      } as ResolvedStack["skills"],
      allSkillIds: ["web-framework-vue"],
      philosophy: "Progressive framework approach",
    }),
  ];

  // Boundary cast: test matrix only contains a subset of all possible slugs
  const slugToId = {
    react: "web-framework-react",
    vue: "web-framework-vue",
    zustand: "web-state-zustand",
    "scss-modules": "web-styling-scss-modules",
    hono: "api-framework-hono",
    drizzle: "api-database-drizzle",
    vitest: "web-testing-vitest",
    "investigation-requirements": "meta-methodology-investigation-requirements",
    "anti-over-engineering": "meta-methodology-anti-over-engineering",
    "success-criteria": "meta-methodology-success-criteria",
    "write-verification": "meta-methodology-write-verification",
    "improvement-protocol": "meta-methodology-improvement-protocol",
    "context-management": "meta-methodology-context-management",
  } as unknown as Record<SkillSlug, SkillId>;

  // Boundary cast: Object.fromEntries returns { [k: string]: string }
  const idToSlug = Object.fromEntries(
    typedEntries(slugToId).map(([slug, fullId]) => [fullId, slug]),
  ) as SkillSlugMap["idToSlug"];

  return createMockMatrix(skills, {
    categories,
    suggestedStacks,
    slugMap: { slugToId, idToSlug },
    ...overrides,
  });
}

/**
 * Builds a lightweight test matrix with 4 skills, 4 categories, and 2 stacks.
 * Use instead of createComprehensiveMatrix when relationship data is not needed.
 * @returns A minimal MergedSkillsMatrix for basic integration tests
 */
export function createBasicMatrix(overrides?: Partial<MergedSkillsMatrix>): MergedSkillsMatrix {
  // Domain-prefixed Category IDs — see createComprehensiveMatrix comment
  const skills = {
    "web-framework-react": getTestSkill("react", { category: "web-framework" }),
    "web-state-zustand": getTestSkill("zustand", { category: "web-client-state" }),
    "api-framework-hono": getTestSkill("hono", { category: "api-api" }),
    "web-testing-vitest": getTestSkill("vitest", { category: "web-testing" }),
    // Methodology skills (DEFAULT_PRESELECTED_SKILLS) — auto-injected by wizard
    "meta-methodology-anti-over-engineering": TEST_SKILLS["anti-over-engineering"],
    "meta-methodology-context-management": TEST_SKILLS["context-management"],
    "meta-methodology-improvement-protocol": TEST_SKILLS["improvement-protocol"],
    "meta-methodology-investigation-requirements": TEST_SKILLS["investigation-requirements"],
    "meta-methodology-success-criteria": TEST_SKILLS["success-criteria"],
    "meta-methodology-write-verification": TEST_SKILLS["write-verification"],
  };

  const suggestedStacks: ResolvedStack[] = [
    createMockResolvedStack("react-fullstack", "React Fullstack", {
      allSkillIds: ["web-framework-react", "web-state-zustand", "api-framework-hono"],
    }),
    createMockResolvedStack("testing-stack", "Testing Stack", {
      allSkillIds: ["web-testing-vitest"],
    }),
  ];

  return createMockMatrix(skills, {
    suggestedStacks,
    categories: {
      "web-framework": {
        ...TEST_CATEGORIES.framework,
        domain: "web",
        exclusive: true,
        required: true,
      },
      "web-client-state": { ...TEST_CATEGORIES.clientState, domain: "web", order: 1 },
      "api-api": {
        ...TEST_CATEGORIES.api,
        domain: "api",
        exclusive: true,
        required: true,
      },
      "web-testing": {
        ...TEST_CATEGORIES.testing,
        displayName: "Testing Framework",
        domain: "shared",
        exclusive: false,
      },
      "shared-methodology": {
        ...TEST_CATEGORIES.methodology,
        domain: "shared",
        exclusive: false,
        required: false,
      },
    } as Record<Category, CategoryDefinition>,
    ...overrides,
  });
}

/**
 * Replicates `handleComplete` from wizard.tsx for the "customize" path.
 *
 * Given the wizard store state (after simulated user selections), this
 * builds the same WizardResultV2 that the real wizard produces:
 * 1. Collects all selected technologies from domainSelections
 * 2. Resolves aliases to canonical skill IDs
 * 3. Adds methodology skills (DEFAULT_PRESELECTED_SKILLS)
 * 4. Runs validation
 */
export function buildWizardResultFromStore(
  matrix: MergedSkillsMatrix,
  overrides?: Partial<WizardResultV2>,
): WizardResultV2 {
  const store = useWizardStore.getState();

  let allSkills: SkillId[];

  if (store.selectedStackId && store.stackAction === "defaults") {
    const stack = matrix.suggestedStacks.find((s) => s.id === store.selectedStackId);
    allSkills = [...(stack?.allSkillIds || [])];
  } else {
    const techNames = store.getAllSelectedTechnologies();
    allSkills = techNames.map((tech) => resolveAlias(tech, matrix));
  }

  const methodologySkills = store.getDefaultMethodologySkills();
  allSkills = [...allSkills, ...methodologySkills.filter((s) => !allSkills.includes(s))];

  const validation = validateSelection(allSkills, matrix);

  return {
    skills: store.skillConfigs.length > 0 ? store.skillConfigs : buildSkillConfigs(allSkills),
    selectedAgents: store.selectedAgents,
    agentConfigs: store.agentConfigs,
    selectedStackId: store.selectedStackId,
    domainSelections: store.domainSelections,
    selectedDomains: store.selectedDomains,
    cancelled: false,
    validation,
    ...overrides,
  };
}

/**
 * Simulates a user selecting specific skills via the wizard store.
 *
 * Sets up domainSelections as if the user toggled each skill in the build step,
 * using the matrix to look up the correct domain and category per skill.
 */
export function simulateSkillSelections(
  skillIds: SkillId[],
  matrix: MergedSkillsMatrix,
  selectedDomains: string[],
): void {
  const domainSelections = skillIds.reduce<DomainSelections>((acc, skillId) => {
    const skill = matrix.skills[skillId];
    if (!skill) return acc;
    // Boundary cast: skill.category is a Category at runtime
    const category = skill.category as Category;
    const domain = matrix.categories[category]?.domain;
    if (!domain) return acc;
    const domainObj = acc[domain] ?? {};
    const subcatList = domainObj[category] ?? [];
    if (subcatList.includes(skillId)) return acc;
    return {
      ...acc,
      [domain]: { ...domainObj, [category]: [...subcatList, skillId] },
    };
  }, {});

  useWizardStore.setState({
    domainSelections,
    selectedDomains: selectedDomains as Domain[],
    approach: "scratch",
    step: "confirm",
  });
}

/**
 * Extracts skill IDs from a stack assignment value, which may be:
 * - A bare string (e.g., "web-framework-react")
 * - An object with .id (e.g., { id: "web-framework-react", preloaded: true })
 * - An array of strings or objects
 */
export function extractSkillIdsFromAssignment(assignment: unknown): string[] {
  if (typeof assignment === "string") {
    return [assignment];
  }
  if (Array.isArray(assignment)) {
    return assignment.flatMap((item) => extractSkillIdsFromAssignment(item));
  }
  if (typeof assignment === "object" && assignment !== null && "id" in assignment) {
    return [String((assignment as { id: string }).id)];
  }
  return [];
}

export function buildTestProjectConfig(
  agents: string[],
  skills: Array<string | { id: string }>,
  overrides?: Partial<TestProjectConfig>,
): TestProjectConfig {
  return {
    name: "test-project",
    description: "Test project",
    agents,
    skills,
    ...overrides,
  };
}

export function createMockSkillDefinition(
  id: SkillId,
  overrides?: Partial<SkillDefinition>,
): SkillDefinition {
  return {
    id,
    path: `skills/${id}/`,
    description: `${id} skill`,
    ...overrides,
  };
}

/** Decomposed matrix config returned by createMockMatrixConfig (replaces SkillsMatrixConfig) */
export type MockMatrixConfig = {
  categories: Record<string, CategoryDefinition>;
  relationships: RelationshipDefinitions;
  aliases: Partial<Record<SkillSlug, SkillId>>;
};

export function createMockMatrixConfig(
  categories: Record<string, CategoryDefinition>,
  overrides?: {
    relationships?: RelationshipDefinitions;
    skillAliases?: Partial<Record<SkillSlug, SkillId>>;
  },
): MockMatrixConfig {
  return {
    categories,
    relationships: overrides?.relationships ?? {
      conflicts: [],
      discourages: [],
      recommends: [],
      requires: [],
      alternatives: [],
    },
    aliases: overrides?.skillAliases ?? {},
  };
}

export function createMockStack(
  id: string,
  config: {
    name: string;
    description?: string;
    agents: Record<string, StackAgentConfig>;
    philosophy?: string;
  },
): Stack {
  return {
    id,
    name: config.name,
    description: config.description ?? "",
    // Boundary cast: test callers may pass arbitrary agent names (e.g., "nonexistent-agent")
    agents: config.agents as Stack["agents"],
    philosophy: config.philosophy,
  };
}

export function createMockCompileConfig(
  agents: Record<string, CompileAgentConfig>,
  overrides?: Partial<CompileConfig>,
): CompileConfig {
  return {
    name: "Test Plugin",
    description: "Test description",
    agents,
    ...overrides,
  };
}

export function createMockCompiledStackPlugin(
  overrides?: Partial<CompiledStackPlugin>,
): CompiledStackPlugin {
  return {
    pluginPath: "/tmp/cc-stack-123456/test-stack",
    manifest: { name: "test-stack", version: "1.0.0" },
    stackName: "Test Stack",
    agents: ["web-developer"],
    skillPlugins: ["web-framework-react"],
    hasHooks: false,
    ...overrides,
  };
}

export function createMockSkillAssignment(id: SkillId, preloaded = false): SkillAssignment {
  return { id, preloaded };
}

export function createMockRawStacksConfig(): RawStacksConfig {
  return {
    stacks: [
      {
        id: "nextjs-fullstack",
        name: "Next.js Fullstack",
        description: "Full-stack Next.js with Hono API",
        agents: {
          "web-developer": {
            "web-framework": "web-framework-react",
            "web-styling": "web-styling-scss-modules",
          },
          "api-developer": {
            "api-api": "api-framework-hono",
            "api-database": "api-database-drizzle",
          },
        },
      },
      {
        id: "vue-spa",
        name: "Vue SPA",
        description: "Vue single-page application",
        agents: {
          "web-developer": {
            "web-framework": "web-framework-vue-composition-api",
            "web-styling": "web-styling-tailwind",
          },
        },
      },
    ],
  };
}

export function createMockRawStacksConfigWithArrays(): RawStacksConfig {
  return {
    stacks: [
      {
        id: "multi-select-stack",
        name: "Multi-Select Stack",
        description: "Stack with array-valued categories",
        agents: {
          "web-developer": {
            "web-framework": "web-framework-react",
            "shared-methodology": [
              "meta-methodology-investigation-requirements",
              "meta-methodology-anti-over-engineering",
              "meta-methodology-success-criteria",
            ],
          },
          "pattern-scout": {
            "shared-methodology": [
              "meta-methodology-investigation-requirements",
              "meta-methodology-anti-over-engineering",
            ],
            "shared-research": "meta-research-research-methodology",
          },
        },
      },
    ],
  };
}

export function createMockRawStacksConfigWithObjects(): RawStacksConfig {
  return {
    stacks: [
      {
        id: "object-stack",
        name: "Object Stack",
        description: "Stack with object-form skill assignments",
        agents: {
          "web-developer": {
            "web-framework": [{ id: "web-framework-react", preloaded: true }],
            "web-styling": "web-styling-scss-modules",
            "shared-methodology": [
              { id: "meta-methodology-investigation-requirements", preloaded: true },
              "meta-methodology-anti-over-engineering",
            ],
          },
        },
      },
    ],
  };
}

export function createMockMarketplace(plugins: MarketplacePlugin[] = []): Marketplace {
  return {
    name: "test-marketplace",
    version: "1.0.0",
    owner: { name: "Test Owner" },
    plugins,
  };
}

export function createMockMarketplacePlugin(
  name: string,
  source: MarketplacePlugin["source"] = "local",
): MarketplacePlugin {
  return {
    name,
    source,
  };
}

/**
 * Creates a ResolvedSkill with availableSources annotation for multi-source testing.
 * Simulates what multi-source-loader.ts does after tagging.
 */
export function createMockMultiSourceSkill(
  id: SkillId,
  category: CategoryPath,
  sources: SkillSource[],
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  const activeSource = sources.find((s) => s.installed) ?? sources[0];
  return createMockSkill(id, category, {
    availableSources: sources,
    activeSource,
    ...overrides,
  });
}

export function createMockCompiledAgentData(overrides?: Partial<AgentConfig>): CompiledAgentData {
  const agent = createMockAgentConfig("test-agent", [], {
    title: "Test Agent",
    description: "A test agent",
    ...overrides,
  });

  return {
    agent,
    intro: "Test intro",
    workflow: "Test workflow",
    examples: "Test examples",
    criticalRequirementsTop: "",
    criticalReminders: "",
    outputFormat: "",
    skills: agent.skills,
    preloadedSkills: [],
    dynamicSkills: [],
    preloadedSkillIds: [],
  };
}

export { getTestSkill, TEST_SKILLS, TEST_CATEGORIES, TEST_MATRICES } from "./test-fixtures";
export type { TestSkillName } from "./test-fixtures";
