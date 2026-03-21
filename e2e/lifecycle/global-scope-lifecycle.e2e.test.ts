import { CLI } from "../fixtures/cli.js";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, EXIT_CODES, DIRS, FILES } from "../pages/constants.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  ensureBinaryExists,
  renderSkillMd,
  writeProjectConfig,
} from "../helpers/test-utils.js";

/**
 * Global scope lifecycle E2E tests -- regression coverage for scope-blind bugs.
 */

// Shared E2E source across all suites in this file
let sourceDir: string;
let sourceTempDir: string;

beforeAll(async () => {
  await ensureBinaryExists();
  const source = await createE2ESource();
  sourceDir = source.sourceDir;
  sourceTempDir = source.tempDir;
}, TIMEOUTS.SETUP * 2);

afterAll(async () => {
  if (sourceTempDir) await cleanupTempDir(sourceTempDir);
});

/**
 * Creates a local skill with forkedFrom metadata in its metadata.yaml.
 */
async function createLocalSkillWithForkedFrom(
  baseDir: string,
  skillId: string,
  options: {
    slug: string;
    category: string;
    contentHash: string;
  },
): Promise<void> {
  const skillDir = path.join(baseDir, DIRS.CLAUDE, DIRS.SKILLS, skillId);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, FILES.SKILL_MD),
    renderSkillMd(skillId, `Test skill ${skillId}`, `# ${skillId}\n\nTest content.`),
  );

  await writeFile(
    path.join(skillDir, FILES.METADATA_YAML),
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

/**
 * Creates the temp directory structure with dual-scope local skills
 * pre-installed (no wizard needed -- directly sets up the file state).
 */
async function createDualScopeInstallation(): Promise<{
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

  await createLocalSkillWithForkedFrom(fakeHome, "web-framework-react", {
    slug: "react",
    category: "web-framework",
    contentHash: "a1b2c3d",
  });

  await createLocalSkillWithForkedFrom(fakeHome, "web-testing-vitest", {
    slug: "vitest",
    category: "web-testing",
    contentHash: "a1b2c3d",
  });

  // Create a simple global agent file
  const globalAgentsDir = path.join(fakeHome, DIRS.CLAUDE, "agents");
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
  });

  // Create project agent file
  const projectAgentsDir = path.join(projectDir, DIRS.CLAUDE, "agents");
  await mkdir(projectAgentsDir, { recursive: true });
  await writeFile(
    path.join(projectAgentsDir, "api-developer.md"),
    "---\nname: api-developer\ndescription: API dev\n---\n\n# API Developer\n\nTest content.",
  );

  return { tempDir, fakeHome, projectDir };
}

// =====================================================================
// Test Suite 1 -- Source Loader: Global local skills always merged
// =====================================================================

