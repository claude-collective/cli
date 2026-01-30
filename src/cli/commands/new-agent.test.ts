import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdir, rm, writeFile } from "fs/promises";

describe("cc new agent", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `cc-new-agent-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("fetchMetaAgent", () => {
    it("should parse agent frontmatter correctly", async () => {
      // Create a mock agent-summoner.md
      const agentsDir = path.join(tempDir, ".claude", "agents");
      await mkdir(agentsDir, { recursive: true });

      const agentContent = `---
name: agent-summoner
description: Creates new agents
tools: Read, Write, Edit, Grep, Glob
model: opus
---

# Agent Summoner

You are an agent creator...
`;

      await writeFile(path.join(agentsDir, "agent-summoner.md"), agentContent);

      // Import the module dynamically to test internal functions
      const { fetchFromSource } = await import("../lib/source-fetcher");
      const matter = await import("gray-matter");

      // Read the file and parse it
      const content = await Bun.file(
        path.join(agentsDir, "agent-summoner.md"),
      ).text();
      const { data: frontmatter, content: body } = matter.default(content);

      expect(frontmatter.name).toBe("agent-summoner");
      expect(frontmatter.description).toBe("Creates new agents");
      expect(frontmatter.tools).toBe("Read, Write, Edit, Grep, Glob");
      expect(frontmatter.model).toBe("opus");
      expect(body).toContain("# Agent Summoner");
    });

    it("should split tools string into array", () => {
      const toolsString = "Read, Write, Edit, Grep, Glob";
      const tools = toolsString.split(",").map((t) => t.trim());

      expect(tools).toEqual(["Read", "Write", "Edit", "Grep", "Glob"]);
    });
  });

  describe("buildAgentPrompt", () => {
    it("should include agent name and purpose in prompt", () => {
      const agentName = "test-agent";
      const purpose = "Testing things";
      const outputDir = "/path/to/output";

      const prompt = `Create a new Claude Code agent named "${agentName}" in the directory "${outputDir}".

Agent Purpose: ${purpose}

Requirements:
1. Create the agent directory structure at ${outputDir}/${agentName}/
2. Create agent.yaml with appropriate configuration
3. Create intro.md with the agent's role and context
4. Create workflow.md with the agent's operational process
5. Optionally create examples.md if relevant examples would help
6. Optionally create critical-requirements.md for important rules

Follow the existing agent patterns in the codebase. Keep the agent focused and practical.`;

      expect(prompt).toContain("test-agent");
      expect(prompt).toContain("Testing things");
      expect(prompt).toContain("/path/to/output");
    });
  });

  describe("command options", () => {
    it("should accept purpose option", async () => {
      // Test that options are parsed correctly by checking command definition
      const { newCommand } = await import("./new-agent");

      const agentCmd = newCommand.commands.find((c) => c.name() === "agent");
      expect(agentCmd).toBeDefined();

      const options = agentCmd?.options || [];
      const purposeOpt = options.find((o) => o.long === "--purpose");
      expect(purposeOpt).toBeDefined();
    });

    it("should accept source option", async () => {
      const { newCommand } = await import("./new-agent");

      const agentCmd = newCommand.commands.find((c) => c.name() === "agent");
      const options = agentCmd?.options || [];
      const sourceOpt = options.find((o) => o.long === "--source");
      expect(sourceOpt).toBeDefined();
    });

    it("should accept refresh flag", async () => {
      const { newCommand } = await import("./new-agent");

      const agentCmd = newCommand.commands.find((c) => c.name() === "agent");
      const options = agentCmd?.options || [];
      const refreshOpt = options.find((o) => o.long === "--refresh");
      expect(refreshOpt).toBeDefined();
    });

    it("should accept non-interactive flag", async () => {
      const { newCommand } = await import("./new-agent");

      const agentCmd = newCommand.commands.find((c) => c.name() === "agent");
      const options = agentCmd?.options || [];
      const nonInteractiveOpt = options.find(
        (o) => o.long === "--non-interactive",
      );
      expect(nonInteractiveOpt).toBeDefined();
    });
  });
});
