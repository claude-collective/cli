import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { Liquid } from "liquidjs";
import {
  resolveSkillReference,
  resolveSkillReferences,
  convertStackToCompileConfig,
  resolveClaudeMd,
  buildSkillRefsFromConfig,
  resolveAgentSkillsFromStack,
  resolveAgentSkillRefs,
  resolveAgents,
} from "./resolver";
import { DIRS, STANDARD_FILES } from "../consts";
import {
  createMockSkillEntry,
  createMockAgentConfig,
  createMockCompileConfig,
  createTempDir,
  cleanupTempDir,
} from "./__tests__/helpers";
import {
  REACT_DEFINITION,
  HONO_DEFINITION,
  ZUSTAND_DEFINITION,
  SCSS_DEFINITION,
  DRIZZLE_DEFINITION,
  WEB_DEVELOPER_DEFINITION,
  API_DEVELOPER_DEFINITION,
  RESOLVE_AGENTS_DEFINITIONS,
  FULLSTACK_STACK,
  WEB_REACT_AND_SCSS_STACK,
  WEB_REACT_ONLY_STACK,
  WEB_SCSS_ONLY_STACK,
  API_HONO_ONLY_STACK,
  WEB_EMPTY_AGENT_STACK,
  WEB_ONLY_PARTIAL_STACK,
  WEB_AND_API_COMPILE_CONFIG,
  WEB_ONLY_COMPILE_CONFIG,
} from "./__tests__/mock-data";
import type {
  AgentName,
  CompiledAgentData,
  ProjectConfig,
  Skill,
  SkillAssignment,
  SkillDefinition,
  SkillId,
  SkillReference,
  StackAgentConfig,
} from "../types";

// ---------------------------------------------------------------------------
// Shared SkillAssignment shorthand
// ---------------------------------------------------------------------------

/** Shorthand: creates a SkillAssignment from an id and optional preloaded flag */
function sa(id: SkillId, preloaded = false): SkillAssignment {
  return { id, preloaded };
}

// ---------------------------------------------------------------------------
// Composite skill maps (test-specific groupings of shared definitions)
// ---------------------------------------------------------------------------

const RESOLVE_SKILL_MAP: Record<string, SkillDefinition> = {
  "web-framework-react": REACT_DEFINITION,
  "api-framework-hono": HONO_DEFINITION,
};

const RESOLVE_SKILLS_MAP: Record<string, SkillDefinition> = {
  "web-framework-react": REACT_DEFINITION,
  "web-state-zustand": ZUSTAND_DEFINITION,
};

const RESOLVE_AGENTS_SKILL_MAP: Record<string, SkillDefinition> = {
  "web-framework-react": REACT_DEFINITION,
  "web-styling-scss-modules": SCSS_DEFINITION,
  "api-framework-hono": HONO_DEFINITION,
  "api-database-drizzle": DRIZZLE_DEFINITION,
};

// ---------------------------------------------------------------------------
// resolveClaudeMd
// ---------------------------------------------------------------------------