describe("global scope lifecycle -- source loader merge", () => {
  it(
    "edit wizard should detect both global and project local skills after dual-scope init",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createDualScopeInstallation();

      try {
        // Run edit from the project directory -- the wizard should load BOTH scopes
        const wizard = await EditWizard.launch({
          projectDir,
          source: { sourceDir, tempDir: sourceTempDir },
          env: { HOME: fakeHome },
          rows: 60,
          cols: 120,
        });

        try {
          // Pass through build to reach sources
          const sources = await wizard.build.passThroughAllDomainsGeneric();

          await sources.waitForReady();

          // Verify ALL skills from both scopes appear in the output
          const sourcesOutput = wizard.getOutput();
          expect(sourcesOutput).toContain("web-framework-react");
          expect(sourcesOutput).toContain("web-testing-vitest");
          expect(sourcesOutput).toContain("api-framework-hono");

          // Complete the wizard
          const agents = await sources.advance();
          const confirm = await agents.acceptDefaults("edit");
          const result = await confirm.confirm();

          const exitCode = await result.exitCode;
          expect(exitCode).toBe(EXIT_CODES.SUCCESS);

          // After edit, verify both scopes of skills still exist on disk
          await expect({ dir: fakeHome }).toHaveSkillCopied("web-framework-react");
          await expect({ dir: fakeHome }).toHaveSkillCopied("web-testing-vitest");
          await expect({ dir: projectDir }).toHaveSkillCopied("api-framework-hono");

          await result.destroy();
        } catch (e) {
          await wizard.destroy();
          throw e;
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );
});

// =====================================================================
// Test Suite 2 -- Doctor: checks both project and global directories
// =====================================================================

describe("global scope lifecycle -- doctor command", () => {
  it("should not report false 'missing' for global-scoped agents", async () => {
    const { tempDir, fakeHome, projectDir } = await createDualScopeInstallation();

    try {
      const { exitCode, stdout } = await CLI.run(
        ["doctor", "--source", sourceDir],
        { dir: projectDir },
        { env: { HOME: fakeHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).not.toContain("web-developer (missing)");
      expect(stdout).toContain("agents compiled");
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it("should not report false 'missing' for global-scoped skills", async () => {
    const { tempDir, fakeHome, projectDir } = await createDualScopeInstallation();

    try {
      const { exitCode, stdout } = await CLI.run(
        ["doctor", "--source", sourceDir],
        { dir: projectDir },
        { env: { HOME: fakeHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).not.toContain("web-framework-react (not found)");
      expect(stdout).not.toContain("web-testing-vitest (not found)");
      expect(stdout).toContain("skills found");
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// =====================================================================
// Test Suite 3 -- Outdated: checks both project and global local skills
// =====================================================================

describe("global scope lifecycle -- outdated command", () => {
  it("should detect global-scoped local skills in outdated check", async () => {
    const { tempDir, fakeHome, projectDir } = await createDualScopeInstallation();

    try {
      const { exitCode, stdout } = await CLI.run(
        ["outdated", "--json", "--source", sourceDir],
        { dir: projectDir },
        { env: { HOME: fakeHome } },
      );

      const parsed = JSON.parse(stdout);
      const skillIds = parsed.skills.map((s: { id: string }) => s.id);

      expect(skillIds).toContain("web-framework-react");
      expect(skillIds).toContain("web-testing-vitest");
      expect(skillIds).toContain("api-framework-hono");
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

      await writeProjectConfig(fakeHome, {
        name: "global-only",
        skills: [{ id: "web-framework-react", scope: "global", source: "local" }],
        agents: [{ name: "web-developer", scope: "global" }],
        domains: ["web"],
      });

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
      });

      const { stdout, output } = await CLI.run(
        ["outdated", "--source", sourceDir],
        { dir: projectDir },
        { env: { HOME: fakeHome } },
      );

      expect(output).not.toContain("No local skills found");
      expect(output).toContain("web-framework-react");
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// =====================================================================
// Test Suite 4 -- Diff: checks both project and global local skills
// =====================================================================

describe("global scope lifecycle -- diff command", () => {
  it("should find global-scoped local skills when diffing", async () => {
    const { tempDir, fakeHome, projectDir } = await createDualScopeInstallation();

    try {
      const { exitCode, output } = await CLI.run(
        ["diff", "--source", sourceDir],
        { dir: projectDir },
        { env: { HOME: fakeHome } },
      );

      expect(output).not.toContain("No local skills found");
      expect(output).toContain("web-framework-react");
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

      await createLocalSkillWithForkedFrom(fakeHome, "web-framework-react", {
        slug: "react",
        category: "web-framework",
        contentHash: "a1b2c3d",
      });

      const { output } = await CLI.run(
        ["diff", "--source", sourceDir],
        { dir: projectDir },
        { env: { HOME: fakeHome } },
      );

      expect(output).not.toContain("No local skills found");
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// =====================================================================
// Test Suite 5 -- Uninstall: per-skill scope from config
// =====================================================================

describe("global scope lifecycle -- uninstall with dual scope", () => {
  it("should remove project-scoped skills from project dir via uninstall --yes", async () => {
    const { tempDir, fakeHome, projectDir } = await createDualScopeInstallation();

    try {
      const { exitCode, output } = await CLI.run(
        ["uninstall", "--yes"],
        { dir: projectDir },
        { env: { HOME: fakeHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("Uninstall complete!");

      await expect({ dir: projectDir }).not.toHaveSkillCopied("api-framework-hono");
      await expect({ dir: fakeHome }).toHaveSkillCopied("web-framework-react");
      await expect({ dir: fakeHome }).toHaveSkillCopied("web-testing-vitest");
      await expect({ dir: fakeHome }).toHaveCompiledAgent("web-developer");
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

// =====================================================================
// Test Suite 6 -- Full init wizard with mixed scope -> verify file placement
// =====================================================================

describe("global scope lifecycle -- init wizard with scope toggling", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined;
    }
  });

  it(
    "should place global-scoped local skills at HOME and project-scoped at project dir",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      tempDir = await createTempDir();
      const fakeHome = path.join(tempDir, "fake-home");
      const projectDir = path.join(fakeHome, "project");

      await mkdir(fakeHome, { recursive: true });
      await mkdir(projectDir, { recursive: true });
      await createPermissionsFile(fakeHome);
      await createPermissionsFile(projectDir);

      // Run init wizard from project dir with HOME pointing to fakeHome
      const wizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir,
        env: { HOME: fakeHome },
        rows: 60,
        cols: 120,
      });

      try {
        // Stack -> Domain -> Build
        const domain = await wizard.stack.selectFirstStack();
        const build = await domain.acceptDefaults();

        // Web domain -- toggle first skill to project scope
        await build.toggleScopeOnFocusedSkill();
        await build.advanceDomain();

        // API domain (all skills stay global)
        await build.advanceDomain();

        // Shared domain (pass through)
        const sources = await build.advanceToSources();

        // Sources -- set ALL to local
        await sources.waitForReady();
        await sources.setAllLocal();
        const agents = await sources.advance();

        // Agents -- accept defaults
        const confirm = await agents.acceptDefaults("init");

        // Confirm
        const result = await confirm.confirm();
        expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

        // --- Scope-aware copy assertions ---
        await expect({ dir: projectDir }).toHaveSkillCopied("web-framework-react");
        await expect({ dir: fakeHome }).toHaveSkillCopied("web-testing-vitest");
        await expect({ dir: fakeHome }).not.toHaveSkillCopied("web-framework-react");
        await expect({ dir: projectDir }).not.toHaveSkillCopied("web-testing-vitest");

        await result.destroy();
      } catch (e) {
        await wizard.destroy();
        throw e;
      }
    },
  );
});
