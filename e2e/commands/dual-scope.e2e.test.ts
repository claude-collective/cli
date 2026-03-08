import path from "path";
import { mkdir } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  createDualScopeProject,
  createLocalSkill,
  directoryExists,
  ensureBinaryExists,
  listFiles,
  readTestFile,
  runCLI,
  writeProjectConfig,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { CLAUDE_DIR } from "../../src/cli/consts.js";

describe("dual-scope compile", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  it("should compile agents to both global and project locations", async () => {
    tempDir = await createTempDir();
    const { globalHome, projectDir } = await createDualScopeProject(tempDir);

    const { exitCode } = await runCLI(["compile"], projectDir, {
      env: { HOME: globalHome, AGENTSINC_SOURCE: undefined },
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const globalAgents = await listFiles(path.join(globalHome, CLAUDE_DIR, "agents"));
    const projectAgents = await listFiles(path.join(projectDir, CLAUDE_DIR, "agents"));

    const globalMdFiles = globalAgents.filter((f) => f.endsWith(".md"));
    const projectMdFiles = projectAgents.filter((f) => f.endsWith(".md"));

    expect(globalMdFiles.length).toBeGreaterThan(0);
    expect(projectMdFiles.length).toBeGreaterThan(0);
  });

  it("should compile global agents referencing only global skills", async () => {
    tempDir = await createTempDir();
    const { globalHome, projectDir } = await createDualScopeProject(tempDir);

    const { exitCode } = await runCLI(["compile"], projectDir, {
      env: { HOME: globalHome, AGENTSINC_SOURCE: undefined },
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const globalAgentPath = path.join(globalHome, CLAUDE_DIR, "agents", "web-developer.md");
    const content = await readTestFile(globalAgentPath);

    expect(content).toContain("web-testing-e2e-global");
    expect(content).not.toContain("web-testing-e2e-local");
  });

  it("should compile project agents referencing both global and project skills", async () => {
    tempDir = await createTempDir();
    const { globalHome, projectDir } = await createDualScopeProject(tempDir);

    const { exitCode } = await runCLI(["compile"], projectDir, {
      env: { HOME: globalHome, AGENTSINC_SOURCE: undefined },
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const projectAgentPath = path.join(projectDir, CLAUDE_DIR, "agents", "api-developer.md");
    const content = await readTestFile(projectAgentPath);

    expect(content).toContain("web-testing-e2e-local");
    expect(content).toContain("web-testing-e2e-global");
  });

  it("should work with global-only installation", async () => {
    tempDir = await createTempDir();

    // Only global home has a config — project dir is bare
    const globalHome = path.join(tempDir, "global-home");
    const projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });

    await writeProjectConfig(globalHome, {
      name: "global-test",
      skills: [{ id: "web-testing-e2e-global", scope: "global", source: "local" }],
      agents: [{ name: "web-developer", scope: "global" }],
      domains: ["web"],
      stack: {
        "web-developer": {
          "web-testing": [{ id: "web-testing-e2e-global", preloaded: true }],
        },
      },
    });

    await createLocalSkill(globalHome, "web-testing-e2e-global", {
      description: "Global skill for single-scope test",
      metadata: `author: "@test"\ncontentHash: "hash-global"\n`,
    });

    const { exitCode } = await runCLI(["compile"], projectDir, {
      env: { HOME: globalHome, AGENTSINC_SOURCE: undefined },
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const globalAgents = await listFiles(path.join(globalHome, CLAUDE_DIR, "agents"));
    const globalMdFiles = globalAgents.filter((f) => f.endsWith(".md"));
    expect(globalMdFiles.length).toBeGreaterThan(0);

    const projectAgentsExist = await directoryExists(path.join(projectDir, CLAUDE_DIR, "agents"));
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
      skills: [{ id: "web-testing-e2e-local", scope: "project", source: "local" }],
      agents: [{ name: "api-developer", scope: "project" }],
      domains: ["web"],
      stack: {
        "api-developer": {
          "web-testing": [{ id: "web-testing-e2e-local", preloaded: true }],
        },
      },
    });

    await createLocalSkill(projectDir, "web-testing-e2e-local", {
      description: "Project skill for single-scope test",
      metadata: `author: "@test"\ncontentHash: "hash-local"\n`,
    });

    const { exitCode } = await runCLI(["compile"], projectDir, {
      env: { HOME: globalHome, AGENTSINC_SOURCE: undefined },
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const projectAgents = await listFiles(path.join(projectDir, CLAUDE_DIR, "agents"));
    const projectMdFiles = projectAgents.filter((f) => f.endsWith(".md"));
    expect(projectMdFiles.length).toBeGreaterThan(0);

    const globalAgentsExist = await directoryExists(path.join(globalHome, CLAUDE_DIR, "agents"));
    expect(globalAgentsExist).toBe(false);
  });

  it("should show both passes in verbose output", async () => {
    tempDir = await createTempDir();
    const { globalHome, projectDir } = await createDualScopeProject(tempDir);

    const { exitCode, combined } = await runCLI(["compile", "--verbose"], projectDir, {
      env: { HOME: globalHome, AGENTSINC_SOURCE: undefined },
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(combined).toContain("Compiling global agents");
    expect(combined).toContain("Compiling project agents");
    expect(combined).toContain("Loaded skill:");
    expect(combined).toContain("web-testing-e2e-global");
    expect(combined).toContain("web-testing-e2e-local");
  });
});
