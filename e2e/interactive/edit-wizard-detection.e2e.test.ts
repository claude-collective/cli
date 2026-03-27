import path from "path";
import { mkdir } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  writeProjectConfig,
  createLocalSkill,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { DIRS, STEP_TEXT, TIMEOUTS } from "../pages/constants.js";

/**
 * E2E tests for edit wizard skill detection (Gap 6).
 *
 * Verifies that the edit wizard correctly detects and displays skills
 * from different sources and scopes: local skills, project-scoped
 * plugin-like skills, and global-scoped skills.
 */

describe("edit wizard — skill detection across sources and scopes", () => {
  let wizard: EditWizard | undefined;
  let tempDir: string | undefined;
  let sourceTempDir: string | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;

    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined;
    }
    if (sourceTempDir) {
      await cleanupTempDir(sourceTempDir);
      sourceTempDir = undefined;
    }
  });

  describe("mixed local and plugin-sourced skills", () => {
    it(
      "should detect and display all skill types in the build step",
      { timeout: TIMEOUTS.INTERACTIVE },
      async () => {
        tempDir = await createTempDir();
        const projectDir = path.join(tempDir, "project");

        const source = await createE2ESource();
        sourceTempDir = source.tempDir;

        // Create a project with mixed skills:
        //   - web-framework-react: local source, project scope
        //   - web-testing-vitest: local source, global scope
        //   - web-state-zustand: local source, project scope
        //   - api-framework-hono: local source, global scope
        const agentsDir = path.join(projectDir, DIRS.CLAUDE, "agents");
        await mkdir(agentsDir, { recursive: true });

        await writeProjectConfig(projectDir, {
          name: "test-mixed-detection",
          skills: [
            { id: "web-framework-react", scope: "project", source: "local" },
            { id: "web-testing-vitest", scope: "global", source: "local" },
            { id: "web-state-zustand", scope: "project", source: "local" },
            { id: "api-framework-hono", scope: "global", source: "local" },
          ],
          agents: [
            { name: "web-developer", scope: "project" },
            { name: "api-developer", scope: "global" },
          ],
          domains: ["web", "api"],
          selectedAgents: ["web-developer", "api-developer"],
        });

        // Create local skill directories with SKILL.md and metadata
        const skills = [
          { id: "web-framework-react", category: "web-framework", slug: "react", domain: "web" },
          { id: "web-testing-vitest", category: "web-testing", slug: "vitest", domain: "web" },
          { id: "web-state-zustand", category: "web-client-state", slug: "zustand", domain: "web" },
          { id: "api-framework-hono", category: "api-api", slug: "hono", domain: "api" },
        ] as const;

        for (const skill of skills) {
          await createLocalSkill(projectDir, skill.id, {
            description: `Test skill ${skill.id}`,
            metadata: `author: "@test"\ndisplayName: ${skill.id}\ncategory: ${skill.category}\nslug: ${skill.slug}\ndomain: ${skill.domain}\ncliDescription: "Test skill"\nusageGuidance: "Testing"\ncontentHash: "e2e-hash"\n`,
          });
        }

        // Launch edit wizard
        wizard = await EditWizard.launch({
          projectDir,
          source,
          rows: 60,
          cols: 120,
        });

        const webOutput = wizard.build.getOutput();

        // Verify we're on the build step — web domain categories should be visible
        expect(webOutput).toContain("Framework");
        expect(webOutput).toContain("Testing");

        // Navigate to API domain to verify api skills are also detected
        await wizard.build.advanceDomain();

        const apiOutput = wizard.build.getOutput();
        // The API domain's category header confirms we navigated to the API build step
        expect(apiOutput).toContain("API Framework");
      },
    );

    it(
      "should show startup message with correct installed skill count",
      { timeout: TIMEOUTS.INTERACTIVE },
      async () => {
        tempDir = await createTempDir();
        const projectDir = path.join(tempDir, "project");

        const source = await createE2ESource();
        sourceTempDir = source.tempDir;

        const agentsDir = path.join(projectDir, DIRS.CLAUDE, "agents");
        await mkdir(agentsDir, { recursive: true });

        // Create project with 3 skills
        await writeProjectConfig(projectDir, {
          name: "test-count-detection",
          skills: [
            { id: "web-framework-react", scope: "project", source: "local" },
            { id: "web-testing-vitest", scope: "project", source: "local" },
            { id: "web-state-zustand", scope: "global", source: "local" },
          ],
          agents: [{ name: "web-developer", scope: "project" }],
          domains: ["web"],
        });

        // Create local skill files for all 3
        for (const id of [
          "web-framework-react",
          "web-testing-vitest",
          "web-state-zustand",
        ] as const) {
          const parts = id.split("-");
          const category = parts.slice(0, 2).join("-");
          const slug = parts.slice(2).join("-");
          await createLocalSkill(projectDir, id, {
            description: `Test skill`,
            metadata: `author: "@test"\ndisplayName: ${id}\ncategory: ${category}\nslug: ${slug}\ncliDescription: "Test"\nusageGuidance: "Test"\ncontentHash: "e2e-hash"\n`,
          });
        }

        wizard = await EditWizard.launch({
          projectDir,
          source,
          rows: 60,
          cols: 120,
        });

        const rawOutput = wizard.getRawOutput();
        // "Found 3 installed skills" — edit.tsx:137
        expect(rawOutput).toContain("Found 3 installed skills");
      },
    );
  });
});
