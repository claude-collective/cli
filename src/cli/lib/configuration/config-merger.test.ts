import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mergeWithExistingConfig } from "./config-merger";
import type { ProjectConfig, SkillAssignment, SkillId } from "../../types";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../consts";
import { createTempDir, cleanupTempDir, writeTestTsConfig } from "../__tests__/helpers";

describe("config-merger", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("cc-config-merger-test-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("mergeWithExistingConfig", () => {
    it("should return new config unchanged when no existing config exists", async () => {
      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: [{ name: "web-developer", scope: "project" }],
        skills: [],
        description: "A new project",
      };

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
      await writeTestTsConfig(tempDir, {
        source: "github:my-org/skills",
        author: "@vince",
      });

      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: [{ name: "web-developer", scope: "project" }],
        skills: [],
      };

      const result = await mergeWithExistingConfig(newConfig, {
        projectDir: tempDir,
      });

      // loadFullProjectConfig finds the config, so merged is true
      expect(result.merged).toBe(true);
      // Author should be inherited from existing
      expect(result.config.author).toBe("@vince");
    });

    it("should inherit agentsSource from existing config", async () => {
      await writeTestTsConfig(tempDir, {
        source: "github:my-org/skills",
        agentsSource: "github:my-org/agents",
      });

      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: [{ name: "web-developer", scope: "project" }],
        skills: [],
      };

      const result = await mergeWithExistingConfig(newConfig, {
        projectDir: tempDir,
      });

      expect(result.merged).toBe(true);
      expect(result.config.agentsSource).toBe("github:my-org/agents");
    });

    describe("merge precedence rules", () => {
      async function writeFullConfig(config: ProjectConfig): Promise<void> {
        await writeTestTsConfig(tempDir, config as unknown as Record<string, unknown>);
      }

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
          await writeFullConfig({
            name: "project",
            agents: [{ name: "web-developer", scope: "project" }],
            skills: [],
            [field]: existingValue,
          });

          const newConfig: ProjectConfig = {
            name: "project",
            agents: [{ name: "web-developer", scope: "project" }],
            skills: [],
            [field]: newValue,
          };

          const result = await mergeWithExistingConfig(newConfig, {
            projectDir: tempDir,
          });

          expect(result.merged).toBe(true);
          expect(result.config[field]).toBe(existingValue);
        },
      );
    });

    describe("union of agents arrays", () => {
      async function writeFullConfig(config: ProjectConfig): Promise<void> {
        await writeTestTsConfig(tempDir, config as unknown as Record<string, unknown>);
      }

      it("should union agents (existing + new, deduplicated)", async () => {
        await writeFullConfig({
          name: "project",
          agents: [
            { name: "web-developer", scope: "project" },
            { name: "api-developer", scope: "project" },
          ],
          skills: [],
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: [
            { name: "web-developer", scope: "project" },
            { name: "cli-developer", scope: "project" },
          ], // web-developer is duplicate
          skills: [],
        };

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
        await writeFullConfig({
          name: "project",
          agents: [],
          skills: [],
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: [{ name: "web-developer", scope: "project" }],
          skills: [],
        };

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        // Empty existing agents, so new agents are used
        expect(result.config.agents).toEqual([{ name: "web-developer", scope: "project" }]);
      });
    });

    describe("deep merge of stack", () => {
      async function writeFullConfig(config: ProjectConfig): Promise<void> {
        await writeTestTsConfig(tempDir, config as unknown as Record<string, unknown>);
      }

      /** Shorthand: creates a SkillAssignment[] from an id */
      function sa(id: string): SkillAssignment[] {
        return [{ id: id as SkillId, preloaded: false }];
      }

      it("should deep merge stack with existing agent configs taking precedence", async () => {
        await writeFullConfig({
          name: "project",
          agents: [{ name: "web-developer", scope: "project" }],
          skills: [],
          stack: {
            "web-developer": {
              "web-framework": sa("web-framework-react-existing"),
              "web-styling": sa("web-styling-scss-existing"),
            },
          },
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: [{ name: "web-developer", scope: "project" }],
          skills: [],
          stack: {
            "web-developer": {
              "web-framework": sa("web-framework-react-new"),
              "web-client-state": sa("web-state-zustand-new"),
            },
          },
        };

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
        await writeFullConfig({
          name: "project",
          agents: [{ name: "web-developer", scope: "project" }],
          skills: [],
          stack: {
            "web-developer": {
              "web-framework": sa("web-framework-react"),
            },
          },
        });

        const newConfig: ProjectConfig = {
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
        };

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
        await writeFullConfig({
          name: "project",
          agents: [{ name: "web-developer", scope: "project" }],
          skills: [],
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: [{ name: "web-developer", scope: "project" }],
          skills: [],
          stack: {
            "web-developer": {
              "web-framework": sa("web-framework-react"),
            },
          },
        };

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
      await writeTestTsConfig(tempDir, {
        name: "existing",
        agents: [{ name: "web-developer", scope: "project" }],
        skills: [],
        author: "@existing",
      });

      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: [{ name: "api-developer", scope: "project" }],
        skills: [],
      };

      await mergeWithExistingConfig(newConfig, { projectDir: tempDir });

      // Original input should be unchanged
      expect(newConfig.name).toBe("new-project");
      expect(newConfig.agents).toEqual([{ name: "api-developer", scope: "project" }]);
      expect(newConfig.author).toBeUndefined();
    });

    it("should return existingConfigPath when merged", async () => {
      await writeTestTsConfig(tempDir, {
        name: "existing",
        agents: [{ name: "web-developer", scope: "project" }],
      });

      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: [{ name: "web-developer", scope: "project" }],
        skills: [],
      };

      const result = await mergeWithExistingConfig(newConfig, {
        projectDir: tempDir,
      });

      expect(result.merged).toBe(true);
      expect(result.existingConfigPath).toBeDefined();
      expect(result.existingConfigPath).toContain(`${CLAUDE_SRC_DIR}/${STANDARD_FILES.CONFIG_TS}`);
    });
  });
});
