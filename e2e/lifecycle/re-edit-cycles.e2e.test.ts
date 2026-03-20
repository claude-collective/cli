import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import type { SkillId } from "../../src/cli/types/index.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  cleanupTempDir,
  createEditableProject,
  createPermissionsFile,
  createTempDir,
  delay,
  ensureBinaryExists,
  EXIT_CODES,
  EXIT_WAIT_TIMEOUT_MS,
  fileExists,
  LIFECYCLE_TEST_TIMEOUT_MS,
  navigateEditWizardToCompletion,
  navigateInitWizardToCompletion,
  readTestFile,
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  WIZARD_LOAD_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * Re-edit / multiple edit cycle E2E tests.
 *
 * Verifies that running `cc edit` multiple times on the same installation
 * does not corrupt the config: no duplicate skills, agents, or domains
 * accumulate across edits.
 *
 * Gap 5 from e2e-test-gaps.md.
 */

/**
 * Parses a config.ts file and extracts skill IDs, agent names, and domains
 * for duplicate detection and structural comparison.
 *
 * The CLI writes config in two formats:
 *
 * 1. Real CLI format (after init/edit): Uses typed named variables above export default:
 *    ```
 *    const skills: SkillConfig[] = [ {...}, {...} ];
 *    const agents: AgentScopeConfig[] = [ {...}, {...} ];
 *    const domains: Domain[] = ["web", "api"];
 *    export default { skills, agents, ... } satisfies ProjectConfig;
 *    ```
 *
 * 2. Test helper format (from renderConfigTs): Uses inline JSON:
 *    ```
 *    export default { "skills": [...], "agents": [...], ... };
 *    ```
 *
 * This parser handles both by extracting from named variable declarations
 * first, falling back to parsing the export default as JSON.
 */
function parseConfigArrays(configContent: string): {
  skillIds: SkillId[];
  agentNames: string[];
  domains: string[];
} {
  const skillIds: SkillId[] = [];
  const agentNames: string[] = [];
  const domains: string[] = [];

  // Strategy 1: Extract from typed named variable declarations (real CLI format)
  const skillsBlockMatch = configContent.match(
    /const skills:\s*SkillConfig\[\]\s*=\s*\[([\s\S]*?)\];/,
  );
  if (skillsBlockMatch) {
    const skillMatches = skillsBlockMatch[1].matchAll(/"id"\s*:\s*"([^"]+)"/g);
    for (const m of skillMatches) {
      // Boundary cast: regex-extracted skill ID from config file
      skillIds.push(m[1] as SkillId);
    }
  }

  const agentsBlockMatch = configContent.match(
    /const agents:\s*AgentScopeConfig\[\]\s*=\s*\[([\s\S]*?)\];/,
  );
  if (agentsBlockMatch) {
    const agentMatches = agentsBlockMatch[1].matchAll(/"name"\s*:\s*"([^"]+)"/g);
    for (const m of agentMatches) {
      agentNames.push(m[1]);
    }
  }

  const domainsBlockMatch = configContent.match(
    /const domains:\s*Domain\[\]\s*=\s*\[([\s\S]*?)\];/,
  );
  if (domainsBlockMatch) {
    const domainMatches = domainsBlockMatch[1].matchAll(/"([^"]+)"/g);
    for (const m of domainMatches) {
      domains.push(m[1]);
    }
  }

  // Strategy 2: If no typed variables found, try parsing export default as JSON (test helper format)
  if (skillIds.length === 0 && agentNames.length === 0) {
    const jsonMatch = configContent.match(/export default\s+({[\s\S]*?})\s*;/);
    if (jsonMatch) {
      try {
        const config = JSON.parse(jsonMatch[1]) as {
          skills?: Array<{ id: string }>;
          agents?: Array<{ name: string }>;
          domains?: string[];
        };
        // Boundary cast: JSON-parsed skill IDs from config file
        skillIds.push(...(config.skills ?? []).map((s) => s.id as SkillId));
        agentNames.push(...(config.agents ?? []).map((a) => a.name));
        domains.push(...(config.domains ?? []));
      } catch {
        // JSON parse failed — fall through to regex-based extraction
      }
    }

    // Strategy 3: Last resort — extract IDs from any format using generic regex
    if (skillIds.length === 0) {
      const idMatches = configContent.matchAll(/"id"\s*:\s*"([^"]+)"/g);
      for (const m of idMatches) {
        // Boundary cast: regex-extracted skill ID from config file
        skillIds.push(m[1] as SkillId);
      }
    }
    if (agentNames.length === 0) {
      const nameMatches = configContent.matchAll(/"name"\s*:\s*"([^"]+)"/g);
      for (const m of nameMatches) {
        agentNames.push(m[1]);
      }
    }
  }

  return { skillIds, agentNames, domains };
}

