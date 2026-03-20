import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { CLAUDE_DIR } from "../../src/cli/consts.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  writeProjectConfig,
  createPermissionsFile,
  createLocalSkill,
  fileExists,
  navigateEditWizardToCompletion,
  WIZARD_LOAD_TIMEOUT_MS,
  EXIT_CODES,
  SETUP_TIMEOUT_MS,
} from "../helpers/test-utils.js";

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
 *
 * Code path under test:
 *   edit.tsx -> recompileAgents() -> compileAndWriteAgents()
 *   agent-recompiler.ts:141 — scope = agentScopeMap?.get(agentName) ?? "project"
 *   agent-recompiler.ts:142 — targetDir = scope === "global" ? globalAgentsDir : agentsDir
 *
 * This test serves as a regression guard to ensure scope-aware routing stays in place.
 */

describe("edit recompile routes agents to correct scope directory", () => {
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
    "should route global agents to ~/.claude/agents/ and project agents to project/.claude/agents/",
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

      // Create global agent file (stub — will be overwritten by recompilation)
      const globalAgentsDir = path.join(tempHOME, CLAUDE_DIR, "agents");
      await mkdir(globalAgentsDir, { recursive: true });
      await writeFile(
        path.join(globalAgentsDir, "web-developer.md"),
        "---\nname: web-developer\n---\nSTUB: global web developer agent.\n",
      );

      // --- Setup project config at <tempHOME>/project/.claude-src/config.ts ---
      // web-developer is global-scoped, api-developer is project-scoped.
      //
      // The config includes `selectedAgents` so the wizard initialization path at
      // use-wizard-initialization.ts:48-53 restores the exact agent selection and
      // scope configs, rather than calling preselectAgentsFromDomains() which would
      // reset all scopes to "global".
      //
      // The config also includes "web-styling-tailwind" — a skill that does NOT exist
      // in the E2E source. The wizard cannot resolve it, so it drops it from the result.
      // This creates a "removed" skill change that triggers the full edit flow
      // (config write + agent recompilation). Without this deliberate difference,
      // the edit command would detect "no changes" and exit early (edit.tsx:242-246).
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

      // Create project skill directories with SKILL.md and metadata.yaml
      // Note: web-styling-tailwind is in the config but we create a skill dir for it
      // so discoverAllPluginSkills/populateFromSkillIds can find it. The wizard will
      // drop it because it has no matching skill in the E2E source matrix.
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

      // Create project agent file for api-developer (stub — will be overwritten by recompilation)
      const projectAgentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      await mkdir(projectAgentsDir, { recursive: true });
      await writeFile(
        path.join(projectAgentsDir, "api-developer.md"),
        "---\nname: api-developer\n---\nSTUB: project api developer agent.\n",
      );

      // Create permissions file to prevent blocking prompt
      await createPermissionsFile(projectDir);

      // --- Action: run edit wizard, navigate through without changes ---
      // --agent-source is needed so that recompileAgents finds web-developer and
      // api-developer definitions. Without it, the CLI loads its built-in agents
      // (developer, tester, etc.) which don't include these E2E test agents.
      session = new TerminalSession(
        ["edit", "--source", sourceDir, "--agent-source", sourceDir],
        projectDir,
        {
          env: {
            HOME: tempHOME,
            AGENTSINC_SOURCE: undefined,
          },
        },
      );

      // Wait for the build step to render
      await session.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);

      // Navigate through without changes (single domain — only 1 Enter on build step)
      await navigateEditWizardToCompletion(session, SETUP_TIMEOUT_MS);

      // Wait for the edit flow to complete
      await session.waitForText("Recompiling agents", SETUP_TIMEOUT_MS);
      const exitCode = await session.waitForExit(SETUP_TIMEOUT_MS);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // --- Assert: agents were routed to correct scope directories ---

      // 1. Global agent: web-developer.md should exist at <tempHOME>/.claude/agents/
      //    and should have been recompiled (no longer the "STUB" content)
      const globalWebDevPath = path.join(tempHOME, CLAUDE_DIR, "agents", "web-developer.md");
      expect(
        await fileExists(globalWebDevPath),
        "Global agent web-developer.md should exist in ~/.claude/agents/",
      ).toBe(true);

      const globalWebDevContent = await readFile(globalWebDevPath, "utf-8");
      expect(
        globalWebDevContent,
        "Global agent web-developer.md should have been recompiled (not the stub)",
      ).not.toContain("STUB");

      // 2. Project agent: api-developer.md should exist at <projectDir>/.claude/agents/
      //    and should have been recompiled (no longer the "STUB" content)
      const projectApiDevPath = path.join(projectDir, CLAUDE_DIR, "agents", "api-developer.md");
      expect(
        await fileExists(projectApiDevPath),
        "Project agent api-developer.md should exist in project/.claude/agents/",
      ).toBe(true);

      const projectApiDevContent = await readFile(projectApiDevPath, "utf-8");
      expect(
        projectApiDevContent,
        "Project agent api-developer.md should have been recompiled (not the stub)",
      ).not.toContain("STUB");

      // 3. Cross-contamination check: web-developer should NOT have been recompiled
      //    into the project agents directory. It may exist there from a prior setup,
      //    but the recompiler should route it to global. Since we didn't create a
      //    web-developer.md stub in the project agents dir, it should not appear there
      //    unless the scope routing is broken.
      const projectWebDevPath = path.join(projectDir, CLAUDE_DIR, "agents", "web-developer.md");
      expect(
        await fileExists(projectWebDevPath),
        "Global-scoped web-developer.md should NOT be recompiled into project/.claude/agents/",
      ).toBe(false);
    },
  );
});
