import { mkdir } from "fs/promises";
import path from "path";
import { expect } from "vitest";
import { cleanupTempDir, createPermissionsFile, createTempDir } from "../helpers/test-utils.js";
import { EXIT_CODES } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";

export type DualScopeEnv = {
  fakeHome: string;
  projectDir: string;
  destroy: () => Promise<void>;
};

/**
 * Shared helpers for dual-scope lifecycle E2E tests.
 *
 * Used by:
 *   - global-scope-lifecycle.e2e.test.ts
 *   - dual-scope-edit-display.e2e.test.ts
 *   - dual-scope-edit-integrity.e2e.test.ts
 *   - config-scope-integrity.e2e.test.ts
 */

/**
 * Creates the temp directory structure for a dual-scope test.
 *
 *   tempDir/
 *     fake-home/
 *       .claude/settings.json
 *       project/
 *         .claude/settings.json
 */
export async function createTestEnvironment(): Promise<{
  tempDir: string;
  fakeHome: string;
  projectDir: string;
}> {
  const tempDir = await createTempDir();
  const fakeHome = path.join(tempDir, "fake-home");
  const projectDir = path.join(fakeHome, "project");

  await mkdir(fakeHome, { recursive: true });
  await mkdir(projectDir, { recursive: true });

  // Create permissions files to prevent permission prompt hang
  await createPermissionsFile(fakeHome);
  await createPermissionsFile(projectDir);

  return { tempDir, fakeHome, projectDir };
}

/**
 * Runs Phase A: Init from HOME directory, accepting all defaults.
 */
export async function initGlobal(
  sourceDir: string,
  sourceTempDir: string,
  homeDir: string,
): Promise<{ exitCode: number; output: string }> {
  const wizard = await InitWizard.launch({
    source: { sourceDir, tempDir: sourceTempDir },
    projectDir: homeDir,
    env: { HOME: homeDir },
  });

  try {
    const result = await wizard.completeWithDefaults();
    const exitCode = await result.exitCode;
    const output = result.rawOutput;
    await result.destroy();
    return { exitCode, output };
  } catch (e) {
    await wizard.destroy();
    throw e;
  }
}

/**
 * Runs Phase B: Init from project directory.
 * Toggles api-framework-hono skill and api-developer agent to project scope.
 */
export async function initProject(
  sourceDir: string,
  sourceTempDir: string,
  homeDir: string,
  projectDir: string,
  options?: { setLocal?: boolean },
): Promise<{ exitCode: number; output: string }> {
  const wizard = await InitWizard.launch({
    source: { sourceDir, tempDir: sourceTempDir },
    projectDir,
    env: { HOME: homeDir },
  });

  try {
    // Stack -> Domain -> Build
    const domain = await wizard.stack.selectFirstStack();
    const build = await domain.acceptDefaults();

    // Web domain (pass through, all skills stay global)
    await build.advanceDomain();

    // API domain: toggle first skill to project scope
    await build.toggleScopeOnFocusedSkill();

    // Advance through remaining domains (API -> Meta -> Sources)
    const sources = await build.passThroughAllDomainsGeneric();

    // Sources step -- optionally set ALL sources to local (default: yes)
    await sources.waitForReady();
    if (options?.setLocal !== false) {
      await sources.setAllLocal();
    }
    const agents = await sources.advance();

    // Agents step -- navigate to api-developer and toggle to project scope
    await agents.navigateCursorToAgent("API Developer");
    await agents.toggleScopeOnFocusedAgent();
    const confirm = await agents.advance("init");

    // Confirm step
    const result = await confirm.confirm();
    const exitCode = await result.exitCode;
    const output = result.rawOutput;
    await result.destroy();
    return { exitCode, output };
  } catch (e) {
    await wizard.destroy();
    throw e;
  }
}

/**
 * Runs Phase A + Phase B to establish dual-scope state.
 */
export async function setupDualScope(
  sourceDir: string,
  sourceTempDir: string,
  fakeHome: string,
  projectDir: string,
): Promise<void> {
  // Phase A: Init global
  const phaseA = await initGlobal(sourceDir, sourceTempDir, fakeHome);
  expect(phaseA.exitCode, `Phase A init failed: ${phaseA.output}`).toBe(EXIT_CODES.SUCCESS);

  // Phase B: Init project with scope toggling
  const phaseB = await initProject(sourceDir, sourceTempDir, fakeHome, projectDir);
  expect(phaseB.exitCode, `Phase B init failed: ${phaseB.output}`).toBe(EXIT_CODES.SUCCESS);
}

