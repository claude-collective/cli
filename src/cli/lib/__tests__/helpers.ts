/**
 * Shared test helpers for CLI tests
 *
 * This module provides common utilities to reduce duplication across test files.
 *
 * @module helpers
 *
 * ## Usage
 *
 * ### Running CLI Commands
 * ```typescript
 * import { runCliCommand } from './helpers';
 *
 * const { stdout, error } = await runCliCommand(['config:show']);
 * expect(stdout).toContain(OUTPUT_STRINGS.CONFIG_HEADER);
 * ```
 *
 * ### Creating Test Fixtures
 * ```typescript
 * import { createTestDirs, writeTestSkill, cleanupTestDirs } from './helpers';
 *
 * const dirs = await createTestDirs();
 * await writeTestSkill(dirs.skillsDir, 'my-skill');
 * // ... run tests ...
 * await cleanupTestDirs(dirs);
 * ```
 *
 * ### Creating Mock Data
 * ```typescript
 * import { createMockSkill, createMockMatrix } from './helpers';
 *
 * const skill = createMockSkill('web-framework-react', 'frontend/framework');
 * const matrix = createMockMatrix({ [skill.id]: skill });
 * ```
 */

import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { mkdtemp, rm, mkdir, writeFile, stat } from "fs/promises";
import { runCommand } from "@oclif/test";

// =============================================================================
// CLI Root Path
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Path to the CLI root directory for oclif command execution.
 *
 * Used by {@link runCliCommand} and can be imported by tests that need
 * direct access to the CLI root (e.g., for file path assertions).
 *
 * @example
 * ```typescript
 * import { CLI_ROOT } from './helpers';
 * const configPath = path.join(CLI_ROOT, 'package.json');
 * ```
 */
export const CLI_ROOT = path.resolve(__dirname, "../../../..");

// =============================================================================
// Output String Constants
// =============================================================================

/**
 * Common output strings used in CLI command assertions.
 *
 * Use these constants instead of hardcoding strings in test assertions
 * to ensure consistency and make updates easier.
 *
 * @example
 * ```typescript
 * import { OUTPUT_STRINGS } from './helpers';
 *
 * expect(stdout).toContain(OUTPUT_STRINGS.CONFIG_HEADER);
 * expect(stderr).toContain(OUTPUT_STRINGS.NO_PLUGIN_FOUND);
 * ```
 */
export const OUTPUT_STRINGS = {
  // Config command outputs
  /** Header for config:show output */
  CONFIG_HEADER: "Claude Collective Configuration",
  /** Config path section header */
  CONFIG_PATHS_HEADER: "Configuration File Paths",
  /** Config layers section header */
  CONFIG_LAYERS_HEADER: "Configuration Layers:",
  /** Config precedence explanation */
  CONFIG_PRECEDENCE: "Precedence: flag > env > project > global > default",
  /** Source label in config output */
  SOURCE_LABEL: "Source:",
  /** Marketplace section header */
  MARKETPLACE_LABEL: "Marketplace:",
  /** Agents source section header */
  AGENTS_SOURCE_LABEL: "Agents Source:",
  /** Global config label */
  GLOBAL_LABEL: "Global:",
  /** Project config label */
  PROJECT_LABEL: "Project:",

  // Setup/Init outputs
  /** Init command header */
  INIT_HEADER: "Claude Collective Setup",
  /** Success message after init */
  INIT_SUCCESS: "Claude Collective initialized successfully!",
  /** Loading matrix message */
  LOADING_MATRIX: "Loading skills matrix...",
  /** Loading skills message */
  LOADING_SKILLS: "Loading skills...",
  /** Loading agents message */
  LOADING_AGENTS: "Loading agent partials...",

  // Plugin/installation outputs
  /** No plugin installed message */
  NO_PLUGIN_FOUND: "No plugin found",
  /** No installation found message (local or plugin) */
  NO_INSTALLATION_FOUND: "No installation found",
  /** No plugin installation found */
  NO_PLUGIN_INSTALLATION: "No plugin installation found",
  /** Not installed message */
  NOT_INSTALLED: "Claude Collective is not installed",
  /** Uninstall header */
  UNINSTALL_HEADER: "Claude Collective Uninstall",
  /** Uninstall complete message */
  UNINSTALL_COMPLETE: "Claude Collective has been uninstalled",
  /** Eject header */
  EJECT_HEADER: "Claude Collective Eject",

  // Doctor command outputs
  /** Doctor command header */
  DOCTOR_HEADER: "Claude Collective Doctor",

  // Error message patterns (lowercase for case-insensitive matching)
  /** Pattern for missing required argument errors */
  ERROR_MISSING_ARG: "missing required arg",
  /** Pattern for unexpected argument errors */
  ERROR_UNEXPECTED_ARG: "unexpected argument",
  /** Pattern for unknown flag errors */
  ERROR_UNKNOWN_FLAG: "unknown flag",
  /** Pattern for parse errors */
  ERROR_PARSE: "parse",
} as const;

