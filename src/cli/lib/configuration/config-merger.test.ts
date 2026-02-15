import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify as stringifyYaml } from "yaml";
import { mergeWithExistingConfig } from "./config-merger";
import type { ProjectConfig } from "../../types";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../consts";

describe("config-merger", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-config-merger-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("mergeWithExistingConfig", () => {
    it("should return new config unchanged when no existing config exists", async () => {
      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: ["web-developer"],
        skills: [],
        description: "A new project",
      };

      const result = await mergeWithExistingConfig(newConfig, {
        projectDir: tempDir,
      });

      expect(result.merged).toBe(false);
      expect(result.config.name).toBe("new-project");
      expect(result.config.agents).toEqual(["web-developer"]);
      expect(result.config.description).toBe("A new project");
      expect(result.existingConfigPath).toBeUndefined();
    });

    it("should inherit author from simple project config when no full config exists", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        stringifyYaml({ source: "github:my-org/skills", author: "@vince" }),
      );

      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: ["web-developer"],
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

    it("should inherit agents_source from existing config", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        stringifyYaml({
          source: "github:my-org/skills",
          agents_source: "github:my-org/agents",
        }),
      );

      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: ["web-developer"],
        skills: [],
      };

      const result = await mergeWithExistingConfig(newConfig, {
        projectDir: tempDir,
      });

      expect(result.merged).toBe(true);
      expect(result.config.agents_source).toBe("github:my-org/agents");
    });

    describe("merge precedence rules", () => {
      async function writeFullConfig(config: ProjectConfig): Promise<void> {
        // Full config is at .claude-src/config.yaml with name and agents (required fields)
        const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
        await mkdir(configDir, { recursive: true });
        await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_YAML), stringifyYaml(config));
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
            agents: ["web-developer"],
            skills: [],
            [field]: existingValue,
          });

          const newConfig: ProjectConfig = {
            name: "project",
            agents: ["web-developer"],
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
        const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
        await mkdir(configDir, { recursive: true });
        await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_YAML), stringifyYaml(config));
      }

      it("should union agents (existing + new, deduplicated)", async () => {
        await writeFullConfig({
          name: "project",
          agents: ["web-developer", "api-developer"],
          skills: [],
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: ["web-developer", "cli-developer"], // web-developer is duplicate
          skills: [],
        };

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expect(result.config.agents).toEqual(["web-developer", "api-developer", "cli-developer"]);
      });

      it("should use new config agents if existing has empty agents", async () => {
        await writeFullConfig({
          name: "project",
          agents: [],
          skills: [],
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: ["web-developer"],
          skills: [],
        };

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        // Empty existing agents, so new agents are used
        expect(result.config.agents).toEqual(["web-developer"]);
      });
    });

    describe("deep merge of stack", () => {
      async function writeFullConfig(config: ProjectConfig): Promise<void> {
        const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
        await mkdir(configDir, { recursive: true });
        await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_YAML), stringifyYaml(config));
      }

      it("should deep merge stack with existing agent configs taking precedence", async () => {
        await writeFullConfig({
          name: "project",
          agents: ["web-developer"],
          skills: [],
          stack: {
            "web-developer": {
              framework: "web-framework-react-existing",
              styling: "web-styling-scss-existing",
            },
          },
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: ["web-developer"],
          skills: [],
          stack: {
            "web-developer": {
              framework: "web-framework-react-new",
              "client-state": "web-state-zustand-new",
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
            framework: "web-framework-react-existing",
            styling: "web-styling-scss-existing",
            "client-state": "web-state-zustand-new",
          },
        });
      });

      it("should add new agents to stack from new config", async () => {
        await writeFullConfig({
          name: "project",
          agents: ["web-developer"],
          skills: [],
          stack: {
            "web-developer": {
              framework: "web-framework-react",
            },
          },
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: ["web-developer", "api-developer"],
          skills: [],
          stack: {
            "web-developer": {
              framework: "web-framework-vue",
            },
            "api-developer": {
              api: "api-framework-hono",
            },
          },
        };

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expect(result.config.stack).toEqual({
          "web-developer": {
            framework: "web-framework-react", // existing takes precedence
          },
          "api-developer": {
            api: "api-framework-hono", // new agent added
          },
        });
      });

      it("should use new config stack if existing has no stack", async () => {
        await writeFullConfig({
          name: "project",
          agents: ["web-developer"],
          skills: [],
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: ["web-developer"],
          skills: [],
          stack: {
            "web-developer": {
              framework: "web-framework-react",
            },
          },
        };

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expect(result.config.stack).toEqual({
          "web-developer": {
            framework: "web-framework-react",
          },
        });
      });
    });

    it("should not mutate the input config", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        stringifyYaml({
          name: "existing",
          agents: ["web-developer"],
          skills: [],
          author: "@existing",
        }),
      );

      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: ["api-developer"],
        skills: [],
      };

      await mergeWithExistingConfig(newConfig, { projectDir: tempDir });

      // Original input should be unchanged
      expect(newConfig.name).toBe("new-project");
      expect(newConfig.agents).toEqual(["api-developer"]);
      expect(newConfig.author).toBeUndefined();
    });

    it("should return existingConfigPath when merged", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_YAML),
        stringifyYaml({
          name: "existing",
          agents: ["web-developer"],
        }),
      );

      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: ["web-developer"],
        skills: [],
      };

      const result = await mergeWithExistingConfig(newConfig, {
        projectDir: tempDir,
      });

      expect(result.merged).toBe(true);
      expect(result.existingConfigPath).toBeDefined();
      expect(result.existingConfigPath).toContain(
        `${CLAUDE_SRC_DIR}/${STANDARD_FILES.CONFIG_YAML}`,
      );
    });
  });
});
