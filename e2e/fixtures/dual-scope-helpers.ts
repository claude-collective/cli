import { mkdir } from "fs/promises";
import path from "path";
import { expect } from "vitest";
import { createPermissionsFile, createTempDir } from "../helpers/test-utils.js";
import { EXIT_CODES } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";

/**
 * Shared helpers for dual-scope lifecycle E2E tests.
 *
 * Used by:
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
    await build.advanceDomain();

    // Shared domain (pass through)
    const sources = await build.advanceToSources();

    // Sources step -- press "l" to set ALL sources to local
    await sources.waitForReady();
    await sources.setAllLocal();
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
