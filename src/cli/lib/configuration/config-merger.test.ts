import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mergeConfigs, mergeWithExistingConfig } from "./config-merger";
import type { ProjectConfig, SkillAssignment, SkillId } from "../../types";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../consts";
import { createTempDir, cleanupTempDir } from "../__tests__/test-fs-utils";
import { writeTestTsConfig } from "../__tests__/helpers/config-io.js";
import { buildSkillConfigs } from "../__tests__/helpers/wizard-simulation.js";
import {
  buildProjectConfig,
  buildAgentConfigs,
  buildSourceConfig,
} from "../__tests__/factories/config-factories.js";
import { expectAgentConfigs } from "../__tests__/assertions/index.js";

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
      expect(result.config).toStrictEqual(newConfig);
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

      it("should keep new source when sourceFlag is provided (new source takes precedence)", async () => {
        await writeFullConfig(
          buildProjectConfig({
            name: "project",
            skills: [],
            source: "github:existing/source",
          }),
        );

        const newConfig = buildProjectConfig({
          name: "project",
          skills: [],
          source: "github:new/source",
        });

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expect(result.config.source).toBe("github:new/source");
      });

      it("should keep existing source when new config has no source", async () => {
        await writeFullConfig(
          buildProjectConfig({
            name: "project",
            skills: [],
            source: "github:existing/source",
          }),
        );

        const newConfig = buildProjectConfig({
          name: "project",
          skills: [],
        });

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expect(result.config.source).toBe("github:existing/source");
      });
    });

    describe("union of agents arrays", () => {
      it("should union agents (existing + new, deduplicated)", async () => {
        await writeFullConfig(
          buildProjectConfig({
            name: "project",
            agents: buildAgentConfigs(["web-developer", "api-developer"]),
            skills: [],
          }),
        );

        const newConfig = buildProjectConfig({
          name: "project",
          agents: buildAgentConfigs(["web-developer", "cli-developer"]), // web-developer is duplicate
          skills: [],
        });

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expectAgentConfigs(
          result.config,
          buildAgentConfigs(["web-developer", "api-developer", "cli-developer"]),
        );
      });

      it("should use new config agents if existing has empty agents", async () => {
        await writeFullConfig(buildProjectConfig({ name: "project", agents: [], skills: [] }));

        const newConfig = buildProjectConfig({ name: "project", skills: [] });

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        // Empty existing agents, so new agents are used
        expectAgentConfigs(result.config, buildAgentConfigs(["web-developer"]));
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
        expect(result.config.stack).toStrictEqual({
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
          agents: buildAgentConfigs(["web-developer", "api-developer"]),
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
        expect(result.config.stack).toStrictEqual({
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
        expect(result.config.stack).toStrictEqual({
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
        agents: buildAgentConfigs(["api-developer"]),
        skills: [],
      });

      await mergeWithExistingConfig(newConfig, { projectDir: tempDir });

      // Original input should be unchanged
      expect(newConfig.name).toBe("new-project");
      expectAgentConfigs(newConfig, buildAgentConfigs(["api-developer"]));
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

        expect(result).toStrictEqual({
          name: "existing-name",
          agents: buildAgentConfigs(["web-developer"]),
          skills: [],
        });
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

        expect(result).toStrictEqual({
          name: "project",
          description: "Existing description",
          agents: buildAgentConfigs(["web-developer"]),
          skills: [],
        });
      });

      it("should use new source when both configs have source (sourceFlag takes precedence)", () => {
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

        expect(result).toStrictEqual({
          name: "project",
          source: "github:new/source",
          agents: buildAgentConfigs(["web-developer"]),
          skills: [],
        });
      });

      it("should use existing source when new config has no source", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: [],
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: [],
          source: "github:existing/source",
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result).toStrictEqual({
          name: "project",
          source: "github:existing/source",
          agents: buildAgentConfigs(["web-developer"]),
          skills: [],
        });
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

        expect(result).toStrictEqual({
          name: "project",
          author: "@existing-author",
          agents: buildAgentConfigs(["web-developer"]),
          skills: [],
        });
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

        expect(result).toStrictEqual({
          name: "project",
          marketplace: "existing-marketplace",
          agents: buildAgentConfigs(["web-developer"]),
          skills: [],
        });
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

        expect(result).toStrictEqual({
          name: "project",
          agentsSource: "github:existing/agents",
          agents: buildAgentConfigs(["web-developer"]),
          skills: [],
        });
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
        expect(result).toStrictEqual({
          name: "new-name",
          description: "New desc",
          author: "@new",
          agents: buildAgentConfigs(["web-developer"]),
          skills: [],
        });
      });
    });

    describe("agents — union by name (no duplicates)", () => {
      it("should union agents from existing and new configs", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          agents: buildAgentConfigs(["web-developer", "cli-developer"]),
          skills: [],
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          agents: buildAgentConfigs(["web-developer", "api-developer"]),
          skills: [],
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result).toStrictEqual({
          name: "project",
          agents: buildAgentConfigs(["web-developer", "api-developer", "cli-developer"]),
          skills: [],
        });
      });

      it("should keep new agents when existing has empty agents array", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          agents: buildAgentConfigs(["web-developer"]),
          skills: [],
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          agents: [],
          skills: [],
        });

        const result = mergeConfigs(newConfig, existingConfig);

        expect(result).toStrictEqual({
          name: "project",
          agents: buildAgentConfigs(["web-developer"]),
          skills: [],
        });
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

        expect(result).toStrictEqual({
          name: "project",
          agents: buildAgentConfigs(["web-developer"]),
          skills: buildSkillConfigs(["web-framework-react"], { source: "new-source" }),
        });
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

        expect(result).toStrictEqual({
          name: "project",
          agents: buildAgentConfigs(["web-developer"]),
          skills: [
            ...buildSkillConfigs(["web-state-zustand"]),
            ...buildSkillConfigs(["web-framework-react"]),
          ],
        });
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

        expect(result).toStrictEqual({
          name: "project",
          agents: buildAgentConfigs(["web-developer"]),
          skills: buildSkillConfigs(["web-framework-react", "api-framework-hono"]),
        });
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

        expect(result).toStrictEqual({
          name: "project",
          agents: buildAgentConfigs(["web-developer"]),
          skills: buildSkillConfigs(["web-framework-react"]),
        });
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

        expect(result).toStrictEqual({
          name: "project",
          agents: buildAgentConfigs(["web-developer"]),
          skills: [],
          stack: {
            "web-developer": {
              "web-framework": sa("web-framework-react-existing"),
              "web-styling": sa("web-styling-scss-existing"),
              "web-client-state": sa("web-state-zustand-new"),
            },
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

        expect(result.stack).toStrictEqual({
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

        expect(result.stack).toStrictEqual({
          "web-developer": { "web-framework": sa("web-framework-react") },
        });
      });
    });

    it("should not mutate the input configs", () => {
      const newConfig = buildProjectConfig({
        name: "new-project",
        agents: buildAgentConfigs(["api-developer"]),
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
      expectAgentConfigs(newConfig, buildAgentConfigs(["api-developer"]));
      expect(newConfig.author).toBeUndefined();
    });

    describe("excluded dual entries", () => {
      it("should preserve both excluded and active entries for the same skill ID", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: [
            ...buildSkillConfigs(["web-framework-react"], { scope: "project", source: "eject" }),
            ...buildSkillConfigs(["web-framework-react"], {
              scope: "global",
              source: "agents-inc",
              excluded: true,
            }),
          ],
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: [],
        });

        const result = mergeConfigs(newConfig, existingConfig);

        // Both entries should be preserved (compound key: id vs id:excluded)
        const reactEntries = result.skills.filter((s) => s.id === "web-framework-react");
        expect(reactEntries).toHaveLength(2);
        expect(reactEntries.find((s) => !s.excluded)).toStrictEqual({
          id: "web-framework-react",
          scope: "project",
          source: "eject",
        });
        expect(reactEntries.find((s) => s.excluded)).toStrictEqual({
          id: "web-framework-react",
          scope: "global",
          source: "agents-inc",
          excluded: true,
        });
      });

      it("should merge correctly when existing config has excluded entries", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: buildSkillConfigs(["web-framework-react"], { scope: "project", source: "eject" }),
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: [
            ...buildSkillConfigs(["web-framework-react"], {
              scope: "global",
              source: "agents-inc",
              excluded: true,
            }),
            ...buildSkillConfigs(["web-testing-vitest"], { scope: "global", source: "agents-inc" }),
          ],
        });

        const result = mergeConfigs(newConfig, existingConfig);

        // Existing excluded entry preserved, new active entry preserved, existing active entry preserved
        const reactEntries = result.skills.filter((s) => s.id === "web-framework-react");
        expect(reactEntries).toHaveLength(2);
        const excludedEntry = reactEntries.find((s) => s.excluded);
        expect(excludedEntry).toStrictEqual({
          id: "web-framework-react",
          scope: "global",
          source: "agents-inc",
          excluded: true,
        });
        const activeEntry = reactEntries.find((s) => !s.excluded);
        expect(activeEntry).toStrictEqual({
          id: "web-framework-react",
          scope: "project",
          source: "eject",
        });
        // Existing vitest entry preserved
        expect(result.skills.find((s) => s.id === "web-testing-vitest")).toStrictEqual({
          id: "web-testing-vitest",
          scope: "global",
          source: "agents-inc",
        });
      });

      it("should handle both configs having excluded entries for the same skill ID", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          skills: buildSkillConfigs(["web-framework-react"], {
            scope: "global",
            source: "agents-inc",
            excluded: true,
          }),
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          skills: buildSkillConfigs(["web-framework-react"], {
            scope: "global",
            source: "agents-inc",
            excluded: true,
          }),
        });

        const result = mergeConfigs(newConfig, existingConfig);

        // Only one excluded entry — compound key deduplicates
        const reactEntries = result.skills.filter((s) => s.id === "web-framework-react");
        expect(reactEntries).toHaveLength(1);
        expect(reactEntries[0].excluded).toBe(true);
      });
    });

    describe("excluded dual entries for agents", () => {
      it("should preserve both excluded and active entries for the same agent name", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          agents: [
            buildAgentConfigs(["api-developer"])[0],
            buildAgentConfigs(["api-developer"], { scope: "global", excluded: true })[0],
          ],
          skills: [],
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          agents: [],
          skills: [],
        });

        const result = mergeConfigs(newConfig, existingConfig);

        // Both entries should be preserved (compound key: name vs name:excluded)
        const apiDevEntries = result.agents.filter((a) => a.name === "api-developer");
        expect(apiDevEntries).toHaveLength(2);
        expect(apiDevEntries.find((a) => !a.excluded)).toStrictEqual({
          name: "api-developer",
          scope: "project",
        });
        expect(apiDevEntries.find((a) => a.excluded)).toStrictEqual({
          name: "api-developer",
          scope: "global",
          excluded: true,
        });
      });

      it("should merge correctly when existing config has excluded agent entries", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          agents: buildAgentConfigs(["api-developer"]),
          skills: [],
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          agents: [
            ...buildAgentConfigs(["api-developer"], { scope: "global", excluded: true }),
            ...buildAgentConfigs(["web-developer"], { scope: "global" }),
          ],
          skills: [],
        });

        const result = mergeConfigs(newConfig, existingConfig);

        // Existing excluded entry preserved, new active entry preserved, existing active entry preserved
        const apiDevEntries = result.agents.filter((a) => a.name === "api-developer");
        expect(apiDevEntries).toHaveLength(2);
        const excludedEntry = apiDevEntries.find((a) => a.excluded);
        expect(excludedEntry).toStrictEqual({
          name: "api-developer",
          scope: "global",
          excluded: true,
        });
        const activeEntry = apiDevEntries.find((a) => !a.excluded);
        expect(activeEntry).toStrictEqual({
          name: "api-developer",
          scope: "project",
        });
        // Existing web-developer entry preserved
        expect(result.agents.find((a) => a.name === "web-developer")).toStrictEqual({
          name: "web-developer",
          scope: "global",
        });
      });

      it("should handle both configs having excluded entries for the same agent name", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          agents: buildAgentConfigs(["api-developer"], { scope: "global", excluded: true }),
          skills: [],
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          agents: buildAgentConfigs(["api-developer"], { scope: "global", excluded: true }),
          skills: [],
        });

        const result = mergeConfigs(newConfig, existingConfig);

        // Only one excluded entry — compound key deduplicates
        const apiDevEntries = result.agents.filter((a) => a.name === "api-developer");
        expect(apiDevEntries).toHaveLength(1);
        expect(apiDevEntries[0].excluded).toBe(true);
      });

      it("should update scope of existing agent when new config has different scope", () => {
        const newConfig = buildProjectConfig({
          name: "project",
          agents: buildAgentConfigs(["api-developer"], { scope: "global" }),
          skills: [],
        });
        const existingConfig = buildProjectConfig({
          name: "project",
          agents: buildAgentConfigs(["api-developer"]),
          skills: [],
        });

        const result = mergeConfigs(newConfig, existingConfig);

        const apiDevEntries = result.agents.filter((a) => a.name === "api-developer");
        expect(apiDevEntries).toHaveLength(1);
        expect(apiDevEntries[0]).toStrictEqual({
          name: "api-developer",
          scope: "global",
        });
      });
    });
  });
});
