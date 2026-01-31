import { describe, it, expect, afterEach } from "vitest";
import {
  createMockSkill,
  createMockMatrix,
  createMockStackConfig,
  createMockAgent,
  createTestDirs,
  cleanupTestDirs,
  fileExists,
  directoryExists,
  writeTestSkill,
  writeTestAgent,
  createSkillContent,
  createMetadataContent,
} from "./helpers";
import type { TestDirs } from "./helpers";

describe("test helpers", () => {
  let testDirs: TestDirs | null = null;

  afterEach(async () => {
    if (testDirs) {
      await cleanupTestDirs(testDirs);
      testDirs = null;
    }
  });

  describe("createMockSkill", () => {
    it("creates a valid skill with defaults", () => {
      const skill = createMockSkill("react (@vince)", "frontend/framework");

      expect(skill.id).toBe("react (@vince)");
      expect(skill.name).toBe("react");
      expect(skill.category).toBe("frontend/framework");
      expect(skill.author).toBe("@test");
    });

    it("allows overrides", () => {
      const skill = createMockSkill("react (@vince)", "frontend", {
        author: "@custom",
        tags: ["popular"],
      });

      expect(skill.author).toBe("@custom");
      expect(skill.tags).toEqual(["popular"]);
    });
  });

  describe("createMockMatrix", () => {
    it("creates a valid matrix", () => {
      const skill = createMockSkill("react (@vince)", "frontend");
      const matrix = createMockMatrix({ "react (@vince)": skill });

      expect(matrix.version).toBe("1.0.0");
      expect(matrix.skills["react (@vince)"]).toBe(skill);
    });
  });

  describe("createMockStackConfig", () => {
    it("creates a valid stack config", () => {
      const config = createMockStackConfig("test-stack", ["react", "zustand"]);

      expect(config.name).toBe("test-stack");
      expect(config.skills).toEqual([{ id: "react" }, { id: "zustand" }]);
      expect(config.agents).toContain("web-developer");
    });
  });

  describe("createMockAgent", () => {
    it("creates a valid agent definition", () => {
      const agent = createMockAgent("test-agent");

      expect(agent.title).toBe("test-agent");
      expect(agent.model).toBe("opus");
    });
  });

  describe("file system helpers", () => {
    it("createTestDirs creates required directories", async () => {
      testDirs = await createTestDirs();

      expect(await directoryExists(testDirs.skillsDir)).toBe(true);
      expect(await directoryExists(testDirs.agentsDir)).toBe(true);
    });

    it("writeTestSkill creates skill files", async () => {
      testDirs = await createTestDirs();
      const skillDir = await writeTestSkill(testDirs.skillsDir, "test-skill");

      expect(await fileExists(`${skillDir}/SKILL.md`)).toBe(true);
      expect(await fileExists(`${skillDir}/metadata.yaml`)).toBe(true);
    });

    it("writeTestAgent creates agent files", async () => {
      testDirs = await createTestDirs();
      const agentDir = await writeTestAgent(testDirs.agentsDir, "test-agent");

      expect(await fileExists(`${agentDir}/agent.yaml`)).toBe(true);
    });
  });

  describe("content generators", () => {
    it("createSkillContent generates valid frontmatter", () => {
      const content = createSkillContent("my-skill", "My description");

      expect(content).toContain("name: my-skill");
      expect(content).toContain("description: My description");
    });

    it("createMetadataContent generates valid yaml", () => {
      const content = createMetadataContent("@custom");

      expect(content).toContain("author: @custom");
    });
  });
});