describe("resolveClaudeMd", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("resolve-claudemd-test-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
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

// ---------------------------------------------------------------------------
// buildSkillRefsFromConfig
// ---------------------------------------------------------------------------

describe("buildSkillRefsFromConfig", () => {
  it("should build skill references from agent stack config", () => {
    const agentStack: StackAgentConfig = {
      "web-framework": [sa("web-framework-react")],
      "web-styling": [sa("web-styling-scss-modules")],
    };

    const result = buildSkillRefsFromConfig(agentStack);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === "web-framework-react")).toBeDefined();
    expect(result.find((r) => r.id === "web-styling-scss-modules")).toBeDefined();
  });

  it("should preserve preloaded flag from assignments", () => {
    const agentStack: StackAgentConfig = {
      "web-framework": [sa("web-framework-react", true)],
    };

    const result = buildSkillRefsFromConfig(agentStack);

    expect(result).toHaveLength(1);
    expect(result[0].preloaded).toBe(true);
  });

  it("should set preloaded to false when not specified", () => {
    const agentStack: StackAgentConfig = {
      "web-framework": [{ id: "web-framework-react" as SkillId }],
    };

    const result = buildSkillRefsFromConfig(agentStack);

    expect(result).toHaveLength(1);
    expect(result[0].preloaded).toBe(false);
  });

  it("should include usage guidance with subcategory name", () => {
    const agentStack: StackAgentConfig = {
      "web-framework": [sa("web-framework-react")],
    };

    const result = buildSkillRefsFromConfig(agentStack);

    expect(result[0].usage).toBe("when working with web-framework");
  });

  it("should return empty array for empty config", () => {
    const result = buildSkillRefsFromConfig({});

    expect(result).toEqual([]);
  });

  it("when config has undefined assignment values, should skip them and return only defined refs", () => {
    const agentStack: StackAgentConfig = {
      "web-framework": [sa("web-framework-react")],
    };

    const result = buildSkillRefsFromConfig(agentStack);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("web-framework-react");
  });

  it("should handle multiple skills per subcategory", () => {
    const agentStack: StackAgentConfig = {
      "shared-methodology": [
        sa("meta-methodology-investigation-requirements", true),
        sa("meta-methodology-anti-over-engineering", true),
      ],
    };

    const result = buildSkillRefsFromConfig(agentStack);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("meta-methodology-investigation-requirements");
    expect(result[0].preloaded).toBe(true);
    expect(result[1].id).toBe("meta-methodology-anti-over-engineering");
    expect(result[1].preloaded).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveSkillReference
// ---------------------------------------------------------------------------

describe("resolveSkillReference", () => {
  it("should resolve a skill reference to a full Skill object", () => {
    const ref: SkillReference = {
      id: "web-framework-react",
      usage: "when building React components",
      preloaded: true,
    };

    const result = resolveSkillReference(ref, RESOLVE_SKILL_MAP);

    expect(result).toEqual({
      id: "web-framework-react",
      path: "skills/web/framework/react/",
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

    const result = resolveSkillReference(ref, RESOLVE_SKILL_MAP);

    expect(result).not.toBeNull();
    expect(result!.preloaded).toBe(false);
  });

  it("when skill ID does not exist in skills map, should return null", () => {
    const ref: SkillReference = {
      id: "web-nonexistent-skill",
      usage: "never",
    };

    const result = resolveSkillReference(ref, RESOLVE_SKILL_MAP);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveSkillReferences
// ---------------------------------------------------------------------------

describe("resolveSkillReferences", () => {
  it("should resolve multiple skill references", () => {
    const refs: SkillReference[] = [
      { id: "web-framework-react", usage: "for components" },
      { id: "web-state-zustand", usage: "for state", preloaded: true },
    ];

    const results = resolveSkillReferences(refs, RESOLVE_SKILLS_MAP);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("web-framework-react");
    expect(results[1].id).toBe("web-state-zustand");
    expect(results[1].preloaded).toBe(true);
  });

  it("should return empty array for empty input", () => {
    const results = resolveSkillReferences([], RESOLVE_SKILLS_MAP);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// convertStackToCompileConfig
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Preloaded vs dynamic skills in compiled agent output
// ---------------------------------------------------------------------------

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
    tempDir = await createTempDir("resolver-test-");

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
    await cleanupTempDir(tempDir);
  });

  function makeSkill(
    id: SkillId,
    preloaded: boolean,
    usage = "when working with this skill",
  ): Skill {
    return createMockSkillEntry(id, preloaded, {
      description: `${id} skill description`,
      usage,
    });
  }

  async function compileAgentWithSkills(skills: Skill[]): Promise<string> {
    const preloadedSkills = skills.filter((s) => s.preloaded);
    const dynamicSkills = skills.filter((s) => !s.preloaded);
    const preloadedSkillIds = preloadedSkills.map((s) => s.id);

    const agent = createMockAgentConfig("test-agent", skills, {
      title: "Test Agent",
      description: "A test agent for skill testing",
      model: "opus",
      tools: ["Read", "Write", "Edit"],
    });

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

  // Lightweight frontmatter extractor for test assertions only.
  // Parses the YAML between --- delimiters, handling top-level keys and one array.
  function extractFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const yaml = match[1];
    const result: Record<string, unknown> = {};
    const lines = yaml.split("\n");
    let arrayKey = "";
    let arrayItems: string[] = [];

    for (const line of lines) {
      if (line.startsWith("skills:")) {
        arrayKey = "skills";
        arrayItems = [];
        continue;
      }

      if (arrayKey && line.trim().startsWith("- ")) {
        arrayItems.push(line.trim().slice(2));
        continue;
      }

      if (arrayKey) {
        result[arrayKey] = [...arrayItems];
        arrayKey = "";
        arrayItems = [];
      }

      const keyMatch = line.match(/^(\w+):\s*(.*)$/);
      if (keyMatch) {
        result[keyMatch[1]] = keyMatch[2];
      }
    }

    if (arrayKey && arrayItems.length > 0) {
      result[arrayKey] = [...arrayItems];
    }

    return result;
  }

  function extractBody(content: string): string {
    const parts = content.split(/^---\n[\s\S]*?\n---\n/m);
    return parts.length > 1 ? parts[1] : content;
  }

  describe("preloaded skills appear in agent frontmatter", () => {
    it("should include skills: field in YAML frontmatter when preloaded skills exist", async () => {
      const skills = [
        makeSkill("web-framework-react", true),
        makeSkill("web-testing-vitest", false),
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toBeDefined();
      expect(Array.isArray(frontmatter.skills)).toBe(true);
    });

    it("should list preloaded skill IDs in the skills array", async () => {
      const skills = [makeSkill("web-framework-react", true), makeSkill("web-state-zustand", true)];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toContain("web-framework-react");
      expect(frontmatter.skills).toContain("web-state-zustand");
    });

    it("should NOT include preloaded skills in the dynamic skill section", async () => {
      const skills = [makeSkill("web-framework-react", true, "when building React components")];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).not.toContain("<skill_activation_protocol>");
      expect(body).not.toContain('Invoke: `skill: "web-framework-react"`');
      expect(body).toContain("<skills_note>");
      expect(body).toContain("All skills for this agent are preloaded via frontmatter");
    });

    it("should include multiple preloaded skills in frontmatter", async () => {
      const skills = [
        makeSkill("web-framework-react", true),
        makeSkill("web-state-zustand", true),
        makeSkill("web-testing-vitest", true),
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toHaveLength(3);
      expect(frontmatter.skills).toContain("web-framework-react");
      expect(frontmatter.skills).toContain("web-state-zustand");
      expect(frontmatter.skills).toContain("web-testing-vitest");
    });

    it("should not include skills: field when no preloaded skills exist", async () => {
      const skills = [makeSkill("web-testing-vitest", false)];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toBeUndefined();
    });
  });

  describe("dynamic skills referenced in agent body", () => {
    it("should reference dynamic skill in body with skill: format", async () => {
      const skills = [makeSkill("web-testing-vitest", false, "when working with vitest")];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain('skill: "web-testing-vitest"');
    });

    it("should include Invoke: instruction for dynamic skills", async () => {
      const skills = [makeSkill("web-testing-vitest", false)];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain('Invoke: `skill: "web-testing-vitest"`');
    });

    it("should NOT include dynamic skills in frontmatter skills array", async () => {
      const skills = [
        makeSkill("web-framework-react", true),
        makeSkill("web-testing-vitest", false),
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toContain("web-framework-react");
      expect(frontmatter.skills).not.toContain("web-testing-vitest");
    });

    it("should include Use when: guidance for each dynamic skill", async () => {
      const skills = [
        makeSkill("web-testing-vitest", false, "when working with vitest"),
        makeSkill("web-build-turborepo", false, "when working with turborepo"),
      ];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain("Use when: when working with vitest");
      expect(body).toContain("Use when: when working with turborepo");
    });

    it("should include skill_activation_protocol section for dynamic skills", async () => {
      const skills = [makeSkill("web-testing-vitest", false)];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain("<skill_activation_protocol>");
      expect(body).toContain("## Available Skills (Require Loading)");
    });

    it("should include description for each dynamic skill", async () => {
      const skills = [makeSkill("web-testing-vitest", false)];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain("Description: web-testing-vitest skill description");
    });
  });

  describe("mixed preloaded and dynamic skills", () => {
    const mixedSkills = [
      makeSkill("web-framework-react", true, "when building React components"),
      makeSkill("web-state-zustand", true, "when managing state"),
      makeSkill("web-testing-vitest", false, "when working with vitest"),
      makeSkill("web-build-turborepo", false, "when working with turborepo"),
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
      expect(body).toContain('Invoke: `skill: "web-testing-vitest"`');
      expect(body).toContain('Invoke: `skill: "web-build-turborepo"`');
    });

    it("when mixed skills exist, should exclude preloaded skills from body invocations", async () => {
      const output = await compileAgentWithSkills(mixedSkills);
      const body = extractBody(output);

      expect(body).not.toContain('Invoke: `skill: "web-framework-react"`');
      expect(body).not.toContain('Invoke: `skill: "web-state-zustand"`');
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

// ---------------------------------------------------------------------------
// resolveAgentSkillsFromStack
// ---------------------------------------------------------------------------

describe("resolveAgentSkillsFromStack", () => {
  it("should return skill references from stack agent config", () => {
    const result = resolveAgentSkillsFromStack("web-developer", WEB_REACT_AND_SCSS_STACK);

    expect(result).toHaveLength(2);
    expect(result.find((s) => s.id === "web-framework-react")).toBeDefined();
    expect(result.find((s) => s.id === "web-styling-scss-modules")).toBeDefined();
  });

  it("should read preloaded from assignment directly", () => {
    const result = resolveAgentSkillsFromStack("web-developer", WEB_REACT_ONLY_STACK);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("web-framework-react");
    expect(result[0].preloaded).toBe(true);
  });

  it("should NOT mark skills as preloaded when assignment has preloaded: false", () => {
    const result = resolveAgentSkillsFromStack("web-developer", WEB_SCSS_ONLY_STACK);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("web-styling-scss-modules");
    expect(result[0].preloaded).toBe(false);
  });

  it("should return empty array for agent not in stack", () => {
    const result = resolveAgentSkillsFromStack("web-developer", API_HONO_ONLY_STACK);

    expect(result).toEqual([]);
  });

  it("should return empty array for agent with empty config", () => {
    const result = resolveAgentSkillsFromStack("web-developer", WEB_EMPTY_AGENT_STACK);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveAgentSkillRefs
// ---------------------------------------------------------------------------

describe("resolveAgentSkillRefs", () => {
  it("should return skills from stack when stack provided", async () => {
    const result = await resolveAgentSkillRefs("web-developer", {}, WEB_REACT_ONLY_STACK);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("web-framework-react");
    expect(result[0].preloaded).toBe(true);
  });

  it("should prioritize explicit agentConfig.skills over stack skills", async () => {
    const agentConfig = {
      skills: [
        {
          id: "web-styling-scss-modules" as SkillId,
          usage: "when styling",
          preloaded: true,
        },
      ],
    };

    const result = await resolveAgentSkillRefs("web-developer", agentConfig, WEB_REACT_ONLY_STACK);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("web-styling-scss-modules");
  });

  it("should return empty array when no stack provided", async () => {
    const result = await resolveAgentSkillRefs("web-developer", {}, undefined);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveAgents with stack
// ---------------------------------------------------------------------------

describe("resolveAgents with stack", () => {
  describe("when resolving agents from fullstack configuration", () => {
    it("should assign correct skill IDs to web-developer", async () => {
      const result = await resolveAgents(
        RESOLVE_AGENTS_DEFINITIONS,
        RESOLVE_AGENTS_SKILL_MAP,
        WEB_AND_API_COMPILE_CONFIG,
        "/test/path",
        FULLSTACK_STACK,
      );

      expect(result["web-developer"]).toBeDefined();
      expect(result["web-developer"].skills).toHaveLength(2);

      const webSkillIds = result["web-developer"].skills.map((s) => s.id);
      expect(webSkillIds).toContain("web-framework-react");
      expect(webSkillIds).toContain("web-styling-scss-modules");
    });

    it("should set correct preloaded flags on web-developer skills", async () => {
      const result = await resolveAgents(
        RESOLVE_AGENTS_DEFINITIONS,
        RESOLVE_AGENTS_SKILL_MAP,
        WEB_AND_API_COMPILE_CONFIG,
        "/test/path",
        FULLSTACK_STACK,
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
        RESOLVE_AGENTS_DEFINITIONS,
        RESOLVE_AGENTS_SKILL_MAP,
        WEB_AND_API_COMPILE_CONFIG,
        "/test/path",
        FULLSTACK_STACK,
      );

      expect(result["api-developer"]).toBeDefined();
      expect(result["api-developer"].skills).toHaveLength(2);

      const apiSkillIds = result["api-developer"].skills.map((s) => s.id);
      expect(apiSkillIds).toContain("api-framework-hono");
      expect(apiSkillIds).toContain("api-database-drizzle");
    });

    it("should set correct preloaded flags on api-developer skills", async () => {
      const result = await resolveAgents(
        RESOLVE_AGENTS_DEFINITIONS,
        RESOLVE_AGENTS_SKILL_MAP,
        WEB_AND_API_COMPILE_CONFIG,
        "/test/path",
        FULLSTACK_STACK,
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
    const result = await resolveAgents(
      RESOLVE_AGENTS_DEFINITIONS,
      RESOLVE_AGENTS_SKILL_MAP,
      WEB_ONLY_COMPILE_CONFIG,
      "/test/path",
    );

    expect(result["web-developer"]).toBeDefined();
    expect(result["web-developer"].skills).toEqual([]);
  });

  it("should throw when agent is referenced in compile config but not in agent definitions", async () => {
    const unknownAgentConfig = createMockCompileConfig({ "unknown-agent": {} });

    await expect(
      resolveAgents(
        RESOLVE_AGENTS_DEFINITIONS,
        RESOLVE_AGENTS_SKILL_MAP,
        unknownAgentConfig,
        "/test/path",
      ),
    ).rejects.toThrow("Agent 'unknown-agent' referenced in compile config but not found");
  });

  it("should list available agents in error message when agent not found", async () => {
    const nonexistentAgentConfig = createMockCompileConfig({ "nonexistent-agent": {} });

    await expect(
      resolveAgents(
        RESOLVE_AGENTS_DEFINITIONS,
        RESOLVE_AGENTS_SKILL_MAP,
        nonexistentAgentConfig,
        "/test/path",
      ),
    ).rejects.toThrow("Available agents: web-developer, api-developer");
  });

  it("should handle agent in compileConfig but not in stack", async () => {
    const result = await resolveAgents(
      RESOLVE_AGENTS_DEFINITIONS,
      RESOLVE_AGENTS_SKILL_MAP,
      WEB_AND_API_COMPILE_CONFIG,
      "/test/path",
      WEB_ONLY_PARTIAL_STACK,
    );

    expect(result["web-developer"].skills).toHaveLength(1);
    expect(result["web-developer"].skills[0].id).toBe("web-framework-react");

    expect(result["api-developer"].skills).toEqual([]);
  });
});
