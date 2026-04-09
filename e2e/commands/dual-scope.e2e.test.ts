import path from "path";
import { mkdir } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  createLocalSkill,
  directoryExists,
  ensureBinaryExists,
  listFiles,
  agentsPath,
  writeProjectConfig,
} from "../helpers/test-utils.js";
import { ProjectBuilder } from "../fixtures/project-builder.js";
import { EXIT_CODES, DIRS } from "../pages/constants.js";
import { CLI } from "../fixtures/cli.js";
import "../matchers/setup.js";

describe("dual-scope compile", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  });

  it("should compile agents to both global and project locations", async () => {
    const { project, globalHome } = await ProjectBuilder.dualScope();
    tempDir = path.dirname(project.dir);

    const { exitCode } = await CLI.run(
      ["compile"],
      { dir: project.dir },
      { env: { HOME: globalHome.dir } },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    await expect(globalHome).toHaveCompiledAgent("web-developer");
    await expect(project).toHaveCompiledAgent("api-developer");
  });

  it("should compile global agents referencing only global skills", async () => {
    const { project, globalHome } = await ProjectBuilder.dualScope();
    tempDir = path.dirname(project.dir);

    const { exitCode } = await CLI.run(
      ["compile"],
      { dir: project.dir },
      { env: { HOME: globalHome.dir } },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    await expect({ dir: globalHome.dir }).toHaveCompiledAgentContent("web-developer", {
      contains: ["web-testing-cypress-e2e"],
      notContains: ["web-testing-playwright-e2e"],
    });
  });

  it("should compile project agents referencing both global and project skills", async () => {
    const { project, globalHome } = await ProjectBuilder.dualScope();
    tempDir = path.dirname(project.dir);

    const { exitCode } = await CLI.run(
      ["compile"],
      { dir: project.dir },
      { env: { HOME: globalHome.dir } },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    await expect({ dir: project.dir }).toHaveCompiledAgentContent("api-developer", {
      contains: ["web-testing-playwright-e2e", "web-testing-cypress-e2e"],
    });
  });

  it("should work with global-only installation", async () => {
    tempDir = await createTempDir();

    // Only global home has a config — project dir is bare
    const globalHome = path.join(tempDir, "global-home");
    const projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });

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
      description: "Global skill for single-scope test",
      metadata: `author: "@test"\ncontentHash: "hash-global"\n`,
    });

    const { exitCode } = await CLI.run(
      ["compile"],
      { dir: projectDir },
      { env: { HOME: globalHome } },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    await expect({ dir: globalHome }).toHaveCompiledAgent("web-developer");

    const projectAgentsExist = await directoryExists(agentsPath(projectDir));
    expect(projectAgentsExist).toBe(false);
  });

  it("should work with project-only installation", async () => {
    tempDir = await createTempDir();

    // Fake HOME has no .claude-src/ — only project dir has config
    const globalHome = path.join(tempDir, "global-home");
    const projectDir = path.join(tempDir, "project");
    await mkdir(globalHome, { recursive: true });

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
      description: "Project skill for single-scope test",
      metadata: `author: "@test"\ncontentHash: "hash-local"\n`,
    });

    const { exitCode } = await CLI.run(
      ["compile"],
      { dir: projectDir },
      { env: { HOME: globalHome } },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    await expect({ dir: projectDir }).toHaveCompiledAgent("api-developer");

    // The global agents directory is now always created (ensureDir is unconditional),
    // but for a project-only install no agent .md files should be written there.
    const globalAgentFiles = await listFiles(agentsPath(globalHome));
    const globalMdFiles = globalAgentFiles.filter((f) => f.endsWith(".md"));
    expect(globalMdFiles.length).toBe(0);
  });

  it("should include global-only skills in project agent when project has no local skills", async () => {
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
      description: "Global skill for cross-scope test",
      metadata: `author: "@test"\ncontentHash: "hash-global"\n`,
    });

    // Project installation: agent references the global skill but has NO local skills
    await writeProjectConfig(projectDir, {
      name: "project-test",
      skills: [{ id: "web-testing-cypress-e2e", scope: "global", source: "eject" }],
      agents: [{ name: "api-developer", scope: "project" }],
      domains: ["web"],
      stack: {
        "api-developer": {
          "web-testing": [{ id: "web-testing-cypress-e2e", preloaded: true }],
        },
      },
    });

    const { exitCode } = await CLI.run(
      ["compile"],
      { dir: projectDir },
      { env: { HOME: globalHome } },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    // The project agent must contain the global skill even though the project
    // directory has no local skills — the compiler must discover ~/.claude/skills/.
    await expect({ dir: projectDir }).toHaveCompiledAgentContent("api-developer", {
      contains: ["web-testing-cypress-e2e"],
    });
  });

  it("should show both passes in verbose output", async () => {
    const { project, globalHome } = await ProjectBuilder.dualScope();
    tempDir = path.dirname(project.dir);

    const { exitCode, output } = await CLI.run(
      ["compile", "--verbose"],
      { dir: project.dir },
      { env: { HOME: globalHome.dir } },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(output).toContain("Compiling global agents");
    expect(output).toContain("Compiling project agents");
    expect(output).toContain("Loaded skill:");
    expect(output).toContain("web-testing-cypress-e2e");
    expect(output).toContain("web-testing-playwright-e2e");
  });
});
