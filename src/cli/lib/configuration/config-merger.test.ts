import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mergeConfigs, mergeWithExistingConfig } from "./config-merger";
import type { ProjectConfig, SkillAssignment, SkillId } from "../../types";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../consts";
import {
  buildProjectConfig,
  buildAgentConfigs,
  buildSkillConfigs,
  buildSourceConfig,
  createTempDir,
  cleanupTempDir,
  writeTestTsConfig,
} from "../__tests__/helpers";

describe("config-merger", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("cc-config-merger-test-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("mergeWithExistingConfig", () => {
    async function writeFullConfig(config: ProjectConfig): Promise<void> {
      // Boundary cast: ProjectConfig to generic record for writeTestTsConfig
      await writeTestTsConfig(tempDir, config as unknown as Record<string, unknown>);
    }

    it("should return new config unchanged when no existing config exists", async () => {
      const newConfig = buildProjectConfig({
        name: "new-project",
        skills: [],
        description: "A new project",
      });

      const result = await mergeWithExistingConfig(newConfig, {
        projectDir: tempDir,
      });

      expect(result.merged).toBe(false);
      expect(result.config.name).toBe("new-project");
      expect(result.config.agents).toEqual([{ name: "web-developer", scope: "project" }]);
      expect(result.config.description).toBe("A new project");
      expect(result.existingConfigPath).toBeUndefined();
    });

    it("should inherit author from simple project config when no full config exists", async () => {
      await writeTestTsConfig(
        tempDir,
        buildSourceConfig({
          source: "github:my-org/skills",
          author: "@vince",
        }),
      );

      const newConfig = buildProjectConfig({ name: "new-project", skills: [] });

      const result = await mergeWithExistingConfig(newConfig, {
        projectDir: tempDir,
      });

      // loadFullProjectConfig finds the config, so merged is true
      expect(result.merged).toBe(true);
      // Author should be inherited from existing
      expect(result.config.author).toBe("@vince");
    });

    it("should inherit agentsSource from existing config", async () => {
      await writeTestTsConfig(
        tempDir,
        buildSourceConfig({
          source: "github:my-org/skills",
          agentsSource: "github:my-org/agents",
        }),
      );

      const newConfig = buildProjectConfig({ name: "new-project", skills: [] });

      const result = await mergeWithExistingConfig(newConfig, {
        projectDir: tempDir,
      });

      expect(result.merged).toBe(true);
      expect(result.config.agentsSource).toBe("github:my-org/agents");
    });

    describe("merge precedence rules", () => {
      it.each([
        { field: "name" as const, existingValue: "existing-project", newValue: "new-project" },
        {
          field: "description" as const,
          existingValue: "Existing description",
          newValue: "New description",
        },
        {
          field: "source" as const,
          existingValue: "github:existing/source",
          newValue: "github:new/source",
        },
        { field: "author" as const, existingValue: "@existing-author", newValue: "@new-author" },
        {
          field: "marketplace" as const,
          existingValue: "existing-marketplace",
          newValue: "new-marketplace",
        },
      ])(
        "should keep existing $field over new $field",
        async ({ field, existingValue, newValue }) => {
          await writeFullConfig(
            buildProjectConfig({ name: "project", skills: [], [field]: existingValue }),
          );

          const newConfig = buildProjectConfig({
            name: "project",
            skills: [],
            [field]: newValue,
          });

          const result = await mergeWithExistingConfig(newConfig, {
            projectDir: tempDir,
          });

          expect(result.merged).toBe(true);
          expect(result.config[field]).toBe(existingValue);
        },
      );
    });

    describe("union of agents arrays", () => {
      it("should union agents (existing + new, deduplicated)", async () => {
        await writeFullConfig(
          buildProjectConfig({
            name: "project",
            agents: [
              { name: "web-developer", scope: "project" },
              { name: "api-developer", scope: "project" },
            ],
            skills: [],
          }),
        );

        const newConfig = buildProjectConfig({
          name: "project",
          agents: [
            { name: "web-developer", scope: "project" },
            { name: "cli-developer", scope: "project" },
          ], // web-developer is duplicate
          skills: [],
        });

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expect(result.config.agents).toEqual([
          { name: "web-developer", scope: "project" },
          { name: "api-developer", scope: "project" },
          { name: "cli-developer", scope: "project" },
        ]);
      });

      it("should use new config agents if existing has empty agents", async () => {
        await writeFullConfig(buildProjectConfig({ name: "project", agents: [], skills: [] }));

        const newConfig = buildProjectConfig({ name: "project", skills: [] });

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        // Empty existing agents, so new agents are used
        expect(result.config.agents).toEqual([{ name: "web-developer", scope: "project" }]);
      });
    });

    describe("deep merge of stack", () => {
      /** Shorthand: creates a SkillAssignment[] from an id */
      function sa(id: string): SkillAssignment[] {
        return [{ id: id as SkillId, preloaded: false }];
      }

      it("should deep merge stack with existing agent configs taking precedence", async () => {
        await writeFullConfig(
          buildProjectConfig({
            name: "project",
            skills: [],
            stack: {
              "web-developer": {
                "web-framework": sa("web-framework-react-existing"),
                "web-styling": sa("web-styling-scss-existing"),
              },
            },
          }),
        );

        const newConfig = buildProjectConfig({
          name: "project",
          skills: [],
          stack: {
            "web-developer": {
              "web-framework": sa("web-framework-react-new"),
              "web-client-state": sa("web-state-zustand-new"),
            },
          },
        });

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        // Existing values take precedence (framework, styling kept)
        // New values added where not existing (client-state added)
        expect(result.config.stack).toEqual({
          "web-developer": {
            "web-framework": sa("web-framework-react-existing"),
            "web-styling": sa("web-styling-scss-existing"),
            "web-client-state": sa("web-state-zustand-new"),
          },
        });
      });

      it("should add new agents to stack from new config", async () => {
        await writeFullConfig(
          buildProjectConfig({
            name: "project",
            skills: [],
            stack: {
              "web-developer": {
                "web-framework": sa("web-framework-react"),
              },
            },
          }),
        );

        const newConfig = buildProjectConfig({
          name: "project",
          agents: [
            { name: "web-developer", scope: "project" },
            { name: "api-developer", scope: "project" },
          ],
          skills: [],
          stack: {
            "web-developer": {
              "web-framework": sa("web-framework-vue"),
            },
            "api-developer": {
              "api-api": sa("api-framework-hono"),
            },
          },
        });

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expect(result.config.stack).toEqual({
          "web-developer": {
            "web-framework": sa("web-framework-react"), // existing takes precedence
          },
          "api-developer": {
            "api-api": sa("api-framework-hono"), // new agent added
          },
        });
      });

      it("should use new config stack if existing has no stack", async () => {
        await writeFullConfig(buildProjectConfig({ name: "project", skills: [] }));

        const newConfig = buildProjectConfig({
          name: "project",
          skills: [],
          stack: {
            "web-developer": {
              "web-framework": sa("web-framework-react"),
            },
          },
        });

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expect(result.config.stack).toEqual({
          "web-developer": {
            "web-framework": sa("web-framework-react"),
          },
        });
      });
    });

    it("should not mutate the input config", async () => {
      await writeTestTsConfig(
        tempDir,
        buildProjectConfig({
          name: "existing",
          agents: buildAgentConfigs(["web-developer"]),
          skills: [],
          author: "@existing",
        }) as Record<string, unknown>,
      );

      const newConfig = buildProjectConfig({
        name: "new-project",
        agents: [{ name: "api-developer", scope: "project" }],
        skills: [],
      });

      await mergeWithExistingConfig(newConfig, { projectDir: tempDir });

      // Original input should be unchanged
      expect(newConfig.name).toBe("new-project");
      expect(newConfig.agents).toEqual([{ name: "api-developer", scope: "project" }]);
      expect(newConfig.author).toBeUndefined();
    });

    it("should return existingConfigPath when merged", async () => {
      await writeTestTsConfig(
        tempDir,
        buildProjectConfig({
          name: "existing",
          agents: buildAgentConfigs(["web-developer"]),
        }) as Record<string, unknown>,
      );

      const newConfig = buildProjectConfig({ name: "new-project", skills: [] });

      const result = await mergeWithExistingConfig(newConfig, {
        projectDir: tempDir,
      });

      expect(result.merged).toBe(true);
      expect(result.existingConfigPath).toBeDefined();
      expect(result.existingConfigPath).toContain(`${CLAUDE_SRC_DIR}/${STANDARD_FILES.CONFIG_TS}`);
    });
  });

  describe("mergeConfigs", () => {
    /** Shorthand: creates a SkillAssignment[] from an id */
    function sa(id: string): SkillAssignment[] {
      return [{ id: id as SkillId, preloaded: false }];
    }

    describe("identity fields — existing takes precedence", () => {
      it("should use existing name when present", () => {
        const newConfig = buildProjectConfig({ name: "new-name", skills: [] });
        const existingConfig = buildProjectConfig({ name: "existing-name", skills: [] });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.name).toBe("existing-name");
      });

      it("should use existing description when present", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: [],
          description: "New description",
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: [],
          description: "Existing description",
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.description).toBe("Existing description");
      });

      it("should use existing source when present", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: [],
          source: "github:new/source",
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: [],
          source: "github:existing/source",
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.source).toBe("github:existing/source");
      });

      it("should use existing author when present", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: [],
          author: "@new-author",
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: [],
          author: "@existing-author",
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.author).toBe("@existing-author");
      });

      it("should use existing marketplace when present", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: [],
          marketplace: "new-marketplace",
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: [],
          marketplace: "existing-marketplace",
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.marketplace).toBe("existing-marketplace");
      });

      it("should use existing agentsSource when present", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: [],
          agentsSource: "github:new/agents",
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: [],
          agentsSource: "github:existing/agents",
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.agentsSource).toBe("github:existing/agents");
      });

      it("should keep new values when existing fields are absent", () => {
        const newConfig = buildProjectConfig({
          name: "new-name",
          skills: [],
          description: "New desc",
          author: "@new",
        });
        const existingConfig = buildProjectConfig({ name: "", skills: [] });

        const result = mergeConfigs(newConfig, existingConfig);

        // Empty string is falsy, so new values are kept
        expect(result.name).toBe("new-name");
        expect(result.description).toBe("New desc");
        expect(result.author).toBe("@new");
      });
    });

    describe("agents — union by name (no duplicates)", () => {
      it("should union agents from existing and new configs", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          agents: [
            { name: "web-developer", scope: "project" },
            { name: "cli-developer", scope: "project" },
          ],
          skills: [],
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          agents: [
            { name: "web-developer", scope: "project" },
            { name: "api-developer", scope: "project" },
          ],
          skills: [],
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.agents).toEqual([
          { name: "web-developer", scope: "project" },
          { name: "api-developer", scope: "project" },
          { name: "cli-developer", scope: "project" },
        ]);
      });

      it("should keep new agents when existing has empty agents array", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          agents: [{ name: "web-developer", scope: "project" }],
          skills: [],
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          agents: [],
          skills: [],
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.agents).toEqual([{ name: "web-developer", scope: "project" }]);
      });
    });

    describe("skills — merge by ID (new overrides existing, keeps rest)", () => {
      it("should override existing skills with matching new skills", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: buildSkillConfigs(["web-framework-react"], { source: "new-source" }),
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: buildSkillConfigs(["web-framework-react"], { source: "old-source" }),
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.skills).toHaveLength(1);
        expect(result.skills[0]?.source).toBe("new-source");
      });

      it("should preserve existing skills not in new config", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: buildSkillConfigs(["web-framework-react"]),
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: buildSkillConfigs(["web-state-zustand"]),
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.skills).toHaveLength(2);
        const ids = result.skills.map((s) => s.id);
        expect(ids).toContain("web-state-zustand");
        expect(ids).toContain("web-framework-react");
      });

      it("should add new skills that are not in existing config", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: buildSkillConfigs(["web-framework-react", "api-framework-hono"]),
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: buildSkillConfigs(["web-framework-react"]),
        });

        const result = mergeConfigs(newConfig, existingConfig);

        const ids = result.skills.map((s) => s.id);
        expect(ids).toContain("web-framework-react");
        expect(ids).toContain("api-framework-hono");
      });

      it("should keep new skills when existing has empty skills array", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: buildSkillConfigs(["web-framework-react"]),
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: [],
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.skills).toHaveLength(1);
        expect(result.skills[0]?.id).toBe("web-framework-react");
      });
    });

    describe("stack — deep-merged by agent", () => {
      it("should deep merge stack with existing agent configs taking precedence", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: [],
          stack: {
            "web-developer": {
              "web-framework": sa("web-framework-react-new"),
              "web-client-state": sa("web-state-zustand-new"),
            },
          },
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: [],
          stack: {
            "web-developer": {
              "web-framework": sa("web-framework-react-existing"),
              "web-styling": sa("web-styling-scss-existing"),
            },
          },
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.stack).toEqual({
          "web-developer": {
            "web-framework": sa("web-framework-react-existing"),
            "web-styling": sa("web-styling-scss-existing"),
            "web-client-state": sa("web-state-zustand-new"),
          },
        });
      });

      it("should add new agents to stack from new config", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: [],
          stack: {
            "web-developer": { "web-framework": sa("web-framework-vue") },
            "api-developer": { "api-api": sa("api-framework-hono") },
          },
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: [],
          stack: {
            "web-developer": { "web-framework": sa("web-framework-react") },
          },
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.stack).toEqual({
          "web-developer": { "web-framework": sa("web-framework-react") },
          "api-developer": { "api-api": sa("api-framework-hono") },
        });
      });

      it("should use new config stack when existing has no stack", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: [],
          stack: {
            "web-developer": { "web-framework": sa("web-framework-react") },
          },
        });
        const existingConfig = buildProjectConfig({ name: "project", skills: [] });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result.stack).toEqual({
          "web-developer": { "web-framework": sa("web-framework-react") },
        });
      });
    });

    it("should not mutate the input configs", () => {
      const newConfig = buildProjectConfig({
        name: "new-project",
        agents: [{ name: "api-developer", scope: "project" }],
        skills: [],
      });
      const existingConfig = buildProjectConfig({
        name: "existing-project",
        agents: buildAgentConfigs(["web-developer"]),
        skills: [],
        author: "@existing",
      });

      mergeConfigs(newConfig, existingConfig);

      // Original inputs should be unchanged
      expect(newConfig.name).toBe("new-project");
      expect(newConfig.agents).toEqual([{ name: "api-developer", scope: "project" }]);
      expect(newConfig.author).toBeUndefined();
    });
  });
});
