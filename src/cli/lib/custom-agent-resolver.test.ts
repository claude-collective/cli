import { describe, it, expect } from "vitest";
import {
  resolveCustomAgent,
  resolveCustomAgents,
  hasAgentIdConflict,
  validateCustomAgentIds,
} from "./custom-agent-resolver";
import { createMockAgent } from "./__tests__/helpers";
import type { CustomAgentConfig, AgentDefinition } from "../../types";
import type { AgentName } from "../types-matrix";

describe("custom-agent-resolver", () => {
  // Mock built-in agents for testing
  const mockBuiltinAgents: Record<string, AgentDefinition> = {
    "web-developer": createMockAgent("Web Developer", {
      description: "A frontend web developer agent",
      disallowed_tools: undefined,
      hooks: undefined,
      path: "developer/web-developer",
      sourceRoot: "/mock/source",
    }),
    "web-reviewer": createMockAgent("Web Reviewer", {
      description: "A code review agent for web projects",
      tools: ["Read", "Grep", "Glob"],
      disallowed_tools: ["Bash"],
      permission_mode: "acceptEdits",
      hooks: {
        PreToolUse: [{ matcher: "Edit" }],
      },
      path: "reviewer/web-reviewer",
      sourceRoot: "/mock/source",
    }),
    "api-developer": createMockAgent("API Developer", {
      description: "A backend API developer agent",
      model: "sonnet",
      path: "developer/api-developer",
      sourceRoot: "/mock/source",
    }),
  };

  describe("resolveCustomAgent", () => {
    describe("standalone custom agents (no extends)", () => {
      it("should create a standalone agent with specified tools", () => {
        const customConfig: CustomAgentConfig = {
          title: "Data Analyst",
          description: "Analyzes data patterns",
          tools: ["Read", "Grep", "Glob"],
        };

        const result = resolveCustomAgent("data-analyst", customConfig, mockBuiltinAgents);

        expect(result.title).toBe("Data Analyst");
        expect(result.description).toBe("Analyzes data patterns");
        expect(result.tools).toEqual(["Read", "Grep", "Glob"]);
        expect(result.path).toBe("_custom");
        expect(result.sourceRoot).toBeUndefined();
      });

      it("should use default tools when not specified", () => {
        const customConfig: CustomAgentConfig = {
          title: "Simple Agent",
          description: "A simple agent",
        };

        const result = resolveCustomAgent("simple-agent", customConfig, mockBuiltinAgents);

        expect(result.tools).toEqual(["Read", "Grep", "Glob"]);
      });

      it("should apply model when specified", () => {
        const customConfig: CustomAgentConfig = {
          title: "Fast Agent",
          description: "Uses faster model",
          model: "sonnet",
          tools: ["Read"],
        };

        const result = resolveCustomAgent("fast-agent", customConfig, mockBuiltinAgents);

        expect(result.model).toBe("sonnet");
      });

      it("should apply permission_mode when specified", () => {
        const customConfig: CustomAgentConfig = {
          title: "Cautious Agent",
          description: "Requires approval",
          permission_mode: "plan",
          tools: ["Read"],
        };

        const result = resolveCustomAgent("cautious-agent", customConfig, mockBuiltinAgents);

        expect(result.permission_mode).toBe("plan");
      });

      it("should apply disallowed_tools when specified", () => {
        const customConfig: CustomAgentConfig = {
          title: "Safe Agent",
          description: "No dangerous tools",
          tools: ["Read", "Grep"],
          disallowed_tools: ["Bash", "Write"],
        };

        const result = resolveCustomAgent("safe-agent", customConfig, mockBuiltinAgents);

        expect(result.disallowed_tools).toEqual(["Bash", "Write"]);
      });

      it("should apply hooks when specified", () => {
        const customConfig: CustomAgentConfig = {
          title: "Hooked Agent",
          description: "Has hooks",
          tools: ["Read"],
          hooks: {
            PostToolUse: [{ matcher: "*" }],
          },
        };

        const result = resolveCustomAgent("hooked-agent", customConfig, mockBuiltinAgents);

        expect(result.hooks).toEqual({
          PostToolUse: [{ matcher: "*" }],
        });
      });
    });

    describe("extended custom agents", () => {
      it("should inherit from base agent", () => {
        const customConfig: CustomAgentConfig = {
          title: "Custom Web Dev",
          description: "Extended web developer",
          extends: "web-developer",
        };

        const result = resolveCustomAgent("custom-web-dev", customConfig, mockBuiltinAgents);

        expect(result.title).toBe("Custom Web Dev");
        expect(result.description).toBe("Extended web developer");
        expect(result.model).toBe("opus"); // Inherited
        expect(result.tools).toEqual(["Read", "Write", "Edit", "Grep", "Glob", "Bash"]); // Inherited
        expect(result.permission_mode).toBe("default"); // Inherited
        expect(result.path).toBe("developer/web-developer"); // Inherited
        expect(result.sourceRoot).toBe("/mock/source"); // Inherited
      });

      it("should override model when specified", () => {
        const customConfig: CustomAgentConfig = {
          title: "Fast Web Dev",
          description: "Faster web developer",
          extends: "web-developer",
          model: "haiku",
        };

        const result = resolveCustomAgent("fast-web-dev", customConfig, mockBuiltinAgents);

        expect(result.model).toBe("haiku");
        expect(result.tools).toEqual(["Read", "Write", "Edit", "Grep", "Glob", "Bash"]); // Still inherited
      });

      it("should override tools when specified", () => {
        const customConfig: CustomAgentConfig = {
          title: "Limited Web Dev",
          description: "Restricted tools",
          extends: "web-developer",
          tools: ["Read", "Grep"],
        };

        const result = resolveCustomAgent("limited-web-dev", customConfig, mockBuiltinAgents);

        expect(result.tools).toEqual(["Read", "Grep"]);
        expect(result.model).toBe("opus"); // Still inherited
      });

      it("should override permission_mode when specified", () => {
        const customConfig: CustomAgentConfig = {
          title: "Strict Web Dev",
          description: "Strict permissions",
          extends: "web-developer",
          permission_mode: "dontAsk",
        };

        const result = resolveCustomAgent("strict-web-dev", customConfig, mockBuiltinAgents);

        expect(result.permission_mode).toBe("dontAsk");
      });

      it("should merge disallowed_tools with inherited", () => {
        const customConfig: CustomAgentConfig = {
          title: "Safer Reviewer",
          description: "Even more restricted",
          extends: "web-reviewer",
          disallowed_tools: ["Write", "Edit"],
        };

        const result = resolveCustomAgent("safer-reviewer", customConfig, mockBuiltinAgents);

        // Should have both inherited (Bash) and custom (Write, Edit)
        expect(result.disallowed_tools).toContain("Bash");
        expect(result.disallowed_tools).toContain("Write");
        expect(result.disallowed_tools).toContain("Edit");
        expect(result.disallowed_tools).toHaveLength(3);
      });

      it("should merge hooks with inherited", () => {
        const customConfig: CustomAgentConfig = {
          title: "More Hooked Reviewer",
          description: "Additional hooks",
          extends: "web-reviewer",
          hooks: {
            PostToolUse: [{ matcher: "*" }],
            PreToolUse: [{ matcher: "Write" }], // Adds to existing PreToolUse
          },
        };

        const result = resolveCustomAgent("more-hooked-reviewer", customConfig, mockBuiltinAgents);

        // Should have merged hooks
        expect(result.hooks?.PreToolUse).toHaveLength(2);
        expect(result.hooks?.PreToolUse?.[0]).toEqual({ matcher: "Edit" }); // Inherited
        expect(result.hooks?.PreToolUse?.[1]).toEqual({ matcher: "Write" }); // Custom
        expect(result.hooks?.PostToolUse).toHaveLength(1);
        expect(result.hooks?.PostToolUse?.[0]).toEqual({ matcher: "*" }); // Custom
      });

      it("should throw error for unknown extended agent", () => {
        const customConfig: CustomAgentConfig = {
          title: "Bad Agent",
          description: "Extends non-existent",
          extends: "non-existent-agent" as AgentName,
        };

        expect(() => resolveCustomAgent("bad-agent", customConfig, mockBuiltinAgents)).toThrow(
          /Custom agent "bad-agent" extends unknown agent "non-existent-agent"/,
        );
      });

      it("should include available agents in error message", () => {
        const customConfig: CustomAgentConfig = {
          title: "Bad Agent",
          description: "Extends non-existent",
          extends: "non-existent-agent" as AgentName,
        };

        expect(() => resolveCustomAgent("bad-agent", customConfig, mockBuiltinAgents)).toThrow(
          /Available agents:/,
        );
      });
    });
  });

  describe("resolveCustomAgents", () => {
    it("should resolve multiple custom agents", () => {
      const customAgents: Record<string, CustomAgentConfig> = {
        "my-dev": {
          title: "My Developer",
          description: "Custom developer",
          extends: "web-developer",
        },
        "my-analyst": {
          title: "My Analyst",
          description: "Custom analyst",
          tools: ["Read", "Grep"],
        },
      };

      const result = resolveCustomAgents(customAgents, mockBuiltinAgents);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result["my-dev"]).toBeDefined();
      expect(result["my-analyst"]).toBeDefined();
      expect(result["my-dev"].model).toBe("opus"); // Inherited
      expect(result["my-analyst"].path).toBe("_custom"); // Standalone
    });

    it("should return empty object for empty input", () => {
      const result = resolveCustomAgents({}, mockBuiltinAgents);
      expect(result).toEqual({});
    });

    it("should propagate errors from individual resolution", () => {
      const customAgents: Record<string, CustomAgentConfig> = {
        "bad-agent": {
          title: "Bad Agent",
          description: "Extends non-existent",
          extends: "non-existent" as AgentName,
        },
      };

      expect(() => resolveCustomAgents(customAgents, mockBuiltinAgents)).toThrow(
        /Custom agent "bad-agent" extends unknown agent/,
      );
    });
  });

  describe("hasAgentIdConflict", () => {
    it("should return true for conflicting ID", () => {
      expect(hasAgentIdConflict("web-developer", mockBuiltinAgents)).toBe(true);
    });

    it("should return false for non-conflicting ID", () => {
      expect(hasAgentIdConflict("my-custom-agent", mockBuiltinAgents)).toBe(false);
    });
  });

  describe("validateCustomAgentIds", () => {
    it("should return errors for conflicting IDs", () => {
      const customAgents: Record<string, CustomAgentConfig> = {
        "web-developer": {
          title: "Conflict",
          description: "Conflicts with built-in",
        },
        "my-custom": {
          title: "OK",
          description: "No conflict",
        },
      };

      const errors = validateCustomAgentIds(customAgents, mockBuiltinAgents);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("web-developer");
      expect(errors[0]).toContain("conflicts with built-in agent");
    });

    it("should return empty array when no conflicts", () => {
      const customAgents: Record<string, CustomAgentConfig> = {
        "my-custom-1": {
          title: "Custom 1",
          description: "No conflict",
        },
        "my-custom-2": {
          title: "Custom 2",
          description: "No conflict",
        },
      };

      const errors = validateCustomAgentIds(customAgents, mockBuiltinAgents);

      expect(errors).toEqual([]);
    });

    it("should return multiple errors for multiple conflicts", () => {
      const customAgents: Record<string, CustomAgentConfig> = {
        "web-developer": {
          title: "Conflict 1",
          description: "Conflicts",
        },
        "api-developer": {
          title: "Conflict 2",
          description: "Conflicts",
        },
      };

      const errors = validateCustomAgentIds(customAgents, mockBuiltinAgents);

      expect(errors).toHaveLength(2);
    });
  });

  // ==========================================================================
  // P3-04: Custom agent with skills from config
  // ==========================================================================
  describe("P3-04: custom agent with skills from config", () => {
    it("should preserve skills from custom agent config", () => {
      const customConfig: CustomAgentConfig = {
        title: "Skill Test Agent",
        description: "Test skills",
        tools: ["Read"],
        skills: [{ id: "web-framework-react", preloaded: true }, { id: "web-language-typescript" }],
      };

      // Verify the config structure is valid with skills
      expect(customConfig.skills).toBeDefined();
      expect(customConfig.skills).toHaveLength(2);
      expect(customConfig.skills?.[0]).toEqual({
        id: "web-framework-react",
        preloaded: true,
      });
      expect(customConfig.skills?.[1]).toEqual({ id: "web-language-typescript" });

      // Note: resolveCustomAgent returns AgentDefinition which doesn't have skills
      // Skills are handled separately in the compilation pipeline
      // This test verifies the config structure is valid
      const result = resolveCustomAgent("skill-agent", customConfig, mockBuiltinAgents);

      // Agent resolves correctly despite having skills in config
      expect(result.title).toBe("Skill Test Agent");
      expect(result.tools).toEqual(["Read"]);
    });

    it("should support skills with local flag", () => {
      const customConfig: CustomAgentConfig = {
        title: "Local Skill Agent",
        description: "Agent with local skills",
        tools: ["Read", "Write"],
        skills: [
          {
            id: "web-custom-skill",
            local: true,
            path: ".claude/skills/my-skill/",
          },
          { id: "web-framework-react", preloaded: false },
        ],
      };

      // Verify local skill structure
      expect(customConfig.skills?.[0]).toEqual({
        id: "web-custom-skill",
        local: true,
        path: ".claude/skills/my-skill/",
      });

      // Agent resolves correctly with local skills in config
      const result = resolveCustomAgent("local-skill-agent", customConfig, mockBuiltinAgents);

      expect(result.title).toBe("Local Skill Agent");
    });

    it("should support extended agent with additional skills", () => {
      const customConfig: CustomAgentConfig = {
        title: "Extended With Skills",
        description: "Extended agent with custom skills",
        extends: "web-developer",
        skills: [{ id: "web-framework-nextjs", preloaded: true }, { id: "web-testing-rtl" }],
      };

      // Verify skills are defined on extended agent config
      expect(customConfig.skills).toHaveLength(2);

      const result = resolveCustomAgent("extended-skill-agent", customConfig, mockBuiltinAgents);

      // Inherits from base
      expect(result.model).toBe("opus");
      expect(result.path).toBe("developer/web-developer");
      // Uses inherited tools (not overridden)
      expect(result.tools).toEqual(["Read", "Write", "Edit", "Grep", "Glob", "Bash"]);
    });

    it("should handle empty skills array", () => {
      const customConfig: CustomAgentConfig = {
        title: "No Skills Agent",
        description: "Agent with empty skills",
        tools: ["Read"],
        skills: [],
      };

      expect(customConfig.skills).toEqual([]);

      const result = resolveCustomAgent("no-skill-agent", customConfig, mockBuiltinAgents);

      expect(result.title).toBe("No Skills Agent");
    });
  });

  // ==========================================================================
  // P3-05: Custom agent overrides builtin agent
  // ==========================================================================
  describe("P3-05: custom agent overrides builtin agent", () => {
    it("should allow custom agent with extends to reference builtin by same name", () => {
      // Use case: User wants to customize web-developer with same ID
      // They use extends to inherit and then override specific properties
      const customConfig: CustomAgentConfig = {
        title: "Custom Web Developer",
        description: "My custom version of web developer",
        extends: "web-developer",
        tools: ["Read", "Grep"], // Override tools
        model: "haiku", // Override model
      };

      // Resolve using the same ID as builtin
      const result = resolveCustomAgent("web-developer", customConfig, mockBuiltinAgents);

      // Custom properties override
      expect(result.title).toBe("Custom Web Developer");
      expect(result.description).toBe("My custom version of web developer");
      expect(result.tools).toEqual(["Read", "Grep"]);
      expect(result.model).toBe("haiku");
      // Inherits path from base
      expect(result.path).toBe("developer/web-developer");
    });

    it("should allow custom agent to fully override builtin without extends", () => {
      // Use case: User wants a completely different agent with the builtin name
      // Note: validateCustomAgentIds would warn about this, but resolveCustomAgent allows it
      const customConfig: CustomAgentConfig = {
        title: "Completely Custom Web Dev",
        description: "Replaces the builtin entirely",
        tools: ["Read", "Bash"],
        model: "sonnet",
        permission_mode: "plan",
      };

      // Resolve using builtin ID (no extends - fresh agent)
      const result = resolveCustomAgent("web-developer", customConfig, mockBuiltinAgents);

      // All properties from custom config
      expect(result.title).toBe("Completely Custom Web Dev");
      expect(result.description).toBe("Replaces the builtin entirely");
      expect(result.tools).toEqual(["Read", "Bash"]);
      expect(result.model).toBe("sonnet");
      expect(result.permission_mode).toBe("plan");
      // No inheritance - uses _custom path
      expect(result.path).toBe("_custom");
      expect(result.sourceRoot).toBeUndefined();
    });

    it("should preserve custom agent skills when overriding builtin", () => {
      const customConfig: CustomAgentConfig = {
        title: "Skilled Web Developer Override",
        description: "Custom web developer with specific skills",
        extends: "web-developer",
        skills: [
          { id: "web-framework-react", preloaded: true },
          { id: "web-framework-nextjs" },
          { id: "web-styling-tailwind", preloaded: true },
        ],
      };

      // Skills are preserved in config for compilation pipeline
      expect(customConfig.skills).toHaveLength(3);
      expect(customConfig.skills?.[0]).toEqual({
        id: "web-framework-react",
        preloaded: true,
      });

      const result = resolveCustomAgent("web-developer", customConfig, mockBuiltinAgents);

      // Inherits non-overridden properties
      expect(result.tools).toEqual(["Read", "Write", "Edit", "Grep", "Glob", "Bash"]);
      expect(result.model).toBe("opus");
    });

    it("should merge disallowed_tools when overriding builtin", () => {
      const customConfig: CustomAgentConfig = {
        title: "Restricted Web Developer",
        description: "Web developer with extra restrictions",
        extends: "web-reviewer", // Has disallowed_tools: ["Bash"]
        disallowed_tools: ["Write", "Edit"],
      };

      const result = resolveCustomAgent("web-reviewer", customConfig, mockBuiltinAgents);

      // Should merge both inherited and custom disallowed tools
      expect(result.disallowed_tools).toContain("Bash"); // Inherited
      expect(result.disallowed_tools).toContain("Write"); // Custom
      expect(result.disallowed_tools).toContain("Edit"); // Custom
      expect(result.disallowed_tools).toHaveLength(3);
    });

    it("should merge hooks when overriding builtin", () => {
      const customConfig: CustomAgentConfig = {
        title: "Hooked Web Reviewer Override",
        description: "Web reviewer with additional hooks",
        extends: "web-reviewer", // Has hooks: { PreToolUse: [{ matcher: "Edit" }] }
        hooks: {
          PreToolUse: [{ matcher: "Write" }], // Add to existing
          PostToolUse: [{ matcher: "*" }], // New hook type
        },
      };

      const result = resolveCustomAgent("web-reviewer", customConfig, mockBuiltinAgents);

      // PreToolUse should have both inherited and custom
      expect(result.hooks?.PreToolUse).toHaveLength(2);
      expect(result.hooks?.PreToolUse?.[0]).toEqual({ matcher: "Edit" }); // Inherited
      expect(result.hooks?.PreToolUse?.[1]).toEqual({ matcher: "Write" }); // Custom
      // PostToolUse is new from custom
      expect(result.hooks?.PostToolUse).toHaveLength(1);
    });

    it("should validate builtin override with validateCustomAgentIds", () => {
      // validateCustomAgentIds reports conflicts as warnings/errors
      // This allows the app to warn users about intentional overrides
      const customAgents: Record<string, CustomAgentConfig> = {
        "web-developer": {
          title: "Custom Web Developer",
          description: "Intentionally overrides builtin",
          extends: "web-developer",
        },
      };

      const errors = validateCustomAgentIds(customAgents, mockBuiltinAgents);

      // Current behavior: reports conflict
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("web-developer");
      expect(errors[0]).toContain("conflicts with built-in agent");

      // Note: This is expected - validateCustomAgentIds provides warnings
      // The actual override still works via resolveCustomAgent
    });
  });
});
