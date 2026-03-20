import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  writeProjectConfig,
  createPermissionsFile,
  createLocalSkill,
  navigateEditWizardToCompletion,
  WIZARD_LOAD_TIMEOUT_MS,
  EXIT_CODES,
  SETUP_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * Bug B regression test: project config must not accumulate global-scoped skills
 * after running the edit wizard.
 *
 * Scenario: A project has both global and project configs. The global config has
 * web-framework-react (scope: global). The project config has web-testing-vitest
 * (scope: project). After a no-op edit (navigate through wizard without changes),
 * the project config should still only contain the project-scoped skill. The
 * global skill must not leak into the project config.
 *
 * Code path under test:
 *   edit.tsx -> buildAndMergeConfig() -> writeScopedConfigs() -> splitConfigByScope()
 *
 * splitConfigByScope filters skills by scope: global skills go to ~/.claude-src/config.ts,
 * project skills go to <project>/.claude-src/config.ts. If this filtering fails, global
 * skills would accumulate in the project config on each edit.
 */

describe("project config does not accumulate global skills after edit", () => {
  let sourceDir: string;
  let sourceTempDir: string;
  let tempHOME: string | undefined;
  let session: TerminalSession | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  afterEach(async () => {
    await session?.destroy();
    session = undefined;
    if (tempHOME) {
      await cleanupTempDir(tempHOME);
      tempHOME = undefined;
    }
  });

  it(
    "should not add global skills to project config after no-op edit",
    { timeout: SETUP_TIMEOUT_MS },
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
      const globalAgentsDir = path.join(tempHOME, CLAUDE_DIR, "agents");
      await mkdir(globalAgentsDir, { recursive: true });
      await writeFile(
        path.join(globalAgentsDir, "web-developer.md"),
        "---\nname: web-developer\n---\nGlobal web developer agent.\n",
      );

      // --- Setup project config at <tempHOME>/project/.claude-src/config.ts ---
      // The project config includes BOTH the global-scoped skill (inherited from global)
      // and the project-scoped skill. This mirrors the state after an initial init or edit
      // that touched both scopes. The bug scenario is that after a no-op edit,
      // splitConfigByScope should remove the global skill from the project config file.
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
      const projectAgentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      await mkdir(projectAgentsDir, { recursive: true });
      await writeFile(
        path.join(projectAgentsDir, "web-developer.md"),
        "---\nname: web-developer\n---\nProject web developer agent.\n",
      );

      // Create permissions file to prevent blocking prompt
      await createPermissionsFile(projectDir);

      const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);

      // --- Action: run edit wizard, navigate through without changes ---
      session = new TerminalSession(["edit", "--source", sourceDir], projectDir, {
        env: {
          HOME: tempHOME,
          AGENTSINC_SOURCE: undefined,
        },
      });

      // Wait for the build step to render
      await session.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);

      // Navigate through without changes
      await navigateEditWizardToCompletion(session, SETUP_TIMEOUT_MS);

      // Wait for the edit flow to complete
      await session.waitForText("Recompiling agents", SETUP_TIMEOUT_MS);
      const exitCode = await session.waitForExit(SETUP_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // --- Assert: project config should not contain global skills in the skills array ---
      const updatedProjectConfig = await readFile(projectConfigPath, "utf-8");

      // The project config MUST contain the project-scoped skill
      expect(updatedProjectConfig).toContain("web-testing-vitest");

      // The skills array in the project config should NOT contain the global skill as an
      // inline entry. It may reference global skills via `...globalConfig.skills` spread
      // (which is correct), but it must not have `"id":"web-framework-react"` as a literal
      // skill object in the project config. The stack section may reference skill IDs for
      // agent routing — that's expected and not a scope leak.
      //
      // Match the pattern of an inline skill config object with the global skill ID.
      // This would look like: {"id":"web-framework-react","scope":"...","source":"..."}
      const hasInlineGlobalSkill =
        updatedProjectConfig.includes('"id":"web-framework-react"') ||
        updatedProjectConfig.includes('"id": "web-framework-react"');
      expect(
        hasInlineGlobalSkill,
        "Global skill 'web-framework-react' should not appear as an inline skill config in the project config",
      ).toBe(false);

      // The project config should use `...globalConfig.skills` spread to inherit global skills
      // rather than inlining them
      expect(updatedProjectConfig).toContain("globalConfig.skills");

      // Also verify the global config still has its skill (it wasn't removed)
      const globalConfigPath = path.join(tempHOME, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const updatedGlobalConfig = await readFile(globalConfigPath, "utf-8");
      expect(updatedGlobalConfig).toContain("web-framework-react");
    },
  );
});
