import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { Liquid } from "liquidjs";
import { resolveSkillReference, resolveSkillReferences, stackToCompileConfig } from "./resolver";
import type {
  SkillDefinition,
  SkillReference,
  ProjectConfig,
  Skill,
  AgentConfig,
  CompiledAgentData,
} from "../types";
import type { AgentName, SkillAlias, SkillId, Subcategory } from "../types-matrix";
import type { StackAgentConfig } from "../types-stacks";

describe("resolveSkillReference", () => {
  const mockSkills: Record<string, SkillDefinition> = {
    ["web-framework-react"]: {
      path: `skills/web/framework/${"web-framework-react"}/`,
      name: "React",
      description: "React component patterns",
      canonicalId: "web-framework-react",
    },
    ["api-framework-hono"]: {
      path: `skills/api/api/${"api-framework-hono"}/`,
      name: "Hono",
      description: "Hono API framework",
      canonicalId: "api-framework-hono",
    },
  };

  it("should resolve a skill reference to a full Skill object", () => {
    const ref: SkillReference = {
      id: "web-framework-react",
      usage: "when building React components",
      preloaded: true,
    };

    const result = resolveSkillReference(ref, mockSkills);

    expect(result).toEqual({
      id: "web-framework-react",
      path: `skills/web/framework/${"web-framework-react"}/`,
      name: "React",
      description: "React component patterns",
      usage: "when building React components",
      preloaded: true,
    });
  });

  it("should default preloaded to false when not specified", () => {
    const ref: SkillReference = {
      id: "api-framework-hono",
      usage: "when building APIs",
    };

    const result = resolveSkillReference(ref, mockSkills);

    expect(result).not.toBeNull();
    expect(result!.preloaded).toBe(false);
  });

  it("should return null if skill is not found", () => {
    const ref: SkillReference = {
      id: "web-nonexistent-skill",
      usage: "never",
    };

    const result = resolveSkillReference(ref, mockSkills);
    expect(result).toBeNull();
  });
});

describe("resolveSkillReferences", () => {
  const mockSkills: Record<string, SkillDefinition> = {
    ["web-framework-react"]: {
      path: `skills/web/framework/${"web-framework-react"}/`,
      name: "React",
      description: "React component patterns",
      canonicalId: "web-framework-react",
    },
    ["web-state-zustand"]: {
      path: `skills/web/client-state-management/${"web-state-zustand"}/`,
      name: "Zustand",
      description: "Lightweight state management",
      canonicalId: "web-state-zustand",
    },
  };

  it("should resolve multiple skill references", () => {
    const refs: SkillReference[] = [
      { id: "web-framework-react", usage: "for components" },
      { id: "web-state-zustand", usage: "for state", preloaded: true },
    ];

    const results = resolveSkillReferences(refs, mockSkills);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("web-framework-react");
    expect(results[1].id).toBe("web-state-zustand");
    expect(results[1].preloaded).toBe(true);
  });

  it("should return empty array for empty input", () => {
    const results = resolveSkillReferences([], mockSkills);
    expect(results).toEqual([]);
  });
});

describe("stackToCompileConfig", () => {
  it("should convert a project config to a compile config", () => {
    const config: ProjectConfig = {
      name: "Test Stack",
      description: "A test stack",
      agents: ["web-developer", "api-developer"],
    };

    const result = stackToCompileConfig("test-stack", config);

    expect(result).toEqual({
      name: "Test Stack",
      description: "A test stack",
      claude_md: "",
      stack: "test-stack",
      agents: {
        "web-developer": {},
        "api-developer": {},
      },
    });
  });

  it("should handle empty agents array", () => {
    const config: ProjectConfig = {
      name: "Empty Stack",
      agents: [],
    };

    const result = stackToCompileConfig("empty-stack", config);

    expect(result.agents).toEqual({});
  });

  it("should use empty string for missing description", () => {
    const config: ProjectConfig = {
      name: "No Description",
      agents: ["test-agent"],
    };

    const result = stackToCompileConfig("no-desc", config);

    expect(result.description).toBe("");
  });
});

// =============================================================================
// P1-16: Preloaded skills appear in agent frontmatter
// P1-17: Dynamic skills referenced in agent body
// =============================================================================

