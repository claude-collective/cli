import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { Liquid } from "liquidjs";
import {
  resolveSkillReference,
  resolveSkillReferences,
  stackToCompileConfig,
} from "./resolver";
import type {
  SkillDefinition,
  SkillReference,
  StackConfig,
  Skill,
  AgentConfig,
  CompiledAgentData,
} from "../types";

describe("resolveSkillReference", () => {
  const mockSkills: Record<string, SkillDefinition> = {
    "react (@vince)": {
      path: "skills/frontend/framework/react (@vince)/",
      name: "React",
      description: "React component patterns",
      canonicalId: "react (@vince)",
    },
    "hono (@vince)": {
      path: "skills/backend/api/hono (@vince)/",
      name: "Hono",
      description: "Hono API framework",
      canonicalId: "hono (@vince)",
    },
  };

  it("should resolve a skill reference to a full Skill object", () => {
    const ref: SkillReference = {
      id: "react (@vince)",
      usage: "when building React components",
      preloaded: true,
    };

    const result = resolveSkillReference(ref, mockSkills);

    expect(result).toEqual({
      id: "react (@vince)",
      path: "skills/frontend/framework/react (@vince)/",
      name: "React",
      description: "React component patterns",
      usage: "when building React components",
      preloaded: true,
    });
  });

  it("should default preloaded to false when not specified", () => {
    const ref: SkillReference = {
      id: "hono (@vince)",
      usage: "when building APIs",
    };

    const result = resolveSkillReference(ref, mockSkills);

    expect(result.preloaded).toBe(false);
  });

  it("should throw an error if skill is not found", () => {
    const ref: SkillReference = {
      id: "nonexistent/skill",
      usage: "never",
    };

    expect(() => resolveSkillReference(ref, mockSkills)).toThrow(
      /Skill 'nonexistent\/skill' not found in scanned skills\. Available skills:/,
    );
  });
});

describe("resolveSkillReferences", () => {
  const mockSkills: Record<string, SkillDefinition> = {
    "react (@vince)": {
      path: "skills/frontend/framework/react (@vince)/",
      name: "React",
      description: "React component patterns",
      canonicalId: "react (@vince)",
    },
    "zustand (@vince)": {
      path: "skills/frontend/client-state-management/zustand (@vince)/",
      name: "Zustand",
      description: "Lightweight state management",
      canonicalId: "zustand (@vince)",
    },
  };

  it("should resolve multiple skill references", () => {
    const refs: SkillReference[] = [
      { id: "react (@vince)", usage: "for components" },
      { id: "zustand (@vince)", usage: "for state", preloaded: true },
    ];

    const results = resolveSkillReferences(refs, mockSkills);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("react (@vince)");
    expect(results[1].id).toBe("zustand (@vince)");
    expect(results[1].preloaded).toBe(true);
  });

  it("should return empty array for empty input", () => {
    const results = resolveSkillReferences([], mockSkills);
    expect(results).toEqual([]);
  });
});

