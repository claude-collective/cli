import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { expectPhaseSuccess } from "../assertions/phase-assertions.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import "../matchers/setup.js";
import { DIRS, EXIT_CODES, FILES, TIMEOUTS } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import {
  cleanupTempDir,
  createTempDir,
  ensureBinaryExists,
  isClaudeCLIAvailable,
  readTestFile,
} from "../helpers/test-utils.js";

/**
 * Preloaded flag preservation across init and edit lifecycle.
 *
 * Gaps 10, 11, 12: Verifies that `preloaded: true` flags from the stack YAML
 * survive init, edit passthrough, and edit with skill additions.
 *
 * The E2E source stack assigns preloaded: true to web-framework-react (via
 * createMockSkillAssignment("web-framework-react", true)) and to
 * api-framework-hono (via createMockSkillAssignment("api-framework-hono", true)).
 *
 * Config.ts uses compact stack assignments: preloaded: true skills are stored as
 * { "id": "...", "preloaded": true }, while preloaded: false skills are stored
 * as bare strings. This test asserts on the presence of the full object form.
 */

/**
 * Extracts the stack JSON from config.ts by finding the `const stack` declaration
 * and parsing its value. Returns the parsed stack object.
 */
function extractStack(configContent: string): Record<string, Record<string, unknown[]>> {
  // Find the start of the stack assignment
  const marker = "const stack";
  const startIdx = configContent.indexOf(marker);
  expect(startIdx, "Expected config.ts to contain a stack variable declaration").not.toBe(-1);

  // Find the opening brace after the `=`
  const eqIdx = configContent.indexOf("=", startIdx);
  const braceIdx = configContent.indexOf("{", eqIdx);

  // Track braces to find the matching closing brace
  let depth = 0;
  let endIdx = braceIdx;
  for (let i = braceIdx; i < configContent.length; i++) {
    if (configContent[i] === "{") depth++;
    if (configContent[i] === "}") depth--;
    if (depth === 0) {
      endIdx = i + 1;
      break;
    }
  }

  const stackJson = configContent.slice(braceIdx, endIdx);
  return JSON.parse(stackJson) as Record<string, Record<string, unknown[]>>;
}

/**
 * Asserts that a given skill ID appears as a preloaded assignment within
 * a specific agent's category in the config.ts stack.
 *
 * The compact format means preloaded: true -> { "id": "...", "preloaded": true }
 * and preloaded: false -> bare string ID. So we check for the object form.
 */
function assertPreloadedInStack(
  configContent: string,
  agentName: string,
  category: string,
  skillId: string,
): void {
  const stack = extractStack(configContent);

  expect(stack[agentName], `Expected stack to contain agent "${agentName}"`).toBeDefined();

  const agentConfig = stack[agentName];
  expect(
    agentConfig[category],
    `Expected stack to contain category "${category}" under agent "${agentName}"`,
  ).toBeDefined();

  const assignments = agentConfig[category];
  const preloadedEntry = assignments.find(
    (a) =>
      typeof a === "object" &&
      a !== null &&
      (a as Record<string, unknown>).id === skillId &&
      (a as Record<string, unknown>).preloaded === true,
  );

  expect(
    preloadedEntry,
    `Expected skill "${skillId}" to have preloaded: true in stack under ${agentName}/${category}.\nAssignments: ${JSON.stringify(assignments)}`,
  ).toBeDefined();
}

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("preloaded preservation across init and edit", () => {
  let fixture: E2EPluginSource;

  beforeAll(async () => {
    await ensureBinaryExists();
    fixture = await createE2EPluginSource();
  }, TIMEOUTS.SETUP * 2);

  afterAll(async () => {
    if (fixture) await cleanupTempDir(fixture.tempDir);
  });

  describe("init and edit passthrough", () => {
    let tempDir: string | undefined;

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
        tempDir = undefined;
      }
    });

    it(
      "should preserve preloaded: true flags from stack through init and edit passthrough",
      { timeout: TIMEOUTS.LIFECYCLE, retry: 0 },
      async () => {
        tempDir = await createTempDir();
        const projectDir = tempDir;
        const configPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);

        // ================================================================
        // Phase A: Stack-picked init
        // ================================================================

        const initWizard = await InitWizard.launch({
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
          projectDir,
        });
        const initResult = await initWizard.completeWithDefaults();
        await initResult.destroy();

        await expectPhaseSuccess(
          { project: { dir: projectDir }, exitCode: initResult.exitCode },
          {
            skillIds: ["web-framework-react"],
            agents: ["web-developer"],
            source: fixture.marketplaceName,
          },
        );

        // Verify preloaded flags in config after init
        const configAfterInit = await readTestFile(configPath);

        assertPreloadedInStack(
          configAfterInit,
          "web-developer",
          "web-framework",
          "web-framework-react",
        );
        assertPreloadedInStack(configAfterInit, "api-developer", "api-api", "api-framework-hono");

        // ================================================================
        // Phase B: Edit passthrough (no changes)
        // ================================================================

        const editWizard = await EditWizard.launch({
          projectDir,
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
        });
        const editResult = await editWizard.passThrough();
        await editResult.destroy();

        expect(await editResult.exitCode).toBe(EXIT_CODES.SUCCESS);

        // Verify preloaded flags survive edit passthrough
        const configAfterEdit = await readTestFile(configPath);

        assertPreloadedInStack(
          configAfterEdit,
          "web-developer",
          "web-framework",
          "web-framework-react",
        );
        assertPreloadedInStack(configAfterEdit, "api-developer", "api-api", "api-framework-hono");
      },
    );
  });
});
