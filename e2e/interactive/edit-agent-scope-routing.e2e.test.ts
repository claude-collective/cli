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
  fileExists,
  readTestFile,
} from "../helpers/test-utils.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { DIRS, TIMEOUTS, EXIT_CODES } from "../pages/constants.js";
import "../matchers/setup.js";

/**
 * Bug A regression test: edit command must route agent compilation output
 * to the correct scope directory.
 *
 * Scenario: A project has both global and project configs. The global config has
 * web-developer (scope: global). The project config has both web-developer (global)
 * and api-developer (project). After running edit and recompiling agents, each
 * agent's compiled output must land in its scope-appropriate directory:
 *   - global agents -> <HOME>/.claude/agents/
 *   - project agents -> <projectDir>/.claude/agents/
 */

describe("edit recompile routes agents to correct scope directory", () => {
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
    "should route global agents to ~/.claude/agents/ and project agents to project/.claude/agents/",
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

      // Create global agent file (stub — will be overwritten by recompilation)
      const globalAgentsDir = path.join(tempHOME, DIRS.CLAUDE, "agents");
      await mkdir(globalAgentsDir, { recursive: true });
      await writeFile(
        path.join(globalAgentsDir, "web-developer.md"),
        "---\nname: web-developer\n---\nSTUB: global web developer agent.\n",
      );

      // --- Setup project config at <tempHOME>/project/.claude-src/config.ts ---
      // web-developer is global-scoped, api-developer is project-scoped.
      // The config includes "web-styling-tailwind" — a skill that does NOT exist
      // in the E2E source. The wizard drops it, creating a "removed" change
      // that triggers the full edit flow (config write + agent recompilation).
      await writeProjectConfig(projectDir, {
        name: "bug-a-test",
        skills: [
          { id: "web-framework-react", scope: "global", source: "local" },
          { id: "web-testing-vitest", scope: "project", source: "local" },
          { id: "web-styling-tailwind", scope: "project", source: "local" },
        ],
        agents: [
          { name: "web-developer", scope: "global" },
          { name: "api-developer", scope: "project" },
        ],
        selectedAgents: ["web-developer", "api-developer"],
        domains: ["web"],
      });

      // Create project skill directories
      for (const skill of [
        { id: "web-framework-react", category: "web-framework", slug: "react" },
        { id: "web-testing-vitest", category: "web-testing", slug: "vitest" },
        { id: "web-styling-tailwind", category: "web-styling", slug: "tailwind" },
      ] as const) {
        await createLocalSkill(projectDir, skill.id, {
          description: `${skill.id} skill`,
          metadata: `author: "@test"\ndisplayName: ${skill.id}\ncategory: ${skill.category}\nslug: ${skill.slug}\ncontentHash: "e2e-hash-${skill.slug}"\n`,
        });
      }

      // Create project agent file for api-developer (stub)
      const projectAgentsDir = path.join(projectDir, DIRS.CLAUDE, "agents");
      await mkdir(projectAgentsDir, { recursive: true });
      await writeFile(
        path.join(projectAgentsDir, "api-developer.md"),
        "---\nname: api-developer\n---\nSTUB: project api developer agent.\n",
      );

      // Create permissions file to prevent blocking prompt
      await createPermissionsFile(projectDir);

      // --- Action: run edit wizard, navigate through without changes ---
      // --agent-source is needed so that recompileAgents finds agent definitions.
      wizard = await EditWizard.launch({
        projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        env: { HOME: tempHOME },
        extraArgs: ["--agent-source", sourceDir],
      });

      // Single domain — advance through build -> sources -> agents -> confirm
      const sources = await wizard.build.advanceToSources();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("edit");
      const result = await confirm.confirm();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      // --- Assert: agents were routed to correct scope directories ---

      // 1. Global agent: web-developer.md should exist at <tempHOME>/.claude/agents/
      //    and should have been recompiled (no longer the "STUB" content)
      const globalWebDevPath = path.join(tempHOME, DIRS.CLAUDE, "agents", "web-developer.md");
      expect(
        await fileExists(globalWebDevPath),
        "Global agent web-developer.md should exist in ~/.claude/agents/",
      ).toBe(true);

      const globalWebDevContent = await readTestFile(globalWebDevPath);
      expect(
        globalWebDevContent,
        "Global agent web-developer.md should have been recompiled (not the stub)",
      ).not.toContain("STUB");

      // 2. Project agent: api-developer.md should exist at <projectDir>/.claude/agents/
      //    and should have been recompiled (no longer the "STUB" content)
      const projectApiDevPath = path.join(projectDir, DIRS.CLAUDE, "agents", "api-developer.md");
      expect(
        await fileExists(projectApiDevPath),
        "Project agent api-developer.md should exist in project/.claude/agents/",
      ).toBe(true);

      const projectApiDevContent = await readTestFile(projectApiDevPath);
      expect(
        projectApiDevContent,
        "Project agent api-developer.md should have been recompiled (not the stub)",
      ).not.toContain("STUB");

      // 3. Cross-contamination check: web-developer should NOT have been recompiled
      //    into the project agents directory.
      const projectWebDevPath = path.join(projectDir, DIRS.CLAUDE, "agents", "web-developer.md");
      expect(
        await fileExists(projectWebDevPath),
        "Global-scoped web-developer.md should NOT be recompiled into project/.claude/agents/",
      ).toBe(false);
    },
  );
});
