import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { verifyAgentCompiled } from "../helpers/plugin-assertions.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  delay,
  ensureBinaryExists,
  EXIT_CODES,
  EXIT_WAIT_TIMEOUT_MS,
  fileExists,
  INSTALL_TIMEOUT_MS,
  KEYSTROKE_DELAY_MS,
  LIFECYCLE_TEST_TIMEOUT_MS,
  navigateInitWizardToCompletion,
  passThroughAllBuildDomains,
  readTestFile,
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  waitForRawText,
  WIZARD_LOAD_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * Config/scope integrity E2E tests.
 *
 * These tests verify fixes to five config/scope-related bugs:
 *
 * Item 1: Source priority preservation — saved `source: "local"` is not
 *         overridden by marketplace `primarySource` when re-opening edit.
 *
 * Item 5: Config merger preserving agent scope changes — `mergeConfigs()`
 *         now merges agents by name, so scope changes from edit are kept.
 *
 * Item 6: Old agent file deletion on scope change — after recompilation
 *         writes the new agent file to the correct scope directory, the
 *         stale copy in the old scope directory is deleted.
 *
 * Item 7: Stack scope leak filtering — global agents' stack entries only
 *         reference global-scoped skills. Project agents keep all references.
 *
 * Item 9: Global config includes all domains — domains are a UI concept
 *         that live entirely in the global config. Project config gets
 *         `domains: undefined`.
 *
 * Architecture for wizard-based tests:
 *   tempDir/
 *     fake-home/                          <- HOME env var
 *       .claude-src/config.ts             <- global config
 *       .claude/agents/                   <- global agents
 *       .claude/skills/                   <- global skills
 *       .claude/settings.json             <- permissions
 *       project/                          <- CWD for project-scoped operations
 *         .claude-src/config.ts           <- project config
 *         .claude/agents/                 <- project agents
 *         .claude/skills/                 <- project skills
 *         .claude/settings.json           <- permissions
 */

/**
 * Creates the temp directory structure for config-scope tests.
 */
async function createTestEnvironment(): Promise<{
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

  return { tempDir, fakeHome, projectDir };
}

/**
 * Runs init wizard from HOME, accepting defaults with all sources set to local.
 * This creates a global installation with `source: "local"` for all skills.
 */
/**
 * Runs init wizard from HOME, accepting all defaults with plugin source mode.
 */
async function initGlobal(
  sourceDir: string,
  homeDir: string,
): Promise<{ exitCode: number; output: string }> {
  const session = new TerminalSession(["init", "--source", sourceDir], homeDir, {
    env: {
      HOME: homeDir,
      AGENTSINC_SOURCE: undefined,
    },
  });

  try {
    await navigateInitWizardToCompletion(session);
    const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
    const output = session.getRawOutput();
    return { exitCode, output };
  } finally {
    await session.destroy();
  }
}

/**
 * Runs init wizard from HOME, accepting defaults with all sources set to local.
 * This creates a global installation with `source: "local"` for all skills.
 */
