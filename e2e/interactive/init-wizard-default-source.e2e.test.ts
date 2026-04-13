import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { TIMEOUTS, EXIT_CODES, STEP_TEXT } from "../pages/constants.js";
import {
  cleanupTempDir,
  createTempDir,
  ensureBinaryExists,
  isClaudeCLIAvailable,
} from "../helpers/test-utils.js";
import "../matchers/setup.js";

/**
 * E2E tests for the init wizard DEFAULT SOURCE code path.
 *
 * ALL existing init E2E tests use `--source <tempDir>`, which bypasses the
 * `DEFAULT_SOURCE` / `BUILT_IN_MATRIX` code path entirely.
 */

const claudeAvailable = await isClaudeCLIAvailable();

/** D-122: Auto-update marketplace before plugin install */
describe.skipIf(!claudeAvailable)("init wizard — stale marketplace update", () => {
  let fixtureV1: E2EPluginSource;
  let fixtureV2: E2EPluginSource;
  let wizard: InitWizard | undefined;
  let sharedHome: string | undefined;

  const SHARED_MARKETPLACE_NAME = `e2e-test-stale-${Date.now()}`;

  beforeAll(async () => {
    await ensureBinaryExists();
    sharedHome = await createTempDir();

    fixtureV1 = await createE2EPluginSource({
      marketplaceName: SHARED_MARKETPLACE_NAME,
    });
    fixtureV2 = await createE2EPluginSource({
      marketplaceName: SHARED_MARKETPLACE_NAME,
    });
  }, TIMEOUTS.SETUP);

  afterAll(async () => {
    if (fixtureV1) await cleanupTempDir(fixtureV1.tempDir);
    if (fixtureV2) await cleanupTempDir(fixtureV2.tempDir);
    if (sharedHome) await cleanupTempDir(sharedHome);
  });

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;
  });

  it("should register marketplace on first init (v1)", async () => {
    wizard = await InitWizard.launch({
      source: { sourceDir: fixtureV1.sourceDir, tempDir: fixtureV1.tempDir },
      env: { HOME: sharedHome },
    });

    const result = await wizard.completeWithDefaults();
    expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

    const output = result.output;
    expect(output).toContain(STEP_TEXT.INIT_SUCCESS);
    expect(output).toContain("Registering marketplace");

    await expect(result.project).toHaveConfig({
      skillIds: ["web-framework-react"],
      agents: ["web-developer"],
    });
  });

  it(
    "should update marketplace on second init (v2) without errors",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      // First run: register marketplace with v1
      const wizardV1 = await InitWizard.launch({
        source: { sourceDir: fixtureV1.sourceDir, tempDir: fixtureV1.tempDir },
        env: { HOME: sharedHome },
      });
      const resultV1 = await wizardV1.completeWithDefaults();
      expect(await resultV1.exitCode).toBe(EXIT_CODES.SUCCESS);
      await wizardV1.destroy();

      // Second run: init with v2 source, same marketplace
      wizard = await InitWizard.launch({
        source: { sourceDir: fixtureV2.sourceDir, tempDir: fixtureV2.tempDir },
        env: { HOME: sharedHome },
      });
      const result = await wizard.completeWithDefaults();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      const output = result.output;
      expect(output).toContain(STEP_TEXT.INIT_SUCCESS);
      expect(output).not.toContain("Registering marketplace");
      expect(output).not.toContain("Failed to");

      await expect(result.project).toHaveConfig({
        skillIds: ["web-framework-react"],
        agents: ["web-developer"],
      });
    },
  );
});

/** D-123: Eject mode ENOENT on consuming projects */
describe("init wizard — default source eject mode ENOENT", () => {
  let wizard: InitWizard | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;
  });

  it(
    "should complete init with default source without ENOENT",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      wizard = await InitWizard.launch({
        noSource: true,
        env: { CC_SOURCE: undefined },
      });

      // Use acceptStackDefaults() — selects first stack and presses "A" to
      // accept defaults, skipping domain traversal (BUILT_IN_MATRIX has more
      // domains than the E2E fixture so passThroughAllDomains() doesn't work).
      const result = await wizard.acceptStackDefaults();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      const output = result.output;
      expect(output).toContain(STEP_TEXT.INIT_SUCCESS);
      expect(output).not.toContain("ENOENT");
      await expect(result.project).toHaveConfig({
        source: "agents-inc",
        agents: ["web-developer", "api-developer"],
      });
    },
  );

  it("should load wizard with BUILT_IN_MATRIX when no source is provided", async () => {
    wizard = await InitWizard.launch({
      noSource: true,
      env: { CC_SOURCE: undefined },
    });

    const screen = wizard.stack.getScreen();
    // BUILT_IN_MATRIX should contain real stacks (e.g., "Next.js Full-Stack")
    expect(screen).toContain("Next.js");
  });
});
