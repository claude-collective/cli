import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify as stringifyYaml } from "yaml";
import { mergeWithExistingConfig } from "./config-merger";
import type { ProjectConfig } from "../../types";

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
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        stringifyYaml({ source: "github:my-org/skills", author: "@vince" }),
      );

      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: ["web-developer"],
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
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        stringifyYaml({
          source: "github:my-org/skills",
          agents_source: "github:my-org/agents",
        }),
      );

      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: ["web-developer"],
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
        const configDir = path.join(tempDir, ".claude-src");
        await mkdir(configDir, { recursive: true });
        await writeFile(path.join(configDir, "config.yaml"), stringifyYaml(config));
      }

      it("should keep existing name over new name", async () => {
        await writeFullConfig({
          name: "existing-project",
          agents: ["web-developer"],
        });

        const newConfig: ProjectConfig = {
          name: "new-project",
          agents: ["web-developer"],
        };

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expect(result.config.name).toBe("existing-project");
      });

      it("should keep existing description over new description", async () => {
        await writeFullConfig({
          name: "project",
          agents: ["web-developer"],
          description: "Existing description",
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: ["web-developer"],
          description: "New description",
        };

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expect(result.config.description).toBe("Existing description");
      });

      it("should keep existing source over new source", async () => {
        await writeFullConfig({
          name: "project",
          agents: ["web-developer"],
          source: "github:existing/source",
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: ["web-developer"],
          source: "github:new/source",
        };

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expect(result.config.source).toBe("github:existing/source");
      });

      it("should keep existing author over new author", async () => {
        await writeFullConfig({
          name: "project",
          agents: ["web-developer"],
          author: "@existing-author",
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: ["web-developer"],
          author: "@new-author",
        };

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expect(result.config.author).toBe("@existing-author");
      });

      it("should keep existing marketplace over new marketplace", async () => {
        await writeFullConfig({
          name: "project",
          agents: ["web-developer"],
          marketplace: "existing-marketplace",
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: ["web-developer"],
          marketplace: "new-marketplace",
        };

        const result = await mergeWithExistingConfig(newConfig, {
          projectDir: tempDir,
        });

        expect(result.merged).toBe(true);
        expect(result.config.marketplace).toBe("existing-marketplace");
      });
    });

    describe("union of agents arrays", () => {
      async function writeFullConfig(config: ProjectConfig): Promise<void> {
        const configDir = path.join(tempDir, ".claude-src");
        await mkdir(configDir, { recursive: true });
        await writeFile(path.join(configDir, "config.yaml"), stringifyYaml(config));
      }

      it("should union agents (existing + new, deduplicated)", async () => {
        await writeFullConfig({
          name: "project",
          agents: ["web-developer", "api-developer"],
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: ["web-developer", "cli-developer"], // web-developer is duplicate
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
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: ["web-developer"],
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
        const configDir = path.join(tempDir, ".claude-src");
        await mkdir(configDir, { recursive: true });
        await writeFile(path.join(configDir, "config.yaml"), stringifyYaml(config));
      }

      it("should deep merge stack with existing agent configs taking precedence", async () => {
        await writeFullConfig({
          name: "project",
          agents: ["web-developer"],
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
          stack: {
            "web-developer": {
              framework: "web-framework-react",
            },
          },
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: ["web-developer", "api-developer"],
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
        });

        const newConfig: ProjectConfig = {
          name: "project",
          agents: ["web-developer"],
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
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        stringifyYaml({
          name: "existing",
          agents: ["web-developer"],
          author: "@existing",
        }),
      );

      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: ["api-developer"],
      };

      await mergeWithExistingConfig(newConfig, { projectDir: tempDir });

      // Original input should be unchanged
      expect(newConfig.name).toBe("new-project");
      expect(newConfig.agents).toEqual(["api-developer"]);
      expect(newConfig.author).toBeUndefined();
    });

    it("should return existingConfigPath when merged", async () => {
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        stringifyYaml({
          name: "existing",
          agents: ["web-developer"],
        }),
      );

      const newConfig: ProjectConfig = {
        name: "new-project",
        agents: ["web-developer"],
      };

      const result = await mergeWithExistingConfig(newConfig, {
        projectDir: tempDir,
      });

      expect(result.merged).toBe(true);
      expect(result.existingConfigPath).toBeDefined();
      expect(result.existingConfigPath).toContain(".claude-src/config.yaml");
    });
  });
});