// =============================================================================
// CLI Command Execution
// =============================================================================

/**
 * Run a CLI command using oclif's runCommand with the correct root path.
 *
 * This is the primary way to test CLI commands. It wraps oclif's `runCommand`
 * and automatically configures the correct CLI root directory.
 *
 * @param args - Command arguments as an array of strings.
 *               First element is the command name, followed by flags and arguments.
 * @returns Promise resolving to an object containing:
 *          - `stdout`: Standard output captured during command execution
 *          - `stderr`: Standard error captured during command execution
 *          - `error`: Error object if command failed (includes `error.oclif?.exit` for exit codes)
 *          - `result`: Command result if successful
 *
 * @example Basic command execution
 * ```typescript
 * const { stdout, error } = await runCliCommand(['config:show']);
 * expect(stdout).toContain(OUTPUT_STRINGS.CONFIG_HEADER);
 * expect(error?.oclif?.exit).toBeUndefined(); // No error exit code
 * ```
 *
 * @example Command with flags
 * ```typescript
 * const { stdout } = await runCliCommand(['search', 'react', '--limit', '5']);
 * expect(stdout).toContain('react');
 * ```
 *
 * @example Checking for expected errors
 * ```typescript
 * const { error } = await runCliCommand(['config:get', 'invalid-key']);
 * expect(error?.oclif?.exit).toBe(2); // INVALID_ARGS exit code
 * ```
 *
 * @see {@link CLI_ROOT} for the path used for command execution
 * @see {@link OUTPUT_STRINGS} for common assertion strings
 */
export async function runCliCommand(args: string[]) {
  return runCommand(args, { root: CLI_ROOT });
}
import type { MergedSkillsMatrix, ResolvedSkill } from "../../types-matrix";
import type { StackConfig, AgentDefinition } from "../../../types";

// =============================================================================
// File System Helpers
// =============================================================================

/**
 * Check if a file exists at the given path.
 *
 * Returns true only if the path exists AND is a file (not a directory).
 *
 * @param filePath - Absolute path to check
 * @returns Promise resolving to true if file exists, false otherwise
 *
 * @example
 * ```typescript
 * if (await fileExists('/path/to/file.txt')) {
 *   // File exists and is a regular file
 * }
 * ```
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists at the given path.
 *
 * Returns true only if the path exists AND is a directory (not a file).
 *
 * @param dirPath - Absolute path to check
 * @returns Promise resolving to true if directory exists, false otherwise
 *
 * @example
 * ```typescript
 * if (await directoryExists('/path/to/dir')) {
 *   // Directory exists
 * }
 * ```
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Create a temporary directory for tests.
 *
 * Creates a unique directory in the system temp folder. Use with
 * {@link cleanupTempDir} to ensure cleanup after tests.
 *
 * @param prefix - Prefix for the temp directory name (default: "cc-test-")
 * @returns Promise resolving to the absolute path of the created directory
 *
 * @example
 * ```typescript
 * const tempDir = await createTempDir('my-test-');
 * // Use tempDir for test files...
 * await cleanupTempDir(tempDir);
 * ```
 *
 * @see {@link cleanupTempDir} for cleanup
 * @see {@link createTestDirs} for complete test directory structure
 */
