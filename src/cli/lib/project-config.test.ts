import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify as stringifyYaml } from "yaml";
import {
  isLegacyStackConfig,
  isSimpleAgentSkills,
  loadProjectConfig,
  normalizeAgentSkills,
  normalizeSkillEntry,
  normalizeStackConfig,
  validateProjectConfig,
} from "./project-config";
import {
  generateProjectConfigFromSkills,
  generateProjectConfigFromStack,
} from "./config-generator";
import type { StackConfig } from "../../types";
import type { MergedSkillsMatrix, ResolvedSkill } from "../types-matrix";

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
      expect(result!.isLegacy).toBe(false);
      expect(result!.config.name).toBe("my-project");
      expect(result!.config.agents).toEqual(["web-developer", "api-developer"]);
    });

    it("should load config with skills array (string format)", async () => {
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        `name: my-project
skills:
  - react (@vince)
  - zustand (@vince)
agents:
  - web-developer
`,
      );

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();
      expect(result!.config.skills).toEqual([
        "react (@vince)",
        "zustand (@vince)",
      ]);
    });

    it("should load config with skills array (object format)", async () => {
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        `name: my-project
skills:
  - id: react (@vince)
    preloaded: true
  - id: my-custom-skill
    local: true
    path: .claude/skills/my-custom-skill/
agents:
  - web-developer
`,
      );

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();
      expect(result!.config.skills).toEqual([
        { id: "react (@vince)", preloaded: true },
        {
          id: "my-custom-skill",
          local: true,
          path: ".claude/skills/my-custom-skill/",
        },
      ]);
    });

    it("should load config with simple list agent_skills", async () => {
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        `name: my-project
agents:
  - web-developer
agent_skills:
  web-developer:
    - react (@vince)
    - zustand (@vince)
`,
      );

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();
      expect(result!.config.agent_skills).toEqual({
        "web-developer": ["react (@vince)", "zustand (@vince)"],
      });
    });

    it("should load config with categorized agent_skills", async () => {
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        `name: my-project
agents:
  - api-developer
agent_skills:
  api-developer:
    api:
      - id: hono (@vince)
        preloaded: true
    database:
      - drizzle (@vince)
`,
      );

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();
      expect(result!.config.agent_skills).toEqual({
        "api-developer": {
          api: [{ id: "hono (@vince)", preloaded: true }],
          database: ["drizzle (@vince)"],
        },
      });
    });

    it("should load legacy StackConfig format (backward compatibility)", async () => {
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        `id: legacy-stack
name: my-stack
version: 1.0.0
author: "@vince"
description: A legacy stack config
framework: nextjs
skills:
  - id: react (@vince)
agents:
  - web-developer
agent_skills:
  web-developer:
    framework:
      - id: react (@vince)
        preloaded: true
philosophy: Ship fast
principles:
  - Keep it simple
tags:
  - nextjs
  - react
`,
      );

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();
      expect(result!.isLegacy).toBe(true);
      expect(result!.config.name).toBe("my-stack");
      expect(result!.config.framework).toBe("nextjs");
      expect(result!.config.author).toBe("@vince");
      expect(result!.config.philosophy).toBe("Ship fast");
      expect(result!.config.principles).toEqual(["Keep it simple"]);
      expect(result!.config.tags).toEqual(["nextjs", "react"]);
      // Legacy-only fields should not be present in normalized config
      expect(
        (result!.config as unknown as Record<string, unknown>).id,
      ).toBeUndefined();
      expect(
        (result!.config as unknown as Record<string, unknown>).version,
      ).toBeUndefined();
    });

    it("should return null for invalid YAML", async () => {
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        "invalid: yaml: content: :",
      );

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

    it("should load config with custom_agents section", async () => {
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        `name: my-project
agents:
  - web-developer
  - my-reviewer
custom_agents:
  my-reviewer:
    title: My Code Reviewer
    description: Custom reviewer for this project
    extends: web-reviewer
    model: opus
    tools:
      - Read
      - Grep
      - Glob
    disallowed_tools:
      - Bash
    permission_mode: acceptEdits
    skills:
      - id: react (@vince)
        preloaded: true
`,
      );

      const result = await loadProjectConfig(tempDir);

      expect(result).not.toBeNull();
      expect(result!.isLegacy).toBe(false);
      expect(result!.config.custom_agents).toBeDefined();
      expect(result!.config.custom_agents!["my-reviewer"]).toEqual({
        title: "My Code Reviewer",
        description: "Custom reviewer for this project",
        extends: "web-reviewer",
        model: "opus",
        tools: ["Read", "Grep", "Glob"],
        disallowed_tools: ["Bash"],
        permission_mode: "acceptEdits",
        skills: [{ id: "react (@vince)", preloaded: true }],
      });
    });
  });

  describe("isLegacyStackConfig", () => {
    it("should return true for semver version", () => {
      expect(
        isLegacyStackConfig({ version: "1.0.0", name: "test", agents: [] }),
      ).toBe(true);
      expect(
        isLegacyStackConfig({ version: "2.1.3", name: "test", agents: [] }),
      ).toBe(true);
    });

    it("should return true for config with id field", () => {
      expect(
        isLegacyStackConfig({ id: "my-stack", name: "test", agents: [] }),
      ).toBe(true);
    });

    it("should return true for config with created/updated fields", () => {
      expect(
        isLegacyStackConfig({
          created: "2024-01-01",
          name: "test",
          agents: [],
        }),
      ).toBe(true);
      expect(
        isLegacyStackConfig({
          updated: "2024-01-01",
          name: "test",
          agents: [],
        }),
      ).toBe(true);
    });

    it("should return false for new format config", () => {
      expect(isLegacyStackConfig({ name: "test", agents: [] })).toBe(false);
      expect(
        isLegacyStackConfig({ version: "1", name: "test", agents: [] }),
      ).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(isLegacyStackConfig(null)).toBe(false);
      expect(isLegacyStackConfig(undefined)).toBe(false);
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
      expect(result.errors).toContain(
        "agents is required and must be an array",
      );
    });

    it("should fail for non-string agents", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer", 123],
      });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("must contain strings")),
      ).toBe(true);
    });

    it("should fail for invalid version", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer"],
        version: "2",
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('version must be "1"'))).toBe(
        true,
      );
    });

    it("should fail for skills as non-array", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer"],
        skills: "react",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("skills must be an array");
    });

    it("should fail for invalid skill entries", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer"],
        skills: [{ notId: "missing-id" }],
      });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("must have an id string")),
      ).toBe(true);
    });

    it("should fail for local skill without path", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer"],
        skills: [{ id: "my-skill", local: true }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("must have a path"))).toBe(
        true,
      );
    });

    it("should pass for valid skills with both string and object format", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer"],
        skills: [
          "react (@vince)",
          { id: "zustand (@vince)", preloaded: true },
          { id: "my-local", local: true, path: ".claude/skills/my-local/" },
        ],
      });

      expect(result.valid).toBe(true);
    });

    it("should validate simple list agent_skills", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer"],
        agent_skills: {
          "web-developer": ["react", "zustand"],
        },
      });

      expect(result.valid).toBe(true);
    });

    it("should validate categorized agent_skills", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer"],
        agent_skills: {
          "web-developer": {
            framework: ["react"],
            state: [{ id: "zustand", preloaded: true }],
          },
        },
      });

      expect(result.valid).toBe(true);
    });

    it("should fail for invalid categorized agent_skills", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer"],
        agent_skills: {
          "web-developer": {
            framework: "not-an-array",
          },
        },
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("must be an array"))).toBe(
        true,
      );
    });

    it("should warn for deprecated fields", () => {
      const result = validateProjectConfig({
        name: "my-project",
        agents: ["web-developer"],
        id: "deprecated-id",
        created: "2024-01-01",
        updated: "2024-01-02",
      });

      // Still valid, but with warnings
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        "id field is deprecated in project config",
      );
      expect(result.warnings).toContain(
        "created field is deprecated in project config",
      );
      expect(result.warnings).toContain(
        "updated field is deprecated in project config",
      );
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

    // custom_agents validation tests
    describe("custom_agents validation", () => {
      it("should pass for valid custom_agents with required fields", () => {
        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: {
            "my-reviewer": {
              title: "My Code Reviewer",
              description: "Custom reviewer for this project",
            },
          },
        });

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should pass for custom_agents with extends", () => {
        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer", "my-reviewer"],
          custom_agents: {
            "my-reviewer": {
              title: "My Code Reviewer",
              description: "Extends web-reviewer",
              extends: "web-reviewer",
            },
          },
        });

        expect(result.valid).toBe(true);
      });

      it("should pass for custom_agents with all optional fields", () => {
        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: {
            "full-agent": {
              title: "Full Custom Agent",
              description: "Agent with all fields",
              extends: "web-developer",
              model: "opus",
              tools: ["Read", "Grep", "Glob"],
              disallowed_tools: ["Bash"],
              permission_mode: "acceptEdits",
              skills: [
                { id: "react (@vince)", preloaded: true },
                "zustand (@vince)",
              ],
              hooks: {
                PreToolUse: [{ matcher: "*" }],
              },
            },
          },
        });

        expect(result.valid).toBe(true);
      });

      it("should fail for custom_agents as non-object", () => {
        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: "not-an-object",
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("custom_agents must be an object");
      });

      it("should fail for custom agent missing title", () => {
        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: {
            "my-agent": {
              description: "Missing title",
            },
          },
        });

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("title is required"))).toBe(
          true,
        );
      });

      it("should fail for custom agent missing description", () => {
        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: {
            "my-agent": {
              title: "My Agent",
            },
          },
        });

        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) => e.includes("description is required")),
        ).toBe(true);
      });

      it("should fail for custom agent with invalid model", () => {
        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: {
            "my-agent": {
              title: "My Agent",
              description: "Test",
              model: "gpt-4",
            },
          },
        });

        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) => e.includes("model must be one of")),
        ).toBe(true);
      });

      it("should fail for custom agent with invalid permission_mode", () => {
        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: {
            "my-agent": {
              title: "My Agent",
              description: "Test",
              permission_mode: "invalid",
            },
          },
        });

        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) =>
            e.includes("permission_mode must be one of"),
          ),
        ).toBe(true);
      });

      it("should fail for custom agent with non-array tools", () => {
        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: {
            "my-agent": {
              title: "My Agent",
              description: "Test",
              tools: "Read",
            },
          },
        });

        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) => e.includes("tools must be an array")),
        ).toBe(true);
      });

      it("should fail for custom agent with non-string tools entries", () => {
        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: {
            "my-agent": {
              title: "My Agent",
              description: "Test",
              tools: ["Read", 123],
            },
          },
        });

        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) =>
            e.includes("tools must contain only strings"),
          ),
        ).toBe(true);
      });

      it("should fail when custom agent extends another custom agent", () => {
        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: {
            "base-agent": {
              title: "Base Agent",
              description: "A base custom agent",
            },
            "derived-agent": {
              title: "Derived Agent",
              description: "Tries to extend base-agent",
              extends: "base-agent",
            },
          },
        });

        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) =>
            e.includes("cannot reference another custom agent"),
          ),
        ).toBe(true);
      });

      it("should fail when exceeding maximum custom agents (20)", () => {
        const customAgents: Record<
          string,
          { title: string; description: string }
        > = {};
        for (let i = 0; i < 21; i++) {
          customAgents[`agent-${i}`] = {
            title: `Agent ${i}`,
            description: `Description ${i}`,
          };
        }

        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: customAgents,
        });

        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) => e.includes("cannot exceed 20 agents")),
        ).toBe(true);
      });

      it("should pass with exactly 20 custom agents", () => {
        const customAgents: Record<
          string,
          { title: string; description: string }
        > = {};
        for (let i = 0; i < 20; i++) {
          customAgents[`agent-${i}`] = {
            title: `Agent ${i}`,
            description: `Description ${i}`,
          };
        }

        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: customAgents,
        });

        expect(result.valid).toBe(true);
      });

      it("should fail for custom agent with invalid skills", () => {
        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: {
            "my-agent": {
              title: "My Agent",
              description: "Test",
              skills: [{ notId: "missing-id" }],
            },
          },
        });

        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) => e.includes("must have an id string")),
        ).toBe(true);
      });

      it("should fail for custom agent config as non-object", () => {
        const result = validateProjectConfig({
          name: "my-project",
          agents: ["web-developer"],
          custom_agents: {
            "my-agent": "not-an-object",
          },
        });

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("must be an object"))).toBe(
          true,
        );
      });
    });
  });

  describe("normalizeStackConfig", () => {
    it("should convert StackConfig to ProjectConfig", () => {
      const stackConfig: StackConfig = {
        name: "my-stack",
        version: "1.0.0",
        author: "@vince",
        description: "Test stack",
        framework: "nextjs",
        skills: [{ id: "react" }],
        agents: ["web-developer"],
        agent_skills: {
          "web-developer": {
            framework: [{ id: "react", preloaded: true }],
          },
        },
        philosophy: "Ship fast",
        principles: ["Keep it simple"],
        tags: ["nextjs"],
      };

      const result = normalizeStackConfig(stackConfig);

      expect(result.name).toBe("my-stack");
      expect(result.agents).toEqual(["web-developer"]);
      expect(result.description).toBe("Test stack");
      expect(result.framework).toBe("nextjs");
      expect(result.author).toBe("@vince");
      expect(result.philosophy).toBe("Ship fast");
      expect(result.principles).toEqual(["Keep it simple"]);
      expect(result.tags).toEqual(["nextjs"]);
      expect(result.skills).toEqual([{ id: "react" }]);
      expect(result.agent_skills).toEqual({
        "web-developer": {
          framework: [{ id: "react", preloaded: true }],
        },
      });
      // version should not be copied (it's semver in StackConfig)
      expect(result.version).toBeUndefined();
    });

    it("should handle minimal StackConfig", () => {
      const stackConfig: StackConfig = {
        name: "minimal",
        version: "1.0.0",
        author: "@user",
        skills: [],
        agents: ["web-developer"],
      };

      const result = normalizeStackConfig(stackConfig);

      expect(result.name).toBe("minimal");
      expect(result.agents).toEqual(["web-developer"]);
      expect(result.skills).toBeUndefined(); // Empty array not copied
      expect(result.description).toBeUndefined();
    });
  });

  describe("isSimpleAgentSkills", () => {
    it("should return true for array", () => {
      expect(isSimpleAgentSkills(["react", "zustand"])).toBe(true);
      expect(isSimpleAgentSkills([{ id: "react" }])).toBe(true);
      expect(isSimpleAgentSkills([])).toBe(true);
    });

    it("should return false for object (categorized)", () => {
      expect(isSimpleAgentSkills({ framework: ["react"] })).toBe(false);
    });

    it("should return false for non-array", () => {
      expect(isSimpleAgentSkills("react")).toBe(false);
      expect(isSimpleAgentSkills(null)).toBe(false);
      expect(isSimpleAgentSkills(undefined)).toBe(false);
    });
  });

  describe("normalizeSkillEntry", () => {
    it("should convert string to SkillAssignment", () => {
      const result = normalizeSkillEntry("react (@vince)");
      expect(result).toEqual({ id: "react (@vince)" });
    });

    it("should pass through SkillAssignment", () => {
      const assignment = { id: "react", preloaded: true };
      const result = normalizeSkillEntry(assignment);
      expect(result).toBe(assignment); // Same object reference
    });
  });

  describe("normalizeAgentSkills", () => {
    it("should normalize simple list to categorized format", () => {
      const result = normalizeAgentSkills({
        "web-developer": ["react", "zustand"],
      });

      expect(result).toEqual({
        "web-developer": {
          uncategorized: [{ id: "react" }, { id: "zustand" }],
        },
      });
    });

    it("should normalize mixed format entries in simple list", () => {
      const result = normalizeAgentSkills({
        "web-developer": ["react", { id: "zustand", preloaded: true }],
      });

      expect(result).toEqual({
        "web-developer": {
          uncategorized: [{ id: "react" }, { id: "zustand", preloaded: true }],
        },
      });
    });

    it("should normalize categorized format entries", () => {
      const result = normalizeAgentSkills({
        "web-developer": {
          framework: ["react"],
          state: [{ id: "zustand", preloaded: true }],
        },
      });

      expect(result).toEqual({
        "web-developer": {
          framework: [{ id: "react" }],
          state: [{ id: "zustand", preloaded: true }],
        },
      });
    });

    it("should handle multiple agents", () => {
      const result = normalizeAgentSkills({
        "web-developer": ["react"],
        "api-developer": {
          api: ["hono"],
        },
      });

      expect(result).toEqual({
        "web-developer": {
          uncategorized: [{ id: "react" }],
        },
        "api-developer": {
          api: [{ id: "hono" }],
        },
      });
    });

    it("should handle empty agent_skills", () => {
      const result = normalizeAgentSkills({});
      expect(result).toEqual({});
    });
  });
});

