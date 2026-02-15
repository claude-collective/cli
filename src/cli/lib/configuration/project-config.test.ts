import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify as stringifyYaml } from "yaml";
import { loadProjectConfig, validateProjectConfig } from "./project-config";
import { generateProjectConfigFromSkills } from "./config-generator";
import { createMockSkill, createMockMatrix } from "../__tests__/helpers";

describe("project-config", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-project-config-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("loadProjectConfig", () => {
    it("should return null if config file does not exist", async () => {
      const result = await loadProjectConfig(tempDir);
      expect(result).toBeNull();
    });

    it("should load minimal config (just name and agents)", async () => {
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        `name: my-project
agents:
  - web-developer
  - api-developer
`,
      );

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();

      expect(result!.config.name).toBe("my-project");
      expect(result!.config.agents).toEqual(["web-developer", "api-developer"]);
    });

    it("should load config with stack (bare strings normalized to SkillAssignment[])", async () => {
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        `name: my-project
agents:
  - web-developer
stack:
  web-developer:
    framework: web-framework-react
    styling: web-styling-scss-modules
`,
      );

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();
      // Bare strings are normalized to SkillAssignment[] at load time
      expect(result!.config.stack).toEqual({
        "web-developer": {
          framework: [{ id: "web-framework-react", preloaded: false }],
          styling: [{ id: "web-styling-scss-modules", preloaded: false }],
        },
      });
    });

    it("should load config with mixed stack formats (array, object, string)", async () => {
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        `name: my-project
agents:
  - web-developer
stack:
  web-developer:
    framework: web-framework-react
    methodology:
      - id: meta-methodology-investigation-requirements
        preloaded: true
      - id: meta-methodology-anti-over-engineering
        preloaded: true
    styling:
      id: web-styling-scss-modules
      preloaded: true
`,
      );

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();
      expect(result!.config.stack).toEqual({
        "web-developer": {
          // bare string -> SkillAssignment[]
          framework: [{ id: "web-framework-react", preloaded: false }],
          // array of objects -> SkillAssignment[]
          methodology: [
            { id: "meta-methodology-investigation-requirements", preloaded: true },
            { id: "meta-methodology-anti-over-engineering", preloaded: true },
          ],
          // single object -> SkillAssignment[]
          styling: [{ id: "web-styling-scss-modules", preloaded: true }],
        },
      });
    });

    it("should load config with extra fields (backward compatibility)", async () => {
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        `name: my-stack
author: "@vince"
description: A config with extra fields
agents:
  - web-developer
`,
      );

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();

      expect(result!.config.name).toBe("my-stack");
      expect(result!.config.author).toBe("@vince");
    });

    it("should return null for invalid YAML", async () => {
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "invalid: yaml: content: :");

      const result = await loadProjectConfig(tempDir);
      expect(result).toBeNull();
    });

    it("should return null for non-object config", async () => {
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "just a string");

      const result = await loadProjectConfig(tempDir);
      expect(result).toBeNull();
    });
  });

  describe("validateProjectConfig", () => {
    it("should pass for minimal valid config", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer"],
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail for missing name", () => {
      const result = validateProjectConfig({
        agents: ["web-developer"],
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

    it("should fail for non-string agents", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer", 123],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("must contain strings"))).toBe(true);
    });

    it("should fail for invalid version", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer"],
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
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-roundtrip-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should round-trip minimal config (name and stack only)", async () => {
    // Create mock matrix with skills
    const matrix = createMockMatrix({
      ["web-framework-react"]: createMockSkill("web-framework-react", "web/framework"),
      ["web-state-zustand"]: createMockSkill("web-state-zustand", "web/state"),
    });

    // Generate config
    const generated = generateProjectConfigFromSkills(
      "test-project",
      ["web-framework-react", "web-state-zustand"],
      matrix,
    );

    // Write to temp dir
    const configDir = path.join(tempDir, ".claude");
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(configDir, "config.yaml"), stringifyYaml(generated));

    // Load it back
    const loaded = await loadProjectConfig(tempDir);

    // Verify
    expect(loaded).not.toBeNull();
    expect(loaded!.config.name).toBe(generated.name);
    expect(loaded!.config.agents).toEqual(generated.agents);
    expect(loaded!.config.stack).toBeDefined();
  });

  it("should round-trip config with options (description/author)", async () => {
    // Create mock matrix with skills
    const matrix = createMockMatrix({
      ["web-framework-react"]: createMockSkill("web-framework-react", "web/framework"),
    });

    // Generate config with options
    const generated = generateProjectConfigFromSkills(
      "my-awesome-project",
      ["web-framework-react"],
      matrix,
      {
        description: "An awesome project for testing",
        author: "@testuser",
      },
    );

    // Write to temp dir
    const configDir = path.join(tempDir, ".claude");
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(configDir, "config.yaml"), stringifyYaml(generated));

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
