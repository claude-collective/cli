import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadProjectConfig, validateProjectConfig } from "./project-config";
import { generateProjectConfigFromSkills } from "./config-generator";
import { generateConfigSource } from "./config-writer";
import type { AgentName } from "../../types";
import { useMatrixStore } from "../../stores/matrix-store";
import {
  createTempDir,
  cleanupTempDir,
  writeTestTsConfig,
  TEST_MATRICES,
} from "../__tests__/helpers";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../consts";

describe("project-config", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("cc-project-config-test-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("loadProjectConfig", () => {
    it("should return null if config file does not exist", async () => {
      const result = await loadProjectConfig(tempDir);
      expect(result).toBeNull();
    });

    it("should load minimal config (just name and agents)", async () => {
      await writeTestTsConfig(tempDir, {
        name: "my-project",
        agents: [
          { name: "web-developer", scope: "project" },
          { name: "api-developer", scope: "project" },
        ],
      });

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();

      expect(result!.config.name).toBe("my-project");
      expect(result!.config.agents).toEqual([
        { name: "web-developer", scope: "project" },
        { name: "api-developer", scope: "project" },
      ]);
    });

    it("should load config with stack (bare strings normalized to SkillAssignment[])", async () => {
      await writeTestTsConfig(tempDir, {
        name: "my-project",
        agents: [{ name: "web-developer", scope: "project" }],
        stack: {
          "web-developer": {
            "web-framework": "web-framework-react",
            "web-styling": "web-styling-scss-modules",
          },
        },
      });

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();
      // Bare strings are normalized to SkillAssignment[] at load time
      expect(result!.config.stack).toEqual({
        "web-developer": {
          "web-framework": [{ id: "web-framework-react", preloaded: false }],
          "web-styling": [{ id: "web-styling-scss-modules", preloaded: false }],
        },
      });
    });

    it("should load config with mixed stack formats (array, object, string)", async () => {
      await writeTestTsConfig(tempDir, {
        name: "my-project",
        agents: [{ name: "web-developer", scope: "project" }],
        stack: {
          "web-developer": {
            "web-framework": "web-framework-react",
            "shared-methodology": [
              { id: "meta-methodology-investigation-requirements", preloaded: true },
              { id: "meta-methodology-anti-over-engineering", preloaded: true },
            ],
            "web-styling": {
              id: "web-styling-scss-modules",
              preloaded: true,
            },
          },
        },
      });

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();
      expect(result!.config.stack).toEqual({
        "web-developer": {
          // bare string -> SkillAssignment[]
          "web-framework": [{ id: "web-framework-react", preloaded: false }],
          // array of objects -> SkillAssignment[]
          "shared-methodology": [
            { id: "meta-methodology-investigation-requirements", preloaded: true },
            { id: "meta-methodology-anti-over-engineering", preloaded: true },
          ],
          // single object -> SkillAssignment[]
          "web-styling": [{ id: "web-styling-scss-modules", preloaded: true }],
        },
      });
    });

    it("should load config with extra fields (passthrough)", async () => {
      await writeTestTsConfig(tempDir, {
        name: "my-stack",
        author: "@vince",
        description: "A config with extra fields",
        agents: [{ name: "web-developer", scope: "project" }],
      });

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();

      expect(result!.config.name).toBe("my-stack");
      expect(result!.config.author).toBe("@vince");
    });

    it("should return null for invalid config", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_TS),
        "invalid typescript content {{",
      );

      const result = await loadProjectConfig(tempDir);
      expect(result).toBeNull();
    });

    it("should return null for non-object config", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_TS),
        'export default "just a string";',
      );

      const result = await loadProjectConfig(tempDir);
      expect(result).toBeNull();
    });
  });

  describe("validateProjectConfig", () => {
    it("should pass for minimal valid config", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: [{ name: "web-developer", scope: "project" }],
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail for missing name", () => {
      const result = validateProjectConfig({
        agents: [{ name: "web-developer", scope: "project" }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("name is required and must be a string");
    });

    it("should fail for missing agents", () => {
      const result = validateProjectConfig({
        name: "my-project",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("agents is required and must be an array");
    });

    it("should fail for non-object agents", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer", 123],
      });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("must contain objects with name and scope")),
      ).toBe(true);
    });

    it("should fail for invalid version", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: [{ name: "web-developer", scope: "project" }],
        version: "2",
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('version must be "1"'))).toBe(true);
    });

    it("should fail for non-object config", () => {
      const result = validateProjectConfig("not an object");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Config must be an object");
    });

    it("should fail for null config", () => {
      const result = validateProjectConfig(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Config must be an object");
    });
  });
});

describe("round-trip tests", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("cc-roundtrip-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("should round-trip minimal config (name and stack only)", async () => {
    useMatrixStore.getState().setMatrix(TEST_MATRICES.reactAndZustand);
    const selectedAgents: AgentName[] = ["web-developer"];

    // Generate config
    const generated = generateProjectConfigFromSkills(
      "test-project",
      ["web-framework-react", "web-state-zustand"],
      { selectedAgents },
    );

    // Write to temp dir as config
    const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, STANDARD_FILES.CONFIG_TS),
      generateConfigSource(generated),
    );

    // Load it back
    const loaded = await loadProjectConfig(tempDir);

    // Verify
    expect(loaded).not.toBeNull();
    expect(loaded!.config.name).toBe(generated.name);
    expect(loaded!.config.agents).toEqual(generated.agents);
    expect(loaded!.config.stack).toBeDefined();
  });

  it("should round-trip config with options (description/author)", async () => {
    useMatrixStore.getState().setMatrix(TEST_MATRICES.react);
    const selectedAgents: AgentName[] = ["web-developer"];

    // Generate config with options
    const generated = generateProjectConfigFromSkills(
      "my-awesome-project",
      ["web-framework-react"],
      {
        description: "An awesome project for testing",
        author: "@testuser",
        selectedAgents,
      },
    );

    // Write to temp dir as config
    const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, STANDARD_FILES.CONFIG_TS),
      generateConfigSource(generated),
    );

    // Load it back
    const loaded = await loadProjectConfig(tempDir);

    // Verify
    expect(loaded).not.toBeNull();
    expect(loaded!.config.name).toBe("my-awesome-project");
    expect(loaded!.config.description).toBe("An awesome project for testing");
    expect(loaded!.config.author).toBe("@testuser");
    expect(loaded!.config.stack).toBeDefined();
  });
});
