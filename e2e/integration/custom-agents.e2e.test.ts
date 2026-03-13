import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  createMinimalProject,
  COMPILE_ENV,
  ensureBinaryExists,
  fileExists,
  listFiles,
  readTestFile,
  runCLI,
  writeProjectConfig,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { verifyAgentCompiled } from "../helpers/plugin-assertions.js";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import { renderAgentYaml } from "../../src/cli/lib/__tests__/content-generators.js";
import type { SkillId } from "../../src/cli/types/index.js";

const E2E_COMPILE_SKILL = "web-testing-e2e-compile" as SkillId;

/**
 * Writes a custom agent structure under .claude-src/agents/<agentName>/
 * with metadata.yaml, intro.md, and optionally workflow.md.
 */
async function createCustomAgent(
  projectDir: string,
  agentName: string,
  options: {
    introContent: string;
    workflowContent?: string;
    metadataYaml?: string;
    description?: string;
    tools?: string[];
    domain?: string;
  },
): Promise<string> {
  const agentDir = path.join(projectDir, CLAUDE_SRC_DIR, "agents", agentName);
  await mkdir(agentDir, { recursive: true });

  const metadataYaml =
    options.metadataYaml ??
    renderAgentYaml(agentName, options.description, {
      title: `${agentName} Agent`,
      tools: options.tools ?? ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
    }) + (options.domain ? `\ndomain: ${options.domain}` : "");

  await writeFile(path.join(agentDir, STANDARD_FILES.AGENT_METADATA_YAML), metadataYaml);
  await writeFile(path.join(agentDir, STANDARD_FILES.INTRO_MD), options.introContent);

  if (options.workflowContent !== undefined) {
    await writeFile(path.join(agentDir, STANDARD_FILES.WORKFLOW_MD), options.workflowContent);
  }

  return agentDir;
}

