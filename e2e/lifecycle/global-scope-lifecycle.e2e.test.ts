import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLAUDE_DIR, STANDARD_DIRS, STANDARD_FILES } from "../../src/cli/consts.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { verifyAgentCompiled, verifySkillCopiedLocally } from "../helpers/plugin-assertions.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  delay,
  ensureBinaryExists,
  EXIT_CODES,
  EXIT_WAIT_TIMEOUT_MS,
  KEYSTROKE_DELAY_MS,
  LIFECYCLE_TEST_TIMEOUT_MS,
  renderSkillMd,
  runCLI,
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  waitForRawText,
  WIZARD_LOAD_TIMEOUT_MS,
  writeProjectConfig,
  COMPILE_ENV,
  INSTALL_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * Global scope lifecycle E2E tests — regression coverage for scope-blind bugs.
 *
 * These tests verify that commands correctly handle both global-scoped and
 * project-scoped local skills. Each test targets a specific bug that was fixed:
 *
 * Bug 1 (source-loader.ts): Global local skills were only loaded as fallback.
 * Bug 4 (update.tsx): Only checked project-scoped local skills for updates.
 * Bug 5 (outdated.ts): Same as update — only checked project dir.
 * Bug 6 (diff.ts): Same pattern — only checked project dir.
 * Bug 7 (doctor.ts): False "missing" warnings for global-scoped items.
 * Bug 8 (uninstall.tsx): Uniform scope for all plugins — now per-skill.
 *
 * Architecture for all tests:
 *   tempDir/
 *     fake-home/                          <- HOME env var
 *       .claude-src/config.ts             <- global config
 *       .claude/skills/<global-skill>/    <- global-scoped local skills
 *       .claude/agents/web-developer.md   <- global-scoped agent
 *       .claude/settings.json             <- permissions
 *       project/                          <- project dir (CWD)
 *         .claude-src/config.ts           <- project config
 *         .claude/skills/<project-skill>/ <- project-scoped local skills
 *         .claude/agents/api-developer.md <- project-scoped agent
 *         .claude/settings.json           <- permissions
 */

/**
 * Creates the temp directory structure with dual-scope local skills
 * pre-installed (no wizard needed — directly sets up the file state).
 *
 * This avoids running the full init wizard twice, keeping tests fast.
 * The resulting state is equivalent to:
 *   Phase A: Init from HOME with all skills global-scoped
 *   Phase B: Init from project with api-framework-hono project-scoped
 *
 * Global scope (in fakeHome):
 *   - web-framework-react (local skill)
 *   - web-testing-vitest (local skill)
 *   - web-developer agent
 *
 * Project scope (in projectDir):
 *   - api-framework-hono (local skill)
 *   - api-developer agent
 */
