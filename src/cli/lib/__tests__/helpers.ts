import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { run, Errors } from "@oclif/core";
import ansis from "ansis";
import { DEFAULT_BRANDING, DEFAULT_PLUGIN_NAME, STANDARD_FILES } from "../../consts";
import { typedEntries } from "../../utils/typed-object";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CLI_ROOT = path.resolve(__dirname, "../../../..");

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
  CategoryDefinition,
  CategoryPath,
  CompileContext,
  Domain,
  DomainSelections,
  ExtractedSkillMetadata,
  MergedSkillsMatrix,
  ResolvedSkill,
  ResolvedStack,
  Skill,
  SkillDisplayName,
  SkillId,
  Subcategory,
} from "../../types";
import type { WizardResultV2 } from "../../components/wizard/wizard";
import type { SourceLoadResult } from "../loading/source-loader";
import type { ResolvedConfig } from "../configuration/config";
import { getTestSkill } from "./test-fixtures";

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function readTestYaml<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  // Boundary cast: YAML parse returns `unknown`, caller provides expected type
  return parseYaml(content) as T;
}

export function buildWizardResult(
  selectedSkills: SkillId[],
  overrides?: Partial<WizardResultV2>,
): WizardResultV2 {
  return {
    selectedSkills,
    selectedAgents: [],
    selectedStackId: null,
    domainSelections: {} as DomainSelections,
    sourceSelections: {},
    expertMode: false,
    installMode: "local",
    cancelled: false,
    validation: { valid: true, errors: [], warnings: [] },
    ...overrides,
  };
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

export async function createTempDir(prefix = "cc-test-"): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

const CLEANUP_MAX_RETRIES = 3;
const CLEANUP_RETRY_DELAY_MS = 100;

export async function cleanupTempDir(dirPath: string): Promise<void> {
  for (let attempt = 0; attempt < CLEANUP_MAX_RETRIES; attempt++) {
    try {
      await rm(dirPath, { recursive: true, force: true });
      return;
    } catch (error: unknown) {
      const isRetryable =
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOTEMPTY";
      if (!isRetryable || attempt === CLEANUP_MAX_RETRIES - 1) {
        throw error;
      }
      // Transient ENOTEMPTY on macOS: kernel hasn't released directory entries yet
      await new Promise((resolve) => setTimeout(resolve, CLEANUP_RETRY_DELAY_MS));
    }
  }
}

export interface TestDirs {
  tempDir: string;
  projectDir: string;
  pluginDir: string;
  skillsDir: string;
  agentsDir: string;
}

export async function createTestDirs(prefix = "cc-test-"): Promise<TestDirs> {
  const tempDir = await createTempDir(prefix);
  const projectDir = path.join(tempDir, "project");
  const pluginDir = path.join(projectDir, ".claude", "plugins", DEFAULT_PLUGIN_NAME);
  const skillsDir = path.join(pluginDir, "skills");
  const agentsDir = path.join(pluginDir, "agents");

  await mkdir(skillsDir, { recursive: true });
  await mkdir(agentsDir, { recursive: true });

  return { tempDir, projectDir, pluginDir, skillsDir, agentsDir };
}

export async function cleanupTestDirs(dirs: TestDirs): Promise<void> {
  await cleanupTempDir(dirs.tempDir);
}

export function createMockSkill(
  id: SkillId,
  category: CategoryPath,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return {
    id,
    description: `${id} skill`,
    category,
    categoryExclusive: false,
    tags: [],
    author: "@test",
    conflictsWith: [],
    recommends: [],
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

/**
 * Creates a mock ExtractedSkillMetadata for testing.
 * Used when mocking extractAllSkills() return values.
 */
export function createMockExtractedSkill(
  id: SkillId,
  overrides?: Partial<ExtractedSkillMetadata>,
): ExtractedSkillMetadata {
  // Derive directory path and category from the skill ID convention: "domain-subcategory-name"
  const segments = id.split("-");
  const domain = segments[0] ?? "web";
  const subcategory = segments[1] ?? "framework";
  const name = segments.slice(2).join("-") || "skill";
  const directoryPath = `${domain}/${subcategory}/${name}`;

  return {
    id,
    directoryPath,
    description: `${id} skill`,
    category: `${domain}-${subcategory}` as CategoryPath,
    categoryExclusive: true,
    author: "@test",
    tags: [],
    compatibleWith: [],
    conflictsWith: [],
    requires: [],
    requiresSetup: [],
    providesSetupFor: [],
    path: `skills/${directoryPath}/`,
    ...overrides,
  };
}

export function createMockMatrix(
  skills: Record<string, ResolvedSkill>,
  overrides?: Partial<MergedSkillsMatrix>,
): MergedSkillsMatrix {
  return {
    version: "1.0.0",
    categories: {} as Record<Subcategory, import("../../types").CategoryDefinition>,
    skills,
    suggestedStacks: [],
    displayNameToId: {} as Record<SkillDisplayName, SkillId>,
    displayNames: {} as Record<SkillId, SkillDisplayName>,
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

function createMetadataContent(author = "@test"): string {
  return `version: 1
author: ${author}
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
  skillName: string,
  options?: {
    author?: string;
    description?: string;
    /** Extra fields to merge into metadata.yaml (e.g., forkedFrom, cliName) */
    extraMetadata?: Record<string, unknown>;
    /** Skip metadata.yaml creation entirely */
    skipMetadata?: boolean;
    /** Custom SKILL.md content (overrides default generated content) */
    skillContent?: string;
  },
): Promise<string> {
  const skillDir = path.join(skillsDir, skillName);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    options?.skillContent ?? createSkillContent(skillName, options?.description),
  );

  if (!options?.skipMetadata) {
    if (options?.extraMetadata) {
      const metadata = {
        version: 1,
        author: options?.author ?? "@test",
        ...options.extraMetadata,
      };
      await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), stringifyYaml(metadata));
    } else {
      await writeFile(
        path.join(skillDir, STANDARD_FILES.METADATA_YAML),
        createMetadataContent(options?.author),
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
 * in the source directory layout (under `src/skills/<domain>/<subcategory>/<name>/`).
 */
export async function writeSourceSkill(
  skillsDir: string,
  directoryPath: string,
  config: {
    id: string;
    description: string;
    category: string;
    author?: string;
    tags?: string[];
    categoryExclusive?: boolean;
    content?: string;
  },
): Promise<string> {
  const skillDir = path.join(skillsDir, directoryPath);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    createSkillContent(config.id, config.description),
  );

  const metadata: Record<string, unknown> = {
    cliName: config.id,
    category: config.category,
    author: config.author ?? "@test",
    version: "1",
  };
  if (config.tags) {
    metadata.tags = config.tags;
  }
  if (config.categoryExclusive !== undefined) {
    metadata.categoryExclusive = config.categoryExclusive;
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
    path.join(agentDir, STANDARD_FILES.AGENT_YAML),
    createAgentYamlContent(agentName, options?.description),
  );

  return agentDir;
}

export function createMockCategory(
  id: Subcategory,
  displayName: string,
  overrides?: Partial<CategoryDefinition>,
): CategoryDefinition {
  return {
    id,
    displayName,
    description: `${displayName} category`,
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
    audience: [],
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
  // Skill categories use domain-prefixed Subcategory IDs (matching production
  // metadata.yaml and the categories map keys, e.g., "web-framework", "api-api").
  const skills = {
    "web-framework-react": getTestSkill("react", { category: "web-framework" }),
    "web-framework-vue": getTestSkill("vue", {
      category: "web-framework",
      conflictsWith: [{ skillId: "web-framework-react", reason: "Choose one framework" }],
    }),
    "web-state-zustand": getTestSkill("zustand", {
      category: "web-client-state",
      recommends: [{ skillId: "web-framework-react", reason: "Works great with React" }],
    }),
    "web-styling-scss-modules": getTestSkill("scss-modules", { category: "web-styling" }),
    "api-framework-hono": getTestSkill("hono", { category: "api-api" }),
    "api-database-drizzle": getTestSkill("drizzle", { category: "api-database" }),
    "web-testing-vitest": getTestSkill("vitest", { category: "web-testing" }),
    // Methodology skills (DEFAULT_PRESELECTED_SKILLS) — auto-injected by wizard
    "meta-methodology-investigation-requirements": createMockSkill(
      "meta-methodology-investigation-requirements",
      "shared-methodology",
      { description: "Never speculate - read actual code first", categoryExclusive: false },
    ),
    "meta-methodology-anti-over-engineering": createMockSkill(
      "meta-methodology-anti-over-engineering",
      "shared-methodology",
      {
        description: "Surgical implementation, not architectural innovation",
        categoryExclusive: false,
      },
    ),
    "meta-methodology-success-criteria": createMockSkill(
      "meta-methodology-success-criteria",
      "shared-methodology",
      { description: "Explicit, measurable criteria defining done", categoryExclusive: false },
    ),
    "meta-methodology-write-verification": createMockSkill(
      "meta-methodology-write-verification",
      "shared-methodology",
      { description: "Verify work was actually saved", categoryExclusive: false },
    ),
    "meta-methodology-improvement-protocol": createMockSkill(
      "meta-methodology-improvement-protocol",
      "shared-methodology",
      { description: "Evidence-based self-improvement", categoryExclusive: false },
    ),
    "meta-methodology-context-management": createMockSkill(
      "meta-methodology-context-management",
      "shared-methodology",
      { description: "Maintain project continuity across sessions", categoryExclusive: false },
    ),
  };

  const categories = {
    "web-framework": createMockCategory("web-framework" as Subcategory, "Framework", {
      domain: "web" as Domain,
      exclusive: true,
      required: true,
    }),
    "web-client-state": createMockCategory("web-client-state" as Subcategory, "State", {
      domain: "web" as Domain,
      order: 1,
    }),
    "web-styling": createMockCategory("web-styling" as Subcategory, "Styling", {
      domain: "web" as Domain,
      order: 2,
    }),
    "api-api": createMockCategory("api-api" as Subcategory, "Backend Framework", {
      domain: "api" as Domain,
      exclusive: true,
      required: true,
    }),
    "api-database": createMockCategory("api-database" as Subcategory, "Database", {
      domain: "api" as Domain,
      order: 1,
    }),
    "web-testing": createMockCategory("web-testing" as Subcategory, "Testing", {
      domain: "shared" as Domain,
      exclusive: false,
      order: 10,
    }),
    "shared-methodology": createMockCategory("shared-methodology" as Subcategory, "Methodology", {
      domain: "shared" as Domain,
      exclusive: false,
      required: false,
      order: 11,
    }),
  } as Record<Subcategory, CategoryDefinition>;

  const suggestedStacks: ResolvedStack[] = [
    createMockResolvedStack("nextjs-fullstack", "Next.js Fullstack", {
      description: "Complete Next.js stack with React and Hono",
      audience: ["startups", "enterprise"],
      skills: {
        "web-developer": {
          "web-framework": "web-framework-react",
          "web-client-state": "web-state-zustand",
          "web-styling": "web-styling-scss-modules",
        },
        "api-developer": {
          "api-api": "api-framework-hono",
          "api-database": "api-database-drizzle",
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
      audience: ["startups"],
      skills: {
        "web-developer": {
          "web-framework": "web-framework-vue",
        },
      } as ResolvedStack["skills"],
      allSkillIds: ["web-framework-vue"],
      philosophy: "Progressive framework approach",
    }),
  ];

  const displayNameToId = {
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
    // Double cast needed: object literal's string keys are not assignable to branded
    // SkillDisplayName/SkillId types without going through `unknown` first (boundary cast)
  } as unknown as Record<SkillDisplayName, SkillId>;

  const displayNames = {} as Record<SkillId, SkillDisplayName>;
  for (const [displayName, fullId] of typedEntries(displayNameToId)) {
    (displayNames as Record<string, string>)[fullId] = displayName;
  }

  return createMockMatrix(skills, {
    categories,
    suggestedStacks,
    displayNameToId,
    displayNames,
    ...overrides,
  });
}

/**
 * Builds a lightweight test matrix with 4 skills, 4 categories, and 2 stacks.
 * Use instead of createComprehensiveMatrix when relationship data is not needed.
 * @returns A minimal MergedSkillsMatrix for basic integration tests
 */
export function createBasicMatrix(overrides?: Partial<MergedSkillsMatrix>): MergedSkillsMatrix {
  // Domain-prefixed Subcategory IDs — see createComprehensiveMatrix comment
  const skills = {
    "web-framework-react": getTestSkill("react", { category: "web-framework" }),
    "web-state-zustand": getTestSkill("zustand", { category: "web-client-state" }),
    "api-framework-hono": getTestSkill("hono", { category: "api-api" }),
    "web-testing-vitest": getTestSkill("vitest", { category: "web-testing" }),
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
      "web-framework": createMockCategory("web-framework" as Subcategory, "Framework", {
        domain: "web" as Domain,
        exclusive: true,
        required: true,
      }),
      "web-client-state": createMockCategory("web-client-state" as Subcategory, "State", {
        domain: "web" as Domain,
        order: 1,
      }),
      "api-api": createMockCategory("api-api" as Subcategory, "Backend Framework", {
        domain: "api" as Domain,
        exclusive: true,
        required: true,
      }),
      "web-testing": createMockCategory("web-testing" as Subcategory, "Testing Framework", {
        domain: "shared" as Domain,
        exclusive: false,
      }),
    } as Record<Subcategory, CategoryDefinition>,
    ...overrides,
  });
}

export { getTestSkill } from "./test-fixtures";
export type { TestSkillName } from "./test-fixtures";
