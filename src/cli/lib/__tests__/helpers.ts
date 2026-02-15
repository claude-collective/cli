import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";
import { parse as parseYaml } from "yaml";
import { runCommand } from "@oclif/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CLI_ROOT = path.resolve(__dirname, "../../../..");

export const OUTPUT_STRINGS = {
  CONFIG_HEADER: "Claude Collective Configuration",
  CONFIG_PATHS_HEADER: "Configuration File Paths",
  CONFIG_LAYERS_HEADER: "Configuration Layers:",
  CONFIG_PRECEDENCE: "Precedence: flag > env > project > global > default",
  SOURCE_LABEL: "Source:",
  MARKETPLACE_LABEL: "Marketplace:",
  AGENTS_SOURCE_LABEL: "Agents Source:",
  GLOBAL_LABEL: "Global:",
  PROJECT_LABEL: "Project:",

  // Setup/Init outputs
  INIT_HEADER: "Claude Collective Setup",
  INIT_SUCCESS: "Claude Collective initialized successfully!",
  LOADING_MATRIX: "Loading skills matrix...",
  LOADING_SKILLS: "Loading skills...",
  LOADING_AGENTS: "Loading agent partials...",

  // Plugin/installation outputs
  NO_PLUGIN_FOUND: "No plugin found",
  NO_INSTALLATION_FOUND: "No installation found",
  NO_PLUGIN_INSTALLATION: "No plugin installation found",
  NOT_INSTALLED: "Claude Collective is not installed",
  UNINSTALL_HEADER: "Claude Collective Uninstall",
  UNINSTALL_COMPLETE: "Claude Collective has been uninstalled",
  EJECT_HEADER: "Claude Collective Eject",

  // Doctor command outputs
  DOCTOR_HEADER: "Claude Collective Doctor",

  // Error message patterns (lowercase for case-insensitive matching)
  ERROR_MISSING_ARG: "missing required arg",
  ERROR_UNEXPECTED_ARG: "unexpected argument",
  ERROR_UNKNOWN_FLAG: "unknown flag",
  ERROR_PARSE: "parse",
} as const;

export async function runCliCommand(args: string[]) {
  return runCommand(args, { root: CLI_ROOT });
}
import type {
  AgentConfig,
  AgentDefinition,
  CategoryDefinition,
  CategoryPath,
  CompileContext,
  Domain,
  DomainSelections,
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
  return parseYaml(content) as T;
}