async function initGlobalWithLocalSource(
  sourceDir: string,
  homeDir: string,
): Promise<{ exitCode: number; output: string }> {
  const session = new TerminalSession(["init", "--source", sourceDir], homeDir, {
    env: {
      HOME: homeDir,
      AGENTSINC_SOURCE: undefined,
    },
  });

  try {
    // Stack selection
    await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Domain selection
    await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Build — advance through all 3 domains (Web, API, Shared)
    await session.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await session.waitForText("API", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await session.waitForText("Shared", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Sources — press "l" to set ALL sources to local.
    await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.write("l");
    await delay(KEYSTROKE_DELAY_MS);
    session.enter();

    // Agents — accept defaults
    await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Confirm
    await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "initialized successfully", INSTALL_TIMEOUT_MS);
    const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
    const output = session.getRawOutput();

    return { exitCode, output };
  } finally {
    await session.destroy();
  }
}

/**
 * Runs init wizard from project dir with mixed scope toggling.
 * Toggles api-framework-hono to project scope, api-developer to project scope.
 * Uses default plugin source mode.
 */
async function initProjectWithMixedScope(
  sourceDir: string,
  homeDir: string,
  projectDir: string,
): Promise<{ exitCode: number; output: string }> {
  const session = new TerminalSession(["init", "--source", sourceDir], projectDir, {
    env: {
      HOME: homeDir,
      AGENTSINC_SOURCE: undefined,
    },
  });

  try {
    // Stack selection
    await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Domain selection
    await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Build — Web domain (pass through, all global)
    await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Build — API domain: toggle first skill (api-framework-hono) to project scope
    await session.waitForText("API", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.write("s"); // Toggle to project scope
    await delay(KEYSTROKE_DELAY_MS);
    session.enter();

    // Build — Shared domain (pass through)
    await session.waitForText("Shared", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Sources — press "p" to force all sources to plugin mode.
    // Without this, skills may inherit source: "local" from the global config
    // or from wizard defaults, causing ENOENT during local skill copy.
    await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.write("p");
    await delay(KEYSTROKE_DELAY_MS);
    session.enter();

    // Agents — navigate to api-developer and toggle to project scope
    await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    for (let i = 0; i < 6; i++) {
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
    }
    session.write("s"); // Toggle api-developer to project scope
    await delay(KEYSTROKE_DELAY_MS);
    session.enter();

    // Confirm
    await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "initialized successfully", INSTALL_TIMEOUT_MS);
    const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
    const output = session.getRawOutput();

    return { exitCode, output };
  } finally {
    await session.destroy();
  }
}

// =====================================================================
// Test Suite 1 — Source priority preservation (Item 1)
// Regression: wizard-store.ts line 613 — saved source takes priority
// =====================================================================

describe("config-scope integrity — source priority preservation", () => {
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
    "should preserve source: local after edit re-open (not overridden by primarySource)",
    { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        // Phase A: Init from HOME with all sources set to local
        const initResult = await initGlobalWithLocalSource(sourceDir, fakeHome);
        expect(initResult.exitCode, `Init failed: ${initResult.output}`).toBe(EXIT_CODES.SUCCESS);

        // Verify Phase A: config has source: "local"
        const globalConfigPath = path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        const configAfterInit = await readTestFile(globalConfigPath);
        expect(configAfterInit).toContain('"local"');

        // Phase B: Edit from HOME — pass through without changes.
        // The fix ensures the wizard restores the saved `source: "local"`
        // instead of overriding with the marketplace primarySource.
        const session = new TerminalSession(["edit", "--source", sourceDir], fakeHome, {
          env: {
            HOME: fakeHome,
            AGENTSINC_SOURCE: undefined,
          },
          rows: 60,
          cols: 120,
        });

        try {
          // Build step — pass through all domains
          await passThroughAllBuildDomains(session);

          // Sources step — pass through WITHOUT pressing "p" or "l"
          // (the wizard should preserve the saved "local" source)
          await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Agents step — pass through
          await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Confirm step
          await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
          expect(exitCode).toBe(EXIT_CODES.SUCCESS);
        } finally {
          await session.destroy();
        }

        // Phase C: Verify config still has source: "local"
        const configAfterEdit = await readTestFile(globalConfigPath);

        // The generated config uses: const skills: SkillConfig[] = [ {...}, ... ];
        // Extract the skills array block
        const skillsMatch = configAfterEdit.match(
          /const skills[\s\S]*?\[([\s\S]*?)\];/,
        );
        expect(skillsMatch, "Config must have a skills variable").not.toBeNull();
        const skillsBlock = skillsMatch![1];

        // Every skill should still have source: "local" (not overridden by marketplace)
        const localSourceMatches = skillsBlock.match(/"source":"local"/g);
        expect(
          localSourceMatches,
          "All skills should retain source: local after edit",
        ).not.toBeNull();
        expect(localSourceMatches!.length).toBeGreaterThan(0);

        // No skill should have a non-local source (which would indicate override)
        const allSourceMatches = skillsBlock.match(/"source":"([^"]+)"/g) ?? [];
        for (const match of allSourceMatches) {
          expect(match).toContain('"local"');
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );
});

// =====================================================================
// Test Suite 2 — Agent scope change preserved through merge (Item 5)
//                + Old agent file deleted on scope change (Item 6)
// Regression: config-merger.ts lines 36-47 / edit.tsx lines 467-478
// =====================================================================

describe("config-scope integrity — agent scope change merge and file cleanup", () => {
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

  // Blocked by D-128: scope toggle from global context should be disabled (no-op).
  // Once D-128 is implemented, this test should assert that pressing S on a global
  // agent does NOT change its scope (no project exists to move it to).
  it.todo(
    "should ignore scope toggle on global agents when editing from global context",
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        // Phase A: Init from HOME (all global)
        const phaseA = await initGlobalWithLocalSource(sourceDir, fakeHome);
        expect(phaseA.exitCode, `Phase A failed: ${phaseA.output}`).toBe(EXIT_CODES.SUCCESS);

        // Verify Phase A: web-developer agent exists at global scope
        const globalWebDevPath = path.join(fakeHome, CLAUDE_DIR, "agents", "web-developer.md");
        expect(
          await fileExists(globalWebDevPath),
          "web-developer.md must exist in global after init",
        ).toBe(true);

        // Phase B: Edit from project dir — toggle web-developer agent from global to project scope.
        // First we need to init the project to create a project config.
        // Then edit with scope change.
        const session = new TerminalSession(["edit", "--source", sourceDir], projectDir, {
          env: {
            HOME: fakeHome,
            AGENTSINC_SOURCE: undefined,
          },
          rows: 60,
          cols: 120,
        });

        try {
          // Build step — pass through all domains
          await passThroughAllBuildDomains(session);

          // Sources step — pass through
          await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Agents step — navigate to web-developer and toggle to project scope.
          // Agents are alphabetical: api-developer, api-researcher, api-reviewer,
          // web-architecture, web-developer (index 4).
          await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          for (let i = 0; i < 4; i++) {
            session.arrowDown();
            await delay(KEYSTROKE_DELAY_MS);
          }
          session.write("s"); // Toggle web-developer to project scope
          await delay(KEYSTROKE_DELAY_MS);
          session.enter();

          // Confirm step
          await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
          const output = session.getRawOutput();
          expect(exitCode, `Edit failed: ${output}`).toBe(EXIT_CODES.SUCCESS);
        } finally {
          await session.destroy();
        }

        // Phase C: Assertions

        // Item 5 — Agent scope change preserved in merged config:
        // The project config should now contain web-developer with scope: "project"
        const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        if (await fileExists(projectConfigPath)) {
          const projectConfig = await readTestFile(projectConfigPath);
          // web-developer should be in the project config (moved from global)
          expect(projectConfig).toContain("web-developer");
        }

        // The global config should still have web-developer in the agents section
        // if it's still global-scoped, or NOT have it if it moved to project
        const globalConfigPath = path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        const globalConfig = await readTestFile(globalConfigPath);
        // After toggling web-developer to project scope, the global config
        // agents array should NOT contain web-developer.
        // Config format: const agents: AgentScopeConfig[] = [ {...}, ... ];
        const globalAgentsMatch = globalConfig.match(
          /const agents[\s\S]*?\[([\s\S]*?)\];/,
        );
        if (globalAgentsMatch) {
          expect(globalAgentsMatch[1]).not.toContain("web-developer");
        }

        // Item 6 — Old agent file deleted after scope change:
        // web-developer was global -> project. Old global file should be gone.
        expect(
          await fileExists(globalWebDevPath),
          "Old global web-developer.md should be deleted after scope change to project",
        ).toBe(false);

        // New file should exist at project scope
        expect(
          await verifyAgentCompiled(projectDir, "web-developer"),
          "web-developer.md must be compiled in project agents dir after scope change",
        ).toBe(true);
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );
});

// =====================================================================
// Test Suite 3 — Global stack only references global skills (Item 7)
// Regression: config-generator.ts lines 207-237
// =====================================================================

describe("config-scope integrity — global stack scope filtering", () => {
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

  // Blocked by D-123: project-scoped skills require local copy, but source path
  // doesn't resolve from consuming projects. Plugin mode can't place skills on disk
  // for compile either. Unblocked when D-123 is fixed.
  it.todo(
    "should not reference project-scoped skills in global config stack section",
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        // Phase A: Init from HOME with plugin mode (not local — local causes ENOENT in Phase B)
        const phaseA = await initGlobal(sourceDir, fakeHome);
        expect(phaseA.exitCode, `Phase A failed: ${phaseA.output}`).toBe(EXIT_CODES.SUCCESS);

        // Phase B: Init from project with mixed scope
        // api-framework-hono -> project scope, api-developer -> project scope
        const phaseB = await initProjectWithMixedScope(sourceDir, fakeHome, projectDir);
        expect(phaseB.exitCode, `Phase B failed: ${phaseB.output}`).toBe(EXIT_CODES.SUCCESS);

        // Phase C: Verify global config stack section

        const globalConfigPath = path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        const globalConfig = await readTestFile(globalConfigPath);

        // Extract stack section from global config
        // Config format: const stack: ... = { ... };
        const stackMatch = globalConfig.match(/const stack[\s\S]*?=\s*(\{[\s\S]*?\});/);

        if (stackMatch) {
          const stackBlock = stackMatch[1];

          // The global config stack should NOT reference project-scoped skills.
          // api-framework-hono was toggled to project scope, so it should not
          // appear in any global agent's stack entry.
          //
          // Note: web-developer is a global agent. Its stack should only
          // reference global-scoped skills (web-framework-react, web-testing-vitest, etc.)
          // NOT project-scoped skills (api-framework-hono).
          expect(stackBlock).not.toContain("api-framework-hono");
        }

        // The project config CAN reference both global and project skills in its stack
        const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        if (await fileExists(projectConfigPath)) {
          const projectConfig = await readTestFile(projectConfigPath);
          // Project config should have api-framework-hono (project-scoped skill)
          expect(projectConfig).toContain("api-framework-hono");
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );
});

// =====================================================================
// Test Suite 4 — All domains in global config (Item 9)
// Regression: config-generator.ts lines 246-254
// =====================================================================

describe("config-scope integrity — domains in global config only", () => {
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

  // Blocked by D-123: same as stack scope filtering test above —
  // mixed scope requires local copy which fails from consuming projects.
  it.todo(
    "should store ALL domains in global config and no domains in project config",
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        // Phase A: Init from HOME with plugin mode (not local — local causes ENOENT in Phase B)
        const phaseA = await initGlobal(sourceDir, fakeHome);
        expect(phaseA.exitCode, `Phase A failed: ${phaseA.output}`).toBe(EXIT_CODES.SUCCESS);

        // Phase B: Init from project with mixed scope
        // This creates skills across multiple domains (web, api, shared)
        const phaseB = await initProjectWithMixedScope(sourceDir, fakeHome, projectDir);
        expect(phaseB.exitCode, `Phase B failed: ${phaseB.output}`).toBe(EXIT_CODES.SUCCESS);

        // Phase C: Verify domain placement

        // Global config should contain ALL domains
        const globalConfigPath = path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        const globalConfig = await readTestFile(globalConfigPath);

        // All domains from the E2E stack (web, api, shared) should be in global config
        expect(globalConfig).toContain('"web"');
        expect(globalConfig).toContain('"api"');
        expect(globalConfig).toContain('"shared"');

        // Extract the domains array from global config
        // Config format: const domains: Domain[] = ["web", "api", "shared"];
        const globalDomainsMatch = globalConfig.match(/const domains[\s\S]*?=\s*\[([\s\S]*?)\];/);
        expect(globalDomainsMatch, "Global config must have a domains variable").not.toBeNull();
        const globalDomainsBlock = globalDomainsMatch![1];

        // All 3 domains should be in the global domains array
        expect(globalDomainsBlock).toContain('"web"');
        expect(globalDomainsBlock).toContain('"api"');
        expect(globalDomainsBlock).toContain('"shared"');

        // Project config should NOT have a domains array
        // (domains are a UI/preference concept stored in global config only)
        const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        if (await fileExists(projectConfigPath)) {
          const projectConfig = await readTestFile(projectConfigPath);

          // The project config should not have a domains variable at all,
          // or if it does, it should be empty.
          // Config format: const domains: Domain[] = [...];
          const projectDomainsMatch = projectConfig.match(/const domains[\s\S]*?=\s*\[([^\]]*)\]/);
          if (projectDomainsMatch) {
            // If domains key exists, the array should be empty
            const domainsContent = projectDomainsMatch[1].trim();
            expect(
              domainsContent,
              "Project config domains array should be empty (domains belong in global config)",
            ).toBe("");
          }
          // If no domains match at all, that's also correct (undefined/omitted)
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );
});

// =====================================================================
// Test Suite 5 — config-types.ts Domain type includes config.domains (Item 10)
// Regression: config-types-writer.ts line 304 — config.domains merged into Domain union
//
// When a config has domains: ["web", "api"] but only web-domain skills,
// the generated config-types.ts Domain type must include BOTH "web" and "api".
// Previously only skill-derived domains appeared (missing "api").
//
// Approach: Init from HOME with all defaults (installs all skills including api).
// Then manually remove api skills from the config while keeping domains: ["web", "api"].
// Run edit from HOME to trigger config-types.ts regeneration via writeScopedConfigs.
// Verify the Domain type includes "api" despite no api skills in the config.
// =====================================================================

describe("config-scope integrity — config-types Domain type includes config.domains", () => {
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
    "should include all config.domains in config-types.ts Domain type even when some domains have no skills",
    { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
    async () => {
      const tempDir = await createTempDir();
      const fakeHome = path.join(tempDir, "fake-home");

      await mkdir(fakeHome, { recursive: true });
      await createPermissionsFile(fakeHome);

      try {
        // Phase A: Init from HOME — accept all defaults.
        // The "a" key accepts all skills and advances to confirm.
        const sessionA = new TerminalSession(["init", "--source", sourceDir], fakeHome, {
          env: {
            HOME: fakeHome,
            AGENTSINC_SOURCE: undefined,
          },
        });

        try {
          // Stack selection
          await sessionA.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          sessionA.enter();

          // Domain selection
          await sessionA.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          sessionA.enter();

          // Build — "a" accepts all and advances to confirm
          await sessionA.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          sessionA.write("a");

          // Confirm — accept
          await waitForRawText(sessionA, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          sessionA.enter();

          await waitForRawText(sessionA, "initialized successfully", INSTALL_TIMEOUT_MS);
          const exitCodeA = await sessionA.waitForExit(EXIT_WAIT_TIMEOUT_MS);
          expect(exitCodeA, `Phase A init failed`).toBe(EXIT_CODES.SUCCESS);
        } finally {
          await sessionA.destroy();
        }

        // Phase B: Manually edit the config to remove api skills while keeping
        // domains: ["web", "api", "shared"]. This simulates the scenario where
        // the user selected the "api" domain but the scope split removed api
        // skills (they went to a project scope, leaving global with no api skills).
        const configPath = path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        const originalConfig = await readTestFile(configPath);

        // Remove api-framework-hono from the skills array.
        // The config.ts is a JS module with `export default { ... }`.
        // We need to remove the skill entry for api-framework-hono while keeping
        // "api" in the domains array.
        const modifiedConfig = originalConfig
          .replace(/\{[^}]*"id"\s*:\s*"api-framework-hono"[^}]*\},?\s*/g, "");

        await writeFile(configPath, modifiedConfig);

        // Verify modification: config should still have domains with "api"
        const verifyConfig = await readTestFile(configPath);
        expect(verifyConfig).toContain('"api"');
        expect(verifyConfig).not.toContain("api-framework-hono");

        // Phase C: Run edit from HOME — pass through without changes.
        // This triggers writeScopedConfigs which regenerates config-types.ts
        // using the modified config (has domains: ["web", "api", "shared"]
        // but no api-domain skills).
        const sessionB = new TerminalSession(["edit", "--source", sourceDir], fakeHome, {
          env: {
            HOME: fakeHome,
            AGENTSINC_SOURCE: undefined,
          },
          rows: 60,
          cols: 120,
        });

        try {
          // Build step — pass through all domains
          await passThroughAllBuildDomains(sessionB);

          // Sources step — pass through
          await sessionB.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          sessionB.enter();

          // Agents step — pass through
          await sessionB.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          sessionB.enter();

          // Confirm step
          await sessionB.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          sessionB.enter();

          const exitCodeB = await sessionB.waitForExit(EXIT_WAIT_TIMEOUT_MS);
          expect(exitCodeB, `Phase C edit failed`).toBe(EXIT_CODES.SUCCESS);
        } finally {
          await sessionB.destroy();
        }

        // Phase D: Verify config-types.ts Domain type includes ALL config.domains
        // (including "api" which has no skills but IS in config.domains)

        const configTypesPath = path.join(
          fakeHome,
          CLAUDE_SRC_DIR,
          STANDARD_FILES.CONFIG_TYPES_TS,
        );
        expect(
          await fileExists(configTypesPath),
          "config-types.ts must exist after edit",
        ).toBe(true);

        const configTypesContent = await readTestFile(configTypesPath);

        // The file must be auto-generated
        expect(configTypesContent).toContain("AUTO-GENERATED");

        // Extract the Domain type union from config-types.ts
        // Format: export type Domain = \n  | "api"\n  | "shared"\n  | "web";
        const domainTypeMatch = configTypesContent.match(
          /export type Domain\s*=\s*([\s\S]*?);/,
        );
        expect(domainTypeMatch, "config-types.ts must contain a Domain type").not.toBeNull();
        const domainTypeBlock = domainTypeMatch![1];

        // All 3 domains must appear in the Domain type — including "api"
        // which has no skills but is in config.domains
        expect(domainTypeBlock).toContain('"web"');
        expect(domainTypeBlock).toContain('"api"');
        expect(domainTypeBlock).toContain('"shared"');
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );
});