async function createDualScopeInstallation(sourceDir: string): Promise<{
  tempDir: string;
  fakeHome: string;
  projectDir: string;
}> {
  const tempDir = await createTempDir();
  const fakeHome = path.join(tempDir, "fake-home");
  const projectDir = path.join(fakeHome, "project");

  await mkdir(fakeHome, { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await createPermissionsFile(fakeHome);
  await createPermissionsFile(projectDir);

  // --- Global installation at fakeHome ---
  await writeProjectConfig(fakeHome, {
    name: "global-test",
    skills: [
      { id: "web-framework-react", scope: "global", source: "local" },
      { id: "web-testing-vitest", scope: "global", source: "local" },
    ],
    agents: [{ name: "web-developer", scope: "global" }],
    domains: ["web"],
    stack: {
      "web-developer": {
        "web-framework": [{ id: "web-framework-react", preloaded: true }],
        "web-testing": [{ id: "web-testing-vitest", preloaded: true }],
      },
    },
  });

  // Create global local skills with forkedFrom metadata (needed for outdated/diff/update)
  await createLocalSkillWithForkedFrom(fakeHome, "web-framework-react", {
    slug: "react",
    category: "web-framework",
    contentHash: "a1b2c3d",
    sourceDir,
  });

  await createLocalSkillWithForkedFrom(fakeHome, "web-testing-vitest", {
    slug: "vitest",
    category: "web-testing",
    contentHash: "a1b2c3d",
    sourceDir,
  });

  // Create a simple global agent file
  const globalAgentsDir = path.join(fakeHome, CLAUDE_DIR, "agents");
  await mkdir(globalAgentsDir, { recursive: true });
  await writeFile(
    path.join(globalAgentsDir, "web-developer.md"),
    "---\nname: web-developer\ndescription: Web dev\n---\n\n# Web Developer\n\nTest content.",
  );

  // --- Project installation at projectDir ---
  await writeProjectConfig(projectDir, {
    name: "project-test",
    skills: [
      { id: "api-framework-hono", scope: "project", source: "local" },
      // Reference the global skills so they appear in the merged config
      { id: "web-framework-react", scope: "global", source: "local" },
      { id: "web-testing-vitest", scope: "global", source: "local" },
    ],
    agents: [
      { name: "api-developer", scope: "project" },
      { name: "web-developer", scope: "global" },
    ],
    domains: ["web", "api"],
    stack: {
      "web-developer": {
        "web-framework": [{ id: "web-framework-react", preloaded: true }],
        "web-testing": [{ id: "web-testing-vitest", preloaded: true }],
      },
      "api-developer": {
        "api-api": [{ id: "api-framework-hono", preloaded: true }],
      },
    },
  });

  await createLocalSkillWithForkedFrom(projectDir, "api-framework-hono", {
    slug: "hono",
    category: "api-api",
    contentHash: "b2c3d4e",
    sourceDir,
  });

  // Create project agent file
  const projectAgentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  await mkdir(projectAgentsDir, { recursive: true });
  await writeFile(
    path.join(projectAgentsDir, "api-developer.md"),
    "---\nname: api-developer\ndescription: API dev\n---\n\n# API Developer\n\nTest content.",
  );

  return { tempDir, fakeHome, projectDir };
}

/**
 * Creates a local skill with forkedFrom metadata in its metadata.yaml.
 * This is needed for `outdated`, `diff`, and `update` commands which
 * read forkedFrom to compare against the source.
 */
async function createLocalSkillWithForkedFrom(
  baseDir: string,
  skillId: string,
  options: {
    slug: string;
    category: string;
    contentHash: string;
    sourceDir: string;
  },
): Promise<void> {
  const skillDir = path.join(baseDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, skillId);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    renderSkillMd(skillId as any, `Test skill ${skillId}`, `# ${skillId}\n\nTest content.`),
  );

  await writeFile(
    path.join(skillDir, STANDARD_FILES.METADATA_YAML),
    `author: "@agents-inc"
displayName: ${skillId}
category: ${options.category}
slug: ${options.slug}
cliDescription: "E2E test skill"
usageGuidance: "Use when testing E2E scenarios"
contentHash: "${options.contentHash}"
forkedFrom:
  skillId: ${skillId}
  contentHash: "${options.contentHash}"
  date: 2026-01-01
`,
  );
}

// =====================================================================
// Test Suite 1 — Source Loader: Global local skills always merged
// (Regression test for bug 1: global local skills only loaded as fallback)
// =====================================================================

describe("global scope lifecycle — source loader merge", () => {
  let sourceDir: string;
  let sourceTempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, SETUP_TIMEOUT_MS * 2);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  it(
    "edit wizard should detect both global and project local skills after dual-scope init",
    { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createDualScopeInstallation(sourceDir);

      try {
        // Run edit from the project directory — the wizard should load BOTH:
        //   - global local skills from fakeHome/.claude/skills/
        //   - project local skills from projectDir/.claude/skills/
        const session = new TerminalSession(["edit", "--source", sourceDir], projectDir, {
          env: {
            HOME: fakeHome,
            AGENTSINC_SOURCE: undefined,
          },
          rows: 60,
          cols: 120,
        });

        try {
          // The edit wizard may start at build step or sources step depending
          // on the existing installation. Wait for either the build step
          // (shows "Framework") or the sources step (shows "Customize").
          // With a pre-populated config, it typically enters build step first.
          //
          // Use waitForRawText to handle either path — the key assertion is
          // that all skills from both scopes appear in the wizard output.

          // Wait for the wizard to load (either build or sources)
          await waitForRawText(session, "skills", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);

          const initialOutput = session.getRawOutput();

          // Navigate through whatever steps appear until we reach "Customize skill sources"
          // Press Enter repeatedly to advance through build steps
          if (!initialOutput.includes("Customize skill sources")) {
            // We're on the build step — advance through all domains
            for (let attempt = 0; attempt < 6; attempt++) {
              session.enter();
              await delay(STEP_TRANSITION_DELAY_MS);
              const output = session.getRawOutput();
              if (output.includes("Customize skill sources")) break;
            }
          }

          // Now on the Sources step — verify ALL skills from both scopes appear
          await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);

          const sourcesOutput = session.getRawOutput();

          // Global-scoped skills should be present
          expect(sourcesOutput).toContain("web-framework-react");
          expect(sourcesOutput).toContain("web-testing-vitest");

          // Project-scoped skill should also be present
          expect(sourcesOutput).toContain("api-framework-hono");

          session.enter();

          // Agents step
          await waitForRawText(session, "Select agents", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Confirm step
          await waitForRawText(session, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Wait for exit
          const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
          expect(exitCode).toBe(EXIT_CODES.SUCCESS);

          // After edit, verify both scopes of skills still exist on disk
          expect(await verifySkillCopiedLocally(fakeHome, "web-framework-react")).toBe(true);
          expect(await verifySkillCopiedLocally(fakeHome, "web-testing-vitest")).toBe(true);
          expect(await verifySkillCopiedLocally(projectDir, "api-framework-hono")).toBe(true);
        } finally {
          await session.destroy();
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );
});

// =====================================================================
// Test Suite 2 — Doctor: checks both project and global directories
// (Regression test for bug 7: false "missing" warnings for global items)
// =====================================================================

describe("global scope lifecycle — doctor command", () => {
  let sourceDir: string;
  let sourceTempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, SETUP_TIMEOUT_MS * 2);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  it("should not report false 'missing' for global-scoped agents", async () => {
    const { tempDir, fakeHome, projectDir } = await createDualScopeInstallation(sourceDir);

    try {
      // Run doctor from project directory with HOME pointing to fakeHome.
      // Doctor should check both project and global agent directories.
      // Before the fix, doctor only checked projectDir for agents, causing
      // false "missing" warnings for global-scoped agents like web-developer.
      const { exitCode, stdout } = await runCLI(["doctor", "--source", sourceDir], projectDir, {
        env: { HOME: fakeHome, ...COMPILE_ENV },
      });

      // Doctor should NOT report web-developer as missing
      // (it exists at fakeHome/.claude/agents/web-developer.md)
      expect(stdout).not.toContain("web-developer (missing)");

      // Doctor should find all agents compiled
      // The exact message depends on the doctor output format,
      // but it should show all agents as found
      expect(stdout).toContain("agents compiled");
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it("should not report false 'missing' for global-scoped skills", async () => {
    const { tempDir, fakeHome, projectDir } = await createDualScopeInstallation(sourceDir);

    try {
      // Run doctor from project directory.
      // Before the fix, doctor only ran discoverLocalSkills(projectDir),
      // missing global skills at ~/.claude/skills/.
      const { exitCode, stdout } = await runCLI(["doctor", "--source", sourceDir], projectDir, {
        env: { HOME: fakeHome, ...COMPILE_ENV },
      });

      // Doctor should find ALL skills — both global and project
      // It should NOT report web-framework-react or web-testing-vitest as missing
      expect(stdout).not.toContain("web-framework-react (not found)");
      expect(stdout).not.toContain("web-testing-vitest (not found)");

      // Doctor should report skills as found
      expect(stdout).toContain("skills found");
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// =====================================================================
// Test Suite 3 — Outdated: checks both project and global local skills
// (Regression test for bug 5: only checked project-scoped local skills)
// =====================================================================

describe("global scope lifecycle — outdated command", () => {
  let sourceDir: string;
  let sourceTempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, SETUP_TIMEOUT_MS * 2);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  it("should detect global-scoped local skills in outdated check", async () => {
    const { tempDir, fakeHome, projectDir } = await createDualScopeInstallation(sourceDir);

    try {
      // Run outdated --json from project directory with HOME pointing to fakeHome.
      // Before the fix, outdated only checked projectDir/.claude/skills/,
      // missing global skills at fakeHome/.claude/skills/.
      const { exitCode, stdout } = await runCLI(
        ["outdated", "--json", "--source", sourceDir],
        projectDir,
        { env: { HOME: fakeHome, ...COMPILE_ENV } },
      );

      // Parse JSON output
      const parsed = JSON.parse(stdout);
      const skillIds = parsed.skills.map((s: { id: string }) => s.id);

      // Global-scoped skills should be included in the results
      expect(skillIds).toContain("web-framework-react");
      expect(skillIds).toContain("web-testing-vitest");

      // Project-scoped skill should also be included
      expect(skillIds).toContain("api-framework-hono");

      // All 3 skills should be in results (may be current or outdated)
      expect(parsed.skills.length).toBeGreaterThanOrEqual(3);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it("should not warn 'No local skills found' when only global skills exist", async () => {
    const tempDir = await createTempDir();
    const fakeHome = path.join(tempDir, "fake-home");
    const projectDir = path.join(fakeHome, "project");

    try {
      await mkdir(fakeHome, { recursive: true });
      await mkdir(projectDir, { recursive: true });

      // Create ONLY global local skills — no project local skills
      await writeProjectConfig(fakeHome, {
        name: "global-only",
        skills: [{ id: "web-framework-react", scope: "global", source: "local" }],
        agents: [{ name: "web-developer", scope: "global" }],
        domains: ["web"],
      });

      // Write config at project level too (needed for detectInstallation)
      await writeProjectConfig(projectDir, {
        name: "project-ref",
        skills: [{ id: "web-framework-react", scope: "global", source: "local" }],
        agents: [{ name: "web-developer", scope: "global" }],
        domains: ["web"],
      });

      await createLocalSkillWithForkedFrom(fakeHome, "web-framework-react", {
        slug: "react",
        category: "web-framework",
        contentHash: "a1b2c3d",
        sourceDir,
      });

      // Run outdated from project dir — should NOT say "No local skills found"
      // because global local skills exist at HOME/.claude/skills/
      const { stdout, combined } = await runCLI(["outdated", "--source", sourceDir], projectDir, {
        env: { HOME: fakeHome, ...COMPILE_ENV },
      });

      // Before the fix, this would warn "No local skills found"
      expect(combined).not.toContain("No local skills found");

      // Should show the global skill in the output
      expect(combined).toContain("web-framework-react");
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// =====================================================================
// Test Suite 4 — Diff: checks both project and global local skills
// (Regression test for bug 6: only checked project-scoped local skills)
// =====================================================================

describe("global scope lifecycle — diff command", () => {
  let sourceDir: string;
  let sourceTempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, SETUP_TIMEOUT_MS * 2);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  it("should find global-scoped local skills when diffing", async () => {
    const { tempDir, fakeHome, projectDir } = await createDualScopeInstallation(sourceDir);

    try {
      // Run diff from project directory with HOME pointing to fakeHome.
      // Before the fix, diff only checked projectDir/.claude/skills/,
      // missing global skills at fakeHome/.claude/skills/.
      const { exitCode, combined } = await runCLI(["diff", "--source", sourceDir], projectDir, {
        env: { HOME: fakeHome, ...COMPILE_ENV },
      });

      // Diff should NOT say "No local skills found"
      expect(combined).not.toContain("No local skills found");

      // The diff command processes all local skills (both scopes).
      // It may exit with code 0 (no diffs) or code 1 (has diffs).
      // Since our test skills are generated by renderSkillMd() and may
      // differ from the E2E source SKILL.md content, diffs are expected.
      //
      // The key assertion is that global-scoped skills ARE processed
      // (not ignored). We verify by checking the output mentions global
      // skills. The diff output lists skill names regardless of diff status.
      expect(combined).toContain("web-framework-react");

      // Exit code 0 = no diffs, 1 = has diffs. Either is valid.
      expect([EXIT_CODES.SUCCESS, EXIT_CODES.ERROR]).toContain(exitCode);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it("should not warn 'No local skills found' when only global skills exist", async () => {
    const tempDir = await createTempDir();
    const fakeHome = path.join(tempDir, "fake-home");
    const projectDir = path.join(fakeHome, "project");

    try {
      await mkdir(fakeHome, { recursive: true });
      await mkdir(projectDir, { recursive: true });

      // Only global local skills — nothing in project dir
      await createLocalSkillWithForkedFrom(fakeHome, "web-framework-react", {
        slug: "react",
        category: "web-framework",
        contentHash: "a1b2c3d",
        sourceDir,
      });

      // Run diff from project dir
      const { combined } = await runCLI(["diff", "--source", sourceDir], projectDir, {
        env: { HOME: fakeHome, ...COMPILE_ENV },
      });

      // Before the fix, this would warn "No local skills found"
      expect(combined).not.toContain("No local skills found");
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// =====================================================================
// Test Suite 5 — Uninstall: per-skill scope from config
// (Regression test for bug 8: uniform scope for all plugins)
//
// This tests the local-mode uninstall behavior (no Claude CLI needed).
// The per-skill scope fix means that when uninstalling, each skill's
// scope is read from the config rather than using a uniform scope.
// For local mode, we verify that uninstall --yes removes skills and
// agents from the correct directories based on their config scope.
// =====================================================================

describe("global scope lifecycle — uninstall with dual scope", () => {
  let sourceDir: string;
  let sourceTempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, SETUP_TIMEOUT_MS * 2);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  it("should remove project-scoped skills from project dir via uninstall --yes", async () => {
    const { tempDir, fakeHome, projectDir } = await createDualScopeInstallation(sourceDir);

    try {
      // Run uninstall --yes from the project directory.
      // This should remove project-scoped skills and agents from projectDir
      // but leave global-scoped items in fakeHome untouched.
      const { exitCode, combined } = await runCLI(["uninstall", "--yes"], projectDir, {
        env: { HOME: fakeHome, ...COMPILE_ENV },
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("Uninstall complete!");

      // Project-scoped skill should be removed from project dir
      const projectSkillExists = await verifySkillCopiedLocally(projectDir, "api-framework-hono");
      expect(projectSkillExists).toBe(false);

      // Global-scoped skills should STILL exist at fakeHome
      // (uninstall from project dir should not touch HOME)
      const globalSkill1 = await verifySkillCopiedLocally(fakeHome, "web-framework-react");
      expect(globalSkill1, "Global-scoped skill should be preserved after project uninstall").toBe(
        true,
      );

      const globalSkill2 = await verifySkillCopiedLocally(fakeHome, "web-testing-vitest");
      expect(globalSkill2, "Global-scoped skill should be preserved after project uninstall").toBe(
        true,
      );

      // Global agent should STILL exist at fakeHome
      expect(await verifyAgentCompiled(fakeHome, "web-developer")).toBe(true);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// =====================================================================
// Test Suite 6 — Full init wizard with mixed scope → verify file placement
// (Regression test for bugs 1+2: source-loader merge + deleteAndCopySkills)
//
// This runs the actual init wizard with scope toggling to create a
// mixed-scope installation and verifies that:
//   - Global-scoped local skills end up at HOME/.claude/skills/
//   - Project-scoped local skills end up at project/.claude/skills/
// =====================================================================

describe("global scope lifecycle — init wizard with scope toggling", () => {
  let sourceDir: string;
  let sourceTempDir: string;
  let tempDir: string | undefined;
  let session: TerminalSession | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, SETUP_TIMEOUT_MS * 2);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  afterEach(async () => {
    await session?.destroy();
    session = undefined;
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined;
    }
  });

  it(
    "should place global-scoped local skills at HOME and project-scoped at project dir",
    { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
    async () => {
      tempDir = await createTempDir();
      const fakeHome = path.join(tempDir, "fake-home");
      const projectDir = path.join(fakeHome, "project");

      await mkdir(fakeHome, { recursive: true });
      await mkdir(projectDir, { recursive: true });
      await createPermissionsFile(fakeHome);
      await createPermissionsFile(projectDir);

      // Run init wizard from project dir with HOME pointing to fakeHome
      session = new TerminalSession(["init", "--source", sourceDir], projectDir, {
        env: {
          HOME: fakeHome,
          AGENTSINC_SOURCE: undefined,
        },
        rows: 60,
        cols: 120,
      });

      // Step 1: Stack selection — accept first stack
      await waitForRawText(session, "Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Step 2: Domain selection — accept defaults (Web, API, Shared)
      await waitForRawText(session, "Web", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Step 3: Build — Web domain
      // The first skill (web-framework-react) starts focused and defaults to global scope.
      // Press "s" to toggle it to project scope.
      await waitForRawText(session, "Web", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.write("s"); // Toggle web-framework-react to project scope
      await delay(KEYSTROKE_DELAY_MS);
      // web-testing-vitest stays global (default)
      session.enter();

      // Build — API domain (all skills stay global)
      await waitForRawText(session, "API", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Build — Shared domain (pass through)
      await waitForRawText(session, "Shared", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Step 4: Sources — set ALL to local
      await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.write("l"); // Set ALL to local
      await delay(KEYSTROKE_DELAY_MS);
      session.enter();

      // Step 5: Agents — accept defaults
      await waitForRawText(session, "Select agents", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Step 6: Confirm
      await waitForRawText(session, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Wait for installation to complete
      await waitForRawText(session, "initialized successfully", INSTALL_TIMEOUT_MS);
      const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // --- Scope-aware copy assertions ---

      // Project-scoped skill (web-framework-react, toggled with "s") should be in PROJECT dir
      const projectSkillExists = await verifySkillCopiedLocally(projectDir, "web-framework-react");
      expect(
        projectSkillExists,
        "Project-scoped skill (toggled) must be in project .claude/skills/",
      ).toBe(true);

      // Global-scoped skill (web-testing-vitest, stayed default) should be in HOME dir
      const globalSkillExists = await verifySkillCopiedLocally(fakeHome, "web-testing-vitest");
      expect(globalSkillExists, "Global-scoped skill must be in HOME .claude/skills/").toBe(true);

      // Cross-check: project-scoped skill should NOT be in HOME
      const projectSkillWrongLocation = await verifySkillCopiedLocally(
        fakeHome,
        "web-framework-react",
      );
      expect(
        projectSkillWrongLocation,
        "Project-scoped skill must NOT be in HOME .claude/skills/",
      ).toBe(false);

      // Cross-check: global skill should NOT be in project dir
      const globalSkillWrongLocation = await verifySkillCopiedLocally(
        projectDir,
        "web-testing-vitest",
      );
      expect(
        globalSkillWrongLocation,
        "Global-scoped skill must NOT be in project .claude/skills/",
      ).toBe(false);
    },
  );
});