describe("preloaded vs dynamic skills in compiled agent output", () => {
  let tempDir: string;
  let engine: Liquid;

  // Minimal agent template that mirrors the real agent.liquid structure
  const testTemplate = `---
name: {{ agent.name }}
description: {{ agent.description }}
tools: {{ agent.tools | join: ", " }}
{% if preloadedSkillIds.size > 0 %}skills:
{% for skillId in preloadedSkillIds %}  - {{ skillId }}
{% endfor %}{% endif %}---

# {{ agent.title }}

{% if dynamicSkills.size > 0 %}
<skill_activation_protocol>
## Available Skills (Require Loading)

{% for skill in dynamicSkills %}
### {{ skill.id }}
- Description: {{ skill.description }}
- Invoke: \`skill: "{{ skill.id }}"\`
- Use when: {{ skill.usage }}

{% endfor %}
</skill_activation_protocol>
{% else %}
<skills_note>
All skills for this agent are preloaded via frontmatter. No additional skill activation required.
</skills_note>
{% endif %}
`;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "resolver-test-"));

    // Create Liquid engine with test template
    const templatesDir = path.join(tempDir, "templates");
    await mkdir(templatesDir, { recursive: true });
    await writeFile(path.join(templatesDir, "agent.liquid"), testTemplate);

    engine = new Liquid({
      root: [templatesDir],
      extname: ".liquid",
      strictVariables: false,
      strictFilters: true,
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // Helper to create mock skills
  function createMockSkill(
    id: SkillId,
    preloaded: boolean,
    usage = "when working with this skill",
  ): Skill {
    return {
      id,
      path: `skills/${id}/`,
      name: id.replace(/ \(@.*\)$/, ""),
      description: `${id} skill description`,
      usage,
      preloaded,
    };
  }

  // Helper to compile agent with skills
  async function compileAgentWithSkills(skills: Skill[]): Promise<string> {
    const preloadedSkills = skills.filter((s) => s.preloaded);
    const dynamicSkills = skills.filter((s) => !s.preloaded);
    const preloadedSkillIds = preloadedSkills.map((s) => s.id);

    const agent: AgentConfig = {
      name: "test-agent",
      title: "Test Agent",
      description: "A test agent for skill testing",
      model: "opus",
      tools: ["Read", "Write", "Edit"],
      skills,
      path: "test-agent",
    };

    const data: CompiledAgentData = {
      agent,
      intro: "Test intro content",
      workflow: "Test workflow content",
      examples: "Test examples content",
      criticalRequirementsTop: "",
      criticalReminders: "",
      outputFormat: "",
      skills,
      preloadedSkills,
      dynamicSkills,
      preloadedSkillIds,
    };

    return engine.renderFile("agent", data);
  }

  // Helper to extract frontmatter from compiled agent
  function extractFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const yaml = match[1];
    const result: Record<string, unknown> = {};

    // Simple YAML parsing for our test cases
    const lines = yaml.split("\n");
    let currentKey = "";
    const currentArray: string[] = [];
    let inArray = false;

    for (const line of lines) {
      if (line.startsWith("skills:")) {
        currentKey = "skills";
        inArray = true;
        continue;
      }

      if (inArray && line.trim().startsWith("- ")) {
        currentArray.push(line.trim().slice(2));
      } else if (inArray && !line.trim().startsWith("-")) {
        if (currentArray.length > 0) {
          result[currentKey] = [...currentArray];
        }
        inArray = false;
        currentArray.length = 0;
      }

      const keyMatch = line.match(/^(\w+):\s*(.*)$/);
      if (keyMatch && !inArray) {
        result[keyMatch[1]] = keyMatch[2];
      }
    }

    if (inArray && currentArray.length > 0) {
      result[currentKey] = [...currentArray];
    }

    return result;
  }

  // Helper to extract body content (after frontmatter)
  function extractBody(content: string): string {
    const parts = content.split(/^---\n[\s\S]*?\n---\n/m);
    return parts.length > 1 ? parts[1] : content;
  }

  describe("P1-16: Preloaded skills appear in agent frontmatter", () => {
    it("should include skills: field in YAML frontmatter when preloaded skills exist", async () => {
      const skills = [
        createMockSkill("web-framework-react", true),
        createMockSkill("web-testing-vitest", false), // Dynamic, should not appear in frontmatter
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toBeDefined();
      expect(Array.isArray(frontmatter.skills)).toBe(true);
    });

    it("should list preloaded skill IDs in the skills array", async () => {
      const skills = [
        createMockSkill("web-framework-react", true),
        createMockSkill("web-state-zustand", true),
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toContain("web-framework-react");
      expect(frontmatter.skills).toContain("web-state-zustand");
    });

    it("should NOT include preloaded skills in the dynamic skill section", async () => {
      const skills = [
        createMockSkill("web-framework-react", true, "when building React components"),
      ];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      // Preloaded skills should not appear in the skill_activation_protocol section
      expect(body).not.toContain("<skill_activation_protocol>");
      expect(body).not.toContain(`Invoke: \`skill: "${"web-framework-react"}"\``);
      // Instead, should show the "all skills preloaded" note
      expect(body).toContain("<skills_note>");
      expect(body).toContain("All skills for this agent are preloaded via frontmatter");
    });

    it("should include multiple preloaded skills in frontmatter", async () => {
      const skills = [
        createMockSkill("web-framework-react", true),
        createMockSkill("web-state-zustand", true),
        createMockSkill("web-testing-vitest", true),
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toHaveLength(3);
      expect(frontmatter.skills).toContain("web-framework-react");
      expect(frontmatter.skills).toContain("web-state-zustand");
      expect(frontmatter.skills).toContain("web-testing-vitest");
    });

    it("should not include skills: field when no preloaded skills exist", async () => {
      const skills = [
        createMockSkill("web-testing-vitest", false), // All dynamic
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toBeUndefined();
    });
  });

  describe("P1-17: Dynamic skills referenced in agent body", () => {
    it("should reference dynamic skill in body with skill: format", async () => {
      const skills = [createMockSkill("web-testing-vitest", false, "when working with vitest")];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain(`skill: "${"web-testing-vitest"}"`);
    });

    it("should include Invoke: instruction for dynamic skills", async () => {
      const skills = [createMockSkill("web-testing-vitest", false)];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain(`Invoke: \`skill: "${"web-testing-vitest"}"\``);
    });

    it("should NOT include dynamic skills in frontmatter skills array", async () => {
      const skills = [
        createMockSkill("web-framework-react", true),
        createMockSkill("web-testing-vitest", false),
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      // Only preloaded skill should be in frontmatter
      expect(frontmatter.skills).toContain("web-framework-react");
      expect(frontmatter.skills).not.toContain("web-testing-vitest");
    });

    it("should include Use when: guidance for each dynamic skill", async () => {
      const skills = [
        createMockSkill("web-testing-vitest", false, "when working with vitest"),
        createMockSkill("web-build-turborepo", false, "when working with turborepo"),
      ];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain("Use when: when working with vitest");
      expect(body).toContain("Use when: when working with turborepo");
    });

    it("should include skill_activation_protocol section for dynamic skills", async () => {
      const skills = [createMockSkill("web-testing-vitest", false)];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain("<skill_activation_protocol>");
      expect(body).toContain("## Available Skills (Require Loading)");
    });

    it("should include description for each dynamic skill", async () => {
      const skills = [createMockSkill("web-testing-vitest", false)];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain(`Description: ${"web-testing-vitest"} skill description`);
    });
  });

  describe("mixed preloaded and dynamic skills", () => {
    it("should correctly separate preloaded and dynamic skills in output", async () => {
      const skills = [
        createMockSkill("web-framework-react", true, "when building React components"),
        createMockSkill("web-state-zustand", true, "when managing state"),
        createMockSkill("web-testing-vitest", false, "when working with vitest"),
        createMockSkill("web-build-turborepo", false, "when working with turborepo"),
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);
      const body = extractBody(output);

      // Preloaded skills in frontmatter only
      expect(frontmatter.skills).toHaveLength(2);
      expect(frontmatter.skills).toContain("web-framework-react");
      expect(frontmatter.skills).toContain("web-state-zustand");
      expect(frontmatter.skills).not.toContain("web-testing-vitest");
      expect(frontmatter.skills).not.toContain("web-build-turborepo");

      // Dynamic skills in body only
      expect(body).toContain("<skill_activation_protocol>");
      expect(body).toContain(`Invoke: \`skill: "${"web-testing-vitest"}"\``);
      expect(body).toContain('Invoke: `skill: "web-build-turborepo"`');
      expect(body).not.toContain(`Invoke: \`skill: "${"web-framework-react"}"\``);
      expect(body).not.toContain(`Invoke: \`skill: "${"web-state-zustand"}"\``);
    });

    it("should handle agent with no skills at all", async () => {
      const skills: Skill[] = [];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);
      const body = extractBody(output);

      // No skills in frontmatter
      expect(frontmatter.skills).toBeUndefined();

      // Should show "all preloaded" note (since there are no dynamic skills to activate)
      expect(body).toContain("<skills_note>");
      expect(body).not.toContain("<skill_activation_protocol>");
    });
  });
});

// =============================================================================
// Phase 7: Stack-based skill resolution tests
// Bug: cc init compiles agents without preloaded_skills in frontmatter
// =============================================================================

import { resolveAgentSkillsFromStack, getAgentSkills, resolveAgents } from "./resolver";
import type { CompileAgentConfig, CompileConfig, AgentDefinition } from "../types";
import type { Stack } from "../types-stacks";

describe("resolveAgentSkillsFromStack", () => {
  it("should return skill references from stack agent config", () => {
    const stack: Stack = {
      id: "test-stack",
      name: "Test Stack",
      description: "A test stack",
      agents: {
        "web-developer": {
          framework: "react",
          styling: "scss-modules",
        },
      },
    };

    const skillAliases: Record<string, string> = {
      react: "web-framework-react",
      "scss-modules": "web-styling-scss-modules",
    };

    const result = resolveAgentSkillsFromStack("web-developer", stack, skillAliases);

    expect(result).toHaveLength(2);
    expect(result.find((s) => s.id === "web-framework-react")).toBeDefined();
    expect(result.find((s) => s.id === "web-styling-scss-modules")).toBeDefined();
  });

  it("should mark framework subcategory skills as preloaded", () => {
    const stack: Stack = {
      id: "test-stack",
      name: "Test Stack",
      description: "A test stack",
      agents: {
        "web-developer": {
          framework: "react",
        },
      },
    };

    const skillAliases: Record<string, string> = {
      react: "web-framework-react",
    };

    const result = resolveAgentSkillsFromStack("web-developer", stack, skillAliases);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("web-framework-react");
    expect(result[0].preloaded).toBe(true);
  });

  it("should NOT mark non-key subcategory skills as preloaded", () => {
    const stack: Stack = {
      id: "test-stack",
      name: "Test Stack",
      description: "A test stack",
      agents: {
        "web-developer": {
          styling: "scss-modules",
        },
      },
    };

    const skillAliases: Record<string, string> = {
      "scss-modules": "web-styling-scss-modules",
    };

    const result = resolveAgentSkillsFromStack("web-developer", stack, skillAliases);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("web-styling-scss-modules");
    expect(result[0].preloaded).toBe(false);
  });

  it("should return empty array for agent not in stack", () => {
    const stack: Stack = {
      id: "test-stack",
      name: "Test Stack",
      description: "A test stack",
      agents: {
        "api-developer": { api: "hono" },
      },
    };

    const skillAliases: Record<string, string> = {
      hono: "api-framework-hono",
    };

    const result = resolveAgentSkillsFromStack("web-developer", stack, skillAliases);

    expect(result).toEqual([]);
  });

  it("should return empty array for agent with empty config", () => {
    const stack: Stack = {
      id: "test-stack",
      name: "Test Stack",
      description: "A test stack",
      agents: {
        "web-developer": {},
      },
    };

    const skillAliases: Record<string, string> = {};

    const result = resolveAgentSkillsFromStack("web-developer", stack, skillAliases);

    expect(result).toEqual([]);
  });

  it("should skip unknown skill aliases with warning (not throw)", () => {
    const stack: Stack = {
      id: "test-stack",
      name: "Test Stack",
      description: "A test stack",
      agents: {
        "web-developer": {
          framework: "react",
          styling: "unknown-style-lib" as SkillAlias,
        },
      },
    };

    const skillAliases: Record<string, string> = {
      react: "web-framework-react",
      // "unknown-style-lib" is NOT in aliases
    };

    const result = resolveAgentSkillsFromStack("web-developer", stack, skillAliases);

    // Should only include the resolved skill, not the unknown one
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("web-framework-react");
  });
});

describe("getAgentSkills", () => {
  const mockSkillDefinitions: Record<string, SkillDefinition> = {
    ["web-framework-react"]: {
      path: "skills/web/framework/react/",
      name: "React",
      description: "React framework",
      canonicalId: "web-framework-react",
    },
    ["web-styling-scss-modules"]: {
      path: "skills/web/styling/scss-modules/",
      name: "SCSS Modules",
      description: "SCSS Modules styling",
      canonicalId: "web-styling-scss-modules",
    },
  };

  it("should return skills from stack when stack and skillAliases provided", async () => {
    const agentConfig: CompileAgentConfig = {};
    const compileConfig: CompileConfig = {
      name: "test",
      description: "test",
      claude_md: "",
      agents: { "web-developer": {} },
    };

    const stack: Stack = {
      id: "test-stack",
      name: "Test Stack",
      description: "A test stack",
      agents: {
        "web-developer": {
          framework: "react",
        },
      },
    };

    const skillAliases: Record<string, string> = {
      react: "web-framework-react",
    };

    const result = await getAgentSkills(
      "web-developer",
      agentConfig,
      compileConfig,
      mockSkillDefinitions,
      "/test/path",
      stack,
      skillAliases,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("web-framework-react");
    expect(result[0].preloaded).toBe(true);
  });

  it("should prioritize explicit agentConfig.skills over stack skills", async () => {
    const agentConfig: CompileAgentConfig = {
      skills: [
        {
          id: "web-styling-scss-modules",
          usage: "when styling",
          preloaded: true,
        },
      ],
    };
    const compileConfig: CompileConfig = {
      name: "test",
      description: "test",
      claude_md: "",
      agents: { "web-developer": agentConfig },
    };

    const stack: Stack = {
      id: "test-stack",
      name: "Test Stack",
      description: "A test stack",
      agents: {
        "web-developer": {
          framework: "react",
        },
      },
    };

    const skillAliases: Record<string, string> = {
      react: "web-framework-react",
    };

    const result = await getAgentSkills(
      "web-developer",
      agentConfig,
      compileConfig,
      mockSkillDefinitions,
      "/test/path",
      stack,
      skillAliases,
    );

    // Should use explicit skills, not stack skills
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("web-styling-scss-modules");
  });

  it("should return empty array when no stack or skillAliases provided", async () => {
    const agentConfig: CompileAgentConfig = {};
    const compileConfig: CompileConfig = {
      name: "test",
      description: "test",
      claude_md: "",
      agents: { "web-developer": {} },
    };

    const result = await getAgentSkills(
      "web-developer",
      agentConfig,
      compileConfig,
      mockSkillDefinitions,
      "/test/path",
      undefined, // no stack
      undefined, // no skillAliases
    );

    expect(result).toEqual([]);
  });
});

describe("resolveAgents with stack and skillAliases", () => {
  const mockAgentDefinitions: Record<string, AgentDefinition> = {
    "web-developer": {
      title: "Web Developer",
      description: "Frontend web developer",
      tools: ["Read", "Write", "Edit"],
      model: "opus",
      path: "web/web-developer",
    },
    "api-developer": {
      title: "API Developer",
      description: "Backend API developer",
      tools: ["Read", "Write", "Edit", "Bash"],
      model: "opus",
      path: "api/api-developer",
    },
  };

  const mockSkillDefinitions: Record<string, SkillDefinition> = {
    ["web-framework-react"]: {
      path: "skills/web/framework/react/",
      name: "React",
      description: "React framework",
      canonicalId: "web-framework-react",
    },
    ["web-styling-scss-modules"]: {
      path: "skills/web/styling/scss-modules/",
      name: "SCSS Modules",
      description: "SCSS Modules styling",
      canonicalId: "web-styling-scss-modules",
    },
    ["api-framework-hono"]: {
      path: "skills/api/api/hono/",
      name: "Hono",
      description: "Hono API framework",
      canonicalId: "api-framework-hono",
    },
    ["api-database-drizzle"]: {
      path: "skills/api/database/drizzle/",
      name: "Drizzle",
      description: "Drizzle ORM",
      canonicalId: "api-database-drizzle",
    },
  };

  it("should resolve agents with skills from stack configuration", async () => {
    const compileConfig: CompileConfig = {
      name: "Test Plugin",
      description: "Test description",
      claude_md: "",
      agents: {
        "web-developer": {},
        "api-developer": {},
      },
    };

    const stack: Stack = {
      id: "fullstack",
      name: "Fullstack Stack",
      description: "A fullstack development stack",
      agents: {
        "web-developer": {
          framework: "react",
          styling: "scss-modules",
        },
        "api-developer": {
          api: "hono",
          database: "drizzle",
        },
      },
    };

    const skillAliases: Record<string, string> = {
      react: "web-framework-react",
      "scss-modules": "web-styling-scss-modules",
      hono: "api-framework-hono",
      drizzle: "api-database-drizzle",
    };

    const result = await resolveAgents(
      mockAgentDefinitions,
      mockSkillDefinitions,
      compileConfig,
      "/test/path",
      stack,
      skillAliases,
    );

    // Check web-developer has correct skills
    expect(result["web-developer"]).toBeDefined();
    expect(result["web-developer"].skills).toHaveLength(2);

    const webSkillIds = result["web-developer"].skills.map((s) => s.id);
    expect(webSkillIds).toContain("web-framework-react");
    expect(webSkillIds).toContain("web-styling-scss-modules");

    // React (framework) should be preloaded, scss-modules (styling) should not
    const reactSkill = result["web-developer"].skills.find((s) => s.id === "web-framework-react");
    expect(reactSkill?.preloaded).toBe(true);

    const scssSkill = result["web-developer"].skills.find(
      (s) => s.id === "web-styling-scss-modules",
    );
    expect(scssSkill?.preloaded).toBe(false);

    // Check api-developer has correct skills
    expect(result["api-developer"]).toBeDefined();
    expect(result["api-developer"].skills).toHaveLength(2);

    const apiSkillIds = result["api-developer"].skills.map((s) => s.id);
    expect(apiSkillIds).toContain("api-framework-hono");
    expect(apiSkillIds).toContain("api-database-drizzle");

    // Hono (api) should be preloaded, drizzle (database) should be preloaded
    const honoSkill = result["api-developer"].skills.find((s) => s.id === "api-framework-hono");
    expect(honoSkill?.preloaded).toBe(true);

    const drizzleSkill = result["api-developer"].skills.find(
      (s) => s.id === "api-database-drizzle",
    );
    expect(drizzleSkill?.preloaded).toBe(true);
  });

  it("should return agents without skills when stack/skillAliases not provided", async () => {
    const compileConfig: CompileConfig = {
      name: "Test Plugin",
      description: "Test description",
      claude_md: "",
      agents: {
        "web-developer": {},
      },
    };

    const result = await resolveAgents(
      mockAgentDefinitions,
      mockSkillDefinitions,
      compileConfig,
      "/test/path",
      // NOT passing stack and skillAliases
    );

    expect(result["web-developer"]).toBeDefined();
    expect(result["web-developer"].skills).toEqual([]);
  });

  it("should handle agent in compileConfig but not in stack", async () => {
    const compileConfig: CompileConfig = {
      name: "Test Plugin",
      description: "Test description",
      claude_md: "",
      agents: {
        "web-developer": {},
        "api-developer": {},
      },
    };

    // Stack only has web-developer
    const stack: Stack = {
      id: "web-only",
      name: "Web Stack",
      description: "A web-only stack",
      agents: {
        "web-developer": {
          framework: "react",
        },
      },
    };

    const skillAliases: Record<string, string> = {
      react: "web-framework-react",
    };

    const result = await resolveAgents(
      mockAgentDefinitions,
      mockSkillDefinitions,
      compileConfig,
      "/test/path",
      stack,
      skillAliases,
    );

    // web-developer should have skills from stack
    expect(result["web-developer"].skills).toHaveLength(1);
    expect(result["web-developer"].skills[0].id).toBe("web-framework-react");

    // api-developer should have no skills (not in stack)
    expect(result["api-developer"].skills).toEqual([]);
  });
});
