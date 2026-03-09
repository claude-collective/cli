import path from "path";
import { fileURLToPath } from "url";
import { mkdir, writeFile, readdir, readFile } from "fs/promises";
import { stripVTControlCharacters } from "node:util";
import { execa } from "execa";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";
import {
  createTempDir as createTempDirBase,
  cleanupTempDir,
  fileExists,
  directoryExists,
} from "../../src/cli/lib/__tests__/test-fs-utils.js";
import { EXIT_CODES } from "../../src/cli/lib/exit-codes.js";
import type { AgentName, Domain, ProjectConfig, SkillId } from "../../src/cli/types/index.js";

export { EXIT_CODES };

export const OCLIF_EXIT_CODES = {
  UNKNOWN_COMMAND: 127,
} as const;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the repository root */
export const CLI_ROOT = path.resolve(__dirname, "../..");

/** Absolute path to the built binary (requires `npm run build` first) */
export const BIN_RUN = path.join(CLI_ROOT, "bin", "run.js");

const E2E_TEMP_PREFIX = "ai-e2e-";

// --- Shared timing constants for interactive E2E tests ---

/** Time to wait for the wizard to load and render the first step */
export const WIZARD_LOAD_TIMEOUT_MS = 10_000;

/** Time to wait for installation to complete */
export const INSTALL_TIMEOUT_MS = 30_000;

/** Delay after a step transition (e.g., pressing Enter to advance) */
export const STEP_TRANSITION_DELAY_MS = 500;

/** Delay after a single keystroke (e.g., arrow key, letter key) */
export const KEYSTROKE_DELAY_MS = 150;

/** Time to wait for a PTY process to exit after sending a signal */
export const EXIT_TIMEOUT_MS = 10_000;

/** General-purpose delay for waiting on async terminal updates */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function createTempDir(): Promise<string> {
  return createTempDirBase(E2E_TEMP_PREFIX);
}

export { cleanupTempDir, fileExists, directoryExists };

/**
 * Creates a minimal project directory with a single local skill.
 * This is the minimum viable setup for `compile`.
 *
 * Structure:
 *   <projectDir>/
 *     .claude-src/
 *       config.ts
 *     .claude/
 *       skills/
 *         web-testing-e2e-compile/
 *           SKILL.md
 *           metadata.yaml
 */
export async function createMinimalProject(tempDir: string): Promise<{
  projectDir: string;
  agentsDir: string;
}> {
  const projectDir = path.join(tempDir, "project");
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  const skillDir = path.join(
    projectDir,
    CLAUDE_DIR,
    STANDARD_DIRS.SKILLS,
    "web-testing-e2e-compile",
  );

  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    `---
name: web-testing-e2e-compile
description: E2E test skill for compile verification
---

# Test E2E Skill

This skill exists solely for E2E testing of the compile command.
`,
  );

  await writeFile(
    path.join(skillDir, STANDARD_FILES.METADATA_YAML),
    `author: "@test"
displayName: web-testing-e2e-compile
slug: e2e-compile
contentHash: "e2e-test-hash"
`,
  );

  await writeProjectConfig(projectDir, {
    name: "e2e-compile-test",
    skills: [{ id: "web-testing-e2e-compile" as SkillId, scope: "project", source: "local" }],
    agents: [{ name: "web-developer", scope: "project" }, { name: "api-developer", scope: "project" }],
  });

  return { projectDir, agentsDir };
}

/**
 * Creates a minimal `.claude-src/config.ts` installation in the given directory.
 *
 * This satisfies `detectInstallation()` for commands that require an existing
 * installation (e.g., `new skill` when no `--output` flag is provided).
 */
export async function createMinimalInstallation(dir: string): Promise<void> {
  await writeProjectConfig(dir, { name: "test", domains: [] });
}

/** Write a config.ts file to the .claude-src/ directory of the given base dir. */
export async function writeProjectConfig(
  baseDir: string,
  config: Partial<ProjectConfig> & Pick<ProjectConfig, "name">,
): Promise<void> {
  const resolved: ProjectConfig = { skills: [], agents: [], ...config };
  const configDir = path.join(baseDir, CLAUDE_SRC_DIR);
  await mkdir(configDir, { recursive: true });
  await writeFile(
    path.join(configDir, STANDARD_FILES.CONFIG_TS),
    `export default ${JSON.stringify(resolved, null, 2)};\n`,
  );
}

export async function ensureBinaryExists(): Promise<void> {
  const binExists = await fileExists(BIN_RUN);
  if (!binExists) {
    throw new Error(
      `CLI binary not found at ${BIN_RUN}. Run 'npm run build' before running E2E tests.`,
    );
  }
}

/** Strip ANSI escape sequences from CLI output */
export function stripAnsi(text: string): string {
  return stripVTControlCharacters(text);
}

/**
 * Run a CLI command via the built binary and return stripped output.
 *
 * Wraps the common `execa("node", [BIN_RUN, ...args], { cwd, reject: false })`
 * pattern used across all non-interactive E2E command tests. All output fields
 * are pre-stripped of ANSI escape sequences.
 *
 * HOME is set to cwd by default to isolate tests from the user's real global
 * config (~/.claude-src/config.ts). Tests that need a different HOME can
 * override via options.env.
 */
