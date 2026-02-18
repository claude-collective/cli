import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import path from "path";
import { readFile } from "fs/promises";

import {
  createTestSource,
  cleanupTestSource,
  type TestDirs,
  type TestStack,
} from "../fixtures/create-test-source";
import { installLocal } from "../../installation/local-installer";
import type { MergedSkillsMatrix, ProjectConfig, ResolvedSkill } from "../../../types";
import {
  fileExists,
  directoryExists,
  readTestYaml,
  buildWizardResult,
  buildSourceResult,
  createMockSkill,
  createMockMatrix,
} from "../helpers";
import { loadDefaultMappings, clearDefaultsCache } from "../../loading";
import { loadStacks } from "../../stacks/stacks-loader";

// Load YAML defaults once for all tests in this file
beforeAll(async () => {
  await loadDefaultMappings();
});

afterAll(() => {
  clearDefaultsCache();
});

// ── Test Stacks ───────────────────────────────────────────────────────────────

const CUSTOM_STACKS: TestStack[] = [
  {
    id: "custom-fullstack",
    name: "Custom Fullstack",
    description: "A consumer-defined fullstack stack",
    agents: {
      "web-developer": {
        framework: "web-framework-react",
      },
      "api-developer": {
        api: "api-framework-hono",
      },
    },
  },
  {
    id: "custom-testing",
    name: "Custom Testing",
    description: "A consumer-defined testing stack",
    agents: {
      "web-developer": {
        testing: "web-testing-vitest",
      },
    },
  },
];

function buildConsumerMatrix(): MergedSkillsMatrix {
  const skills: Record<string, ResolvedSkill> = {
    "web-framework-react": createMockSkill("web-framework-react", "web/framework", {
      description: "React framework for building user interfaces",
      tags: ["react", "web"],
    }),
    "api-framework-hono": createMockSkill("api-framework-hono", "api/framework", {
      description: "Hono API framework for the edge",
      tags: ["hono", "api"],
    }),
    "web-testing-vitest": createMockSkill("web-testing-vitest", "web/testing", {
      description: "Next generation testing framework",
      tags: ["testing", "vitest"],
    }),
  };
  return createMockMatrix(skills);
}

// ── T6: Consumer-Defined Stacks ─────────────────────────────────────────────

describe("Integration: Consumer-Defined Stacks (T6)", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestSource({
      stacks: CUSTOM_STACKS,
    });
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  it("should load custom stacks from source config/stacks.yaml", async () => {
    const stacks = await loadStacks(dirs.sourceDir);

    expect(stacks.length).toBe(2);
    expect(stacks[0].id).toBe("custom-fullstack");
    expect(stacks[0].name).toBe("Custom Fullstack");
    expect(stacks[1].id).toBe("custom-testing");
  });

  it("should return empty array when source has no stacks.yaml", async () => {
    const noDirs = await createTestSource();

    try {
      const stacks = await loadStacks(noDirs.sourceDir);
      expect(stacks).toEqual([]);
    } finally {
      await cleanupTestSource(noDirs);
    }
  });

  it("should install with custom stack skills reflected in config.yaml", async () => {
    const sourceResult = buildSourceResult(buildConsumerMatrix(), dirs.sourceDir);

    const result = await installLocal({
      wizardResult: buildWizardResult([
        "web-framework-react",
        "api-framework-hono",
      ]),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestYaml<ProjectConfig>(result.configPath);
    expect(config.skills).toContain("web-framework-react");
    expect(config.skills).toContain("api-framework-hono");
    expect(config.installMode).toBe("local");
  });
});

// ── T6: Consumer-Defined Skills Matrix ──────────────────────────────────────

describe("Integration: Consumer-Defined Skills Matrix (T6)", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestSource({
      stacks: CUSTOM_STACKS,
    });
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  it("should use source skills-matrix.yaml when present", async () => {
    const matrixPath = path.join(dirs.sourceDir, "config", "skills-matrix.yaml");
    expect(await fileExists(matrixPath)).toBe(true);

    const matrixContent = await readFile(matrixPath, "utf-8");
    expect(matrixContent).toContain("web-framework-react");
    expect(matrixContent).toContain("api-framework-hono");
    expect(matrixContent).toContain("web-testing-vitest");
  });

  it("should install all skills from source and compile agents", async () => {
    const sourceResult = buildSourceResult(buildConsumerMatrix(), dirs.sourceDir);

    const result = await installLocal({
      wizardResult: buildWizardResult([
        "web-framework-react",
        "api-framework-hono",
        "web-testing-vitest",
      ]),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    expect(result.copiedSkills).toHaveLength(3);
    expect(result.compiledAgents.length).toBeGreaterThan(0);
    expect(await directoryExists(result.skillsDir)).toBe(true);
    expect(await directoryExists(result.agentsDir)).toBe(true);
  });
});
