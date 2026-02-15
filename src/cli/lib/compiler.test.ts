import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import { readFile as fsReadFile, stat } from "fs/promises";
import type { AgentConfig, Skill } from "../types";
import {
  createMockAgentConfig,
  createMockSkillEntry,
  createTempDir,
  cleanupTempDir,
} from "./__tests__/helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fixture root: test/fixtures/ at repo root
const FIXTURES_ROOT = path.resolve(__dirname, "../../..", "test/fixtures");

// Mock resolver — returns a fixture CLAUDE.md path based on projectRoot
vi.mock("./resolver", () => ({
  resolveClaudeMd: vi
    .fn()
    .mockImplementation(async (projectRoot: string) =>
      path.join(projectRoot, "src/stacks/default/CLAUDE.md"),
    ),
}));

// Mock output-validator — compiler tests focus on compilation, not validation
vi.mock("./output-validator", () => ({
  validateCompiledAgent: vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
  printOutputValidationResult: vi.fn(),
}));

// Mock logger (suppress output during tests)
vi.mock("../utils/logger", () => ({
  verbose: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
  setVerbose: vi.fn(),
}));

import {
  compileAllAgents,
  compileAllSkills,
  copyClaudeMdToOutput,
  compileAllCommands,
  createLiquidEngine,
  removeCompiledOutputDirs,
  sanitizeLiquidSyntax,
  sanitizeCompiledAgentData,
} from "./compiler";
import { validateCompiledAgent } from "./output-validator";
import { warn } from "../utils/logger";
import type { CompiledAgentData } from "../types";

/**
 * Copies fixture files into a temp directory matching the project layout
 * that the compiler expects. Uses real file I/O instead of mocking fs.
 */
async function createProjectFromFixtures(): Promise<string> {
  const tempDir = await createTempDir("compiler-test-");
  const { writeFile: fsWrite, mkdir } = await import("fs/promises");

  // Agent fixtures
  const WEB_DEV_FILES = [
    "intro.md",
    "workflow.md",
    "examples.md",
    "critical-requirements.md",
    "critical-reminders.md",
    "output-format.md",
  ] as const;
  const webDevDir = path.join(tempDir, "src/agents/web-developer");
  await mkdir(webDevDir, { recursive: true });
  for (const file of WEB_DEV_FILES) {
    const content = await fsReadFile(
      path.join(FIXTURES_ROOT, "agents/web-developer", file),
      "utf-8",
    );
    await fsWrite(path.join(webDevDir, file), content);
  }

  const apiDevDir = path.join(tempDir, "src/agents/api-developer");
  await mkdir(apiDevDir, { recursive: true });
  for (const file of ["intro.md", "workflow.md"] as const) {
    const content = await fsReadFile(
      path.join(FIXTURES_ROOT, "agents/api-developer", file),
      "utf-8",
    );
    await fsWrite(path.join(apiDevDir, file), content);
  }

  // Template
  const templatesDir = path.join(tempDir, "src/agents/_templates");
  await mkdir(templatesDir, { recursive: true });
  const templateContent = await fsReadFile(
    path.join(FIXTURES_ROOT, "agents/_templates/agent.liquid"),
    "utf-8",
  );
  await fsWrite(path.join(templatesDir, "agent.liquid"), templateContent);

  // Skills (folder-based)
  const reactSkillDir = path.join(tempDir, "skills/web-framework-react");
  await mkdir(reactSkillDir, { recursive: true });
  const skillContent = await fsReadFile(
    path.join(FIXTURES_ROOT, "skills/web-framework-react/SKILL.md"),
    "utf-8",
  );
  await fsWrite(path.join(reactSkillDir, "SKILL.md"), skillContent);

  // Skills (single-file)
  const skillsDir = path.join(tempDir, "skills");
  const vitestContent = await fsReadFile(
    path.join(FIXTURES_ROOT, "skills/web-testing-vitest.md"),
    "utf-8",
  );
  await fsWrite(path.join(skillsDir, "web-testing-vitest.md"), vitestContent);

  // Commands
  const commandsDir = path.join(tempDir, "src/commands");
  await mkdir(commandsDir, { recursive: true });
  for (const file of ["deploy.md", "test.md"] as const) {
    const content = await fsReadFile(path.join(FIXTURES_ROOT, "commands", file), "utf-8");
    await fsWrite(path.join(commandsDir, file), content);
  }

  // CLAUDE.md for stack
  const stackDir = path.join(tempDir, "src/stacks/default");
  await mkdir(stackDir, { recursive: true });
  const claudeContent = await fsReadFile(
    path.join(FIXTURES_ROOT, "stacks/default/CLAUDE.md"),
    "utf-8",
  );
  await fsWrite(path.join(stackDir, "CLAUDE.md"), claudeContent);

  return tempDir;
}