/**
 * Runs Phase A: Init from HOME directory with eject mode (local sources).
 * Like initGlobal() but navigates through sources step to set all local.
 */
export async function initGlobalWithEject(
  sourceDir: string,
  sourceTempDir: string,
  homeDir: string,
): Promise<{ exitCode: number; output: string }> {
  const wizard = await InitWizard.launch({
    source: { sourceDir, tempDir: sourceTempDir },
    projectDir: homeDir,
    env: { HOME: homeDir },
  });

  try {
    const domain = await wizard.stack.selectFirstStack();
    const build = await domain.acceptDefaults();
    const sources = await build.passThroughAllDomains();

    await sources.waitForReady();
    await sources.setAllLocal();
    const agents = await sources.advance();

    const confirm = await agents.acceptDefaults("init");
    const result = await confirm.confirm();
    const exitCode = await result.exitCode;
    const output = result.rawOutput;
    await result.destroy();
    return { exitCode, output };
  } catch (e) {
    await wizard.destroy();
    throw e;
  }
}

/**
 * Runs Phase A (with eject) + Phase B to establish dual-scope state
 * where all skills are installed in eject mode.
 */
export async function setupDualScopeWithEject(
  sourceDir: string,
  sourceTempDir: string,
  fakeHome: string,
  projectDir: string,
): Promise<void> {
  const phaseA = await initGlobalWithEject(sourceDir, sourceTempDir, fakeHome);
  expect(phaseA.exitCode, `Phase A init failed: ${phaseA.output}`).toBe(EXIT_CODES.SUCCESS);

  const phaseB = await initProject(sourceDir, sourceTempDir, fakeHome, projectDir);
  expect(phaseB.exitCode, `Phase B init failed: ${phaseB.output}`).toBe(EXIT_CODES.SUCCESS);
}

/**
 * Creates a complete dual-scope environment via wizard interactions
 * with eject mode for all skills. Returns a handle with destroy() for cleanup.
 */
export async function createDualScopeEnv(
  sourceDir: string,
  sourceTempDir: string,
): Promise<DualScopeEnv> {
  const { tempDir, fakeHome, projectDir } = await createTestEnvironment();
  await setupDualScopeWithEject(sourceDir, sourceTempDir, fakeHome, projectDir);
  return {
    fakeHome,
    projectDir,
    destroy: () => cleanupTempDir(tempDir),
  };
}

/**
 * Runs init in project directory with eject mode, but without toggling
 * any skills to project scope. All skills remain global-scoped.
 */
export async function initProjectAllGlobal(
  sourceDir: string,
  sourceTempDir: string,
  homeDir: string,
  projectDir: string,
): Promise<{ exitCode: number; output: string }> {
  const wizard = await InitWizard.launch({
    source: { sourceDir, tempDir: sourceTempDir },
    projectDir,
    env: { HOME: homeDir },
  });

  try {
    const domain = await wizard.stack.selectFirstStack();
    const build = await domain.acceptDefaults();
    const sources = await build.passThroughAllDomains();

    await sources.waitForReady();
    await sources.setAllLocal();
    const agents = await sources.advance();

    const confirm = await agents.acceptDefaults("init");
    const result = await confirm.confirm();
    const exitCode = await result.exitCode;
    const output = result.rawOutput;
    await result.destroy();
    return { exitCode, output };
  } catch (e) {
    await wizard.destroy();
    throw e;
  }
}

/**
 * Creates a global-only environment via wizard interactions with eject mode.
 * Phase A initializes the global home, Phase B initializes the project
 * with all skills remaining global-scoped (no scope toggling).
 */
export async function createGlobalOnlyEnv(
  sourceDir: string,
  sourceTempDir: string,
): Promise<DualScopeEnv> {
  const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

  const phaseA = await initGlobalWithEject(sourceDir, sourceTempDir, fakeHome);
  expect(phaseA.exitCode, `Phase A init failed: ${phaseA.output}`).toBe(EXIT_CODES.SUCCESS);

  const phaseB = await initProjectAllGlobal(sourceDir, sourceTempDir, fakeHome, projectDir);
  expect(phaseB.exitCode, `Phase B init failed: ${phaseB.output}`).toBe(EXIT_CODES.SUCCESS);

  return {
    fakeHome,
    projectDir,
    destroy: () => cleanupTempDir(tempDir),
  };
}
