import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  writeProjectConfig,
  createPermissionsFile,
  createLocalSkill,
  readTestFile,
} from "../helpers/test-utils.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { DIRS, FILES, TIMEOUTS, EXIT_CODES } from "../pages/constants.js";
import "../matchers/setup.js";

/**
 * Bug B regression test: project config must not accumulate global-scoped skills
 * after running the edit wizard.
 *
 * Scenario: A project has both global and project configs. The global config has
 * web-framework-react (scope: global). The project config has web-testing-vitest
 * (scope: project). After a no-op edit (navigate through wizard without changes),
 * the project config should inline the global skill with scope: "global" exactly
 * once, alongside the project-scoped skill. The global skill must not be
 * duplicated or accumulated across re-edits.
 *
 * Code path under test:
 *   edit.tsx -> buildAndMergeConfig() -> writeScopedConfigs() -> splitConfigByScope()
 */

describe("project config does not accumulate global skills after edit", () => {
  let sourceDir: string;
  let sourceTempDir: string;
  let tempHOME: string | undefined;
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
    if (tempHOME) {
      await cleanupTempDir(tempHOME);
      tempHOME = undefined;
    }
  });

  it(
    "should not add global skills to project config after no-op edit",
    { timeout: TIMEOUTS.SETUP },
    async () => {
      tempHOME = await createTempDir();
      const projectDir = path.join(tempHOME, "project");

      // --- Setup global config at <tempHOME>/.claude-src/config.ts ---
      await writeProjectConfig(tempHOME, {
        name: "global",
        skills: [{ id: "web-framework-react", scope: "global", source: "local" }],
        agents: [{ name: "web-developer", scope: "global" }],
        domains: ["web"],
      });

      // Create global skill directory with SKILL.md and metadata.yaml
      await createLocalSkill(tempHOME, "web-framework-react", {
        description: "React framework",
        metadata: `author: "@test"\ndisplayName: web-framework-react\ncategory: web-framework\nslug: react\ncontentHash: "e2e-hash-react"\n`,
      });

      // Create global agent file
      const globalAgentsDir = path.join(tempHOME, DIRS.CLAUDE, "agents");
      await mkdir(globalAgentsDir, { recursive: true });
      await writeFile(
        path.join(globalAgentsDir, "web-developer.md"),
        "---\nname: web-developer\n---\nGlobal web developer agent.\n",
      );

      // --- Setup project config at <tempHOME>/project/.claude-src/config.ts ---
      await writeProjectConfig(projectDir, {
        name: "bug-b-test",
        skills: [
          { id: "web-framework-react", scope: "global", source: "local" },
          { id: "web-testing-vitest", scope: "project", source: "local" },
        ],
        agents: [{ name: "web-developer", scope: "project" }],
        domains: ["web"],
      });

      // Create project skill directory with SKILL.md and metadata.yaml
      await createLocalSkill(projectDir, "web-testing-vitest", {
        description: "Vitest testing",
        metadata: `author: "@test"\ndisplayName: web-testing-vitest\ncategory: web-testing\nslug: vitest\ncontentHash: "e2e-hash-vitest"\n`,
      });

      // Create project agent file
      const projectAgentsDir = path.join(projectDir, DIRS.CLAUDE, "agents");
      await mkdir(projectAgentsDir, { recursive: true });
      await writeFile(
        path.join(projectAgentsDir, "web-developer.md"),
        "---\nname: web-developer\n---\nProject web developer agent.\n",
      );

      // Create permissions file to prevent blocking prompt
      await createPermissionsFile(projectDir);

      const projectConfigPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);

      // --- Action: run edit wizard, navigate through without changes ---
      wizard = await EditWizard.launch({
        projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        env: { HOME: tempHOME },
      });

      // Single domain — advance through build -> sources -> agents -> confirm
      const sources = await wizard.build.advanceToSources();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("edit");
      const result = await confirm.confirm();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      // --- Assert: project config inlines global skills with scope: "global" (no spread) ---
      const updatedProjectConfig = await readTestFile(projectConfigPath);

      // The project config MUST contain the project-scoped skill
      expect(updatedProjectConfig).toContain("web-testing-vitest");

      // The project config MUST inline the global skill (new behavior: no spread import)
      expect(updatedProjectConfig).toContain("web-framework-react");

      // The project config must NOT use the old `...globalConfig.skills` spread pattern
      expect(updatedProjectConfig).not.toContain("globalConfig.skills");
      expect(updatedProjectConfig).not.toContain("globalConfig.agents");

      // Key invariant: the global skill must appear exactly once (no accumulation).
      // Count occurrences of the skill ID in the config to detect duplication.
      const reactSkillOccurrences = updatedProjectConfig.split("web-framework-react").length - 1;
      expect(
        reactSkillOccurrences,
        "Global skill 'web-framework-react' should appear exactly once in project config (no accumulation)",
      ).toBe(1);

      // Also verify the global config still has its skill (it wasn't removed)
      const globalConfigPath = path.join(tempHOME, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const updatedGlobalConfig = await readTestFile(globalConfigPath);
      expect(updatedGlobalConfig).toContain("web-framework-react");
    },
  );
});