export async function runCLI(
  args: string[],
  cwd: string,
  options?: { env?: Record<string, string | undefined> },
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  combined: string;
}> {
  const result = await execa("node", [BIN_RUN, ...args], {
    cwd,
    reject: false,
    env: { HOME: cwd, ...options?.env },
  });
  return {
    exitCode: result.exitCode ?? 1,
    stdout: stripAnsi(result.stdout),
    stderr: stripAnsi(result.stderr),
    combined: stripAnsi(result.stdout + result.stderr),
  };
}

export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    return await readdir(dirPath);
  } catch {
    return [];
  }
}

export async function readTestFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf-8");
}

/**
 * Creates a local skill directory under `<projectDir>/.claude/skills/<skillId>/`
 * with SKILL.md and optional metadata.yaml.
 *
 * Returns the absolute path to the skill directory.
 */
export async function createLocalSkill(
  projectDir: string,
  skillId: SkillId,
  options?: { description?: string; metadata?: string },
): Promise<string> {
  const skillDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, skillId);
  await mkdir(skillDir, { recursive: true });

  const description = options?.description ?? `A test skill`;
  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    `---\nname: ${skillId}\ndescription: ${description}\n---\n\n# ${skillId}\n`,
  );

  if (options?.metadata) {
    await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), options.metadata);
  }

  return skillDir;
}

/**
 * Creates the `.claude/settings.json` file with default allow permissions.
 *
 * This works around the permission checker that renders a blocking Ink component
 * after install completes (see FINDINGS.md, Finding 7). Without this file,
 * the PTY process never exits because the permission prompt waits for input.
 */
export async function createPermissionsFile(projectDir: string): Promise<void> {
  const claudeDir = path.join(projectDir, CLAUDE_DIR);
  await mkdir(claudeDir, { recursive: true });
  await writeFile(
    path.join(claudeDir, "settings.json"),
    JSON.stringify({ permissions: { allow: ["Read(*)"] } }),
  );
}

/**
 * Minimum viable project structure for the `edit` command.
 *
 * The edit command calls detectInstallation() which looks for
 * .claude-src/config.ts (or .claude/config.ts). It then
 * loads the project config for domains, agents, skills, etc.
 * and discovers installed plugin skills via discoverAllPluginSkills().
 *
 * For local mode, discoverAllPluginSkills() returns empty, so the
 * edit command falls back to projectConfig.config.skills.
 *
 * This helper creates the minimal file structure:
 *   <projectDir>/
 *     .claude-src/
 *       config.ts   (with name, skills, agents, domains)
 *     .claude/
 *       skills/
 *         <skillId>/
 *           SKILL.md
 *           metadata.yaml
 *       agents/       (empty, for recompilation target)
 */
export async function createEditableProject(
  tempDir: string,
  options?: {
    skills?: SkillId[];
    agents?: AgentName[];
    domains?: Domain[];
  },
): Promise<string> {
  const projectDir = path.join(tempDir, "project");
  const skills = options?.skills ?? ["web-framework-react"];
  const agents = options?.agents ?? ["web-developer"];
  const domains = options?.domains ?? ["web"];

  const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");

  await mkdir(skillsDir, { recursive: true });
  await mkdir(agentsDir, { recursive: true });

  // Skills must be SkillConfig[] objects (not bare strings) to pass Zod validation
  const skillConfigs = skills.map((id) => ({ id, scope: "project" as const, source: "local" }));
  const agentConfigs = agents.map((name) => ({ name, scope: "project" as const }));

  await writeProjectConfig(projectDir, {
    name: "test-edit-project",
    skills: skillConfigs,
    agents: agentConfigs,
    domains,
  });

  for (const skillId of skills) {
    const skillDir = path.join(skillsDir, skillId);
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      `---\nname: ${skillId}\ndescription: Test skill for E2E\n---\n\n# ${skillId}\n\nTest content.\n`,
    );

    // Derive category from skill ID (e.g., "web-framework-react" -> "web-framework")
    const parts = skillId.split("-");
    const category = parts.slice(0, 2).join("-");
    const slug = parts.slice(2).join("-") || skillId;

    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      `author: "@test"\ndisplayName: ${skillId}\ncategory: ${category}\nslug: ${slug}\ncontentHash: "e2e-hash-${skillId}"\n`,
    );
  }

  return projectDir;
}

/**
 * Creates two independent installations (global + project) for dual-scope compile tests.
 *
 * Structure:
 *   <tempDir>/
 *     global-home/                        <- fake HOME
 *       .claude-src/config.ts             <- global config
 *       .claude/skills/web-testing-e2e-global/
 *     project/                            <- project dir (cwd)
 *       .claude-src/config.ts             <- project config
 *       .claude/skills/web-testing-e2e-local/
 */
