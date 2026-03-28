import path from "path";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  createLocalSkill,
  ensureBinaryExists,
  fileExists,
  listFiles,
  readTestFile,
  agentsPath,
  writeProjectConfig,
} from "../helpers/test-utils.js";
import "../matchers/setup.js";
import { EXIT_CODES, DIRS } from "../pages/constants.js";
import { CLI } from "../fixtures/cli.js";

function agentFilePath(dir: string, agentName: string): string {
  return path.join(agentsPath(dir), `${agentName}.md`);
}

/**
 * Regression tests for compile scope-filtering fixes.
 *
 * Dual-pass scope filtering — project pass must NOT overwrite global agents.
 * Global skill discovery — project pass must see global local skills.
 * Filtered agents per pass — each pass only compiles its own scope's agents.
 */
describe("compile scope filtering", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  });

  describe("dual-pass scope filtering", () => {
    it("should not overwrite global agent with zero-skill version during project pass", async () => {
      tempDir = await createTempDir();
      const globalHome = path.join(tempDir, "global-home");
      const projectDir = path.join(tempDir, "project");

      // Global installation: web-developer agent with a skill
      await writeProjectConfig(globalHome, {
        name: "global-test",
        skills: [{ id: "web-testing-cypress-e2e", scope: "global", source: "eject" }],
        agents: [{ name: "web-developer", scope: "global" }],
        domains: ["web"],
        stack: {
          "web-developer": {
            "web-testing": [{ id: "web-testing-cypress-e2e", preloaded: true }],
          },
        },
      });

      await createLocalSkill(globalHome, "web-testing-cypress-e2e", {
        description: "Global skill for scope filtering test",
        metadata: `author: "@test"\ncontentHash: "hash-global-sf"\n`,
      });

      // Project installation: api-developer agent with a different skill.
      // The project config does NOT have web-developer in its agents list,
      // but before the fix, the project pass would compile ALL agents from
      // the agent definitions source, including web-developer, with zero skills.
      await writeProjectConfig(projectDir, {
        name: "project-test",
        skills: [
          { id: "web-testing-playwright-e2e", scope: "project", source: "eject" },
          { id: "web-testing-cypress-e2e", scope: "global", source: "eject" },
        ],
        agents: [{ name: "api-developer", scope: "project" }],
        domains: ["web"],
        stack: {
          "api-developer": {
            "web-testing": [{ id: "web-testing-playwright-e2e", preloaded: true }],
          },
        },
      });

      await createLocalSkill(projectDir, "web-testing-playwright-e2e", {
        description: "Project skill for scope filtering test",
        metadata: `author: "@test"\ncontentHash: "hash-project-sf"\n`,
      });

      const { exitCode, output } = await CLI.run(
        ["compile"],
        { dir: projectDir },
        { env: { HOME: globalHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("Compiling global agents");
      expect(output).toContain("Compiling project agents");

      // Global agent should exist and contain its skill (not be clobbered)
      const globalAgentPath = agentFilePath(globalHome, "web-developer");
      expect(await fileExists(globalAgentPath)).toBe(true);
      const globalAgentContent = await readTestFile(globalAgentPath);
      expect(globalAgentContent).toContain("web-testing-cypress-e2e");

      // web-developer should NOT appear in the project agents directory
      // (it's a global agent, not a project agent)
      const projectWebDevPath = agentFilePath(projectDir, "web-developer");
      expect(await fileExists(projectWebDevPath)).toBe(false);

      // Project agent should exist and contain its skill
      await expect({ dir: projectDir }).toHaveCompiledAgent("api-developer");
    });

    it("should compile global agent with skills even when project config has no stack entry for it", async () => {
      tempDir = await createTempDir();
      const globalHome = path.join(tempDir, "global-home");
      const projectDir = path.join(tempDir, "project");

      // Global installation: two agents, each with a skill
      await writeProjectConfig(globalHome, {
        name: "global-test",
        skills: [
          { id: "web-testing-cypress-e2e", scope: "global", source: "eject" },
          { id: "web-framework-react", scope: "global", source: "eject" },
        ],
        agents: [
          { name: "web-developer", scope: "global" },
          { name: "api-developer", scope: "global" },
        ],
        domains: ["web"],
        stack: {
          "web-developer": {
            "web-testing": [{ id: "web-testing-cypress-e2e", preloaded: true }],
          },
          "api-developer": {
            "web-framework": [{ id: "web-framework-react", preloaded: true }],
          },
        },
      });

      await createLocalSkill(globalHome, "web-testing-cypress-e2e", {
        description: "Global skill A",
        metadata: `author: "@test"\ncontentHash: "hash-gA"\n`,
      });
      await createLocalSkill(globalHome, "web-framework-react", {
        description: "Global skill B",
        metadata: `author: "@test"\ncontentHash: "hash-gB"\n`,
      });

      // Project installation: completely different agent, no overlap with global
      await writeProjectConfig(projectDir, {
        name: "project-test",
        skills: [{ id: "web-testing-playwright-e2e", scope: "project", source: "eject" }],
        agents: [{ name: "cli-developer", scope: "project" }],
        domains: ["web"],
        stack: {
          "cli-developer": {
            "web-testing": [{ id: "web-testing-playwright-e2e", preloaded: true }],
          },
        },
      });

      await createLocalSkill(projectDir, "web-testing-playwright-e2e", {
        description: "Project skill",
        metadata: `author: "@test"\ncontentHash: "hash-pC"\n`,
      });

      const { exitCode } = await CLI.run(
        ["compile"],
        { dir: projectDir },
        { env: { HOME: globalHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Both global agents should be compiled with their respective skills
      const globalWebDev = await readTestFile(agentFilePath(globalHome, "web-developer"));
      expect(globalWebDev).toContain("web-testing-cypress-e2e");

      const globalApiDev = await readTestFile(agentFilePath(globalHome, "api-developer"));
      expect(globalApiDev).toContain("web-framework-react");

      // Project agent compiled separately
      await expect({ dir: projectDir }).toHaveCompiledAgent("cli-developer");
    });
  });

  describe("global skill discovery for project pass", () => {
    it("should make global local skills available to project agents", async () => {
      tempDir = await createTempDir();
      const globalHome = path.join(tempDir, "global-home");
      const projectDir = path.join(tempDir, "project");

      // Global installation: one global skill
      await writeProjectConfig(globalHome, {
        name: "global-test",
        skills: [{ id: "web-testing-cypress-e2e", scope: "global", source: "eject" }],
        agents: [{ name: "web-developer", scope: "global" }],
        domains: ["web"],
        stack: {
          "web-developer": {
            "web-testing": [{ id: "web-testing-cypress-e2e", preloaded: true }],
          },
        },
      });

      await createLocalSkill(globalHome, "web-testing-cypress-e2e", {
        description: "Global local skill for discovery test",
        metadata: `author: "@test"\ncontentHash: "hash-gd"\n`,
      });

      // Project installation: project agent references the GLOBAL skill via stack.
      // Before the fix, the project pass only discovered project plugins,
      // so it couldn't find globally-installed local skills.
      await writeProjectConfig(projectDir, {
        name: "project-test",
        skills: [
          { id: "web-testing-cypress-e2e", scope: "global", source: "eject" },
          { id: "web-testing-playwright-e2e", scope: "project", source: "eject" },
        ],
        agents: [{ name: "api-developer", scope: "project" }],
        domains: ["web"],
        stack: {
          "api-developer": {
            "web-testing": [
              { id: "web-testing-cypress-e2e", preloaded: true },
              { id: "web-testing-playwright-e2e", preloaded: true },
            ],
          },
        },
      });

      await createLocalSkill(projectDir, "web-testing-playwright-e2e", {
        description: "Project-local skill for discovery test",
        metadata: `author: "@test"\ncontentHash: "hash-pd"\n`,
      });

      const { exitCode, output } = await CLI.run(
        ["compile", "--verbose"],
        { dir: projectDir },
        { env: { HOME: globalHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Project agent should include both the project-local AND global-local skill
      const projectAgentPath = agentFilePath(projectDir, "api-developer");
      expect(await fileExists(projectAgentPath)).toBe(true);
      const content = await readTestFile(projectAgentPath);
      expect(content).toContain("web-testing-playwright-e2e");
      expect(content).toContain("web-testing-cypress-e2e");
    });

    it("should discover global local skills even when project has no global-scoped skills in config", async () => {
      tempDir = await createTempDir();
      const globalHome = path.join(tempDir, "global-home");
      const projectDir = path.join(tempDir, "project");

      // Global installation with a skill
      await writeProjectConfig(globalHome, {
        name: "global-test",
        skills: [{ id: "web-testing-cypress-e2e", scope: "global", source: "eject" }],
        agents: [{ name: "web-developer", scope: "global" }],
        domains: ["web"],
        stack: {
          "web-developer": {
            "web-testing": [{ id: "web-testing-cypress-e2e", preloaded: true }],
          },
        },
      });

      await createLocalSkill(globalHome, "web-testing-cypress-e2e", {
        description: "Global skill for project discovery",
        metadata: `author: "@test"\ncontentHash: "hash-gpd"\n`,
      });

      // Project installation: references the global skill in its stack
      // but only has project-scoped skills in config
      await writeProjectConfig(projectDir, {
        name: "project-test",
        skills: [{ id: "web-testing-playwright-e2e", scope: "project", source: "eject" }],
        agents: [{ name: "api-developer", scope: "project" }],
        domains: ["web"],
        stack: {
          "api-developer": {
            "web-testing": [{ id: "web-testing-cypress-e2e", preloaded: true }],
          },
        },
      });

      await createLocalSkill(projectDir, "web-testing-playwright-e2e", {
        description: "Project skill (not referenced in stack)",
        metadata: `author: "@test"\ncontentHash: "hash-ppd"\n`,
      });

      const { exitCode } = await CLI.run(
        ["compile"],
        { dir: projectDir },
        { env: { HOME: globalHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // The project agent should include the global skill even though
      // the project config only has project-scoped skills
      const projectAgentPath = agentFilePath(projectDir, "api-developer");
      expect(await fileExists(projectAgentPath)).toBe(true);
      const content = await readTestFile(projectAgentPath);
      expect(content).toContain("web-testing-cypress-e2e");
    });
  });

  describe("project agents not clobbered by global pass", () => {
    it("should compile project agents with their own skills, not zero-skill versions", async () => {
      tempDir = await createTempDir();
      const globalHome = path.join(tempDir, "global-home");
      const projectDir = path.join(tempDir, "project");

      // Global installation: web-developer only
      await writeProjectConfig(globalHome, {
        name: "global-test",
        skills: [{ id: "web-testing-cypress-e2e", scope: "global", source: "eject" }],
        agents: [{ name: "web-developer", scope: "global" }],
        domains: ["web"],
        stack: {
          "web-developer": {
            "web-testing": [{ id: "web-testing-cypress-e2e", preloaded: true }],
          },
        },
      });

      await createLocalSkill(globalHome, "web-testing-cypress-e2e", {
        description: "Global skill",
        metadata: `author: "@test"\ncontentHash: "hash-g13"\n`,
      });

      // Project installation: api-developer with its own skill assignment
      await writeProjectConfig(projectDir, {
        name: "project-test",
        skills: [
          { id: "web-testing-playwright-e2e", scope: "project", source: "eject" },
          { id: "web-testing-cypress-e2e", scope: "global", source: "eject" },
        ],
        agents: [{ name: "api-developer", scope: "project" }],
        domains: ["web"],
        stack: {
          "api-developer": {
            "web-testing": [{ id: "web-testing-playwright-e2e", preloaded: true }],
          },
        },
      });

      await createLocalSkill(projectDir, "web-testing-playwright-e2e", {
        description: "Project skill for non-clobber test",
        metadata: `author: "@test"\ncontentHash: "hash-p13"\n`,
      });

      const { exitCode } = await CLI.run(
        ["compile"],
        { dir: projectDir },
        { env: { HOME: globalHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Project agent should have its skill, not be empty/zero-skill
      const projectAgentPath = agentFilePath(projectDir, "api-developer");
      expect(await fileExists(projectAgentPath)).toBe(true);
      const content = await readTestFile(projectAgentPath);

      // Verify the agent has real content (not a zero-skill compilation)
      const MIN_AGENT_CONTENT_LENGTH = 200;
      expect(content.length).toBeGreaterThan(MIN_AGENT_CONTENT_LENGTH);
      expect(content).toContain("web-testing-playwright-e2e");
      expect(content).toContain("name: api-developer");
    });

    it("should not produce duplicate agent files across scopes", async () => {
      tempDir = await createTempDir();
      const globalHome = path.join(tempDir, "global-home");
      const projectDir = path.join(tempDir, "project");

      // Global: web-developer
      await writeProjectConfig(globalHome, {
        name: "global-test",
        skills: [{ id: "web-testing-cypress-e2e", scope: "global", source: "eject" }],
        agents: [{ name: "web-developer", scope: "global" }],
        domains: ["web"],
        stack: {
          "web-developer": {
            "web-testing": [{ id: "web-testing-cypress-e2e", preloaded: true }],
          },
        },
      });

      await createLocalSkill(globalHome, "web-testing-cypress-e2e", {
        description: "Global skill for dedup test",
        metadata: `author: "@test"\ncontentHash: "hash-gdd"\n`,
      });

      // Project: api-developer
      await writeProjectConfig(projectDir, {
        name: "project-test",
        skills: [
          { id: "web-testing-playwright-e2e", scope: "project", source: "eject" },
          { id: "web-testing-cypress-e2e", scope: "global", source: "eject" },
        ],
        agents: [{ name: "api-developer", scope: "project" }],
        domains: ["web"],
        stack: {
          "api-developer": {
            "web-testing": [{ id: "web-testing-playwright-e2e", preloaded: true }],
          },
        },
      });

      await createLocalSkill(projectDir, "web-testing-playwright-e2e", {
        description: "Project skill for dedup test",
        metadata: `author: "@test"\ncontentHash: "hash-pdd"\n`,
      });

      const { exitCode } = await CLI.run(
        ["compile"],
        { dir: projectDir },
        { env: { HOME: globalHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // web-developer should ONLY be in global dir, NOT in project dir
      const globalAgents = await listFiles(agentsPath(globalHome));
      const projectAgents = await listFiles(agentsPath(projectDir));

      const globalMdFiles = globalAgents.filter((f) => f.endsWith(".md"));
      const projectMdFiles = projectAgents.filter((f) => f.endsWith(".md"));

      expect(globalMdFiles).toContain("web-developer.md");
      expect(globalMdFiles).not.toContain("api-developer.md");

      expect(projectMdFiles).toContain("api-developer.md");
      expect(projectMdFiles).not.toContain("web-developer.md");
    });

    it("should output correct pass labels in verbose mode", async () => {
      tempDir = await createTempDir();
      const globalHome = path.join(tempDir, "global-home");
      const projectDir = path.join(tempDir, "project");

      // Global: web-developer
      await writeProjectConfig(globalHome, {
        name: "global-test",
        skills: [{ id: "web-testing-cypress-e2e", scope: "global", source: "eject" }],
        agents: [{ name: "web-developer", scope: "global" }],
        domains: ["web"],
        stack: {
          "web-developer": {
            "web-testing": [{ id: "web-testing-cypress-e2e", preloaded: true }],
          },
        },
      });

      await createLocalSkill(globalHome, "web-testing-cypress-e2e", {
        description: "Global skill for verbose test",
        metadata: `author: "@test"\ncontentHash: "hash-gv"\n`,
      });

      // Project: api-developer
      await writeProjectConfig(projectDir, {
        name: "project-test",
        skills: [{ id: "web-testing-playwright-e2e", scope: "project", source: "eject" }],
        agents: [{ name: "api-developer", scope: "project" }],
        domains: ["web"],
        stack: {
          "api-developer": {
            "web-testing": [{ id: "web-testing-playwright-e2e", preloaded: true }],
          },
        },
      });

      await createLocalSkill(projectDir, "web-testing-playwright-e2e", {
        description: "Project skill for verbose test",
        metadata: `author: "@test"\ncontentHash: "hash-pv"\n`,
      });

      const { exitCode, output } = await CLI.run(
        ["compile", "--verbose"],
        { dir: projectDir },
        { env: { HOME: globalHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Both passes should be labeled
      expect(output).toContain("Compiling global agents");
      expect(output).toContain("Compiling project agents");
      expect(output).toContain("Global compile complete");
      expect(output).toContain("Project compile complete");

      // Each pass should report recompiled agents
      expect(output).toMatch(/Recompiled \d+ global agents/);
      expect(output).toMatch(/Recompiled \d+ project agents/);
    });
  });
});
