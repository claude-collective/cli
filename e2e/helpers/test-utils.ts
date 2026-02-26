import path from "path";
import { fileURLToPath } from "url";
import { mkdir, writeFile, readdir, readFile } from "fs/promises";
import { stripVTControlCharacters } from "node:util";
import { execa } from "execa";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  STANDARD_FILES,
  STANDARD_DIRS,
} from "../../src/cli/consts.js";
import {
  createTempDir as createTempDirBase,
  cleanupTempDir,
  fileExists,
  directoryExists,
} from "../../src/cli/lib/__tests__/test-fs-utils.js";
import { EXIT_CODES } from "../../src/cli/lib/exit-codes.js";
import type { AgentName, Domain, SkillId } from "../../src/cli/types/index.js";
import type { InstallMode } from "../../src/cli/lib/installation/installation.js";

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
export const WIZARD_LOAD_TIMEOUT_MS = 20_000;

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
 * This is the minimum viable setup for `compile --output`.
 *
 * Structure:
 *   <projectDir>/
 *     .claude/
 *       skills/
 *         web-testing-e2e-compile/
 *           SKILL.md
 *           metadata.yaml
 */
export async function createMinimalProject(tempDir: string): Promise<{
  projectDir: string;
  outputDir: string;
}> {
  const projectDir = path.join(tempDir, "project");
  const outputDir = path.join(tempDir, "output");
  const skillDir = path.join(
    projectDir,
    CLAUDE_DIR,
    STANDARD_DIRS.SKILLS,
    "web-testing-e2e-compile",
  );

  await mkdir(skillDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

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
contentHash: "e2e-test-hash"
`,
  );

  return { projectDir, outputDir };
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
    env: options?.env,
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
 * .claude-src/config.yaml (or .claude/config.yaml). It then
 * loads the project config for domains, agents, skills, etc.
 * and discovers installed plugin skills via discoverAllPluginSkills().
 *
 * For local mode, discoverAllPluginSkills() returns empty, so the
 * edit command falls back to projectConfig.config.skills.
 *
 * This helper creates the minimal file structure:
 *   <projectDir>/
 *     .claude-src/
 *       config.yaml   (with name, skills, agents, installMode)
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
    installMode?: InstallMode;
  },
): Promise<string> {
  const projectDir = path.join(tempDir, "project");
  const skills = options?.skills ?? ["web-framework-react"];
  const agents = options?.agents ?? ["web-developer"];
  const domains = options?.domains ?? ["web"];
  const installMode = options?.installMode ?? "local";

  const configDir = path.join(projectDir, CLAUDE_SRC_DIR);
  const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");

  await mkdir(configDir, { recursive: true });
  await mkdir(skillsDir, { recursive: true });
  await mkdir(agentsDir, { recursive: true });

  const configYaml = [
    `name: test-edit-project`,
    `installMode: ${installMode}`,
    `skills:`,
    ...skills.map((s) => `  - ${s}`),
    `agents:`,
    ...agents.map((a) => `  - ${a}`),
    `domains:`,
    ...domains.map((d) => `  - ${d}`),
  ].join("\n");

  await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_YAML), configYaml + "\n");

  for (const skillId of skills) {
    const skillDir = path.join(skillsDir, skillId);
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      `---\nname: ${skillId}\ndescription: Test skill for E2E\n---\n\n# ${skillId}\n\nTest content.\n`,
    );

    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      `author: "@test"\ncontentHash: "e2e-hash-${skillId}"\n`,
    );
  }

  return projectDir;
}