export async function createDualScopeProject(tempDir: string): Promise<{
  globalHome: string;
  projectDir: string;
}> {
  const globalHome = path.join(tempDir, "global-home");
  const projectDir = path.join(tempDir, "project");

  // --- Global installation ---
  await writeProjectConfig(globalHome, {
    name: "global-test",
    skills: [{ id: "web-testing-e2e-global", scope: "global", source: "local" }],
    agents: [{ name: "web-developer", scope: "global" }],
    domains: ["web"],
    stack: {
      "web-developer": {
        "web-testing": [{ id: "web-testing-e2e-global", preloaded: true }],
      },
    },
  });

  await createLocalSkill(globalHome, "web-testing-e2e-global", {
    description: "Global E2E skill for dual-scope testing",
    metadata: `author: "@test"\ncontentHash: "hash-global"\n`,
  });

  // --- Project installation ---
  await writeProjectConfig(projectDir, {
    name: "project-test",
    skills: [
      { id: "web-testing-e2e-local", scope: "project", source: "local" },
      { id: "web-testing-e2e-global", scope: "global", source: "local" },
    ],
    agents: [{ name: "api-developer", scope: "project" }],
    domains: ["web"],
    stack: {
      "api-developer": {
        "web-testing": [{ id: "web-testing-e2e-global", preloaded: true }],
        "web-mocking": [{ id: "web-testing-e2e-local", preloaded: true }],
      },
    },
  });

  await createLocalSkill(projectDir, "web-testing-e2e-local", {
    description: "Project-local E2E skill for dual-scope testing",
    metadata: `author: "@test"\ncontentHash: "hash-local"\n`,
  });

  return { globalHome, projectDir };
}

/**
 * Creates a project directory with a custom (non-marketplace) skill and
 * a config that references it via a custom category in the stack.
 *
 * This exercises the regression where Zod schema validation in
 * loadProjectConfigFromDir rejected custom skill IDs and category keys.
 *
 * The skill ID uses a valid prefix ("web-") so it passes downstream
 * validation in resolveAgentConfigToSkills, while remaining a custom
 * (non-marketplace) skill unknown to the built-in type unions.
 *
 * Structure:
 *   <projectDir>/
 *     .claude-src/
 *       config-types.ts   (auto-generated types including custom IDs)
 *       config.ts         (imports config-types, uses satisfies ProjectConfig)
 *     .claude/
 *       skills/
 *         web-custom-e2e-widget/
 *           SKILL.md
 *           metadata.yaml  (custom: true, domain: custom-e2e, category: web-custom-e2e)
 */
export async function createProjectWithCustomSkill(tempDir: string): Promise<{
  projectDir: string;
  agentsDir: string;
}> {
  const projectDir = path.join(tempDir, "project");
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");

  const configDir = path.join(projectDir, CLAUDE_SRC_DIR);
  const skillDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, "web-custom-e2e-widget");

  await mkdir(configDir, { recursive: true });
  await mkdir(skillDir, { recursive: true });

  // Auto-generated config-types.ts with custom skill ID and custom category
  const configTypesContent = `// AUTO-GENERATED by agentsinc — DO NOT EDIT

export type SkillId =
  // Custom
  | "web-custom-e2e-widget"
  // Marketplace
  | "web-framework-react";

export type AgentName =
  | "web-developer";

export type Domain =
  // Custom
  | "custom-e2e"
  // Marketplace
  | "web";

export type Category =
  | "web-custom-e2e"
  | "web-framework";

export type SkillConfig = { id: SkillId; scope: "project" | "global"; source: string };

export type SkillAssignment = SkillId | { id: SkillId; preloaded: boolean };

export type StackAgentConfig = Partial<Record<Category, SkillAssignment>>;

export type AgentScopeConfig = { name: AgentName; scope: "project" | "global" };

export interface ProjectConfig {
  version?: "1";
  name: string;
  description?: string;
  agents: AgentScopeConfig[];
  skills: SkillConfig[];
  author?: string;
  stack?: Partial<Record<AgentName, StackAgentConfig>>;
  source?: string;
  marketplace?: string;
  agentsSource?: string;
  domains?: Domain[];
  selectedAgents?: AgentName[];
}
`;

  await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_TYPES_TS), configTypesContent);

  // Config file that references custom skill and custom category
  const configContent = `import type { ProjectConfig } from "./config-types";

export default {
  name: "test-custom-skill-project",
  agents: [{ name: "web-developer", scope: "project" }],
  skills: [{ id: "web-custom-e2e-widget", scope: "project", source: "local" }],
  domains: ["web"],
  stack: {
    "web-developer": {
      "web-custom-e2e": {
        id: "web-custom-e2e-widget",
        preloaded: true,
      },
    },
  },
} satisfies ProjectConfig;
`;

  await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_TS), configContent);

  // Custom skill SKILL.md
  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    `---
name: web-custom-e2e-widget
description: A custom test widget skill
---

# Custom E2E Widget

Custom skill for E2E testing of custom skill ID handling.
`,
  );

  // Custom skill metadata.yaml with custom: true
  await writeFile(
    path.join(skillDir, STANDARD_FILES.METADATA_YAML),
    `custom: true
domain: custom-e2e
category: web-custom-e2e
slug: e2e-widget
author: "@test"
displayName: Custom E2E Widget
contentHash: "e2e-custom-hash"
`,
  );

  return { projectDir, agentsDir };
}
