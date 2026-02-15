import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { Liquid } from "liquidjs";
import {
  resolveSkillReference,
  resolveSkillReferences,
  convertStackToCompileConfig,
  resolveClaudeMd,
  buildSkillRefsFromConfig,
} from "./resolver";
import { DIRS, STANDARD_FILES } from "../consts";
import { createMockSkillEntry } from "./__tests__/helpers";
import type {
  AgentConfig,
  AgentName,
  CompiledAgentData,
  ProjectConfig,
  Skill,
  SkillDefinition,
  SkillId,
  SkillReference,
  Subcategory,
} from "../types";

describe("resolveClaudeMd", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "resolve-claudemd-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should return stack CLAUDE.md path when it exists", async () => {
    const stackDir = path.join(tempDir, DIRS.stacks, "my-stack");
    await mkdir(stackDir, { recursive: true });
    await writeFile(path.join(stackDir, STANDARD_FILES.CLAUDE_MD), "# Claude config");

    const result = await resolveClaudeMd(tempDir, "my-stack");

    expect(result).toBe(path.join(tempDir, DIRS.stacks, "my-stack", STANDARD_FILES.CLAUDE_MD));
  });

  it("should throw when stack CLAUDE.md does not exist", async () => {
    await expect(resolveClaudeMd(tempDir, "nonexistent-stack")).rejects.toThrow(
      "Stack 'nonexistent-stack' is missing required CLAUDE.md file",
    );
  });

  it("should include expected path in error message", async () => {
    const expectedPath = path.join(tempDir, DIRS.stacks, "missing-stack", STANDARD_FILES.CLAUDE_MD);

    await expect(resolveClaudeMd(tempDir, "missing-stack")).rejects.toThrow(expectedPath);
  });
});

describe("buildSkillRefsFromConfig", () => {
  it("should build skill references from agent stack config", () => {
    const agentStack: Partial<Record<Subcategory, SkillId>> = {
      framework: "web-framework-react" as SkillId,
      styling: "web-styling-scss-modules" as SkillId,
    };

    const result = buildSkillRefsFromConfig(agentStack);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === "web-framework-react")).toBeDefined();
    expect(result.find((r) => r.id === "web-styling-scss-modules")).toBeDefined();
  });

  it("should set preloaded to false for all refs", () => {
    const agentStack: Partial<Record<Subcategory, SkillId>> = {
      framework: "web-framework-react" as SkillId,
    };

    const result = buildSkillRefsFromConfig(agentStack);

    expect(result).toHaveLength(1);
    expect(result[0].preloaded).toBe(false);
  });

  it("should include usage guidance with subcategory name", () => {
    const agentStack: Partial<Record<Subcategory, SkillId>> = {
      framework: "web-framework-react" as SkillId,
    };

    const result = buildSkillRefsFromConfig(agentStack);

    expect(result[0].usage).toBe("when working with framework");
  });

  it("should return empty array for empty config", () => {
    const result = buildSkillRefsFromConfig({});

    expect(result).toEqual([]);
  });

  it("when config has undefined skill ID values, should skip them and return only defined refs", () => {
    // Partial record may have undefined values
    const agentStack: Partial<Record<Subcategory, SkillId>> = {
      framework: "web-framework-react" as SkillId,
      styling: undefined,
    };

    const result = buildSkillRefsFromConfig(agentStack);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("web-framework-react");
  });
});

