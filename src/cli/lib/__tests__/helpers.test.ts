import { describe, it, expect, afterEach } from "vitest";
import {
  createMockSkill,
  createMockMatrix,
  createMockAgent,
  createTestDirs,
  cleanupTestDirs,
  fileExists,
  directoryExists,
  writeTestSkill,
  writeTestAgent,
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
      // Using normalized skill ID format
      const skill = createMockSkill("web-framework-react", "web/framework");

      expect(skill.id).toBe("web-framework-react");
      expect(skill.category).toBe("web/framework");
      expect(skill.author).toBe("@test");
    });

    it("allows overrides", () => {
      const skill = createMockSkill("web-framework-react", "web-framework", {
        author: "@custom",
        tags: ["popular"],
      });

      expect(skill.author).toBe("@custom");
      expect(skill.tags).toEqual(["popular"]);
    });
  });

  describe("createMockMatrix", () => {
    it("creates a valid matrix", () => {
      const skill = createMockSkill("web-framework-react", "web-framework");
      const matrix = createMockMatrix({ "web-framework-react": skill });

      expect(matrix.version).toBe("1.0.0");
      expect(matrix.skills["web-framework-react"]).toBe(skill);
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
});