/** Asserts that an array has no duplicate entries. */
function expectNoDuplicates(arr: string[], label: string): void {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.push(item);
    }
    seen.add(item);
  }
  expect(duplicates, `Duplicate ${label} found: ${duplicates.join(", ")}`).toEqual([]);
}

/**
 * Navigates a multi-domain edit wizard to completion without changing skills.
 *
 * For a project with 3 domains (Web, API, Shared), the build step has 3 sub-steps.
 * Each domain requires Enter to advance to the next domain, then Sources -> Agents -> Confirm.
 */
async function navigateMultiDomainEditToCompletion(
  session: TerminalSession,
  timeoutMs = 30_000,
): Promise<void> {
  // Build step — Web domain -> API domain
  session.enter();
  await session.waitForText("API", timeoutMs);
  await delay(STEP_TRANSITION_DELAY_MS);

  // Build step — API domain -> Shared domain
  session.enter();
  await session.waitForText("Shared", timeoutMs);
  await delay(STEP_TRANSITION_DELAY_MS);

  // Build step — Shared domain -> Sources step
  session.enter();
  await session.waitForText("Customize skill sources", timeoutMs);
  await delay(STEP_TRANSITION_DELAY_MS);

  // Sources step -> Agents step
  session.enter();
  await session.waitForText("Select agents", timeoutMs);
  await delay(STEP_TRANSITION_DELAY_MS);

  // Agents step -> Confirm step
  session.enter();
  await session.waitForText("Ready to install", timeoutMs);
  await delay(STEP_TRANSITION_DELAY_MS);

  // Confirm step -> Complete
  session.enter();
}