export async function createTempDir(prefix = "cc-test-"): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

/**
 * Clean up a temporary directory and all its contents.
 *
 * Recursively removes the directory and all files/subdirectories within it.
 * Safe to call even if directory doesn't exist.
 *
 * @param dirPath - Absolute path to directory to remove
 * @returns Promise that resolves when cleanup is complete
 *
 * @example
 * ```typescript
 * afterEach(async () => {
 *   await cleanupTempDir(tempDir);
 * });
 * ```
 *
 * @see {@link createTempDir} for creating temp directories
 * @see {@link cleanupTestDirs} for cleaning up TestDirs structures
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  await rm(dirPath, { recursive: true, force: true });
}

// =============================================================================
// Test Directory Structure
// =============================================================================

/**
 * Structure returned by {@link createTestDirs} containing paths to common test directories.
 *
 * @property tempDir - Root temporary directory (used for cleanup)
 * @property projectDir - Simulated project root directory
 * @property pluginDir - Plugin installation directory (.claude/plugins/claude-collective)
 * @property skillsDir - Skills directory within the plugin
 * @property agentsDir - Agents directory within the plugin
 */
export interface TestDirs {
  /** Root temporary directory (parent of all test files) */
  tempDir: string;
  /** Simulated project root directory */
  projectDir: string;
  /** Plugin installation directory (.claude/plugins/claude-collective) */
  pluginDir: string;
  /** Skills directory within the plugin */
  skillsDir: string;
  /** Agents directory within the plugin */
  agentsDir: string;
}

/**
 * Create a complete test directory structure for plugin tests.
 *
 * Creates a realistic directory structure matching the Claude Collective
 * plugin installation layout:
 *
 * ```
 * {tempDir}/
 *   project/
 *     .claude/
 *       plugins/
 *         claude-collective/
 *           skills/
 *           agents/
 * ```
 *
 * @param prefix - Prefix for the temp directory name (default: "cc-test-")
 * @returns Promise resolving to TestDirs with all path references
 *
 * @example
 * ```typescript
 * let testDirs: TestDirs;
 *
 * beforeEach(async () => {
 *   testDirs = await createTestDirs();
 * });
 *
 * afterEach(async () => {
 *   await cleanupTestDirs(testDirs);
 * });
 *
 * it('should create skill files', async () => {
 *   await writeTestSkill(testDirs.skillsDir, 'my-skill');
 *   expect(await fileExists(`${testDirs.skillsDir}/my-skill/SKILL.md`)).toBe(true);
 * });
 * ```
 *
 * @see {@link cleanupTestDirs} for cleanup
 * @see {@link writeTestSkill} for adding skills to the structure
 * @see {@link writeTestAgent} for adding agents to the structure
 */
export async function createTestDirs(prefix = "cc-test-"): Promise<TestDirs> {
  const tempDir = await createTempDir(prefix);
  const projectDir = path.join(tempDir, "project");
  const pluginDir = path.join(
    projectDir,
    ".claude",
    "plugins",
    "claude-collective",
  );
  const skillsDir = path.join(pluginDir, "skills");
  const agentsDir = path.join(pluginDir, "agents");

  await mkdir(skillsDir, { recursive: true });
  await mkdir(agentsDir, { recursive: true });

  return { tempDir, projectDir, pluginDir, skillsDir, agentsDir };
}

/**
 * Clean up test directories created by {@link createTestDirs}.
 *
 * Removes the entire temp directory tree. Safe to call multiple times
 * or if directories were already deleted.
 *
 * @param dirs - TestDirs structure to clean up
 * @returns Promise that resolves when cleanup is complete
 *
 * @example
 * ```typescript
 * afterEach(async () => {
 *   if (testDirs) {
 *     await cleanupTestDirs(testDirs);
 *     testDirs = null;
 *   }
 * });
 * ```
 *
 * @see {@link createTestDirs} for creating the directory structure
 */
export async function cleanupTestDirs(dirs: TestDirs): Promise<void> {
  await cleanupTempDir(dirs.tempDir);
}

// =============================================================================
// Mock Data Creators
// =============================================================================