// =============================================================================
// Round-trip Tests (Generate -> Write -> Load)
// =============================================================================

/**
 * Helper to create a minimal resolved skill for testing
 */
function createMockSkill(
  id: string,
  category: string,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return {
    id,
    name: id.replace(/ \(@.*\)$/, ""),
    description: `${id} skill`,
    category,
    categoryExclusive: false,
    tags: [],
    author: "@test",
    conflictsWith: [],
    recommends: [],
    recommendedBy: [],
    requires: [],
    requiredBy: [],
    alternatives: [],
    discourages: [],
    requiresSetup: [],
    providesSetupFor: [],
    path: `skills/${category}/${id}/`,
    ...overrides,
  };
}

/**
 * Helper to create a minimal merged skills matrix for testing
 */
function createMockMatrix(
  skills: Record<string, ResolvedSkill>,
): MergedSkillsMatrix {
  return {
    version: "1.0.0",
    categories: {},
    skills,
    suggestedStacks: [],
    aliases: {},
    aliasesReverse: {},
    generatedAt: new Date().toISOString(),
  };
}

describe("round-trip tests", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-roundtrip-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should round-trip minimal config (name and skills only)", async () => {
    // Create mock matrix with skills
    const matrix = createMockMatrix({
      "react (@vince)": createMockSkill("react (@vince)", "frontend/framework"),
      "zustand (@vince)": createMockSkill("zustand (@vince)", "frontend/state"),
    });

    // Generate config
    const generated = generateProjectConfigFromSkills(
      "test-project",
      ["react (@vince)", "zustand (@vince)"],
      matrix,
    );

    // Write to temp dir
    const configDir = path.join(tempDir, ".claude");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, "config.yaml"),
      stringifyYaml(generated),
    );

    // Load it back
    const loaded = await loadProjectConfig(tempDir);

    // Verify
    expect(loaded).not.toBeNull();
    expect(loaded!.config.name).toBe(generated.name);
    expect(loaded!.config.agents).toEqual(generated.agents);
    expect(loaded!.config.skills).toEqual(generated.skills);
    expect(loaded!.isLegacy).toBe(false);
  });

  it("should round-trip config with options (description/framework/author)", async () => {
    // Create mock matrix with skills
    const matrix = createMockMatrix({
      "react (@vince)": createMockSkill("react (@vince)", "frontend/framework"),
    });

    // Generate config with options
    const generated = generateProjectConfigFromSkills(
      "my-awesome-project",
      ["react (@vince)"],
      matrix,
      {
        description: "An awesome project for testing",
        framework: "nextjs",
        author: "@testuser",
      },
    );

    // Write to temp dir
    const configDir = path.join(tempDir, ".claude");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, "config.yaml"),
      stringifyYaml(generated),
    );

    // Load it back
    const loaded = await loadProjectConfig(tempDir);

    // Verify
    expect(loaded).not.toBeNull();
    expect(loaded!.config.name).toBe("my-awesome-project");
    expect(loaded!.config.description).toBe("An awesome project for testing");
    expect(loaded!.config.framework).toBe("nextjs");
    expect(loaded!.config.author).toBe("@testuser");
    expect(loaded!.config.skills).toEqual(["react (@vince)"]);
    expect(loaded!.isLegacy).toBe(false);
  });

  it("should round-trip config with local skills (path preserved)", async () => {
    // Create mock matrix with local skill
    const matrix = createMockMatrix({
      "react (@vince)": createMockSkill("react (@vince)", "frontend/framework"),
      "my-custom-skill (@local)": createMockSkill(
        "my-custom-skill (@local)",
        "local/custom",
        {
          local: true,
          localPath: ".claude/skills/my-custom-skill/",
        },
      ),
    });

    // Generate config with local skill
    const generated = generateProjectConfigFromSkills(
      "project-with-local",
      ["react (@vince)", "my-custom-skill (@local)"],
      matrix,
    );

    // Write to temp dir
    const configDir = path.join(tempDir, ".claude");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, "config.yaml"),
      stringifyYaml(generated),
    );

    // Load it back
    const loaded = await loadProjectConfig(tempDir);

    // Verify
    expect(loaded).not.toBeNull();
    expect(loaded!.config.name).toBe("project-with-local");
    expect(loaded!.config.skills).toHaveLength(2);

    // Remote skill should be string
    expect(loaded!.config.skills![0]).toBe("react (@vince)");

    // Local skill should be object with path preserved
    expect(loaded!.config.skills![1]).toEqual({
      id: "my-custom-skill (@local)",
      local: true,
      path: ".claude/skills/my-custom-skill/",
    });

    expect(loaded!.isLegacy).toBe(false);
  });

  it("should round-trip legacy StackConfig format (backward compat)", async () => {
    // Create a legacy StackConfig
    const stackConfig: StackConfig = {
      name: "legacy-stack",
      version: "1.0.0",
      author: "@vince",
      description: "A legacy stack config for testing",
      framework: "nextjs",
      skills: [
        { id: "react (@vince)" },
        { id: "zustand (@vince)", preloaded: true },
      ],
      agents: ["web-developer", "api-developer"],
      agent_skills: {
        "web-developer": {
          framework: [{ id: "react (@vince)", preloaded: true }],
        },
      },
      philosophy: "Ship fast, iterate faster",
      principles: ["Keep it simple", "Test everything"],
      tags: ["nextjs", "react", "fullstack"],
    };

    // Write as StackConfig (legacy format with semver version)
    const configDir = path.join(tempDir, ".claude");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, "config.yaml"),
      stringifyYaml(stackConfig),
    );

    // Load it back (should detect legacy and normalize)
    const loaded = await loadProjectConfig(tempDir);

    // Verify
    expect(loaded).not.toBeNull();
    expect(loaded!.isLegacy).toBe(true);

    // Core fields should be preserved
    expect(loaded!.config.name).toBe("legacy-stack");
    expect(loaded!.config.description).toBe(
      "A legacy stack config for testing",
    );
    expect(loaded!.config.framework).toBe("nextjs");
    expect(loaded!.config.author).toBe("@vince");
    expect(loaded!.config.agents).toEqual(["web-developer", "api-developer"]);

    // Skills should be preserved
    expect(loaded!.config.skills).toEqual([
      { id: "react (@vince)" },
      { id: "zustand (@vince)", preloaded: true },
    ]);

    // agent_skills should be preserved
    expect(loaded!.config.agent_skills).toEqual({
      "web-developer": {
        framework: [{ id: "react (@vince)", preloaded: true }],
      },
    });

    // Extended fields should be preserved
    expect(loaded!.config.philosophy).toBe("Ship fast, iterate faster");
    expect(loaded!.config.principles).toEqual([
      "Keep it simple",
      "Test everything",
    ]);
    expect(loaded!.config.tags).toEqual(["nextjs", "react", "fullstack"]);

    // Legacy-only fields should NOT be in normalized config
    expect(
      (loaded!.config as unknown as Record<string, unknown>).version,
    ).toBeUndefined();
  });

  it("should round-trip config with agent_skills (includeAgentSkills option)", async () => {
    // Create mock matrix with skills
    const matrix = createMockMatrix({
      "react (@vince)": createMockSkill("react (@vince)", "frontend/framework"),
      "zustand (@vince)": createMockSkill("zustand (@vince)", "frontend/state"),
    });

    // Generate config with agent_skills included
    const generated = generateProjectConfigFromSkills(
      "project-with-agent-skills",
      ["react (@vince)", "zustand (@vince)"],
      matrix,
      { includeAgentSkills: true },
    );

    // Write to temp dir
    const configDir = path.join(tempDir, ".claude");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, "config.yaml"),
      stringifyYaml(generated),
    );

    // Load it back
    const loaded = await loadProjectConfig(tempDir);

    // Verify
    expect(loaded).not.toBeNull();
    expect(loaded!.config.name).toBe("project-with-agent-skills");

    // agent_skills should be present and match
    expect(loaded!.config.agent_skills).toBeDefined();
    expect(loaded!.config.agent_skills).toEqual(generated.agent_skills);

    expect(loaded!.isLegacy).toBe(false);
  });

  it("should round-trip ProjectConfig generated from StackConfig", async () => {
    // Create a StackConfig
    const stackConfig: StackConfig = {
      name: "converted-stack",
      version: "2.0.0",
      author: "@converter",
      description: "Stack converted to ProjectConfig",
      framework: "remix",
      skills: [
        { id: "react (@vince)", preloaded: true },
        { id: "hono (@vince)" },
        { id: "local-skill", local: true, path: ".claude/skills/local-skill/" },
      ],
      agents: ["web-developer"],
      philosophy: "Convention over configuration",
      principles: ["DRY", "KISS"],
      tags: ["remix", "fullstack"],
    };

    // Generate ProjectConfig from StackConfig
    const generated = generateProjectConfigFromStack(stackConfig);

    // Write to temp dir
    const configDir = path.join(tempDir, ".claude");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, "config.yaml"),
      stringifyYaml(generated),
    );

    // Load it back
    const loaded = await loadProjectConfig(tempDir);

    // Verify
    expect(loaded).not.toBeNull();
    expect(loaded!.isLegacy).toBe(false); // ProjectConfig, not StackConfig

    expect(loaded!.config.name).toBe("converted-stack");
    expect(loaded!.config.description).toBe("Stack converted to ProjectConfig");
    expect(loaded!.config.framework).toBe("remix");
    expect(loaded!.config.author).toBe("@converter");
    expect(loaded!.config.agents).toEqual(["web-developer"]);

    // Skills should use minimal format
    expect(loaded!.config.skills).toEqual([
      { id: "react (@vince)", preloaded: true },
      "hono (@vince)",
      { id: "local-skill", local: true, path: ".claude/skills/local-skill/" },
    ]);

    expect(loaded!.config.philosophy).toBe("Convention over configuration");
    expect(loaded!.config.principles).toEqual(["DRY", "KISS"]);
    expect(loaded!.config.tags).toEqual(["remix", "fullstack"]);

    // version should NOT be copied from StackConfig (it's semver)
    expect(loaded!.config.version).toBeUndefined();
  });
});