describe("custom sub-agents", () => {
  let tempDir: string | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined;
    }
  });

  describe("custom agent compilation", () => {
    it("should compile a custom agent to the output directory", async () => {
      tempDir = await createTempDir();
      const { projectDir } = await createMinimalProject(tempDir);

      // Create a custom agent structure
      await createCustomAgent(projectDir, "my-custom-agent", {
        introContent: "E2E-CUSTOM-AGENT-INTRO",
        workflowContent: "E2E-CUSTOM-AGENT-WORKFLOW",
        description: "A custom E2E test agent",
        domain: "web",
      });

      // Update config to reference the custom agent
      await writeProjectConfig(projectDir, {
        name: "e2e-custom-agent-test",
        skills: [{ id: E2E_COMPILE_SKILL, scope: "project", source: "local" }],
        agents: [
          { name: "web-developer", scope: "project" },
          { name: "my-custom-agent", scope: "project" },
        ],
      });

      const { exitCode } = await runCLI(["compile"], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Verify the custom agent was compiled with valid frontmatter
      expect(await verifyAgentCompiled(projectDir, "my-custom-agent")).toBe(true);

      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      const content = await readTestFile(path.join(agentsDir, "my-custom-agent.md"));

      // Custom content from intro.md and workflow.md
      expect(content).toContain("E2E-CUSTOM-AGENT-INTRO");
      expect(content).toContain("E2E-CUSTOM-AGENT-WORKFLOW");
    });

    it("should override a built-in agent with a custom agent of the same name", async () => {
      tempDir = await createTempDir();
      const { projectDir } = await createMinimalProject(tempDir);

      // Create a custom agent that overrides the built-in web-developer
      await createCustomAgent(projectDir, "web-developer", {
        introContent: "E2E-OVERRIDE-INTRO",
        workflowContent: "E2E-OVERRIDE-WORKFLOW",
        description: "Custom override of web-developer",
        domain: "web",
      });

      const { exitCode } = await runCLI(["compile"], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      const webDevPath = path.join(agentsDir, "web-developer.md");
      expect(await fileExists(webDevPath)).toBe(true);

      const content = await readTestFile(webDevPath);

      // Should contain the custom override content, not the built-in intro
      expect(content).toContain("E2E-OVERRIDE-INTRO");
      expect(content).toContain("E2E-OVERRIDE-WORKFLOW");
    });

    it("should compile custom agent alongside built-in agents without cross-contamination", async () => {
      tempDir = await createTempDir();
      const { projectDir } = await createMinimalProject(tempDir);

      // Create a custom agent
      await createCustomAgent(projectDir, "my-custom-agent", {
        introContent: "E2E-CUSTOM-ONLY-CONTENT",
        workflowContent: "E2E-CUSTOM-ONLY-WORKFLOW",
        description: "A custom agent for coexistence test",
        domain: "web",
      });

      // Config includes both built-in and custom agents
      await writeProjectConfig(projectDir, {
        name: "e2e-coexistence-test",
        skills: [{ id: E2E_COMPILE_SKILL, scope: "project", source: "local" }],
        agents: [
          { name: "web-developer", scope: "project" },
          { name: "my-custom-agent", scope: "project" },
        ],
      });

      const { exitCode } = await runCLI(["compile"], projectDir, {
        env: COMPILE_ENV,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");

      // Both agent files should exist
      const outputFiles = await listFiles(agentsDir);
      expect(outputFiles).toContain("web-developer.md");
      expect(outputFiles).toContain("my-custom-agent.md");

      const webDevContent = await readTestFile(path.join(agentsDir, "web-developer.md"));
      const customContent = await readTestFile(path.join(agentsDir, "my-custom-agent.md"));

      // They should have different content (no cross-contamination)
      expect(webDevContent).not.toBe(customContent);

      // Custom agent content should only appear in the custom agent file
      expect(customContent).toContain("E2E-CUSTOM-ONLY-CONTENT");
      expect(webDevContent).not.toContain("E2E-CUSTOM-ONLY-CONTENT");

      // Both should have valid frontmatter
      expect(webDevContent).toMatch(/^---\n/);
      expect(customContent).toMatch(/^---\n/);

      // Each should reference its own name in frontmatter
      expect(webDevContent).toContain("name: web-developer");
      expect(customContent).toContain("name: my-custom-agent");
    });
  });

  describe("edge cases", () => {
    it("should fail gracefully when custom agent is missing workflow.md", async () => {
      tempDir = await createTempDir();
      const { projectDir } = await createMinimalProject(tempDir);

      // Create a custom agent without workflow.md
      await createCustomAgent(projectDir, "incomplete-agent", {
        introContent: "E2E-INCOMPLETE-AGENT-INTRO",
        // workflow.md intentionally omitted (undefined means skip creation)
        description: "An agent with missing workflow.md",
        domain: "web",
      });

      await writeProjectConfig(projectDir, {
        name: "e2e-missing-workflow-test",
        skills: [{ id: E2E_COMPILE_SKILL, scope: "project", source: "local" }],
        agents: [{ name: "incomplete-agent", scope: "project" }],
      });

      const { exitCode, combined } = await runCLI(["compile"], projectDir, {
        env: COMPILE_ENV,
      });

      // Compile should fail or warn about the missing workflow.md
      // readAgentFiles() calls readFile() (not readFileOptional) for workflow.md,
      // so a missing file should cause a compile failure for that agent
      expect(combined).toMatch(/failed|error|workflow/i);
    });

    it("should report useful error when custom agent has empty metadata.yaml", async () => {
      tempDir = await createTempDir();
      const { projectDir } = await createMinimalProject(tempDir);

      const agentDir = path.join(projectDir, CLAUDE_SRC_DIR, "agents", "broken-agent");
      await mkdir(agentDir, { recursive: true });

      // Write an empty metadata.yaml (missing required fields)
      await writeFile(path.join(agentDir, STANDARD_FILES.AGENT_METADATA_YAML), "");
      await writeFile(path.join(agentDir, STANDARD_FILES.INTRO_MD), "Some intro");
      await writeFile(path.join(agentDir, STANDARD_FILES.WORKFLOW_MD), "Some workflow");

      await writeProjectConfig(projectDir, {
        name: "e2e-empty-metadata-test",
        skills: [{ id: E2E_COMPILE_SKILL, scope: "project", source: "local" }],
        agents: [{ name: "broken-agent", scope: "project" }],
      });

      const { combined } = await runCLI(["compile"], projectDir, {
        env: COMPILE_ENV,
      });

      // loadProjectAgents warns about invalid metadata.yaml and skips the agent.
      // The compile should either warn about the skipped agent or report it's not found.
      expect(combined).toMatch(/invalid|skip|not found/i);
    });
  });
});
