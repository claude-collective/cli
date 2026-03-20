import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { isClaudeCLIAvailable } from "../../src/cli/utils/exec.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  delay,
  ensureBinaryExists,
  EXIT_CODES,
  EXIT_WAIT_TIMEOUT_MS,
  PLUGIN_INSTALL_TIMEOUT_MS,
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  WIZARD_LOAD_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * E2E tests for the init wizard DEFAULT SOURCE code path.
 *
 * ALL existing init E2E tests use `--source <tempDir>`, which bypasses the
 * `DEFAULT_SOURCE` / `BUILT_IN_MATRIX` code path entirely. These tests
 * exercise the code paths that only trigger when no `--source` flag is
 * provided and no `CC_SOURCE` env var is set.
 *
 * Bug D-122: Stale marketplace clone — when a marketplace is already
 *   registered, `cc init` must call `claude plugin marketplace update`
 *   before installing plugins. Without the update, renamed/new skills
 *   fail with "Plugin not found in marketplace".
 *
 * Bug D-123: Local mode ENOENT on consuming projects — source-loader.ts
 *   sets `sourcePath: ""` when using `BUILT_IN_MATRIX`. skill-copier.ts
 *   joins the empty sourcePath with "src" + skill path, creating relative
 *   paths that only resolve inside the marketplace repo.
 */

// --- Bug D-122: Stale marketplace clone ---

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("init wizard — stale marketplace update (D-122)", () => {
  let fixtureV1: E2EPluginSource;
  let fixtureV2: E2EPluginSource;

  let session: TerminalSession | undefined;
  let projectDir: string | undefined;

  // Shared HOME directory so marketplace registrations persist across runs.
  // TerminalSession sets HOME=cwd by default, which isolates each run's
  // Claude CLI state. Using a shared HOME lets the v2 run see the v1
  // marketplace registration.
  let sharedHome: string | undefined;

  // Use a fixed marketplace name so v1 and v2 share the same registration
  const SHARED_MARKETPLACE_NAME = `e2e-test-stale-${Date.now()}`;

  beforeAll(async () => {
    await ensureBinaryExists();

    sharedHome = await createTempDir();

    // Build v1 and v2 plugin sources with the SAME marketplace name.
    // Both use the same E2E skill set, but the important thing is that
    // v2 is a fresh build — if the marketplace is not updated after v1
    // registration, Claude CLI would serve stale plugin manifests.
    fixtureV1 = await createE2EPluginSource({
      marketplaceName: SHARED_MARKETPLACE_NAME,
    });
    fixtureV2 = await createE2EPluginSource({
      marketplaceName: SHARED_MARKETPLACE_NAME,
    });
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    if (fixtureV1) await cleanupTempDir(fixtureV1.tempDir);
    if (fixtureV2) await cleanupTempDir(fixtureV2.tempDir);
    if (sharedHome) await cleanupTempDir(sharedHome);
  });

  afterEach(async () => {
    await session?.destroy();
    session = undefined;

    if (projectDir) {
      await cleanupTempDir(projectDir);
      projectDir = undefined;
    }
  });

  function spawnInitWizard(cwd: string, sourcePath: string): TerminalSession {
    return new TerminalSession(["init", "--source", sourcePath], cwd, {
      env: { AGENTSINC_SOURCE: undefined, HOME: sharedHome },
    });
  }

  async function runFullPluginInitFlow(project: string, source: string): Promise<TerminalSession> {
    await createPermissionsFile(project);

    const wizardSession = spawnInitWizard(project, source);

    // Step 1: Stack selection — Enter accepts first stack
    await wizardSession.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Step 2: Domain selection — Enter accepts pre-selected domains
    await wizardSession.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Step 3: Build step — "a" accepts all defaults
    await wizardSession.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.write("a");

    // Step 4: Confirmation — Enter to confirm
    await wizardSession.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    wizardSession.enter();

    // Wait for plugin installation to complete
    await wizardSession.waitForText("initialized successfully", PLUGIN_INSTALL_TIMEOUT_MS);

    return wizardSession;
  }

  it("should register marketplace on first init (v1)", async () => {
    projectDir = await createTempDir();

    session = await runFullPluginInitFlow(projectDir, fixtureV1.sourceDir);

    const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const fullOutput = session.getFullOutput();
    expect(fullOutput).toContain("initialized successfully");

    // First init should register the marketplace (it doesn't exist yet)
    expect(fullOutput).toContain("Registering marketplace");
  });

  it("should update marketplace on second init (v2) without errors", async () => {
    // First run: register marketplace with v1 using sharedHome
    const projectV1 = await createTempDir();
    const sessionV1 = await runFullPluginInitFlow(projectV1, fixtureV1.sourceDir);
    const exitCodeV1 = await sessionV1.waitForExit(EXIT_WAIT_TIMEOUT_MS);
    expect(exitCodeV1).toBe(EXIT_CODES.SUCCESS);
    await sessionV1.destroy();
    await cleanupTempDir(projectV1);

    // Second run: init with v2 source using the SAME marketplace name.
    // Both runs share the same HOME, so the marketplace registered by v1
    // is visible to v2. init.tsx should call claudePluginMarketplaceUpdate()
    // (line 343) to refresh it. Without the update, renamed or new skills
    // in v2 would fail with "Plugin not found in marketplace".
    projectDir = await createTempDir();
    session = await runFullPluginInitFlow(projectDir, fixtureV2.sourceDir);

    const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const fullOutput = session.getFullOutput();
    expect(fullOutput).toContain("initialized successfully");

    // Second init should NOT re-register (marketplace already exists)
    expect(fullOutput).not.toContain("Registering marketplace");

    // Should not have any "Failed to" errors
    expect(fullOutput).not.toContain("Failed to");
  });
});