describe("re-edit cycles: config stability across multiple edits", () => {
  let sourceDir: string;
  let sourceTempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  describe("idempotent no-change edits", () => {
    let tempDir: string | undefined;
    let session: TerminalSession | undefined;

    afterEach(async () => {
      await session?.destroy();
      session = undefined;
      if (tempDir) {
        await cleanupTempDir(tempDir);
        tempDir = undefined;
      }
    });

    it(
      "should preserve config across init -> edit -> edit without changes",
      { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();
        const projectDir = tempDir;
        const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);

        // ================================================================
        // Phase 1: Init via TerminalSession
        // ================================================================

        await createPermissionsFile(projectDir);

        session = new TerminalSession(["init", "--source", sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        // Navigate init wizard: Stack -> Domain -> Build("a") -> Confirm -> Success
        await navigateInitWizardToCompletion(session);
        const initExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(initExitCode).toBe(EXIT_CODES.SUCCESS);

        await session.destroy();
        session = undefined;

        // --- Phase 1 verification ---
        expect(await fileExists(configPath)).toBe(true);
        const configAfterInit = await readTestFile(configPath);
        const initArrays = parseConfigArrays(configAfterInit);
        expect(initArrays.skillIds.length).toBeGreaterThan(0);
        expectNoDuplicates(initArrays.skillIds, "skills after init");
        expectNoDuplicates(initArrays.agentNames, "agents after init");
        expectNoDuplicates(initArrays.domains, "domains after init");

        // ================================================================
        // Phase 2: First edit -- navigate through without changes
        // ================================================================

        session = new TerminalSession(["edit", "--source", sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        await navigateMultiDomainEditToCompletion(session);

        const edit1ExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(edit1ExitCode).toBe(EXIT_CODES.SUCCESS);

        await session.destroy();
        session = undefined;

        // --- Phase 2 verification ---
        const configAfterEdit1 = await readTestFile(configPath);
        const edit1Arrays = parseConfigArrays(configAfterEdit1);

        // No duplicate entries after first edit
        expectNoDuplicates(edit1Arrays.skillIds, "skills after first edit");
        expectNoDuplicates(edit1Arrays.agentNames, "agents after first edit");
        expectNoDuplicates(edit1Arrays.domains, "domains after first edit");

        // Skills should be identical to post-init (skills come from the same source)
        expect(edit1Arrays.skillIds.sort()).toEqual(initArrays.skillIds.sort());

        // ================================================================
        // Phase 3: Second edit -- navigate through without changes again
        // ================================================================

        session = new TerminalSession(["edit", "--source", sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        await navigateMultiDomainEditToCompletion(session);

        const edit2ExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(edit2ExitCode).toBe(EXIT_CODES.SUCCESS);

        await session.destroy();
        session = undefined;

        // --- Phase 3 verification ---
        const configAfterEdit2 = await readTestFile(configPath);
        const edit2Arrays = parseConfigArrays(configAfterEdit2);

        // No duplicate entries after second edit
        expectNoDuplicates(edit2Arrays.skillIds, "skills after second edit");
        expectNoDuplicates(edit2Arrays.agentNames, "agents after second edit");
        expectNoDuplicates(edit2Arrays.domains, "domains after second edit");

        // CRITICAL: No accumulation between consecutive edits.
        // edit2 should be identical to edit1 (no growth in any array).
        expect(edit2Arrays.skillIds.sort()).toEqual(edit1Arrays.skillIds.sort());
        expect(edit2Arrays.agentNames.sort()).toEqual(edit1Arrays.agentNames.sort());
        expect(edit2Arrays.domains.sort()).toEqual(edit1Arrays.domains.sort());

        // Verify counts did not grow between edits
        expect(edit2Arrays.skillIds.length).toBe(edit1Arrays.skillIds.length);
        expect(edit2Arrays.agentNames.length).toBe(edit1Arrays.agentNames.length);
        expect(edit2Arrays.domains.length).toBe(edit1Arrays.domains.length);
      },
    );
  });

  describe("edit with skill addition persists across cycles", () => {
    let tempDir: string | undefined;
    let session: TerminalSession | undefined;

    afterEach(async () => {
      await session?.destroy();
      session = undefined;
      if (tempDir) {
        await cleanupTempDir(tempDir);
        tempDir = undefined;
      }
    });

    it(
      "should retain added skill across subsequent no-change edit",
      { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        // ================================================================
        // Phase 1: Create project with limited skills (single domain, one skill)
        // ================================================================

        const projectDir = await createEditableProject(tempDir, {
          skills: ["web-framework-react"],
          agents: ["web-developer"],
          domains: ["web"],
        });

        await createPermissionsFile(projectDir);
        const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);

        // Verify initial state
        const configBefore = await readTestFile(configPath);
        const beforeArrays = parseConfigArrays(configBefore);
        expect(beforeArrays.skillIds).toContain("web-framework-react");

        // ================================================================
        // Phase 2: First edit -- add a skill
        //
        // The E2E source has web-testing-vitest in the Testing category.
        // The editable project only has web-framework-react (Framework).
        // We arrow down to reach the next category, then space to toggle.
        // ================================================================

        session = new TerminalSession(["edit", "--source", sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
          rows: 60,
          cols: 120,
        });

        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
        await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);

        // Arrow down from Framework category to next category, press space to select
        session.arrowDown();
        await delay(STEP_TRANSITION_DELAY_MS);
        session.space();
        await delay(STEP_TRANSITION_DELAY_MS);

        // Navigate through: Build -> Sources -> Agents -> Confirm -> Complete
        await navigateEditWizardToCompletion(session);

        // Wait for recompilation or early exit
        const edit1ExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(edit1ExitCode).toBe(EXIT_CODES.SUCCESS);

        await session.destroy();
        session = undefined;

        // --- Phase 2 verification ---
        const configAfterAdd = await readTestFile(configPath);
        const addArrays = parseConfigArrays(configAfterAdd);

        // The edit should have produced changes (added or same skill set)
        expect(addArrays.skillIds.length).toBeGreaterThanOrEqual(beforeArrays.skillIds.length);
        expectNoDuplicates(addArrays.skillIds, "skills after adding");
        expectNoDuplicates(addArrays.agentNames, "agents after adding");

        // Original skill should still be present
        expect(addArrays.skillIds).toContain("web-framework-react");

        // Track which skills were added (if any) for later verification
        const addedSkillIds = addArrays.skillIds.filter(
          (id) => !beforeArrays.skillIds.includes(id),
        );

        // ================================================================
        // Phase 3: Second edit -- navigate through without changes
        // ================================================================

        session = new TerminalSession(["edit", "--source", sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
          rows: 60,
          cols: 120,
        });

        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Single-domain project -- navigateEditWizardToCompletion works here
        await navigateEditWizardToCompletion(session);

        const edit2ExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(edit2ExitCode).toBe(EXIT_CODES.SUCCESS);

        await session.destroy();
        session = undefined;

        // --- Phase 3 verification ---
        const configAfterNoChange = await readTestFile(configPath);
        const noChangeArrays = parseConfigArrays(configAfterNoChange);

        // No new duplicates introduced
        expectNoDuplicates(noChangeArrays.skillIds, "skills after no-change edit");
        expectNoDuplicates(noChangeArrays.agentNames, "agents after no-change edit");
        expectNoDuplicates(noChangeArrays.domains, "domains after no-change edit");

        // CRITICAL: No accumulation between consecutive edits.
        // The skill set after edit2 should match edit1 (no growth).
        expect(noChangeArrays.skillIds.sort()).toEqual(addArrays.skillIds.sort());

        // Skill count should not have grown
        expect(noChangeArrays.skillIds.length).toBe(addArrays.skillIds.length);

        // Previously added skills should still be in config (not lost)
        for (const addedId of addedSkillIds) {
          expect(noChangeArrays.skillIds).toContain(addedId);
        }

        // Original skill should still be present
        expect(noChangeArrays.skillIds).toContain("web-framework-react");
      },
    );
  });
});