describe("resolveSkillReference", () => {
  const mockSkills: Record<string, SkillDefinition> = {
    ["web-framework-react"]: {
      path: `skills/web/framework/${"web-framework-react"}/`,
      description: "React component patterns",
      id: "web-framework-react",
    },
    ["api-framework-hono"]: {
      path: `skills/api/api/${"api-framework-hono"}/`,
      description: "Hono API framework",
      id: "api-framework-hono",
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

  it("when skill ID does not exist in skills map, should return null", () => {
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
      description: "React component patterns",
      id: "web-framework-react",
    },
    ["web-state-zustand"]: {
      path: `skills/web/client-state-management/${"web-state-zustand"}/`,
      description: "Lightweight state management",
      id: "web-state-zustand",
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

describe("convertStackToCompileConfig", () => {
  it("should convert a project config to a compile config", () => {
    const config: ProjectConfig = {
      name: "Test Stack",
      description: "A test stack",
      agents: ["web-developer", "api-developer"],
      skills: [],
    };

    const result = convertStackToCompileConfig("test-stack", config);

    expect(result).toEqual({
      name: "Test Stack",
      description: "A test stack",
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
      skills: [],
    };

    const result = convertStackToCompileConfig("empty-stack", config);

    expect(result.agents).toEqual({});
  });

  it("when agent has no description field, should default to empty string", () => {
    const config: ProjectConfig = {
      name: "No Description",
      agents: ["test-agent" as AgentName],
      skills: [],
    };

    const result = convertStackToCompileConfig("no-desc", config);

    expect(result.description).toBe("");
  });
});

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

  // Thin wrapper: resolver tests use different description/usage defaults
  function createMockSkill(
    id: SkillId,
    preloaded: boolean,
    usage = "when working with this skill",
  ): Skill {
    return createMockSkillEntry(id, preloaded, {
      description: `${id} skill description`,
      usage,
    });
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
    const mixedSkills = [
      createMockSkill("web-framework-react", true, "when building React components"),
      createMockSkill("web-state-zustand", true, "when managing state"),
      createMockSkill("web-testing-vitest", false, "when working with vitest"),
      createMockSkill("web-build-turborepo", false, "when working with turborepo"),
    ];

    it("when mixed skills exist, should include only preloaded skills in frontmatter", async () => {
      const output = await compileAgentWithSkills(mixedSkills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toHaveLength(2);
      expect(frontmatter.skills).toContain("web-framework-react");
      expect(frontmatter.skills).toContain("web-state-zustand");
    });

    it("when mixed skills exist, should exclude dynamic skills from frontmatter", async () => {
      const output = await compileAgentWithSkills(mixedSkills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).not.toContain("web-testing-vitest");
      expect(frontmatter.skills).not.toContain("web-build-turborepo");
    });

    it("when mixed skills exist, should include dynamic skills in body activation protocol", async () => {
      const output = await compileAgentWithSkills(mixedSkills);
      const body = extractBody(output);

      expect(body).toContain("<skill_activation_protocol>");
      expect(body).toContain(`Invoke: \`skill: "${"web-testing-vitest"}"\``);
      expect(body).toContain('Invoke: `skill: "web-build-turborepo"`');
    });

    it("when mixed skills exist, should exclude preloaded skills from body invocations", async () => {
      const output = await compileAgentWithSkills(mixedSkills);
      const body = extractBody(output);

      expect(body).not.toContain(`Invoke: \`skill: "${"web-framework-react"}"\``);
      expect(body).not.toContain(`Invoke: \`skill: "${"web-state-zustand"}"\``);
    });
  });

  describe("empty skills handling", () => {
    it("when no skills exist, should not include skills field in frontmatter", async () => {
      const output = await compileAgentWithSkills([]);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toBeUndefined();
    });

    it("when no skills exist, should show skills_note instead of activation protocol", async () => {
      const output = await compileAgentWithSkills([]);
      const body = extractBody(output);

      expect(body).toContain("<skills_note>");
      expect(body).not.toContain("<skill_activation_protocol>");
    });
  });
});

import { resolveAgentSkillsFromStack, resolveAgentSkillRefs, resolveAgents } from "./resolver";
import type {
  AgentDefinition,
  CompileAgentConfig,
  CompileConfig,
  SkillAssignment,
  Stack,
} from "../types";

/** Shorthand: creates a SkillAssignment from an id and optional preloaded flag */
function sa(id: SkillId, preloaded = false): SkillAssignment {
  return { id, preloaded };
}

describe("resolveAgentSkillsFromStack", () => {
  it("should return skill references from stack agent config", () => {
    const stack: Stack = {
      id: "test-stack",
      name: "Test Stack",
      description: "A test stack",
      agents: {
        "web-developer": {
          framework: [sa("web-framework-react", true)],
          styling: [sa("web-styling-scss-modules")],
        },
      },
    };

    const result = resolveAgentSkillsFromStack("web-developer", stack);

    expect(result).toHaveLength(2);
    expect(result.find((s) => s.id === "web-framework-react")).toBeDefined();
    expect(result.find((s) => s.id === "web-styling-scss-modules")).toBeDefined();
  });

  it("should read preloaded from assignment directly", () => {
    const stack: Stack = {
      id: "test-stack",
      name: "Test Stack",
      description: "A test stack",
      agents: {
        "web-developer": {
          framework: [sa("web-framework-react", true)],
        },
      },
    };

    const result = resolveAgentSkillsFromStack("web-developer", stack);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("web-framework-react");
    expect(result[0].preloaded).toBe(true);
  });

  it("should NOT mark skills as preloaded when assignment has preloaded: false", () => {
    const stack: Stack = {
      id: "test-stack",
      name: "Test Stack",
      description: "A test stack",
      agents: {
        "web-developer": {
          styling: [sa("web-styling-scss-modules")],
        },
      },
    };

    const result = resolveAgentSkillsFromStack("web-developer", stack);

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
        "api-developer": { api: [sa("api-framework-hono", true)] },
      },
    };

    const result = resolveAgentSkillsFromStack("web-developer", stack);

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

    const result = resolveAgentSkillsFromStack("web-developer", stack);

    expect(result).toEqual([]);
  });
});

describe("resolveAgentSkillRefs", () => {
  it("should return skills from stack when stack provided", async () => {
    const agentConfig: CompileAgentConfig = {};

    const stack: Stack = {
      id: "test-stack",
      name: "Test Stack",
      description: "A test stack",
      agents: {
        "web-developer": {
          framework: [sa("web-framework-react", true)],
        },
      },
    };

    const result = await resolveAgentSkillRefs("web-developer", agentConfig, stack);

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

    const stack: Stack = {
      id: "test-stack",
      name: "Test Stack",
      description: "A test stack",
      agents: {
        "web-developer": {
          framework: [sa("web-framework-react", true)],
        },
      },
    };

    const result = await resolveAgentSkillRefs("web-developer", agentConfig, stack);

    // Should use explicit skills, not stack skills
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("web-styling-scss-modules");
  });

  it("should return empty array when no stack provided", async () => {
    const agentConfig: CompileAgentConfig = {};

    const result = await resolveAgentSkillRefs(
      "web-developer",
      agentConfig,
      undefined, // no stack
    );

    expect(result).toEqual([]);
  });
});

describe("resolveAgents with stack", () => {
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
      description: "React framework",
      id: "web-framework-react",
    },
    ["web-styling-scss-modules"]: {
      path: "skills/web/styling/scss-modules/",
      description: "SCSS Modules styling",
      id: "web-styling-scss-modules",
    },
    ["api-framework-hono"]: {
      path: "skills/api/api/hono/",
      description: "Hono API framework",
      id: "api-framework-hono",
    },
    ["api-database-drizzle"]: {
      path: "skills/api/database/drizzle/",
      description: "Drizzle ORM",
      id: "api-database-drizzle",
    },
  };

  describe("when resolving agents from fullstack configuration", () => {
    const compileConfig: CompileConfig = {
      name: "Test Plugin",
      description: "Test description",
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
          framework: [sa("web-framework-react", true)],
          styling: [sa("web-styling-scss-modules")],
        },
        "api-developer": {
          api: [sa("api-framework-hono", true)],
          database: [sa("api-database-drizzle", true)],
        },
      },
    };

    it("should assign correct skill IDs to web-developer", async () => {
      const result = await resolveAgents(
        mockAgentDefinitions,
        mockSkillDefinitions,
        compileConfig,
        "/test/path",
        stack,
      );

      expect(result["web-developer"]).toBeDefined();
      expect(result["web-developer"].skills).toHaveLength(2);

      const webSkillIds = result["web-developer"].skills.map((s) => s.id);
      expect(webSkillIds).toContain("web-framework-react");
      expect(webSkillIds).toContain("web-styling-scss-modules");
    });

    it("should set correct preloaded flags on web-developer skills", async () => {
      const result = await resolveAgents(
        mockAgentDefinitions,
        mockSkillDefinitions,
        compileConfig,
        "/test/path",
        stack,
      );

      const reactSkill = result["web-developer"].skills.find((s) => s.id === "web-framework-react");
      expect(reactSkill?.preloaded).toBe(true);

      const scssSkill = result["web-developer"].skills.find(
        (s) => s.id === "web-styling-scss-modules",
      );
      expect(scssSkill?.preloaded).toBe(false);
    });

    it("should assign correct skill IDs to api-developer", async () => {
      const result = await resolveAgents(
        mockAgentDefinitions,
        mockSkillDefinitions,
        compileConfig,
        "/test/path",
        stack,
      );

      expect(result["api-developer"]).toBeDefined();
      expect(result["api-developer"].skills).toHaveLength(2);

      const apiSkillIds = result["api-developer"].skills.map((s) => s.id);
      expect(apiSkillIds).toContain("api-framework-hono");
      expect(apiSkillIds).toContain("api-database-drizzle");
    });

    it("should set correct preloaded flags on api-developer skills", async () => {
      const result = await resolveAgents(
        mockAgentDefinitions,
        mockSkillDefinitions,
        compileConfig,
        "/test/path",
        stack,
      );

      const honoSkill = result["api-developer"].skills.find((s) => s.id === "api-framework-hono");
      expect(honoSkill?.preloaded).toBe(true);

      const drizzleSkill = result["api-developer"].skills.find(
        (s) => s.id === "api-database-drizzle",
      );
      expect(drizzleSkill?.preloaded).toBe(true);
    });
  });

  it("should return agents without skills when stack not provided", async () => {
    const compileConfig: CompileConfig = {
      name: "Test Plugin",
      description: "Test description",
      agents: {
        "web-developer": {},
      },
    };

    const result = await resolveAgents(
      mockAgentDefinitions,
      mockSkillDefinitions,
      compileConfig,
      "/test/path",
      // NOT passing stack
    );

    expect(result["web-developer"]).toBeDefined();
    expect(result["web-developer"].skills).toEqual([]);
  });

  it("should throw when agent is referenced in compile config but not in agent definitions", async () => {
    const compileConfig: CompileConfig = {
      name: "Test Plugin",
      description: "Test description",
      agents: {
        "unknown-agent": {},
      },
    };

    await expect(
      resolveAgents(mockAgentDefinitions, mockSkillDefinitions, compileConfig, "/test/path"),
    ).rejects.toThrow("Agent 'unknown-agent' referenced in compile config but not found");
  });

  it("should list available agents in error message when agent not found", async () => {
    const compileConfig: CompileConfig = {
      name: "Test Plugin",
      description: "Test description",
      agents: {
        "nonexistent-agent": {},
      },
    };

    await expect(
      resolveAgents(mockAgentDefinitions, mockSkillDefinitions, compileConfig, "/test/path"),
    ).rejects.toThrow("Available agents: web-developer, api-developer");
  });

  it("should handle agent in compileConfig but not in stack", async () => {
    const compileConfig: CompileConfig = {
      name: "Test Plugin",
      description: "Test description",
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
          framework: [sa("web-framework-react", true)],
        },
      },
    };

    const result = await resolveAgents(
      mockAgentDefinitions,
      mockSkillDefinitions,
      compileConfig,
      "/test/path",
      stack,
    );

    // web-developer should have skills from stack
    expect(result["web-developer"].skills).toHaveLength(1);
    expect(result["web-developer"].skills[0].id).toBe("web-framework-react");

    // api-developer should have no skills (not in stack)
    expect(result["api-developer"].skills).toEqual([]);
  });
});
