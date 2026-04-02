import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { TIMEOUTS, EXIT_CODES, DIRS } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  ensureBinaryExists,
  fileExists,
  readTestFile,
} from "../helpers/test-utils.js";
import { ProjectBuilder } from "../fixtures/project-builder.js";

/**
 * Re-edit / multiple edit cycle E2E tests.
 *
 * Verifies that running `cc edit` multiple times on the same installation
 * does not corrupt the config: no duplicate skills, agents, or domains
 * accumulate across edits.
 */

/**
 * Parses a config.ts file and extracts skill IDs, agent names, and domains
 * for duplicate detection and structural comparison.
 */
function parseConfigArrays(configContent: string): {
  skillIds: string[];
  agentNames: string[];
  domains: string[];
} {
  const skillIds: string[] = [];
  const agentNames: string[] = [];
  const domains: string[] = [];

  // Strategy 1: Extract from typed named variable declarations (real CLI format)
  const skillsBlockMatch = configContent.match(
    /const skills:\s*SkillConfig\[\]\s*=\s*\[([\s\S]*?)\];/,
  );
  if (skillsBlockMatch) {
    const skillMatches = skillsBlockMatch[1].matchAll(/"id"\s*:\s*"([^"]+)"/g);
    for (const m of skillMatches) {
      skillIds.push(m[1]);
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

  // Strategy 2: JSON fallback (test helper format)
  if (skillIds.length === 0 && agentNames.length === 0) {
    const jsonMatch = configContent.match(/export default\s+({[\s\S]*?})\s*;/);
    if (jsonMatch) {
      try {
        const config = JSON.parse(jsonMatch[1]) as {
          skills?: Array<{ id: string }>;
          agents?: Array<{ name: string }>;
          domains?: string[];
        };
        skillIds.push(...(config.skills ?? []).map((s) => s.id));
        agentNames.push(...(config.agents ?? []).map((a) => a.name));
        domains.push(...(config.domains ?? []));
      } catch {
        // JSON parse failed -- fall through to regex-based extraction
      }
    }

    // Strategy 3: Last resort regex
    if (skillIds.length === 0) {
      const idMatches = configContent.matchAll(/"id"\s*:\s*"([^"]+)"/g);
      for (const m of idMatches) {
        skillIds.push(m[1]);
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
  expect(duplicates, `Duplicate ${label} found: ${duplicates.join(", ")}`).toStrictEqual([]);
}

describe("re-edit cycles: config stability across multiple edits", () => {
  let sourceDir: string;
  let sourceTempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, TIMEOUTS.SETUP);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  describe("idempotent no-change edits", () => {
    let tempDir: string | undefined;

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
        tempDir = undefined;
      }
    });

    it(
      "should preserve config across init -> edit -> edit without changes",
      { timeout: TIMEOUTS.LIFECYCLE },
      async () => {
        tempDir = await createTempDir();
        const projectDir = tempDir;
        const configPath = path.join(projectDir, DIRS.CLAUDE_SRC, "config.ts");

        // ================================================================
        // Phase 1: Init via wizard
        // ================================================================

        const initWizard = await InitWizard.launch({
          source: { sourceDir, tempDir: sourceTempDir },
          projectDir,
        });
        const initResult = await initWizard.completeWithDefaults();
        expect(await initResult.exitCode).toBe(EXIT_CODES.SUCCESS);
        await initResult.destroy();

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

        const edit1Wizard = await EditWizard.launch({
          projectDir,
          source: { sourceDir, tempDir: sourceTempDir },
        });
        const edit1Result = await edit1Wizard.passThrough();
        expect(await edit1Result.exitCode).toBe(EXIT_CODES.SUCCESS);
        await edit1Result.destroy();

        // --- Phase 2 verification ---
        const configAfterEdit1 = await readTestFile(configPath);
        const edit1Arrays = parseConfigArrays(configAfterEdit1);

        expectNoDuplicates(edit1Arrays.skillIds, "skills after first edit");
        expectNoDuplicates(edit1Arrays.agentNames, "agents after first edit");
        expectNoDuplicates(edit1Arrays.domains, "domains after first edit");

        expect(edit1Arrays.skillIds.sort()).toStrictEqual(initArrays.skillIds.sort());

        // ================================================================
        // Phase 3: Second edit -- navigate through without changes again
        // ================================================================

        const edit2Wizard = await EditWizard.launch({
          projectDir,
          source: { sourceDir, tempDir: sourceTempDir },
        });
        const edit2Result = await edit2Wizard.passThrough();
        expect(await edit2Result.exitCode).toBe(EXIT_CODES.SUCCESS);
        await edit2Result.destroy();

        // --- Phase 3 verification ---
        const configAfterEdit2 = await readTestFile(configPath);
        const edit2Arrays = parseConfigArrays(configAfterEdit2);

        expectNoDuplicates(edit2Arrays.skillIds, "skills after second edit");
        expectNoDuplicates(edit2Arrays.agentNames, "agents after second edit");
        expectNoDuplicates(edit2Arrays.domains, "domains after second edit");

        // CRITICAL: No accumulation between consecutive edits.
        expect(edit2Arrays.skillIds.sort()).toStrictEqual(edit1Arrays.skillIds.sort());
        expect(edit2Arrays.agentNames.sort()).toStrictEqual(edit1Arrays.agentNames.sort());
        expect(edit2Arrays.domains.sort()).toStrictEqual(edit1Arrays.domains.sort());

        expect(edit2Arrays.skillIds.length).toBe(edit1Arrays.skillIds.length);
        expect(edit2Arrays.agentNames.length).toBe(edit1Arrays.agentNames.length);
        expect(edit2Arrays.domains.length).toBe(edit1Arrays.domains.length);
      },
    );
  });

  describe("edit with skill addition persists across cycles", () => {
    let tempDir: string | undefined;

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
        tempDir = undefined;
      }
    });

    it(
      "should retain added skill across subsequent no-change edit",
      { timeout: TIMEOUTS.LIFECYCLE },
      async () => {
        // ================================================================
        // Phase 1: Create project with limited skills (single domain, one skill)
        // ================================================================

        const project = await ProjectBuilder.editable({
          skills: ["web-framework-react"],
          agents: ["web-developer"],
          domains: ["web"],
        });
        tempDir = path.dirname(project.dir);
        const projectDir = project.dir;

        await createPermissionsFile(projectDir);
        const configPath = path.join(projectDir, DIRS.CLAUDE_SRC, "config.ts");

        // Verify initial state
        const configBefore = await readTestFile(configPath);
        const beforeArrays = parseConfigArrays(configBefore);
        expect(beforeArrays.skillIds).toContain("web-framework-react");

        // ================================================================
        // Phase 2: First edit -- add a skill
        // ================================================================

        const edit1Wizard = await EditWizard.launch({
          projectDir,
          source: { sourceDir, tempDir: sourceTempDir },
          rows: 60,
          cols: 120,
        });

        // Arrow down to next category, space to select
        await edit1Wizard.build.navigateDown();
        await edit1Wizard.build.toggleFocusedSkill();

        // Navigate through: Build -> Sources -> Agents -> Confirm -> Complete
        const sources1 = await edit1Wizard.build.advanceToSources();
        const agents1 = await sources1.acceptDefaults();
        const confirm1 = await agents1.acceptDefaults("edit");
        const edit1Result = await confirm1.confirm();

        expect(await edit1Result.exitCode).toBe(EXIT_CODES.SUCCESS);
        await edit1Result.destroy();

        // --- Phase 2 verification ---
        const configAfterAdd = await readTestFile(configPath);
        const addArrays = parseConfigArrays(configAfterAdd);

        expect(addArrays.skillIds.length).toBeGreaterThanOrEqual(beforeArrays.skillIds.length);
        expectNoDuplicates(addArrays.skillIds, "skills after adding");
        expectNoDuplicates(addArrays.agentNames, "agents after adding");

        expect(addArrays.skillIds).toContain("web-framework-react");

        const addedSkillIds = addArrays.skillIds.filter(
          (id) => !beforeArrays.skillIds.includes(id),
        );

        // ================================================================
        // Phase 3: Second edit -- navigate through without changes
        // ================================================================

        const edit2Wizard = await EditWizard.launch({
          projectDir,
          source: { sourceDir, tempDir: sourceTempDir },
          rows: 60,
          cols: 120,
        });

        const sources2 = await edit2Wizard.build.advanceToSources();
        const agents2 = await sources2.acceptDefaults();
        const confirm2 = await agents2.acceptDefaults("edit");
        const edit2Result = await confirm2.confirm();

        expect(await edit2Result.exitCode).toBe(EXIT_CODES.SUCCESS);
        await edit2Result.destroy();

        // --- Phase 3 verification ---
        const configAfterNoChange = await readTestFile(configPath);
        const noChangeArrays = parseConfigArrays(configAfterNoChange);

        expectNoDuplicates(noChangeArrays.skillIds, "skills after no-change edit");
        expectNoDuplicates(noChangeArrays.agentNames, "agents after no-change edit");
        expectNoDuplicates(noChangeArrays.domains, "domains after no-change edit");

        // CRITICAL: No accumulation between consecutive edits.
        expect(noChangeArrays.skillIds.sort()).toStrictEqual(addArrays.skillIds.sort());
        expect(noChangeArrays.skillIds.length).toBe(addArrays.skillIds.length);

        for (const addedId of addedSkillIds) {
          expect(noChangeArrays.skillIds).toContain(addedId);
        }

        expect(noChangeArrays.skillIds).toContain("web-framework-react");
      },
    );
  });
});
