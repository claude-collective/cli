import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { mkdtemp, rm, mkdir, writeFile, stat } from "fs/promises";
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
  AgentDefinition,
  CategoryDefinition,
  CategoryPath,
  Domain,
  MergedSkillsMatrix,
  ProjectConfig,
  ResolvedSkill,
  ResolvedStack,
  SkillDisplayName,
  SkillId,
  Subcategory,
} from "../../types";
import {
  createTestReactSkill,
  createTestVueSkill,
  createTestZustandSkill,
  createTestScssModulesSkill,
  createTestHonoSkill,
  createTestDrizzleSkill,
  createTestVitestSkill,
} from "./test-fixtures";

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

// Includes one methodology skill to test preselection behavior
export function createMockMatrixWithMethodology(
  skills: Record<string, ResolvedSkill> = {},
  overrides?: Partial<MergedSkillsMatrix>,
): MergedSkillsMatrix {
  const METHODOLOGY_CATEGORY: Subcategory = "methodology";
  // Just one methodology skill is enough to test preselection
  // Using normalized skill ID format
  const methodologySkill = createMockSkill(
    "meta-methodology-anti-over-engineering",
    METHODOLOGY_CATEGORY,
    { description: "Surgical implementation" },
  );

  return createMockMatrix(
    { [methodologySkill.id]: methodologySkill, ...skills },
    {
      categories: {
        [METHODOLOGY_CATEGORY]: {
          id: METHODOLOGY_CATEGORY,
          displayName: "Methodology",
          description: "Foundational development practices",
          exclusive: false,
          required: false,
          order: 0,
        },
        ...overrides?.categories,
      } as Record<Subcategory, import("../../types").CategoryDefinition>,
      ...overrides,
    },
  );
}

export function createMockProjectConfig(
  name: string,
  skills: SkillId[],
  overrides?: Partial<ProjectConfig>,
): ProjectConfig {
  // Build stack from skills: each skill goes to all agents under its subcategory
  const stack: Record<string, Record<string, SkillId>> = {};
  for (const skillId of skills) {
    // Extract a subcategory from the skill ID (e.g., "web-framework-react" -> "framework")
    const parts = skillId.split("-");
    const subcategory = parts.length >= 2 ? parts[1] : parts[0];
    for (const agent of ["web-developer", "api-developer"]) {
      if (!stack[agent]) stack[agent] = {};
      stack[agent][subcategory] = skillId;
    }
  }
  return {
    name,
    description: `Test project: ${name}`,
    author: "@test",
    agents: ["web-developer", "api-developer"],
    stack,
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

export function createMetadataContent(author = "@test"): string {
  return `version: 1
author: ${author}
`;
}

export function createAgentYamlContent(name: string, description = "A test agent"): string {
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
    "web-framework-react": createTestReactSkill({ category: "framework" }),
    "web-framework-vue": createTestVueSkill({
      category: "framework",
      conflictsWith: [{ skillId: "web-framework-react", reason: "Choose one framework" }],
    }),
    "web-state-zustand": createTestZustandSkill({
      category: "client-state",
      recommends: [{ skillId: "web-framework-react", reason: "Works great with React" }],
    }),
    "web-styling-scss-modules": createTestScssModulesSkill({ category: "styling" }),
    "api-framework-hono": createTestHonoSkill({ category: "api" }),
    "api-database-drizzle": createTestDrizzleSkill({ category: "database" }),
    "web-testing-vitest": createTestVitestSkill({ category: "testing" }),
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
    "web-framework-react": createTestReactSkill({ category: "framework" }),
    "web-state-zustand": createTestZustandSkill({ category: "client-state" }),
    "api-framework-hono": createTestHonoSkill({ category: "api" }),
    "web-testing-vitest": createTestVitestSkill({ category: "testing" }),
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

export {
  createTestReactSkill,
  createTestZustandSkill,
  createTestHonoSkill,
  createTestVitestSkill,
  createTestVueSkill,
  createTestAuthPatternsSkill,
  createTestDrizzleSkill,
  createTestScssModulesSkill,
} from "./test-fixtures";