export function buildWizardResult(
  selectedSkills: SkillId[],
  overrides?: Partial<WizardResultV2>,
): WizardResultV2 {
  return {
    selectedSkills,
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
    return parseYaml(yamlContent) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function createTempDir(prefix = "cc-test-"): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function cleanupTempDir(dirPath: string): Promise<void> {
  await rm(dirPath, { recursive: true, force: true });
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
  const pluginDir = path.join(projectDir, ".claude", "plugins", "claude-collective");
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
    permission_mode: "default",
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
    outputDir: "/project/.claude/plugins/claude-collective",
    ...overrides,
  };
}

function createSkillContent(name: string, description = "A test skill"): string {
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

function createAgentYamlContent(name: string, description = "A test agent"): string {
  return `name: ${name}
description: ${description}
tools: Read, Write, Edit
model: opus
permissionMode: default
`;
}

export async function writeTestSkill(
  skillsDir: string,
  skillName: string,
  options?: { author?: string; description?: string },
): Promise<string> {
  const skillDir = path.join(skillsDir, skillName);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, "SKILL.md"),
    createSkillContent(skillName, options?.description),
  );

  await writeFile(path.join(skillDir, "metadata.yaml"), createMetadataContent(options?.author));

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
    path.join(agentDir, "agent.yaml"),
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

// 7 skills across 6 categories, 2 stacks, display name mappings, and relationship data
export function createComprehensiveMatrix(
  overrides?: Partial<MergedSkillsMatrix>,
): MergedSkillsMatrix {
  // Skill categories use bare Subcategory IDs (matching production metadata.yaml
  // and the categories map keys). The test fixture factories default to "web/framework"
  // CategoryPath format, but the wizard's populateFromStack needs bare IDs to match
  // the categories map lookup (e.g., "framework" not "web/framework").
  const skills = {
    "web-framework-react": getTestSkill("react", { category: "framework" }),
    "web-framework-vue": getTestSkill("vue", {
      category: "framework",
      conflictsWith: [{ skillId: "web-framework-react", reason: "Choose one framework" }],
    }),
    "web-state-zustand": getTestSkill("zustand", {
      category: "client-state",
      recommends: [{ skillId: "web-framework-react", reason: "Works great with React" }],
    }),
    "web-styling-scss-modules": getTestSkill("scss-modules", { category: "styling" }),
    "api-framework-hono": getTestSkill("hono", { category: "api" }),
    "api-database-drizzle": getTestSkill("drizzle", { category: "database" }),
    "web-testing-vitest": getTestSkill("vitest", { category: "testing" }),
  };

  const categories = {
    framework: createMockCategory("framework" as Subcategory, "Framework", {
      domain: "web" as Domain,
      exclusive: true,
      required: true,
    }),
    "client-state": createMockCategory("client-state" as Subcategory, "State", {
      domain: "web" as Domain,
      order: 1,
    }),
    styling: createMockCategory("styling" as Subcategory, "Styling", {
      domain: "web" as Domain,
      order: 2,
    }),
    api: createMockCategory("api" as Subcategory, "Backend Framework", {
      domain: "api" as Domain,
      exclusive: true,
      required: true,
    }),
    database: createMockCategory("database" as Subcategory, "Database", {
      domain: "api" as Domain,
      order: 1,
    }),
    testing: createMockCategory("testing" as Subcategory, "Testing", {
      domain: "shared" as Domain,
      exclusive: false,
      order: 10,
    }),
  } as Record<Subcategory, CategoryDefinition>;

  const suggestedStacks: ResolvedStack[] = [
    createMockResolvedStack("nextjs-fullstack", "Next.js Fullstack", {
      description: "Complete Next.js stack with React and Hono",
      audience: ["startups", "enterprise"],
      skills: {
        "web-developer": {
          framework: "web-framework-react",
          "client-state": "web-state-zustand",
          styling: "web-styling-scss-modules",
        },
        "api-developer": {
          api: "api-framework-hono",
          database: "api-database-drizzle",
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
          framework: "web-framework-vue",
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
  } as unknown as Record<SkillDisplayName, SkillId>;

  const displayNames = {} as Record<SkillId, SkillDisplayName>;
  for (const [displayName, fullId] of Object.entries(displayNameToId)) {
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

// 4 skills, 4 categories, 2 stacks — lighter than createComprehensiveMatrix
export function createBasicMatrix(overrides?: Partial<MergedSkillsMatrix>): MergedSkillsMatrix {
  // Bare Subcategory IDs — see createComprehensiveMatrix comment
  const skills = {
    "web-framework-react": getTestSkill("react", { category: "framework" }),
    "web-state-zustand": getTestSkill("zustand", { category: "client-state" }),
    "api-framework-hono": getTestSkill("hono", { category: "api" }),
    "web-testing-vitest": getTestSkill("vitest", { category: "testing" }),
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
      framework: createMockCategory("framework" as Subcategory, "Framework", {
        domain: "web" as Domain,
        exclusive: true,
        required: true,
      }),
      "client-state": createMockCategory("client-state" as Subcategory, "State", {
        domain: "web" as Domain,
        order: 1,
      }),
      api: createMockCategory("api" as Subcategory, "Backend Framework", {
        domain: "api" as Domain,
        exclusive: true,
        required: true,
      }),
      testing: createMockCategory("testing" as Subcategory, "Testing Framework", {
        domain: "shared" as Domain,
        exclusive: false,
      }),
    } as Record<Subcategory, CategoryDefinition>,
    ...overrides,
  });
}

export { getTestSkill } from "./test-fixtures";
export type { TestSkillName } from "./test-fixtures";