/**
 * Create a minimal resolved skill for testing.
 *
 * Creates a {@link ResolvedSkill} with sensible defaults that can be
 * used in matrix and skill selection tests. Override any property
 * as needed.
 *
 * @param id - Normalized skill ID (e.g., "web-framework-react")
 * @param category - Skill category path (e.g., "frontend/framework")
 * @param overrides - Optional partial skill to override defaults
 * @returns Complete ResolvedSkill object
 *
 * @example Basic usage
 * ```typescript
 * const skill = createMockSkill('web-framework-react', 'frontend/framework');
 * expect(skill.name).toBe('web-framework-react');
 * expect(skill.author).toBe('@test');
 * ```
 *
 * @example With overrides
 * ```typescript
 * const skill = createMockSkill('web-framework-react', 'frontend', {
 *   author: '@custom',
 *   tags: ['popular', 'frontend'],
 *   recommends: [{ skillId: 'web-state-zustand', reason: 'Works well with React' }],
 * });
 * ```
 *
 * @see {@link createMockMatrix} for creating a matrix with skills
 * @see {@link createTestReactSkill} for pre-built common skills
 */
export function createMockSkill(
  id: string,
  category: string,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return {
    id,
    // For normalized IDs, use the ID itself as the name (unless overridden)
    name: id,
    description: `${id} skill`,
    category,
    categoryExclusive: false,
    tags: [],
    author: "@test",
    conflictsWith: [],
    recommends: [],
    recommendedBy: [],
    requires: [],
    requiredBy: [],
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
 * Create a minimal merged skills matrix for testing.
 *
 * Creates a {@link MergedSkillsMatrix} that can be used with wizard
 * components and skill resolution logic.
 *
 * @param skills - Record of skill IDs to ResolvedSkill objects
 * @param overrides - Optional partial matrix to override defaults
 * @returns Complete MergedSkillsMatrix object
 *
 * @example Basic usage
 * ```typescript
 * const skill = createMockSkill('react (@vince)', 'frontend');
 * const matrix = createMockMatrix({ 'react (@vince)': skill });
 * ```
 *
 * @example With stacks and categories
 * ```typescript
 * const matrix = createMockMatrix(skills, {
 *   categories: {
 *     frontend: { name: 'Frontend', description: 'Frontend skills' },
 *   },
 *   suggestedStacks: [
 *     { id: 'react-stack', name: 'React Stack', allSkillIds: ['web-framework-react'] },
 *   ],
 * });
 * ```
 *
 * @see {@link createMockSkill} for creating skills to add to the matrix
 */
export function createMockMatrix(
  skills: Record<string, ResolvedSkill>,
  overrides?: Partial<MergedSkillsMatrix>,
): MergedSkillsMatrix {
  return {
    version: "1.0.0",
    categories: {},
    skills,
    suggestedStacks: [],
    aliases: {},
    aliasesReverse: {},
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock matrix that includes one methodology skill (to test preselected behavior).
 *
 * Use this for tests where the wizard's preselected skills should be visible.
 * Only includes one methodology skill - enough to test preselection logic.
 *
 * @param skills - Additional skills to include (one methodology skill added automatically)
 * @param overrides - Optional partial matrix to override defaults
 * @returns MergedSkillsMatrix with one methodology skill included
 */
export function createMockMatrixWithMethodology(
  skills: Record<string, ResolvedSkill> = {},
  overrides?: Partial<MergedSkillsMatrix>,
): MergedSkillsMatrix {
  const METHODOLOGY_CATEGORY = "meta/methodology";
  // Just one methodology skill is enough to test preselection
  // Using normalized skill ID format
  const methodologySkill = createMockSkill(
    "meta-methodology-anti-over-engineering",
    METHODOLOGY_CATEGORY,
    { name: "Anti-Over-Engineering", description: "Surgical implementation" },
  );

  return createMockMatrix(
    { [methodologySkill.id]: methodologySkill, ...skills },
    {
      categories: {
        [METHODOLOGY_CATEGORY]: {
          id: METHODOLOGY_CATEGORY,
          name: "Methodology",
          description: "Foundational development practices",
          exclusive: false,
          required: false,
          order: 0,
        },
        ...overrides?.categories,
      },
      ...overrides,
    },
  );
}

/**
 * Create a minimal stack config for testing.
 *
 * Creates a {@link StackConfig} representing a pre-built skill stack.
 * Automatically sets up agent_skills mappings.
 *
 * @param name - Stack name (e.g., "nextjs-fullstack")
 * @param skills - Array of skill IDs to include
 * @param overrides - Optional partial config to override defaults
 * @returns Complete StackConfig object
 *
 * @example
 * ```typescript
 * const stack = createMockStackConfig('react-stack', [
 *   'web-framework-react',
 *   'web-state-zustand',
 * ]);
 * expect(stack.agents).toContain('web-developer');
 * ```
 *
 * @see {@link createMockAgent} for creating agent definitions
 */
export function createMockStackConfig(
  name: string,
  skills: string[],
  overrides?: Partial<StackConfig>,
): StackConfig {
  return {
    name,
    version: "1.0.0",
    description: `Test stack: ${name}`,
    author: "@test",
    skills: skills.map((s) => ({ id: s })),
    agents: ["web-developer", "api-developer"],
    agent_skills: {
      "web-developer": {
        default: skills
          .filter((s) => !s.includes("backend"))
          .map((s) => ({ id: s })),
      },
      "api-developer": {
        default: skills
          .filter((s) => !s.includes("frontend"))
          .map((s) => ({ id: s })),
      },
    },
    ...overrides,
  };
}

/**
 * Create a minimal agent definition for testing.
 *
 * Creates an {@link AgentDefinition} with common defaults suitable
 * for most test scenarios.
 *
 * @param name - Agent name/title (e.g., "web-developer")
 * @param overrides - Optional partial definition to override defaults
 * @returns Complete AgentDefinition object
 *
 * @example Basic usage
 * ```typescript
 * const agent = createMockAgent('web-developer');
 * expect(agent.model).toBe('opus');
 * expect(agent.tools).toContain('Read');
 * ```
 *
 * @example With custom tools
 * ```typescript
 * const agent = createMockAgent('minimal-agent', {
 *   tools: ['Read', 'Grep'],
 *   model: 'sonnet',
 * });
 * ```
 */
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

// =============================================================================
// File Content Helpers
// =============================================================================

/**
 * Create minimal SKILL.md content with YAML frontmatter.
 *
 * Generates valid skill file content that can be parsed by the
 * skill loader.
 *
 * @param name - Skill name
 * @param description - Skill description (default: "A test skill")
 * @returns String content for SKILL.md file
 *
 * @example
 * ```typescript
 * const content = createSkillContent('my-skill', 'My skill description');
 * await writeFile(path.join(skillDir, 'SKILL.md'), content);
 * ```
 *
 * @see {@link writeTestSkill} for creating complete skill directories
 */
export function createSkillContent(
  name: string,
  description = "A test skill",
): string {
  return `---
name: ${name}
description: ${description}
category: test
---

# ${name}

This is a test skill.
`;
}

/**
 * Create minimal metadata.yaml content for a skill.
 *
 * @param author - Skill author (default: "@test")
 * @returns String content for metadata.yaml file
 *
 * @example
 * ```typescript
 * const content = createMetadataContent('@myauthor');
 * await writeFile(path.join(skillDir, 'metadata.yaml'), content);
 * ```
 *
 * @see {@link writeTestSkill} for creating complete skill directories
 */
export function createMetadataContent(author = "@test"): string {
  return `version: 1
author: ${author}
`;
}

/**
 * Create minimal agent.yaml content for an agent definition.
 *
 * Generates valid agent configuration that can be parsed by the
 * agent resolver.
 *
 * @param name - Agent name
 * @param description - Agent description (default: "A test agent")
 * @returns String content for agent.yaml file
 *
 * @example
 * ```typescript
 * const content = createAgentYamlContent('my-agent', 'My agent description');
 * await writeFile(path.join(agentDir, 'agent.yaml'), content);
 * ```
 *
 * @see {@link writeTestAgent} for creating complete agent directories
 */
export function createAgentYamlContent(
  name: string,
  description = "A test agent",
): string {
  return `name: ${name}
description: ${description}
tools: Read, Write, Edit
model: opus
permissionMode: default
`;
}

/**
 * Write a complete test skill directory with SKILL.md and metadata.yaml.
 *
 * Creates a skill directory structure matching the expected format:
 * ```
 * {skillsDir}/
 *   {skillName}/
 *     SKILL.md
 *     metadata.yaml
 * ```
 *
 * @param skillsDir - Parent skills directory path
 * @param skillName - Name of the skill (used for directory and content)
 * @param options - Optional configuration
 * @param options.author - Author for metadata.yaml (default: "@test")
 * @param options.description - Description for SKILL.md (default: "A test skill")
 * @returns Promise resolving to the created skill directory path
 *
 * @example
 * ```typescript
 * const testDirs = await createTestDirs();
 * const skillDir = await writeTestSkill(testDirs.skillsDir, 'react', {
 *   author: '@vince',
 *   description: 'React patterns',
 * });
 * expect(await fileExists(`${skillDir}/SKILL.md`)).toBe(true);
 * ```
 *
 * @see {@link createTestDirs} for creating the directory structure
 * @see {@link createSkillContent} for the SKILL.md template
 */
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

  await writeFile(
    path.join(skillDir, "metadata.yaml"),
    createMetadataContent(options?.author),
  );

  return skillDir;
}

/**
 * Write a complete test agent directory with agent.yaml.
 *
 * Creates an agent directory structure matching the expected format:
 * ```
 * {agentsDir}/
 *   {agentName}/
 *     agent.yaml
 * ```
 *
 * @param agentsDir - Parent agents directory path
 * @param agentName - Name of the agent (used for directory and content)
 * @param options - Optional configuration
 * @param options.description - Description for agent.yaml (default: "A test agent")
 * @returns Promise resolving to the created agent directory path
 *
 * @example
 * ```typescript
 * const testDirs = await createTestDirs();
 * const agentDir = await writeTestAgent(testDirs.agentsDir, 'web-developer', {
 *   description: 'Frontend specialist',
 * });
 * expect(await fileExists(`${agentDir}/agent.yaml`)).toBe(true);
 * ```
 *
 * @see {@link createTestDirs} for creating the directory structure
 * @see {@link createAgentYamlContent} for the agent.yaml template
 */
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

// =============================================================================
// Re-export from test-fixtures for convenience
// =============================================================================

/**
 * Re-exports from test-fixtures module.
 *
 * These exports provide consistent skill IDs, categories, and pre-built
 * mock skill creators across all tests.
 *
 * @example
 * ```typescript
 * import {
 *   TEST_SKILLS,
 *   TEST_CATEGORIES,
 *   createTestReactSkill,
 * } from './helpers';
 *
 * const skill = createTestReactSkill();
 * expect(skill.id).toBe(TEST_SKILLS.REACT);
 * expect(skill.category).toBe(TEST_CATEGORIES.FRAMEWORK);
 * ```
 *
 * @see module:test-fixtures for detailed documentation
 */
export {
  /** Constant skill IDs for use in tests (e.g., TEST_SKILLS.REACT) */
  TEST_SKILLS,
  /** Default test author (@vince) */
  TEST_AUTHOR,
  /** Constant category paths for use in tests (e.g., TEST_CATEGORIES.FRAMEWORK) */
  TEST_CATEGORIES,
  /** Generic placeholder skill IDs for abstract tests */
  PLACEHOLDER_SKILLS,
  /** Create a pre-configured React skill */
  createTestReactSkill,
  /** Create a pre-configured Zustand skill */
  createTestZustandSkill,
  /** Create a pre-configured Hono skill */
  createTestHonoSkill,
  /** Create a pre-configured Vitest skill */
  createTestVitestSkill,
  /** Create a pre-configured Vue skill */
  createTestVueSkill,
  /** Create a pre-configured auth-patterns skill */
  createTestAuthPatternsSkill,
  /** Create a pre-configured Drizzle skill */
  createTestDrizzleSkill,
} from "./test-fixtures";