describe("stackToCompileConfig", () => {
  it("should convert a stack config to a compile config", () => {
    const stack: StackConfig = {
      name: "Test Stack",
      version: "1.0.0",
      author: "test",
      description: "A test stack",
      agents: ["web-developer", "api-developer"],
      skills: [],
    };

    const result = stackToCompileConfig("test-stack", stack);

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
    const stack: StackConfig = {
      name: "Empty Stack",
      version: "1.0.0",
      author: "test",
      agents: [],
      skills: [],
    };

    const result = stackToCompileConfig("empty-stack", stack);

    expect(result.agents).toEqual({});
  });

  it("should use empty string for missing description", () => {
    const stack: StackConfig = {
      name: "No Description",
      version: "1.0.0",
      author: "test",
      agents: ["test-agent"],
      skills: [],
    };

    const result = stackToCompileConfig("no-desc", stack);

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
    id: string,
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
        createMockSkill("react (@vince)", true),
        createMockSkill("vitest (@vince)", false), // Dynamic, should not appear in frontmatter
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toBeDefined();
      expect(Array.isArray(frontmatter.skills)).toBe(true);
    });

    it("should list preloaded skill IDs in the skills array", async () => {
      const skills = [
        createMockSkill("react (@vince)", true),
        createMockSkill("zustand (@vince)", true),
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toContain("react (@vince)");
      expect(frontmatter.skills).toContain("zustand (@vince)");
    });

    it("should NOT include preloaded skills in the dynamic skill section", async () => {
      const skills = [
        createMockSkill(
          "react (@vince)",
          true,
          "when building React components",
        ),
      ];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      // Preloaded skills should not appear in the skill_activation_protocol section
      expect(body).not.toContain("<skill_activation_protocol>");
      expect(body).not.toContain('Invoke: `skill: "react (@vince)"`');
      // Instead, should show the "all skills preloaded" note
      expect(body).toContain("<skills_note>");
      expect(body).toContain(
        "All skills for this agent are preloaded via frontmatter",
      );
    });

    it("should include multiple preloaded skills in frontmatter", async () => {
      const skills = [
        createMockSkill("react (@vince)", true),
        createMockSkill("zustand (@vince)", true),
        createMockSkill("vitest (@vince)", true),
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toHaveLength(3);
      expect(frontmatter.skills).toContain("react (@vince)");
      expect(frontmatter.skills).toContain("zustand (@vince)");
      expect(frontmatter.skills).toContain("vitest (@vince)");
    });

    it("should not include skills: field when no preloaded skills exist", async () => {
      const skills = [
        createMockSkill("vitest (@vince)", false), // All dynamic
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      expect(frontmatter.skills).toBeUndefined();
    });
  });

  describe("P1-17: Dynamic skills referenced in agent body", () => {
    it("should reference dynamic skill in body with skill: format", async () => {
      const skills = [
        createMockSkill("vitest (@vince)", false, "when working with vitest"),
      ];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain('skill: "vitest (@vince)"');
    });

    it("should include Invoke: instruction for dynamic skills", async () => {
      const skills = [createMockSkill("vitest (@vince)", false)];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain('Invoke: `skill: "vitest (@vince)"`');
    });

    it("should NOT include dynamic skills in frontmatter skills array", async () => {
      const skills = [
        createMockSkill("react (@vince)", true),
        createMockSkill("vitest (@vince)", false),
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);

      // Only preloaded skill should be in frontmatter
      expect(frontmatter.skills).toContain("react (@vince)");
      expect(frontmatter.skills).not.toContain("vitest (@vince)");
    });

    it("should include Use when: guidance for each dynamic skill", async () => {
      const skills = [
        createMockSkill("vitest (@vince)", false, "when working with vitest"),
        createMockSkill(
          "turborepo (@vince)",
          false,
          "when working with turborepo",
        ),
      ];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain("Use when: when working with vitest");
      expect(body).toContain("Use when: when working with turborepo");
    });

    it("should include skill_activation_protocol section for dynamic skills", async () => {
      const skills = [createMockSkill("vitest (@vince)", false)];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain("<skill_activation_protocol>");
      expect(body).toContain("## Available Skills (Require Loading)");
    });

    it("should include description for each dynamic skill", async () => {
      const skills = [createMockSkill("vitest (@vince)", false)];

      const output = await compileAgentWithSkills(skills);
      const body = extractBody(output);

      expect(body).toContain("Description: vitest (@vince) skill description");
    });
  });

  describe("mixed preloaded and dynamic skills", () => {
    it("should correctly separate preloaded and dynamic skills in output", async () => {
      const skills = [
        createMockSkill(
          "react (@vince)",
          true,
          "when building React components",
        ),
        createMockSkill("zustand (@vince)", true, "when managing state"),
        createMockSkill("vitest (@vince)", false, "when working with vitest"),
        createMockSkill(
          "turborepo (@vince)",
          false,
          "when working with turborepo",
        ),
      ];

      const output = await compileAgentWithSkills(skills);
      const frontmatter = extractFrontmatter(output);
      const body = extractBody(output);

      // Preloaded skills in frontmatter only
      expect(frontmatter.skills).toHaveLength(2);
      expect(frontmatter.skills).toContain("react (@vince)");
      expect(frontmatter.skills).toContain("zustand (@vince)");
      expect(frontmatter.skills).not.toContain("vitest (@vince)");
      expect(frontmatter.skills).not.toContain("turborepo (@vince)");

      // Dynamic skills in body only
      expect(body).toContain("<skill_activation_protocol>");
      expect(body).toContain('Invoke: `skill: "vitest (@vince)"`');
      expect(body).toContain('Invoke: `skill: "turborepo (@vince)"`');
      expect(body).not.toContain('Invoke: `skill: "react (@vince)"`');
      expect(body).not.toContain('Invoke: `skill: "zustand (@vince)"`');
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