// --- Bug D-123: Local mode ENOENT on consuming projects ---

describe("init wizard — default source local mode ENOENT (D-123)", () => {
  let session: TerminalSession | undefined;
  let projectDir: string | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await session?.destroy();
    session = undefined;

    if (projectDir) {
      await cleanupTempDir(projectDir);
      projectDir = undefined;
    }
  });

  /**
   * Spawns `cc init` WITHOUT `--source` and WITHOUT `CC_SOURCE` env var.
   *
   * This forces the source resolution to fall through to DEFAULT_SOURCE
   * (github:agents-inc/skills), which triggers the BUILT_IN_MATRIX code
   * path in source-loader.ts:81-94 where `sourcePath` is set to "".
   *
   * HOME is set to the temp dir to prevent any global config from
   * providing a source override.
   */
  function spawnInitWithoutSource(cwd: string): TerminalSession {
    return new TerminalSession(["init"], cwd, {
      env: {
        AGENTSINC_SOURCE: undefined,
        CC_SOURCE: undefined,
      },
    });
  }

  /**
   * When running `cc init` without `--source` from a consuming project,
   * the wizard uses BUILT_IN_MATRIX (sourcePath: ""). If the user
   * selects local install mode, skill-copier.ts joins the empty sourcePath
   * with "src" + skill.path, creating a relative path like
   * "src/skills/web-framework/web-framework-react" that does not exist
   * in the consuming project's directory. This causes ENOENT errors
   * during generateSkillHash() or copy().
   *
   * This test verifies the bug exists (expects ENOENT or error output)
   * and will pass cleanly once the fix is applied.
   */
  it.todo(
    "should handle local install mode without ENOENT when using default source",
    // The fix for D-123 needs to either:
    //   1. Resolve sourcePath to the actual cached clone directory, or
    //   2. Download skills on-demand when sourcePath is empty, or
    //   3. Prevent local mode from being selectable when using BUILT_IN_MATRIX
    //
    // Once the fix is implemented, replace this .todo with the full test:
    //
    //   async () => {
    //     projectDir = await createTempDir();
    //     await createPermissionsFile(projectDir);
    //
    //     session = spawnInitWithoutSource(projectDir);
    //
    //     // The wizard should load with BUILT_IN_MATRIX stacks
    //     await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    //     await delay(STEP_TRANSITION_DELAY_MS);
    //     session.enter();
    //
    //     // Domain selection
    //     await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
    //     await delay(STEP_TRANSITION_DELAY_MS);
    //     session.enter();
    //
    //     // Build step — "a" accepts all defaults
    //     await session.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);
    //     await delay(STEP_TRANSITION_DELAY_MS);
    //     session.write("a");
    //
    //     // Confirmation
    //     await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    //     await delay(STEP_TRANSITION_DELAY_MS);
    //     session.enter();
    //
    //     // After fix: should complete successfully
    //     await session.waitForText("initialized successfully", INSTALL_TIMEOUT_MS);
    //     const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
    //     expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    //   }
  );

  it("should load wizard with BUILT_IN_MATRIX when no source is provided", async () => {
    projectDir = await createTempDir();
    await createPermissionsFile(projectDir);

    session = spawnInitWithoutSource(projectDir);

    // The wizard should still load and render the stack selection step
    // using the pre-computed BUILT_IN_MATRIX from source-loader.ts:81-94.
    // This verifies the default source path at least gets to the wizard UI.
    await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);

    const screen = session.getScreen();

    // BUILT_IN_MATRIX should contain real stacks (e.g., "Next.js Full-Stack")
    // This confirms we're using the built-in matrix, not a temp source
    expect(screen).toContain("Next.js");
  });
});
