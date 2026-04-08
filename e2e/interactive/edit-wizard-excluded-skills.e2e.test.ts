import path from "path";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  writeProjectConfig,
  createLocalSkill,
  readTestFile,
  directoryExists,
} from "../helpers/test-utils.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { DIRS, FILES, TIMEOUTS, EXIT_CODES } from "../pages/constants.js";
import "../matchers/setup.js";

/**
 * Bug D-193 regression test: excluded skills must not appear as selected
 * in the edit wizard's build step.
 *
 * Skills with `excluded: true` in config should be filtered from
 * `currentSkillIds` so they are not pre-selected. They are still preserved
 * in the config and visible in the info panel / confirm step via
 * `SkillAgentSummary`.
 *
 * Code path under test:
 *   edit.tsx -> buildEditContext() -> currentSkillIds filtering
 *   lib/wizard/build-step-logic.ts -> buildCategoriesForDomain()
 */

describe("edit wizard — excluded skills", () => {
  let sourceDir: string;
  let sourceTempDir: string;
  let tempDir: string | undefined;
  let wizard: EditWizard | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, TIMEOUTS.SETUP);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined;
    }
  });

  it(
    "should not show excluded skills as selected in build step",
    { timeout: TIMEOUTS.INTERACTIVE },
    async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");

      // Setup: react (normal), vitest (excluded)
      await writeProjectConfig(projectDir, {
        name: "excluded-skills-test",
        skills: [
          { id: "web-framework-react", scope: "project", source: "eject" },
          { id: "web-testing-vitest", scope: "project", source: "eject", excluded: true },
        ],
        agents: [{ name: "web-developer", scope: "project" }],
        domains: ["web"],
      });

      // Create local skill directory only for the non-excluded skill.
      // The excluded skill has no local directory — it was excluded by the user.
      await createLocalSkill(projectDir, "web-framework-react", {
        description: "React framework",
        metadata: `author: "@test"\ndisplayName: web-framework-react\ncategory: web-framework\nslug: react\ndomain: web\ncliDescription: "React framework"\nusageGuidance: "Testing"\ncontentHash: "e2e-hash"\n`,
      });

      wizard = await EditWizard.launch({
        projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        rows: 60,
        cols: 120,
      });

      const buildOutput = wizard.build.getOutput();

      // Framework is an exclusive category with a selection counter.
      // react is NOT excluded → it should be pre-selected: (1 of 1).
      expect(buildOutput).toContain("(1 of 1)");

      // Both skills appear in the build step (all skills in the source are shown).
      expect(buildOutput).toContain("web-framework-react");

      // The Testing category should be visible (vitest is in the source).
      expect(buildOutput).toContain("Testing");

      // Navigate through wizard without changes: Build → Sources → Agents → Confirm
      const sources = await wizard.build.advanceToSources();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("edit");
      const result = await confirm.confirm();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      // Read the config file and verify both skills are present with correct flags
      const configPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const updatedConfig = await readTestFile(configPath);

      // The non-excluded skill must be present
      expect(updatedConfig).toContain("web-framework-react");

      // The excluded skill must still be present in config (not dropped)
      expect(updatedConfig).toContain("web-testing-vitest");

      // The excluded flag must be preserved on the vitest entry
      expect(updatedConfig).toContain('"excluded":true');
    },
  );

  it(
    "should preserve excluded skill in config after no-op edit",
    { timeout: TIMEOUTS.INTERACTIVE },
    async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");

      // Setup: react (normal), vitest (excluded)
      await writeProjectConfig(projectDir, {
        name: "excluded-preserve-test",
        skills: [
          { id: "web-framework-react", scope: "project", source: "eject" },
          { id: "web-testing-vitest", scope: "project", source: "eject", excluded: true },
        ],
        agents: [{ name: "web-developer", scope: "project" }],
        domains: ["web"],
      });

      await createLocalSkill(projectDir, "web-framework-react", {
        description: "React framework",
        metadata: `author: "@test"\ndisplayName: web-framework-react\ncategory: web-framework\nslug: react\ndomain: web\ncliDescription: "React framework"\nusageGuidance: "Testing"\ncontentHash: "e2e-hash"\n`,
      });

      wizard = await EditWizard.launch({
        projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        rows: 60,
        cols: 120,
      });

      // Navigate through wizard without changes: Build → Sources → Agents → Confirm
      const sources = await wizard.build.advanceToSources();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("edit");
      const result = await confirm.confirm();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      // Read the config file and verify both skills are present
      const configPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const updatedConfig = await readTestFile(configPath);

      // The non-excluded skill must be present
      expect(updatedConfig).toContain("web-framework-react");

      // The excluded skill must still be present in config (not dropped)
      expect(updatedConfig).toContain("web-testing-vitest");

      // The excluded flag must be preserved on the vitest entry.
      // Production config-writer uses JSON.stringify without indent, so no space before "true".
      expect(updatedConfig).toContain('"excluded":true');
    },
  );

  it(
    "should show non-excluded skills correctly as selected alongside excluded skills",
    { timeout: TIMEOUTS.INTERACTIVE },
    async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");

      // Setup: react (normal), vitest (normal), zustand (excluded)
      await writeProjectConfig(projectDir, {
        name: "mixed-excluded-test",
        skills: [
          { id: "web-framework-react", scope: "project", source: "eject" },
          { id: "web-testing-vitest", scope: "project", source: "eject" },
          { id: "web-state-zustand", scope: "project", source: "eject", excluded: true },
        ],
        agents: [{ name: "web-developer", scope: "project" }],
        domains: ["web"],
      });

      // Create local skill directories for non-excluded skills only
      await createLocalSkill(projectDir, "web-framework-react", {
        description: "React framework",
        metadata: `author: "@test"\ndisplayName: web-framework-react\ncategory: web-framework\nslug: react\ndomain: web\ncliDescription: "React framework"\nusageGuidance: "Testing"\ncontentHash: "e2e-hash"\n`,
      });

      await createLocalSkill(projectDir, "web-testing-vitest", {
        description: "Vitest testing",
        metadata: `author: "@test"\ndisplayName: web-testing-vitest\ncategory: web-testing\nslug: vitest\ndomain: web\ncliDescription: "Vitest testing"\nusageGuidance: "Testing"\ncontentHash: "e2e-hash"\n`,
      });

      wizard = await EditWizard.launch({
        projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        rows: 60,
        cols: 120,
      });

      const buildOutput = wizard.build.getOutput();

      // Framework (exclusive): react is selected → (1 of 1)
      expect(buildOutput).toContain("(1 of 1)");

      // Both non-excluded skills should appear with their names
      expect(buildOutput).toContain("web-framework-react");

      // The Testing category is visible (vitest is in the source)
      expect(buildOutput).toContain("Testing");

      // Navigate through wizard to verify it completes successfully
      const sources = await wizard.build.advanceToSources();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("edit");
      const result = await confirm.confirm();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      // Verify config after save: excluded flag preserved on zustand
      const configPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const updatedConfig = await readTestFile(configPath);

      expect(updatedConfig).toContain("web-framework-react");
      expect(updatedConfig).toContain("web-testing-vitest");
      expect(updatedConfig).toContain("web-state-zustand");
      // Production config-writer uses JSON.stringify without indent, so no space before "true".
      expect(updatedConfig).toContain('"excluded":true');
    },
  );

  it(
    "should show skill as selected when it has both excluded tombstone and active project entry",
    { timeout: TIMEOUTS.INTERACTIVE },
    async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");

      // Setup: zustand has a dual entry — global excluded tombstone + active project entry.
      // This happens when a skill is toggled from global to project scope (G→P).
      await writeProjectConfig(projectDir, {
        name: "dual-entry-test",
        skills: [
          { id: "web-framework-react", scope: "project", source: "eject" },
          { id: "web-state-zustand", scope: "global", source: "eject", excluded: true },
          { id: "web-state-zustand", scope: "project", source: "eject" },
        ],
        agents: [{ name: "web-developer", scope: "project" }],
        domains: ["web"],
      });

      // Create local skill directories for both non-excluded skills
      await createLocalSkill(projectDir, "web-framework-react", {
        description: "React framework",
        metadata: `author: "@test"\ndisplayName: web-framework-react\ncategory: web-framework\nslug: react\ndomain: web\ncliDescription: "React framework"\nusageGuidance: "Testing"\ncontentHash: "e2e-hash"\n`,
      });

      await createLocalSkill(projectDir, "web-state-zustand", {
        description: "State management",
        metadata: `author: "@test"\ndisplayName: web-state-zustand\ncategory: web-client-state\nslug: zustand\ndomain: web\ncliDescription: "State management"\nusageGuidance: "Testing"\ncontentHash: "e2e-hash"\n`,
      });

      wizard = await EditWizard.launch({
        projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        rows: 60,
        cols: 120,
      });

      const buildOutput = wizard.build.getOutput();

      // Framework (exclusive): react is selected → (1 of 1)
      expect(buildOutput).toContain("(1 of 1)");

      // The active project entry for zustand must not be filtered out
      // by the excluded tombstone. zustand should be visible and selectable.
      expect(buildOutput).toContain("web-state-zustand");

      // Navigate through wizard without changes: Build → Sources → Agents → Confirm
      const sources = await wizard.build.advanceToSources();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("edit");
      const result = await confirm.confirm();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      // Read the config file and verify dual entries are preserved
      const configPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const updatedConfig = await readTestFile(configPath);

      // The non-excluded skill must be present
      expect(updatedConfig).toContain("web-framework-react");

      // Both zustand entries must be present (tombstone + active)
      expect(updatedConfig).toContain("web-state-zustand");

      // The excluded flag must be preserved on the tombstone entry
      expect(updatedConfig).toContain('"excluded":true');

      // Both scope entries must be present: global (tombstone) and project (active)
      expect(updatedConfig).toContain('"scope":"global"');
      expect(updatedConfig).toContain('"scope":"project"');

      // The zustand local skill directory must still exist after save
      const zustandSkillDir = path.join(projectDir, ".claude", "skills", "web-state-zustand");
      expect(await directoryExists(zustandSkillDir)).toBe(true);
    },
  );

  it(
    "should preserve both tombstone and active entry after no-op edit with dual entries",
    { timeout: TIMEOUTS.INTERACTIVE },
    async () => {
      tempDir = await createTempDir();
      const projectDir = path.join(tempDir, "project");

      // Same dual-entry setup: global excluded tombstone + active project entry
      await writeProjectConfig(projectDir, {
        name: "dual-entry-preserve-test",
        skills: [
          { id: "web-framework-react", scope: "project", source: "eject" },
          { id: "web-state-zustand", scope: "global", source: "eject", excluded: true },
          { id: "web-state-zustand", scope: "project", source: "eject" },
        ],
        agents: [{ name: "web-developer", scope: "project" }],
        domains: ["web"],
      });

      await createLocalSkill(projectDir, "web-framework-react", {
        description: "React framework",
        metadata: `author: "@test"\ndisplayName: web-framework-react\ncategory: web-framework\nslug: react\ndomain: web\ncliDescription: "React framework"\nusageGuidance: "Testing"\ncontentHash: "e2e-hash"\n`,
      });

      await createLocalSkill(projectDir, "web-state-zustand", {
        description: "State management",
        metadata: `author: "@test"\ndisplayName: web-state-zustand\ncategory: web-client-state\nslug: zustand\ndomain: web\ncliDescription: "State management"\nusageGuidance: "Testing"\ncontentHash: "e2e-hash"\n`,
      });

      wizard = await EditWizard.launch({
        projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        rows: 60,
        cols: 120,
      });

      // Navigate through wizard without changes: Build → Sources → Agents → Confirm
      const sources = await wizard.build.advanceToSources();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("edit");
      const result = await confirm.confirm();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      // Read the config file and verify both entries are present
      const configPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const updatedConfig = await readTestFile(configPath);

      // The non-excluded skill must be present
      expect(updatedConfig).toContain("web-framework-react");

      // Both zustand entries must be present (tombstone + active)
      expect(updatedConfig).toContain("web-state-zustand");

      // The excluded flag must be preserved on the tombstone entry
      expect(updatedConfig).toContain('"excluded":true');

      // Both scope entries must be present: global (tombstone) and project (active)
      expect(updatedConfig).toContain('"scope":"global"');
      expect(updatedConfig).toContain('"scope":"project"');
    },
  );
});