function createCompileContext(
  projectRoot: string,
  overrides?: Partial<import("../types").CompileContext>,
): import("../types").CompileContext {
  return {
    stackId: "test-stack",
    verbose: false,
    projectRoot,
    outputDir: path.join(projectRoot, ".claude/plugins/claude-collective"),
    ...overrides,
  };
}

describe("compiler", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await createProjectFromFixtures();
  });

  afterEach(async () => {
    await cleanupTempDir(projectDir);
  });

  describe("compileAllAgents", () => {
    describe("output directory and file writing", () => {
      it("when compiling agents, should create the agents output directory", async () => {
        const engine = {
          renderFile: vi.fn().mockResolvedValue("---\nname: test\n---\n# Compiled output"),
        };

        const agents: Record<string, AgentConfig> = {
          "web-developer": createMockAgentConfig("web-developer", [
            createMockSkillEntry("web-framework-react", true),
          ]),
        };

        const ctx = createCompileContext(projectDir);
        await compileAllAgents(agents, ctx, engine as never);

        // Verify the output directory was actually created on disk
        const dirStat = await stat(path.join(ctx.outputDir, "agents"));
        expect(dirStat.isDirectory()).toBe(true);
      });

      it("when compiling agents, should write compiled agent to output file", async () => {
        const COMPILED_OUTPUT = "---\nname: test\n---\n# Compiled output";
        const engine = {
          renderFile: vi.fn().mockResolvedValue(COMPILED_OUTPUT),
        };

        const agents: Record<string, AgentConfig> = {
          "web-developer": createMockAgentConfig("web-developer", [
            createMockSkillEntry("web-framework-react", true),
          ]),
        };

        const ctx = createCompileContext(projectDir);
        await compileAllAgents(agents, ctx, engine as never);

        // Verify the file was actually written with correct content
        const outputPath = path.join(ctx.outputDir, "agents/web-developer.md");
        const content = await fsReadFile(outputPath, "utf-8");
        expect(content).toBe(COMPILED_OUTPUT);
      });
    });

    describe("reading agent source files", () => {
      it("when compiling an agent, should pass agent data to template engine", async () => {
        const engine = {
          renderFile: vi.fn().mockResolvedValue("---\nname: test\n---\n# output"),
        };

        const agents: Record<string, AgentConfig> = {
          "api-developer": createMockAgentConfig("api-developer"),
        };

        const ctx = createCompileContext(projectDir);
        await compileAllAgents(agents, ctx, engine as never);

        // Engine should receive data read from real fixture files
        expect(engine.renderFile).toHaveBeenCalledWith(
          "agent",
          expect.objectContaining({
            intro: expect.stringContaining("API Developer"),
            workflow: expect.stringContaining("Design the API"),
          }),
        );
      });

      it("when compiling an agent, should read optional files like examples.md", async () => {
        const engine = {
          renderFile: vi.fn().mockResolvedValue("---\nname: test\n---\n# output"),
        };

        const agents: Record<string, AgentConfig> = {
          "web-developer": createMockAgentConfig("web-developer"),
        };

        const ctx = createCompileContext(projectDir);
        await compileAllAgents(agents, ctx, engine as never);

        // Web developer fixture has an examples.md file
        expect(engine.renderFile).toHaveBeenCalledWith(
          "agent",
          expect.objectContaining({
            examples: expect.stringContaining("Build a React component"),
          }),
        );
      });
    });

    describe("error handling", () => {
      it("when agent file read fails, should throw descriptive error with agent name", async () => {
        const engine = { renderFile: vi.fn() };
        const agents: Record<string, AgentConfig> = {
          "web-developer": createMockAgentConfig("web-developer", [], {
            path: "nonexistent-agent",
          }),
        };

        await expect(
          compileAllAgents(agents, createCompileContext(projectDir), engine as never),
        ).rejects.toThrow(/Failed to compile agent 'web-developer'/);
      });
    });

    describe("output validation", () => {
      it("when compilation has warnings, should call validateCompiledAgent", async () => {
        vi.mocked(validateCompiledAgent).mockReturnValue({
          valid: true,
          errors: [],
          warnings: ["Missing <role> section"],
        });

        const engine = {
          renderFile: vi.fn().mockResolvedValue("---\nname: test\n---\n# output"),
        };

        const agents: Record<string, AgentConfig> = {
          "web-developer": createMockAgentConfig("web-developer"),
        };

        await compileAllAgents(agents, createCompileContext(projectDir), engine as never);

        expect(validateCompiledAgent).toHaveBeenCalled();
      });

      it("when validation has warnings, should print validation result", async () => {
        vi.mocked(validateCompiledAgent).mockReturnValue({
          valid: true,
          errors: [],
          warnings: ["Missing <role> section"],
        });

        const engine = {
          renderFile: vi.fn().mockResolvedValue("---\nname: test\n---\n# output"),
        };

        const agents: Record<string, AgentConfig> = {
          "web-developer": createMockAgentConfig("web-developer"),
        };

        await compileAllAgents(agents, createCompileContext(projectDir), engine as never);

        const { printOutputValidationResult } = await import("./output-validator");
        expect(printOutputValidationResult).toHaveBeenCalledWith(
          "web-developer",
          expect.objectContaining({ warnings: ["Missing <role> section"] }),
        );
      });
    });
  });

  describe("compileAllSkills", () => {
    it("copies folder-based skills with SKILL.md", async () => {
      const agents: Record<string, AgentConfig> = {
        "web-developer": createMockAgentConfig("web-developer", [
          createMockSkillEntry("web-framework-react"),
        ]),
      };
      agents["web-developer"].skills[0].path = "skills/web-framework-react/";

      const ctx = createCompileContext(projectDir);
      await compileAllSkills(agents, ctx);

      // Verify the skill file was actually copied to output
      const outputPath = path.join(ctx.outputDir, "skills/web-framework-react/SKILL.md");
      const content = await fsReadFile(outputPath, "utf-8");
      expect(content).toContain("React Framework");
    });

    it("copies single-file skills", async () => {
      const agents: Record<string, AgentConfig> = {
        "web-developer": createMockAgentConfig("web-developer", [
          { ...createMockSkillEntry("web-testing-vitest"), path: "skills/web-testing-vitest.md" },
        ]),
      };

      const ctx = createCompileContext(projectDir);
      await compileAllSkills(agents, ctx);

      // Verify single-file skill was written as SKILL.md in output
      const outputPath = path.join(ctx.outputDir, "skills/web-testing-vitest/SKILL.md");
      const content = await fsReadFile(outputPath, "utf-8");
      expect(content).toContain("Vitest Testing");
    });

    it("deduplicates skills across agents", async () => {
      const sharedSkill: Skill = {
        ...createMockSkillEntry("web-framework-react"),
        path: "skills/web-framework-react/",
      };

      const agents: Record<string, AgentConfig> = {
        "web-developer": createMockAgentConfig("web-developer", [sharedSkill]),
        "web-reviewer": createMockAgentConfig("web-reviewer", [sharedSkill]),
      };

      const ctx = createCompileContext(projectDir);
      await compileAllSkills(agents, ctx);

      // Verify the skill output exists and has correct content
      const outputPath = path.join(ctx.outputDir, "skills/web-framework-react/SKILL.md");
      const content = await fsReadFile(outputPath, "utf-8");
      expect(content).toContain("React Framework");
    });

    it("throws descriptive error when skill file is missing", async () => {
      const agents: Record<string, AgentConfig> = {
        "web-developer": createMockAgentConfig("web-developer", [
          { ...createMockSkillEntry("web-missing-skill"), path: "skills/missing.md" },
        ]),
      };

      await expect(compileAllSkills(agents, createCompileContext(projectDir))).rejects.toThrow(
        /Failed to compile skill 'web-missing-skill'/,
      );
    });
  });

  describe("copyClaudeMdToOutput", () => {
    it("reads resolved CLAUDE.md and writes to output", async () => {
      const ctx = createCompileContext(projectDir);
      await copyClaudeMdToOutput(ctx);

      // Verify CLAUDE.md was written to the plugins root (one level above outputDir)
      const outputPath = path.join(ctx.outputDir, "../CLAUDE.md");
      const content = await fsReadFile(outputPath, "utf-8");
      expect(content).toContain("Project-level instructions for Claude");
    });
  });

  describe("compileAllCommands", () => {
    it("skips when commands directory does not exist", async () => {
      // Create a project without commands dir
      const emptyProject = await createTempDir("compiler-no-cmds-");

      const ctx = createCompileContext(emptyProject);
      await compileAllCommands(ctx);

      // No output directory should be created
      await expect(stat(path.join(ctx.outputDir, "commands"))).rejects.toThrow();

      await cleanupTempDir(emptyProject);
    });

    it("copies command files to output directory", async () => {
      const ctx = createCompileContext(projectDir);
      await compileAllCommands(ctx);

      // Verify both command files were copied with correct content
      const deployContent = await fsReadFile(
        path.join(ctx.outputDir, "commands/deploy.md"),
        "utf-8",
      );
      expect(deployContent).toContain("Deploy the application");

      const testContent = await fsReadFile(path.join(ctx.outputDir, "commands/test.md"), "utf-8");
      expect(testContent).toContain("Run the test suite");
    });

    it("skips when no command files found", async () => {
      // Create a project with an empty commands dir
      const emptyProject = await createTempDir("compiler-empty-cmds-");
      const { mkdir } = await import("fs/promises");
      await mkdir(path.join(emptyProject, "src/commands"), { recursive: true });

      const ctx = createCompileContext(emptyProject);
      await compileAllCommands(ctx);

      // Commands output dir should not exist (no files to write)
      await expect(stat(path.join(ctx.outputDir, "commands"))).rejects.toThrow();

      await cleanupTempDir(emptyProject);
    });

    it("throws descriptive error when command file read fails", async () => {
      // Create a project with an unreadable command file
      const brokenProject = await createTempDir("compiler-bad-cmd-");
      const { mkdir, writeFile: fsWrite, chmod } = await import("fs/promises");
      const cmdDir = path.join(brokenProject, "src/commands");
      await mkdir(cmdDir, { recursive: true });
      await fsWrite(path.join(cmdDir, "deploy.md"), "content");
      await chmod(path.join(cmdDir, "deploy.md"), 0o000);

      await expect(compileAllCommands(createCompileContext(brokenProject))).rejects.toThrow(
        /Failed to compile command 'deploy\.md'/,
      );

      // Restore permissions for cleanup
      await chmod(path.join(cmdDir, "deploy.md"), 0o644);
      await cleanupTempDir(brokenProject);
    });
  });

  describe("removeCompiledOutputDirs", () => {
    it("removes agents, skills, and commands directories", async () => {
      const { mkdir } = await import("fs/promises");
      const outputDir = path.join(projectDir, "output-test");
      await mkdir(path.join(outputDir, "agents"), { recursive: true });
      await mkdir(path.join(outputDir, "skills"), { recursive: true });
      await mkdir(path.join(outputDir, "commands"), { recursive: true });

      await removeCompiledOutputDirs(outputDir);

      // Verify directories were removed
      await expect(stat(path.join(outputDir, "agents"))).rejects.toThrow();
      await expect(stat(path.join(outputDir, "skills"))).rejects.toThrow();
      await expect(stat(path.join(outputDir, "commands"))).rejects.toThrow();
    });
  });

  describe("createLiquidEngine", () => {
    it("creates engine with default template root", async () => {
      const engine = await createLiquidEngine();

      expect(engine).toBeDefined();
      expect(typeof engine.renderFile).toBe("function");
    });

    it("checks for local template overrides when projectDir provided", async () => {
      const engine = await createLiquidEngine(projectDir);

      expect(engine).toBeDefined();
    });
  });

  describe("sanitizeLiquidSyntax", () => {
    it("returns clean strings unchanged", () => {
      expect(sanitizeLiquidSyntax("Web Developer", "test")).toBe("Web Developer");
    });

    it("strips {{ and }} delimiters from input", () => {
      const result = sanitizeLiquidSyntax('{{ include "../../../etc/passwd" }}', "agent.name");
      expect(result).toBe(' include "../../../etc/passwd" ');
      expect(result).not.toContain("{{");
      expect(result).not.toContain("}}");
    });

    it("strips {% and %} delimiters from input", () => {
      const result = sanitizeLiquidSyntax('{% assign x = "malicious" %}', "agent.name");
      expect(result).toBe(' assign x = "malicious" ');
      expect(result).not.toContain("{%");
      expect(result).not.toContain("%}");
    });

    it("strips mixed Liquid delimiters", () => {
      const result = sanitizeLiquidSyntax("{{ x }}{% if true %}evil{% endif %}", "agent.name");
      expect(result).not.toContain("{{");
      expect(result).not.toContain("}}");
      expect(result).not.toContain("{%");
      expect(result).not.toContain("%}");
    });

    it("warns when stripping Liquid syntax", () => {
      sanitizeLiquidSyntax("{{ malicious }}", "agent.name");
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Stripped Liquid template syntax from 'agent.name'"),
      );
    });

    it("does not warn for clean strings", () => {
      vi.mocked(warn).mockClear();
      sanitizeLiquidSyntax("Clean Agent Name", "agent.name");
      expect(warn).not.toHaveBeenCalled();
    });

    it("handles strings with only Liquid delimiters", () => {
      expect(sanitizeLiquidSyntax("{{}}", "test")).toBe("");
      expect(sanitizeLiquidSyntax("{%%}", "test")).toBe("");
    });

    it("handles nested/repeated delimiters", () => {
      const result = sanitizeLiquidSyntax("{{ {{ nested }} }}", "test");
      expect(result).not.toContain("{{");
      expect(result).not.toContain("}}");
    });
  });

  describe("sanitizeCompiledAgentData", () => {
    function createTestAgentData(overrides?: Partial<AgentConfig>): CompiledAgentData {
      const agent: AgentConfig = {
        name: "test-agent",
        title: "Test Agent",
        description: "A test agent",
        tools: ["Read", "Write"],
        skills: [],
        ...overrides,
      };

      return {
        agent,
        intro: "Test intro",
        workflow: "Test workflow",
        examples: "Test examples",
        criticalRequirementsTop: "",
        criticalReminders: "",
        outputFormat: "",
        skills: agent.skills,
        preloadedSkills: [],
        dynamicSkills: [],
        preloadedSkillIds: [],
      };
    }

    it("passes through clean data unchanged", () => {
      const data = createTestAgentData();
      const result = sanitizeCompiledAgentData(data);

      expect(result.agent.name).toBe("test-agent");
      expect(result.agent.title).toBe("Test Agent");
      expect(result.agent.description).toBe("A test agent");
      expect(result.intro).toBe("Test intro");
    });

    it("sanitizes Liquid syntax in agent.name", () => {
      const data = createTestAgentData({ name: '{{ forked_from.source | join: "|" }}' });
      const result = sanitizeCompiledAgentData(data);

      expect(result.agent.name).not.toContain("{{");
      expect(result.agent.name).not.toContain("}}");
    });

    it("sanitizes Liquid syntax in agent.title", () => {
      const data = createTestAgentData({ title: "{% include 'malicious' %}" });
      const result = sanitizeCompiledAgentData(data);

      expect(result.agent.title).not.toContain("{%");
      expect(result.agent.title).not.toContain("%}");
    });

    it("sanitizes Liquid syntax in agent.description", () => {
      const data = createTestAgentData({ description: "{{ evil }}" });
      const result = sanitizeCompiledAgentData(data);

      expect(result.agent.description).not.toContain("{{");
    });

    it("sanitizes Liquid syntax in agent.tools array", () => {
      const data = createTestAgentData({ tools: ["Read", "{{ malicious }}"] });
      const result = sanitizeCompiledAgentData(data);

      expect(result.agent.tools[0]).toBe("Read");
      expect(result.agent.tools[1]).not.toContain("{{");
    });

    it("sanitizes Liquid syntax in file content fields", () => {
      const data = createTestAgentData();
      data.intro = "Normal text {{ inject }} more text";
      data.workflow = "{% assign x = 1 %} workflow";
      data.examples = "{{ forked_from }} examples";

      const result = sanitizeCompiledAgentData(data);

      expect(result.intro).not.toContain("{{");
      expect(result.workflow).not.toContain("{%");
      expect(result.examples).not.toContain("{{");
    });

    it("sanitizes Liquid syntax in skill metadata", () => {
      const skill = createMockSkillEntry("web-framework-react", true, {
        description: "{{ malicious }} skill",
        usage: "{% evil %} usage",
      });

      const data = createTestAgentData();
      data.skills = [skill];
      data.preloadedSkills = [skill];
      data.preloadedSkillIds = [skill.id];

      const result = sanitizeCompiledAgentData(data);

      expect(result.skills[0].description).not.toContain("{{");
      expect(result.skills[0].usage).not.toContain("{%");
    });

    it("preserves undefined optional fields", () => {
      const data = createTestAgentData({ model: undefined, permission_mode: undefined });
      const result = sanitizeCompiledAgentData(data);

      expect(result.agent.model).toBeUndefined();
      expect(result.agent.permission_mode).toBeUndefined();
    });

    it("sanitizes optional string fields when present", () => {
      const data = createTestAgentData({
        model: "{{ inject }}" as AgentConfig["model"],
        permission_mode: "{% evil %}" as AgentConfig["permission_mode"],
      });
      const result = sanitizeCompiledAgentData(data);

      expect(String(result.agent.model)).not.toContain("{{");
      expect(String(result.agent.permission_mode)).not.toContain("{%");
    });
  });

  describe("template injection prevention (integration)", () => {
    it("when agent.name contains Liquid syntax, should not execute it", async () => {
      const engine = {
        renderFile: vi.fn().mockResolvedValue("---\nname: test\n---\n# output"),
      };

      const agents: Record<string, AgentConfig> = {
        "web-developer": createMockAgentConfig("web-developer", [], {
          name: '{{ "INJECTED" }}',
          title: "{% assign x = 1 %}Injected",
        }),
      };

      const ctx = createCompileContext(projectDir);
      await compileAllAgents(agents, ctx, engine as never);

      // Verify sanitized data was passed to the engine
      const renderCall = engine.renderFile.mock.calls[0][1] as CompiledAgentData;
      expect(renderCall.agent.name).not.toContain("{{");
      expect(renderCall.agent.name).not.toContain("}}");
      expect(renderCall.agent.title).not.toContain("{%");
      expect(renderCall.agent.title).not.toContain("%}");
    });
  });
});
